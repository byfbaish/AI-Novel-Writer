import { describe, expect, it } from 'vitest'
import {
  BOOK_SCOPE,
  blocksConsumption,
  buildSourceRef,
  derivedStatus,
  describeDrift,
  expandChapterRange,
  mergeChangedChapters,
  parseUpstreamRefKey,
  refCoversChapter,
  upstreamRefKey,
} from '../upstream-revisions'

/**
 * 上游版本与派生来源判定的纯函数。
 *
 * 这些用例守的是设计稿里几条**方向性**决定，判错方向就是静默消费旧数据：
 * - 不知道来源 ⇒ `legacy`，不是 `valid`（不能把「没记过」当成「没问题」）；
 * - `have > need` 也判脏（库被回滚/上游被重置时会出现）；
 * - 来源里的键在当前表里消失 ⇒ 判脏（派生基于的东西已经不在了）；
 * - `changed_chapters` 取并集（覆盖会漏判同一批更早改过的章）；
 * - 非 `outline` 域不受章集合收窄（世界观改了就是全书都变）。
 */
function snapshotOf(entries: Record<string, number>): ReadonlyMap<string, number> {
  return new Map(Object.entries(entries))
}

describe('upstreamRefKey / parseUpstreamRefKey', () => {
  it('拼出 domain:scope 两段，单例域默认 book', () => {
    expect(upstreamRefKey('worldbuilding')).toBe('worldbuilding:book')
    expect(upstreamRefKey('arc', BOOK_SCOPE)).toBe('arc:book')
    expect(upstreamRefKey('outline', 'u07')).toBe('outline:u07')
  })

  it('解析回两段；格式不合法返回 null（调用方按 legacy 处理，不猜）', () => {
    expect(parseUpstreamRefKey('outline:u07')).toEqual({ domain: 'outline', scope: 'u07' })
    expect(parseUpstreamRefKey('outline')).toBeNull()
    expect(parseUpstreamRefKey(':u07')).toBeNull()
    expect(parseUpstreamRefKey('outline:')).toBeNull()
  })
})

describe('buildSourceRef', () => {
  it('只记当前表里存在的键 —— 没版本概念的上游不进快照', () => {
    const current = snapshotOf({ 'worldbuilding:book': 3, 'arc:book': 1 })
    const ref = buildSourceRef(['worldbuilding:book', 'arc:book', 'outline:u07'], current)
    // outline:u07 不在表里 ⇒ 不进快照，整行因此会被判 legacy 而不是「伪造 rev=0 假装最新」
    expect(ref).toEqual({ 'worldbuilding:book': 3, 'arc:book': 1 })
  })

  it('全部键都不存在时得到空快照（后续判 legacy）', () => {
    expect(buildSourceRef(['outline:u07'], snapshotOf({}))).toEqual({})
  })
})

