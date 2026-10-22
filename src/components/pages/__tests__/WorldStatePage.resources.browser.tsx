import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorldStatePage from '../WorldStatePage'
import { useProjectStore } from '../../../stores/project-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useWorkflowStore, type WorkflowRun } from '../../../stores/workflow-store'
import { useWorldStateStore } from '../../../stores/world-state-store'
import { emptyWorldStateView, type WorldStateResources, type WorldStateView } from '../../../shared/world-state-view'
import type { ResourceDefinition, ResourceMovement } from '../../../shared/resource-ledger'
import type { ProjectData } from '../../../shared/ipc-channels'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'

/**
 * 「资源」分类（第六区）的渲染与回填契约。
 *
 * 重点验四件事：
 * 1. 三态各有自己的样子 —— 未知 / 冲突**都不能显示成一个数**；
 * 2. 未扫描的章在走势图里留空（虚线条目），不画成 0；
 * 3. 引文可展开；族分组不出现合计；
 * 4. 只有两个回填动作会碰写路径，且它们只经工作流工厂；页面自身的 IPC 只有两个读通道。
 */
const project = { id: 'w6c', path: 'C:\\novels\\w6c', sessionLease: 'lease-w6c' } as ProjectData
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function resource(overrides: Partial<ResourceDefinition> & { resourceId: string; name: string }): ResourceDefinition {
  return {
    familyId: null,
    tier: 0,
    unit: '枚',
    anchorValue: null,
    period: '卷',
    earnNote: '',
    costNote: '',
    scarcityNote: '',
    anchorNote: '',
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    ...overrides,
  }
}

function movement(overrides: Partial<ResourceMovement> & { id: number; resourceId: string; chapterNumber: number; delta: number }): ResourceMovement {
  return {
    unit: '枚',
    evidence: '他把袋子推过来。',
    source: 'finalized-extract',
    createdAt: '2026-10-22T00:00:00.000Z',
    ...overrides,
  }
}

const stone = resource({ resourceId: 'res:stone-low', name: '下品灵石', familyId: '灵石', tier: 0 })
const stoneHigh = resource({ resourceId: 'res:stone-high', name: '上品灵石', familyId: '灵石', tier: 2, anchorValue: 100 })
const merit = resource({ resourceId: 'res:merit', name: '军功', unit: '点' })
const token = resource({ resourceId: 'res:token', name: '令牌', unit: '枚' })

/** 三个资源刚好覆盖三态：known / no-origin / unit-mismatch。 */
const movements: ResourceMovement[] = [
  movement({ id: 1, resourceId: stone.resourceId, chapterNumber: 0, delta: 30, source: 'author', evidence: '开篇：袋中三十枚。' }),
  movement({ id: 2, resourceId: stone.resourceId, chapterNumber: 1, delta: 10, evidence: '取走十枚。' }),
  movement({ id: 3, resourceId: stone.resourceId, chapterNumber: 2, delta: -6, evidence: '又花掉六枚。' }),
  movement({ id: 4, resourceId: stone.resourceId, chapterNumber: 3, delta: 120, evidence: '掌柜推来一百二十枚灵石。' }),
  movement({ id: 5, resourceId: merit.resourceId, chapterNumber: 1, delta: 5, unit: '点', evidence: '记军功五分。' }),
  movement({ id: 6, resourceId: token.resourceId, chapterNumber: 0, delta: 2, source: 'author', evidence: '开篇两枚令牌。' }),
  movement({ id: 7, resourceId: token.resourceId, chapterNumber: 2, delta: 1, unit: '块', evidence: '又多了一块令牌。' }),
]

function viewOf(resources: WorldStateResources, chapterCount = 3): WorldStateView {
  return {
    ...emptyWorldStateView(project.path),
    resources,
    chapters: Array.from({ length: chapterCount }, (_, index) => ({
      chapterNumber: index + 1,
      title: null,
      storyDayOffset: null,
      storyDayLabel: null,
      draftStatus: 'finalized',
      observations: [],
    })),
  }
}

function runRecord(id: string, status: 'completed' | 'failed', error?: string): WorkflowRun {
  return {
    id,
    projectPath: project.path,
    projectSession: { projectId: project.id, projectPath: project.path, leaseId: project.sessionLease! },
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    type: 'chapter_creation',
    title: id,
    status,
    steps: [],
    currentStepIndex: 0,
    createdAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  }
}

