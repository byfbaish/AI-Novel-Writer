/**
 * W5 世界状态读取服务（纯只读）
 *
 * 设计约束（见 docs/design/architecture/world-state-review-and-wiring-plan.md §17–§18）：
 * - 只读：本文件只有查询，没有任何写语句，也不做隐式迁移。
 * - NULL 就是 NULL：story_day_offset 未知时保持 null，不填 0；六个状态槽全空时不伪造 currentState。
 * - 「归位表」只对账**模型已经点名过**的名字（审稿差分 / 定稿候选 / 蓝图计划角色），不从正文抽名字。
 * - 每个来源读不出来都要显式计数；失败不折成空数组、不静默吞掉。
 */
import type Database from 'better-sqlite3'
import {
  buildCastLedger,
  type CastLedgerAnchor,
  type CastLedgerCharacter,
  type CastLedgerMention,
} from '../../src/shared/cast-ledger'
import { CHARACTER_STATE_TEXT_FIELDS, type CharacterStateTextField } from '../../src/shared/character-roster'
import type { FinalizedSourceIdentity } from '../../src/shared/finalized-continuity'
import { emptyWorldStateView, WORLD_STATE_NOTES, type CastLedgerView,
  type WorldStateChapter, type WorldStateCharacter, type WorldStateFieldProvenance,
  type WorldStateNote, type WorldStateObservation, type WorldStateView } from '../../src/shared/world-state-view'
import { isFinalizedSourceIdentity } from '../../src/shared/source-ref'
import { CharacterCastDecisionRepository, hasCharacterCastDecisionSchema } from '../repositories/character-cast-decision-repository'
import { listCurrentReviewStateDeltaMentions } from '../repositories/review-cycle-repository'
import { SummaryRepository } from '../repositories/summary-repository'

type StateSlots = Record<CharacterStateTextField, string>

interface CharacterStateRow {
  characterId: string
  name: string | null
  revision: number | null
  retired: number
  location: string | null
  powerLevel: string | null
  physicalState: string | null
  mentalState: string | null
  keyItems: string | null
  recentEvents: string | null
  updatedAtChapter: number | null
  provenance: string | null
}

const recordValue = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
)

const safeInteger = (value: unknown, minimum = 0): number | null => (
  Number.isSafeInteger(value) && Number(value) >= minimum ? Number(value) : null
)

const stateSlots = (row: CharacterStateRow): StateSlots => ({
  location: row.location ?? '',
  powerLevel: row.powerLevel ?? '',
  physicalState: row.physicalState ?? '',
  mentalState: row.mentalState ?? '',
  keyItems: row.keyItems ?? '',
  recentEvents: row.recentEvents ?? '',
})

const provenanceSource = (value: unknown): FinalizedSourceIdentity | null => {
  const record = recordValue(value)
  if (!record) return null
  if (typeof record.draftId !== 'number' || typeof record.finalizationId !== 'string'
    || typeof record.chapterNumber !== 'number' || typeof record.contentHash !== 'string') return null
  const identity = record as unknown as FinalizedSourceIdentity
  return isFinalizedSourceIdentity(identity) ? identity : null
}

/** 解析 characters.cs_provenance：只认 author / derived / legacy 三种明确形状，其余槽位视为未记录。 */
function parseProvenance(raw: unknown): Partial<Record<CharacterStateTextField, WorldStateFieldProvenance>> {
  const provenance: Partial<Record<CharacterStateTextField, WorldStateFieldProvenance>> = {}
  let parsed: unknown = {}
  try { parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : {} } catch { return provenance }
  const record = recordValue(parsed)
  if (!record) return provenance
  for (const field of CHARACTER_STATE_TEXT_FIELDS) {
    const entry = recordValue(record[field])
    if (!entry) continue
    if (entry.kind === 'author') {
      const chapterNumber = safeInteger(entry.chapterNumber)
      if (chapterNumber !== null) provenance[field] = { kind: 'author', chapterNumber }
      continue
    }
    if (entry.kind === 'legacy') { provenance[field] = { kind: 'legacy' }; continue }
    if (entry.kind === 'derived') {
      const source = provenanceSource(entry.source)
      if (source) provenance[field] = { kind: 'derived', chapterNumber: source.chapterNumber }
    }
  }
  return provenance
}

const countStatuses = (entries: readonly { status: keyof CastLedgerView['counts'] }[]): CastLedgerView['counts'] => {
  const counts: CastLedgerView['counts'] = { orphan: 0, ambiguous: 0, anchored: 0, carded: 0 }
  for (const entry of entries) counts[entry.status] += 1
  return counts
}

