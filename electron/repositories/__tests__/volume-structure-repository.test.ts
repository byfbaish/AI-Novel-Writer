import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import {
  hasVolumeStructureSchema,
  listVolumeUnits,
  listVolumes,
  markVolumeDone,
  rebuildVolumes,
} from '../volume-structure-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * 卷 / 单元结构仓储（M19）。
 *
 * 守六条：
 * 1. **重建只写计划列** —— 先手填 `actual_*` 再重建，两列必须一字未变（G2 反例）；
 * 2. **重建幂等**，且删除只发生在「大纲没有 + 没有交接单」的卷上；
 * 3. 有交接单的卷即使大纲里消失也**保留**（`source='retained'`），计划列不动；
 * 4. 改名且有交接单 ⇒ `VOLUME_NAME_CHANGED` 告警，不阻断；
 * 5. `markVolumeDone` 取**区间内已定稿章的最大章号**，不是 `planned_last`；
 * 6. 缺表降级成空结果，写入抛可读原因。
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

const PLAN_TWO = `# 卷 / 单元结构
## 卷一：杂役处
### 单元一：醒来
### 单元二：签到
## 卷二：百草园
### 单元一：阵法
### 单元二：药园
`

const PLAN_RENAMED = PLAN_THREE.replace('卷二：百草园', '卷二：百草园（改名了）')

function migratedDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  return db
}

function rebuild(db: InstanceType<typeof Database>, plan: string, totalChapters = 150) {
  return rebuildVolumes(db, { plan, synopsis: null, totalChapters })
}

function seedFinalized(db: InstanceType<typeof Database>, chapters: readonly number[]): void {
  for (const chapter of chapters) {
    db.prepare('INSERT INTO contents(body) VALUES(?)').run(`第${chapter}章正文`)
    const contentId = db.prepare('SELECT last_insert_rowid() AS id').pluck().get() as number
    db.prepare(`INSERT INTO drafts(chapter_number, version, content_id, word_count, status)
      VALUES(?, 1, ?, 1200, 'finalized')`).run(chapter, contentId)
  }
}

function seedHandoff(db: InstanceType<typeof Database>, volumeId: string): void {
  db.prepare(`INSERT INTO volume_handoffs(handoff_id, volume_id, source) VALUES(?,?,?)
    ON CONFLICT(handoff_id) DO NOTHING`).run(`handoff:${volumeId}`, volumeId, 'author')
}

