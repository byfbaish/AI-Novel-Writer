import type { ApproveCharacterProposalRequest, CharacterProposalBatch } from '../shared/character-proposal'
import { isAdoptedCharacterDecision } from '../shared/character-proposal'
import { defaultCharacterProposalRelationships, defaultCharacterProposalSelections } from './workflows/character-proposal-preview'
import { applyRegenerationStrategy, type RegenerationStrategy } from '../shared/character-regeneration-diff'

/**
 * A relationship row as the panel holds it while the author decides. `sourceCharacterId` marks
 * an author-created outgoing edge from an existing card; such rows carry no proposal target and
 * are therefore never auto-derived from the batch.
 */
export interface CharacterProposalRelationshipChoice {
  sourceSelectionKey?: string
  sourceCharacterId?: string
  targetSelectionKey?: string
  targetCharacterId?: string
  relation: string
}

export interface CharacterProposalChoices {
  proposalBatchId: string
  revision: number
  selections: ApproveCharacterProposalRequest['selections']
  relationships: CharacterProposalRelationshipChoice[]
  /**
   * Targets the author marked as "the blueprint will build this person later".
   *
   * These are author intent, not relationships — no edge exists until a card does, so they never
   * enter the approve request. They are carried separately so the marker survives to feed P1's
   * candidate set rather than being silently lost.
   */
  blueprintPendingRelations?: { sourceSelectionKey: string; targetName: string }[]
  edits?: NonNullable<ApproveCharacterProposalRequest['edits']>
}

export function createCharacterProposalChoices(
  batch: CharacterProposalBatch,
  strategy: RegenerationStrategy = 'overwrite-all',
): CharacterProposalChoices {
  // 三选一只翻「默认选择」这一项（C1-b）；不传时策略等于现状默认，其余字段逐项不变。
  return { proposalBatchId: batch.proposalBatchId, revision: batch.revision,
    selections: applyRegenerationStrategy(batch, defaultCharacterProposalSelections(batch), strategy),
    relationships: defaultCharacterProposalRelationships(batch) }
}

/**
 * Synthesizes the request payload. Rows whose `sourceCharacterId` equals a candidate's adopted
 * id are collapsed back onto that candidate's selection key, because an identity being created by
 * this very batch has no id until the commit runs.
 */
export function toApproveCharacterProposalRequest(choices: CharacterProposalChoices, operationId: string): ApproveCharacterProposalRequest {
  const keyByCharacterId = new Map(choices.selections.flatMap(selection =>
    selection.action === 'map' ? [[selection.characterId, selection.selectionKey] as const] : []))
  // 关系只能在"会产生角色"的端点之间成立（主进程同规则校验）。端点被改成
  // 暂不采用/功能配角时丢弃该行 —— 与面板在改决策时自动清边的语义一致；
  // 不兜底的话，任何滞留的边都会让整次保存炸 CHARACTER_RELATIONSHIP_PROPOSAL_INVALID。
  const adoptedKeys = new Set(choices.selections
    .filter(selection => isAdoptedCharacterDecision(selection.action)).map(selection => selection.selectionKey))
  const relationships = choices.relationships.flatMap(relationship => {
    if (relationship.sourceSelectionKey !== undefined && !adoptedKeys.has(relationship.sourceSelectionKey)) return []
    if (relationship.targetSelectionKey !== undefined && !adoptedKeys.has(relationship.targetSelectionKey)) return []
    // 端点没填完的行不是边：主进程要求两端各二选一，半截行只会让整次保存失败
    // （2026-10-28 实机：作者加了边却没选目标 ⇒ 保存报 CHARACTER_RELATIONSHIP_PROPOSAL_INVALID）。
    if (relationship.targetSelectionKey === undefined && relationship.targetCharacterId === undefined) return []
    if (relationship.sourceSelectionKey === undefined && relationship.sourceCharacterId === undefined) return []
    // 本批新建/映射的候选此刻还没有 id：把它折回候选键。一行上同时留着键与 id 时以键为准 ——
    // 这种行是提议派生的，id 只是面板显示留下来的残值。
    const foldedSource = relationship.sourceCharacterId && keyByCharacterId.has(relationship.sourceCharacterId)
      ? keyByCharacterId.get(relationship.sourceCharacterId) : undefined
    const sourceSelectionKey = relationship.sourceSelectionKey ?? foldedSource
    return [{
      ...(sourceSelectionKey !== undefined ? { sourceSelectionKey } : { sourceCharacterId: relationship.sourceCharacterId! }),
      ...(relationship.targetSelectionKey !== undefined
        ? { targetSelectionKey: relationship.targetSelectionKey }
        : { targetCharacterId: relationship.targetCharacterId! }),
      relation: relationship.relation,
    }]
  })
  return { proposalBatchId: choices.proposalBatchId, expectedRevision: choices.revision,
    operationId, selections: choices.selections, relationships,
    ...(choices.edits?.length ? { edits: choices.edits } : {}) }
}
