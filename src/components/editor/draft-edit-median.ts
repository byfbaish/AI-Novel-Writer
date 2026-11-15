/**
 * 「近 10 章动作数中位数」的唯一口径入口（P48；P51 改为连续章号口径）。
 *
 * 动作数沿用 P38 已落口径：某章 `draft_edit_stats` 里 `origin = 'human'` 且
 * `changed_chars > 0` 的行数。AI 行与空保存都不算作者动作。
 *
 * 取哪 10 章（P51 口径）：以**当前章**为终点，向前数**连续 10 个章号**（含当前章）。
 * 章的边界不再由计量行界定 —— 一行都没有的章是「本窗口内的零动作章」，动作数记 0
 * 并照常进样本。旧口径（从「有计量行」的章里取最近 10 个）会把零动作章整章跳过，
 * 于是中位数系统性偏高、不同书的断档情况不可比（B10）。零动作章是真实数据，不是缺失；
 * 只有「连续章号数不到 10 个」才叫样本不足。
 *
 * 主进程只回原始行，筛选 / 计数 / 取窗 / 中位数全在这里算（P37 判例：
 * 主进程不做业务口径）。
 */

/** 纯函数入参：与主进程载荷解耦的驼峰形状。 */
export interface DraftEditActionRow {
  chapterNumber: number
  origin: string
  changedChars: number
}

export interface DraftEditMedianSummary {
  /** 窗口内各章动作数的中位数；样本不足 10 章时为 null，绝不按 N 章硬算。 */
  median: number | null
  /** 窗口内实际纳入的章数（≤ windowSize），用于「样本不足（N/10 章）」文案。 */
  sampleChapters: number
}

/** 标准中位数：奇数取正中间，偶数取中间两个的平均。输入需已升序。 */
function medianOfAscending(values: readonly number[]): number {
  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 1
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2
}

/** 章号必须是正整数：0 与负数不是章，参与不了「向前连续编号」。 */
function isChapterNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * 窗口终点（当前章）：显式传入的当前章优先；未传（或非法）时退到计量行里最大的章号。
 * 退路只用于「调用方拿不到章号」的老场景，生产调用一律显式传当前章。
 */
function resolveCurrentChapter(
  currentChapterNumber: number | undefined,
  newestMeasuredChapter: number,
): number {
  return isChapterNumber(currentChapterNumber) ? currentChapterNumber : newestMeasuredChapter
}

/**
 * 近 N 章作者动作数中位数。
 *
 * `windowSize` 默认 10；抽成参数只为让「9 个数取第 5 个」这半条口径可被直接测试，
 * 生产调用一律不传。`currentChapterNumber` 是窗口终点（当前章），不传时按计量行里的
 * 最大章号推。
 */
export function medianActionsLast10(
  rows: readonly DraftEditActionRow[],
  windowSize = 10,
  currentChapterNumber?: number,
): DraftEditMedianSummary {
  const humanActionsByChapter = new Map<number, number>()
  let newestMeasuredChapter = 0

  for (const row of rows) {
    if (!isChapterNumber(row.chapterNumber)) continue
    if (row.chapterNumber > newestMeasuredChapter) {
      newestMeasuredChapter = row.chapterNumber
    }
    if (row.origin !== 'human' || !(row.changedChars > 0)) continue
    humanActionsByChapter.set(
      row.chapterNumber,
      (humanActionsByChapter.get(row.chapterNumber) ?? 0) + 1,
    )
  }

  const window = Number.isSafeInteger(windowSize) && windowSize > 0 ? windowSize : 0
  const currentChapter = resolveCurrentChapter(currentChapterNumber, newestMeasuredChapter)
  if (window === 0 || !isChapterNumber(currentChapter)) {
    return { median: null, sampleChapters: 0 }
  }

  // 章号从第 1 章起编号，所以「向前连续 window 个章号」至多能数到第 1 章。
  const firstChapter = Math.max(1, currentChapter - window + 1)
  const sampleChapters = currentChapter - firstChapter + 1
  if (sampleChapters < window) {
    return { median: null, sampleChapters }
  }

  // 窗口内逐章取数：没有计量行（或只有 AI 行）的章动作数都是 0，照样进样本。
  const counts: number[] = []
  for (let chapter = firstChapter; chapter <= currentChapter; chapter += 1) {
    counts.push(humanActionsByChapter.get(chapter) ?? 0)
  }
  counts.sort((left, right) => left - right)

  return { median: Math.round(medianOfAscending(counts)), sampleChapters }
}
