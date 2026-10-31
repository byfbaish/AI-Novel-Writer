import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M26（v26 → v27）：给「大纲自己」记一条上游来源（中间环）。
 *
 * 与 M25 同一组断言，只是对象换成 `project_core.synopsis_source_ref` —— 形状相同，
 * 理由也相同（只加列 / 存量读空串 / 非空 / 幂等 / verify 失败整步回滚）。
 *
 * 额外守一条 M26 独有的：**不许动 `plot_tree_source_ref` 与 `plot_tree_snapshot`**。
 * 两者与 `synopsis` 同在一张表，写错了列不会报错，只会让剧情树的「旧了」判断
 * 从这一刻起全错。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v26：三张派生表的来源列已有（M25），大纲的来源列还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 26)
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  db.prepare(`UPDATE project_core SET synopsis = '第1章：旧大纲', plot_tree_snapshot = '{"version":1}',
    plot_tree_source_ref = '{"outline:book":3}' WHERE id = 'main'`).run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null }

function columnsOf(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

const EXPECTED = [{ table: 'project_core', column: 'synopsis_source_ref' }] as const

describe('installed M26 lane', () => {
  it('升到最新版本，列在，且不动大纲原文与剧情树的两列', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(27)
      for (const entry of EXPECTED) {
        expect(columnsOf(db, entry.table).map(column => column.name)).toContain(entry.column)
      }
      const row = db.prepare(
        "SELECT synopsis, plot_tree_snapshot, plot_tree_source_ref, synopsis_source_ref FROM project_core WHERE id = 'main'",
      ).get() as Record<string, string>
      // 存量行读到空串 ⇒ 判 legacy（「不知道这段大纲基于什么」），不是「上游变过」。
      expect(row.synopsis_source_ref).toBe('')
      expect(row.synopsis).toBe('第1章：旧大纲')
      expect(row.plot_tree_snapshot).toBe('{"version":1}')
      expect(row.plot_tree_source_ref).toBe('{"outline:book":3}')
    } finally { db.close() }
  })

  it('列非空且默认空串 —— 空串才是「没记过来源」，NULL 会让判定变成三态', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      for (const entry of EXPECTED) {
        const column = columnsOf(db, entry.table).find(item => item.name === entry.column)!
        expect(column.notnull).toBe(1)
        expect(column.dflt_value).toBe("''")
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
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（列与 user_version 一起退）', () => {
    const db = fixture()
    try {
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M26' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(26)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      for (const entry of EXPECTED) {
        expect(columnsOf(db, entry.table).map(column => column.name)).not.toContain(entry.column)
      }
    } finally { db.close() }
  })
})
