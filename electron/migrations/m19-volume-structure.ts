import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M19 建「卷 / 单元」结构表，并把 `volume_handoffs` 的区间外置成外键（P1-2 期 1b，2026-10-24）。
 *
 * ## 为什么要有 `volumes` / `volume_units`
 *
 * 在此之前，「第 57 章属第几卷第几单元」每次都要把 Markdown 大纲重新解析一遍、再按权重
 * 等比折算。而且 `volume_handoffs` 的区间要作者手填两个章号。这两件事都是「用户在替系统
 * 做它可以自己做的事」。表建起来之后：交接单只需选卷，区间由 `volumeEffectiveRanges()`
 * 一处算；P1-2 期 2 的卷末自动生成也终于知道「这一卷是第几章到第几章」。
 *
 * ## 计划列 vs 实际列：两组列写法完全不同
 *
 * - `planned_*` 是**物化副本**，由重建任务从 `plot_structure_plan` + `synopsis` 算出来，
 *   随时可整体重算（带 `outline_hash` 判过期）。它**不是**权威 —— 大纲才是。
 * - `actual_last` 是**唯一事实**，只由面板「标记本卷已完成」写入，值取该卷已定稿章的
 *   最大章号。**永不推断**：超写是常态（计划 40 章写到 43 章），把 `planned_last` 抄成
 *   `actual_last` 必错。
 *
 * 重建任务**只 upsert 计划列**，`actual_last` / `actual_source` 一列都不碰。这是本设计
 * 最要紧的一条不变量，G2 反例测试专门钉它。
 *
 * ## 为什么没有 `actual_first`
 *
 * 它是「上一卷有效末章 + 1」的派生值。存下来就要两行同写（标记第 2 卷还得改第 1 卷），
 * 半途失败即自相矛盾；而且会把估算写进 `actual_*`（判据 DN 同型：缺失就说缺失）。
 * 起点只在 `volumeEffectiveRanges()` 一处算。
 *
 * ## 为什么没有 `status` 与章数
 *
 * 「这一卷写完了」由 `actual_last IS NOT NULL` 回答，不造第二个真相。
 * 章数账留在检查点的 `synopsis_volume_deviations`（生成期状态），卷表**不存章数** ——
 * 存了就是两套账（W6 的死法）。字数同理，属派生数值（ADR-0022）。
 *
 * ## 为什么表名是 `volume_units` 而不是 `units`
 *
 * `src/shared/draft-units.ts` 与 `planning:target-units` 已经把 unit 用作「正文段落单位」。
 * 同名不同义会让后来的人读错。
 *
 * ## `volume_handoffs` 就地重建的执行顺序
 *
 * 旧表（M18 形状，13 列）存在且没有 `volume_id` 列时：**非空就抛错**，空才 DROP。
 * 三本真实项目的 schema 是 18/10/9，这张表在任何真实库都还没建过 —— 守卫是给
 * 「万一有人手动建过」兜底的。**不许为了让它不报错而改成无条件 DROP**：数据丢失不可逆。
 *
 * ## 绝对不许改 M18 的 DDL
 *
 * `desktop-registry.ts` 的 `schemas(19)` 是**在内存里跑 `applyM18VolumeHandoffs` 现算指纹**
 * 得到的。改 M18 的 DDL 等于改掉「已知 v19 形状」，任何已升到 19 的库会从 known 变成
 * unknown schema，`probeSchema` 直接失败。所以本表只能在这里重建。
 */
export const M19_VOLUMES_SQL = `CREATE TABLE volumes (
      volume_id      TEXT PRIMARY KEY,
      volume_index   INTEGER NOT NULL UNIQUE CHECK(volume_index > 0),
      name           TEXT,
      planned_first  INTEGER CHECK(planned_first IS NULL OR planned_first > 0),
      planned_last   INTEGER,
      planned_source TEXT NOT NULL CHECK(planned_source IN ('headings','declared','even')),
      actual_last    INTEGER CHECK(actual_last IS NULL OR actual_last > 0),
      actual_source  TEXT CHECK(actual_source IN ('finalized','author')),
      outline_hash   TEXT NOT NULL,
      source         TEXT NOT NULL,
      created_at     TEXT,
      updated_at     TEXT,
      CHECK(planned_last IS NULL OR planned_last >= planned_first),
      CHECK((planned_first IS NULL) = (planned_last IS NULL)),
      CHECK((actual_last IS NULL) = (actual_source IS NULL))
    )`

export const M19_VOLUME_UNITS_SQL = `CREATE TABLE volume_units (
      unit_id        TEXT PRIMARY KEY,
      volume_id      TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
      unit_index     INTEGER NOT NULL CHECK(unit_index > 0),
      name           TEXT,
      planned_first  INTEGER CHECK(planned_first IS NULL OR planned_first > 0),
      planned_last   INTEGER,
      planned_source TEXT NOT NULL CHECK(planned_source IN ('headings','declared','even')),
      created_at     TEXT,
      updated_at     TEXT,
      UNIQUE(volume_id, unit_index),
      CHECK(planned_last IS NULL OR planned_last >= planned_first),
      CHECK((planned_first IS NULL) = (planned_last IS NULL))
    )`

