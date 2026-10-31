import {
  BOOK_SCOPE,
  derivedStatusForChapters,
  upstreamRefKey,
  type DerivedDrift,
  type DerivedSourceRef,
  type ParsedChangedChapters,
  type UpstreamDomain,
  type UpstreamRefKey,
  type UpstreamRevisionSnapshot,
} from './upstream-revisions'

/**
 * 期 3a：失效清单的组装（P2-3，2026-10-31）。
 *
 * ## 它解决什么
 *
 * 期 1/2 让读取侧**能判**「这一行旧了」，但拒绝只在真正读那一刻发生：作者点了
 * 「重建大纲」，要等写完之后才会发现下游有 N 张蓝图要重算。这里要的是同一件事
 * 发生在**点之前** —— 先报出一张可数清单，作者决定还动不动手。
 *
 * ## 为什么是纯函数
 *
 * 它要把「如果上游再改一版」这个**假想**拿来算，而这个假想绝不能落库：
 * 「plan 阶段绝不 bump」是红线（主稿 §8.1）—— 一旦 plan 自己改了
 * 版本表，取消就不是取消，取消之后所有派生真的都旧了。纯函数 + 入参显式给
 * `overrides`，写库这条路在类型上就不通。
 *
 * ## 三组之外为什么还有 `unseen`
 *
 * 存量派生没有 `source_ref`，既不能判 valid 也不能判 stale。它既不是「要处置的
 * 3 项」，也不是「安全的」—— 分成两个计数各自如实报，才不会让作者把「不知道」
 * 读成「没问题」（主稿 §9.2 的 blast radius 纪律）。
 *
 * 设计稿：[`docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md`](../../docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md)
 */

export type InvalidationGroupKind = 'outline' | 'blueprint' | 'handoff' | 'plot-tree'

/**
 * 「假想这个域再改一版」的请求值。
 *
 * UI 手边没有当前版本号（没有读版本表的 IPC），而它要问的正是「再改一版会怎样」。
 * 借 `0` 这个不是合法版本号的值来表达，是为了不动施工图钉死的 `rev: number` 签名 ——
 * 增字段或增 channel 都得先改设计。**这是施工期补的口径，待作者裁定**（登记在 §六）。
 */
export const HYPOTHETICAL_NEXT_REV = 0

/**
 * 提醒强度。**只由后端给**（主稿 §8.3），UI 不许自己重算：
 * 强度背后是「后果能不能撤销」这种业务判断，放到渲染层等于把它做成样式选择。
 */
export type InvalidationTier = 'silent' | 'once' | 'strong'

export interface InvalidationItem {
  /** 给作者看的标签：蓝图 = 「第 12 章」；交接单 = 「第 1 卷第 20 章交接单」；剧情树 = 「剧情树」。 */
  label: string
  /** 该项覆盖的章号；剧情树给 `null`（全书）。 */
  chapters: readonly number[] | null
  /** 落后在哪几个域。**文案归 UI**（`describeDrift` 渲染），这里只给数据。 */
  behind: readonly DerivedDrift[]
}

export interface InvalidationGroup {
  kind: InvalidationGroupKind
  /** 恒等于 `items.length`；单独留字段是给 UI 做「N」时不必再取值。 */
  count: number
  items: readonly InvalidationItem[]
}

export interface InvalidationPlan {
  /** 只放 `count > 0` 的组；UI 不渲染「章节蓝图（0）」。 */
  groups: readonly InvalidationGroup[]
  /**
   * 没有 `source_ref`、无法判定的存量派生。**不进 `groups`**（主稿 §十·1 第 2 条）。
   *
   * `count === 0` 时也要给这个字段 —— UI 靠它显示「没有无法判断的项」，
   * 缺字段会被读成「我没查」。
   */
  unseen: { count: number; kinds: readonly InvalidationGroupKind[] }
  tier: InvalidationTier
  /**
   * 受影响章集合之间的**最大空隙**（= 这段确实没被波及）；给不出就 `null`。
   *
   * 口径（本模块自定，施工图未钉死算法，取最保守的一种）：
   * - 命中项里有任何一项覆盖「全部章」（剧情树 / 交接单边界非 `actual` ⇒ `chapters`
   *   为空数组）⇒ 没有不受影响的章 ⇒ `null`；
   * - 其余情况取受影响章的最小–最大区间，在**区间内部**找最长的连续空隙；
   *   一次都没命中时没有「受影响」可言 ⇒ `null`。
   *
   * **为什么只报区间内部、不报两端**：本函数的入参里没有「全书最后一章」，
   * 说不清第 1 章之前和第 N 章之后有多少章。给两端的值只能猜。
   */
  unaffected: { from: number; to: number } | null
}

