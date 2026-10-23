import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import {
  deleteInstitutionCadence,
  getInstitutionCadence,
  hasInstitutionCadenceSchema,
  listInstitutionCadences,
  upsertInstitutionCadence,
} from '../institution-cadence-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

function emptyDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  return db
}

function migratedDb() {
  const db = emptyDb()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  return db
}

describe('institution cadence repository', () => {
  it('M15 之前的库降级成空结果，不抛错', () => {
    const db = emptyDb()
    try {
      expect(hasInstitutionCadenceSchema(db)).toBe(false)
      expect(listInstitutionCadences(db)).toEqual([])
      expect(getInstitutionCadence(db, 'cadence:x')).toBeUndefined()
      // 写入必须显式失败并给可读原因，而不是抛裸异常
      expect(upsertInstitutionCadence(db, { name: '月例', axis: 'chapter', interval: 10 }))
        .toEqual({ success: false, error: 'CADENCE_SCHEMA_MISSING' })
      expect(deleteInstitutionCadence(db, 'cadence:x'))
        .toEqual({ success: false, error: 'CADENCE_SCHEMA_MISSING' })
    } finally { db.close() }
  })

  it('新建后能按 id 读到，字段原样回读（含空锚与 0 日序的区别）', () => {
    const db = migratedDb()
    try {
      const monthly = upsertInstitutionCadence(db, {
        name: '月例', axis: 'chapter', interval: 10, anchorChapter: 12,
        note: '外门弟子', chapterNumber: 3, evidence: '又到了发月例的日子',
      })
      expect(monthly.success).toBe(true)
      expect(getInstitutionCadence(db, monthly.cadenceId!)).toMatchObject({
        name: '月例', axis: 'chapter', interval: 10, anchorChapter: 12,
        anchorStoryDay: null, fallbackIntervalChapters: null,
        note: '外门弟子', chapterNumber: 3, evidence: '又到了发月例的日子', source: 'author',
      })

      const patrol = upsertInstitutionCadence(db, {
        name: '巡夜', axis: 'story-day', interval: 3, anchorChapter: 12,
        anchorStoryDay: 0, fallbackIntervalChapters: 3,
      })
      // 0 与 null 必须原样区分：0 是「故事开始当天」，null 是「没登记」
      expect(getInstitutionCadence(db, patrol.cadenceId!)).toMatchObject({
        anchorStoryDay: 0, fallbackIntervalChapters: 3,
      })
    } finally { db.close() }
  })

  it('重名就地拒绝（不是裸 UNIQUE 错误），改名后可保存', () => {
    const db = migratedDb()
    try {
      const first = upsertInstitutionCadence(db, { name: '月例', axis: 'chapter', interval: 10 })
      expect(first.success).toBe(true)
      expect(upsertInstitutionCadence(db, { name: '月例', axis: 'story-day', interval: 7 }))
        .toEqual({ success: false, error: 'CADENCE_NAME_DUPLICATED' })
      // 同一条制度改字段（含改名）不受重名闸门影响
      expect(upsertInstitutionCadence(db, {
        cadenceId: first.cadenceId!, name: '月例发放', axis: 'chapter', interval: 10,
      }).success).toBe(true)
      expect(listInstitutionCadences(db).map(cadence => cadence.name)).toEqual(['月例发放'])
    } finally { db.close() }
  })

  it('间隔与章号只收正整数；日序收 0；轴只收两值', () => {
    const db = migratedDb()
    try {
      for (const interval of [0, -1, 1.5]) {
        expect(upsertInstitutionCadence(db, { name: `事件${interval}`, axis: 'chapter', interval }))
          .toEqual({ success: false, error: 'CADENCE_INVALID:interval' })
      }
      expect(upsertInstitutionCadence(db, { name: '章号0', axis: 'chapter', interval: 3, anchorChapter: 0 }))
        .toEqual({ success: false, error: 'CADENCE_INVALID:anchorChapter' })
      expect(upsertInstitutionCadence(db, { name: '出处章0', axis: 'chapter', interval: 3, chapterNumber: 0 }))
        .toEqual({ success: false, error: 'CADENCE_INVALID:chapterNumber' })
      expect(upsertInstitutionCadence(db, { name: '降级0', axis: 'story-day', interval: 3, fallbackIntervalChapters: 0 }))
        .toEqual({ success: false, error: 'CADENCE_INVALID:fallbackIntervalChapters' })
      expect(upsertInstitutionCadence(db, { name: '轴错', axis: 'week' as never, interval: 3 }))
        .toEqual({ success: false, error: 'CADENCE_INVALID:axis' })
      // 日序 0 合法（故事开始当天）
      expect(upsertInstitutionCadence(db, { name: '巡夜', axis: 'story-day', interval: 1, anchorStoryDay: 0 }).success)
        .toBe(true)
      expect(listInstitutionCadences(db)[0]?.anchorStoryDay).toBe(0)
    } finally { db.close() }
  })

  it('缺名称直接拒，且不留下半条记录', () => {
    const db = migratedDb()
    try {
      expect(upsertInstitutionCadence(db, { name: '   ', axis: 'chapter', interval: 10 }).success).toBe(false)
      expect(upsertInstitutionCadence(db, { name: '月例', axis: 'chapter', interval: 10 }).success).toBe(true)
      // 上行成功的那条不该被上一条失败污染
      expect(listInstitutionCadences(db)).toHaveLength(1)
    } finally { db.close() }
  })

  it('删除是真删；删不存在的给明确原因；列表按轴分组', () => {
    const db = migratedDb()
    try {
      const monthly = upsertInstitutionCadence(db, { name: '月例', axis: 'chapter', interval: 10 })
      upsertInstitutionCadence(db, { name: '巡夜', axis: 'story-day', interval: 3 })
      expect(listInstitutionCadences(db).map(cadence => cadence.axis)).toEqual(['chapter', 'story-day'])
      expect(deleteInstitutionCadence(db, monthly.cadenceId!)).toEqual({ success: true })
      expect(deleteInstitutionCadence(db, monthly.cadenceId!))
        .toEqual({ success: false, error: 'CADENCE_NOT_FOUND' })
      expect(listInstitutionCadences(db).map(cadence => cadence.name)).toEqual(['巡夜'])
    } finally { db.close() }
  })
})
