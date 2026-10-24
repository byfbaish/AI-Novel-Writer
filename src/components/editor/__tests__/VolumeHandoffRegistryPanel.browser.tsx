import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import {
  VOLUME_HANDOFF_MAX_CHARS,
  type VolumeHandoffDefinition,
  type VolumeHandoffInput,
} from '../../../shared/volume-handoff'
import { useProjectStore } from '../../../stores/project-store'
import { VolumeHandoffRegistryPanel } from '../VolumeHandoffRegistryPanel'

/**
 * P1-2 期 1 卷末交接登记面板（8 条）。验收口径：
 * - 卷号与两个章号**全部手填**，页面不给任何区间推算（作者 2026-10-24 已裁定砍掉）；
 * - 区间重叠 / 卷号重复 / 章号非法 **整批不提交**（一行错不让别的行偷偷落库）；
 * - 三个数组字段用多行文本域，空行丢弃；
 * - 字数超限只红字提示，**照常可保存**（注入侧按顺序丢弃）。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'handoff-project',
  leaseId: 'handoff-lease',
  projectPath: 'C:\\synthetic\\handoff-project',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: VolumeHandoffDefinition[]

function definition(overrides: Partial<VolumeHandoffDefinition> = {}): VolumeHandoffDefinition {
  return {
    handoffId: 'handoff:1',
    volumeIndex: 1,
    firstChapter: 1,
    lastChapter: 20,
    worldState: '灵潮退去，北境三城封关',
    heroState: '顾长风的左臂仍未复原',
    events: ['玄火令被夺', '沈砚投靠监天台'],
    items: ['玄火令在监天台手中'],
    debts: ['欠沈砚一条命'],
    openThread: '监天台为何要玄火令',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function summaryRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="volume-handoff-row"]')]
}

function details(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="volume-handoff-detail"]')]
}

function field(detailIndex: number, name: string): HTMLInputElement | HTMLTextAreaElement {
  const target = details()[detailIndex]?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on detail ${detailIndex}`)
  return target
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const target = [...scope.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

async function fill(detailIndex: number, name: string, value: string) {
  await act(async () => {
    const input = field(detailIndex, name)
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, VolumeHandoffInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:volume-handoffs-upsert') as Array<
    [string, VolumeHandoffInput, string]
  >
}

async function renderPanel() {
  await act(async () => {
    root.render(<VolumeHandoffRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:volume-handoffs-list')).toBe(true))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '交接测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:volume-handoffs-list') return { success: true, entries: stored }
    if (channel === 'db:volume-handoffs-upsert') {
      const input = args[0] as VolumeHandoffInput
      return {
        success: true,
        entry: definition({
          handoffId: input.handoffId ?? `handoff:new-${invoke.mock.calls.length}`,
          volumeIndex: input.volumeIndex,
          firstChapter: input.firstChapter,
          lastChapter: input.lastChapter,
          worldState: input.worldState ?? '',
          heroState: input.heroState ?? '',
          events: [...(input.events ?? [])],
          items: [...(input.items ?? [])],
          debts: [...(input.debts ?? [])],
          openThread: input.openThread ?? '',
        }),
      }
    }
    if (channel === 'db:volume-handoffs-delete') return { success: true }
    throw new Error(`Unexpected IPC ${channel}`)
  })
  Object.defineProperty(window, 'aiNovelAPI', {
    configurable: true,
    value: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() },
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  setActiveProjectSessionContext(null)
  delete (window as typeof window & { aiNovelAPI?: unknown }).aiNovelAPI
})

describe('卷末交接登记面板', () => {
  it('空表给出引导，挂载只读一个通道', async () => {
    await renderPanel()
    expect(new Set(invoke.mock.calls.map(([channel]) => channel))).toEqual(new Set(['db:volume-handoffs-list']))
    expect(container.textContent).toContain('还没有登记任何卷末交接单')
    expect(summaryRows()).toHaveLength(0)
  })

  it('列表渲染：卷号 / 区间 / 世界 / 主角 / 三个计数', async () => {
    stored = [definition()]
    await renderPanel()
    expect(summaryRows()).toHaveLength(1)
    const row = summaryRows()[0]!
    expect(row.querySelector('[data-field="volumeIndex-cell"]')?.textContent).toBe('1')
    expect(row.querySelector('[data-field="range-cell"]')?.textContent).toBe('第1–20章')
    expect(row.querySelector('[data-field="worldState-cell"]')?.textContent).toBe('灵潮退去，北境三城封关')
    expect(row.querySelector('[data-field="events-cell"]')?.textContent).toBe('2')
    expect(row.querySelector('[data-field="items-cell"]')?.textContent).toBe('1')
    expect(row.querySelector('[data-field="debts-cell"]')?.textContent).toBe('1')
    // 默认收起：详情表单不占位。
    expect(details()).toHaveLength(0)
    await click(button('编辑', row))
    expect(details()).toHaveLength(1)
    expect(field(0, 'volumeIndex')).toHaveProperty('value', '1')
    expect(field(0, 'events')).toHaveProperty('value', '玄火令被夺\n沈砚投靠监天台')
    // 章号手填，页面不给任何推算按钮。
    expect(container.textContent).toContain('章号请对照大纲里该卷的最后几章填写')
  })

  it('新增一行并保存：三个数组字段按行拆分、空行丢弃', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    expect(details()).toHaveLength(1)
    await fill(0, 'volumeIndex', '2')
    await fill(0, 'firstChapter', '21')
    await fill(0, 'lastChapter', '40')
    await fill(0, 'worldState', '北境封关')
    await fill(0, 'events', '玄火令被夺\n\n  沈砚投靠监天台  \n')
    await fill(0, 'items', '玄火令')
    await fill(0, 'debts', '\n')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0]![1]).toMatchObject({
      volumeIndex: 2,
      firstChapter: 21,
      lastChapter: 40,
      worldState: '北境封关',
      heroState: '',
      events: ['玄火令被夺', '沈砚投靠监天台'],
      items: ['玄火令'],
      debts: [],
      openThread: '',
    })
    expect(upsertCalls()[0]![2]).toBe(session.projectPath)
  })

  it('区间重叠：整批不提交，两行都标红', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeIndex', '1')
    await fill(0, 'firstChapter', '1')
    await fill(0, 'lastChapter', '20')
    await click(button('新增一卷'))
    await fill(1, 'volumeIndex', '2')
    await fill(1, 'firstChapter', '19')
    await fill(1, 'lastChapter', '30')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 2 行还需要修改，本次没有提交')
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(2)
    expect(container.textContent).toContain('章号区间与另一卷重叠了')
  })

  it('卷号重复：整批不提交', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeIndex', '1')
    await fill(0, 'firstChapter', '1')
    await fill(0, 'lastChapter', '20')
    await click(button('新增一卷'))
    await fill(1, 'volumeIndex', '1')
    await fill(1, 'firstChapter', '21')
    await fill(1, 'lastChapter', '40')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('第1卷登记了不止一份')
  })

  it('章号非法（末章小于首章 / 0）本地拒', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeIndex', '1')
    await fill(0, 'firstChapter', '21')
    await fill(0, 'lastChapter', '20')
    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('结束章号不能小于起始章号')

    await fill(0, 'lastChapter', '40')
    await fill(0, 'firstChapter', '0')
    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('起始章号必须是正整数')
  })

  it('相邻区间（20 与 21）允许保存', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeIndex', '1')
    await fill(0, 'firstChapter', '1')
    await fill(0, 'lastChapter', '20')
    await click(button('新增一卷'))
    await fill(1, 'volumeIndex', '2')
    await fill(1, 'firstChapter', '21')
    await fill(1, 'lastChapter', '40')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(2)
  })

  it('字数提示：超 1500 红字但**不阻断**保存', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeIndex', '1')
    await fill(0, 'firstChapter', '1')
    await fill(0, 'lastChapter', '20')
    await fill(0, 'worldState', '墨'.repeat(VOLUME_HANDOFF_MAX_CHARS + 50))
    const hint = container.querySelector('[data-testid="volume-handoff-chars"]')
    expect(hint?.textContent).toContain(`/ ${VOLUME_HANDOFF_MAX_CHARS} 字`)
    expect(hint?.textContent).toContain('超出部分注入时会按顺序丢弃，仍可保存')

    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0]![1].worldState).toHaveLength(VOLUME_HANDOFF_MAX_CHARS + 50)
  })
})
