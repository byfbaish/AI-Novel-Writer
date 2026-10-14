import type { ApproveCharacterProposalRequest, CharacterProposalBatch } from '../shared/character-proposal'
import { isAdoptedCharacterDecision } from '../shared/character-proposal'
import { defaultCharacterProposalRelationships, defaultCharacterProposalSelections } from './workflows/character-proposal-preview'

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

export function createCharacterProposalChoices(batch: CharacterProposalBatch): CharacterProposalChoices {
  return { proposalBatchId: batch.proposalBatchId, revision: batch.revision,
    selections: defaultCharacterProposalSelections(batch), relationships: defaultCharacterProposalRelationships(batch) }
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
    // A row whose "source" is a card being mapped in this very batch has no id yet: fold it back
    // onto that candidate's selection key. Every other row keeps whichever source it declares.
    if (relationship.sourceCharacterId && keyByCharacterId.has(relationship.sourceCharacterId))
      return [{ sourceSelectionKey: keyByCharacterId.get(relationship.sourceCharacterId), targetSelectionKey: relationship.targetSelectionKey, targetCharacterId: relationship.targetCharacterId, relation: relationship.relation }]
    if (relationship.sourceSelectionKey || relationship.sourceCharacterId) return [relationship]
    // A row with no source at all is not an edge; dropping it is the only safe reading.
    return []
  }).map(({ sourceCharacterId, ...rest }) => sourceCharacterId ? { ...rest, sourceCharacterId } : rest)
  return { proposalBatchId: choices.proposalBatchId, expectedRevision: choices.revision,
    operationId, selections: choices.selections, relationships,
    ...(choices.edits?.length ? { edits: choices.edits } : {}) }
}
