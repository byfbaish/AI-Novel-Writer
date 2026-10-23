import { describe, expect, it } from 'vitest'

import { chapterStaleness, isStaleChapter } from '../chapter-staleness'

const meta = (generation: number, staleFromChapter: number | null = null) => ({ generation, staleFromChapter })

describe('章节「前提已变」判定', () => {
  it('没有派生快照 ⇒ not-finalized（未定稿 / 刚退回，不参与判定）', () => {
    expect(chapterStaleness(
      { chapterNumber: 2, snapshotGeneration: null, generation: 5, acknowledgedGenerations: [] },
      meta(5, 3),
    ).state).toBe('not-finalized')
  })

  it('快照代追平当前世代 ⇒ current', () => {
    expect(chapterStaleness(
      { chapterNumber: 2, snapshotGeneration: 5, generation: 5, acknowledgedGenerations: [] },
      meta(5, 3),
    ).state).toBe('current')
  })

  it('快照代落后且没有确认 ⇒ stale，并带出"从第几章开始脏"供文案用', () => {
    const result = chapterStaleness(
      { chapterNumber: 4, snapshotGeneration: 3, generation: 5, acknowledgedGenerations: [] },
      meta(5, 3),
    )
    expect(result).toEqual({ state: 'stale', staleFromChapter: 3 })
    expect(isStaleChapter(result)).toBe(true)
  })

  it('针对当前世代确认过 ⇒ current', () => {
    expect(chapterStaleness(
      { chapterNumber: 4, snapshotGeneration: 3, generation: 5, acknowledgedGenerations: [5] },
      meta(5, 3),
    ).state).toBe('current')
  })

  it('确认是"针对某一代"的：世代变了，旧确认自动失效', () => {
    // 作者在 generation=5 时确认过第 4 章；之后又退了一章 ⇒ generation=6
    const staleAgain = chapterStaleness(
      { chapterNumber: 4, snapshotGeneration: 3, generation: 6, acknowledgedGenerations: [5] },
      meta(6, 3),
    )
    expect(staleAgain.state).toBe('stale')
  })

  it('重新定稿后自动恢复：不需要额外清理逻辑', () => {
    // 重新定稿会写新快照，快照代 = 当前世代
    expect(chapterStaleness(
      { chapterNumber: 3, snapshotGeneration: 6, generation: 6, acknowledgedGenerations: [] },
      meta(6, 3),
    ).state).toBe('current')
  })

  it('快照代超过当前世代也算 current（异常输入不制造假警报）', () => {
    expect(chapterStaleness(
      { chapterNumber: 3, snapshotGeneration: 7, generation: 6, acknowledgedGenerations: [] },
      meta(6, 3),
    ).state).toBe('current')
  })
})
