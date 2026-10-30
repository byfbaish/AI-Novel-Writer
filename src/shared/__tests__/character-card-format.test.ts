import { describe, expect, it } from 'vitest'

import {
  applyCardDelta,
  cardCitationIndex,
  normalizeEntryName,
  parsePersonalityCard,
  protagonistCardFromRoster,
  renderPersonalityCard,
  summarizeCharacterHits,
  type CardDeltaHit,
} from '../character-card-format'

const FULL_CARD = [
  '【禁区】',
  'X1 不替人作保 —— 宁可这趟活黄了，也不在保状上按手印',
  'X2 不当众认错 —— 宁可挨断一根肋骨，也不在人多的地方说软话',
  '【筹码】',
  '母亲：灰渠镖行洗衣，咳血',
  '灶台第三块砖里的三百文',
  '【处境】',
  'given 站在灰渠废码头，手上只有一副挑担',
  '【软肋】',
  'S1 母亲——她一流血，他什么手印都肯按',
].join('\n')

describe('personality card format v3', () => {
  it('parses all four sections of a complete card', () => {
    const card = parsePersonalityCard(FULL_CARD)
    expect(card.format).toBe('v3')
    expect(card.forbidden.map(line => line.id)).toEqual(['X1', 'X2'])
    expect(card.forbidden[0].text).toContain('宁可这趟活黄了')
    expect(card.chips.map(line => line.name)).toEqual(['母亲', '灶台第三块砖里的三百文'])
    expect(card.chips[0].text).toContain('咳血')
    expect(card.situation.given).toBe(true)
    expect(card.situation.text).toContain('灰渠废码头')
    expect(card.softSpots).toHaveLength(1)
    expect(card.softSpots[0].name).toBe('母亲')
    expect(card.issues).toEqual([])
  })

  it('treats a card without the forbidden section as legacy', () => {
    const card = parsePersonalityCard('第一层【他在乎什么】\nB1 重情（母亲）')
    expect(card.format).toBe('legacy')
    expect(card.forbidden).toEqual([])
  })

  it('treats a forbidden section with zero X lines as legacy', () => {
    // 段存在但一条编号都没有：与旧卡同待遇，避免整批刷屏。
    const card = parsePersonalityCard('【禁区】\n他这人没什么不肯做的\n【筹码】\n母亲')
    expect(card.format).toBe('legacy')
  })

  it('accepts a card with zero chips', () => {
    const card = parsePersonalityCard('【禁区】\nX1 不替人作保')
    expect(card.format).toBe('v3')
    expect(card.chips).toEqual([])
    expect(card.situation.given).toBe(false)
    expect(card.issues).toEqual([])
  })

  it('accepts a card without the soft-spot section', () => {
    const card = parsePersonalityCard('【禁区】\nX1 不替人作保')
    expect(card.softSpots).toEqual([])
    expect(card.issues).toEqual([])
  })

  it('splits the name at the first separator whatever the separator is', () => {
    const cases: Array<[string, string]> = [
      ['母亲——她一流血，他什么手印都肯按', '母亲'],
      ['母亲：灰渠镖行洗衣', '母亲'],
      ['母亲｜灰渠镖行洗衣', '母亲'],
      ['母亲: 灰渠镖行洗衣', '母亲'],
    ]
    for (const [line, expected] of cases) {
      const card = parsePersonalityCard(`【禁区】\nX1 线\n【筹码】\n${line}`)
      expect(card.chips[0]?.name).toBe(expected)
    }
  })

  it('strips decorative quotes from names', () => {
    const card = parsePersonalityCard('【禁区】\nX1 线\n【筹码】\n「母亲」：灰渠镖行洗衣')
    expect(card.chips[0]?.name).toBe('母亲')
  })

  it('treats a line without separator as a bare name', () => {
    const card = parsePersonalityCard('【禁区】\nX1 线\n【筹码】\n灰渠的旧路引')
    expect(card.chips[0]).toEqual({ name: '灰渠的旧路引', text: '' })
  })

  it('round-trips through render without drifting', () => {
    const card = parsePersonalityCard(FULL_CARD)
    const rendered = renderPersonalityCard(card)
    const again = parsePersonalityCard(rendered)
    expect(again).toEqual(card)
    expect(renderPersonalityCard(again)).toBe(rendered)
  })

  it('truncates more than three forbidden lines and records the issue', () => {
    const card = parsePersonalityCard(['【禁区】', 'X1 a', 'X2 b', 'X3 c', 'X4 d'].join('\n'))
    expect(card.forbidden).toHaveLength(3)
    expect(card.issues).toContain('too-many-forbidden')
  })

  it('reads and re-renders the English markers without switching them to Chinese', () => {
    const english = [
      '[Forbidden]',
      'X1 he would rather lose the job than sign a guarantee',
      '[Chips]',
      'his mother: she coughs blood, and he yields to anyone who can pay for it',
      '[Situation]',
      'given the dead dock at the canal town',
      '[Soft spots]',
      'S1 his mother — the moment she bleeds, he signs anything',
    ].join('\n')
    const card = parsePersonalityCard(english)
    expect(card.format).toBe('v3')
    expect(card.markerStyle).toBe('en')
    expect(card.chips[0].name).toBe('his mother')
    expect(card.softSpots[0].name).toBe('his mother')

    const rendered = renderPersonalityCard(card)
    expect(rendered).toContain('[Forbidden]')
    expect(rendered).toContain('[Soft spots]')
    expect(rendered).not.toContain('【禁区】')
    expect(parsePersonalityCard(rendered)).toEqual(card)
  })

  it('strips markdown list markers so they never become part of a name', () => {
    // 模型经常把筹码写成 `- 他的名字：……`，破折号一旦进名字，章纲就再也引用不上。
    const card = parsePersonalityCard(['【禁区】', '- X1 不替人作保', '【筹码】', '- 他的手记本：记满了账目'].join('\n'))
    expect(card.forbidden[0].id).toBe('X1')
    expect(card.chips[0]).toEqual({ name: '他的手记本', text: '记满了账目' })
  })

  it('flags a chip written as a numbered entry', () => {
    const card = parsePersonalityCard(['【禁区】', 'X1 a', '【筹码】', 'X1：老兵留下的钢刀'].join('\n'))
    expect(card.issues).toContain('numbered-chip')
  })
})

