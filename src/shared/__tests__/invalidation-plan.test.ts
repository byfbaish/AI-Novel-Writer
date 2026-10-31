import { describe, expect, it } from 'vitest'
import { computeInvalidationPlan, type InvalidationGroupKind } from '../invalidation-plan'
import {
  BOOK_SCOPE,
  describeDrift,
  expandChapterRange,
  upstreamRefKey,
  type ParsedChangedChapters,
  type UpstreamDomain,
  type UpstreamRevisionSnapshot,
} from '../upstream-revisions'

/**
 * 期 3a 失效清单的组装。
 *
 * 守的是四条**会静默出错**的形态，每一条对应一个「清单看着全、其实骗人」的结果：
 * - `legacy` 与 `stale` 不许合并 —— 混成一个计数，作者分不清「要处置 3 项」和「有 3 项我不知道」；
 * - `unseen.count` 如实报 —— 显示「0 项影响」而实际一堆看不见的派生，是 blast radius 最危险的低估；
 * - 空组不占位 —— 渲染出「章节蓝图（0）」会让作者以为有事；
 * - `overrides` 不许凭空造域 —— 否则每次 plan 都报「全军覆没」，作者第三次就盲点确定了。
 *
 * ## 两个必须知道的构造约定
 *
 * 1. **`plotTreeSourceRef` 在每个用例里都显式给**，不给默认值。剧情树全书只有一份，
 *    它恒为候选；传 `null` 就会得到一条 `legacy`（进 `unseen`）。留默认值会让一半用例
 *    的期望变成隐式依赖。
 * 2. **交接单的 `chapters` 是已展开的完整章列表**（`volumeHandoffChapters()` 的产出形态），
 *    不是首末章两个数字。写成 `[1, 20]` 等于「只覆盖第 1 章和第 20 章」，测出来的是别的东西。
 */
function snapshotOf(entries: Record<string, number>): UpstreamRevisionSnapshot {
  return new Map(Object.entries(entries))
}

/** 交接单的章集合：必须展开，否则按章收窄会得到假结果。 */
function range(from: number, to: number): number[] {
  return expandChapterRange({ from, to })
}

/** `changes` 的新格式：`键 → (rev → 章集)`。旧格式那一路由 `upstream-revisions` 的用例守着。 */
function changesOf(
  entries: Record<string, Record<number, readonly number[]>>,
): ReadonlyMap<string, ParsedChangedChapters> {
  return new Map(
    Object.entries(entries).map(([key, byRev]) => [
      key,
      {
        legacyChapters: [],
        byRev: new Map(Object.entries(byRev).map(([rev, chapters]) => [Number(rev), chapters])),
      } satisfies ParsedChangedChapters,
    ]),
  )
}

const OUTLINE = upstreamRefKey('outline', BOOK_SCOPE)
const WORLD = upstreamRefKey('worldbuilding', BOOK_SCOPE)

interface PlanInput {
  overrides?: ReadonlyArray<{ domain: UpstreamDomain; scope?: string; rev: number }>
  revisions?: UpstreamRevisionSnapshot
  changes?: ReadonlyMap<string, ParsedChangedChapters>
  blueprints?: ReadonlyArray<{ chapterNumber: number; sourceRef: Record<string, number> | null }>
  handoffs?: ReadonlyArray<{ label: string; chapters: readonly number[]; sourceRef: Record<string, number> | null }>
  plotTreeSourceRef: Record<string, number> | null
}

function plan(input: PlanInput) {
  return computeInvalidationPlan({
    overrides: input.overrides ?? [],
    revisions: input.revisions ?? snapshotOf({ [OUTLINE]: 3 }),
    changes: input.changes ?? changesOf({}),
    blueprints: input.blueprints ?? [],
    handoffs: input.handoffs ?? [],
    plotTreeSourceRef: input.plotTreeSourceRef,
  })
}

function labelsOf(planResult: ReturnType<typeof plan>, kind: InvalidationGroupKind): string[] {
  return planResult.groups.find((group) => group.kind === kind)?.items.map((item) => item.label) ?? []
}

