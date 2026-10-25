/**
 * 大纲领先正文的**发射前闸门**（P1-2 期 1，2026-10-25）。
 *
 * ## 为什么要有这道闸
 *
 * 正文受约束于大纲，但**大纲并不受约束于正文**：作者可以先把第 2、3 卷大纲铺完，正文还停在
 * 第 1 卷。卷末交接单只由**定稿**产生（`finalize-chapter.command.ts` 的卷末章），所以那时
 * 第 1 卷根本没有快照 —— 新卷大纲只能基于**计划**，不是**实际结局**。作者原话：
 *
 * > 定稿正文影响卷快照，会将影响传导到大纲，微小的差异可能会让模型产出不一样的内容。
 *
 * 而「正文实况 → 大纲层」这条线**从来没接上**：`architecture.command.ts` 完全不消费
 * `volume_handoffs`，全仓只有正文链的写前查阅读它。这道闸不修那条线，只保证**作者知道**。
 *
 * ## 判据必须是二维，只看卷差会漏判
 *
 * | 卷差（大纲 − 正文） | 上一卷正文 | 判定 |
 * |---|---|---|
 * | 0 | 任意 | 正常 |
 * | 1 | 已定稿 | 正常 |
 * | **1** | **未定稿** | **⚠️ 就是本闸**：卷差只有 1，隐患照样存在 |
 * | ≥2 | 任意 | 本闸同样命中（上一卷必然未定稿） |
 *
 * ## 三个返回，与 `volumeHandoffGateOf` 对齐
 *
 * - `null` = **不适用**（不是任何一卷的卷首章 / 卷结构为空 / 上一卷起止未定）⇒ 完全不打扰；
 * - `aligned` = 上一卷已整卷定稿，或作者已确认过；
 * - `ahead` = 大纲跑到了正文前面 ⇒ 调用方弹强提示（可取消）。
 *
 * ## 为什么定稿判据用「权威序列」而不是「最大定稿章号」
 *
 * `maxFinalized >= 上一卷末章` 在**中间有洞**时是错的（第 5 章没定稿、第 6 章定了，仍然放行），
 * 而洞正是「卷没写完」的典型形态。`db:draft-authority-sequence` 自带断章检测，`invalid`
 * 一律按未定稿处理 —— 不把坏账当完成。
 */
import type { AuthoritativeChapterSequence, AuthoritativeChapterSequenceStatus } from './author-manuscript-import'
import { volumeRangeEndingAt, type VolumeDefinition, type VolumeRange } from './volume-structure'

export type OutlineProgressGateState = 'aligned' | 'ahead'

export interface OutlineProgressGate {
  state: OutlineProgressGateState
  /** 刚结束的那一卷（其有效末章 = 本批起始章 − 1）。 */
  range: VolumeRange
  /** 正文实况来源；`invalid` 表示章号账本有洞，按未定稿处理。 */
  authorityStatus: AuthoritativeChapterSequenceStatus
  /** 正文定稿到第几章（`invalid` 时也照实给出，供面板说明）。 */
  draftLastChapter: number
  /** 还差几章才算整卷定稿。 */
  missingChapters: number
}

/** 豁免表里的稳定键：一卷一条。撤销即「重新开始提醒」。 */
export function outlineProgressAckKey(volumeId: string): string {
  return `outline-progress:${volumeId}`
}

/**
 * 从第 `chapterNumber` 章开始规划大纲时，上一卷的正文是否已经整卷定稿。
 *
 * 返回 `null` = **不适用**（这一章不是任何一卷的第一章）。判定「上一卷」用的是
 * `volumeRangeEndingAt(volumes, chapterNumber - 1)` —— 与定稿链的卷末章触发、开写闸门
 * 是同一个函数，三处不会各说各话。
 */
export function outlineProgressGateOf(input: {
  volumes: readonly VolumeDefinition[]
  authority: Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>
  /** 已确认的稳定键（`outlineProgressAckKey` 的产物）。 */
  acknowledged: readonly string[]
  chapterNumber: number
}): OutlineProgressGate | null {
  if (!Number.isSafeInteger(input.chapterNumber) || input.chapterNumber < 2) return null
  const range = volumeRangeEndingAt(input.volumes, input.chapterNumber - 1)
  // 上一卷末章未定（`planned_*` 与 `actual_*` 都是 NULL）⇒ 没有可比对的边界，不猜。
  if (!range || range.last === null) return null
  const draftLastChapter = Number.isSafeInteger(input.authority.lastChapterNumber)
    ? Math.max(0, input.authority.lastChapterNumber)
    : 0
  const missingChapters = Math.max(0, range.last - draftLastChapter)
  const base = { range, authorityStatus: input.authority.status, draftLastChapter, missingChapters }
  // 作者已点头 ⇒ 不再问（哪怕正文没写完：那是他自己选的「先铺大纲」）。
  if (input.acknowledged.includes(outlineProgressAckKey(range.volumeId))) {
    return { ...base, state: 'aligned' }
  }
  const aligned = input.authority.status !== 'invalid' && draftLastChapter >= range.last
  return { ...base, state: aligned ? 'aligned' : 'ahead' }
}
