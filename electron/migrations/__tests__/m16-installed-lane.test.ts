import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M16（v16 → v17）：`knowledge_states`（P1-1 信息流 / 谁知道什么）。
 *
 * 这个 lane 守五条形状：
 * 1. **主语是 `character_id`、表里没有名字列**（M02 之后 `characters.name` 不再唯一）；
 * 2. `UNIQUE(character_id, fact_key)` 挡的是「同一角色对同一条事实重复登记」，
 *    不同角色对同一事实、同一角色对不同事实都必须照常允许；
 * 3. `CHECK(learned_chapter >= fact_chapter)` 挡「先于事实存在就知道」；
 * 4. 章号 0 非法（会被读成序章）；`evidence` / 时间戳三列可空（空 = 作者没记，不是空串）；
 * 5. 迁移不动既有作者数据，重跑不改指纹。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 16)
  db.prepare("INSERT INTO characters (character_id,name,role) VALUES ('character:guchangfeng','顾长风','supporting')").run()
  db.prepare("INSERT INTO characters (character_id,name,role) VALUES ('character:xiaozheng','小郑','minor')").run()
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v16 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const INSERT = `INSERT INTO knowledge_states(
  knowledge_id,character_id,fact_chapter,fact_evidence,fact_evidence_hash,fact_key,
  learned_chapter,evidence,source) VALUES(?,?,?,?,?,?,?,?,?)`

const HASH = 'a'.repeat(64)
const KEY = 'kf:0123456789abcdef'

describe('installed M16 lane', () => {
  it('升到最新版本，建出 knowledge_states，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(17)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_states'")
        .pluck().get()).toBe('knowledge_states')
      // 两个索引都建出来：按角色查（面板按人扫）与按得知章查（生成链按期界筛）。
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='knowledge_states' AND name LIKE 'idx_%'")
        .pluck().all()).toEqual(['idx_knowledge_states_character', 'idx_knowledge_states_learned'])
    } finally { db.close() }
  })

  it('11 列、可空性与 CHECK：章号必须为正，得知章不得早于事实章', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'knowledge_states').map(column => column.name)).toEqual([
        'knowledge_id', 'character_id', 'fact_chapter', 'fact_evidence', 'fact_evidence_hash',
        'fact_key', 'learned_chapter', 'evidence', 'source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'knowledge_states').find(column => column.name === name)
      // 三处「空值有意义」的列可空
      for (const optional of ['evidence', 'created_at', 'updated_at']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      // 引用本身缺一个都不是一条知情关系
      for (const filled of ['character_id', 'fact_chapter', 'fact_evidence',
        'fact_evidence_hash', 'fact_key', 'learned_chapter', 'source']) {
        expect(byName(filled)?.notnull).toBe(1)
      }
      // 表里没有名字列：显示名必须读时 JOIN（名字不唯一，存一份会过期）。
      expect(byName('character_name')).toBeUndefined()
      expect(byName('name')).toBeUndefined()

      const insert = db.prepare(INSERT)
      // 章号 0 会被读成「序章」
      expect(() => insert.run('k:zero', 'character:guchangfeng', 0, '引文', HASH, KEY, 1, null, 'author')).toThrow()
      // 先于事实存在就知道：拒
      expect(() => insert.run('k:early', 'character:guchangfeng', 9, '引文', HASH, KEY, 8, null, 'author')).toThrow()
      // 同章得知合法（事实出现在这一章，这一章就知道）
      expect(() => insert.run('k:same', 'character:guchangfeng', 9, '引文', HASH, KEY, 9, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('UNIQUE(character_id, fact_key)：同角色同事实拒，不同角色同事实 / 同角色不同事实允许', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const insert = db.prepare(INSERT)
      insert.run('k:1', 'character:guchangfeng', 9, '灵根检测结果被人改过', HASH, KEY, 12, null, 'author')
      // 同一角色 + 同一条事实（同一个 key）⇒ 拒
      expect(() => insert.run('k:2', 'character:guchangfeng', 9, '灵根检测结果被人改过', HASH, KEY, 13, null, 'author')).toThrow()
      // 换一个角色，同一条事实 ⇒ 允许（两个人可以知道同一件事）
      expect(() => insert.run('k:3', 'character:xiaozheng', 9, '灵根检测结果被人改过', HASH, KEY, 13, null, 'author')).not.toThrow()
      // 同一角色，另一条事实（另一个 key）⇒ 允许
      expect(() => insert.run('k:4', 'character:guchangfeng', 9, '另一起事件', HASH, 'kf:fedcba9876543210', 13, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('可空列写 NULL 而不是空串（空 = 没记出处，不是「记了一个空串」）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      db.prepare(INSERT).run('k:none', 'character:guchangfeng', 9, '引文', HASH, KEY, 12, null, 'author')
      const row = db.prepare(`SELECT evidence, created_at, updated_at FROM knowledge_states WHERE knowledge_id=?`)
        .get('k:none') as { evidence: string | null; created_at: string | null; updated_at: string | null }
      expect(row.evidence).toBeNull()
      expect(row.created_at).toBeNull()
      expect(row.updated_at).toBeNull()
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
      expect(db.prepare('SELECT COUNT(*) FROM knowledge_states').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M16' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(16)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all())
        .not.toContain('knowledge_states')
    } finally { db.close() }
  })
})
