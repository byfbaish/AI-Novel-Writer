/**
 * 通知提示音的 Web Audio 合成（N2·§4.4）
 *
 * 为什么不放音频文件：仓库卫生（不引二进制）、无版权问题、跨平台听感一致，
 * 音量 / 静音 / 试听全部由 config 控制。**合成参数只在这一处**，
 * 将来想换成采样文件，改 `TONE_SPECS` 一个表就够（`public/sounds/` 路径预留）。
 *
 * 为什么在渲染进程：主进程没有零依赖的音频方案（设计稿 §4.1）。主进程发的
 * OS toast 恒 `silent: true`，声音由这里负责，否则两套声音会一起响、音量开关也管不住。
 */

import type { SystemNotificationSound } from '../../shared/system-notification'

/** 一个音的合成参数。`startAt` / `durationMs` 相对本次播放起点，单位毫秒。 */
interface ToneSpec {
  /** 基频（Hz）。 */
  frequency: number
  startAt: number
  durationMs: number
  type: OscillatorType
}

/**
 * 两个提示音的音型（设计稿 §4.4）：
 * - `complete` 两声上行轻钟 C5 → G5，正弦，各 ~120ms，指数衰减；
 * - `error` 单声低鸣 A4 → E4 下行，三角波，~200ms。
 *
 * 上行 / 下行是刻意的：不靠文字也能听出「成了」还是「没成」，两个音型
 * 在频率走向上相反，比换音色更容易分辨。
 */
const TONE_SPECS: Record<SystemNotificationSound, readonly ToneSpec[]> = {
  complete: [
    { frequency: 523.25, startAt: 0, durationMs: 120, type: 'sine' },
    { frequency: 783.99, startAt: 130, durationMs: 160, type: 'sine' },
  ],
  error: [
    { frequency: 440, startAt: 0, durationMs: 200, type: 'triangle' },
    { frequency: 329.63, startAt: 90, durationMs: 240, type: 'triangle' },
  ],
}

/** 默认音量，与 `DEFAULT_GLOBAL_CONFIG.notificationSoundVolume` 必须一致。 */
export const DEFAULT_NOTIFICATION_SOUND_VOLUME = 0.6

/**
 * 峰值系数：两个音可能叠在一起，直接用 volume 当峰值会削波。
 * 0.6 × 0.35 ≈ 0.21 峰值 —— 既能听见，又不会在戴耳机时炸耳朵。
 */
const PEAK_FACTOR = 0.35
/** 起音 12ms：从 0 直接跳到峰值会爆出「咔」声。 */
const ATTACK_SECONDS = 0.012

type AudioContextConstructor = new () => AudioContext

let context: AudioContext | null = null

/**
 * 懒建单例。**失败返回 null 而不是抛**：没有音频设备的机器（CI / 远程桌面）
 * 应该安静地不响，不该让一条通知把主流程带崩。
 */
function audioContext(): AudioContext | null {
  if (context) return context
  const global = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor }
  const Ctor = global.AudioContext ?? global.webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_NOTIFICATION_SOUND_VOLUME
  return Math.min(1, Math.max(0, volume))
}

function scheduleTone(ctx: AudioContext, spec: ToneSpec, peak: number): void {
  const startAt = ctx.currentTime + spec.startAt / 1000
  const endAt = startAt + spec.durationMs / 1000
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = spec.type
  oscillator.frequency.setValueAtTime(spec.frequency, startAt)
  // exponentialRamp 不接受 0，所以两头都用 0.0001（听觉上等于静音）。
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), startAt + ATTACK_SECONDS)
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  // 多留 20ms 再停：正好卡在 ramp 终点会切出尾音爆音。
  oscillator.stop(endAt + 0.02)
}

/**
 * 播一个提示音。同步返回、不阻塞调用方 —— 通知该弹还得弹，声音是附加物。
 *
 * 音量由调用方按 config 传入（`notificationSoundVolume` / `notificationSoundEnabled`）；
 * 这里不认识 config，也不该认识 —— 判据只有一处，两处判会分叉。
 */
export function playSystemNotificationSound(
  sound: SystemNotificationSound,
  options: { volume?: number } = {},
): void {
  const ctx = audioContext()
  if (!ctx) return
  const volume = clampVolume(options.volume ?? DEFAULT_NOTIFICATION_SOUND_VOLUME)
  if (volume <= 0) return

  // 浏览器策略下新建的 context 可能处于 suspended；resume 失败就算了，
  // 下一次（通常是用户手势里的「试听」）会成功。
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

  const peak = volume * PEAK_FACTOR
  for (const spec of TONE_SPECS[sound]) scheduleTone(ctx, spec, peak)
}

/** 仅供测试：丢掉单例，让下一次播放重新建（jsdom 里没有 AudioContext，不建）。 */
export function resetSystemNotificationAudio(): void {
  if (!context) return
  void context.close().catch(() => {})
  context = null
}
