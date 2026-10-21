import { describe, expect, it } from 'vitest'
import {
  judgeReviewStateConflict,
  locateReviewStateObservations,
  normalizeStateValue,
} from '../review-state-conflict'

const content = '清晨出门时他怀里揣着六枚灵石。傍晚回到药铺，灵石只剩四枚。柜台后落着一层薄灰。'

function spanOf(quote: string) {
  const start = content.indexOf(quote)
  return { start, end: start + quote.length }
}

describe('normalizeStateValue', () => {
  it('erases only differences that carry no information', () => {
    expect(normalizeStateValue('  六枚 ')).toBe(normalizeStateValue('六枚'))
    expect(normalizeStateValue('剩余：4 枚。')).toBe(normalizeStateValue('剩余:4枚'))
    expect(normalizeStateValue('「药铺柜台后」')).toBe(normalizeStateValue('药铺柜台后'))
    expect(normalizeStateValue('ＡＢＣ')).toBe(normalizeStateValue('abc'))
  })

  // 「差不多」正是 AC5 那种静默失效的来源：归一化一旦开始猜同义，就会把 6 与 16
  // 也猜成一样。所以这两种差异**故意**留下，由作者裁决。
  it('deliberately keeps Chinese numerals and leading labels distinct', () => {
    expect(normalizeStateValue('六枚')).not.toBe(normalizeStateValue('6枚'))
    expect(normalizeStateValue('余量：6枚')).not.toBe(normalizeStateValue('6枚'))
    expect(normalizeStateValue('6枚')).not.toBe(normalizeStateValue('16枚'))
  })
})

describe('judgeReviewStateConflict', () => {
  it('agrees whenever both readers report the same value, wherever they read it', () => {
    const first = spanOf('六枚灵石')
    const second = spanOf('灵石只剩四枚')
    expect(judgeReviewStateConflict(
      { observed: '六枚灵石', span: first },
      { value: '　六枚灵石。', span: second },
    )).toBe('agree')
  })

  // 判据 DA 的核心：同一段话读出两个值，说明至少一方读错了。
  it('treats two different values read from the same passage as a conflict', () => {
    const same = spanOf('灵石只剩四枚')
    expect(judgeReviewStateConflict(
      { observed: '还剩六枚', span: same },
      { value: '还剩四枚', span: same },
    )).toBe('conflict')
  })

  // 同一章内的正常时间推进：审稿引前文、定稿引后文，不构成冲突。
  it('lets the later passage win when the two readers quote different moments', () => {
    expect(judgeReviewStateConflict(
      { observed: '六枚', span: spanOf('揣着六枚灵石') },
      { value: '四枚', span: spanOf('灵石只剩四枚') },
    )).toBe('finalization-wins')
  })

  // 反过来：正文更靠后处已经写了新值，定稿却按前文写回 —— 这是漏读后文，必须问。
  it('raises a conflict when the review read a later passage than the finalization did', () => {
    expect(judgeReviewStateConflict(
      { observed: '四枚', span: spanOf('灵石只剩四枚') },
      { value: '六枚', span: spanOf('揣着六枚灵石') },
    )).toBe('conflict')
  })

  it('treats an adjacent span boundary as review-later, not as overlap', () => {
    const later = spanOf('傍晚回到药铺')
    const earlier = spanOf('清晨出门时他怀里揣着六枚灵石。')
    expect(earlier.end).toBe(later.start)
    expect(judgeReviewStateConflict({ observed: '四枚', span: later }, { value: '六枚', span: earlier }))
      .toBe('conflict')
  })
})

describe('locateReviewStateObservations', () => {
  const item = { characterName: '顾长风', field: 'keyItems' as const, observed: '六枚', quote: '揣着六枚灵石' }

  it('returns the exact span in the finalized prose and keeps trimmed quotes as-is', () => {
    expect(locateReviewStateObservations([{ ...item, quote: '  揣着六枚灵石  ' }], content)).toEqual([
      { ...item, quote: '揣着六枚灵石', span: { start: content.indexOf('揣着六枚灵石'), end: content.indexOf('揣着六枚灵石') + 6 },
        origin: 'finalized' },
    ])
  })

  // 不丢弃、只标 null：丢弃等于「审稿提过但锚点坏了」这件事对作者不可见。
  it('marks unlocatable or ambiguous quotes as null instead of dropping them', () => {
    const observations = locateReviewStateObservations([
      { ...item, quote: '这句话正文里没有' },
      { ...item, quote: '枚' },
    ], content)
    expect(observations).toHaveLength(2)
    expect(observations.map(observation => observation.span)).toEqual([null, null])
    expect(observations.map(observation => observation.origin)).toEqual(['unlocatable', 'unlocatable'])
  })

  // 合并修订是原地写回同一 draft ⇒ 审稿正文与定稿正文几乎从不相等。整篇比哈希就一章都不触发，
  // 所以闸门下沉到逐条：引文还在就判，被修订掉就跳过。
  it('still locates a quote that survived a rewrite of the surrounding prose', () => {
    const revised = '清晨出门时他怀里揣着六枚灵石。傍晚回到药铺，灵石只剩四枚。（本节已精修）'
    expect(locateReviewStateObservations([item], revised, content)).toEqual([
      { ...item, quote: '揣着六枚灵石', span: { start: revised.indexOf('揣着六枚灵石'), end: revised.indexOf('揣着六枚灵石') + 6 },
        origin: 'finalized' },
    ])
  })

  it('reports a quote that only the reviewed version had as revised-away, not as broken evidence', () => {
    const revised = '清晨出门时他怀里揣着六枚灵石。傍晚回到药铺，灵石全换成了丹药。'
    expect(locateReviewStateObservations([{ ...item, quote: '灵石只剩四枚' }], revised, content)).toEqual([
      { ...item, quote: '灵石只剩四枚', span: null, origin: 'revised-away' },
    ])
  })

  // 两版都定位不到 = 报告体本身坏了：这不是「改过了」，是证据不可用（判据 CS）。
  it('keeps a quote locatable in neither version as unlocatable', () => {
    const revised = '清晨出门时他怀里揣着六枚灵石。'
    expect(locateReviewStateObservations([{ ...item, quote: '这句话两版里都没有' }], revised, content))
      .toEqual([{ ...item, quote: '这句话两版里都没有', span: null, origin: 'unlocatable' }])
  })
})
