import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'

import { getProjectDb } from '../../database'
import { BlueprintRepository, type BlueprintData } from '../blueprint-repository'
import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'

/**
 * 段二 T9：B′ 双写的蓝图侧伴随字段 —— `spaceRefs` 落进 `blueprints.structured_refs`。
 *
 * 两条纪律在这里被钉住：
 * ① **稀疏**：没有空间引用时该键**不出现**，否则每个既有蓝图都会多一个 `structuredRefs: []`，
 *    从而改变 `commitPayloadHash` / `character_sync_input` 的字节形态（幂等重放与冻结事实的基准）；
 * ② **fail-open**：未升级到 v9 的库（没有该列）照样能正常读写蓝图，绝不因伴随字段而失败。
 */
vi.mock('../../database', () => ({
  getProjectDb: vi.fn(),
}))

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

/**
 * `withStructuredRefs: false` 模拟**未升级到 M08/v9** 的库：基线表没有
 * `structured_refs` 列（这正是 M08 迁移要加的那一列）。
 */
function createDb(options: { withStructuredRefs?: boolean } = {}): BetterSqlite3.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE IF NOT EXISTS blueprints (
      chapter_number INTEGER PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      role TEXT DEFAULT '',
      purpose TEXT DEFAULT '',
      key_events TEXT DEFAULT '',
      ${options.withStructuredRefs === false ? '' : "structured_refs TEXT NOT NULL DEFAULT '',"}
      characters TEXT DEFAULT '[]',
      suspense_hook TEXT DEFAULT '',
      user_guidance TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      notes_updated_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS project_core (id TEXT PRIMARY KEY, characters_arch TEXT DEFAULT '');
    INSERT OR IGNORE INTO project_core (id, characters_arch) VALUES ('main', '');
    CREATE TABLE IF NOT EXISTS characters (
      name TEXT PRIMARY KEY, role TEXT DEFAULT 'supporting',
      gender TEXT DEFAULT '', age TEXT DEFAULT '', appearance TEXT DEFAULT '',
      personality TEXT DEFAULT '', background TEXT DEFAULT '', abilities TEXT DEFAULT '',
      motivation TEXT DEFAULT '', relationships TEXT DEFAULT '', arc TEXT DEFAULT '', notes TEXT DEFAULT '',
      cs_location TEXT DEFAULT '', cs_power_level TEXT DEFAULT '', cs_physical_state TEXT DEFAULT '',
      cs_mental_state TEXT DEFAULT '', cs_key_items TEXT DEFAULT '', cs_recent_events TEXT DEFAULT '',
      cs_updated_at_chapter INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
  return db
}

function baseBlueprint(chapterNumber = 1): BlueprintData {
  return {
    chapterNumber,
    title: `第${chapterNumber}章`,
    role: '建置',
    purpose: '推进',
    keyEvents: normalizeKeyEvents('主角来到老陈记', { chapterNumber }),
    characters: ['陈默'],
    suspenseHook: '他为什么来？',
    userGuidance: '',
    notes: '',
    notesUpdatedAt: '',
  }
}

/** 直接读存储列的原始文本（绕过仓库，验证真的落库了）。 */
function rawStructuredRefs(db: BetterSqlite3.Database, chapterNumber = 1): string | undefined {
  const row = db.prepare('SELECT structured_refs FROM blueprints WHERE chapter_number=?').get(chapterNumber) as { structured_refs: string } | undefined
  return row?.structured_refs
}

beforeEach(() => {
  vi.mocked(getProjectDb).mockReturnValue(null)
})

describe('T9 · structured_refs 落库与回读', () => {
  it('写入 structuredRefs 后落进同名列，并能原样读回', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      BlueprintRepository.upsert({
        ...baseBlueprint(1),
        structuredRefs: [{ space: '老陈记', timeRef: '08:00', beat: '买早饭' }],
      })

      expect(JSON.parse(rawStructuredRefs(db)!)).toEqual([{ space: '老陈记', timeRef: '08:00', beat: '买早饭' }])
      expect(BlueprintRepository.getByChapter(1)?.structuredRefs)
        .toEqual([{ space: '老陈记', timeRef: '08:00', beat: '买早饭' }])
    } finally { db.close() }
  })

  it('★ 语义项的字段名 spaceRefs 也能落库（模型侧 → 存储列的换名点）', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      // `ChapterBlueprint = BlueprintData` 的别名会让语义项带着 spaceRefs 抵达仓库；
      // 换名必须在唯一的写入归一化点完成，而不是要求每个调用点自己改。
      BlueprintRepository.upsert({
        ...baseBlueprint(1),
        spaceRefs: [{ space: '市立图书馆', timeRef: '10:00-12:00' }],
      } as BlueprintData)

      expect(BlueprintRepository.getByChapter(1)?.structuredRefs)
        .toEqual([{ space: '市立图书馆', timeRef: '10:00-12:00' }])
    } finally { db.close() }
  })

  it('★ 稀疏：没有空间引用时该键不出现（既有蓝图的形状与 payload 哈希不变）', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      BlueprintRepository.upsert(baseBlueprint(1))
      // 存储列被写成空数组串，但读回的对象**不含**这个键。
      expect(rawStructuredRefs(db)).toBe('[]')
      expect(BlueprintRepository.getByChapter(1)).not.toHaveProperty('structuredRefs')
      expect(BlueprintRepository.getAll()[0]).not.toHaveProperty('structuredRefs')
    } finally { db.close() }
  })

  it('清空引用：先写后有，再写无 ⇒ 列回空、对象不再带该键', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      BlueprintRepository.upsert({ ...baseBlueprint(1), structuredRefs: [{ space: '老陈记' }] })
      expect(BlueprintRepository.getByChapter(1)?.structuredRefs).toEqual([{ space: '老陈记' }])

      BlueprintRepository.upsert({ ...baseBlueprint(1) })
      expect(rawStructuredRefs(db)).toBe('[]')
      expect(BlueprintRepository.getByChapter(1)).not.toHaveProperty('structuredRefs')
    } finally { db.close() }
  })

  it('★ fail-open：未升级到 v9（没有 structured_refs 列）照样能读写蓝图', () => {
    const db = createDb({ withStructuredRefs: false })
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      expect(() => BlueprintRepository.upsert({
        ...baseBlueprint(1),
        structuredRefs: [{ space: '老陈记', timeRef: '08:00' }],
      })).not.toThrow()

      const read = BlueprintRepository.getByChapter(1)
      expect(read?.title).toBe('第1章')
      // 缺列 ⇒ 没有可读的伴随字段，读回不含该键（不报错、不伪造）。
      expect(read).not.toHaveProperty('structuredRefs')
      expect(() => BlueprintRepository.getAll()).not.toThrow()
    } finally { db.close() }
  })

  it('非法条目被丢弃而不是抛错（缺 space / 非数组 / 坏 JSON）', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      for (const [chapter, refs] of [
        [1, [{ timeRef: '08:00' }, null, 42, { space: '  ' }]],
        [2, 'not json'],
        [3, { space: '甲' }],
        [4, undefined],
      ] as const) {
        expect(() => BlueprintRepository.upsert({ ...baseBlueprint(chapter), structuredRefs: refs as never })).not.toThrow()
        expect(BlueprintRepository.getByChapter(chapter)).not.toHaveProperty('structuredRefs')
      }
    } finally { db.close() }
  })

  it('trim 后保留 beat；只写给出的字段', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      BlueprintRepository.upsert({
        ...baseBlueprint(1),
        structuredRefs: [{ space: '  老陈记  ', beat: ' 买早饭 ', timeRef: ' 08:00 ' }],
      })
      expect(BlueprintRepository.getByChapter(1)?.structuredRefs)
        .toEqual([{ space: '老陈记', timeRef: '08:00', beat: '买早饭' }])
    } finally { db.close() }
  })
})

