import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import {
  deleteVolumeHandoff,
  findPreviousHandoff,
  hasVolumeHandoffSchema,
  listVolumeHandoffs,
  upsertVolumeHandoff,
} from '../volume-handoff-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * P1-2 卷末交接单仓储（M18）。
 *
 * 五条纪律：
 * 1. **缺表降级**：`list` → `[]`、`findPreviousHandoff` → `null`，**不抛**；
 * 2. **卷号被别的行占用** ⇒ `VOLUME_HANDOFF_VOLUME_TAKEN`；
 * 3. **区间与其他行重叠** ⇒ `VOLUME_HANDOFF_RANGE_CONFLICT`（相邻 20/21 不算重叠）；
 * 4. **`findPreviousHandoff` 只返回一条**（第 1、2 卷都存在时必须是第 2 卷）；
 * 5. **空文本存 NULL 读回 `''`；JSON 列永远 `'[]'` 或数组字符串**，脏 JSON 退 `[]` 不抛。
 */
const PROJECT_CACHE = path.resolve('.runtime/.cache/p1-2-volume-handoff-tests')
let projectRoot = ''

beforeEach(() => {
  fs.mkdirSync(PROJECT_CACHE, { recursive: true })
  projectRoot = fs.mkdtempSync(path.join(PROJECT_CACHE, 'case-'))
  openCanonicalProjectFixture(projectRoot)
})

afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('volume handoff repository', () => {
  it('M18 之前的库降级成空结果，不抛错（写入给可读原因）', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      expect(hasVolumeHandoffSchema(db)).toBe(false)
      expect(listVolumeHandoffs(db)).toEqual([])
      expect(findPreviousHandoff(db, 45)).toBeNull()
      expect(() => upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20 }))
        .toThrow('VOLUME_HANDOFF_SCHEMA_MISSING')
      expect(deleteVolumeHandoff(db, 'handoff:x')).toBe(false)
    } finally { db.close() }
  })

  it('JSON 往返：三个数组字段原样读回，空数组落库是 `[]`', () => {
    const db = getProjectDb()!
    const saved = upsertVolumeHandoff(db, {
      volumeIndex: 1,
      firstChapter: 1,
      lastChapter: 20,
      worldState: '灵潮退去',
      heroState: '左臂未愈',
      events: ['玄火令被夺', '沈砚投靠监天台'],
      items: ['玄火令'],
      debts: [],
      openThread: '监天台为何要玄火令',
    })
    expect(saved.events).toEqual(['玄火令被夺', '沈砚投靠监天台'])
    expect(saved.items).toEqual(['玄火令'])
    expect(saved.debts).toEqual([])
    expect(listVolumeHandoffs(db)).toHaveLength(1)
    const raw = db.prepare('SELECT events_json, items_json, debts_json, world_state, created_at FROM volume_handoffs')
      .get() as Record<string, string | null>
    expect(raw.events_json).toBe('["玄火令被夺","沈砚投靠监天台"]')
    expect(raw.debts_json).toBe('[]')
    expect(raw.world_state).toBe('灵潮退去')
    expect(raw.created_at).toEqual(expect.any(String))
  })

  it('空文本存 NULL（不是空串）；读回是空串', () => {
    const db = getProjectDb()!
    const saved = upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20 })
    expect(saved.worldState).toBe('')
    expect(saved.heroState).toBe('')
    expect(saved.openThread).toBe('')
    const raw = db.prepare('SELECT world_state, hero_state, open_thread FROM volume_handoffs WHERE handoff_id=?')
      .get(saved.handoffId) as Record<string, string | null>
    expect(raw.world_state).toBeNull()
    expect(raw.hero_state).toBeNull()
    expect(raw.open_thread).toBeNull()
  })

  it('卷号被别的行占用 ⇒ VOLUME_HANDOFF_VOLUME_TAKEN；同一行改内容不算冲突', () => {
    const db = getProjectDb()!
    const first = upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20 })
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 21, lastChapter: 40 }))
      .toThrow('VOLUME_HANDOFF_VOLUME_TAKEN')
    // 同一份交接单改一句话：卷号与区间不变，必须放行（校验只看**其他**行）。
    const updated = upsertVolumeHandoff(db, {
      handoffId: first.handoffId, volumeIndex: 1, firstChapter: 1, lastChapter: 20, worldState: '改过的世界',
    })
    expect(updated.worldState).toBe('改过的世界')
    expect(updated.createdAt).toBe(first.createdAt)
  })

  it('区间与其他行重叠 ⇒ VOLUME_HANDOFF_RANGE_CONFLICT（相邻允许）', () => {
    const db = getProjectDb()!
    upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20 })
    // 20 与 21 相邻，不重叠。
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 2, firstChapter: 21, lastChapter: 40 })).not.toThrow()
    // 19–30 与 1–20 重叠（交集 19–20）。
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 3, firstChapter: 19, lastChapter: 30 }))
      .toThrow('VOLUME_HANDOFF_RANGE_CONFLICT')
    // 完全包含也算重叠。
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 4, firstChapter: 5, lastChapter: 8 }))
      .toThrow('VOLUME_HANDOFF_RANGE_CONFLICT')
  })

  it('章号非法（0 / 负 / 末章小于首章）在写入前被拒', () => {
    const db = getProjectDb()!
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 0, firstChapter: 1, lastChapter: 20 }))
      .toThrow('VOLUME_HANDOFF_INVALID:volumeIndex')
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 0, lastChapter: 20 }))
      .toThrow('VOLUME_HANDOFF_INVALID:firstChapter')
    expect(() => upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 21, lastChapter: 20 }))
      .toThrow('VOLUME_HANDOFF_INVALID:range')
  })

  it('findPreviousHandoff 只返回一条：第 1、2 卷都在时是第 2 卷', () => {
    const db = getProjectDb()!
    const first = upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20, worldState: '第一卷末' })
    const second = upsertVolumeHandoff(db, { volumeIndex: 2, firstChapter: 21, lastChapter: 40, worldState: '第二卷末' })
    expect(findPreviousHandoff(db, 45)?.handoffId).toBe(second.handoffId)
    // 第 41 章：第二卷刚结束 ⇒ 仍是第二卷。
    expect(findPreviousHandoff(db, 41)?.handoffId).toBe(second.handoffId)
    // 第 21 章：第二卷尚未结束 ⇒ 是第一卷。
    expect(findPreviousHandoff(db, 21)?.handoffId).toBe(first.handoffId)
    // 第 20 章：第一卷的 last_chapter 等于本章 ⇒ 还不算「上一卷」（严格小于）。
    expect(findPreviousHandoff(db, 20)).toBeNull()
    // 第 1 章：必然没有上一卷。
    expect(findPreviousHandoff(db, 1)).toBeNull()
  })

  it('脏 JSON / 非数组 / 非字符串元素一律当 `[]` 读，不抛', () => {
    const db = getProjectDb()!
    const saved = upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20, events: ['保留'] })
    db.prepare('UPDATE volume_handoffs SET events_json=?, items_json=?, debts_json=? WHERE handoff_id=?')
      .run('{not json', '{"a":1}', '["ok",2,null,"  "]', saved.handoffId)
    const entry = listVolumeHandoffs(db)[0]!
    expect(entry.events).toEqual([])
    expect(entry.items).toEqual([])
    expect(entry.debts).toEqual(['ok'])
  })

  it('删除是真删；不存在的 id 返回 false', () => {
    const db = getProjectDb()!
    const saved = upsertVolumeHandoff(db, { volumeIndex: 1, firstChapter: 1, lastChapter: 20 })
    expect(deleteVolumeHandoff(db, saved.handoffId)).toBe(true)
    expect(deleteVolumeHandoff(db, saved.handoffId)).toBe(false)
    expect(listVolumeHandoffs(db)).toEqual([])
  })
})
