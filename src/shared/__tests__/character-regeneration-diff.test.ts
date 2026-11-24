import { describe, expect, it } from 'vitest'

import type { CharacterProposalBatch, CharacterProposalSource } from '../character-proposal'
import type { CharacterRosterEntry } from '../character-roster'
import {
  REGENERATION_DIFF_GROUPS,
  applyRegenerationStrategy,
  buildRegenerationDiff,
  regenerationCandidateFromItem,
  splitRegenerationSentences,
  summarizeRegenerationCoverage,
  type RegenerationCandidate,
} from '../character-regeneration-diff'

/** 一张已有卡（现值）。 */
const oldEntry: CharacterRosterEntry = {
  characterId: '卡-陈默', name: '陈默', role: 'protagonist',
  gender: '男', age: '三十岁', appearance: '灰袍', personality: '克制',
  background: '清平里的旧摊主。后来进了城。', abilities: '做饭', motivation: '守住摊子',
  arc: '从摊主到掌柜', notes: '',
  relationships: [{ target: '老陈', relation: '旧同事' }],
  currentState: { location: '清平里', powerLevel: '', physicalState: '', mentalState: '',
    keyItems: '', recentEvents: '', updatedAtChapter: 3 },
}

const sameCandidate = (): RegenerationCandidate => ({
  fields: { name: '陈默', role: 'protagonist', gender: '男', age: '三十岁', appearance: '灰袍',
    personality: '克制', background: '清平里的旧摊主。后来进了城。', abilities: '做饭',
    motivation: '守住摊子', arc: '从摊主到掌柜', notes: '' },
  relationships: [{ targetName: '老陈', relation: '旧同事' }],
})

describe('J3 字段级并排对比（纯函数）', () => {
  it('5 组固定顺序，且每组都带组内字段', () => {
    const diff = buildRegenerationDiff(oldEntry, sameCandidate())
    expect(diff.rows.map(row => row.group)).toEqual([...REGENERATION_DIFF_GROUPS])
    const background = diff.rows.find(row => row.group === 'background')!
    expect(background.fields.map(field => field.field)).toEqual([
      'gender', 'age', 'appearance', 'personality', 'background', 'abilities', 'motivation', 'arc', 'notes',
    ])
    expect(diff.differentFieldCount).toBe(0)
  })

  it('仅空白差异不算差异（去空白后相等＝灰行，不计入差异数）', () => {
    const candidate = sameCandidate()
    candidate.fields = { ...candidate.fields, background: '清平里 的旧摊主。后来进了城。' }
    const diff = buildRegenerationDiff(oldEntry, candidate)
    const field = diff.rows.find(row => row.group === 'background')!.fields.find(item => item.field === 'background')!
    expect(field.status).toBe('same')
    expect(diff.differentFieldCount).toBe(0)
  })

  it('候选为空标「候选为空·保留现值」且不计入差异数', () => {
    const candidate = sameCandidate()
    candidate.fields = { ...candidate.fields, abilities: '   ' }
    const diff = buildRegenerationDiff(oldEntry, candidate)
    const field = diff.rows.find(row => row.group === 'background')!.fields.find(item => item.field === 'abilities')!
    expect(field.status).toBe('candidate-empty')
    expect(field.note).toBe('candidate-empty-keeps-current')
    expect(diff.differentFieldCount).toBe(0)
  })

  it('不等＝高亮并按句切分（中文 。！？；，英 . ! ? ;），不做逐字 diff', () => {
    expect(splitRegenerationSentences('甲。乙！丙？丁；戊')).toEqual(['甲。', '乙！', '丙？', '丁；', '戊'])
    expect(splitRegenerationSentences('One. Two! Three? Four; Five')).toEqual(['One.', 'Two!', 'Three?', 'Four;', 'Five'])
    const candidate = sameCandidate()
    candidate.fields = { ...candidate.fields, background: '清平里的旧摊主。后来进城做了掌柜。还添了一间铺子。' }
    const diff = buildRegenerationDiff(oldEntry, candidate)
    const field = diff.rows.find(row => row.group === 'background')!.fields.find(item => item.field === 'background')!
    expect(field.status).toBe('changed')
    expect(field.sentences?.rewritten).toEqual([{ from: '后来进了城。', to: '后来进城做了掌柜。' }])
    expect(field.sentences?.added).toEqual(['还添了一间铺子。'])
    expect(diff.differentFieldCount).toBe(1)
  })

  it('关系组按「对象名＋关系词」配对：对象相同而关系词变＝改写一条，不是新增＋消失两条', () => {
    const candidate = sameCandidate()
    candidate.relationships = [{ targetName: '老陈', relation: '同乡' }]
    const diff = buildRegenerationDiff(oldEntry, candidate)
    const rows = diff.rows.find(row => row.group === 'relationships')!.fields
    expect(rows).toHaveLength(1)
    expect(rows[0]!.relationship).toEqual({ kind: 'relation-changed', target: '老陈', oldRelation: '旧同事', newRelation: '同乡' })
    expect(diff.differentFieldCount).toBe(1)
  })

  it('当前状态只读展示：候选不提供时保留现值、不计差异', () => {
    const diff = buildRegenerationDiff(oldEntry, sameCandidate())
    const fields = diff.rows.find(row => row.group === 'currentState')!.fields
    const location = fields.find(item => item.field === 'location')!
    // 候选没有状态 ⇒ 「候选为空·保留现值」，但状态本身仍是只读项。
    expect(location.status).toBe('candidate-empty')
    expect(location.note).toBe('current-state-read-only')
    expect(fields.every(item => item.status !== 'changed')).toBe(true)
    // 候选真的提供了状态值：能显示会变成什么，仍不算差异（只读）。
    const withState = buildRegenerationDiff(oldEntry, { ...sameCandidate(), currentState: { location: '城东' } })
    const changedState = withState.rows.find(row => row.group === 'currentState')!.fields
      .find(item => item.field === 'location')!
    expect(changedState.status).toBe('changed')
    expect(withState.differentFieldCount).toBe(0)
  })

  it('覆盖张数 N 与有实质差异的 M 由批内同名候选统计得出', () => {
    const batch = { ...batchFixture(),
      items: batchFixture().items.filter(item => item.selectionKey === 'a') }
    expect(summarizeRegenerationCoverage(batch, [oldEntry])).toEqual({ sameNameCount: 1, differentCount: 1 })
    const identical = { ...batch, items: [{ ...batch.items[0]!,
      fields: { ...batch.items[0]!.fields, background: '清平里的旧摊主。后来进了城。' }, relationships: [] }] }
    expect(summarizeRegenerationCoverage(identical, [{ ...oldEntry, relationships: [] }]))
      .toEqual({ sameNameCount: 1, differentCount: 0 })
  })

  it('从提案项摊出的候选不带动态状态（候选永不提供状态）', () => {
    const item = batchFixture().items[0]!
    expect(regenerationCandidateFromItem(item).currentState).toBeUndefined()
  })
})

