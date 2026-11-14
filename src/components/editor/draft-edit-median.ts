/**
 * 「近 10 章动作数中位数」的唯一口径入口（P48）。
 *
 * 动作数沿用 P38 已落口径：某章 `draft_edit_stats` 里 `origin = 'human'` 且
 * `changed_chars > 0` 的行数。AI 行与空保存都不算作者动作。
 *
 * 取哪 10 章：同一项目内按 `chapter_number` 降序取最近 10 章（含当前章），
 * 不按时间戳、不取全书。章的存在性由计量行本身界定 —— 一行都没有的章不是样本
 * （否则「全 ai 章」与「从没保存过的章」会被混为一谈）。
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

/**
 * 近 N 章作者动作数中位数。
 *
 * `windowSize` 默认 10；抽成参数只为让「9 个数取第 5 个」这半条口径可被直接测试，
 * 生产调用一律不传。
 */
export function medianActionsLast10(
  rows: readonly DraftEditActionRow[],
  windowSize = 10,
): DraftEditMedianSummary {
  const humanActionsByChapter = new Map<number, number>()
  const chapters = new Set<number>()

  for (const row of rows) {
    if (!Number.isSafeInteger(row.chapterNumber)) continue
    chapters.add(row.chapterNumber)
    if (row.origin !== 'human' || !(row.changedChars > 0)) continue
    humanActionsByChapter.set(
      row.chapterNumber,
      (humanActionsByChapter.get(row.chapterNumber) ?? 0) + 1,
    )
  }

  // 最近 windowSize 章：章号降序取前 N，再还原成升序喂给中位数。
  const window = [...chapters]
    .sort((left, right) => right - left)
    .slice(0, Math.max(0, windowSize))
  if (window.length < windowSize) {
    return { median: null, sampleChapters: window.length }
  }

  const counts = window
    .map(chapterNumber => humanActionsByChapter.get(chapterNumber) ?? 0)
    .sort((left, right) => left - right)

  return { median: Math.round(medianOfAscending(counts)), sampleChapters: window.length }
}
