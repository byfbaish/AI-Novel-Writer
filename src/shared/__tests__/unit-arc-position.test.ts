import { describe, expect, it } from 'vitest'
import {
  accumulatedVolumeDeviation,
  arcSpanForUnit,
  dropVolumeDeviation,
  expectedTotalChapters,
  parseArcStructure,
  planVolumeChapters,
  renderUnitArcPositionBlock,
  upsertVolumeDeviation,
  volumeDeviationRecordOf,
  volumeDeviationValue,
  withProjectedUnitArcGuide,
} from '../arc-position'

// E3：单元模式按**游标**定位弧位（不按章号）。章号只用于把弧光结构裁到本单元，不写进提示词。
const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '- 叙事任务：立规则。',
  '### 单元二：定价',
  '- 叙事任务：把销档变成交易。',
  '## 卷二：销档',
  '### 单元一：配合',
  '- 叙事任务：只剩配合这一条路。',
].join('\n')

const parsed = parseArcStructure(PLAN)

describe('arcSpanForUnit：按游标取本单元的弧位', () => {
  it('卷一单元一 / 单元二', () => {
    expect(arcSpanForUnit(parsed, 60, 1, 1)).toMatchObject({ majorIndex: 1, midIndex: 1, midName: '门牌', midRange: [1, 15] })
    expect(arcSpanForUnit(parsed, 60, 1, 2)).toMatchObject({ majorIndex: 1, midIndex: 2, midName: '定价', midRange: [16, 30] })
    expect(arcSpanForUnit(parsed, 60, 1, 1)?.remainingMids.map(item => item.name)).toEqual(['定价'])
    expect(arcSpanForUnit(parsed, 60, 1, 2)?.remainingMids).toEqual([])
  })

  it('卷二只有一个单元', () => {
    expect(arcSpanForUnit(parsed, 60, 2, 1)).toMatchObject({ majorIndex: 2, midIndex: 1, midRange: [31, 60] })
  })

  it('越界 / 结构不可解析 ⇒ null', () => {
    expect(arcSpanForUnit(parsed, 60, 3, 1)).toBeNull()
    expect(arcSpanForUnit(parsed, 60, 0, 1)).toBeNull()
    expect(arcSpanForUnit(parsed, 60, 1, 3)).toBeNull()
    expect(arcSpanForUnit(parsed, 0, 1, 1)).toBeNull()
    expect(arcSpanForUnit(null, 60, 1, 1)).toBeNull()
  })
})

describe('renderUnitArcPositionBlock：不写章号、不给章数配额', () => {
  it('本单元的定位与规格，后续单元只报名字', () => {
    const block = renderUnitArcPositionBlock(parsed, 60, 1, 1, 'zh-CN')
    expect(block).toContain('本次只写：卷 1【开局】· 单元 1【门牌】')
    expect(block).toContain('本卷共 2 个单元')
    expect(block).toContain('叙事任务：立规则。')
    expect(block).toContain('单元 2【定价】')
    // 不写本单元的章号区间（会和「从第 N 章开始」打架）
    expect(block).not.toContain('第 1–15 章')
    expect(block).not.toContain('本批范围')
    // 删掉了与「不凑章数」冲突的那条原规则
    expect(block).not.toContain('章数区间是')
    expect(block).toContain('篇幅由剧情决定')
  })

  it('本卷最后一个单元：后续单元写“无”', () => {
    expect(renderUnitArcPositionBlock(parsed, 60, 1, 2, 'zh-CN')).toContain('（无 —— 这是本卷最后一个单元）')
  })

  it('英文版', () => {
    const block = renderUnitArcPositionBlock(parsed, 60, 2, 1, 'en-US')
    expect(block).toContain('Write only: volume 2 "销档" · unit 1 "配合"')
    expect(block).toContain('length follows the story')
  })

  it('结构不可解析 ⇒ 空串（不注入）', () => {
    expect(renderUnitArcPositionBlock(null, 60, 1, 1, 'zh-CN')).toBe('')
    expect(renderUnitArcPositionBlock(parsed, 60, 9, 1, 'zh-CN')).toBe('')
  })
})

