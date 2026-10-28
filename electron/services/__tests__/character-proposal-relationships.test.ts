import { describe, expect, it } from 'vitest'

import type { CharacterProposalItem } from '../../../src/shared/character-proposal'
import { resolveProposalRelationships, type ProposalRelationshipInput } from '../character-proposal-service'

/**
 * `resolveProposalRelationships` 的合同测试。
 *
 * 2026-10-28 实机：作者点「确认采用角色提议」报
 * `character-proposal:approve — CHARACTER_RELATIONSHIP_PROPOSAL_INVALID`，界面拿不到任何
 * 可行动的线索。回读判定条件发现两处**必然失败**的分支：
 *
 * 1. 目标绑定到已有角色卡时，判据 `item.targetSelectionKey === relation.targetSelectionKey`
 *    恒为假（批内根本没有那张卡的选择键）⇒ 面板上的「绑定到已有角色卡」只要点就一定炸；
 * 2. 两端都没填完的行（加了边没选目标）静默通过 UI 过滤，落到主进程必炸。
 *
 * 本文件把这两条钉死，并顺带锁住「暂不采用/功能配角不产生角色、不能当端点」的既有规则。
 */

const item = (
  selectionKey: string,
  name: string,
  relationships: Array<{ targetSelectionKey?: string; targetName?: string; relation: string }> = [],
): CharacterProposalItem => ({
  selectionKey,
  sourceId: `来源-${name}`,
  fields: { name },
  rawValue: {},
  relationships,
  resolution: { status: 'unresolved', candidateIds: [] },
})

const items = new Map([
  item('candidate_a', '甲', [
    { targetSelectionKey: 'candidate_b', relation: '同门' },
    { targetSelectionKey: 'candidate_c', relation: '债主' },
  ]),
  item('candidate_b', '乙'),
  item('candidate_c', '丙'),
].map(entry => [entry.selectionKey, entry]))

const decisions = (
  entries: Array<[string, 'create' | 'map' | 'keep-unresolved' | 'functional', string?]>,
) => new Map(entries.map(([key, action, characterId]) => [key, { action, ...(characterId ? { characterId } : {}) }]))

const resolve = (relationships: ProposalRelationshipInput[], decisionMap = decisions([
  ['candidate_a', 'create'], ['candidate_b', 'create'], ['candidate_c', 'create'],
]), existing: string[] = ['existing_card']) => resolveProposalRelationships({
  relationships,
  decisions: decisionMap,
  items,
  existingCharacterIds: new Set(existing),
})

describe('角色提议的关系边判定', () => {
  it('候选 → 候选（两端新建）', () => {
    expect(resolve([{ sourceSelectionKey: 'candidate_a', targetSelectionKey: 'candidate_b', relation: '同门' }]))
      .toEqual([{ sourceSelectionKey: 'candidate_a', targetSelectionKey: 'candidate_b', relation: '同门' }])
  })

  it('两端都映射到已有角色时写成 id，而不是选择键', () => {
    const mapped = decisions([
      ['candidate_a', 'map', 'existing_card'],
      ['candidate_b', 'map', 'other_card'],
    ])
    expect(resolve([{ sourceSelectionKey: 'candidate_a', targetSelectionKey: 'candidate_b', relation: '同门' }], mapped))
      .toEqual([{ sourceCharacterId: 'existing_card', targetCharacterId: 'other_card', relation: '同门' }])
  })

  it('目标绑定到已有角色卡：来源声明过同文本的边就放行（2026-10-28 回归点）', () => {
    expect(resolve([{ sourceSelectionKey: 'candidate_a', targetCharacterId: 'existing_card', relation: '债主' }]))
      .toEqual([{ sourceSelectionKey: 'candidate_a', targetCharacterId: 'existing_card', relation: '债主' }])
  })

  it('目标绑定到已有卡、但来源从未声明过这条关系：拒绝，并指明是第几条', () => {
    expect(() => resolve([
      { sourceSelectionKey: 'candidate_a', targetSelectionKey: 'candidate_b', relation: '同门' },
      { sourceSelectionKey: 'candidate_a', targetCharacterId: 'existing_card', relation: '凭空捏造的仇' },
    ])).toThrow(/CHARACTER_RELATIONSHIP_PROPOSAL_INVALID.*第 2 条.*凭空捏造/u)
  })

  it('目标候选没被采用（暂不采用/功能配角）：拒绝', () => {
    const kept = decisions([['candidate_a', 'create'], ['candidate_b', 'keep-unresolved']])
    expect(() => resolve(
      [{ sourceSelectionKey: 'candidate_a', targetSelectionKey: 'candidate_b', relation: '同门' }],
      kept,
    )).toThrow(/目标候选没有被创建或采用/u)
  })

  it('半截行（没有目标）：拒绝，理由写明是没填完', () => {
    expect(() => resolve([{ sourceSelectionKey: 'candidate_a', relation: '同门' }]))
      .toThrow(/两端都没选/u)
  })

  it('来源是已有卡、目标是候选：放行', () => {
    expect(resolve([{ sourceCharacterId: 'existing_card', targetSelectionKey: 'candidate_b', relation: '上下级' }]))
      .toEqual([{ sourceCharacterId: 'existing_card', targetSelectionKey: 'candidate_b', relation: '上下级' }])
  })

  it('来源既有卡已退休 / 不存在：拒绝', () => {
    expect(() => resolve(
      [{ sourceCharacterId: 'ghost', targetSelectionKey: 'candidate_b', relation: '上下级' }],
    )).toThrow(/来源角色不存在或已退休/u)
  })

  it('来源同时给了选择键与 id：拒绝（二选一）', () => {
    expect(() => resolve([
      { sourceSelectionKey: 'candidate_a', sourceCharacterId: 'existing_card', targetSelectionKey: 'candidate_b', relation: '同门' },
    ])).toThrow(/来源必须二选一/u)
  })
})
