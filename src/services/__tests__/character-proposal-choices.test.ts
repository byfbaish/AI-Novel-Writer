import { describe, expect, it } from 'vitest'
import { createCharacterProposalChoices, toApproveCharacterProposalRequest, type CharacterProposalChoices } from '../character-proposal-choices'
import type { CharacterProposalBatch } from '../../shared/character-proposal'

const batch: CharacterProposalBatch = {
  proposalBatchId: '批次', revision: 1, status: 'pending-approval',
  source: { kind: 'directory', operationId: 'blueprint-sync-op' },
  items: [
    { selectionKey: 'a', sourceId: '来源甲', fields: { name: '陈默', role: 'protagonist' }, rawValue: {},
      relationships: [{ targetName: '老陈', relation: '熟客与摊主' }], resolution: { status: 'unresolved', candidateIds: ['卡-陈默'] } },
    { selectionKey: 'b', sourceId: '来源乙', fields: { name: '老陈', role: 'minor' }, rawValue: {},
      relationships: [], resolution: { status: 'unresolved', candidateIds: [] } },
  ],
}

function choicesWith(partial: Partial<CharacterProposalChoices>): CharacterProposalChoices {
  return { ...createCharacterProposalChoices(batch), ...partial }
}

describe('批准请求的关系合成', () => {
  it('端点被改为不产生角色的决策时，滞留的关系行被丢弃而不是让整次保存爆炸', () => {
    // 实机：作者把老陈登记为功能配角后，先前采纳的「陈默 → 老陈」边仍留在选择里，
    // 主进程校验（两端必须产生角色）直接拒绝 —— 保存永远失败。
    const request = toApproveCharacterProposalRequest(choicesWith({
      selections: [
        { selectionKey: 'a', action: 'map', characterId: '卡-陈默' },
        { selectionKey: 'b', action: 'functional' },
      ],
      relationships: [
        { sourceSelectionKey: 'a', targetSelectionKey: 'b', relation: '熟客与摊主' },
        { sourceSelectionKey: 'a', targetSelectionKey: 'b', relation: '滞留边' },
      ],
    }), '操作')
    expect(request.relationships).toEqual([])
  })

  it('两端都会产生角色的关系照常传送', () => {
    const request = toApproveCharacterProposalRequest(choicesWith({
      selections: [
        { selectionKey: 'a', action: 'map', characterId: '卡-陈默' },
        { selectionKey: 'b', action: 'create' },
      ],
      relationships: [{ sourceSelectionKey: 'a', targetSelectionKey: 'b', relation: '熟客与摊主' }],
    }), '操作')
    expect(request.relationships).toEqual([{ sourceSelectionKey: 'a', targetSelectionKey: 'b', relation: '熟客与摊主' }])
  })
})