describe('T9 · commitRange 回读比对', () => {
  it('带 structuredRefs 的区间提交能通过回读比对并落库', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      const receipt = BlueprintRepository.commitRange({
        mode: 'full',
        operationId: 'directory-with-space-refs',
        startChapter: 1,
        endChapter: 2,
        blueprints: [
          { ...baseBlueprint(1), structuredRefs: [{ space: '老陈记', timeRef: '08:00' }] },
          baseBlueprint(2),
        ],
      })
      // 回读比对（samePersistedBlueprint）认这个字段 —— 否则这里会抛「回读不一致」。
      expect(receipt.snapshot[0]?.structuredRefs).toEqual([{ space: '老陈记', timeRef: '08:00' }])
      expect(receipt.snapshot[1]).not.toHaveProperty('structuredRefs')
      expect(JSON.parse(rawStructuredRefs(db, 1)!)).toEqual([{ space: '老陈记', timeRef: '08:00' }])
    } finally { db.close() }
  })

  it('幂等重放：同一 operationId 不因伴随字段而产生第二次写入', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      const request = {
        mode: 'full' as const,
        operationId: 'directory-space-refs-replay',
        startChapter: 1,
        endChapter: 1,
        blueprints: [{ ...baseBlueprint(1), structuredRefs: [{ space: '老陈记' }] }],
      }
      const first = BlueprintRepository.commitRange(request)
      const replay = BlueprintRepository.commitRange(request)
      expect(first.idempotent).toBe(false)
      expect(replay.idempotent).toBe(true)
      expect(replay.payloadHash).toBe(first.payloadHash)
    } finally { db.close() }
  })

  it('★ 稀疏不影响既有 payload 哈希：不带伴随字段的同一个请求哈希稳定', () => {
    const db = createDb()
    vi.mocked(getProjectDb).mockReturnValue(db)
    try {
      const request = {
        mode: 'full' as const,
        operationId: 'directory-plain',
        startChapter: 1,
        endChapter: 1,
        blueprints: [baseBlueprint(1)],
      }
      const receipt = BlueprintRepository.commitRange(request)
      // 归一化后 blueprint 对象里**没有** structuredRefs 键 ⇒ 哈希与引入该字段之前一致。
      expect(receipt.characterSyncInput[0]).not.toHaveProperty('structuredRefs')
    } finally { db.close() }
  })
})
