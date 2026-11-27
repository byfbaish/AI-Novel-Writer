import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  captureSecureRootIdentity,
  normalizeSecureRelativePath,
  type SecureFileCapability,
  type SecureRootIdentity,
} from '../security/windows-safe-file-system'

/**
 * 授权失败的完整码表。抛点是唯一的产码处，控制器只按这里列出的码转界面文案，
 * 不再匹配中文 message；新增或改名必须同步改本表、抛点与控制器用例。
 */
export const EXTERNAL_FILE_GRANT_ERROR_CODES = [
  'EXTERNAL_FILE_GRANT_PATH_ABSOLUTE',
  'EXTERNAL_FILE_GRANT_PATH_INVALID_NUL',
  'EXTERNAL_FILE_GRANT_PATH_TRAVERSAL',
  'EXTERNAL_FILE_GRANT_PATH_INVALID_NORMALIZE',
  'EXTERNAL_FILE_GRANT_TARGET_DIRECTORY_NOT_FOUND',
  'EXTERNAL_FILE_GRANT_TARGET_FILE_NOT_FOUND',
  'EXTERNAL_FILE_GRANT_TARGET_PARENT_NOT_FOUND',
  'EXTERNAL_FILE_GRANT_PATH_INVALID_CHILD_NAME',
  'EXTERNAL_FILE_GRANT_INVALID_TTL_MS',
  'EXTERNAL_FILE_GRANT_INVALID_MAX_USES',
  'EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_EXACT_PATH',
  'EXTERNAL_FILE_GRANT_TARGET_CHANGED_EXACT_PATH',
  'EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_DIRECTORY',
  'EXTERNAL_FILE_GRANT_TARGET_CHANGED_DIRECTORY',
  'EXTERNAL_FILE_GRANT_UNKNOWN_GRANT',
  'EXTERNAL_FILE_GRANT_EXPIRED',
  'EXTERNAL_FILE_GRANT_EXHAUSTED',
  'EXTERNAL_FILE_GRANT_WINDOW_MISMATCH',
  'EXTERNAL_FILE_GRANT_OPERATION_NOT_GRANTED',
  'EXTERNAL_FILE_GRANT_EXACT_SUBPATH_REJECTED',
  'EXTERNAL_FILE_GRANT_TARGET_INVALID',
] as const

export type ExternalFileGrantErrorCode = typeof EXTERNAL_FILE_GRANT_ERROR_CODES[number]

/**
 * 与 `windows-safe-file-system.ts` 的 `secureError` 同风格：码挂在 `code` 上，
 * 中文诊断文案仍留在 `message`（它们是 i18n 现值，逐字保留）。
 */
function grantError(code: ExternalFileGrantErrorCode, message: string): Error {
  return Object.assign(new Error(message), { code })
}

/**
 * 短期外部文件授权由主进程签发并保存在内存中。渲染进程只能携带授权标识，
 * 不能借此传入任意绝对路径。
 */
export type ExternalFileGrantOperation = 'read' | 'list' | 'write' | 'create' | 'show'
  | 'project-create' | 'project-open' | 'legacy-import'

export interface ExternalFileGrantRequest {
  grantId: string
  webContentsId: number
  operation: ExternalFileGrantOperation
  relativePath?: string
}

export interface ExternalFileGrantServiceOptions {
  now?: () => number
  newGrantId?: () => string
}

export interface DirectoryExternalFileGrantOptions {
  webContentsId: number
  directoryPath: string
  operations: readonly ExternalFileGrantOperation[]
  ttlMs: number
  maxUses?: number
}

export interface FileExternalFileGrantOptions {
  webContentsId: number
  filePath: string
  operations: readonly ExternalFileGrantOperation[]
  ttlMs: number
  maxUses?: number
}

export interface IssuedExternalFileGrant {
  grantId: string
  expiresAt: number
}

/**
 * This is an opaque main-process capability, not a path approved for Node fs.
 * Controllers must hand it to windowsSafeFileSystem, which opens it from the
 * root handle without following reparse points.
 */
export interface ResolvedExternalFileGrant extends SecureFileCapability {
  scope: 'file' | 'directory'
}

interface ExternalFileGrantRecord {
  webContentsId: number
  scope: 'file' | 'directory'
  rootPath: string
  rootIdentity: SecureRootIdentity
  fixedRelativePath: string | null
  operations: ReadonlySet<ExternalFileGrantOperation>
  expiresAt: number
  usesRemaining: number
  deleteOnConsume: boolean
}

function assertSafeRelativePath(relativePath: string): void {
  if (
    path.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || path.posix.isAbsolute(relativePath)
  ) {
    throw grantError('EXTERNAL_FILE_GRANT_PATH_ABSOLUTE', '外部文件授权的相对路径不能是绝对路径')
  }
  if (relativePath.includes('\0')) {
    throw grantError('EXTERNAL_FILE_GRANT_PATH_INVALID_NUL', '外部文件授权的相对路径无效')
  }
  if (relativePath.split(/[\\/]+/).some(segment => segment === '..')) {
    throw grantError('EXTERNAL_FILE_GRANT_PATH_TRAVERSAL', '外部文件授权的相对路径不得包含父目录遍历')
  }
}

