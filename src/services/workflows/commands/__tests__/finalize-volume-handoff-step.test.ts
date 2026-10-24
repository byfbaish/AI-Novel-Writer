import { describe, expect, it, vi } from 'vitest'

import type { StepCallbacks, WorkflowContext } from '../../../../stores/workflow-store'
import { buildFinalizePostProcessSteps, resolveVolumeHandoffRange } from '../finalize-chapter.command'

/**
 * P1-2 期 2：定稿链的「卷末交接单」步骤。
 *
 * 三条不变量在这里被钉死：**作者版永不覆盖** · **数据未就绪不算失败** ·
 * **坏输出一个字都不写**。范式照 `finalize-resource-ledger-step.test.ts`：
 * 直接调 `buildFinalizePostProcessSteps`，模型传输用 `generateVolumeHandoffRaw` 桩掉。
 */

const PROMPT_TEMPLATE = {
  key: 'generate_volume_handoff',
  name: '卷末交接单生成',
  description: '测试用模板',
  systemRole: '你是续稿统筹编辑。',
  variables: { volume_label: '本卷', chapter_range: '区间', volume_notes: '要点' },
  content: '{{volume_label}} {{chapter_range}}\n{{volume_notes}}',
}

vi.mock('../../../prompt-templates', () => ({
  resolvePromptTemplate: async () => PROMPT_TEMPLATE,
  getPromptTemplate: () => PROMPT_TEMPLATE,
  getPromptSource: () => 'builtin',
}))

const PROJECT = { path: 'C:\\novels\\handoff-step' }
const PROJECT_SESSION = Object.freeze({
  projectId: 'handoff-step',
  leaseId: 'lease-handoff-step',
  projectPath: PROJECT.path,
})
const RANGE = Object.freeze({
  volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
  first: 1, last: 3, basis: 'headings' as const, actualLast: null,
})
const DRAFT_JSON = JSON.stringify({
  worldState: '宗门被围',
  heroState: '重伤未愈',
  events: ['执法殿夺权'],
  items: ['通行令在林岚手里'],
  debts: ['欠药铺药钱'],
  openThread: '谁递的信',
})

function context(): WorkflowContext {
  return {
    runId: 'handoff-step-run',
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

function stubIpc(input: {
  handoffs?: Array<Record<string, unknown>>
  projections?: Array<Record<string, unknown>>
} = {}) {
  const upserts: Array<Record<string, unknown>> = []
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:volume-handoffs-list') return { success: true, entries: input.handoffs ?? [] }
    if (channel === 'db:continuity-list-before') {
      // 上界不含：本卷 [1,3] ⇒ 请求 4。
      expect(args[0]).toBe(RANGE.last + 1)
      return input.projections ?? [
        { chapterNumber: 1, chapterTitle: '一', chapterNotes: '第一章要点' },
        { chapterNumber: 2, chapterTitle: '二', chapterNotes: '第二章要点' },
        { chapterNumber: 3, chapterTitle: '三', chapterNotes: '第三章要点' },
      ]
    }
    if (channel === 'db:volume-handoffs-upsert') {
      upserts.push(args[0] as Record<string, unknown>)
      return { success: true, entry: { handoffId: 'handoff:1', ...(args[0] as object) } }
    }
    throw new Error(`unexpected IPC: ${channel}`)
  })
  vi.stubGlobal('window', { aiNovelAPI: { invoke } })
  return { upserts, invoke }
}

function buildStep(input: {
  chapterNumber?: number
  range?: typeof RANGE | undefined
  raw?: string
  modelCalls?: { count: number }
} = {}) {
  const modelCalls = input.modelCalls ?? { count: 0 }
  const steps = buildFinalizePostProcessSteps(
    PROJECT,
    input.chapterNumber ?? 3,
    '第三章',
    '正文',
    {
      complete: async () => '',
      generateVolumeHandoffRaw: async () => {
        modelCalls.count += 1
        return input.raw ?? DRAFT_JSON
      },
    },
    31,
    [],
    'zh-CN',
    { draftId: 31, finalizationId: 'finalization-31', chapterNumber: input.chapterNumber ?? 3, contentHash: 'a'.repeat(64) },
    0,
    undefined,
    input.range === undefined && 'range' in input ? {} : { volumeHandoff: input.range ?? RANGE },
  )
  return { steps, step: steps.find(item => item.key === 'volume_handoff'), modelCalls }
}

