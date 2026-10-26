import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { SECRET_DETAIL_MAX, SECRET_TEXT_MAX } from '../../../src/shared/secret'
import { deleteSecret, hasSecretSchema, listSecrets, upsertSecret } from '../secret-repository'

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

describe('secret repository', () => {
  it('M21 之前的库降级成空结果，不抛错', () => {
    const db = emptyDb()
    try {
      expect(hasSecretSchema(db)).toBe(false)
      expect(listSecrets(db)).toEqual([])
      // 写入必须显式失败并给可读原因，而不是抛裸异常
      expect(upsertSecret(db, { title: '试药残篇', detail: '真相' }))
        .toEqual({ success: false, error: 'SECRET_SCHEMA_MISSING' })
      expect(deleteSecret(db, 'secret:x')).toEqual({ success: false, error: 'SECRET_SCHEMA_MISSING' })
    } finally { db.close() }
  })

  it('新建后能读到，字段原样回读（含名字数组与 null 揭穿章）', () => {
    const db = migratedDb()
    try {
      const written = upsertSecret(db, {
        title: '柳长老拿弟子试药',
        detail: '试药房里的残篇是从外门弟子身上取的',
        holders: ['柳长老', '药童'],
        unaware: ['众弟子'],
        revealChapter: null,
        evidence: '谁在隐瞒什么：柳长老捂试药残篇',
      })
      expect(written.success).toBe(true)
      const [entry] = listSecrets(db)
      expect(entry).toMatchObject({
        secretId: written.secretId,
        title: '柳长老拿弟子试药',
        detail: '试药房里的残篇是从外门弟子身上取的',
        holders: ['柳长老', '药童'],
        unaware: ['众弟子'],
        revealChapter: null,
        evidence: '谁在隐瞒什么：柳长老捂试药残篇',
        source: 'author',
      })
    } finally { db.close() }
  })

  it('同名就地拒绝（不是裸 UNIQUE 错误）；改自己不受影响', () => {
    const db = migratedDb()
    try {
      const first = upsertSecret(db, { title: '宗主改账', detail: '账是宗主自己改的' })
      expect(first.success).toBe(true)
      expect(upsertSecret(db, { title: '宗主改账', detail: '另一份真相' }))
        .toEqual({ success: false, error: 'SECRET_DUPLICATED' })
      // 同一行改字段（title 不变）不受重名闸门影响
      expect(upsertSecret(db, {
        secretId: first.secretId, title: '宗主改账', detail: '改过的真相', revealChapter: 30,
      }).success).toBe(true)
      expect(listSecrets(db)[0]?.detail).toBe('改过的真相')
      expect(listSecrets(db)[0]?.revealChapter).toBe(30)
    } finally { db.close() }
  })

  it('名字数组：去重、去空白项；非法结构整条拒绝（不静默转空）', () => {
    const db = migratedDb()
    try {
      const written = upsertSecret(db, {
        title: '重复名字', detail: '真相',
        holders: ['  柳长老 ', '柳长老', '', '药童'],
      })
      expect(written.success).toBe(true)
      expect(listSecrets(db)[0]?.holders).toEqual(['柳长老', '药童'])

      // 非数组 ⇒ 明确报错。静默转空会让「三个隐瞒者全丢了」表现成「保存成功但列表空了」。
      const bad = upsertSecret(db, {
        title: '坏结构', detail: '真相', holders: '柳长老' as unknown as string[],
      })
      expect(bad.success).toBe(false)
      expect(bad.error).toBe('SECRET_INVALID:holders')
      // 数组里混了非字符串同样拒绝
      expect(upsertSecret(db, {
        title: '坏元素', detail: '真相', unaware: [1 as unknown as string],
      })).toEqual({ success: false, error: 'SECRET_INVALID:unaware' })
    } finally { db.close() }
  })

  it('揭穿章：null / 省略合法，0 与小数与字符串一律拒绝', () => {
    const db = migratedDb()
    try {
      expect(upsertSecret(db, { title: '未定', detail: '真相' }).success).toBe(true)
      expect(listSecrets(db)[0]?.revealChapter).toBeNull()
      for (const revealChapter of [0, -3, 2.5, '12' as unknown as number]) {
        expect(upsertSecret(db, { title: `坏章号${String(revealChapter)}`, detail: '真相', revealChapter }).success)
          .toBe(false)
      }
    } finally { db.close() }
  })

  it('title / detail 必填且有长度上限', () => {
    const db = migratedDb()
    try {
      expect(upsertSecret(db, { title: '   ', detail: '真相' })).toEqual({ success: false, error: 'SECRET_INVALID:title' })
      expect(upsertSecret(db, { title: '有名字', detail: '  ' })).toEqual({ success: false, error: 'SECRET_INVALID:detail' })
      expect(upsertSecret(db, { title: '长'.repeat(SECRET_TEXT_MAX + 1), detail: '真相' }))
        .toEqual({ success: false, error: 'SECRET_INVALID:title' })
      expect(upsertSecret(db, { title: '真相过长', detail: '长'.repeat(SECRET_DETAIL_MAX + 1) }))
        .toEqual({ success: false, error: 'SECRET_INVALID:detail' })
    } finally { db.close() }
  })

  it('读取侧容错：名字列是坏 JSON 时降级成空数组，不拖垮整页', () => {
    const db = migratedDb()
    try {
      upsertSecret(db, { title: '坏数据', detail: '真相', holders: ['柳长老'] })
      // 模拟被手工改坏的库（写入侧不会产生这种值，但存量库可能有）
      db.prepare("UPDATE secrets SET holder_names='not json', unaware_names='{\"a\":1}'").run()
      const [entry] = listSecrets(db)
      expect(entry?.holders).toEqual([])
      expect(entry?.unaware).toEqual([])
      // 其余字段照常可读 —— 一行坏数据不该让整张登记页消失
      expect(entry?.title).toBe('坏数据')
    } finally { db.close() }
  })

  it('排序：揭穿章升序，未定的排最后', () => {
    const db = migratedDb()
    try {
      upsertSecret(db, { title: '丙未定', detail: '真相', revealChapter: null })
      upsertSecret(db, { title: '乙第三章', detail: '真相', revealChapter: 3 })
      upsertSecret(db, { title: '甲第十二章', detail: '真相', revealChapter: 12 })
      expect(listSecrets(db).map(entry => entry.title)).toEqual(['乙第三章', '甲第十二章', '丙未定'])
    } finally { db.close() }
  })

  it('删除是真删；删不存在的行给 NOT_FOUND', () => {
    const db = migratedDb()
    try {
      const written = upsertSecret(db, { title: '待删', detail: '真相' })
      expect(deleteSecret(db, written.secretId!)).toEqual({ success: true })
      expect(listSecrets(db)).toEqual([])
      expect(deleteSecret(db, written.secretId!)).toEqual({ success: false, error: 'SECRET_NOT_FOUND' })
      expect(deleteSecret(db, '   ')).toEqual({ success: false, error: 'SECRET_INVALID:secretId' })
    } finally { db.close() }
  })
})
