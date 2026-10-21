import type Database from 'better-sqlite3'
import { isDeepStrictEqual } from 'node:util'
import type { ApproveCharacterProposalRequest, CancelCharacterProposalRequest, CharacterCastDecisionView, CharacterIdentitySnapshot, CharacterProposalBatch, CharacterProposalHistoryEntry, CharacterProposalItem, CharacterProposalSource, CharacterStaticFields, PendingFinalizedCharacterProposalSummary, RegisterCharacterCastRequest, RevokeCharacterCastRequest } from '../../src/shared/character-proposal'
import { isAdoptedCharacterDecision } from '../../src/shared/character-proposal'
import { resolveScopedCharacterIdentity, type CharacterStaticProvenance } from '../../src/shared/character-identity'
import { CHARACTER_ROLES } from '../../src/shared/character-role'
import { CharacterCastDecisionRepository, hasCharacterCastDecisionSchema } from '../repositories/character-cast-decision-repository'
import { CharacterRosterRepository, commitCharacterIdentities, refreshCharacterIdentityProjection, type CharacterIdentityCommitRequest } from '../repositories/character-roster-repository'
import { GenerationRunRepository, textHash } from '../repositories/generation-run-repository'
import { SummaryRepository } from '../repositories/summary-repository'
import { normalizeFinalizedCharacterProposalSource } from './finalized-character-generation-proof'
import { readLegacyRosterGenerationProof } from './legacy-roster-generation-proof'
import type { ArchitectureDerivationVersion } from '../../src/shared/character-proposal-parser'

export interface CharacterProposalProof {
  items: Omit<CharacterProposalItem, 'resolution'>[]
  sourceHash: string
  /** An unproven legacy/import candidate remains readable; it cannot be silently adopted. */
  provenance: CharacterStaticProvenance | null
}

/**
 * 判据 CX：这批「有出现、无卡」里是否还有**未登记为锚点人物**的名字。
 *
 * 实测缺陷（2026-10-21 第 3 章）：`小郑` 与 `跛脚老管事` 在采纳界面被明确判为
 * `functional`（有引用键、无卡槽），但定稿后处理仍为这两个名字抽出了完整状态，并
 * stage 成 `update:2` / `update:3` 两条待确认项 —— 它们**没有卡可写**，永远无法应用，
 * 只会让待确认队列每章加长一次、永远清不空。
 *
 * 两个调用点（`finalization-generation` 定稿主链、`finalized-character-generation`
 * 单独重跑链）都必须走这一处判断，否则同一条规则会在两条链上漂移。
 *
 * 收的是**已算好的名字集合**而不是 service：这两个调用点都在自己的事务里，把
 * `declinedCandidateNames()`（它自己会开一层事务）留在这里等于逼调用方在事务内嵌套读取。
 */
export function needsFinalizedOccurrenceBatch(
  declined: ReadonlySet<string>,
  unresolved: readonly { displayName: string }[],
): boolean {
  return unresolved.some(item => Boolean(item.displayName.trim()) && !declined.has(item.displayName.trim()))
}
interface Envelope {
  version: 1
  architectureDerivationVersion?: 2
  projectId: string
  proof: CharacterProposalProof
  batch: CharacterProposalBatch
  decision?: ApproveCharacterProposalRequest
  created?: { selectionKey: string; characterId: string }[]
  approvalProof?: { payloadHash: string; receiptHash: string }
  authorEditProof?: { payloadHash: string; receiptHash: string }
}
const fields = ['name', 'role', 'gender', 'age', 'appearance', 'personality', 'background', 'abilities', 'motivation', 'arc', 'notes'] as const
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
/** Author-facing grouping label. History has no timestamp, so the source is the only stable axis. */
function historyLabel(group: CharacterProposalHistoryEntry['sourceGroup'], itemCount: number): string {
  const base = group === 'architecture' ? '来自前提+配置'
    : group === 'planning-material' ? '来自创作资料'
      : group === 'directory' ? '来自章节蓝图'
        : group === 'import' ? '来自导入'
          : group === 'finalized-generation' ? '来自定稿正文'
            : '来自旧角色名单'
  return `${base} · ${itemCount} 个角色`
}
/** 可以「原文保留 + 追加候选」的叙述性字段。标识类字段不在此列。 */
const MERGE_TEXT_FIELDS = new Set([
  'appearance', 'personality', 'background', 'abilities', 'motivation', 'arc', 'notes',
])
/** 标识类字段：已有非空值时一律以现有卡为准，绝不覆盖、也不拼接。 */
const IDENTITY_FIELDS = new Set(['name', 'gender', 'age', 'role'])

/** 去空白与常见标点后比较，用于判断「候选是否已经写在现有文本里」。 */
function normalizeForMerge(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/gu, '')
    .replace(/[，。；、,.;:：!！?？"'“”‘’（）()【】[\]]/gu, '')
}

/**
 * 采用到已有角色时的字段合并策略。
 *
 * 背景（2026-10-21 作者裁定）：初始角色面板里的内容**已经被正文引用**，直接覆盖会让已写好的
 * 正文与角色卡对不上。因此改成合并：
 * - 现有为空 → 采用候选（补全照旧生效）；
 * - 值相同 / 候选已经包含在现有文本里 → 不写（保证重复导入幂等）；
 * - 叙述性字段 → 保留原文并在末尾追加候选，中间空一行；
 * - 标识字段（姓名/性别/年龄/定位）→ 保留现有值，不覆盖也不拼接。
 *
 * 导出以便纯函数单测；调用方只负责把它算出的差异写进 changes。
 */
export function mergeAdoptedCharacterFields(
  existing: Readonly<Record<string, string>>,
  candidate: Readonly<Record<string, string>>,
): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [key, rawCandidate] of Object.entries(candidate)) {
    const value = typeof rawCandidate === 'string' ? rawCandidate.trim() : ''
    const current = typeof existing[key] === 'string' ? existing[key] : ''
    if (!value) continue
    if (!current.trim()) { merged[key] = value; continue }
    if (current.trim() === value) continue
    if (IDENTITY_FIELDS.has(key) || !MERGE_TEXT_FIELDS.has(key)) continue
    const normalizedCurrent = normalizeForMerge(current)
    const normalizedCandidate = normalizeForMerge(value)
    if (!normalizedCandidate || normalizedCurrent.includes(normalizedCandidate)) continue
    merged[key] = `${current.trimEnd()}\n\n${value}`
  }
  return merged
}

