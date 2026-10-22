import { describe, expect, it } from 'vitest'

import type { LedgerBalance, LedgerSeriesPoint, ResourceDefinition } from '../../../../shared/resource-ledger'
import {
  RESOURCE_JUMP_MIN_ABS,
  RESOURCE_JUMP_RATIO,
  describeJump,
  describeResourceBalance,
  detectResourceJumps,
  formatMovementDelta,
  groupResourcesByFamily,
} from '../resource-ledger-view-model'

function resource(overrides: Partial<ResourceDefinition> & { resourceId: string; name: string }): ResourceDefinition {
  return {
    familyId: null,
    tier: 0,
    unit: '枚',
    anchorValue: null,
    period: '卷',
    earnNote: '',
    costNote: '',
    scarcityNote: '',
    anchorNote: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('三态文案（判据 DJ / §9.2）', () => {
  it('known 显示数值与截止章', () => {
    const balance: LedgerBalance = { kind: 'known', value: 154, throughChapter: 3 }
    expect(describeResourceBalance(balance, '枚', 'zh-CN')).toEqual({
      primary: '154 枚',
      secondary: '截至第 3 章',
      tone: 'known',
    })
  })

  it('未扫描说「第 n 章起未扫描 + 中断」，绝不出现 0', () => {
    const balance: LedgerBalance = { kind: 'unknown', reason: 'not-scanned', fromChapter: 2 }
    const text = describeResourceBalance(balance, '枚', 'zh-CN')
    expect(text.primary).toBe('未知（第 2 章起未扫描）')
    expect(text.secondary).toContain('第 2 章起账本中断')
    expect(text.tone).toBe('unknown')
    // 关键：整段文案里不许出现数值 0（「不按 0 计」是唯一允许的 0，而且必须是「不是 0」的语义）。
    expect(text.primary).not.toContain('0')
    expect(text.secondary).not.toMatch(/\b0\s*枚/u)
  })

  it('缺开篇余额说「未登记开篇余额」，且不把登记缺口说成中断', () => {
    const balance: LedgerBalance = { kind: 'unknown', reason: 'no-origin', fromChapter: 1 }
    const text = describeResourceBalance(balance, '枚', 'zh-CN')
    expect(text.primary).toBe('未知（未登记开篇余额）')
    expect(text.secondary).toContain('第 0 章的开篇起点')
    // 起点缺失是登记问题，不能说成「账本中断」——两种修法完全不同。
    expect(text.secondary).not.toContain('账本中断')
    expect(text.tone).toBe('unknown')
  })

  it('单位冲突列出两种单位与起始章，不给数字', () => {
    const balance: LedgerBalance = { kind: 'conflict', reason: 'unit-mismatch', units: ['枚', '块'], fromChapter: 4 }
    const text = describeResourceBalance(balance, '枚', 'zh-CN')
    expect(text.primary).toBe('单位不一致：枚 / 块')
    expect(text.secondary).toContain('第 4 章起')
    expect(text.secondary).toContain('不合并、不换算')
    expect(text.tone).toBe('conflict')
    // 不能把冲突显示成一个数。
    expect(text.primary).not.toMatch(/\d/u)
  })

  it('英文文案同样是三态，不是 0', () => {
    expect(describeResourceBalance({ kind: 'unknown', reason: 'not-scanned', fromChapter: 5 }, 'coins', 'en-US').primary)
      .toBe('Unknown (not scanned from chapter 5)')
    expect(describeResourceBalance({ kind: 'unknown', reason: 'no-origin', fromChapter: 1 }, 'coins', 'en-US').primary)
      .toBe('Unknown (no opening balance registered)')
    expect(describeResourceBalance({ kind: 'conflict', reason: 'unit-mismatch', units: ['a', 'b'], fromChapter: 2 }, 'a', 'en-US').primary)
      .toBe('Unit mismatch: a / b')
  })
})

describe('骤增 / 骤降阈值', () => {
  const point = (chapterNumber: number, value: number | null): LedgerSeriesPoint => ({ chapterNumber, value })

  it('同时满足「≥50%」与「≥10 单位」才标记', () => {
    expect(RESOURCE_JUMP_RATIO).toBe(0.5)
    expect(RESOURCE_JUMP_MIN_ABS).toBe(10)
    // +100（100 → 200）：两条都满足。
    expect(detectResourceJumps([point(1, 100), point(2, 200)])).toEqual([
      { chapterNumber: 2, previousChapter: 1, delta: 100, ratio: 1 },
    ])
    // +20（100 → 120）：比例不够，是正常收入。
    expect(detectResourceJumps([point(1, 100), point(2, 120)])).toEqual([])
    // 1 → 2：比例 +100%，但绝对额只有 1，小数目波动不报警。
    expect(detectResourceJumps([point(1, 1), point(2, 2)])).toEqual([])
    // 骤降同样标记（100 → 40）。
    expect(detectResourceJumps([point(1, 100), point(2, 40)])).toEqual([
      { chapterNumber: 2, previousChapter: 1, delta: -60, ratio: 0.6 },
    ])
  })

  it('上一可算点为 0 时只看绝对额（比例为 null）', () => {
    expect(detectResourceJumps([point(1, 0), point(2, 10)])).toEqual([
      { chapterNumber: 2, previousChapter: 1, delta: 10, ratio: null },
    ])
    expect(describeJump({ chapterNumber: 2, previousChapter: 1, delta: 10, ratio: null }, 'zh-CN'))
      .toContain('从 0 起')
  })

  it('未知章（null）被跳过：不与 0 比，也不切断「上一可算点」', () => {
    const points = [point(1, 100), point(2, null), point(3, 200)]
    // 第 3 章比的是第 1 章（+100 / 100%），不是和 0 比出的 +200。
    expect(detectResourceJumps(points)).toEqual([
      { chapterNumber: 3, previousChapter: 1, delta: 100, ratio: 1 },
    ])
    expect(describeJump({ chapterNumber: 3, previousChapter: 1, delta: 100, ratio: 1 }, 'zh-CN'))
      .toContain('较第 1 章 100%')
  })

  it('全未知的序列没有任何异常标记', () => {
    expect(detectResourceJumps([point(1, null), point(2, null)])).toEqual([])
  })
})

describe('族分组', () => {
  it('同族多品阶并成一组、按品阶排序，且不产生任何合计', () => {
    const groups = groupResourcesByFamily([
      resource({ resourceId: 'res:stone-high', name: '上品灵石', familyId: '灵石', tier: 2 }),
      resource({ resourceId: 'res:stone-low', name: '下品灵石', familyId: '灵石', tier: 0 }),
      resource({ resourceId: 'res:merit', name: '军功', unit: '点' }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ key: 'family:灵石', familyId: '灵石', title: '灵石' })
    expect(groups[0].items.map(item => item.name)).toEqual(['下品灵石', '上品灵石'])
    // 组对象本身没有 total / sum 之类的字段：族级余额是派生展示，这里不编数。
    expect(Object.keys(groups[0])).toEqual(['key', 'familyId', 'title', 'items'])
    // 单例资源自成一族（无族名，所以不渲染族标题）。
    expect(groups[1]).toMatchObject({ key: 'resource:res:merit', familyId: null, title: null })
  })

  it('空白族名按单例处理（不是「一族叫空字符串」）', () => {
    const groups = groupResourcesByFamily([
      resource({ resourceId: 'res:a', name: '甲', familyId: '   ' }),
      resource({ resourceId: 'res:b', name: '乙', familyId: '   ' }),
    ])
    expect(groups.map(group => group.key)).toEqual(['resource:res:a', 'resource:res:b'])
  })
})

describe('变动展示', () => {
  it('带符号：+120 / -6', () => {
    expect(formatMovementDelta(120)).toBe('+120')
    expect(formatMovementDelta(-6)).toBe('-6')
  })

  it('骤增 / 骤降两个方向都有中文与英文文案', () => {
    expect(describeJump({ chapterNumber: 4, previousChapter: 3, delta: 120, ratio: 2 }, 'zh-CN'))
      .toBe('骤增 第 4 章 +120（较第 3 章 200%）')
    expect(describeJump({ chapterNumber: 4, previousChapter: 3, delta: -120, ratio: 2 }, 'en-US'))
      .toBe('Jump down at chapter 4: -120 (200% vs chapter 3)')
  })
})
