/**
 * D9：单次模型调用的超时上限与三态观测。
 *
 * 缺陷稿实测：单章大纲调用 12 分钟未返回，UI 无法区分「在算」与「已死」。
 * 默认上限取 **10 分钟**（`10 * 60 * 1000`）—— 比实测挂起时长低一档的整数分钟值，
 * 写死为常量；需要覆盖时用 `resolveSingleCallTimeoutMs(configured)`（可配置）。
 *
 * 本模块只做观测与超时判定，**不改既有生成状态机行为**：超时 / 失败时通过注入回调
 * 通知调用方，由调用方复用 D2 的失败终态落库路径
 * （见 `electron/services/generation-run-timeout.ts` 的 `finalizeFailedGeneration`）。
 */
export const DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000

/** 可配置上限：传入有效正整数则覆盖，否则回默认 10 分钟。 */
export function resolveSingleCallTimeoutMs(configured?: number | null): number {
  return typeof configured === 'number' && Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_SINGLE_CALL_TIMEOUT_MS
}

/** 三态：生成中 → 超时已中止 → 调用失败。 */
export type SingleCallPhase = 'generating' | 'timed-out' | 'failed'

export interface SingleCallWatchdog {
  readonly phase: SingleCallPhase
  /** 开始一次调用观测：进入「生成中」，起计时器。 */
  start(): void
  /** 调用失败（区别于超时）：进入「调用失败」，撤掉计时器。 */
  fail(): void
  /** 正常结束 / 卸载：撤掉计时器，不再触发超时。 */
  dispose(): void
}

export interface SingleCallWatchdogOptions {
  timeoutMs?: number | null
  /** 超时已中止：调用方应在此复用 D2 失败终态落库。 */
  onTimeout?: () => void
  /** 调用失败：同样应落失败终态。 */
  onFailure?: () => void
}

export function createSingleCallWatchdog(options: SingleCallWatchdogOptions = {}): SingleCallWatchdog {
  let phase: SingleCallPhase = 'generating'
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    get phase() { return phase },
    start() {
      clear()
      phase = 'generating'
      // 用全局 setTimeout：假时钟（vi.useFakeTimers）会替换它，三态可确定性断言。
      timer = setTimeout(() => {
        timer = null
        if (phase !== 'generating') return
        phase = 'timed-out'
        options.onTimeout?.()
      }, resolveSingleCallTimeoutMs(options.timeoutMs))
    },
    fail() {
      clear()
      // 终态不翻转：已超时的调用不再改写成「调用失败」。
      if (phase === 'timed-out') return
      phase = 'failed'
      options.onFailure?.()
    },
    dispose() { clear() },
  }
}
