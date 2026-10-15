import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M08 一次迁移做两件事（2026-10-15）：
 *
 * 1. `blueprints.structured_refs` —— B′ 双写的机读伴随字段（`spaceRefs` JSON）。
 *    与 `key_events` / `characters` 同法：TEXT 存 JSON，不动既有列。
 * 2. `character_cast_decisions` —— 锚点人物（功能配角）的**append-only 作者决定日志**。
 *    撤销 = 追加一条 `revoke`，当前有效登记 = 按 name 取最后一条。
 *    这样"已批准批次不可改写"的历史约束不受影响（与 `reopen` 同一原则：只追加现状，不重写历史）。
 *
 * M00 基线已冻结（指纹即其 CREATE TABLE 文本哈希），因此新增列/表必须走新的 lane 步骤，
 * 不能改 baseline-schema.ts —— 否则所有旧项目的指纹会全部失配。
 */
export const M08_ADDED_BLUEPRINT_COLUMNS = ['structured_refs'] as const
export const M08_CREATED_TABLES = ['character_cast_decisions'] as const

export const M08_STRUCTURED_REFS_SQL =
  "ALTER TABLE blueprints ADD COLUMN structured_refs TEXT NOT NULL DEFAULT ''"

/**
 * `created_at` 由应用写 ISO 字符串（**不要**用 SQLite `datetime('now')`：它不带时区，
 * 展示前还得补 Z —— 见 notes/data-and-schema.md 的既有一致性约定）。
 */
export const M08_CAST_DECISIONS_SQL = `
CREATE TABLE character_cast_decisions (
 decision_id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 anchor_role TEXT NOT NULL,
 catchphrase TEXT NOT NULL DEFAULT '',
 relation_to_protagonist TEXT NOT NULL DEFAULT '',
 action TEXT NOT NULL CHECK(action IN ('register','revoke')),
 source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
 operation_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_character_cast_decisions_name ON character_cast_decisions(name);
`

function tableExists(db: Database.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

function blueprintColumns(db: Database.Database): string[] {
  return (db.prepare('PRAGMA table_info(blueprints)').all() as Array<{ name: string }>).map(column => column.name)
}

/** 幂等：列/表已存在即返回，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM08StructuredRefsAndCastDecisions(db: Database.Database): void {
  if (!tableExists(db, 'blueprints')) throw new Error('STRUCTURED_REFS_MIGRATION_SCHEMA_UNRECOGNIZED')
  if (!blueprintColumns(db).includes('structured_refs')) db.exec(M08_STRUCTURED_REFS_SQL)
  if (!tableExists(db, 'character_cast_decisions')) db.exec(M08_CAST_DECISIONS_SQL)
}

export function verifyM08StructuredRefsAndCastDecisions(db: Database.Database): boolean {
  try {
    const column = (db.prepare('PRAGMA table_info(blueprints)').all() as Array<{ name: string; notnull: number }>)
      .find(item => item.name === 'structured_refs')
    if (!column || column.notnull !== 1) return false
    const columns = (db.prepare('PRAGMA table_info(character_cast_decisions)').all() as Array<{ name: string }>)
      .map(item => item.name)
    return ['decision_id', 'name', 'anchor_role', 'action', 'operation_id', 'created_at']
      .every(required => columns.includes(required))
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM08Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M08', from: 8, to: 9, owner: 'S11',
    migrate: reader => applyM08StructuredRefsAndCastDecisions(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM08StructuredRefsAndCastDecisions(deps.database(reader)) }
}
