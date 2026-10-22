import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { StepCallbacks, WorkflowContext } from '../../../stores/workflow-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useProjectStore } from '../../../stores/project-store'
import { createRepairFinalizeWorkflow, createResourceLedgerBackfillWorkflow } from '../chapter-workflow'

const postProcess = vi.hoisted(() => ({
  params: [] as Array<Record<string, unknown>>,
  execute: vi.fn(async (...call: unknown[]) => { void call }),
}))

vi.mock('../commands/finalize-chapter.command', () => ({
  RunFinalizePostProcessCommand: class {
    constructor(params: Record<string, unknown>) {
      postProcess.params.push(params)
    }

    execute(params: unknown) {
      return postProcess.execute(params)
    }
  },
}))

const PROJECT_PATH = 'C:\\novels\\ledger-backfill'
const PROJECT_SESSION = Object.freeze({
  projectId: 'ledger-backfill',
  leaseId: 'lease-ledger-backfill',
  projectPath: PROJECT_PATH,
})
const CHAPTER_NUMBER = 2
const CONTENT = '他取走一百二十枚下品灵石。'

function frozenSource() {
  return {
    status: 'valid' as const,
    snapshot: {
      source: {
        draftId: 21,
        finalizationId: 'finalization-21',
        chapterNumber: CHAPTER_NUMBER,
        contentHash: createHash('sha256').update(CONTENT, 'utf8').digest('hex'),
      },
      chapterTitle: '第二章',
      content: CONTENT,
      projectionGeneration: 0,
    },
  }
}

function context(): WorkflowContext {
  return {
    runId: 'ledger-backfill-run',
    projectPath: PROJECT_PATH,
    projectSession: PROJECT_SESSION,
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    data: {},
    cancelled: false,
  }
}

function callbacks(): StepCallbacks {
  return { log: vi.fn(), setProgress: vi.fn(), appendText: vi.fn() }
}

function stubIpc() {
  const invoke = vi.fn(async (channel: string) => {
    switch (channel) {
      case 'db:draft-get-finalized':
        return { id: 21 }
      case 'db:draft-get-full':
        return { content: CONTENT }
      case 'db:continuity-read-source':
        return frozenSource()
      case 'db:blueprint-get':
        return { title: '第二章', characters: ['林舟'] }
      default:
        throw new Error(`unexpected IPC: ${channel}`)
    }
  })
  vi.stubGlobal('window', { aiNovelAPI: { invoke } })
}

async function runOnlyStep(workflow: ReturnType<typeof createResourceLedgerBackfillWorkflow>) {
  const step = workflow.steps[0]!
  await step.executor({ ...step, id: 'backfill-step', status: 'running', logs: [] }, context(), callbacks())
}

afterEach(() => {
  postProcess.params.length = 0
  postProcess.execute.mockClear()
  vi.unstubAllGlobals()
  useLocaleStore.setState({ locale: 'zh-CN' })
  useProjectStore.setState({ currentProject: null })
})

describe('createResourceLedgerBackfillWorkflow', () => {
  it('rescans only the resource-ledger step of a finalized chapter', async () => {
    useProjectStore.setState({
      currentProject: {
        id: PROJECT_SESSION.projectId,
        name: 'Ledger backfill',
        path: PROJECT_PATH,
        sessionLease: PROJECT_SESSION.leaseId,
      } as never,
    })
    stubIpc()

    const workflow = createResourceLedgerBackfillWorkflow(CHAPTER_NUMBER, PROJECT_PATH, PROJECT_SESSION)
    await runOnlyStep(workflow)

    expect(postProcess.params).toEqual([expect.objectContaining({
      chapterNumber: CHAPTER_NUMBER,
      draftId: 21,
      stepKey: 'resource-ledger',
      // 回填必须**无条件重扫**：要处理的恰恰是「当年根本没有这一步」的章，
      // 沿用 onlyFailed 的「已成功就跳过」会让回填对已完成章静默失效。
      onlyFailed: false,
    })])
  })

  it('routes the ledger step through the same step path the repair workflow uses', async () => {
    useProjectStore.setState({
      currentProject: {
        id: PROJECT_SESSION.projectId,
        name: 'Ledger backfill',
        path: PROJECT_PATH,
        sessionLease: PROJECT_SESSION.leaseId,
      } as never,
    })
    stubIpc()

    await runOnlyStep(createResourceLedgerBackfillWorkflow(CHAPTER_NUMBER, PROJECT_PATH, PROJECT_SESSION))
    await runOnlyStep(createRepairFinalizeWorkflow(CHAPTER_NUMBER, PROJECT_PATH, PROJECT_SESSION, 'resource-ledger'))

    // 一个写入口、一个步骤键、一个解析函数：两条入口只在 onlyFailed 上不同（判据 DM 的同型要求）。
    const [backfill, retry] = postProcess.params
    expect(backfill!.stepKey).toBe('resource-ledger')
    expect(retry!.stepKey).toBe('resource-ledger')
    expect(backfill!.onlyFailed).toBe(false)
    expect(retry!.onlyFailed).toBe(true)
  })

  it('freezes its own title and completion copy instead of borrowing the repair wording', () => {
    stubIpc()
    const backfill = createResourceLedgerBackfillWorkflow(CHAPTER_NUMBER, PROJECT_PATH, PROJECT_SESSION)
    expect(backfill).toMatchObject({
      title: `第 ${CHAPTER_NUMBER} 章 · 回填资源账本`,
      steps: [{ name: '重扫资源账本' }],
      onComplete: { mode: 'open', message: `第${CHAPTER_NUMBER}章资源账本回填完成` },
    })
  })
})
