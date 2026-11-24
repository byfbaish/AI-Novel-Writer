import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M31：建 `character_regeneration_snapshots` —— 架构重建覆盖旧卡前的**逐字段回退快照**（C1-b，2026-11-24）。
 *
 * ## 为什么不挂在既有提案表上
 *
 * `character_identity_proposals` 自带 `resolved_character_id` / `approval_id` 的审批语义
 * （`m02-character-identity.ts:18-21`）。角色卡重生成塞进去会把两套审批搅在一起：
 * 一条快照既不是"候选"也不是"已批准决定"，读侧必须靠猜才知道它是什么。
 *
 * ## 为什么不能改基线
 *
 * M00 的 DDL 已冻结，指纹就是那段文本的哈希 —— 加一行注释都会让旧项目 `probeSchema`
 * 报 `UNRECOGNIZED_SCHEMA`（`baseline-schema.ts:10-15`）⇒ 只能新增 lane 步骤（照 M08 先例）。
 *
 * ## 主键与索引
 *
 * `(operation_id, character_id)` 是主键：一次重建一批行，按 `operation_id` 整批取；
 * 同一批里一张卡只有一行（覆盖前的状态）。`idx_..._operation` 让"按批读取"不必全表扫。
 *
 * `created_at` 由应用写 ISO 字符串，**禁用 `datetime('now')`**（它不带时区，展示前还要补 Z ——
 * 同 `m08-structured-refs-and-cast-decisions.ts:22-25`）。
 */
export const M31_CHARACTER_REGENERATION_SNAPSHOTS_SQL = [
  `CREATE TABLE character_regeneration_snapshots (
 operation_id TEXT NOT NULL,
 character_id TEXT NOT NULL,
 source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
 field_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY (operation_id, character_id)
)`,
  `CREATE INDEX idx_character_regeneration_snapshots_operation
 ON character_regeneration_snapshots(operation_id)`,
] as const

export const M31_CHARACTER_REGENERATION_SNAPSHOT_COLUMNS = [
  ['operation_id', 'TEXT', 1, null, 1],
  ['character_id', 'TEXT', 1, null, 2],
  ['source_revision', 'INTEGER', 1, null, 0],
  ['field_json', 'TEXT', 1, null, 0],
  ['created_at', 'TEXT', 1, null, 0],
] as const

const TABLE = 'character_regeneration_snapshots'
const INDEX = 'idx_character_regeneration_snapshots_operation'

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function hasTable(db: Database.Database): boolean {  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE))
}

function hasIndex(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(INDEX))
}

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${TABLE})`).all() as ColumnInfo[]
}

/** 幂等：表/索引已在就跳过（重复执行不改写 sqlite_master，指纹保持唯一）。 */
export function applyM31CharacterRegenerationSnapshots(db: Database.Database): void {
  if (!hasTable(db)) db.exec(M31_CHARACTER_REGENERATION_SNAPSHOTS_SQL[0])
  if (!hasIndex(db)) db.exec(M31_CHARACTER_REGENERATION_SNAPSHOTS_SQL[1])
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 五列、主键顺序、以及 `source_revision` 的 `CHECK(>= 0)` 都要核：主键顺序写反会让
 * "按批读取"退化成按卡读取，而 SQLite 不会报错 —— 只会在回退时找不到别的卡。
 */
export function verifyM31CharacterRegenerationSnapshots(db: Database.Database): boolean {
  try {
    if (!hasTable(db) || !hasIndex(db)) return false
    const columns = columnsOf(db)
    if (columns.length !== M31_CHARACTER_REGENERATION_SNAPSHOT_COLUMNS.length) return false
    for (const [name, type, notnull, dfltValue, pk] of M31_CHARACTER_REGENERATION_SNAPSHOT_COLUMNS) {
      const column = columns.find(item => item.name === name)
      if (!column) return false
      if (column.type.toUpperCase() !== type) return false
      if (column.notnull !== notnull) return false
      if ((column.dflt_value ?? null) !== dfltValue) return false
      if (column.pk !== pk) return false
    }
    // CHECK 约束没有对应的 PRAGMA，只能按 sqlite_master 原文核（改名即失败，符合"表名/列名照抄"）。
    const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(TABLE) as { sql: string })
    if (!/CHECK\s*\(\s*source_revision\s*>=\s*0\s*\)/iu.test(sql.sql)) return false
    const negative = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(INDEX) as { name: string })
    return Boolean(negative.name)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM31Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M31', from: 31, to: 32, owner: 'C1B',
    migrate: reader => applyM31CharacterRegenerationSnapshots(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM31CharacterRegenerationSnapshots(deps.database(reader)) }
}
