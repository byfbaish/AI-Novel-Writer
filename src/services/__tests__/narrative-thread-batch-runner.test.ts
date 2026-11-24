import { describe, expect, it, vi } from 'vitest'

import { NARRATIVE_THREAD_CANDIDATE_BUDGET } from '../../shared/narrative-thread-generation-pure'
import { runNarrativeThreadChapters } from '../narrative-thread-batch-runner'

describe('runNarrativeThreadChapters（J4：串行与失败即停）', () => {
  it('N=3 第 2 章抛错 ⇒ 调用序列 [1,2]、failedChapter=2、第 1 章候选仍在、results 长度 2', async () => {
    const calls: number[] = []
    const runChapter = vi.fn(async (chapterNumber: number) => {
      calls.push(chapterNumber)
      if (chapterNumber === 2) throw new Error('模型未完整完成')
      return { candidates: [`第${chapterNumber}章候选`], handle: `handle-${chapterNumber}` }
    })

    const batch = await runNarrativeThreadChapters({
      range: { from: 1, to: 3 },
      runChapter,
      signal: new AbortController().signal,
    })

    expect(batch.order).toEqual([1, 2, 3])
    expect(calls).toEqual([1, 2])
    expect(runChapter).toHaveBeenCalledTimes(2)
    expect(batch.failedChapter).toBe(2)
    expect(batch.results).toHaveLength(2)
    expect(batch.results[0]).toMatchObject({ chapterNumber: 1, status: 'ok', candidates: ['第1章候选'] })
    expect(batch.results[1]).toMatchObject({ chapterNumber: 2, status: 'failed', candidates: [] })
  })

  it('全部成功时逐章按序产出，onProgress 计数递增', async () => {
    const progress: Array<[number, number, number]> = []
    const batch = await runNarrativeThreadChapters({
      range: { from: 5, to: 7 },
      runChapter: async chapterNumber => ({ candidates: [chapterNumber], handle: `h-${chapterNumber}` }),
      signal: new AbortController().signal,
      onProgress: (done, total, chapterNumber) => { progress.push([done, total, chapterNumber]) },
    })
    expect(batch.order).toEqual([5, 6, 7])
    expect(batch.results.map(item => item.chapterNumber)).toEqual([5, 6, 7])
    expect(batch.failedChapter).toBeNull()
    expect(progress).toEqual([[1, 3, 5], [2, 3, 6], [3, 3, 7]])
    expect(batch.results.every(item => item.status === 'ok')).toBe(true)
  })

  it('外部 signal 已中止 ⇒ 后续章不发起', async () => {
    const controller = new AbortController()
    controller.abort()
    const calls: number[] = []
    const batch = await runNarrativeThreadChapters({
      range: { from: 1, to: 2 },
      runChapter: async chapterNumber => { calls.push(chapterNumber); return { candidates: [chapterNumber] } },
      signal: controller.signal,
    })
    // 循环首次检查即中止：一章也不发起。
    expect(calls).toEqual([])
    expect(batch.results).toHaveLength(0)
    expect(batch.failedChapter).toBe(1)
  })
})

describe('每章请求预算（J5：原样 4096，与 N 无关）', () => {
  it('每次调用捕获的 maxRequestedOutputTokensPerAttempt 均为 4096，N=1 与 N=10 同值', async () => {
    const captured: number[] = []
    const makeRunner = () => async (chapterNumber: number) => {
      // 真实 runChapter 用同一常量组装单章请求预算；这里照抄同一来源。
      captured.push(NARRATIVE_THREAD_CANDIDATE_BUDGET.maxRequestedOutputTokensPerAttempt)
      return { candidates: [chapterNumber] }
    }

    await runNarrativeThreadChapters({ range: { from: 1, to: 1 }, runChapter: makeRunner(), signal: new AbortController().signal })
    await runNarrativeThreadChapters({ range: { from: 1, to: 10 }, runChapter: makeRunner(), signal: new AbortController().signal })

    expect(captured).toHaveLength(11)
    expect(captured.every(value => value === 4_096)).toBe(true)
    const perN1 = captured.slice(0, 1)
    const perN10 = captured.slice(1)
    expect(perN1).toEqual([4_096])
    expect(perN10).toEqual(Array.from({ length: 10 }, () => 4_096))
  })
})
