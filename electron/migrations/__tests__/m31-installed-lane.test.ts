import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { applyM31CharacterRegenerationSnapshots } from '../m31-character-regeneration-snapshots'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema, probeSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * J5（M31 / v31 → v32）：`character_regeneration_snapshots` 建表。
 *
 * 这一层的断言重点不在「表在不在」，而在三件静默错：
 * 1. `user_version` 停在 31 ⇒ M31 永不执行（`migrateSchema(..., CURRENT_DESKTOP_SCHEMA_VERSION)`
 *    以它为目标）；
 * 2. 重跑不幂等 ⇒ 第二次建表抛错，或指纹每次都变（旧项目再也认不出来）；
 * 3. 动到了 M00 基线 ⇒ 所有 `user_version=0` 的旧项目打开即 `UNRECOGNIZED_SCHEMA`。
 */
function fixture(version: number) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), version)
  return db
}

type Column = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

describe('installed M31 lane', () => {
  it('从 v31 升到 v32，五列齐、主键顺序为 (operation_id, character_id)', () => {
    const db = fixture(31)
    try {
      expect(db.pragma('user_version', { simple: true })).toBe(31)
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBe(32)
      expect(db.pragma('user_version', { simple: true })).toBe(32)
      const columns = columnsOf(db, 'character_regeneration_snapshots')
      expect(columns.map(column => column.name)).toEqual(['operation_id', 'character_id', 'source_revision', 'field_json', 'created_at'])
      expect(columns.filter(column => column.pk > 0).map(column => [column.name, column.pk]))
        .toEqual([['operation_id', 1], ['character_id', 2]])
      expect(columns.find(column => column.name === 'source_revision')).toMatchObject({ type: 'INTEGER', notnull: 1 })
      const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='character_regeneration_snapshots'").get() as { sql: string }).sql
      expect(sql).toMatch(/CHECK\s*\(\s*source_revision\s*>=\s*0\s*\)/u)
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_character_regeneration_snapshots_operation'").get()).toBeTruthy()
    } finally { db.close() }
  })

  it('重复执行是幂等的：不产生步骤、不改指纹（直接再 apply 一次也一样）', () => {
    const db = fixture(32)
    try {
      const fingerprint = sqliteSchemaFingerprint(db)
      const again = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(again.completedSteps).toEqual([])
      applyM31CharacterRegenerationSnapshots(db)
      applyM31CharacterRegenerationSnapshots(db)
      expect(sqliteSchemaFingerprint(db)).toBe(fingerprint)
    } finally { db.close() }
  })

  it('M00 基线指纹没被动：user_version=0 的旧项目仍被 probeSchema 认出', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      const probe = probeSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry())
      expect(probe.version).toBe(0)
      expect(probe.fingerprint).toBe(sqliteSchemaFingerprint(db))
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（表与 user_version 一起退）', () => {
    const db = fixture(31)
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M31' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(31)
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='character_regeneration_snapshots'").get()).toBeUndefined()
    } finally { db.close() }
  })
})
