import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CharacterProposalBatch } from '../../../shared/character-proposal'
import type { GenerationOutcome, GenerationTask } from '../../generation/generation-harness'
import type { MainGenerationRunHandle } from '../../generation/generation-runtime'
import type { StepCallbacks, WorkflowContext } from '../../../stores/workflow-store'
import { useProjectStore } from '../../../stores/project-store'
import { CompleteCastLedgerCharactersCommand } from '../commands/cast-ledger-completion.command'

const projectPath = 'C:\\novels\\A'
const projectSession = { projectId: 'project-1', leaseId: 'lease-1', projectPath }
const runHandle: MainGenerationRunHandle = {
  projectId: 'project-1',
  epoch: 'epoch-1',
  rootActionId: 'root-1',
  runId: 'run-1',
}

function arrangeCurrentProject(): void {
  useProjectStore.setState({
    currentProject: {
      id: projectSession.projectId,
      name: 'A',
      path: projectPath,
      sessionLease: projectSession.leaseId,
      novelConfig: { writingLanguage: 'zh-CN' },
    } as never,
  })
}

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    runId: 'workflow-run-1',
    projectPath,
    projectSession,
    generationModelId: 'deepseek-v4-flash',
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    data: {},
    cancelled: false,
    mainGenerationRunHandle: runHandle,
    ...overrides,
  } as unknown as WorkflowContext
}

function makeCallbacks(): StepCallbacks {
  return {
    log: vi.fn(),
    setProgress: vi.fn(),
    appendText: vi.fn(),
  } as unknown as StepCallbacks
}

/** 每个 entry 都按 validateCharacterDetail(version 2) 的必填规则构造。 */
function detailEntry(slotId: string, name: string): Record<string, unknown> {
  return {
    slotId,
    name,
    role: 'supporting',
    gender: '女',
    age: '二十岁上下',
    appearance: '常穿深青色外袍，左眉有一道旧疤',
    personality: '寡言，但对承诺极其固执',
    background: '旧城药铺的学徒，师门在火并中覆灭',
    abilities: '辨药、缝合伤口，能读懂残破的旧方',
    motivation: '查清师门覆灭的真相并保住剩下的同伴',
    arc: '从回避冲突到主动承担',
    notes: '说话时习惯先沉默一拍',
    currentState: {
      location: '旧城',
      powerLevel: '低',
      physicalState: '左臂旧伤未愈',
      mentalState: '警惕',
      keyItems: ['药箱', '半张旧方'],
      recentEvents: ['城门封锁'],
      updatedAtChapter: 0,
    },
  }
}

function completedOutcome(entries: unknown[], options: { withArtifact?: boolean; textHash?: string } = {}): GenerationOutcome {
  const withArtifact = options.withArtifact ?? true
  return {
    status: 'completed',
    content: JSON.stringify({ entries }),
    finishReason: 'stop',
    receipt: {
      purpose: 'cast-ledger-character-completion',
      model: { id: 'deepseek-v4-flash', configurationRevision: 'rev-1', endpointFingerprint: 'fp-1' },
      capabilities: {},
      budget: {
        attempt: 1,
        maxAttempts: 12,
        requestedOutputTokens: 512,
        cumulativeRequestedOutputTokens: 512,
        maxRequestedOutputTokens: 98_304,
        maxRequestedOutputTokensPerAttempt: 8192,
        deadlineAt: Date.now() + 60_000,
      },
      finishReason: 'stop',
      ...(withArtifact
        ? { visibleArtifact: { artifactId: 'artifact-1', attemptId: 'attempt-1', revision: 1, textHash: options.textHash ?? 'hash-1' } }
        : {}),
    },
  } as unknown as GenerationOutcome
}

/** 从提示词里的冻结清单行反解本批 slotId/name，保证假模型回显真实名单。 */
function slotsFromTask(task: GenerationTask): Array<{ slotId: string; name: string }> {
  const userContent = task.messages.find(message => message.role === 'user')?.content ?? ''
  const slots = [...userContent.matchAll(/\{"slotId":"([^"]+)","name":"([^"]+)"\}/gu)]
    .map(match => ({ slotId: match[1]!, name: match[2]! }))
  if (!slots.length) throw new Error('测试夹具未能在提示词中找到冻结名单')
  return slots
}

