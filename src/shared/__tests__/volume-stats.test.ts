import { describe, expect, it } from 'vitest'
import { parseArcStructure, planVolumeStats, renderVolumeStats } from '../arc-position'

// 设计稿 volume-quota-context-budget-design.md §6.1 / §6.2
// 取代 planProgress 的「预算 / 进度线 / 三档」：卷内只统计「已写多少、还剩多少」。
const V7 = [
  '# 卷 / 单元结构',
  '',
  '## 卷一：开局',
  '### 单元一：门牌',
  '- 叙事任务：立规则。',
  '### 单元二：定价',
  '- 叙事任务：把销档变成交易。',
  '',
  '## 卷二：销档',
  '### 单元一：配合',
  '- 叙事任务：只剩配合这一条路。',
].join('\n')

const parsed = parseArcStructure(V7)!

describe('planVolumeStats：卷内统计', () => {
  it('两卷等权：60 章 → 每卷 30 章', () => {
    const stats = planVolumeStats(parsed, 60, { majorIndex: 1 })!
    expect(stats.volumeChapters).toBe(30)
    expect(stats.midCount).toBe(2)
    expect(stats.actualUsed).toBe(0)
    expect(stats.remaining).toBe(30)
    expect(stats.bookProgress).toBeNull()
  })

  it('已写 12 章：剩 18 章，不含任何「应该写多少」的数字', () => {
    const stats = planVolumeStats(parsed, 60, { majorIndex: 1, actualUsed: 12 })!
    expect(stats.actualUsed).toBe(12)
    expect(stats.remaining).toBe(18)
    expect(Object.keys(stats).sort()).toEqual(
      ['actualUsed', 'bookProgress', 'majorIndex', 'midCount', 'remaining', 'volumeChapters'])
  })

  it('已写超过卷长时截断，remaining 不为负', () => {
    const stats = planVolumeStats(parsed, 60, { majorIndex: 1, actualUsed: 99 })!
    expect(stats.actualUsed).toBe(30)
    expect(stats.remaining).toBe(0)
  })

  it('bookProgress 由 coveredTo 折算，封顶 1', () => {
    expect(planVolumeStats(parsed, 60, { majorIndex: 1, coveredTo: 30 })!.bookProgress).toBe(0.5)
    expect(planVolumeStats(parsed, 60, { majorIndex: 1, coveredTo: 999 })!.bookProgress).toBe(1)
  })

  it('actualUsed 非法值按 0', () => {
    const stats = planVolumeStats(parsed, 60, { majorIndex: 1, actualUsed: Number.NaN })!
    expect(stats.actualUsed).toBe(0)
  })

  it('越界与非法输入一律 null（fail-open）', () => {
    expect(planVolumeStats(parsed, 60, { majorIndex: 3 })).toBeNull()
    expect(planVolumeStats(parsed, 60, { majorIndex: 0 })).toBeNull()
    expect(planVolumeStats(parsed, 0, { majorIndex: 1 })).toBeNull()
    expect(planVolumeStats(parsed, 60, null)).toBeNull()
    expect(planVolumeStats(null, 60, { majorIndex: 1 })).toBeNull()
  })
})

describe('renderVolumeStats：日志行', () => {
  it('中文含已写/总量/剩余', () => {
    const line = renderVolumeStats(planVolumeStats(parsed, 60, { majorIndex: 1, actualUsed: 12 }), 'zh-CN')!
    expect(line).toContain('卷 1')
    expect(line).toContain('12/30')
    expect(line).toContain('还剩 18 章')
  })

  it('英文同口径', () => {
    const line = renderVolumeStats(planVolumeStats(parsed, 60, { majorIndex: 1, actualUsed: 12 }), 'en-US')!
    expect(line).toContain('volume 1')
    expect(line).toContain('12/30')
    expect(line).toContain('18 left')
  })

  it('null 输入返回 null', () => {
    expect(renderVolumeStats(null, 'zh-CN')).toBeNull()
  })
})
