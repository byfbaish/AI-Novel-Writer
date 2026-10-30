import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M25（v25 → v26）：三张派生表加「我基于哪一版上游」的来源列。
 *
 * 这个 lane 守五条：
 * 1. **只加列，不重建任何表** —— 三张表都有存量行（交接单、蓝图、剧情树快照）；
 * 2. **存量行读到空串** —— 空串 = 没记过来源 = 判 `legacy`，与「记成空」不能混；
 * 3. 列**非空**（可空会让判定从两态变三态）；
 * 4. 重跑幂等（列已在就跳过，不改写 `sqlite_master`）；
 * 5. verify 失败回滚整步（三列与 `user_version` 一起退）。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v25：`upstream_revisions` 已有（M24），但三张表的来源列还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 25)
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  db.prepare("INSERT INTO blueprints(chapter_number, title, purpose) VALUES(12, '第12章', '旧派生')").run()
  db.prepare(`INSERT INTO volumes(volume_id, volume_index, name, planned_source, outline_hash, source)
    VALUES('vol-1', 1, '第一卷', 'declared', 'hash-1', 'outline')`).run()
  db.prepare(`INSERT INTO volume_handoffs(handoff_id, volume_id, world_state, source)
    VALUES('h-1', 'vol-1', '卷末世界', 'author')`).run()
  db.prepare(`UPDATE project_core SET plot_tree_snapshot = '{"version":1}' WHERE id = 'main'`).run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null }

function columnsOf(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const EXPECTED = [
  { table: 'volume_handoffs', column: 'source_ref' },
  { table: 'blueprints', column: 'source_ref' },
  { table: 'project_core', column: 'plot_tree_source_ref' },
] as const

describe('installed M25 lane', () => {
  it('升到最新版本，三列都在，且不动既有派生内容', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(26)
      for (const entry of EXPECTED) {
        expect(columnsOf(db, entry.table).map(column => column.name)).toContain(entry.column)
      }
      // 存量行必须原样还在，来源列读到空串（= 判 legacy，不是「上游变过」）
      expect(db.prepare('SELECT COALESCE(world_state, \'\') AS w FROM volume_handoffs').pluck().get()).toBe('卷末世界')
      expect(db.prepare('SELECT source_ref FROM blueprints WHERE chapter_number = 12').pluck().get()).toBe('')
      expect(db.prepare("SELECT plot_tree_source_ref FROM project_core WHERE id = 'main'").pluck().get()).toBe('')
      expect(db.prepare("SELECT plot_tree_snapshot FROM project_core WHERE id = 'main'").pluck().get()).toBe('{"version":1}')
    } finally { db.close() }
  })

  it('三列都非空且默认空串 —— 空串才是「没记过来源」，NULL 会让判定变成三态', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      for (const entry of EXPECTED) {
        const column = columnsOf(db, entry.table).find(item => item.name === entry.column)!
        expect(column.notnull).toBe(1)
        expect(column.dflt_value).toBe("''")
      }
    } finally { db.close() }
  })

  it('重跑是幂等的：不产生步骤、不改指纹', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const fingerprint = sqliteSchemaFingerprint(db)
      const again = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(again.completedSteps).toEqual([])
      expect(sqliteSchemaFingerprint(db)).toBe(fingerprint)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（三列与 user_version 一起退）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M25' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(25)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      for (const entry of EXPECTED) {
        expect(columnsOf(db, entry.table).map(column => column.name)).not.toContain(entry.column)
      }
    } finally { db.close() }
  })
})
