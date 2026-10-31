import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M27：建 `upstream_revision_log` —— 上游版本的**流水账**（P2-3 / S6c，2026-10-31）。
 *
 * ## 病根：`upstream_revisions` 只有当前态
 *
 * `upstream_revisions` 是「一域一行」的当前态表：`rev` 一涨，上一版的 `updated_at`
 * 就被 `UPDATE` 覆盖。于是**历史每版是什么时候改的**这件事从来没有落过盘，
 * 而 `rev` 涨上去了就再也取不回来。硬拒文案的溯源链第 3 层（时间 + 原因）缺的就是它。
 *
 * ## 与 `upstream_revisions` 的分工（两张表都在，不许合并）
 *
 * - `upstream_revisions` = **当前态**：判定（`have vs need`）只读它，一次一行、可缓存。
 * - `upstream_revision_log` = **流水**：只追加，为一版一记、可多行。
 *
 * 判定侧**不读**流水（多一行少一行不影响「旧没旧」），否则流水一脏就会误判业务；
 * 流水只服务「为什么旧」的取证与将来的回滚审计。
 *
 * ## 为什么 `reason` 默认 `unknown` 而不是空串
 *
 * 空白与「不知道」必须是两种东西（主稿 §十·3）。空串会被读成「没有原因这个字段」，
 * 于是将来所有读取方都得自己兜一层；显式 `unknown` 则让「还没接上原因」变成一个
 * **可见的待办**：查一遍 `WHERE reason='unknown'` 就知道还有多少处没接线。
 * 写入侧因此允许**不传** reason（默认落 `unknown`），但**库里永远有值**。
 *
 * ## 为什么 `covers_all` 单独一列
 *
 * `changed_chapters` 是「这一版改过的章」，而 `replace` 语义（整本重生成、整段替换）
 * 说的是「**全部**章都变了」。用空数组兼职表达「全部」会被读成「一章没改」——
 * 这是两个相反的意思，必须分开存。有了这一列，读侧不必再猜 `bump` 当时用的 mode。
 *
 * ## 为什么没有 UNIQUE(domain, scope, rev)
 *
 * 导入更早的便携包会让 rev 回退（`upstream_revisions` 是整行覆盖），之后再 bump
 * 就会撞上流水里已有的同一 `(domain, scope, rev)`。给这本书的唯一性约束会直接
 * 让**业务写入事务失败** —— 一本旁路账本不该有这个权力。所以允许重复，
 * 读侧按 `id DESC` 取最近一条，并把「同 rev 多行」当作导入/回滚的正常痕迹。
 *
 * ## 为什么不做 append-only 触发器
 *
 * 清除创作字段时必须能整表删除（版本账随被描述的世界一起归零，与
 * `DELETE FROM upstream_revisions` 同一处同一语义），触发器会把这件正当操作拦掉。
 * 只追加是**仓储层纪律**（`UpstreamRevisionRepository` 只发 INSERT），不是数据库约束。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M27_UPSTREAM_REVISION_LOG_SQL = [
  `CREATE TABLE IF NOT EXISTS upstream_revision_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    scope TEXT NOT NULL,
    rev INTEGER NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    reason TEXT NOT NULL DEFAULT 'unknown',
    changed_chapters TEXT NOT NULL DEFAULT '[]',
    covers_all INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_upstream_revision_log_key
    ON upstream_revision_log (domain, scope, rev)`,
] as const

const TABLE = 'upstream_revision_log'
const INDEX = 'idx_upstream_revision_log_key'

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
export function applyM27UpstreamRevisionLog(db: Database.Database): void {
  if (!hasTable(db)) db.exec(M27_UPSTREAM_REVISION_LOG_SQL[0])
  if (!hasIndex(db)) db.exec(M27_UPSTREAM_REVISION_LOG_SQL[1])
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言四条，每条都对应一个真实会出事的形态：
 * - 八列齐全：缺 `reason` ⇒ 溯源链第 3 层永远只有时间没有原因；
 *   缺 `covers_all` ⇒ 「全部章都变了」会被读成「一章没改」（意思相反）；
 * - `id` 是主键：读侧按 `id DESC` 取最近一条，没有主键就没有确定的"最近"；
 * - `reason` 非空且默认 `unknown`：可空会让「没接线」静默成「没有原因这一栏」；
 * - 索引在：这是只增不删的表，`(domain, scope, rev)` 查历史会随版本数线性变慢。
 */
export function verifyM27UpstreamRevisionLog(db: Database.Database): boolean {
  try {
    if (!hasTable(db) || !hasIndex(db)) return false
    const columns = new Map(columnsOf(db).map(item => [item.name, item]))
    for (const name of ['id', 'domain', 'scope', 'rev', 'at', 'reason', 'changed_chapters', 'covers_all']) {
      if (!columns.has(name)) return false
    }
    if (columns.get('id')!.pk !== 1) return false
    for (const name of ['domain', 'scope', 'rev', 'at', 'reason', 'changed_chapters', 'covers_all']) {
      if (columns.get(name)!.notnull !== 1) return false
    }
    if ((columns.get('reason')!.dflt_value ?? '') !== "'unknown'") return false
    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM27Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M27', from: 27, to: 28, owner: 'P2-3',
    migrate: reader => applyM27UpstreamRevisionLog(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM27UpstreamRevisionLog(deps.database(reader)) }
}
