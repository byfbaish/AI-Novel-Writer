import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M14（v14 → v15）：`key_items`（P1-1 关键物品宿体）。
 *
 * 这个 lane 要守的不是「表建出来了」，而是四条形状：
 * 1. `name` UNIQUE —— 一条记录 = 一件有名字的物品，同名多件靠状态短语写；
 * 2. 三处「空值有意义」的列**可空**：`holder_character`（非角色持有）、
 *    `chapter_number`（没标出处章）、`evidence`（没有引文）—— 空 ≠ 0，空 ≠ 空串；
 * 3. `holder_label` / `source` 必填（没有持有者的物品等于没登记）；
 * 4. 迁移不动既有作者数据，且重跑不改指纹。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 14)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v14 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const INSERT = `INSERT INTO key_items(item_id,name,holder_character,holder_label,status_note,chapter_number,evidence,source)
  VALUES(?,?,?,?,?,?,?,?)`

describe('installed M14 lane', () => {
  it('升到最新版本，建出 key_items，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      // M15 起 schema 继续往前走：这里只钉「至少已到 15」，不再钉等于 15。
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(15)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='key_items'").pluck().get())
        .toBe('key_items')
    } finally { db.close() }
  })

  it('列名与可空性：三处空值有意义的列必须可空，holder_label/source 必填', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'key_items').map(column => column.name)).toEqual([
        'item_id', 'name', 'holder_character', 'holder_label', 'status_note',
        'chapter_number', 'evidence', 'source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'key_items').find(column => column.name === name)
      for (const optional of ['holder_character', 'chapter_number', 'evidence']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      expect(byName('holder_label')?.notnull).toBe(1)
      expect(byName('source')?.notnull).toBe(1)
    } finally { db.close() }
  })

  it('name 真的拒重复；同名不同持有者也拒（一条记录 = 一件物品）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const insert = db.prepare(INSERT)
      insert.run('item:1', '麻绳', '顾长风', '顾长风', '串着四枚下品灵石', 3, '他把麻绳绕了两圈', 'author')
      expect(() => insert.run('item:2', '麻绳', '赵无妄', '赵无妄', null, null, null, 'author')).toThrow()
      // 换一个名字就可以共存
      expect(() => insert.run('item:3', '黄纸包', '顾长风', '顾长风', '三天量活气散', 3, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('章节/引文为空是合法的「缺失」，不是 0 或空串默认值', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      db.prepare(INSERT).run('item:9', '欠条', null, '无主', null, null, null, 'author')
      const row = db.prepare('SELECT holder_character, chapter_number, evidence FROM key_items WHERE item_id=?')
        .get('item:9') as { holder_character: string | null; chapter_number: number | null; evidence: string | null }
      expect(row.holder_character).toBeNull()
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
      expect(db.prepare('SELECT COUNT(*) FROM key_items').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M14' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(14)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all()).not.toContain('key_items')
    } finally { db.close() }
  })
})