describe('卷偏离与实际预期章数（计划与偏离分开存）', () => {
  it('卷计划章数与折算同源', () => {
    expect(planVolumeChapters(parsed, 60, 1)).toBe(30)
    expect(planVolumeChapters(parsed, 60, 2)).toBe(30)
    expect(planVolumeChapters(parsed, 60, 3)).toBeNull()
    expect(planVolumeChapters(null, 60, 1)).toBeNull()
  })

  it('按卷记账：偏离 = 实际 − 计划，超写为正、少写为负，**不截断**', () => {
    const under = volumeDeviationRecordOf(parsed, 60, 1, 9)!
    expect(under).toEqual({ volumeIndex: 1, planned: 30, actual: 9 })
    expect(volumeDeviationValue(under)).toBe(-21)
    const over = volumeDeviationRecordOf(parsed, 60, 1, 38)!
    expect(over).toEqual({ volumeIndex: 1, planned: 30, actual: 38 })
    expect(volumeDeviationValue(over)).toBe(8)
    expect(volumeDeviationRecordOf(parsed, 60, 1, -1)).toBeNull()
    expect(volumeDeviationRecordOf(parsed, 60, 9, 1)).toBeNull()
  })

  it('累计偏离 = 各卷之和；同一卷重写覆盖而不叠加', () => {
    const first = volumeDeviationRecordOf(parsed, 60, 1, 9)!
    const second = volumeDeviationRecordOf(parsed, 60, 2, 34)!
    const records = upsertVolumeDeviation(upsertVolumeDeviation([], first), second)
    expect(records.map(item => item.volumeIndex)).toEqual([1, 2])
    expect(accumulatedVolumeDeviation(records)).toBe(-21 + 4)
    // 卷 1 重写后覆盖原账，不是再记一条
    const rewritten = upsertVolumeDeviation(records, volumeDeviationRecordOf(parsed, 60, 1, 30)!)
    expect(rewritten).toHaveLength(2)
    expect(accumulatedVolumeDeviation(rewritten)).toBe(4)
    expect(accumulatedVolumeDeviation(null)).toBe(0)
  })

  it('卷回滚：删掉该卷的账，累计偏离随之减少', () => {
    const records = upsertVolumeDeviation(
      upsertVolumeDeviation([], volumeDeviationRecordOf(parsed, 60, 1, 9)!),
      volumeDeviationRecordOf(parsed, 60, 2, 34)!,
    )
    const rolledBack = dropVolumeDeviation(records, 2)
    expect(rolledBack.map(item => item.volumeIndex)).toEqual([1])
    expect(accumulatedVolumeDeviation(rolledBack)).toBe(-21)
    expect(dropVolumeDeviation(rolledBack, 9)).toHaveLength(1)
  })

  it('实际预期 = 计划 + 累计偏离，且至少 1 章', () => {
    expect(expectedTotalChapters(200, -63)).toBe(137)
    expect(expectedTotalChapters(200, 7)).toBe(207)
    expect(expectedTotalChapters(200, 0)).toBe(200)
    expect(expectedTotalChapters(200, -500)).toBe(1)
    expect(expectedTotalChapters(Number.NaN, 3)).toBe(1)
  })
})

describe('withProjectedUnitArcGuide：按单元裁剪 + 追加单元块', () => {
  it('保留本卷与本单元全字段，其他卷只留接续理由', () => {
    const text = withProjectedUnitArcGuide('原始弧光', PLAN, 60, 1, 1, 'zh-CN')
    expect(text).toContain('单元一：门牌')
    expect(text).toContain('叙事任务：立规则。')
    expect(text).not.toContain('只剩配合这一条路')
    expect(text).toContain('【本次所处弧位')
  })

  it('结构不可解析 ⇒ 原样返回 guide', () => {
    expect(withProjectedUnitArcGuide('原始弧光', '没有卷与单元的自由文本', 60, 1, 1, 'zh-CN')).toBe('原始弧光')
  })
})
