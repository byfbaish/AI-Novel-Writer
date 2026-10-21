/**
 * 微任务排队探针（仅 dev）。
 *
 * 用途：2026-10-21 排查「审稿结束后渲染层满核空转 + 私有内存持续增长」。
 * CPU profile 显示 `processRootScheduleInMicrotask` 自身吃掉 48%（无子帧、父帧是微任务回调），
 * 说明有代码以**微任务频率**反复触发 React 调度（`set()` → `ensureRootIsScheduled` → `queueMicrotask`）。
 * 微任务执行时原始调用方已离开栈，只能在**排队那一刻**取证 —— 本探针就是干这个。
 *
 * 约束：
 * - 仅 dev、仅 window 环境；必须在 `react-dom` 之前导入（React 会在模块求值时捕获
 *   `queueMicrotask`，晚于它包装就抓不到了）。
 * - 每 20 次抽一条栈、每窗口最多 60 条，正常量级（<200 次/2s）完全不输出。
 * - 只包装、不改变调度语义（原样调用原函数并返回其结果）。
 */

const ENABLED = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true
const WINDOW_MS = 2_000
/** 低于这个量视为正常，不输出。 */
const MIN_CALLS = 200
/** 每 N 次抽一条栈。 */
const SAMPLE_EVERY = 20
/** 每窗口最多采 60 条栈。 */
const MAX_SAMPLES = 60
/** 每条栈保留的行数。 */
const STACK_LINES = 9

let installed = false

export function installMicrotaskProbe(): void {
  if (!ENABLED || installed || typeof window === 'undefined') return
  installed = true

  const original = window.queueMicrotask.bind(window)
  let count = 0
  let windowStart = performance.now()
  let samples: string[] = []

  const captureSignal = (): string => {
    const stack = (new Error().stack ?? '').split('\n').slice(3, 3 + STACK_LINES)
    // 去掉参数里的时间戳查询串，便于同类栈聚合
    return stack.map(line => line.replace(/\?t=\d+/gu, '')).join('\n')
  }

  const report = (elapsedMs: number): void => {
    const perSecond = Math.round((count / elapsedMs) * 1_000)
    const groups = new Map<string, { count: number; stack: string }>()
    for (const stack of samples) {
      const signature = stack.split('\n').slice(0, 4).join('\n')
      const entry = groups.get(signature)
      if (entry) entry.count += 1
      else groups.set(signature, { count: 1, stack })
    }
    const top = [...groups.values()].sort((left, right) => right.count - left.count).slice(0, 3)
    console.warn(`[microtask] ${count} 次 / ${(elapsedMs / 1_000).toFixed(1)}s = ${perSecond}/s`
      + `（抽样 ${samples.length} 条，归并为 ${groups.size} 类）`)
    for (const group of top) {
      console.warn(`[microtask] 排队调用方（同类 ${group.count} 条样本）：\n${group.stack}`)
    }
  }

  window.queueMicrotask = (callback: VoidFunction): void => {
    count += 1
    if (count % SAMPLE_EVERY === 1 && samples.length < MAX_SAMPLES) samples.push(captureSignal())
    const now = performance.now()
    const elapsed = now - windowStart
    if (elapsed >= WINDOW_MS) {
      if (count >= MIN_CALLS) report(elapsed)
      count = 0
      samples = []
      windowStart = now
    }
    original(callback)
  }
}

// 模块被导入即安装（main.tsx 把它排在 react-dom 之前）。
installMicrotaskProbe()
