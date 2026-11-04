import { describe, expect, it } from 'vitest'

import {
  projectSynopsisForOutline,
  renderOutlinePrefixBlock,
  resolveOutlineVolumePosition,
  type OutlinePrefixProjectionOptions,
  type OutlineVolumePosition,
} from '../synopsis-projection'
import type { VolumeHandoffDefinition } from '../volume-handoff'

/**
 * 大纲链的 L2/L3 分层投影（P1-2 期 3）。验收口径：
 * - **只注入投影，不改落库**：投影结果永远只用于 prompt；
 * - L2 只取本卷已写；L3 有交接单给实际、没有给计划并**显式标注**；
 * - 解析不可靠时原样返回，一行都不丢。
 */

const handoff = (over: Partial<VolumeHandoffDefinition> = {}): VolumeHandoffDefinition => ({
  handoffId: 'handoff:1', volumeId: 'volume:1', volumeIndex: 1,
  firstChapter: 1, lastChapter: 20, boundaryBasis: 'headings',
  worldState: '灵潮退去', heroState: '顾长风左臂未愈', events: ['玄火令被夺'],
  items: [], debts: [], openThread: '监天台为何要玄火令',
  source: 'author', createdAt: '', updatedAt: '',
  ...over,
})

/** 16 章的大纲：第 1–8 章一组，第 9–16 章一章一条。 */
function synopsis(units = 16): string {
  const lines: string[] = ['# 情节大纲', '', '全书总纲：这是一场关于欠债与还债的故事。', '']
  lines.push('第1–8章：开篇', '选择：拖 —— 他先避开。', '钩子：门闩没关。', '')
  for (let chapter = 9; chapter <= units; chapter += 1) {
    lines.push(`第${chapter}章：第${chapter}步`, `选择：认 —— 他认了第${chapter}笔账。`, '钩子：账本又厚一页。', '')
  }
  return lines.join('\n')
}

const cursorPosition = (volumeIndex: number, volumeFirstChapter: number): OutlineVolumePosition =>
  ({ volumeIndex, volumeFirstChapter, basis: 'cursor' })

const baseOptions = (over: Partial<OutlinePrefixProjectionOptions> = {}): OutlinePrefixProjectionOptions => ({
  from: 17,
  position: cursorPosition(2, 9),
  arcPlan: '',
  writingLanguage: 'zh-CN',
  previousHandoff: null,
  previousVolumeFinalized: true,
  proseFinalizedThrough: 20,
  ...over,
})

describe('resolveOutlineVolumePosition — 本卷从第几章起', () => {
  it('有游标时用 from − writtenInVolume（写超也成立）', () => {
    expect(resolveOutlineVolumePosition({
      from: 26, cursor: { volumeIndex: 2, unitIndex: 1, writtenInVolume: 5 }, arcPlan: '', totalChapters: 100,
    })).toEqual({ volumeIndex: 2, volumeFirstChapter: 21, basis: 'cursor' })
  })

  it('没有游标时退回弧光折算，并标明来源（会被调用方记为 degraded）', () => {
    const arcPlan = [
      '## 大弧一：开篇（约 20 章）',
      '### 中弧 1：起（约 10 章）',
      '### 中弧 2：承（约 10 章）',
      '## 大弧二：北塔（约 20 章）',
      '### 中弧 1：起（约 10 章）',
      '### 中弧 2：承（约 10 章）',
    ].join('\n')
    const position = resolveOutlineVolumePosition({ from: 25, cursor: null, arcPlan, totalChapters: 40 })
    expect(position.volumeIndex).toBe(2)
    expect(position.basis).toBe('arc-span')
  })

  it('既无游标也无弧光 ⇒ 定位失败，不猜', () => {
    expect(resolveOutlineVolumePosition({ from: 9, cursor: null, arcPlan: '', totalChapters: 40 }))
      .toEqual({ volumeIndex: null, volumeFirstChapter: null, basis: 'none' })
  })
})

