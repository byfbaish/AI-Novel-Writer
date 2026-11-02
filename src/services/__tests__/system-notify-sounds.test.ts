import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_NOTIFICATION_SOUND_VOLUME,
  playSystemNotificationSound,
  resetSystemNotificationAudio,
} from '../system-notify/sounds'

/** 记录参数写入，用于断言「上行 / 下行」与峰值。 */
class FakeAudioParam {
  readonly writes: Array<{ kind: 'set' | 'ramp'; value: number; at: number }> = []

  setValueAtTime(value: number, at: number): this {
    this.writes.push({ kind: 'set', value, at })
    return this
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.writes.push({ kind: 'ramp', value, at })
    return this
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam()
  readonly connect = vi.fn()
}

class FakeOscillator {
  type = 'sine'
  readonly frequency = new FakeAudioParam()
  readonly connect = vi.fn()
  readonly start = vi.fn()
  readonly stop = vi.fn()
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: 'suspended' | 'running' | 'closed' = 'running'
  currentTime = 0
  readonly destination = { name: 'destination' }
  readonly oscillators: FakeOscillator[] = []
  readonly gains: FakeGainNode[] = []
  readonly resume = vi.fn(async () => { this.state = 'running' })
  readonly close = vi.fn(async () => { this.state = 'closed' })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain
  }
}

function installFakeAudioContext(): void {
  FakeAudioContext.instances.length = 0
  ;(globalThis as unknown as { AudioContext?: unknown }).AudioContext = FakeAudioContext
}

function onlyContext(): FakeAudioContext {
  expect(FakeAudioContext.instances).toHaveLength(1)
  return FakeAudioContext.instances[0]!
}

beforeEach(() => {
  resetSystemNotificationAudio()
  installFakeAudioContext()
})

afterEach(() => {
  resetSystemNotificationAudio()
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext
})

describe('playSystemNotificationSound', () => {
  it('完成音是两声上行正弦（C5 → G5）', () => {
    playSystemNotificationSound('complete', { volume: 0.6 })
    const ctx = onlyContext()

    expect(ctx.oscillators.map(osc => osc.type)).toEqual(['sine', 'sine'])
    expect(ctx.oscillators.map(osc => osc.frequency.writes[0]!.value)).toEqual([523.25, 783.99])
    // 第二个音在后：上行感来自频率上升 + 时间错开。
    const firstStart = ctx.oscillators[0]!.start.mock.calls[0]![0] as number
    const secondStart = ctx.oscillators[1]!.start.mock.calls[0]![0] as number
    expect(secondStart).toBeGreaterThan(firstStart)
  })

  it('失败音是两声下行三角波（A4 → E4），与完成音在频率走向上相反', () => {
    playSystemNotificationSound('error', { volume: 0.6 })
    const ctx = onlyContext()

    expect(ctx.oscillators.map(osc => osc.type)).toEqual(['triangle', 'triangle'])
    const frequencies = ctx.oscillators.map(osc => osc.frequency.writes[0]!.value)
    expect(frequencies).toEqual([440, 329.63])
    expect(frequencies[0]!).toBeGreaterThan(frequencies[1]!)
  })

  it('峰值按音量缩放（不直接用 volume，避免两音叠加削波）', () => {
    playSystemNotificationSound('complete', { volume: 0.8 })
    const ctx = onlyContext()

    const peak = ctx.gains[0]!.gain.writes.find(write => write.kind === 'ramp')!.value
    expect(peak).toBeCloseTo(0.8 * 0.35, 5)
  })

  it('音量 0 不发声（静音就是静音，不留一个听不见的振荡器）', () => {
    playSystemNotificationSound('complete', { volume: 0 })
    // 音量判定在懒建 context 之后、排音之前 —— context 可能已建，但一个音都不排。
    const ctx = FakeAudioContext.instances[0]
    expect(ctx?.oscillators ?? []).toHaveLength(0)
  })

  it('音量越界被夹到 0–1，非法值退回默认音量', () => {
    playSystemNotificationSound('complete', { volume: 3 })
    const loudPeak = onlyContext().gains[0]!.gain.writes.find(write => write.kind === 'ramp')!.value
    expect(loudPeak).toBeCloseTo(0.35, 5)

    resetSystemNotificationAudio()
    installFakeAudioContext()
    playSystemNotificationSound('complete', { volume: Number.NaN })
    const fallbackPeak = onlyContext().gains[0]!.gain.writes.find(write => write.kind === 'ramp')!.value
    expect(fallbackPeak).toBeCloseTo(DEFAULT_NOTIFICATION_SOUND_VOLUME * 0.35, 5)
  })

  it('suspended 的 context 会被 resume（浏览器手势策略下新建的常是 suspended）', () => {
    class SuspendedContext extends FakeAudioContext {
      constructor() {
        super()
        this.state = 'suspended'
      }
    }
    FakeAudioContext.instances.length = 0
    ;(globalThis as unknown as { AudioContext?: unknown }).AudioContext = SuspendedContext

    playSystemNotificationSound('complete')
    const ctx = FakeAudioContext.instances[0]!
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('没有 Web Audio 时安静地不响，不抛错', () => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext
    expect(() => playSystemNotificationSound('complete')).not.toThrow()
  })

  it('AudioContext 构造失败也不抛（远程桌面 / 无音频设备）', () => {
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = class {
      constructor() {
        throw new Error('no audio device')
      }
    }
    expect(() => playSystemNotificationSound('error')).not.toThrow()
  })
})