export class CharacterProposalService {
  constructor(private readonly db: Database.Database, private readonly projectId: string,
    private readonly prove: (source: CharacterProposalSource, forWrite: boolean, version: ArchitectureDerivationVersion) => CharacterProposalProof) {}
  private sourceProof(source: CharacterProposalSource, forWrite: boolean, version: ArchitectureDerivationVersion): CharacterProposalProof {
    // The source and durable envelope share one JSON representation, including omitted optional fields.
    return JSON.parse(JSON.stringify(this.prove(source, forWrite, version))) as CharacterProposalProof
  }
  private revision(): number { return (this.db.prepare("SELECT revision FROM character_identity_meta WHERE id='main'").get() as { revision: number }).revision }
  private write(envelope: Envelope): void {
    const encoded = JSON.stringify(envelope)
    this.db.prepare('UPDATE character_identity_proposals SET source_hash=?,raw_value=? WHERE proposal_id=?').run(textHash(encoded), encoded, envelope.batch.proposalBatchId)
  }
  private assertFinalizedSourceCurrent(envelope: Envelope): void {
    if (envelope.batch.source.kind !== 'finalized-generation') return
    const provenance = envelope.proof.provenance
    const source = provenance && 'source' in provenance ? provenance.source : undefined
    const row = source && this.db.prepare('SELECT draft_id FROM finalization_outbox WHERE finalization_id=?').get(source.sourceId) as { draft_id: number } | undefined
    if (!row) throw new Error('CHARACTER_PROPOSAL_SOURCE_CHANGED')
    try {
      const current = SummaryRepository.readFinalizedCharacterContext(row.draft_id,
        { projectId: this.projectId, epoch: envelope.batch.source.handle.epoch }, this.db)
      if (current.source.finalizationId !== source.sourceId || current.source.contentHash !== source.contentHash
        || current.sourceOrder.authoritativeFinalizationRevision !== source.revision) throw new Error('CHARACTER_PROPOSAL_SOURCE_CHANGED')
    } catch {
      throw new Error('CHARACTER_PROPOSAL_SOURCE_CHANGED')
    }
  }
  private readEnvelope(proposalBatchId: string): Envelope {
    const row = this.db.prepare('SELECT source_key,source_hash,raw_value FROM character_identity_proposals WHERE proposal_id=?').get(proposalBatchId) as { source_key: string; source_hash: string; raw_value: string } | undefined
    if (!row || row.source_key !== `character-proposal-v1:${this.projectId}` || textHash(row.raw_value) !== row.source_hash) throw new Error('CHARACTER_PROPOSAL_RECEIPT_INVALID')
    let envelope: Envelope
    try { envelope = JSON.parse(row.raw_value) as Envelope } catch { throw new Error('CHARACTER_PROPOSAL_RECEIPT_INVALID') }
    if (!envelope || envelope.version !== 1 || envelope.projectId !== this.projectId || !envelope.batch
      || envelope.batch.proposalBatchId !== proposalBatchId) throw new Error('CHARACTER_PROPOSAL_RECEIPT_INVALID')
    if (envelope.architectureDerivationVersion !== undefined && (envelope.architectureDerivationVersion !== 2
      || envelope.batch.source?.kind !== 'generation' || envelope.batch.source.inputKind !== 'architecture')) throw new Error('CHARACTER_PROPOSAL_RECEIPT_INVALID')
    let currentProof: CharacterProposalProof
    try { currentProof = this.sourceProof(envelope.batch.source, false, envelope.architectureDerivationVersion ?? 1) } catch (error) {
      if (envelope.batch?.source?.kind === 'finalized-generation' && (error as Error).message !== 'CHARACTER_PROPOSAL_SOURCE_INVALID')
        throw new Error('CHARACTER_PROPOSAL_SOURCE_CHANGED')
      throw error
    }
    if (!isDeepStrictEqual(envelope.proof, currentProof)) {
      // 目录批次的 provenance 由「目录进度标记」推导，该标记是过渡性的（清蓝图 / 重跑后即消失）。
      // 但封存在批次里的那份 provenance 记录的是"这批候选由哪次生成产出"这一历史事实，
      // 标记消失不改事实 —— 其余证据一致时复用封存值，否则旧批次会连读取都失败。
      const keepsStoredProvenance = envelope.batch.status === 'pending-approval' && envelope.proof.provenance !== null
        && currentProof.provenance === null
        && isDeepStrictEqual({ ...envelope.proof, provenance: null }, currentProof)
      if (envelope.batch.source.kind === 'import' && envelope.batch.status === 'pending-approval' && envelope.proof.provenance === null
        && currentProof.provenance && isDeepStrictEqual({ ...envelope.proof, provenance: currentProof.provenance }, currentProof)) envelope.proof = currentProof
      else if (keepsStoredProvenance) envelope.proof = { ...currentProof, provenance: envelope.proof.provenance }
      else throw new Error('CHARACTER_PROPOSAL_SOURCE_CHANGED')
    }
    this.assertFinalizedSourceCurrent(envelope)
    if (envelope.batch.status === 'approved') {
      const receipt = this.db.prepare('SELECT receipt_json FROM character_identity_approvals WHERE operation_id=?').get(envelope.batch.approvalOperationId) as { receipt_json: string } | undefined
      const adoptionRevision = receipt && JSON.parse(receipt.receipt_json).revision as number | undefined
      if (!receipt || !envelope.decision) throw new Error('CHARACTER_PROPOSAL_APPROVAL_INVALID')
      if (envelope.authorEditProof) {
        const authorReceipt = this.db.prepare('SELECT payload_hash,receipt_json FROM character_identity_approvals WHERE operation_id=?')
          .get(`character-proposal-edit:${envelope.decision.operationId}`) as { payload_hash: string; receipt_json: string } | undefined
        if (!authorReceipt || authorReceipt.payload_hash !== envelope.authorEditProof.payloadHash
          || textHash(authorReceipt.receipt_json) !== envelope.authorEditProof.receiptHash
          || JSON.parse(authorReceipt.receipt_json).revision !== envelope.batch.revision
          || adoptionRevision !== envelope.batch.revision - 1) throw new Error('CHARACTER_PROPOSAL_APPROVAL_INVALID')
      } else if (adoptionRevision !== envelope.batch.revision) throw new Error('CHARACTER_PROPOSAL_APPROVAL_INVALID')
      if (envelope.batch.source.kind === 'legacy-roster-generation') {
        const row = this.db.prepare('SELECT payload_hash,receipt_json FROM character_identity_approvals WHERE operation_id=?').get(envelope.batch.approvalOperationId) as { payload_hash: string; receipt_json: string }
        const saved = JSON.parse(row.receipt_json)
        if (!envelope.approvalProof || row.payload_hash !== envelope.approvalProof.payloadHash || textHash(row.receipt_json) !== envelope.approvalProof.receiptHash
          || saved.approval?.operationId !== envelope.decision.operationId || envelope.batch.approvalOperationId !== envelope.decision.operationId
          || !isDeepStrictEqual(saved.created, envelope.created)) throw new Error('CHARACTER_PROPOSAL_APPROVAL_INVALID')
      }
    }
    return envelope
  }
  /**
   * 作者已判定「有引用键、无卡槽」的名字集合（`character_cast_decisions` 当前态）。
   *
   * 与公开的 `declinedCandidateNames()` 是同一条规则的**事务内**形态：后者自己开
   * `.immediate()` 事务，而 `resolveItems` 已经跑在 `stage`/`read` 的事务里，
   * 这里只做「回填（幂等）+ 读当前态」，不再嵌套一层事务。
   */
  private declinedNameSet(): Set<string> {
    if (!hasCharacterCastDecisionSchema(this.db)) {
      return new Set(this.legacyFunctionalNames().map(item => item.name))
    }
    this.backfillLegacyCastDecisions()
    return new Set(CharacterCastDecisionRepository.declinedNames(this.db))
  }
  private resolveItems(proof: CharacterProposalProof, source: CharacterProposalSource, snapshot: CharacterIdentitySnapshot): CharacterProposalItem[] {
    const aliases = snapshot.aliases.filter(alias => snapshot.characters.some(character => character.characterId === alias.characterId && !character.retired))
      .map(alias => ({ ...alias, projectId: this.projectId }))
    // 判据 CX（实测，2026-10-21 第 3 章）：已登记为锚点人物（无卡）的名字**不再进入定稿候选**。
    // 实测缺陷：`小郑` 与 `跛脚老管事` 在采纳界面被判为 `functional`，但定稿后处理仍为这两个
    // 名字抽出了完整状态，并 stage 成 `update:2`/`update:3` 两条待确认项 —— 它们没有卡可写，
    // **永远无法应用**，只会让待确认队列每章加长一次、永远清不空。`declinedCandidateNames`
    // 的注释早就写明这条规则（"否则那个集合永远清不空"），只是 `resolveItems` 没执行它。
    //
    // 只对定稿这条链生效：架构/旧名单/导入声明的是「要建哪些人」，不受登记影响 ——
    // 那些批次的项本来就是建卡机会，不是「有出现、无卡」的残留。
    const declined = source.kind === 'finalized-generation' ? this.declinedNameSet() : new Set<string>()
    return proof.items.flatMap(item => {
      if (declined.has(item.fields.name.trim())) return []
      let resolution = resolveScopedCharacterIdentity(aliases,
        { name: item.fields.name, projectId: this.projectId, sourceKey: item.sourceId, revision: snapshot.revision })
      if (source.kind !== 'finalized-generation' && resolution.status === 'unresolved') resolution = resolveScopedCharacterIdentity(aliases,
        { name: item.fields.name, projectId: this.projectId, revision: snapshot.revision })
      return [{ ...structuredClone(item), resolution }]
    })
  }
  read(proposalBatchId: string): CharacterProposalBatch {
    return this.db.transaction(() => {
      const envelope = this.readEnvelope(proposalBatchId)
      if (envelope.batch.status === 'pending-approval' && envelope.batch.revision !== this.revision()) {
        const snapshot = this.identitySnapshot()
        envelope.batch = { ...envelope.batch, revision: snapshot.revision, items: this.resolveItems(envelope.proof, envelope.batch.source, snapshot) }
        this.write(envelope)
      }
      return structuredClone(envelope.batch)
    }).immediate()
  }
  listPendingFinalized(): PendingFinalizedCharacterProposalSummary[] {
    const rows = this.db.prepare('SELECT proposal_id FROM character_identity_proposals WHERE source_key=? ORDER BY proposal_id')
      .all(`character-proposal-v1:${this.projectId}`) as { proposal_id: string }[]
    return rows.flatMap(({ proposal_id }): PendingFinalizedCharacterProposalSummary[] => {
      try {
        const envelope = this.readEnvelope(proposal_id), provenance = envelope.proof.provenance
        const source = provenance && 'source' in provenance ? provenance.source : undefined
        if (envelope.batch.status !== 'pending-approval' || !source) return []
        if (envelope.batch.source.kind === 'import') return [{ proposalBatchId: proposal_id, revision: envelope.batch.revision, importOperationId: envelope.batch.source.operationId }]
        return envelope.batch.source.kind === 'finalized-generation'
          ? [{ proposalBatchId: proposal_id, revision: envelope.batch.revision, finalizationId: source.sourceId }] : []
      } catch { return [] }
    })
  }
  /**
   * 从**既有已批准批次**派生出的 functional 名字 —— 段三切换读取源之前的历史登记。
   *
   * 批次收据里只有名字与角色值：口吻/关系从未被结构化保存过，因此回填时留空，
   * 由作者在管理面里补写，而不是编一个假值。
   */
  private legacyFunctionalNames(): { name: string; anchorRole: string; proposalBatchId: string; selectionKey: string; revision: number }[] {
    const rows = this.db.prepare('SELECT proposal_id FROM character_identity_proposals WHERE source_key=? ORDER BY proposal_id')
      .all(`character-proposal-v1:${this.projectId}`) as { proposal_id: string }[]
    const derived: { name: string; anchorRole: string; proposalBatchId: string; selectionKey: string; revision: number }[] = []
    for (const { proposal_id } of rows) {
      try {
        // 只读封存决定，不重算来源证明（见 storedDecisionEnvelope 的分工说明）。
        const envelope = this.storedDecisionEnvelope(proposal_id)
        if (!envelope) continue
        const functional = new Set((envelope.decision?.selections ?? [])
          .filter(selection => selection.action === 'functional').map(selection => selection.selectionKey))
        if (!functional.size) continue
        for (const item of envelope.batch.items) {
          if (!functional.has(item.selectionKey)) continue
          const name = item.fields.name?.trim()
          if (name) derived.push({ name, anchorRole: item.fields.role ?? '', proposalBatchId: proposal_id,
            selectionKey: item.selectionKey, revision: envelope.batch.revision })
        }
      } catch { /* 结构不可解的信封不贡献任何东西；篡改由 storedDecisionEnvelope 的哈希校验挡掉。 */ }
    }
    return derived
  }
  /**
   * 读**封存的作者决定**，但**不重算来源证明**。
   *
   * 与 `readEnvelope` 的分工：后者的用途是"还要不要继续对这批候选动手"，所以要求来源仍可证；
   * 而回填要回答的是"作者当初决定了什么" —— 那个事实只由信封自己承载，行内 `source_hash`
   * 已经保证它没被篡改（篡改仍会被上面的哈希校验挡掉）。
   *
   * 若在这里也要求重算证明，任何一次来源漂移（旧运行谱系失配 / 目录进度标记消失 / 名单被改）
   * 都会让**已定稿的登记静默消失**，名字随即回到候选集 —— 那正是本项目今天刚定下的
   * 判据 ⑮：重算取不到 ≠ 从未存在。
   */
  private storedDecisionEnvelope(proposalBatchId: string): Envelope | undefined {
    const row = this.db.prepare('SELECT source_key,source_hash,raw_value FROM character_identity_proposals WHERE proposal_id=?')
      .get(proposalBatchId) as { source_key: string; source_hash: string; raw_value: string } | undefined
    if (!row || row.source_key !== `character-proposal-v1:${this.projectId}` || textHash(row.raw_value) !== row.source_hash) return undefined
    try {
      const envelope = JSON.parse(row.raw_value) as Envelope
      return envelope?.batch && Array.isArray(envelope.batch.items) ? envelope : undefined
    } catch { return undefined }
  }

