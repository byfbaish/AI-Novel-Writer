import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import {
  deleteVolumeHandoff,
  findPreviousHandoff,
  hasVolumeHandoffSchema,
  listVolumeHandoffs,
  upsertVolumeHandoff,
} from '../volume-handoff-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * 卷末交接单仓储（M19 之后：区间外置到 `volumes`）。
 *
 * 守七条：
 * 1. **`volumes` 缺失也算没有 schema** —— 只探 `volume_handoffs` 会让 `JOIN` 抛 `no such table`，
 *    被正文链的 `catch { return null }` 吞成「没有上一卷」，跨卷记忆静默消失（B2 反例）；
 * 2. 卷不存在 / 同卷已有一份 ⇒ 可读的拒绝原因；
 * 3. `findPreviousHandoff` 只返回一条，且**末章等于本章不算上一卷**；
 * 4. `actual_last` 覆盖 `planned_last`：该卷写超了，早章就不该提前拿到它的交接单；
 * 5. 区间由 `volumeEffectiveRanges` 派生（起点 = 上一卷有效末章 + 1）；
 * 6. JSON 列永远 `'[]'` 或数组字符串，脏 JSON 退 `[]` 不抛；
 * 7. 指向已删的卷时**保留该行**（区间为 null）让面板处理，`findPreviousHandoff` 跳过它。
 */
function migratedDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  return db
}

function seedVolume(
  db: InstanceType<typeof Database>,
  index: number,
  first: number,
  last: number,
  actualLast: number | null = null,
): string {
  const volumeId = `volume:${index}`
  db.prepare(`INSERT INTO volumes(volume_id,volume_index,name,planned_first,planned_last,
    planned_source,actual_last,actual_source,outline_hash,source)
    VALUES(?,?,?,?,?,'headings',?,?,'hash','outline')`).run(
    volumeId, index, `第${index}卷`, first, last,
    actualLast, actualLast === null ? null : 'finalized',
  )
  return volumeId
}

