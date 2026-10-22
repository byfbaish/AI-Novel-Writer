import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorldStatePage from '../WorldStatePage'
import { useProjectStore } from '../../../stores/project-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useLLMStore } from '../../../stores/llm-store'
import { useWorkflowStore } from '../../../stores/workflow-store'
import { useWorldStateStore } from '../../../stores/world-state-store'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { emptyWorldStateView } from '../../../shared/world-state-view'
import type { ProjectData } from '../../../shared/ipc-channels'

const project = { id: 'w5', path: 'C:\\novels\\w5', sessionLease: 'lease-w5' } as ProjectData
const model = { id: 'model-w5', name: 'Test model', modelName: 'test', baseUrl: 'https://example.invalid' } as ReturnType<typeof useLLMStore.getState>['models'][number]
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** 一个 orphan 名字 + 两天的定稿章节（用于验证时间线按日分组）。 */
const view = (() => {
  const base = emptyWorldStateView(project.path)
  return {
    ...base,
    castLedger: {
      entries: [{ name: '林舟', status: 'orphan' as const, characterIds: [], mentions: [{ name: '林舟', source: 'blueprint' as const, chapterNumber: 3 }] }],
      counts: { orphan: 1, ambiguous: 0, anchored: 0, carded: 0 },
    },
    chapters: [
      { chapterNumber: 1, title: '开端', storyDayOffset: 1, storyDayLabel: null, draftStatus: 'finalized' as const, observations: [] },
      { chapterNumber: 2, title: '同一天', storyDayOffset: 1, storyDayLabel: null, draftStatus: 'finalized' as const, observations: [] },
      { chapterNumber: 3, title: '第三日', storyDayOffset: 3, storyDayLabel: null, draftStatus: 'finalized' as const, observations: [] },
      { chapterNumber: 4, title: '日序未知', storyDayOffset: null, storyDayLabel: null, draftStatus: 'draft' as const, observations: [] },
    ],
    continuityFacts: [
      { chapterNumber: 1, text: '林舟在下品灵石矿脉取走一百二十枚' },
      { chapterNumber: 2, text: '林舟只剩二十枚灵石' },
    ],
  }
})()

const originals = {
  project: useProjectStore.getState(),
  locale: useLocaleStore.getState(),
  llm: useLLMStore.getState(),
  workflow: useWorkflowStore.getState(),
}
let root: Root
let container: HTMLDivElement
let start: ReturnType<typeof vi.fn<ReturnType<typeof useWorkflowStore.getState>['startWorkflow']>>
let invoke: ReturnType<typeof vi.fn>
let testLease = 0

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label)
  expect(result, label).toBeTruthy()
  return result!
}

async function click(label: string) {
  await act(async () => button(label).click())
  // Confirm dialogs resolve after their 200 ms exit animation.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
}

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

beforeEach(async () => {
  vi.clearAllMocks()
  useWorldStateStore.getState().reset()
  project.sessionLease = `lease-${++testLease}`
  invoke = vi.fn().mockImplementation((channel: string) => Promise.resolve(channel === 'world-state:read' ? view : null))
  Object.defineProperty(window, 'aiNovelAPI', { configurable: true, value: { invoke, on: vi.fn(() => () => {}), once: vi.fn(), send: vi.fn() } })
  start = vi.fn<ReturnType<typeof useWorkflowStore.getState>['startWorkflow']>().mockResolvedValue('failed-run')
  useLocaleStore.setState({ locale: 'zh-CN', initialized: true })
  useProjectStore.setState({ currentProject: project })
  setActiveProjectSessionContext({ projectId: project.id, projectPath: project.path, leaseId: project.sessionLease! })
  useLLMStore.setState({ models: [model], defaultModelId: model.id })
  useWorkflowStore.setState({ startWorkflow: start, history: [], getResourceConflict: () => null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<WorldStatePage />))
  await settle()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'aiNovelAPI')
  setActiveProjectSessionContext(null)
  useWorldStateStore.getState().reset()
  useProjectStore.setState(originals.project)
  useLocaleStore.setState(originals.locale)
  useLLMStore.setState(originals.llm)
  useWorkflowStore.setState(originals.workflow)
  vi.restoreAllMocks()
})

