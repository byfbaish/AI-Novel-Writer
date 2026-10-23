import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { KeyItemDefinition, KeyItemInput } from '../../../shared/key-item'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { KeyItemRegistryPanel } from '../KeyItemRegistryPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'key-item-project',
  leaseId: 'key-item-lease',
  projectPath: 'C:\\synthetic\\key-item-project',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: KeyItemDefinition[]
let deleteOutcome: { success: boolean; error?: string }

function definition(overrides: Partial<KeyItemDefinition> = {}): KeyItemDefinition {
  return {
    itemId: 'item:knife',
    name: '裁纸刀',
    holderCharacter: '林岚',
    holderLabel: '林岚',
    statusNote: '刃口崩了一角',
    chapterNumber: 3,
    evidence: '刀口崩了一角',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="key-item-row"]')]
}

function field(rowIndex: number, name: string): HTMLInputElement {
  const target = rows()[rowIndex]?.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on row ${rowIndex}`)
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

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, KeyItemInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:key-items-upsert') as Array<
    [string, KeyItemInput, string]
  >
}

async function renderPanel() {
  await act(async () => {
    root.render(<KeyItemRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:key-items-list')).toBe(true))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  deleteOutcome = { success: true }
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '关键物品测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:key-items-list') return { success: true, items: stored }
    if (channel === 'db:key-items-upsert') {
      const input = args[0] as KeyItemInput
      return { success: true, itemId: input.itemId ?? `item:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:key-items-delete') return deleteOutcome
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

describe('关键物品登记面板', () => {
  it('挂载只读列表，不写库；空表给出引导', async () => {
    await renderPanel()
    expect(new Set(invoke.mock.calls.map(([channel]) => channel))).toEqual(new Set(['db:key-items-list']))
    expect(container.textContent).toContain('还没有登记任何物品')
  })

  it('已有行原样回显，且把 null 章号渲染成空输入（不显示 0）', async () => {
    stored = [definition({ chapterNumber: null, evidence: '' })]
    await renderPanel()
    expect(rows()).toHaveLength(1)
    expect(field(0, 'name').value).toBe('裁纸刀')
    expect(field(0, 'chapterNumber').value).toBe('')
    expect(field(0, 'evidence').value).toBe('')
  })

  it('新增一行并保存：一次 upsert，章号为空时传 null 而不是 0', async () => {
    await renderPanel()
    await click(button('新增一件'))
    await fill(0, 'name', '欠条')
    await fill(0, 'holderLabel', '赵无妄')
    await fill(0, 'statusNote', '还没签')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0][1]).toMatchObject({
      name: '欠条', holderLabel: '赵无妄', statusNote: '还没签', chapterNumber: null, evidence: '',
    })
    expect(container.textContent).toContain('已保存 1 件物品')
  })

  it('填了出处章就按数字提交', async () => {
    await renderPanel()
    await click(button('新增一件'))
    await fill(0, 'name', '裁员名单备份')
    await fill(0, 'holderLabel', '王浩')
    await fill(0, 'chapterNumber', '4')
    await fill(0, 'evidence', '红笔表格')
    await click(button('保存'))

    expect(upsertCalls()[0][1]).toMatchObject({ chapterNumber: 4, evidence: '红笔表格' })
  })

  it('本地重名整批不提交（不留一行偷偷落库）', async () => {
    await renderPanel()
    await click(button('新增一件'))
    await click(button('新增一件'))
    for (const index of [0, 1]) {
      await fill(index, 'name', '麻绳')
      await fill(index, 'holderLabel', '顾长风')
    }
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 1 行还需要修改，本次没有提交')
  })

  it('章号不是正整数时本地就拦住', async () => {
    await renderPanel()
    await click(button('新增一件'))
    await fill(0, 'name', '麻绳')
    await fill(0, 'holderLabel', '顾长风')
    await fill(0, 'chapterNumber', '0')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('出处章只能填正整数')
  })

  it('删除是软标记，点保存才发一次 delete；后端拒绝时留在表里并给原因', async () => {
    stored = [definition()]
    deleteOutcome = { success: false, error: 'KEY_ITEM_NOT_FOUND' }
    await renderPanel()
    await click(button('删除'))
    // 软标记阶段不发 IPC
    expect(invoke.mock.calls.some(([channel]) => channel === 'db:key-items-delete')).toBe(false)
    await click(button('保存'))

    expect(invoke.mock.calls.filter(([channel]) => channel === 'db:key-items-delete')).toHaveLength(1)
    expect(container.textContent).toContain('这条物品已经不在了')
    expect(rows()).toHaveLength(1)
  })
})
