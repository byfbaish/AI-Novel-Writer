import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M22：`summary_snapshots` 加一列 `knowledge_candidates`（P20-3，2026-10-26 作者裁定「只做知情一格」）。
 *
 * ## 为什么是同一张表，不是新表
 *
 * 候选的语义是「**这一章定稿**里谁新得知了哪条事实」—— 它和 `continuity_facts` 同生共死：
 * 章重定稿 ⇒ facts 变了 ⇒ 候选必须跟着失效。放在同一行，失效判定天然成立（见下）；
 * 单独建表就要自己维护一个「代际」字段，多一份可能对不上的真相。
 *
 * ## 为什么只加列、不重建表
 *
 * 没有约束变更（不加外键、不加 CHECK、不改主键），`ALTER TABLE ADD COLUMN` 就够。
 * 重建表只在前者做不到时才值得 —— 代价是全量拷贝 + 索引重建 + 外键校验（M02 那次是必需的，
 * 这里不是）。
 *
 * ## 候选怎么失效（不加列）
 *
 * 候选里存的是 `factKey = kf:sha256(章号 + 归一化逐字引文)`，它**本身就是那批 facts 的指纹**。
 * 章重定稿 ⇒ 引文变了 ⇒ `factKey` 变了 ⇒ 旧候选在当前投影里**反查不到** ⇒ 读取侧标 `stale`。
 * 所以不需要 `facts_hash`、不需要定时清理、不需要版本号。
 *
 * ## 候选不是事实
 *
 * 这一列只被知情登记页读。**正文链、审稿链都不许读它**（`knowledge-candidate.test.ts` 有源码扫描
 * 钉住这一点）—— 未采纳的候选永远不进 prompt、永远不落 `knowledge_states`。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M22_KNOWLEDGE_CANDIDATES_SQL = [
  "ALTER TABLE summary_snapshots ADD COLUMN knowledge_candidates TEXT NOT NULL DEFAULT '[]'",
] as const

const TABLE = 'summary_snapshots'
const COLUMN = 'knowledge_candidates'

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
}

function hasColumn(db: Database.Database): boolean {
  return columnsOf(db).some(column => column.name === COLUMN)
}

/** 幂等：列已在就跳过（重复执行不改写 sqlite_master，指纹保持唯一）。 */
export function applyM22KnowledgeCandidates(db: Database.Database): void {
  if (!hasColumn(db)) db.exec(M22_KNOWLEDGE_CANDIDATES_SQL[0])
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言三条：列在、**非空**（`'[]'` 是合法空值，不需要 NULL）、默认值就是 `'[]'`。
 * 第三条要紧：默认值写成 `''` 的话，读取侧 `JSON.parse('')` 会抛，而一条空候选本该是
 * 「没有候选」而不是「读失败」（判据 DN：没有 ≠ 读不出来）。
 */
export function verifyM22KnowledgeCandidates(db: Database.Database): boolean {
  try {
    const column = columnsOf(db).find(item => item.name === COLUMN)
    if (!column) return false
    if (column.notnull !== 1) return false
    // SQLite 把 DEFAULT 原样存进 dflt_value，字符串字面量带单引号：`'[]'`。
    return (column.dflt_value ?? '').replace(/^'(.*)'$/u, '$1') === '[]'
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM22Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M22', from: 22, to: 23, owner: 'P20',
    migrate: reader => applyM22KnowledgeCandidates(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM22KnowledgeCandidates(deps.database(reader)) }
}