describe('finalize post-process · volume_handoff step（P1-2 期 2）', () => {
  it('不传 volumeHandoff ⇒ 步骤清单与本期之前逐字相同（旧调用零改动）', () => {
    const steps = buildFinalizePostProcessSteps(
      PROJECT, 3, '第三章', '正文', { complete: async () => '' }, 31, [], 'zh-CN',
      undefined, undefined, undefined,
      {},
    )
    expect(steps.map(step => step.key)).toEqual(['kb_import', 'chapter_notes', 'character_cards'])
  })

  it('卷末章 ⇒ 注册为关键性 false 的步骤，且排在 character_cards 之前', () => {
    const { steps, step } = buildStep()
    expect(step).toBeDefined()
    expect(step!.critical).toBe(false)
    const keys = steps.map(item => item.key)
    expect(keys.indexOf('volume_handoff')).toBeGreaterThan(keys.indexOf('chapter_notes'))
    expect(keys.indexOf('volume_handoff')).toBeLessThan(keys.indexOf('character_cards'))
  })

  it('非卷末章 ⇒ 即使传了区间也不注册（builder 层的双保险）', () => {
    const { step } = buildStep({ chapterNumber: 2 })
    expect(step).toBeUndefined()
  })

  it('正常生成：读本卷区间要点，写 source=generated，日志可核对', async () => {
    const { upserts } = stubIpc()
    const { step } = buildStep()
    const log = callbacks()
    await step!.executor(log, context())
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({
      volumeId: 'volume:1',
      source: 'generated',
      worldState: '宗门被围',
      events: ['执法殿夺权'],
    })
    expect(upserts[0]).not.toHaveProperty('handoffId')
    const logged = log.log.mock.calls.map(([message]) => String(message)).join('\n')
    expect(logged).toContain('已生成卷末交接单初稿')
    expect(logged).toContain('要点 3/3 章')
  })

  it('已有作者版 ⇒ 一次模型都不调、一个字都不写（硬不变量）', async () => {
    const { upserts } = stubIpc({
      handoffs: [{ handoffId: 'handoff:author', volumeId: 'volume:1', source: 'author' }],
    })
    const { step, modelCalls } = buildStep()
    const log = callbacks()
    await step!.executor(log, context())
    expect(modelCalls.count).toBe(0)
    expect(upserts).toHaveLength(0)
    expect(log.log.mock.calls.map(([message]) => String(message)).join('\n')).toContain('不覆盖')
  })

  it('已有初稿 ⇒ 覆盖时带上原 handoffId（保住 created_at）', async () => {
    const { upserts } = stubIpc({
      handoffs: [{ handoffId: 'handoff:generated', volumeId: 'volume:1', source: 'generated' }],
    })
    const { step } = buildStep()
    await step!.executor(callbacks(), context())
    expect(upserts[0]).toMatchObject({ handoffId: 'handoff:generated', source: 'generated' })
  })

  it('模型输出不可读 ⇒ 步骤失败但一个字都不写（不用垃圾覆盖好数据）', async () => {
    const { upserts } = stubIpc()
    const { step } = buildStep({ raw: '抱歉，我无法完成。' })
    await expect(step!.executor(callbacks(), context())).rejects.toThrow('VOLUME_HANDOFF_GENERATION_UNREADABLE')
    expect(upserts).toHaveLength(0)
  })

  it('六项全空 ⇒ 失败、不写空壳', async () => {
    const { upserts } = stubIpc()
    const { step } = buildStep({
      raw: JSON.stringify({ worldState: '', heroState: '', events: [], items: [], debts: [], openThread: '' }),
    })
    await expect(step!.executor(callbacks(), context())).rejects.toThrow('VOLUME_HANDOFF_GENERATION_EMPTY')
    expect(upserts).toHaveLength(0)
  })

  it('本卷一条要点都没有 ⇒ 视为数据未就绪（ok、不写库、给出去哪儿补）', async () => {
    const { upserts } = stubIpc({ projections: [] })
    const { step, modelCalls } = buildStep()
    const log = callbacks()
    await expect(step!.executor(log, context())).resolves.toBeUndefined()
    expect(modelCalls.count).toBe(0)
    expect(upserts).toHaveLength(0)
    expect(log.log.mock.calls.map(([message]) => String(message)).join('\n')).toContain('还没有可用的定稿要点')
  })

  it('缺本卷末章要点 ⇒ 仍生成，并在日志里点出缺哪几章', async () => {
    const { upserts } = stubIpc({
      projections: [
        { chapterNumber: 1, chapterTitle: '一', chapterNotes: '第一章要点' },
        { chapterNumber: 3, chapterTitle: '三', chapterNotes: '第三章要点' },
      ],
    })
    const { step } = buildStep()
    const log = callbacks()
    await step!.executor(log, context())
    expect(upserts).toHaveLength(1)
    expect(log.log.mock.calls.map(([message]) => String(message)).join('\n')).toContain('缺第 2 章')
  })
})

