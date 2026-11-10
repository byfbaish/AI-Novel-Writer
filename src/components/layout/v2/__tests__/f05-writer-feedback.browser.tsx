import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { useLocaleStore } from '../../../../stores/locale-store'
import { useProjectStore } from '../../../../stores/project-store'
import { useWorkflowStore, type WorkflowRun } from '../../../../stores/workflow-store'
import AIOutputPanel from '../../../panels/AIOutputPanel'
import ShellV2 from '../ShellV2'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const originalLocale = useLocaleStore.getState()
const originalProject = useProjectStore.getState()
const originalWorkflow = useWorkflowStore.getState()
const originalBridge = Object.getOwnPropertyDescriptor(window, 'aiNovelAPI')
const projectPath = 'C:/f05/feedback'
const projectSession = { projectId: 'f05-feedback', projectPath, leaseId: 'f05-feedback-lease' }
const run: WorkflowRun = {
  id: 'f05-feedback', projectPath, projectSession,
  writingLanguage: 'zh-CN', uiLocale: 'zh-CN', type: 'chapter_creation',
  title: '写稿 - 第 1 章：雨夜中的第一封来信', status: 'running',
  currentStepIndex: 0, createdAt: '2026-09-21T00:00:00.000Z',
  steps: [{ id: 'draft', name: '生成正文', description: '写稿', status: 'running', logs: [] }],
}

let host: HTMLDivElement
let root: Root

async function render() {
  await act(async () => root.render(
    <ShellV2 theme="paper" titleBar={<span>雨夜来信</span>}
      rail={<span>小说</span>} sidebar={<span>作品资料</span>} editor={<span>正文</span>}
      aiPanel={<AIOutputPanel />} bottom={<span>任务</span>} statusBar={<span>本地写作</span>} />,
  ))
  expect(host.querySelector('[data-shell-presentation="writer"]')).toBeTruthy()
}

async function result(text: string) {
  await act(async () => {
    const current = useWorkflowStore.getState().activeRuns[0]
    useWorkflowStore.setState({
      activeRuns: [{ ...current, steps: [{ ...current.steps[0], result: text }] }],
    })
  })
}

beforeEach(async () => {
  await page.viewport(1280, 900)
  useLocaleStore.setState({ ...originalLocale, locale: 'zh-CN', initialized: true })
  useProjectStore.setState({ ...originalProject, currentProject: {
    id: projectSession.projectId, name: 'Feedback project', path: projectPath,
    sessionLease: projectSession.leaseId, novelConfig: {},
  } as never })
  useWorkflowStore.setState({ ...originalWorkflow, activeRuns: [run], currentRun: run, history: [] })
  Object.defineProperty(window, 'aiNovelAPI', { configurable: true, value: {
    invoke: async (channel: string) => {
      if (['db:recovery-candidate-list', 'generation:list', 'generation:list-batches'].includes(channel)) return []
      throw new Error(`Unexpected IPC: ${channel}`)
    },
    on: () => () => {},
  } })
  host = document.createElement('div')
  host.style.height = '860px'
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  useLocaleStore.setState(originalLocale, true)
  useProjectStore.setState(originalProject, true)
  useWorkflowStore.setState(originalWorkflow, true)
  if (originalBridge) Object.defineProperty(window, 'aiNovelAPI', originalBridge)
  else Reflect.deleteProperty(window, 'aiNovelAPI')
})

it('U13.A01 Writer 输出区随工作流增量呈现正文', async () => {
  await render()
  await result('雨落在窗沿。')
  await act(async () => page.getByRole('button', { name: '查看当前输出（低频）' }).click())
  await vi.waitFor(() => expect(host.querySelector('[aria-label="写作助手"]')?.textContent).toContain('雨落在窗沿。'), { timeout: 4000 })
  await result('雨落在窗沿。门外有人敲门。')
  await vi.waitFor(() => expect(host.querySelector('[aria-label="写作助手"]')?.textContent).toContain('雨落在窗沿。门外有人敲门。'), { timeout: 4000 })
})

it('U13.A02 仅收到提供商推理时显示可折叠推理区，正文开始后仍可展开', async () => {
  await render()
  await result('<think>先核对前章时间线')
  expect(host.textContent).not.toContain('先核对前章时间线')
  await act(async () => {
    const current = useWorkflowStore.getState().activeRuns[0]
    useWorkflowStore.setState({ activeRuns: [{ ...current, steps: [{ ...current.steps[0], status: 'completed', result: '<think>先核对前章时间线</think>门外有人敲门。' }] }] })
  })
  await vi.waitFor(() => expect(host.textContent).toContain('门外有人敲门。'))
  expect(host.textContent).not.toContain('先核对前章时间线')
  await act(async () => page.getByRole('button', { name: '思考过程' }).click())
  expect(host.textContent).toContain('先核对前章时间线')
})

it.each([
  ['机器错误码', 'MODEL_RATE_LIMIT'],
  ['完整任务标题', run.title],
])('U13.A03 Writer 失败结果显示%s', async (_label, expected) => {
  const failed = {
    ...run, status: 'failed' as const, errorCode: 'MODEL_RATE_LIMIT',
    error: '提供商暂时拒绝请求',
    steps: [{ ...run.steps[0], status: 'failed' as const, errorCode: 'MODEL_RATE_LIMIT', error: '提供商暂时拒绝请求' }],
  }
  useWorkflowStore.setState({ activeRuns: [], currentRun: null, history: [failed] })
  await render()
  const historyItem = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find(button => button.textContent?.includes('雨夜中的第一封来信'))
  expect(historyItem).toBeTruthy()
  await act(async () => historyItem!.click())
  expect(host.querySelector('[aria-label="写作助手"]')?.textContent).toContain(expected)
})
