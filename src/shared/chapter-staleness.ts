/**
 * 章节「前提已变」判定（P0-1，2026-10-23）。
 *
 * ## 它判断的是什么
 *
 * 一章定稿后，它的**派生**（章节要点、连续性事实、角色状态）是那一刻算出来的；
 * 而「那一刻」就是 `continuity_projection_meta.generation` 的值。
 * 之后只要有**任何一章被退回或改过**，generation 就会 +1，于是这些派生相对新世界就"旧了" ——
 * 本章正文与它的派生可能仍成立，但**系统不能假装自己知道**。
 *
 * 这不是"账本"，是**可判定的时间戳比较**：快照生成时的世代 vs 当前世代。
 *
 * ## 为什么需要"该章之前的最新变更代"，而不是全局计数
 *
 * 影响是**单向**的：第 k 章变化只影响 k 之后。用单一全局计数器会得出
 * "改第 22 章 ⇒ 第 21 章也过期"的错误结论 —— 逐章修复时会把已确认的章反复打回。
 * 所以判定用的是 `requiredGeneration`（该章**之前**的章最后一次变化的代），
 * 由 `continuity_change_log` 算出（M13）。
 *
 * ## 为什么不看 `stale_from_chapter`
 *
 * 那是**单调水位**（只会往前走，重新定稿不会让它后退），用来回答"最早从哪一章开始脏"，
 * 不能用来回答"这一章现在可不可信" —— 用它判会把整本书永久判脏。
 * 这里只看三条：有没有快照、快照代够不够新、有没有针对**当前代**的人工确认。
 *
 * ## 为什么要 ack
 *
 * 退第 20 章会让 21..300 章全部"派生过期"，但其中大多数可能完全不受影响。
 * 逐章重跑后处理（每章一次模型调用）成本太高，所以给一个**显式确认**的出口：
 * 「我看过了，这一章不用改」—— 必须写理由，且**下次任何一章再退回，generation 变，
 * 这条确认自动失效**。确认是"针对这一代世界"的，不是一次性免责。
 */

export type ChapterStalenessState =
  /** 派生是最新世代生成的，或已针对当前世代人工确认 */
  | 'current'
  /** 派生落后于当前世代，且没有针对当前世代的确认 */
  | 'stale'
  /** 没有派生快照：未定稿，或刚被退回草稿。不参与判定，也不出徽标 */
  | 'not-finalized'

export interface ChapterStalenessInput {
  chapterNumber: number
  /** 该章派生快照的生成世代；`null` = 没有快照 */
  snapshotGeneration: number | null
  /**
   * 该章**之前**的章最后一次变化时的代（`continuity_change_log` 前缀最大）。
   * 0 = 前面从没变过。**不含本章及之后的变更** —— 后文变化不影响前文。
   */
  requiredGeneration: number
  /** 该章做过的确认（每次确认记下当时的代） */
  acknowledgedGenerations: readonly number[]
}

export interface ChapterStaleness {
  state: ChapterStalenessState
  /**
   * 仅用于文案：这一轮脏是从第几章开始的。
   * **不参与判定**（见文件头"为什么不看 stale_from_chapter"）。
   */
  staleFromChapter?: number | null
}

export interface ChapterStalenessProjectMeta {
  /** 仅用于文案：这一轮脏从第几章开始。不参与判定。 */
  staleFromChapter: number | null
}

/**
 * 判定一章的状态。纯函数：不读库、不看时间。
 */
export function chapterStaleness(
  input: ChapterStalenessInput,
  meta: ChapterStalenessProjectMeta,
): ChapterStaleness {
  const { snapshotGeneration, requiredGeneration, acknowledgedGenerations } = input
  if (snapshotGeneration === null || !Number.isSafeInteger(snapshotGeneration)) {
    return { state: 'not-finalized', staleFromChapter: null }
  }
  // 最有力的凭据：要么快照就是在"前文最新变化之后"算的，要么在之后确认过。
  const bestEvidence = Math.max(
    snapshotGeneration,
    ...acknowledgedGenerations.filter(value => Number.isSafeInteger(value)),
  )
  if (bestEvidence >= requiredGeneration) {
    return { state: 'current', staleFromChapter: null }
  }
  return { state: 'stale', staleFromChapter: meta.staleFromChapter }
}

/** 该章是否需要在列表上提示"前提已变"。 */
export function isStaleChapter(result: ChapterStaleness): boolean {
  return result.state === 'stale'
}
