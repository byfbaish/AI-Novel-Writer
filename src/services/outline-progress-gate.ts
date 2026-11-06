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
import { isVolumeHandoffEmpty, renderVolumeHandoffSection, VOLUME_HANDOFF_MAX_CHARS } from '../shared/volume-handoff'
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
 * **判定口径必须与 `outline-prefix-context.ts` + `projectSynopsisForOutline` 一致**，否则闸门说
 * 「会用实际」而投影用的是计划，比不说更糟：
 * - 按**卷号精确匹配**，绝不回退到更早的卷（回退会把第 n−2 卷的交接当成第 n−1 卷）；
 * - `validity.state === 'stale'` ⇒ 读取侧不注入 ⇒ 这里也必须算 `stale`；
 * - 六栏全空 ⇒ `missing`；
 * - **能过前面几关还不够**：投影真正的判据是 `renderVolumeHandoffSection(...) !== ''`
 *   （`synopsis-projection.ts:497`）。单条内容超过 1500 字预算时渲染结果为空节，投影走 plan。
 *   2026-11-06 独立复核抓到的正是这条：只判「空不空」会让「单在但太长」重演 D3 原缺陷。
 *   两种语言都渲染、任一为空即算不可用 —— 取严，因为读侧拿不到项目语言，
 *   少报一次可用最多让作者多点一次确认，多报一次可用就是界面撒谎。
 */
function handoffAvailabilityOf(
  handoffs: readonly VolumeHandoffDefinition[],
  previousVolumeIndex: number | null,
  chapterNumber: number,
): PreviousHandoffAvailability {
  if (previousVolumeIndex === null) return 'unknown'
  const entry = handoffs.find(candidate => candidate.volumeIndex === previousVolumeIndex)
  if (!entry) return 'missing'
  if (entry.validity?.state === 'stale') return 'stale'
  if (isVolumeHandoffEmpty(entry)) return 'missing'
  const renders = (language: 'zh-CN' | 'en-US') =>
    renderVolumeHandoffSection(entry, language, chapterNumber, VOLUME_HANDOFF_MAX_CHARS) !== ''
  return renders('zh-CN') && renders('en-US') ? 'usable' : 'unusable'
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
      // D3（2026-11-06）：第二维。**单独 catch** —— 读失败不算失败（`unknown` 会让这一维不打扰，
      // 与扩维之前一致），但也不能让它把整条 `Promise.all` 拖进 catch：那会把原本会报的
      // `prose-unfinalized` 一起吞掉（复核抓到的回归面）。
      ipc.invokeWithProjectSession(input.projectSession, 'db:volume-handoffs-list', projectPath)
        .catch(() => null),
    ])
    if (!volumesResult?.success) return { gate: null, warning: volumesResult?.error }
    // 卷表本身陈旧/没解析完时边界不可信 ⇒ 判不出就不拦（与「读失败」同一口径）。
    // 判据只用 `state === 'ready'`：`empty` 是老项目没建卷，走下面的 `volumeRangeEndingAt` 自然返回 null。
    const volumeState = (volumesResult as { state?: string }).state
    if (volumeState && volumeState !== 'ready' && volumeState !== 'empty') {
      return { gate: null, warning: `卷结构状态为 ${volumeState}，本次不判` }
    }
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
          ? handoffAvailabilityOf(handoffs, previousRange?.volumeIndex ?? null, input.chapterNumber)
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
