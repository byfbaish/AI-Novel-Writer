import { describe, expect, it } from 'vitest'
import { medianActionsLast10, type DraftEditActionRow } from '../draft-edit-median'

/** 造一行的简写：只关心三列口径相关的字段。 */
function row(chapterNumber: number, origin: 'human' | 'ai', changedChars: number): DraftEditActionRow {
  return { chapterNumber, origin, changedChars }
}

/** 造一章：`human` 个作者改动行 + `ai` 个 AI 行，都按 1 字改动。 */
function chapter(chapterNumber: number, human: number, ai = 0): DraftEditActionRow[] {
  return [
    ...Array.from({ length: human }, () => row(chapterNumber, 'human', 10)),
    ...Array.from({ length: ai }, () => row(chapterNumber, 'ai', 500)),
  ]
}

describe('medianActionsLast10', () => {
  it('reports 9 chapters as insufficient samples instead of averaging 9', () => {
    const rows = Array.from({ length: 9 }, (_, index) => chapter(index + 1, 2)).flat()
    expect(medianActionsLast10(rows)).toEqual({ median: null, sampleChapters: 9 })
  })

  it('averages the 5th and 6th counts when exactly 10 chapters are present', () => {
    // 动作数 1..10，升序后第 5、6 个是 5 和 6，中位数 5.5 → 四舍五入 6。
    const rows = Array.from({ length: 10 }, (_, index) => chapter(index + 1, index + 1)).flat()
    expect(medianActionsLast10(rows)).toEqual({ median: 6, sampleChapters: 10 })
  })

  it('takes the 5th value when the window is odd', () => {
    // 窗口 9 章、动作数 1..9，第 5 个是 5 —— 验证「9 个数取第 5 个」这半条口径。
    const rows = Array.from({ length: 9 }, (_, index) => chapter(index + 1, index + 1)).flat()
    expect(medianActionsLast10(rows, 9)).toEqual({ median: 5, sampleChapters: 9 })
  })

  it('treats all-AI rows as zero author actions but keeps the chapters as samples', () => {
    // 全 ai：10 章都在，每章作者动作 0 —— 有样本、读数为 0，不是「样本不足」。
    const rows = Array.from({ length: 10 }, (_, index) => chapter(index + 1, 0, 3)).flat()
    expect(medianActionsLast10(rows)).toEqual({ median: 0, sampleChapters: 10 })
  })

  it('returns no median for an empty row set', () => {
    expect(medianActionsLast10([])).toEqual({ median: null, sampleChapters: 0 })
  })

  it('keeps only the most recent 10 chapters and ignores older ones', () => {
    // 第 1..5 章动作数极大，但窗口只留第 6..15 章，读数不受影响。
    const old = Array.from({ length: 5 }, (_, index) => chapter(index + 1, 99)).flat()
    const recent = Array.from({ length: 10 }, (_, index) => chapter(index + 6, 2)).flat()
    expect(medianActionsLast10([...old, ...recent])).toEqual({ median: 2, sampleChapters: 10 })
  })
})

/**
 * P51：窗口从「有计量行的最近 10 章」改成「当前章向前连续 10 个章号」。
 *
 * 零动作章（没有任何 `draft_edit_stats` 行）在旧口径下被整章跳过，于是中位数系统性
 * 偏高、不同书的断档情况不可比（B10）。下面的用例把「空章必须进样本、记 0」钉死：
 * 一旦空章又被丢掉，样本数会掉到 9 以下，读数直接变成 `median: null`。
 */
describe('medianActionsLast10 · P51 连续章号口径', () => {
  it('counts chapters with no measurement rows as zero actions instead of dropping them', () => {
    // 章 3..12 连续，其中 5 与 8 一行都没有；其余八章动作数 1,1,1,9,9,9,9,9。
    // 把 5、8 记 0 可得 10 个样本：0,0,1,1,1,9,9,9,9,9，第 5、6 个是 1 与 9，中位数 5。
    // 反证：若 5 或 8 中任何一章被跳过，样本只剩 9 → 中位数 null，读数不是 5。
    const rows = [
      ...chapter(3, 1),
      ...chapter(4, 1),
      ...chapter(6, 1),
      ...chapter(7, 9),
      ...chapter(9, 9),
      ...chapter(10, 9),
      ...chapter(11, 9),
      ...chapter(12, 9),
    ]
    expect(medianActionsLast10(rows, 10, 12)).toEqual({ median: 5, sampleChapters: 10 })
  })

  it('treats an empty chapter and an all-AI chapter identically: both are zero actions', () => {
    // 同样一章 3..12：5、8 章有 AI 行（有计量行但 0 个作者动作）。
    // 与上一条「5、8 章一行都没有」必须同解 —— 空章不是缺样本。
    const rows = [
      ...chapter(3, 1),
      ...chapter(4, 1),
      ...chapter(5, 0, 2),
      ...chapter(6, 1),
      ...chapter(7, 9),
      ...chapter(8, 0, 2),
      ...chapter(9, 9),
      ...chapter(10, 9),
      ...chapter(11, 9),
      ...chapter(12, 9),
    ]
    expect(medianActionsLast10(rows, 10, 12)).toEqual({ median: 5, sampleChapters: 10 })
  })

  it('fills chapter-number gaps with zero and still walks back 10 chapter numbers', () => {
    // 只有 3、4、7..12 有行：以当前章 12 为起点向前连续编号，5、6 缺号记 0，
    // 窗口仍是 3..12 共 10 个章号 → 样本 10，不是 8。
    const rows = [3, 4, 7, 8, 9, 10, 11, 12].flatMap(chapterNumber => chapter(chapterNumber, 1))
    expect(medianActionsLast10(rows, 10, 12)).toEqual({ median: 1, sampleChapters: 10 })
  })

  it('reports the reachable chapter numbers as the sample when fewer than 10 exist', () => {
    // 当前章 5：向前连续编号只够 1..5 共 5 个章号（行只落在 1、5 两章）→ 样本不足（5/10 章）。
    const rows = [...chapter(1, 2), ...chapter(5, 3)]
    expect(medianActionsLast10(rows, 10, 5)).toEqual({ median: null, sampleChapters: 5 })
  })

  it('counts trailing chapters newer than the newest measurement row as zero', () => {
    // 计量行只到第 5 章，但当前章是 15：窗口 6..15 全是零动作章，照样是满样本、读数 0。
    // 这正是旧口径会悄悄漏掉的一整段 —— 一行都没有的章在过去被当成「不存在」。
    const rows = [1, 2, 3, 4, 5].flatMap(chapterNumber => chapter(chapterNumber, 2))
    expect(medianActionsLast10(rows, 10, 15)).toEqual({ median: 0, sampleChapters: 10 })
  })
})
