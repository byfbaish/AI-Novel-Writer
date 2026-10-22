import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry } from '../registry'
import { migrateSchema, verifySchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 7)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v7 作者正文')
  return db
}

describe('installed M07 lane', () => {
  it('migrates recognized v7 without changing author content and verifies v8 reopen', () => {
    const db = fixture()
    try {
      const before = db.prepare('SELECT body FROM contents').pluck().get()
      const result = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 8)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBe(12)
      expect(result.completedSteps).toEqual(['M07'])
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(before)
      // 新列以 NOT NULL DEFAULT '' 落地，消费点在它为空时回退到枚举模板。
      const column = (db.prepare('PRAGMA table_info(project_core)').all() as Array<{ name: string; notnull: number }>)
        .find(item => item.name === 'plot_structure_plan')
      expect(column?.notnull).toBe(1)
      expect(verifySchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 8).version).toBe(8)
      expect(migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 8).completedSteps).toEqual([])
    } finally { db.close() }
  })

  it('rolls back a failed M07 verification without changing v7 data or schema', () => {
    const db = fixture()
    try {
      const registry = getDesktopMigrationRegistry(), before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(registry.implementations.map(step => step.id === 'M07'
        ? { ...step, verify: () => false } : step), registry.recognizedSchemas)
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, 8)).toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(7)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe('v7 作者正文')
      const columns = (db.prepare('PRAGMA table_info(project_core)').all() as Array<{ name: string }>).map(c => c.name)
      expect(columns).not.toContain('plot_structure_plan')
    } finally { db.close() }
  })
})
