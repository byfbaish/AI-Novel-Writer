import { describe, expect, it } from 'vitest'

import { parsePersonalityCard } from '../character-card-format'
import { auditDispositionCitations } from '../disposition-citation'

/**
 * 主角卡的固定夹具。**必须走真解析器** —— 手写 PersonalityCard 结构会让
 * 「解析器改了、测试还绿」这种事发生（那正是这一段最该防的）。
 */
const CARD = parsePersonalityCard([
  '【禁区】',
  'X1 不替人作保 —— 宁可不接这趟活，也不在保状上按手印',
  'X2 不当众认错 —— 宁可挨断一根肋骨，也不在人多的地方说软话',
  '【筹码】',
  '母亲：镖行洗衣，咳血',
  '灶台第三块砖里的三百文',
  '【处境】',
  'given 站在灰渠废码头，手上只有一副挑担',
].join('\n'))

/** 旧四层卡 —— 没有【禁区】段，解析成 legacy。 */
const LEGACY_CARD = parsePersonalityCard('第一层【他在乎什么】\nB1 重情（母亲）\n第三层\nD1 他怎么做')

/** 英文项目的卡：名字是英文，引用也必须是英文才对得上。 */
const CARD_EN = parsePersonalityCard([
  '[Forbidden]',
  'X1 he never signs a guarantee for another man',
  '[Chips]',
  'his mother: she coughs blood and he yields to anyone who can pay for it',
  '[Situation]',
  'given the dead dock at the canal town',
].join('\n'))

function chapter(index: number, choice: string, name = '门口'): string {
  return [`## 第${index}章：${name}`, '', choice, '', '正文一段。', '', '钩子：门没关。', ''].join('\n')
}

/** 带「定性：」行的版本 —— 定性在章标题行与选择行之间，单独一行。 */
function chapterQ(index: number, qualify: string, choice: string, name = '门口'): string {
  return [`## 第${index}章：${name}`, '', qualify, '', choice, '', '正文一段。', '', '钩子：门没关。', ''].join('\n')
}

const CODES = (synopsis: string, extra: Record<string, unknown> = {}) =>
  auditDispositionCitations({ synopsis, card: CARD, ...extra }).map(finding => finding.code)

