/**
 * 大纲领先正文闸门的**读侧与确认写入**（P1-2 期 1，2026-10-25）。
 *
 * 只做四件事：并发读卷结构 / 正文权威序列 / 已确认清单 / **卷末交接单** → 交给
 * `outlineProgressGateOf` 判定 → 作者点头时往 `consistency_exemptions` 写一条带理由的确认。
 *
 * **第四路读是 2026-11-06 补的（D3）**：原来只判「上一卷正文写完没」，而 L3 拿到实际还是计划
 * 取决于交接单在不在、能不能用。两个降级口子（已定稿但没登记单 / 单过期）因此被判 `aligned`、
 * 界面零提示。判定口径见 `handoffAvailabilityOf` 的注释 —— **必须与 `outline-prefix-context.ts`
 * 一致**，否则闸门说「会用实际」而投影用的是计划，比不说更糟。
 *
 * **fail-open 是刻意的**：这是一道「提醒你先看看」的闸，不是数据校验。读失败、老项目没有
 * 卷表（`db:volumes-list` 返回 `state: 'empty'`），都不该让作者规划不了下一卷大纲。
 * 判定不出 ⇒ `gate: null`（= 本次不拦），并把原因放进 `warning` 供调用方打日志。
 *
 * 确认键前缀 `outline-progress:` 与开写闸门的 `volume-handoff:` **分开**：同表共存、
 * 互不串扰，撤销一条不影响另一条。
 */
import type { AuthoritativeChapterSequence } from '../shared/author-manuscript-import'
import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { ConsistencyExemption } from '../shared/consistency-preflight'
import {
  outlineProgressAckKey,
  outlineProgressGateOf,
  type OutlineProgressGate,
  type PreviousHandoffAvailability,
} from '../shared/outline-progress-gate'
import type { VolumeHandoffDefinition } from '../shared/volume-handoff'
import { volumeRangeEndingAt, type VolumeDefinition } from '../shared/volume-structure'
import { ipc } from './ipc-client'

export interface OutlineProgressGateReadResult {
  /** `null` = 这一章不是任何一卷的第一章（不适用），或读取失败（见 `warning`）。 */
  gate: OutlineProgressGate | null
  /** 读取失败/降级时的可读原因（调用方决定要不要 log）。 */
  warning?: string
}

/**
 * 第二维：上一卷的交接单能不能用。
 *
 * **判定口径必须与 `outline-prefix-context.ts` 一致**，否则闸门说「会用实际」而投影用的是计划，
 * 比不说更糟：
 * - 按**卷号精确匹配**，绝不回退到更早的卷（回退会把第 n−2 卷的交接当成第 n−1 卷）；
 * - `validity.state === 'stale'` ⇒ 读取侧不注入 ⇒ 这里也必须算 `stale`，不能算 `usable`。
 *
 * 六栏全空按 `missing` 算：那种单渲染出来是空节，投影照样走 `plan`。
 */
function handoffAvailabilityOf(
  handoffs: readonly VolumeHandoffDefinition[],
  previousVolumeIndex: number | null,
): PreviousHandoffAvailability {
  if (previousVolumeIndex === null) return 'unknown'
  const entry = handoffs.find(candidate => candidate.volumeIndex === previousVolumeIndex)
  if (!entry) return 'missing'
  if (entry.validity?.state === 'stale') return 'stale'
  const blank = entry.worldState.trim() === ''
    && entry.heroState.trim() === ''
    && entry.openThread.trim() === ''
    && entry.events.length === 0
    && entry.items.length === 0
    && entry.debts.length === 0
  return blank ? 'missing' : 'usable'
}

export async function readOutlineProgressGate(input: {
  projectSession: ProjectSessionContext
  /** 本批起始章（= 新卷第一章）。 */
  chapterNumber: number
}): Promise<OutlineProgressGateReadResult> {
  if (!Number.isSafeInteger(input.chapterNumber) || input.chapterNumber < 2) {
    return { gate: null }
  }
  const projectPath = input.projectSession.projectPath
  try {
    const [volumesResult, authority, exemptions, handoffsResult] = await Promise.all([
      ipc.invokeWithProjectSession(input.projectSession, 'db:volumes-list', projectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:draft-authority-sequence', projectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:consistency-exemption-list', projectPath),
      // D3（2026-11-06）：第二维。读失败不算失败 —— `unknown` 会让这一维不打扰，
      // 与扩维之前的行为一致（fail-open）。
      ipc.invokeWithProjectSession(input.projectSession, 'db:volume-handoffs-list', projectPath),
    ])
    if (!volumesResult?.success) return { gate: null, warning: volumesResult?.error }
    if (!authority || typeof authority !== 'object' || typeof authority.status !== 'string') {
      return { gate: null, warning: '正文权威序列不可读' }
    }
    const volumes = (volumesResult.volumes ?? []) as VolumeDefinition[]
    // mock / 老库可能返回非数组：直接 .filter 会 TypeError，而外层 catch 会把它变成
    // 「静默不拦」—— 于是这道闸看起来时灵时不灵。判类型，不判真值。
    const acknowledged = (Array.isArray(exemptions) ? exemptions as ConsistencyExemption[] : [])
      .filter(entry => !entry.revoked)
      .map(entry => entry.stableFactKey)
    const previousRange = volumeRangeEndingAt(volumes, input.chapterNumber - 1)
    const handoffs = handoffsResult?.success && Array.isArray(handoffsResult.entries)
      ? handoffsResult.entries as VolumeHandoffDefinition[]
      : null
    return {
      gate: outlineProgressGateOf({
        volumes,
        authority: authority as Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>,
        acknowledged,
        chapterNumber: input.chapterNumber,
        handoff: handoffs
          ? handoffAvailabilityOf(handoffs, previousRange?.volumeIndex ?? null)
          : 'unknown',
      }),
    }
  } catch (error) {
    return { gate: null, warning: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 记一次「我知道，仍按计划继续」。写的是 `consistency_exemptions`（稳定键 + 理由 + 可撤销）。
 *
 * 撤销入口在「卷末交接」页的已确认清单：删掉这条，下次规划同一卷时会重新提醒。
 */
export async function acknowledgeOutlineProgress(input: {
  projectSession: ProjectSessionContext
  volumeId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await ipc.invokeWithProjectSession(
      input.projectSession,
      'db:consistency-exemption-save',
      outlineProgressAckKey(input.volumeId),
      input.reason,
      input.projectSession.projectPath,
    )
    return result?.success ? { success: true } : { success: false, error: result?.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