/**
 * 解析 summary_snapshots.character_state_candidates（TEXT，JSON 数组或 {version:2,pending:[]}）。
 * 返回 null 表示这一行**读不出来**（坏 JSON / 形状不认识），由调用方计数；返回 [] 表示合法但没有候选。
 */
function parseCandidateMentions(raw: unknown): string[] | null {
  if (typeof raw !== 'string') return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  const pending = Array.isArray(parsed) ? parsed : (() => {
    const record = recordValue(parsed)
    return record && Array.isArray(record.pending) ? record.pending : null
  })()
  if (!pending) return null
  const names: string[] = []
  for (const item of pending) {
    const record = recordValue(item)
    if (!record || typeof record.characterName !== 'string') continue
    const name = record.characterName.trim()
    if (name) names.push(name)
  }
  return names
}

/** 解析 blueprints.characters（TEXT，JSON 名字数组）；返回 null 表示读不出来。 */
function parseBlueprintMentions(raw: unknown): string[] | null {
  if (typeof raw !== 'string') return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!Array.isArray(parsed)) return null
  return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
}

function readCharacters(db: Database.Database): { rows: CharacterStateRow[]; aliases: Map<string, string[]> } {
  const rows = db.prepare(`SELECT character_id AS characterId, name,
    identity_revision AS revision, retired,
    cs_location AS location, cs_power_level AS powerLevel, cs_physical_state AS physicalState,
    cs_mental_state AS mentalState, cs_key_items AS keyItems, cs_recent_events AS recentEvents,
    cs_updated_at_chapter AS updatedAtChapter, cs_provenance AS provenance
    FROM characters ORDER BY name`).all() as CharacterStateRow[]
  const aliases = new Map<string, string[]>()
  try {
    const aliasRows = db.prepare('SELECT character_id AS characterId, name FROM character_aliases').all() as Array<{
      characterId: string; name: string | null }>
    for (const alias of aliasRows) {
      const name = typeof alias.name === 'string' ? alias.name.trim() : ''
      if (!alias.characterId || !name) continue
      const list = aliases.get(alias.characterId) ?? []
      if (!list.includes(name)) list.push(name)
      aliases.set(alias.characterId, list)
    }
  } catch {
    // M02 之前的库没有 character_aliases：显示名仍然可用，别名缺口由归位表状态暴露，不在这里猜。
  }
  return { rows, aliases }
}

/**
 * 读取 W5 世界状态视图。纯只读，不打开/切换数据库，不抛业务错误。
 * @param db 已迁移到当前版本的项目库；调用方负责项目上下文校验。
 * @param projectPath 当前项目根目录；无项目时传 null，得到空视图。
 */
