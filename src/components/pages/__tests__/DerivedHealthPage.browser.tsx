import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DerivedInventory } from '../../../shared/invalidation-plan'
import type { DerivedInventoryRead } from '../../../services/derived-inventory'

/**
 * 派生内容清点页（S7）。钉住五件事：
 *
 * 1. **空态与「读不到」不许混**：版本表不存在要说「还没有版本记录」，不能说「一切正常」
 *    （主稿 §9.2 的 blast radius 纪律 —— 把「不知道」显示成「0 项」是最危险的低估）。
 * 2. 分组按 `GROUP_ORDER`，计数进标题。
 * 3. `unseen` **默认收起**（它不是要处置的），展开后列得出是哪几类。
 * 4. 「去处置」的跳转参数：蓝图要带章号、定稿章要用 draftId 拼 `ai-novel://draft/<id>`。
 * 5. **跳转前必须切回 `project` 视图** —— 清点页是辅助页，`EditorArea` 用 `hidden`
 *    把 tab 区挡住；只开 tab 不切视图，作者看到的是「点了没反应」。
 */

const mocks = vi.hoisted(() => ({
  readDerivedInventory: vi.fn(),
  openArchFile: vi.fn(async () => {}),
  openBuiltinEditor: vi.fn(),
  openChapterFile: vi.fn(async () => {}),
}))

vi.mock('../../../services/derived-inventory', () => ({
  readDerivedInventory: mocks.readDerivedInventory,
}))

vi.mock('../../panels/sidebar/sidebar-file-openers', () => ({
  openArchFile: mocks.openArchFile,
  openBuiltinEditor: mocks.openBuiltinEditor,
  openChapterFile: mocks.openChapterFile,
}))

vi.mock('../../project-session-gate', () => ({
  captureProjectSession: () => ({ projectId: 'p1', leaseId: 'l1', projectPath: 'C:/projects/p1' }),
  isProjectSessionCurrent: () => true,
}))

import { useLayoutStore } from '../../../stores/layout-store'
import { useLocaleStore } from '../../../stores/locale-store'
import DerivedHealthPage from '../DerivedHealthPage'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const DRIFT = [{
  key: 'outline:book',
  have: 3,
  need: 5,
  changed: [{ rev: 4, chapters: [12, 13, 14], at: '2026-10-31T14:05:00.000Z', reason: 'author-edit' as const }],
}]

function inventory(overrides: Partial<DerivedInventory> = {}): DerivedInventory {
  return {
    groups: [
      { kind: 'blueprint', count: 2, items: [
        { label: '第 12 章', chapters: [12], behind: DRIFT },
        { label: '第 14 章', chapters: [14], behind: DRIFT },
      ] },
      { kind: 'finalized', count: 1, items: [{ label: '第 12 章', chapters: [12], behind: DRIFT }] },
    ],
    unseen: { count: 2, kinds: ['plot-tree', 'handoff'] },
    upstream: [
      { domain: 'outline', scope: 'book', rev: 5, at: '2026-10-31T14:05:00.000Z', reason: 'author-edit' },
    ],
    finalizedDrafts: [{ chapterNumber: 12, draftId: 77 }],
    scannedAt: '2026-11-01T02:00:00.000Z',
    ...overrides,
  }
}

let root: Root
let container: HTMLDivElement

function testid(name: string): HTMLElement {
  const target = container.querySelector(`[data-testid="${name}"]`)
  if (!target) throw new Error(`missing testid ${name}: ${container.textContent}`)
  return target as HTMLElement
}

async function render(read: DerivedInventoryRead): Promise<void> {
  mocks.readDerivedInventory.mockResolvedValue(read)
  await act(async () => {
    root.render(<DerivedHealthPage />)
  })
  // 首帧在 `useEffect` 里发起读取，再让一轮微任务把 setState 落下去。
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  mocks.readDerivedInventory.mockReset()
  mocks.openArchFile.mockClear()
  mocks.openBuiltinEditor.mockClear()
  mocks.openChapterFile.mockClear()
  useLocaleStore.setState({ locale: 'zh-CN' })
  useLayoutStore.setState({ sidebarView: 'derived-health', activeRailItem: 'derived-health' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
})

describe('DerivedHealthPage —— 三种失败面', () => {
  it('版本表不存在 ⇒ 说「还没有版本记录」，不说「一切正常」', async () => {
    await render({ state: 'missing' })
    expect(testid('derived-health-missing')).toBeTruthy()
    expect(container.querySelector('[data-testid="derived-health-empty"]')).toBeNull()
  })

  it('确实没有要处置的 ⇒ 空态', async () => {
    await render({
      state: 'ok',
      inventory: inventory({ groups: [], unseen: { count: 0, kinds: [] } }),
    })
    expect(testid('derived-health-empty')).toBeTruthy()
  })
})

describe('DerivedHealthPage —— 清单', () => {
  it('分组带计数，unseen 默认收起且展开后列得出是哪几类', async () => {
    await render({ state: 'ok', inventory: inventory() })

    expect(testid('derived-group-blueprint').textContent).toContain('章节蓝图（2）')
    expect(testid('derived-group-finalized').textContent).toContain('已定稿章节（1）')

    const unseen = testid('derived-health-unseen') as HTMLDetailsElement
    expect(unseen.open).toBe(false)
    expect(unseen.textContent).toContain('另有 2 项无法判断')

    await act(async () => { unseen.open = true })
    expect(unseen.textContent).toContain('剧情树')
    expect(unseen.textContent).toContain('卷末交接单')
  })

  it('每行带证据：版本区间与触发时间都在，不是只写「旧了」', async () => {
    await render({ state: 'ok', inventory: inventory() })
    const row = testid('derived-item-blueprint-第 12 章')
    expect(row.textContent).toContain('情节大纲')
    expect(row.textContent).toContain('第4版')
  })
})

describe('DerivedHealthPage —— 去处置', () => {
  it('蓝图：切回 project 视图并带上章号', async () => {
    await render({ state: 'ok', inventory: inventory() })

    await act(async () => { testid('derived-open-blueprint-第 12 章').click() })

    // 不切视图的话 tab 区被 auxiliaryPage 的 `hidden` 挡住 —— 点了等于没点。
    expect(useLayoutStore.getState().sidebarView).toBe('project')
    expect(useLayoutStore.getState().activeRailItem).toBe('blueprint')
    expect(mocks.openBuiltinEditor).toHaveBeenCalledWith(
      'chapter-card-editor',
      '章节蓝图',
      'chapter-card',
      undefined,
      12,
    )
  })

  it('定稿章：用 draftId 拼正文路径，而不是按章号猜', async () => {
    await render({ state: 'ok', inventory: inventory() })

    await act(async () => { testid('derived-open-finalized-第 12 章').click() })

    expect(useLayoutStore.getState().sidebarView).toBe('project')
    expect(mocks.openChapterFile).toHaveBeenCalledWith('ai-novel://draft/77', '第 12 章')
  })
})
