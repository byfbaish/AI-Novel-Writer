import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/** M10 给 `summary_snapshots` 加故事日序两列（W2：把「今天是第几天」变成可算术的事实）。
 *
 * 为什么是列而不是散文：「三天后」「明早」这类相对时间要能相加，必须先落到一个整数锚点上；
 * 只靠章节要点里的「二月廿三」，机器算不出两章相隔几天。
 * 为什么**可空**：NULL = 没算出来，0 = 开篇当日。这两件事必须不同形，
 * 否则解析失败会被当成「第 0 日」，全书日序整体静默偏移（判据 CS）。
 * 基线（baseline-schema.ts）已冻结，所以必须走新 lane，不能改 CREATE TABLE。
 */
export const M10_STORY_DAY_SQL = [
  'ALTER TABLE summary_snapshots ADD COLUMN story_day_offset INTEGER DEFAULT NULL',
  'ALTER TABLE summary_snapshots ADD COLUMN story_day_label TEXT DEFAULT NULL',
] as const

function storyDayColumns(db: Database.Database): Array<{ name: string; notnull: number }> {
  return db.prepare('PRAGMA table_info(summary_snapshots)').all() as Array<{ name: string; notnull: number }>
}

/** 幂等：两列各自判存在，重复执行不改写 sqlite_master（指纹因此保持唯一）。 */
export function applyM10StoryDay(db: Database.Database): void {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='summary_snapshots'").get()) {
    throw new Error('STORY_DAY_MIGRATION_SCHEMA_UNRECOGNIZED')
  }
  for (const [sql, column] of [
    [M10_STORY_DAY_SQL[0], 'story_day_offset'],
    [M10_STORY_DAY_SQL[1], 'story_day_label'],
  ] as const) {
    if (!storyDayColumns(db).some(item => item.name === column)) db.exec(sql)
  }
}

/** 两列都必须存在且**可空**。若有人把它建成 NOT NULL DEFAULT 0，
 * 「缺失」就被压成了「第 0 日」—— 那是这个迁移唯一不能犯的错。 */
export function verifyM10StoryDay(db: Database.Database): boolean {
  try {
    const columns = storyDayColumns(db)
    const offset = columns.find(item => item.name === 'story_day_offset')
    const label = columns.find(item => item.name === 'story_day_label')
    return Boolean(offset) && Boolean(label) && offset!.notnull === 0 && label!.notnull === 0
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM10Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M10', from: 10, to: 11, owner: 'S11',
    migrate: reader => applyM10StoryDay(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM10StoryDay(deps.database(reader)) }
}