function normalizedRelativePath(relativePath: string): string {
  assertSafeRelativePath(relativePath)
  try {
    return normalizeSecureRelativePath(relativePath)
  } catch {
    throw grantError('EXTERNAL_FILE_GRANT_PATH_INVALID_NORMALIZE', '外部文件授权的相对路径无效')
  }
}

export class ExternalFileGrantService {
  private readonly now: () => number
  private readonly newGrantId: () => string
  private readonly grants = new Map<string, ExternalFileGrantRecord>()

  constructor(options: ExternalFileGrantServiceOptions = {}) {
    this.now = options.now ?? Date.now
    this.newGrantId = options.newGrantId ?? randomUUID
  }

  issueDirectory(options: DirectoryExternalFileGrantOptions): IssuedExternalFileGrant {
    const targetPath = fs.realpathSync.native(options.directoryPath)
    if (!fs.statSync(targetPath).isDirectory()) {
      throw grantError('EXTERNAL_FILE_GRANT_TARGET_DIRECTORY_NOT_FOUND', '外部文件授权目录必须是已存在的目录')
    }
    return this.issue({
      webContentsId: options.webContentsId,
      scope: 'directory',
      rootPath: targetPath,
      rootIdentity: captureSecureRootIdentity(targetPath),
      fixedRelativePath: null,
      operations: options.operations,
      ttlMs: options.ttlMs,
      maxUses: options.maxUses,
    })
  }

  issueFile(options: FileExternalFileGrantOptions): IssuedExternalFileGrant {
    const targetPath = fs.realpathSync.native(options.filePath)
    if (!fs.statSync(targetPath).isFile()) {
      throw grantError('EXTERNAL_FILE_GRANT_TARGET_FILE_NOT_FOUND', '外部文件授权目标必须是已存在的文件')
    }
    const rootPath = path.dirname(targetPath)
    return this.issue({
      webContentsId: options.webContentsId,
      scope: 'file',
      rootPath,
      rootIdentity: captureSecureRootIdentity(rootPath),
      fixedRelativePath: path.basename(targetPath),
      operations: options.operations,
      ttlMs: options.ttlMs,
      maxUses: options.maxUses,
    })
  }

  /**
   * 为用户在保存对话框或“新建文件夹”选择器中选定、可能尚不存在的单一子项签发精确授权。
   * 授权固定父目录与子项名称，渲染进程既不能改名也不能追加子路径。
   */
  issueNewChild(options: FileExternalFileGrantOptions): IssuedExternalFileGrant {
    const requestedPath = path.resolve(options.filePath)
    const name = path.basename(requestedPath)
    const rootPath = fs.realpathSync.native(path.dirname(requestedPath))
    if (!fs.statSync(rootPath).isDirectory()) {
      throw grantError('EXTERNAL_FILE_GRANT_TARGET_PARENT_NOT_FOUND', '外部文件授权的父目录必须是已存在的目录')
    }
    if (name === '' || normalizedRelativePath(name) !== name) {
      throw grantError('EXTERNAL_FILE_GRANT_PATH_INVALID_CHILD_NAME', '外部文件授权的相对路径无效')
    }
    return this.issue({
      webContentsId: options.webContentsId,
      scope: 'file',
      rootPath,
      rootIdentity: captureSecureRootIdentity(rootPath),
      fixedRelativePath: name,
      operations: options.operations,
      ttlMs: options.ttlMs,
      maxUses: options.maxUses,
    })
  }

  revoke(grantId: string): void {
    this.grants.delete(grantId)
  }

  revokeWebContents(webContentsId: number): void {
    for (const [grantId, grant] of this.grants) {
      if (grant.webContentsId === webContentsId) {
        this.grants.delete(grantId)
      }
    }
  }

  activeCount(): number {
    return this.grants.size
  }

  private issue(options: {
    webContentsId: number
    scope: 'file' | 'directory'
    rootPath: string
    rootIdentity: SecureRootIdentity
    fixedRelativePath: string | null
    operations: readonly ExternalFileGrantOperation[]
    ttlMs: number
    maxUses?: number
  }): IssuedExternalFileGrant {
    if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) {
      throw grantError('EXTERNAL_FILE_GRANT_INVALID_TTL_MS', '外部文件授权有效期必须为正数')
    }
    const maxUses = options.maxUses ?? 1
    if (!Number.isSafeInteger(maxUses) || maxUses <= 0) {
      throw grantError('EXTERNAL_FILE_GRANT_INVALID_MAX_USES', '外部文件授权使用次数必须是正整数')
    }

