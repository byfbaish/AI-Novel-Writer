import { describe, expect, it } from 'vitest'
import { computeInvalidationPlan,
  mergeInvalidationPlans, type InvalidationGroupKind, type InvalidationPlan } from '../invalidation-plan'
import {
  BOOK_SCOPE,
  describeDrift,
  expandChapterRange,
  upstreamRefKey,
  type ParsedChangedChapters,
  type UpstreamDomain,
  type UpstreamRevisionReason,
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
const ARC = upstreamRefKey('arc', BOOK_SCOPE)

interface PlanInput {
  overrides?: ReadonlyArray<{ domain: UpstreamDomain; scope?: string; rev: number }>
  revisions?: UpstreamRevisionSnapshot
  changes?: ReadonlyMap<string, ParsedChangedChapters>
  blueprints?: ReadonlyArray<{ chapterNumber: number; sourceRef: Record<string, number> | null }>
  handoffs?: ReadonlyArray<{ label: string; chapters: readonly number[]; sourceRef: Record<string, number> | null }>
  plotTreeSourceRef: Record<string, number> | null
  /**
   * 大纲自己的来源（M26 中间环）。**这里给默认 `null` 与 `plotTreeSourceRef` 不同**：
   * 剧情树恒为候选必须逐例显式，而大纲只在「世界观/弧光变了」那一族用例里才有意义；
   * 每条都写一遍只会让那些用例被一串无关字段淹没。生产侧仍是必填（漏传是类型错误）。
   */
  synopsisSourceRef?: Record<string, number> | null
  /** 默认 `false`：老用例测的是别的组，不该被一条「没有大纲」的候选搅动期望值。 */
  hasSynopsis?: boolean
  /**
   * 已定稿章节（S6 / M28）。默认空 —— 老用例的期望值里不该突然多一组「已定稿章节」。
   * 生产侧仍是必填：漏传会让正文这一层从清单里凭空消失，而作者会据此以为「不影响正文」。
   */
  finalizedDrafts?: ReadonlyArray<{ chapterNumber: number; outlineRev: number }>
  reason?: UpstreamRevisionReason
}

function plan(input: PlanInput) {
  return computeInvalidationPlan({
    overrides: input.overrides ?? [],
    revisions: input.revisions ?? snapshotOf({ [OUTLINE]: 3 }),
    changes: input.changes ?? changesOf({}),
    blueprints: input.blueprints ?? [],
    handoffs: input.handoffs ?? [],
    plotTreeSourceRef: input.plotTreeSourceRef,
    synopsisSourceRef: input.synopsisSourceRef ?? null,
    hasSynopsis: input.hasSynopsis ?? false,
    finalizedDrafts: input.finalizedDrafts ?? [],
    ...(input.reason ? { reason: input.reason } : {}),
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

/**
 * 中间环（P2-3 期 3b，M26）：大纲自己也要记「基于哪一版世界观/弧光」。
 *
 * 没有这一环，`S6a` 把蓝图收窄成只记 `outline` 之后，「世界改了」就在整条链路上
 * 静默了 —— 作者明确要求「补齐中间环，不然链条缺一环」。这一组钉的就是那根环，
 * 以及它的**方向**：级联逐层发生，不跨层直传。
 */
describe('computeInvalidationPlan · 中间环：大纲记 world/arc', () => {
  const SYNOPSIS_REF = { [WORLD]: 1, [ARC]: 1 }

  it('世界观再改一版 ⇒ 报「情节大纲旧了」，蓝图不动（蓝图是大纲的下游）', () => {
    const result = plan({
      overrides: [{ domain: 'worldbuilding', rev: 2 }],
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 1, [ARC]: 1 }),
      // 蓝图只记 outline（S6a 之后的新写法）：世界观变动碰不到它们。
      blueprints: [{ chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } }],
      // 剧情树**故意记三域**：它是拿整份架构直接生成的，三个域都是它的直接上游，
      // 不是「跨层直传」。所以这里它照样命中 —— 这条不是 bug，是既定口径。
      plotTreeSourceRef: { [OUTLINE]: 3, [WORLD]: 1, [ARC]: 1 },
      synopsisSourceRef: SYNOPSIS_REF,
      hasSynopsis: true,
    })
    expect(result.groups.map(group => group.kind)).toEqual(['outline', 'plot-tree'])
    const outline = result.groups[0]
    expect(outline.items[0].label).toBe('情节大纲')
    expect(outline.items[0].chapters).toBeNull()
    expect(result.tier).toBe('once')
    // 蓝图一条都没有：世界观的改动在收窄之后不再直接打到蓝图。
    expect(result.groups.some(group => group.kind === 'blueprint')).toBe(false)
    // 大纲覆盖全书 ⇒ 说不出「哪些章没事」。
    expect(result.unaffected).toBeNull()
  })

  it('作者重生成大纲之后：大纲回到 valid，蓝图才 stale —— 逐层级联', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 2, [ARC]: 1 }),
      changes: changesOf({ [OUTLINE]: { 4: [] } }),
      blueprints: [
        { chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } },
        { chapterNumber: 13, sourceRef: { [OUTLINE]: 4 } },
      ],
      plotTreeSourceRef: null,
      // 大纲在「世界观第 2 版」时重生成过 ⇒ 它自己对 world/arc 是新的。
      synopsisSourceRef: { [WORLD]: 2, [ARC]: 1 },
      hasSynopsis: true,
    })
    expect(result.groups.map(group => group.kind)).toEqual(['blueprint'])
    expect(result.groups[0].count).toBe(1)
    expect(result.groups[0].items[0].label).toBe('第 12 章')
  })

  it('弧光再改一版同样只打到大纲（弧光是大纲的上游）', () => {
    const result = plan({
      overrides: [{ domain: 'arc', rev: 2 }],
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 1, [ARC]: 1 }),
      plotTreeSourceRef: null,
      synopsisSourceRef: SYNOPSIS_REF,
      hasSynopsis: true,
    })
    expect(result.groups.map(group => group.kind)).toEqual(['outline'])
    expect(describeDrift(result.groups[0].items[0].behind)).toBe('弧光 第1版→第2版')
  })

  it('有大纲但没记过来源（存量）⇒ 进 unseen，不进 groups', () => {
    const result = plan({
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 1, [ARC]: 1 }),
      plotTreeSourceRef: { [OUTLINE]: 3 },
      synopsisSourceRef: null,
      hasSynopsis: true,
    })
    expect(result.groups).toEqual([])
    expect(result.unseen).toEqual({ count: 1, kinds: ['outline'] })
    // 「不知道」也要让作者看见（主稿 §9.2）：弹一次、不阻断、不给空清单。
    expect(result.tier).toBe('once')
  })

  it('压根没有大纲 ⇒ 不进候选，也不许报「1 项判断不了」', () => {
    const result = plan({
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 1, [ARC]: 1 }),
      plotTreeSourceRef: { [OUTLINE]: 3 },
      synopsisSourceRef: null,
      hasSynopsis: false,
    })
    expect(result.groups).toEqual([])
    expect(result.unseen).toEqual({ count: 0, kinds: [] })
    // 「无事可报」必须是 silent：新建项目第一次生成大纲时弹一张空清单，
    // 第三次就成了盲点确定（主稿 §8.3）。
    expect(result.tier).toBe('silent')
  })
})

