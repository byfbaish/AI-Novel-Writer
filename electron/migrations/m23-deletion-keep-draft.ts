import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M23：`chapter_deletion_operations` 加一列 `keep_draft`（2026-10-30 作者裁定方案 1）。
 *
 * ## 病根
 *
 * 这张表 **按 `draft_id` 唯一**，而「删除正文」与「退回草稿」共用它 —— 两条入口的投影清理
 * 完全一样（实体稿 + 知识库），只差 `begin` 里那一句 `keepDraft`。语义**从未落库**，
 * 于是 `begin` 命中旧收据时只比 `chapter_number`，不比「这次是删还是退」：
 *
 * 1. 先删后退 → 被删除收据接住，`revertChapterFacts` 一次没跑，界面却报「已退回」（静默 no-op）
 * 2. 先退后删 → 被退回收据接住，删除实际没发生
 * 3. 最坏：接住一次**中断的删除**（status 停在 pending/failed）→ `resume` 替它跑完投影清理，
 *    删掉实体稿与知识库文档
 *
 * 第 3 条是为什么必须落库而不是「在服务层再判一次」：`resumeExistingOperation` 只拿得到
 * 收据，收据里没有语义就没得判。
 *
 * ## 为什么是加列，不是新建表
 *
 * 语义是**一次操作的属性**，不是新的实体。拆表要自己维护「哪条收据属于哪次操作」的映射，
 * 而 `draft_id` 上已有 UNIQUE —— 多一份可能对不上的真相。
 *
 * ## 存量行为什么一律填 0
 *
 * 已发生的行**无法判定**当时是删还是退（库里没有任何痕迹可反推），不猜。
 * 填 0（= 删除语义）的后果只有一个：若某个 draft 的历史收据其实是退回，作者再来一次
 * 「删除」会被 `begin` 显式拒绝 —— 这正是要的「遇歧义宁可拒绝」。
 *
 * **不影响**中断收据的续跑：`resume` 对两种语义做的事完全一致（只清理实体稿与知识库文档，
 * 不动 drafts/contents），删草稿只发生在 `begin`。所以填 0 不会让某条中断的退回把草稿删掉。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M23_DELETION_KEEP_DRAFT_SQL = [
  'ALTER TABLE chapter_deletion_operations ADD COLUMN keep_draft INTEGER NOT NULL DEFAULT 0',
] as const

const TABLE = 'chapter_deletion_operations'
const COLUMN = 'keep_draft'

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
}

function hasColumn(db: Database.Database): boolean {
  return columnsOf(db).some(column => column.name === COLUMN)
}

/** 幂等：列已在就跳过（重复执行不改写 sqlite_master，指纹保持唯一）。 */
export function applyM23DeletionKeepDraft(db: Database.Database): void {
  if (!hasColumn(db)) db.exec(M23_DELETION_KEEP_DRAFT_SQL[0])
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言三条：列在、**非空**（语义必须可判，NULL 会让 `keepDraft` 变成三态）、默认值就是 `0`。
 * 第三条是「存量行读到删除语义」的保证 —— SQLite 把 INTEGER 的 DEFAULT 原样存成 `0`。
 */
export function verifyM23DeletionKeepDraft(db: Database.Database): boolean {
  try {
    const column = columnsOf(db).find(item => item.name === COLUMN)
    if (!column) return false
    if (column.notnull !== 1) return false
    return (column.dflt_value ?? '') === '0'
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM23Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M23', from: 23, to: 24, owner: 'P0-1',
    migrate: reader => applyM23DeletionKeepDraft(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM23DeletionKeepDraft(deps.database(reader)) }
}
