import { normalizeKeyEvents } from '../../../shared/blueprint-key-events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

import type { StepCallbacks, WorkflowContext } from '../../../stores/workflow-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useProjectStore } from '../../../stores/project-store'
import { createChapterWorkflow, createRepairFinalizeWorkflow } from '../chapter-workflow'

const postProcess = vi.hoisted(() => ({
  params: [] as Array<Record<string, unknown>>,
  execute: vi.fn(async (params: unknown) => { void params }),
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

const PROJECT_PATH = 'C:\\novels\\repair-finalize'
const PROJECT_SESSION = Object.freeze({
  projectId: 'repair-finalize',
  leaseId: 'lease-repair-finalize',
  projectPath: PROJECT_PATH,
})
const originalLocale = useLocaleStore.getState().locale

function finalizedSource(content: string) {
  return {
    status: 'valid' as const,
    snapshot: {
      source: {
        draftId: 17,
        finalizationId: 'finalization-17',
        chapterNumber: 3,
        contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
      },
      chapterTitle: '定稿标题',
      content,
      projectionGeneration: 0,
    },
  }
}

function context(): WorkflowContext {
  return {
    runId: 'repair-finalize-run',
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

afterEach(() => {
  postProcess.params.length = 0
  postProcess.execute.mockClear()
  vi.unstubAllGlobals()
  useLocaleStore.setState({ locale: originalLocale })
  useProjectStore.setState({ currentProject: null })
})

describe('createRepairFinalizeWorkflow', () => {
  it('scopes direct writing and repair to the target chapter', () => {
    const writing = createChapterWorkflow({
      projectPath: PROJECT_PATH,
      chapterNumber: 3,
      title: '第三章',
      role: '发展',
      purpose: '推进冲突',
      characters: [],
      keyEvents: normalizeKeyEvents('冲突升级'),
      wordsTarget: 4200,
    }, PROJECT_SESSION)
    const repair = createRepairFinalizeWorkflow(3, PROJECT_PATH, PROJECT_SESSION)

    expect(writing).toMatchObject({
      chapterWordsTarget: 4200,
      resourceKeys: ['chapter:3'],
      readResourceKeys: ['novel-config', 'architecture', 'blueprints'],
    })
    expect(repair).toMatchObject({
      resourceKeys: [
        'chapter:3',
        'character-roster',
        'continuity',
        'chapter-summary',
      ],
      readResourceKeys: ['novel-config', 'architecture', 'blueprints'],
    })
  })

  it.each([
    ['all failed steps', undefined],
    ['one failed step', 'character_cards'],
  ] as const)('retries %s without rerunning successful steps', async (_label, stepKey) => {
    useProjectStore.setState({
      currentProject: {
        id: PROJECT_SESSION.projectId,
        name: 'Repair finalize',
        path: PROJECT_PATH,
        sessionLease: PROJECT_SESSION.leaseId,
      } as never,
    })
    const invoke = vi.fn(async (channel: string) => {
      switch (channel) {
        case 'db:draft-get-finalized':
          return { id: 17 }
        case 'db:draft-get-full':
          return { content: '已定稿正文' }
        case 'db:continuity-read-source':
          return finalizedSource('已定稿正文')
        case 'db:blueprint-get':
          return { title: '定稿标题', characters: ['林舟'] }
        default:
          throw new Error(`unexpected IPC: ${channel}`)
      }
    })
    vi.stubGlobal('window', { aiNovelAPI: { invoke } })

    const workflow = createRepairFinalizeWorkflow(3, PROJECT_PATH, PROJECT_SESSION, stepKey)
    const step = workflow.steps[0]!
    await step.executor({
      ...step,
      id: 'repair-finalize-step',
      status: 'running',
      logs: [],
    }, context(), callbacks())

    expect(postProcess.params).toEqual([expect.objectContaining({
      chapterNumber: 3,
      draftId: 17,
      onlyFailed: true,
      stepKey,
    })])
    expect(postProcess.execute).toHaveBeenCalledOnce()
  })

  it('fails the repair workflow when a non-critical step still fails, and explains a terminal conflict', async () => {
    // 回归护栏：非关键步骤失败不会让 runPostProcessPipeline 抛错，历史上这会让工作流
    // "成功"结束、UI 提示修复完成，而状态卡仍显示失败（用户看到两个矛盾结论）。
    useProjectStore.setState({
      currentProject: {
        id: PROJECT_SESSION.projectId,
        name: 'Repair finalize',
        path: PROJECT_PATH,
        sessionLease: PROJECT_SESSION.leaseId,
      } as never,
    })
    const invoke = vi.fn(async (channel: string) => {
      switch (channel) {
        case 'db:draft-get-finalized':
          return { id: 17 }
        case 'db:draft-get-full':
          return { content: '已定稿正文' }
        case 'db:continuity-read-source':
          return finalizedSource('已定稿正文')
        case 'db:blueprint-get':
          return { title: '定稿标题', characters: ['林舟'] }
        default:
          throw new Error(`unexpected IPC: ${channel}`)
      }
    })
    vi.stubGlobal('window', { aiNovelAPI: { invoke } })
    postProcess.execute.mockResolvedValueOnce({
      scope: 'chapter_3_finalize',
      sourceLabel: '第3章定稿',
      createdAt: '2026-10-17T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
      allCriticalPassed: true,
      steps: {
        chapter_notes: {
          label: '章节剧情要点', critical: true, ok: true, lastAttemptAt: '', attemptCount: 1,
        },
        character_cards: {
          label: '角色状态更新', critical: false, ok: false, lastAttemptAt: '', attemptCount: 4,
          error: "Error invoking remote method 'finalization-generation:commit': Error: FINALIZED_CHARACTER_SOURCE_CONFLICT",
        },
      },
    } as never)

    const workflow = createRepairFinalizeWorkflow(3, PROJECT_PATH, PROJECT_SESSION, 'character_cards')
    const step = workflow.steps[0]!
    let failure: Error | undefined
    await step.executor({
      ...step,
      id: 'repair-finalize-step',
      status: 'running',
      logs: [],
    }, context(), callbacks()).catch((error: unknown) => { failure = error as Error })

    expect(failure).toBeInstanceOf(Error)
    expect(failure!.message).toContain('修复未完成：角色状态更新')
    expect(failure!.message).toContain('FINALIZED_CHARACTER_SOURCE_CONFLICT')
    // 顺序冲突是终局的：必须说明"重试不会成功"，否则用户会一直点重试
    expect(failure!.message).toContain('重复重试不会成功')
  })

  it('freezes English repair copy, fallback metadata, and completion text at creation', async () => {
    useLocaleStore.setState({ locale: 'en-US' })
    useProjectStore.setState({
      currentProject: {
        id: PROJECT_SESSION.projectId,
        name: 'Repair finalize',
        path: PROJECT_PATH,
        sessionLease: PROJECT_SESSION.leaseId,
      } as never,
    })
    const invoke = vi.fn(async (channel: string) => {
      switch (channel) {
        case 'db:draft-get-finalized':
          return { id: 17 }
        case 'db:draft-get-full':
          return { content: 'Finalized manuscript' }
        case 'db:continuity-read-source':
          return finalizedSource('Finalized manuscript')
        case 'db:blueprint-get':
          return null
        default:
          throw new Error(`unexpected IPC: ${channel}`)
      }
    })
    vi.stubGlobal('window', { aiNovelAPI: { invoke } })

    const workflow = createRepairFinalizeWorkflow(3, PROJECT_PATH, PROJECT_SESSION)
    expect(() => createRepairFinalizeWorkflow(3, PROJECT_PATH, {
      ...PROJECT_SESSION,
      projectPath: 'C:\\novels\\another-project',
    })).toThrow('Workflow project session does not match the target path')
    useLocaleStore.setState({ locale: 'zh-CN' })

    expect(workflow).toMatchObject({
      uiLocale: 'en-US',
      title: 'Chapter 3 · Repair post-processing',
      steps: [{
        name: 'Rebuild post-processing',
        description: 'Regenerate chapter notes, continuity facts, and character state from the finalized manuscript',
      }],
      onComplete: { mode: 'open', message: 'Chapter 3 post-processing repair completed' },
    })
    const step = workflow.steps[0]!
    await step.executor({
      ...step,
      id: 'repair-finalize-step-en',
      status: 'running',
      logs: [],
    }, { ...context(), uiLocale: workflow.uiLocale! }, callbacks())

    expect(postProcess.params).toEqual([expect.objectContaining({
      chapterTitle: 'Chapter 3',
      sourceLabel: 'Chapter 3 finalized manuscript',
    })])
  })

  it.each([
    ['project switch', 'project', 'The project changed, so repair was stopped.'],
    ['missing finalized record', 'draft', 'The finalized record for Chapter 3 could not be found.'],
    ['missing finalized content', 'content', 'Could not read finalized manuscript content: ID=17'],
  ] as const)('uses frozen English for the %s error', async (_label, failure, expected) => {
    useLocaleStore.setState({ locale: 'en-US' })
    if (failure !== 'project') {
      useProjectStore.setState({
        currentProject: {
          id: PROJECT_SESSION.projectId,
          name: 'Repair finalize',
          path: PROJECT_PATH,
          sessionLease: PROJECT_SESSION.leaseId,
        } as never,
      })
    }
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'db:draft-get-finalized') return failure === 'draft' ? null : { id: 17 }
      if (channel === 'db:draft-get-full') return null
      throw new Error(`unexpected IPC: ${channel}`)
    })
    vi.stubGlobal('window', { aiNovelAPI: { invoke } })
    const workflow = createRepairFinalizeWorkflow(3, PROJECT_PATH, PROJECT_SESSION)
    useLocaleStore.setState({ locale: 'zh-CN' })
    const step = workflow.steps[0]!

    await expect(step.executor({
      ...step,
      id: 'repair-finalize-error-step',
      status: 'running',
      logs: [],
    }, { ...context(), uiLocale: workflow.uiLocale! }, callbacks())).rejects.toThrow(expected)
  })
})