    const grantId = this.newGrantId()
    const expiresAt = this.now() + options.ttlMs
    this.grants.set(grantId, {
      webContentsId: options.webContentsId,
      scope: options.scope,
      rootPath: options.rootPath,
      rootIdentity: options.rootIdentity,
      fixedRelativePath: options.fixedRelativePath,
      operations: new Set(options.operations),
      expiresAt,
      usesRemaining: maxUses,
      deleteOnConsume: maxUses === 1,
    })
    return { grantId, expiresAt }
  }

  resolve(request: ExternalFileGrantRequest): ResolvedExternalFileGrant {
    return this.resolveRequest(request, true)
  }

  /**
   * 仅供主进程在同一次已授权业务操作的临界点复核边界；不会新增一次使用。
   * 渲染进程从未得到该服务实例，不能借此绕过有限次数约束。
   */
  revalidate(request: ExternalFileGrantRequest): ResolvedExternalFileGrant {
    return this.resolveRequest(request, false)
  }

  /**
   * 仅供主进程内仍以路径为入参、并自行做无跟随/防覆盖校验的服务（便携归档导出与恢复）使用：
   * 把一次精确文件授权解析成路径。目录范围授权不能冒充精确授权（且不会被消费），
   * 并在交出路径前复核授权时的父目录仍是同一个目录。渲染进程拿不到本服务实例。
   */
  resolveExactPath(request: Omit<ExternalFileGrantRequest, 'relativePath'>): string {
    if (this.revalidate(request).scope !== 'file') {
      throw grantError('EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_EXACT_PATH', '外部文件授权范围不符')
    }
    const target = this.resolve(request)
    const current = captureSecureRootIdentity(target.rootPath)
    if (
      current.volumeSerialNumber !== target.rootIdentity.volumeSerialNumber
      || current.fileIndex !== target.rootIdentity.fileIndex
    ) {
      throw grantError('EXTERNAL_FILE_GRANT_TARGET_CHANGED_EXACT_PATH', '外部文件授权目标已变化')
    }
    return path.join(target.rootPath, target.relativePath)
  }

  /** Project services own their internal paths; only the selected root crosses this boundary. */
  resolveDirectoryPath(request: Omit<ExternalFileGrantRequest, 'relativePath'>): string {
    const target = this.revalidate(request)
    if (target.scope !== 'directory' || target.relativePath !== '') {
      throw grantError('EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_DIRECTORY', '外部文件授权范围不符')
    }
    const current = captureSecureRootIdentity(target.rootPath)
    if (current.volumeSerialNumber !== target.rootIdentity.volumeSerialNumber
      || current.fileIndex !== target.rootIdentity.fileIndex) {
      throw grantError('EXTERNAL_FILE_GRANT_TARGET_CHANGED_DIRECTORY', '外部文件授权目标已变化')
    }
    this.resolve(request)
    return target.rootPath
  }

  private resolveRequest(
    request: ExternalFileGrantRequest,
    consumeUse: boolean,
  ): ResolvedExternalFileGrant {
    const grant = this.grants.get(request.grantId)
    if (!grant) {
      throw grantError('EXTERNAL_FILE_GRANT_UNKNOWN_GRANT', '外部文件授权不存在或已失效')
    }
    if (this.now() >= grant.expiresAt) {
      this.grants.delete(request.grantId)
      throw grantError('EXTERNAL_FILE_GRANT_EXPIRED', '外部文件授权已过期')
    }
    if (consumeUse && grant.usesRemaining <= 0) {
      throw grantError('EXTERNAL_FILE_GRANT_EXHAUSTED', '外部文件授权已用尽')
    }
    if (grant.webContentsId !== request.webContentsId) {
      throw grantError('EXTERNAL_FILE_GRANT_WINDOW_MISMATCH', '外部文件授权不属于当前窗口')
    }
    if (!grant.operations.has(request.operation)) {
      throw grantError('EXTERNAL_FILE_GRANT_OPERATION_NOT_GRANTED', `外部文件授权未授予 ${request.operation} 操作`)
    }

    const requestedRelativePath = request.relativePath ?? ''
    let relativePath: string
    if (grant.scope === 'file') {
      if (requestedRelativePath !== '' && requestedRelativePath !== '.') {
        throw grantError('EXTERNAL_FILE_GRANT_EXACT_SUBPATH_REJECTED', '精确文件授权不接受子路径')
      }
      if (!grant.fixedRelativePath) {
        throw grantError('EXTERNAL_FILE_GRANT_TARGET_INVALID', '外部文件授权目标无效')
      }
      relativePath = grant.fixedRelativePath
    } else {
      relativePath = normalizedRelativePath(requestedRelativePath)
    }
    if (consumeUse) {
      grant.usesRemaining -= 1
      if (grant.usesRemaining === 0 && grant.deleteOnConsume) this.grants.delete(request.grantId)
    }
    return {
      rootPath: grant.rootPath,
      relativePath,
      rootIdentity: grant.rootIdentity,
      scope: grant.scope,
    }
  }
}

/** 主进程进程内唯一授权登记处；授权绝不落盘。 */
export const externalFileGrants = new ExternalFileGrantService()
