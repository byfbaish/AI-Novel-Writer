import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type IpcHandler = (...args: unknown[]) => Promise<unknown>

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  showOpenDialog: vi.fn(),
  locale: 'zh-CN',
}))

vi.mock('electron', () => ({
  app: { getLocale: () => mocks.locale },
  dialog: { showOpenDialog: mocks.showOpenDialog },
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      mocks.handlers.set(channel, handler)
    }),
  },
}))

import { registerExternalFileGrantController } from '../external-file-grant-controller'
import {
  EXTERNAL_FILE_GRANT_ERROR_CODES,
  ExternalFileGrantService,
} from '../../services/external-file-grant-service'
import type { SecureFileCapability, WindowsSafeFileSystem } from '../../security/windows-safe-file-system'

const LOCALES = ['zh-CN', 'en-US'] as const

type LocaleTexts = Record<typeof LOCALES[number], string>

const PATH_INVALID_TEXT: LocaleTexts = {
  'zh-CN': '外部文件授权路径无效，已拒绝操作。',
  'en-US': 'The external file grant path is invalid; the operation was rejected.',
}
const GRANT_INVALID_TEXT: LocaleTexts = {
  'zh-CN': '外部文件授权已失效，请重新选择。',
  'en-US': 'The external file grant has expired. Please choose again.',
}
const NO_PERMISSION_TEXT: LocaleTexts = {
  'zh-CN': '当前窗口无权使用该外部文件授权。',
  'en-US': 'This window is not allowed to use the external file grant.',
}
const FALLBACK_TEXT: LocaleTexts = {
  'zh-CN': '外部文件授权操作失败。',
  'en-US': 'The external file grant operation failed.',
}

/** 服务层每个抛点的码只在这里落一次文案；本表必须与 `EXTERNAL_FILE_GRANT_ERROR_CODES` 等长。 */
const CONTROLLER_MAPPING: ReadonlyArray<readonly [string, LocaleTexts]> = [
  ['EXTERNAL_FILE_GRANT_PATH_ABSOLUTE', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_PATH_INVALID_NUL', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_PATH_TRAVERSAL', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_PATH_INVALID_NORMALIZE', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_PATH_INVALID_CHILD_NAME', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_TARGET_DIRECTORY_NOT_FOUND', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_TARGET_FILE_NOT_FOUND', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_TARGET_PARENT_NOT_FOUND', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_TARGET_INVALID', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_EXACT_PATH', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_DIRECTORY', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_TARGET_CHANGED_EXACT_PATH', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_TARGET_CHANGED_DIRECTORY', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_EXACT_SUBPATH_REJECTED', PATH_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_UNKNOWN_GRANT', GRANT_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_EXPIRED', GRANT_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_EXHAUSTED', GRANT_INVALID_TEXT],
  ['EXTERNAL_FILE_GRANT_WINDOW_MISMATCH', NO_PERMISSION_TEXT],
  ['EXTERNAL_FILE_GRANT_OPERATION_NOT_GRANTED', NO_PERMISSION_TEXT],
  ['EXTERNAL_FILE_GRANT_INVALID_TTL_MS', FALLBACK_TEXT],
  ['EXTERNAL_FILE_GRANT_INVALID_MAX_USES', FALLBACK_TEXT],
]

const capability: SecureFileCapability = {
  rootPath: 'C:\\fixture-root',
  relativePath: 'note.md',
  rootIdentity: { volumeSerialNumber: '1', fileIndex: '2' },
}

function grantsStub(): ExternalFileGrantService {
  return {
    resolve: () => ({ ...capability, scope: 'directory' }),
    revalidate: () => ({ ...capability, scope: 'directory' }),
    issueDirectory: () => ({ grantId: 'fixture-grant', expiresAt: 0 }),
    revokeWebContents: () => undefined,
  } as unknown as ExternalFileGrantService
}

function failingFileSystem(error: unknown): WindowsSafeFileSystem {
  const fail = async () => {
    throw error
  }
  return {
    readText: fail,
    writeTextAtomically: fail,
    mkdir: fail,
    exists: async () => true,
    listDirectory: fail,
  } as unknown as WindowsSafeFileSystem
}