export const M19_VOLUME_HANDOFFS_SQL = `CREATE TABLE volume_handoffs (
      handoff_id  TEXT PRIMARY KEY,
      volume_id   TEXT NOT NULL UNIQUE REFERENCES volumes(volume_id) ON DELETE RESTRICT,
      world_state TEXT,
      hero_state  TEXT,
      events_json TEXT NOT NULL DEFAULT '[]',
      items_json  TEXT NOT NULL DEFAULT '[]',
      debts_json  TEXT NOT NULL DEFAULT '[]',
      open_thread TEXT,
      source      TEXT NOT NULL,
      created_at  TEXT,
      updated_at  TEXT
    )`

const VOLUMES_TABLE = 'volumes'
const UNITS_TABLE = 'volume_units'
const HANDOFFS_TABLE = 'volume_handoffs'

const VOLUME_COLUMNS = ['volume_id', 'volume_index', 'name', 'planned_first', 'planned_last',
  'planned_source', 'actual_last', 'actual_source', 'outline_hash', 'source',
  'created_at', 'updated_at'] as const
const UNIT_COLUMNS = ['unit_id', 'volume_id', 'unit_index', 'name', 'planned_first',
  'planned_last', 'planned_source', 'created_at', 'updated_at'] as const
const HANDOFF_COLUMNS = ['handoff_id', 'volume_id', 'world_state', 'hero_state', 'events_json',
  'items_json', 'debts_json', 'open_thread', 'source', 'created_at', 'updated_at'] as const

/** 必填列（`notnull = 1`）。`*_id` 是 TEXT PRIMARY KEY，SQLite 不把它记成 NOT NULL，见 verify。 */
const VOLUME_REQUIRED = ['volume_index', 'planned_source', 'outline_hash', 'source'] as const
const UNIT_REQUIRED = ['volume_id', 'unit_index', 'planned_source'] as const
const HANDOFF_REQUIRED = ['volume_id', 'events_json', 'items_json', 'debts_json', 'source'] as const

/** 可空列：空 = 作者还没填（或未定），不是空串。 */
const VOLUME_OPTIONAL = ['name', 'planned_first', 'planned_last', 'actual_last', 'actual_source',
  'created_at', 'updated_at'] as const
const UNIT_OPTIONAL = ['name', 'planned_first', 'planned_last', 'created_at', 'updated_at'] as const
const HANDOFF_OPTIONAL = ['world_state', 'hero_state', 'open_thread', 'created_at', 'updated_at'] as const

function hasSchemaObject(db: Database.Database, type: 'table', name: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get(type, name))
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  return columnsOf(db, table).some(info => info.name === column)
}

/** 幂等：三张表分别判存在。旧 `volume_handoffs`（M18 形状）先重建。 */
export function applyM19VolumeStructure(db: Database.Database): void {
  if (hasSchemaObject(db, 'table', HANDOFFS_TABLE) && !hasColumn(db, HANDOFFS_TABLE, 'volume_id')) {
    const rows = db.prepare(`SELECT COUNT(*) AS count FROM ${HANDOFFS_TABLE}`).get() as { count: number }
    // 空表才能重建。非空时停下 —— 那些行是作者手填的真实区间，丢不可逆。
    if (rows.count > 0) throw new Error('M19_VOLUME_HANDOFF_NOT_EMPTY')
    db.exec(`DROP TABLE ${HANDOFFS_TABLE}`)
  }
  if (!hasSchemaObject(db, 'table', VOLUMES_TABLE)) db.exec(M19_VOLUMES_SQL)
  if (!hasSchemaObject(db, 'table', UNITS_TABLE)) db.exec(M19_VOLUME_UNITS_SQL)
  if (!hasSchemaObject(db, 'table', HANDOFFS_TABLE)) db.exec(M19_VOLUME_HANDOFFS_SQL)
}

type IndexInfo = { name: string; unique: number }

function uniqueIndexColumns(db: Database.Database, table: string): string[][] {
  const indexes = (db.prepare(`PRAGMA index_list(${table})`).all() as IndexInfo[])
    .filter(index => index.unique)
  return indexes.map(index => (db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>)
    .map(column => column.name))
}

function hasUniqueIndexOn(db: Database.Database, table: string, column: string): boolean {
  return uniqueIndexColumns(db, table)
    .some(columns => columns.length === 1 && columns[0] === column)
}

function hasCompositeUniqueOn(db: Database.Database, table: string, columns: readonly string[]): boolean {
  return uniqueIndexColumns(db, table)
    .some(found => found.length === columns.length && columns.every(name => found.includes(name)))
}

type ForeignKeyInfo = { table: string; from: string; to: string; on_delete: string }

