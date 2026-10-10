import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M07 把第五层「阶段结构 / 自由弧」显性化为 project_core.plot_structure_plan。
 * M00 基线已冻结（指纹即其 CREATE TABLE 文本哈希），因此新增列必须走新的 lane 步骤，
 * 不能改 baseline-schema.ts 里的 CREATE TABLE —— 否则所有旧项目的指纹会全部失配。
 */
export const M07_PLOT_STRUCTURE_PLAN_SQL =
  "ALTER TABLE project_core ADD COLUMN plot_structure_plan TEXT NOT NULL DEFAULT ''"

function hasPlotStructurePlan(db: Database.Database): boolean {
  const columns = db.prepare('PRAGMA table_info(project_core)').all() as Array<{ name: string }>
  return columns.some(column => column.name === 'plot_structure_plan')
}

/** 幂等：若列已存在则直接返回，重复执行不会改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM07PlotStructurePlan(db: Database.Database): void {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_core'").get()) {
    throw new Error('PLOT_STRUCTURE_PLAN_MIGRATION_SCHEMA_UNRECOGNIZED')
  }
  if (hasPlotStructurePlan(db)) return
  db.exec(M07_PLOT_STRUCTURE_PLAN_SQL)
}

export function verifyM07PlotStructurePlan(db: Database.Database): boolean {
  try {
    const columns = db.prepare('PRAGMA table_info(project_core)').all() as Array<{ name: string; notnull: number }>
    const column = columns.find(item => item.name === 'plot_structure_plan')
    return Boolean(column) && column!.notnull === 1
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM07Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M07', from: 7, to: 8, owner: 'S11',
    migrate: reader => applyM07PlotStructurePlan(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM07PlotStructurePlan(deps.database(reader)) }
}
