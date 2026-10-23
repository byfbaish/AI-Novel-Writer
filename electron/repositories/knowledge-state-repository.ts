import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import {
  KNOWLEDGE_EVIDENCE_MAX,
  KNOWLEDGE_TEXT_MAX,
  knowledgeFactEvidenceHash,
  knowledgeFactKey,
  type KnowledgeDeleteResult,
  type KnowledgeFactCandidate,
  type KnowledgeRefState,
  type KnowledgeStateDefinition,
  type KnowledgeStateInput,
  type KnowledgeWriteResult,
} from '../../src/shared/knowledge-state'
import { SummaryRepository } from './summary-repository'

/**
 * P1-1 信息流仓储（M16：谁知道什么）。
 *
 * 与关键物品、制度同一条降级纪律：
 * - **表不存在就降级成空结果**：M16 之前的库读路径返回 `[]`，不抛错；
 * - **同角色同 key 就地拒绝**：`UNIQUE(character_id, fact_key)` 的裸约束错误对用户不可读，
 *   所以先查一次给 `KNOWLEDGE_DUPLICATED`；
 * - **删除是真删**：一条知情关系不是历史账本，删了不需要留痕。
 *
 * ## 显示名读时 JOIN，不落表
 *
 * `characters.name` 在 M02 之后不再唯一（同名不同人、改名、别名都真实存在），所以表里只存
 * `character_id`，显示名 JOIN 出来。角色被删掉时名字为空串 —— 这比「存一份旧名字」诚实：
 * 存快照会让作者以为那条登记还指着一个活人。
 *
 * ## `refState` 在主进程算，且复用唯一那条「读定稿连续性投影」的路径
 *
 * 判定要问的问题是「这条登记指向的事实在**该章的当前定稿**里还在不在」。这件事只有
 * `SummaryRepository.listFinalizedContinuityBefore` 能回答（`summary_snapshots.continuity_facts`
 * 是 JSON 列、无主键、无 supersede 语义，另写一份 SQL 就会长出第二套判断）。
 * 所以这里**一次取出到最大事实章为止的全部投影**，再按 `fact_chapter` 分组成 key 集合。
 *
 * 三态：
 * - 找不到该章的投影 / 投影不是 `current` ⇒ `unverifiable`（读不到，不能断定）；
 * - 有 current 投影且 key 在其中 ⇒ `valid`；
 * - 有 current 投影但 key 不在 ⇒ `stale`（该章索引在，这条事实已不在）。
 *
 * **不自动改键、不自动删行、不自动迁到新事实**：那等于替作者认定「新的就是旧的那条」。
 *
 * ## 为什么这些函数是 async
 *
 * 引用键必须用 `crypto.subtle`（共享层严禁 `node:crypto`，渲染层会直接炸），而它是异步的。
 * 键的算法只有共享层一份 —— 仓储与面板都 await 同一个函数，绝不各写一份日志口径。
 */

const SELECT_STATE = `knowledge_states.knowledge_id AS knowledgeId,
  knowledge_states.character_id AS characterId,
  COALESCE(characters.name, '') AS characterName,
  knowledge_states.fact_chapter AS factChapter,
  knowledge_states.fact_evidence AS factEvidence,
  knowledge_states.fact_evidence_hash AS factEvidenceHash,
  knowledge_states.fact_key AS factKey,
  knowledge_states.learned_chapter AS learnedChapter,
  COALESCE(knowledge_states.evidence, '') AS evidence,
  knowledge_states.source AS source,
  COALESCE(knowledge_states.created_at, '') AS createdAt,
  COALESCE(knowledge_states.updated_at, '') AS updatedAt`

type StoredState = Omit<KnowledgeStateDefinition, 'refState'>

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M16 之前的库没有这张表 —— 全链路据此降级，不抛错。 */
export function hasKnowledgeSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'knowledge_states')
}

