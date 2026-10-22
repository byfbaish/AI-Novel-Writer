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
  /**
   * 归位表补全（W4a ②补全段）：作者在归位表里看到「被提到但还没有卡」的名字，模型为它们补齐静态资料。
   *
   * 为什么是「先生成、后 stage」而不是「先只带名字 stage、再补全」：
   * `readEnvelope`（character-proposal-service.ts）每次读取都从**当前**库重算 proof 并与封存 proof
   * 深比较，不等即 CHARACTER_PROPOSAL_SOURCE_CHANGED；而 `proposalBatchId` 是
   * `textHash(JSON.stringify([projectId, source]))`。若先 stage 只有名字的批次、随后补全后再 stage，
   * 会得到**新的** batchId，旧批次永远停在 pending-approval（判据 CX 的「永远无法应用的项」）。
   * 反过来「不改 source、只让 items 由 proof 派生名字」则会产出**没有资料的卡**（§4.4 retired=1「刘三」的空壳教训）。
   * 因此：模型产物先落 artifact，`names` 与 `artifacts` 一次成型后才 stage ⇒ 不存在「只有名字的可批准批次」。
   *
   * 注意：产物里的 `currentState` 不写入新卡（`CharacterStaticFields` 没有该字段，且
   * `decodeCharacterDetails` 会把 `updatedAtChapter` 压成 0）⇒ 新卡显示为「未观测」，而不是伪造的第 0 章状态。
   */
  | { kind: 'cast-ledger'; names: string[]; handle: MainGenerationRunHandle;
      artifacts: { artifactId: string; revision: number; textHash: string }[] }
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
    | 'cast-ledger'
  itemCount: number
  /** Display label, e.g. 「来自前提+配置 · 5 个角色」. Author-facing only. */
  label: string
}
export type PendingFinalizedCharacterProposalSummary = {
  proposalBatchId: string
  revision: number
} & ({ finalizationId: string; importOperationId?: never } | { importOperationId: string; finalizationId?: never })
/**
 * 锚点人物（功能配角）的一条决定记录 —— append-only 日志的只读视图。
 *
 * `revoke` 行仍然带着登记时的定位与口吻：撤销的是**卡槽**，不是引用键，
 * 所以已声明的口吻/定位不因撤销而丢失（判据 ④）。
 */
export interface CharacterCastDecisionView {
  decisionId: string
  name: string
  anchorRole: string
  catchphrase: string
  relationToProtagonist: string
  action: 'register' | 'revoke'
  sourceRevision: number
  operationId: string
  createdAt: string
}
/** 登记（或改口吻/定位后重新登记）一个锚点人物。 */
export interface RegisterCharacterCastRequest {
  name: string
  anchorRole: string
  catchphrase?: string
  relationToProtagonist?: string
  operationId: string
}
/** 撤销登记：该名字重新回到待建卡候选集。 */
export interface RevokeCharacterCastRequest {
  name: string
  operationId: string
}
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
  /** 作者已确认「登记为锚点人物、不建卡」的名字；用于从待建卡候选集里排除。 */
  'character-proposal:list-declined': { args: []; return: string[] }
  /** 锚点人物管理面：列出当前仍有效的登记（不含已撤销的名字）。 */
  'character-cast:list': { args: []; return: CharacterCastDecisionView[] }
  'character-cast:register': { args: [RegisterCharacterCastRequest]; return: CharacterCastDecisionView[] }
  'character-cast:revoke': { args: [RevokeCharacterCastRequest]; return: CharacterCastDecisionView[] }
  'character-proposal:list-pending-finalized': { args: []; return: PendingFinalizedCharacterProposalSummary[] }
  'character-proposal:read-pending-finalized': { args: [{ proposalBatchId: string }]; return: CharacterProposalBatch }
  'character-proposal:approve': { args: [ApproveCharacterProposalRequest]; return: { batch: CharacterProposalBatch; created: { selectionKey: string; characterId: string }[] } }
  'character-proposal:cancel': { args: [CancelCharacterProposalRequest]; return: CharacterProposalBatch }
  'character-proposal:reopen': { args: [CancelCharacterProposalRequest]; return: CharacterProposalBatch }
  'character-identity:read': { args: []; return: CharacterIdentitySnapshot }
}
