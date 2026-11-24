import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CharacterRegenerationDiffPanel } from '../CharacterRegenerationDiffPanel'
import { CharacterProposalSelectionPanel } from '../CharacterProposalSelectionPanel'
import { createCharacterProposalChoices, type CharacterProposalChoices } from '../../../services/character-proposal-choices'
import type { CharacterProposalBatch, CharacterProposalSource } from '../../../shared/character-proposal'
import type { CharacterRosterEntry } from '../../../shared/character-roster'
import { useCharacterStore, type CharacterCard } from '../../../stores/character-store'
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

const rebuildSource = { kind: 'generation', inputKind: 'architecture',
  handle: { projectId: 'p', epoch: 'e', runId: 'run-1', stage: 'architecture', modelRevision: 'b'.repeat(64) } } as unknown as CharacterProposalSource
const incrementalSource = { kind: 'directory', operationId: 'blueprint-sync-目录' } as unknown as CharacterProposalSource

const oldEntry: CharacterRosterEntry = {
  characterId: '卡-陈默', name: '陈默', role: 'protagonist', gender: '男', age: '三十岁',
  appearance: '灰袍', personality: '克制', background: '清平里的旧摊主。后来进了城。',
  abilities: '做饭', motivation: '守住摊子', arc: '从摊主到掌柜', notes: '',
  relationships: [],
}

function rebuildBatch(background = '清平里的旧摊主。后来进城做了掌柜。'): CharacterProposalBatch {
  return {
    proposalBatchId: '批次-重建', revision: 1, status: 'pending-approval', source: rebuildSource,
    items: [
      { selectionKey: 'a', sourceId: '来源甲',
        fields: { name: '陈默', role: 'protagonist', background, abilities: '' }, rawValue: {}, relationships: [],
        resolution: { status: 'unresolved', candidateIds: ['卡-陈默'] } },
      { selectionKey: 'b', sourceId: '来源乙', fields: { name: '沈青', role: 'supporting' }, rawValue: {},
        relationships: [], resolution: { status: 'unresolved', candidateIds: [] } },
    ],
  }
}

async function mount(ui: ReactNode) {
  useLocaleStore.setState({ locale: 'zh-CN' })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => { root?.render(<>{ui}</>) })
  return host
}

describe('J4 三选一（组件面）', () => {
  it('三个策略按钮都在；点「保留旧卡」把同名项改成 keep-unresolved，新名字仍新建', async () => {
    let latest: CharacterProposalChoices | undefined
    const batch = rebuildBatch()
    const choices = createCharacterProposalChoices(batch)
    const Host = () => {
      const [current, setCurrent] = useState(choices)
      return <CharacterRegenerationDiffPanel batch={batch} entries={[oldEntry]} choices={current}
        onChange={next => { latest = next; setCurrent(next) }} />
    }
    await mount(<Host />)
    await expect.element(page.getByLabelText('重建策略：全部覆盖')).toBeVisible()
    await expect.element(page.getByLabelText('重建策略：逐张确认')).toBeVisible()
    await act(async () => { (page.getByLabelText('重建策略：保留旧卡（跳过同名）').element() as HTMLButtonElement).click() })
    expect(latest?.selections).toEqual([
      { selectionKey: 'a', action: 'keep-unresolved' },
      { selectionKey: 'b', action: 'create' },
    ])
    // 「逐张确认」＝把面板当前的选择原样透传（不重算默认）。
    await act(async () => { (page.getByLabelText('重建策略：逐张确认').element() as HTMLButtonElement).click() })
    expect(latest?.selections).toEqual([
      { selectionKey: 'a', action: 'keep-unresolved' },
      { selectionKey: 'b', action: 'create' },
    ])
  })

  it('顶部 N／M 计数 + 差异行高亮 + 候选为空·保留现值', async () => {
    const batch = rebuildBatch()
    const choices = createCharacterProposalChoices(batch)
    const host = await mount(<CharacterRegenerationDiffPanel batch={batch} entries={[oldEntry]} choices={choices} onChange={() => {}} />)
    expect(host.textContent).toContain('本次重建会覆盖 1 张同名卡')
    expect(host.textContent).toContain('其中 1 张有实质差异')
    expect(host.querySelectorAll('[data-diff="changed"]').length).toBe(1)
    expect(host.querySelector('[data-field="background"]')?.getAttribute('data-diff')).toBe('changed')
    expect(host.textContent).toContain('候选为空·保留现值')
  })

  it('M=0 时「全部覆盖」降级为「无差异，仍要覆盖？」', async () => {
    const batch = rebuildBatch('清平里的旧摊主。后来进了城。')
    const choices = createCharacterProposalChoices(batch)
    const host = await mount(<CharacterRegenerationDiffPanel batch={batch} entries={[oldEntry]} choices={choices} onChange={() => {}} />)
    expect(host.textContent).toContain('其中 0 张有实质差异')
    expect(host.textContent).toContain('无差异，仍要覆盖？')
  })

  it('J8：无快照时不出「回退这一字段」；有快照且有处理器时才出', async () => {
    const batch = rebuildBatch()
    const choices = createCharacterProposalChoices(batch)
    const host = await mount(<CharacterRegenerationDiffPanel batch={batch} entries={[oldEntry]} choices={choices} onChange={() => {}} />)
    expect(host.textContent).not.toContain('回退这一字段')
    await act(async () => root?.unmount())
    host.remove()
    const rollback: string[] = []
    const host2 = await mount(<CharacterRegenerationDiffPanel batch={batch} entries={[oldEntry]} choices={choices}
      onChange={() => {}} snapshotAvailable onRollbackField={(_id, field) => rollback.push(field)} />)
    const button = page.getByLabelText('回退这一字段：背景')
    await expect.element(button).toBeVisible()
    await act(async () => { (button.element() as HTMLButtonElement).click() })
    expect(rollback).toEqual(['background'])
    expect(host2.textContent).toContain('回退这一字段')
  })
})

describe('候选面板只在重建时挂对比屏', () => {
  const card = (overrides: Partial<CharacterCard> & { characterId: string; name: string }): CharacterCard => ({
    role: 'supporting', gender: '', age: '', appearance: '', personality: '', background: '',
    abilities: '', motivation: '', relationships: '', arc: '', notes: '', ...overrides,
  })

  it('重建批次：对比屏出现；增量批次：不出现', async () => {
    useCharacterStore.setState({ characters: [card({ characterId: '卡-陈默', name: '陈默', role: 'protagonist',
      background: '清平里的旧摊主。后来进了城。' })] })
    const batch = rebuildBatch()
    const choices = createCharacterProposalChoices(batch)
    const host = await mount(<CharacterProposalSelectionPanel batch={batch}
      identities={[{ characterId: '卡-陈默', name: '陈默', role: 'protagonist' }]} choices={choices} onChange={() => {}} />)
    expect(host.textContent).toContain('本次重建会覆盖 1 张同名卡')
    await act(async () => root?.unmount())
    host.remove()
    const incremental: CharacterProposalBatch = { ...batch, source: incrementalSource }
    const host2 = await mount(<CharacterProposalSelectionPanel batch={incremental}
      identities={[{ characterId: '卡-陈默', name: '陈默', role: 'protagonist' }]}
      choices={createCharacterProposalChoices(incremental)} onChange={() => {}} />)
    expect(host2.textContent).not.toContain('本次重建会覆盖')
  })
})
