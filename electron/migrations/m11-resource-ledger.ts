import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M11 建资源账本两张表（W6 §3.2 / §5.1）。
 *
 * `resources` 是「资源」这一整类的表，不是灵石专用表：一条记录 = 一种可计数的资源。
 * `resource_movements` 是逐章变动，余额由它累加出来 —— **起点也是它的一行**
 * （`chapter_number=0` + `source='author'`），所以这里故意没有 `initial_value` 列，
 * 否则「起点」会有两个真相（§3.2 ★ / 判据 DI）。
 *
 * 三条不可退让的形状：
 * - `delta` **不许 DEFAULT 0**：缺失就该是「没有这条行」，不是「本章 +0」；
 * - `unit` 是**记账当时的快照**：作者日后改 `resources.unit` 不能静默重解释历史（§5.1 ★）；
 * - 外键 `ON DELETE RESTRICT` **不是 CASCADE**：误删资源必须报错，不能连历史一起清空。
 *
 * `scarcity_note` 是 W4b 的「设计意图栏」，只展示、不参与算术（§3.2 ★ / 判据 DL）。
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane，不能改 CREATE TABLE。
 */
export const M11_RESOURCE_LEDGER_SQL = [
  `CREATE TABLE resources (
      resource_id TEXT PRIMARY KEY,
      family_id TEXT,
      name TEXT NOT NULL UNIQUE,
      tier INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      anchor_value REAL,
      period TEXT NOT NULL,
      earn_note TEXT,
      cost_note TEXT,
      scarcity_note TEXT,
      anchor_note TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
  `CREATE TABLE resource_movements (
      id INTEGER PRIMARY KEY,
      chapter_number INTEGER NOT NULL,
      resource_id TEXT NOT NULL REFERENCES resources(resource_id) ON DELETE RESTRICT,
      delta INTEGER NOT NULL,
      unit TEXT NOT NULL,
      evidence TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT
    )`,
  'CREATE INDEX idx_resource_movements_chapter_resource ON resource_movements(chapter_number, resource_id)',
] as const

const MOVEMENT_INDEX = 'idx_resource_movements_chapter_resource'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type=? AND name=?").get(type, name))
}

/** 幂等：表与索引各自判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。
 * 两表互相独立地判存在，所以「只有一半」的库也能被补齐，而不是直接抛错。 */
export function applyM11ResourceLedger(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', 'resources')) db.exec(M11_RESOURCE_LEDGER_SQL[0])
  if (!hasSchemaObject(db, 'table', 'resource_movements')) db.exec(M11_RESOURCE_LEDGER_SQL[1])
  if (!hasSchemaObject(db, 'index', MOVEMENT_INDEX)) db.exec(M11_RESOURCE_LEDGER_SQL[2])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null }
type ForeignKeyInfo = { table: string; from: string; on_delete: string }
type IndexInfo = { name: string; unique: number }

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

/** 单列 UNIQUE 既可能来自列约束（sqlite_autoindex），也可能来自显式索引，两种都算。 */
function hasUniqueIndexOn(db: Database.Database, table: string, column: string): boolean {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as IndexInfo[]
  return indexes.some(index => {
    if (!index.unique) return false
    const columns = db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>
    return columns.length === 1 && columns[0]?.name === column
  })
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM11ResourceLedger(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', 'resources') || !hasSchemaObject(db, 'table', 'resource_movements')) return false
    if (!hasUniqueIndexOn(db, 'resources', 'name')) return false

    const resourceColumns = columnsOf(db, 'resources')
    const requiredResourceColumns = ['resource_id', 'family_id', 'name', 'tier', 'unit', 'anchor_value',
      'period', 'earn_note', 'cost_note', 'scarcity_note', 'anchor_note', 'created_at', 'updated_at']
    if (!requiredResourceColumns.every(name => resourceColumns.some(column => column.name === name))) return false
    // anchor_value 必须**可空**：NULL = 不可通兑，0 = 免费兑换，两者不能同形。
    if (resourceColumns.find(column => column.name === 'anchor_value')?.notnull !== 0) return false

    const movementColumns = columnsOf(db, 'resource_movements')
    const delta = movementColumns.find(column => column.name === 'delta')
    const unit = movementColumns.find(column => column.name === 'unit')
    if (delta?.notnull !== 1 || delta.dflt_value !== null) return false
    if (unit?.notnull !== 1) return false

    const foreignKeys = db.prepare('PRAGMA foreign_key_list(resource_movements)').all() as ForeignKeyInfo[]
    const reference = foreignKeys.find(key => key.table === 'resources' && key.from === 'resource_id')
    if (!reference || reference.on_delete === 'CASCADE') return false

    return hasSchemaObject(db, 'index', MOVEMENT_INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM11Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M11', from: 11, to: 12, owner: 'W6',
    migrate: reader => applyM11ResourceLedger(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM11ResourceLedger(deps.database(reader)) }
}
