import { describe, expect, it } from 'vitest'
import { summarizeVolumeWarnings } from '../volume-warning-summary'

describe('summarizeVolumeWarnings', () => {
  it('空数组 ⇒ 全零（界面不显示任何告警句）', () => {
    expect(summarizeVolumeWarnings([])).toEqual({
      observedOutOfRange: 0, ambiguousCount: 0, ambiguousChapters: '', other: 0,
    })
  })

  it('观测越界与单元重叠分开计数 —— 两者处置不同，不能共用一句归因', () => {
    const summary = summarizeVolumeWarnings([
      'VOLUME_OBSERVED_OUT_OF_RANGE:1',
      'VOLUME_UNIT_AMBIGUOUS:2:1-2:8-9',
    ])
    expect(summary.observedOutOfRange).toBe(1)
    expect(summary.ambiguousCount).toBe(1)
    expect(summary.ambiguousChapters).toBe('8-9')
  })

  it('同一处重叠的 overlap / ambiguous 只算一次（不报三遍）', () => {
    const summary = summarizeVolumeWarnings([
      'VOLUME_UNIT_OVERLAP:2:1-2:8-9',
      'VOLUME_UNIT_AMBIGUOUS:2:1-2:8-9',
      'VOLUME_UNIT_INVERTED:3:2',
    ])
    expect(summary.ambiguousCount).toBe(1)
    expect(summary.other).toBe(0)
  })

  it('多处重叠的章号按出现顺序拼起来，去掉重复', () => {
    const summary = summarizeVolumeWarnings([
      'VOLUME_UNIT_AMBIGUOUS:2:1-2:8-9',
      'VOLUME_UNIT_AMBIGUOUS:4:1-3:12',
    ])
    expect(summary.ambiguousCount).toBe(2)
    expect(summary.ambiguousChapters).toBe('8-9、12')
  })

  it('不认识的前缀不静默吞掉 —— 计入 other，界面至少会显示「另有 N 条」', () => {
    const summary = summarizeVolumeWarnings(['SOMETHING_NEW:1', 'VOLUME_OBSERVED_OUT_OF_RANGE:2'])
    expect(summary.other).toBe(1)
    expect(summary.observedOutOfRange).toBe(1)
  })
})
