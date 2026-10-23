import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M16 建「信息流（谁知道什么）」表（P1-1 连续性宿体第三格，2026-10-23）。
 *
 * ## 一行 = 谁在第 L 章得知了第 C 章定稿里的那条事实
 *
 * 主语是 `character_id`，**表里不存名字**：M02 重建 `characters` 之后 `character_id` 才是主键，
 * `name` 不再唯一（同名不同人、改名、别名都真实存在）。显示名一律读时 JOIN —— 存一份名字
 * 就等于存了一份会过期的快照，改名之后登记页与提示词会各说各话。
 *
 * ## 两个「引文」列语义不同，不能合并
 *
 * - `fact_evidence`：作者从**定稿正文**里选的**逐字引文**。它是这条事实的引用主体，
 *   `fact_key` 就是由「章号 + 这条引文」算出来的（见 `src/shared/knowledge-state.ts`）。
 * - `evidence`：**这条知情关系本身**的出处（哪一章写了「他这才知道」），可空。
 *   它不进提示词（本节预算 640 字，关系出处会挤掉判定行），只在登记页可见。
 *
 * `fact_evidence_hash` 是逐字引文的完整 sha256（64 hex），用于人工核对「库里引文是否被改过」；
 * `fact_key` 是 16 hex 的引用键（`kf:` 前缀），**是引用不是内容哈希**：事实被重抽/改稿时
 * key 不重算，由 `refState` 判定失效，绝不自动改键或删行。
 *
 * ## 只做正向知情，不做负知识
 *
 * 这里只记「谁**知道了**」，不记「谁不知道」，也不做 C1 身份分面。
 * 封闭默认（未列入者视为不知道）**只在注入文本里成立**，且只对**已登记的事实**成立；
 * 未登记的事实一概不判 —— 这句话逐字写在节首说明里，由测试钉住。
 *
 * `CHECK(learned_chapter >= fact_chapter)` 挡「先于事实存在就知道」：模型最爱把后文的
 * 恍然大悟提前到第一次出场，这条约束让「第 3 章就知道第 9 章的事」在写入时就失败。
 *
 * `UNIQUE(character_id, fact_key)` 挡的是**同一角色对同一条事实重复登记**（不是同角色多条
 * 事实）：同一个人对同一件事只该有一个「从第几章起知道」。两条不同的引文 = 两条不同的 key，
 * 照常允许；同一角色对两条不同事实也照常允许。
 *
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane。
 */
export const M16_KNOWLEDGE_STATES_SQL = [
  `CREATE TABLE knowledge_states (
      knowledge_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(character_id),
      fact_chapter INTEGER NOT NULL CHECK(fact_chapter > 0),
      fact_evidence TEXT NOT NULL,
      fact_evidence_hash TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      learned_chapter INTEGER NOT NULL CHECK(learned_chapter >= fact_chapter),
      evidence TEXT,
      source TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(character_id, fact_key)
    )`,
  'CREATE INDEX idx_knowledge_states_character ON knowledge_states(character_id)',
  'CREATE INDEX idx_knowledge_states_learned ON knowledge_states(learned_chapter)',
] as const

const CHARACTER_INDEX = 'idx_knowledge_states_character'
const LEARNED_INDEX = 'idx_knowledge_states_learned'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type=? AND name=?").get(type, name))
}

/** 幂等：表与两个索引**各自**判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM16KnowledgeStates(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', 'knowledge_states')) db.exec(M16_KNOWLEDGE_STATES_SQL[0])
  if (!hasSchemaObject(db, 'index', CHARACTER_INDEX)) db.exec(M16_KNOWLEDGE_STATES_SQL[1])
  if (!hasSchemaObject(db, 'index', LEARNED_INDEX)) db.exec(M16_KNOWLEDGE_STATES_SQL[2])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }
type IndexInfo = { name: string; unique: number }

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

/** 复合 UNIQUE：与单列重名不同，要按「列集完全一致」判，顺序也必须对上。 */
function hasUniqueIndexOn(db: Database.Database, table: string, expected: readonly string[]): boolean {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as IndexInfo[]
  return indexes.some(index => {
    if (!index.unique) return false
    const columns = db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>
    return columns.length === expected.length && columns.every((column, position) => column.name === expected[position])
  })
}

/** CHECK 是形状的一部分（章号为正、不得先于事实存在）：读 sqlite_master 的 DDL 断言，不写库。 */
function hasExpectedChecks(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  const sql = (row?.sql ?? '').replace(/\s+/gu, ' ')
  return sql.includes('CHECK(fact_chapter > 0)')
    && sql.includes('CHECK(learned_chapter >= fact_chapter)')
    && sql.includes('UNIQUE(character_id, fact_key)')
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM16KnowledgeStates(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', 'knowledge_states')) return false
    if (!hasUniqueIndexOn(db, 'knowledge_states', ['character_id', 'fact_key'])) return false
    if (!hasExpectedChecks(db, 'knowledge_states')) return false

    const columns = columnsOf(db, 'knowledge_states')
    const required = ['knowledge_id', 'character_id', 'fact_chapter', 'fact_evidence', 'fact_evidence_hash',
      'fact_key', 'learned_chapter', 'evidence', 'source', 'created_at', 'updated_at']
    if (!required.every(name => columns.some(column => column.name === name))) return false
    // 主键：`TEXT PRIMARY KEY` 在 SQLite 里**不会**被记成 NOT NULL（只有 INTEGER 主键会隐式非空），
    // 所以这里断言 `pk=1`，不能拿 `notnull===1` 判它 —— 否则形状对、校验却过不去。
    if (columns.find(column => column.name === 'knowledge_id')?.pk !== 1) return false
    // 三处「空值有意义」的列必须**可空**：关系出处空 = 作者没记出处，不是空串。
    for (const optional of ['evidence', 'created_at', 'updated_at']) {
      if (columns.find(column => column.name === optional)?.notnull !== 0) return false
    }
    // 引用本身（角色 / 章号 / 引文 / key）缺一个都不是一条知情关系。
    for (const filled of ['character_id', 'fact_chapter', 'fact_evidence',
      'fact_evidence_hash', 'fact_key', 'learned_chapter', 'source']) {
      if (columns.find(column => column.name === filled)?.notnull !== 1) return false
    }

    return hasSchemaObject(db, 'index', CHARACTER_INDEX) && hasSchemaObject(db, 'index', LEARNED_INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM16Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M16', from: 16, to: 17, owner: 'P1-1',
    migrate: reader => applyM16KnowledgeStates(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM16KnowledgeStates(deps.database(reader)) }
}
