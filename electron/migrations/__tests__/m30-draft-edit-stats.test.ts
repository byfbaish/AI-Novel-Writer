import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { applyM30DraftEditStats, verifyM30DraftEditStats } from '../m30-draft-edit-stats'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'
import { DraftEditStatsRepository } from '../../repositories/draft-edit-stats-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

type Column = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: InstanceType<typeof Database>, table: string): Column[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<Column & { cid: number }>)
    .map(({ cid: _cid, ...column }) => column)
}

function existingTableSql(db: InstanceType<typeof Database>): string[] {
  return (db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'draft_edit_stats'
    ORDER BY name
  `).all() as Array<{ sql: string }>).map(row => row.sql)
}

function fixture(): InstanceType<typeof Database> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v30：M29 已装，M30（草稿计量表）还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 30)
  return db
}

describe('M30 draft edit stats migration', () => {
  it('creates the standalone table without changing existing table structure', () => {
    const db = fixture()
    try {
      const beforeTables = existingTableSql(db)
      const beforeDrafts = columnsOf(db, 'drafts')
      const beforeContents = columnsOf(db, 'contents')

      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(existingTableSql(db)).toEqual(beforeTables)
      expect(columnsOf(db, 'drafts')).toEqual(beforeDrafts)
      expect(columnsOf(db, 'contents')).toEqual(beforeContents)
      expect(columnsOf(db, 'draft_edit_stats')).toEqual([
        { name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
        { name: 'draft_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0 },
        { name: 'at', type: 'TEXT', notnull: 1, dflt_value: "datetime('now')", pk: 0 },
        { name: 'origin', type: 'TEXT', notnull: 1, dflt_value: "'ai'", pk: 0 },
        { name: 'changed_chars', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
        { name: 'old_chars', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
        { name: 'new_chars', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
        { name: 'save_count', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
      ])
      expect(verifyM30DraftEditStats(db)).toBe(true)
    } finally { db.close() }
  })

  it('is reentrant: applying twice does not throw or duplicate the table', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const fingerprint = sqliteSchemaFingerprint(db)
      expect(() => applyM30DraftEditStats(db)).not.toThrow()
      expect(() => applyM30DraftEditStats(db)).not.toThrow()
      expect(db.prepare(`
        SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'draft_edit_stats'
      `).pluck().get()).toBe(1)
      const again = migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(again.completedSteps).toEqual([])
      expect(sqliteSchemaFingerprint(db)).toBe(fingerprint)
    } finally { db.close() }
  })

  it('accumulates save_count per draft and keeps every event row', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      DraftEditStatsRepository.record({
        draftId: 9, origin: 'human', changedChars: 10, oldChars: 100, newChars: 100,
      }, db)
      DraftEditStatsRepository.record({
        draftId: 9, origin: 'ai', changedChars: 3, oldChars: 100, newChars: 98,
      }, db)

      expect(DraftEditStatsRepository.listForDraft(9, db)).toMatchObject([
        { draft_id: 9, origin: 'human', changed_chars: 10, old_chars: 100, new_chars: 100, save_count: 1 },
        { draft_id: 9, origin: 'ai', changed_chars: 3, old_chars: 100, new_chars: 98, save_count: 2 },
      ])
      expect(db.prepare('SELECT origin FROM draft_edit_stats WHERE draft_id = 9 ORDER BY id').pluck().all())
        .toEqual(['human', 'ai'])
    } finally { db.close() }
  })
})