describe('volume handoff repository', () => {
  it('M19 之前的库降级成空结果，不抛错（写入给可读原因）', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys=ON')
    db.transaction(() => initializeLegacyBaselineSchema(db))()
    try {
      expect(hasVolumeHandoffSchema(db)).toBe(false)
      expect(listVolumeHandoffs(db)).toEqual([])
      expect(findPreviousHandoff(db, 30)).toBeNull()
      expect(deleteVolumeHandoff(db, 'handoff:x')).toBe(false)
      expect(() => upsertVolumeHandoff(db, { volumeId: 'volume:1' })).toThrow('VOLUME_HANDOFF_SCHEMA_MISSING')
    } finally { db.close() }
  })

  it('B2 反例：只有 volume_handoffs、没有 volumes ⇒ 整条读路径仍降级', () => {
    const db = new Database(':memory:')
    try {
      // M18 形状的表：13 列、没有 volumes。这正是「升到 v19 但没到 v20」的库。
      db.exec(`CREATE TABLE volume_handoffs (
        handoff_id TEXT PRIMARY KEY, volume_index INTEGER NOT NULL UNIQUE,
        first_chapter INTEGER NOT NULL, last_chapter INTEGER NOT NULL,
        world_state TEXT, hero_state TEXT,
        events_json TEXT NOT NULL DEFAULT '[]', items_json TEXT NOT NULL DEFAULT '[]',
        debts_json TEXT NOT NULL DEFAULT '[]', open_thread TEXT, source TEXT NOT NULL,
        created_at TEXT, updated_at TEXT)`)
      expect(hasVolumeHandoffSchema(db)).toBe(false)
      expect(listVolumeHandoffs(db)).toEqual([])
      expect(findPreviousHandoff(db, 30)).toBeNull()
      expect(() => upsertVolumeHandoff(db, { volumeId: 'volume:1' })).toThrow('VOLUME_HANDOFF_SCHEMA_MISSING')
    } finally { db.close() }
  })

  it('卷不存在 ⇒ VOLUME_HANDOFF_VOLUME_NOT_FOUND', () => {
    const db = migratedDb()
    try {
      expect(() => upsertVolumeHandoff(db, { volumeId: 'volume:404' })).toThrow('VOLUME_HANDOFF_VOLUME_NOT_FOUND')
    } finally { db.close() }
  })

  it('同一卷登记第二份 ⇒ VOLUME_HANDOFF_VOLUME_TAKEN；同一行改内容放行', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId, worldState: '初稿' })
      expect(() => upsertVolumeHandoff(db, { volumeId, worldState: '另一份' }))
        .toThrow('VOLUME_HANDOFF_VOLUME_TAKEN')
      const updated = upsertVolumeHandoff(db, { handoffId: saved.handoffId, volumeId, worldState: '改过' })
      expect(updated.handoffId).toBe(saved.handoffId)
      expect(updated.worldState).toBe('改过')
      expect(updated.createdAt).toBe(saved.createdAt)
    } finally { db.close() }
  })

  it('三个数组原样往返；空数组落库是 []', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, {
        volumeId,
        events: ['玄火令被夺', '沈砚投靠监天台'],
        items: ['玄火令在监天台手中'],
        debts: [],
      })
      expect(saved.events).toEqual(['玄火令被夺', '沈砚投靠监天台'])
      expect(saved.items).toEqual(['玄火令在监天台手中'])
      expect(saved.debts).toEqual([])
      const raw = db.prepare('SELECT debts_json FROM volume_handoffs WHERE handoff_id=?')
        .pluck().get(saved.handoffId)
      expect(raw).toBe('[]')
    } finally { db.close() }
  })

  it('空文本存 NULL，读回空串', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId, worldState: '   ', heroState: '' })
      expect(saved.worldState).toBe('')
      expect(saved.heroState).toBe('')
      const raw = db.prepare('SELECT world_state FROM volume_handoffs WHERE handoff_id=?')
        .pluck().get(saved.handoffId)
      expect(raw).toBeNull()
    } finally { db.close() }
  })

  it('findPreviousHandoff 只返回一条：末章等于本章不算上一卷', () => {
    const db = migratedDb()
    try {
      const first = seedVolume(db, 1, 1, 20)
      const second = seedVolume(db, 2, 21, 40)
      upsertVolumeHandoff(db, { volumeId: first, worldState: '第一卷' })
      upsertVolumeHandoff(db, { volumeId: second, worldState: '第二卷' })
      expect(findPreviousHandoff(db, 45)?.worldState).toBe('第二卷')
      expect(findPreviousHandoff(db, 41)?.worldState).toBe('第二卷')
      // 第 40 章还属于第 2 卷 ⇒ 不能提前拿到第 2 卷的交接单。
      expect(findPreviousHandoff(db, 40)?.worldState).toBe('第一卷')
      expect(findPreviousHandoff(db, 21)?.worldState).toBe('第一卷')
      expect(findPreviousHandoff(db, 20)).toBeNull()
      expect(findPreviousHandoff(db, 1)).toBeNull()
    } finally { db.close() }
  })

  it('actual_last 覆盖 planned_last：写超的卷不会让早章提前拿到它的交接单', () => {
    const db = migratedDb()
    try {
      // 第 1 卷计划 1–20，实际写到 25。
      const first = seedVolume(db, 1, 1, 20, 25)
      const second = seedVolume(db, 2, 21, 40)
      upsertVolumeHandoff(db, { volumeId: first, worldState: '第一卷' })
      upsertVolumeHandoff(db, { volumeId: second, worldState: '第二卷' })
      // 第 23 章还在第 1 卷里 ⇒ 拿不到任何「上一卷」（第 1 卷自己还没结束）。
      expect(findPreviousHandoff(db, 23)).toBeNull()
      expect(findPreviousHandoff(db, 26)?.worldState).toBe('第一卷')
    } finally { db.close() }
  })

  it('区间由 volumeEffectiveRanges 派生：起点 = 上一卷有效末章 + 1', () => {
    const db = migratedDb()
    try {
      const first = seedVolume(db, 1, 1, 20, 25)
      seedVolume(db, 2, 21, 40)
      const saved = upsertVolumeHandoff(db, { volumeId: first })
      expect([saved.firstChapter, saved.lastChapter]).toEqual([1, 25])
      expect(saved.boundaryBasis).toBe('actual')
      const second = listVolumeHandoffs(db).find(entry => entry.volumeId === 'volume:2')
      // 第 2 卷没有交接单，所以这里只有一条；起点规则在 volume-structure 的测试里全覆盖。
      expect(second).toBeUndefined()
    } finally { db.close() }
  })

  it('脏 JSON / 非数组 / 非字符串元素 ⇒ 退 []，不抛', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId })
      db.prepare('UPDATE volume_handoffs SET events_json=?, items_json=?, debts_json=? WHERE handoff_id=?')
        .run('{not json', '[1,2]', '[{"a":1},"有效"]', saved.handoffId)
      const reloaded = listVolumeHandoffs(db)[0]!
      expect(reloaded.events).toEqual([])
      expect(reloaded.items).toEqual([])
      expect(reloaded.debts).toEqual(['有效'])
    } finally { db.close() }
  })

  it('删除是真删；不存在返回 false', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId })
      expect(deleteVolumeHandoff(db, saved.handoffId)).toBe(true)
      expect(listVolumeHandoffs(db)).toEqual([])
      expect(deleteVolumeHandoff(db, saved.handoffId)).toBe(false)
      expect(deleteVolumeHandoff(db, '')).toBe(false)
    } finally { db.close() }
  })

  it('指向已删的卷：保留该行且区间为 null，findPreviousHandoff 跳过它', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId, worldState: '孤儿' })
      // 外键 RESTRICT 正常路径删不掉；这里模拟「外部写入绕过外键」的坏数据。
      db.pragma('foreign_keys=OFF')
      db.prepare('DELETE FROM volumes WHERE volume_id=?').run(volumeId)
      db.pragma('foreign_keys=ON')

      const listed = listVolumeHandoffs(db)
      expect(listed).toHaveLength(1)
      expect(listed[0]!.volumeIndex).toBeNull()
      expect(listed[0]!.firstChapter).toBeNull()
      expect(listed[0]!.boundaryBasis).toBeNull()
      expect(listed[0]!.worldState).toBe('孤儿')
      expect(findPreviousHandoff(db, 30)).toBeNull()
      expect(deleteVolumeHandoff(db, saved.handoffId)).toBe(true)
    } finally { db.close() }
  })
})

