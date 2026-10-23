import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InstitutionCadence, InstitutionCadenceInput } from '../../../shared/institution-cadence'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { CadenceRegistryPanel } from '../CadenceRegistryPanel'

/**
 * P1-1 制度登记面板（7 条）。验收口径（计划 §5.1 G3）：
 * 可增删改、保存前不落库、重名整批不提交，且「没登记」与「填了 0」在提交时不能混。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'cadence-project',
  leaseId: 'cadence-lease',
  projectPath: 'C:\\synthetic\\cadence-project',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: InstitutionCadence[]
let deleteOutcome: { success: boolean; error?: string }

function definition(overrides: Partial<InstitutionCadence> = {}): InstitutionCadence {
  return {
    cadenceId: 'cadence:monthly',
    name: '月例',
    axis: 'chapter',
    interval: 10,
    anchorChapter: 12,
    anchorStoryDay: null,
    fallbackIntervalChapters: null,
    note: '外门弟子',
    chapterNumber: 3,
    evidence: '又到了发月例的日子',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="cadence-row"]')]
}

function field(rowIndex: number, name: string): HTMLInputElement {
  const target = rows()[rowIndex]?.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on row ${rowIndex}`)
  return target
}

function axisSelect(rowIndex: number): HTMLSelectElement {
  const target = rows()[rowIndex]?.querySelector<HTMLSelectElement>('select[data-field="axis"]')
  if (!target) throw new Error(`Missing axis select on row ${rowIndex}`)
  return target
}

function button(label: string): HTMLButtonElement {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

async function fill(rowIndex: number, name: string, value: string) {
  await act(async () => {
    const input = field(rowIndex, name)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function chooseAxis(rowIndex: number, value: 'chapter' | 'story-day') {
  await act(async () => {
    const select = axisSelect(rowIndex)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, InstitutionCadenceInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:cadences-upsert') as Array<
    [string, InstitutionCadenceInput, string]
  >
}

async function renderPanel() {
  await act(async () => {
    root.render(<CadenceRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:cadences-list')).toBe(true))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  deleteOutcome = { success: true }
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '制度测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:cadences-list') return { success: true, cadences: stored }
    if (channel === 'db:cadences-upsert') {
      const input = args[0] as InstitutionCadenceInput
      return { success: true, cadenceId: input.cadenceId ?? `cadence:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:cadences-delete') return deleteOutcome
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

describe('制度登记面板', () => {
  it('挂载只读列表，不写库；空表给出引导', async () => {
    await renderPanel()
    expect(new Set(invoke.mock.calls.map(([channel]) => channel))).toEqual(new Set(['db:cadences-list']))
    expect(container.textContent).toContain('还没有登记任何周期事件')
  })

  it('已有行原样回显：null 锚渲染成空输入（不显示 0），轴回显 story-day', async () => {
    stored = [definition({ axis: 'story-day', anchorStoryDay: 9, anchorChapter: 12, fallbackIntervalChapters: null })]
    await renderPanel()
    expect(rows()).toHaveLength(1)
    expect(field(0, 'name').value).toBe('月例')
    expect(axisSelect(0).value).toBe('story-day')
    expect(field(0, 'anchorStoryDay').value).toBe('9')
    expect(field(0, 'fallbackIntervalChapters').value).toBe('')
    expect(field(0, 'evidence').value).toBe('又到了发月例的日子')
  })

  it('新增一行并保存：一次 upsert，空锚传 null 而不是 0', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'name', '欠款结清')
    await fill(0, 'interval', '10')
    await fill(0, 'anchorChapter', '12')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0][1]).toMatchObject({
      name: '欠款结清', axis: 'chapter', interval: 10, anchorChapter: 12,
      anchorStoryDay: null, fallbackIntervalChapters: null, chapterNumber: null,
    })
    expect(container.textContent).toContain('已保存 1 条制度')
  })

  it('切到按日轴：提交 story-day，日序 0 原样传 0（与「没填」不是一回事）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'name', '签到')
    await fill(0, 'interval', '7')
    await chooseAxis(0, 'story-day')
    await fill(0, 'anchorChapter', '12')
    await fill(0, 'anchorStoryDay', '0')
    await click(button('保存'))

    expect(upsertCalls()[0][1]).toMatchObject({ axis: 'story-day', interval: 7, anchorStoryDay: 0 })
  })

  it('本地重名整批不提交（不留一行偷偷落库）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await click(button('新增一条'))
    for (const index of [0, 1]) {
      await fill(index, 'name', '月例')
      await fill(index, 'interval', '10')
    }
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 1 行还需要修改，本次没有提交')
  })

  it('「每隔」不是正整数时本地就拦住', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'name', '月例')
    await fill(0, 'interval', '0')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('「每隔」只能填正整数')
  })

  it('删除是软标记，点保存才发一次 delete；后端拒绝时留在表里并给原因', async () => {
    stored = [definition()]
    deleteOutcome = { success: false, error: 'CADENCE_NOT_FOUND' }
    await renderPanel()
    await click(button('删除'))
    // 软标记阶段不发 IPC
    expect(invoke.mock.calls.some(([channel]) => channel === 'db:cadences-delete')).toBe(false)
    await click(button('保存'))

    expect(invoke.mock.calls.filter(([channel]) => channel === 'db:cadences-delete')).toHaveLength(1)
    expect(container.textContent).toContain('这条制度已经不在了')
    expect(rows()).toHaveLength(1)
  })
})
