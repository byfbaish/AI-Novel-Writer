/**
 * 大纲领先正文的**发射前闸门**（P1-2 期 1，2026-10-25）。
 *
 * ## 为什么要有这道闸
 *
 * 正文受约束于大纲，但**大纲并不受约束于正文**：作者可以先把第 2、3 卷大纲铺完，正文还停在
 * 第 1 卷。卷末交接单只由**定稿**产生（`finalize-chapter.command.ts` 的卷末章），所以那时
 * 第 1 卷根本没有快照 —— 新卷大纲只能基于**计划**，不是**实际结局**。作者原话：
 *
 * > 定稿正文影响卷快照，会将影响传导到大纲，微小的差异可能会让模型产出不一样的内容。
 *
 * 而「正文实况 → 大纲层」这条线**从来没接上**：`architecture.command.ts` 完全不消费
 * `volume_handoffs`，全仓只有正文链的写前查阅读它。这道闸不修那条线，只保证**作者知道**。
 *
 * ## 判据必须是二维，只看卷差会漏判
 *
 * | 卷差（大纲 − 正文） | 上一卷正文 | 判定 |
 * |---|---|---|
 * | 0 | 任意 | 正常 |
 * | 1 | 已定稿 | 正常 |
 * | **1** | **未定稿** | **⚠️ 就是本闸**：卷差只有 1，隐患照样存在 |
 * | ≥2 | 任意 | 本闸同样命中（上一卷必然未定稿） |
 *
 * ## 三个返回，与 `volumeHandoffGateOf` 对齐
 *
 * - `null` = **不适用**（不是任何一卷的卷首章 / 卷结构为空 / 上一卷起止未定）⇒ 完全不打扰；
 * - `aligned` = 上一卷已整卷定稿，或作者已确认过；
 * - `ahead` = 大纲跑到了正文前面 ⇒ 调用方弹强提示（可取消）。
 *
 * ## 判据为什么在 2026-11-06 扩成二维（D3）

 * 原来只有一维：上一卷正文定稿到哪。但「正文写完没」与「本批大纲实际拿到什么材料」**不是同一件事**——
 * L3 走「实际」还是「计划」取决于**卷末交接单在不在、能不能用**（`synopsis-projection.ts:504–522`）。
 * 于是有两种降级被判成 `aligned`、界面零提示：
 *
 * | 形态 | 一维判据 | 实际 L3 |
 * |---|---|---|
 * | A 上一卷已整卷定稿，但作者没登记交接单 | aligned | plan |
 * | B 有交接单但 `stale`（上游改过）⇒ 读取侧静默置 null | aligned | plan |
 *
 * A 是默认形态：交接单按 D14 的裁定**仍然手动登记**，作者没打开过那个面板就永远不会有。
 * 所以二维判据的第二维是「上一卷交接单可用性」，见 `PreviousHandoffAvailability`。
 *
 * ## 为什么定稿判据用「权威序列」而不是「最大定稿章号」
 *
 * `maxFinalized >= 上一卷末章` 在**中间有洞**时是错的（第 5 章没定稿、第 6 章定了，仍然放行），
 * 而洞正是「卷没写完」的典型形态。`db:draft-authority-sequence` 自带断章检测，`invalid`
 * 一律按未定稿处理 —— 不把坏账当完成。
 *
 * ## 修法 C（2026-11-09，D21）：判据不再依赖卷表新鲜度
 *
 * 以前卷结构表 `stale` 时读侧整体 `return { gate: null }`，这道闸在**正常状态**下直接闭嘴，
 * 界面零提示。现在改由调用方按当前大纲现算区间、通过 `ranges` 传进来（`liveVolumeRanges`），
 * 本函数只管判。两条纪律：
 *
 * - **区间算法仍然只有一份**（`volumeEffectiveRanges`），`ranges` 只是注入，不是第二份实现；
 * - **过期优先于已确认**：`handoff === 'stale'` 判在 `acknowledged` 之前（见函数内注释）。
 */
