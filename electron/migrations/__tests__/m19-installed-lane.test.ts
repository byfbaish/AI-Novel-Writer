import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../desktop-registry'
import { createMigrationRegistry, type MigrationRegistry } from '../registry'
import { migrateSchema } from '../runner'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from '../sqlite-schema-adapter'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * M19（v19 → v20）：`volumes` + `volume_units` + 重建 `volume_handoffs`（P1-2 期 1b）。
 *
 * 这个 lane 守八条：
 * 1. 升到 20 且**不动既有作者数据**；
 * 2. `volumes` **12 列**，`volume_index` 单列 UNIQUE，三组 CHECK 在（含「计划两列同 NULL」）；
 * 3. `volume_units` **9 列**，`UNIQUE(volume_id, unit_index)`，FK `ON DELETE CASCADE`；
 * 4. `volume_handoffs` 重建后 **11 列**，`volume_id` NOT NULL UNIQUE，FK `ON DELETE RESTRICT`；
 * 5. FK 有牙齿：有交接单的卷删不掉；删无交接单的卷会连带删单元；
 * 6. **反例**：v19 的旧表里只要有数据，M19 就整步拒绝（不 DROP、不丢作者手填的区间）；
 * 7. 幂等：重跑不产生步骤、不改指纹；
 * 8. verify 失败会回滚整步（含 user_version）。
 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 18)
  db.prepare("INSERT INTO characters (character_id,name,role) VALUES ('character:guchangfeng','顾长风','protagonist')").run()
  db.prepare('INSERT INTO contents(body) VALUES(?)').run('v18 作者正文')
  db.prepare('INSERT INTO drafts(chapter_number, version, content_id, word_count) VALUES(1, 1, 1, 888)').run()
  return db
}

type Column = { name: string; notnull: number; dflt_value: string | null; pk: number }
type ForeignKey = { table: string; from: string; to: string; on_delete: string }

function columns(db: InstanceType<typeof Database>, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[]
}

function uniqueIndexColumns(db: InstanceType<typeof Database>, table: string): string[][] {
  const indexes = (db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string; unique: number }>)
    .filter(index => index.unique)
  return indexes.map(index => (db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>)
    .map(column => column.name))
}