/**
 * 多域合并（S6a 之后才需要）：勾了多个上游域时，一份清单只答得了一半。
 *
 * 三条口径见 `mergeInvalidationPlans` 的注释，这里逐条钉住 —— 尤其第 2 条
 * （`unseen` 不许相加）：每个域的清单都扫同一批候选，相加会把同一行数成 N 项，
 * 而「多了几条判断不了」正是最容易被随手写错、又最没人会去核的那类数字。
 */
describe('mergeInvalidationPlans', () => {
  const WORLD_PLAN: InvalidationPlan = {
    groups: [{
      kind: 'outline',
      count: 1,
      items: [{ label: '情节大纲', chapters: null, behind: [{ key: WORLD, have: 1, need: 2 }] }],
    }],
    unseen: { count: 1, kinds: ['plot-tree'] },
    tier: 'once',
    unaffected: null,
    reason: 'unknown',
  }
  const OUTLINE_PLAN: InvalidationPlan = {
    groups: [{
      kind: 'blueprint',
      count: 1,
      items: [{ label: '第 12 章', chapters: [12], behind: [{ key: OUTLINE, have: 3, need: 4 }] }],
    }],
    // 同一个剧情树在每一份清单里都是 legacy —— 它是同一行，不是两行。
    unseen: { count: 1, kinds: ['plot-tree'] },
    tier: 'once',
    unaffected: { from: 4, to: 11 },
    reason: 'unknown',
  }

  it('两份清单的组按 kind 并起来，`unseen` 取最大而不是相加', () => {
    const merged = mergeInvalidationPlans([WORLD_PLAN, OUTLINE_PLAN])
    expect(merged.groups.map(group => group.kind)).toEqual(['outline', 'blueprint'])
    // 两份都报了同一条剧情树 legacy ⇒ 合并后仍是 1，不是 2。
    expect(merged.unseen).toEqual({ count: 1, kinds: ['plot-tree'] })
    // 一份说不清「哪段没事」⇒ 合并后也不许报（说错比不说更糟）。
    expect(merged.unaffected).toBeNull()
  })

  it('同一行落后于两个域 ⇒ 一条（不是两条），证据取并集', () => {
    const worldHit: InvalidationPlan = {
      groups: [{ kind: 'blueprint', count: 1, items: [{ label: '第 12 章', chapters: [12], behind: [{ key: WORLD, have: 1, need: 2 }] }] }],
      unseen: { count: 0, kinds: [] }, tier: 'once', unaffected: null, reason: 'unknown',
    }
    const outlineHit: InvalidationPlan = {
      groups: [{ kind: 'blueprint', count: 1, items: [{ label: '第 12 章', chapters: [12], behind: [{ key: OUTLINE, have: 3, need: 4 }] }] }],
      unseen: { count: 0, kinds: [] }, tier: 'once', unaffected: null, reason: 'unknown',
    }
    const merged = mergeInvalidationPlans([worldHit, outlineHit])
    expect(merged.groups).toHaveLength(1)
    expect(merged.groups[0].count).toBe(1)
    expect(merged.groups[0].items[0].behind.map(drift => drift.key)).toEqual([WORLD, OUTLINE])
  })

  it('tier 取最高一档：任何一个域带来的后果都成立', () => {
    const strong: InvalidationPlan = {
      groups: [{ kind: 'handoff', count: 1, items: [{ label: '第1卷交接单', chapters: [1], behind: [] }] }],
      unseen: { count: 0, kinds: [] }, tier: 'strong', unaffected: null, reason: 'unknown',
    }
    expect(mergeInvalidationPlans([WORLD_PLAN, strong]).tier).toBe('strong')
    expect(mergeInvalidationPlans([WORLD_PLAN, { ...WORLD_PLAN, tier: 'silent' }]).tier).toBe('once')
  })

  it('全 silent ⇒ 合并也是 silent（空清单不许被合并成一条提示）', () => {
    const silent: InvalidationPlan = { groups: [], unseen: { count: 0, kinds: [] }, tier: 'silent', unaffected: null, reason: 'unknown' }
    expect(mergeInvalidationPlans([silent, silent]).tier).toBe('silent')
    expect(mergeInvalidationPlans([]).tier).toBe('silent')
  })
})