function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`KNOWLEDGE_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`KNOWLEDGE_INVALID:${label}`)
  return normalized
}

function optionalText(value: unknown, max = KNOWLEDGE_TEXT_MAX): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized.length > max ? normalized.slice(0, max) : normalized
}

function requireInteger(value: unknown, label: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`KNOWLEDGE_INVALID:${label}`)
  return value as number
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 每章「当前定稿里有哪几条事实」的 key 集合。`null` = 没有可用的 current 投影。
 *
 * 只取一次投影（上界 = 需要的最大章 + 1），避免逐行查库；同一章的多条登记共用一份答案。
 */
async function currentFactKeysByChapter(
  db: BetterSqlite3.Database,
  chapters: readonly number[],
): Promise<Map<number, Set<string> | null>> {
  const wanted = [...new Set(chapters.filter(chapter => Number.isSafeInteger(chapter) && chapter > 0))]
  const result = new Map<number, Set<string> | null>()
  if (wanted.length === 0) return result
  const upperBound = Math.max(...wanted)
  const projections = SummaryRepository.listFinalizedContinuityBefore(upperBound + 1, db)
  const byChapter = new Map(projections.map(projection => [projection.chapterNumber, projection]))
  for (const chapter of wanted) {
    const projection = byChapter.get(chapter)
    // 缺失 / stale / legacy 一律 unverifiable：读不到就不能断定「这条事实还在/不在了」。
    if (!projection || projection.sourceStatus !== 'current') {
      result.set(chapter, null)
      continue
    }
    const keys = new Set<string>()
    for (const fact of projection.facts ?? []) {
      if (!fact.evidence?.trim()) continue
      keys.add(await knowledgeFactKey(chapter, fact.evidence))
    }
    result.set(chapter, keys)
  }
  return result
}

function toRefState(keys: Set<string> | null, factKey: string): KnowledgeRefState {
  if (keys === null) return 'unverifiable'
  return keys.has(factKey) ? 'valid' : 'stale'
}

/**
 * 列出全部知情关系（含显示名与 `refState`）。
 *
 * 排序是**稳定底座**：从哪个角色、哪一章得知（新章在前），再按事实章。提示词里的
 * 「本章出场角色优先」是渲染层的排序，不在这里做 —— 仓储不知道本章谁出场。
 */
export async function listKnowledgeStates(db: BetterSqlite3.Database): Promise<KnowledgeStateDefinition[]> {
  if (!hasKnowledgeSchema(db)) return []
  const rows = db.prepare(`SELECT ${SELECT_STATE}
    FROM knowledge_states
    LEFT JOIN characters ON characters.character_id = knowledge_states.character_id
    ORDER BY knowledge_states.learned_chapter DESC, characterName,
      knowledge_states.fact_chapter, knowledge_states.knowledge_id`).all() as StoredState[]
  if (rows.length === 0) return []
  const keys = await currentFactKeysByChapter(db, rows.map(row => row.factChapter))
  return rows.map(row => ({ ...row, refState: toRefState(keys.get(row.factChapter) ?? null, row.factKey) }))
}

/**
 * 写入（新建或改已有行）。
 *
 * `factKey` / `factEvidenceHash` **由这里从章号 + 引文重算**，不接受入参 —— 否则调用方
 * 可以自己挑一条别的事实挂上去。
 *
 * 「同角色同 key 就地拒绝」：同一个人对同一件事只该有一个「从第几章起知道」。改已有行时，
 * 若改了引文导致 key 变化、且新 key 已属于另一个 `knowledge_id`，同样拒绝（否则会悄悄合并
 * 两条登记，丢掉其中一条的出处）。
 */
export async function upsertKnowledgeState(
  db: BetterSqlite3.Database,
  input: KnowledgeStateInput,
): Promise<KnowledgeWriteResult> {
  if (!hasKnowledgeSchema(db)) return { success: false, error: 'KNOWLEDGE_SCHEMA_MISSING' }
  try {
    const characterId = requireText(input?.characterId, 'characterId', KNOWLEDGE_TEXT_MAX)
    const factChapter = requireInteger(input?.factChapter, 'factChapter', 1)
    const factEvidence = requireText(input?.factEvidence, 'factEvidence', KNOWLEDGE_EVIDENCE_MAX)
    const learnedChapter = requireInteger(input?.learnedChapter, 'learnedChapter', 1)
    // 「先于事实存在就知道」在写入时就拦住：表上的 CHECK 是最后一道闸，这里先给可读原因。
    if (learnedChapter < factChapter) return { success: false, error: 'KNOWLEDGE_INVALID:learnedChapter' }
    const evidence = optionalText(input?.evidence)
    const factKey = await knowledgeFactKey(factChapter, factEvidence)
    const factEvidenceHash = await knowledgeFactEvidenceHash(factEvidence)

    const character = db.prepare('SELECT character_id AS characterId FROM characters WHERE character_id=?')
      .get(characterId) as { characterId: string } | undefined
    // 外键失败只会抛出裸 SQLite 错误；显式判定让面板能说清「这个角色不在了」。
    if (!character) return { success: false, error: 'KNOWLEDGE_CHARACTER_NOT_FOUND' }

    const knowledgeId = typeof input?.knowledgeId === 'string' && input.knowledgeId.trim()
      ? input.knowledgeId.trim()
      : `knowledge:${randomUUID()}`
    const owner = db.prepare('SELECT knowledge_id AS knowledgeId FROM knowledge_states WHERE character_id=? AND fact_key=?')
      .get(characterId, factKey) as { knowledgeId: string } | undefined
    if (owner && owner.knowledgeId !== knowledgeId) return { success: false, error: 'KNOWLEDGE_DUPLICATED' }

    const timestamp = nowIso()
    db.prepare(`INSERT INTO knowledge_states
      (knowledge_id,character_id,fact_chapter,fact_evidence,fact_evidence_hash,fact_key,
       learned_chapter,evidence,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(knowledge_id) DO UPDATE SET
        character_id=excluded.character_id, fact_chapter=excluded.fact_chapter,
        fact_evidence=excluded.fact_evidence, fact_evidence_hash=excluded.fact_evidence_hash,
        fact_key=excluded.fact_key, learned_chapter=excluded.learned_chapter,
        evidence=excluded.evidence, updated_at=excluded.updated_at`).run(
      knowledgeId, characterId, factChapter, factEvidence, factEvidenceHash, factKey,
      learnedChapter, evidence || null, 'author', timestamp, timestamp,
    )
    return { success: true, knowledgeId }
  } catch (error) {
    return { success: false, error: String(error instanceof Error ? error.message : error) }
  }
}

export function deleteKnowledgeState(db: BetterSqlite3.Database, knowledgeId: string): KnowledgeDeleteResult {
  if (!hasKnowledgeSchema(db)) return { success: false, error: 'KNOWLEDGE_SCHEMA_MISSING' }
  if (typeof knowledgeId !== 'string' || !knowledgeId.trim()) return { success: false, error: 'KNOWLEDGE_INVALID:knowledgeId' }
  const removed = db.prepare('DELETE FROM knowledge_states WHERE knowledge_id=?').run(knowledgeId.trim()).changes
  return removed === 0 ? { success: false, error: 'KNOWLEDGE_NOT_FOUND' } : { success: true }
}

/**
 * 面板「选事实」的候选：**已定稿且投影为 current** 的各章连续性索引。
 *
 * 只读、不写库。只有 `current` 投影的 facts 才配当引用目标 —— `stale` / `legacy` 的索引
 * 已经对不上正文，拿它当候选等于让作者登记一条查不到出处的引用。
 *
 * 没有引文的 fact 跳过：引用键的第二个量就是引文，没有引文就没有键。
 */
export async function listFactCandidates(db: BetterSqlite3.Database): Promise<KnowledgeFactCandidate[]> {
  const maxChapter = db.prepare("SELECT MAX(chapter_number) AS chapterNumber FROM drafts WHERE status='finalized'")
    .get() as { chapterNumber: number | null } | undefined
  const upperBound = maxChapter?.chapterNumber
  if (!upperBound || upperBound < 1) return []
  const projections = SummaryRepository.listFinalizedContinuityBefore(upperBound + 1, db)
  const candidates: KnowledgeFactCandidate[] = []
  for (const projection of projections) {
    if (projection.sourceStatus !== 'current') continue
    for (const fact of projection.facts ?? []) {
      if (!fact.evidence?.trim()) continue
      candidates.push({
        chapterNumber: projection.chapterNumber,
        factKey: await knowledgeFactKey(projection.chapterNumber, fact.evidence),
        factEvidence: fact.evidence,
        statement: fact.statement,
        category: fact.category,
      })
    }
  }
  // 新章在前：作者登记时多半在对照最近几章的揭示。
  return candidates.sort((left, right) => right.chapterNumber - left.chapterNumber
    || (left.factEvidence < right.factEvidence ? -1 : left.factEvidence > right.factEvidence ? 1 : 0))
}
