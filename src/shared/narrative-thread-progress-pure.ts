/**
 * 档 3「已扫 / 剩余」的纯函数。
 *
 * 口径（项目总负责人 2026-11-24 裁，见实施包 §6.2）：
 * - `scanned A` = 计划区间并集与「单元区间」的交集章数（声明覆盖，reject 也算已扫）；
 * - `written W` = 单元区间内**已定稿**章号的去重数；
 * - `remaining B` = max(0, W − A)；
 * - 建议起点 = 并集右端 + 1，建议章数 = min(3, W − 右端)。
 *
 * **绝不读 `maxChapters`**：它是名义上界（`generation-owner-contract.ts:69`、
 * `plot-outline-contract.ts:135-137`），用它推导 B 会让历史章在改上界时集体误报。
 * 单元区间右端一律取「单元内已定稿的最大章号」，取不到就整条建议条不渲染。
 */

export interface NarrativeThreadPlanRangeSource {
  readonly targetStartChapter: number
  readonly targetEndChapter: number
}

export interface NarrativeThreadProgressUnit {
  readonly from: number
  /** 名义上界：仅为可赋值自 `ArchitectureUnitRange`；本模块刻意不读。 */
  readonly maxChapters?: number
}

export interface NarrativeThreadProgressSuggestion {
  start: number
  count: number
}

export interface NarrativeThreadProgress {
  scanned: number
  written: number
  /** 单元不可知（`unit === null` 或单元内无已定稿章）时为 `null`，绝不写 0 冒充。 */
  remaining: number | null
  suggestion: NarrativeThreadProgressSuggestion | null
}

/** 一组区间的章号并集大小（去重计数）。 */
export function chapterUnionCount(
  ranges: readonly { readonly from: number; readonly to: number }[],
): number {
  const covered = new Set<number>()
  for (const range of ranges) {
    for (let chapter = range.from; chapter <= range.to; chapter += 1) covered.add(chapter)
  }
  return covered.size
}

/** 计划区间并集在「单元左界及以上」的章号（升序去重）。单元未知时为空。 */
export function coveredChapterUnion(
  plans: readonly NarrativeThreadPlanRangeSource[],
  unit: NarrativeThreadProgressUnit | null,
): number[] {
  if (!unit) return []
  const covered = new Set<number>()
  for (const plan of plans) {
    const start = Math.max(plan.targetStartChapter, unit.from)
    for (let chapter = start; chapter <= plan.targetEndChapter; chapter += 1) covered.add(chapter)
  }
  return [...covered].sort((left, right) => left - right)
}

/**
 * 已定稿草稿 → 去重章号（升序）。
 *
 * `DraftStatus` 有五档 `draft | revised | reviewed | finalized | archived`
 * （`src/shared/draft-status.ts:7`）；`reviewed`（已审稿）**不是定稿**，
 * 从原表直接数会把 `written` 撑大、「剩余 M 章」算小。这里只认 `finalized`。
 */
export function finalizedChapterNumbers(
  drafts: readonly { readonly chapterNumber: number; readonly status: string }[],
): number[] {
  return [...new Set(
    drafts
      .filter(draft => draft.status === 'finalized' && Number.isSafeInteger(draft.chapterNumber))
      .map(draft => draft.chapterNumber),
  )].sort((left, right) => left - right)
}

export function narrativeThreadProgress(
  plans: readonly NarrativeThreadPlanRangeSource[],
  unit: NarrativeThreadProgressUnit | null,
  writtenChapters: readonly number[],
): NarrativeThreadProgress {
  if (!unit) return { scanned: 0, written: 0, remaining: null, suggestion: null }
  const inUnit = [...new Set(writtenChapters.filter(chapter => Number.isSafeInteger(chapter) && chapter >= unit.from))]
    .sort((left, right) => left - right)
  if (inUnit.length === 0) return { scanned: 0, written: 0, remaining: null, suggestion: null }

  const unitRight = inUnit[inUnit.length - 1]
  const covered = coveredChapterUnion(plans, unit).filter(chapter => chapter <= unitRight)
  const written = inUnit.length
  const scanned = covered.length
  const remaining = Math.max(0, written - scanned)
  const unionRight = covered.length > 0 ? covered[covered.length - 1] : null
  const suggestion = unionRight === null
    ? null
    : {
        start: unionRight + 1,
        count: Math.min(3, Math.max(0, written - unionRight)),
      }
  return { scanned, written, remaining, suggestion }
}