describe('volume structure repository', () => {
  it('重建写入卷 / 单元与计划来源', () => {
    const db = migratedDb()
    try {
      const result = rebuild(db, PLAN_THREE)
      expect(result.volumes).toHaveLength(3)
      expect(result.volumes.map(volume => volume.volumeIndex)).toEqual([1, 2, 3])
      expect(result.volumes.map(volume => volume.name)).toEqual(['杂役处', '百草园', '执法殿'])
      expect(result.volumes.every(volume => volume.plannedSource === 'even')).toBe(true)
      expect(result.volumes.every(volume => volume.source === 'outline')).toBe(true)
      expect(result.volumes.map(volume => [volume.plannedFirst, volume.plannedLast]))
        .toEqual([[1, 50], [51, 100], [101, 150]])
      expect(listVolumeUnits(db, 'volume:1')).toHaveLength(2)
      expect(listVolumeUnits(db)).toHaveLength(6)
    } finally { db.close() }
  })

  it('G2 反例：重建只写计划列，actual_* 一字未变', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      db.prepare("UPDATE volumes SET actual_last=42, actual_source='finalized' WHERE volume_id='volume:2'").run()
      const result = rebuild(db, PLAN_THREE)
      const second = result.volumes.find(volume => volume.volumeId === 'volume:2')
      expect(second?.actualLast).toBe(42)
      expect(second?.actualSource).toBe('finalized')
      // 计划列照常被重写（它们是物化副本）。
      expect(second?.plannedFirst).toBe(51)
    } finally { db.close() }
  })

  it('重建幂等：第二次跑结果完全相同', () => {
    const db = migratedDb()
    try {
      const first = rebuild(db, PLAN_THREE)
      const second = rebuild(db, PLAN_THREE)
      expect(second.volumes).toEqual(first.volumes.map(volume => ({ ...volume, updatedAt: second.volumes
        .find(item => item.volumeId === volume.volumeId)!.updatedAt })))
      expect(second.removed).toBe(0)
      expect(second.retained).toEqual([])
    } finally { db.close() }
  })

  it('大纲已无此卷且无交接单 ⇒ 删除', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      const result = rebuild(db, PLAN_TWO)
      expect(result.volumes).toHaveLength(2)
      expect(result.removed).toBe(1)
      expect(result.retained).toEqual([])
      expect(listVolumeUnits(db, 'volume:3')).toHaveLength(0)
    } finally { db.close() }
  })

  it('有交接单的卷即使大纲里消失也保留：source=retained、计划列不动', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedHandoff(db, 'volume:3')
      const before = listVolumes(db).find(volume => volume.volumeId === 'volume:3')!
      const result = rebuild(db, PLAN_TWO)
      const retained = result.volumes.find(volume => volume.volumeId === 'volume:3')
      expect(retained).toBeDefined()
      expect(retained!.source).toBe('retained')
      expect([retained!.plannedFirst, retained!.plannedLast]).toEqual([before.plannedFirst, before.plannedLast])
      expect(result.retained).toEqual([3])
      expect(result.removed).toBe(0)
      // 外键 RESTRICT 没有炸 —— 保留比删除安全。
      expect(db.prepare('SELECT COUNT(*) FROM volume_handoffs').pluck().get()).toBe(1)
    } finally { db.close() }
  })

  it('已 retained 的卷再重建不会重复计数', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedHandoff(db, 'volume:3')
      rebuild(db, PLAN_TWO)
      const again = rebuild(db, PLAN_TWO)
      expect(again.retained).toEqual([3])
      expect(again.volumes.filter(volume => volume.source === 'retained')).toHaveLength(1)
    } finally { db.close() }
  })

  it('改卷名且有交接单 ⇒ VOLUME_NAME_CHANGED 告警，但照常重建', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedHandoff(db, 'volume:2')
      const result = rebuild(db, PLAN_RENAMED)
      expect(result.warnings).toContain('VOLUME_NAME_CHANGED:2')
      expect(result.volumes.find(volume => volume.volumeId === 'volume:2')?.name).toBe('百草园（改名了）')
    } finally { db.close() }
  })

  it('markVolumeDone 取区间内已定稿章的最大章号，不是 planned_last', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedFinalized(db, [1, 2, 3, 18])
      const result = markVolumeDone(db, 'volume:1')
      expect(result.actualLast).toBe(18)
      expect(result.volume.plannedLast).toBe(50)
      expect(result.volume.actualSource).toBe('finalized')
    } finally { db.close() }
  })

  it('下一卷计划起点之后的定稿章不计入上一卷', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedFinalized(db, [18, 19, 51])
      // 第 1 卷 1–50、下一卷起点 51 ⇒ 51 那一章不算进第 1 卷。
      expect(markVolumeDone(db, 'volume:1').actualLast).toBe(19)
      // 第 2 卷 51–100 ⇒ 只有 51 那一章属于它。
      expect(markVolumeDone(db, 'volume:2').actualLast).toBe(51)
    } finally { db.close() }
  })

  it('反例：区间内没有定稿章 ⇒ 抛错且 actual_last 仍为 NULL', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedFinalized(db, [120])
      expect(() => markVolumeDone(db, 'volume:1')).toThrow('VOLUME_MARK_DONE_NO_FINALIZED')
      const first = listVolumes(db).find(volume => volume.volumeId === 'volume:1')!
      expect(first.actualLast).toBeNull()
      expect(first.actualSource).toBeNull()
    } finally { db.close() }
  })

  it('再写两章后重新标记 ⇒ 上调', () => {
    const db = migratedDb()
    try {
      rebuild(db, PLAN_THREE)
      seedFinalized(db, [1, 2, 18])
      expect(markVolumeDone(db, 'volume:1').actualLast).toBe(18)
      seedFinalized(db, [19, 20])
      expect(markVolumeDone(db, 'volume:1').actualLast).toBe(20)
    } finally { db.close() }
  })

  it('缺表降级：读返回空数组，写抛可读原因', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys=ON')
    db.transaction(() => initializeLegacyBaselineSchema(db))()
    try {
      expect(hasVolumeStructureSchema(db)).toBe(false)
      expect(listVolumes(db)).toEqual([])
      expect(listVolumeUnits(db)).toEqual([])
      expect(() => rebuild(db, PLAN_THREE)).toThrow('VOLUME_STRUCTURE_SCHEMA_MISSING')
      expect(() => markVolumeDone(db, 'volume:1')).toThrow('VOLUME_STRUCTURE_SCHEMA_MISSING')
    } finally { db.close() }
  })
})
