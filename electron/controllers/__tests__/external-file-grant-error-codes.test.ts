import fs from 'node:fs'
import path from 'node:path'
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
import type { ExternalFileGrantService } from '../../services/external-file-grant-service'
import type { SecureFileCapability, WindowsSafeFileSystem } from '../../security/windows-safe-file-system'

const LOCALES = ['zh-CN', 'en-US'] as const

/** `windows-safe-file-system.ts` 的 `secureError` 把错误码直接当 message 抛出。 */
const PATH_INVALID_CODES = [
  'SECURE_FS_REPARSE_POINT',
  'SECURE_FS_INVALID_PATH',
  'SECURE_FS_NOT_FOUND',
] as const
const SERVICE_UNAVAILABLE_CODES = [
  'SECURE_FS_UNSUPPORTED_PLATFORM',
  'SECURE_FS_HELPER_UNAVAILABLE',
  'SECURE_FS_HELPER_TIMEOUT',
] as const
/** 本控制器不映射的安全错误码：必须落兜底，不能被误判成其它分支。 */
const UNMAPPED_CODES = ['SECURE_FS_TARGET_IN_USE', 'SECURE_FS_HELPER_FAILED'] as const

const PATH_INVALID_TEXT = {
  'zh-CN': '外部文件授权路径无效，已拒绝操作。',
  'en-US': 'The external file grant path is invalid; the operation was rejected.',
} as const
const SERVICE_UNAVAILABLE_TEXT = {
  'zh-CN': '安全外部文件服务不可用，已拒绝操作。',
  'en-US': 'The secure external file service is unavailable; the operation was rejected.',
} as const
const FALLBACK_TEXT = {
  'zh-CN': '外部文件授权操作失败。',
  'en-US': 'The external file grant operation failed.',
} as const

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

function register(error: unknown): void {
  mocks.handlers.clear()
  registerExternalFileGrantController(grantsStub(), failingFileSystem(error))
}

function readFile(): Promise<unknown> {
  return handler('fs:grant-read-file')(event(), 'fixture-grant', 'note.md')
}

describe('external file grant error codes', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.showOpenDialog.mockReset()
  })

  for (const locale of LOCALES) {
    describe(`界面语言 ${locale}`, () => {
      beforeEach(() => {
        mocks.locale = locale
      })

      it.each(PATH_INVALID_CODES)('%s 命中「路径无效」说明', async (code) => {
        register(new Error(code))
        await expect(readFile()).resolves.toEqual({
          success: false,
          content: '',
          error: PATH_INVALID_TEXT[locale],
        })
      })

      it.each(SERVICE_UNAVAILABLE_CODES)('%s 命中「服务不可用」说明', async (code) => {
        register(new Error(code))
        await expect(readFile()).resolves.toEqual({
          success: false,
          content: '',
          error: SERVICE_UNAVAILABLE_TEXT[locale],
        })
      })

      it.each(UNMAPPED_CODES)('%s 落兜底说明', async (code) => {
        register(new Error(code))
        await expect(readFile()).resolves.toEqual({
          success: false,
          content: '',
          error: FALLBACK_TEXT[locale],
        })
      })
    })
  }

  // 换界面语言不再换判据：同一个码在英文界面仍走同一条分支，且结果里没有中文。
  it('英文界面下按码分流的结果不含中文文案', async () => {
    mocks.locale = 'en-US'
    register(new Error('SECURE_FS_HELPER_TIMEOUT'))
    const result = await readFile() as { error: string }
    expect(result.error).toBe(SERVICE_UNAVAILABLE_TEXT['en-US'])
    expect(result.error).not.toMatch(/[\u4e00-\u9fff]/)
  })

  it('写入与建目录入口同样按码分流，不依赖中文文案', async () => {
    mocks.locale = 'en-US'
    register(new Error('SECURE_FS_NOT_FOUND'))

    await expect(handler('fs:grant-write-file')(event(), 'fixture-grant', 'note.md', 'x'))
      .resolves.toMatchObject({ success: false, error: PATH_INVALID_TEXT['en-US'] })
    await expect(handler('fs:grant-mkdir')(event(), 'fixture-grant', 'folder'))
      .resolves.toMatchObject({ success: false, error: PATH_INVALID_TEXT['en-US'] })
  })
})

// 主进程文案解析会读入已放行的全局数据；与既有 controller 用例保持同一套隔离夹具。
const globalEnvironmentKeys = ['AI_NOVEL_APP_DATA_HOME', 'AI_NOVEL_LEGACY_SOURCE_HOME', 'AI_NOVEL_VELA_HOME'] as const
let globalFixtureRoot = ''
let globalConfigPath = ''
const previousGlobalEnvironment = new Map<string, string | undefined>()

beforeAll(async () => {
  for (const key of globalEnvironmentKeys) previousGlobalEnvironment.set(key, process.env[key])
  const cache = path.resolve('.runtime/.cache')
  fs.mkdirSync(cache, { recursive: true })
  globalFixtureRoot = fs.mkdtempSync(path.join(cache, 'controller-global-external-file-grant-error-codes-'))
  process.env.AI_NOVEL_LEGACY_SOURCE_HOME = path.join(globalFixtureRoot, 'legacy')
  const dataRoot = await (await import('../../services/__tests__/global-data-fixture'))
    .prepareGlobalDataFixture(globalFixtureRoot)
  // 配置里不存 locale，界面语言完全由 app.getLocale() 决定（模拟作者未手动选过语言）。
  globalConfigPath = path.join(dataRoot, 'config.json')
  fs.writeFileSync(globalConfigPath, '{}', 'utf8')
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
