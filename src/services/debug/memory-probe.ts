/**
 * 渲染层内存打点（最小侵入诊断）。
 *
 * 存在理由：精修等重活会出现 10GB 级的**峰值**（会回落，不是泄漏，但在 16GB 机器上
 * 足以把系统压到换页）。只看任务管理器无法判断内存是"随调用次数线性涨"还是
 * "某一次调用暴涨"，也无法知道挂在提示词装配、追踪落盘还是面板轮询上。
 *
 * 所以这里只做一件事：在少数关键位置记一条堆用量读数，带上与上一条的差值和全局峰值。
 * 打开开关后跑一轮精修，读 `memoryProbeReport()`（开发者设置里也会实时显示）即可定位。
 *
 * 三条硬约束：
 * - **关闭时零开销**：`markMemory` 首行即返回，不读堆、不分配。
 * - **不持有大对象**：只存数字与短标签，环形缓冲上限 400 条。
 * - **不影响业务**：所有读取都包在 try/catch 里，任何异常都静默降级。
 */

export interface MemorySample {
  label: string
  detail?: string
  at: number
  heapUsed: number
  heapTotal: number
  heapLimit: number
  /** 与上一次采样相比的增量（字节，可为负）。 */
  delta: number
}

interface HeapReading {
  used: number
  total: number
  limit: number
}

/** 环形缓冲上限：只保留最近 400 条，够看出形态又不会自己变成内存问题。 */
const MAX_SAMPLES = 400
/** 控制台输出节流（毫秒）：打点可能很密，但日志不必每条都打。 */
const CONSOLE_THROTTLE_MS = 1000

const samples: MemorySample[] = []
const listeners = new Set<() => void>()
let enabledProvider: () => boolean = () => false
let baseline: number | null = null
let peak: MemorySample | null = null
let lastConsoleAt = 0

function readHeap(): HeapReading | null {
  try {
    const perf = typeof performance === 'undefined' ? undefined : performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
    }
    const memory = perf?.memory
    if (!memory) return null
    return { used: memory.usedJSHeapSize, total: memory.totalJSHeapSize, limit: memory.jsHeapSizeLimit }
  } catch {
    return null
  }
}

/** 当前运行时是否提供堆读数（只有 Chromium 系暴露 `performance.memory`）。 */
export function isMemoryProbeSupported(): boolean {
  return readHeap() !== null
}

/** 把开关接到渲染层的 debug store（与 Prompt 追踪同一套模式）。 */
export function configureMemoryProbe(provider: { enabled: () => boolean }): void {
  enabledProvider = provider.enabled
}

export function isMemoryProbeEnabled(): boolean {
  try {
    return enabledProvider() === true
  } catch {
    return false
  }
}

/** 清空采样与峰值。打开开关时调用，让"这一轮峰值"从零开始。 */
export function resetMemoryProbe(): void {
  samples.length = 0
  baseline = null
  peak = null
  lastConsoleAt = 0
  notify()
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // 订阅方出错不能影响打点。
    }
  }
}

export function subscribeMemoryProbe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

/**
 * 记一次内存采样。
 *
 * @param label 稳定的短标签（用于聚合），例如 `prompt.build` / `trace.flush`。
 * @param detail 可选补充（不要塞大字符串，只放 key / 计数这类短值）。
 */
export function markMemory(label: string, detail?: string): void {
  if (!isMemoryProbeEnabled()) return
  const heap = readHeap()
  if (!heap) return
  const previous = samples.length > 0 ? samples[samples.length - 1]!.heapUsed : null
  if (baseline === null) baseline = heap.used
  const sample: MemorySample = {
    label,
    ...(detail ? { detail } : {}),
    at: Date.now(),
    heapUsed: heap.used,
    heapTotal: heap.total,
    heapLimit: heap.limit,
    delta: previous === null ? 0 : heap.used - previous,
  }
  samples.push(sample)
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES)
  if (!peak || sample.heapUsed > peak.heapUsed) peak = sample

  const now = Date.now()
  if (now - lastConsoleAt >= CONSOLE_THROTTLE_MS) {
    lastConsoleAt = now
    console.info(
      `[mem] ${label}${detail ? `(${detail})` : ''} `
        + `used=${mb(sample.heapUsed)}MB delta=${mb(sample.delta)}MB peak=${mb(peak.heapUsed)}MB`,
    )
  }
  notify()
}

export interface MemoryProbeReport {
  supported: boolean
  enabled: boolean
  /** 当前堆用量（字节）；无读数时为 0。 */
  current: number
  /** 开启开关时的基线堆用量。 */
  baseline: number | null
  /** 本轮峰值及其归属标签。 */
  peak: number
  peakLabel: string | null
  peakDetail: string | null
  samples: number
  /** 按标签聚合：最大单次增量、累计增量、次数。用来回答"谁在涨"。 */
  topLabels: Array<{ label: string; maxDelta: number; totalDelta: number; count: number }>
}

export function memoryProbeReport(): MemoryProbeReport {
  const heap = readHeap()
  if (heap && baseline === null) baseline = heap.used
  const byLabel = new Map<string, { maxDelta: number; totalDelta: number; count: number }>()
  for (const sample of samples) {
    const entry = byLabel.get(sample.label) ?? { maxDelta: 0, totalDelta: 0, count: 0 }
    entry.maxDelta = Math.max(entry.maxDelta, sample.delta)
    entry.totalDelta += sample.delta
    entry.count += 1
    byLabel.set(sample.label, entry)
  }
  const topLabels = [...byLabel.entries()]
    .map(([label, entry]) => ({ label, ...entry }))
    .sort((left, right) => right.maxDelta - left.maxDelta)
    .slice(0, 8)
  return {
    supported: isMemoryProbeSupported(),
    enabled: isMemoryProbeEnabled(),
    current: heap?.used ?? 0,
    baseline,
    peak: peak?.heapUsed ?? 0,
    peakLabel: peak?.label ?? null,
    peakDetail: peak?.detail ?? null,
    samples: samples.length,
    topLabels,
  }
}

export function memoryProbeSamples(): readonly MemorySample[] {
  return samples
}

/**
 * 单行摘要，供面板直接显示。
 * 形如：`当前 1234MB · 峰值 9876MB(prompt.build) · 基线 456MB`
 */
export function memoryProbeSummary(): string {
  const report = memoryProbeReport()
  if (!report.supported) return '当前运行时没有堆读数（仅 Chromium 系支持）'
  const peak = report.peakLabel ? `峰值 ${mb(report.peak)}MB(${report.peakLabel})` : `峰值 ${mb(report.peak)}MB`
  const base = report.baseline === null ? '' : ` · 基线 ${mb(report.baseline)}MB`
  return `当前 ${mb(report.current)}MB · ${peak}${base} · ${report.samples} 次采样`
}

/** 供 DevTools 控制台手动查询/重置。仅在浏览器环境挂载。 */
export function installMemoryProbeConsoleHandle(): void {
  if (typeof window === 'undefined') return
  const host = window as Window & { __memoryProbe?: unknown }
  host.__memoryProbe = { report: memoryProbeReport, samples: memoryProbeSamples, reset: resetMemoryProbe, summary: memoryProbeSummary }
}
