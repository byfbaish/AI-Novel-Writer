import { describe, expect, it } from 'vitest'

import { chapterStaleness, isStaleChapter } from '../chapter-staleness'

const meta = (staleFromChapter: number | null = null) => ({ staleFromChapter })

describe('章节「前提已变」判定', () => {
  it('没有派生快照 ⇒ not-finalized（未定稿 / 刚退回，不参与判定）', () => {
    expect(chapterStaleness(
      { chapterNumber: 2, snapshotGeneration: null, requiredGeneration: 3, acknowledgedGenerations: [] },
      meta(3),
    ).state).toBe('not-finalized')
  })

  it('快照代追平前文最新变化 ⇒ current', () => {
    expect(chapterStaleness(
      { chapterNumber: 2, snapshotGeneration: 5, requiredGeneration: 5, acknowledgedGenerations: [] },
      meta(3),
    ).state).toBe('current')
  })

  it('快照代落后且没有确认 ⇒ stale，并带出"从第几章开始脏"供文案用', () => {
    const result = chapterStaleness(
      { chapterNumber: 4, snapshotGeneration: 3, requiredGeneration: 5, acknowledgedGenerations: [] },
      meta(3),
    )
    expect(result).toEqual({ state: 'stale', staleFromChapter: 3 })
    expect(isStaleChapter(result)).toBe(true)
  })

  it('确认代追平前文最新变化 ⇒ current', () => {
    expect(chapterStaleness(
      { chapterNumber: 4, snapshotGeneration: 3, requiredGeneration: 5, acknowledgedGenerations: [5] },
      meta(3),
    ).state).toBe('current')
  })

  it('★ 改后文不影响前文：只要本章之前没变过，全局世代再高也 current', () => {
    // 第 5 章快照是代 2 算的；之后第 20、21 章被反复修改（全局 generation 已经很高），
    // 但第 5 章之前（1..4）从没变过 ⇒ requiredGeneration = 0 ⇒ 仍然可信。
    expect(chapterStaleness(
      { chapterNumber: 5, snapshotGeneration: 2, requiredGeneration: 0, acknowledgedGenerations: [] },
      meta(20),
    ).state).toBe('current')
  })

  it('★ 逐章修复不会打回已确认的章：改更后面的章不影响它', () => {
    // 退第 21 章 ⇒ 改 ⇒ 定稿(代 7)；随后确认第 22 章(代 7)；再退第 23 章(代 8)。
    // 第 22 章之前最新变化仍是第 21 章那一代(7)，确认代 7 已够 ⇒ 不该被 23 章打回。
    expect(chapterStaleness(
      { chapterNumber: 22, snapshotGeneration: 6, requiredGeneration: 7, acknowledgedGenerations: [7] },
      meta(21),
    ).state).toBe('current')
  })

  it('重新定稿后自动恢复：不需要额外清理逻辑', () => {
    expect(chapterStaleness(
      { chapterNumber: 3, snapshotGeneration: 6, requiredGeneration: 6, acknowledgedGenerations: [] },
      meta(3),
    ).state).toBe('current')
  })
})
