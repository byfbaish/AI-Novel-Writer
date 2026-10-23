import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M15 建「制度（周期事件）」表（P1-1 连续性宿体第二格，2026-10-23）。
 *
 * ## 一条记录 = 一个周期事件
 *
 * 月例、七日一次的送账、每晚的巡夜 —— 作者关心的是「这一章该不该发生」，不是「发生了多少」。
 * 所以这里**没有数量、没有余额、没有变动表**（那是资源账本 `resources` 的事），只有
 * 「叫法 + 轴 + 间隔 + 上次发生的锚」。判据见 `src/shared/institution-cadence.ts`。
 *
 * ## 锚是「上次真的发生」，不是起算点
 *
 * `anchor_chapter` / `anchor_story_day` 记的是**上一次真的发生**的那一点。用起算点做模运算
 * （`(当前 - t0) % interval`）会在一轮漏写之后永久错位，而「上次发生」只错一轮。
 *
 * ## 三个可空但**语义不同**的列
 *
 * - `anchor_chapter` / `anchor_story_day`：空 = 作者没登记过上次发生 ⇒ 判定为 `unknown`，
 *   **绝不折成 `not_due`**（空 ≠ 0，也 ≠「还没到」）；
 * - `fallback_interval_chapters`：空 = 作者没有给出按章降级轴 ⇒ 写前日序判定就是 `unknown`，
 *   这是设计（登记页会提示「要写前就能判，请填按章降级」）；
 * - `chapter_number`：这条制度**写在哪一章**，与 `anchor_chapter`（上次发生在哪章）不是一回事；
 * - `note` / `evidence`：作者备注与逐字引文，都不进提示词（本节预算 480 字）。
 *
 * `axis` 与 `interval` 带 CHECK：轴只有两个值，间隔必须为正 —— 这两条错了，判定表没有意义。
 * 其余数值列允许为空但**不允许 0**（0 会被读成「序章」或「每 0 章」）。
 *
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane。
 */
export const M15_INSTITUTION_CADENCES_SQL = [
  `CREATE TABLE institution_cadences (
      cadence_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      axis TEXT NOT NULL CHECK(axis IN ('chapter','story-day')),
      interval INTEGER NOT NULL CHECK(interval > 0),
      anchor_chapter INTEGER CHECK(anchor_chapter IS NULL OR anchor_chapter > 0),
      anchor_story_day INTEGER CHECK(anchor_story_day IS NULL OR anchor_story_day >= 0),
      fallback_interval_chapters INTEGER CHECK(fallback_interval_chapters IS NULL OR fallback_interval_chapters > 0),
      note TEXT,
      chapter_number INTEGER CHECK(chapter_number IS NULL OR chapter_number > 0),
      evidence TEXT,
      source TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`,
  'CREATE INDEX idx_institution_cadences_axis ON institution_cadences(axis)',
] as const

const AXIS_INDEX = 'idx_institution_cadences_axis'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type=? AND name=?").get(type, name))
}

/** 幂等：表与索引各自判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM15InstitutionCadences(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', 'institution_cadences')) db.exec(M15_INSTITUTION_CADENCES_SQL[0])
  if (!hasSchemaObject(db, 'index', AXIS_INDEX)) db.exec(M15_INSTITUTION_CADENCES_SQL[1])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null }
type IndexInfo = { name: string; unique: number }

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

function hasUniqueIndexOn(db: Database.Database, table: string, column: string): boolean {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as IndexInfo[]
  return indexes.some(index => {
    if (!index.unique) return false
    const columns = db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>
    return columns.length === 1 && columns[0]?.name === column
  })
}

/** CHECK 是形状的一部分（轴只有两值、间隔为正）：读 sqlite_master 的 DDL 断言，不写库。 */
function hasExpectedChecks(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  const sql = (row?.sql ?? '').replace(/\s+/gu, ' ')
  return sql.includes("CHECK(axis IN ('chapter','story-day'))")
    && sql.includes('CHECK(interval > 0)')
    && sql.includes('CHECK(anchor_chapter IS NULL OR anchor_chapter > 0)')
    && sql.includes('CHECK(anchor_story_day IS NULL OR anchor_story_day >= 0)')
    && sql.includes('CHECK(fallback_interval_chapters IS NULL OR fallback_interval_chapters > 0)')
    && sql.includes('CHECK(chapter_number IS NULL OR chapter_number > 0)')
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM15InstitutionCadences(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', 'institution_cadences')) return false
    if (!hasUniqueIndexOn(db, 'institution_cadences', 'name')) return false
    if (!hasExpectedChecks(db, 'institution_cadences')) return false

    const columns = columnsOf(db, 'institution_cadences')
    const required = ['cadence_id', 'name', 'axis', 'interval', 'anchor_chapter', 'anchor_story_day',
      'fallback_interval_chapters', 'note', 'chapter_number', 'evidence', 'source', 'created_at', 'updated_at']
    if (!required.every(name => columns.some(column => column.name === name))) return false
    // 八处「空值有意义」的列必须**可空**：空 ≠ 0 / 空 ≠ 空串。
    for (const optional of ['anchor_chapter', 'anchor_story_day', 'fallback_interval_chapters',
      'note', 'chapter_number', 'evidence', 'created_at', 'updated_at']) {
      if (columns.find(column => column.name === optional)?.notnull !== 0) return false
    }
    for (const filled of ['name', 'axis', 'interval', 'source']) {
      if (columns.find(column => column.name === filled)?.notnull !== 1) return false
    }

    return hasSchemaObject(db, 'index', AXIS_INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM15Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M15', from: 15, to: 16, owner: 'P1-1',
    migrate: reader => applyM15InstitutionCadences(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM15InstitutionCadences(deps.database(reader)) }
}
