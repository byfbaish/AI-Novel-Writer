import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { deleteKeyItem, getKeyItem, hasKeyItemSchema, listKeyItems, upsertKeyItem } from '../key-item-repository'

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

describe('key item repository', () => {
  it('M14 之前的库降级成空结果，不抛错', () => {
    const db = emptyDb()
    try {
      expect(hasKeyItemSchema(db)).toBe(false)
      expect(listKeyItems(db)).toEqual([])
      expect(getKeyItem(db, 'item:x')).toBeUndefined()
      // 写入必须显式失败并给可读原因，而不是抛裸异常
      expect(upsertKeyItem(db, { name: '麻绳', holderLabel: '顾长风' }))
        .toEqual({ success: false, error: 'KEY_ITEM_SCHEMA_MISSING' })
      expect(deleteKeyItem(db, 'item:x')).toEqual({ success: false, error: 'KEY_ITEM_SCHEMA_MISSING' })
    } finally { db.close() }
  })

  it('新建后能按名字读到，字段原样回读', () => {
    const db = migratedDb()
    try {
      const written = upsertKeyItem(db, {
        name: '麻绳',
        holderLabel: '顾长风',
        holderCharacter: '顾长风',
        statusNote: '串着四枚下品灵石',
        chapterNumber: 3,
        evidence: '他把麻绳绕了两圈',
      })
      expect(written.success).toBe(true)
      const item = getKeyItem(db, written.itemId!)!
      expect(item).toMatchObject({
        name: '麻绳',
        holderLabel: '顾长风',
        holderCharacter: '顾长风',
        statusNote: '串着四枚下品灵石',
        chapterNumber: 3,
        evidence: '他把麻绳绕了两圈',
        source: 'author',
      })
    } finally { db.close() }
  })

  it('重名就地拒绝（不是裸 UNIQUE 错误），改名后可保存', () => {
    const db = migratedDb()
    try {
      const first = upsertKeyItem(db, { name: '欠条', holderLabel: '赵无妄' })
      expect(first.success).toBe(true)
      expect(upsertKeyItem(db, { name: '欠条', holderLabel: '顾长风' }))
        .toEqual({ success: false, error: 'KEY_ITEM_NAME_DUPLICATED' })
      // 同一件物品改字段（含改名）不受重名闸门影响
      expect(upsertKeyItem(db, { itemId: first.itemId!, name: '借据', holderLabel: '赵无妄' }).success).toBe(true)
      expect(listKeyItems(db).map(item => item.name)).toEqual(['借据'])
    } finally { db.close() }
  })

  it('章号只收正整数：0 / 负数 / 小数都被拒（0 不等于「没标」）', () => {
    const db = migratedDb()
    try {
      for (const chapterNumber of [0, -1, 1.5]) {
        expect(upsertKeyItem(db, { name: `物品${chapterNumber}`, holderLabel: '无主', chapterNumber }))
          .toEqual({ success: false, error: 'KEY_ITEM_INVALID:chapterNumber' })
      }
      expect(upsertKeyItem(db, { name: '无章号', holderLabel: '无主', chapterNumber: null }).success).toBe(true)
      expect(listKeyItems(db)[0]?.chapterNumber).toBeNull()
    } finally { db.close() }
  })

  it('缺名称或持有者直接拒，且不留下半条记录', () => {
    const db = migratedDb()
    try {
      expect(upsertKeyItem(db, { name: '   ', holderLabel: '顾长风' }).success).toBe(false)
      expect(upsertKeyItem(db, { name: '麻绳', holderLabel: '   ' }).success).toBe(false)
      expect(listKeyItems(db)).toEqual([])
    } finally { db.close() }
  })

  it('删除是真删；删不存在的给明确原因', () => {
    const db = migratedDb()
    try {
      const written = upsertKeyItem(db, { name: '麻绳', holderLabel: '顾长风' })
      expect(deleteKeyItem(db, written.itemId!)).toEqual({ success: true })
      expect(listKeyItems(db)).toEqual([])
      expect(deleteKeyItem(db, written.itemId!)).toEqual({ success: false, error: 'KEY_ITEM_NOT_FOUND' })
    } finally { db.close() }
  })

  it('排序把同一持有者的物品放在一起（作者扫表不用来回跳）', () => {
    const db = migratedDb()
    try {
      upsertKeyItem(db, { name: '乙物', holderLabel: '赵无妄' })
      upsertKeyItem(db, { name: '甲物', holderLabel: '顾长风', holderCharacter: '顾长风' })
      upsertKeyItem(db, { name: '丙物', holderLabel: '顾长风', holderCharacter: '顾长风' })
      const names = listKeyItems(db).map(item => item.name)
      expect(names).toHaveLength(3)
      // 只断言「同持有者相邻」，不断言中文的字节序 —— 那由 SQLite 的 BINARY 排序决定，
      // 不是拼音序，钉死它只会让以后改排序的人白白改测试。
      expect(Math.abs(names.indexOf('甲物') - names.indexOf('丙物'))).toBe(1)
    } finally { db.close() }
  })
})