describe('projectSynopsisForOutline — 分层', () => {
  it('L2 只取本卷已写章，设定层始终保留且不计入 L2', () => {
    // 本卷从第 9 章起 ⇒ 第 9–16 章进 L2，第 1–8 章那组不进
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      position: cursorPosition(2, 9), previousHandoff: handoff(),
    }))
    expect(projection.setting.text).toContain('全书总纲')
    expect(projection.l2.text).toContain('第9章：第9步')
    expect(projection.l2.text).toContain('第16章：第16步')
    expect(projection.l2.text).not.toContain('第1–8章')
    expect(projection.l2.firstChapter).toBe(9)
    expect(projection.l2.lastChapter).toBe(16)
    expect(projection.setting.chars).toBeGreaterThan(0)
    expect(projection.l2.chars).toBeGreaterThan(0)
  })

  it('卷首（本卷第一章）⇒ L2 为空，只留设定层 + L3', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      from: 9, position: cursorPosition(2, 9), previousHandoff: handoff(),
    }))
    expect(projection.l2.text).toBe('')
    expect(projection.l2.groupCount).toBe(0)
    expect(projection.l3.kind).toBe('actual')
    const block = renderOutlinePrefixBlock(projection, 'zh-CN')
    expect(block).toContain('本卷尚未写任何正文')
  })

  it('L3 有交接单 ⇒ 用实际，不出现「计划」提示', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({ previousHandoff: handoff() }))
    expect(projection.l3.kind).toBe('actual')
    expect(projection.reality).toEqual({ kind: 'finalized' })
    expect(projection.degraded).not.toContain('l3-handoff-missing')
    expect(renderOutlinePrefixBlock(projection, 'zh-CN')).not.toContain('实际结局未知')
  })

  it('L3 无交接单 ⇒ 退化为卷纲摘要并标注「计划，实际结局未知」', () => {
    const arcPlan = [
      '## 大弧一：草鞋渡（约 10 章）',
      '- 卷叙事任务：把欠债摆到台面上',
      '- 离开状态：顾长风带着账本离开渡口',
      '### 中弧 1：起（约 5 章）',
      '### 中弧 2：承（约 5 章）',
      '## 大弧二：北塔（约 10 章）',
      '- 卷叙事任务：进塔',
      '### 中弧 1：起（约 5 章）',
      '### 中弧 2：承（约 5 章）',
    ].join('\n')
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      previousHandoff: null, arcPlan, previousVolumeFinalized: false, proseFinalizedThrough: 6,
    }))
    expect(projection.l3.kind).toBe('plan')
    expect(projection.l3.text).toContain('草鞋渡')
    expect(projection.degraded).toContain('l3-handoff-missing')
    const block = renderOutlinePrefixBlock(projection, 'zh-CN')
    expect(block).toContain('卷纲摘要 · 计划')
    expect(block).toContain('实际结局未知')
    expect(block).toContain('只定稿到第 6 章')
  })

  it('已定稿但交接单不见了：说「用摘要代替」，不说「正文没写完」', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      previousHandoff: null, arcPlan: '', previousVolumeFinalized: true,
    }))
    const block = renderOutlinePrefixBlock(projection, 'zh-CN')
    expect(block).toContain('已定稿，但没有卷末交接单')
    expect(projection.degraded).toContain('l3-volume-plan-unavailable')
  })

  it('有交接单但正文没写完 ⇒ 标「只覆盖已定稿部分」', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      previousHandoff: handoff(), previousVolumeFinalized: false, proseFinalizedThrough: 12,
    }))
    expect(projection.reality).toEqual({ kind: 'partial', volumeIndex: 1, finalizedThrough: 12 })
    expect(renderOutlinePrefixBlock(projection, 'zh-CN')).toContain('只覆盖已定稿部分')
  })

  it('第 1 卷没有「上一卷」⇒ 不渲染 L3，也不提示', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      position: cursorPosition(1, 1), previousHandoff: null, previousVolumeFinalized: null,
    }))
    expect(projection.l3.kind).toBe('none')
    expect(projection.reality).toBeNull()
    expect(renderOutlinePrefixBlock(projection, 'zh-CN')).not.toContain('上一卷')
  })

  it('L2 超软上限 ⇒ 只留最近若干章全文，更早的降到标题行并注明已省略', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      previousHandoff: handoff(), from: 17, position: cursorPosition(1, 1),
      l2SoftLimitChars: 60, l2RecentFullChapters: 3,
    }))
    expect(projection.l2.collapsed).toBe(true)
    expect(projection.l2.omittedGroups).toBeGreaterThan(0)
    expect(projection.degraded).toContain('l2-collapsed-over-budget')
    expect(projection.l2.text).toContain('第16章：第16步')
    // 早期章组只留标题行：标题在、正文行不在
    expect(projection.l2.text).toContain('第1–8章：开篇')
    expect(projection.l2.text).not.toContain('他先避开')
    expect(renderOutlinePrefixBlock(projection, 'zh-CN')).toContain('只保留标题行')
  })

  it('章组跨卷界 ⇒ 整组归本卷，并标记 degraded', () => {
    // 第 1–8 章那一组跨过「本卷从第 5 章起」的边界
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      from: 17, position: cursorPosition(2, 5), previousHandoff: handoff(),
    }))
    expect(projection.l2.text).toContain('第1–8章：开篇')
    expect(projection.degraded).toContain('l2-group-straddles-volume-start')
  })

  it('整份大纲解析失败（代码块写法）⇒ 原样返回，一行都不丢', () => {
    const raw = '```\n第1章：示例\n```'
    const projection = projectSynopsisForOutline(raw, baseOptions({ previousHandoff: handoff() }))
    expect(projection.l2.text).toBe(raw.trim())
    expect(projection.degraded).toContain('outline-unparsable')
  })

  it('英文项目输出英文小标题与英文提示', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({
      writingLanguage: 'en-US', previousHandoff: null, arcPlan: '', previousVolumeFinalized: false,
    }))
    const block = renderOutlinePrefixBlock(projection, 'en-US')
    expect(block).toContain('[Confirmed outline prefix]')
    expect(block).toContain('[Outline already written in this volume')
    expect(block).toContain('the actual outcome is unknown')
  })

  it('外层节标题逐字保留，分层信息只在内层小标题', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({ previousHandoff: handoff() }))
    const block = renderOutlinePrefixBlock(projection, 'zh-CN')
    expect(block.startsWith('【已完成大纲前缀】')).toBe(true)
    expect(block).toContain('【设定与全局约束】')
    expect(block).toContain('【上一卷（第1卷）交接 · 实际】')
    expect(block).toContain('【本卷已写大纲（第9–16章，共 8 条）】')
  })

  it('不单独渲染「最近 K 章」：L4 ⊆ L2，重复注入只是白花 token', () => {
    const projection = projectSynopsisForOutline(synopsis(), baseOptions({ previousHandoff: handoff() }))
    const block = renderOutlinePrefixBlock(projection, 'zh-CN')
    expect(block).not.toContain('最近')
    // 第 16 章只出现一次（若并列 L4 会出现两遍）
    expect(block.split('第16章：第16步')).toHaveLength(2)
  })
})
