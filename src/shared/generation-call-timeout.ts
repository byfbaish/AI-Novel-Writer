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

/** D9 单次调用超时的稳定失败码：判据是**时长**，与传输层超时（NETWORK_ERROR）分档。 */
export const GENERATION_CALL_TIMEOUT_FAILURE_CODE = 'GENERATION_CALL_TIMEOUT' as const

export type GenerationCallTimeoutFailureCode = typeof GENERATION_CALL_TIMEOUT_FAILURE_CODE

/**
 * D9：同一条 deadline 的时长 = min(root 剩余预算, 单次调用上限)。
 * 纯函数，便于在不依赖 native sqlite 的单测里固定两个取值方向。
 */
export function resolveCallDeadlineMs(budgetRemainingMs: number, capMs: number = DEFAULT_SINGLE_CALL_TIMEOUT_MS): number {
  const remaining = Number.isFinite(budgetRemainingMs) ? budgetRemainingMs : 0
  return Math.max(0, Math.min(remaining, capMs))
}

export type DeadlineTimeoutFailureCode = GenerationCallTimeoutFailureCode | 'ROOT_BUDGET_EXHAUSTED'

/** 同一条 deadline 的「时长 + 超时归属」：预算比上限大 ⇒ 这次是单次调用超时；否则是 root 预算耗尽。 */
export function resolveCallDeadline(budgetRemainingMs: number, capMs: number = DEFAULT_SINGLE_CALL_TIMEOUT_MS): {
  deadlineMs: number
  failureCode: DeadlineTimeoutFailureCode
} {
  return {
    deadlineMs: resolveCallDeadlineMs(budgetRemainingMs, capMs),
    failureCode: budgetRemainingMs > capMs ? GENERATION_CALL_TIMEOUT_FAILURE_CODE : 'ROOT_BUDGET_EXHAUSTED',
  }
}

/**
 * D9 顺序不变量：先置超时标记，再写 root 的失败码，最后才 abort。
 * 抽成纯函数是为了能在不依赖 native sqlite 的层断言调用顺序（生产调用点唯一）。
 */
export function runDeadlineTimeout(input: {
  failureCode: DeadlineTimeoutFailureCode
  markTimedOut: () => void
  block: (code: DeadlineTimeoutFailureCode) => void
  abort: () => void
}): void {
  input.markTimedOut()
  input.block(input.failureCode)
  input.abort()
}

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
