import { describe, expect, it } from 'vitest'
import { formatVolumeRangeLabel } from '../volume-range-label'
import type { VolumeRange } from '../volume-structure'

/** 验收走中文路径：text 直接取中文参数。 */
const pickZh = (_zh: string) => _zh
/** 英文路径防回归：text 取英文参数。 */
const pickEn = (_zh: string, en: string) => en

function range(partial: Pick<VolumeRange, 'first' | 'last' | 'basis' | 'actualLast'>): VolumeRange {
  return {
    volumeId: 'v1',
    volumeIndex: 1,
    name: '测试卷',
    ...partial,
  }
}

describe('formatVolumeRangeLabel', () => {
  it('range 为 undefined 时输出「—」', () => {
    expect(formatVolumeRangeLabel(undefined, pickZh)).toBe('—')
  })

  it('first 为 null 时输出「起止未定」', () => {
    const value = range({ first: null, last: 10, basis: 'even', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('起止未定')
  })

  it('last 为 null 时输出「起止未定」', () => {
    const value = range({ first: 7, last: null, basis: 'even', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('起止未定')
  })

  it('basis=even、进度落后于边界时带「（已写 N）」', () => {
    const value = range({ first: 7, last: 10, basis: 'even', actualLast: 9 })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('第7–10章 · 估算（已写 9）')
  })

  it('basis=declared、无进度时不带「已写」', () => {
    const value = range({ first: 41, last: 60, basis: 'declared', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('第41–60章 · 折算')
  })

  it('进度正好等于边界时不出现「已写」（D19：进度≠边界提示）', () => {
    const value = range({ first: 7, last: 10, basis: 'even', actualLast: 10 })
    const label = formatVolumeRangeLabel(value, pickZh)
    expect(label).toBe('第7–10章 · 估算')
    expect(label).not.toContain('已写')
  })

  it('英文路径与现状一致：`ch 41–60 · scaled`', () => {
    const value = range({ first: 41, last: 60, basis: 'declared', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickEn)).toBe('ch 41–60 · scaled')
  })

  it('basis=actual、无进度时输出「实际」', () => {
    const value = range({ first: 41, last: 60, basis: 'actual', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('第41–60章 · 实际')
  })

  it('basis=actual、进度落后于边界时带「（已写 N）」', () => {
    const value = range({ first: 41, last: 60, basis: 'actual', actualLast: 48 })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('第41–60章 · 实际（已写 48）')
  })

  it('英文路径：basis=actual 输出 `ch 41–60 · actual`', () => {
    const value = range({ first: 41, last: 60, basis: 'actual', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickEn)).toBe('ch 41–60 · actual')
  })

  it('basis=headings、无进度时输出「精确」', () => {
    const value = range({ first: 41, last: 60, basis: 'headings', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('第41–60章 · 精确')
  })

  it('basis=headings、进度落后于边界时带「（已写 N）」', () => {
    const value = range({ first: 41, last: 60, basis: 'headings', actualLast: 48 })
    expect(formatVolumeRangeLabel(value, pickZh)).toBe('第41–60章 · 精确（已写 48）')
  })

  it('英文路径：basis=headings 输出 `ch 41–60 · exact`', () => {
    const value = range({ first: 41, last: 60, basis: 'headings', actualLast: null })
    expect(formatVolumeRangeLabel(value, pickEn)).toBe('ch 41–60 · exact')
  })

  const BASIS_WORD_ZH: Record<VolumeRange['basis'], string> = {
    actual: '实际',
    headings: '精确',
    declared: '折算',
    even: '估算',
  }

  const PROGRESS_STATES = [
    { state: '无进度', actualLast: null, suffix: '' },
    { state: '进度落后于边界', actualLast: 9, suffix: '（已写 9）' },
    { state: '进度等于边界', actualLast: 10, suffix: '' },
  ] as const

  const tableCases: Array<{
    basis: VolumeRange['basis']
    state: string
    actualLast: number | null
    expected: string
  }> = []
  for (const basis of ['actual', 'headings', 'declared', 'even'] as const) {
    for (const { state, actualLast, suffix } of PROGRESS_STATES) {
      tableCases.push({
        basis,
        state,
        actualLast,
        expected: `第7–10章 · ${BASIS_WORD_ZH[basis]}${suffix}`,
      })
    }
  }

  it.each(tableCases)('表格驱动：basis=$basis、$state 时输出「$expected」', ({ basis, actualLast, expected }) => {
    const label = formatVolumeRangeLabel(range({ first: 7, last: 10, basis, actualLast }), pickZh)
    expect(label).toBe(expected)
    const expectProgress = actualLast !== null && actualLast !== 10
    expect(label.includes('已写')).toBe(expectProgress)
  })
})
