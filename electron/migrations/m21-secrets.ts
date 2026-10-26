import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M21 建「秘密宿体」表（P20-2，2026-10-26 作者裁定「新表」）。
 *
 * ## 一行 = 一个秘密：谁在捂、谁还不知道、计划第几章穿
 *
 * 主语是**秘密**，不是人。这与 M16（`knowledge_states`，主语是人）是根本差异：
 * M16 问「他在第几章知道了什么」，本表问「这件事谁还不知道、什么时候会穿」。
 * 一个秘密对多个隐瞒者、多个被骗者，所以两边都是**名字数组**而不是单个 `character_id`
 * —— 详情与代价见 `src/shared/secret.ts` 文件头（含为什么不并入 M16 的四条逐列对照）。
 *
 * ## 为什么没有 `status` 列
 *
 * 「已揭穿 / 未揭穿」由 `reveal_chapter` 与被审章号推导（`secretChapterState`）。
 * 落一份冗余状态就有两个真相：改了揭穿章忘了改状态，审稿员会按旧状态判。
 *
 * ## `reveal_chapter` 可空是有语义的
 *
 * `NULL` = 作者还没决定第几章穿，**不是**「永不揭穿」。推导时按「任何章都算未揭穿」处理
 * （保守方向：宁可多拦一次，不可漏放一次）。所以 CHECK 只约束「非空时必须为正」，
 * 不能用 `NOT NULL` —— 那会把「还没想好」这个真实状态逼成假数字。
 *
 * ## `title` 是唯一键
 *
 * 同一个秘密不该登记两次。两条描述同一件事但名字不同（「试药残篇」/「柳长老拿弟子试药」）
 * 在数据库层**拦不住**，那是语义重复，只能靠作者自己看 —— 不要假装约束能解决它。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以必须走新 lane。
 */
export const M21_SECRETS_SQL = [
  `CREATE TABLE secrets (
      secret_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      holder_names TEXT NOT NULL DEFAULT '[]',
      unaware_names TEXT NOT NULL DEFAULT '[]',
      reveal_chapter INTEGER,
      evidence TEXT,
      source TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(title),
      CHECK(reveal_chapter IS NULL OR reveal_chapter > 0)
    )`,
  'CREATE INDEX idx_secrets_reveal ON secrets(reveal_chapter)',
] as const

const REVEAL_INDEX = 'idx_secrets_reveal'

function hasSchemaObject(db: Database.Database, type: 'table' | 'index', name: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get(type, name))
}

/** 幂等：表与索引**各自**判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM21Secrets(db: Database.Database): void {
  if (!hasSchemaObject(db, 'table', 'secrets')) db.exec(M21_SECRETS_SQL[0])
  if (!hasSchemaObject(db, 'index', REVEAL_INDEX)) db.exec(M21_SECRETS_SQL[1])
}

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null; pk: number }
type IndexInfo = { name: string; unique: number }

function columnsOf(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
}

/** 单列 UNIQUE：按「唯一索引只有这一列」判。 */
function hasUniqueIndexOn(db: Database.Database, table: string, expected: readonly string[]): boolean {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as IndexInfo[]
  return indexes.some(index => {
    if (!index.unique) return false
    const columns = db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>
    return columns.length === expected.length && columns.every((column, position) => column.name === expected[position])
  })
}

/** CHECK 是形状的一部分（非空揭穿章必须为正）：读 sqlite_master 的 DDL 断言，不写库。 */
function hasExpectedChecks(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  const sql = (row?.sql ?? '').replace(/\s+/gu, ' ')
  return sql.includes('UNIQUE(title)')
    && sql.includes('CHECK(reveal_chapter IS NULL OR reveal_chapter > 0)')
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM21Secrets(db: Database.Database): boolean {
  try {
    if (!hasSchemaObject(db, 'table', 'secrets')) return false
    if (!hasUniqueIndexOn(db, 'secrets', ['title'])) return false
    if (!hasExpectedChecks(db, 'secrets')) return false

    const columns = columnsOf(db, 'secrets')
    const required = ['secret_id', 'title', 'detail', 'holder_names', 'unaware_names',
      'reveal_chapter', 'evidence', 'source', 'created_at', 'updated_at']
    if (!required.every(name => columns.some(column => column.name === name))) return false
    // `TEXT PRIMARY KEY` 在 SQLite 里不会被记成 NOT NULL，所以断言 `pk=1`（与 M16 同一条坑）。
    if (columns.find(column => column.name === 'secret_id')?.pk !== 1) return false
    // 三处「空值有意义」的列必须**可空**：揭穿章未定、出处没记、时间戳由仓储写。
    for (const optional of ['reveal_chapter', 'evidence', 'created_at', 'updated_at']) {
      if (columns.find(column => column.name === optional)?.notnull !== 0) return false
    }
    // 秘密名与真相本体缺一个都不是一条秘密；两个名字数组与来源也必须有值（哪怕是 `[]`）。
    for (const filled of ['title', 'detail', 'holder_names', 'unaware_names', 'source']) {
      if (columns.find(column => column.name === filled)?.notnull !== 1) return false
    }

    return hasSchemaObject(db, 'index', REVEAL_INDEX)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM21Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M21', from: 21, to: 22, owner: 'P20',
    migrate: reader => applyM21Secrets(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM21Secrets(deps.database(reader)) }
}
