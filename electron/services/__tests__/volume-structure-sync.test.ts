import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { listVolumes } from '../../repositories/volume-structure-repository'
import {
  markVolumeProgressForChapter,
  refreshVolumeProgress,
  syncVolumeStructureFromCore,
} from '../volume-structure-sync'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * 卷结构自动同步（D14）。
 *
 * 守五条：
 * 1. 架构里有卷 / 单元文本 ⇒ 提交后自动落库，**不需要任何手动点击**；
 * 2. 重建**幂等**，重复调用不会把 `planned_last` 抄进 `actual_last`；
 * 3. 没有 `project_core` / 没有卷结构文本 ⇒ 返回 `null`，不抛、不阻断主流程；
 * 4. 定稿之后自动推进 `actual_last`，值 = **本卷区间内已定稿的最大章号**（不是 `planned_last`）；
 * 5. 只有**该章所属的那一卷**被推进，后面那些卷保持 `null`（不能把「还没写」变成「已写到」）；
 * 6. **回填历史**：正文先定稿、卷结构后建出来的老项目，一次全量对账就能补齐
 *    （实机就是这个顺序，只补事件不补对账 ⇒ 第 1 卷永远显示空进度）。
 */
const PLAN_THREE = `# 卷 / 单元结构
## 卷一：杂役处
### 单元一：醒来
### 单元二：签到
## 卷二：百草园
### 单元一：阵法
### 单元二：药园
## 卷三：执法殿
### 单元一：围猎
### 单元二：赵家
`

function migratedDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  return db
}

function seedCore(db: InstanceType<typeof Database>, plan: string | null) {
  db.prepare('INSERT INTO project_core(id, project_name, global_guidance, plot_structure_plan) VALUES(?,?,?,?)')
    .run('main', '合成小说', '保留作者事实', plan ?? '')
}

let draftId = 0
function seedDraft(db: InstanceType<typeof Database>, chapterNumber: number, status: string) {
  draftId += 1
  const contentId = db.prepare('INSERT INTO contents(body) VALUES(?)').run('合成正文').lastInsertRowid
  db.prepare('INSERT INTO drafts (id, chapter_number, version, status, content_id) VALUES (?, ?, ?, ?, ?)')
    .run(draftId, chapterNumber, 1, status, contentId)
  return draftId
}

function seedFinalized(db: InstanceType<typeof Database>, chapterNumber: number) {
  return seedDraft(db, chapterNumber, 'finalized')
}

describe('syncVolumeStructureFromCore', () => {
  it('架构里有卷/单元文本 ⇒ 自动落库，actual_last 留空', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    expect(listVolumes(db)).toHaveLength(0)

    const result = syncVolumeStructureFromCore(db)

    expect(result?.volumes).toBe(3)
    const volumes = listVolumes(db)
    expect(volumes).toHaveLength(3)
    // 关键：重建只写计划列，actual_last 必须是 null（它是「事实」，不是估算）
    for (const volume of volumes) expect(volume.actualLast).toBeNull()
  })

  it('幂等：连调两次不改变卷数，也不把 planned_last 抄成 actual_last', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    const first = listVolumes(db)

    syncVolumeStructureFromCore(db)
    const second = listVolumes(db)

    expect(second).toHaveLength(first.length)
    for (const volume of second) expect(volume.actualLast).toBeNull()
  })

  it('没有 project_core ⇒ 返回 null，不抛', () => {
    const db = migratedDb()
    expect(syncVolumeStructureFromCore(db)).toBeNull()
  })

  it('卷结构文本为空 ⇒ 返回 null，不建任何卷', () => {
    const db = migratedDb()
    seedCore(db, null)
    expect(syncVolumeStructureFromCore(db)).toBeNull()
    expect(listVolumes(db)).toHaveLength(0)
  })
})

