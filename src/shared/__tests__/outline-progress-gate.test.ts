import { describe, expect, it } from 'vitest'

import { outlineProgressAckKey, outlineProgressGateOf } from '../outline-progress-gate'
import { volumeHandoffAckKey } from '../volume-handoff-gate'
import type { VolumeDefinition } from '../volume-structure'

const volume = (over: Partial<VolumeDefinition> = {}): VolumeDefinition => ({
  volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
  plannedFirst: 1, plannedLast: 20, plannedSource: 'headings',
  actualLast: null, actualSource: null,
  outlineHash: 'hash:1', source: 'outline', createdAt: '', updatedAt: '',
  ...over,
})

const volumes = [
  volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 20 }),
  volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 21, plannedLast: 40 }),
]

const authority = (lastChapterNumber: number, status: 'empty' | 'continuous' | 'invalid' = 'continuous') =>
  ({ status, lastChapterNumber })

describe('outlineProgressGateOf — 大纲领先正文的闸门', () => {
  it('第 1 章与卷中章都不适用（不打扰作者）', () => {
    expect(outlineProgressGateOf({ volumes, authority: authority(0), acknowledged: [], chapterNumber: 1 })).toBeNull()
    expect(outlineProgressGateOf({ volumes, authority: authority(0), acknowledged: [], chapterNumber: 7 })).toBeNull()
    // 第 21 章是第 2 卷第一章 ⇒ 要判第 1 卷
    expect(outlineProgressGateOf({ volumes, authority: authority(0), acknowledged: [], chapterNumber: 21 })).not.toBeNull()
  })

  it('上一卷正文未整卷定稿 ⇒ ahead，并说清还差几章', () => {
    const gate = outlineProgressGateOf({ volumes, authority: authority(12), acknowledged: [], chapterNumber: 21 })
    expect(gate?.state).toBe('ahead')
    expect(gate?.range.volumeId).toBe('volume:1')
    expect(gate?.draftLastChapter).toBe(12)
    expect(gate?.missingChapters).toBe(8)
  })

  it('上一卷已整卷定稿 ⇒ aligned', () => {
    expect(outlineProgressGateOf({ volumes, authority: authority(20), acknowledged: [], chapterNumber: 21 })?.state)
      .toBe('aligned')
    // 写超也算：定稿超过卷末章同样是「写完了」
    expect(outlineProgressGateOf({ volumes, authority: authority(23), acknowledged: [], chapterNumber: 21 })?.state)
      .toBe('aligned')
  })

  it('章号账本 invalid ⇒ 视为未定稿，不把坏账当完成', () => {
    const gate = outlineProgressGateOf({
      volumes, authority: authority(20, 'invalid'), acknowledged: [], chapterNumber: 21,
    })
    expect(gate?.state).toBe('ahead')
    expect(gate?.authorityStatus).toBe('invalid')
    // 差章数为 0 如实给出：面板要说的是「账本有洞」，不是「还差几章」
    expect(gate?.missingChapters).toBe(0)
  })

  it('作者已确认 ⇒ aligned，撤销后重新提醒', () => {
    const acknowledged = [outlineProgressAckKey('volume:1')]
    expect(outlineProgressGateOf({ volumes, authority: authority(0), acknowledged, chapterNumber: 21 })?.state)
      .toBe('aligned')
    expect(outlineProgressGateOf({ volumes, authority: authority(0), acknowledged: [], chapterNumber: 21 })?.state)
      .toBe('ahead')
  })

  it('上一卷末章未定（计划与实际都是空）⇒ 不适用，而不是误判成没写完', () => {
    expect(outlineProgressGateOf({
      volumes: [volume({ plannedFirst: null, plannedLast: null })],
      authority: authority(0),
      acknowledged: [],
      chapterNumber: 21,
    })).toBeNull()
  })

  it('确认键带独立前缀，与开写闸门同表共存且不串键', () => {
    expect(outlineProgressAckKey('volume:3')).toBe('outline-progress:volume:3')
    // 开写闸门的确认不该放行大纲闸门
    expect(outlineProgressGateOf({
      volumes, authority: authority(0), acknowledged: [volumeHandoffAckKey('volume:1')], chapterNumber: 21,
    })?.state).toBe('ahead')
  })

  it('卷表为空 ⇒ 不适用（fail-open：老项目没有卷结构）', () => {
    expect(outlineProgressGateOf({ volumes: [], authority: authority(0), acknowledged: [], chapterNumber: 21 }))
      .toBeNull()
  })
})
