import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M27（v27 → v28）：建上游版本的**流水账** `upstream_revision_log`（S6c）。
 *
 * 与 M24 同一组断言（整表新增），对象换成流水表。守的东西比加列多一条：
 * 这是一张**只增不删**的表，所以还要守住「读侧能按 `(domain, scope)` 找到历史」
 * —— 索引不在，版本一多就退化成全表扫，而这条查询将来在每次硬拒文案里都要跑。
 *
 * 额外守一条 M27 独有的：**`upstream_revisions` 的既有行不许被动**。
 * 两张表名字相近、职责相邻，迁移写错表不会报错，只会让「旧没旧」的判断从这一刻起全错。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v27：版本账已有（M24~M26），流水表还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 27)
  db.prepare(`INSERT OR IGNORE INTO upstream_revisions (domain, scope, rev, digest, changed_chapters)
    VALUES ('outline', 'book', 3, 'digest-3', '[12,13]')`).run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const TABLE = 'upstream_revision_log'
const COLUMNS = ['id', 'domain', 'scope', 'rev', 'at', 'reason', 'changed_chapters', 'covers_all'] as const

describe('installed M27 lane', () => {
  it('升到最新版本，表在，索引在，且不动既有版本账', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(28)
      expect(columnsOf(db, TABLE).map(column => column.name)).toEqual([...COLUMNS])
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_upstream_revision_log_key'").get())
        .toBeTruthy()
      // 既有版本账一个字不许动。
      const revisions = db.prepare('SELECT domain, scope, rev, digest, changed_chapters FROM upstream_revisions').all()
      expect(revisions).toEqual([{ domain: 'outline', scope: 'book', rev: 3, digest: 'digest-3', changed_chapters: '[12,13]' }])
      // 新表刚建出来必须是空的 —— 存量项目「没有历史」是事实，不许补造。
      expect(db.prepare(`SELECT COUNT(*) FROM ${TABLE}`).pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('id 是主键、原因是 unknown 且非空 —— 这两条决定了「最近一条」与「没接线」怎么读', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const columns = new Map(columnsOf(db, TABLE).map(item => [item.name, item]))
      // 读侧按 `id DESC` 取最近一条（rev 会因导入更早备份而撞号），没有主键就没有确定的"最近"。
      expect(columns.get('id')!.pk).toBe(1)
      expect(columns.get('reason')!.notnull).toBe(1)
      expect(columns.get('reason')!.dflt_value).toBe("'unknown'")
      for (const name of ['domain', 'scope', 'rev', 'at', 'changed_chapters', 'covers_all']) {
        expect(columns.get(name)!.notnull).toBe(1)
      }
      // 默认值必须真能落库：直接插一条最小行，读回来是 unknown 而不是空串。
      db.prepare(`INSERT INTO ${TABLE} (domain, scope, rev) VALUES ('arc', 'book', 1)`).run()
      expect(db.prepare(`SELECT reason, covers_all, changed_chapters FROM ${TABLE}`).get())
        .toEqual({ reason: 'unknown', covers_all: 0, changed_chapters: '[]' })
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

  it('verify 失败会回滚整步（表与 user_version 一起退）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M27' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(27)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE)).toBeUndefined()
    } finally { db.close() }
  })
})
