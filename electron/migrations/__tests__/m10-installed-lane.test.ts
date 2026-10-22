import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry } from '../registry'
import { migrateSchema, verifySchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M10（v10 → v11）：`summary_snapshots.story_day_offset` / `story_day_label`。
 * 这两列的全部价值在于「缺失」与「第 0 日」不同形，所以本 lane 最重要的一条断言
 * 不是「列加上了」，而是**既有行落成 NULL 而不是 0**。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 10)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v10 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 777)').run()
  // 既有快照行：迁移必须让它保持「日序未知」，不能凭空变成第 0 日。
  db.prepare('INSERT INTO summary_snapshots(draft_id, chapter_number, chapter_notes) VALUES(1, 1, ?)').run('旧章节要点')
  return db
}

describe('installed M10 lane', () => {
  it('migrates recognized v10 to v11 and leaves existing snapshots with an unknown day order', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      const notesBefore = db.prepare('SELECT chapter_notes FROM summary_snapshots WHERE chapter_number=1').pluck().get()
      const result = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 11)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBe(12)
      expect(result.completedSteps).toEqual(['M10'])
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare('SELECT chapter_notes FROM summary_snapshots WHERE chapter_number=1').pluck().get()).toBe(notesBefore)

      const columns = (db.prepare('PRAGMA table_info(summary_snapshots)').all() as Array<{ name: string; notnull: number }>)
      expect(columns.find(item => item.name === 'story_day_offset')?.notnull).toBe(0)
      expect(columns.find(item => item.name === 'story_day_label')?.notnull).toBe(0)
      // NULL = 没算出来。若这里读出 0，全书日序会被整体当成「开篇当日」。
      expect(db.prepare('SELECT story_day_offset FROM summary_snapshots WHERE chapter_number=1').pluck().get()).toBeNull()
      expect(db.prepare('SELECT story_day_label FROM summary_snapshots WHERE chapter_number=1').pluck().get()).toBeNull()

      expect(verifySchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 11).version).toBe(11)
      // 幂等：再次迁移不产生步骤、不改指纹。
      const fingerprint = sqliteSchemaFingerprint(db)
      expect(migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 11).completedSteps).toEqual([])
      expect(sqliteSchemaFingerprint(db)).toBe(fingerprint)
    } finally { db.close() }
  })

  it('rolls back a failed M10 verification without changing v10 data or schema', () => {
    const db = fixture()
    try {
      const registry = getDesktopMigrationRegistry(), before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(registry.implementations.map(step => step.id === 'M10'
        ? { ...step, verify: () => false } : step), registry.recognizedSchemas)
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, 11)).toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(10)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe('v10 作者正文')
      const columns = (db.prepare('PRAGMA table_info(summary_snapshots)').all() as Array<{ name: string }>)
        .map(column => column.name)
      expect(columns).not.toContain('story_day_offset')
      expect(columns).not.toContain('story_day_label')
    } finally { db.close() }
  })
})
