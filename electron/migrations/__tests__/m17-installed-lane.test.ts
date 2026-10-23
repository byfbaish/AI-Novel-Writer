import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M17（v17 → v18）：`power_abilities`（P1-1 能力 / 本书级能力规则）。
 *
 * 这个 lane 守六条形状：
 * 1. **表里没有 `character_id`**：角色技能在 `characters.abilities`，再登一份就是第二套账；
 * 2. `name` 单列 UNIQUE（同名两条会让「说的是哪一条」无法回答）；
 * 3. `stage_chapter` 只能为空或正整数（0 会被读成「序章」）；`undated` 是主路径；
 * 4. `evidence_scope` 只允许三档（数据完整性，不是创作自由度）；
 * 5. **`form` 上没有 CHECK**：混合形态是真实数据，词表外值必须一字不差地读回来；
 * 6. 迁移不动既有作者数据，重跑不改指纹。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 17)
  db.prepare("INSERT INTO characters (character_id,name,role) VALUES ('character:guchangfeng','顾长风','protagonist')").run()
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v17 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const INSERT = `INSERT INTO power_abilities(
  ability_id,name,form,hard_limit,weakness,cost_note,stage_chapter,stage_note,
  evidence,evidence_scope,source) VALUES(?,?,?,?,?,?,?,?,?,?,?)`

describe('installed M17 lane', () => {
  it('升到最新版本，建出 power_abilities，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(18)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='power_abilities'")
        .pluck().get()).toBe('power_abilities')
      // 索引按 stage_chapter 建：生成链要按「能不能用」筛，面板要按章号扫。
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='power_abilities' AND name LIKE 'idx_%'")
        .pluck().all()).toEqual(['idx_power_abilities_stage'])
    } finally { db.close() }
  })

  it('13 列、可空性与两处 CHECK；`form` 上没有任何 CHECK', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'power_abilities').map(column => column.name)).toEqual([
        'ability_id', 'name', 'form', 'hard_limit', 'weakness', 'cost_note',
        'stage_chapter', 'stage_note', 'evidence', 'evidence_scope', 'source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'power_abilities').find(column => column.name === name)
      // 十处「空值有意义」的列可空（空 = 作者没登记，不是空串）。
      for (const optional of ['form', 'hard_limit', 'weakness', 'cost_note', 'stage_chapter',
        'stage_note', 'evidence', 'evidence_scope', 'created_at', 'updated_at']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      for (const filled of ['name', 'source']) expect(byName(filled)?.notnull).toBe(1)
      // 表里刻意没有 character_id：角色技能的家是 characters.abilities。
      expect(byName('character_id')).toBeUndefined()

      const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='power_abilities'")
        .pluck().get() as string).replace(/\s+/gu, ' ')
      expect(sql).toContain('CHECK(stage_chapter IS NULL OR stage_chapter > 0)')
      expect(sql).toContain("CHECK(evidence_scope IS NULL OR evidence_scope IN ('golden-finger','worldbuilding','chapter'))")
      // 提案 §3.2：混合形态是真实数据，`form` 不许有 CHECK。
      expect(sql).toMatch(/\bform TEXT\b/u)
      expect(sql).not.toMatch(/CHECK\s*\(\s*form\b/u)
      expect(sql).not.toMatch(/\bform TEXT\s+CHECK/u)

      const insert = db.prepare(INSERT)
      // 0 会被读成「序章」；负章号同样非法。
      expect(() => insert.run('a:zero', '零章能力', null, null, null, null, 0, null, null, null, 'author')).toThrow()
      expect(() => insert.run('a:neg', '负章能力', null, null, null, null, -3, null, null, null, 'author')).toThrow()
      // 空 = undated（主路径），永远合法。
      expect(() => insert.run('a:undated', '未标章号能力', null, null, null, null, null, null, null, null, 'author')).not.toThrow()
      // 出处域只允许三档；空也合法。
      expect(() => insert.run('a:bad-scope', '错出处', null, null, null, null, null, null, null, 'wiki', 'author')).toThrow()
      expect(() => insert.run('a:scope', '好出处', null, null, null, null, null, null, null, 'worldbuilding', 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('name 单列 UNIQUE：同名拒，不同名允许（与 ability_id 无关）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const insert = db.prepare(INSERT)
      insert.run('a:1', '噬魂推演录', null, null, null, null, null, null, null, null, 'author')
      expect(() => insert.run('a:2', '噬魂推演录', null, null, null, null, null, null, null, null, 'author')).toThrow()
      expect(() => insert.run('a:3', '每日一次的现实编辑权', null, null, null, null, null, null, null, null, 'author')).not.toThrow()
    } finally { db.close() }
  })

  it('可空列写 NULL 而不是空串；词表外的 form 原样读回（不设 CHECK 的证明）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const exotic = '规则·功法·天赋混合（寄生于重生神魂）'
      db.prepare(INSERT).run('a:exotic', '噬魂推演录', exotic, null, null, null, null, null, null, null, 'author')
      const row = db.prepare(`SELECT form, hard_limit, weakness, cost_note, stage_chapter,
        stage_note, evidence, evidence_scope, created_at, updated_at FROM power_abilities WHERE ability_id=?`)
        .get('a:exotic') as Record<string, string | null>
      expect(row.form).toBe(exotic)
      for (const optional of ['hard_limit', 'weakness', 'cost_note', 'stage_chapter',
        'stage_note', 'evidence', 'evidence_scope', 'created_at', 'updated_at']) {
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
      expect(db.prepare('SELECT COUNT(*) FROM power_abilities').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M17' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(17)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all())
        .not.toContain('power_abilities')
    } finally { db.close() }
  })
})
