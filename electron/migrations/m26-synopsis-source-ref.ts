import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M26：给「大纲自己」记一条上游来源（P2-3 期 3b · 补齐中间环，2026-10-31）。
 *
 * ## 病根：链条缺一环
 *
 * 期 2 让派生记住「我基于哪一版」，但只覆盖了 §1.2 里有原料的那三张表。于是作者
 * 改世界观时，**唯一会响的是蓝图**（三域全记），而大纲与剧情树之间的那一环——
 * 「世界改了 ⇒ 大纲过时了」——完全没有落点：`project_core.synopsis` 是纯文本，
 * 不知道自己基于哪一版世界观。
 *
 * 作者 2026-10-31 的裁定给了这条链的正确形状：
 *
 * ```
 * 世界观/弧光改了 → 提醒「大纲过时」→ 作者决定是否重生成大纲
 *                → 大纲 rev +1 → 蓝图/交接单 stale → 作者决定是否重生成蓝图
 *                → 蓝图 stale → 正文链硬拒（这一层保留，且必须带溯源链）
 * ```
 *
 * 也就是说**级联是逐层发生的，不是跨层直传**。这张表加的列就是那条中间环的落点。
 *
 * ## 为什么只记 `worldbuilding` + `arc`，不记 `outline`
 *
 * 派生不该记自己。大纲的 `outline` rev 由它自己的写入推进（`commitSynopsis` /
 * `update`），记进去会让「大纲刚写完就判自己 stale」。
 *
 * ## 为什么加列而不是塞进 `synopsis` 文本或另开一张表
 *
 * - 塞进文本：`synopsis` 的整串被章标题解析、CAS 与导出反复逐字节比对，加任何
 *   记号都会让这些通道把「来源变了」读成「内容变了」——M25 对剧情树踩过同一个坑。
 * - 另开表：这一行是 `project_core` 一行的属性，`id='main'` 已经是唯一主键，
 *   再造一张一对一的表只会多一份可能对不上的真相。
 *
 * ## 为什么默认空串而不是 NULL
 *
 * 与 M25 同一口径：空串 = 存量行（没有来源记录）⇒ 判 `legacy`（不知道）。
 * `NULL` 会让「从来没记过」与「记成空」变成两种状态，而判定侧只需要一种不确定。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M26_SYNOPSIS_SOURCE_REF_SQL = [
  "ALTER TABLE project_core ADD COLUMN synopsis_source_ref TEXT NOT NULL DEFAULT ''",
] as const

const COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'project_core', column: 'synopsis_source_ref' },
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

/** 幂等：列已在就跳过；表不存在时跳过并把判断交给 `verify`（与 M25 同一条纪律）。 */
export function applyM26SynopsisSourceRef(db: Database.Database): void {
  COLUMNS.forEach((entry, index) => {
    if (!hasTable(db, entry.table)) return
    if (hasColumn(db, entry.table, entry.column)) return
    db.exec(M26_SYNOPSIS_SOURCE_REF_SQL[index])
  })
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 三条断言与 M25 逐条对应 —— 缺列 ⇒ 中间环永远记不下来，`worldbuilding` 改动
 * 在「大纲」这一层静默；可空或默认不是 `''` ⇒ 存量行读不到「没记过」这个状态。
 */
export function verifyM26SynopsisSourceRef(db: Database.Database): boolean {
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
export function createM26Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return {
    id: 'M26', from: 26, to: 27, owner: 'P2-3',
    migrate: reader => applyM26SynopsisSourceRef(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM26SynopsisSourceRef(deps.database(reader)),
  }
}
