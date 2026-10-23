import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M12（v12 → v13）：`chapter_staleness_acknowledgements`（P0-1 前提变更确认）。
 *
 * 这个 lane 要守的不是「表建出来了」，而是三条形状：
 * 1. **复合主键真的会拒重复**：同章同代只能有一条确认（否则回显会翻倍）；
 * 2. **`reason` NOT NULL 且无默认值** —— 确认必须给理由，空理由等于静默放行；
 * 3. 迁移不动既有作者数据（正文/要点原样）。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 12)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v12 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

describe('installed M12 lane', () => {
  it('升到最新版本，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_staleness_acknowledgements'")
        .pluck().get()).toBe('chapter_staleness_acknowledgements')
    } finally { db.close() }
  })

  it('复合主键 (章号, 世代) 会拒重复，但同章不同世代可以共存', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const insert = db.prepare(
        'INSERT INTO chapter_staleness_acknowledgements(chapter_number, acknowledged_generation, reason) VALUES(?,?,?)',
      )
      insert.run(3, 5, '第 2 章只改了错别字')
      expect(() => insert.run(3, 5, '重复确认')).toThrow()
      // 世代不同就是另一次确认：世界变了，作者重新确认过
      expect(() => insert.run(3, 6, '第 2 章又改了一次，仍不影响第 3 章')).not.toThrow()
    } finally { db.close() }
  })

  it('reason 是必填（NOT NULL 且无默认值），不能静默填成空串', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const reason = columns(db, 'chapter_staleness_acknowledgements')
        .find(column => column.name === 'reason')
      expect(reason?.notnull).toBe(1)
      expect(reason?.dflt_value).toBeNull()
      expect(() => db.prepare(
        'INSERT INTO chapter_staleness_acknowledgements(chapter_number, acknowledged_generation) VALUES(?,?)',
      ).run(3, 5)).toThrow()
    } finally { db.close() }
  })
})
