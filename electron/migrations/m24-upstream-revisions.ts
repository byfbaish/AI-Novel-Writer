import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M24：建 `upstream_revisions` —— 上游三域的版本账（P2-2 期 1，2026-10-30）。
 *
 * ## 为什么需要一张新表
 *
 * 库里没有「上游版本」这个概念：世界观、弧光是 `project_core` 的 TEXT 列，
 * 情节大纲也是。它们被覆盖式重写，**旧值不落任何痕迹**，所以下游派生
 * （交接单、蓝图、章纲要点）无法判断自己基于的是哪一版 ——
 * 交接稿 §三的结论「上游重建不触碰任何下游表」是事实，不是缺陷；缺陷是
 * 下游连「我旧了」都说不出来。
 *
 * ## 为什么是独立表，不是给 `project_core` 加一列
 *
 * 三域的**作用域不同**：世界观 / 弧光是全书一份，情节大纲按单元批次各一份。
 * 宽表的一列表达不了「`outline:u07` 到第 5 版、`outline:u08` 还停在第 2 版」。
 * 而且 `project_core` 已经 30+ 列，再塞三列会让「哪些列是架构产物」更难辨。
 *
 * ## 为什么 `changed_chapters` 也在这一行
 *
 * 上游**重新生成**只有批级入口，但**手改**能停在单章（章节卡编辑器、
 * agent 的 `db:blueprint-upsert`）。若 rev 一涨就把整批判脏，作者改一章
 * 会看到整批 10 章全部标红 —— 提示的噪声超过信息量就会被整体无视
 * （现在卷 `stale` 就是这个下场）。所以批仍是 rev 的身份，章集合描述
 * 「这批里到底哪几章动过」。
 *
 * 设计依据与裁定记录 →
 * `docs/design/architecture/upstream-version-and-derived-invalidation-design.md` §4.1。
 *
 * ## 为什么没有 `stale` 标志列
 *
 * 失效是**算出来的**（比较派生的 `source_ref` 与当前 `rev`），不是写进去的。
 * 写标志就要维护「谁该清标志」，而清不掉的那条会让派生永久脏。
 * 先例：QuestDB 物化视图存 `refresh_base_table_txn`，滞后量是算的，不是标志位。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M24_UPSTREAM_REVISIONS_SQL = [
  `CREATE TABLE IF NOT EXISTS upstream_revisions (
    domain TEXT NOT NULL,
    scope TEXT NOT NULL,
    rev INTEGER NOT NULL DEFAULT 0,
    digest TEXT NOT NULL DEFAULT '',
    changed_chapters TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (domain, scope)
  )`,
] as const

const TABLE = 'upstream_revisions'

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
}

function hasTable(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE))
}

/** 幂等：表已在就跳过（重复执行不改写 sqlite_master，指纹保持唯一）。 */
export function applyM24UpstreamRevisions(db: Database.Database): void {
  if (!hasTable(db)) db.exec(M24_UPSTREAM_REVISIONS_SQL[0])
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言四条，每条都对应一个真实会出事的形态：
 * - 六列齐全：缺 `changed_chapters` 会让单章手改退化成整批判脏；
 * - `rev` **非空**：可空会让版本比较变成三态（null 既不是落后也不是相等）；
 * - `rev` 默认 `0`：新建行的起点必须是 0，否则第一次 `+1` 从什么基数算不明；
 * - 主键是 `(domain, scope)`：这张表的全部语义建立在「一个域一个作用域一行」上，
 *   主键错了就会允许 `worldbuilding:book` 出现两行，读取时取哪一行全凭运气。
 */
export function verifyM24UpstreamRevisions(db: Database.Database): boolean {
  try {
    if (!hasTable(db)) return false
    const columns = columnsOf(db)
    const names = new Set(columns.map(column => column.name))
    for (const required of ['domain', 'scope', 'rev', 'digest', 'changed_chapters', 'updated_at']) {
      if (!names.has(required)) return false
    }
    const rev = columns.find(column => column.name === 'rev')
    if (!rev) return false
    if (rev.notnull !== 1) return false
    if ((rev.dflt_value ?? '') !== '0') return false
    const primaryKey = columns.filter(column => column.pk > 0).sort((left, right) => left.pk - right.pk)
    return primaryKey.length === 2 && primaryKey[0].name === 'domain' && primaryKey[1].name === 'scope'
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM24Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M24', from: 24, to: 25, owner: 'P2-2',
    migrate: reader => applyM24UpstreamRevisions(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM24UpstreamRevisions(deps.database(reader)) }
}
