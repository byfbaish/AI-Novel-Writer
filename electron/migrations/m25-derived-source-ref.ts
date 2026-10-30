import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M25：三张派生表加「我基于哪一版上游」的来源列（P2-2 期 2，2026-10-30）。
 *
 * ## 病根
 *
 * M24 只让「上游有几版」这件事存在，派生侧一个字都不知道。于是读取侧即使拿到
 * 当前版本，也没有可比的东西 —— 判定所需要的另一半是**派生自己记下生成时的快照**。
 * 本迁移加的就是这三处快照列。
 *
 * ## 为什么是加列，不是新表
 *
 * 来源是**一行派生的属性**，不是新实体。拆表要维护「哪一行派生对哪一条来源」，
 * 而行本身已有主键（`blueprints.chapter_number` / `volume_handoffs.handoff_id`），
 * 多一份可能对不上的真相没有必要。
 *
 * ## 为什么剧情树是给 `project_core` 加列，而不是塞进 `plot_tree_snapshot` 这个 JSON
 *
 * 那个 JSON 的**整串**被两处当成基准：
 * - `graph-generation-source.ts` 对整串做 sha256 当 `targetBaselineHash`；
 * - `graph-generation.ts` 存前与旧串逐字节比较。
 *
 * 往里加一个字段，这两处立刻判「来源已变」——正在跑的生成会被自己拦掉。加独立列
 * 则零影响：JSON 的字节不动，来源另有出处。
 *
 * ## 为什么默认空串而不是 NULL
 *
 * 空串 = 存量行（版本机制出现之前生成的）⇒ 判 `legacy`（不知道）。`NULL` 会让
 * 「从来没记过」和「记成空」变成两种状态，而判定侧只需要一种不确定。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M25_DERIVED_SOURCE_REF_SQL = [
  "ALTER TABLE volume_handoffs ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE blueprints ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE project_core ADD COLUMN plot_tree_source_ref TEXT NOT NULL DEFAULT ''",
] as const

/** 列名 → 表名。顺序即 SQL 顺序，`verify` 与 `apply` 共用同一份清单。 */
const COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'volume_handoffs', column: 'source_ref' },
  { table: 'blueprints', column: 'source_ref' },
  { table: 'project_core', column: 'plot_tree_source_ref' },
]

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null }

function hasTable(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
}

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  return hasTable(db, table) && columnsOf(db, table).some(item => item.name === column)
}

/**
 * 幂等：列已在就跳过（重复执行不改写 `sqlite_master`，指纹保持唯一）。
 *
 * 表不存在时**直接跳过并把判断交给 verify** —— 不在这里抛，是因为这个函数也可能
 * 被桌面注册表用在「还没有该表」的库上；但 verify 会因此返回 false 并回滚整步，
 * 所以「形不形状」永远是显式失败，不会静默少列。
 */
export function applyM25DerivedSourceRef(db: Database.Database): void {
  COLUMNS.forEach((entry, index) => {
    if (!hasTable(db, entry.table)) return
    if (hasColumn(db, entry.table, entry.column)) return
    db.exec(M25_DERIVED_SOURCE_REF_SQL[index])
  })
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言三条，每条都对应一个真实会出事的形态：
 * - 三列都在：缺任一列 ⇒ 那一种派生的来源永远记不下来，读取侧被判 `legacy`，
 *   机制看起来「做了」其实只做了一半；
 * - `notnull = 1`：可空会让「没记过」与「记了空」分叉，判定从两态变三态；
 * - 默认值是 `''`：存量行必须读到空串（SQLite 把 TEXT 的 DEFAULT 原样存成 `''`）。
 */
export function verifyM25DerivedSourceRef(db: Database.Database): boolean {
  try {
    for (const entry of COLUMNS) {
      if (!hasTable(db, entry.table)) return false
      const column = columnsOf(db, entry.table).find(item => item.name === entry.column)
      if (!column) return false
      if (column.notnull !== 1) return false
      if ((column.dflt_value ?? '') !== "''") return false
    }
    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM25Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M25', from: 25, to: 26, owner: 'P2-2',
    migrate: reader => applyM25DerivedSourceRef(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM25DerivedSourceRef(deps.database(reader)) }
}
