import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M30：建 `draft_edit_stats` —— 草稿编辑计量的事件流水（P35，2026-11-14）。
 *
 * ## 为什么必须是独立表
 *
 * 旧正文在被 `draft-update-content` 覆盖时就地写进 `contents.body`，没有历史版本；
 * 这次改动的「改了多少字」事后再也重建不出来。计量只能在保存时算、当场落盘。
 * 既有 `drafts` / `contents` 的列语义不为这条计量改变，所以另开一张只追加的表。
 *
 * ## 为什么一行一次保存，而不是一稿一行
 *
 * `origin` 必须能和每次改动绑定：同一条草稿可能先由 AI 修稿、再由作者手改。
 * 一稿一行只能留下最后一次来源，A2 的「AI 改动不能算成人工劳动」就无法成立。
 * 因此每次保存插一行，`save_count` 是该草稿到这次为止的序号（1、2、3…）。
 *
 * ## 为什么 `origin` 默认 `ai`
 *
 * `db:draft-update-content` 会被 AI 修稿复用；缺省宁可少记人工，也不能把 AI 的
 * 改动算成作者劳动。人工保存路径必须显式传 `human`。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以走新 lane。
 */
export const M30_DRAFT_EDIT_STATS_SQL = [
  `CREATE TABLE IF NOT EXISTS draft_edit_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id INTEGER NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    origin TEXT NOT NULL DEFAULT 'ai',
    changed_chars INTEGER NOT NULL DEFAULT 0,
    old_chars INTEGER NOT NULL DEFAULT 0,
    new_chars INTEGER NOT NULL DEFAULT 0,
    save_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_draft_edit_stats_draft
    ON draft_edit_stats (draft_id, id)`,
] as const

export const M30_DRAFT_EDIT_STATS_COLUMNS = [
  ['id', 'INTEGER', 0, null, 1],
  ['draft_id', 'INTEGER', 1, null, 0],
  ['at', 'TEXT', 1, "datetime('now')", 0],
  ['origin', 'TEXT', 1, "'ai'", 0],
  ['changed_chars', 'INTEGER', 1, '0', 0],
  ['old_chars', 'INTEGER', 1, '0', 0],
  ['new_chars', 'INTEGER', 1, '0', 0],
  ['save_count', 'INTEGER', 1, '0', 0],
] as const

const TABLE = 'draft_edit_stats'
const INDEX = 'idx_draft_edit_stats_draft'

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function hasTable(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE))
}

function hasIndex(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(INDEX))
}

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
}

/** 幂等：表/索引已在就跳过（重复执行不改写 sqlite_master，指纹保持唯一）。 */
export function applyM30DraftEditStats(db: Database.Database): void {
  if (!hasTable(db)) db.exec(M30_DRAFT_EDIT_STATS_SQL[0])
  if (!hasIndex(db)) db.exec(M30_DRAFT_EDIT_STATS_SQL[1])
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言表、索引、八列、主键、`NOT NULL`、以及 `origin` / 计数字段的默认值。
 * 默认值写错不会报错，只会让「没传来源」的保存被读成人工，或让计数侧读到 NULL。
 */
export function verifyM30DraftEditStats(db: Database.Database): boolean {
  try {
    if (!hasTable(db) || !hasIndex(db)) return false
    const columns = columnsOf(db)
    if (columns.length !== M30_DRAFT_EDIT_STATS_COLUMNS.length) return false
    for (const [name, type, notnull, dfltValue, pk] of M30_DRAFT_EDIT_STATS_COLUMNS) {
      const column = columns.find(item => item.name === name)
      if (!column) return false
      if (column.type.toUpperCase() !== type) return false
      if (column.notnull !== notnull) return false
      if ((column.dflt_value ?? null) !== dfltValue) return false
      if (column.pk !== pk) return false
    }
    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM30Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M30', from: 30, to: 31, owner: 'P35',
    migrate: reader => applyM30DraftEditStats(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM30DraftEditStats(deps.database(reader)) }
}
