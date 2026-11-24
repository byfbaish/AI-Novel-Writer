import { describe, expect, it } from 'vitest'

import { PLANNING_ACTION_CHAPTER_LIMIT } from '../plot-outline-contract'
import { S07_TASK_BUDGET_POLICY } from '../../services/generation/task-budget-planner'
import {
  NARRATIVE_THREAD_CHAPTER_BUDGET_POLICY,
  NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT,
  assertNarrativeThreadBatchBudget,
  assertNarrativeThreadChapterBudget,
  narrativeThreadPlanBudget,
  narrativeThreadPlanRange,
} from '../narrative-thread-range-pure'

/** S07 policy 复算单章声明需求：base + 1 × tokensPerItem[lang].planning。 */
function recomputedSingleChapter(writingLanguage: 'zh-CN' | 'en-US'): number {
  return S07_TASK_BUDGET_POLICY.structuredItems.baseTokens
    + S07_TASK_BUDGET_POLICY.structuredItems.tokensPerItem[writingLanguage].planning
}

describe('narrativeThreadPlanRange（J1／J7：区间闸复用）', () => {
  it('章数上限与 PLANNING_ACTION_CHAPTER_LIMIT 同源', () => {
    expect(NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT).toBe(PLANNING_ACTION_CHAPTER_LIMIT)
    expect(NARRATIVE_THREAD_CHAPTER_BUDGET_POLICY.chapterLimit).toBe(PLANNING_ACTION_CHAPTER_LIMIT)
  })

  it('count = 0 抛 GENERATION_PLANNING_RANGE_INVALID', () => {
    expect(() => narrativeThreadPlanRange(3, 0)).toThrow('GENERATION_PLANNING_RANGE_INVALID')
  })

  it('count = 11 抛 GENERATION_PLANNING_RANGE_INVALID（走 assertPlanningActionRange）', () => {
    expect(() => narrativeThreadPlanRange(1, 11)).toThrow('GENERATION_PLANNING_RANGE_INVALID')
  })

  it('右端越过全书章数抛 GENERATION_PLANNING_RANGE_INVALID', () => {
    expect(() => narrativeThreadPlanRange(5, 6, 8)).toThrow('GENERATION_PLANNING_RANGE_INVALID')
  })

  it('起点小于 1 抛 GENERATION_PLANNING_RANGE_INVALID', () => {
    expect(() => narrativeThreadPlanRange(0, 1)).toThrow('GENERATION_PLANNING_RANGE_INVALID')
  })

  it('N = 1 的区间与单章逐字等价（J7）', () => {
    expect(narrativeThreadPlanRange(2, 1)).toEqual({ from: 2, to: 2 })
    expect(narrativeThreadPlanRange(2, 1, 10)).toEqual({ from: 2, to: 2 })
  })
})

describe('assertNarrativeThreadChapterBudget（J2：单章预算闸含 base）', () => {
  it('zh-CN 单章声明需求 3584（base + 每章 3072）', () => {
    expect(narrativeThreadPlanBudget('zh-CN', 1)).toBe(3_584)
    expect(narrativeThreadPlanBudget('zh-CN', 1)).toBe(recomputedSingleChapter('zh-CN'))
  })

  it('en-US 单章声明需求 2560（base + 每章 2048）', () => {
    expect(narrativeThreadPlanBudget('en-US', 1)).toBe(2_560)
    expect(narrativeThreadPlanBudget('en-US', 1)).toBe(recomputedSingleChapter('en-US'))
  })

  it('3072 装不下 3584：抛错原文含 required 3584 与 perAttempt 3072', () => {
    expect(() => assertNarrativeThreadChapterBudget('zh-CN', 3_072)).toThrow('NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED')
    expect(() => assertNarrativeThreadChapterBudget('zh-CN', 3_072)).toThrow('required 3584')
    expect(() => assertNarrativeThreadChapterBudget('zh-CN', 3_072)).toThrow('perAttempt 3072')
  })

  it('4096 装得下 3584：不抛', () => {
    expect(() => assertNarrativeThreadChapterBudget('zh-CN', 4_096)).not.toThrow()
  })
})

describe('assertNarrativeThreadBatchBudget（J3：批声明闸与闸序）', () => {
  it('zh-CN 10 章声明需求 31232，未超 32768：不抛', () => {
    expect(narrativeThreadPlanBudget('zh-CN', 10)).toBe(31_232)
    expect(() => assertNarrativeThreadBatchBudget('zh-CN', 10, 32_768)).not.toThrow()
  })

  it('zh-CN 6 章 18944 超 16384：抛错原文含五项', () => {
    expect(narrativeThreadPlanBudget('zh-CN', 6)).toBe(18_944)
    expect(() => assertNarrativeThreadBatchBudget('zh-CN', 6, 16_384)).toThrow('NARRATIVE_THREAD_BATCH_BUDGET_EXCEEDED')
    expect(() => assertNarrativeThreadBatchBudget('zh-CN', 6, 16_384)).toThrow('required 18944')
    expect(() => assertNarrativeThreadBatchBudget('zh-CN', 6, 16_384)).toThrow('base+perChapter×6')
    expect(() => assertNarrativeThreadBatchBudget('zh-CN', 6, 16_384)).toThrow('cap 16384')
  })

  it('N = 11 先被区间闸拒：抛的是 GENERATION_PLANNING_RANGE_INVALID', () => {
    expect(() => {
      narrativeThreadPlanRange(1, 11, 20)
      assertNarrativeThreadBatchBudget('zh-CN', 11, 32_768)
    }).toThrow('GENERATION_PLANNING_RANGE_INVALID')
  })
})
