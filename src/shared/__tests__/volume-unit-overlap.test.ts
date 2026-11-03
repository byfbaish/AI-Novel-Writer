import { describe, expect, it } from 'vitest'
import { findUnitOverlaps } from '../volume-unit-overlap'
import type { UnitRange } from '../volume-unit-overlap'

function unit(label: string, from: number, to: number): UnitRange {
  return { label, from, to }
}

describe('findUnitOverlaps', () => {
  it('第 2 卷真实样本 [{7,9},{8,9},{10,10}] ⇒ overlap 交集 8–9 且 ambiguous-chapter 含 8、9', () => {
    const result = findUnitOverlaps([unit('7-9', 7, 9), unit('8-9', 8, 9), unit('10-10', 10, 10)])
    const overlap = result.filter((f) => f.kind === 'overlap')
    expect(overlap).toEqual([{ kind: 'overlap', chapters: [8, 9], units: ['7-9', '8-9'] }])
    const ambiguous = result.filter((f) => f.kind === 'ambiguous-chapter')
    expect(ambiguous).toHaveLength(1)
    expect(ambiguous[0].chapters).toContain(8)
    expect(ambiguous[0].chapters).toContain(9)
    expect(ambiguous[0].units).toEqual(['7-9', '8-9'])
  })

  it('第 1 卷真实样本 [{1,3},{4,4},{5,6}] ⇒ 返回空数组', () => {
    expect(findUnitOverlaps([unit('1-3', 1, 3), unit('4-4', 4, 4), unit('5-6', 5, 6)])).toEqual([])
  })

  it('单点区间 [{5,5},{6,6}] 不报重叠', () => {
    expect(findUnitOverlaps([unit('5-5', 5, 5), unit('6-6', 6, 6)])).toEqual([])
  })

  it('相接不算重叠：[{1,3},{4,6}] ⇒ 空（3 和 4 相邻但无交集）', () => {
    expect(findUnitOverlaps([unit('1-3', 1, 3), unit('4-6', 4, 6)])).toEqual([])
  })

  it('from > to ⇒ 报 inverted-range 且不参与后续重叠计算', () => {
    const result = findUnitOverlaps([unit('a', 3, 1), unit('b', 1, 5)])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ kind: 'inverted-range', chapters: [3, 1], units: ['a'] })
  })

  it('完整包含 [{1,10},{3,4}] ⇒ overlap 报 3–4', () => {
    const result = findUnitOverlaps([unit('whole', 1, 10), unit('inner', 3, 4)])
    const overlap = result.filter((f) => f.kind === 'overlap')
    expect(overlap).toEqual([{ kind: 'overlap', chapters: [3, 4], units: ['whole', 'inner'] }])
  })

  it('kind 顺序固定为 inverted-range → overlap → ambiguous-chapter，kind 内按 chapters[0] 升序', () => {
    const result = findUnitOverlaps([
      unit('b', 1, 4),
      unit('c', 3, 6),
      unit('bad', 5, 2),
      unit('d', 8, 8),
    ])
    expect(result.map((f) => f.kind)).toEqual(['inverted-range', 'overlap', 'ambiguous-chapter'])
    // overlap：唯一一对是 (b,c)，交集 3–4。
    expect(result.filter((f) => f.kind === 'overlap')[0].chapters).toEqual([3, 4])
    // ambiguous：章 3、4 被 b、c 覆盖。
    const ambiguous = result.filter((f) => f.kind === 'ambiguous-chapter')[0]
    expect(ambiguous.chapters).toEqual([3, 4])
    expect(ambiguous.units).toEqual(['b', 'c'])
  })

  it('空输入 ⇒ 空数组', () => {
    expect(findUnitOverlaps([])).toEqual([])
  })
})