describe('computeInvalidationPlan · tier', () => {
  it('① 假想 rev 大于所有 source_ref ⇒ 三组都判 stale', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 9 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      handoffs: [{ label: '第 1 卷第 20 章交接单', chapters: range(1, 20), sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.groups.map((group) => group.kind)).toEqual(['blueprint', 'handoff', 'plot-tree'])
    expect(result.groups.map((group) => group.count)).toEqual([1, 1, 1])
    expect(result.tier).toBe('strong')
    expect(result.unseen.count).toBe(0)
  })

  it('② 假想 rev 等于当前 rev ⇒ 无事可报，tier=silent', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 3 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.groups).toEqual([])
    expect(result.tier).toBe('silent')
    expect(result.unseen.count).toBe(0)
  })

  it('⑥ 只有蓝图 ⇒ once；再加一份交接单 ⇒ strong', () => {
    const onlyBlueprint = plan({
      overrides: [{ domain: 'outline', rev: 9 }],
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: null,
    })
    expect(onlyBlueprint.tier).toBe('once')

    const withHandoff = plan({
      overrides: [{ domain: 'outline', rev: 9 }],
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      handoffs: [{ label: '第 1 卷第 20 章交接单', chapters: range(1, 20), sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: null,
    })
    expect(withHandoff.tier).toBe('strong')
  })

  it('⑥b 只有 legacy 项、没有 stale ⇒ 不是 silent（有事看不见就不算无事）', () => {
    const result = plan({
      blueprints: [{ chapterNumber: 12, sourceRef: null }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.groups).toEqual([])
    expect(result.unseen.count).toBe(1)
    expect(result.tier).toBe('once')
  })

  it('组空且 unseen 为 0 ⇒ silent，且 unaffected 为 null', () => {
    const result = plan({ blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }], plotTreeSourceRef: { [OUTLINE]: 3 } })
    expect(result.groups).toEqual([])
    expect(result.unseen.count).toBe(0)
    expect(result.tier).toBe('silent')
    expect(result.unaffected).toBeNull()
  })
})

describe('computeInvalidationPlan · legacy 不许与 stale 混为一谈', () => {
  it('③ source_ref 为 null 的蓝图进 unseen.count，不进 groups', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 9 }],
      blueprints: [
        { chapterNumber: 12, sourceRef: null },
        { chapterNumber: 13, sourceRef: { [OUTLINE]: 3 } },
      ],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.unseen.count).toBe(1)
    expect(result.unseen.kinds).toEqual(['blueprint'])
    expect(labelsOf(result, 'blueprint')).toEqual(['第 13 章'])
  })

  it('同时有 legacy 与 stale ⇒ 两个计数各自如实，不合并', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 9 }],
      blueprints: [
        { chapterNumber: 11, sourceRef: null },
        { chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } },
      ],
      handoffs: [{ label: '第 1 卷交接单', chapters: range(1, 20), sourceRef: null }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.unseen.count).toBe(2)
    expect(result.unseen.kinds).toEqual(['blueprint', 'handoff'])
    expect(result.groups.map((group) => [group.kind, group.count])).toEqual([['blueprint', 1], ['plot-tree', 1]])
  })

  it('unseen.count === 0 时字段仍在（UI 要靠它显示「没有无法判断的项」）', () => {
    const result = plan({
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.unseen).toEqual({ count: 0, kinds: [] })
  })

  it('⑦ 空组不出现在 groups 里（不渲染「章节蓝图（0）」）', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 9 }],
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: null,
    })
    expect(result.groups.map((group) => group.kind)).toEqual(['blueprint'])
    expect(result.groups.every((group) => group.count > 0)).toBe(true)
  })
})

describe('computeInvalidationPlan · overrides 的边界', () => {
  it('④ overrides 给了表里不存在的域 ⇒ 被忽略，不产生全军覆没的假警报', () => {
    const result = plan({
      overrides: [{ domain: 'arc', rev: 9 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.groups).toEqual([])
    expect(result.tier).toBe('silent')
  })

  it('④b 给了不存在的 scope 同样被忽略（键是一条整体，不是只看 domain）', () => {
    const unitKey = upstreamRefKey('outline', 'u07')
    const result = plan({
      overrides: [{ domain: 'outline', scope: 'u99', rev: 9 }],
      revisions: snapshotOf({ [OUTLINE]: 3, [unitKey]: 2 }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [unitKey]: 2 } }],
      plotTreeSourceRef: { [unitKey]: 2 },
    })
    expect(result.groups).toEqual([])
  })

  it('存在的单元级 scope 正常生效（单元大纲的版本与全书互不相干）', () => {
    const unitKey = upstreamRefKey('outline', 'u07')
    const result = plan({
      overrides: [{ domain: 'outline', scope: 'u07', rev: 5 }],
      revisions: snapshotOf({ [unitKey]: 2 }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [unitKey]: 2 } }],
      plotTreeSourceRef: null,
    })
    expect(labelsOf(result, 'blueprint')).toEqual(['第 12 章'])
    expect(result.groups[0].items[0].behind).toEqual([{ key: unitKey, have: 2, need: 5 }])
  })

  it('世界观是全书域：一旦变化不受章集合收窄，哪怕改的章不在这张蓝图里', () => {
    const result = plan({
      overrides: [{ domain: 'worldbuilding', rev: 4 }],
      revisions: snapshotOf({ [WORLD]: 2, [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 3: [31] } }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [WORLD]: 2, [OUTLINE]: 3 } }],
      plotTreeSourceRef: null,
    })
    expect(labelsOf(result, 'blueprint')).toEqual(['第 12 章'])
    expect(result.groups[0].items[0].behind).toEqual([{ key: WORLD, have: 2, need: 4 }])
  })
})