/**
 * 组的固定顺序。UI 顺序必须稳定，否则同一份数据两次渲染会跳行；
 * 下面 `tierFor` 之外的遍历都走这里，新增类型时改这一个对象即可。
 *
 * `outline` 排第一不是排版偏好：它就是**中间那一环**（P2-3 期 3b），比它下游的
 * 蓝图/交接单更上游。做成硬拦之前，作者看到的顺序应当与级联发生的顺序一致。
 */
const GROUP_ORDER: readonly InvalidationGroupKind[] = ['outline', 'blueprint', 'handoff', 'plot-tree']

/**
 * 假想快照：在真实版本表上叠加 `overrides`。
 *
 * **这是仓储层 `snapshotWithOverride`（`electron/repositories/upstream-revision-repository.ts:264`）
 * 的等价实现**。`src/shared/**` 不能 import electron，所以这里必须再写一份，而
 * 两份的语义必须逐字一致 —— 不一样的表现是「plan 报的和真做的时候发生的不一样」，
 * 那正是本期存在的理由被否定了。
 *
 * 唯一的一条特殊语义：**键不存在于表中时，覆盖被忽略。** plan 问的是「这域再
 * 改一版会怎样」，不是「凭空造一个域」；给不存在的键一个假 rev 会让每一行的
 * `have !== need` 都成立，报出「全军覆没」的假警报。
 *
 * 所以这里**不要顺手加防御**（校验 rev 是否整数、是否单调）：加了就等于这一份
 * 比仓储层那一份更严，两边行为从此不同，而这种不同在真正的「键存在」路径上
 * 永远不会被测出来。
 */
function overlayOverrides(
  revisions: UpstreamRevisionSnapshot,
  overrides: ReadonlyArray<{ domain: UpstreamDomain; scope?: string; rev: number }>,
): ReadonlyMap<UpstreamRefKey, number> {
  const map = new Map<UpstreamRefKey, number>(revisions)
  for (const override of overrides) {
    const key = upstreamRefKey(override.domain, override.scope ?? BOOK_SCOPE)
    if (!map.has(key)) continue
    map.set(key, override.rev)
  }
  return map
}

interface Candidate {
  kind: InvalidationGroupKind
  label: string
  chapters: readonly number[] | null
  sourceRef: DerivedSourceRef | null
}

/**
 * `chapters` 为空数组时按「覆盖全部章」处理：这与 `derivedStatusForChapters`
 * 的空集约定同向，写在这里是因为 `unaffected` 的口径要靠它判断“能不能收敛到章”。
 */
function coversWholeBook(chapters: readonly number[] | null): boolean {
  return !chapters || chapters.length === 0
}

/**
 * 受影响章集合内部的最大空隙。多个空隙取最长的一个（作者对「哪一整段没事」
 * 的印象比「一共几个洞」有用）；空隙不存在返回 `null`。
 */
function widestUnaffectedGap(hitChapters: readonly number[]): { from: number; to: number } | null {
  const sorted = [...new Set(hitChapters)].filter((chapter) => Number.isSafeInteger(chapter)).sort((left, right) => left - right)
  if (sorted.length < 2) return null
  const from = sorted[0]
  const to = sorted[sorted.length - 1]
  const affected = new Set(sorted)
  let best: { from: number; to: number } | null = null
  let runStart: number | null = null
  for (let chapter = from + 1; chapter < to; chapter += 1) {
    if (affected.has(chapter)) {
      if (runStart !== null) {
        const width = chapter - runStart
        if (!best || width > best.to - best.from) best = { from: runStart, to: chapter - 1 }
        runStart = null
      }
      continue
    }
    if (runStart === null) runStart = chapter
  }
  if (runStart !== null) {
    const width = to - runStart
    if (!best || width > best.to - best.from) best = { from: runStart, to: to - 1 }
  }
  return best
}

/**
 * 期 3a 的组装入口。纯函数：不读库、不看时间、不写任何东西。
 *
 * `changes` 必须是**解析后**的章集（`parseChangedChapters` 的结果），不是原始 JSON 串 ——
 * 解析属于仓储层，进到这里再解析等于把两代格式的兼容逻辑复制第二份。
 *
 * 交接单的 `chapters` **由调用方算**（用 `volumeHandoffChapters()`）：那条函数有四个
 * 例外档（边界非 `actual` ⇒ `[]` = 覆盖全部章），在这里重写一遍必错。
 */
