import { CHARACTER_STATE_TEXT_FIELDS, type CharacterStateTextField } from './character-roster'
import { decideDerivedPatch, type CharacterFieldSnapshot, type DerivedSourceOrder } from './character-identity'
import { isFinalizedSourceIdentity, type ProjectEpoch } from './source-ref'

export type FinalizedContinuityFactCategory =
  | 'character-state'
  | 'timeline'
  | 'open-thread'
  | 'plot'

/** Existing finalization receipt fields needed to bind derived material to immutable prose. */
export interface FinalizedSourceIdentity {
  draftId: number
  finalizationId: string
  chapterNumber: number
  contentHash: string
}

export type FinalizedProjectionStatus = 'current' | 'stale' | 'legacy'

export interface FinalizedSourceSnapshot {
  source: FinalizedSourceIdentity
  chapterTitle: string
  content: string
  /** Project continuity watermark frozen before semantic extraction starts. */
  projectionGeneration: number
}

export type FinalizedSourceReadResult =
  | { status: 'valid'; snapshot: FinalizedSourceSnapshot }
  | {
      status: 'legacy'
      draftId: number
      chapterNumber: number
      chapterTitle: string
      content: string
    }
  | { status: 'invalid' }

export interface FinalizedContinuityFact {
  category: FinalizedContinuityFactCategory
  entities: string[]
  statement: string
  sourceChapter: number
  evidence: string
  /** Display labels remain readable; only these proven IDs are identity references. */
  characterRefs?: FinalizedCharacterReference[]
}

export interface FinalizedCharacterReference {
  characterId: string
  displayNameSnapshot: string
}

/** A machine-derived locator only; it never becomes an author-confirmed fact. */
export interface FinalizedCharacterStateCandidate {
  /** Absent only on preserved legacy locators, never sufficient for a new write. */
  characterId?: string
  characterName: string
  field: CharacterStateTextField
  value: string
  evidence?: FinalizedCharacterEvidence
  selectionKey?: string
  displayName?: string
  rawValue?: unknown
  /**
   * 为什么这条没被自动写回。三种原因**互斥且不可合并**：
   * - `author-protected` / `legacy-protected`：目标字段已被作者（或历史作者值）占住。
   * - `review-conflict`：审稿在正文里读到的值与定稿后处理读到的值不一致（W3 第二单元）。
   *   它不是「定稿读错了」的断言 —— 两个读者至少有一个错了，谁错只有作者能判。
   */
  reason?: 'author-protected' | 'legacy-protected' | 'review-conflict'
  /**
   * 仅 `review-conflict` 时存在：审稿侧读到的值与它的引文。
   * 没有这两项，作者看到的只有「当前值 vs 定稿建议值」，等于要他去翻正文第三遍才能裁决。
   */
  reviewObserved?: string
  reviewQuote?: string
  /** Present on current source-bound decisions; omitted only by preserved legacy rows. */
  candidateKey?: string
  source?: FinalizedSourceIdentity
  expectedFieldRevision?: number
  expectedFieldValueHash?: string
}

export interface PendingFinalizedCharacterStateCandidate extends FinalizedCharacterStateCandidate {
  candidateKey: string
  characterId: string
  source: FinalizedSourceIdentity
  expectedFieldRevision: number
  expectedFieldValueHash: string
}

export interface PendingFinalizedCharacterStateCandidateSummary {
  draftId: number
  candidateKey: string
  finalizationId: string
  characterId: string
  characterName: string
  field: CharacterStateTextField
}

export interface FinalizedCharacterStateDecisionRequest {
  draftId: number
  candidateKey: string
  characterId: string
  field: CharacterStateTextField
  expectedFieldRevision: number
  expectedFieldValueHash: string
  operationId: string
  decision: 'accept' | 'decline'
}

export interface FinalizedCharacterStateDecisionReceipt {
  candidateKey: string
  operationId: string
  payloadHash: string
  decision: 'accept' | 'decline'
  source: FinalizedSourceIdentity
  idempotent: boolean
}

