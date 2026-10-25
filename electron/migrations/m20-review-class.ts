import type Database from 'better-sqlite3'

import { canonicalM03FindingSetHash, descriptor } from './m03-review-cycle'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M20：findings 增加 mechanical/semantic 轴（A2，2026-10-25）。
 *
 * 轴回答「这条能不能机械地改」——与 severity 正交，来自模型输出，缺省 NULL。
 * 作者裁定：同性质的字段必须进指纹，所以 `review_class` 纳入
 * `canonicalM03FindingSetHash`，存量 cycle 的 `finding_set_hash` 在本次迁移里按新口径重算。
 * 目前没有发行版，故直接重算，不为旧口径留兼容分支；存量 finding 的轴一律 NULL，不按 category 猜。
 */
const TABLE = 'review_findings'
const COLUMN = 'review_class'
const CHECK = `CHECK(${COLUMN} IS NULL OR ${COLUMN} IN ('mechanical','semantic'))`

export const M20_REVIEW_CLASS_SQL = `ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} TEXT ${CHECK}`

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function applyM20ReviewClass(db: Database.Database): void {
  if (!db.inTransaction) throw new Error('REVIEW_CLASS_MIGRATION_TRANSACTION_REQUIRED')
  const columns = (db.prepare(`PRAGMA table_info(${TABLE})`).all() as { name: string }[]).map(row => row.name)
  if (columns.length === 0) throw new Error('REVIEW_CLASS_MIGRATION_TABLE_MISSING')
  if (!columns.includes(COLUMN)) db.exec(M20_REVIEW_CLASS_SQL)

  // 轴进了指纹，不重算就会让 ReviewCycleRepository 对存量 cycle 报 hash 冲突。
  const cycles = db.prepare('SELECT cycle_id FROM review_cycles ORDER BY cycle_id').all() as { cycle_id: string }[]
  const selectFindings = db.prepare(`SELECT * FROM ${TABLE} WHERE cycle_id=? ORDER BY finding_id`)
  const updateCycle = db.prepare('UPDATE review_cycles SET finding_set_hash=? WHERE cycle_id=?')
  for (const cycle of cycles) {
    const findings = (selectFindings.all(cycle.cycle_id) as Parameters<typeof descriptor>[0][]).map(descriptor)
    updateCycle.run(canonicalM03FindingSetHash(findings), cycle.cycle_id)
  }
}

/** 只读校验：形状错了就返回 false，由 runner 回滚整步（含 user_version）。 */
export function verifyM20ReviewClass(db: Database.Database): boolean {
  try {
    const column = (db.prepare(`PRAGMA table_info(${TABLE})`).all() as { name: string; type: string }[])
      .find(row => row.name === COLUMN)
    if (!column || column.type.toUpperCase() !== 'TEXT') return false
    const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(TABLE) as { sql: string } | undefined)?.sql
    if (!sql) return false
    return sql.replace(/\s/gu, '').toLowerCase()
      .includes(CHECK.replace(/\s/gu, '').toLowerCase())
  } catch {
    return false
  }
}

export function createM20Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return {
    id: 'M20', from: 20, to: 21, owner: 'A2',
    migrate: reader => applyM20ReviewClass(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM20ReviewClass(deps.database(reader)),
  }
}