import type { AuthoritativeChapterSequence, AuthoritativeChapterSequenceStatus } from './author-manuscript-import'
import { volumeRangeEndingAt, type VolumeDefinition, type VolumeRange } from './volume-structure'

export type OutlineProgressGateState = 'aligned' | 'ahead'

/** 为什么会 `ahead` —— 面板据此说不同的话（四档的「该去做什么」完全不同）。 */
export type OutlineProgressGateReason =
  | 'prose-unfinalized'
  | 'handoff-missing'
  | 'handoff-stale'
  | 'handoff-unusable'

/**
 * 上一卷卷末交接单在**本批大纲**这一步的可用性。
 *
 * - `usable`：有单、没过期、**而且真能渲染出一节内容** ⇒ L3 会用「实际」；
 * - `missing`：没有这一卷的单，或单在但六栏全空；
 * - `stale`：有单但基于的上游已经改过。读取侧**不注入**（旧事实比没有更糟），投影走 plan；
 * - `unusable`：单在、不空、没过期，但按篇幅预算渲染出来是空节（单条超 1500 字等）⇒ 投影仍走 plan。
 *   这一档是 2026-11-06 复核抓出来的：只判「六栏空不空」会漏掉预算路径，正是 D3 原缺陷换个原因复发；
 * - `unknown`：判断不出（读失败 / 老库）。**fail-open：不因这一维打扰**，与一维时行为一致。
 */
export type PreviousHandoffAvailability =
  | 'usable'
  | 'missing'
  | 'stale'
  | 'unusable'
  | 'unknown'

export interface OutlineProgressGate {
  state: OutlineProgressGateState
  /** `aligned` 时为 `null`；`ahead` 时说明是哪一维没过。 */
  reason: OutlineProgressGateReason | null
  /** 刚结束的那一卷（其有效末章 = 本批起始章 − 1）。 */
  range: VolumeRange
  /** 正文实况来源；`invalid` 表示章号账本有洞，按未定稿处理。 */
  authorityStatus: AuthoritativeChapterSequenceStatus
  /** 正文定稿到第几章（`invalid` 时也照实给出，供面板说明）。 */
  draftLastChapter: number
  /** 还差几章才算整卷定稿。 */
  missingChapters: number
  /** 第二维的事实；`reason` 为交接单两档时，面板只讲这一维，不再讲「还差几章」。 */
  handoff: PreviousHandoffAvailability
  /**
   * 卷结构表比大纲旧（`db:volumes-list` 的 `state === 'stale'`）。
   *
   * **只影响面板附注，不影响判据**（修法 C，D21）：判据早就按当前大纲现算了，这一位是让作者
   * 知道「表旧、但已经按新大纲判过」，免得把「提示说上一卷没写完」当成表没重建的错。
   */
  structureStale: boolean
  /**
   * 本次判定用的卷边界来自哪里：
   * - `live` = 按 `project_core` 的当前大纲现算（`liveVolumeRanges`）；
   * - `table` = 现算不可用（读失败 / 物化失败 / 对不上），退回表边界 —— **可能过期**。
   *
   * 两种都必须如实告知作者：说「已按当前大纲」而实际用了旧表，就是 D21 那类静默撒谎。
   */
  boundarySource: 'live' | 'table'
}

/** 豁免表里的稳定键：一卷一条。撤销即「重新开始提醒」。 */
export function outlineProgressAckKey(volumeId: string): string {
  return `outline-progress:${volumeId}`
}

/**
 * 从第 `chapterNumber` 章开始规划大纲时，本批能不能拿到「上一卷实际写成了什么样」。
 *
 * 返回 `null` = **不适用**（这一章不是任何一卷的第一章）。判定「上一卷」用的是
 * `volumeRangeEndingAt(volumes, chapterNumber - 1)` —— 与定稿链的卷末章触发、开写闸门
 * 是同一个函数，三处不会各说各话。
 *
 * 两维依次判：**正文定稿**（拿不到实际结局）→ **交接单**（拿到了也不会被注入）。
 * 第一维不过就不再看第二维：正文都没写完时，讲交接单是废话。
 */
