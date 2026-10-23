import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M12：章节「前提已变」的人工确认（P0-1，2026-10-23）。
 *
 * ## 这张表在记什么
 *
 * 退回/改写任意一章会让 `continuity_projection_meta.generation` +1，于是**之后所有章**的
 * 派生（要点/连续性事实/角色状态）相对新世界都算"旧"。其中大多数章其实不受影响，
 * 逐章重跑后处理（每章一次模型调用）成本不可接受，所以给一个**显式确认**的出口。
 *
 * ## 三处不可退让的形状
 *
 * - **主键是 `(chapter_number, acknowledged_generation)`**：确认**绑定世代**。
 *   下次任何一章再退回 ⇒ generation 变 ⇒ 旧确认查不到 ⇒ 自动失效、重新提示。
 *   这是刻意设计：确认是"针对这一代世界"的，不是一次性免责。
 * - `reason` **NOT NULL 且无默认值**：确认必须给理由。空理由等于静默放行，
 *   而静默放行正是这个功能要防的东西。
 * - **不加外键到 drafts**：章可能被删后重建，若挂外键，历史上"确认过第 3 章"这条事实
 *   会随草稿删除一起消失；它记录的是**作者某时点的判断**，不应被正文生命周期牵连。
 *
 * 基线（baseline-schema.ts）已冻结，所以走新 lane。
 */
export const M12_CHAPTER_STALENESS_ACK_SQL = [
  `CREATE TABLE chapter_staleness_acknowledgements (
      chapter_number INTEGER NOT NULL,
      acknowledged_generation INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (chapter_number, acknowledged_generation)
    )`,
] as const

const TABLE = 'chapter_staleness_acknowledgements'

function hasTable(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE))
}

/** 幂等：重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM12ChapterStalenessAck(db: Database.Database): void {
  if (!hasTable(db)) db.exec(M12_CHAPTER_STALENESS_ACK_SQL[0])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }

/** 只读校验：形状错了返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM12ChapterStalenessAck(db: Database.Database): boolean {
  try {
    if (!hasTable(db)) return false
    const columns = db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
    const chapterNumber = columns.find(column => column.name === 'chapter_number')
    const generation = columns.find(column => column.name === 'acknowledged_generation')
    const reason = columns.find(column => column.name === 'reason')
    if (!chapterNumber || !generation || !reason) return false
    // 复合主键：两列都要 NOT NULL 且 pk 序号分别为 1、2
    if (chapterNumber.notnull !== 1 || generation.notnull !== 1) return false
    if (chapterNumber.pk !== 1 || generation.pk !== 2) return false
    // 理由必填：NOT NULL 且不能有默认值（有默认值就能被静默填成空串）
    if (reason.notnull !== 1 || reason.dflt_value !== null) return false
    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM12Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return {
    id: 'M12',
    from: 12,
    to: 13,
    owner: 'P0-1',
    migrate: reader => applyM12ChapterStalenessAck(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM12ChapterStalenessAck(deps.database(reader)),
  }
}
