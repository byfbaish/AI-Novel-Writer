import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  savePath: '',
  openPath: '',
}))

vi.mock('electron', () => ({
  app: { getLocale: () => 'zh-CN', getVersion: () => '9.9.9' },
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      mocks.handlers.set(channel, handler)
    }),
  },
  dialog: {
    showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: mocks.savePath })),
    showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [mocks.openPath] })),
  },
}))

vi.mock('../../i18n', () => ({
  mainText: (_locale: string, zh: string) => zh,
}))

function handler(channel: string): IpcHandler {
  const registered = mocks.handlers.get(channel)
  if (!registered) throw new Error(`Missing IPC handler: ${channel}`)
  return registered
}

const event = { sender: { id: 7, once: () => undefined } }

function readPrompt(velaHome: string, fileName: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(velaHome, 'prompts', fileName), 'utf8'))
}

const SKILL_MARKDOWN = '---\nname: style-guide\ndescription: 番茄叙事\n---\n# 番茄叙事\n\n短句切分，重视体感。\n'

describe('user settings package controller', () => {
  let fixtureRoot = ''
  let velaHome = ''

  beforeEach(async () => {
    vi.resetModules()
    mocks.handlers.clear()
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vela-pack-ipc-'))
    velaHome = await (await import('../../services/__tests__/global-data-fixture')).prepareGlobalDataFixture(fixtureRoot)

    const { registerAppDataController } = await import('../app-data-controller')
    const { registerUserSettingsPackageController } = await import('../user-settings-package-controller')
    const { ExternalFileGrantService } = await import('../../services/external-file-grant-service')
    registerAppDataController()
    registerUserSettingsPackageController(new ExternalFileGrantService())
  })

  afterEach(() => {
    delete process.env.AI_NOVEL_VELA_HOME
    delete process.env.AI_NOVEL_APP_DATA_HOME
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  })

  function seedAssets(): void {
    fs.mkdirSync(path.join(velaHome, 'prompts'), { recursive: true })
    fs.writeFileSync(path.join(velaHome, 'prompts', 'premise.zh-CN.json'), JSON.stringify({
      key: 'premise',
      writingLanguage: 'zh-CN',
      content: '包内番茄文风',
    }), 'utf8')
    fs.mkdirSync(path.join(velaHome, 'skills', 'style-guide'), { recursive: true })
    fs.writeFileSync(path.join(velaHome, 'skills', 'style-guide', 'SKILL.md'), SKILL_MARKDOWN, 'utf8')
  }

  async function exportPack(): Promise<string> {
    const target = path.join(fixtureRoot, 'creative.vela-pack')
    mocks.savePath = target
    const grant = await handler('dialog:select-settings-pack-export')(event, 'creative') as { grantId: string }
    const result = await handler('settings-pack:export')(event, { targetGrantId: grant.grantId }) as {
      success: boolean
      receipt?: { summary: { prompts: unknown[]; skills: unknown[] }; diagnostics: unknown[] }
    }
    expect(result.success).toBe(true)
    expect(result.receipt!.summary.prompts).toHaveLength(1)
    expect(result.receipt!.summary.skills).toHaveLength(1)
    return target
  }

  async function inspectPack(file: string): Promise<{ inspectId: string; conflicts: { prompts: string[]; skills: string[] } }> {
    mocks.openPath = file
    const grant = await handler('dialog:select-settings-pack-import')(event) as { grantId: string }
    const result = await handler('settings-pack:inspect')(event, { archiveGrantId: grant.grantId }) as {
      success: boolean
      receipt?: { inspectId: string; conflicts: { prompts: string[]; skills: string[] } }
    }
    expect(result.success).toBe(true)
    return result.receipt!
  }

  it('导出创作资产包只含 prompts 与 skills，不含个人环境', async () => {
    seedAssets()
    const target = await exportPack()
    // 回执/包内不含 models.json / config.json / recent-projects.json / skins
    const raw = fs.readFileSync(target)
    expect(raw.includes(Buffer.from('models.json'))).toBe(false)
    expect(raw.includes(Buffer.from('config.json'))).toBe(false)
    expect(raw.includes(Buffer.from('recent-projects.json'))).toBe(false)
    expect(raw.includes(Buffer.from('skins/'))).toBe(false)
  })

  it('检查结果回报冲突，覆盖导入会先留备份再用包内内容落盘', async () => {
    seedAssets()
    const target = await exportPack()

    fs.writeFileSync(path.join(velaHome, 'prompts', 'premise.zh-CN.json'), JSON.stringify({
      key: 'premise',
      writingLanguage: 'zh-CN',
      content: '本地已改',
    }), 'utf8')
    fs.rmSync(path.join(velaHome, 'skills', 'style-guide'), { recursive: true, force: true })

    const inspected = await inspectPack(target)
    expect(inspected.conflicts.prompts).toEqual(['premise.zh-CN.json'])
    expect(inspected.conflicts.skills).toEqual([])

    const result = await handler('settings-pack:import')(event, {
      inspectId: inspected.inspectId,
      conflictStrategy: 'overwrite',
      importPrompts: true,
      importSkills: true,
    }) as { success: boolean; receipt?: Record<string, unknown> }
    expect(result.success).toBe(true)
    expect(result.receipt!.overwrittenPrompts).toBe(1)
    expect(result.receipt!.importedSkills).toBe(1)

    expect((readPrompt(velaHome, 'premise.zh-CN.json') as { content: string }).content).toBe('包内番茄文风')
    expect(fs.readFileSync(path.join(velaHome, 'skills', 'style-guide', 'SKILL.md'), 'utf8')).toContain('番茄叙事')

    const backups = result.receipt!.backupDirectories as string[]
    expect(backups.some(name => name.startsWith('prompts.bak-'))).toBe(true)
    const backupRoot = path.join(velaHome, backups.find(name => name.startsWith('prompts.bak-'))!)
    expect((readPrompt(backupRoot, 'premise.zh-CN.json') as { content: string }).content).toBe('本地已改')
  })

  it('跳过策略下本地内容保持不变，且检查结果未被二次消费', async () => {
    seedAssets()
    const target = await exportPack()
    fs.writeFileSync(path.join(velaHome, 'prompts', 'premise.zh-CN.json'), JSON.stringify({
      key: 'premise',
      writingLanguage: 'zh-CN',
      content: '本地已改',
    }), 'utf8')
    fs.rmSync(path.join(velaHome, 'skills', 'style-guide'), { recursive: true, force: true })

    const inspected = await inspectPack(target)
    const result = await handler('settings-pack:import')(event, {
      inspectId: inspected.inspectId,
      conflictStrategy: 'skip',
      importPrompts: true,
      importSkills: true,
    }) as { success: boolean; receipt?: Record<string, unknown> }
    expect(result.success).toBe(true)
    expect(result.receipt!.skippedPrompts).toBe(1)
    expect((readPrompt(velaHome, 'premise.zh-CN.json') as { content: string }).content).toBe('本地已改')
  })

  it('check 后重命名导入会同时保留本地与包内两份', async () => {
    seedAssets()
    const target = await exportPack()
    const inspected = await inspectPack(target)
    const result = await handler('settings-pack:import')(event, {
      inspectId: inspected.inspectId,
      conflictStrategy: 'rename',
      importPrompts: true,
      importSkills: true,
    }) as { success: boolean; receipt?: Record<string, unknown> }
    expect(result.success).toBe(true)
    expect(result.receipt!.renamedPrompts).toBe(1)
    expect(fs.existsSync(path.join(velaHome, 'prompts', 'premise.zh-CN.json'))).toBe(true)
    expect(fs.existsSync(path.join(velaHome, 'prompts', 'premise-imported.zh-CN.json'))).toBe(true)
  })

  it('未知的检查标识被拒绝（导入只消费本人本窗口、未过期的检查结果）', async () => {
    const result = await handler('settings-pack:import')(event, {
      inspectId: 'not-a-real-id',
      conflictStrategy: 'overwrite',
      importPrompts: true,
      importSkills: true,
    }) as { success: boolean; errorCode?: string }
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('USER_PACK_GRANT_INVALID')
  })
})
