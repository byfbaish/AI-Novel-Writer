import { outputTokensFor, S07_TASK_BUDGET_POLICY } from '../services/generation/task-budget-planner'
import {
  PLANNING_ACTION_CHAPTER_LIMIT,
  assertPlanningActionRange,
  type PlotOutlineRange,
} from './plot-outline-contract'
import type { WritingLanguage } from './writing-language'

/**
 * 分层说明（本卡唯一一处分层倒置，必须留在这里）：
 * `src/shared/` 反向 import `src/services/generation/task-budget-planner.ts`。
 * 理由只有一条——「每章 token 预算只能有 S07 策略一个来源」。把 512 / 3_072 / 2_048
 * 复制进本模块就是制造第二份真相，日后调一处必漂。这里只复用 `outputTokensFor`
 * 与 `S07_TASK_BUDGET_POLICY`；**不 import harness**，单次请求硬顶由调用方注入。
 */

/** 区间章数上限，值直接取 `PLANNING_ACTION_CHAPTER_LIMIT`，绝不复制字面量 10。 */
export const NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT = PLANNING_ACTION_CHAPTER_LIMIT

const structuredItems = (writingLanguage: WritingLanguage, requestedItems: number) =>
  ({ kind: 'structured-items' as const, writingLanguage, requestedItems })

/**
 * 第 1..N 章的声明需求 = base + N × 每章 planning 预算。
 * 直接复用 S07 的唯一算式 `outputTokensFor`，本模块不写任何数字。
 */
export function narrativeThreadPlanBudget(writingLanguage: WritingLanguage, chapters: number): number {
  return outputTokensFor('planning', structuredItems(writingLanguage, chapters), chapters)
}

export const NARRATIVE_THREAD_CHAPTER_BUDGET_POLICY = Object.freeze({
  version: 'narrative-thread-chapter-budget-v1',
  s07PolicyVersion: S07_TASK_BUDGET_POLICY.version,
  chapterLimit: NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT,
})

/**
 * 区间 = `[startChapter, startChapter + chapterCount - 1]`。
 *
 * 上限/越界复用既有 `assertPlanningActionRange`（`plot-outline-contract.ts:20-23`），
 * 不新写 `> 10` 分支。`totalChapters` 可选：给了才核对「右端不得越过全书章数」，
 * 没给就只做区间自洽校验（N=1 的等价性用例不需要全书章数）。
 */
export function narrativeThreadPlanRange(
  startChapter: number,
  chapterCount: number,
  totalChapters?: number,
): PlotOutlineRange {
  const from = startChapter
  const to = startChapter + chapterCount - 1
  assertPlanningActionRange({ from, to })
  if (totalChapters !== undefined && to > totalChapters) throw new Error('GENERATION_PLANNING_RANGE_INVALID')
  return { from, to }
}

/**
 * 单章预算闸：`base + 每章 planning` 必须装进单次请求预算。
 * 默认单次预算 4096，zh-CN 单章声明需求 3584（由 policy 复算，见测试）。
 */
export function assertNarrativeThreadChapterBudget(
  writingLanguage: WritingLanguage,
  perAttemptTokens: number,
): void {
  const required = narrativeThreadPlanBudget(writingLanguage, 1)
  if (required > perAttemptTokens) {
    throw new Error(`NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED: required ${required} > perAttempt ${perAttemptTokens}`)
  }
}

/**
 * 批声明闸：`base + 每章 × N` 与单次请求硬顶比较。
 *
 * `hardCapTokens` 由调用方传入（UI 传 `GENERATION_ABSOLUTE_BUDGET_LIMITS.maxRequestedOutputTokensPerAttempt`），
 * 本模块不 import harness，避免 shared → services 的第二处倒置。
 */
export function assertNarrativeThreadBatchBudget(
  writingLanguage: WritingLanguage,
  chapters: number,
  hardCapTokens: number,
): void {
  const required = narrativeThreadPlanBudget(writingLanguage, chapters)
  if (required > hardCapTokens) {
    throw new Error(`NARRATIVE_THREAD_BATCH_BUDGET_EXCEEDED: required ${required} (base+perChapter×${chapters}) > cap ${hardCapTokens}`)
  }
}
