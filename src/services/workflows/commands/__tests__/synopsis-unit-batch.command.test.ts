import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLLMStore } from '../../../../stores/llm-store'
import { useProjectStore } from '../../../../stores/project-store'
import type { StepCallbacks, WorkflowContext } from '../../../../stores/workflow-store'
import { GeneratePlotArchitectureCommand, synopsisFactsFingerprint, synopsisInputsFingerprint } from '../architecture.command'
import { createWorkflowRuntimeDependencies } from './workflow-generation-runtime.fixture'
import { clearProjectCustomPrompts, getBuiltinPromptTemplate } from '../../../prompt-templates'
import type { ArchitectureUnitRange } from '../../../../shared/generation-owner-contract'

/**
 * E3 T4b：逐单元批次的状态机接线。
 *
 * 覆盖三条不能退化的性质：
 * 1. 请求期**没有 `to`**：提示词里出现「单元 k：名」，不出现「第 from–to 章」；
 * 2. **实际章数偏离计划**也能推进（单元 1 计划 15 章、实际只写 5 章，单元 2 从第 6 章起）；
 * 3. 完成落盘的指纹按**实际范围**算，第二批不会误报「源事实已变化」。
 */

const projectAPath = 'C:\\novels\\unit-batch'
const originalGenerateStream = useLLMStore.getState().generateStream
const originalDefaultModelId = useLLMStore.getState().defaultModelId

const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '- 叙事任务：立规则。',
  '### 单元二：定价',
  '- 叙事任务：把销档变成交易。',
  '## 卷二：销档',
  '### 单元一：配合',
  '- 叙事任务：只剩配合这一条路。',
].join('\n')

const novelConfig = {
  genre: '都市',
  targetAudience: '男频',
  subGenre: '行业',
  totalChapters: 60,
  wordsPerChapter: 3000,
  plotStructure: 'three_act',
  narrativePOV: 'third_limited',
  coreOutline: '主角在旧货市场盘下一间铺子，靠记账与赊账把生意盘活。',
  worldSetting: '城中村改造，铺面层层转租，账本决定谁说话算数。',
  goldenFinger: '主角过目不忘，但记账越细越容易被人盯上。',
  protagonistProfile: '谨慎，认账，不肯欠人情。',
  globalGuidance: '保持因果推进。',
  writingStyle: '短句，对话推进。',
} as const

const premise = '故事前提：周岚在铁砧镇盘下一间铺子，账本里记着整条街的赊欠。'.repeat(2)
const charactersArch = '角色图谱：周岚（主角）、老陈（房东）、苏绾（会计）。'.repeat(2)
const worldbuilding = '世界观：铺面转租链条决定进货渠道，赊账周期决定谁先倒。'.repeat(2)

const coreSeed = { premise, charactersArch, worldbuilding, plotStructurePlan: PLAN }

function currentFingerprint(range: { from: number; to: number }): string {
  return synopsisInputsFingerprint({
    synopsis: '',
    premise,
    charactersArch,
    worldbuilding,
    plotStructurePlan: PLAN,
    genre: novelConfig.genre,
    totalChapters: novelConfig.totalChapters,
    wordsPerChapter: novelConfig.wordsPerChapter,
    writingLanguage: 'zh-CN',
    plotStructure: novelConfig.plotStructure,
    narrativePov: novelConfig.narrativePOV,
    globalGuidance: novelConfig.globalGuidance,
  }, '', range, getBuiltinPromptTemplate('synopsis', 'zh-CN'))
}

function project(path: string) {
  return { id: 'main', name: path, path, sessionLease: 'lease-main', novelConfig }
}

const context: WorkflowContext = {
  runId: 'unit-batch-run',
  projectPath: projectAPath,
  projectSession: { projectId: 'main', leaseId: 'lease-main', projectPath: projectAPath },
  writingLanguage: 'zh-CN',
  uiLocale: 'zh-CN',
  data: {},
  cancelled: false,
}

const callbacks: StepCallbacks = { log: vi.fn(), setProgress: vi.fn(), appendText: vi.fn() }

function chapters(from: number, to: number): string {
  return Array.from({ length: to - from + 1 }, (_, index) =>
    `第${from + index}章：核对第${from + index}笔账\n周岚翻开账本核对这一笔赊欠，把来路和去处都对上。`,
  ).join('\n\n')
}