  /**
   * 把历史 functional 登记补进决定日志。
   *
   * **按「这个名字在日志里一条记录都没有」判断**，而不是按「表为空」：这样即便作者先登记了
   * 一个新名字（表已非空），老陈这类历史登记仍然会被补上；而一旦某名字有了任何记录
   * （包括一条 `revoke`），就永不回填 —— 撤销过的名字不会因为一次读取而"复活"。
   * 因此本方法幂等，且可与作者操作任意交错。
   */
  private backfillLegacyCastDecisions(): void {
    for (const derived of this.legacyFunctionalNames()) {
      if (CharacterCastDecisionRepository.currentForName(this.db, derived.name)) continue
      CharacterCastDecisionRepository.append(this.db, {
        name: derived.name, anchorRole: derived.anchorRole, action: 'register',
        sourceRevision: derived.revision,
        // 回填没有真实时间可用（批次表无时间列），记的是"我们把它固化下来的时刻"。
        createdAt: new Date().toISOString(),
        operationId: `cast-backfill:${derived.proposalBatchId}:${derived.selectionKey}`,
      })
    }
  }
  /**
   * Names the author explicitly registered as anchored supporting roles (no card).
   *
   * These are settled decisions, not pending ones: a name listed here must stop
   * appearing in the derived "declared by a blueprint but not yet built" candidate
   * set, otherwise that set can never be emptied.
   *
   * 段三起读取源改为 append-only 决定日志 `character_cast_decisions`（撤销因此成为可能：
   * 撤销 = 追加一条 `revoke`，该名字随即回到候选集）。未升级到 M08 的库没有这张表，
   * 此时回退到旧的「扫已批准批次」派生，保证未升级项目不受影响。
   */
  declinedCandidateNames(): string[] {
    if (!hasCharacterCastDecisionSchema(this.db)) {
      return [...new Set(this.legacyFunctionalNames().map(item => item.name))]
    }
    return this.db.transaction(() => {
      this.backfillLegacyCastDecisions()
      return CharacterCastDecisionRepository.declinedNames(this.db)
    }).immediate()
  }
  /** 锚点人物管理面：当前仍有效的登记（已撤销的名字不在其中）。 */
  listCastDecisions(): CharacterCastDecisionView[] {
    if (!hasCharacterCastDecisionSchema(this.db)) return []
    return this.db.transaction(() => {
      this.backfillLegacyCastDecisions()
      return CharacterCastDecisionRepository.current(this.db).filter(decision => decision.action === 'register')
    }).immediate()
  }
  /** 登记 / 改口吻定位。两者都是「追加一条 register」，当前态按名字取最后一条。 */
  registerCastDecision(request: RegisterCharacterCastRequest): CharacterCastDecisionView[] {
    if (!request || typeof request.name !== 'string' || !request.name.trim() || request.name.trim().length > 200
      || typeof request.anchorRole !== 'string' || !request.anchorRole.trim() || request.anchorRole.trim().length > 500
      || typeof request.operationId !== 'string' || !request.operationId.trim() || request.operationId.length > 256
      || Object.keys(request).some(key => !['name', 'anchorRole', 'catchphrase', 'relationToProtagonist', 'operationId'].includes(key))
      || request.catchphrase !== undefined && (typeof request.catchphrase !== 'string' || request.catchphrase.length > 500)
      || request.relationToProtagonist !== undefined && (typeof request.relationToProtagonist !== 'string' || request.relationToProtagonist.length > 500))
      throw new Error('CAST_DECISION_INVALID')
    if (!hasCharacterCastDecisionSchema(this.db)) throw new Error('CAST_DECISION_SCHEMA_REQUIRED')
    return this.db.transaction(() => {
      this.backfillLegacyCastDecisions()
      CharacterCastDecisionRepository.append(this.db, {
        name: request.name.trim(), anchorRole: request.anchorRole.trim(),
        catchphrase: request.catchphrase, relationToProtagonist: request.relationToProtagonist,
        action: 'register', sourceRevision: this.revision(), operationId: request.operationId.trim(),
        createdAt: new Date().toISOString(),
      })
      return CharacterCastDecisionRepository.current(this.db).filter(decision => decision.action === 'register')
    }).immediate()
  }
  /**
   * 撤销登记：该名字回到待建卡候选集。
   *
   * 撤销是**新决定**，不改写任何已批准批次收据（与 `reopen` 同一原则）。撤销行沿用当前
   * 登记的定位与口吻，因此「引用键」与「卡槽」在数据形状上分开 —— 撤销卡槽不连带丢失
   * 已声明的口吻与定位（判据 ④）。对未登记或已撤销的名字是幂等空操作。
   */
  revokeCastDecision(request: RevokeCharacterCastRequest): CharacterCastDecisionView[] {
    if (!request || typeof request.name !== 'string' || !request.name.trim() || request.name.trim().length > 200
      || typeof request.operationId !== 'string' || !request.operationId.trim() || request.operationId.length > 256
      || Object.keys(request).some(key => !['name', 'operationId'].includes(key)))
      throw new Error('CAST_DECISION_INVALID')
    if (!hasCharacterCastDecisionSchema(this.db)) throw new Error('CAST_DECISION_SCHEMA_REQUIRED')
    return this.db.transaction(() => {
      this.backfillLegacyCastDecisions()
      const name = request.name.trim()
      const current = CharacterCastDecisionRepository.currentForName(this.db, name)
      if (current && current.action === 'register') {
        CharacterCastDecisionRepository.append(this.db, {
          name, anchorRole: current.anchorRole, catchphrase: current.catchphrase,
          relationToProtagonist: current.relationToProtagonist, action: 'revoke',
          sourceRevision: this.revision(), operationId: request.operationId.trim(),
          createdAt: new Date().toISOString(),
        })
      }
      return CharacterCastDecisionRepository.current(this.db).filter(decision => decision.action === 'register')
    }).immediate()
  }
  /**
   * Read-only generation history. The table stores no timestamp, so entries are
   * grouped by the semantic meaning of `source` instead of being time-ordered.
   * Any entry whose durable proof no longer verifies is skipped, never repaired.
   */
  listHistory(): CharacterProposalHistoryEntry[] {
    const rows = this.db.prepare('SELECT proposal_id FROM character_identity_proposals WHERE source_key=? ORDER BY proposal_id')
      .all(`character-proposal-v1:${this.projectId}`) as { proposal_id: string }[]
    return rows.flatMap(({ proposal_id }): CharacterProposalHistoryEntry[] => {
      try {
        const envelope = this.readEnvelope(proposal_id)
        const source = envelope.batch.source
        const sourceGroup = source.kind === 'generation' ? source.inputKind : source.kind
        return [{
          proposalBatchId: proposal_id,
          revision: envelope.batch.revision,
          status: envelope.batch.status,
          source: structuredClone(source),
          sourceGroup,
          itemCount: envelope.batch.items.length,
          label: historyLabel(sourceGroup, envelope.batch.items.length),
        }]
      } catch { return [] }
    })
  }
  readPendingFinalized(proposalBatchId: string): CharacterProposalBatch {
    const batch = this.read(proposalBatchId)
    if (batch.status !== 'pending-approval' || !['finalized-generation', 'import'].includes(batch.source.kind))
      throw new Error('CHARACTER_PROPOSAL_NOT_PENDING_FINALIZED')
    return batch
  }
  evidence(proposalBatchId: string) {
    const envelope = this.readEnvelope(proposalBatchId)
    return { proposalBatchId, sourceHash: envelope.proof.sourceHash }
  }
  stage(source: CharacterProposalSource): CharacterProposalBatch {
    return this.db.transaction(() => {
      if (source?.kind === 'legacy-roster-generation') {
        source = readLegacyRosterGenerationProof(this.db, new GenerationRunRepository(() => this.db), this.projectId, source).source
        const proposalBatchId = `cpb:${textHash(JSON.stringify([this.projectId, source]))}`
        if (this.db.prepare('SELECT 1 FROM character_identity_proposals WHERE proposal_id=?').get(proposalBatchId)) return this.read(proposalBatchId)
      }
      if (source?.kind === 'finalized-generation') {
        const normalized = normalizeFinalizedCharacterProposalSource(this.db, new GenerationRunRepository(() => this.db), this.projectId, source)
        source = normalized.source
        // Only the dedicated main context supports historical ACKs. Legacy kinds keep their write gate.
        if (normalized.stableFinalizationSource) {
          const proposalBatchId = `cpb:${textHash(JSON.stringify([this.projectId, source]))}`
          if (this.db.prepare('SELECT 1 FROM character_identity_proposals WHERE proposal_id=?').get(proposalBatchId)) return this.read(proposalBatchId)
        }
      }
      const proposalBatchId = `cpb:${textHash(JSON.stringify([this.projectId, source]))}`
      const existing = this.db.prepare('SELECT 1 FROM character_identity_proposals WHERE proposal_id=?').get(proposalBatchId)
      if (existing) {
        const envelope = this.readEnvelope(proposalBatchId)
        this.sourceProof(source, true, envelope.architectureDerivationVersion ?? 1)
        return this.read(proposalBatchId)
      }
      const architectureDerivationVersion = source?.kind === 'generation' && source.inputKind === 'architecture' ? 2 : undefined
      const proof = this.sourceProof(source, true, architectureDerivationVersion ?? 1)
      const revision = this.revision(), snapshot = this.identitySnapshot()
      const items = this.resolveItems(proof, source, snapshot)
      const batch: CharacterProposalBatch = { proposalBatchId, revision, status: 'pending-approval', source: structuredClone(source), items }
      const envelope: Envelope = { version: 1, ...(architectureDerivationVersion ? { architectureDerivationVersion } : {}),
        projectId: this.projectId, proof: structuredClone(proof), batch }
      this.assertFinalizedSourceCurrent(envelope)
      const encoded = JSON.stringify(envelope)
      this.db.prepare('INSERT INTO character_identity_proposals(proposal_id,owner_character_id,source_key,source_hash,raw_value,candidate_ids_json) VALUES(?,NULL,?,?,?,?)')
        .run(proposalBatchId, `character-proposal-v1:${this.projectId}`, textHash(encoded), encoded, '[]')
      return structuredClone(batch)
    }).immediate()
  }
  cancel(request: CancelCharacterProposalRequest): CharacterProposalBatch {
    if (!request || !nonempty(request.proposalBatchId)
      || !Number.isSafeInteger(request.expectedRevision)
      || Object.keys(request).some(key => !['proposalBatchId', 'expectedRevision'].includes(key))) throw new Error('CHARACTER_APPROVAL_INVALID')
    return this.db.transaction(() => {
      const envelope = this.readEnvelope(request.proposalBatchId)
      if (request.expectedRevision !== envelope.batch.revision) throw new Error('CHARACTER_ID_REVISION_CONFLICT')
      if (envelope.batch.status === 'approved') throw new Error('CHARACTER_PROPOSAL_ALREADY_APPROVED')
      if (envelope.batch.status === 'cancelled') return structuredClone(envelope.batch)
      envelope.batch.status = 'cancelled'; this.write(envelope)
      return structuredClone(envelope.batch)
    }).immediate()
  }

