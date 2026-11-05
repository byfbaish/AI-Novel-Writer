import { describe, expect, it } from 'vitest'
import {
  BOOK_SCOPE,
  blocksConsumption,
  buildSourceRef,
  derivedStatus,
  describeDrift,
  changedChaptersBetween,
  derivedStatusForChapters,
  expandChapterRange,
  mergeRevisionLogIntoChangedChapters,
  parseChangedChapters,
  parseUpstreamRefKey,
  serializeChangedChapters,
  withChangedChapters,
  refCoversChapter,
  upstreamRefKey,
  type UpstreamRevisionLogEntry,
} from '../upstream-revisions'

/**
 * 上游版本与派生来源判定的纯函数。
 *
 * 这些用例守的是设计稿里几条**方向性**决定，判错方向就是静默消费旧数据：
 * - 不知道来源 ⇒ `legacy`，不是 `valid`（不能把「没记过」当成「没问题」）；
 * - `have > need` 也判脏（库被回滚/上游被重置时会出现）；
 * - 来源里的键在当前表里消失 ⇒ 判脏（派生基于的东西已经不在了）；
 * - `changed_chapters` 记「哪一版改了哪些章」，判定只取 `(have, need]`；
 * - 空章集 = 覆盖全部（不是「什么都没改」），倒退（`have > need`）一律算脏；
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
    // S4b：每段都带「第几版→第几版」；没有 changed 证据时不给括号（不编造）。
    expect(text).toBe('世界观 第1版→第2版；弧光 第1版→第2版；情节大纲（u07） 第1版→第2版')
  })

  it('S4b 逐版证据：连续 ≥3 章压成区间，否则逐章列', () => {
    expect(describeDrift([{
      key: 'outline:book', have: 3, need: 5,
      changed: [{ rev: 4, chapters: [12, 13, 14] }, { rev: 5, chapters: [31] }],
    }])).toBe('情节大纲 第3版→第5版（第4版改过第12–14章；第5版改过第31章）')
    expect(describeDrift([{
      key: 'outline:book', have: 1, need: 2,
      changed: [{ rev: 2, chapters: [31, 33] }],
    }])).toBe('情节大纲 第1版→第2版（第2版改过第31、33章）')
  })

  it('S4b 取不到那一版 ⇒ 写「改动章未知」，不猜也不省略这半句', () => {
    // 省略会让作者以为「那版没改东西」，而真相是「被 20 版上限挤掉了」。
    expect(describeDrift([{
      key: 'outline:book', have: 1, need: 3,
      changed: [{ rev: 2, chapters: [12] }, { rev: 3, chapters: null }],
    }])).toBe('情节大纲 第1版→第3版（第2版改过第12章；第3版改动章未知）')
  })

  it('S4b 版本倒退标注「版本回退」—— 与「作者又改了一版」必须能分开', () => {
    expect(describeDrift([{ key: 'outline:book', have: 5, need: 2 }]))
      .toBe('情节大纲 第5版→第2版（版本回退）')
  })

  it('S6c 期 2 第 3 层：每版带时间与原因，时间按**本地**时区渲染', () => {
    const text = describeDrift([{
      key: 'outline:book', have: 3, need: 5,
      changed: [
        { rev: 4, chapters: [12, 13, 14], at: '2026-10-31 14:05:00', reason: 'author-edit' },
        { rev: 5, chapters: [31], at: '2026-10-31 15:20:00', reason: 'regenerate' },
      ],
    }])
    // 时分不钉死（跑测机器的时区不同），但必须是 MM-DD HH:MM，
    // 而不是把库里的 UTC 原文 `2026-10-31 14:05:00` 直接摆给作者。
    expect(text).toMatch(
      /^情节大纲 第3版→第5版（第4版 \d{2}-\d{2} \d{2}:\d{2} 作者手改，改过第12–14章；第5版 \d{2}-\d{2} \d{2}:\d{2} 重新生成，改过第31章）$/u,
    )
    expect(text).not.toContain('2026-10-31 14:05')
  })

  it('S6c 期 2：`unknown` 不渲染 —— 界面写「原因未知」对作者没有信息量', () => {
    // 但数据库里必须留着它：`WHERE reason='unknown'` 是「还有多少处没接线」的计数口径。
    expect(describeDrift([{
      key: 'outline:book', have: 1, need: 2,
      changed: [{ rev: 2, chapters: [7], at: '2026-10-31 14:05:00', reason: 'unknown' }],
    }])).toMatch(/^情节大纲 第1版→第2版（第2版 \d{2}-\d{2} \d{2}:\d{2} 改过第7章）$/u)
  })

  it('S6c 期 2：`coversAll` 说「改动了全部章节」，不与「查不到」混为一谈', () => {
    // 两种都是一个空章集，但方向相反：一个是「整本都重写了」，一个是「不知道改了哪些」。
    expect(describeDrift([{
      key: 'outline:book', have: 1, need: 2,
      changed: [{ rev: 2, chapters: [], coversAll: true, at: '2026-10-31 14:05:00', reason: 'regenerate' }],
    }])).toMatch(/改动了全部章节）$/u)
    expect(describeDrift([{
      key: 'outline:book', have: 1, need: 2,
      changed: [{ rev: 2, chapters: [] }],
    }])).toBe('情节大纲 第1版→第2版（第2版改动章未知）')
  })
})

describe('mergeRevisionLogIntoChangedChapters（S6c 期 2）', () => {
  function entry(
    overrides: Partial<UpstreamRevisionLogEntry> & { rev: number },
  ): UpstreamRevisionLogEntry {
    return {
      domain: 'outline', scope: 'book', at: '2026-10-31 14:05:00',
      reason: 'unknown', changedChapters: [], coversAll: false,
      ...overrides,
    }
  }

  it('两段各覆盖一段时间：JSON 的旧版本 + 流水的新版本都要在（缺任一段 ⇒ 全改）', () => {
    const base = parseChangedChapters('{"1":[3]}')
    const merged = mergeRevisionLogIntoChangedChapters(base, [entry({ rev: 2, changedChapters: [7] })])
    expect([...merged.byRev.entries()]).toEqual([[1, [3]], [2, [7]]])
    // 两段都在，区间 (1,2] 才收窄得出「只改了第 7 章」；只有任一半都会返回 null。
    expect(changedChaptersBetween(merged, 1, 2)).toEqual([7])
  })

  it('同 rev 两边都有 ⇒ 以流水为准（当前态列被 replace / 20 版上限加工过）', () => {
    const base = parseChangedChapters('{"2":[9]}')
    const merged = mergeRevisionLogIntoChangedChapters(base, [entry({ rev: 2, changedChapters: [7] })])
    expect(merged.byRev.get(2)).toEqual([7])
  })

  it('coversAll 落成空章集 —— 判定侧「空 = 全改」的约定不许另造哨兵', () => {
    const merged = mergeRevisionLogIntoChangedChapters(null, [entry({ rev: 1, coversAll: true })])
    expect(merged.byRev.get(1)).toEqual([])
    expect(changedChaptersBetween(merged, 0, 1)).toBeNull()
    expect(merged.meta?.get(1)?.coversAll).toBe(true)
  })

  it('legacy 章集原样保留（流水没有「哪一版」这层信息，表达不了它）', () => {
    const merged = mergeRevisionLogIntoChangedChapters(parseChangedChapters('[31,33]'), [])
    expect(merged.legacyChapters).toEqual([31, 33])
    expect(merged.meta).toBeUndefined()
  })

  it('撞号时后写的覆盖先写的（与 history 的 rev ASC, id ASC 同序）', () => {
    const merged = mergeRevisionLogIntoChangedChapters(null, [
      entry({ rev: 2, changedChapters: [4] }),
      entry({ rev: 2, changedChapters: [5], reason: 'import-restore' }),
    ])
    expect(merged.byRev.get(2)).toEqual([5])
    expect(merged.meta?.get(2)?.reason).toBe('import-restore')
  })
})

describe('changed_chapters 的两代格式', () => {
  it('旧格式（裸数组）解析成 legacyChapters —— 没记 rev，只能保守处理', () => {
    const parsed = parseChangedChapters('[31,33]')
    expect(parsed.legacyChapters).toEqual([31, 33])
    expect(parsed.byRev.size).toBe(0)
  })

  it('新格式解析成 rev → 章集，`legacy` 键原样保留（换代不能把旧章集丢掉）', () => {
    const parsed = parseChangedChapters('{"legacy":[1,2],"3":[31],"4":[33,35]}')
    expect(parsed.legacyChapters).toEqual([1, 2])
    expect([...parsed.byRev.entries()]).toEqual([[3, [31]], [4, [33, 35]]])
  })

  it('坏数据一律解析成空（判定侧因此按「覆盖全部」处理，方向多判脏）', () => {
    for (const raw of ['', 'null', '不是 JSON', '{"a":[1]}', '{"0":[1]}']) {
      const parsed = parseChangedChapters(raw)
      expect(parsed.legacyChapters).toEqual([])
      expect(parsed.byRev.size).toBe(0)
    }
  })

  it('写入把章集挂在新 rev 键上；超过上限时把最旧两条合并（不是塞进 legacy）', () => {
    let parsed = parseChangedChapters('')
    for (let rev = 1; rev <= 22; rev += 1) parsed = withChangedChapters(parsed, rev, [rev])
    expect(parsed.byRev.size).toBe(20)
    // 合并后 1..3 的章集落在 rev3 这条上，方向是多判脏而不是永久「全部章」
    expect(parsed.byRev.get(3)).toEqual([1, 2, 3])
    expect(parsed.legacyChapters).toEqual([])
    expect(parseChangedChapters(serializeChangedChapters(parsed)).byRev.size).toBe(20)
  })
})

describe('changedChaptersBetween', () => {
  it('只取 (have, need] 这一段 —— 这正是「改 31 再改 33 后，31 那行不该脏」的根', () => {
    const parsed = parseChangedChapters('{"2":[31],"3":[33]}')
    expect(changedChaptersBetween(parsed, 2, 3)).toEqual([33])
    expect(changedChaptersBetween(parsed, 1, 2)).toEqual([31])
  })

  it('旧格式 / 缺记录 / 空条目一律返回 null（= 无法收窄，按全部章算）', () => {
    expect(changedChaptersBetween(parseChangedChapters('[31]'), 1, 2)).toBeNull()
    expect(changedChaptersBetween(parseChangedChapters('{"1":[]}'), 1, 2)).toBeNull()
    expect(changedChaptersBetween(parseChangedChapters('{"5":[31]}'), 1, 2)).toBeNull()
    expect(changedChaptersBetween(null, 1, 2)).toBeNull()
  })
})

describe('derivedStatusForChapters', () => {
  const changes = (raw: Record<string, string>) => new Map(
    Object.entries(raw).map(([key, value]) => [key, parseChangedChapters(value)]),
  )

  it('S4b 判定时把逐版证据一起带出来 —— 拒绝发生在渲染层，那里拿不到 changes', () => {
    const log = changes({ 'outline:book': '{"4":[12,13,14],"5":[31]}' })
    const current = snapshotOf({ 'outline:book': 5 })
    const verdict = derivedStatusForChapters({ 'outline:book': 3 }, current, log, [12])
    expect(verdict.state).toBe('stale')
    if (verdict.state !== 'stale') throw new Error('unreachable')
    expect(verdict.behind[0].changed).toEqual([
      { rev: 4, chapters: [12, 13, 14] },
      { rev: 5, chapters: [31] },
    ])
    // 再往下走一遍真实链路：硬拒文案必须能说出「哪一版改过哪些章」。
    expect(describeDrift(verdict.behind))
      .toBe('情节大纲 第3版→第5版（第4版改过第12–14章；第5版改过第31章）')
  })

  it('S4b 旧格式（裸数组）不编造版本归属 —— changed 不给，文案退回只报版本区间', () => {
    const log = changes({ 'outline:book': '[31,33]' })
    const current = snapshotOf({ 'outline:book': 2 })
    const verdict = derivedStatusForChapters({ 'outline:book': 1 }, current, log, [31])
    if (verdict.state !== 'stale') throw new Error('unreachable')
    expect(verdict.behind[0].changed).toBeUndefined()
    expect(describeDrift(verdict.behind)).toBe('情节大纲 第1版→第2版')
  })

  it('改 31 再改 33：写于 rev2 的第 31 章那行必须 valid（不能拦作者刚改完的卡）', () => {
    const log = changes({ 'outline:book': '{"2":[31],"3":[33]}' })
    const current = snapshotOf({ 'outline:book': 3 })
    expect(derivedStatusForChapters({ 'outline:book': 2 }, current, log, [31])).toEqual({ state: 'valid' })
    // 依赖被改章的那几行才脏
    expect(derivedStatusForChapters({ 'outline:book': 2 }, current, log, [33]).state).toBe('stale')
    expect(derivedStatusForChapters({ 'outline:book': 1 }, current, log, [31]).state).toBe('stale')
  })

  it('空章集 = 覆盖全部：整本重生成（replace 后无记录）必须让所有派生变脏', () => {
    const log = changes({ 'outline:book': '{}' })
    const current = snapshotOf({ 'outline:book': 4 })
    expect(derivedStatusForChapters({ 'outline:book': 1 }, current, log, [7]).state).toBe('stale')
    // 章集本身说不清（null / []）同样按全书算
    expect(derivedStatusForChapters({ 'outline:book': 1 }, current, log, null).state).toBe('stale')
    expect(derivedStatusForChapters({ 'outline:book': 1 }, current, log, []).state).toBe('stale')
  })

  it('have > need 一律脏，不看章集（备份恢复 / 导入更早的包）', () => {
    const log = changes({ 'outline:book': '{"2":[99]}' })
    const result = derivedStatusForChapters({ 'outline:book': 5 }, snapshotOf({ 'outline:book': 2 }), log, [7])
    expect(result.state).toBe('stale')
    expect(result.state === 'stale' && result.behind[0]).toEqual({ key: 'outline:book', have: 5, need: 2 })
  })

  it('changes 缺键 / current 缺键都按全部章算（与 derivedStatus 的 need=0 ⇒ stale 同向）', () => {
    expect(derivedStatusForChapters({ 'outline:u07': 1 }, snapshotOf({ 'outline:u07': 2 }), changes({}), [7]).state).toBe('stale')
    expect(derivedStatusForChapters({ 'outline:u07': 2 }, snapshotOf({}), changes({}), [7]).state).toBe('stale')
  })

  it('非 outline 域恒覆盖全部章：世界观改了，与章号无关', () => {
    const log = changes({ 'worldbuilding:book': '{"2":[99]}' })
    expect(derivedStatusForChapters({ 'worldbuilding:book': 1 }, snapshotOf({ 'worldbuilding:book': 2 }), log, [7]).state)
      .toBe('stale')
  })

  it('没有来源仍然判 legacy（不是 valid）', () => {
    expect(derivedStatusForChapters(null, snapshotOf({}), changes({}), [1])).toEqual({ state: 'legacy' })
    expect(derivedStatusForChapters({}, snapshotOf({}), changes({}), [1])).toEqual({ state: 'legacy' })
  })

  /**
   * D17 的验收标准：**提交 1 章大纲只让这一章的派生变脏。**
   *
   * 修之前写入侧交的是空集 ⇒ 三条全 stale（就是同步页列 7 项的形状）。
   * 这条用例一旦回退成空集就会红，比看界面可靠。
   */
  it('D17：rev7 只改了第 10 章 ⇒ 第 7 章蓝图有效、第 10 章蓝图脏、覆盖 7–10 的交接单脏', () => {
    const log = changes({ 'outline:book': '{"7":[10]}' })
    const current = snapshotOf({ 'outline:book': 7 })
    expect(derivedStatusForChapters({ 'outline:book': 6 }, current, log, [7])).toEqual({ state: 'valid' })
    expect(derivedStatusForChapters({ 'outline:book': 6 }, current, log, [10]).state).toBe('stale')
    // 交接单覆盖整卷区间：只要其中一章被改过就得重算。
    expect(derivedStatusForChapters({ 'outline:book': 6 }, current, log, [7, 8, 9, 10]).state).toBe('stale')
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
