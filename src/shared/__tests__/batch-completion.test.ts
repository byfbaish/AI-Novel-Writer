import { describe, expect, it } from 'vitest'

import { readBatchChapterCompletion } from '../batch-completion'

describe('D9 阶段 2 · 逐章完成读数', () => {
  it('空输入：三态落到 empty', () => {
    expect(readBatchChapterCompletion({ runs: [] })).toEqual({ completedChapters: [], lastCompletedChapter: null, reason: 'empty' })
  })

  it('有 run 但没有任何终态章节证据：落到 no-completed-run', () => {
    expect(readBatchChapterCompletion({ runs: [{ status: 'running' }, { status: 'failed' }] }))
      .toEqual({ completedChapters: [], lastCompletedChapter: null, reason: 'no-completed-run' })
  })

  it('单卷单批：按 run 给出的章号集合返回', () => {
    expect(readBatchChapterCompletion({ runs: [{ status: 'completed', completedChapters: [1, 2, 3], coveredTo: 3 }] }))
      .toEqual({ completedChapters: [1, 2, 3], lastCompletedChapter: 3, reason: 'ok' })
  })

  it('多单元 / 多批：终态 run 的章号取并集并按章号排序', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1, 2, 3, 4], coveredTo: 4 },
      { status: 'completed', completedChapters: [5, 6, 7, 8], coveredTo: 8 },
      { status: 'failed', completedChapters: [9], coveredTo: 9 },
      { status: 'paused', completedChapters: [10], coveredTo: 10 },
    ] })
    expect(result.completedChapters).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(result.lastCompletedChapter).toBe(9)
    expect(result.reason).toBe('ok')
  })

  it('covered_to 回退：后一批覆盖更小不得把读数拉回去', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], coveredTo: 12 },
      { status: 'completed', completedChapters: [7, 8, 9], coveredTo: 9 },
    ] })
    expect(result.lastCompletedChapter).toBe(12)
    expect(result.completedChapters).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('批次中断（最后一章是废稿）：只算前五章，第六章不在集合里', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1, 2, 3, 4, 5], coveredTo: 5 },
      { status: 'failed', completedChapters: [], coveredTo: null },
    ] })
    expect(result.completedChapters).toEqual([1, 2, 3, 4, 5])
    expect(result.lastCompletedChapter).toBe(5)
    expect(result.completedChapters).not.toContain(6)
  })
})

