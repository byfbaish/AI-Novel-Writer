import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import {
  CADENCE_TEXT_MAX,
  type CadenceAxis,
  type CadenceDeleteResult,
  type CadenceWriteResult,
  type InstitutionCadence,
  type InstitutionCadenceInput,
} from '../../src/shared/institution-cadence'

/**
 * P1-1 制度仓储（M15）。
 *
 * 与关键物品同一条降级纪律：
 * - **表不存在就降级成空结果**：M15 之前的库读路径返回 `[]`，不抛错；
 * - **重名就地拒绝**：`name` 在表上是 UNIQUE，但裸 SQLite 约束错误对用户不可读，
 *   所以先查一次给出 `CADENCE_NAME_DUPLICATED`；
 * - **删除是真删**：一条制度不是历史账本，没有「删了就丢历史」的问题。
 *
 * 数值列只有四类，口径各不相同，不能混：
 * - `interval` / `fallbackIntervalChapters`：**间隔**，必须 ≥ 1；
 * - `anchorChapter` / `chapterNumber`：**章号**，必须 ≥ 1（0 会被读成「序章」）；
 * - `anchorStoryDay`：**书中日序**，允许 0（第 0 日就是故事开始那天）。
 */

const SELECT_CADENCE = `cadence_id AS cadenceId, name, axis, interval,
  anchor_chapter AS anchorChapter, anchor_story_day AS anchorStoryDay,
  fallback_interval_chapters AS fallbackIntervalChapters, COALESCE(note,'') AS note,
  chapter_number AS chapterNumber, COALESCE(evidence,'') AS evidence, source,
  COALESCE(created_at,'') AS createdAt, COALESCE(updated_at,'') AS updatedAt`

const AXES: readonly CadenceAxis[] = ['chapter', 'story-day']

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M15 之前的库没有这张表 —— 全链路据此降级，不抛错。 */
export function hasInstitutionCadenceSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'institution_cadences')
}

function requireText(value: unknown, label: string, max = CADENCE_TEXT_MAX): string {
  if (typeof value !== 'string') throw new Error(`CADENCE_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`CADENCE_INVALID:${label}`)
  return normalized
}

function optionalText(value: unknown, max = CADENCE_TEXT_MAX): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized.length > max ? normalized.slice(0, max) : normalized
}

/** `null` / `undefined` ⇒ null（缺失）；否则必须是满足条件的整数，0 与负数一律拒。 */
function optionalInteger(value: unknown, label: string, minimum: number): number | null {
  if (value === undefined || value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`CADENCE_INVALID:${label}`)
  return value as number
}

function requireInteger(value: unknown, label: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`CADENCE_INVALID:${label}`)
  return value as number
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 按轴、名称排序：同一轴的制度挨在一起，作者扫表时不用来回跳。
 *
 * 中文本身的先后是 SQLite 的 BINARY（码点）序，不是拼音序 —— 这里只承诺「分组」，
 * 不承诺「甲乙丙」的读法顺序。
 */
export function listInstitutionCadences(db: BetterSqlite3.Database): InstitutionCadence[] {
  if (!hasInstitutionCadenceSchema(db)) return []
  return db.prepare(`SELECT ${SELECT_CADENCE} FROM institution_cadences ORDER BY axis, name`)
    .all() as InstitutionCadence[]
}

export function getInstitutionCadence(
  db: BetterSqlite3.Database,
  cadenceId: string,
): InstitutionCadence | undefined {
  if (!hasInstitutionCadenceSchema(db)) return undefined
  return db.prepare(`SELECT ${SELECT_CADENCE} FROM institution_cadences WHERE cadence_id=?`)
    .get(cadenceId) as InstitutionCadence | undefined
}

export function upsertInstitutionCadence(
  db: BetterSqlite3.Database,
  input: InstitutionCadenceInput,
): CadenceWriteResult {
  if (!hasInstitutionCadenceSchema(db)) return { success: false, error: 'CADENCE_SCHEMA_MISSING' }
  try {
    const name = requireText(input?.name, 'name')
    const axis = input?.axis
    if (!AXES.includes(axis)) return { success: false, error: 'CADENCE_INVALID:axis' }
    const interval = requireInteger(input?.interval, 'interval', 1)
    const anchorChapter = optionalInteger(input?.anchorChapter, 'anchorChapter', 1)
    // 日序允许 0：故事开始那天就是第 0 日，它和「没登记」是两件事。
    const anchorStoryDay = optionalInteger(input?.anchorStoryDay, 'anchorStoryDay', 0)
    const fallbackIntervalChapters = optionalInteger(
      input?.fallbackIntervalChapters, 'fallbackIntervalChapters', 1)
    const note = optionalText(input?.note)
    const chapterNumber = optionalInteger(input?.chapterNumber, 'chapterNumber', 1)
    const evidence = optionalText(input?.evidence)

    const cadenceId = typeof input?.cadenceId === 'string' && input.cadenceId.trim()
      ? input.cadenceId.trim()
      : `cadence:${randomUUID()}`
    // 重名必须就地拒绝，而不是让 UNIQUE 约束抛出裸 SQLite 错误。
    const owner = db.prepare('SELECT cadence_id AS cadenceId FROM institution_cadences WHERE name=?')
      .get(name) as { cadenceId: string } | undefined
    if (owner && owner.cadenceId !== cadenceId) return { success: false, error: 'CADENCE_NAME_DUPLICATED' }

    const timestamp = nowIso()
    db.prepare(`INSERT INTO institution_cadences
      (cadence_id,name,axis,interval,anchor_chapter,anchor_story_day,fallback_interval_chapters,
       note,chapter_number,evidence,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(cadence_id) DO UPDATE SET
        name=excluded.name, axis=excluded.axis, interval=excluded.interval,
        anchor_chapter=excluded.anchor_chapter, anchor_story_day=excluded.anchor_story_day,
        fallback_interval_chapters=excluded.fallback_interval_chapters, note=excluded.note,
        chapter_number=excluded.chapter_number, evidence=excluded.evidence,
        updated_at=excluded.updated_at`).run(
      cadenceId, name, axis, interval, anchorChapter, anchorStoryDay, fallbackIntervalChapters,
      note || null, chapterNumber, evidence || null, 'author', timestamp, timestamp,
    )
    return { success: true, cadenceId }
  } catch (error) {
    return { success: false, error: String(error instanceof Error ? error.message : error) }
  }
}

export function deleteInstitutionCadence(db: BetterSqlite3.Database, cadenceId: string): CadenceDeleteResult {
  if (!hasInstitutionCadenceSchema(db)) return { success: false, error: 'CADENCE_SCHEMA_MISSING' }
  if (typeof cadenceId !== 'string' || !cadenceId.trim()) return { success: false, error: 'CADENCE_INVALID:cadenceId' }
  const removed = db.prepare('DELETE FROM institution_cadences WHERE cadence_id=?').run(cadenceId.trim()).changes
  return removed === 0 ? { success: false, error: 'CADENCE_NOT_FOUND' } : { success: true }
}
