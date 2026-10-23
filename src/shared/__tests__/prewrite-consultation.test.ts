import { describe, expect, it } from 'vitest'

import {
  buildPrewriteConsultationBlock,
  PREWRITE_FACTS_MAX_ITEMS,
  PREWRITE_ITEMS_MAX_ITEMS,
  renderPrewriteFactLine,
  renderPrewriteFactsSection,
  renderPrewriteItemsSection,
  type PrewriteFact,
} from '../prewrite-consultation'
import { renderKeyItemLine, type KeyItemDefinition } from '../key-item'
import { CADENCE_MAX_ITEMS, type CadenceEntry, type InstitutionCadence } from '../institution-cadence'
import {
  KNOWLEDGE_MAX_ITEMS,
  type KnowledgeStateDefinition,
} from '../knowledge-state'
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

const item = (over: Partial<KeyItemDefinition> = {}): KeyItemDefinition => ({
  itemId: 'item:1',
  name: '裁纸刀',
  holderCharacter: '',
  holderLabel: '林岚',
  statusNote: '',
  chapterNumber: null,
  evidence: '',
  source: 'author',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const cadence = (over: Partial<InstitutionCadence> = {}): InstitutionCadence => ({
  cadenceId: 'cadence:1',
  name: '月例',
  axis: 'chapter',
  interval: 10,
  anchorChapter: 12,
  anchorStoryDay: null,
  fallbackIntervalChapters: null,
  note: '',
  chapterNumber: null,
  evidence: '',
  source: 'author',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const dueEntry = (over: Partial<InstitutionCadence> = {}, name = '月例'): CadenceEntry => ({
  cadence: cadence({ name, ...over }),
  evaluation: { status: 'due', basis: 'chapter' },
})

const knowledge = (over: Partial<KnowledgeStateDefinition> = {}): KnowledgeStateDefinition => ({
  knowledgeId: 'knowledge:1',
  characterId: 'character:guchangfeng',
  characterName: '顾长风',
  factChapter: 9,
  factEvidence: '灵根检测结果被人改过',
  factEvidenceHash: 'a'.repeat(64),
  factKey: 'kf:0123456789abcdef',
  learnedChapter: 12,
  evidence: '',
  source: 'author',
  refState: 'valid',
  createdAt: '',
  updatedAt: '',
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
    expect(buildPrewriteConsultationBlock({}, 'zh-CN'))
      .toEqual({ text: '', factCount: 0, itemCount: 0, cadenceCount: 0, knowledgeCount: 0, ruleCount: 0 })
    expect(buildPrewriteConsultationBlock({ facts: [], rules: [] }, 'zh-CN').text).toBe('')
    // 传空 cadences 与不传逐字节相同：制度缺省必须零字节。
    expect(buildPrewriteConsultationBlock({ cadences: [] }, 'zh-CN').text).toBe('')
  })

  it('只有事实时没有规则节，反之亦然', () => {
    const factsOnly = buildPrewriteConsultationBlock({ facts: [fact()] }, 'zh-CN')
    expect(factsOnly.text).toContain('【前文事实（')
    expect(factsOnly.text).not.toContain('【本书规则（')
    expect(factsOnly).toMatchObject({ factCount: 1, itemCount: 0, ruleCount: 0 })

    const rulesOnly = buildPrewriteConsultationBlock({ rules: [rule()] }, 'zh-CN')
    expect(rulesOnly.text).toContain('【本书规则（')
    expect(rulesOnly.text).not.toContain('【前文事实（')
    expect(rulesOnly).toMatchObject({ factCount: 0, itemCount: 0, ruleCount: 1 })
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

  it('四节都有时顺序是 事实 → 关键物品 → 制度 → 规则', () => {
    const text = buildPrewriteConsultationBlock(
      { facts: [fact()], items: [item()], cadences: [dueEntry()], rules: [rule()] },
      'zh-CN',
    ).text
    expect(text.indexOf('【前文事实（')).toBeLessThan(text.indexOf('【关键物品（'))
    expect(text.indexOf('【关键物品（')).toBeLessThan(text.indexOf('【制度（周期事件'))
    expect(text.indexOf('【制度（周期事件')).toBeLessThan(text.indexOf('【本书规则（'))
  })
})

/**
 * 关键物品这一节（P1-1）。三条断言对应三种「出处」：有章号有引文 / 只有章号 / 都没有。
 * 第三种必须如实写「作者登记」—— 伪造一个章号会让模型拿它跟前文对账，对不上就是新错误源。
 */
describe('key items section', () => {
  it('空数组返回空串：没有登记就不留空标题', () => {
    expect(renderPrewriteItemsSection([], 'zh-CN')).toBe('')
  })

  it('三种出处分支：章号+引文 / 只有章号 / 都没有（作者登记）', () => {
    expect(renderKeyItemLine(item({ chapterNumber: 3, evidence: '刀口崩了一角' }), 'zh-CN'))
      .toBe('- 裁纸刀 — 林岚持有；出处：第3章：『刀口崩了一角』')
    expect(renderKeyItemLine(item({ chapterNumber: 3 }), 'zh-CN'))
      .toBe('- 裁纸刀 — 林岚持有；出处：第3章')
    expect(renderKeyItemLine(item(), 'zh-CN'))
      .toBe('- 裁纸刀 — 林岚持有；出处：作者登记')
    expect(renderKeyItemLine(item(), 'zh-CN')).not.toContain('章')
  })

  it('状态短语跟在持有者后面', () => {
    expect(renderKeyItemLine(item({ statusNote: '剩两副' }), 'zh-CN')).toContain('林岚持有（剩两副）')
  })

  it('持有者为空时写「未登记持有者」，不留一个空白', () => {
    expect(renderKeyItemLine(item({ holderLabel: '   ' }), 'zh-CN')).toContain('未登记持有者')
  })

  it('条数按上限截断，超出的整条丢弃', () => {
    const items = Array.from({ length: PREWRITE_ITEMS_MAX_ITEMS + 2 }, (_, index) =>
      item({ itemId: `item:${index}`, name: `物品${index}` }))
    const section = renderPrewriteItemsSection(items, 'zh-CN')
    expect(section.split('\n').filter(line => line.startsWith('- ')).length).toBe(PREWRITE_ITEMS_MAX_ITEMS)
    expect(section).not.toContain('物品9')
  })

  it('buildPrewriteConsultationBlock 回报 itemCount，并受同一套上限约束', () => {
    const items = Array.from({ length: 12 }, (_, index) => item({ itemId: `item:${index}`, name: `物品${index}` }))
    expect(buildPrewriteConsultationBlock({ items }, 'zh-CN')).toMatchObject({
      factCount: 0, itemCount: PREWRITE_ITEMS_MAX_ITEMS, ruleCount: 0,
    })
  })
})

/**
 * 制度这一节（P1-1 期 2）。四件事：位置、零字节、上限、`unknown` 的措辞。
 * 判定表本身由 `institution-cadence.test.ts` 负责，这里只钉它在组装层的位置与计数。
 */
describe('cadences section', () => {
  it('制度排在关键物品之后、本书规则之前，并回报 cadenceCount', () => {
    const block = buildPrewriteConsultationBlock({
      items: [item()],
      cadences: [dueEntry()],
      rules: [rule()],
    }, 'zh-CN')
    expect(block.text).toContain('【制度（周期事件：到没到点）】')
    expect(block.text).toContain('以下每条只回答「该不该发生」，不回答「应发多少」')
    expect(block.text.indexOf('【关键物品（')).toBeLessThan(block.text.indexOf('【制度（周期事件'))
    expect(block.text.indexOf('【制度（周期事件')).toBeLessThan(block.text.indexOf('【本书规则（'))
    expect(block).toMatchObject({ factCount: 0, itemCount: 1, cadenceCount: 1, knowledgeCount: 0, ruleCount: 1 })
  })

  it('unknown 渲染成「未知」而不是「未到」（缺失就说缺失，判据 DN 同型）', () => {
    const block = buildPrewriteConsultationBlock({
      cadences: [{
        cadence: cadence({ axis: 'story-day', interval: 7, anchorStoryDay: 9, anchorChapter: 12 }),
        evaluation: { status: 'unknown', basis: 'none', reason: 'story-day-missing' },
      }],
    }, 'zh-CN')
    expect(block.text).toContain('未知（本章日序不可知）')
    expect(block.text).not.toContain('未到')
    expect(block.cadenceCount).toBe(1)
  })

  it('条数按上限截断，超出的整条丢弃（与其它节同一纪律）', () => {
    const many = Array.from({ length: CADENCE_MAX_ITEMS + 3 }, (_, index) => dueEntry({}, `事件${index}`))
    const block = buildPrewriteConsultationBlock({ cadences: many }, 'zh-CN')
    expect(block.cadenceCount).toBe(CADENCE_MAX_ITEMS)
    expect(block.text).not.toContain(`事件${CADENCE_MAX_ITEMS}`)
  })
})

/**
 * 知情这一节（P1-1 期 3）。四件事：位置（制度之后、规则之前）、零字节、
 * 上限整条丢弃、以及**节首说明逐字包含封闭默认的边界句**。
 *
 * 最后一条是本期的判据：说明句缺了「未登记的事实一概不判」，读者就会把它读成
 * 「这本书里谁都不知道别的任何事」—— 那是比不注入更大的错误。
 */
describe('knowledge section', () => {
  it('知情排在制度之后、本书规则之前，并回报 knowledgeCount', () => {
    const block = buildPrewriteConsultationBlock({
      cadences: [dueEntry()],
      knowledge: [knowledge()],
      rules: [rule()],
    }, 'zh-CN')
    expect(block.text).toContain('【知情（谁知道什么）】')
    expect(block.text.indexOf('【制度（周期事件')).toBeLessThan(block.text.indexOf('【知情（谁知道什么）】'))
    expect(block.text.indexOf('【知情（谁知道什么）】')).toBeLessThan(block.text.indexOf('【本书规则（'))
    expect(block).toMatchObject({ factCount: 0, itemCount: 0, cadenceCount: 1, knowledgeCount: 1, ruleCount: 1 })
  })

  it('节首说明逐字包含「未登记的事实一概不判」（封闭默认只在注入文本里成立）', () => {
    const block = buildPrewriteConsultationBlock({ knowledge: [knowledge()] }, 'zh-CN')
    expect(block.text).toContain('登记过的事实，未列出的角色视为不知道；未登记的事实一概不判。')
    // 英文对称：不能只写前半句。
    const en = buildPrewriteConsultationBlock({ knowledge: [knowledge()] }, 'en-US')
    expect(en.text).toContain('facts that were never registered are not judged at all')
  })

  it('缺省与传空都零字节（材料块逐字节不变，parity 哈希护栏靠这个成立）', () => {
    expect(buildPrewriteConsultationBlock({ knowledge: [] }, 'zh-CN').text).toBe('')
    expect(buildPrewriteConsultationBlock({}, 'zh-CN').text).toBe('')
  })

  it('条数按上限截断，超出的整条丢弃（不截半行）', () => {
    const many = Array.from({ length: KNOWLEDGE_MAX_ITEMS + 3 }, (_, index) => knowledge({
      knowledgeId: `knowledge:${index}`,
      characterName: `角色${index}`,
      learnedChapter: 12 - index,
    }))
    const block = buildPrewriteConsultationBlock({ knowledge: many }, 'zh-CN')
    expect(block.knowledgeCount).toBe(KNOWLEDGE_MAX_ITEMS)
    // 被裁掉的最后一条：整行都不出现（不是只少半句）。
    expect(block.text).not.toContain(`角色${KNOWLEDGE_MAX_ITEMS + 2}：`)
  })
})