describe('markVolumeProgressForChapter', () => {
  it('定稿后自动推进本卷 actual_last，且不碰后面的卷', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    const before = listVolumes(db)
    const first = before[0]!
    expect(first.plannedFirst).not.toBeNull()

    seedFinalized(db, first.plannedFirst!)
    expect(markVolumeProgressForChapter(db, first.plannedFirst!)).toBe(1)

    const after = listVolumes(db)
    expect(after[0]!.actualLast).toBe(first.plannedFirst)
    // 取的是「已定稿的最大章号」，不是 planned_last
    expect(after[0]!.actualLast).not.toBe(first.plannedLast)
    // 后面的卷一律保持 null
    for (const volume of after.slice(1)) expect(volume.actualLast).toBeNull()
  })

  it('只记已定稿的章号：未定稿的章不参与', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    const first = listVolumes(db)[0]!
    const start = first.plannedFirst!

    seedFinalized(db, start)
    seedDraft(db, start + 1, 'candidate')
    markVolumeProgressForChapter(db, start + 1)

    expect(listVolumes(db)[0]!.actualLast).toBe(start)
  })

  it('本章不属于任何卷 ⇒ 返回 0，不抛', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    // 远超最后一卷区间
    expect(markVolumeProgressForChapter(db, 99999)).toBe(0)
  })

  it('卷结构未建立 ⇒ 返回 0，不抛（不能让定稿因此失败）', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    expect(markVolumeProgressForChapter(db, 1)).toBe(0)
  })
})

describe('refreshVolumeProgress', () => {
  /**
   * 实机复现的顺序：正文先定稿，卷结构**后**建出来。
   * 只做「定稿时推进」的话，这一卷的 `actual_last` 永远停在 null —— 看起来和没修一样。
   */
  it('回填历史：正文先定稿、卷结构后建 ⇒ 一次对账补齐全卷进度', () => {
    const db = migratedDb()
    // 先有 3 章定稿，此时还没有任何卷
    seedFinalized(db, 1)
    seedFinalized(db, 2)
    seedFinalized(db, 3)
    seedCore(db, PLAN_THREE)

    // 架构提交（sync）自带对账，落库同时就把进度补上
    syncVolumeStructureFromCore(db)

    const volumes = listVolumes(db)
    expect(volumes[0]!.plannedFirst).toBe(1)
    expect(volumes[0]!.actualLast).toBe(3)
    // 后面的卷没有任何定稿章 ⇒ 保持 null
    for (const volume of volumes.slice(1)) expect(volume.actualLast).toBeNull()
  })

  it('幂等：连调两次结果不变（不把 planned_last 抄成 actual_last）', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    seedFinalized(db, 1)

    expect(refreshVolumeProgress(db)).toBe(1)
    const first = listVolumes(db)
    refreshVolumeProgress(db)
    const second = listVolumes(db)

    expect(second.map(v => v.actualLast)).toEqual(first.map(v => v.actualLast))
    expect(second[0]!.actualLast).toBe(1)
  })

  it('全卷都没有定稿章 ⇒ 返回 0，不抛，全部保持 null', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    expect(refreshVolumeProgress(db)).toBe(0)
    for (const volume of listVolumes(db)) expect(volume.actualLast).toBeNull()
  })

  it('卷结构未建立 ⇒ 返回 0，不抛', () => {
    const db = migratedDb()
    expect(refreshVolumeProgress(db)).toBe(0)
  })

  it('跨卷不串：每卷取各自区间的最大已定稿章号', () => {
    const db = migratedDb()
    seedCore(db, PLAN_THREE)
    syncVolumeStructureFromCore(db)
    const volumes = listVolumes(db)
    const second = volumes[1]!
    // 第二卷只定稿了它的第一、二章；第一卷整卷没有
    seedFinalized(db, second.plannedFirst!)
    seedFinalized(db, second.plannedFirst! + 1)

    refreshVolumeProgress(db)

    const after = listVolumes(db)
    expect(after[0]!.actualLast).toBeNull()
    expect(after[1]!.actualLast).toBe(second.plannedFirst! + 1)
    expect(after[2]!.actualLast).toBeNull()
  })
})