function tableSql(db: InstanceType<typeof Database>, table: string): string {
  return ((db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").pluck().get(table) as string) ?? '')
    .replace(/\s+/gu, ' ')
}

const INSERT_VOLUME = `INSERT INTO volumes(
  volume_id,volume_index,name,planned_first,planned_last,planned_source,outline_hash,source)
  VALUES(?,?,?,?,?,?,?,?)`

const INSERT_UNIT = `INSERT INTO volume_units(
  unit_id,volume_id,unit_index,name,planned_first,planned_last,planned_source)
  VALUES(?,?,?,?,?,?,?)`

const INSERT_HANDOFF = `INSERT INTO volume_handoffs(handoff_id,volume_id,source) VALUES(?,?,?)`

function seedVolume(db: InstanceType<typeof Database>, id: string, index: number): void {
  db.prepare(INSERT_VOLUME).run(id, index, `第${index}卷`, index * 20 - 19, index * 20, 'headings', `hash:${index}`, 'outline')
}

describe('installed M19 lane', () => {
  it('升到最新版本，建出三张表，且不动既有作者数据', () => {
    const db = fixture()
    try {
      const bodyBefore = db.prepare('SELECT body FROM contents').pluck().get()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(CURRENT_DESKTOP_SCHEMA_VERSION).toBeGreaterThanOrEqual(20)
      expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(bodyBefore)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('volumes','volume_units','volume_handoffs') ORDER BY name")
        .pluck().all()).toEqual(['volume_handoffs', 'volume_units', 'volumes'])
      // 与 M14/M15/M17/M18 一致：唯一约束写在列上/表级，**不另建** idx_ 索引。
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' AND tbl_name IN ('volumes','volume_units','volume_handoffs')")
        .pluck().all()).toEqual([])
    } finally { db.close() }
  })

  it('volumes 12 列、可空性与三组 CHECK；volume_index 单列 UNIQUE', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'volumes').map(column => column.name)).toEqual([
        'volume_id', 'volume_index', 'name', 'planned_first', 'planned_last', 'planned_source',
        'actual_last', 'actual_source', 'outline_hash', 'source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'volumes').find(column => column.name === name)
      for (const filled of ['volume_index', 'planned_source', 'outline_hash', 'source']) {
        expect(byName(filled)?.notnull).toBe(1)
      }
      for (const optional of ['name', 'planned_first', 'planned_last', 'actual_last', 'actual_source',
        'created_at', 'updated_at']) {
        expect(byName(optional)?.notnull).toBe(0)
      }
      // `TEXT PRIMARY KEY` 在 SQLite 里不会被记成 NOT NULL，只能断言 pk=1。
      expect(byName('volume_id')?.pk).toBe(1)
      expect(uniqueIndexColumns(db, 'volumes').some(found => found.length === 1 && found[0] === 'volume_index')).toBe(true)

      const sql = tableSql(db, 'volumes')
      expect(sql).toContain('CHECK(volume_index > 0)')
      expect(sql).toContain("CHECK(planned_source IN ('headings','declared','even'))")
      expect(sql).toContain("CHECK(actual_source IN ('finalized','author'))")
      expect(sql).toContain('CHECK(planned_last IS NULL OR planned_last >= planned_first)')
      // 「计划两列同 NULL」与「实际两列同 NULL」：不允许一个有一个没有。
      expect(sql).toContain('CHECK((planned_first IS NULL) = (planned_last IS NULL))')
      expect(sql).toContain('CHECK((actual_last IS NULL) = (actual_source IS NULL))')
    } finally { db.close() }
  })

  it('volume_units 9 列、复合 UNIQUE、FK 级联删', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'volume_units').map(column => column.name)).toEqual([
        'unit_id', 'volume_id', 'unit_index', 'name', 'planned_first', 'planned_last',
        'planned_source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'volume_units').find(column => column.name === name)
      for (const filled of ['volume_id', 'unit_index', 'planned_source']) {
        expect(byName(filled)?.notnull).toBe(1)
      }
      expect(byName('unit_id')?.pk).toBe(1)
      expect(uniqueIndexColumns(db, 'volume_units')
        .some(found => found.length === 2 && found.includes('volume_id') && found.includes('unit_index'))).toBe(true)

      const fk = (db.prepare('PRAGMA foreign_key_list(volume_units)').all() as ForeignKey[])
        .find(row => row.from === 'volume_id')
      expect(fk?.table).toBe('volumes')
      expect(fk?.to).toBe('volume_id')
      expect(fk?.on_delete).toBe('CASCADE')
    } finally { db.close() }
  })

  it('volume_handoffs 重建为 11 列、volume_id 外键 RESTRICT、JSON 默认 []', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      expect(columns(db, 'volume_handoffs').map(column => column.name)).toEqual([
        'handoff_id', 'volume_id', 'world_state', 'hero_state', 'events_json', 'items_json',
        'debts_json', 'open_thread', 'source', 'created_at', 'updated_at',
      ])
      const byName = (name: string) => columns(db, 'volume_handoffs').find(column => column.name === name)
      expect(byName('volume_id')?.notnull).toBe(1)
      expect(byName('handoff_id')?.pk).toBe(1)
      expect(uniqueIndexColumns(db, 'volume_handoffs')
        .some(found => found.length === 1 && found[0] === 'volume_id')).toBe(true)
      for (const jsonColumn of ['events_json', 'items_json', 'debts_json']) {
        expect(byName(jsonColumn)?.dflt_value).toBe("'[]'")
      }
      // 区间两列必须消失 —— 区间已外置到 volumes。
      expect(columns(db, 'volume_handoffs').some(column => column.name === 'first_chapter')).toBe(false)
      expect(columns(db, 'volume_handoffs').some(column => column.name === 'last_chapter')).toBe(false)

      const fk = (db.prepare('PRAGMA foreign_key_list(volume_handoffs)').all() as ForeignKey[])
        .find(row => row.from === 'volume_id')
      expect(fk?.table).toBe('volumes')
      expect(fk?.on_delete).toBe('RESTRICT')
    } finally { db.close() }
  })

  it('FK 有牙齿：有交接单的卷删不掉；删无交接单的卷连带删单元', () => {
    const db = fixture()
    try {
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
      seedVolume(db, 'volume:1', 1)
      seedVolume(db, 'volume:2', 2)
      db.prepare(INSERT_UNIT).run('unit:1:1', 'volume:1', 1, '单元一', 1, 10, 'headings')
      db.prepare(INSERT_UNIT).run('unit:2:1', 'volume:2', 1, '单元一', 21, 40, 'headings')
      db.prepare(INSERT_HANDOFF).run('handoff:1', 'volume:1', 'author')

      // RESTRICT：有交接单的卷不能删，否则跨卷记忆静默消失。
      expect(() => db.prepare('DELETE FROM volumes WHERE volume_id=?').run('volume:1')).toThrow()
      expect(db.prepare('SELECT COUNT(*) FROM volume_handoffs').pluck().get()).toBe(1)

      // CASCADE：删无交接单的卷会把它的单元一起带走。
      db.prepare('DELETE FROM volumes WHERE volume_id=?').run('volume:2')
      expect(db.prepare('SELECT COUNT(*) FROM volume_units WHERE volume_id=?').pluck().get('volume:2')).toBe(0)
      expect(db.prepare('SELECT COUNT(*) FROM volume_units WHERE volume_id=?').pluck().get('volume:1')).toBe(1)
    } finally { db.close() }
  })

  it('旧表有数据时整步拒绝：不 DROP、不丢作者手填的区间', () => {
    const db = fixture()
    try {
      // 先升到 v19（M18 形状：13 列，区间是作者手填的）
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 19)
      db.prepare(`INSERT INTO volume_handoffs(
        handoff_id,volume_index,first_chapter,last_chapter,events_json,items_json,debts_json,source)
        VALUES('handoff:legacy',1,1,20,'[]','[]','[]','author')`).run()

      expect(() => migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('M19_VOLUME_HANDOFF_NOT_EMPTY')
      // 回滚到 19，旧表与那一行都还在 —— 数据丢失不可逆，宁可停下。
      expect(db.pragma('user_version', { simple: true })).toBe(19)
      expect(db.prepare('SELECT COUNT(*) FROM volume_handoffs').pluck().get()).toBe(1)
      expect(columns(db, 'volume_handoffs').some(column => column.name === 'first_chapter')).toBe(true)
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
      expect(db.prepare('SELECT COUNT(*) FROM volumes').pluck().get()).toBe(0)
    } finally { db.close() }
  })

  it('verify 失败会回滚整步（含 user_version 与表）', () => {
    const db = fixture()
    try {
      // M19 从 v19 起跑，所以指纹必须取「已经到 v19」那一刻的。
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 19)
      const registry: MigrationRegistry = getDesktopMigrationRegistry()
      const before = sqliteSchemaFingerprint(db)
      const rejected = createMigrationRegistry(
        registry.implementations.map(step => step.id === 'M19' ? { ...step, verify: () => false } : step),
        registry.recognizedSchemas,
      )
      expect(() => migrateSchema(new SqliteSchemaAdapter(db), rejected, CURRENT_DESKTOP_SCHEMA_VERSION))
        .toThrow('MIGRATION_VERIFICATION_FAILED')
      expect(db.pragma('user_version', { simple: true })).toBe(19)
      expect(sqliteSchemaFingerprint(db)).toBe(before)
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all())
        .not.toContain('volumes')
    } finally { db.close() }
  })
})