describe('card deltas', () => {
  it('adds a soft spot with the next number', () => {
    const result = applyCardDelta(FULL_CARD, { kind: 'soft-spot', name: '那副挑担', text: '压断过他一次腰' })
    expect(result.dropped).toBeUndefined()
    const card = parsePersonalityCard(result.personality)
    expect(card.softSpots.map(line => line.id)).toEqual(['S1', 'S2'])
    expect(card.softSpots[1].name).toBe('那副挑担')
  })

  it('does not duplicate a soft spot that names the same interface', () => {
    const result = applyCardDelta(FULL_CARD, { kind: 'soft-spot', name: '母亲', text: '病情加重' })
    expect(parsePersonalityCard(result.personality).softSpots).toHaveLength(1)
  })

  it('adds, replaces and loses a chip', () => {
    const added = applyCardDelta(FULL_CARD, { kind: 'chip', name: '灰渠的旧路引', change: 'add' })
    expect(parsePersonalityCard(added.personality).chips.map(line => line.name)).toContain('灰渠的旧路引')

    const replaced = applyCardDelta(added.personality, {
      kind: 'chip', change: 'replace', replaces: '灰渠的旧路引', name: '盐道的引票', text: '顶替了旧路引',
    })
    const afterReplace = parsePersonalityCard(replaced.personality)
    expect(afterReplace.chips.map(line => line.name)).toContain('盐道的引票')
    expect(afterReplace.chips.map(line => line.name)).not.toContain('灰渠的旧路引')

    const lost = applyCardDelta(replaced.personality, { kind: 'chip', change: 'lose', name: '母亲' })
    expect(parsePersonalityCard(lost.personality).chips.map(line => line.name)).not.toContain('母亲')
  })

  it('drops instead of truncating when the soft spot cap is reached', () => {
    let text = '【禁区】\nX1 线'
    for (let i = 1; i <= 5; i += 1) {
      text = applyCardDelta(text, { kind: 'soft-spot', name: `接口${i}` }).personality
    }
    const overflow = applyCardDelta(text, { kind: 'soft-spot', name: '接口6' })
    expect(overflow.dropped).toBe('soft-spot-cap')
    expect(overflow.personality).toBe(text)
  })

  it('refuses to touch a legacy card at all', () => {
    const legacy = '第一层【他在乎什么】\nB1 重情（母亲）'
    expect(() => applyCardDelta(legacy, { kind: 'soft-spot', name: '母亲' })).toThrow('CARD_FORMAT_LEGACY')
    expect(legacy).toBe('第一层【他在乎什么】\nB1 重情（母亲）')
  })
})