export function computeInvalidationPlan(input: {
  overrides: ReadonlyArray<{ domain: UpstreamDomain; scope?: string; rev: number }>
  revisions: UpstreamRevisionSnapshot
  changes: ReadonlyMap<UpstreamRefKey, ParsedChangedChapters>
  blueprints: ReadonlyArray<{ chapterNumber: number; sourceRef: DerivedSourceRef | null }>
  handoffs: ReadonlyArray<{ label: string; chapters: readonly number[]; sourceRef: DerivedSourceRef | null }>
  plotTreeSourceRef: DerivedSourceRef | null
  /**
   * 大纲自己的来源（M26）。**必填**：漏传会让「世界改了 ⇒ 大纲旧了」这一环
   * 静默消失，而那正是本期存在的理由。`null` = 有大纲但没记过来源 ⇒ `legacy` ⇒ 进 `unseen`。
   */
  synopsisSourceRef: DerivedSourceRef | null
  /**
   * 这本书到底有没有大纲文本。
   *
   * **「没有大纲」不是「不知道大纲」**：两者都表现为 `synopsisSourceRef === null`，
   * 但前者不该报「有一项判断不了」——新建项目第一次生成大纲时，弹一张
   * 「1 项无法判断」的清单等于在作者最该点确认的那一刻制造噪声，而
   * §8.3 的教训正是「无事可报还弹窗，第三次就成了盲点确定」。
   * 所以这里要一个显式的存在性信号，而不是靠 `null` 一词双义。
   */
  hasSynopsis: boolean
}): InvalidationPlan {
  const hypothetical = overlayOverrides(input.revisions, input.overrides)

  const candidates: Candidate[] = []

  // 大纲 = 中间那一环（P2-3 期 3b）。它依赖 worldbuilding + arc，不依赖自己。
  //
  // **没有大纲就不进候选**：没有的东西谈不上「旧了」，也不该被算进「判断不了」。
  //
  // `chapters: null` 是**语义正确**而不是偷懒：一段大纲覆盖全书，说得出「整本大纲旧了」
  // 却说不出「哪几章」——`synopsis` 是一整块文本，没有章粒度。硬给一个空数组会走
  // 「覆盖全部章」的分支，效果相同但意义不同；给一个具体区间则是在编造。
  if (input.hasSynopsis) {
    candidates.push({
      kind: 'outline',
      label: '情节大纲',
      chapters: null,
      sourceRef: input.synopsisSourceRef,
    })
  }

  for (const blueprint of input.blueprints) {
    candidates.push({
      kind: 'blueprint',
      label: `第 ${blueprint.chapterNumber} 章`,
      chapters: [blueprint.chapterNumber],
      sourceRef: blueprint.sourceRef,
    })
  }
  for (const handoff of input.handoffs) {
    candidates.push({
      kind: 'handoff',
      label: handoff.label,
      chapters: handoff.chapters,
      sourceRef: handoff.sourceRef,
    })
  }
  // 剧情树全书只有一份，不是一个可枚举的列表，所以它**恒为候选**。
  // ⚠️ 已知边界（登记在设计稿 §六）：`null` 在这里表示「这棵树没有来源记录」⇒ legacy
  // ⇒ 计入 `unseen`。若这本书压根没有剧情树，调用方目前只能用同一个 `null` 表达，
  // 于是会多出一条「无法判断」。方向是**多报**（主稿 §十·1 偏保守），可接受，
  // 但要让 S6c 之后的 UI 能把 kinds 展示出来，别让它变成一个来历不明的数字。
  candidates.push({
    kind: 'plot-tree',
    label: '剧情树',
    chapters: null,
    sourceRef: input.plotTreeSourceRef,
  })

  const staleByKind = new Map<InvalidationGroupKind, InvalidationItem[]>()
  const unseenKinds = new Set<InvalidationGroupKind>()
  let unseenCount = 0
  const hitChapters: number[] = []
  let sawWholeBookHit = false

  for (const candidate of candidates) {
    const verdict = derivedStatusForChapters(
      candidate.sourceRef,
      hypothetical,
      input.changes,
      candidate.chapters,
    )
    if (verdict.state === 'legacy') {
      unseenCount += 1
      unseenKinds.add(candidate.kind)
      continue
    }
    if (verdict.state !== 'stale') continue
    const items = staleByKind.get(candidate.kind) ?? []
    items.push({ label: candidate.label, chapters: candidate.chapters, behind: verdict.behind })
    staleByKind.set(candidate.kind, items)
    if (coversWholeBook(candidate.chapters)) sawWholeBookHit = true
    else if (candidate.chapters) hitChapters.push(...candidate.chapters)
  }

  const groups: InvalidationGroup[] = []
  for (const kind of GROUP_ORDER) {
    const items = staleByKind.get(kind)
    if (!items || items.length === 0) continue
    groups.push({ kind, count: items.length, items })
  }

  return {
    groups,
    unseen: { count: unseenCount, kinds: GROUP_ORDER.filter((kind) => unseenKinds.has(kind)) },
    tier: tierFor(groups, unseenCount),
    unaffected: sawWholeBookHit ? null : widestUnaffectedGap(hitChapters),
  }
}

