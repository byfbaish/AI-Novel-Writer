import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createSingleCallWatchdog,
  DEFAULT_SINGLE_CALL_TIMEOUT_MS,
  resolveSingleCallTimeoutMs,
} from '../generation-call-timeout'

afterEach(() => { vi.useRealTimers() })

describe('单次调用超时上限（D9 配置）', () => {
  it('默认 10 分钟且写死为常量', () => {
    expect(DEFAULT_SINGLE_CALL_TIMEOUT_MS).toBe(600_000)
    expect(resolveSingleCallTimeoutMs()).toBe(600_000)
    expect(resolveSingleCallTimeoutMs(null)).toBe(600_000)
  })

  it('可配置：有效正整数覆盖，非法值回默认', () => {
    expect(resolveSingleCallTimeoutMs(30_000)).toBe(30_000)
    expect(resolveSingleCallTimeoutMs(1)).toBe(1)
    expect(resolveSingleCallTimeoutMs(0)).toBe(600_000)
    expect(resolveSingleCallTimeoutMs(-1)).toBe(600_000)
    expect(resolveSingleCallTimeoutMs(1.5)).toBe(600_000)
    expect(resolveSingleCallTimeoutMs(Number.NaN)).toBe(600_000)
  })
})

describe('单次调用三态（D9 假时钟）', () => {
  it('生成中 → 超时已中止：到默认 10 分钟才切换，onTimeout 触发', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const watchdog = createSingleCallWatchdog({ onTimeout })
    watchdog.start()
    expect(watchdog.phase).toBe('generating')
    vi.advanceTimersByTime(DEFAULT_SINGLE_CALL_TIMEOUT_MS - 1)
    expect(watchdog.phase).toBe('generating')
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(watchdog.phase).toBe('timed-out')
    expect(onTimeout).toHaveBeenCalledOnce()
  })

  it('调用失败：fail() 切换为 failed，onFailure 触发，且撤掉超时计时器', () => {
    vi.useFakeTimers()
    const onFailure = vi.fn()
    const onTimeout = vi.fn()
    const watchdog = createSingleCallWatchdog({ onFailure, onTimeout })
    watchdog.start()
    watchdog.fail()
    expect(watchdog.phase).toBe('failed')
    expect(onFailure).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(DEFAULT_SINGLE_CALL_TIMEOUT_MS * 2)
    expect(onTimeout).not.toHaveBeenCalled()
    expect(watchdog.phase).toBe('failed')
  })

  it('可配置上限生效（不必等 10 分钟）', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const watchdog = createSingleCallWatchdog({ timeoutMs: 2_000, onTimeout })
    watchdog.start()
    vi.advanceTimersByTime(1_999)
    expect(watchdog.phase).toBe('generating')
    vi.advanceTimersByTime(1)
    expect(watchdog.phase).toBe('timed-out')
  })

  it('dispose() 后不再触发超时', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const watchdog = createSingleCallWatchdog({ onTimeout })
    watchdog.start()
    watchdog.dispose()
    vi.advanceTimersByTime(DEFAULT_SINGLE_CALL_TIMEOUT_MS * 2)
    expect(onTimeout).not.toHaveBeenCalled()
    expect(watchdog.phase).toBe('generating')
  })
})
