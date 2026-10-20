import type { ArchitectureUnitRange } from '../../shared/generation-owner-contract'
import { CANONICAL_PROJECT_DIRECTORY } from '../../shared/project-format'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { ipc } from '../ipc-client'

/**
 * E3 逐单元批次的**发射侧**（T10 探针 → T11 正式开关）。
 *
 * 只为把「点一次 = 一个单元」变成可触发：请求期拿落库游标算出本次单元，
 * 交给 `launchCreativeWorkflow`；**判定逻辑一行都不在这里**——范围由
 * `computeSynopsisUnitRange`（与命令侧同一份实现）算出，命令侧 `approveUnitContext`
 * 仍会按游标复核一遍，过期请求照旧 fail-closed。
 *
 * 开关关掉时本模块不产生任何行为，调用方原样走 `synopsisRange`。
 */
export const SYNOPSIS_UNIT_LAUNCH_FLAG = 'aiNovel:e3-unit-batch'

/** 检查点里本模块真正读的字段（其余字段由命令侧拥有，这里不看）。 */
export interface SynopsisUnitCheckpoint {
  readonly synopsis_covered_to?: number
  readonly synopsis_incomplete?: boolean
  readonly synopsis_unit_cursor?: {
    readonly volumeIndex: number
    readonly unitIndex: number
    readonly writtenInVolume: number
  } | null
}

export interface SynopsisUnitLaunchInput {
  readonly projectSession: ProjectSessionContext
  readonly totalChapters: number
  /** 弧光结构正文（`db:project-core-get` 的 `plotStructurePlan`）；没有骨架就无法定位单元。 */
  readonly plotStructurePlan: string | undefined
  /** 便于测试注入；缺省读 `window.localStorage`。 */
  readonly storage?: Pick<Storage, 'getItem'> | null
}

/** 开关读取失败（隐私模式 / 非浏览器环境）一律视为关闭。 */
export function synopsisUnitLaunchEnabled(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const store = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
    return store?.getItem(SYNOPSIS_UNIT_LAUNCH_FLAG) === '1'
  } catch {
    return false
  }
}

export function synopsisUnitCheckpointPath(projectPath: string): string {
  return `${projectPath}/${CANONICAL_PROJECT_DIRECTORY}/partial_arch.json`
}

export async function readSynopsisUnitCheckpoint(
  projectSession: ProjectSessionContext,
): Promise<SynopsisUnitCheckpoint> {
  const result = await ipc.invokeWithProjectSession(
    projectSession,
    'fs:read-json',
    synopsisUnitCheckpointPath(projectSession.projectPath),
    projectSession.projectPath,
  )
  if (result.success && result.data && typeof result.data === 'object') {
    return result.data as SynopsisUnitCheckpoint
  }
  return {}
}

/**
 * 由落库检查点算出「本次要写的单元」。返回 `null` 表示**本次不走单元模式**，
 * 调用方应原样退回按章区间（fail-open：开关只是探针，不能把生成拦死）。
 *
 * 与命令侧同源的三处：
 * 1. `coveredTo` 直接取检查点的 `synopsis_covered_to`（命令侧同样读它，不拿正文重算）；
 * 2. `coveredTo = 0` 用 `INITIAL_SYNOPSIS_UNIT_CURSOR`；
 * 3. `coveredTo ≥ 1` 但没有游标 = 旧检查点，用 `deriveSynopsisUnitCursor` 预览一遍；
 *    命令侧在真正执行时会用同一个函数把游标**落盘**（`syncSynopsisUnitCursor`），
 *    这里只是不落盘地算出同一结果，好让 `approveUnitContext` 的复核通过。
 */
export async function resolveSynopsisUnitLaunch(
  input: SynopsisUnitLaunchInput,
): Promise<ArchitectureUnitRange | null> {
  if (!synopsisUnitLaunchEnabled(input.storage)) return null
  const totalChapters = Number(input.totalChapters)
  if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return null

  const checkpoint = await readSynopsisUnitCheckpoint(input.projectSession)
  // 有未完成批次时单元模式语义未定（中断续写走 resumeSynopsis，不是「再写一个单元」），
  // 探针阶段直接退回按章区间，避免重复生成同一单元。
  if (checkpoint.synopsis_incomplete === true) return null

  const coveredTo = Number.isSafeInteger(checkpoint.synopsis_covered_to)
    ? Number(checkpoint.synopsis_covered_to)
    : 0
  const { computeSynopsisUnitRange, deriveSynopsisUnitCursor, INITIAL_SYNOPSIS_UNIT_CURSOR } =
    await import('./commands/architecture.command')
  const cursor = checkpoint.synopsis_unit_cursor
    ?? (coveredTo >= 1
      ? deriveSynopsisUnitCursor(input.plotStructurePlan, totalChapters, coveredTo)
      : INITIAL_SYNOPSIS_UNIT_CURSOR)
  if (!cursor) return null
  return computeSynopsisUnitRange(input.plotStructurePlan, totalChapters, cursor, coveredTo)
}
