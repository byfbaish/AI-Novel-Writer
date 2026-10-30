import { describe, expect, it } from 'vitest'

import type { ParsedChangedChapters } from '../../../src/shared/upstream-revisions'
import {
  blueprintValidity,
  plotTreeValidity,
  volumeHandoffChapters,
  volumeHandoffValidity,
  type DerivedReadContext,
} from '../derived-validity'

/**
 * 读取侧判定（P2-2 期 2）。
 *
 * 这里守的是**「按章收窄」的边界**：哪些派生有资格用章集收窄、哪些必须按全改算。
 * 收窄本来是为了不误伤（改 33 章不该把 31 章的卡判脏），但它一旦用在该用的地方之外，
 * 就变成漏判 —— 而不变的方向必须永远是「宁多说脏，别漏」。
 */
function context(
  revisions: ReadonlyArray<readonly [string, number]>,
  changes: ReadonlyArray<readonly [string, ReadonlyArray<readonly [number, number[]]>]> = [],
): DerivedReadContext {
  return {
    revisions: new Map(revisions),
    changes: new Map(changes.map(([key, entries]) => [key, {
      legacyChapters: [],
      byRev: new Map(entries.map(([rev, chapters]) => [rev, chapters])),
    } as ParsedChangedChapters])),
  }
}

const outlineOnly = (chapterMap: ReadonlyArray<readonly [number, number[]]>) =>
  context([['outline:book', 2]], [['outline:book', chapterMap]])

describe('volumeHandoffChapters — 只有 actual 才敢收窄', () => {
  it('actual + 首末章都是正整数 ⇒ 展开区间', () => {
    expect(volumeHandoffChapters({ boundaryBasis: 'actual', firstChapter: 1, lastChapter: 3 }))
      .toEqual([1, 2, 3])
  })

  it.each(['declared', 'even', 'headings'] as const)(
    '%s 的区间是推算值 ⇒ 不收窄（空集 = 全书）',
    (basis) => {
      // 用估算区间决定"哪一章被改了"就是拿猜测当事实：估错直接漏判。
      expect(volumeHandoffChapters({ boundaryBasis: basis, firstChapter: 1, lastChapter: 20 }))
        .toEqual([])
    },
  )

  it('卷已删（basis=null）或不适用 ⇒ 不收窄', () => {
    expect(volumeHandoffChapters({ boundaryBasis: null, firstChapter: 1, lastChapter: 20 })).toEqual([])
  })

  it('首末章缺失 / 非正整数 ⇒ 不收窄', () => {
    expect(volumeHandoffChapters({ boundaryBasis: 'actual', firstChapter: null, lastChapter: 20 })).toEqual([])
    expect(volumeHandoffChapters({ boundaryBasis: 'actual', firstChapter: 0, lastChapter: 20 })).toEqual([])
    expect(volumeHandoffChapters({ boundaryBasis: 'actual', firstChapter: 20, lastChapter: 3 })).toEqual([])
  })
})

describe('volumeHandoffValidity', () => {
  const actualRange = { boundaryBasis: 'actual' as const, firstChapter: 1, lastChapter: 20 }

  it('改的是本卷之外的章 ⇒ valid（收窄生效，作者刚改别的卷不该被判脏）', () => {
    expect(volumeHandoffValidity(outlineOnly([[2, [21]]]), { 'outline:book': 1 }, actualRange).state)
      .toBe('valid')
  })

  it('改到了本卷某一章 ⇒ stale', () => {
    expect(volumeHandoffValidity(outlineOnly([[2, [5]]]), { 'outline:book': 1 }, actualRange).state)
      .toBe('stale')
  })

  it('区间是估算的 ⇒ 改任何一章都判 stale（不能收窄）', () => {
    expect(volumeHandoffValidity(
      outlineOnly([[2, [21]]]),
      { 'outline:book': 1 },
      { boundaryBasis: 'declared', firstChapter: 1, lastChapter: 20 },
    ).state).toBe('stale')
  })

  it('没有来源记录 ⇒ legacy（存量行，只提示不阻断）', () => {
    expect(volumeHandoffValidity(outlineOnly([[2, [5]]]), null, actualRange).state).toBe('legacy')
  })
})

describe('blueprintValidity — 只看自己这一章', () => {
  it('改的是别的章 ⇒ valid', () => {
    expect(blueprintValidity(outlineOnly([[2, [33]]]), { 'outline:book': 1 }, 31).state).toBe('valid')
  })

  it('改的是本章 ⇒ stale', () => {
    const result = blueprintValidity(outlineOnly([[2, [33]]]), { 'outline:book': 1 }, 33)
    expect(result.state).toBe('stale')
    expect(result.state === 'stale' ? result.behind[0] : null)
      .toEqual({ key: 'outline:book', have: 1, need: 2 })
  })

  it('章号不合法 ⇒ not-applicable（不是 stale，别拿它去拦人）', () => {
    expect(blueprintValidity(outlineOnly([]), { 'outline:book': 1 }, 0).state).toBe('not-applicable')
  })

  it('版本表里没有该键（need=0）⇒ stale，不判 legacy', () => {
    // 这是"库被恢复到更早备份"的形状：来源记着第 1 版，而版本表里那一行没了。
    // 判 legacy 会让它看起来"从来没记过来源"，从而只提示不阻断 —— 方向反了。
    expect(blueprintValidity(context([]), { 'outline:book': 1 }, 5).state).toBe('stale')
  })
})

describe('plotTreeValidity — 全书一份', () => {
  it('改任何一章都 stale（章集为 null ⇒ 覆盖全部章）', () => {
    expect(plotTreeValidity(outlineOnly([[2, [999]]]), { 'outline:book': 1 }).state).toBe('stale')
  })

  it('版本没变 ⇒ valid', () => {
    expect(plotTreeValidity(context([['outline:book', 2]]), { 'outline:book': 2 }).state).toBe('valid')
  })

  it('rev 倒退（导入更早的包）⇒ stale，哪怕章集为空', () => {
    const backed = context([['outline:book', 1]], [['outline:book', []]])
    expect(plotTreeValidity(backed, { 'outline:book': 3 }).state).toBe('stale')
  })
})
