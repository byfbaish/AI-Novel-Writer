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
  /** 中断批次的半成品正文；只用来判断「这个 incomplete 标记背后到底有没有东西可续」。 */
  readonly synopsis_result?: string | null
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

/** 探针跳过单元模式的原因。**每个分支都必须能在界面上说清楚**，否则现场只会看到「没反应」。 */
export type SynopsisUnitSkipReason =
  | 'flag-off'
  | 'invalid-total'
  | 'incomplete'
  | 'no-cursor'
  | 'compute-null'
  /** 探针自己抛了异常（**绝不能因此拦住生成**，但也必须被看见）。 */
  | 'probe-error'

export interface SynopsisUnitProbeResult {
  /** 算出的单元；`null` = 本次不走单元模式。 */
  readonly unit: ArchitectureUnitRange | null
  /** `null` = 进了单元模式。 */
  readonly reason: SynopsisUnitSkipReason | null
  /** 检查点里的已覆盖章数（读不到文件时为 0）。 */
  readonly coveredTo: number
  /** 是否真的读到了 `<项目>/.ai-novel/partial_arch.json`。路径/项目格式不对时是 `false`。 */
  readonly checkpointFound: boolean
  /** 老检查点没有游标、本次是**预览推导**出来的（命令侧会落盘同一个值）。 */
  readonly cursorDerived: boolean
  /** `probe-error` 时的原始报错文本。 */
  readonly detail?: string
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

export interface SynopsisUnitCheckpointRead {
  readonly checkpoint: SynopsisUnitCheckpoint
  readonly found: boolean
}

/** 读检查点；**不抛错**（读不到就是「全书未开始」，同时把 found 标出来供诊断用）。 */
export async function readSynopsisUnitCheckpointWithStatus(
  projectSession: ProjectSessionContext,
): Promise<SynopsisUnitCheckpointRead> {
  try {
    const result = await ipc.invokeWithProjectSession(
      projectSession,
      'fs:read-json',
      synopsisUnitCheckpointPath(projectSession.projectPath),
      projectSession.projectPath,
    )
    if (result.success && result.data && typeof result.data === 'object') {
      return { checkpoint: result.data as SynopsisUnitCheckpoint, found: true }
    }
    return { checkpoint: {}, found: false }
  } catch {
    return { checkpoint: {}, found: false }
  }
}

export async function readSynopsisUnitCheckpoint(
  projectSession: ProjectSessionContext,
): Promise<SynopsisUnitCheckpoint> {
  return (await readSynopsisUnitCheckpointWithStatus(projectSession)).checkpoint
}

/**
 * 探针主体：把「为什么没进单元模式」也带出来（`resolveSynopsisUnitLaunch` 只关心结果）。
 *
 * 与命令侧同源的三处：
 * 1. `coveredTo` 直接取检查点的 `synopsis_covered_to`（命令侧同样读它，不拿正文重算）；
 * 2. `coveredTo = 0` 用 `INITIAL_SYNOPSIS_UNIT_CURSOR`；
 * 3. `coveredTo ≥ 1` 但没有游标 = 旧检查点，用 `deriveSynopsisUnitCursor` 预览一遍；
 *    命令侧在真正执行时会用同一个函数把游标**落盘**（`syncSynopsisUnitCursor`），
 *    这里只是不落盘地算出同一结果，好让 `approveUnitContext` 的复核通过。
 */
export async function probeSynopsisUnitLaunch(
  input: SynopsisUnitLaunchInput,
): Promise<SynopsisUnitProbeResult> {
  const skip = (reason: SynopsisUnitSkipReason, coveredTo = 0, checkpointFound = false, cursorDerived = false): SynopsisUnitProbeResult =>
    Object.freeze({ unit: null, reason, coveredTo, checkpointFound, cursorDerived })

  if (!synopsisUnitLaunchEnabled(input.storage)) return skip('flag-off')
  const totalChapters = Number(input.totalChapters)
  if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return skip('invalid-total')

  const { checkpoint, found } = await readSynopsisUnitCheckpointWithStatus(input.projectSession)
  const coveredTo = Number.isSafeInteger(checkpoint.synopsis_covered_to)
    ? Number(checkpoint.synopsis_covered_to)
    : 0
  // 有未完成批次时单元模式语义未定（中断续写走 resumeSynopsis，不是「再写一个单元」），
  // 探针阶段直接退回按章区间，避免重复生成同一单元。
  // ⚠️ 例外：批前预写的空标记（`covered_to=0` 且没有半成品正文）背后没有任何可续内容
  //    ——那是「刚才那批一个字都没落库」留下的，视同未开始，否则一次失败就会把单元模式锁死。
  if (checkpoint.synopsis_incomplete === true) {
    const resumable = (typeof checkpoint.synopsis_result === 'string' && checkpoint.synopsis_result.trim().length > 0)
      || coveredTo > 0
    if (resumable) return skip('incomplete', coveredTo, found)
  }
  const { computeSynopsisUnitRange, deriveSynopsisUnitCursor, INITIAL_SYNOPSIS_UNIT_CURSOR } =
    await import('./commands/architecture.command')
  const explicitCursor = checkpoint.synopsis_unit_cursor ?? null
  const cursor = explicitCursor
    ?? (coveredTo >= 1
      ? deriveSynopsisUnitCursor(input.plotStructurePlan, totalChapters, coveredTo)
      : INITIAL_SYNOPSIS_UNIT_CURSOR)
  if (!cursor) return skip('no-cursor', coveredTo, found)
  const unit = computeSynopsisUnitRange(input.plotStructurePlan, totalChapters, cursor, coveredTo)
  if (!unit) return skip('compute-null', coveredTo, found, explicitCursor === null)
  return Object.freeze({ unit, reason: null, coveredTo, checkpointFound: found, cursorDerived: explicitCursor === null })
}

/**
 * 由落库检查点算出「本次要写的单元」。返回 `null` 表示**本次不走单元模式**，
 * 调用方应原样退回按章区间（fail-open：开关只是探针，不能把生成拦死）。
 */
export async function resolveSynopsisUnitLaunch(
  input: SynopsisUnitLaunchInput,
): Promise<ArchitectureUnitRange | null> {
  return (await probeSynopsisUnitLaunch(input)).unit
}

/**
 * 组件侧便捷版：连弧光结构一起读（调用方不必自己再发一次 `db:project-core-get`）。
 * **永不抛错**——探针只是探针，任何异常都必须退化成 `probe-error` 并让人看见，
 * 绝不允许它把整次生成拦住（这正是 2026-10-20 实机「点了没反应」的教训）。
 */
export async function probeSynopsisUnitLaunchForProject(input: {
  readonly projectSession: ProjectSessionContext
  readonly totalChapters: number
  readonly storage?: Pick<Storage, 'getItem'> | null
}): Promise<SynopsisUnitProbeResult> {
  try {
    let plotStructurePlan: string | undefined
    try {
      const core = await ipc.invokeWithProjectSession(input.projectSession, 'db:project-core-get', input.projectSession.projectPath)
      plotStructurePlan = core?.plotStructurePlan ?? undefined
    } catch {
      plotStructurePlan = undefined
    }
    return await probeSynopsisUnitLaunch({
      projectSession: input.projectSession,
      totalChapters: input.totalChapters,
      plotStructurePlan,
      storage: input.storage,
    })
  } catch (error) {
    return Object.freeze({
      unit: null,
      reason: 'probe-error' as const,
      coveredTo: 0,
      checkpointFound: false,
      cursorDerived: false,
      detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    })
  }
}

/** 原因 → 给人看的一句话（探针阶段唯一的解释来源，别再让现场「看不到任何信息」）。 */
export function describeSynopsisUnitProbe(result: SynopsisUnitProbeResult): string {
  switch (result.reason) {
    case null:
      return `已进单元模式：第 ${result.unit!.unitIndex} 个单元，从第 ${result.unit!.from} 章起`
        + `（名义上界 ${result.unit!.maxChapters} 章 / 本卷剩余 ${result.unit!.volumeRemaining} 章）`
        + (result.cursorDerived ? '｜游标按已写章推导（命令侧会落盘）' : '')
    case 'flag-off':
      return `开关没打开：localStorage['${SYNOPSIS_UNIT_LAUNCH_FLAG}'] 不是 "1"`
    case 'invalid-total':
      return '读不到有效的全书总章数（novelConfig.totalChapters），无法折算单元上界'
    case 'incomplete':
      return '检查点里有未完成批次（synopsis_incomplete=true）：中断续写语义未定，本次走按章区间'
    case 'no-cursor':
      return `推不出单元游标：已覆盖第 ${result.coveredTo} 章，`
        + (result.checkpointFound ? '骨架里可能没有「### 单元」划界' : `且没读到 ${CANONICAL_PROJECT_DIRECTORY}/partial_arch.json`)
    case 'compute-null':
      return `单元定位失败：已覆盖第 ${result.coveredTo} 章`
        + (result.checkpointFound ? '' : `（没读到 ${CANONICAL_PROJECT_DIRECTORY}/partial_arch.json）`)
    case 'probe-error':
      return `探针自身报错，已退回按章区间：${result.detail ?? '未知错误'}`
  }
}

/** 探针结果上报：`console.warn`（不会被 Info 级别过滤器吃掉）+ 挂到 `window` 便于现场自查。 */
export function reportSynopsisUnitProbe(result: SynopsisUnitProbeResult): void {
  try {
    const message = `[E3] ${describeSynopsisUnitProbe(result)}`
    if (result.reason === null) console.warn(message)
    else console.warn(`${message}（reason=${result.reason}）`)
    ;(globalThis as Record<string, unknown>).__e3UnitProbe = result
  } catch {
    // 诊断失败不影响生成
  }
}
