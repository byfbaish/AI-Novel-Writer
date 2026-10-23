import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M13：连续性变更日志（P0-1 期 3 的正确性修正，2026-10-23）。
 *
 * ## 为什么必须记「哪一章变了」
 *
 * 期 1 的判定用单一全局计数器 `continuity_projection_meta.generation`：
 * "快照代 < 当前代 ⇒ stale"。这在**单次**退回时正确，在**逐章修复**时错得离谱：
 *
 * ```
 * 退第 21 章（G+1）→ 改 → 重新定稿 → 第 22 章确认无需改动（ack@G+1）
 * 退第 22 章（G+2）→ 改 → 重新定稿
 *   ⇒ 第 21 章的 ack 是 G+1，当前是 G+2 ⇒ 判 stale
 * ```
 *
 * 可改第 22 章**根本不影响第 21 章**。全局计数器丢失了"变的是哪一章"，
 * 于是把"后文变化"也算成"影响前文"，逐章修复时会不断把已确认的章打回 stale。
 *
 * ## 正确的因果
 *
 * 影响是**单向**的：第 k 章变化只影响 k 之后。所以一章需要重算的条件是
 * "它**之前**的某一章在它快照之后变过"：
 *
 * ```
 * requiredGeneration(N) = MAX(generation) FROM changes WHERE chapter_number < N
 * credible(N) ⟺ MAX(snapshotGeneration, 最新确认的 generation) >= requiredGeneration(N)
 * ```
 *
 * 改第 22 章不会抬高第 21 章的 requiredGeneration（只取 < 21 的变更）⇒ 21 保持 current。
 * 改第 20 章会抬高 21..N 的 requiredGeneration ⇒ 它们全部变 stale，正确。
 *
 * ## 形状
 *
 * - 只增不改：日志记的是"某代某章变过"这一事实，删除/回滚都不该抹掉它（否则判定会退回去）。
 * - `generation` 与 `continuity_projection_meta.generation` 同源：每次失效+1，日志用同一个值。
 * - 无外键到 drafts：章删了重建，历史变更事实仍然成立。
 */
export const M13_CONTINUITY_CHANGE_LOG_SQL = [
  `CREATE TABLE continuity_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_number INTEGER NOT NULL,
      generation INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  'CREATE INDEX idx_continuity_change_log_chapter ON continuity_change_log(chapter_number, generation)',
] as const

const TABLE = 'continuity_change_log'
const INDEX = 'idx_continuity_change_log_chapter'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get(type, name))
}

/** 幂等：表与索引各自判存在，所以"只有一半"的库也能被补齐。 */
export function applyM13ContinuityChangeLog(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', TABLE)) db.exec(M13_CONTINUITY_CHANGE_LOG_SQL[0])
  if (!hasSchemaObject(db, 'index', INDEX)) db.exec(M13_CONTINUITY_CHANGE_LOG_SQL[1])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null }

export function verifyM13ContinuityChangeLog(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', TABLE)) return false
    const columns = db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
    const chapterNumber = columns.find(column => column.name === 'chapter_number')
    const generation = columns.find(column => column.name === 'generation')
    // 两列都必填：一行日志必须说清"哪一章、哪一代"
    if (chapterNumber?.notnull !== 1 || generation?.notnull !== 1) return false
    return hasSchemaObject(db, 'index', INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM13Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return {
    id: 'M13',
    from: 13,
    to: 14,
    owner: 'P0-1',
    migrate: reader => applyM13ContinuityChangeLog(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM13ContinuityChangeLog(deps.database(reader)),
  }
}
