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
