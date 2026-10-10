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
  'character-proposal:list-pending-finalized': { args: []; return: PendingFinalizedCharacterProposalSummary[] }
  'character-proposal:read-pending-finalized': { args: [{ proposalBatchId: string }]; return: CharacterProposalBatch }
  'character-proposal:approve': { args: [ApproveCharacterProposalRequest]; return: { batch: CharacterProposalBatch; created: { selectionKey: string; characterId: string }[] } }
  'character-proposal:cancel': { args: [CancelCharacterProposalRequest]; return: CharacterProposalBatch }
  'character-identity:read': { args: []; return: CharacterIdentitySnapshot }
}