export function readWorldState(db: Database.Database, projectPath: string | null): WorldStateView {
  const notes: WorldStateNote[] = []
  const { rows, aliases } = readCharacters(db)

  const characters: WorldStateCharacter[] = []
  const castCharacters: CastLedgerCharacter[] = []
  for (const row of rows) {
    if (!row.characterId) continue
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const retired = row.retired === 1
    if (name) {
      castCharacters.push({
        characterId: row.characterId,
        name,
        aliases: aliases.get(row.characterId) ?? [],
        retired,
      })
    }
    if (retired || !name) continue
    const slots = stateSlots(row)
    const updatedAtChapter = safeInteger(row.updatedAtChapter)
    const hasState = updatedAtChapter !== null
      && CHARACTER_STATE_TEXT_FIELDS.some(field => slots[field].length > 0)
    characters.push({
      characterId: row.characterId,
      name,
      revision: safeInteger(row.revision) ?? 0,
      currentState: hasState
        ? { ...slots, updatedAtChapter }
        : null,
      provenance: parseProvenance(row.provenance),
    })
  }

  // 锚点：老库没有 character_cast_decisions 表 → 锚点按空处理，并在 notes 里明确告知。
  let anchors: CastLedgerAnchor[] = []
  if (hasCharacterCastDecisionSchema(db)) {
    anchors = CharacterCastDecisionRepository.current(db)
      .filter(decision => decision.action === 'register')
      .map(decision => ({ name: decision.name, anchorRole: decision.anchorRole }))
  } else {
    notes.push(WORLD_STATE_NOTES.castDecisionSchemaMissing)
  }

  // 来源 1：审稿报告 v3 stateDelta（逐章最新定稿稿，只采信同版审稿）。
  const reviewDelta = listCurrentReviewStateDeltaMentions(db)
  const mentions: CastLedgerMention[] = [...reviewDelta.mentions]

  // 来源 2：定稿后处理角色状态候选（summary_snapshots.character_state_candidates）。
  let finalizedUnreadable = 0
  const snapshots = db.prepare(`SELECT chapter_number AS chapterNumber,
    character_state_candidates AS candidates FROM summary_snapshots
    ORDER BY chapter_number ASC, id ASC`).all() as Array<{ chapterNumber: number; candidates: string | null }>
  for (const snapshot of snapshots) {
    const names = parseCandidateMentions(snapshot.candidates)
    if (names === null) { finalizedUnreadable += 1; continue }
    const chapterNumber = safeInteger(snapshot.chapterNumber)
    for (const name of names) {
      mentions.push({ name, source: 'finalized-proposal', ...(chapterNumber === null ? {} : { chapterNumber }) })
    }
  }

  // 来源 3：蓝图计划角色（blueprints.characters JSON 名字数组，正文没出现也算点名）。
  let blueprintUnreadable = 0
  const blueprints = db.prepare('SELECT chapter_number AS chapterNumber, characters AS characters FROM blueprints ORDER BY chapter_number ASC')
    .all() as Array<{ chapterNumber: number; characters: string | null }>
  for (const blueprint of blueprints) {
    const names = parseBlueprintMentions(blueprint.characters)
    if (names === null) { blueprintUnreadable += 1; continue }
    const chapterNumber = safeInteger(blueprint.chapterNumber)
    for (const name of names) {
      mentions.push({ name, source: 'blueprint', ...(chapterNumber === null ? {} : { chapterNumber }) })
    }
  }

  const ledgerEntries = buildCastLedger(castCharacters, anchors, mentions)

  // 章节轴：直接复用定稿连续性投影（chapter_notes 非空的最新定稿快照，一章一行）。
  // 传 Number.MAX_SAFE_INTEGER 而不是 Infinity —— 仓库对入参做 safe-integer 校验。
  const projections = SummaryRepository.listFinalizedContinuityBefore(Number.MAX_SAFE_INTEGER, db)
  const latestDraftStatus = db.prepare(`SELECT status FROM drafts WHERE chapter_number=?
    ORDER BY version DESC, id DESC LIMIT 1`)
  const chapters: WorldStateChapter[] = []
  const continuityFacts: WorldStateView['continuityFacts'] = []
  for (const projection of projections) {
    const observations: WorldStateObservation[] = (projection.characterStateCandidates ?? []).map(candidate => ({
      characterName: candidate.characterName,
      characterId: typeof candidate.characterId === 'string' && candidate.characterId ? candidate.characterId : null,
      field: candidate.field,
      value: candidate.value,
      evidence: typeof candidate.evidence?.text === 'string' ? candidate.evidence.text : null,
      reviewObserved: typeof candidate.reviewObserved === 'string' ? candidate.reviewObserved : null,
      reviewQuote: typeof candidate.reviewQuote === 'string' ? candidate.reviewQuote : null,
      reason: candidate.reason ?? null,
    }))
    const draftRow = latestDraftStatus.get(projection.chapterNumber) as { status?: unknown } | undefined
    chapters.push({
      chapterNumber: projection.chapterNumber,
      title: typeof projection.chapterTitle === 'string' && projection.chapterTitle ? projection.chapterTitle : null,
      // 投影里「没有这个键」= 日序未知，必须保持 null（0 是合法日序，不能用来顶替未知）。
      storyDayOffset: typeof projection.storyDayOffset === 'number' ? projection.storyDayOffset : null,
      storyDayLabel: typeof projection.storyDayLabel === 'string' && projection.storyDayLabel ? projection.storyDayLabel : null,
      draftStatus: typeof draftRow?.status === 'string' ? draftRow.status : null,
      observations,
    })
    for (const fact of projection.facts ?? []) {
      if (typeof fact.statement !== 'string') continue
      continuityFacts.push({ chapterNumber: fact.sourceChapter, text: fact.statement })
    }
  }

  return {
    ...emptyWorldStateView(projectPath),
    fetchedAt: new Date().toISOString(),
    castLedger: { entries: ledgerEntries, counts: countStatuses(ledgerEntries) },
    chapters,
    characters,
    continuityFacts,
    unreadableMentions: {
      review: reviewDelta.unreadableChapters.length,
      finalized: finalizedUnreadable,
      blueprint: blueprintUnreadable,
    },
    notes,
  }
}