/**
 * 已定稿章节（S6 / M28）。
 *
 * ## 这一组存在的理由
 *
 * 前四组都在说「还有什么没算完」；这一组说的是「**已经交出去的东西**可能不成立了」。
 * 所以它有两个别人没有的性质：
 * - 强度恒为 `strong` —— 定稿行可能已经发布，改上游会让「发出去的那一版」与库里的
 *   依据对不上，这一步不该顺手点过去；
 * - 判据**只认大纲一域** —— 世界/弧光的变化要先落到大纲（M26 的中环）才往下传。
 *   记三域的话，作者改一个设定就会看到所有已定稿章节一起变红，而它们一个字都不用改。
 */
describe('已定稿章节组（S6 / M28）', () => {
  const outlineAt = (rev: number) => snapshotOf({ [OUTLINE]: rev })

  it('大纲改过这一章 ⇒ 进 finalized 组，强度直接拉到 strong', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: outlineAt(3),
      changes: changesOf({ [OUTLINE]: { 4: [8] } }),
      // 剧情树与大纲同版 ⇒ 它不 stale，别让它混进来干扰断言。
      plotTreeSourceRef: { [OUTLINE]: 4 },
      finalizedDrafts: [{ chapterNumber: 8, outlineRev: 3 }],
    })
    expect(labelsOf(result, 'finalized')).toEqual(['第 8 章'])
    expect(result.tier).toBe('strong')
    // 只有这一组时也不许降级：strong 的判据是「后果不可撤销」，不是「影响面大」。
    expect(result.groups.map(group => group.kind)).toEqual(['finalized'])
  })

  it('改的是别的章 ⇒ 这一章定稿正文不报（按章收窄在正文层同样成立）', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: outlineAt(3),
      changes: changesOf({ [OUTLINE]: { 4: [12] } }),
      plotTreeSourceRef: { [OUTLINE]: 4 },
      finalizedDrafts: [{ chapterNumber: 8, outlineRev: 3 }],
    })
    expect(labelsOf(result, 'finalized')).toEqual([])
    // 而且它不该跑到 unseen 里：判断得了、结论是「没事」。
    expect(result.unseen.kinds).not.toContain('finalized')
  })

  it('没记过大纲版本 ⇒ 进 unseen，不进组（不猜成「没事」也不猜成「旧了」）', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: outlineAt(3),
      changes: changesOf({ [OUTLINE]: { 4: [8] } }),
      plotTreeSourceRef: { [OUTLINE]: 4 },
      finalizedDrafts: [{ chapterNumber: 8, outlineRev: -1 }],
    })
    expect(labelsOf(result, 'finalized')).toEqual([])
    expect(result.unseen.kinds).toContain('finalized')
    expect(result.unseen.count).toBe(1)
  })

  it('只改世界观 ⇒ 定稿正文不直接变红 —— 它要等大纲真的重生成（级联逐层，不跨层直传）', () => {
    const result = plan({
      // 假想世界观再改一版；大纲仍停在第 3 版（作者还没点「重建大纲」）。
      overrides: [{ domain: 'worldbuilding', rev: 2 }],
      revisions: snapshotOf({ [OUTLINE]: 3, [WORLD]: 1 }),
      changes: changesOf({}),
      plotTreeSourceRef: null,
      synopsisSourceRef: { [WORLD]: 1, [ARC]: 1 },
      hasSynopsis: true,
      finalizedDrafts: [{ chapterNumber: 8, outlineRev: 3 }],
    })
    // 大纲被判旧了（中间环），但正文还停在「依据第 3 版」—— 而第 3 版确实还是当前版。
    expect(labelsOf(result, 'outline')).toEqual(['情节大纲'])
    expect(labelsOf(result, 'finalized')).toEqual([])
  })

  it('整本重生成大纲（coversAll）⇒ 所有定稿章一起报，不是「一章没改」', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: outlineAt(3),
      // replace 语义：流水里记 `coversAll`，合并后落成空章集（判定的既有约定）。
      changes: changesOf({ [OUTLINE]: { 4: [] } }),
      plotTreeSourceRef: { [OUTLINE]: 4 },
      finalizedDrafts: [
        { chapterNumber: 8, outlineRev: 3 },
        { chapterNumber: 9, outlineRev: 3 },
      ],
    })
    expect(labelsOf(result, 'finalized')).toEqual(['第 8 章', '第 9 章'])
    expect(result.groups.find(group => group.kind === 'finalized')!.count).toBe(2)
  })

  it('正文层也参与「不受影响的章」的计算 —— 否则作者会照着旧空隙跳过该复查的章', () => {
    const result = plan({
      overrides: [{ domain: 'outline', rev: 4 }],
      revisions: outlineAt(3),
      changes: changesOf({ [OUTLINE]: { 4: [3, 12] } }),
      blueprints: [
        { chapterNumber: 3, sourceRef: { [OUTLINE]: 3 } },
        { chapterNumber: 12, sourceRef: { [OUTLINE]: 3 } },
      ],
      plotTreeSourceRef: { [OUTLINE]: 4 },
      // 第 14 章定稿正文也在同一版里被改到 —— 受影响区间从 3–12 变成 3–14，
      // 原来的「第 13 章没事」不再成立。
      finalizedDrafts: [{ chapterNumber: 14, outlineRev: 3 }],
    })
    expect(result.unaffected).toEqual({ from: 4, to: 11 })
  })
})

