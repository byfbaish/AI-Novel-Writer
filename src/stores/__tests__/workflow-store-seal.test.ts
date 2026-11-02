import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowStore, type WorkflowContext } from '../workflow-store'
import { useProjectStore } from '../project-store'
import { useLocaleStore } from '../locale-store'

const projectPath = 'C:\\test-project'
const handle = { projectId: 'test-project', epoch: 'lease-test-project', rootActionId: 'root-1', runId: 'run-1' }
const frozenSession = (leaseId = 'lease-test-project') => ({ projectId: 'test-project', leaseId, projectPath })
const receipt = { runId: 'run-1', rootActionId: 'root-1', runStatus: 'completed', rootStatus: 'sealed', settledRuns: 1, verdict: 'sealed' }

/** 桥接替身：未知通道继续拒绝，免得把真实 IPC 缺失掩盖成「测试没配」。 */
function stubBridge(seal: () => unknown = () => receipt) {
  const invoke = vi.fn(async (channel: string, payload?: unknown) => {
    if (channel === 'skills:list-user') return []
    if (channel === 'fs:check-exists') return false
    if (channel === 'generation:seal') { void payload; return seal() }
    throw new Error(`测试未配置桌面调用：${channel}`)
  })
  vi.stubGlobal('window', { aiNovelAPI: { invoke, on: vi.fn(() => () => {}), once: vi.fn() } })
  return invoke
}

const sealCalls = (invoke: ReturnType<typeof stubBridge>) => invoke.mock.calls.filter(([channel]) => channel === 'generation:seal')

beforeEach(() => {
  stubBridge()
  useWorkflowStore.setState({ activeRuns: [], history: [], globalLogs: [], waitingRuns: {}, currentRun: null, waitingForConfirm: false, waitingAfterStepIndex: -1 })
  useProjectStore.setState({
    currentProject: { id: 'test-project', name: 'Test', path: projectPath, sessionLease: 'lease-test-project', novelConfig: {} } as never,
  })
  useLocaleStore.setState({ locale: 'zh-CN', initialized: true })
})

/** 一个最小工作流：executor 只负责把主进程 handle 挂进上下文。 */
function runOnce(options: { assignHandle?: boolean; failStep?: boolean } = {}) {
  return useWorkflowStore.getState().startWorkflow({
    runId: 'seal-run',
    type: 'architecture_generation',
    title: '收口测试',
    projectPath,
    projectSession: frozenSession(),
    steps: [{
      name: '一步',
      description: '一步',
      executor: async (_step, context: WorkflowContext) => {
        if (options.assignHandle !== false) context.mainGenerationRootHandle = handle
        if (options.failStep) throw new Error('步进失败')
      },
    }],
  })
}

describe('D2：workflow run 收尾写批次终态', () => {
  it('成功收尾 → 只调一次 generation:seal，outcome 为 completed', async () => {
    const invoke = stubBridge()
    await runOnce()
    const calls = sealCalls(invoke)
    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toMatchObject({ outcome: 'completed', handle: expect.objectContaining({ runId: 'run-1' }) })
    expect(useWorkflowStore.getState().history[0].status).toBe('completed')
  })

  it('步骤失败 → outcome 为 failed（成功和失败在库里不能长得一样）', async () => {
    const invoke = stubBridge()
    await runOnce({ failStep: true })
    expect(sealCalls(invoke)[0][1]).toMatchObject({ outcome: 'failed' })
    expect(useWorkflowStore.getState().history[0].status).toBe('failed')
  })

  it('没开过主进程 run（无 handle）→ 不调 seal', async () => {
    const invoke = stubBridge()
    await runOnce({ assignHandle: false })
    expect(sealCalls(invoke)).toHaveLength(0)
  })

  // 终态缺失是缺陷，但「因为写终态失败导致工作流卡在收尾」是更严重的缺陷。
  it('seal 抛错 → 工作流仍记 completed，只留一条 warn', async () => {
    const invoke = stubBridge(() => { throw new Error('GENERATION_SEAL_IPC_DOWN') })
    await runOnce()
    const state = useWorkflowStore.getState()
    expect(state.history[0].status).toBe('completed')
    const warns = state.globalLogs.filter(log => log.level === 'warn')
    expect(warns).toHaveLength(1)
    expect(warns[0].message).toContain('批次终态未能写入账本')
    expect(sealCalls(invoke)).toHaveLength(1)
  })
})
