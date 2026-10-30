import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M23（v23 → v24）：`chapter_deletion_operations` 加一列 `keep_draft`。
 *
 * 这个 lane 守四条：
 * 1. **只加列、不重建表** —— 既有收据行原样保留（它们是历史事实，不能因为加一列就被改写）；
 * 2. **存量行读到 `0`** —— 历史语义不可考时统一按「删除」记，且必须可读（不是 NULL）；
 * 3. 重跑幂等（列已在就跳过，不改写 `sqlite_master`）；
 * 4. verify 失败回滚整步（列与 `user_version` 一起退）。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v23：M22 已加过 knowledge_candidates，但 keep_draft 还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 23)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v23 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  // 升级前就存在的收据：用来验证「旧行拿到默认值」，而不是升级后写过的行。
  db.prepare(`INSERT INTO chapter_deletion_operations(
    operation_id, draft_id, chapter_number, finalization_id, status
  ) VALUES('op-legacy', 1, 1, 'finalization-1', 'pending')`).run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function column(db: InstanceType<typeof Database>, name: string): Column | undefined {
  return (db.prepare('PRAGMA table_info(chapter_deletion_operations)').all() as Column[])
    .find(item => item.name === name)
}

describe('installed M23 lane', () => {
  it('升到最新版本，加出 keep_draft，且不动既有收据与正文', () => {
    const db = fixture()
    try {
      const receiptBefore = db.prepare(
        'SELECT operation_id, draft_id, finalization_id, status FROM chapter_deletion_operations',
      ).get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(24)
      expect(column(db, 'keep_draft')).toBeDefined()
      expect(db.prepare(
        'SELECT operation_id, draft_id, finalization_id, status FROM chapter_deletion_operations',
      ).get()).toEqual(receiptBefore)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe('v23 作者正文')
    } finally { db.close() }
  })

  it('存量收据读到 0（删除语义），不是 NULL —— 语义必须可判，不能三态', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const raw = db.prepare("SELECT keep_draft FROM chapter_deletion_operations WHERE operation_id='op-legacy'")
        .pluck().get() as number
      expect(raw).toBe(0)
      expect(raw).not.toBeNull()
      expect(raw).not.toBeUndefined()
    } finally { db.close() }
  })

  it('列形状：非空 + 默认 0，且排在最后（ALTER 追加，不改既有列序）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const names = (db.prepare('PRAGMA table_info(chapter_deletion_operations)').all() as Column[])
        .map(item => item.name)
      expect(names[names.length - 1]).toBe('keep_draft')
      const added = column(db, 'keep_draft')!
      expect(added.notnull).toBe(1)
      expect(added.dflt_value).toBe('0')
      // 语义相关的老列都在（keep_draft 是**加**语义判据，不是替换掉 legacy 授权那套）
      expect(column(db, 'legacy_knowledge_authorization')).toBeDefined()
      expect(column(db, 'status')).toBeDefined()
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

  it('verify 失败会回滚整步（含 user_version 与那一列）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M23' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(23)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(column(db, 'keep_draft')).toBeUndefined()
    } finally { db.close() }
  })
})
