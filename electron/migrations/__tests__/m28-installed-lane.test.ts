import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M28（v28 → v29）：`drafts.outline_rev` —— 「这一章定稿时大纲是第几版」（S6）。
 *
 * 加列迁移比建表少一层断言，但这一列有两处**错了不会报错、只会静默判错**的地方，
 * 所以断言的重点不在「列有没有」，而在「默认值到底是什么」：
 *
 * 1. 默认值若写成 `0`，每一条老数据都会被读成「依赖第 0 版」，而 `0` 在别处表示
 *    「假想再造一版」—— 于是所有已定稿章节永远判 `stale`（或永远 `valid`），
 *    两种错都不会让任何测试自己红起来。
 * 2. 默认值若写成 `NULL`，`NOT NULL` 一并失守，将来每个读取方都要自己兜一层
 *    `?? -1`，漏兜的那一处会把 `NULL` 当版本号参与比较。
 *
 * 另外守一条：**既有草稿行一个字不许动**。`ALTER TABLE ADD COLUMN` 若被写成
 * 「重建表」的写法（有些迁移工具会这么干），`status` / `source_dependencies` 会在
 * 一次升级里被悄悄重置 —— 那才是真正会让人一夜白写的形态。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  // 停在 v28：流水账已有（M27），定稿时的大纲版本还没有。
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 28)
  db.prepare("INSERT INTO contents (id, body) VALUES (9001, '正文')").run()
  db.prepare(`INSERT INTO drafts (chapter_number, version, status, source, content_id, word_count, source_dependencies)
    VALUES (8, 2, 'finalized', 'write', 9001, 1234, '["d1"]')`).run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

describe('installed M28 lane', () => {
  it('升到最新版本，列在，且既有草稿行原样保留', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(29)
      expect(columnsOf(db, 'drafts').map(column => column.name)).toContain('outline_rev')
      // 既有行不许被「重建表」式的迁移碰掉任何一个字段。
      expect(db.prepare('SELECT chapter_number, version, status, source, word_count, source_dependencies FROM drafts').get())
        .toEqual({ chapter_number: 8, version: 2, status: 'finalized', source: 'write', word_count: 1234, source_dependencies: '["d1"]' })
    } finally { db.close() }
  })

  it('老数据的默认值是 -1（显式「没有记录」），不是 0 / NULL', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      const column = columnsOf(db, 'drafts').find(item => item.name === 'outline_rev')!
      expect(column.notnull).toBe(1)
      expect(column.dflt_value).toBe('-1')
      // 存量行拿到的是 -1：**不能回填成当前大纲版本** —— 它们定稿于某个找不回来的
      // 版本上，补一个当前值会让真正该复查的章节判 `valid`（假阴性，方向错）。
      expect(db.prepare('SELECT outline_rev FROM drafts').pluck().get()).toBe(-1)
      // 新插入的行也吃这个默认值（不是靠写入侧显式给）。
      db.prepare("INSERT INTO contents (id, body) VALUES (9002, '正文2')").run()
      db.prepare("INSERT INTO drafts (chapter_number, version, content_id) VALUES (9, 1, 9002)").run()
      expect(db.prepare('SELECT outline_rev FROM drafts WHERE chapter_number = 9').pluck().get()).toBe(-1)
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
        registry.implementations.map(step => step.id === 'M28' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(28)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(columnsOf(db, 'drafts').map(column => column.name)).not.toContain('outline_rev')
    } finally { db.close() }
  })
})