describe('roster projection', () => {
  const markdown = [
    '# 角色图谱',
    '',
    '## 主角：陈砚',
    '- 性别：男',
    '- 性格：' + FULL_CARD,
    '- 背景：边镇灰渠',
    '',
    '## 配角：赵铎',
    '- 性别：男',
    '- 性格：【禁区】\nX1 另一张卡的线',
    '',
  ].join('\n')

  it('picks only the protagonist block and keeps every continued line', () => {
    const card = protagonistCardFromRoster(markdown)
    expect(card?.format).toBe('v3')
    expect(card?.forbidden.map(line => line.id)).toEqual(['X1', 'X2'])
    expect(card?.chips.map(line => line.name)).toEqual(['母亲', '灶台第三块砖里的三百文'])
    expect(card?.softSpots).toHaveLength(1)
  })

  it('returns null when there is no protagonist block', () => {
    expect(protagonistCardFromRoster('# 角色图谱\n\n## 配角：赵铎\n- 性格：x')).toBeNull()
    expect(protagonistCardFromRoster('')).toBeNull()
    expect(protagonistCardFromRoster(null)).toBeNull()
  })

  it('reads the English projection too', () => {
    const english = ['# Character graph', '', '## Protagonist: Chen Yan', '- Personality: 【禁区】\nX1 a line'].join('\n')
    expect(protagonistCardFromRoster(english, 'en-US')?.forbidden[0].id).toBe('X1')
  })
})

describe('citation index and hit ledger', () => {
  it('exposes the whitelists the audit needs', () => {
    const index = cardCitationIndex(parsePersonalityCard(FULL_CARD))
    expect(index.forbiddenIds).toEqual(['X1', 'X2'])
    expect(index.softSpotIds).toEqual(['S1'])
    expect(index.chipNames).toEqual(['母亲', '灶台第三块砖里的三百文'])
  })

  it('folds hits into a read model instead of storing an aggregate', () => {
    expect(summarizeCharacterHits([])).toEqual({
      count: 0, brokenCount: 0, lastChapter: 0, lastCost: '', recent: [], byForbidden: {},
    })

    const few: CardDeltaHit[] = [
      { forbidden: 'X2', cost: '认了账', chapter: 3, broken: false },
      { forbidden: 'X1', cost: '按了手印', chapter: 8, broken: true },
      { forbidden: 'X2', cost: '当众低了头', chapter: 9, broken: true },
    ]
    const ledger = summarizeCharacterHits(few)
    expect(ledger.count).toBe(3)
    expect(ledger.brokenCount).toBe(2)
    expect(ledger.lastChapter).toBe(9)
    expect(ledger.lastCost).toBe('当众低了头')
    expect(ledger.recent.map(hit => hit.chapter)).toEqual([9, 8, 3])
    expect(ledger.byForbidden.X2).toEqual({ count: 2, brokenCount: 1 })

    // 10 条只留最近 3 条明细，全量统计仍在。
    const many: CardDeltaHit[] = Array.from({ length: 10 }, (_, index) => ({
      forbidden: 'X1', cost: `代价${index + 1}`, chapter: index + 1, broken: index % 2 === 0,
    }))
    const big = summarizeCharacterHits(many)
    expect(big.count).toBe(10)
    expect(big.recent).toHaveLength(3)
    expect(big.recent[0].chapter).toBe(10)
    expect(big.byForbidden.X1.count).toBe(10)
  })

  it('normalizes entry names the same way on both sides of a citation', () => {
    expect(normalizeEntryName('「母亲」')).toBe('母亲')
    expect(normalizeEntryName('  灶台第三块砖里的三百文， ')).toBe('灶台第三块砖里的三百文')
    expect(normalizeEntryName('《旧路引》')).toBe('旧路引')
  })
})