interface CheckpointSnapshot {
  [key: string]: unknown
  synopsis_result?: string
  synopsis_incomplete?: boolean
  synopsis_covered_to?: number
  synopsis_range?: { from: number; to: number }
  synopsis_unit_cursor?: { volumeIndex: number; unitIndex: number; writtenInVolume: number }
  synopsis_volume_deviations?: Array<{ volumeIndex: number; planned: number; actual: number }>
  synopsis_facts_fingerprint?: string
  synopsis_step_guidance?: string
}

function harness(checkpoint: CheckpointSnapshot = {}, dbSynopsis = '', readFailure: string | null = null) {
  const partialWrites: CheckpointSnapshot[] = []
  let storedCheckpoint: CheckpointSnapshot = { ...checkpoint }
  let storedDbSynopsis = dbSynopsis
  const invoke = vi.fn(async (_channel: string, ...rest: unknown[]) => {
    const channel = String(_channel)
    if (channel === 'prompt:load-global') return { templates: [], diagnostics: [] }
    if (channel === 'fs:check-exists') return false
    if (channel === 'db:project-core-get') return { ...coreSeed, synopsis: storedDbSynopsis }
    if (channel === 'db:project-core-update') return { success: true }
    if (channel === 'db:project-core-synopsis-commit') {
      const request = rest[0] as { synopsis: string }
      storedDbSynopsis = request.synopsis
      return { success: true }
    }
    if (channel === 'fs:read-json') {
      if (readFailure) return { success: false, data: null, reason: readFailure }
      return { success: true, data: storedCheckpoint }
    }
    if (channel === 'fs:write-json') {
      storedCheckpoint = { ...(rest[1] as CheckpointSnapshot) }
      partialWrites.push(storedCheckpoint)
      return { success: true }
    }
    if (channel === 'fs:write-file') return { success: true }
    throw new Error(`Unexpected IPC channel: ${channel}`)
  })
  vi.stubGlobal('window', {
    aiNovelAPI: {
      invoke, on: vi.fn(() => () => {}), once: vi.fn(), send: vi.fn(),
      setZoomLevel: vi.fn(), setZoomFactor: vi.fn(), getZoomLevel: vi.fn(),
    },
  })
  return { partialWrites, dbSynopsis: () => storedDbSynopsis }
}

function responseStream(responses: readonly string[]) {
  let index = 0
  return vi.fn((
    _messages: Parameters<ReturnType<typeof useLLMStore.getState>['generateStream']>[0],
    streamCallbacks: Parameters<ReturnType<typeof useLLMStore.getState>['generateStream']>[1],
  ) => {
    const output = responses[index++]
    if (output === undefined) throw new Error(`unexpected generation attempt ${index}`)
    streamCallbacks.onDone?.(output, undefined, 'stop')
    return Promise.resolve(`unit-request-${index}`)
  })
}

function makeCommand(unit?: ArchitectureUnitRange, resume = false) {
  return new GeneratePlotArchitectureCommand(
    ['synopsis'],
    { expectedProjectPath: projectAPath, novelConfig } as never,
    createWorkflowRuntimeDependencies(),
    {
      ...(unit ? { synopsisUnit: unit } : {}),
      ...(resume
        ? { resumeSynopsis: true, resumeHandle: { projectId: 'main', epoch: 'lease-main', rootActionId: '合成恢复根', runId: '合成恢复运行' } }
        : {}),
    },
  )
}

function promptText(mock: ReturnType<typeof responseStream>, callIndex = 0): string {
  const messages = mock.mock.calls[callIndex]?.[0] as Array<{ content: string }> | undefined
  return (messages ?? []).map(message => message.content).join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  context.data = {}
  context.cancelled = false
  useProjectStore.setState({ currentProject: project(projectAPath) as never })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useLLMStore.setState({ defaultModelId: originalDefaultModelId, generateStream: originalGenerateStream })
  useProjectStore.setState({ currentProject: null })
  clearProjectCustomPrompts()
})