/**
 * P1-2 期 2：自动生成写的是 `source='generated'`，作者手填是 `'author'`。
 * 两件事必须在仓储层就成立，否则上层所有「作者版不被覆盖」的判断都是空的：
 * 1. `generated` 能原样往返（不被默认值悄悄改成 `author`）；
 * 2. 同一 `handoffId` 二次写入只刷新 `updated_at`，`created_at` 与主键都不动。
 */
describe('volume handoff source（P1-2 期 2）', () => {
  it('source=generated 原样往返，不被默认值改成 author', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId, worldState: '模型初稿', source: 'generated' })
      expect(saved.source).toBe('generated')
      expect(listVolumeHandoffs(db)[0]!.source).toBe('generated')
    } finally { db.close() }
  })

  it('同一 handoffId 二次 upsert：created_at 不动、updated_at 刷新、source 可改写', () => {
    const db = migratedDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      const saved = upsertVolumeHandoff(db, { volumeId, worldState: '初稿', source: 'generated' })
      // 把 updated_at 钉到一个肯定过去的时刻，避免同毫秒内两次写入被判成「没变」。
      db.prepare("UPDATE volume_handoffs SET updated_at='2000-01-01T00:00:00.000Z' WHERE handoff_id=?")
        .run(saved.handoffId)
      const again = upsertVolumeHandoff(db, {
        handoffId: saved.handoffId, volumeId, worldState: '作者改过', source: 'author',
      })
      expect(again.handoffId).toBe(saved.handoffId)
      expect(again.createdAt).toBe(saved.createdAt)
      expect(again.updatedAt).not.toBe('2000-01-01T00:00:00.000Z')
      expect(again.source).toBe('author')
    } finally { db.close() }
  })
})