function handler(channel: string): IpcHandler {
  const registered = mocks.handlers.get(channel)
  if (!registered) throw new Error(`Missing IPC handler: ${channel}`)
  return registered
}

function event(webContentsId = 17) {
  return { sender: { id: webContentsId, once: vi.fn() } }
}

/** 故意把中文诊断写成另一分支的旧文案：控制器若还在匹配 message 就会走错。 */
function registerCode(code: string | undefined, message = '外部文件授权已过期'): void {
  mocks.handlers.clear()
  registerExternalFileGrantController(
    grantsStub(),
    failingFileSystem(code === undefined ? new Error(message) : Object.assign(new Error(message), { code })),
  )
}

function readFile(): Promise<unknown> {
  return handler('fs:grant-read-file')(event(), 'fixture-grant', 'note.md')
}

describe('授权服务层错误码 → 控制器文案', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.showOpenDialog.mockReset()
  })

  it('码表 21 条、互不重复，且控制器映射无遗漏无多余', () => {
    expect(EXTERNAL_FILE_GRANT_ERROR_CODES).toHaveLength(21)
    expect(new Set(EXTERNAL_FILE_GRANT_ERROR_CODES).size).toBe(21)
    expect(CONTROLLER_MAPPING.map(([code]) => code).sort())
      .toEqual([...EXTERNAL_FILE_GRANT_ERROR_CODES].sort())
  })

  for (const locale of LOCALES) {
    describe(`界面语言 ${locale}`, () => {
      beforeEach(() => {
        mocks.locale = locale
      })

      it.each(CONTROLLER_MAPPING)('%s 命中对应说明（不看中文 message）', async (code, expected) => {
        registerCode(code)
        await expect(readFile()).resolves.toEqual({
          success: false,
          content: '',
          error: expected[locale],
        })
      })
    })
  }

  it('未登记的授权码与不带码的中文错误一律落兜底', async () => {
    mocks.locale = 'zh-CN'
    registerCode('EXTERNAL_FILE_GRANT_UNRECOGNIZED_SEGMENT')
    await expect(readFile()).resolves.toEqual({
      success: false,
      content: '',
      error: FALLBACK_TEXT['zh-CN'],
    })
    registerCode(undefined, '外部文件授权已过期')
    await expect(readFile()).resolves.toEqual({
      success: false,
      content: '',
      error: FALLBACK_TEXT['zh-CN'],
    })
  })

  it('英文界面下按码分流的结果不含中文', async () => {
    mocks.locale = 'en-US'
    registerCode('EXTERNAL_FILE_GRANT_WINDOW_MISMATCH')
    const result = await readFile() as { error: string }
    expect(result.error).toBe(NO_PERMISSION_TEXT['en-US'])
    expect(result.error).not.toMatch(/[\u4e00-\u9fff]/)
  })
})

const serviceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-external-grant-codes-'))
const serviceSourcePath = fileURLToPath(
  new URL('../../services/external-file-grant-service.ts', import.meta.url),
)
const CHINESE_MESSAGE = /[\u4e00-\u9fff]/

function workspace(name: string): { root: string; file: string } {
  const root = path.join(serviceRoot, name)
  fs.mkdirSync(root, { recursive: true })
  const file = path.join(root, 'note.md')
  fs.writeFileSync(file, 'note', 'utf8')
  return { root, file }
}

function service(now: () => number = () => 1_000): ExternalFileGrantService {
  return new ExternalFileGrantService({ now, newGrantId: () => 'grant-fixture' })
}

function thrown(operation: () => unknown): { code?: string; message: string } {
  try {
    operation()
  } catch (error) {
    return {
      code: typeof error === 'object' && error !== null
        ? (error as { code?: string }).code
        : undefined,
      message: error instanceof Error ? error.message : String(error),
    }
  }
  throw new Error('用例期待抛错，但没有抛')
}

afterAll(() => {
  fs.rmSync(serviceRoot, { recursive: true, force: true })
})