describe('世界状态页 · 归位表补齐并建卡', () => {
  it('orphan 卡先披露模型端点，取消后不启动工作流', async () => {
    expect(document.body.textContent).toContain('归位表')
    await click('补齐并建卡')
    expect(document.body.textContent).toContain(model.baseUrl)
    await click('取消')
    expect(start).not.toHaveBeenCalled()
    // 取消后按钮恢复可点，仍停在同一条 orphan 卡。
    expect(button('补齐并建卡')).toBeTruthy()
  })

  it('确认后启动两段式补齐工作流（生成 → 确认写入）', async () => {
    await click('补齐并建卡')
    await click('发送')
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      generationModelId: model.id,
      projectSession: { projectId: project.id, projectPath: project.path, leaseId: project.sessionLease },
      steps: [
        expect.objectContaining({ name: '补全缺失角色资料' }),
        expect.objectContaining({ name: '确认并写入角色卡' }),
      ],
    }), true)
  })

  it('没有默认模型时给出设置指引，不启动工作流', async () => {
    useLLMStore.setState({ models: [], defaultModelId: null })
    await click('补齐并建卡')
    expect(document.body.textContent).toContain('模型配置')
    expect(start).not.toHaveBeenCalled()
  })

  it('只读视图没有其他可编辑或批准控件', async () => {
    // 归位表 / 时间线 / 角色三个分类都没有输入框。
    // 事实栏那个搜索框只过滤内存里已加载的数组（不发 IPC、不写库），
    // 所以它出现在只读页里不违反只读契约 —— 见下一个 describe。
    expect(container.querySelectorAll('input').length).toBe(0)
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelectorAll('[contenteditable="true"]').length).toBe(0)
    // 归位表里只有 orphan 卡带动作入口：刷新 + 补齐并建卡，再没有批准/写入按钮。
    expect(container.querySelectorAll('button').length).toBe(2)
  })
})

describe('世界状态页 · 时间线', () => {
  it('按故事日分组，最近三组默认展开，日序未知单独成组', async () => {
    await act(async () => useWorldStateStore.getState().setSection('timeline'))
    await settle()

    // 用页面自己的 DOM，不用 document.body：全局 toast 容器会跨用例残留。
    const text = container.textContent ?? ''
    expect(text).toContain('第1日')
    expect(text).toContain('第3日')
    // 同一故事日的两章并进一组，组头给章号区间。
    expect(text).toContain('第 1–2 章')
    // 日序未知单独成组，不折算成第 0 日。
    expect(text).toContain('日序未知')
    expect(text).toContain('收起')
  })

  it('keeps the read-only channel as the only IPC call of the page', async () => {
    await act(async () => useWorldStateStore.getState().setSection('timeline'))
    await settle()

    expect(invoke.mock.calls.every(([channel]) => channel === 'world-state:read')).toBe(true)
  })
})

describe('世界状态页 · 事实检索', () => {
  async function typeSearch(value: string) {
    const input = container.querySelector('input[type="search"]') as HTMLInputElement | null
    expect(input).toBeTruthy()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(input, value)
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle()
  }

  it('filters facts locally without any extra IPC call', async () => {
    await act(async () => useWorldStateStore.getState().setSection('facts'))
    await settle()

    const callsBefore = invoke.mock.calls.length
    expect(container.textContent).toContain('2 / 2')

    await typeSearch('灵石')
    expect(container.textContent).toContain('2 / 2')

    await typeSearch('一百二十')
    expect(container.textContent).toContain('1 / 2')
    expect(container.textContent).toContain('取走一百二十枚')
    expect(container.textContent).not.toContain('只剩二十枚灵石')

    await typeSearch('不存在')
    expect(container.textContent).toContain('没有匹配的事实')

    // 搜索是纯内存过滤：一次 IPC 都不该多发。
    expect(invoke.mock.calls.length).toBe(callsBefore)
  })
})