export function outlineProgressGateOf(input: {
  volumes: readonly VolumeDefinition[]
  authority: Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>
  /** 已确认的稳定键（`outlineProgressAckKey` 的产物）。 */
  acknowledged: readonly string[]
  chapterNumber: number
  /** 第二维。省略 = `unknown`（fail-open，等价于 2026-11-06 之前的一维行为）。 */
  handoff?: PreviousHandoffAvailability
  /**
   * 判定用的区间（修法 C）：调用方按当前大纲现算后传进来。
   * 省略 ⇒ 走 `volumeRangeEndingAt(input.volumes)` —— **区间算法只有一份**，这里不另算。
   */
  ranges?: readonly VolumeRange[]
  /** 卷结构表是否比大纲旧。省略 = `false`（老调用方 / 判据不关心）。 */
  structureStale?: boolean
  /** 区间来源；省略时按「传了 `ranges` 就是现算」推断。 */
  boundarySource?: 'live' | 'table'
}): OutlineProgressGate | null {
  if (!Number.isSafeInteger(input.chapterNumber) || input.chapterNumber < 2) return null
  const target = input.chapterNumber - 1
  const range = input.ranges
    ? input.ranges.find(candidate => candidate.last === target) ?? null
    : volumeRangeEndingAt(input.volumes, target)
  // 上一卷末章未定（`planned_*` 与 `actual_*` 都是 NULL）⇒ 没有可比对的边界，不猜。
  if (!range || range.last === null) return null
  const draftLastChapter = Number.isSafeInteger(input.authority.lastChapterNumber)
    ? Math.max(0, input.authority.lastChapterNumber)
    : 0
  const missingChapters = Math.max(0, range.last - draftLastChapter)
  const handoff = input.handoff ?? 'unknown'
  const base = {
    range,
    authorityStatus: input.authority.status,
    draftLastChapter,
    missingChapters,
    handoff,
    structureStale: input.structureStale ?? false,
    boundarySource: input.boundarySource ?? (input.ranges ? 'live' as const : 'table' as const),
  }
  // 两维依次判：正文都没写完时，讲交接单是废话（第一维不过就不看第二维）。
  // 这一维里「确认」仍然有效 —— 作者确认的是「我知道正文没写完，先铺大纲」，与单有没有过期无关。
  const proseAligned = input.authority.status !== 'invalid' && draftLastChapter >= range.last
  const acknowledged = input.acknowledged.includes(outlineProgressAckKey(range.volumeId))
  if (!proseAligned) {
    return acknowledged
      ? { ...base, state: 'aligned', reason: null }
      : { ...base, state: 'ahead', reason: 'prose-unfinalized' }
  }
  // 过期优先（2026-11-09 修法 C，D21）：交接单 `stale` 是对**某一版上游**的确认，上游改了以后
  // 那次确认描述的现实已经不在 —— 它不能继续被「确认一次永久放行」压住。与
  // `volume-handoff-gate.ts` 的既有纪律一致（那里本来就是这个顺序）。
  //
  // 只把 `stale` 提到确认之前：`missing` / `unusable` 不是「现实变了」，而是「材料一直缺」，
  // 确认它们仍然是作者的真实意图（先铺大纲、后面再补单），提上去会让每次卷首都弹。
  if (handoff === 'stale') return { ...base, state: 'ahead', reason: 'handoff-stale' }
  // 作者已点头 ⇒ 不再问（哪怕正文没写完：那是他自己选的「先铺大纲」）。
  if (acknowledged) {
    return { ...base, state: 'aligned', reason: null }
  }
  // 正文写完了，但这一卷的交接单不可用 ⇒ L3 仍走 plan，只不过原因换了一个。
  if (handoff === 'missing') return { ...base, state: 'ahead', reason: 'handoff-missing' }
  if (handoff === 'unusable') return { ...base, state: 'ahead', reason: 'handoff-unusable' }
  return { ...base, state: 'aligned', reason: null }
}