/**
 * 强度判定。**这张表是唯一判据，不许加权、不许打分**（施工图 §2.1）。
 *
 * - 无事可报 ⇒ `silent`：弹一个空清单等于训练作者盲点确定（主稿 §8.3）；
 * - 含交接单 ⇒ `strong`：交接单会被**拒绝读取**，下一卷开不了工，后果不可逆。
 *
 * ⚠️ 本期没有「已定稿章节」组（`drafts` 没有 `source_ref`，主稿 §1.2 明判「不算」），
 * 所以 `strong` 目前只能由交接单触发。**将来补上定稿组时，这一行的条件要改成
 * 「含定稿章 或 含交接单」—— 这条注释必须跟着改，只改代码不改注释会让下一班
 * 以为现在的行为是设计意图。**
 */
function tierFor(groups: readonly InvalidationGroup[], unseenCount: number): InvalidationTier {
  if (groups.length === 0 && unseenCount === 0) return 'silent'
  const hasHandoff = groups.some((group) => group.kind === 'handoff' && group.count > 0)
  return hasHandoff ? 'strong' : 'once'
}

const TIER_RANK: Readonly<Record<InvalidationTier, number>> = { silent: 0, once: 1, strong: 2 }

/**
 * 多域合并（S6a 之后必须存在）。
 *
 * ## 为什么不能「只问最上游那一域」了
 *
 * 收窄之前三域全记，问哪个域报出来都是同一批行，所以期 3a 只问最上游那个。收窄之后
 * 一张蓝图只记 `outline`：勾了「世界观 + 情节大纲」时，只问世界观会得到「大纲旧了」，
 * 只问大纲会得到「蓝图旧了」——**少问一个就少一半**。
 *
 * ## 合并口径三条
 *
 * 1. **行按 `(kind, label)` 去重，`behind` 取并集**（同一个键保留先出现的证据）。
 *    同一张蓝图可能同时落后于世界观与大纲，那是两条证据，都要摆出来。
 * 2. **`unseen` 取每个 kind 的最大值后再求和**：每个域的清单都扫同一批候选，
 *    同一行会在每份清单里各出现一次 —— 相加会把它数成 N 项（虚增），取最大才如实。
 * 3. **`unaffected` 只要有一份说不清就不报**（任一是 `null`，或两份说法不一致）。
 *    「哪一段没事」说错比不说更糟：作者会据此跳过那几章。
 *
 * `tier` 取最高的一档：任何一个域带来的后果都成立，取低等于替作者降级。
 */
export function mergeInvalidationPlans(plans: readonly InvalidationPlan[]): InvalidationPlan {
  if (plans.length === 0) {
    return { groups: [], unseen: { count: 0, kinds: [] }, tier: 'silent', unaffected: null }
  }
  if (plans.length === 1) return plans[0]

  const byKind = new Map<InvalidationGroupKind, Map<string, InvalidationItem>>()
  for (const plan of plans) {
    for (const group of plan.groups) {
      const items = byKind.get(group.kind) ?? new Map<string, InvalidationItem>()
      for (const item of group.items) {
        const existing = items.get(item.label)
        if (!existing) { items.set(item.label, item); continue }
        const seen = new Set(existing.behind.map((drift) => drift.key))
        const merged = [...existing.behind, ...item.behind.filter((drift) => !seen.has(drift.key))]
        items.set(item.label, { ...existing, behind: merged })
      }
      byKind.set(group.kind, items)
    }
  }

  const groups: InvalidationGroup[] = []
  for (const kind of GROUP_ORDER) {
    const items = byKind.get(kind)
    if (!items || items.size === 0) continue
    const list = [...items.values()]
    groups.push({ kind, count: list.length, items: list })
  }

  let unseenCount = 0
  const unseenKinds = new Set<InvalidationGroupKind>()
  for (const kind of GROUP_ORDER) {
    let best = 0
    for (const plan of plans) {
      if (!plan.unseen.kinds.includes(kind)) continue
      best = Math.max(best, plan.unseen.count)
    }
    if (best > 0) { unseenCount += best; unseenKinds.add(kind) }
  }

  const tiers = plans.map((plan) => plan.tier)
  const tier = tiers.reduce((left, right) => (TIER_RANK[right] > TIER_RANK[left] ? right : left), 'silent' as InvalidationTier)

  const gaps = plans.map((plan) => plan.unaffected)
  const first = gaps[0]
  const agreed = first !== null && gaps.every((gap) => gap !== null && gap.from === first.from && gap.to === first.to)

  return {
    groups,
    unseen: { count: unseenCount, kinds: GROUP_ORDER.filter((kind) => unseenKinds.has(kind)) },
    tier,
    unaffected: agreed ? first : null,
  }
}
