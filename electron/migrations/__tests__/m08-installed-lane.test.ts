import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry } from '../registry'
import { migrateSchema, verifySchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M08（v8 → v9）：`blueprints.structured_refs`（B′ 机读伴随字段）+
 * `character_cast_decisions`（锚点人物的 append-only 作者决定日志）。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 8)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v8 作者正文')
  // 已存在的蓝图行：迁移必须给新列补默认值，而不是改写或丢弃它。
  db.prepare('INSERT INTO blueprints(chapter_number, title, key_events) VALUES(1, ?, ?)')
    .run('第一章', '[{"id":"ch1:E1","event":"既有事件","estimatedUnits":700}]')
  return db
}

describe('installed M08 lane', () => {
  it('migrates recognized v8 to v9, keeps author content, and defaults the new column', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      const keyEventsBefore = db.prepare('SELECT key_events FROM blueprints WHERE chapter_number=1').pluck().get()
      const result = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 9)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBe(11)
      expect(result.completedSteps).toEqual(['M08'])
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare('SELECT key_events FROM blueprints WHERE chapter_number=1').pluck().get()).toBe(keyEventsBefore)

      const column = (db.prepare('PRAGMA table_info(blueprints)').all() as Array<{ name: string; notnull: number }>)
        .find(item => item.name === 'structured_refs')
      expect(column?.notnull).toBe(1)
      // 既有行的新列取默认空串（消费点据此回退到"没有机读伴随字段"，fail-open）。
      expect(db.prepare('SELECT structured_refs FROM blueprints WHERE chapter_number=1').pluck().get()).toBe('')

      const castColumns = (db.prepare('PRAGMA table_info(character_cast_decisions)').all() as Array<{ name: string }>)
        .map(item => item.name)
      expect(castColumns).toEqual(expect.arrayContaining(['decision_id', 'name', 'anchor_role', 'action', 'created_at']))
      // 决定日志只允许 register/revoke，非法动作由 CHECK 拒绝。
      expect(() => db.prepare(`INSERT INTO character_cast_decisions
        (decision_id,name,anchor_role,action,source_revision,operation_id,created_at)
        VALUES('d1','老陈','早餐摊摊主','erase',1,'op1','2026-10-15T00:00:00.000Z')`).run())
        .toThrow(/CHECK/u)

      expect(verifySchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 9).version).toBe(9)
      // 幂等：再次迁移不产生步骤、不改指纹。
      const fingerprint = sqliteSchemaFingerprint(db)
      expect(migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 9).completedSteps).toEqual([])
      expect(sqliteSchemaFingerprint(db)).toBe(fingerprint)
    } finally { db.close() }
  })

  it('rolls back a failed M08 verification without changing v8 data or schema', () => {
    const db = fixture()
    try {
      const registry = getDesktopMigrationRegistry(), before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(registry.implementations.map(step => step.id === 'M08'
        ? { ...step, verify: () => false } : step), registry.recognizedSchemas)
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, 9)).toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(8)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe('v8 作者正文')
      const columns = (db.prepare('PRAGMA table_info(blueprints)').all() as Array<{ name: string }>).map(item => item.name)
      expect(columns).not.toContain('structured_refs')
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='character_cast_decisions'").get()).toBeUndefined()
    } finally { db.close() }
  })
})
