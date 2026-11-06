/**
 * D8（2026-11-06 第八轮）：卷/单元路线提交时，**只作废未完成批次的残本**。
 *
 * ## 为什么不能用 `resetSynopsisCheckpoint` / `clearArchStepCheckpoint`
 *
 * 那两个动作删的是 `SYNOPSIS_CHECKPOINT_KEYS` 的 14 键整表，里面有
 * `synopsis_covered_to` / `synopsis_unit_cursor` / `synopsis_volume_deviations`
 * —— 删掉就掐断 E3 的反馈收敛闭环，还会造出 `coveredTo=0 && dbCoveredTo>0`
 * 触发防误删守卫。它们属于「重置 / 级联清空」，语义与本动作完全不同。
 *
 * ## 为什么 `synopsis_range` / 完成态 `synopsis_result` 一律保留
 *
 * 完成态这两个键是「上一批写到哪 / 上一批正文」的**记账**，不是残本：
 * 卷单元路线下一批续批会硬查 `synopsis_range` 做指纹复算
 * （`architecture.command.ts` 的续批分支 `:3516/:3532`、完成落盘 `:3944`、
 * D17 `outlineWrittenRange` `:4335`）。清掉它们，等于把「残本堵住下一次生成」
 * 换成「续批检查点缺少上一批范围」——另一种堵，而且堵在反馈收敛链上。
 *
 * ## 三层事实（§12.10.1）
 *
 * ① 作者看见的候选：`mainOwned` 时来自主进程 `generation:read-context`
 *    （检查点里没有 `synopsis_result`），非 `mainOwned` 才是检查点里的半成品；
 * ② 闸门旗标：`synopsis_incomplete === true`，探针与命令侧都读它；
 * ③ 下一批记账：`synopsis_range` / 进度 / 游标 / 偏差账 / 指纹链。
 *
 * 本模块只处理 ②（以及它附着的那份残本正文）；① 由事件通知界面层失效；
 * ③ 一个键都不碰。**完成态 ⇒ 不写文件**（空操作）。
 */

import { ipc } from '../ipc-client'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { globalEventBus } from '../../shared/event-bus'
import { synopsisUnitCheckpointPath } from './synopsis-unit-launch'

/** 只有 `synopsis_incomplete === true` 时才会被删的键；完成态一律不动。 */
export const SYNOPSIS_CANDIDATE_DISCARD_KEYS = [
  'synopsis_incomplete',
  'synopsis_generation_handle',
] as const

export interface SynopsisCandidateDiscardPlan {
  /** `false` = 完成态 / 无残本：调用方必须直接返回，不许写检查点文件。 */
  readonly discard: boolean
  readonly keys: readonly string[]
}

/**
 * 纯函数，便于单测把「完成态不误伤」钉死。
 *
 * `synopsis_result` 只在**中断态**才是残本正文，且主进程持有的形态下它已被
 * `persistInterruptedSynopsis` 删掉 ⇒ 有则删、无则不补。
 */
export function synopsisCandidateDiscardPlan(
  raw: Record<string, unknown>,
): SynopsisCandidateDiscardPlan {
  if (raw.synopsis_incomplete !== true) return { discard: false, keys: [] }
  const keys: string[] = [...SYNOPSIS_CANDIDATE_DISCARD_KEYS]
  if ('synopsis_result' in raw) keys.push('synopsis_result')
  return { discard: true, keys }
}

export type SynopsisCandidateDiscardResult =
  | { readonly ok: true; readonly discarded: number }
  | { readonly ok: false; readonly error: string }

/** 只作废检查点里的残本旗标。文件不存在 / 完成态 ⇒ 成功且 `discarded=0`。 */
export async function discardSynopsisCandidate(
  projectSession: ProjectSessionContext,
): Promise<SynopsisCandidateDiscardResult> {
  const path = synopsisUnitCheckpointPath(projectSession.projectPath)
  let raw: Record<string, unknown>
  try {
    const read = await ipc.invokeWithProjectSession(
      projectSession,
      'fs:read-json',
      path,
      projectSession.projectPath,
    )
    if (read?.success && read.data && typeof read.data === 'object') {
      raw = { ...(read.data as Record<string, unknown>) }
    } else if (read?.reason === 'invalid-json' || read?.reason === 'unreadable' || read?.reason === 'denied') {
      // 文件读不出来 ⇒ 没有可判定的旗标，也不该覆盖成空对象（那会抹掉别人的进度）。
      return { ok: false, error: String(read.reason) }
    } else {
      return { ok: true, discarded: 0 }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const plan = synopsisCandidateDiscardPlan(raw)
  if (!plan.discard) return { ok: true, discarded: 0 }
  for (const key of plan.keys) delete raw[key]
  try {
    const write = await ipc.invokeWithProjectSession(
      projectSession,
      'fs:write-json',
      path,
      raw,
      projectSession.projectPath,
    )
    if (write?.success === false) return { ok: false, error: write.error ?? '写入情节大纲检查点失败' }
    return { ok: true, discarded: plan.keys.length }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * **提交被接受之后、生成启动之前**调用（两个生产入口共用）。
 *
 * 数据层作废残本 ⇒ 发事件让三处界面派生视图连坐失效。事件是**读侧失效**，
 * 不是写侧第二次删除；上游级联清空也复用这个事件（数据层照既有语义）。
 * 清场失败必须让提交停下：否则作者会带着一份仍在堵路的 `incomplete` 起新 run。
 */
export async function applySynopsisRouteSubmit(
  projectSession: ProjectSessionContext,
  reason: 'submit' | 'upstream-clear' = 'submit',
): Promise<void> {
  const result = await discardSynopsisCandidate(projectSession)
  if (!result.ok) {
    throw new Error(`情节大纲候选清场失败，本次生成未启动：${result.error}`)
  }
  globalEventBus.emit('SYNOPSIS_CANDIDATE_DISCARDED', {
    projectPath: projectSession.projectPath,
    projectSession,
    reason,
  })
}

/** 上游级联清空 / 显式重置：数据层照旧，只补「界面派生视图跟着失效」。 */
export function notifySynopsisCandidateDiscarded(
  projectSession: ProjectSessionContext,
): void {
  globalEventBus.emit('SYNOPSIS_CANDIDATE_DISCARDED', {
    projectPath: projectSession.projectPath,
    projectSession,
    reason: 'upstream-clear',
  })
}
