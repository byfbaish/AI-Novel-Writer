/**
 * 渲染层 IPC 速率表（仅 dev）。
 *
 * 存在理由：2026-10-21 排查「审稿结束后渲染层满核空转 + 私有内存 ~20MB/s 持续增长」时，
 * `ipc-client` 每次调用打两条 `console.log`，Console 被刷到每秒上万条 —— 既看不出是哪条
 * 通道在循环，日志本身也成了可观开销（trace 里 `V8Console::runTask` 42,621 次 / 4.3s）。
 * 这里把「逐条打印」换成「每 2 秒一行摘要 + 最热通道的调用栈」。
 *
 * 归因要点：栈必须在**该通道自己的调用里**抓，不能在汇总时抓 ——
 * 汇总那一刻的栈属于「刚好跨过窗口边界的那次调用」，与热点通道无关（2026-10-21 踩过）。
 *
 * 三条硬约束：
 * - **生产零开销**：`ENABLED` 为假时首行即返回，不统计、不建栈。
 * - **不注册定时器**：只在调用时判断时间窗，测试环境不会因此挂住事件循环。
 * - **取证不成灾**：每个通道每个窗口最多抓一次栈，每窗口最多 8 条通道，避免采样变成新开销。
 */

const ENABLED = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true

/** 汇总窗口：每 2 秒最多输出一行。 */
const REPORT_WINDOW_MS = 2_000
/** 低于这个量视为正常流量，不输出（避免刷屏）。 */
const MIN_CALLS_TO_REPORT = 20
/** 每个窗口最多为 8 条通道抓栈。 */
const MAX_STACK_CHANNELS = 8
/** 每条栈只留前几帧，够看清调用方即可。 */
const STACK_FRAMES = 6

const counts = new Map<string, number>()
/** 本窗口内每条通道**首次**调用时的栈（归因正确的关键）。 */
let windowStacks = new Map<string, string>()
let total = 0
let windowStart = typeof performance === 'undefined' ? 0 : performance.now()
/** 上一次已打印过栈的通道，避免同一热点每轮重复刷栈。 */
let lastStackChannel: string | null = null

function captureStack(): string {
  return (new Error().stack ?? '').split('\n').slice(2, 2 + STACK_FRAMES).join('\n')
}

function perSecond(count: number, elapsedMs: number): number {
  return elapsedMs > 0 ? Math.round((count / elapsedMs) * 1_000) : count
}

function report(elapsedMs: number): void {
  const top = [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)
  console.warn(
    `[ipc-rate] ${total} 次 / ${(elapsedMs / 1_000).toFixed(1)}s = ${perSecond(total, elapsedMs)}/s · `
      + top.map(([channel, count]) => `${channel} ${perSecond(count, elapsedMs)}/s`).join(' · '),
  )
  const hottest = top[0]?.[0]
  if (hottest && hottest !== lastStackChannel) {
    const stack = windowStacks.get(hottest)
    if (stack) {
      lastStackChannel = hottest
      console.warn(`[ipc-rate] 最热通道调用栈：${hottest}\n${stack}`)
    }
  }
  counts.clear()
  windowStacks = new Map()
  total = 0
  windowStart = performance.now()
}

/** 每次真正的 IPC 调用登记一次；到窗口边界且有量时输出摘要。 */
export function noteIpcInvoke(channel: string): void {
  if (!ENABLED || typeof performance === 'undefined') return
  total += 1
  const seen = (counts.get(channel) ?? 0) + 1
  counts.set(channel, seen)
  if (seen === 1 && windowStacks.size < MAX_STACK_CHANNELS) windowStacks.set(channel, captureStack())
  const elapsed = performance.now() - windowStart
  if (elapsed < REPORT_WINDOW_MS) return
  if (total < MIN_CALLS_TO_REPORT) {
    counts.clear()
    windowStacks = new Map()
    total = 0
    windowStart = performance.now()
    return
  }
  report(elapsed)
}

/** 供 DevTools 控制台手动清零（重新开始一个统计窗口）。 */
export function resetIpcRateWindow(): void {
  counts.clear()
  windowStacks = new Map()
  lastStackChannel = null
  total = 0
  windowStart = typeof performance === 'undefined' ? 0 : performance.now()
}