const rebuildSource = { kind: 'generation', inputKind: 'architecture',
  handle: { projectId: 'p', epoch: 'e', runId: 'run-1', stage: 'architecture', modelRevision: 'b'.repeat(64) } } as unknown as CharacterProposalSource

function batchFixture(): CharacterProposalBatch {
  return {
    proposalBatchId: '批次-1', revision: 3, status: 'pending-approval', source: rebuildSource,
    items: [
      // a：名字唯一命中已有卡 ⇒ 重建默认 = map 到那张卡。
      { selectionKey: 'a', sourceId: '来源甲', fields: { name: '陈默', role: 'protagonist' }, rawValue: {},
        relationships: [], resolution: { status: 'unresolved', candidateIds: ['卡-陈默'] } },
      // b：全新名字 ⇒ 默认 create（保留旧卡策略下也必须照建）。
      { selectionKey: 'b', sourceId: '来源乙', fields: { name: '沈青', role: 'supporting' }, rawValue: {},
        relationships: [], resolution: { status: 'unresolved', candidateIds: [] } },
      // c：同名多命中 ⇒ 默认 keep-unresolved。
      { selectionKey: 'c', sourceId: '来源丙', fields: { name: '老陈', role: 'minor' }, rawValue: {},
        relationships: [], resolution: { status: 'unresolved', candidateIds: ['卡-1', '卡-2'] } },
    ],
  }
}

describe('J4 三选一 → 默认选择（不新增决策类型）', () => {
  const batch = batchFixture()

  it('全部覆盖＝现状默认（同名唯一候选 map 到那张卡）', () => {
    const selections = applyRegenerationStrategy(batch, [], 'overwrite-all')
    expect(selections).toEqual([
      { selectionKey: 'a', action: 'map', characterId: '卡-陈默' },
      { selectionKey: 'b', action: 'create' },
      { selectionKey: 'c', action: 'keep-unresolved' },
    ])
  })

  it('保留旧卡（跳过同名）＝同名命中项一律 keep-unresolved，新名字仍按默认建卡', () => {
    const selections = applyRegenerationStrategy(batch, [], 'keep-existing')
    expect(selections).toEqual([
      { selectionKey: 'a', action: 'keep-unresolved' },
      { selectionKey: 'b', action: 'create' },
      { selectionKey: 'c', action: 'keep-unresolved' },
    ])
    // 不新增卡：没有任何一项被改成 create 之外的新建语义。
    expect(selections.filter(selection => selection.action === 'create').map(selection => selection.selectionKey)).toEqual(['b'])
  })

  it('逐张确认＝作者已有选择原样透传（面板四选一继续可用）', () => {
    const author = [{ selectionKey: 'a', action: 'create' as const },
      { selectionKey: 'b', action: 'keep-unresolved' as const },
      { selectionKey: 'c', action: 'functional' as const }]
    expect(applyRegenerationStrategy(batch, author, 'per-card')).toEqual(author)
  })
})
