import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { globalEventBus } from '../../shared/event-bus'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { projectSessionContextFromProject } from '../../shared/project-session-context'
import { useLayoutStore } from '../../stores/layout-store'
import { useProjectStore } from '../../stores/project-store'
import { useWorkflowStore, type WorkflowRun, type WorkflowType } from '../../stores/workflow-store'
import { disposeSystemNotifyHub, initSystemNotifyHub, refreshSystemNotifySoundPolicy, registerSystemNotifyRule } from '../system-notify/notify-hub'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  playSound: vi.fn(),
}))

vi.mock('../ipc-client', () => ({
  ipc: { invoke: mocks.invoke, on: mocks.on },
}))

vi.mock('../system-notify/sounds', () => ({
  DEFAULT_NOTIFICATION_SOUND_VOLUME: 0.6,
  playSystemNotificationSound: mocks.playSound,
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

/** 只数 `system-notification:show`：初始化时还会读一次 `config:get`（声音策略）。 */
function showCalls(): Array<[string, Record<string, unknown>]> {
  return mocks.invoke.mock.calls.filter(([channel]) => channel === 'system-notification:show') as
    Array<[string, Record<string, unknown>]>
}

/** 等异步链跑完（事件处理器是 fire-and-forget）。 */
async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  mocks.invoke.mockReset()
  // 初始化时的 `config:get` 与真正的 `show` 返回不同形状。
  mocks.invoke.mockImplementation(async (channel: string) => (
    channel === 'config:get' ? {} : { shown: true }
  ))
  mocks.on.mockReset()
  mocks.on.mockReturnValue(() => {})
  mocks.playSound.mockReset()
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

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(showCalls()[0]![1]).toMatchObject({
      title: 'AI小说作家',
      body: '「第 3 章」已完成',
      sound: 'complete',
      route: 'editor',
    })
  })

  it('没有编辑器产物的类型落到右栏 ai-output', async () => {
    const session = installProject()
    emitComplete(session, makeRun(session, 'post_process', '角色卡提取'))

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(showCalls()[0]![1]).toMatchObject({ route: 'ai-output' })
  })

  it('批量生成走专门文案，且不编造章数', async () => {
    const session = installProject()
    emitComplete(session, makeRun(session, 'batch_generate', '第 1-10 章'))

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    const payload = showCalls()[0]![1] as { body: string; route: string }
    expect(payload.body).toBe('「第 1-10 章」批量生成已完成')
    expect(payload.route).toBe('editor')
    expect(payload.body).not.toMatch(/\d+\s*章批量/)
  })

  it('合并键取规则 id（同一类通知 3 秒内只弹一条由主进程判）', async () => {
    const session = installProject()
    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(showCalls()[0]![1].coalesceKey).toBe('workflow-complete')
  })

  it('提示音在本地播，音量取设置里的值', async () => {
    mocks.invoke.mockImplementation(async (channel: string) => (
      channel === 'config:get' ? { notificationSoundVolume: 0.25 } : { shown: true }
    ))
    // 策略在 init 时读的，这里重建一次让新配置生效。
    disposeSystemNotifyHub()
    initSystemNotifyHub()
    await refreshSystemNotifySoundPolicy()
    const session = installProject()

    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))

    await vi.waitFor(() => expect(mocks.playSound).toHaveBeenCalledWith('complete', { volume: 0.25 }))
  })

  it('声音开关关掉后不响（弹窗照旧）', async () => {
    mocks.invoke.mockImplementation(async (channel: string) => (
      channel === 'config:get' ? { notificationSoundEnabled: false } : { shown: true }
    ))
    disposeSystemNotifyHub()
    initSystemNotifyHub()
    await refreshSystemNotifySoundPolicy()
    const session = installProject()

    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(mocks.playSound).not.toHaveBeenCalled()
  })

  it('会话已被同路径新 lease 取代时，旧 run 的完成不弹给新会话', async () => {
    const staleSession = installProject()
    // 同一个路径重新打开过：projectId/path 相同，leaseId 变了。
    installProject({ leaseId: 'lease-A2' })

    emitComplete(staleSession, makeRun(staleSession, 'chapter_creation', '第 3 章'))

    await flush()
    expect(showCalls()).toHaveLength(0)
  })

  it('run 查不到时不弹（事件不能凭空造通知）', async () => {
    const session = installProject()
    globalEventBus.emit('WORKFLOW_COMPLETE', {
      type: 'chapter_creation',
      projectPath: PROJECT_PATH,
      projectSession: session,
      runId: 'run-missing',
    })

    await flush()
    expect(showCalls()).toHaveLength(0)
  })

  it('重复初始化不会让同一条事件弹两次', async () => {
    const session = installProject()
    initSystemNotifyHub()
    initSystemNotifyHub()

    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    await flush()
    expect(showCalls()).toHaveLength(1)
  })

  // ---- N2：定稿 / 失败两条规则 ----

  it('定稿完成：文案带章号与章名，route 回前台', async () => {
    const session = installProject()
    globalEventBus.emit('FINALIZE_COMPLETE', {
      tabId: 'tab-1',
      chapterNumber: 10,
      chapterTitle: '月底查账',
      projectPath: PROJECT_PATH,
      projectSession: session,
      draftId: 10,
      finalizationId: 'f-1',
      contentHash: 'x',
    } as never)

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(showCalls()[0]![1]).toMatchObject({
      body: '第10章「月底查账」已定稿',
      sound: 'complete',
      route: 'editor',
      coalesceKey: 'finalize-complete',
    })
  })

  it('定稿通知同样做会话校验：旧会话的定稿不弹给新会话', async () => {
    const staleSession = installProject()
    installProject({ leaseId: 'lease-A2' })

    globalEventBus.emit('FINALIZE_COMPLETE', {
      tabId: 'tab-1',
      chapterNumber: 10,
      chapterTitle: '月底查账',
      projectPath: PROJECT_PATH,
      projectSession: staleSession,
      draftId: 10,
      finalizationId: 'f-1',
      contentHash: 'x',
    } as never)

    await flush()
    expect(showCalls()).toHaveLength(0)
  })

  it('失败通知：用错误音，正文带第一行摘要，落到 ai-output', async () => {
    globalEventBus.emit('WORKFLOW_ERROR', {
      title: '第 3 章生成',
      error: '模型返回空响应\n    at somewhere',
    })

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(showCalls()[0]![1]).toMatchObject({
      body: '「第 3 章生成」失败：模型返回空响应',
      sound: 'error',
      route: 'ai-output',
      coalesceKey: 'workflow-error',
    })
    expect(mocks.playSound).toHaveBeenCalledWith('error', { volume: 0.6 })
  })

  it('失败通知：超长错误只截 120 字，不把整块栈塞进系统通知', async () => {
    globalEventBus.emit('WORKFLOW_ERROR', { title: '批量生成', error: 'x'.repeat(400) })

    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    const body = showCalls()[0]![1].body as string
    expect(body).toContain('：')
    expect(body.length).toBeLessThan(160)
    expect(body.endsWith('…')).toBe(true)
  })

  it('失败通知：没有标题就不弹（不造就一条无从指认的通知）', async () => {
    globalEventBus.emit('WORKFLOW_ERROR', { title: '   ', error: 'boom' })

    await flush()
    expect(showCalls()).toHaveLength(0)
  })

  it('规则热插拔：同 id 覆盖、注销后不再生效', async () => {
    const session = installProject()
    const dispose = registerSystemNotifyRule({
      id: 'workflow-complete',
      events: ['WORKFLOW_COMPLETE'],
      build: () => ({ title: 'T', body: '覆盖版', route: 'ai-output' }),
    })

    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))
    await vi.waitFor(() => expect(showCalls()).toHaveLength(1))
    expect(showCalls()[0]![1].body).toBe('覆盖版')

    dispose()
    mocks.invoke.mockClear()
    emitComplete(session, makeRun(session, 'chapter_creation', '第 3 章'))
    await flush()
    expect(showCalls()).toHaveLength(0)
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