describe('derivedStatus', () => {
  it('没有来源 ⇒ legacy（不是 valid，也不是 stale）', () => {
    expect(derivedStatus(null, snapshotOf({}))).toEqual({ state: 'legacy' })
    expect(derivedStatus(undefined, snapshotOf({}))).toEqual({ state: 'legacy' })
    expect(derivedStatus({}, snapshotOf({ 'arc:book': 2 }))).toEqual({ state: 'legacy' })
  })

  it('每个依赖域都相等 ⇒ valid', () => {
    const current = snapshotOf({ 'worldbuilding:book': 3, 'arc:book': 1 })
    expect(derivedStatus({ 'worldbuilding:book': 3, 'arc:book': 1 }, current)).toEqual({ state: 'valid' })
  })

  it('任一域落后 ⇒ stale，并列出落后的域（不列没变的那几个）', () => {
    const current = snapshotOf({ 'worldbuilding:book': 3, 'arc:book': 4 })
    const result = derivedStatus({ 'worldbuilding:book': 3, 'arc:book': 1 }, current)
    expect(result.state).toBe('stale')
    expect(result.state === 'stale' && result.behind).toEqual([{ key: 'arc:book', have: 1, need: 4 }])
  })

  it('have > need 也判脏 —— 库被恢复到更早版本时必须算脏', () => {
    // 与删除收据那次事故同族（ADR-0026）：收据/来源描述的现实可能已经不在了。
    const result = derivedStatus({ 'arc:book': 5 }, snapshotOf({ 'arc:book': 2 }))
    expect(result.state).toBe('stale')
    expect(result.state === 'stale' && result.behind[0]).toEqual({ key: 'arc:book', have: 5, need: 2 })
  })

  it('来源里的键在当前表里消失 ⇒ 判脏（need 记 0），不当 legacy', () => {
    const result = derivedStatus({ 'outline:u07': 2 }, snapshotOf({}))
    expect(result.state).toBe('stale')
    expect(result.state === 'stale' && result.behind[0]).toEqual({ key: 'outline:u07', have: 2, need: 0 })
  })

  it('非整数 rev 跳过不比（坏数据不伪造结论）', () => {
    expect(derivedStatus({ 'arc:book': Number.NaN }, snapshotOf({ 'arc:book': 1 }))).toEqual({ state: 'valid' })
  })

  it('只有 stale 需要拦截；legacy 与 not-applicable 不拦', () => {
    expect(blocksConsumption({ state: 'stale', behind: [] })).toBe(true)
    expect(blocksConsumption({ state: 'legacy' })).toBe(false)
    expect(blocksConsumption({ state: 'valid' })).toBe(false)
    expect(blocksConsumption({ state: 'not-applicable', reason: '未定稿' })).toBe(false)
  })
})

describe('describeDrift', () => {
  it('按 世界观 → 弧光 → 情节大纲 固定排序，同一份数据文案稳定', () => {
    const text = describeDrift([
      { key: 'outline:u07', have: 1, need: 2 },
      { key: 'arc:book', have: 1, need: 2 },
      { key: 'worldbuilding:book', have: 1, need: 2 },
    ])
    expect(text).toBe('世界观、弧光、情节大纲（u07）')
  })
})

describe('mergeChangedChapters', () => {
  it('取并集、去重、升序 —— 覆盖会让同一批更早改过的章漏判', () => {
    expect(mergeChangedChapters([31, 33], [33, 35])).toEqual([31, 33, 35])
    expect(mergeChangedChapters(null, [35, 31])).toEqual([31, 35])
    expect(mergeChangedChapters([], [])).toEqual([])
  })

  it('丢掉非法章号（0、负数、非整数），不让坏数据污染集合', () => {
    expect(mergeChangedChapters([0, -3, 12], [7, 1.5 as number])).toEqual([12, 7].sort((a, b) => a - b))
  })
})

describe('expandChapterRange', () => {
  it('正常区间展开成闭区间数组', () => {
    expect(expandChapterRange({ from: 3, to: 6 })).toEqual([3, 4, 5, 6])
    expect(expandChapterRange({ from: 5, to: 5 })).toEqual([5])
  })

  it('非法区间一律空数组（空 = 全部覆盖，方向选多判脏）', () => {
    expect(expandChapterRange(null)).toEqual([])
    expect(expandChapterRange({ from: 6, to: 3 })).toEqual([])
    expect(expandChapterRange({ from: 0, to: 3 })).toEqual([])
    expect(expandChapterRange({ from: 1.5, to: 3 })).toEqual([])
  })
})

describe('refCoversChapter', () => {
  it('outline 域按章收窄：只有改过的章才算被波及', () => {
    expect(refCoversChapter('outline:u07', [31, 33], 31)).toBe(true)
    expect(refCoversChapter('outline:u07', [31, 33], 32)).toBe(false)
  })

  it('非 outline 域恒为 true —— 世界观改了就是全书都变', () => {
    expect(refCoversChapter('worldbuilding:book', [31], 99)).toBe(true)
    expect(refCoversChapter('arc:book', [], 1)).toBe(true)
  })

  it('章集合为空视为「全部覆盖」，不是「没改过」', () => {
    expect(refCoversChapter('outline:u07', [], 42)).toBe(true)
    expect(refCoversChapter('outline:u07', null, 42)).toBe(true)
  })

  it('键格式不合法时保守返回 true', () => {
    expect(refCoversChapter('乱码键', [1], 99)).toBe(true)
  })
})
