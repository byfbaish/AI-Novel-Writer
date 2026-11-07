import type { GenerationRunRepository } from '../repositories/generation-run-repository'

/**
 * D9：单次调用「超时已中止」/「调用失败」共用的失败终态落库。
 *
 * 复用 D2 的唯一终态写入点 `GenerationRunRepository.seal(rootId, 'failed')`
 * （`generation-run-repository.ts:709-742`，注释逐字「**唯一的终态写入点**」）：
 * 它把该 root 下所有 `running` / `paused` 的 run 改写成终态 `failed`，
 * 因此 `generation_runs` 不会留在 `running` / `paused`。
 *
 * 不另开终态写入点、不改其它生成状态机行为。`createSingleCallWatchdog` 的
 * `onTimeout` / `onFailure` 由调用方接到本函数，形成「物理无响应 → 失败终态」闭环。
 */
export function finalizeFailedGeneration(repository: GenerationRunRepository, rootId: string): void {
  repository.seal(rootId, 'failed')
}