function makeProposalBatch(names: readonly string[]): CharacterProposalBatch {
  return {
    proposalBatchId: 'batch-1',
    revision: 1,
    status: 'pending-approval',
    source: { kind: 'cast-ledger', names: [...names], handle: runHandle, artifacts: [{ artifactId: 'artifact-1', revision: 1, textHash: 'hash-1' }] },
    items: names.map(name => ({
      selectionKey: 'cast-ledger:' + name,
      sourceId: 'cast-ledger:' + name,
      resolution: { status: 'unresolved', candidateIds: [] },
      fields: { name, role: 'supporting' },
      relationships: [],
      rawValue: {},
    })),
  } as unknown as CharacterProposalBatch
}

interface HarnessOptions {
  /** 命令前置过滤读到的既有角色卡。 */
  cards?: string[]
  /** 生成结束后重查到的角色卡（缺省等于 cards）。 */
  cardsAfterGeneration?: string[]
  premise?: string | null
  /** 假模型的响应；缺省按冻结名单回显全部 entry 并带一个 visibleArtifact。 */
  respond?: (task: GenerationTask) => GenerationOutcome
  runHandle?: MainGenerationRunHandle | null
}

function makeHarness(names: readonly string[], options: HarnessOptions = {}) {
  const state = {
    cards: options.cards ?? [],
    characterGetAllCalls: 0,
  }
  const stagePayloads: unknown[] = []
  const stageResult = makeProposalBatch(names)
  const invoke = vi.fn(async (channel: string, ..._args: unknown[]) => {
    switch (channel) {
      case 'db:character-get-all': {
        state.characterGetAllCalls += 1
        const cards = state.characterGetAllCalls >= 2 && options.cardsAfterGeneration
          ? options.cardsAfterGeneration
          : state.cards
        return cards.map(cardName => ({ name: cardName }))
      }
      case 'db:project-core-get':
        return options.premise === undefined ? null : { premise: options.premise }
      case 'db:blueprint-get-all':
        return [{ chapterNumber: 1, characters: [names[0] ?? ''] }]
      case 'character-proposal:stage':
        stagePayloads.push(_args[0])
        return stageResult
      default:
        throw new Error('测试遇到未预期的 IPC 通道：' + channel)
    }
  })
  vi.stubGlobal('window', {
    aiNovelAPI: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() },
  })

  const complete = vi.fn(async (task: GenerationTask) => {
    if (options.respond) return options.respond(task)
    return completedOutcome(slotsFromTask(task).map(slot => detailEntry(slot.slotId, slot.name)))
  })
  let capturedMain: { selection?: Record<string, unknown> } | undefined
  const createRuntime = vi.fn(async (_options?: unknown, main?: unknown) => {
    capturedMain = main as typeof capturedMain
    return {
      execute: async (operation: (scope: { session: unknown }) => Promise<unknown>) => operation({
        session: { budget: {}, complete },
      }),
      close: async () => {},
    } as never
  })

  const command = new CompleteCastLedgerCharactersCommand(names, { createRuntime })
  return { command, invoke, complete, createRuntime, stagePayloads, stageResult, capturedMain: () => capturedMain, state }
}

beforeEach(() => {
  arrangeCurrentProject()
})

afterEach(() => {
  useProjectStore.setState({ currentProject: null })
  vi.unstubAllGlobals()
})

