/**
 * 卷末交接的**开写闸门**（P1-2 期 2b，2026-10-24）。
 *
 * ## 为什么要有这道闸
 *
 * 交接单是「跨卷记忆」：第 2 卷开写时，第 1 卷的正文已经退出上下文，模型只能靠这份单子
 * 知道「谁还欠谁一条命」。而它是**派生品**——作者很可能既没手填、也没看自动生成的初稿。
 * 期 2 把「生成初稿」做完了，但没有东西保证**有人读过它**。这道闸补的就是这一点：
 *
 * > 进入新一卷的第一章时，如果上一卷的交接单缺失、或只有一份没被确认过的模型初稿，
 * > 就停下来要作者点一次头。
 *
 * 频次是这一设计成立的前提：一卷二十章以上，**一次强提示换一整个卷的跨卷一致性**。
 *
 * ## 三个状态
 *
 * - `missing`：上一卷压根没有交接单；
 * - `unreviewed-draft`：只有 `source='generated'` 的初稿，作者没改过、也没确认过；
 * - `clear`：作者版，或作者已显式确认过（记在 `consistency_exemptions` 里）。
 *
 * ## 为什么确认要持久化
 *
 * 不记的话，作者取消对话框、改了章标题再进来，又要被问一次；而「我确认过了」本来就是
 * 一个跨会话的事实。复用 `consistency_exemptions`（稳定键 + 理由 + 可撤销）是为了零迁移：
 * 撤销那条豁免就等于「重新开始提醒」。
 */
import type { VolumeHandoffDefinition } from './volume-handoff'
import { volumeRangeEndingAt, type VolumeDefinition, type VolumeRange } from './volume-structure'

export type VolumeHandoffGateState = 'clear' | 'missing' | 'unreviewed-draft'

export interface VolumeHandoffGate {
  state: VolumeHandoffGateState
  /** 刚结束的那一卷（其有效末章 = 本章章号 − 1）。 */
  range: VolumeRange
  /** 该卷现有的交接单；`null` = 没有。 */
  handoff: VolumeHandoffDefinition | null
}

/** 豁免表里的稳定键：一卷一条。撤销即「重新开始提醒」。 */
export function volumeHandoffAckKey(volumeId: string): string {
  return `volume-handoff:${volumeId}`
}

/**
 * 开写第 `chapterNumber` 章时，上一卷的跨卷记忆是否已经过人工确认。
 *
 * 返回 `null` = **不适用**（这一章不是任何一卷的第一章），调用方据此完全不打扰作者。
 * 判定「上一卷」用的是 `volumeRangeEndingAt(volumes, chapterNumber - 1)` ——
 * 与定稿链的卷末章触发、面板的区间展示是同一个函数，三处不会各说各话。
 */
export function volumeHandoffGateOf(input: {
  volumes: readonly VolumeDefinition[]
  handoffs: readonly VolumeHandoffDefinition[]
  /** 已确认的稳定键（`volumeHandoffAckKey` 的产物）。 */
  acknowledged: readonly string[]
  chapterNumber: number
}): VolumeHandoffGate | null {
  const chapterNumber = input.chapterNumber
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 2) return null
  const range = volumeRangeEndingAt(input.volumes, chapterNumber - 1)
  if (!range) return null
  const handoff = input.handoffs.find(entry => entry.volumeId === range.volumeId) ?? null
  // 作者已点头 ⇒ 不再问（哪怕手上只有初稿：那是他自己选的「就用这份」）。
  if (input.acknowledged.includes(volumeHandoffAckKey(range.volumeId))) {
    return { state: 'clear', range, handoff }
  }
  if (!handoff) return { state: 'missing', range, handoff: null }
  // 作者版 = 他自己写的，不需要再确认；初稿 = 没人读过，必须问。
  if (handoff.source === 'generated') return { state: 'unreviewed-draft', range, handoff }
  return { state: 'clear', range, handoff }
}
