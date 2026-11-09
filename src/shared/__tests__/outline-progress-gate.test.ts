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
    expect(gate?.reason).toBe('prose-unfinalized')
    expect(gate?.range.volumeId).toBe('volume:1')
    expect(gate?.draftLastChapter).toBe(12)
    expect(gate?.missingChapters).toBe(8)
  })

  it('上一卷已整卷定稿且交接单可用 ⇒ aligned', () => {
    expect(outlineProgressGateOf({
      volumes, authority: authority(20), acknowledged: [], chapterNumber: 21, handoff: 'usable',
    })?.state).toBe('aligned')
    // 写超也算：定稿超过卷末章同样是「写完了」
    expect(outlineProgressGateOf({
      volumes, authority: authority(23), acknowledged: [], chapterNumber: 21, handoff: 'usable',
    })?.state).toBe('aligned')
  })

  it('不传第二维 ⇒ 按 unknown 处理，行为与扩维之前一致（fail-open）', () => {
    const gate = outlineProgressGateOf({ volumes, authority: authority(20), acknowledged: [], chapterNumber: 21 })
    expect(gate?.state).toBe('aligned')
    expect(gate?.handoff).toBe('unknown')
  })

  it('正文已定稿但没有交接单 ⇒ ahead / handoff-missing（D3 形态 A）', () => {
    const gate = outlineProgressGateOf({
      volumes, authority: authority(20), acknowledged: [], chapterNumber: 21, handoff: 'missing',
    })
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('handoff-missing')
    expect(gate?.handoff).toBe('missing')
    // 这一档说的是「材料不可用」，不是「还差几章」——差章数如实为 0
    expect(gate?.missingChapters).toBe(0)
  })

  it('交接单过期 ⇒ ahead / handoff-stale（D3 形态 B）', () => {
    const gate = outlineProgressGateOf({
      volumes, authority: authority(20), acknowledged: [], chapterNumber: 21, handoff: 'stale',
    })
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('handoff-stale')
  })

  it('交接单装不进篇幅预算 ⇒ ahead / handoff-unusable（复核 2026-11-06 补的档）', () => {
    const gate = outlineProgressGateOf({
      volumes, authority: authority(20), acknowledged: [], chapterNumber: 21, handoff: 'unusable',
    })
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('handoff-unusable')
  })

  it('两维同时不过 ⇒ 只报第一维（正文都没写完时讲交接单是废话）', () => {
    const gate = outlineProgressGateOf({
      volumes, authority: authority(12), acknowledged: [], chapterNumber: 21, handoff: 'missing',
    })
    expect(gate?.reason).toBe('prose-unfinalized')
  })

  it('章号账本 invalid ⇒ 视为未定稿，不把坏账当完成', () => {
    const gate = outlineProgressGateOf({
      volumes, authority: authority(20, 'invalid'), acknowledged: [], chapterNumber: 21, handoff: 'usable',
    })
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('prose-unfinalized')
    expect(gate?.authorityStatus).toBe('invalid')
    // 差章数为 0 如实给出：面板要说的是「账本有洞」，不是「还差几章」
    expect(gate?.missingChapters).toBe(0)
  })

  it('过期优先于已确认：交接单 stale 压不住（修法 C，D21）', () => {
    const acknowledged = [outlineProgressAckKey('volume:1')]
    const gate = outlineProgressGateOf({
      volumes, authority: authority(20), acknowledged, chapterNumber: 21, handoff: 'stale',
    })
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('handoff-stale')
  })

  it('正文没写完时仍报第一维：过期优先不越过「两维依次判」', () => {
    // 正文都没写完时讲交接单是废话；单过期不该把「去写正文」这条可执行结论顶掉。
    expect(outlineProgressGateOf({
      volumes, authority: authority(12), acknowledged: [], chapterNumber: 21, handoff: 'stale',
    })?.reason).toBe('prose-unfinalized')
    // 这一档里确认仍然有效：作者确认的是「先铺大纲」，与单有没有过期无关。
    expect(outlineProgressGateOf({
      volumes, authority: authority(12), acknowledged: [outlineProgressAckKey('volume:1')], chapterNumber: 21, handoff: 'stale',
    })?.state).toBe('aligned')
  })

  it('只有 stale 提前：missing / unusable 仍被确认压住（否则每次卷首都弹）', () => {
    const acknowledged = [outlineProgressAckKey('volume:1')]
    for (const handoff of ['missing', 'unusable'] as const) {
      const gate = outlineProgressGateOf({
        volumes, authority: authority(20), acknowledged, chapterNumber: 21, handoff,
      })
      expect(gate?.state).toBe('aligned')
    }
  })

  it('传入现算区间时按注入的区间判，且如实报来源与表新鲜度', () => {
    const liveRanges = [{ volumeId: 'volume:1', volumeIndex: 1, name: '第1卷', first: 1, last: 12, basis: 'headings' as const, actualLast: null }]
    const gate = outlineProgressGateOf({
      volumes,
      ranges: liveRanges,
      structureStale: true,
      authority: authority(12),
      acknowledged: [],
      chapterNumber: 13,
      handoff: 'usable',
    })
    expect(gate?.range.last).toBe(12)
    expect(gate?.boundarySource).toBe('live')
    expect(gate?.structureStale).toBe(true)
    // 正文定稿到 12 = 现算卷末 ⇒ 不该报还差 8 章（那是旧表边界 20 才会得出的结论）
    expect(gate?.state).toBe('aligned')
    expect(gate?.missingChapters).toBe(0)
  })

  it('不传现算区间 ⇒ 来源如实报 table（老调用方行为不变）', () => {
    const gate = outlineProgressGateOf({ volumes, authority: authority(20), acknowledged: [], chapterNumber: 21, handoff: 'usable' })
    expect(gate?.boundarySource).toBe('table')
    expect(gate?.structureStale).toBe(false)
  })

  it('作者已确认 ⇒ aligned，撤销后重新提醒', () => {
    const acknowledged = [outlineProgressAckKey('volume:1')]
    expect(outlineProgressGateOf({
      volumes, authority: authority(0), acknowledged, chapterNumber: 21,
    })?.state).toBe('aligned')
    // 确认一次管住两维：交接单缺失（**不是**过期）不该在作者点头后再弹第二次
    expect(outlineProgressGateOf({
      volumes, authority: authority(20), acknowledged, chapterNumber: 21, handoff: 'missing',
    })?.state).toBe('aligned')
    expect(outlineProgressGateOf({
      volumes, authority: authority(0), acknowledged: [], chapterNumber: 21,
    })?.state).toBe('ahead')
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