const originals = {
  project: useProjectStore.getState(),
  locale: useLocaleStore.getState(),
  workflow: useWorkflowStore.getState(),
}
let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let start: ReturnType<typeof vi.fn<ReturnType<typeof useWorkflowStore.getState>['startWorkflow']>>
let testLease = 0

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

function button(label: string) {
  const found = [...document.querySelectorAll('button')]
    .find(node => node.textContent === label || node.getAttribute('aria-label') === label)
  expect(found, label).toBeTruthy()
  return found!
}

async function click(label: string) {
  await act(async () => button(label).click())
  // 确认框有 200ms 退场动画。
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
}

async function mount(options: {
  resources: WorldStateResources
  chapterCount?: number
  scannedChapters?: number[]
  movements?: ResourceMovement[]
}) {
  const view = viewOf(options.resources, options.chapterCount ?? 3)
  invoke = vi.fn().mockImplementation((channel: string) => {
    if (channel === 'world-state:read') return Promise.resolve(view)
    if (channel === 'db:resource-ledger-read') {
      return Promise.resolve({
        success: true,
        resources: view.resources.items,
        movements: options.movements ?? movements,
        scannedChapters: options.scannedChapters ?? [1, 2, 3],
      })
    }
    return Promise.resolve(null)
  })
  Object.defineProperty(window, 'aiNovelAPI', {
    configurable: true,
    value: { invoke, on: vi.fn(() => () => {}), once: vi.fn(), send: vi.fn() },
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useWorldStateStore.getState().setSection('resources')
  await act(async () => root.render(<WorldStatePage />))
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  useWorldStateStore.getState().reset()
  project.sessionLease = `lease-${++testLease}`
  useLocaleStore.setState({ locale: 'zh-CN', initialized: true })
  useProjectStore.setState({ currentProject: project })
  setActiveProjectSessionContext({ projectId: project.id, projectPath: project.path, leaseId: project.sessionLease! })
  start = vi.fn<ReturnType<typeof useWorkflowStore.getState>['startWorkflow']>().mockResolvedValue('run-none')
  useWorkflowStore.setState({ startWorkflow: start, history: [], getResourceConflict: () => null })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'aiNovelAPI')
  setActiveProjectSessionContext(null)
  useWorldStateStore.getState().reset()
  useProjectStore.setState(originals.project)
  useLocaleStore.setState(originals.locale)
  useWorkflowStore.setState(originals.workflow)
  vi.restoreAllMocks()
})

