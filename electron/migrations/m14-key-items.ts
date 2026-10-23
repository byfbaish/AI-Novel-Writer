import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M14 建「关键物品」表（P1-1 连续性宿体第一格，2026-10-23）。
 *
 * ## 它不是资源账本
 *
 * 物品与资源（M11 `resources`）的划界只有一条：**有没有数量增减**。
 * - 资源：能被同一单位反复加减（灵石、贡献点），口径靠 `unit` + `period`；
 * - 物品：一件**有归属的东西**（欠条、裁员名单备份、串着灵石的麻绳），
 *   关心的是「在谁手里 / 什么状态」，没有 delta、没有单位、没有周期。
 *
 * 所以这里**没有余额、没有变动表、没有算术**：转手就是改 `holder_character`。
 * 这也是它不违反 ADR-0022 的原因 —— ADR 下线的是「余额」，不是「事实」。
 *
 * ## 三条形状
 *
 * - `name` **UNIQUE**：一条记录 = 一件有名字的关键物品。同名多件（三副药）靠
 *   `status_note` 写清楚（「剩两副」），**不拆成多行** —— 拆了就得回答「哪一行是哪一副」，
 *   而正文里从来没有这个 ID。
 * - `holder_character` 存的是**角色名**（`characters.name` 就是它的主键），不是角色 ID；
 *   非角色持有（地点 / 无主 / 组织）时为空，靠 `holder_label` 展示。
 *   刻意**不加外键**：物品归属是「截至某章的快照」，角色改名或删卡时不该由数据库
 *   去级联改写一件历史物品的归属；对不上的由归位表（W4a）与作者复核处理。
 * - `chapter_number` / `evidence` **都可空**：作者登记时可能只记得「刀在他手里」，
 *   不记得哪一章写的。空值在注入时渲染成「作者登记」而不是伪造一个章号（判据 DN 同型）。
 *
 * `source` 记来源（`author` / `derived`）。本期只有作者登记；留这一列是为了以后
 * 从定稿正文抽取时两种来源能区分开，不必再改表。
 *
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane。
 */
export const M14_KEY_ITEMS_SQL = [
  `CREATE TABLE key_items (
      item_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      holder_character TEXT,
      holder_label TEXT NOT NULL,
      status_note TEXT,
      chapter_number INTEGER,
      evidence TEXT,
      source TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`,
  'CREATE INDEX idx_key_items_holder ON key_items(holder_character)',
] as const

const HOLDER_INDEX = 'idx_key_items_holder'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type=? AND name=?").get(type, name))
}

/** 幂等：表与索引各自判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM14KeyItems(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', 'key_items')) db.exec(M14_KEY_ITEMS_SQL[0])
  if (!hasSchemaObject(db, 'index', HOLDER_INDEX)) db.exec(M14_KEY_ITEMS_SQL[1])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null }
type IndexInfo = { name: string; unique: number }

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

function hasUniqueIndexOn(db: Database.Database, table: string, column: string): boolean {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as IndexInfo[]
  return indexes.some(index => {
    if (!index.unique) return false
    const columns = db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>
    return columns.length === 1 && columns[0]?.name === column
  })
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM14KeyItems(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', 'key_items')) return false
    if (!hasUniqueIndexOn(db, 'key_items', 'name')) return false

    const columns = columnsOf(db, 'key_items')
    const required = ['item_id', 'name', 'holder_character', 'holder_label', 'status_note',
      'chapter_number', 'evidence', 'source', 'created_at', 'updated_at']
    if (!required.every(name => columns.some(column => column.name === name))) return false
    // 三处「空值有意义」的列必须**可空**：空 ≠ 0 / 空 ≠ 空串。
    // holder_character 空 = 非角色持有；chapter_number 空 = 作者没标出处章；evidence 空 = 没有引文。
    for (const optional of ['holder_character', 'chapter_number', 'evidence']) {
      if (columns.find(column => column.name === optional)?.notnull !== 0) return false
    }
    const holderLabel = columns.find(column => column.name === 'holder_label')
    const source = columns.find(column => column.name === 'source')
    if (holderLabel?.notnull !== 1 || source?.notnull !== 1) return false

    return hasSchemaObject(db, 'index', HOLDER_INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM14Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M14', from: 14, to: 15, owner: 'P1-1',
    migrate: reader => applyM14KeyItems(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM14KeyItems(deps.database(reader)) }
}
