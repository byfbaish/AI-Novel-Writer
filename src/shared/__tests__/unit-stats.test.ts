import { describe, expect, it } from 'vitest'
import {
  parseArcStructure,
  planUnitStats,
  renderUnitBudgetBlock,
  renderUnitBudgetLine,
  unitRemainingStateOf,
} from '../arc-position'

// 设计稿 e3-unit-batch-implementation-plan.md §3 T1
// 口径 volume-quota-context-budget-design.md §6.2 / §7.1（C 项）：
// 只回答「本卷已写多少 / 还剩几个单元 / 本单元名义上界多少」，
// 不返回「本单元应该写几章」的配额；等分只画参照线，定位必须用游标。
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

describe('planUnitStats：单元级余量统计', () => {
  it('单元 1/2、未开写：名义上界 = 卷长 ÷ 单元数，余量比 1（均衡）', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 1 })!
    expect(stats.volumeName).toBe('开局')
    expect(stats.unitName).toBe('门牌')
    expect(stats.volumeChapters).toBe(30)
    expect(stats.unitCount).toBe(2)
    expect(stats.writtenInVolume).toBe(0)
    expect(stats.remaining).toBe(30)
    expect(stats.remainingUnits).toBe(2)
    expect(stats.maxChapters).toBe(15)
    expect(stats.maxChaptersCeil).toBe(15)
    expect(stats.ratio).toBe(1)
    expect(stats.state).toBe('balanced')
  })

  it('卷末单元（2/2）只剩自己：剩余章数全归它，余量比放大', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 })!
    expect(stats.remainingUnits).toBe(1)
    expect(stats.remaining).toBe(25)
    expect(stats.maxChapters).toBe(25)
    expect(stats.ratio).toBeCloseTo(25 / 15, 10)
    expect(stats.state).toBe('ample')
  })

  it('已写接近卷长：余量比收紧（< 90%）', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 28 })!
    expect(stats.remaining).toBe(2)
    expect(stats.ratio).toBeCloseTo(2 / 15, 10)
    expect(stats.state).toBe('tight')
    expect(stats.maxChaptersCeil).toBe(2)
  })

  it('非整数名义上界向上取整，用于请求与预算冻结', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 5 })!
    expect(stats.maxChapters).toBe(12.5)
    expect(stats.maxChaptersCeil).toBe(13)
    // 12.5 ÷ 15 = 0.833 < 0.9：已写 5 章后再按均分走，余量偏紧
    expect(stats.ratio).toBeCloseTo(12.5 / 15, 10)
    expect(stats.state).toBe('tight')
  })

  it('已写超过卷长：截断到卷长，剩余 0、向上取整也为 0', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 99 })!
    expect(stats.writtenInVolume).toBe(30)
    expect(stats.remaining).toBe(0)
    expect(stats.maxChapters).toBe(0)
    expect(stats.maxChaptersCeil).toBe(0)
    expect(stats.ratio).toBe(0)
    expect(stats.state).toBe('tight')
  })

  it('writtenInVolume 非法值按 0', () => {
    expect(planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: Number.NaN })!.writtenInVolume).toBe(0)
    expect(planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: -3 })!.writtenInVolume).toBe(0)
  })

  it('卷长随全书章数折算（与弧位块同源）', () => {
    const stats = planUnitStats(parsed, 61, { volumeIndex: 1, unitIndex: 1 })!
    expect(stats.volumeChapters).toBe(31)
    expect(stats.maxChapters).toBe(15.5)
    expect(stats.maxChaptersCeil).toBe(16)
  })

  it('越界与非法输入一律 null（fail-open）', () => {
    expect(planUnitStats(parsed, 60, { volumeIndex: 0, unitIndex: 1 })).toBeNull()
    expect(planUnitStats(parsed, 60, { volumeIndex: 3, unitIndex: 1 })).toBeNull()
    expect(planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 0 })).toBeNull()
    expect(planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 3 })).toBeNull()
    expect(planUnitStats(parsed, 0, { volumeIndex: 1, unitIndex: 1 })).toBeNull()
    expect(planUnitStats(parsed, 60, null)).toBeNull()
    expect(planUnitStats(null, 60, { volumeIndex: 1, unitIndex: 1 })).toBeNull()
  })
})

describe('unitRemainingStateOf：余量比判档', () => {
  it('边界归中：正好 ±10% 算均衡', () => {
    expect(unitRemainingStateOf(0.9)).toBe('balanced')
    expect(unitRemainingStateOf(1.1)).toBe('balanced')
    expect(unitRemainingStateOf(0.899)).toBe('tight')
    expect(unitRemainingStateOf(1.101)).toBe('ample')
  })

  it('非有限值按均衡（fail-open）', () => {
    expect(unitRemainingStateOf(Number.NaN)).toBe('balanced')
    expect(unitRemainingStateOf(Number.POSITIVE_INFINITY)).toBe('balanced')
  })
})

describe('renderUnitBudgetLine：常驻余量行', () => {
  it('中文：已写 / 还剩 / 剩余单元 / 名义上界', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 7 })!
    expect(renderUnitBudgetLine(stats, 'zh-CN')).toBe(
      '本卷：已写 7/30 章，还剩 23 章；本单元 2/2，名义上界约 23 章')
  })

  it('英文：同口径', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 7 })!
    expect(renderUnitBudgetLine(stats, 'en-US')).toBe(
      'volume: 7/30 chapters written, 23 left; unit 2/2, nominal cap 23 chapters')
  })

  it('null 输入返回 null', () => {
    expect(renderUnitBudgetLine(null, 'zh-CN')).toBeNull()
  })
})

describe('renderUnitBudgetBlock：余量行常驻 + 方向按阈值', () => {
  it('带内（r=1）：只有余量行，不给任何方向', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 1 })!
    const block = renderUnitBudgetBlock(stats, 'zh-CN')!
    expect(block.split('\n')).toHaveLength(2)
    expect(block).toContain('【本卷配给 · 单元 1/2】')
    expect(block).toContain('本卷：已写 0/30 章')
    expect(block).not.toContain('收紧')
    expect(block).not.toContain('可以展开')
  })

  it('收紧（r < 0.9）：追加收紧指令，且不含章数目标', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 28 })!
    const block = renderUnitBudgetBlock(stats, 'zh-CN')!
    expect(block).toContain('收紧：')
    expect(block).toContain('必要情节一个都不能少')
    expect(block).not.toMatch(/写到\s*\d+\s*章/)
  })

  it('展开（r > 1.1）：追加展开指令，且限定在本单元已有的事', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 })!
    const block = renderUnitBudgetBlock(stats, 'zh-CN')!
    expect(block).toContain('可以展开：')
    expect(block).toContain('只展开本单元已有的事')
  })

  it('英文版同口径', () => {
    const stats = planUnitStats(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 28 })!
    const block = renderUnitBudgetBlock(stats, 'en-US')!
    expect(block).toContain('[Volume budget · unit 2/2]')
    expect(block).toContain('Tighten:')
  })

  it('null 输入返回 null', () => {
    expect(renderUnitBudgetBlock(null, 'zh-CN')).toBeNull()
  })
})
