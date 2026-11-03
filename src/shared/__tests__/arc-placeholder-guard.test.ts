import { describe, expect, it } from 'vitest'

import { findAngleBracketPlaceholders, type PlaceholderHit } from '../arc-placeholder-guard'

describe('findAngleBracketPlaceholders', () => {
  // 命中表：输入 → 期望命中条数与（可选）index / line 断言
  const hitCases: Array<[label: string, text: string, expected: Array<Partial<PlaceholderHit>>]> = [
    ['单占位符', '<七点>', [{ index: 0, line: 1 }]],
    ['占位符位于行中', '拍子：<七点>', [{ index: 3, line: 1 }]],
    ['连续两个占位符', '<钩子>→单元一｜<第一转折>→单元二', [{ index: 0, line: 1 }, { index: 9, line: 1 }]],
    ['括号内是本书专名', '<赵铎用律条锁人>', [{ index: 0, line: 1 }]],
    ['占位符在第二行', '第一行\n第二行 <结局>', [{ index: 8, line: 2 }]],
  ]

  it.each(hitCases)('命中：%s', (_, text, expected) => {
    const hits = findAngleBracketPlaceholders(text)
    expect(hits).toHaveLength(expected.length)
    expected.forEach((exp, i) => {
      expect(hits[i].raw).toBe(text.slice(exp.index!, exp.index! + hits[i].raw.length))
      if (exp.index !== undefined) expect(hits[i].index).toBe(exp.index)
      if (exp.line !== undefined) expect(hits[i].line).toBe(exp.line)
    })
  })

  // 不命中表：输入 → 期望 0 条
  const missCases: Array<[label: string, text: string]> = [
    ['单行 HTML br', '<br>'],
    ['闭合 strong', '</strong>'],
    ['strong 包裹正文（开始与闭合均豁免）', '<strong>x</strong>'],
    ['书名号不命中', '《书名》'],
    ['小于号后无大于号', 'a < b'],
    ['大于号前无小于号', 'x > y'],
    ['空串', ''],
    ['未闭合占位符', '<未闭合'],
  ]

  it.each(missCases)('不命中：%s', (_, text) => {
    expect(findAngleBracketPlaceholders(text)).toEqual([])
  })

  // 补充：判据的其余边界与实现选择
  it.each([
    ['大写标签名豁免', '<SPAN>'],
    ['h1–h6 数字标签豁免', '<h3>'],
    ['h1–h6 大写豁免', '</H6>'],
    ['自闭合 br 豁免（尾部斜杠）', '<br/>'],
    ['空内部 <> 不命中', '<>'],
    ['内部只有空白不命中', '< >'],
  ])('不命中（豁免/空内部）：%s', (_, text) => {
    expect(findAngleBracketPlaceholders(text)).toEqual([])
  })

  it('HTML 标签与占位符混排只命中占位符', () => {
    const text = '<p>开场</p><钩子>正文</div>'
    const hits = findAngleBracketPlaceholders(text)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toEqual({ raw: '<钩子>', index: 9, line: 1 })
  })

  it('三行文本中跨行累计全文 index', () => {
    const text = 'a<钩子>b\nc<结局>\nd'
    const hits = findAngleBracketPlaceholders(text)
    expect(hits).toEqual([
      { raw: '<钩子>', index: 1, line: 1 },
      { raw: '<结局>', index: 8, line: 2 },
    ])
  })

  it('含属性 HTML 标签按判据字面命中（内部非纯标签名）', () => {
    expect(findAngleBracketPlaceholders('<span class="x">')).toHaveLength(1)
  })
})