  /**
   * 重新打开一个已取消的批次，回到待确认状态。
   *
   * 取消是纯状态翻转，不写任何身份效果（无 creation、无 relationship），因此重开不产生
   * 任何需要回滚的东西 —— 它只是把"作者当时没能做出决定"（常因保存报错而取消）的批次
   * 放回决策队列。没有这一步，蓝图声明过的候选会在「暂存即完成」的同步操作与「取消即
   * 终态」的批次之间永远失踪。已批准的批次不可重开：决策已落库且有身份效果。
   */
  reopen(request: CancelCharacterProposalRequest): CharacterProposalBatch {
    if (!request || !nonempty(request.proposalBatchId)
      || !Number.isSafeInteger(request.expectedRevision)
      || Object.keys(request).some(key => !['proposalBatchId', 'expectedRevision'].includes(key))) throw new Error('CHARACTER_APPROVAL_INVALID')
    return this.db.transaction(() => {
      const envelope = this.readEnvelope(request.proposalBatchId)
      if (request.expectedRevision !== envelope.batch.revision) throw new Error('CHARACTER_ID_REVISION_CONFLICT')
      if (envelope.batch.status === 'pending-approval') return structuredClone(envelope.batch)
      if (envelope.batch.status !== 'cancelled') throw new Error('CHARACTER_PROPOSAL_ALREADY_APPROVED')
      envelope.batch = { ...envelope.batch, status: 'pending-approval', revision: this.revision() }
      this.write(envelope)
      return structuredClone(envelope.batch)
    }).immediate()
  }
  approve(request: ApproveCharacterProposalRequest): { batch: CharacterProposalBatch; created: { selectionKey: string; characterId: string }[] } {
    if (!request || !nonempty(request.operationId) || request.operationId.length > 256 || !Array.isArray(request.selections)
      || Object.keys(request).some(key => !['proposalBatchId', 'expectedRevision', 'operationId', 'selections', 'relationships', 'edits'].includes(key))) throw new Error('CHARACTER_APPROVAL_INVALID')
    return this.db.transaction(() => {
      const envelope = this.readEnvelope(request.proposalBatchId), batch = envelope.batch
      const byKey = new Map(batch.items.map(item => [item.selectionKey, item]))
      if (request.edits !== undefined && (batch.source.kind !== 'generation' || batch.source.inputKind !== 'planning-material'
        || !Array.isArray(request.edits) || request.edits.length > batch.items.length)) throw new Error('CHARACTER_PROPOSAL_EDIT_INVALID')
      const editKeys = new Set<string>()
      const edits = request.edits?.map(edit => {
        if (!edit || typeof edit.selectionKey !== 'string' || editKeys.has(edit.selectionKey)
          || !byKey.has(edit.selectionKey) || !edit.fields || typeof edit.fields !== 'object' || Array.isArray(edit.fields))
          throw new Error('CHARACTER_PROPOSAL_EDIT_INVALID')
        editKeys.add(edit.selectionKey)
        const values = Object.entries(edit.fields)
        if (!values.length || values.some(([key, value]) => !fields.includes(key as typeof fields[number])
          || typeof value !== 'string' || key === 'name' && !value.trim()
          || key === 'role' && !CHARACTER_ROLES.includes(value as typeof CHARACTER_ROLES[number])))
          throw new Error('CHARACTER_PROPOSAL_EDIT_INVALID')
        return { selectionKey: edit.selectionKey, fields: Object.fromEntries(fields.filter(key => key in edit.fields)
          .map(key => [key, edit.fields[key]])) as Partial<CharacterStaticFields> }
      }).sort((a, b) => a.selectionKey.localeCompare(b.selectionKey, 'en-US'))
      const decision = edits ? { ...request, edits } : request
      if (batch.status === 'approved') {
        if (!isDeepStrictEqual(envelope.decision, decision)) throw new Error('CHARACTER_APPROVAL_NONCE_CONFLICT')
        return { batch: structuredClone(batch), created: structuredClone(envelope.created ?? []) }
      }
      if (batch.status !== 'pending-approval') throw new Error('CHARACTER_PROPOSAL_CANCELLED')
      if (batch.source.kind !== 'legacy-roster-generation' && !['ready', 'empty'].includes(CharacterRosterRepository.read(this.db).status))
        throw new Error('CHARACTER_AUTHOR_ROSTER_NOT_READY')
      if (request.expectedRevision !== batch.revision || this.revision() !== batch.revision) throw new Error('CHARACTER_ID_REVISION_CONFLICT')
      const proof = this.sourceProof(batch.source, true, envelope.architectureDerivationVersion ?? 1)
      // 过渡性的目录进度标记消失后重算会拿不到 provenance；此时用封存值（读取时已校验过其余证据一致）。
      const provenance = proof.provenance ?? envelope.proof.provenance
      if (!provenance || !['generated', 'derived'].includes(provenance.kind)) throw new Error('CHARACTER_PROPOSAL_PROVENANCE_REQUIRED')
      if (request.selections.length !== byKey.size || new Set(request.selections.map(item => item.selectionKey)).size !== byKey.size) throw new Error('CHARACTER_APPROVAL_SELECTION_INVALID')
      if (edits?.some(edit => !request.selections.some(selection => selection.selectionKey === edit.selectionKey && isAdoptedCharacterDecision(selection.action))))
        throw new Error('CHARACTER_PROPOSAL_EDIT_INVALID')
      if (batch.source.kind === 'legacy-roster-generation' && !request.selections.some(item => item.action === 'create' || item.action === 'map'))
        throw new Error('CHARACTER_APPROVAL_SELECTION_REQUIRED')
      const identityRequest: CharacterIdentityCommitRequest = { approval: { operationId: request.operationId, expectedRevision: request.expectedRevision,
        source: provenance, action: batch.source.kind === 'legacy-roster-generation' || batch.source.kind === 'generation' && batch.source.inputKind === 'architecture' ? 'adopt-generated' : 'adopt-import' },
        changes: [], creations: [], retireIds: [], relationships: [], resolutions: [] }
      const existingCharacters = this.identitySnapshot().characters
      for (const selection of request.selections) {
        const item = byKey.get(selection.selectionKey)
        if (!item || !['create', 'map', 'keep-unresolved', 'functional'].includes(selection.action)
          || Object.keys(selection).some(key => !['selectionKey', 'action', ...(selection.action === 'map' ? ['characterId'] : [])].includes(key))) throw new Error('CHARACTER_APPROVAL_SELECTION_INVALID')
        if (selection.action === 'create') identityRequest.creations.push({ selectionKey: item.selectionKey, fields: item.fields })
        // A finalized occurrence carries a historical display label, not permission to rename an existing identity.
        if (selection.action === 'map' && batch.source.kind !== 'finalized-generation') {
          const existing = existingCharacters.find(character => character.characterId === selection.characterId && !character.retired)
          if (!existing) throw new Error('CHARACTER_ID_UNKNOWN')
          // 合并而非覆盖：初始角色/已定稿正文引用过的字段不能被候选直接冲掉。
          const adopted = mergeAdoptedCharacterFields(
            existing.fields as unknown as Record<string, string>,
            item.fields as unknown as Record<string, string>,
          )
          if (Object.keys(adopted).length) identityRequest.changes.push({ characterId: selection.characterId, fields: adopted })
        }
        if (selection.action === 'map' && batch.source.kind === 'finalized-generation'
          && !this.identitySnapshot().characters.some(character => character.characterId === selection.characterId && !character.retired))
          throw new Error('CHARACTER_ID_UNKNOWN')
      }
      for (const relation of request.relationships ?? []) {
        // `from` is a candidate of this batch that actually produces a character (`create`/`map`)
        // or, when the author attaches an outgoing edge to an existing card, that card's own id.
        // `keep-unresolved` and `functional` produce no character, so neither can be an edge source.
        const from = relation.sourceSelectionKey
          ? request.selections.find(item => item.selectionKey === relation.sourceSelectionKey) : undefined
        const to = relation.targetSelectionKey
          ? request.selections.find(item => item.selectionKey === relation.targetSelectionKey) : undefined
        const fromExisting = relation.sourceCharacterId !== undefined
        const fromCandidate = from !== undefined
        if (fromExisting === fromCandidate
          || fromExisting && (relation.sourceSelectionKey !== undefined || !nonempty(relation.sourceCharacterId))
          || fromCandidate && (!isAdoptedCharacterDecision(from!.action)
            || !byKey.get(from!.selectionKey)!.relationships.some(item => item.relation === relation.relation
              && (item.targetSelectionKey ? item.targetSelectionKey === relation.targetSelectionKey : Boolean(item.targetName))))
          || to !== undefined && !isAdoptedCharacterDecision(to.action)
          || Boolean(to) === Boolean(relation.targetCharacterId)) throw new Error('CHARACTER_RELATIONSHIP_PROPOSAL_INVALID')
        // An existing source can only point at a resolvable target, and relabelling it would
        // rewrite an identity the batch has no authority over.
        if (fromExisting && !existingCharacters.some(character => character.characterId === relation.sourceCharacterId && !character.retired))
          throw new Error('CHARACTER_ID_UNKNOWN')
        identityRequest.relationships.push({
          ...(fromExisting ? { sourceCharacterId: relation.sourceCharacterId }
            : from!.action === 'map' ? { sourceCharacterId: from!.characterId }
              : { sourceSelectionKey: from!.selectionKey }),
          ...(to ? to.action === 'map' ? { targetCharacterId: to.characterId }
            : { targetSelectionKey: to.selectionKey } : { targetCharacterId: relation.targetCharacterId }),
          relation: relation.relation })
      }
      const frozenRequest = JSON.stringify(identityRequest)
      const receipt = commitCharacterIdentities(this.db, identityRequest, candidate => JSON.stringify(candidate) === frozenRequest)
      let finalRevision = receipt.revision
      const authorChanges = (edits ?? []).flatMap(edit => {
        const item = byKey.get(edit.selectionKey)!
        const changed = Object.fromEntries(Object.entries(edit.fields).filter(([key, value]) => item.fields[key as keyof CharacterStaticFields] !== value))
        if (!Object.keys(changed).length) return []
        const selection = request.selections.find(value => value.selectionKey === edit.selectionKey)!
        const characterId = selection.action === 'map' ? selection.characterId
          : receipt.created.find(value => value.selectionKey === edit.selectionKey)?.characterId
        if (!characterId) throw new Error('CHARACTER_PROPOSAL_EDIT_INVALID')
        return [{ characterId, fields: changed }]
      })
      if (authorChanges.length) {
        const source = batch.source
        if (source.kind !== 'generation' || source.inputKind !== 'planning-material') throw new Error('CHARACTER_PROPOSAL_EDIT_INVALID')
        const authorRequest: CharacterIdentityCommitRequest = {
          approval: { operationId: `character-proposal-edit:${request.operationId}`, expectedRevision: receipt.revision,
            action: 'author-edit', source: { kind: 'author', source: { projectId: this.projectId, epoch: source.handle.epoch,
              sourceId: `character-proposal-edit:${batch.proposalBatchId}`, revision: receipt.revision,
              contentHash: textHash(JSON.stringify(edits)) } } },
          changes: authorChanges, creations: [], retireIds: [], relationships: [], resolutions: [],
        }
        const frozenAuthorRequest = JSON.stringify(authorRequest)
        finalRevision = commitCharacterIdentities(this.db, authorRequest, candidate => JSON.stringify(candidate) === frozenAuthorRequest).revision
        const authorReceipt = this.db.prepare('SELECT payload_hash,receipt_json FROM character_identity_approvals WHERE operation_id=?')
          .get(authorRequest.approval.operationId) as { payload_hash: string; receipt_json: string }
        envelope.authorEditProof = { payloadHash: authorReceipt.payload_hash, receiptHash: textHash(authorReceipt.receipt_json) }
      }
      refreshCharacterIdentityProjection(this.db)
      // 段三起：`functional` 决定在**确认时**就写入决定日志，日志因此成为唯一事实源
      // （读取侧的 backfill 只负责段三之前的历史批次）。这样撤销之后再登记同一个名字
      // 也能生效 —— 若只靠读取时派生，一个已被撤销过的名字会因"日志里已有记录"而永不更新。
      if (hasCharacterCastDecisionSchema(this.db)) {
        for (const selection of request.selections) {
          if (selection.action !== 'functional') continue
          const name = byKey.get(selection.selectionKey)?.fields.name?.trim()
          if (!name) continue
          CharacterCastDecisionRepository.append(this.db, {
            name, anchorRole: byKey.get(selection.selectionKey)?.fields.role ?? '', action: 'register',
            sourceRevision: finalRevision,
            operationId: `cast-approve:${request.operationId}:${selection.selectionKey}`,
            createdAt: new Date().toISOString(),
          })
        }
      }
      envelope.batch = { ...batch, status: 'approved', revision: finalRevision, approvalOperationId: request.operationId }
      envelope.decision = structuredClone(decision); envelope.created = receipt.created
      if (batch.source.kind === 'legacy-roster-generation') {
        const row = this.db.prepare('SELECT payload_hash,receipt_json FROM character_identity_approvals WHERE operation_id=?').get(request.operationId) as { payload_hash: string; receipt_json: string } | undefined
        if (!row) throw new Error('CHARACTER_PROPOSAL_APPROVAL_INVALID')
        envelope.approvalProof = { payloadHash: row.payload_hash, receiptHash: textHash(row.receipt_json) }
      }
      this.write(envelope)
      return { batch: structuredClone(envelope.batch), created: structuredClone(receipt.created) }
    }).immediate()
  }
  identitySnapshot(): CharacterIdentitySnapshot {
    return this.db.transaction(() => ({ revision: this.revision(),
      characters: (this.db.prepare('SELECT * FROM characters ORDER BY character_id').all() as Record<string, unknown>[]).map(row => ({
        characterId: row.character_id as string, fields: Object.fromEntries(fields.map(key => [key, String(row[key] ?? '')])) as unknown as CharacterStaticFields,
        retired: row.retired === 1, revision: row.identity_revision as number, provenance: JSON.parse(row.static_provenance as string) as CharacterStaticProvenance })),
      aliases: (this.db.prepare('SELECT * FROM character_aliases ORDER BY character_id,name,valid_from').all() as Record<string, unknown>[]).map(row => ({
        characterId: row.character_id as string, name: row.name as string, sourceKey: row.source_key as string, validFrom: row.valid_from as number, validThrough: row.valid_through as number | null })),
      relationships: (this.db.prepare('SELECT * FROM character_relationships ORDER BY relationship_id').all() as Record<string, unknown>[]).map(row => ({
        relationshipId: row.relationship_id as string, sourceCharacterId: row.source_character_id as string, targetCharacterId: row.target_character_id as string, relation: row.relation as string })),
    }))()
  }
}

/** Find an exact durable source, never a latest-name or latest-proposal fallback. */
export function findCharacterProposalEvidence(db: Database.Database, source: CharacterProposalSource,
  prove: (projectId: string, source: CharacterProposalSource) => CharacterProposalProof) {
  if (source.kind === 'finalized-generation') source = normalizeFinalizedCharacterProposalSource(
    db, new GenerationRunRepository(() => db), source.handle.projectId, source).source
  const rows = db.prepare("SELECT raw_value FROM character_identity_proposals WHERE source_key LIKE 'character-proposal-v1:%'").all() as { raw_value: string }[]
  const matches = rows.map(row => JSON.parse(row.raw_value) as Envelope).filter(envelope => isDeepStrictEqual(envelope.batch?.source, source))
  if (matches.length !== 1) throw new Error('CHARACTER_PROPOSAL_EVIDENCE_REQUIRED')
  const envelope = matches[0]!
  return new CharacterProposalService(db, envelope.projectId, candidate => prove(envelope.projectId, candidate)).evidence(envelope.batch.proposalBatchId)
}
