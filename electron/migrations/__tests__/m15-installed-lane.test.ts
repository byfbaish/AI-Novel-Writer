import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M15（v15 → v16）：`institution_cadences`（P1-1 制度 / 周期事件）。
 *
 * 这个 lane 要守的不是「表建出来了」，而是五条形状：
 * 1. `name` UNIQUE —— 一条记录 = 一个周期事件；
 * 2. `axis` 只有两个值、`interval` 必须为正 —— 这两条错了判定表就没有意义；
 * 3. 七处「空值有意义」的列**可空**：锚空 = 没登记过（判 unknown，不是 not_due），
 *    降级轴空 = 写前日序不可判，`chapter_number` 空 = 没标出处章；
 * 4. `anchor_story_day = 0` 合法（故事开始当天），而**章号 0 非法**（会被读成序章）；
 * 5. 迁移不动既有作者数据，且重跑不改指纹。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 15)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v15 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const INSERT = `INSERT INTO institution_cadences(
  cadence_id,name,axis,interval,anchor_chapter,anchor_story_day,fallback_interval_chapters,
  note,chapter_number,evidence,source) VALUES(?,?,?,?,?,?,?,?,?,?,?)`

describe('installed M15 lane', () => {
  it('升到最新版本，建出 institution_cadences，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(16)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='institution_cadences'")
        .pluck().get()).toBe('institution_cadences')
    } finally { db.close() }
  })

  it('列名/可空性与 CHECK：七个空值有意义的列可空，轴只有两值，间隔与章号必须为正', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'institution_cadences').map(column => column.name)).toEqual([
        'cadence_id', 'name', 'axis', 'interval', 'anchor_chapter', 'anchor_story_day',
        'fallback_interval_chapters', 'note', 'chapter_number', 'evidence', 'source',
        'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'institution_cadences').find(column => column.name === name)
      for (const optional of ['anchor_chapter', 'anchor_story_day', 'fallback_interval_chapters',
        'note', 'chapter_number', 'evidence', 'created_at', 'updated_at']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      for (const filled of ['name', 'axis', 'interval', 'source']) {
        expect(byName(filled)?.notnull).toBe(1)
      }

      const insert = db.prepare(INSERT)
      // 轴只有两个值：写第三个值必须被拒（判定表没有第三个分支）
      expect(() => insert.run('c:axis', '签到', 'week', 7, 1, null, null, null, null, null, 'author')).toThrow()
      // 每隔 0 章没有意义
      expect(() => insert.run('c:interval', '签到', 'chapter', 0, 1, null, null, null, null, null, 'author')).toThrow()
      // 章号 0 会被读成「序章」，必须拒
      expect(() => insert.run('c:chapter', '签到', 'chapter', 7, 0, null, null, null, null, null, 'author')).toThrow()
      expect(() => insert.run('c:fallback', '签到', 'story-day', 7, 1, 0, 0, null, null, null, 'author')).toThrow()
      // 日序 0 = 故事开始当天，合法
      expect(() => insert.run('c:day', '签到', 'story-day', 7, 1, 0, 3, null, null, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('name 真的拒重复（一条记录 = 一个周期事件）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const insert = db.prepare(INSERT)
      insert.run('cadence:1', '月例', 'chapter', 10, 12, null, null, '外门弟子', 3, null, 'author')
      expect(() => insert.run('cadence:2', '月例', 'story-day', 7, 12, 9, 3, null, null, null, 'author')).toThrow()
      expect(() => insert.run('cadence:3', '送账日', 'story-day', 7, 12, 9, 3, null, null, null, 'author'))
        .not.toThrow()
    } finally { db.close() }
  })

  it('锚为空是合法的「没登记过」，不是 0（空 ≠ 0）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      db.prepare(INSERT).run('c:none', '巡夜', 'story-day', 3, null, null, null, null, null, null, 'author')
      const row = db.prepare(`SELECT anchor_chapter, anchor_story_day, fallback_interval_chapters,
        note, chapter_number, evidence FROM institution_cadences WHERE cadence_id=?`).get('c:none') as {
        anchor_chapter: number | null; anchor_story_day: number | null
        fallback_interval_chapters: number | null; note: string | null
        chapter_number: number | null; evidence: string | null
      }
      expect(row.anchor_chapter).toBeNull()
      expect(row.anchor_story_day).toBeNull()
      expect(row.fallback_interval_chapters).toBeNull()
      expect(row.note).toBeNull()
      expect(row.chapter_number).toBeNull()
      expect(row.evidence).toBeNull()
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
      expect(db.prepare('SELECT COUNT(*) FROM institution_cadences').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M15' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(15)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all())
        .not.toContain('institution_cadences')
    } finally { db.close() }
  })
})
