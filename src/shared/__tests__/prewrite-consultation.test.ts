import { describe, expect, it } from 'vitest'

import {
  buildPrewriteConsultationBlock,
  PREWRITE_FACTS_MAX_ITEMS,
  renderPrewriteFactLine,
  renderPrewriteFactsSection,
  type PrewriteFact,
} from '../prewrite-consultation'
import type { WorldBuildingRule } from '../worldbuilding-rules'

const fact = (over: Partial<PrewriteFact> = {}): PrewriteFact => ({
  category: 'timeline',
  statement: '林岚抵达海港',
  sourceChapter: 3,
  evidence: '她踏上了青石码头',
  ...over,
})

const rule = (over: Partial<WorldBuildingRule> = {}): WorldBuildingRule => ({
  dimension: 1,
  name: '',
  rule: '必须偿还同等灵力',
  ...over,
})

describe('renderPrewriteFactLine', () => {
  it('中文行与审稿链逐字相同（判据 DM：同一条事实只有一种措辞）', () => {
    expect(renderPrewriteFactLine(fact(), 'zh-CN'))
      .toBe('- [timeline] 林岚抵达海港（来源第3章；证据：她踏上了青石码头）')
  })

  it('英文行与审稿链逐字相同', () => {
    expect(renderPrewriteFactLine(fact(), 'en-US'))
      .toBe('- [timeline] 林岚抵达海港 (source: Chapter 3; evidence: 她踏上了青石码头)')
  })
})

describe('renderPrewriteFactsSection', () => {
  it('空数组返回空串：不留只有标题的空节', () => {
    expect(renderPrewriteFactsSection([], 'zh-CN')).toBe('')
  })

  it('条数按上限截断，超出整条丢弃（不截半句）', () => {
    const facts = Array.from({ length: PREWRITE_FACTS_MAX_ITEMS + 2 }, (_, index) =>
      fact({ statement: `事实${index + 1}`, evidence: `引文${index + 1}` }))
    const text = renderPrewriteFactsSection(facts, 'zh-CN')
    expect(text).toContain('事实6')
    expect(text).not.toContain('事实7')
    expect(text).not.toContain('事实8')
    expect(text.split('\n').filter(line => line.startsWith('- ')).length).toBe(PREWRITE_FACTS_MAX_ITEMS)
  })

  it('超字数上限时整条丢弃，且不出现半句', () => {
    const facts = [
      fact({ statement: '甲'.repeat(50), evidence: '一' }),
      fact({ statement: '乙'.repeat(50), evidence: '二' }),
    ]
    const text = renderPrewriteFactsSection(facts, 'zh-CN', 80)
    expect(text).toContain('甲')
    expect(text).not.toContain('乙')
  })

  it('没有引文或没有陈述的条目不进（无法回查的陈述不算事实）', () => {
    const text = renderPrewriteFactsSection([
      fact({ evidence: '   ' }),
      fact({ statement: ' ', evidence: '引文' }),
    ], 'zh-CN')
    expect(text).toBe('')
  })
})

describe('buildPrewriteConsultationBlock', () => {
  it('两节都空 ⇒ 空串（材料块逐字节不变，parity 哈希护栏靠这个成立）', () => {
    expect(buildPrewriteConsultationBlock({}, 'zh-CN')).toEqual({ text: '', factCount: 0, ruleCount: 0 })
    expect(buildPrewriteConsultationBlock({ facts: [], rules: [] }, 'zh-CN').text).toBe('')
  })

  it('只有事实时没有规则节，反之亦然', () => {
    const factsOnly = buildPrewriteConsultationBlock({ facts: [fact()] }, 'zh-CN')
    expect(factsOnly.text).toContain('【前文事实（')
    expect(factsOnly.text).not.toContain('【本书规则（')
    expect(factsOnly).toMatchObject({ factCount: 1, ruleCount: 0 })

    const rulesOnly = buildPrewriteConsultationBlock({ rules: [rule()] }, 'zh-CN')
    expect(rulesOnly.text).toContain('【本书规则（')
    expect(rulesOnly.text).not.toContain('【前文事实（')
    expect(rulesOnly).toMatchObject({ factCount: 0, ruleCount: 1 })
  })

  it('两节都有时事实在前、规则在后', () => {
    const text = buildPrewriteConsultationBlock({ facts: [fact()], rules: [rule()] }, 'zh-CN').text
    expect(text.indexOf('【前文事实（')).toBeLessThan(text.indexOf('【本书规则（'))
  })

  it('回报的条数是**通过裁剪后**的真实行数', () => {
    const facts = Array.from({ length: 9 }, (_, index) =>
      fact({ statement: `事实${index}`, evidence: `引文${index}` }))
    const rules = Array.from({ length: 11 }, (_, index) =>
      rule({ rule: `规则${index}必须执行` }))
    const block = buildPrewriteConsultationBlock({ facts, rules }, 'zh-CN')
    expect(block.factCount).toBe(PREWRITE_FACTS_MAX_ITEMS)
    expect(block.ruleCount).toBe(8)
  })

  it('英文两节的标题与说明都在', () => {
    const text = buildPrewriteConsultationBlock({ facts: [fact()], rules: [rule()] }, 'en-US').text
    expect(text).toContain('[Established facts from earlier chapters')
    expect(text).toContain('[World rules')
  })
})
