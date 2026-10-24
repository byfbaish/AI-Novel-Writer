import { describe, expect, it } from 'vitest'

import { volumeHandoffAckKey, volumeHandoffGateOf } from '../volume-handoff-gate'
import type { VolumeHandoffDefinition } from '../volume-handoff'
import type { VolumeDefinition } from '../volume-structure'

const volume = (over: Partial<VolumeDefinition> = {}): VolumeDefinition => ({
  volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
  plannedFirst: 1, plannedLast: 20, plannedSource: 'headings',
  actualLast: null, actualSource: null,
  outlineHash: 'hash:1', source: 'outline', createdAt: '', updatedAt: '',
  ...over,
})

const handoff = (over: Partial<VolumeHandoffDefinition> = {}): VolumeHandoffDefinition => ({
  handoffId: 'handoff:1', volumeId: 'volume:1', volumeIndex: 1,
  firstChapter: 1, lastChapter: 20, boundaryBasis: 'headings',
  worldState: '围城', heroState: '重伤', events: [], items: [], debts: [], openThread: '',
  source: 'author', createdAt: '', updatedAt: '',
  ...over,
})

const volumes = [
  volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 20 }),
  volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 21, plannedLast: 40 }),
]

describe('volumeHandoffGateOf — 开写闸门', () => {
  it('第 1 章与非卷首章都不适用（不打扰作者）', () => {
    expect(volumeHandoffGateOf({ volumes, handoffs: [], acknowledged: [], chapterNumber: 1 })).toBeNull()
    expect(volumeHandoffGateOf({ volumes, handoffs: [], acknowledged: [], chapterNumber: 7 })).toBeNull()
    expect(volumeHandoffGateOf({ volumes, handoffs: [], acknowledged: [], chapterNumber: 21 })).not.toBeNull()
  })

  it('上一卷没有交接单 ⇒ missing', () => {
    const gate = volumeHandoffGateOf({ volumes, handoffs: [], acknowledged: [], chapterNumber: 21 })
    expect(gate?.state).toBe('missing')
    expect(gate?.range.volumeId).toBe('volume:1')
    expect(gate?.handoff).toBeNull()
  })

  it('只有模型初稿 ⇒ unreviewed-draft（初稿没人看过就不算交接完成）', () => {
    const gate = volumeHandoffGateOf({
      volumes, handoffs: [handoff({ source: 'generated' })], acknowledged: [], chapterNumber: 21,
    })
    expect(gate?.state).toBe('unreviewed-draft')
  })

  it('作者版 ⇒ clear', () => {
    const gate = volumeHandoffGateOf({
      volumes, handoffs: [handoff({ source: 'author' })], acknowledged: [], chapterNumber: 21,
    })
    expect(gate?.state).toBe('clear')
  })

  it('作者已确认 ⇒ clear，哪怕手上只有初稿', () => {
    const gate = volumeHandoffGateOf({
      volumes,
      handoffs: [handoff({ source: 'generated' })],
      acknowledged: [volumeHandoffAckKey('volume:1')],
      chapterNumber: 21,
    })
    expect(gate?.state).toBe('clear')
  })

  it('确认键按卷区分：确认了第 1 卷不该放行第 2 卷', () => {
    expect(volumeHandoffGateOf({
      volumes, handoffs: [], acknowledged: [volumeHandoffAckKey('volume:1')], chapterNumber: 21,
    })?.state).toBe('clear')
    expect(volumeHandoffGateOf({
      volumes, handoffs: [], acknowledged: [volumeHandoffAckKey('volume:1')], chapterNumber: 41,
    })?.state).toBe('missing')
  })

  it('卷末章未定（计划与实际都为空）⇒ 不适用，而不是误判成「没有交接单」', () => {
    expect(volumeHandoffGateOf({
      volumes: [volume({ plannedFirst: null, plannedLast: null })],
      handoffs: [],
      acknowledged: [],
      chapterNumber: 21,
    })).toBeNull()
  })

  it('确认键带前缀，避免与其它缺省豁免撞键', () => {
    expect(volumeHandoffAckKey('volume:3')).toBe('volume-handoff:volume:3')
  })
})
