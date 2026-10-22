import { describe, expect, it } from 'vitest'

import {
  clipSelfReviewQuote,
  describeWorldBuildingSelfReview,
  filterSelfReviewFindings,
  isQuotePresent,
  MAX_SELF_REVIEW_ITEMS,
  MAX_SELF_REVIEW_QUOTE,
  parseWorldBuildingSelfReview,
} from '../worldbuilding-self-review'

const WORLD = [
  '### 2.【阶层断层与资源战场】',
  '灵石只有宗门才发得起，凡人每日劳作十二时辰也只能换十枚下品灵石。',
  '### 5.【时间历法（日序与周期）】',
  '山门每月初一放粮，逾期不补。',
].join('\n')

const find = (quote: string, severity = 'conflict', why = '两处设定不能同时成立') => ({
  severity,
  category: 'resource',
  quote,
  why,
})

describe('parseWorldBuildingSelfReview', () => {
  it('解析正常 findings，并按原文顺序保留字段', () => {
    const review = parseWorldBuildingSelfReview(JSON.stringify({
      findings: [
        find('灵石只有宗门才发得起', 'conflict', '与后文「人人富足」矛盾'),
        find('山门每月初一放粮', 'suggestion', '未写逾期后果'),
      ],
    }))

    expect(review.unreadable).toBe(false)
    expect(review.findings).toEqual([
      { severity: 'conflict', category: 'resource', quote: '灵石只有宗门才发得起', why: '与后文「人人富足」矛盾' },
      { severity: 'suggestion', category: 'resource', quote: '山门每月初一放粮', why: '未写逾期后果' },
    ])
  })

  it('findings 为空数组时是「审了、没问题」，不是「没审成」', () => {
    const review = parseWorldBuildingSelfReview('{"findings": []}')

    expect(review).toEqual({ findings: [], unreadable: false })
    expect(describeWorldBuildingSelfReview(review, 'zh-CN')).toBeUndefined()
  })

  it.each([
    ['坏 JSON', '{"findings": [}'],
    ['空字符串', '   '],
    ['不是对象', '[{"severity":"conflict"}]'],
    ['缺 findings 键', '{"items": []}'],
    ['findings 不是数组', '{"findings": {}}'],
    ['severity 不认识', '{"findings":[{"severity":"error","category":"logic","quote":"灵石","why":"x"}]}'],
    ['category 不认识', '{"findings":[{"severity":"conflict","category":"money","quote":"灵石","why":"x"}]}'],
  ])('%s ⇒ unreadable，且不抛错', (_label, raw) => {
    const review = parseWorldBuildingSelfReview(raw)

    expect(review).toEqual({ findings: [], unreadable: true })
  })

  it.each([
    ['quote 为空串', '{"findings":[{"severity":"conflict","category":"logic","quote":"  ","why":"x"}]}'],
    ['quote 缺失', '{"findings":[{"severity":"conflict","category":"logic","why":"x"}]}'],
    ['why 为空', '{"findings":[{"severity":"conflict","category":"logic","quote":"灵石","why":""}]}'],
  ])('%s ⇒ 整份作废（不把半份结果当全份）', (_label, raw) => {
    expect(parseWorldBuildingSelfReview(raw)).toEqual({ findings: [], unreadable: true })
  })

  it('整段套了代码围栏时仍能解析（只容忍这一种包装）', () => {
    const review = parseWorldBuildingSelfReview('```json\n{"findings": []}\n```')

    expect(review).toEqual({ findings: [], unreadable: false })
  })

  it('读回自己写进 partial 的信封：unreadable 原样保留', () => {
    const stored = JSON.stringify({ findings: [], unreadable: true })

    expect(parseWorldBuildingSelfReview(stored)).toEqual({ findings: [], unreadable: true })
  })
})

