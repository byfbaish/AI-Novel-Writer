import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M17 建「能力（本书级能力规则）」表（P1-1 连续性宿体第四格，2026-10-24）。
 *
 * ## 一行 = 一条**本书级**能力规则，不是一个人的技能
 *
 * 表里**刻意没有 `character_id`**：角色技能的家是 `characters.abilities`（M02 之后随角色卡
 * 一起进正文，`generate-draft.command.ts:2171`）。再登一份就是第二套账（W6 同型）。
 * 本表只装「没有角色归属、属于这本书的规则」——金手指、体系漏洞、宝物权限。
 *
 * ## 三类限制（Sanderson 第二定律）
 *
 * `hard_limit`（永远做不到什么 / 必要前提）、`weakness`（敌人能怎么破）、`cost_note`（用一次
 * 要付什么）分开存，因为它们在正文里是三种不同的失败：规则被写软、破绽被忽略、代价消失。
 * 三列**都可空**，且空 ⇒ 渲染整段省略（**不写「未登记」**，那个词会被读成「没有限制」）。
 *
 * ## `form` 不设 CHECK
 *
 * 真实取样里 18 个实例有 3 个横跨两到三类（规则 + 功法 + 天赋寄生）。定枚举等于替作者
 * 切一个切不开的东西，作者会挑一个「最不冲突」的类别，模型就按错类别写。词表只作
 * `datalist` 提示，词表外照样保存、原样读回（有专门用例钉住）。
 *
 * ## `evidence_scope` 必须有 CHECK
 *
 * 三档是本表唯一的出处枚举（`golden-finger` / `worldbuilding` / `chapter`），它是**数据完整性**
 * 而不是创作自由度：写错一个值，渲染层就只能猜「该不该印章号」。三本书的能力出处
 * 100% 是设定文本、0% 是章号 —— 没有这一列，UI 只能把「世界观第 1 维那句话」写成
 * 「来源第 3 章」，那是伪造章号（判据 DN 同型）。
 *
 * ## `stage_chapter` 的真实默认是 NULL
 *
 * 三库「第 N 章」命中 0 次，阶段一律用「开局 / 中期 / 后期」或境界名。所以 `undated` 是
 * 主路径，`ahead` 只是「作者手填章号才有」的开关 —— **本表不宣称解决了剧透**，它只提供
 * 一个出口：`stage_chapter > 本章` 的行由生成链过滤，不注入。
 *
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane。
 */
export const M17_POWER_ABILITIES_SQL = [
  `CREATE TABLE power_abilities (
      ability_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      form TEXT,
      hard_limit TEXT,
      weakness TEXT,
      cost_note TEXT,
      stage_chapter INTEGER CHECK(stage_chapter IS NULL OR stage_chapter > 0),
      stage_note TEXT,
      evidence TEXT,
      evidence_scope TEXT CHECK(evidence_scope IS NULL OR evidence_scope IN ('golden-finger','worldbuilding','chapter')),
      source TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`,
  'CREATE INDEX idx_power_abilities_stage ON power_abilities(stage_chapter)',
] as const

const STAGE_INDEX = 'idx_power_abilities_stage'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type=? AND name=?").get(type, name))
}

/** 幂等：表与索引**各自**判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM17PowerAbilities(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', 'power_abilities')) db.exec(M17_POWER_ABILITIES_SQL[0])
  if (!hasSchemaObject(db, 'index', STAGE_INDEX)) db.exec(M17_POWER_ABILITIES_SQL[1])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }
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

/** 表 DDL（空白归一，便于逐字断言）。 */
function tableSql(db: Database.Database, table: string): string {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  return (row?.sql ?? '').replace(/\s+/gu, ' ')
}

/** CHECK 是形状的一部分：两处可空但有界。读 sqlite_master 的 DDL 断言，不写库。 */
function hasExpectedChecks(sql: string): boolean {
  return sql.includes('CHECK(stage_chapter IS NULL OR stage_chapter > 0)')
    && sql.includes("CHECK(evidence_scope IS NULL OR evidence_scope IN ('golden-finger','worldbuilding','chapter'))")
}

/**
 * `form` 上**不得**有 CHECK（提案 §3.2 的结论）：混合形态是真实数据，定枚举会把
 * 「规则 + 功法 + 天赋」切成两半，模型就会按错类别写。这里显式断言它不存在，而不是
 * 只断言「其它 CHECK 都在」—— 后者在有人顺手加一条 CHECK 时照样会通过。
 */
function formHasNoCheck(sql: string): boolean {
  if (!/\bform TEXT\b/u.test(sql)) return false
  return !/CHECK\s*\(\s*form\b/u.test(sql) && !/\bform TEXT\s+CHECK/u.test(sql)
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM17PowerAbilities(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', 'power_abilities')) return false
    if (!hasUniqueIndexOn(db, 'power_abilities', 'name')) return false
    const sql = tableSql(db, 'power_abilities')
    if (!hasExpectedChecks(sql)) return false
    if (!formHasNoCheck(sql)) return false

    const columns = columnsOf(db, 'power_abilities')
    const required = ['ability_id', 'name', 'form', 'hard_limit', 'weakness', 'cost_note',
      'stage_chapter', 'stage_note', 'evidence', 'evidence_scope', 'source', 'created_at', 'updated_at']
    if (columns.length !== required.length) return false
    if (!required.every(name => columns.some(column => column.name === name))) return false
    // 主键：`TEXT PRIMARY KEY` 在 SQLite 里不会被记成 NOT NULL，只能断言 pk=1。
    if (columns.find(column => column.name === 'ability_id')?.pk !== 1) return false
    if (columns.find(column => column.name === 'name')?.notnull !== 1) return false
    if (columns.find(column => column.name === 'source')?.notnull !== 1) return false
    // 十处「空值有意义」的列必须**可空**：空 = 作者没登记，不是空串。
    for (const optional of ['form', 'hard_limit', 'weakness', 'cost_note', 'stage_chapter',
      'stage_note', 'evidence', 'evidence_scope', 'created_at', 'updated_at']) {
      if (columns.find(column => column.name === optional)?.notnull !== 0) return false
    }

    return hasSchemaObject(db, 'index', STAGE_INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM17Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M17', from: 17, to: 18, owner: 'P1-1',
    migrate: reader => applyM17PowerAbilities(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM17PowerAbilities(deps.database(reader)) }
}
