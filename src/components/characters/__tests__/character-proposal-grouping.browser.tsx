import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CharacterProposalSelectionPanel } from '../CharacterProposalSelectionPanel'
import { createCharacterProposalChoices, toApproveCharacterProposalRequest, type CharacterProposalChoices } from '../../../services/character-proposal-choices'
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

async function mount(options: {
  identities?: Array<{ characterId: string; name: string; role?: string }>
  onChoices?: (choices: CharacterProposalChoices) => void
} = {}) {
  useLocaleStore.setState({ locale: 'zh-CN' })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const choices = createCharacterProposalChoices(batch)
  const identities = options.identities ?? [{ characterId: '卡-陈默', name: '陈默', role: 'protagonist' }]
  // 受控宿主：决策变化必须回灌，否则测不到"选项随决策收窄"。
  const Host = () => {
    const [current, setCurrent] = useState(choices)
    return <CharacterProposalSelectionPanel batch={batch} identities={identities}
      choices={current} onChange={next => { options.onChoices?.(next); setCurrent(next) }} />
  }
  await act(async () => { root?.render(<Host />) })
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

  it('目标唯一命中已有卡时可以直接采用到那张卡，并产出 targetCharacterId 的关系', async () => {
    let latest: CharacterProposalChoices | undefined
    const host = await mount({
      identities: [
        { characterId: '卡-陈默', name: '陈默', role: 'protagonist' },
        { characterId: '卡-李慧兰', name: '李慧兰', role: 'minor' },
      ],
      onChoices: next => { latest = next },
    })
    host.querySelectorAll('details')[1]!.open = true
    const edge = page.getByLabelText('关系处理：陈默 → 李慧兰')
    await expect.element(edge).toBeVisible()
    // 2026-10-21：此前这里被 `!targetSelectionKey` 整行禁用，只剩灰掉的「暂不采用」。
    expect((edge.element() as HTMLSelectElement).disabled).toBe(false)
    const optionValues = () => Array.from(edge.element().querySelectorAll('option')).map(option => option.value)
    expect(optionValues()).toContain('bind:卡-李慧兰')
    // 起点先采用到已有卡，否则关系无处可写（与主进程校验同规则）。
    await act(async () => {
      const source = host!.querySelector<HTMLSelectElement>('select[aria-label="采用方式：陈默 · a"]')!
      source.value = 'map:卡-陈默'
      source.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      const fresh = page.getByLabelText('关系处理：陈默 → 李慧兰').element() as HTMLSelectElement
      fresh.value = 'bind:卡-李慧兰'
      fresh.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(latest?.relationships).toContainEqual({ sourceSelectionKey: 'a', targetCharacterId: '卡-李慧兰', relation: '母子' })
    // 合同层：主进程按 source(候选)/target(已有卡) 的混搭形态收这条边。
    expect(toApproveCharacterProposalRequest(latest!, 'op').relationships).toContainEqual({
      sourceSelectionKey: 'a', targetCharacterId: '卡-李慧兰', relation: '母子',
    })
  })

  it('端点不产生角色时「采用这条关系」消失，并显式说明原因', async () => {
    const host = await mount()
    const edge = page.getByLabelText('关系处理：陈默 → 老陈')
    const options = () => Array.from(edge.element().querySelectorAll('option')).map(option => option.value)
    const setDecision = async (label: string, value: string) => act(async () => {
      const select = host.querySelector<HTMLSelectElement>(`select[aria-label="采用方式：${label}"]`)!
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // 实机反馈：作者记得这里曾有「采用」，现在没了却不知道为什么 —— 静默移除像 bug。
    // 默认下陈默（同名候选）是暂不采用 ⇒ 起点不产生角色，选项不在、原因写明。
    expect(options()).not.toContain('adopt')
    await expect.element(page.getByText(/关系两端都需「新建」或「采用到已有角色」才能写入/)).toBeVisible()
    // 两端都改为新建 ⇒ 关系可写，选项回来、说明消失。
    await setDecision('陈默 · a', 'create')
    expect(options()).toContain('adopt')
    expect(host.textContent).not.toContain('关系两端都需「新建」或「采用到已有角色」才能写入')
    // 终点改成功能配角 ⇒ 没有卡可挂关系，选项再次收窄并给出同一原因。
    await setDecision('老陈 · b', 'functional')
    expect(options()).not.toContain('adopt')
    await expect.element(page.getByText(/关系两端都需「新建」或「采用到已有角色」才能写入/)).toBeVisible()
  })
})
