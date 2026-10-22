import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import {
  deleteResource,
  hasResourceLedgerSchema,
  listMovementsThrough,
  listResources,
  replaceChapterMovements,
  upsertResource,
} from '../resource-repository'

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

describe('resource repository', () => {
  it('degrades to empty results when the M11 tables do not exist', () => {
    const db = emptyDb()
    try {
      expect(hasResourceLedgerSchema(db)).toBe(false)
      // 未升级的项目不能因为一张表把整条读链路带崩。
      expect(listResources(db)).toEqual([])
      expect(listMovementsThrough(db, 10)).toEqual([])
      expect(deleteResource(db, 'res:1')).toEqual({ success: false, error: 'RESOURCE_LEDGER_SCHEMA_MISSING' })
      expect(replaceChapterMovements(db, 1, [], 'finalized-extract'))
        .toEqual({ success: false, error: 'RESOURCE_LEDGER_SCHEMA_MISSING' })
    } finally { db.close() }
  })

  it('round-trips definitions and rejects a duplicate name in place', () => {
    const db = migratedDb()
    try {
      expect(hasResourceLedgerSchema(db)).toBe(true)
      const created = upsertResource(db, { name: '下品灵石', familyId: '灵石', unit: '枚', period: '日', anchorValue: 1 })
      expect(created.success).toBe(true)
      const resourceId = (created as { resourceId: string }).resourceId

      expect(upsertResource(db, { name: '下品灵石', unit: '块', period: '日' }))
        .toEqual({ success: false, error: 'RESOURCE_NAME_DUPLICATED' })
      // anchor_value 空 = 不可通兑；0 不是它的同义词。
      expect(upsertResource(db, { name: '军功', unit: '点', period: '副', anchorValue: 0 }))
        .toEqual({ success: false, error: 'RESOURCE_INVALID:anchorValue' })

      expect(upsertResource(db, { name: '军功', unit: '点', period: '副', scarcityNote: '战功难得' }).success).toBe(true)
      // 排序按 族 → 品阶：单例（family_id 空）在前，同族按 tier 递增，供资源页分组展示。
      expect(listResources(db).map(resource => resource.name)).toEqual(['军功', '下品灵石'])

      expect(upsertResource(db, { resourceId, name: '下品灵石', unit: '枚', period: '日', anchorNote: '按开篇汇率' }).success).toBe(true)
      expect(listResources(db).find(resource => resource.resourceId === resourceId)?.anchorNote).toBe('按开篇汇率')
    } finally { db.close() }
  })

  it('rebuilds a chapter idempotently so retries cannot inflate the balance', () => {
    const db = migratedDb()
    try {
      const created = upsertResource(db, { name: '下品灵石', unit: '枚', period: '日' })
      const resourceId = (created as { resourceId: string }).resourceId
      const rows = [
        { resourceId, delta: 120, evidence: '取走一百二十枚' },
        { resourceId, delta: -6, evidence: '花掉六枚' },
      ]

      expect(replaceChapterMovements(db, 2, rows, 'finalized-extract')).toEqual({ success: true, inserted: 2 })
      // `id` 是行标识不是账本语义：重建后必然换新，不能拿它当幂等判据。
      const semantic = () => listMovementsThrough(db, 2)
        .map(({ chapterNumber, resourceId: id, delta, unit, evidence, source }) => ({ chapterNumber, id, delta, unit, evidence, source }))
      const first = semantic()
      // withRetry 让同一段抽取最多跑 3 次：第二次必须与第一次逐字段相同。
      expect(replaceChapterMovements(db, 2, rows, 'finalized-extract')).toEqual({ success: true, inserted: 2 })
      expect(semantic()).toEqual(first)
      expect(listMovementsThrough(db, 2).map(movement => movement.delta)).toEqual([120, -6])
    } finally { db.close() }
  })

  it('keeps the unit snapshot and never lets a source overwrite the other source', () => {
    const db = migratedDb()
    try {
      const created = upsertResource(db, { name: '下品灵石', unit: '枚', period: '日' })
      const resourceId = (created as { resourceId: string }).resourceId
      replaceChapterMovements(db, 0, [{ resourceId, delta: 30, evidence: '开篇有三十枚' }], 'author')
      replaceChapterMovements(db, 1, [{ resourceId, delta: 10, evidence: '领到十枚' }], 'finalized-extract')
      // 第 0 章是作者的起点声明，抽取不许写它。
      expect(replaceChapterMovements(db, 0, [{ resourceId, delta: 1, evidence: '模型猜测' }], 'finalized-extract'))
        .toEqual({ success: false, error: 'RESOURCE_INVALID:origin-source' })

      // 作者改单位：历史行仍记「枚」，语义不被静默重解释。
      upsertResource(db, { resourceId, name: '下品灵石', unit: '块', period: '日' })
      expect(listMovementsThrough(db, 1).map(movement => movement.unit)).toEqual(['枚', '枚'])

      replaceChapterMovements(db, 1, [{ resourceId, delta: 99, unit: '块', evidence: '重扫九十九块' }], 'finalized-extract')
      expect(listMovementsThrough(db, 1).map(movement => movement.delta)).toEqual([30, 99])
      // 起点行来自另一来源，不能被定稿抽取的整章重建带走。
      expect(listMovementsThrough(db, 0).map(movement => movement.source)).toEqual(['author'])
    } finally { db.close() }
  })

  it('refuses to delete a resource that already has ledger history', () => {
    const db = migratedDb()
    try {
      const created = upsertResource(db, { name: '下品灵石', unit: '枚', period: '日' })
      const resourceId = (created as { resourceId: string }).resourceId
      replaceChapterMovements(db, 0, [{ resourceId, delta: 30, evidence: '开篇有三十枚' }], 'author')
      expect(deleteResource(db, resourceId)).toEqual({ success: false, error: 'RESOURCE_HAS_MOVEMENTS', movementCount: 1 })
      expect(listResources(db)).toHaveLength(1)

      const unused = upsertResource(db, { name: '军功', unit: '点', period: '副' })
      expect(deleteResource(db, (unused as { resourceId: string }).resourceId)).toEqual({ success: true })
      expect(deleteResource(db, 'res:missing')).toEqual({ success: false, error: 'RESOURCE_NOT_FOUND' })
    } finally { db.close() }
  })
})
