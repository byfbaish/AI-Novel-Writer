/**
 * 卷末交接开写闸门的**读侧与确认写入**（P1-2 期 2b，2026-10-24）。
 *
 * 只做三件事：并发读卷结构 / 交接单 / 已确认清单 → 交给 `volumeHandoffGateOf` 判定 →
 * 作者点头时往 `consistency_exemptions` 写一条带理由的确认。
 *
 * **fail-open 是刻意的**：这是一道「提醒你确认」的闸，不是数据校验。读失败、老项目没有这几张表，
 * 都不该让作者写不了下一章。判定不出 ⇒ 返回 `undefined`（= 本次不拦）。
 */
import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { ConsistencyExemption } from '../shared/consistency-preflight'
import type { VolumeHandoffDefinition } from '../shared/volume-handoff'
import {
  volumeHandoffAckKey,
  volumeHandoffGateOf,
  type VolumeHandoffGate,
} from '../shared/volume-handoff-gate'
import type { VolumeDefinition } from '../shared/volume-structure'
import { ipc } from './ipc-client'

export interface VolumeHandoffGateReadResult {
  /** `null` = 这一章不是任何一卷的第一章（不适用）。 */
  gate: VolumeHandoffGate | null
  /** 读取失败/降级时的可读原因（调用方决定要不要 log）。 */
  warning?: string
}

export async function readVolumeHandoffGate(input: {
  projectSession: ProjectSessionContext
  chapterNumber: number
}): Promise<VolumeHandoffGateReadResult> {
  const projectPath = input.projectSession.projectPath
  try {
    const [volumesResult, handoffsResult, exemptions] = await Promise.all([
      ipc.invokeWithProjectSession(input.projectSession, 'db:volumes-list', projectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:volume-handoffs-list', projectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:consistency-exemption-list', projectPath),
    ])
    if (!volumesResult?.success || !handoffsResult?.success) {
      return { gate: null, warning: volumesResult?.error ?? handoffsResult?.error }
    }
    const volumes = (volumesResult.volumes ?? []) as VolumeDefinition[]
    const handoffs = (handoffsResult.entries ?? []) as VolumeHandoffDefinition[]
    const acknowledged = ((exemptions ?? []) as ConsistencyExemption[])
      .filter(entry => !entry.revoked)
      .map(entry => entry.stableFactKey)
    return { gate: volumeHandoffGateOf({ volumes, handoffs, acknowledged, chapterNumber: input.chapterNumber }) }
  } catch (error) {
    return { gate: null, warning: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 记一次「已人工复查」。写的是 `consistency_exemptions`（稳定键 + 理由 + 可撤销）。
 *
 * 撤销入口在卷末交接面板：删掉这条确认，下次进入新一卷第一章会重新提醒。
 */
export async function acknowledgeVolumeHandoff(input: {
  projectSession: ProjectSessionContext
  volumeId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await ipc.invokeWithProjectSession(
      input.projectSession,
      'db:consistency-exemption-save',
      volumeHandoffAckKey(input.volumeId),
      input.reason,
      input.projectSession.projectPath,
    )
    return result?.success ? { success: true } : { success: false, error: result?.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
