import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CharacterProposalSelectionPanel } from '../CharacterProposalSelectionPanel'
import { createCharacterProposalChoices } from '../../../services/character-proposal-choices'
import type { CharacterProposalBatch } from '../../../shared/character-proposal'
import { useLocaleStore } from '../../../stores/locale-store'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
let host: HTMLDivElement | undefined

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = undefined
  host = undefined
})

const batch: CharacterProposalBatch = {
  proposalBatchId: '批次', revision: 1, status: 'pending-approval',
  source: { kind: 'directory', operationId: 'blueprint-sync-目录' },
  items: [
    // 已有名册同名：设计上永不自动合并，但应折叠收纳，不能把新面孔淹没（作者实测反馈）。
    { selectionKey: 'a', sourceId: '来源甲', fields: { name: '陈默', role: 'protagonist' }, rawValue: {},
      relationships: [{ targetName: '老陈', relation: '早餐熟客与摊主' }, { targetName: '李慧兰', relation: '母子' }], resolution: { status: 'unresolved', candidateIds: ['卡-陈默'] } },
    { selectionKey: 'b', sourceId: '来源乙', fields: { name: '老陈', role: 'minor' }, rawValue: {},
      relationships: [], resolution: { status: 'unresolved', candidateIds: [] } },
  ],
}

async function mount() {
  useLocaleStore.setState({ locale: 'zh-CN' })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const choices = createCharacterProposalChoices(batch)
  await act(async () => {
    root?.render(<CharacterProposalSelectionPanel batch={batch} identities={[{ characterId: '卡-陈默', name: '陈默', role: 'protagonist' }]}
      choices={choices} onChange={() => {}} />)
  })
  return host
}

describe('候选面板的分组与滚动', () => {
  it('新面孔平铺在上，与已有角色同名的候选收进折叠组，且整块可滚动', async () => {
    const host = await mount()
    // 老陈（新面孔）直接可见，且不套在任何 details 里。
    const laoChen = page.getByLabelText('采用方式：老陈 · b')
    await expect.element(laoChen).toBeVisible()
    expect(laoChen.element().closest('details')).toBeNull()
    // 陈默（同名）在折叠组里：存在于 DOM 但不可见。
    const chenMo = host.querySelector<HTMLSelectElement>('select[aria-label="采用方式：陈默 · a"]')
    expect(chenMo).not.toBeNull()
    expect(chenMo!.closest('details')).not.toBeNull()
    expect(chenMo!.closest('details')!.open).toBe(false)
    expect(host.textContent).toContain('与已有角色同名，待确认是否同一人（1）')
    // 提议的边「陈默 → 老陈」涉及新面孔，必须保持可见。
    expect(host.textContent).toContain('陈默 → 老陈')
    // 滚动容器：高度受限、可滚 —— 保存按钮与名册不再被候选清单挤走。
    const scroller = host.querySelector('div.overflow-y-auto')
    expect(scroller).not.toBeNull()
    expect(scroller!.className).toContain('max-h-80')
  })

  it('纯已有角色之间的关系提议同样折叠', async () => {
    const host = await mount()
    // 陈默 → 李慧兰：两端都是已有名册角色，收进第二个折叠组。
    const edge = page.getByLabelText('关系处理：陈默 → 李慧兰')
    await expect.element(edge).not.toBeVisible()
    expect(host.textContent).toContain('已有角色之间的关系提议（1）')
    host.querySelectorAll('details')[1]!.open = true
    await expect.element(edge).toBeVisible()
  })
})