describe('GeneratePlotArchitectureCommand 逐单元批次', () => {
  it('单元 1：提示词只给单元与起点（无章号区间），落盘回填实际章数并推进游标', async () => {
    const stream = responseStream([chapters(1, 5)])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    const ipc = harness()

    await makeCommand({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })

    const prompt = promptText(stream)
    expect(prompt).toContain('【第 1 卷第 1 单元：门牌】')
    expect(prompt).toContain('从全书第 1 章开始')
    // P2：章标题带归属（suffix 末尾追加的格式段），本批第一章的示例行必须逐字出现。
    expect(prompt).toContain('## 第1卷第1单元第1章（全书第1章）：章名')
    expect(prompt).toContain('## 第1卷第1单元第2章（全书第2章）：章名')
    // 弧位按**游标**定位：不写本单元章号区间，也不给「章数以区间为给定条件」那条（与不凑章数冲突）
    expect(prompt).toContain('本次只写：卷 1【开局】· 单元 1【门牌】')
    expect(prompt).not.toContain('本批范围：第')
    expect(prompt).not.toContain('章数区间是')
    // 请求期没有 `to`：不得出现按章号划定的批次范围（旧的 `synopsisBatchInstruction` 文案）
    expect(prompt).not.toContain('本次必须对第 1–')
    expect(prompt).not.toContain('本次不展开细写')

    const saved = ipc.partialWrites.at(-1)!
    expect(saved.synopsis_range).toEqual({ from: 1, to: 5 })
    expect(saved.synopsis_covered_to).toBe(5)
    expect(saved.synopsis_incomplete).toBe(false)
    expect(saved.synopsis_unit_cursor).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 })
    // 完成落盘按**实际范围**算指纹（不是请求上界 1–15）
    expect(saved.synopsis_facts_fingerprint).toBe(currentFingerprint({ from: 1, to: 5 }))
  })

  it('单元 1 少写（5 章 vs 计划 15 章）后，单元 2 仍从第 6 章起接上且不被指纹拒绝', async () => {    // 两次真实运行串起来：单元 1 的检查点与 DB 正文都是它自己写出来的，不是手工编的。
    const stream = responseStream([chapters(1, 5), chapters(6, 9)])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    const ipc = harness()

    await makeCommand({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })
    const afterFirst = ipc.partialWrites.at(-1)!
    expect(afterFirst.synopsis_range).toEqual({ from: 1, to: 5 })

    context.data = {}
    // 卷内第二个单元：本卷剩余 25 章全归它（1 个剩余单元）。若沿用请求上界算指纹，这里会被
    // "源事实已变化" 拒绝——那正是方案 D 修订要防的坑。
    await makeCommand({ from: 6, unitIndex: 2, maxChapters: 25, volumeRemaining: 25 })
      .execute({ step: {}, context, callbacks })

    const prompt = promptText(stream, 1)
    expect(prompt).toContain('【第 1 卷第 2 单元：定价】')
    expect(prompt).toContain('从全书第 6 章开始')
    // 卷号沿用游标（本批仍在卷一），章标题示例的「全书第N章」接着上一批的 5 章往后数。
    expect(prompt).toContain('## 第1卷第2单元第1章（全书第6章）：章名')
    // 非 main-owned 走 seed 续写：已确认前缀随请求一起带上，不需要额外的"前缀"提示块。
    expect(prompt).toContain('第5章：核对第5笔账')

    const saved = ipc.partialWrites.at(-1)!
    expect(saved.synopsis_range).toEqual({ from: 6, to: 9 })
    expect(saved.synopsis_covered_to).toBe(9)
    // 本卷最后一个单元完成 ⇒ 进卷二、卷内已写重置
    expect(saved.synopsis_unit_cursor).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 })
    expect(saved.synopsis_facts_fingerprint).toBe(currentFingerprint({ from: 6, to: 9 }))
    // 卷一写完：计划 30 章、实际 9 章 ⇒ 累计偏离 −21（实际预期 = 60 − 21 = 39）
    expect(saved.synopsis_volume_deviations).toEqual([{ volumeIndex: 1, planned: 30, actual: 9 }])
  })

  it('断点续写：中断检查点（range = boundTo、游标未推进）续写后按实际章数落盘并推进游标', async () => {
    const partialBody = chapters(1, 5)
    const addition = '\n\n' + chapters(6, 9)
    const interruptedDb = `# 情节大纲\n\n${partialBody}\n\n> ⚠️ **本大纲未完成**：生成被输出长度中断，以上为已自动保存的已完成部分。\n> 可在「AI 输出」提示处点击「继续生成情节大纲」，从断点续写补齐本批章节。`
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: responseStream([addition]) })
    const ipc = harness({
      synopsis_result: partialBody,
      synopsis_incomplete: true,
      synopsis_covered_to: 5,
      // 中断落盘用**请求范围**：单元 2 的 boundTo = 6 + 25 − 1 = 30
      synopsis_range: { from: 6, to: 30 },
      synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 },
      synopsis_facts_fingerprint: currentFingerprint({ from: 6, to: 30 }),
      synopsis_db_hash: synopsisFactsFingerprint([interruptedDb]),
      synopsis_step_guidance: '',
    }, interruptedDb)

    await makeCommand({ from: 6, unitIndex: 2, maxChapters: 25, volumeRemaining: 25 }, true)
      .execute({ step: {}, context, callbacks })

    const saved = ipc.partialWrites.at(-1)!
    expect(saved.synopsis_incomplete).toBe(false)
    expect(saved.synopsis_range).toEqual({ from: 6, to: 9 })
    expect(saved.synopsis_covered_to).toBe(9)
    expect(saved.synopsis_unit_cursor).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 })
    expect(saved.synopsis_facts_fingerprint).toBe(currentFingerprint({ from: 6, to: 9 }))
  })

  it('跨卷后继续：游标卷内已写重置为 0 不被判成"游标损坏"，下一单元接在卷末之后', async () => {
    const first = chapters(1, 9)
    // 单元 2 完成后：进卷二、卷内已写 = 0
    const checkpoint: CheckpointSnapshot = {
      synopsis_result: first,
      synopsis_incomplete: false,
      synopsis_covered_to: 9,
      synopsis_range: { from: 6, to: 9 },
      synopsis_unit_cursor: { volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 },
      synopsis_volume_deviations: [{ volumeIndex: 1, planned: 30, actual: 9 }],
      synopsis_facts_fingerprint: currentFingerprint({ from: 6, to: 9 }),
      synopsis_step_guidance: '',
    }
    const dbSynopsis = `# 情节大纲\n\n${first}\n\n> 本大纲已覆盖至第 9 章（全书 60 章），其余章节将在后续批次继续生成。`
    const stream = responseStream([chapters(10, 13)])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    const ipc = harness({ ...checkpoint, synopsis_db_hash: synopsisFactsFingerprint([dbSynopsis]) }, dbSynopsis)

    await makeCommand({ from: 10, unitIndex: 1, maxChapters: 30, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })

    expect(promptText(stream, 0)).toContain('【第 2 卷第 1 单元：配合】')
    expect(promptText(stream, 0)).toContain('从全书第 10 章开始')
    const saved = ipc.partialWrites.at(-1)!
    expect(saved.synopsis_range).toEqual({ from: 10, to: 13 })
    expect(saved.synopsis_covered_to).toBe(13)
    // 弧光单元骨架走完 ⇒ 就是「写完」，与计划章数无关（作者口径：200 章是计划不是约束）。
    expect(saved.synopsis_unit_cursor).toBeUndefined()
    // 卷二写完：计划 30 章、实际 4 章 ⇒ 累计偏离 −21 + (−26) = −47（实际预期 60 − 47 = 13 = 实际章数）
    expect(saved.synopsis_volume_deviations).toEqual([
      { volumeIndex: 1, planned: 30, actual: 9 },
      { volumeIndex: 2, planned: 30, actual: 4 },
    ])
    // 不能再挂「其余章节将在后续批次继续生成」——骨架走完就没有后续批次了。
    expect(ipc.dbSynopsis()).not.toContain('其余章节将在后续批次继续生成')
    expect(callbacks.log).toHaveBeenCalledWith(expect.stringContaining('实际预期 13 章'))
  })

  it('作废已写章节重新规划：清空累计卷偏离，回到计划章数为基准', async () => {
    const stream = responseStream([chapters(1, 5)])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    const ipc = harness({
      synopsis_result: chapters(1, 3),
      synopsis_incomplete: false,
      synopsis_covered_to: 3,
      synopsis_range: { from: 1, to: 3 },
      synopsis_volume_deviations: [{ volumeIndex: 1, planned: 30, actual: 9 }],
    })

    // 旧路径（章号区间）显式覆盖重写：from = 1 且原有已写内容 = 作废重规划
    await new GeneratePlotArchitectureCommand(['synopsis'], { expectedProjectPath: projectAPath, novelConfig } as never,
      createWorkflowRuntimeDependencies(), { synopsisRange: { from: 1, to: 5 } })
      .execute({ step: {}, context, callbacks })

    const saved = ipc.partialWrites.at(-1)!
    expect(saved.synopsis_range).toEqual({ from: 1, to: 5 })
    expect(saved.synopsis_volume_deviations).toBeUndefined()
    expect(callbacks.log).toHaveBeenCalledWith(expect.stringContaining('回到计划章数 60 章为基准'))
  })

  it('过期请求（单元序号与游标不符）fail-closed，不生成', async () => {
    const stream = responseStream([])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    harness({
      synopsis_result: chapters(1, 5),
      synopsis_incomplete: false,
      synopsis_covered_to: 5,
      synopsis_range: { from: 1, to: 5 },
      synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 },
      synopsis_facts_fingerprint: currentFingerprint({ from: 1, to: 5 }),
      synopsis_step_guidance: '',
    }, `# 情节大纲\n\n${chapters(1, 5)}\n\n> 本大纲已覆盖至第 5 章（全书 60 章），其余章节将在后续批次继续生成。`)

    await expect(makeCommand({ from: 6, unitIndex: 1, maxChapters: 15, volumeRemaining: 25 })
      .execute({ step: {}, context, callbacks })).rejects.toThrow('不一致')
    expect(stream).not.toHaveBeenCalled()
  })

  /**
   * 实机故障（2026-10-20）：模型把标题写成「## 第 1 章：xxx」（章号两侧带空格），
   * 旧解析只认紧排 ⇒ 覆盖=0 ⇒ 回填判「没写出本章标题」整批丢弃。
   */
  it('章号两侧带空格也能回填（第 1 章 与 第1章 同等对待）', async () => {
    const spaced = Array.from({ length: 6 }, (_, index) =>
      `## 第 ${index + 1} 章：核对第${index + 1}笔账\r\n周岚翻开账本核对这一笔赊欠，把来路和去处都对上。`,
    ).join('\r\n\r\n')
    const stream = responseStream([spaced])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    const ipc = harness()

    await makeCommand({ from: 1, unitIndex: 1, maxChapters: 6, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })

    const saved = ipc.partialWrites.at(-1)!
    expect(saved.synopsis_range).toEqual({ from: 1, to: 6 })
    expect(saved.synopsis_covered_to).toBe(6)
    expect(saved.synopsis_unit_cursor).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 6 })
  })

  /**
   * 同一故障的第二层：回填失败必须**整批不落库**，并在报错里说清「能认出的最大章号」。
   * （主进程托管运行时的批前预写与回滚走 `previousBatchPartial`，本夹具不是 main-owned，
   *   那一段由实机 T10 覆盖；这里锁住的是「失败即不提交」和报错可诊断。）
   */
  it('回填失败：整批不落库，报错带上能认出的最大章号', async () => {
    const stream = responseStream(['这一段完全没有章标题，只是一段自由文本。'])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    const ipc = harness({ synopsis_covered_to: 0, synopsis_incomplete: false })

    await expect(makeCommand({ from: 1, unitIndex: 1, maxChapters: 6, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })).rejects.toThrow('能认出的最大章号：0')

    // 没有提交：没有一次落盘把 covered_to 推高，DB 正文也没被写
    expect(ipc.partialWrites.every(write => (write.synopsis_covered_to ?? 0) === 0)).toBe(true)
    expect(ipc.dbSynopsis()).toBe('')
  })
})