describe('性格引用体检（三格）', () => {
  it('引用了卡上存在的禁区就不报', () => {
    const synopsis = chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X1：不替人作保')
    expect(CODES(synopsis)).toEqual([])
  })

  it('选择行没有任何依据就报 ARC_CHOICE_NO_BASIS', () => {
    const synopsis = chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为他向来谨慎')
    const findings = auditDispositionCitations({ synopsis, card: CARD })
    expect(findings.map(finding => finding.code)).toEqual(['ARC_CHOICE_NO_BASIS'])
    expect(findings[0].chapter).toContain('第1章')
  })

  it('显式写「无」是合法依据', () => {
    expect(CODES(chapter(1, '选择：自己 —— 他一个人走了｜否掉了 求人，因为 无：他不在场'))).toEqual([])
  })

  it('引用了卡上没有的编号就报 ARC_CHOICE_UNKNOWN_X', () => {
    const findings = auditDispositionCitations({ synopsis: chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X7：某条线'), card: CARD })
    expect(findings.map(finding => finding.code)).toEqual(['ARC_CHOICE_UNKNOWN_X'])
    expect(findings[0].zh).toContain('X7')
  })

  it('筹码按名字引用，名字不在卡上就报 ARC_CHOICE_UNKNOWN_CHIP', () => {
    expect(CODES(chapter(1, '选择：交换 —— 他拿出一张引票｜否掉了 硬闯，因为 筹码：母亲'))).toEqual([])
    expect(CODES(chapter(1, '选择：交换 —— 他拿出一张引票｜否掉了 硬闯，因为 筹码：隔壁老王')))
      .toEqual(['ARC_CHOICE_UNKNOWN_CHIP'])
  })

  it('软肋在登记前允许先引用，但名字必须和卡一致', () => {
    // 卡上还没有【软肋】段：引用它不报错（章末定稿才登记）
    expect(CODES(chapter(1, '选择：交换 —— 他按了手印｜否掉了 掉头走，因为 软肋：母亲的病'))).toEqual([])
  })

  it('连续 5 章指向同一条禁区才报，4 章不报', () => {
    const four = [1, 2, 3, 4].map(index => chapterQ(index, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错')).join('\n')
    expect(CODES(four)).toEqual([])

    const five = [1, 2, 3, 4, 5].map(index => chapterQ(index, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错')).join('\n')
    const findings = auditDispositionCitations({ synopsis: five, card: CARD })
    expect(findings.map(finding => finding.code)).toEqual(['ARC_CHOICE_SAME_X'])
    expect(findings[0].chapter).toContain('第5章')
  })

  it('中间换一条会把连续计数打断', () => {
    const synopsis = [
      chapterQ(1, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错'),
      chapterQ(2, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错'),
      chapterQ(3, '定性：X1 — 有人递来保状', '选择：规则 —— 他退了回去｜否掉了 按手印，因为 X1：不替人作保'),
      chapterQ(4, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错'),
      chapterQ(5, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错'),
    ].join('\n')
    expect(CODES(synopsis)).toEqual([])
  })

  it('同一条禁区被破两次就报 ARC_CHOICE_REPEAT_BREAK', () => {
    const once = chapter(4, '选择：交换 —— 他按了手印｜否掉了 掉头走，因为 顶撞X1：丢了定金')
    expect(CODES(once)).toEqual([])

    const twice = [
      chapter(4, '选择：交换 —— 他按了手印｜否掉了 掉头走，因为 顶撞X1：丢了定金'),
      chapter(9, '选择：交换 —— 他又按了一次｜否掉了 掉头走，因为 顶撞X1：母亲没药了'),
    ].join('\n')
    const findings = auditDispositionCitations({ synopsis: twice, card: CARD })
    expect(findings.map(finding => finding.code)).toEqual(['ARC_CHOICE_REPEAT_BREAK'])
    expect(findings[0].chapter).toContain('第9章')
  })

  it('破了一条不存在的禁区同样报 UNKNOWN_X', () => {
    expect(CODES(chapter(1, '选择：交换 —— 他按了手印｜否掉了 掉头走，因为 顶撞X5：丢了定金')))
      .toEqual(['ARC_CHOICE_UNKNOWN_X'])
  })
})

describe('定型与依据的一致性矩阵', () => {
  const cases: Array<[string, string, boolean]> = [
    // [定性, 依据, 是否允许]
    ['定性：X2 — 当众被问责', '因为 X2：不当众认错', true],
    ['定性：X2 — 当众被问责', '因为 X1：不替人作保', false],
    ['定性：X1 — 有人递来保状', '因为 顶撞X1：按了手印', true],
    ['定性：X1 — 有人递来保状', '因为 顶撞X2：跪了', false],
    ['定性：筹码：母亲 — 她被扣了', '因为 筹码：母亲', true],
    ['定性：筹码：母亲 — 她被扣了', '因为 X1：不替人作保', true],
    ['定性：筹码：母亲 — 她被扣了', '因为 筹码：三百文', false],
    ['定性：无 — 他在山里', '因为 无：全章未出场', true],
    ['定性：无 — 他在山里', '因为 X1：不替人作保', false],
  ]

  for (const [qualify, basis, allowed] of cases) {
    it(`${qualify} ⇒ ${basis} ${allowed ? '允许' : '报 MISMATCH'}`, () => {
      const synopsis = chapterQ(1, qualify, `选择：自己 —— 他动了｜否掉了 不动，${basis}`)
      const codes = CODES(synopsis)
      expect(codes.includes('ARC_CHOICE_MISMATCH')).toBe(!allowed)
    })
  }

  it('没有定性行的旧格式大纲不做一致性比较', () => {
    expect(CODES(chapter(1, '选择：自己 —— 他动了｜否掉了 不动，因为 X1：不替人作保'))).toEqual([])
  })
})

describe('边界与口径', () => {
  it('旧四层卡一律不出结果（由调用方报汇总）', () => {
    const synopsis = chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X1：某条线')
    expect(auditDispositionCitations({ synopsis, card: LEGACY_CARD })).toEqual([])
  })

  it('只报本章区间内的问题', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X7：编的'),
      chapter(5, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X8：也编的'),
    ].join('\n')
    const inRange = auditDispositionCitations({ synopsis, card: CARD, chapterRange: { from: 4, to: 8 } })
    expect(inRange.map(finding => finding.zh)).toEqual([expect.stringContaining('X8')])
  })

  it('不给区间时两章都报', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X7：编的'),
      chapter(5, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 X8：也编的'),
    ].join('\n')
    expect(auditDispositionCitations({ synopsis, card: CARD })).toHaveLength(2)
  })

  it('SAME_X 的计数不受区间影响 —— 只看第 5 章仍能报', () => {
    const synopsis = [1, 2, 3, 4, 5]
      .map(index => chapterQ(index, '定性：X2 — 当众被问责', '选择：自己 —— 他认了｜否掉了 辩白，因为 X2：不当众认错'))
      .join('\n')
    const findings = auditDispositionCitations({ synopsis, card: CARD, chapterRange: { from: 5, to: 5 } })
    expect(findings.map(finding => finding.code)).toContain('ARC_CHOICE_SAME_X')
  })

  it('读得懂英文写法', () => {
    const synopsis = [
      '## Chapter 1: The dock',
      '',
      'Qualify: chip: his mother — she is being held',
      '',
      'Choice: Trade — he signed | ruled out: walking away, because chip: his mother',
      '',
      'Prose.',
    ].join('\n')
    expect(auditDispositionCitations({ synopsis, card: CARD_EN })).toEqual([])
  })

  it('英文的 break 也算顶撞', () => {
    const synopsis = [
      '## Chapter 1: The dock',
      '',
      'Qualify: X1 — a guarantee is pushed at him',
      '',
      'Choice: Trade — he signed | ruled out: walking away, because break X1: the deposit is gone',
      '',
      'Prose.',
    ].join('\n')
    expect(auditDispositionCitations({ synopsis, card: CARD_EN })).toEqual([])
  })

  it('空大纲不出结果', () => {
    expect(auditDispositionCitations({ synopsis: '', card: CARD })).toEqual([])
  })
})
