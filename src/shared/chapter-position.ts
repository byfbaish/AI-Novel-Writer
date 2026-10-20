/**
 * 章节位置的**唯一表达处**（2026-10-20）。
 *
 * 目标写法（作者定）：`第3卷第2单元第3章（全书第45章）`
 * —— 前置层级给人看「在哪一段」，括号里的全书章号给机器与核对用。
 *
 * 为什么需要它：位置上个月在六个地方各写各的（「第 1 卷 · 第 2 个单元，从第 6 章起」
 * 「第 2 个单元，从第 6 章起」「已覆盖至第 21 章」……），作者在 A6 事故里把
 * 「第 2 个单元」读成了「第二卷开始」。缺层级比缺信息更危险。
 *
 * 降级：结构不全时逐级退化，**绝不瞎补** ——
 * | 情况 | 输出 |
 * |---|---|
 * | 有卷有单元 | `第3卷第2单元第3章（全书第45章）` |
 * | 只有卷（两级结构） | `第3卷第3章（全书第45章）` |
 * | 都没有 | `第45章` |
 */

import type { WritingLanguage } from './writing-language'

export interface ChapterPosition {
  /** 全书章号 —— 唯一机器锚点，必填 */
  chapter: number
  /** 卷号；读不到传 `null`/省略 */
  volumeIndex?: number | null
  /** 单元号；两级结构（无单元层）传 `null`/省略 */
  unitIndex?: number | null
  /**
   * 在所属层级内的序号（有单元层 = 单元内第几章；只有卷层 = 卷内第几章）。
   * **省略即 1**：绝大多数调用点表达的是「本批从哪开始」，那必然是单元的第一章。
   */
  chapterInParent?: number | null
}

function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null
}

/** 把位置格式化成 `第3卷第2单元第3章（全书第45章）`。 */
export function formatChapterPosition(position: ChapterPosition, language: WritingLanguage): string {
  const chapter = positiveOrNull(position.chapter)
  if (chapter === null) return language === 'en-US' ? 'chapter ?' : '第 ? 章'
  const volume = positiveOrNull(position.volumeIndex)
  const unit = positiveOrNull(position.unitIndex)
  const inParent = positiveOrNull(position.chapterInParent) ?? 1
  const english = language === 'en-US'

  if (volume !== null && unit !== null) {
    return english
      ? `Vol ${volume} Unit ${unit} Ch ${inParent} (Book Ch ${chapter})`
      : `第${volume}卷第${unit}单元第${inParent}章（全书第${chapter}章）`
  }
  if (volume !== null) {
    return english
      ? `Vol ${volume} Ch ${inParent} (Book Ch ${chapter})`
      : `第${volume}卷第${inParent}章（全书第${chapter}章）`
  }
  return english ? `Chapter ${chapter}` : `第${chapter}章`
}