/**
 * 2026-10-20 实机事故：作者手改检查点（A6 把 writtenInVolume +3）之后，文件读数失败被当成
 * 「全书未开始」，于是从第 1 章开写，把已完成的 21 章大纲覆盖成 4 章。
 *
 * 这两条锁的是命令侧的最后一道闸：**读不出来 / 读丢了都不许开工**。
 */
describe('GeneratePlotArchitectureCommand · 检查点不可信时 fail-closed', () => {
  it('检查点读不出来（JSON / 编码）⇒ 中止，一次模型调用都不发', async () => {
    const stream = responseStream([chapters(1, 5)])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    harness({}, '', 'invalid-json')

    await expect(makeCommand({ from: 1, unitIndex: 1, maxChapters: 6, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })).rejects.toThrow('检查点读不出来')
    expect(stream).not.toHaveBeenCalled()
  })

  it('检查点丢了但库里已有大纲 ⇒ 中止（继续下去唯一的结果就是覆盖重写）', async () => {
    const stream = responseStream([chapters(1, 5)])
    useLLMStore.setState({ defaultModelId: 'model-1', generateStream: stream })
    harness({}, chapters(1, 21))

    await expect(makeCommand({ from: 1, unitIndex: 1, maxChapters: 6, volumeRemaining: 30 })
      .execute({ step: {}, context, callbacks })).rejects.toThrow('已有第 1–21 章')
    expect(stream).not.toHaveBeenCalled()
  })
})
