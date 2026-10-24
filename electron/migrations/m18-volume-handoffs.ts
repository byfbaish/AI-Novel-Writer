import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M18 建「卷末交接单」表（P1-2 期 1，2026-10-24）。
 *
 * ## 一条记录 = **一卷的交接单**，不是编年史
 *
 * 只记「下一卷要用的」几件事。写第 4 卷时，前 3 卷正文早已退出上下文，只剩几百字大纲；
 * 这张表就是补上的「跨卷记忆」。所以它**刻意不是**逐章摘要表 —— `summary_snapshots`
 * 已经有那个职责，重复登记等于第二套账。
 *
 * ## `first_chapter` / `last_chapter` 是**写入那一刻的真实章号**，不是计划章数
 *
 * 超写是常态（计划 40 章写到 43 章）。用「第 2 卷 = 21–40」这种计划值，一旦超写，
 * 第 41–43 章就会读不到上一卷。
 *
 * ## 正文链靠 `last_chapter < 本章` 找「上一卷」
 *
 * 所以区间必须**连续、不重叠**：重叠 = 章号落在两条区间里 = 静默注入错卷。
 * 这也是 `first_chapter` / `last_chapter` 各带 CHECK 的原因 —— 区间本身合法是本表的
 * 核心不变量，不是展示字段。
 *
 * ## 三个 `_json` 列是**字符串数组**（`["…","…"]`），不是对象
 *
 * 空必须存 `'[]'`（列是 `NOT NULL DEFAULT '[]'`），**永不 NULL**：写 NULL 会约束失败，
 * 而 NULL 与 `[]` 在多处读路径上会被当成两种语义。
 *
 * ## `volume_index` 单列 UNIQUE 写在列上
 *
 * 与 M14 / M15 / M17 一致，不另建 `CREATE UNIQUE INDEX` —— 少一条 apply 分支、
 * 少一条 verify 断言，也少一个「表和索引不同步」的失败形态。
 *
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane。
 */
export const M18_VOLUME_HANDOFFS_SQL = `CREATE TABLE volume_handoffs (
      handoff_id    TEXT PRIMARY KEY,
      volume_index  INTEGER NOT NULL UNIQUE CHECK(volume_index > 0),
      first_chapter INTEGER NOT NULL CHECK(first_chapter > 0),
      last_chapter  INTEGER NOT NULL CHECK(last_chapter >= first_chapter),
      world_state   TEXT,
      hero_state    TEXT,
      events_json   TEXT NOT NULL DEFAULT '[]',
      items_json    TEXT NOT NULL DEFAULT '[]',
      debts_json    TEXT NOT NULL DEFAULT '[]',
      open_thread   TEXT,
      source        TEXT NOT NULL,
      created_at    TEXT,
      updated_at    TEXT
    )`

const TABLE = 'volume_handoffs'

const COLUMNS = ['handoff_id', 'volume_index', 'first_chapter', 'last_chapter', 'world_state',
  'hero_state', 'events_json', 'items_json', 'debts_json', 'open_thread', 'source',
  'created_at', 'updated_at'] as const

/** 五处「空值有意义」的列：空 = 作者没填，不是空串。 */
const NULLABLE_COLUMNS = ['world_state', 'hero_state', 'open_thread', 'created_at', 'updated_at'] as const

function hasSchemaObject(db: Database.Database, type: 'table', name: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get(type, name))
}

/** 幂等：只有表，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM18VolumeHandoffs(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', TABLE)) db.exec(M18_VOLUME_HANDOFFS_SQL)
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }
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

/** 表 DDL（空白归一，便于逐字断言）。 */
function tableSql(db: Database.Database, table: string): string {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  return (row?.sql ?? '').replace(/\s+/gu, ' ')
}

/** CHECK 是形状的一部分：三处区间约束读 DDL 断言，不写库。
 * `last_chapter >= first_chapter` 与 `first_chapter > 0` 合起来同时排除了「last_chapter <= 0」。
 */
function hasExpectedChecks(sql: string): boolean {
  return sql.includes('CHECK(volume_index > 0)')
    && sql.includes('CHECK(first_chapter > 0)')
    && sql.includes('CHECK(last_chapter >= first_chapter)')
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM18VolumeHandoffs(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', TABLE)) return false
    if (!hasUniqueIndexOn(db, TABLE, 'volume_index')) return false
    if (!hasExpectedChecks(tableSql(db, TABLE))) return false

    const columns = columnsOf(db, TABLE)
    if (columns.length !== COLUMNS.length) return false
    if (!COLUMNS.every(name => columns.some(column => column.name === name))) return false
    // 主键：`TEXT PRIMARY KEY` 在 SQLite 里不会被记成 NOT NULL，只能断言 pk=1。
    if (columns.find(column => column.name === 'handoff_id')?.pk !== 1) return false
    if (columns.find(column => column.name === 'volume_index')?.notnull !== 1) return false
    for (const needed of ['first_chapter', 'last_chapter', 'events_json', 'items_json',
      'debts_json', 'source'] as const) {
      if (columns.find(column => column.name === needed)?.notnull !== 1) return false
    }
    for (const optional of NULLABLE_COLUMNS) {
      if (columns.find(column => column.name === optional)?.notnull !== 0) return false
    }
    // 三个 JSON 列的默认必须是 '[]'，不是 NULL：读侧不必区分「没填」和「空数组」。
    for (const jsonColumn of ['events_json', 'items_json', 'debts_json'] as const) {
      if (columns.find(column => column.name === jsonColumn)?.dflt_value !== "'[]'") return false
    }

    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM18Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M18', from: 18, to: 19, owner: 'P1-1',
    migrate: reader => applyM18VolumeHandoffs(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM18VolumeHandoffs(deps.database(reader)) }
}
