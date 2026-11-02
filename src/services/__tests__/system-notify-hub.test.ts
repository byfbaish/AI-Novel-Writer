import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { globalEventBus } from '../../shared/event-bus'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { projectSessionContextFromProject } from '../../shared/project-session-context'
import { useLayoutStore } from '../../stores/layout-store'
import { useProjectStore } from '../../stores/project-store'
import { useWorkflowStore, type WorkflowRun, type WorkflowType } from '../../stores/workflow-store'
import { disposeSystemNotifyHub, initSystemNotifyHub } from '../system-notify/notify-hub'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
}))

vi.mock('../ipc-client', () => ({
  ipc: { invoke: mocks.invoke, on: mocks.on },
}))

const PROJECT_PATH = 'C:\\novels\\A'

function installProject(overrides: { leaseId?: string } = {}): ProjectSessionContext {
  const project = {
    id: 'A',
    name: 'A',
    path: PROJECT_PATH,
    sessionLease: overrides.leaseId ?? 'lease-A',
    novelConfig: {},
  }
  useProjectStore.setState({ currentProject: project as never })
  const session = projectSessionContextFromProject(project as never)
  if (!session) throw new Error('fixture session missing')
  return session
}

function makeRun(session: ProjectSessionContext, type: WorkflowType, title: string): WorkflowRun {
  return {
    id: 'run-1',
    projectPath: PROJECT_PATH,
    projectSession: session,
    type,
    title,
    status: 'completed',
    steps: [],
    currentStepIndex: 0,
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    createdAt: '2026-11-01T00:00:00.000Z',
  } as unknown as WorkflowRun
}

function emitComplete(session: ProjectSessionContext, run: WorkflowRun): void {
  useWorkflowStore.setState({ activeRuns: [run], history: [] })
  globalEventBus.emit('WORKFLOW_COMPLETE', {
    type: run.type,
    projectPath: PROJECT_PATH,
    projectSession: session,
    runId: run.id,
  })
}

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.invoke.mockResolvedValue({ shown: true })
  mocks.on.mockReset()
  mocks.on.mockReturnValue(() => {})
  useLayoutStore.setState({ sidebarView: 'project', rightView: 'agent', aiPanelOpen: false })
  useWorkflowStore.setState({ activeRuns: [], history: [] })
  initSystemNotifyHub()
})

afterEach(() => {
  disposeSystemNotifyHub()
  useProjectStore.setState({ currentProject: null })
  useWorkflowStore.setState({ activeRuns: [], history: [] })
})

describe('SystemNotifyHub', () => {
  it('章节完成后请求一条通知，route 只回前台（不开文件）', async () => {
    const session = installProject()
    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))

    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1))
    expect(mocks.invoke).toHaveBeenCalledWith('system-notification:show', {
      title: 'AI小说作家',
      body: '「第 3 章」已完成',
      sound: 'complete',
      route: 'editor',
    })
  })

  it('没有编辑器产物的类型落到右栏 ai-output', async () => {
    const session = installProject()
    emitComplete(session, makeRun(session, 'post_process', '角色卡提取'))

    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1))
    expect(mocks.invoke.mock.calls[0][1]).toMatchObject({ route: 'ai-output' })
  })

  it('批量生成走专门文案，且不编造章数', async () => {
    const session = installProject()
    emitComplete(session, makeRun(session, 'batch_generate', '第 1-10 章'))

    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1))
    const payload = mocks.invoke.mock.calls[0][1] as { body: string; route: string }
    expect(payload.body).toBe('「第 1-10 章」批量生成已完成')
    expect(payload.route).toBe('editor')
    expect(payload.body).not.toMatch(/\d+\s*章批量/)
  })

  it('会话已被同路径新 lease 取代时，旧 run 的完成不弹给新会话', async () => {
    const staleSession = installProject()
    // 同一个路径重新打开过：projectId/path 相同，leaseId 变了。
    installProject({ leaseId: 'lease-A2' })

    emitComplete(staleSession, makeRun(staleSession, 'chapter_creation', '第 3 章'))

    await Promise.resolve()
    await Promise.resolve()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('run 查不到时不弹（事件不能凭空造通知）', async () => {
    const session = installProject()
    globalEventBus.emit('WORKFLOW_COMPLETE', {
      type: 'chapter_creation',
      projectPath: PROJECT_PATH,
      projectSession: session,
      runId: 'run-missing',
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('重复初始化不会让同一条事件弹两次', async () => {
    const session = installProject()
    initSystemNotifyHub()
    initSystemNotifyHub()

    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))

    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })

  it('点击通知：ai-output 打开右栏，characters 切左栏，editor 什么都不做', () => {
    const activated = mocks.on.mock.calls.find(
      ([channel]) => channel === 'system-notification:activated',
    )?.[1] as (payload: { route: 'ai-output' | 'editor' | 'characters' }) => void
    expect(activated).toBeTypeOf('function')

    activated({ route: 'ai-output' })
    expect(useLayoutStore.getState()).toMatchObject({ rightView: 'ai-output', aiPanelOpen: true })

    activated({ route: 'characters' })
    expect(useLayoutStore.getState().sidebarView).toBe('characters')

    const before = useLayoutStore.getState()
    activated({ route: 'editor' })
    // editor = 只回前台：不改任何导航状态（自动开文件会盖掉作者当前内容）
    expect(useLayoutStore.getState()).toMatchObject({
      rightView: before.rightView,
      sidebarView: before.sidebarView,
      aiPanelOpen: before.aiPanelOpen,
    })
  })
})
