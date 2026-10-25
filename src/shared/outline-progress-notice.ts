/**
 * 「上一卷只有计划」这句话的**唯一文案源**（P1-2 期 2/3，2026-10-25）。
 *
 * ## 为什么单独一个模块
 *
 * 同一件事要在两个地方说：
 * 1. **期 1 的闸门**（作者决定要不要先补正文）—— 说给人看；
 * 2. **期 3 的 prompt 前缀块**（模型要知道「这段是计划，不是实际结局」）—— 说给模型看。
 *
 * 两处措辞一旦分家，就会出现「UI 说没定稿、prompt 说一切正常」这种自相矛盾。
 * 所以文案只在这里写一遍，两个调用点共用；且**同一次请求里最多出现一次**
 * （`renderOutlinePrefixBlock` 内部调用它，命令层只在「空前缀」分支单独调用，
 * 两个分支互斥）。
 *
 * ## 四种情形，不能合并成「未定稿」一句
 *
 * 作者最需要区分的恰恰是这四种，而不是「定了没定」：
 * - 已定稿 + 有交接单 → 什么都不说（正常态）；
 * - 已定稿 + 无交接单 → **单子被删了**，此时只能退回卷纲摘要，不说清就会被当成实际；
 * - 未定稿 + 有交接单 → 交接单只覆盖已写部分，其后都是计划；
 * - 未定稿 + 无交接单 → 只有计划，实际结局未知。
 */
import type { WritingLanguage } from './writing-language'

export type PreviousVolumeReality =
  /** 已定稿且有交接单：正常态，不出任何提示。 */
  | { kind: 'finalized' }
  /** 有交接单，但上一卷正文还没写完：交接只覆盖已写部分。 */
  | { kind: 'partial'; volumeIndex: number; finalizedThrough: number }
  /**
   * 只有计划。三种原因分开说：
   * - `no-handoff`：上一卷**已定稿**，但交接单不见了（被删/从未生成）；
   * - `unfinalized`：正文没写完，交接单本来就不会有；
   * - `unresolved`：卷结构不可用，判断不出定稿没定稿 —— 按「缺则 unknown」处理。
   */
  | { kind: 'plan-only'; volumeIndex: number; reason: 'no-handoff' | 'unfinalized' | 'unresolved'; finalizedThrough?: number }

/**
 * 渲染一句「这段是什么」。`finalized` 返回空串（调用方据此不插入任何内容）。
 */
export function renderPreviousVolumeRealityNotice(
  reality: PreviousVolumeReality,
  writingLanguage: WritingLanguage,
): string {
  const en = writingLanguage === 'en-US'
  if (reality.kind === 'finalized') return ''
  if (reality.kind === 'partial') {
    return en
      ? `The handoff below covers only what is finalized (through chapter ${reality.finalizedThrough}); everything after it is plan, not outcome.`
      : `以下交接单只覆盖已定稿部分（到第 ${reality.finalizedThrough} 章）；其后内容属计划，不是实际结局。`
  }
  const volume = en ? `Volume ${reality.volumeIndex}` : `第 ${reality.volumeIndex} 卷`
  if (reality.reason === 'no-handoff') {
    return en
      ? `${volume} is finalized but has no volume handoff, so the outline summary below stands in for it: that is plan, not the actual outcome.`
      : `${volume}已定稿，但没有卷末交接单，因此以下用卷纲摘要代替：那是**计划**，不是实际结局。`
  }
  if (reality.reason === 'unresolved') {
    return en
      ? `Whether ${volume} is finalized cannot be determined (the volume structure is unavailable). Only the plan is available below; the actual outcome is unknown.`
      : `判断不出${volume}是否已定稿（卷结构不可用）。以下只有计划，实际结局未知。`
  }
  const through = reality.finalizedThrough
  return en
    ? `${volume} is not fully finalized${through === undefined ? '' : ` (prose finalized through chapter ${through})`}. Only the plan is available below; the actual outcome is unknown.`
    : `${volume}正文尚未整卷定稿${through === undefined ? '' : `（只定稿到第 ${through} 章）`}。以下只有计划，实际结局未知。`
}
