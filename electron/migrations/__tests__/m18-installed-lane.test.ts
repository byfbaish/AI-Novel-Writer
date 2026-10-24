import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M18（v18 → v19）：`volume_handoffs`（P1-2 卷末交接单）。
 *
 * 这个 lane 守六条形状：
 * 1. 升到 19 且**不动既有作者数据**；
 * 2. **13 列**，五处「空值有意义」的列可空，其余 NOT NULL；
 * 3. `volume_index` 单列 UNIQUE（同名两卷会让「上一卷是哪卷」无法回答）；
 * 4. 三个 `_json` 列的默认是 `'[]'` 而**不是 NULL**（读侧不必区分两种空）；
 * 5. 幂等：重跑不产生步骤、不改指纹；
 * 6. 三处 CHECK 真有牙齿（`last_chapter < first_chapter` 被拒）。
 *
 * ⚠️ 这是**历史 lane**：M19（P1-2 期 1b）把 `volume_handoffs` 重建成了 11 列 + `volume_id` 外键。
 * 所以下面测「13 列形状」的四条必须**停在 v19**（`M18_TARGET`），不能跑 `CURRENT`——
 * 跑到底时表已经被重建，测的就不是 M18 了。v20 的形状由 `m19-installed-lane` 守。
 */
const M18_TARGET = 19
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 18)
  db.prepare("INSERT INTO characters (character_id,name,role) VALUES ('character:guchangfeng','顾长风','protagonist')").run()
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v18 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const INSERT = `INSERT INTO volume_handoffs(
  handoff_id,volume_index,first_chapter,last_chapter,world_state,hero_state,
  events_json,items_json,debts_json,open_thread,source) VALUES(?,?,?,?,?,?,?,?,?,?,?)`

describe('installed M18 lane', () => {
  it('升到最新版本，建出 volume_handoffs，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(19)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='volume_handoffs'")
        .pluck().get()).toBe('volume_handoffs')
      // 与 M14/M15/M17 一致：单列唯一写在列上，**不另建** idx_ 索引。
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='volume_handoffs' AND name LIKE 'idx_%'")
        .pluck().all()).toEqual([])
    } finally { db.close() }
  })

  it('13 列、可空性与三处 CHECK；主键被判成 pk=1 而不是 notnull', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), M18_TARGET)
      expect(columns(db, 'volume_handoffs').map(column => column.name)).toEqual([
        'handoff_id', 'volume_index', 'first_chapter', 'last_chapter', 'world_state',
        'hero_state', 'events_json', 'items_json', 'debts_json', 'open_thread', 'source',
        'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'volume_handoffs').find(column => column.name === name)
      // 五处「空值有意义」的列可空（空 = 作者没填，不是空串）。
      for (const optional of ['world_state', 'hero_state', 'open_thread', 'created_at', 'updated_at']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      for (const filled of ['volume_index', 'first_chapter', 'last_chapter', 'events_json',
        'items_json', 'debts_json', 'source']) {
        expect(byName(filled)?.notnull).toBe(1)
      }
      // `TEXT PRIMARY KEY` 在 SQLite 里不会被记成 NOT NULL，只能断言 pk=1。
      expect(byName('handoff_id')?.pk).toBe(1)

      const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='volume_handoffs'")
        .pluck().get() as string).replace(/\s+/gu, ' ')
      expect(sql).toContain('CHECK(volume_index > 0)')
      expect(sql).toContain('CHECK(first_chapter > 0)')
      expect(sql).toContain('CHECK(last_chapter >= first_chapter)')
    } finally { db.close() }
  })

  it('volume_index 单列 UNIQUE：同卷号拒，不同卷号允许', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), M18_TARGET)
      const insert = db.prepare(INSERT)
      insert.run('h:1', 1, 1, 20, null, null, '[]', '[]', '[]', null, 'author')
      expect(() => insert.run('h:dup', 1, 21, 40, null, null, '[]', '[]', '[]', null, 'author')).toThrow()
      expect(() => insert.run('h:2', 2, 21, 40, null, null, '[]', '[]', '[]', null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('三个 JSON 列在未赋值时是 `[]` 字符串，不是 NULL；文本列留 NULL', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), M18_TARGET)
      db.prepare('INSERT INTO volume_handoffs(handoff_id,volume_index,first_chapter,last_chapter,source) VALUES(?,?,?,?,?)')
        .run('h:default', 1, 1, 20, 'author')
      const row = db.prepare(`SELECT world_state, hero_state, events_json, items_json, debts_json,
        open_thread, created_at, updated_at FROM volume_handoffs WHERE handoff_id=?`)
        .get('h:default') as Record<string, string | null>
      expect(row.events_json).toBe('[]')
      expect(row.items_json).toBe('[]')
      expect(row.debts_json).toBe('[]')
      for (const optional of ['world_state', 'hero_state', 'open_thread', 'created_at', 'updated_at']) {
        expect(row[optional]).toBeNull()
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
      expect(db.prepare('SELECT COUNT(*) FROM volume_handoffs').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('CHECK 有牙齿：卷号/首章必须为正，末章不得小于首章', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), M18_TARGET)
      const insert = db.prepare(INSERT)
      // 卷号 0 会被读成「序卷」；负卷号同样非法。
      expect(() => insert.run('h:zero-volume', 0, 1, 20, null, null, '[]', '[]', '[]', null, 'author')).toThrow()
      // 首章 0 会被读成「序章」。
      expect(() => insert.run('h:zero-first', 1, 0, 20, null, null, '[]', '[]', '[]', null, 'author')).toThrow()
      // 区间倒置 = 这条交接单永远匹配不到任何一章，属写入错误。
      expect(() => insert.run('h:reversed', 1, 20, 19, null, null, '[]', '[]', '[]', null, 'author')).toThrow()
      // 单章区间合法（<=）。
      expect(() => insert.run('h:single', 1, 20, 20, null, null, '[]', '[]', '[]', null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M18' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(18)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all())
        .not.toContain('volume_handoffs')
    } finally { db.close() }
  })
})