describe('resolveVolumeHandoffRange — 卷末章探测（fail-open）', () => {
  const volumeDefinition = (index: number, first: number, last: number) => ({
    volumeId: `volume:${index}`, volumeIndex: index, name: `第${index}卷`,
    plannedFirst: first, plannedLast: last, plannedSource: 'headings',
    actualLast: null, actualSource: null, outlineHash: 'hash', source: 'outline',
    createdAt: '', updatedAt: '',
  })

  const stubVolumes = (listResult: unknown | Error) => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel !== 'db:volumes-list') throw new Error(`unexpected IPC: ${channel}`)
      if (listResult instanceof Error) throw listResult
      return listResult
    })
    vi.stubGlobal('window', { aiNovelAPI: { invoke } })
    return invoke
  }

  const call = (chapterNumber: number, onStale?: () => void) => resolveVolumeHandoffRange({
    projectPath: PROJECT.path, projectSession: PROJECT_SESSION as never, chapterNumber, onStale,
  })

  it('命中本卷末章时返回该卷区间', async () => {
    stubVolumes({
      success: true, state: 'ready',
      volumes: [volumeDefinition(1, 1, 3), volumeDefinition(2, 4, 6)],
    })
    await expect(call(3)).resolves.toMatchObject({ volumeId: 'volume:1', first: 1, last: 3 })
    await expect(call(6)).resolves.toMatchObject({ volumeId: 'volume:2', first: 4, last: 6 })
  })

  it('非卷末章 / 空结构 / 读失败 / success:false 一律 undefined（绝不因此让定稿失败）', async () => {
    stubVolumes({ success: true, state: 'ready', volumes: [volumeDefinition(1, 1, 3)] })
    await expect(call(2)).resolves.toBeUndefined()
    await expect(call(99)).resolves.toBeUndefined()

    stubVolumes({ success: true, state: 'empty', volumes: [] })
    await expect(call(3)).resolves.toBeUndefined()

    stubVolumes({ success: false, error: 'PROJECT_NOT_OPEN' })
    await expect(call(3)).resolves.toBeUndefined()

    stubVolumes(new Error('db closed'))
    await expect(call(3)).resolves.toBeUndefined()
  })

  it('卷结构过期时照样给出区间，并回调 onStale（让作者知道该重建）', async () => {
    stubVolumes({ success: true, state: 'stale', volumes: [volumeDefinition(1, 1, 3)] })
    const onStale = vi.fn()
    await expect(call(3, onStale)).resolves.toMatchObject({ volumeId: 'volume:1' })
    expect(onStale).toHaveBeenCalledTimes(1)
  })

  it('未过期时不回调 onStale（不制造无意义日志）', async () => {
    stubVolumes({ success: true, state: 'ready', volumes: [volumeDefinition(1, 1, 3)] })
    const onStale = vi.fn()
    await call(3, onStale)
    expect(onStale).not.toHaveBeenCalled()
  })
})
