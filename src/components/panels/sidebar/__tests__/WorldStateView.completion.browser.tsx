import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorldStateView from '../WorldStateView'
import { useProjectStore } from '../../../../stores/project-store'
import { useLocaleStore } from '../../../../stores/locale-store'
import { useLLMStore } from '../../../../stores/llm-store'
import { useWorkflowStore } from '../../../../stores/workflow-store'
import { setActiveProjectSessionContext } from '../../../../shared/project-session-context'
import { emptyWorldStateView } from '../../../../shared/world-state-view'
import type { ProjectData } from '../../../../shared/ipc-channels'

const project = { id: 'w5', path: 'C:\\novels\\w5', sessionLease: 'lease-w5' } as ProjectData
const model = { id: 'model-w5', name: 'Test model', modelName: 'test', baseUrl: 'https://example.invalid' } as ReturnType<typeof useLLMStore.getState>['models'][number]
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** 一个 orphan 名字：归位表里被蓝图提到、但还没有角色卡。 */
const view = (() => {
  const base = emptyWorldStateView(project.path)
  return {
    ...base,
    castLedger: {
      entries: [{ name: '林舟', status: 'orphan' as const, characterIds: [], mentions: [{ name: '林舟', source: 'blueprint' as const, chapterNumber: 3 }] }],
      counts: { orphan: 1, ambiguous: 0, anchored: 0, carded: 0 },
    },
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
  await act(async () => root.render(<WorldStateView />))
  await settle()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'aiNovelAPI')
  setActiveProjectSessionContext(null)
  useProjectStore.setState(originals.project)
  useLocaleStore.setState(originals.locale)
  useLLMStore.setState(originals.llm)
  useWorkflowStore.setState(originals.workflow)
  vi.restoreAllMocks()
})

describe('世界状态 · 归位表补齐并建卡', () => {
  it('orphan 行先披露模型端点，取消后不启动工作流', async () => {
    expect(document.body.textContent).toContain('归位表')
    await click('补齐并建卡')
    expect(document.body.textContent).toContain(model.baseUrl)
    await click('取消')
    expect(start).not.toHaveBeenCalled()
    // 取消后按钮恢复可点，仍停在同一条 orphan 行。
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
    expect(container.querySelectorAll('input').length).toBe(0)
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelectorAll('[contenteditable="true"]').length).toBe(0)
    // 归位表四档里只有 orphan 行带动作入口：刷新 + 补齐并建卡，再没有批准/写入按钮。
    expect(container.querySelectorAll('button').length).toBe(2)
  })
})
