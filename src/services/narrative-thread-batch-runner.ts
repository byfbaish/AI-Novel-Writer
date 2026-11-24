/**
 * 叙事线索候选的**串行执行器**（档 1：一次一段章区间，逐章串行）。
 *
 * 只做调度：产物由注入的 `runChapter` 决定（真实 App 里是 `open → execute → read → detach`），
 * 因此本模块不 import IPC、不依赖 Electron，可直接单测。
 *
 * 写死的语义（实施包 §4）：
 * 1. 按 `from..to` 顺序逐章调用，任何两章不重叠（不做 `Promise.all`）；
 * 2. 第 k 章抛错 ⇒ 记 `failedChapter = k`，k+1..to 一律不发起；
 * 3. 已成功章的 `candidates` 整批保留；
 * 4. 禁止自动跳过失败章、自动减 N、自动缩短文本、自动换模型重试；
 * 5. 外部 `signal` 中止与失败同等处理（后续章不发起）。
 */

export interface NarrativeThreadBatchChapterResult<C, H> {
  chapterNumber: number
  status: 'ok' | 'failed'
  candidates: C[]
  handle?: H
}

export interface NarrativeThreadBatchChapters<C, H> {
  order: readonly number[]
  results: NarrativeThreadBatchChapterResult<C, H>[]
  failedChapter: number | null
}

export async function runNarrativeThreadChapters<C, H>(input: {
  range: { from: number; to: number }
  runChapter: (chapterNumber: number, signal: AbortSignal) => Promise<{ candidates: C[]; handle?: H }>
  signal: AbortSignal
  onProgress?: (done: number, total: number, chapterNumber: number) => void
}): Promise<NarrativeThreadBatchChapters<C, H>> {
  const order: number[] = []
  for (let chapter = input.range.from; chapter <= input.range.to; chapter += 1) order.push(chapter)
  const results: NarrativeThreadBatchChapterResult<C, H>[] = []
  let failedChapter: number | null = null

  for (const chapterNumber of order) {
    if (input.signal.aborted) {
      failedChapter = chapterNumber
      break
    }
    try {
      const produced = await input.runChapter(chapterNumber, input.signal)
      results.push({ chapterNumber, status: 'ok', candidates: produced.candidates, handle: produced.handle })
      input.onProgress?.(results.length, order.length, chapterNumber)
    } catch {
      failedChapter = chapterNumber
      results.push({ chapterNumber, status: 'failed', candidates: [] })
      break
    }
  }

  return { order, results, failedChapter }
}
