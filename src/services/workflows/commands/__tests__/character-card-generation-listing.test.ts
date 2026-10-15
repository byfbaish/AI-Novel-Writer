import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useProjectStore } from '../../../../stores/project-store'
import type { StepCallbacks, WorkflowContext } from '../../../../stores/workflow-store'
import type { CharacterProposalBatch } from '../../../../shared/character-proposal'
import type { BlueprintCharacterSyncOperation, BlueprintData } from '../../../../../electron/repositories/blueprint-repository'
import { CommitPlanningMaterialCharactersCommand } from '../planning-material.command'
import { ListPendingBlueprintCandidatesCommand } from '../character-card-generation.command'
import type { CommandExecuteParams } from '../base-command'

/**
 * 实机缺陷 1b（2026-10-15）：**「有待决」≠「可决策」**。
 *
 * 候选清单派生自**蓝图**（与批次决策无关），而批次身份是
 * `cpb:hash([projectId, {kind:'directory', operationId}])` —— 一个操作一个批次、批准即冻结。
 * 于是「已登记为锚点人物、后来撤销」的名字会重新出现在清单里，却没有任何可确认的批次；
 * 确认步只抛一句「缺少已预览的角色卡候选」，作者完全看不出该去哪（老陈/老周）。
 *
 * 本文件锁死两条纪律：
 *  1. 已批准批次**不得重开**（决策有身份效果），且必须**如实告知**而不是报配置错误；
 *  2. 取消过的批次**仍要重开**（取消不落身份效果）—— 回归保护，别把 1 修成 2 的破。
 */

const projectPath = 'C:\\novels\\A'
const projectSession = { projectId: 'project-1', leaseId: 'lease-1', projectPath }

function blueprint(chapterNumber: number, candidates: Array<{ name: string; role: string }>): BlueprintData {
  return {
    chapterNumber,
    title: `第${chapterNumber}章`,
    role: 'normal',
    purpose: '推进',
    keyEvents: [],
    characters: [],
    suspenseHook: '',
    userGuidance: '',
    notes: '',
    newCharacterCandidates: candidates,
  } as unknown as BlueprintData
}

function syncOperation(operationId: string, blueprints: BlueprintData[]): BlueprintCharacterSyncOperation {
  return {
    operationId,
    blueprintCommitOperationId: `commit-${operationId}`,
    blueprintCommitPayloadHash: 'hash',
    status: 'completed',
    startChapter: blueprints[0]?.chapterNumber ?? 1,
    endChapter: blueprints[blueprints.length - 1]?.chapterNumber ?? 1,
    characterSyncInput: blueprints,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    completedAt: '2026-10-15T00:00:00.000Z',
  } as BlueprintCharacterSyncOperation
}

function batch(status: CharacterProposalBatch['status'], items: CharacterProposalBatch['items'] = []): CharacterProposalBatch {
  return {
    proposalBatchId: 'cpb:测试',
    revision: status === 'approved' ? 3 : 1,
    status,
    source: { kind: 'directory', operationId: 'op-1' },
    items,
  } as unknown as CharacterProposalBatch
}

interface HarnessOptions {
  operations: BlueprintCharacterSyncOperation[]
  rosterNames?: string[]
  declined?: string[]
  /** 按操作 id 决定 `character-proposal:stage` 的返回；缺省给一个空的待批批次。 */
  stage?: (operationId: string) => CharacterProposalBatch
}

function harness({ operations, rosterNames = [], declined = [], stage }: HarnessOptions) {
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:blueprint-character-sync-list-all') return operations
    if (channel === 'db:character-get-all') return rosterNames.map(name => ({ name }))
    if (channel === 'character-proposal:list-declined') return declined
    if (channel === 'character-proposal:stage') {
      const request = args[0] as { source: { operationId: string } }
      return stage ? stage(request.source.operationId) : batch('pending-approval')
    }
    if (channel === 'character-proposal:reopen') {
      const request = args[0] as { proposalBatchId: string }
      return { ...batch('pending-approval'), proposalBatchId: request.proposalBatchId, revision: 2 }
    }
    throw new Error(`Unexpected IPC channel: ${channel}`)
  })
  vi.stubGlobal('window', { aiNovelAPI: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() } })
  return invoke
}

function makeContext(): WorkflowContext {
  return {
    runId: 'character-card-generation-run',
    projectPath,
    projectSession,
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    data: {},
    cancelled: false,
  } as unknown as WorkflowContext
}

function makeCallbacks(): StepCallbacks & { log: ReturnType<typeof vi.fn> } {
  return { log: vi.fn(), setProgress: vi.fn(), appendText: vi.fn() } as unknown as StepCallbacks & { log: ReturnType<typeof vi.fn> }
}

function params(context: WorkflowContext, callbacks: StepCallbacks): CommandExecuteParams {
  return { step: {}, context, callbacks }
}

describe('ListPendingBlueprintCandidatesCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({
      currentProject: {
        id: projectSession.projectId,
        name: 'A',
        path: projectPath,
        sessionLease: projectSession.leaseId,
        novelConfig: { writingLanguage: 'zh-CN' },
      } as never,
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('★ 实机复现：名字的来源批次已批准（撤销锚点后回榜）⇒ 不重开、不报错，优雅收场', async () => {
    // 老陈：登记为锚点人物后又被撤销 ⇒ 不再进 declined、也不在名册 ⇒ 重新出现在待建卡清单。
    const invoke = harness({
      operations: [syncOperation('op-ch1', [blueprint(1, [{ name: '老陈', role: 'minor' }])])],
      stage: () => batch('approved'),
    })
    const context = makeContext()
    const callbacks = makeCallbacks()

    const result = await new ListPendingBlueprintCandidatesCommand().execute(params(context, callbacks))

    // 决策已落库 ⇒ 绝不能重开（重开等于复写有身份效果的决策）。
    expect(invoke.mock.calls.some(([channel]) => channel === 'character-proposal:reopen')).toBe(false)
    // 明确告知「本入口只确认新候选」，并与「提取步没跑」区分开。
    expect(String(callbacks.log.mock.calls.map(call => call[0] ?? '').join('\n'))).toContain('已作出过决定')
    expect(result).toContain('已批准的批次不可重新打开')
    // 关键：落**空数组**（"没得确认"），而不是什么都不留。
    expect(context.data.planningMaterialCharacterCandidates).toEqual([])
    expect(context.data.characterProposalBatch).toBeUndefined()
  })

  it('★ 已批准来源不再让确认步抛「缺少已预览的角色卡候选」', async () => {
    harness({
      operations: [syncOperation('op-ch1', [blueprint(1, [{ name: '老陈', role: 'minor' }])])],
      stage: () => batch('approved'),
    })
    const context = makeContext()
    await new ListPendingBlueprintCandidatesCommand().execute(params(context, makeCallbacks()))

    const commit = new CommitPlanningMaterialCharactersCommand()
    const callbacks = makeCallbacks()
    await expect(commit.execute(params(context, callbacks))).resolves.toBeUndefined()
    expect(String(callbacks.log.mock.calls.map(call => call[0] ?? '').join('\n'))).toContain('没有待导入的角色卡')
  })

  it('回归：待批批次仍被接上确认闸门（写入路径只消费批次）', async () => {
    const items = [{ selectionKey: 'k', sourceId: 's', fields: { name: '老陈', role: 'minor' }, relationships: [], rawValue: {}, resolution: { status: 'unresolved', candidateIds: [] } }]
    harness({
      operations: [syncOperation('op-ch1', [blueprint(1, [{ name: '老陈', role: 'minor' }])])],
      stage: () => batch('pending-approval', items as unknown as CharacterProposalBatch['items']),
    })
    const context = makeContext()
    await new ListPendingBlueprintCandidatesCommand().execute(params(context, makeCallbacks()))

    expect((context.data.characterProposalBatch as CharacterProposalBatch).status).toBe('pending-approval')
    expect(context.data.planningMaterialCharacterCandidates).toEqual([{ name: '老陈', role: 'minor' }])
  })

  it('回归：取消过的批次仍会重开（取消不落身份效果，作者应能重来）', async () => {
    const invoke = harness({
      operations: [syncOperation('op-ch1', [blueprint(1, [{ name: '老陈', role: 'minor' }])])],
      stage: () => batch('cancelled'),
    })
    const context = makeContext()
    const callbacks = makeCallbacks()
    await new ListPendingBlueprintCandidatesCommand().execute(params(context, callbacks))

    expect(invoke.mock.calls.some(([channel]) => channel === 'character-proposal:reopen')).toBe(true)
    expect((context.data.characterProposalBatch as CharacterProposalBatch).status).toBe('pending-approval')
    expect(String(callbacks.log.mock.calls.map(call => call[0] ?? '').join('\n'))).toContain('重新打开')
  })

  it('已建卡 / 已登记为锚点人物的名字不进清单', async () => {
    harness({
      operations: [syncOperation('op-ch1', [
        blueprint(1, [{ name: '老陈', role: 'minor' }, { name: '周岚', role: 'supporting' }]),
      ])],
      rosterNames: ['周岚'],
      declined: ['老陈'],
    })
    const context = makeContext()
    const callbacks = makeCallbacks()
    const result = await new ListPendingBlueprintCandidatesCommand().execute(params(context, callbacks))

    expect(result).toContain('没有待建卡角色')
    expect(context.data.planningMaterialCharacterCandidates).toEqual([])
  })

  it('混合来源：一个操作是新候选、另一个已批准 ⇒ 用新候选过闸，并附带说明', async () => {
    const items = [{ selectionKey: 'k', sourceId: 's', fields: { name: '阿七', role: 'minor' }, relationships: [], rawValue: {}, resolution: { status: 'unresolved', candidateIds: [] } }]
    harness({
      operations: [
        syncOperation('op-ch1', [blueprint(1, [{ name: '老陈', role: 'minor' }])]),
        syncOperation('op-ch9', [blueprint(9, [{ name: '阿七', role: 'minor' }])]),
      ],
      stage: operationId => operationId === 'op-ch1'
        ? batch('approved')
        : batch('pending-approval', items as unknown as CharacterProposalBatch['items']),
    })
    const context = makeContext()
    const result = await new ListPendingBlueprintCandidatesCommand().execute(params(context, makeCallbacks()))

    expect((context.data.characterProposalBatch as CharacterProposalBatch).status).toBe('pending-approval')
    expect(context.data.planningMaterialCharacterCandidates).toEqual([{ name: '阿七', role: 'minor' }])
    expect(result).toContain('已批准的批次不可重新打开')
  })
})
