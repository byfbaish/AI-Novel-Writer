import { afterEach, expect, it, vi } from 'vitest'

import type { MainGenerationRunView } from '../../generation/generation-runtime'
import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import type { StepCallbacks, WorkflowContext } from '../../../stores/workflow-store'
import { useProjectStore } from '../../../stores/project-store'
import { useWorkflowReasoningStore } from '../../../stores/workflow-reasoning-store'
import { createWorkflowMainGenerationRuntime } from '../workflow-main-generation'
import type { createMainGenerationTransport } from '../../generation/main-generation-transport'

const session: ProjectSessionContext = { projectId: 'novel', leaseId: 'lease', projectPath: 'C:/novel' }
const handle = { projectId: session.projectId, epoch: session.leaseId, rootActionId: 'root', runId: 'generation' }
const view: MainGenerationRunView = { handle,
  budget: { maxAttempts: 1, maxRequestedOutputTokens: 100, maxRequestedOutputTokensPerAttempt: 100, deadlineAt: 1000 },
  status: 'running', nonReplayable: false, artifacts: [] }
const originalProject = useProjectStore.getState()
const originalReasoning = useWorkflowReasoningStore.getState()

afterEach(() => {
  vi.unstubAllGlobals()
  useProjectStore.setState(originalProject, true)
  useWorkflowReasoningStore.setState(originalReasoning, true)
})

async function runtimeForImport(invoke: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('window', { aiNovelAPI: { invoke } })
  const transport = { read: vi.fn(async () => view), subscribe: vi.fn(() => () => {}) } as unknown as
    ReturnType<typeof createMainGenerationTransport>
  const context: WorkflowContext = { runId: 'workflow', projectPath: session.projectPath, projectSession: session,
    generationModelId: 'model', writingLanguage: 'zh-CN', uiLocale: 'zh-CN', data: {}, cancelled: false }
  const callbacks = { log: vi.fn(), setProgress: vi.fn(), appendText: vi.fn() } satisfies StepCallbacks
  return createWorkflowMainGenerationRuntime({ context, callbacks,
    selection: { operation: 'import-global-facts', promptKeys: [], skillStages: [], output: 'structured-data',
      importSlot: { runId: 'import-run', stage: 'global', batchId: 'done' } } }, transport)
}

it('refuses to dispatch a mainOwned task whose prompt exceeds its byte budget', async () => {
  const invoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(async channel => {
    if (channel === 'import-generation:read') return { view, modelId: 'model', frozenContext: {} }
    return { outcome: { receipt: {} }, run: view }
  })
  const runtime = await runtimeForImport(invoke)
  const task = { purpose: 'import-global-facts' as const, output: 'structured-data' as const,
    messages: [{ role: 'user' as const, content: '很长的提示词'.repeat(50) }],
    promptBudget: { limitUtf8Bytes: 64, sections: [] } }

  await runtime.execute(async ({ session: generation }) => {
    await expect(generation.complete(task)).rejects.toThrow('提示词预算不足')
  })
  // 丢给主进程之前就拦下：既没有发出请求，也没有产生 ordinal 副作用。
  expect(invoke.mock.calls.filter(([channel]) => channel === 'import-generation:execute')).toEqual([])
})

it('still dispatches when the same task carries no budget policy', async () => {
  const invoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(async channel => {
    if (channel === 'import-generation:read') return { view, modelId: 'model', frozenContext: {} }
    return { outcome: { receipt: {} }, run: view }
  })
  const runtime = await runtimeForImport(invoke)
  const task = { purpose: 'import-global-facts' as const, output: 'structured-data' as const,
    messages: [{ role: 'user' as const, content: '很长的提示词'.repeat(50) }] }

  await runtime.execute(async ({ session: generation }) => {
    await generation.complete(task).catch(() => undefined)
  })
  expect(invoke.mock.calls.filter(([channel]) => channel === 'import-generation:execute')).toHaveLength(1)
})