// WB-14 补测：只新增用例，不改上面既有 6 例的任何断言、不改 batch-completion.ts 实现。
// 说明：带「表征断言」字样的用例，记录的是实现当前的真实行为，用于暴露卡面假设与实现的差异，
// 不是把失败期望改成通过来洗白；差异逐条写在卡报告的「未做项 / 发现」里。
describe('WB-14 补测 · DB-1 未测分支', () => {
  // 第 1 类：coveredTo 只补边界（WB-8 报告 §问3 缺口 4 点名「核心声明零验证」）
  it('coveredTo 只补边界不推区间：空章号 + coveredTo=5 时集合仅 [5]，不推出 1..4', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [], coveredTo: 5 },
    ] })
    expect(result.completedChapters).toEqual([5])
    expect(result.lastCompletedChapter).toBe(5)
    expect(result.reason).toBe('ok')
    for (const ch of [1, 2, 3, 4]) expect(result.completedChapters).not.toContain(ch)
  })

  it('第 1–3 章完成、第 4 章失败、第 5 章完成：实现按并集取 max=5，不判连续完成边界（表征断言）', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1, 2, 3], coveredTo: 3 },
      { status: 'failed', completedChapters: [], coveredTo: null },
      { status: 'completed', completedChapters: [5], coveredTo: 5 },
    ] })
    expect(result.completedChapters).toEqual([1, 2, 3, 5])
    expect(result.completedChapters).not.toContain(4)
    // 实现是纯并集取 max，没有「连续完成边界」判定 ⇒ 卡面期望的 3 未实现。
    expect(result.lastCompletedChapter).toBe(5)
    expect(result.reason).toBe('ok')
  })

  it('第 1 章失败、第 2–4 章完成：实现仍收 [2,3,4]、last=4，不落到 0/null（表征断言）', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'failed', completedChapters: [], coveredTo: null },
      { status: 'completed', completedChapters: [2, 3, 4], coveredTo: 4 },
    ] })
    expect(result.completedChapters).toEqual([2, 3, 4])
    expect(result.lastCompletedChapter).toBe(4)
    expect(result.reason).toBe('ok')
  })

  // 第 2 类：空输入（顺带补 WB-8 缺口 2：终态 run 上的 completedChapters null/undefined）
  it('空章列表：终态 run 的 completedChapters 为 null 且不抛异常，落 no-completed-run', () => {
    const input = { runs: [{ status: 'completed', completedChapters: null, coveredTo: null }] }
    expect(() => readBatchChapterCompletion(input)).not.toThrow()
    expect(readBatchChapterCompletion(input))
      .toEqual({ completedChapters: [], lastCompletedChapter: null, reason: 'no-completed-run' })
  })

  it('completedChapters 与 coveredTo 均缺省：不抛异常，落 no-completed-run', () => {
    const result = readBatchChapterCompletion({ runs: [{ status: 'failed' }] })
    expect(result).toEqual({ completedChapters: [], lastCompletedChapter: null, reason: 'no-completed-run' })
  })

  // 第 3 类：单卷单单元最小正例
  it('单卷单单元最小正例：一个终态 run 只给第 1 章', () => {
    expect(readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1], coveredTo: 1 },
    ] })).toEqual({ completedChapters: [1], lastCompletedChapter: 1, reason: 'ok' })
  })

  // 第 4 类：多卷多单元（实现无「卷」维度，只有扁平 runs 并集，故只验不串味）
  it('多卷多单元：后批完成章不改写前批章号（实现无卷维度，仅按全局并集，表征断言）', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1, 2, 3], coveredTo: 3 },
      { status: 'completed', completedChapters: [7, 8], coveredTo: 8 },
    ] })
    expect(result.completedChapters).toEqual([1, 2, 3, 7, 8])
    expect(result.lastCompletedChapter).toBe(8)
  })

  // 顺带补 WB-8 缺口 5：Set 去重 + sort 升序
  it('多卷多单元：乱序与重复章号经 Set 去重后升序返回', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [5, 2, 9, 2, 1], coveredTo: 9 },
      { status: 'completed', completedChapters: [3, 1, 7], coveredTo: 7 },
    ] })
    expect(result.completedChapters).toEqual([1, 2, 3, 5, 7, 9])
    expect(result.lastCompletedChapter).toBe(9)
  })

  // 第 5 类：状态集边界。口径经作者 2026-11-11 拍板，不再用「表征断言」：
  // 失败 = 只废当前章（已落稿照收，覆盖不算）；取消 = 整批作废；aborted（进程死亡）同失败。
  it('状态集边界：cancelled 是整批作废，其章号一条都不算完成', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'cancelled', completedChapters: [1, 2], coveredTo: 2 },
    ] })
    expect(result.completedChapters).toEqual([])
    expect(result.lastCompletedChapter).toBeNull()
    expect(result.reason).toBe('no-completed-run')
  })

  it('状态集边界：aborted（进程死亡）保留已落稿章，但 coveredTo 不算完成', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'aborted', completedChapters: [1, 2], coveredTo: 3 },
    ] })
    expect(result.completedChapters).toEqual([1, 2])
    expect(result.completedChapters).not.toContain(3)
    expect(result.lastCompletedChapter).toBe(2)
  })

  it('覆盖 ≠ 完成：failed 的 coveredTo 不得计入完成集合（只补 completed 的边界）', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'failed', completedChapters: [1, 2], coveredTo: 5 },
    ] })
    expect(result.completedChapters).toEqual([1, 2])
    expect(result.lastCompletedChapter).toBe(2)
    expect(result.reason).toBe('ok')
  })

  it('失败只废最后一章：前批 completed 落 1–5、后批 failed 覆盖到 8 但零落稿 ⇒ 读数停在 5', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: [1, 2, 3, 4, 5], coveredTo: 5 },
      { status: 'failed', completedChapters: [], coveredTo: 8 },
    ] })
    expect(result.completedChapters).toEqual([1, 2, 3, 4, 5])
    expect(result.lastCompletedChapter).toBe(5)
  })

  it('状态集边界：running / paused 非终态被跳过，其章号不计入完成集合', () => {
    const result = readBatchChapterCompletion({ runs: [
      { status: 'running', completedChapters: [7], coveredTo: 7 },
      { status: 'paused', completedChapters: [8], coveredTo: 8 },
    ] })
    expect(result.completedChapters).toEqual([])
    expect(result.lastCompletedChapter).toBeNull()
    expect(result.reason).toBe('no-completed-run')
  })

  // 顺带补 WB-8 缺口 1：validChapter 的拒绝分支
  it('非法章号：0 / 负数 / 小数 / NaN / 非安全整数 / 字符串被拒绝，只留合法章', () => {
    const dirty = [0, -1, 2.5, NaN, Number.MAX_SAFE_INTEGER + 1, 3, '7'] as unknown as readonly number[]
    const result = readBatchChapterCompletion({ runs: [
      { status: 'completed', completedChapters: dirty, coveredTo: 0 },
    ] })
    expect(result.completedChapters).toEqual([3])
    expect(result.lastCompletedChapter).toBe(3)
    expect(result.reason).toBe('ok')
  })
})
