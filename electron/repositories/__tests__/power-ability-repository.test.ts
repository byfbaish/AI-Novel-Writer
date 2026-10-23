import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import {
  deletePowerAbility,
  getPowerAbility,
  hasPowerAbilitySchema,
  listPowerAbilities,
  upsertPowerAbility,
} from '../power-ability-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * P1-1 能力仓储（M17）。
 *
 * 五条纪律：
 * 1. **缺表降级成 `[]`**，不抛（M17 之前的库照常能打开项目）；
 * 2. **重名就地拒**（不是裸 UNIQUE 错误）；同 id 改名不受影响；
 * 3. **`stage_chapter` 不许 0**（会被读成序章），空 = undated 是合法主路径；
 * 4. **`evidence_scope` 只收三档**；
 * 5. **词表外 `form` 原样读回**（不设 CHECK 的证明），可空列存 NULL 不是空串。
 */
const PROJECT_CACHE = path.resolve('.runtime/.cache/p1-1-ability-tests')
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

describe('power ability repository', () => {
  it('M17 之前的库降级成空结果，不抛错（写入给可读原因）', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      expect(hasPowerAbilitySchema(db)).toBe(false)
      expect(listPowerAbilities(db)).toEqual([])
      expect(getPowerAbility(db, 'ability:x')).toBeUndefined()
      expect(upsertPowerAbility(db, { name: '噬魂推演录' }))
        .toEqual({ success: false, error: 'ABILITY_SCHEMA_MISSING' })
      expect(deletePowerAbility(db, 'ability:x'))
        .toEqual({ success: false, error: 'ABILITY_SCHEMA_MISSING' })
    } finally { db.close() }
  })

  it('新建后按 id 回读：空字段读成空串、库里是 NULL，三态字段原样带回', () => {
    const db = getProjectDb()!
    const created = upsertPowerAbility(db, {
      name: '噬魂推演录',
      form: '规则',
      hardLimit: '必须击杀仇敌后方可掠夺',
      stageNote: '开局',
      evidenceScope: 'golden-finger',
    })
    expect(created).toMatchObject({ success: true })
    const entry = getPowerAbility(db, created.abilityId!)
    expect(entry).toMatchObject({
      abilityId: created.abilityId,
      name: '噬魂推演录',
      form: '规则',
      hardLimit: '必须击杀仇敌后方可掠夺',
      weakness: '',
      costNote: '',
      // 没填章号 ⇒ undated 的主路径，不是 0。
      stageChapter: null,
      stageNote: '开局',
      evidence: '',
      evidenceScope: 'golden-finger',
      source: 'author',
    })
    // 空字段在库里是 NULL，不是空串：否则「填过又清空」与「从没填过」无法区分。
    const raw = db.prepare('SELECT weakness, cost_note, evidence, stage_chapter FROM power_abilities WHERE ability_id=?')
      .get(created.abilityId!) as Record<string, unknown>
    expect(raw).toEqual({ weakness: null, cost_note: null, evidence: null, stage_chapter: null })
  })

  it('重名就地拒绝；改自己不算重名；换名字后可以保存', () => {
    const db = getProjectDb()!
    const first = upsertPowerAbility(db, { name: '噬魂推演录' })
    expect(upsertPowerAbility(db, { name: '噬魂推演录' }))
      .toEqual({ success: false, error: 'ABILITY_NAME_DUPLICATED' })
    // 空白差异按 trim 后同名 ⇒ 同样拒。
    expect(upsertPowerAbility(db, { name: '  噬魂推演录  ' }))
      .toEqual({ success: false, error: 'ABILITY_NAME_DUPLICATED' })
    // 同 id 更新（名字不变）允许。
    expect(upsertPowerAbility(db, { abilityId: first.abilityId, name: '噬魂推演录', weakness: '蚀毒未清时强注灵力即经脉爆裂' }).success)
      .toBe(true)
    expect(getPowerAbility(db, first.abilityId!)?.weakness).toBe('蚀毒未清时强注灵力即经脉爆裂')
    // 改成另一个没人用的名字允许。
    expect(upsertPowerAbility(db, { abilityId: first.abilityId, name: '噬魂推演录（改名）' }).success).toBe(true)
  })

  it('stage_chapter 只能是正整数或空；evidence_scope 只收三档', () => {
    const db = getProjectDb()!
    expect(upsertPowerAbility(db, { name: '零章', stageChapter: 0 }))
      .toEqual({ success: false, error: 'ABILITY_INVALID:stageChapter' })
    expect(upsertPowerAbility(db, { name: '负数章', stageChapter: -2 }))
      .toEqual({ success: false, error: 'ABILITY_INVALID:stageChapter' })
    expect(upsertPowerAbility(db, { name: '小数章', stageChapter: 1.5 }))
      .toEqual({ success: false, error: 'ABILITY_INVALID:stageChapter' })
    expect(upsertPowerAbility(db, { name: '错出处', evidenceScope: 'wiki' as never }))
      .toEqual({ success: false, error: 'ABILITY_INVALID:evidenceScope' })

    const active = upsertPowerAbility(db, { name: '第3章起', stageChapter: 3, evidenceScope: 'chapter' })
    expect(active.success).toBe(true)
    expect(getPowerAbility(db, active.abilityId!)).toMatchObject({ stageChapter: 3, evidenceScope: 'chapter' })
    expect(listPowerAbilities(db)).toHaveLength(1)
  })

  it('删除是真删；删不存在的给明确原因', () => {
    const db = getProjectDb()!
    const created = upsertPowerAbility(db, { name: '临时能力' })
    expect(deletePowerAbility(db, created.abilityId!)).toEqual({ success: true })
    expect(deletePowerAbility(db, created.abilityId!)).toEqual({ success: false, error: 'ABILITY_NOT_FOUND' })
    expect(listPowerAbilities(db)).toEqual([])
  })

  it('词表外的 form 原样读回；列表按 name 的码元序（与提示词同一口径）', () => {
    const db = getProjectDb()!
    const exotic = '规则·功法·天赋混合（寄生于重生神魂）'
    upsertPowerAbility(db, { name: '噬魂推演录', form: exotic })
    upsertPowerAbility(db, { name: '阿甲能力', form: '系统' })
    upsertPowerAbility(db, { name: 'Zeta', form: '宝物' })
    const listed = listPowerAbilities(db)
    expect(listed.map(entry => entry.name)).toEqual(['Zeta', '噬魂推演录', '阿甲能力'])
    expect(listed.find(entry => entry.name === '噬魂推演录')?.form).toBe(exotic)
    // 表 DDL 里没有 form 的 CHECK：写任何字符串都成功（写不进去才是形状错了）。
    const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='power_abilities'")
      .pluck().get() as string).replace(/\s+/gu, ' ')
    expect(sql).not.toMatch(/CHECK\s*\(\s*form\b/u)
  })
})