describe('computeInvalidationPlan · 交接单的保守方向', () => {
  it('⑤ chapters 为空数组（边界非 actual）⇒ 按覆盖全书算 ⇒ 判 stale', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 4: [31] } }),
      handoffs: [{ label: '第 1 卷交接单', chapters: [], sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: null,
    })
    expect(labelsOf(result, 'handoff')).toEqual(['第 1 卷交接单'])
    expect(result.tier).toBe('strong')
    // 覆盖全书时没有「不受影响」可言。
    expect(result.unaffected).toBeNull()
  })

  it('⑤b 边界为 actual（已展开成完整章集合）时，没被改到的那一卷交接单不受影响', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 4: [31] } }),
      handoffs: [
        { label: '第 1 卷交接单', chapters: range(1, 20), sourceRef: { [OUTLINE]: 3 } },
        { label: '第 2 卷交接单', chapters: range(21, 40), sourceRef: { [OUTLINE]: 3 } },
      ],
      plotTreeSourceRef: null,
    })
    // 第 31 章落在第 2 卷区间里 ⇒ 第 2 卷判脏、第 1 卷不判。
    expect(labelsOf(result, 'handoff')).toEqual(['第 2 卷交接单'])
  })
})

describe('computeInvalidationPlan · 按章收窄与 unaffected', () => {
  it('⑫ 改了第 31 章 ⇒ 第 12 章那张蓝图不判脏（不许拒绝作者刚改完的卡）', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 4: [31] } }),
      blueprints: [
        { chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } },
        { chapterNumber: 31, sourceRef: { [OUTLINE]: 3 } },
      ],
      plotTreeSourceRef: null,
    })
    expect(labelsOf(result, 'blueprint')).toEqual(['第 31 章'])
  })

  it('受影响章之间有空隙 ⇒ unaffected 给最长那一段', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 4: [3, 12, 40] } }),
      blueprints: [
        { chapterNumber: 3, sourceRef: { [OUTLINE]: 3 } },
        { chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } },
        { chapterNumber: 40, sourceRef: { [OUTLINE]: 3 } },
      ],
      plotTreeSourceRef: null,
    })
    expect(labelsOf(result, 'blueprint')).toEqual(['第 3 章', '第 12 章', '第 40 章'])
    expect(result.unaffected).toEqual({ from: 13, to: 39 })
  })

  it('只命中一章 ⇒ 没有区间内部空隙 ⇒ null（不猜两端）', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 4: [12] } }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: null,
    })
    expect(result.unaffected).toBeNull()
  })

  it('剧情树命中（覆盖全书）⇒ unaffected 为 null，不许报「某些章没事」', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3 }),
      changes: changesOf({ [OUTLINE]: { 4: [3, 12] } }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      plotTreeSourceRef: { [OUTLINE]: 3 },
    })
    expect(result.unaffected).toBeNull()
  })
})

describe('computeInvalidationPlan · behind 只给数据不给文案', () => {
  it('⑬ behind 里是结构化数据（key / have / need / changed），文案留给 UI 的 describeDrift', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 6 }],
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 2 }),
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3, [WORLD]: 2 } }],
      plotTreeSourceRef: null,
    })
    const item = result.groups[0].items[0]
    // 本次 override 只动 outline ⇒ 世界观不进 behind。
    // S4b 之后 `changed` 也是**结构化数据**（版本号 + 章号），不是文案；
    // 这里用 toMatchObject 而不是 toEqual，是因为「有没有章集证据」取决于输入里
    // 有没有 changes 日志 —— 本用例没给，所以 changed 为 undefined。
    expect(item.behind).toMatchObject([{ key: OUTLINE, have: 3, need: 6 }])
    expect(item.behind[0].changed).toBeUndefined()
    // 文案由 UI 层渲染，且现在必须带版本区间（S4b）。
    expect(describeDrift(item.behind)).toBe('情节大纲 第3版→第6版')
    expect(item.label).toBe('第 12 章')
  })
})
