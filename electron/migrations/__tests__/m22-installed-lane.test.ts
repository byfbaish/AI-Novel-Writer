import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M22（v22 → v23）：`summary_snapshots` 加一列 `knowledge_candidates`（P20-3 章末知情候选）。
 *
 * 这个 lane 守四条：
 * 1. **只加列、不重建表** —— 既有行、既有索引、既有指纹以外的一切都不动；
 * 2. **旧行读到 `'[]'` 而不是 NULL 或空串** —— 读侧 `JSON.parse` 遇到 NULL / `''` 会抛，
 *    而「没有候选」本该是空数组，不是读取失败（判据 DN：没有 ≠ 读不出来）；
 * 3. 重跑幂等（列已在就跳过，不改写 `sqlite_master`）；
 * 4. verify 失败回滚整步（列与 `user_version` 一起退）。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 22)
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v22 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  // 升级前就存在的快照行：用来验证「旧行拿到默认值」，而不是升级后写过的行。
  db.prepare('INSERT INTO summary_snapshots(chapter_number, chapter_notes) VALUES(1, ?)').run('# 第1章 要点')
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function column(db: InstanceType<typeof Database>, name: string): Column | undefined {
  return (db.prepare('PRAGMA table_info(summary_snapshots)').all() as Column[]).find(item => item.name === name)
}

describe('installed M22 lane', () => {
  it('升到最新版本，加出 knowledge_candidates，且不动既有快照与正文', () => {
    const db = fixture()
    try {
      const notesBefore = db.prepare('SELECT chapter_notes FROM summary_snapshots').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(23)
      expect(column(db, 'knowledge_candidates')).toBeDefined()
      expect(db.prepare('SELECT chapter_notes FROM summary_snapshots').pluck().get()).toBe(notesBefore)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe('v22 作者正文')
    } finally { db.close() }
  })

  it('旧行读到默认值 [] —— 不是 NULL、不是空串（读侧 JSON.parse 不能抛）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const raw = db.prepare('SELECT knowledge_candidates AS candidates FROM summary_snapshots WHERE chapter_number=1')
        .pluck().get() as string
      expect(raw).toBe('[]')
      expect(JSON.parse(raw)).toEqual([])
      // 不是 NULL 也不是空串：这两种都说明「列加上了但默认值没落到旧行」
      expect(raw).not.toBeNull()
      expect(raw).not.toBe('')
    } finally { db.close() }
  })

  it('列形状：非空 + 默认 []，且排在最后（ALTER 追加，不改既有列序）', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const names = (db.prepare('PRAGMA table_info(summary_snapshots)').all() as Column[]).map(item => item.name)
      expect(names[names.length - 1]).toBe('knowledge_candidates')
      const added = column(db, 'knowledge_candidates')!
      expect(added.notnull).toBe(1)
      expect((added.dflt_value ?? '').replace(/^'(.*)'$/u, '$1')).toBe('[]')
      // 既有候选列还在，语义没被替换（角色状态候选 ≠ 知情候选，判据 DE 同族：一格两义）
      expect(column(db, 'character_state_candidates')).toBeDefined()
      expect(column(db, 'continuity_facts')).toBeDefined()
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
        registry.implementations.map(step => step.id === 'M22' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(22)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(column(db, 'knowledge_candidates')).toBeUndefined()
    } finally { db.close() }
  })
})
