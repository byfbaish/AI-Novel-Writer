import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { ProjectData } from '../../../shared/ipc-channels'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { useLocaleStore } from '../../../stores/locale-store'
import WorldBuildingEditor from '../WorldBuildingEditor'
import ArchFileViewer from '../ArchFileViewer'
import ConfirmCard from '../../panels/agent/ConfirmCard'
import { useAgentStore } from '../../../stores/agent-store'
import { useLLMStore } from '../../../stores/llm-store'
import { useWorkflowStore } from '../../../stores/workflow-store'
import { SYNOPSIS_UNIT_LAUNCH_FLAG } from '../../../services/workflows/synopsis-unit-launch'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const project: ProjectData = {
  id: 'planning-entry', name: 'Planning entry', path: 'C:\\synthetic\\planning-entry', sessionLease: 'planning-lease',
  novelConfig: {
    genre: '奇幻', subGenre: '', targetAudience: '', totalChapters: 20, wordsPerChapter: 3000,
    plotStructure: 'three_act', narrativePOV: 'third_limited', coreOutline: '测试作者构想',
    worldSetting: '', goldenFinger: '', protagonistProfile: '', globalGuidance: '', writingLanguage: 'en-US',
  }, characterStates: '', createdAt: '', updatedAt: '',
}
const originalProject = useProjectStore.getState()
const originalLocale = useLocaleStore.getState()
const originalAgent = useAgentStore.getState()
const originalLLM = useLLMStore.getState()
const originalWorkflow = useWorkflowStore.getState()
let invoke: ReturnType<typeof vi.fn>
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  useProjectStore.setState({ currentProject: project })
  useLocaleStore.setState({ locale: 'zh-CN' })
  useLLMStore.setState({ defaultModelId: 'boundary-probe-model' })
  useWorkflowStore.setState({ activeRuns: [], history: [], globalLogs: [], waitingRuns: {}, currentRun: null })
  setActiveProjectSessionContext({ projectId: project.id, projectPath: project.path, leaseId: project.sessionLease! })
  invoke = vi.fn(async (channel: string) => {
      if (channel === 'config:get') return { outlineTargetUnits: 650 }
      if (channel === 'config:set') return { success: true }
      if (channel === 'generation:list' || channel === 'skills:list-user') return []
      if (channel === 'fs:check-exists') return false
      if (channel === 'prompt:load-global') return { templates: [], diagnostics: [] }
      if (channel === 'db:project-core-get') return { premise: '故事前提'.repeat(20), worldbuilding: '世界设定'.repeat(20), synopsis: '', totalChapters: 20 }
      if (channel === 'db:character-roster-read') return { status: 'ready', renderedMarkdown: '角色名单'.repeat(20), entries: [] }
      if (channel === 'db:blueprint-get-all') return []
      if (channel === 'fs:read-json') return { success: true, data: {} }
      if (channel === 'generation:begin') throw new Error('PLANNING_ENTRY_BOUNDARY_OBSERVED')
      throw new Error(`Unexpected IPC ${channel}`)
    })
  Object.defineProperty(window, 'aiNovelAPI', { configurable: true, value: {
    invoke, on: vi.fn(() => () => {}), once: vi.fn(), send: vi.fn(),
  } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'aiNovelAPI')
  setActiveProjectSessionContext(null)
  window.localStorage.removeItem(SYNOPSIS_UNIT_LAUNCH_FLAG)
  useProjectStore.setState(originalProject)
  useLocaleStore.setState(originalLocale)
  useAgentStore.setState(originalAgent)
  useLLMStore.setState(originalLLM)
  useWorkflowStore.setState(originalWorkflow)
})

it.each(['architecture-page', 'outline-file'] as const)('passes the confirmed range and word target through %s', async entry => {
  await act(async () => root.render(entry === 'architecture-page'
    ? <WorldBuildingEditor projectKey={project.path} />
    : <ArchFileViewer tabId="planning-outline" filePath="ai-novel://core/synopsis" projectKey={project.path} content="" savedContent="" />))
  if (entry === 'architecture-page') {
    await act(async () => page.getByRole('button', { name: 'AI 生成架构', exact: true }).click())
  } else {
    await act(async () => page.getByRole('button', { name: 'AI 生成', exact: true }).click())
  }
  await expect.element(page.getByRole('spinbutton', { name: '每章大纲目标词数' })).toHaveValue(650)
  await act(async () => {
    await page.getByRole('spinbutton', { name: '本次生成范围的结束章' }).fill('10')
    await page.getByRole('spinbutton', { name: '每章大纲目标词数' }).fill('1000')
    await page.getByRole('button', { name: /确认生成/ }).click()
  })
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('generation:begin', expect.objectContaining({
    authorInputs: expect.arrayContaining([
      { id: 'planning:target-units', text: '1000' },
      expect.objectContaining({ id: 'architecture:planning-intent', text: expect.stringContaining('"synopsisRange":{"from":1,"to":10}') }),
    ]),
  }), expect.anything()))
  await vi.waitFor(() => expect(useWorkflowStore.getState().activeRuns).toHaveLength(0))
  expect(invoke.mock.calls.some(([channel]) => channel === 'generation:execute')).toBe(false)
})