describe('授权服务层抛点各自带码', () => {
  it('相对路径不能是绝对路径', () => {
    const { root } = workspace('absolute')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read', relativePath: 'C:\\absolute\\note.md',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_PATH_ABSOLUTE',
      message: '外部文件授权的相对路径不能是绝对路径',
    })
  })

  it('相对路径含 NUL 字节时判无效', () => {
    const { root } = workspace('nul')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read', relativePath: 'note\u0000.md',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_PATH_INVALID_NUL',
      message: '外部文件授权的相对路径无效',
    })
  })

  it('相对路径含父目录遍历时拒绝', () => {
    const { root } = workspace('traversal')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read', relativePath: '../escape.txt',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_PATH_TRAVERSAL',
      message: '外部文件授权的相对路径不得包含父目录遍历',
    })
  })

  it('通不过规范化校验的段（保留设备名）判无效', () => {
    const { root } = workspace('normalize')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read', relativePath: 'con',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_PATH_INVALID_NORMALIZE',
      message: '外部文件授权的相对路径无效',
    })
  })

  it('目录授权指向普通文件时拒绝', () => {
    const { file } = workspace('directory-not-found')
    expect(thrown(() => service().issueDirectory({
      webContentsId: 1, directoryPath: file, operations: ['read'], ttlMs: 60_000,
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_TARGET_DIRECTORY_NOT_FOUND',
      message: '外部文件授权目录必须是已存在的目录',
    })
  })

  it('文件授权指向目录时拒绝', () => {
    const { root } = workspace('file-not-found')
    expect(thrown(() => service().issueFile({
      webContentsId: 1, filePath: root, operations: ['read'], ttlMs: 60_000,
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_TARGET_FILE_NOT_FOUND',
      message: '外部文件授权目标必须是已存在的文件',
    })
  })

  it('新建子项的父目录不是目录时拒绝', () => {
    const { file } = workspace('parent-not-found')
    expect(thrown(() => service().issueNewChild({
      webContentsId: 1, filePath: path.join(file, 'child.txt'), operations: ['create'], ttlMs: 60_000,
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_TARGET_PARENT_NOT_FOUND',
      message: '外部文件授权的父目录必须是已存在的目录',
    })
  })

  it('新建子项没有可用的名字时拒绝', () => {
    expect(thrown(() => service().issueNewChild({
      webContentsId: 1, filePath: path.parse(serviceRoot).root, operations: ['create'], ttlMs: 60_000,
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_PATH_INVALID_CHILD_NAME',
      message: '外部文件授权的相对路径无效',
    })
  })

  it('有效期非正数时拒绝', () => {
    const { root } = workspace('ttl')
    expect(thrown(() => service().issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 0,
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_INVALID_TTL_MS',
      message: '外部文件授权有效期必须为正数',
    })
  })

  it('使用次数不是正整数时拒绝', () => {
    const { root } = workspace('max-uses')
    expect(thrown(() => service().issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 0,
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_INVALID_MAX_USES',
      message: '外部文件授权使用次数必须是正整数',
    })
  })

  it('目录授权不能冒充精确文件授权', () => {
    const { root } = workspace('scope-exact')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolveExactPath({
      grantId: grant.grantId, webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_EXACT_PATH',
      message: '外部文件授权范围不符',
    })
  })

  it('精确文件授权的父目录被换掉后拒绝交出路径', () => {
    const { root, file } = workspace('exact-changed')
    const grants = service()
    const grant = grants.issueFile({
      webContentsId: 1, filePath: file, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    fs.renameSync(root, `${root}-old`)
    fs.mkdirSync(root)
    expect(thrown(() => grants.resolveExactPath({
      grantId: grant.grantId, webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_TARGET_CHANGED_EXACT_PATH',
      message: '外部文件授权目标已变化',
    })
  })

  it('文件授权不能冒充目录授权', () => {
    const { file } = workspace('scope-directory')
    const grants = service()
    const grant = grants.issueFile({
      webContentsId: 1, filePath: file, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolveDirectoryPath({
      grantId: grant.grantId, webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_DIRECTORY',
      message: '外部文件授权范围不符',
    })
  })

  it('目录授权选过之后根目录被换掉时拒绝交出根路径', () => {
    const { root } = workspace('directory-changed')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    fs.renameSync(root, `${root}-old`)
    fs.mkdirSync(root)
    expect(thrown(() => grants.resolveDirectoryPath({
      grantId: grant.grantId, webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_TARGET_CHANGED_DIRECTORY',
      message: '外部文件授权目标已变化',
    })
  })

  it('未签发的授权标识判不存在', () => {
    expect(thrown(() => service().resolve({
      grantId: 'missing-grant', webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_UNKNOWN_GRANT',
      message: '外部文件授权不存在或已失效',
    })
  })

  it('超过有效期判过期', () => {
    let now = 1_000
    const { root } = workspace('expired')
    const grants = service(() => now)
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 1_000, maxUses: 4,
    })
    now = 2_000
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_EXPIRED',
      message: '外部文件授权已过期',
    })
  })

  it('次数用完之后判用尽', () => {
    const { root } = workspace('exhausted')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 3,
    })
    for (let use = 0; use < 3; use += 1) {
      grants.resolve({ grantId: grant.grantId, webContentsId: 1, operation: 'read' })
    }
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_EXHAUSTED',
      message: '外部文件授权已用尽',
    })
  })

  it('别的窗口拿到的授权判不属于当前窗口', () => {
    const { root } = workspace('window')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 2, operation: 'read',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_WINDOW_MISMATCH',
      message: '外部文件授权不属于当前窗口',
    })
  })

  it('授权范围外的操作被拒', () => {
    const { root } = workspace('operation')
    const grants = service()
    const grant = grants.issueDirectory({
      webContentsId: 1, directoryPath: root, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'write',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_OPERATION_NOT_GRANTED',
      message: '外部文件授权未授予 write 操作',
    })
  })

  it('精确文件授权不接受子路径', () => {
    const { file } = workspace('subpath')
    const grants = service()
    const grant = grants.issueFile({
      webContentsId: 1, filePath: file, operations: ['read'], ttlMs: 60_000, maxUses: 4,
    })
    expect(thrown(() => grants.resolve({
      grantId: grant.grantId, webContentsId: 1, operation: 'read', relativePath: 'chapter.txt',
    }))).toEqual({
      code: 'EXTERNAL_FILE_GRANT_EXACT_SUBPATH_REJECTED',
      message: '精确文件授权不接受子路径',
    })
  })

  it('21 处抛点一一带码、中文文案仍在 message 里', () => {
    const source = fs.readFileSync(serviceSourcePath, 'utf8')
    expect(source.match(/throw new Error\(/g) ?? []).toHaveLength(0)
    expect(source.match(/throw grantError\(/g) ?? []).toHaveLength(21)
    for (const code of EXTERNAL_FILE_GRANT_ERROR_CODES) {
      expect(source.split(`throw grantError('${code}'`).length - 1, code).toBe(1)
    }
    // 码只产在抛点，文案不会变成码：每个码的 message 参数仍是中文诊断原文。
    expect(source).toMatch(CHINESE_MESSAGE)
    expect(source).not.toMatch(/throw grantError\('[A-Z_]+'\)/)
  })
})

// 主进程文案解析会读入已放行的全局数据；与既有 controller 用例保持同一套隔离夹具。
const globalEnvironmentKeys = ['AI_NOVEL_APP_DATA_HOME', 'AI_NOVEL_LEGACY_SOURCE_HOME', 'AI_NOVEL_VELA_HOME'] as const
let globalFixtureRoot = ''
const previousGlobalEnvironment = new Map<string, string | undefined>()

beforeAll(async () => {
  for (const key of globalEnvironmentKeys) previousGlobalEnvironment.set(key, process.env[key])
  const cache = path.resolve('.runtime/.cache')
  fs.mkdirSync(cache, { recursive: true })
  globalFixtureRoot = fs.mkdtempSync(path.join(cache, 'controller-global-external-file-grant-codes-'))
  process.env.AI_NOVEL_LEGACY_SOURCE_HOME = path.join(globalFixtureRoot, 'legacy')
  const dataRoot = await (await import('../../services/__tests__/global-data-fixture'))
    .prepareGlobalDataFixture(globalFixtureRoot)
  // 配置里不存 locale，界面语言完全由 app.getLocale() 决定。
  fs.writeFileSync(path.join(dataRoot, 'config.json'), '{}', 'utf8')
})
afterAll(() => {
  for (const key of globalEnvironmentKeys) {
    const previous = previousGlobalEnvironment.get(key)
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
  vi.resetModules()
  if (globalFixtureRoot) fs.rmSync(globalFixtureRoot, { recursive: true, force: true })
})