/**
 * `reason` 回显（S6，方案 A）：只影响文案，**不影响任何判定**。
 *
 * 这里钉住的正是那个边界：同一次假想改版，`reason` 换成 `rollback` 之后
 * 分组、强度、`unseen`、`unaffected` 都必须一模一样 —— 一变就说明判定读了它，
 * 而「回滚」与「重生成」在数据上本来就该得到同一张清单。
 */
describe('plan.reason 只是回显（S6）', () => {
  const input = {
    overrides: [{ domain: 'outline' as const, rev: 4 }],
    revisions: snapshotOf({ [OUTLINE]: 3 }),
    changes: changesOf({ [OUTLINE]: { 4: [8] } }),
    plotTreeSourceRef: { [OUTLINE]: 5 },
    finalizedDrafts: [{ chapterNumber: 8, outlineRev: 3 }],
  }

  it('不传 ⇒ unknown；传了就原样带回来', () => {
    expect(plan(input).reason).toBe('unknown')
    expect(plan({ ...input, reason: 'rollback' }).reason).toBe('rollback')
  })

  it('换 reason 不改任何一个判定字段', () => {
    const base = plan(input)
    const rolledBack = plan({ ...input, reason: 'rollback' })
    expect(rolledBack.groups).toEqual(base.groups)
    expect(rolledBack.tier).toBe(base.tier)
    expect(rolledBack.unseen).toEqual(base.unseen)
    expect(rolledBack.unaffected).toEqual(base.unaffected)
  })

  it('合并多份清单：空清单的 unknown 不许盖掉另一份明确的 rollback', () => {
    const silent: InvalidationPlan = {
      groups: [], unseen: { count: 0, kinds: [] }, tier: 'silent', unaffected: null, reason: 'unknown',
    }
    const rolledBack = plan({ ...input, reason: 'rollback' })
    expect(mergeInvalidationPlans([silent, rolledBack]).reason).toBe('rollback')
    expect(mergeInvalidationPlans([]).reason).toBe('unknown')
  })
})
