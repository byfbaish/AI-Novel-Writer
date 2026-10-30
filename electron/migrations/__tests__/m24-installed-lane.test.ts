import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M24（v24 → v25）：新建 `upstream_revisions`。
 *
 * 这个 lane 守五条：
 * 1. **建表不重建任何既有表** —— 上游内容是 `project_core` 的列，不动它；
 * 2. **六列齐全** —— 缺 `changed_chapters` 会让单章手改退化成整批判脏；
 * 3. **`rev` 非空且默认 0** —— 可空会让版本比较变成三态（null 既不是落后也不算相等）；
 * 4. 重跑幂等（表已在就跳过，不改写 `sqlite_master`）；
 * 5. verify 失败回滚整步（表与 `user_version` 一起退）。
 *
 * 另有一条**主键形状**断言：这张表的全部语义建立在「一个域一个作用域一行」上，
 * 主键错了就会允许 `worldbuilding:book` 出现两行，读取时取哪一行全凭运气。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v24：M23 已加过 keep_draft，但 upstream_revisions 还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 24)
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  db.prepare("UPDATE project_core SET worldbuilding = ?, synopsis = ? WHERE id = 'main'")
    .run('v24 的世界观', 'v24 的大纲')
  return db
}

type Column = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: InstanceType<typeof Database>): Column[] {
  return db.prepare('PRAGMA table_info(upstream_revisions)').all() as Column[]
}

function hasTable(db: InstanceType<typeof Database>): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='upstream_revisions'").get())
}

describe('installed M24 lane', () => {
  it('升到最新版本，建出 upstream_revisions，且不动既有上游内容', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(25)
      expect(hasTable(db)).toBe(true)
      const core = db.prepare("SELECT worldbuilding, synopsis FROM project_core WHERE id='main'").get()
      expect(core).toEqual({ worldbuilding: 'v24 的世界观', synopsis: 'v24 的大纲' })
      // 新建表必须是空的：升级不该凭空造出「第 1 版」，那会让所有存量派生
      // 在第一次判定时看到「上游变过」（它们根本没记过 source_ref，应判 legacy）。
      expect(db.prepare('SELECT COUNT(*) FROM upstream_revisions').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('六列齐全，rev 非空且默认 0', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const columns = columnsOf(db)
      const names = columns.map(column => column.name)
      for (const required of ['domain', 'scope', 'rev', 'digest', 'changed_chapters', 'updated_at']) {
        expect(names).toContain(required)
      }
      const rev = columns.find(column => column.name === 'rev')!
      expect(rev.notnull).toBe(1)
      expect(rev.dflt_value).toBe('0')
      const changed = columns.find(column => column.name === 'changed_chapters')!
      expect(changed.notnull).toBe(1)
      expect(changed.dflt_value).toBe("'[]'")
    } finally { db.close() }
  })

  it('主键是 (domain, scope)：一个域一个作用域只能有一行', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const primaryKey = columnsOf(db).filter(column => column.pk > 0).sort((left, right) => left.pk - right.pk)
      expect(primaryKey.map(column => column.name)).toEqual(['domain', 'scope'])
      db.prepare("INSERT INTO upstream_revisions(domain, scope, rev) VALUES('worldbuilding','book',1)").run()
      expect(() => db.prepare(
        "INSERT INTO upstream_revisions(domain, scope, rev) VALUES('worldbuilding','book',2)",
      ).run()).toThrow(/UNIQUE/)
      // 同域不同作用域必须允许（大纲按单元分版的前提）
      expect(() => db.prepare(
        "INSERT INTO upstream_revisions(domain, scope, rev) VALUES('outline','u07',1)",
      ).run()).not.toThrow()
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
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与那张表）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M24' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(24)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(hasTable(db)).toBe(false)
    } finally { db.close() }
  })
})