describe('CompleteCastLedgerCharactersCommand', () => {
  it('全部名字都已有角色卡时优雅收场，不进入生成运行时', async () => {
    const harness = makeHarness(['叶知秋', '沈砚'], { cards: ['叶知秋', '沈砚'] })
    const context = makeContext()
    const callbacks = makeCallbacks()

    const result = await harness.command.execute({ step: {}, context, callbacks })

    expect(result).toBe('这些名字都已有角色卡，无需补全。')
    expect(harness.createRuntime).not.toHaveBeenCalled()
    expect(callbacks.setProgress).toHaveBeenCalledWith(100)
    expect(callbacks.log).toHaveBeenCalledWith('这些名字都已有角色卡，无需补全。')
    expect(context.data.characterProposalBatch).toBeUndefined()
    // 只读了角色卡；没有任何写通道被调用。
    expect(harness.invoke.mock.calls.map(call => call[0])).toEqual(['db:character-get-all'])
  })

  it('只为缺卡的名字生成，authorInputs id/text 与 operation 符合主进程 proof 约定', async () => {
    const harness = makeHarness(['叶知秋', '沈砚'], { cards: ['沈砚'], premise: '旧城将倾' })

    const result = await harness.command.execute({ step: {}, context: makeContext(), callbacks: makeCallbacks() })

    expect(harness.createRuntime).toHaveBeenCalledTimes(1)
    const main = harness.capturedMain()
    expect(main?.selection?.operation).toBe('cast-ledger-character-completion')
    expect(main?.selection?.authorInputs).toEqual([{ id: 'cast-ledger:name:0', text: '叶知秋' }])
    expect(main?.selection?.output).toBe('structured-data')

    // 冻结名单与上下文都进了 detail 提示词；模型收到了故事前提。
    const task = harness.complete.mock.calls[0]?.[0] as GenerationTask
    expect(task.purpose).toBe('cast-ledger-character-completion')
    expect(task.output).toBe('structured-data')
    const userContent = task.messages.find(message => message.role === 'user')?.content ?? ''
    expect(userContent).toContain('旧城将倾')
    expect(userContent).toContain('{"slotId":"cast-1","name":"叶知秋"}')
    expect(userContent).not.toContain('"name":"沈砚"')

    expect(result).toContain('## 待确认角色提议')
  })

  it('stage 收到 cast-ledger source（names/handle/artifacts），并写回待确认批次', async () => {
    const harness = makeHarness(['叶知秋', '沈砚'], { premise: '旧城将倾' })
    const context = makeContext()
    const callbacks = makeCallbacks()

    const result = await harness.command.execute({ step: {}, context, callbacks })

    expect(harness.stagePayloads).toHaveLength(1)
    expect(harness.stagePayloads[0]).toEqual({
      source: {
        kind: 'cast-ledger',
        names: ['叶知秋', '沈砚'],
        handle: runHandle,
        artifacts: [{ artifactId: 'artifact-1', revision: 1, textHash: 'hash-1' }],
      },
    })
    expect(context.data.characterProposalBatch).toBe(harness.stageResult)
    expect(result).toContain('## 待确认角色提议')
    expect(result).toContain('这些名字来自归位表')
    expect(callbacks.log).toHaveBeenCalledWith('已为 2 个名字补齐资料，等待确认后建卡；角色名单尚未更改。')
    expect(callbacks.setProgress).toHaveBeenCalledWith(100)
  })

  it('缺少 run handle 时抛裸协议码 CHARACTER_CAST_LEDGER_ARTIFACT_INVALID', async () => {
    const harness = makeHarness(['叶知秋'], { runHandle: null })
    await expect(harness.command.execute({
      step: {},
      context: makeContext({ mainGenerationRunHandle: undefined }),
      callbacks: makeCallbacks(),
    })).rejects.toThrow('CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    expect(harness.stagePayloads).toHaveLength(0)
  })

  it('生成结果没有可见产物时抛 CHARACTER_CAST_LEDGER_ARTIFACT_INVALID，且不 stage', async () => {
    const harness = makeHarness(['叶知秋'], {
      respond: task => completedOutcome(
        slotsFromTask(task).map(slot => detailEntry(slot.slotId, slot.name)),
        { withArtifact: false },
      ),
    })
    await expect(harness.command.execute({
      step: {},
      context: makeContext(),
      callbacks: makeCallbacks(),
    })).rejects.toThrow('CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    expect(harness.stagePayloads).toHaveLength(0)
  })

  it('生成期间名字已建卡时放弃 stage', async () => {
    const harness = makeHarness(['叶知秋'], { cardsAfterGeneration: ['叶知秋'] })
    await expect(harness.command.execute({
      step: {},
      context: makeContext(),
      callbacks: makeCallbacks(),
    })).rejects.toThrow('名单已变化，请刷新世界状态后重试。')
    expect(harness.stagePayloads).toHaveLength(0)
  })

  it('模型改写名字时以失败收据终止，不 stage', async () => {
    const harness = makeHarness(['叶知秋'], {
      respond: task => completedOutcome(
        slotsFromTask(task).map(slot => detailEntry(slot.slotId, '叶知秋改写版')),
      ),
    })
    await expect(harness.command.execute({
      step: {},
      context: makeContext(),
      callbacks: makeCallbacks(),
    })).rejects.toThrow('归位表角色补全失败')
    expect(harness.stagePayloads).toHaveLength(0)
  })

  it('项目会话已切换时立即停止，不进入生成运行时', async () => {
    const harness = makeHarness(['叶知秋'])
    useProjectStore.setState({
      currentProject: {
        id: projectSession.projectId,
        name: 'A',
        path: projectPath,
        sessionLease: 'lease-2',
        novelConfig: { writingLanguage: 'zh-CN' },
      } as never,
    })
    await expect(harness.command.execute({
      step: {},
      context: makeContext(),
      callbacks: makeCallbacks(),
    })).rejects.toThrow('当前项目已切换，归位表补全已停止')
    expect(harness.createRuntime).not.toHaveBeenCalled()
  })
})
