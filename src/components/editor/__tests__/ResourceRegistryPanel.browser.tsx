import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResourceDefinition, ResourceDefinitionInput } from '../../../shared/resource-ledger'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { ResourceRegistryPanel } from '../ResourceRegistryPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'resource-project',
  leaseId: 'resource-lease',
  projectPath: 'C:\\synthetic\\resource-project',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: ResourceDefinition[]
let deleteOutcome: { success: boolean; error?: string; movementCount?: number }

function definition(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    resourceId: 'res:stone',
    familyId: null,
    name: '灵石',
    tier: 1,
    unit: '块',
    anchorValue: null,
    period: '章',
    earnNote: '',
    costNote: '',
    scarcityNote: '',
    anchorNote: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="resource-row"]')]
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

function upsertCalls(): Array<[string, ResourceDefinitionInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:resources-upsert') as Array<
    [string, ResourceDefinitionInput, string]
  >
}

function deleteCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:resources-delete')
}

async function fillRow(rowIndex: number, name: string) {
  await fill(rowIndex, 'name', name)
  await fill(rowIndex, 'unit', '块')
  await fill(rowIndex, 'period', '章')
}

async function renderPanel() {
  await act(async () => {
    root.render(<ResourceRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:resources-list')).toBe(true))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  deleteOutcome = { success: true }
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '资源测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:resources-list') return { success: true, resources: stored }
    if (channel === 'db:resources-upsert') {
      const input = args[0] as ResourceDefinitionInput
      return { success: true, resourceId: input.resourceId ?? `res:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:resources-delete') return deleteOutcome
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

describe('资源登记面板', () => {
  it('空账本给出引导', async () => {
    await renderPanel()

    expect(rows()).toHaveLength(0)
    expect(container.textContent).toContain('先登记本书的资源')
    expect(container.textContent).toContain('灵石分品阶就填同一个资源族')
    expect(upsertCalls()).toHaveLength(0)
  })

  it('就地增行删行，未点保存前不落库', async () => {
    await renderPanel()

    await click(button('增行'))
    expect(rows()).toHaveLength(1)
    // 判据 DL 的可见化：这一列永远不参与算术。
    expect(container.textContent).toContain('设计意图')
    expect(container.textContent).toContain('仅展示，不参与任何计算')
    await fillRow(0, '灵石')
    // 编辑本身不发写请求。
    expect(upsertCalls()).toHaveLength(0)

    await click(button('增行'))
    expect(rows()).toHaveLength(2)
    // 未落库的新行删除后直接消失，不产生 delete 调用。
    await click(rows()[1].querySelector('button') as HTMLButtonElement)
    expect(rows()).toHaveLength(1)
    expect(deleteCalls()).toHaveLength(0)
    expect(field(0, 'name').value).toBe('灵石')
  })

  it('重名就地拒绝，整批不提交', async () => {
    await renderPanel()

    await click(button('增行'))
    await click(button('增行'))
    await fillRow(0, '灵石')
    await fillRow(1, '灵石')

    await click(button('保存'))

    expect(container.textContent).toContain('名称与上面的行重复：灵石')
    expect(container.textContent).toContain('本次没有提交')
    expect(upsertCalls()).toHaveLength(0)
  })

  it('换算锚填 0 会被拦下（0 是免费兑换，不是不可通兑）', async () => {
    await renderPanel()

    await click(button('增行'))
    await fillRow(0, '灵石')
    await fill(0, 'anchorValue', '0')

    await click(button('保存'))

    expect(container.textContent).toContain('换算锚只能留空或填正数')
    expect(upsertCalls()).toHaveLength(0)
  })

  it('保存时按行一次性提交：每行一次 upsert，没有逐格写入', async () => {
    await renderPanel()

    await click(button('增行'))
    await click(button('增行'))
    await fillRow(0, '下品灵石')
    await fillRow(1, '上品灵石')
    await fill(1, 'tier', '3')
    await fill(1, 'anchorValue', '100')
    await fill(1, 'scarcityNote', '上品灵石只在宗门内流通')
    await fill(1, 'familyId', '灵石')

    expect(upsertCalls()).toHaveLength(0)

    await click(button('保存'))
    await vi.waitFor(() => expect(container.textContent).toContain('已保存 2 条资源定义'))

    const calls = upsertCalls()
    expect(calls).toHaveLength(2)
    // 每行一次完整定义，而不是每个单元格一次。
    expect(Object.keys(calls[0][1]).sort()).toEqual([
      'anchorNote', 'anchorValue', 'costNote', 'earnNote', 'familyId',
      'name', 'period', 'scarcityNote', 'tier', 'unit',
    ])
    expect(calls[0][1]).toMatchObject({ name: '下品灵石', unit: '块', period: '章', anchorValue: null })
    expect(calls[1][1]).toMatchObject({
      name: '上品灵石',
      familyId: '灵石',
      tier: 3,
      anchorValue: 100,
      scarcityNote: '上品灵石只在宗门内流通',
    })
    // 只有「读清单 + 逐行 upsert」两种通道，没有别的写入口。
    expect(new Set(invoke.mock.calls.map(([channel]) => channel)))
      .toEqual(new Set(['db:resources-list', 'db:resources-upsert']))
  })

  it('删除已有账本记录的资源时就地说明原因，不静默失败也不提示重试', async () => {
    stored = [definition({ resourceId: 'res:stone', name: '灵石' })]
    deleteOutcome = { success: false, error: 'RESOURCE_HAS_MOVEMENTS', movementCount: 7 }
    await renderPanel()

    expect(rows()).toHaveLength(1)
    await click(button('删除'))
    await click(button('保存'))

    await vi.waitFor(() => expect(container.textContent).toContain('该资源已有 7 条账本记录'))
    expect(container.textContent).toContain('删定义会丢掉历史')
    expect(container.textContent).not.toContain('重试')
    // 行没有被抹掉，定义还在原处，作者能接着改。
    expect(rows()).toHaveLength(1)
    expect(field(0, 'name').value).toBe('灵石')
    expect(deleteCalls()).toHaveLength(1)
  })
})
