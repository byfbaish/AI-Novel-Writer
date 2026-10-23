import { describe, expect, it, vi } from 'vitest'

import type { StepCallbacks, WorkflowContext } from '../../../../stores/workflow-store'
import { buildFinalizePostProcessSteps } from '../finalize-chapter.command'

const PROMPT_TEMPLATE = {
  key: 'extract_resource_movements',
  name: '资源变动抽取',
  description: '测试用模板',
  systemRole: '你是账房校对员。',
  variables: {
    chapter_content: '章节正文',
    chapter_number: '章节编号',
    chapter_title: '章节标题',
    resources_json: '资源清单',
  },
  content: '{{chapter_number}} {{chapter_title}}\n{{resources_json}}\n{{chapter_content}}',
}

vi.mock('../../../prompt-templates', () => ({
  resolvePromptTemplate: async () => PROMPT_TEMPLATE,
  getPromptTemplate: () => PROMPT_TEMPLATE,
  getPromptSource: () => 'builtin',
}))

const CHAPTER_TEXT = '他把袋子推过来，取走一百二十枚。'
const PROJECT = { path: 'C:\\novels\\ledger-step' }
const PROJECT_SESSION = Object.freeze({
  projectId: 'ledger-step',
  leaseId: 'lease-ledger-step',
  projectPath: PROJECT.path,
})

function context(): WorkflowContext {
  return {
    runId: 'ledger-step-run',
    projectPath: PROJECT.path,
    projectSession: PROJECT_SESSION,
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    data: {},
    cancelled: false,
  }
}

function callbacks(): StepCallbacks & { log: ReturnType<typeof vi.fn> } {
  return { log: vi.fn(), setProgress: vi.fn(), appendText: vi.fn() } as never
}

function stubIpc(resources: Array<{ resourceId: string; name: string; unit: string }>) {
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    void args
    if (channel === 'db:resources-list') return { success: true, resources }
    if (channel === 'db:resource-movements-replace-chapter') return { success: true, inserted: 1 }
    throw new Error(`unexpected IPC: ${channel}`)
  })
  vi.stubGlobal('window', { aiNovelAPI: { invoke } })
  return invoke
}

function ledgerStep(raw: string) {
  const steps = buildFinalizePostProcessSteps(
    PROJECT,
    2,
    '第二章',
    CHAPTER_TEXT,
    { complete: async () => '', extractResourceMovements: async () => raw },
    21,
    [],
    'zh-CN',
    { draftId: 21, finalizationId: 'finalization-21', chapterNumber: 2, contentHash: 'a'.repeat(64) },
    0,
    undefined,
    // 该步骤已下线（ADR-0022），这里显式开启以继续守护保留的代码。
    { includeResourceLedger: true },
  )
  const step = steps.find((item) => item.key === 'resource-ledger')
  expect(step).toBeDefined()
  expect(step!.critical).toBe(false)
  return step!
}

describe('finalize post-process · resource-ledger step (W6b)', () => {
  it('默认不注册进后处理队列（2026-10-23 下线，ADR-0022）', () => {
    const steps = buildFinalizePostProcessSteps(
      PROJECT,
      2,
      '第二章',
      CHAPTER_TEXT,
      { complete: async () => '', extractResourceMovements: async () => '{"movements":[]}' },
    )
    // 余额计算对写作没有用处，唯一消费者是一块展示面板 ⇒ 不再每章花一次模型调用。
    expect(steps.map((step) => step.key)).toEqual(['kb_import', 'chapter_notes', 'character_cards'])
  })

  it('显式开启时仍注册为非关键步骤（保留代码不腐烂）', () => {
    const steps = buildFinalizePostProcessSteps(
      PROJECT,
      2,
      '第二章',
      CHAPTER_TEXT,
      { complete: async () => '', extractResourceMovements: async () => '{"movements":[]}' },
      undefined,
      [],
      'zh-CN',
      undefined,
      undefined,
      undefined,
      { includeResourceLedger: true },
    )
    expect(steps.map((step) => step.key)).toEqual([
      'kb_import',
      'chapter_notes',
      'character_cards',
      'resource-ledger',
    ])
    expect(steps.at(-1)!.critical).toBe(false)
  })

  it('finishes ok and writes nothing when no resource is registered', async () => {
    const invoke = stubIpc([])
    const log = callbacks()
    const step = ledgerStep('{"movements":[]}')
    await expect(step.executor(log, context())).resolves.toBeUndefined()
    expect(invoke.mock.calls.some(([channel]) => channel === 'db:resource-movements-replace-chapter')).toBe(false)
    expect(String(log.log.mock.calls[0]?.[0])).toContain('尚未登记资源')
  })

  it('rebuilds the chapter through the repository IPC with only the verbatim rows', async () => {
    const resources = [{ resourceId: 'res:stone', name: '下品灵石', unit: '枚' }]
    const invoke = stubIpc(resources)
    const step = ledgerStep(JSON.stringify({
      movements: [
        { resource: '下品灵石', delta: 120, unit: '枚', quote: '取走一百二十枚' },
        // 引文命不中：丢弃，但仍要落库另一条。
        { resource: '下品灵石', delta: 5, unit: '枚', quote: '取走五枚' },
      ],
    }))

    await step.executor(callbacks(), context())

    const write = invoke.mock.calls.find(([channel]) => channel === 'db:resource-movements-replace-chapter')
    expect(write).toBeDefined()
    expect(write![1]).toBe(2)
    expect(write![2]).toEqual([{
      resourceId: 'res:stone',
      delta: 120,
      unit: '枚',
      evidence: '取走一百二十枚',
    }])
    expect(write![3]).toBe('finalized-extract')
  })

  it('fails the step on unreadable output instead of recording "no change"', async () => {
    const resources = [{ resourceId: 'res:stone', name: '下品灵石', unit: '枚' }]
    const invoke = stubIpc(resources)
    const step = ledgerStep('抱歉，我无法完成')

    await expect(step.executor(callbacks(), context())).rejects.toThrow('RESOURCE_LEDGER_EXTRACTION_UNREADABLE')
    // 坏输出一个字都不写：写空等于用垃圾覆盖上一次的整章结果。
    expect(invoke.mock.calls.some(([channel]) => channel === 'db:resource-movements-replace-chapter')).toBe(false)
  })
})
