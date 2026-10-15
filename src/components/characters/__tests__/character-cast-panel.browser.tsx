import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CharacterCastPanel } from '../CharacterCastPanel'
import type { CharacterCastDecisionView } from '../../../shared/character-proposal'
import { useCharacterStore } from '../../../stores/character-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useProjectStore } from '../../../stores/project-store'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = { projectId: '项目', projectPath: 'C:/锚点', leaseId: '会话' }

const registered: CharacterCastDecisionView = {
  decisionId: 'cast:op-1', name: '老陈', anchorRole: '早餐摊摊主', catchphrase: '来碗豆浆',
  relationToProtagonist: '旧识', action: 'register', sourceRevision: 3,
  operationId: 'cast-backfill:cpb:1:1:1', createdAt: '2026-10-15T00:00:00.000Z',
}

let root: Root | undefined
let host: HTMLDivElement | undefined
let invoke: ReturnType<typeof vi.fn>
let current: CharacterCastDecisionView[]

function mountApi(initial: CharacterCastDecisionView[]) {
  current = initial
  invoke = vi.fn(async (channel: string, payload?: { name: string; operationId: string; anchorRole?: string }) => {
    if (channel === 'character-cast:list') return current
    // 撤销：列表里移除（主进程语义是追加一条 revoke，当前态随之消失）。
    if (channel === 'character-cast:revoke') { current = current.filter(item => item.name !== payload!.name); return current }
    if (channel === 'character-cast:register') {
      current = current.map(item => item.name === payload!.name
        ? { ...item, anchorRole: payload!.anchorRole ?? item.anchorRole, operationId: payload!.operationId } : item)
      return current
    }
    if (channel === 'skills:list-user') return []
    if (channel === 'fs:check-exists') return false
    throw new Error(channel)
  })
  ;(window as unknown as { aiNovelAPI: { invoke: typeof invoke; on: () => () => void } }).aiNovelAPI = { invoke, on: () => () => {} }
}

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = undefined
  host = undefined
  useProjectStore.setState({ currentProject: null })
  useCharacterStore.setState({ characters: [], rosterRevision: 0 } as never)
})

async function mount(initial: CharacterCastDecisionView[]) {
  useLocaleStore.setState({ locale: 'zh-CN' })
  useProjectStore.setState({ currentProject: { id: session.projectId, path: session.projectPath, sessionLease: session.leaseId, novelConfig: {} } as never })
  mountApi(initial)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => { root?.render(<CharacterCastPanel />) })
  return host
}

describe('锚点人物（不建卡）管理面', () => {
  it('没有登记时整块不出现（空面板只是噪声）', async () => {
    const host = await mount([])
    expect(host.textContent).not.toContain('锚点人物')
  })

  it('列出已登记的定位、口吻、与主角关系及来源', async () => {
    const host = await mount([registered])
    // 默认折叠，先展开。
    await act(async () => { await page.getByRole('button', { name: /锚点人物（不建卡）（1）/ }).click() })
    expect(host.textContent).toContain('老陈')
    expect(host.textContent).toContain('早餐摊摊主')
    expect(host.textContent).toContain('来碗豆浆')
    expect(host.textContent).toContain('旧识')
    // 来源轴：回填的历史登记要能认出来。
    expect(host.textContent).toContain('历史登记（自动回填）')
  })

  it('撤销后该名字从管理面消失（主进程追加 revoke）', async () => {
    const host = await mount([registered])
    await act(async () => { await page.getByRole('button', { name: /锚点人物（不建卡）（1）/ }).click() })
    await act(async () => { await page.getByRole('button', { name: '撤销登记：老陈' }).click() })
    expect(invoke.mock.calls.some(([channel, payload]) => channel === 'character-cast:revoke'
      && (payload as { name: string }).name === '老陈')).toBe(true)
    expect(host.textContent).not.toContain('老陈')
  })

  it('可改口吻与定位（追加一条 register）', async () => {
    await mount([registered])
    await act(async () => { await page.getByRole('button', { name: /锚点人物（不建卡）（1）/ }).click() })
    await act(async () => { await page.getByRole('button', { name: '改口吻定位：老陈' }).click() })
    await act(async () => {
      await page.getByRole('textbox', { name: '定位：老陈' }).fill('守夜人')
      await page.getByRole('button', { name: '保存' }).click()
    })
    const edit = invoke.mock.calls.find(([channel]) => channel === 'character-cast:register')
    expect(edit).toBeTruthy()
    expect((edit![1] as { anchorRole: string }).anchorRole).toBe('守夜人')
  })
})