function foreignKey(db: Database.Database, table: string, from: string): ForeignKeyInfo | undefined {
  const rows = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as ForeignKeyInfo[]
  return rows.find(row => row.from === from)
}

/** 表 DDL（空白归一，便于逐字断言）。 */
function tableSql(db: Database.Database, table: string): string {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  return (row?.sql ?? '').replace(/\s+/gu, ' ')
}

/** CHECK 是形状的一部分：读 DDL 断言，不写库。 */
function hasVolumeChecks(sql: string): boolean {
  return sql.includes('CHECK(volume_index > 0)')
    && sql.includes("CHECK(planned_source IN ('headings','declared','even'))")
    && sql.includes('CHECK(planned_last IS NULL OR planned_last >= planned_first)')
    && sql.includes('CHECK((planned_first IS NULL) = (planned_last IS NULL))')
    && sql.includes('CHECK((actual_last IS NULL) = (actual_source IS NULL))')
    && sql.includes("CHECK(actual_source IN ('finalized','author'))")
}

function hasHandoffChecks(sql: string): boolean {
  // 重建后的交接单表**不再有区间 CHECK** —— 区间不再由作者输入。
  return !sql.includes('first_chapter') && !sql.includes('last_chapter')
}

function matchesColumns(columns: readonly ColumnInfo[], expected: readonly string[]): boolean {
  if (columns.length !== expected.length) return false
  return expected.every(name => columns.some(column => column.name === name))
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM19VolumeStructure(db: Database.Database): boolean {
  try {
    for (const table of [VOLUMES_TABLE, UNITS_TABLE, HANDOFFS_TABLE] as const) {
      if (!hasSchemaObject(db, 'table', table)) return false
    }

    // ---- volumes ----
    const volumes = columnsOf(db, VOLUMES_TABLE)
    if (!matchesColumns(volumes, VOLUME_COLUMNS)) return false
    if (volumes.find(column => column.name === 'volume_id')?.pk !== 1) return false
    if (!hasUniqueIndexOn(db, VOLUMES_TABLE, 'volume_index')) return false
    for (const needed of VOLUME_REQUIRED) {
      if (volumes.find(column => column.name === needed)?.notnull !== 1) return false
    }
    for (const optional of VOLUME_OPTIONAL) {
      if (volumes.find(column => column.name === optional)?.notnull !== 0) return false
    }
    if (!hasVolumeChecks(tableSql(db, VOLUMES_TABLE))) return false

    // ---- volume_units ----
    const units = columnsOf(db, UNITS_TABLE)
    if (!matchesColumns(units, UNIT_COLUMNS)) return false
    if (units.find(column => column.name === 'unit_id')?.pk !== 1) return false
    if (!hasCompositeUniqueOn(db, UNITS_TABLE, ['volume_id', 'unit_index'])) return false
    for (const needed of UNIT_REQUIRED) {
      if (units.find(column => column.name === needed)?.notnull !== 1) return false
    }
    for (const optional of UNIT_OPTIONAL) {
      if (units.find(column => column.name === optional)?.notnull !== 0) return false
    }
    const unitForeignKey = foreignKey(db, UNITS_TABLE, 'volume_id')
    if (unitForeignKey?.table !== VOLUMES_TABLE || unitForeignKey.to !== 'volume_id') return false
    if (unitForeignKey.on_delete !== 'CASCADE') return false

    // ---- volume_handoffs ----
    const handoffs = columnsOf(db, HANDOFFS_TABLE)
    if (!matchesColumns(handoffs, HANDOFF_COLUMNS)) return false
    if (handoffs.find(column => column.name === 'handoff_id')?.pk !== 1) return false
    if (!hasUniqueIndexOn(db, HANDOFFS_TABLE, 'volume_id')) return false
    for (const needed of HANDOFF_REQUIRED) {
      if (handoffs.find(column => column.name === needed)?.notnull !== 1) return false
    }
    for (const optional of HANDOFF_OPTIONAL) {
      if (handoffs.find(column => column.name === optional)?.notnull !== 0) return false
    }
    if (!hasHandoffChecks(tableSql(db, HANDOFFS_TABLE))) return false
    const handoffForeignKey = foreignKey(db, HANDOFFS_TABLE, 'volume_id')
    if (handoffForeignKey?.table !== VOLUMES_TABLE || handoffForeignKey.to !== 'volume_id') return false
    // RESTRICT：有交接单的卷不能删，否则跨卷记忆静默消失。
    if (handoffForeignKey.on_delete !== 'RESTRICT') return false
    for (const jsonColumn of ['events_json', 'items_json', 'debts_json'] as const) {
      if (handoffs.find(column => column.name === jsonColumn)?.dflt_value !== "'[]'") return false
    }

    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM19Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M19', from: 19, to: 20, owner: 'P1-2',
    migrate: reader => applyM19VolumeStructure(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM19VolumeStructure(deps.database(reader)) }
}
