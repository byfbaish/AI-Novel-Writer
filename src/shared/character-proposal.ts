import type { MainGenerationRunHandle } from '../services/generation/generation-runtime'
import type { CharacterStaticProvenance, ScopedCharacterResolution } from './character-identity'
import type { CharacterRole } from './character-role'

export interface CharacterStaticFields {
  name: string
  role?: CharacterRole
  gender?: string
  age?: string
  appearance?: string
  personality?: string
  background?: string
  abilities?: string
  motivation?: string
  arc?: string
  notes?: string
}
export type CharacterProposalSource =
  | { kind: 'generation'; inputKind: 'architecture' | 'planning-material'; handle: MainGenerationRunHandle;
      artifacts: { artifactId: string; revision: number; textHash: string }[]; manifestArtifactId?: string }
  | { kind: 'directory'; operationId: string }
  | { kind: 'import'; operationId: string }
  | { kind: 'finalized-generation'; handle: MainGenerationRunHandle;
      artifact: { artifactId: string; revision: number; textHash: string } }
  | { kind: 'legacy-roster-generation'; handle: MainGenerationRunHandle;
      artifact: { artifactId: string; revision: number; textHash: string } }
export interface CharacterProposalStageEvidence { proposalBatchId: string; sourceHash: string }
export interface CharacterProposalItem {
  selectionKey: string
  sourceId: string
  fields: CharacterStaticFields
  relationships: { targetSelectionKey?: string; targetName?: string; relation: string; raw?: unknown }[]
  rawValue?: unknown
  resolution: ScopedCharacterResolution
}
export interface CharacterProposalBatch {
  proposalBatchId: string
  revision: number
  status: 'pending-approval' | 'approved' | 'cancelled'
  items: CharacterProposalItem[]
  source: CharacterProposalSource
  approvalOperationId?: string
}
export type CharacterProposalDecision =
  | { selectionKey: string; action: 'create' }
  | { selectionKey: string; action: 'map'; characterId: string }
  | { selectionKey: string; action: 'keep-unresolved' }
  /**
   * 作者确认这是「位置锚定型功能配角」：有固定身份与引用键（摊主/门卫/前台），
   * 会被反复引用，但**不建卡、不进名册**（他没有弧光，建卡只制造维护负担）。
   * 与 `keep-unresolved` 的区别是**有结论**：它记录的是一个已作出的决定，
   * 因此该名字可以从「待建卡候选集」里排除，而不是永远挂在待处理中。
   */
  | { selectionKey: string; action: 'functional' }

/** 只有新建或映射到已有卡才会产生角色；`functional` 与 `keep-unresolved` 都不产生。 */
export function isAdoptedCharacterDecision(action: CharacterProposalDecision['action']): boolean {
  return action === 'create' || action === 'map'
}
export interface ApproveCharacterProposalRequest {
  proposalBatchId: string
  expectedRevision: number
  operationId: string
  selections: CharacterProposalDecision[]
  /**
   * An outgoing edge may originate from either a candidate created/mapped by this batch
   * (`sourceSelectionKey`) or an existing character card the author picked directly
   * (`sourceCharacterId`). Exactly one of the two must be present; the storage layer
   * already treats both endpoints symmetrically.
   */
  relationships?: { sourceSelectionKey?: string; sourceCharacterId?: string; targetSelectionKey?: string; targetCharacterId?: string; relation: string }[]
  /** Author changes to planning-material candidates, applied only with an explicit adoption decision. */
  edits?: { selectionKey: string; fields: Partial<CharacterStaticFields> }[]
}
export interface CancelCharacterProposalRequest {
  proposalBatchId: string
  expectedRevision: number
}
/** Read-only summary of one staged batch. Deliberately carries no timestamp: the table has no time column. */
export interface CharacterProposalHistoryEntry {
  proposalBatchId: string
  revision: number
  status: 'pending-approval' | 'approved' | 'cancelled'
  source: CharacterProposalSource
  /** Semantic grouping key derived from `source`; history cannot be time-ordered. */
  sourceGroup: 'architecture' | 'planning-material' | 'directory' | 'import' | 'finalized-generation' | 'legacy-roster-generation'
  itemCount: number
  /** Display label, e.g. 「来自前提+配置 · 5 个角色」. Author-facing only. */
  label: string
}
export type PendingFinalizedCharacterProposalSummary = {
  proposalBatchId: string
  revision: number
} & ({ finalizationId: string; importOperationId?: never } | { importOperationId: string; finalizationId?: never })
export interface CharacterIdentitySnapshot {
  revision: number
  characters: { characterId: string; fields: CharacterStaticFields; retired: boolean; revision: number;
    provenance: CharacterStaticProvenance | Record<string, unknown> }[]
  aliases: { characterId: string; name: string; sourceKey: string; validFrom: number; validThrough: number | null }[]
  relationships: { relationshipId: string; sourceCharacterId: string; targetCharacterId: string; relation: string }[]
}
export interface CharacterProposalChannels {
  'character-proposal:stage': { args: [{ source: CharacterProposalSource }]; return: CharacterProposalBatch }
  'character-proposal:read': { args: [{ proposalBatchId: string }]; return: CharacterProposalBatch }
  'character-proposal:list-history': { args: []; return: CharacterProposalHistoryEntry[] }
  /** 作者已确认「登记为功能配角、不建卡」的名字；用于从待建卡候选集里排除。 */
  'character-proposal:list-declined': { args: []; return: string[] }
  'character-proposal:list-pending-finalized': { args: []; return: PendingFinalizedCharacterProposalSummary[] }
  'character-proposal:read-pending-finalized': { args: [{ proposalBatchId: string }]; return: CharacterProposalBatch }
  'character-proposal:approve': { args: [ApproveCharacterProposalRequest]; return: { batch: CharacterProposalBatch; created: { selectionKey: string; characterId: string }[] } }
  'character-proposal:cancel': { args: [CancelCharacterProposalRequest]; return: CharacterProposalBatch }
  'character-identity:read': { args: []; return: CharacterIdentitySnapshot }
}
