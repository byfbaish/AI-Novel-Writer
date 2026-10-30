/**
 * 大纲前缀的**上一卷上下文**（P1-2 期 3，2026-10-25）。
 *
 * 只做一件事：给定本卷卷号，取「上一卷的卷末交接单」与「上一卷是否已整卷定稿」，
 * 供 `projectSynopsisForOutline` 决定 L3 给**实际**还是**计划**。
 *
 * ## 两条不能改的口径
 *
 * 1. **按卷号精确匹配，禁止「取最近一份」**。`findPreviousHandoff(beforeChapter)` 在
 *    「上一卷没有交接单」时会静默回退到更早的卷（`docs/plans/p1-2-volume-handoff-plan.md:538`
 *    记录的已知缺陷）—— 大纲领先正文时这几乎必然发生，回退过去就会把第 n−2 卷的交接
 *    当成第 n−1 卷，那比没有更糟。
 * 2. **卷表只用来定边界，不用来定「正文写到哪」**。`actual_last` 描述的是正文实况、
 *    且只在面板重建时更新；正文写到哪由 `db:draft-authority-sequence` 说了算。
 *
 * 全程 fail-open：读失败返回 `previousVolumeFinalized: null`（= 判断不出），
 * 投影侧会据此写「判断不出是否定稿」，而不是假装已定稿。
 */
import type { AuthoritativeChapterSequence } from '../shared/author-manuscript-import'
import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { VolumeHandoffDefinition } from '../shared/volume-handoff'
import { volumeEffectiveRanges, type VolumeDefinition } from '../shared/volume-structure'
import { ipc } from './ipc-client'
import { describeDrift } from '../shared/upstream-revisions'

export interface OutlinePrefixContext {
  /** 上一卷的交接单（已按卷号精确匹配）；`null` = 这一卷没有。 */
  previousHandoff: VolumeHandoffDefinition | null
  /** `null` = 判断不出（卷表没有这一卷，或权威序列不可读）。 */
  previousVolumeFinalized: boolean | null
  /** 正文整体定稿到第几章（措辞用）。 */
  proseFinalizedThrough: number
  previousVolumeLastChapter: number | null
  warning?: string
}

const EMPTY: Omit<OutlinePrefixContext, 'warning'> = {
  previousHandoff: null,
  previousVolumeFinalized: null,
  proseFinalizedThrough: 0,
  previousVolumeLastChapter: null,
}

export async function readOutlinePrefixContext(input: {
  projectSession: ProjectSessionContext
  expectedProjectPath: string
  /** 本卷卷号（1 起）；< 2 时直接返回空上下文（第 1 卷没有上一卷）。 */
  volumeIndex: number
}): Promise<OutlinePrefixContext> {
  if (!Number.isSafeInteger(input.volumeIndex) || input.volumeIndex < 2) return { ...EMPTY }
  try {
    const [volumeResult, handoffResult, authority] = await Promise.all([
      ipc.invokeWithProjectSession(input.projectSession, 'db:volumes-list', input.expectedProjectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:volume-handoffs-list', input.expectedProjectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:draft-authority-sequence', input.expectedProjectPath),
    ])
    if (!volumeResult?.success) return { ...EMPTY, warning: volumeResult?.error }
    const volumes = (volumeResult.volumes ?? []) as VolumeDefinition[]
    const handoffs = (handoffResult?.success ? handoffResult.entries ?? [] : []) as VolumeHandoffDefinition[]
    const previousIndex = input.volumeIndex - 1
    const previous = volumeEffectiveRanges(volumes).find(range => range.volumeIndex === previousIndex) ?? null
    // 精确匹配；找不到就是「这一卷没有单」，绝不回退到更早的卷。
    const matchedHandoff = handoffs.find(entry => entry.volumeIndex === previousIndex) ?? null
    // 过期 ⇒ **不注入**并给警告（P2-2 期 2，B 类：提示不阻断）。
    // 注入一份基于旧大纲的跨卷事实比不注入更糟 —— 模型会把它当成当前事实往下写，
    // 而作者看到的是"工具说第 N 卷发生了什么"，无从分辨那是旧版本。
    const handoffDrift = matchedHandoff?.validity?.state === 'stale'
      ? describeDrift(matchedHandoff.validity.behind)
      : null
    const previousHandoff = handoffDrift ? null : matchedHandoff
    const sequence = authority && typeof authority === 'object' && typeof authority.status === 'string'
      ? authority as AuthoritativeChapterSequence
      : null
    const proseFinalizedThrough = sequence && Number.isSafeInteger(sequence.lastChapterNumber)
      ? Math.max(0, sequence.lastChapterNumber)
      : 0
    const previousVolumeLastChapter = previous?.last ?? null
    const previousVolumeFinalized = !sequence || previousVolumeLastChapter === null
      ? null
      : sequence.status !== 'invalid' && proseFinalizedThrough >= previousVolumeLastChapter
    return {
      previousHandoff,
      previousVolumeFinalized,
      proseFinalizedThrough,
      previousVolumeLastChapter,
      ...(handoffDrift
        ? { warning: `上一卷交接单基于的${handoffDrift}已经改过了，本次未注入` }
        : {}),
    }
  } catch (error) {
    return { ...EMPTY, warning: error instanceof Error ? error.message : String(error) }
  }
}
