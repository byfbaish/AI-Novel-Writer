import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  configureMemoryProbe,
  isMemoryProbeEnabled,
  isMemoryProbeSupported,
  markMemory,
  memoryProbeReport,
  memoryProbeSamples,
  memoryProbeSummary,
  resetMemoryProbe,
} from '../memory-probe'

/** 用可变的假堆替换 performance.memory（只有 Chromium 暴露它，Node 里没有）。 */
function installFakeHeap(initialUsed = 100 * 1024 * 1024) {
  const heap = {
    usedJSHeapSize: initialUsed,
    totalJSHeapSize: initialUsed * 2,
    jsHeapSizeLimit: 4096 * 1024 * 1024,
  }
  Object.defineProperty(performance, 'memory', { configurable: true, value: heap })
  return heap
}

let enabled = false

afterEach(() => {
  enabled = false
  configureMemoryProbe({ enabled: () => enabled })
  resetMemoryProbe()
  Reflect.deleteProperty(performance, 'memory')
  vi.restoreAllMocks()
})

describe('memory probe', () => {
  it('is a no-op while disabled', () => {
    installFakeHeap()
    configureMemoryProbe({ enabled: () => enabled })

    markMemory('prompt.build')

    expect(memoryProbeSamples()).toHaveLength(0)
    expect(memoryProbeReport().samples).toBe(0)
    expect(isMemoryProbeEnabled()).toBe(false)
  })

  it('records heap usage, per-mark delta, and the peak owner', () => {
    const heap = installFakeHeap(100 * 1024 * 1024)
    enabled = true
    resetMemoryProbe()
    vi.spyOn(console, 'info').mockImplementation(() => {})

    markMemory('prompt.build', 'first_chapter_draft')
    heap.usedJSHeapSize = 300 * 1024 * 1024
    markMemory('trace.flush')
    heap.usedJSHeapSize = 200 * 1024 * 1024
    markMemory('panel.llm-history', 'records=30')

    const samples = memoryProbeSamples()
    expect(samples).toHaveLength(3)
    expect(samples[0]).toMatchObject({ label: 'prompt.build', detail: 'first_chapter_draft', delta: 0 })
    // delta 是相对上一条采样，而不是相对基线
    expect(samples[1]!.delta).toBe(200 * 1024 * 1024)
    expect(samples[2]!.delta).toBe(-100 * 1024 * 1024)

    const report = memoryProbeReport()
    expect(report.peak).toBe(300 * 1024 * 1024)
    expect(report.peakLabel).toBe('trace.flush')
    expect(report.baseline).toBe(100 * 1024 * 1024)
    expect(report.current).toBe(200 * 1024 * 1024)
    // topLabels 按最大单次增量排序：本次是 trace.flush 从 100MB 跳到 300MB
    expect(report.topLabels[0]).toMatchObject({ label: 'trace.flush', maxDelta: 200 * 1024 * 1024 })
  })

  it('aggregates by label so the biggest growth source is visible', () => {
    const heap = installFakeHeap(100 * 1024 * 1024)
    enabled = true
    resetMemoryProbe()
    vi.spyOn(console, 'info').mockImplementation(() => {})

    markMemory('panel.llm-history')
    heap.usedJSHeapSize += 50 * 1024 * 1024
    markMemory('panel.llm-history')
    heap.usedJSHeapSize += 120 * 1024 * 1024
    markMemory('panel.llm-history')
    heap.usedJSHeapSize += 10 * 1024 * 1024
    markMemory('prompt.build')

    const report = memoryProbeReport()
    const panel = report.topLabels.find(entry => entry.label === 'panel.llm-history')
    expect(panel).toMatchObject({ count: 3, maxDelta: 120 * 1024 * 1024 })
    // 累计增量也保留，便于判断是"持续 churn"还是"单次暴涨"
    // 首条采样没有上一条可比较，delta 记 0，所以累计是 50 + 120 = 170MB
    expect(panel!.totalDelta).toBe(170 * 1024 * 1024)
    expect(report.topLabels[0]!.label).toBe('panel.llm-history')
  })

  it('resets samples, baseline and peak together', () => {
    const heap = installFakeHeap(100 * 1024 * 1024)
    enabled = true
    resetMemoryProbe()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    markMemory('prompt.build')
    heap.usedJSHeapSize = 500 * 1024 * 1024
    markMemory('prompt.build')

    resetMemoryProbe()

    expect(memoryProbeSamples()).toHaveLength(0)
    expect(memoryProbeReport()).toMatchObject({ peak: 0, peakLabel: null, samples: 0 })
  })

  it('reports unsupported when the runtime exposes no heap readings', () => {
    enabled = true
    resetMemoryProbe()
    Reflect.deleteProperty(performance, 'memory')

    markMemory('prompt.build')

    expect(isMemoryProbeSupported()).toBe(false)
    expect(memoryProbeSamples()).toHaveLength(0)
    expect(memoryProbeSummary()).toContain('没有堆读数')
  })
})