/** Offsets count JS UTF-16 code units in the immutable, unnormalized prose. */
export interface FinalizedCharacterEvidence { start: number; end: number; text: string }
export interface FinalizedCharacterContext extends ProjectEpoch {
  source: FinalizedSourceIdentity
  content: string
  projectionGeneration: number
  identityRevision: number
  identityStatus: 'bound' | 'legacy'
  sourceOrder: DerivedSourceOrder
  characters: Array<FinalizedCharacterReference & {
    aliases: string[]
    fields: CharacterFieldSnapshot[]
  }>
}
/** Render only: the original fields remain the CAS baseline. originProjectId must be main-verified transfer authority. */
export function finalizedCharacterPromptCards(context: FinalizedCharacterContext, originProjectId?: string) {
  return context.characters.map(character => ({ characterId: character.characterId, name: character.displayNameSnapshot, aliases: character.aliases,
    fields: character.fields.filter(field => {
      const previous = field.sourceOrder
      // chapterNumber identifies the chapter within the verified project lineage; draft IDs identify versions, not chapters.
      const superseded = field.field === 'recentEvents' && field.characterId === character.characterId && field.provenance.kind === 'derived'
        && typeof field.provenance.source?.finalizationId === 'string' && isFinalizedSourceIdentity(field.provenance.source)
        && field.provenance.source.chapterNumber === context.source.chapterNumber
        && field.provenance.source.finalizationId !== context.source.finalizationId
        && previous && previous.authoritativeFinalizationRevision < context.sourceOrder.authoritativeFinalizationRevision
        && decideDerivedPatch(field, { ...field, projectId: context.projectId, epoch: context.epoch,
          baseFieldRevision: field.revision, baseValueHash: field.valueHash, baseProvenance: field.provenance,
          source: context.source, sourceOrder: context.sourceOrder }, { source: context.source, order: context.sourceOrder, originProjectId }) === 'apply-derived'
      return !superseded
    }).map(field => ({ field: field.field, value: field.value, provenance: field.provenance })) }))
}
export type FinalizedCharacterStateValues = Partial<Record<CharacterStateTextField, string>>
export interface FinalizedCharacterStateUpdate {
  characterId: string
  currentState: FinalizedCharacterStateValues
  evidence: FinalizedCharacterEvidence
}
/** A model occurrence requiring an explicit identity decision, never an automatic merge. */
export interface FinalizedCharacterStateOccurrence {
  selectionKey: string
  displayName: string
  originalText: string
  candidateIds: string[]
  currentState: FinalizedCharacterStateValues
  evidence: FinalizedCharacterEvidence
  rawValue: unknown
  reason: 'name-only' | 'unknown-id' | 'ambiguous' | 'legacy'
}
export interface FinalizedCharacterStateResponse {
  updates: FinalizedCharacterStateUpdate[]
  unresolved: FinalizedCharacterStateOccurrence[]
}
export interface FinalizedCharacterStateCommitReceipt {
  applied: number
  unchanged: number
  candidates: FinalizedCharacterStateCandidate[]
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
/** Main re-parses the settled artifact with its own frozen context before domain commit. */
/**
 * 校验并定位一条引文，返回带精确偏移的 evidence。
 *
 * 状态六槽与卡片增量**共用这一份** —— 两处如果各写一套，「引文必须唯一」的语义
 * 迟早会分叉，而分叉之后错的那一边不会报错，只会让 probe 悄悄变松。
 *
 * 错误码按失败原因分开，是为了让 repair 轮能指名缺什么，而不是只给一个空出口。
 */
export function resolveCharacterEvidence(evidence: unknown, content: string): FinalizedCharacterEvidence {
  if (!record(evidence)) throw new Error('FINALIZED_CHARACTER_EVIDENCE_MISSING')
  let start = evidence.start
  let end = evidence.end
  if (!Object.hasOwn(evidence, 'start') && !Object.hasOwn(evidence, 'end')
    && typeof evidence.text === 'string' && evidence.text.length > 0) {
    const located = content.indexOf(evidence.text)
    if (located < 0 || content.indexOf(evidence.text, located + 1) !== -1) throw new Error('FINALIZED_CHARACTER_EVIDENCE_NOT_UNIQUE')
    start = located
    end = located + evidence.text.length
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (start as number) < 0
    || (end as number) <= (start as number) || (end as number) > content.length
    || typeof evidence.text !== 'string' || content.slice(start as number, end as number) !== evidence.text) {
    throw new Error('FINALIZED_CHARACTER_EVIDENCE_INVALID')
  }
  return { start: start as number, end: end as number, text: evidence.text }
}

export function parseFinalizedCharacterStateResponse(content: string, context: FinalizedCharacterContext): FinalizedCharacterStateResponse {
  const text = content.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
  const parsed: unknown = JSON.parse(text)
  if (!record(parsed) || !Array.isArray(parsed.updates) || parsed.updates.length > 1_000) throw new Error('FINALIZED_CHARACTER_UPDATES_INVALID')
  const result: FinalizedCharacterStateResponse = { updates: [], unresolved: [] }
  const seen = new Set<string>()
  for (const [index, input] of parsed.updates.entries()) {
    if (!record(input) || !record(input.currentState)) throw new Error('FINALIZED_CHARACTER_UPDATE_INVALID')
    // A distinct code lets the repair turn name the missing field instead of offering only the empty exit.
    const exactEvidence = resolveCharacterEvidence(input.evidence, context.content)
    const currentState: FinalizedCharacterStateValues = {}
    for (const field of CHARACTER_STATE_TEXT_FIELDS) {
      if (!Object.hasOwn(input.currentState, field)) continue
      if (typeof input.currentState[field] !== 'string') throw new Error('FINALIZED_CHARACTER_FIELD_INVALID')
      currentState[field] = input.currentState[field]
    }
    if (!Object.keys(currentState).length || Object.hasOwn(input.currentState, 'updatedAtChapter') && input.currentState.updatedAtChapter !== context.source.chapterNumber) {
      throw new Error('FINALIZED_CHARACTER_FIELD_INVALID')
    }
    const characterId = typeof input.characterId === 'string' ? input.characterId : ''
    const originalText = typeof input.name === 'string' ? input.name : ''
    const character = context.identityStatus === 'bound' ? context.characters.find(item => item.characterId === characterId) : undefined
    // Even an explicit model ID cannot disambiguate two source characters with
    // the same frozen display label. Preserve the occurrence for author approval.
    const sharedLabel = character && context.characters.filter(item => item.displayNameSnapshot === character.displayNameSnapshot).length > 1
    if (!character || sharedLabel) {
      if (!originalText.trim() && !characterId) throw new Error('FINALIZED_CHARACTER_IDENTITY_REQUIRED')
      result.unresolved.push({ selectionKey: `update:${index}`, displayName: originalText.trim() ? originalText : character?.displayNameSnapshot ?? originalText, originalText,
        candidateIds: context.characters.filter(item => item.characterId === characterId || sharedLabel && item.displayNameSnapshot === character?.displayNameSnapshot
          || item.displayNameSnapshot === originalText || item.aliases.includes(originalText)).map(item => item.characterId),
        currentState, evidence: exactEvidence, rawValue: structuredClone(input),
        reason: context.identityStatus === 'legacy' ? 'legacy' : sharedLabel ? 'ambiguous' : characterId ? 'unknown-id' : 'name-only' })
      continue
    }
    if (seen.has(characterId)) throw new Error('FINALIZED_CHARACTER_DUPLICATE_ID')
    seen.add(characterId)
    result.updates.push({ characterId, currentState, evidence: exactEvidence })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* 角色卡增量（cardDeltas）                                             */
/* ------------------------------------------------------------------ */

/**
 * 章末产出的**一条**卡片增量。三种 kind 互不重叠：
 * - `soft-spot` 软肋登记：他因为什么破了戒，而且那样东西以后还能被拿捏
 * - `chip` 筹码变更：add / replace / lose
 * - `hit` 顶撞记账：顶到或破了哪条禁区、代价多少（**不改卡面**）
 */
export interface FinalizedCharacterCardDelta {
  characterId: string
  kind: 'soft-spot' | 'chip' | 'hit'
  name?: string
  text?: string
  change?: 'add' | 'replace' | 'lose'
  replaces?: string
  /** `X1`…`X3`，规范化成大写。 */
  forbidden?: string
  cost?: string
  broken?: boolean
  evidence: FinalizedCharacterEvidence
  /** 落库时生成：同一份定稿重跑得到同一个 key，用于幂等回放。 */
  deltaKey?: string
}

export type CardDeltaDropReason =
  | 'unknown-character'
  | 'invalid-shape'
  | 'evidence-invalid'
  | 'cost-too-long'
  | 'soft-spot-cap'

/** 作者对一条卡片增量的决定。 */
export interface FinalizedCharacterCardDeltaDecisionRequest {
  draftId: number
  deltaKey: string
  operationId: string
  decision: 'accept' | 'decline'
}

export interface FinalizedCharacterCardDeltaDecisionReceipt {
  delta: FinalizedCharacterCardDelta
  /** 同一 operationId 重放时为 true（幂等）。 */
  idempotent: boolean
  /** accept 且写卡成功时的新卡面；decline 或（重复确认导致的）无变化时为 undefined。 */
  personality?: string
}

export interface PendingFinalizedCharacterCardDelta {
  draftId: number
  delta: FinalizedCharacterCardDelta
}

/** 面板一次取全：待确认的增量 + 只读的顶撞账本。 */
export interface FinalizedCharacterCardDeltaBoard {
  pending: PendingFinalizedCharacterCardDelta[]
  hits: PendingFinalizedCharacterCardDelta[]
}

export interface FinalizedCardDeltaParseResult {
  deltas: FinalizedCharacterCardDelta[]
  /** 显式丢弃的条目 —— 静默截断会让「模型提了」与「卡上有」变成两份真相。 */
  dropped: Array<{ index: number; reason: CardDeltaDropReason }>
}

/** `X1` / `x 1` / `X 01` → `X1`；其它形态返回 undefined。 */
export function normalizeForbiddenId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^[\t ]*[Xx][\t ]*(\d{1,2})[\t ]*$/u.exec(value)
  return match ? `X${Number(match[1])}` : undefined
}

/**
 * 解析 `cardDeltas`。**永不抛错**：它是可选增强，不该因为一条格式不对就让整章定稿失败。
 *
 * 与 `parseFinalizedCharacterStateResponse` 的三点区别，都是有意的：
 * 1. 不抛错，坏条目进 `dropped`（状态六槽错会触发 repair，卡片增量错只该被丢掉）；
 * 2. 只认冻结名单里的 `characterId`（列表里没有的人不算）；
 * 3. 不做语义判断（「这个筹码能不能被拿走」是 prompt 的事），只做结构与长度校验。
 *
 * ⚠️ `forbidden` 之外不校验编号存在性 —— 那需要读角色卡，属于落库层的职责。
 */
export function parseFinalizedCharacterCardDeltas(
  content: string,
  context: FinalizedCharacterContext,
  limits: { softSpots?: number; costLength?: number } = {},
): FinalizedCardDeltaParseResult {
  const result: FinalizedCardDeltaParseResult = { deltas: [], dropped: [] }
  const softSpotLimit = limits.softSpots ?? 5
  const costLimit = limits.costLength ?? 60

  let parsed: unknown
  try {
    const text = content.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
    parsed = JSON.parse(text)
  } catch {
    return result
  }
  if (!record(parsed) || !Array.isArray(parsed.cardDeltas)) return result

  const known = new Set(context.characters.map(character => character.characterId))
  const softSpotCount = new Map<string, number>()

  for (const [index, input] of parsed.cardDeltas.slice(0, 200).entries()) {
    const drop = (reason: CardDeltaDropReason): void => { result.dropped.push({ index, reason }) }
    if (!record(input)) { drop('invalid-shape'); continue }
    const characterId = typeof input.characterId === 'string' ? input.characterId : ''
    if (!known.has(characterId)) { drop('unknown-character'); continue }
    const kind = input.kind
    if (kind !== 'soft-spot' && kind !== 'chip' && kind !== 'hit') { drop('invalid-shape'); continue }

    let evidence: FinalizedCharacterEvidence
    try {
      evidence = resolveCharacterEvidence(input.evidence, context.content)
    } catch {
      drop('evidence-invalid')
      continue
    }

    if (kind === 'hit') {
      const forbidden = normalizeForbiddenId(input.forbidden)
      const cost = typeof input.cost === 'string' ? input.cost.trim() : ''
      if (!forbidden) { drop('invalid-shape'); continue }
      if (cost.length > costLimit) { drop('cost-too-long'); continue }
      result.deltas.push({ characterId, kind, forbidden, cost, broken: input.broken === true, evidence })
      continue
    }

    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const text = typeof input.text === 'string' ? input.text.trim() : ''
    if (!name) { drop('invalid-shape'); continue }

    if (kind === 'soft-spot') {
      const used = softSpotCount.get(characterId) ?? 0
      if (used >= softSpotLimit) { drop('soft-spot-cap'); continue }
      softSpotCount.set(characterId, used + 1)
      result.deltas.push({ characterId, kind, name, text, evidence })
      continue
    }

    const change: 'add' | 'replace' | 'lose' =
      input.change === 'replace' || input.change === 'lose' ? input.change : 'add'
    const replaces = typeof input.replaces === 'string' ? input.replaces.trim() : ''
    if (change === 'replace' && !replaces) { drop('invalid-shape'); continue }
    result.deltas.push({
      characterId, kind, name, text, change, evidence,
      ...(change === 'replace' ? { replaces } : {}),
    })
  }

  return result
}

export interface FinalizedContinuityProjection {
  draftId: number
  /** Current finalized prose to read when this derived locator is stale. */
  currentFinalizedDraftId?: number
  chapterNumber: number
  chapterTitle: string
  chapterNotes: string
  facts?: FinalizedContinuityFact[]
  /** Used only to locate the bound finalized prose, never rendered as a fact. */
  characterStateCandidates?: FinalizedCharacterStateCandidate[]
  /** 距开篇 t0 的天数（t0 = 0）。NULL / 缺省 = 未取到，**不等于 0**。 */
  storyDayOffset?: number | null
  /** 书中写法（如「二月廿七」），只用于展示与审稿比对。 */
  storyDayLabel?: string | null
  /** Missing only for pre-v2 rows whose source cannot be safely reconstructed. */
  source?: FinalizedSourceIdentity
  /** Missing legacy callers must be treated exactly like `legacy`, never current. */
  sourceStatus?: FinalizedProjectionStatus
}

export interface SaveFinalizedContinuityRequest {
  draftId: number
  chapterNumber: number
  chapterNotes: string
  facts?: FinalizedContinuityFact[]
  /**
   * 本章距 t0 的天数（t0 = 0）。缺省 / null = 未取到。
   *
   * 主进程不接受「倒退」的日序：本章值早于任一更早章的有值快照时直接拒绝保存，
   * 因为那意味着模型算错了一次，而错值会顺着下游继续漂（判据：显式失败优于静默错误）。
   */
  storyDayOffset?: number | null
  storyDayLabel?: string | null
  /** Watermark frozen before extraction; stale in-flight results must not advance it. */
  projectionGeneration: number
  /** Frozen before extraction; the main process revalidates it at commit time. */
  source: FinalizedSourceIdentity
}

export interface SaveFinalizedCharacterStateCandidatesRequest {
  draftId: number
  chapterNumber: number
  candidates: FinalizedCharacterStateCandidate[]
  /** Watermark frozen before extraction; stale in-flight results must not advance it. */
  projectionGeneration: number
  /** Frozen before extraction; the main process revalidates it at commit time. */
  source: FinalizedSourceIdentity
}
