import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, dialog, ipcMain } from 'electron'

import type { ExternalFileGrant } from '../../src/shared/ipc-channels'
import {
  USER_SETTINGS_PACK_EXTENSION,
  type UserSettingsPackErrorCode,
  type UserSettingsPackExportRequest,
  type UserSettingsPackImportRequest,
  type UserSettingsPackInspectRequest,
} from '../../src/shared/user-settings-pack'
import {
  ExternalFileGrantService,
  externalFileGrants,
  type IssuedExternalFileGrant,
} from '../services/external-file-grant-service'
import { readUserSettingsPackArchive, writeUserSettingsPackArchive } from '../services/user-settings-pack-archive'
import { fail } from '../services/user-settings-pack-format'
import {
  applyUserSettingsPack,
  collectCreativeAssetsPack,
  findPackConflicts,
  summarizePack,
} from '../services/user-settings-pack-service'

/**
 * 用户级「创作资产包」控制器。
 *
 * 与 `project:archive-*` 并列，但**不依赖项目会话**：备份用户设置时通常没有打开任何项目，
 * 因此本入口必须独立于项目会话存在。
 */

const USER_PACK_ERROR_CODES = new Set<UserSettingsPackErrorCode>([
  'USER_PACK_INVALID',
  'USER_PACK_LIMIT_EXCEEDED',
  'USER_PACK_VERSION_UNSUPPORTED',
  'USER_PACK_GRANT_INVALID',
  'USER_PACK_TARGET_EXISTS',
  'USER_PACK_SOURCE_UNSAFE',
  'USER_PACK_EMPTY',
  'USER_PACK_CONTENT_REJECTED',
])

const PACK_GRANT_TTL_MS = 10 * 60 * 1_000
/** 检查结果保留时间：导入只使用检查时读到的字节，故需要短时缓存。 */
const INSPECT_CACHE_TTL_MS = 10 * 60 * 1_000
const MAX_INSPECT_CACHE = 8

function failure(error: unknown) {
  const candidate = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code
    : error instanceof Error ? error.message : undefined
  const errorCode = USER_PACK_ERROR_CODES.has(candidate as UserSettingsPackErrorCode)
    ? candidate as UserSettingsPackErrorCode
    : undefined
  return {
    success: false as const,
    error: error instanceof Error ? error.message : String(error),
    ...(errorCode ? { errorCode } : {}),
  }
}

function safeSuggestedName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const safe = Array.from(value.trim(), character => (
    character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character
  )).join('')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  return safe || fallback
}

interface PackGrantEvent {
  sender: {
    id: number
    once: (event: 'destroyed', listener: () => void) => unknown
  }
}

function issueSelectedGrant(
  grants: ExternalFileGrantService,
  event: PackGrantEvent,
  issued: IssuedExternalFileGrant,
  selectedPath: string,
): ExternalFileGrant {
  event.sender.once('destroyed', () => grants.revoke(issued.grantId))
  return { grantId: issued.grantId, displayName: path.basename(selectedPath) }
}

function resolveGrantedPath(
  grants: ExternalFileGrantService,
  event: PackGrantEvent,
  grantId: unknown,
  operation: 'read' | 'create',
): string {
  try {
    if (typeof grantId !== 'string' || grantId === '') throw new Error('grant missing')
    return grants.resolveExactPath({ grantId, webContentsId: event.sender.id, operation })
  } catch {
    throw Object.assign(new Error('USER_PACK_GRANT_INVALID'), { code: 'USER_PACK_GRANT_INVALID' })
  }
}

interface InspectCacheEntry {
  webContentsId: number
  expiresAt: number
  manifest: ReturnType<typeof collectCreativeAssetsPack>['manifest']
  files: Map<string, Buffer>
}

