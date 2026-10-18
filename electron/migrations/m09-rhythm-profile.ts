import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M09 把「平台节奏画像」显性化为 project_core.rhythm_profile（v7 弧光层）。
 *
 * 为什么是列而不是全局设置：平台是**书的属性**——同一个 App 里两本书可以一本起点、一本番茄。
 * 为什么默认空串：空 = 中性（模板整段裁掉），老项目升级后不该被静默改节奏。
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane，不能改 CREATE TABLE。
 */
export const M09_RHYTHM_PROFILE_SQL =
  "ALTER TABLE project_core ADD COLUMN rhythm_profile TEXT NOT NULL DEFAULT ''"

function hasRhythmProfile(db: Database.Database): boolean {
  const columns = db.prepare('PRAGMA table_info(project_core)').all() as Array<{ name: string }>
  return columns.some(column => column.name === 'rhythm_profile')
}

/** 幂等：若列已存在则直接返回，重复执行不会改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM09RhythmProfile(db: Database.Database): void {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_core'").get()) {
    throw new Error('RHYTHM_PROFILE_MIGRATION_SCHEMA_UNRECOGNIZED')
  }
  if (hasRhythmProfile(db)) return
  db.exec(M09_RHYTHM_PROFILE_SQL)
}

export function verifyM09RhythmProfile(db: Database.Database): boolean {
  try {
    const columns = db.prepare('PRAGMA table_info(project_core)').all() as Array<{ name: string; notnull: number }>
    const column = columns.find(item => item.name === 'rhythm_profile')
    return Boolean(column) && column!.notnull === 1
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM09Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M09', from: 9, to: 10, owner: 'S11',
    migrate: reader => applyM09RhythmProfile(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM09RhythmProfile(deps.database(reader)) }
}
