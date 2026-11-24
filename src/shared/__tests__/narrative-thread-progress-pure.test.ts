import { describe, expect, it } from 'vitest'

import {
  chapterUnionCount,
  coveredChapterUnion,
  finalizedChapterNumbers,
  narrativeThreadProgress,
} from '../narrative-thread-progress-pure'

const plan = (targetStartChapter: number, targetEndChapter: number) => ({ targetStartChapter, targetEndChapter })
const written = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index)

describe('chapterUnionCount', () => {
  it('区间并集去重计数', () => {
    expect(chapterUnionCount([{ from: 11, to: 20 }])).toBe(10)
    expect(chapterUnionCount([{ from: 1, to: 3 }, { from: 3, to: 5 }])).toBe(5)
  })
})

describe('coveredChapterUnion', () => {
  it('只保留单元左界及以上的章，升序去重', () => {
    expect(coveredChapterUnion([plan(1, 4), plan(11, 20)], { from: 11 })).toEqual(written(11, 20))
    expect(coveredChapterUnion([plan(1, 4)], { from: 5 })).toEqual([])
  })

  it('单元未知时为空', () => {
    expect(coveredChapterUnion([plan(11, 20)], null)).toEqual([])
  })
})

describe('finalizedChapterNumbers（只数 finalized，reviewed 不计）', () => {
  it('五档里只有 finalized 计入并去重', () => {
    const drafts = [
      { chapterNumber: 1, status: 'finalized' },
      { chapterNumber: 1, status: 'finalized' },
      { chapterNumber: 2, status: 'reviewed' },
      { chapterNumber: 3, status: 'revised' },
      { chapterNumber: 4, status: 'draft' },
      { chapterNumber: 5, status: 'archived' },
      { chapterNumber: 6, status: 'finalized' },
    ]
    expect(finalizedChapterNumbers(drafts)).toEqual([1, 6])
  })
})

describe('narrativeThreadProgress（J6：档 3 计数）', () => {
  it('并集 [11,20]、单元 from=1、已写 1..32 ⇒ 已扫 10 / 已写 32 / 剩余 22 / 建议 21 起 3 章', () => {
    const progress = narrativeThreadProgress([plan(11, 20)], { from: 1, maxChapters: 32 }, written(1, 32))
    expect(progress.scanned).toBe(10)
    expect(progress.written).toBe(32)
    expect(progress.remaining).toBe(22)
    expect(progress.suggestion).toEqual({ start: 21, count: 3 })
  })

  it('空计划 ⇒ 建议条不显示（suggestion 为 null）', () => {
    const progress = narrativeThreadProgress([], { from: 1, maxChapters: 32 }, written(1, 8))
    expect(progress.suggestion).toBeNull()
    expect(progress.scanned).toBe(0)
  })

  it('单元未知 ⇒ suggestion 为 null，且不得把 remaining 写成 0', () => {
    const progress = narrativeThreadProgress([plan(11, 20)], null, written(1, 32))
    expect(progress.suggestion).toBeNull()
    expect(progress.remaining).toBeNull()
    expect(progress.remaining).not.toBe(0)
  })

  it('单元内无已定稿章 ⇒ 建议条不显示（不拿 totalChapters 顶替单元右端）', () => {
    const progress = narrativeThreadProgress([plan(11, 20)], { from: 11, maxChapters: 32 }, written(1, 10))
    expect(progress.suggestion).toBeNull()
  })

  it('变异对照：unit.maxChapters = 8 时 remaining 仍为 22（证明未读 maxChapters）', () => {
    const progress = narrativeThreadProgress([plan(11, 20)], { from: 1, maxChapters: 8 }, written(1, 32))
    expect(progress.scanned).toBe(10)
    expect(progress.remaining).toBe(22)
    expect(progress.suggestion).toEqual({ start: 21, count: 3 })
  })
})