/** 20 章、一卷两单元：卷内剩余 20 章摊到 2 个单元 ⇒ 名义上界 10 章。 */
const UNIT_PLAN = [
  '## 卷一：开头',
  '### 单元一：门牌',
  '- 叙事任务：立规则。',
  '### 单元二：定价',
  '- 叙事任务：把销档变成交易。',
].join('\n')

it('sends a unit batch instead of a chapter range when the E3 probe flag is on', async () => {
  window.localStorage.setItem(SYNOPSIS_UNIT_LAUNCH_FLAG, '1')
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'config:get') return { outlineTargetUnits: 650 }
    if (channel === 'config:set') return { success: true }
    if (channel === 'generation:list' || channel === 'skills:list-user') return []
    if (channel === 'fs:check-exists') return false
    if (channel === 'prompt:load-global') return { templates: [], diagnostics: [] }
    if (channel === 'db:project-core-get') {
      return {
        premise: '故事前提'.repeat(20), worldbuilding: '世界设定'.repeat(20), synopsis: '',
        plotStructurePlan: UNIT_PLAN, totalChapters: 20,
      }
    }
    if (channel === 'db:character-roster-read') return { status: 'ready', renderedMarkdown: '角色名单'.repeat(20), entries: [] }
    if (channel === 'db:blueprint-get-all') return []
    if (channel === 'fs:read-json') return { success: true, data: { synopsis_covered_to: 0 } }
    if (channel === 'generation:begin') throw new Error('PLANNING_ENTRY_BOUNDARY_OBSERVED')
    throw new Error(`Unexpected IPC ${channel}`)
  })
  await act(async () => root.render(<ArchFileViewer tabId="planning-outline-unit" filePath="ai-novel://core/synopsis" projectKey={project.path} content="" savedContent="" />))
  await act(async () => page.getByRole('button', { name: 'AI 生成', exact: true }).click())
  // 单元模式下弹窗**不再显示章号区间**：它只显示本单元的起章与名义上界，
  // 否则作者会以为「填了 1–10 就是按章跑」（2026-10-20 实机踩过）。
  // ⚠️ 断言必须**限定在本弹窗内部**：本文件的 beforeEach 每次新建 container，
  //    前序用例留下的 portal 还挂在 body 上，全局 getByRole 会命中那份旧的章号输入框。
  const unitDialog = () => Array.from(document.querySelectorAll('[role="dialog"]'))
    .find(el => el.textContent?.includes('单元模式：')
      && el.textContent?.includes('第 1 个单元')
      // 卷号必须一起显示：只写「第 k 个单元」时，作者会把卷一第 2 个单元读成「第二卷开始」。
      && el.textContent?.includes('第 1 卷'))
  await vi.waitFor(() => expect(unitDialog()).toBeTruthy())
  expect(unitDialog()!.querySelector('input[aria-label="本次生成范围的结束章"]')).toBeNull()
  await act(async () => {
    await page.getByRole('button', { name: /确认生成/ }).click()
  })
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('generation:begin', expect.objectContaining({
    authorInputs: expect.arrayContaining([
      expect.objectContaining({ id: 'architecture:planning-intent', text: expect.stringContaining('"synopsisUnit"') }),
    ]),
  }), expect.anything()))
  const begin = invoke.mock.calls.find(([channel]) => channel === 'generation:begin')?.[1] as unknown as {
    authorInputs: Array<{ id: string; text: string }>
  }
  const intent = begin.authorInputs.find(input => input.id === 'architecture:planning-intent')!.text
  // 单元模式下没有按章区间（显式 null）：`to` 由模型写完再回填。
  expect(intent).toContain('"synopsisRange":null')
  expect(intent).toContain('"synopsisUnit":{"from":1,"unitIndex":1,"maxChapters":10,"volumeRemaining":20}')
})

it.each(['generate_architecture', 'generate_blueprint'] as const)('shows the approved %s range and target without replacing them with defaults', async workflow => {  const resolveToolConfirmation = vi.fn()
  useAgentStore.setState({ resolveToolConfirmation })
  await act(async () => root.render(<ConfirmCard toolCall={{
    id: 'confirmed-planning', toolName: 'start_workflow', status: 'waiting_confirm',
    arguments: { workflow, start_chapter: 6, chapter_count: 10, target_units: 1000 },
  }} />))
  await expect.element(page.getByText(/范围为第 6–15 章，每章规划目标 1000 词/)).toBeVisible()
  await act(async () => page.getByRole('button', { name: '批准执行' }).click())
  expect(resolveToolConfirmation).toHaveBeenCalledWith('confirmed-planning', true)
})
