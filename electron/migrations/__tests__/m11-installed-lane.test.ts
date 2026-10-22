import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry } from '../registry'
import { migrateSchema, verifySchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M11（v11 → v12）：`resources` + `resource_movements`（W6 资源账本）。
 *
 * 本 lane 真正要守的不是「两张表建出来了」，而是三条形状：
 * 1. `resources.name` 的唯一约束**真的会拒重复**（权威值只能定义一次，判据 DI）；
 * 2. `delta` **notnull 且无默认值** ——「缺失」必须表现为「没有这条行」，不能是「+0」；
 * 3. 外键 **RESTRICT 不是 CASCADE** —— 误删资源必须报错，不能连历史一起清空。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 11)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v11 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  db.prepare('INSERT INTO summary_snapshots(draft_id, chapter_number, chapter_notes, story_day_offset, story_day_label) VALUES(1, 1, ?, 3, ?)')
    .run('旧章节要点', '第三日')
  return db
}

const RESOURCE_COLUMNS = ['resource_id', 'family_id', 'name', 'tier', 'unit', 'anchor_value', 'period',
  'earn_note', 'cost_note', 'scarcity_note', 'anchor_note', 'created_at', 'updated_at']
const MOVEMENT_COLUMNS = ['id', 'chapter_number', 'resource_id', 'delta', 'unit', 'evidence', 'source', 'created_at']

type Column = { name: string; notnull: number; dflt_value: string | null }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

describe('installed M11 lane', () => {
  it('migrates recognized v11 to v12 without touching existing author data', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      const draftBefore = db.prepare('SELECT chapter_number, version, content_id, word_count FROM drafts WHERE id=1').get()
      const snapshotBefore = db.prepare('SELECT chapter_notes, story_day_offset, story_day_label FROM summary_snapshots WHERE chapter_number=1').get()

      const result = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12)

      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBe(12)
      expect(result.completedSteps).toEqual(['M11'])
      expect(db.pragma('user_version', { simple: true })).toBe(12)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare('SELECT chapter_number, version, content_id, word_count FROM drafts WHERE id=1').get()).toEqual(draftBefore)
      expect(db.prepare('SELECT chapter_notes, story_day_offset, story_day_label FROM summary_snapshots WHERE chapter_number=1').get())
        .toEqual(snapshotBefore)
      expect(verifySchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12).version).toBe(12)
    } finally { db.close() }
  })

  it('is idempotent: a second run completes no steps and leaves the fingerprint unchanged', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12)
      const fingerprint = sqliteSchemaFingerprint(db)
      expect(migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12).completedSteps).toEqual([])
      expect(sqliteSchemaFingerprint(db)).toBe(fingerprint)
      expect(db.prepare('SELECT COUNT(*) FROM resources').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('lands both tables with the contracted columns, an undeletable-by-default delta and a unique name', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12)
      expect(columns(db, 'resources').map(column => column.name)).toEqual(RESOURCE_COLUMNS)
      expect(columns(db, 'resource_movements').map(column => column.name)).toEqual(MOVEMENT_COLUMNS)

      const delta = columns(db, 'resource_movements').find(column => column.name === 'delta')
      // 缺失 = 没有这条行。若 delta 带 DEFAULT 0，「未抽到」就会被记成「本章 ±0」。
      expect(delta).toMatchObject({ notnull: 1, dflt_value: null })
      expect(columns(db, 'resource_movements').find(column => column.name === 'unit')?.notnull).toBe(1)
      expect(columns(db, 'resources').find(column => column.name === 'anchor_value')?.notnull).toBe(0)

      db.prepare(`INSERT INTO resources(resource_id,name,unit,period) VALUES('res:1','下品灵石','枚','日')`).run()
      expect(() => db.prepare(`INSERT INTO resources(resource_id,name,unit,period) VALUES('res:2','下品灵石','块','日')`).run())
        .toThrow(/UNIQUE/u)
    } finally { db.close() }
  })

  it('rolls back a failed M11 verification and leaves the schema at v11 without the new tables', () => {
    const db = fixture()
    try {
      const registry = getDesktopMigrationRegistry(), before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(registry.implementations.map(step => step.id === 'M11'
        ? { ...step, verify: () => false } : step), registry.recognizedSchemas)
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, 12)).toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(11)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all()
      expect(tables).not.toContain('resources')
      expect(tables).not.toContain('resource_movements')
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe('v11 作者正文')
    } finally { db.close() }
  })

  it('refuses to delete a resource that still has movements instead of cascading them away', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12)
      db.prepare(`INSERT INTO resources(resource_id,name,unit,period) VALUES('res:1','下品灵石','枚','日')`).run()
      db.prepare(`INSERT INTO resource_movements(chapter_number,resource_id,delta,unit,evidence,source)
        VALUES(0,'res:1',30,'枚','开篇三十枚','author')`).run()
      expect(() => db.prepare("DELETE FROM resources WHERE resource_id='res:1'").run())
        .toThrow(/FOREIGN KEY|constraint/iu)
      expect(db.prepare('SELECT COUNT(*) FROM resource_movements').pluck().get()).toBe(1)
    } finally { db.close() }
  })
})
