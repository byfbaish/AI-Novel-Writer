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
})
