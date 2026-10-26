import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M21（v21 → v22）：`secrets`（P20-2 秘密宿体 / 谁在捂什么）。
 *
 * 这个 lane 守五条形状：
 * 1. **主语是秘密，不是人**：没有 `character_id`，隐瞒者与被骗者都是名字数组
 *    （势力不是 `characters` 行；写世界观时角色卡常还没建）；
 * 2. `UNIQUE(title)` 挡「同一个秘密登记两次」；
 * 3. `reveal_chapter` **可空且 NULL 有语义**（作者还没决定第几章穿，按「任何章都算未揭穿」处理），
 *    非空时必须为正 —— 0 会被读成序章；
 * 4. `evidence` 与时间戳三列可空（空 = 作者没记，不是空串）；
 * 5. 迁移不动既有作者数据，重跑不改指纹。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 21)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v21 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const INSERT = `INSERT INTO secrets(
  secret_id,title,detail,holder_names,unaware_names,reveal_chapter,evidence,source)
  VALUES(?,?,?,?,?,?,?,?)`

describe('installed M21 lane', () => {
  it('升到最新版本，建出 secrets，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(22)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='secrets'")
        .pluck().get()).toBe('secrets')
      // 揭穿章索引：审稿链按章筛未揭穿的秘密。
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='secrets' AND name LIKE 'idx_%'")
        .pluck().all()).toEqual(['idx_secrets_reveal'])
    } finally { db.close() }
  })

  it('10 列、可空性与 CHECK：揭穿章可空，非空时必须为正', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'secrets').map(column => column.name)).toEqual([
        'secret_id', 'title', 'detail', 'holder_names', 'unaware_names',
        'reveal_chapter', 'evidence', 'source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'secrets').find(column => column.name === name)
      // 三处「空值有意义」的列可空
      for (const optional of ['reveal_chapter', 'evidence', 'created_at', 'updated_at']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      // 秘密名、真相、两个名字数组、来源缺一个都不是一条秘密
      for (const filled of ['title', 'detail', 'holder_names', 'unaware_names', 'source']) {
        expect(byName(filled)?.notnull).toBe(1)
      }
      // ★ 主语是秘密不是人：表里不许出现 character_id（那是 M16 的形状，混进来就会
      //   有人按「一角色一行」去塞，一个秘密 N 个知情者当场分裂成 N 行）。
      expect(byName('character_id')).toBeUndefined()

      const insert = db.prepare(INSERT)
      // 章号 0 会被读成「序章」
      expect(() => insert.run('s:zero', '柳长老试药', '真相', '["柳长老"]', '[]', 0, null, 'author')).toThrow()
      // 揭穿章未定（NULL）合法
      expect(() => insert.run('s:null', '宗主改账', '真相', '["宗主"]', '[]', null, null, 'author')).not.toThrow()
      // 正整数合法
      expect(() => insert.run('s:twelve', '试药残篇', '真相', '["柳长老"]', '["众弟子"]', 12, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('UNIQUE(title)：同名拒，不同名允许（哪怕真相相同）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const insert = db.prepare(INSERT)
      insert.run('s:1', '试药残篇', '真相 A', '["柳长老"]', '[]', 12, null, 'author')
      // 同名 ⇒ 拒（同一个秘密不该登记两条）
      expect(() => insert.run('s:2', '试药残篇', '真相 B', '["周账房"]', '[]', 30, null, 'author')).toThrow()
      // 不同名、同样的真相 ⇒ 允许：语义重复数据库拦不住，只能靠作者自己看。
      expect(() => insert.run('s:3', '柳长老拿弟子试药', '真相 A', '["柳长老"]', '[]', 12, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('可空列写 NULL 而不是空串（揭穿章未定是状态，不是 0）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      db.prepare(INSERT).run('s:none', '未定的秘密', '真相', '[]', '[]', null, null, 'author')
      const row = db.prepare('SELECT reveal_chapter, evidence, created_at, updated_at FROM secrets WHERE secret_id=?')
        .get('s:none') as { reveal_chapter: number | null; evidence: string | null; created_at: string | null; updated_at: string | null }
      expect(row.reveal_chapter).toBeNull()
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
      expect(db.prepare('SELECT COUNT(*) FROM secrets').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M21' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(21)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all())
        .not.toContain('secrets')
    } finally { db.close() }
  })
})