describe('世界状态页 · 资源（第六区）', () => {
  it('三态各有自己的样子：数值 / 未登记开篇余额 / 单位不一致', async () => {
    await mount({ resources: { unreadable: false, items: [stone, stoneHigh, merit, token] } })

    const text = container.textContent ?? ''
    // known：数值 + 截止章。
    expect(text).toContain('154 枚')
    expect(text).toContain('截至第 3 章')
    // no-origin：说「未登记开篇余额」，不是「中断」、更不是 0。
    expect(text).toContain('未知（未登记开篇余额）')
    expect(text).toContain('这是登记缺口')
    // conflict：列出两种单位与起始章，且不折算成一个数。
    expect(text).toContain('单位不一致：枚 / 块')
    expect(text).toContain('第 2 章起混记')
    expect(text).toContain('不合并、不换算')
    // 未知资源不能渲染成「0 点 / 0 枚」（+30 枚 之类的合法数字不算）。
    expect(text).not.toMatch(/(^|\D)0\s*(枚|点|块|粒)/u)
  })

  it('走势图把未扫描的章留成空槽，不画成 0', async () => {
    await mount({ resources: { unreadable: false, items: [stone] }, scannedChapters: [1] })

    const text = container.textContent ?? ''
    expect(text).toContain('未知（第 2 章起未扫描）')
    expect(text).toContain('第 2 章起账本中断')
    expect(text).toContain('虚线 = 该章未知，不是 0')
    // 只画第 1 章那一根；第 2、3 章是虚线空槽。
    expect(container.querySelectorAll('[data-ledger-bar]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-ledger-gap]')).toHaveLength(2)
    const gap = container.querySelector('[data-ledger-gap="2"]')
    expect(gap?.getAttribute('title')).toContain('未知')
  })

  it('引文可展开、族分组不给合计、异常有标记', async () => {
    await mount({ resources: { unreadable: false, items: [stone, stoneHigh] } })

    const text = container.textContent ?? ''
    // 同族两个品阶并成一组，并明写「不合计」。
    expect(text).toContain('族：灵石')
    expect(text).toContain('2 个品阶')
    expect(text).toContain('不合计')
    // 引文原文与章号都在 DOM 里（details 折叠时也已渲染）。
    expect(text).toContain('第 1 章 · 引文')
    expect(text).toContain('取走十枚。')
    expect(text).toContain('开篇（第 0 章）')
    // 第 2 → 3 章从 34 涨到 154：+120，骤增。
    expect(text).toContain('骤增 第 3 章 +120')
  })

  it('未登记资源时给引导，不渲染空表', async () => {
    await mount({ resources: { unreadable: false, items: [] } })

    const text = container.textContent ?? ''
    expect(text).toContain('尚未登记资源')
    expect(text).toContain('资源登记')
    expect(container.querySelectorAll('[data-ledger-bar]')).toHaveLength(0)
    // 没有资源就没有可回填的对象：一个按钮都不该有。
    expect(container.querySelectorAll('button')).toHaveLength(1)
  })

  it('资源表读不出来时显式「未读取」，不退化成「尚未登记」', async () => {
    await mount({ resources: { unreadable: true, items: [] } })

    const text = container.textContent ?? ''
    expect(text).toContain('本次没读到资源登记表')
    expect(text).toContain('不是「0 个资源」')
    expect(text).not.toContain('尚未登记资源')
  })

  it('页面自身只调两个读通道，回填只经工作流工厂', async () => {
    await mount({ resources: { unreadable: false, items: [stone] } })

    const channels = new Set(invoke.mock.calls.map(([channel]) => channel as string))
    expect([...channels].sort()).toEqual(['db:resource-ledger-read', 'world-state:read'])
    expect(invoke.mock.calls.every(([channel]) => (
      channel === 'world-state:read' || channel === 'db:resource-ledger-read'
    ))).toBe(true)

    // 除两个回填动作外没有任何可编辑控件。
    expect(container.querySelectorAll('input').length).toBe(0)
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelectorAll('[contenteditable="true"]').length).toBe(0)
  })

  it('「重扫本章变动」按章启动回填工作流，并给出结果提示', async () => {
    start.mockImplementation(async (definition) => {
      const id = `run-${definition.title}`
      useWorkflowStore.setState(state => ({ history: [runRecord(id, 'completed'), ...state.history] }))
      return id
    })
    await mount({ resources: { unreadable: false, items: [stone] } })

    await click('重扫本章变动')

    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('第 1 章'),
      steps: [expect.objectContaining({ name: '重扫资源账本' })],
    }), true)
    expect(container.textContent).toContain('第 1 章重扫完成。')
  })

  it('「补扫第 1–N 章」按顺序逐章跑，失败即停并说明停在哪一章', async () => {
    start.mockImplementation(async (definition) => {
      const chapter = Number(/第 (\d+) 章/u.exec(definition.title)?.[1] ?? '0')
      const id = `run-${chapter}`
      const failed = chapter === 2
      useWorkflowStore.setState(state => ({
        history: [
          runRecord(id, failed ? 'failed' : 'completed', failed ? '定稿正文来源收据已失效' : undefined),
          ...state.history,
        ],
      }))
      return id
    })
    await mount({ resources: { unreadable: false, items: [stone] } })

    // 取消时一章都不跑。
    await click('补扫第 1–3 章')
    // 确认框是 portal 到 body 的，不在页面容器里。
    expect(document.body.textContent).toContain('任何一章失败会立刻停下')
    await click('取消')
    expect(start).not.toHaveBeenCalled()

    // 确认后：第 1 章成功、第 2 章失败 ⇒ 停在第 2 章，第 3 章不跑。
    await click('补扫第 1–3 章')
    await click('开始补扫')
    expect(start).toHaveBeenCalledTimes(2)
    const text = container.textContent ?? ''
    expect(text).toContain('第 1 章完成（1/3）')
    expect(text).toContain('补扫停在第 2 章')
    expect(text).toContain('定稿正文来源收据已失效')
    expect(text).not.toContain('第 3 章完成')
  })
})