describe('引文必须逐字命中原文', () => {
  it('逐字命中的引文算有效', () => {
    expect(isQuotePresent('凡人每日劳作十二时辰', WORLD)).toBe(true)
  })

  it('跨行改写过的引文按空白容错仍算命中，改字则不算', () => {
    expect(isQuotePresent('灵石只有宗门才发得起，\n凡人每日劳作', WORLD)).toBe(true)
    expect(isQuotePresent('灵石只有世家才发得起', WORLD)).toBe(false)
  })

  it('引文不在原文里 ⇒ 整条被过滤（模型瞎编引文的唯一防线）', () => {
    const review = parseWorldBuildingSelfReview(JSON.stringify({
      findings: [
        find('凡人每日劳作十二时辰也只能换十枚下品灵石'),
        find('这条引文是模型编出来的'),
      ],
    }))

    const filtered = filterSelfReviewFindings(review, WORLD)

    expect(filtered.findings).toHaveLength(1)
    expect(filtered.findings[0]!.quote).toContain('凡人每日劳作十二时辰')
    expect(filtered.unreadable).toBe(false)
  })

  it('所有引文都命不中 ⇒ 结果退化为「无条目」，且不谎称未完成', () => {
    const review = parseWorldBuildingSelfReview(JSON.stringify({ findings: [find('编的引文')] }))

    expect(filterSelfReviewFindings(review, WORLD)).toEqual({ findings: [], unreadable: false })
    expect(describeWorldBuildingSelfReview(filterSelfReviewFindings(review, WORLD), 'zh-CN')).toBeUndefined()
  })

  it('同一引文同一严重度只留一条', () => {
    const review = parseWorldBuildingSelfReview(JSON.stringify({
      findings: [find('山门每月初一放粮'), find('山门每月初一放粮')],
    }))

    expect(filterSelfReviewFindings(review, WORLD).findings).toHaveLength(1)
  })
})

describe('展示层', () => {
  it('超长引文截断到上限并带省略号', () => {
    const long = `${'灵'.repeat(MAX_SELF_REVIEW_QUOTE + 20)}`
    const clipped = clipSelfReviewQuote(long)

    expect(clipped).toHaveLength(MAX_SELF_REVIEW_QUOTE + 1)
    expect(clipped.endsWith('…')).toBe(true)
    expect(clipSelfReviewQuote('短引文')).toBe('短引文')
  })

  it('超过展示上限时列出前 N 条并说明「另有 N 条」', () => {
    const findings = Array.from({ length: MAX_SELF_REVIEW_ITEMS + 2 }, (_, index) => ({
      severity: 'suggestion' as const,
      category: 'logic' as const,
      quote: `第 ${index} 条引文`,
      why: '说明',
    }))
    const text = describeWorldBuildingSelfReview({ findings, unreadable: false }, 'zh-CN')!

    expect(text).toContain(`有 ${MAX_SELF_REVIEW_ITEMS + 2} 处`)
    expect(text).toContain('另有 2 条未展开。')
    expect(text).toContain('第 0 条引文')
    expect(text).not.toContain(`第 ${MAX_SELF_REVIEW_ITEMS + 1} 条引文`)
  })

  it('unreadable 时明确说「未完成」，绝不说成「0 个问题」', () => {
    const zh = describeWorldBuildingSelfReview({ findings: [], unreadable: true }, 'zh-CN')!

    expect(zh).toContain('未完成')
    expect(zh).not.toContain('0')
    expect(describeWorldBuildingSelfReview({ findings: [], unreadable: false }, 'zh-CN')).toBeUndefined()
  })

  it('双语各说各话，且冲突排在建议前面', () => {
    const review = {
      findings: [
        { severity: 'suggestion' as const, category: 'logic' as const, quote: '山门每月初一放粮', why: '可补充' },
        { severity: 'conflict' as const, category: 'resource' as const, quote: '灵石只有宗门才发得起', why: '两处矛盾' },
      ],
      unreadable: false,
    }

    const zh = describeWorldBuildingSelfReview(review, 'zh-CN')!
    const en = describeWorldBuildingSelfReview(review, 'en-US')!

    expect(zh).toContain('世界观自审')
    expect(zh.indexOf('两处矛盾')).toBeLessThan(zh.indexOf('可补充'))
    expect(en).toContain('Worldbuilding self-review')
    // 英文侧只换叙述语言：引文必须保持原文（这里原文就是中文），但标签不能漏中文。
    expect(en).toContain('worth confirming')
    expect(en).toContain('(conflict)')
    expect(en).not.toContain('世界观自审')
    expect(en).not.toContain('（矛盾）')
    expect(describeWorldBuildingSelfReview({ findings: [], unreadable: true }, 'en-US'))
      .toBe('Worldbuilding self-review did not complete this run; the generated worldbuilding is unaffected.')
  })
})
