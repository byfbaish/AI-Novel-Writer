import { describe, expect, it } from 'vitest'
import { canonicalCastLedgerNames, CastLedgerCompletionError, parseCastLedgerCompletion } from '../cast-ledger-completion'

/**
 * 归位表补全产物的解析器测试。
 *
 * 产物的形状合同与「架构详情」同构：`{ entries: [...] }`，每条必须通过
 * validateCharacterDetail（含 slotId 与 currentState）。这里刻意用**完整**条目，
 * 因为「缺字段」在真实链路上就是 ARTIFACT_INVALID：补全产物不合格时宁可整批失败，
 * 也不能产出一张只有名字的空壳卡。
 */
function detail(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slotId: `cast-${name}`,
    name,
    role: 'supporting',
    gender: '女',
    age: '成年',
    appearance: `${name}的外貌`,
    personality: `${name}的性格`,
    background: `${name}的背景`,
    abilities: `${name}的能力`,
    motivation: `${name}的动机`,
    arc: `${name}的弧光`,
    notes: `${name}的备注`,
    currentState: { location: '城里', powerLevel: '普通', physicalState: '健康', mentalState: '冷静',
      keyItems: '钥匙', recentEvents: '抵达', updatedAtChapter: 0 },
    ...overrides,
  }
}
const artifact = (...entries: Record<string, unknown>[]) => JSON.stringify({ entries })
function expectError(run: () => unknown, code: string): CastLedgerCompletionError {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(CastLedgerCompletionError)
    const typed = error as CastLedgerCompletionError
    expect(typed.code).toBe(code)
    // message 必须是裸错误码：controller 只透传 ^CHARACTER_[A-Z_]+$
    expect(typed.message).toBe(code)
    return typed
  }
  throw new Error(`期望抛出 ${code}`)
}

describe('canonicalCastLedgerNames', () => {
  it('trim、去空、去重、排序，且幂等', () => {
    const canonical = canonicalCastLedgerNames([' 韩素 ', '林岚', '韩素', '', '   '])
    expect(canonical).toEqual(['林岚', '韩素'])
    expect(canonicalCastLedgerNames(canonical)).toEqual(canonical)
  })
})

describe('parseCastLedgerCompletion', () => {
  it('按 expectedNames 顺序产出条目，字段恰为 11 个静态字段且不投影 currentState/slotId', () => {
    // 产物故意逆序 + 分段：产出顺序只由名单决定。
    const parsed = parseCastLedgerCompletion([artifact(detail('韩素'), detail('林岚'))], ['林岚', '韩素'])
    expect(parsed.names).toEqual(['林岚', '韩素'])
    expect(parsed.items.map(item => item.fields.name)).toEqual(['林岚', '韩素'])
    expect(parsed.items[0]).toMatchObject({
      selectionKey: 'cast-ledger:林岚', sourceId: 'cast-ledger:林岚', relationships: [],
      fields: { name: '林岚', role: 'supporting', gender: '女', age: '成年',
        appearance: '林岚的外貌', personality: '林岚的性格', background: '林岚的背景',
        abilities: '林岚的能力', motivation: '林岚的动机', arc: '林岚的弧光', notes: '林岚的备注' },
    })
    expect(Object.keys(parsed.items[0]!.fields).sort()).toEqual([
      'abilities', 'age', 'appearance', 'arc', 'background', 'gender', 'motivation', 'name', 'notes', 'personality', 'role',
    ])
    expect(parsed.items[0]!.fields).not.toHaveProperty('slotId')
    expect(parsed.items[0]!.fields).not.toHaveProperty('currentState')
  })

  it('合并多段产物后名字集合相等即成功', () => {
    const parsed = parseCastLedgerCompletion([artifact(detail('林岚')), artifact(detail('韩素'))], ['韩素', '林岚'])
    expect(parsed.items.map(item => item.fields.name)).toEqual(['韩素', '林岚'])
  })

  it('字段值 trim 后写入', () => {
    const parsed = parseCastLedgerCompletion([artifact(detail('林岚', { appearance: '  黑发  ' }))], ['林岚'])
    expect(parsed.items[0]!.fields.appearance).toBe('黑发')
  })

  it('名字缺失报 NAMES_MISMATCH 且 detail 列出缺少的名字', () => {
    const error = expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'))], ['林岚', '韩素']),
      'CHARACTER_CAST_LEDGER_NAMES_MISMATCH')
    expect(error.detail).toContain('缺少 韩素')
    expect(error.detail).toContain('多出 无')
  })

  it('名字多出报 NAMES_MISMATCH 且 detail 列出多出的名字', () => {
    const error = expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'), detail('路人甲'))], ['林岚']),
      'CHARACTER_CAST_LEDGER_NAMES_MISMATCH')
    expect(error.detail).toContain('多出 路人甲')
    expect(error.detail).toContain('缺少 无')
  })

  it('同一名字出现两次报 NAMES_MISMATCH（重复也要失败，不能第二次覆盖第一次）', () => {
    const error = expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'), detail('林岚'))], ['林岚']),
      'CHARACTER_CAST_LEDGER_NAMES_MISMATCH')
    expect(error.detail).toContain('重复 林岚')
  })

  it('名字多到超过上限时 detail 截断为最多 8 个', () => {
    const expected = Array.from({ length: 10 }, (_, index) => `角色${index}`)
    const error = expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'))], expected), 'CHARACTER_CAST_LEDGER_NAMES_MISMATCH')
    expect(error.detail).toContain('等 10 个')
  })

  it('坏 JSON 报 ARTIFACT_INVALID', () => {
    expectError(() => parseCastLedgerCompletion(['{坏语法'], ['林岚']), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('非 entries 信封（如数组/别的结构化产物）报 ARTIFACT_INVALID', () => {
    expectError(() => parseCastLedgerCompletion([JSON.stringify([detail('林岚')])], ['林岚']), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    expectError(() => parseCastLedgerCompletion([JSON.stringify({ characters: [detail('林岚')] })], ['林岚']), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('空字段不静默丢弃/不补空串：整段产物报 ARTIFACT_INVALID', () => {
    // 与任务书「空串保留空串」的偏差：validateCharacterDetail 要求 11 个静态字段全非空，
    // 空字段意味着模型没补齐资料 —— 允许它通过就会造出空壳卡（§4.4 retired=1「刘三」）。
    const error = expectError(() => parseCastLedgerCompletion([artifact(detail('林岚', { notes: '' }))], ['林岚']),
      'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    expect(error.detail).toContain('notes')
  })

  it('缺 currentState / 多了 relationships 也报 ARTIFACT_INVALID', () => {
    const missingState = detail('林岚') as Record<string, unknown>
    delete missingState.currentState
    expectError(() => parseCastLedgerCompletion([artifact(missingState)], ['林岚']), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    expectError(() => parseCastLedgerCompletion([artifact(detail('林岚', { relationships: [] }))], ['林岚']), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('期望名单为空/重复/含空项时报 NAMES_REQUIRED', () => {
    expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'))], []), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
    expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'))], ['林岚', '  ']), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
    expectError(() => parseCastLedgerCompletion([artifact(detail('林岚'))], ['林岚', '林岚']), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
    // 仅大小写不同也算重复：身份键相同
    expectError(() => parseCastLedgerCompletion([artifact(detail('Lin'))], ['Lin', 'lin']), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
  })

  it('没有产物文本时报 ARTIFACT_INVALID', () => {
    expectError(() => parseCastLedgerCompletion([], ['林岚']), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })
})