export function registerUserSettingsPackageController(
  grants: ExternalFileGrantService = externalFileGrants,
): void {
  const inspected = new Map<string, InspectCacheEntry>()

  const pruneInspected = (): void => {
    const now = Date.now()
    for (const [id, entry] of inspected) {
      if (entry.expiresAt <= now) inspected.delete(id)
    }
    while (inspected.size > MAX_INSPECT_CACHE) {
      const oldest = inspected.keys().next().value
      if (oldest === undefined) break
      inspected.delete(oldest)
    }
  }

  ipcMain.handle('dialog:select-settings-pack-export', async (event: PackGrantEvent, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: '导出创作资产包',
      defaultPath: `${safeSuggestedName(suggestedName, 'creative-assets')}.${USER_SETTINGS_PACK_EXTENSION}`,
      filters: [{ name: 'Vela Creative Assets', extensions: [USER_SETTINGS_PACK_EXTENSION] }],
      properties: ['createDirectory'],
    })
    if (result.canceled || !result.filePath) return null
    if (fs.existsSync(result.filePath)) {
      throw new Error('目标文件已存在，请选择其他文件名。创作资产包不会覆盖已有文件。')
    }
    const issued = grants.issueNewChild({
      webContentsId: event.sender.id,
      filePath: result.filePath,
      operations: ['create'],
      ttlMs: PACK_GRANT_TTL_MS,
      maxUses: 1,
    })
    return issueSelectedGrant(grants, event, issued, result.filePath)
  })

  ipcMain.handle('dialog:select-settings-pack-import', async (event: PackGrantEvent) => {
    const result = await dialog.showOpenDialog({
      title: '选择创作资产包',
      filters: [{ name: 'Vela Creative Assets', extensions: [USER_SETTINGS_PACK_EXTENSION] }],
      properties: ['openFile'],
    })
    const archivePath = result.canceled ? undefined : result.filePaths[0]
    if (!archivePath) return null
    const issued = grants.issueFile({
      webContentsId: event.sender.id,
      filePath: archivePath,
      operations: ['read'],
      ttlMs: PACK_GRANT_TTL_MS,
      maxUses: 1,
    })
    return issueSelectedGrant(grants, event, issued, archivePath)
  })

  ipcMain.handle('settings-pack:export', async (event: PackGrantEvent, request: UserSettingsPackExportRequest) => {
    try {
      const targetPath = resolveGrantedPath(grants, event, request.targetGrantId, 'create')
      const collected = collectCreativeAssetsPack({ appVersion: app.getVersion() })
      const receipt = await writeUserSettingsPackArchive({
        manifest: collected.manifest,
        files: collected.files,
        targetPath,
      })
      return {
        success: true as const,
        receipt: {
          summary: summarizePack(collected.manifest),
          targetSha256: receipt.manifestSha256,
          targetByteSize: receipt.archiveBytes,
          diagnostics: collected.diagnostics,
        },
      }
    } catch (error) {
      return failure(error)
    }
  })

  ipcMain.handle('settings-pack:inspect', async (event: PackGrantEvent, request: UserSettingsPackInspectRequest) => {
    try {
      const archivePath = resolveGrantedPath(grants, event, request.archiveGrantId, 'read')
      const read = await readUserSettingsPackArchive({ archivePath })
      pruneInspected()
      const inspectId = randomUUID()
      inspected.set(inspectId, {
        webContentsId: event.sender.id,
        expiresAt: Date.now() + INSPECT_CACHE_TTL_MS,
        manifest: read.manifest,
        files: read.files,
      })
      return {
        success: true as const,
        receipt: {
          inspectId,
          summary: summarizePack(read.manifest),
          conflicts: findPackConflicts(read.manifest),
          diagnostics: [],
        },
      }
    } catch (error) {
      return failure(error)
    }
  })

  ipcMain.handle('settings-pack:import', async (event: PackGrantEvent, request: UserSettingsPackImportRequest) => {
    try {
      pruneInspected()
      const entry = inspected.get(request.inspectId)
      if (!entry || entry.webContentsId !== event.sender.id || entry.expiresAt <= Date.now()) {
        inspected.delete(request.inspectId)
        fail('USER_PACK_GRANT_INVALID')
      }
      const receipt = applyUserSettingsPack({
        manifest: entry.manifest,
        files: entry.files,
        conflictStrategy: request.conflictStrategy,
        importPrompts: request.importPrompts !== false,
        importSkills: request.importSkills !== false,
      })
      inspected.delete(request.inspectId)
      return { success: true as const, receipt }
    } catch (error) {
      return failure(error)
    }
  })
}
