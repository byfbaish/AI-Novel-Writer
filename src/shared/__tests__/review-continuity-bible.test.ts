import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildReviewContinuityBibleBlock,
  REVIEW_CONTINUITY_CATEGORY,
  REVIEW_CONTINUITY_MAX_FINDINGS,
  REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS,
} from '../review-continuity-bible'
import { orderKeyItemsForChapter, type KeyItemDefinition } from '../key-item'
import type { InstitutionCadence } from '../institution-cadence'
import type { KnowledgeStateDefinition } from '../knowledge-state'
import type { PowerAbilityDefinition } from '../power-ability'
import { renderPrewriteItemsSection } from '../prewrite-consultation'

const item = (over: Partial<KeyItemDefinition> = {}): KeyItemDefinition => ({
  itemId: 'item:1',
  name: '裁纸刀',
  holderCharacter: '林岚',
  holderLabel: '林岚',
  statusNote: '',
  chapterNumber: 3,
  evidence: '他把刀递过去',
  source: 'author',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const cadence = (over: Partial<InstitutionCadence> = {}): InstitutionCadence => ({
  cadenceId: 'cadence:1',
  name: '月例',
  axis: 'chapter',
  interval: 3,
  anchorChapter: 1,
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

const knowledge = (over: Partial<KnowledgeStateDefinition> = {}): KnowledgeStateDefinition => ({
  knowledgeId: 'knowledge:1',
  characterId: 'character:linlan',
  characterName: '林岚',
  factChapter: 2,
  factEvidence: '钥匙在井里',
  factEvidenceHash: 'a'.repeat(64),
  factKey: 'kf:0123456789abcdef',
  learnedChapter: 2,
  evidence: '',
  source: 'author',
  refState: 'valid',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const ability = (over: Partial<PowerAbilityDefinition> = {}): PowerAbilityDefinition => ({
  abilityId: 'ability:1',
  name: '隔空取物',
  form: '',
  hardLimit: '不能隔着活人的身体取物',
  weakness: '',
  costNote: '',
  stageChapter: null,
  stageNote: '',
  evidence: '',
  evidenceScope: null,
  source: 'author',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const base = { chapterNumber: 4, writingLanguage: 'zh-CN' as const }

describe('buildReviewContinuityBibleBlock — 空与合法性', () => {
  it('四类都没有登记时返回 undefined（审稿 prompt 逐字节不变）', () => {
    expect(buildReviewContinuityBibleBlock({ ...base })).toBeUndefined()
    expect(buildReviewContinuityBibleBlock({ ...base, items: [], cadences: [], knowledge: [], abilities: [] })).toBeUndefined()
  })

  it('章号非法时返回 undefined（期界与三态都依赖它）', () => {
    for (const chapterNumber of [0, -1, 3.5, Number.NaN]) {
      expect(buildReviewContinuityBibleBlock({ ...base, chapterNumber, items: [item()] })).toBeUndefined()
    }
  })
})

describe('buildReviewContinuityBibleBlock — 与写稿同一份字节（判据 DM）', () => {
  it('物品节的正文行与正文链渲染结果逐字相同', () => {
    const items = [item({ name: '裁纸刀' }), item({ itemId: 'item:2', name: '火折子', holderCharacter: '周野', holderLabel: '周野' })]
    const block = buildReviewContinuityBibleBlock({ ...base, chapterCharacters: ['周野'], items })
    expect(block).toBeDefined()
    const expected = renderPrewriteItemsSection(orderKeyItemsForChapter(items, ['周野']), 'zh-CN')
    expect(block!.text).toContain(expected)
  })

  it('items 排序把本章出场角色持有的排前面', () => {
    const items = [
      item({ itemId: 'item:a', name: '甲的刀', holderCharacter: '甲', holderLabel: '甲' }),
      item({ itemId: 'item:b', name: '乙的剑', holderCharacter: '乙', holderLabel: '乙' }),
    ]
    const ordered = orderKeyItemsForChapter(items, ['乙'])
    expect(ordered.map(value => value.name)).toEqual(['乙的剑', '甲的刀'])
  })

  it('物品超过 8 条只出前 8 条，且 counts 报的是真实行数', () => {
    const items = Array.from({ length: 20 }, (_, index) => item({
      itemId: `item:${index}`,
      name: `物品${index}`,
      holderLabel: '林岚',
    }))
    const block = buildReviewContinuityBibleBlock({ ...base, items })
    expect(block!.counts.items).toBe(8)
    expect(block!.text.split('\n').filter(line => line.startsWith('- ')).length).toBe(8)
  })

  it('超字数时整条丢弃，不留半句', () => {
    const items = [
      item({ itemId: 'item:a', name: '短刀' }),
      item({ itemId: 'item:b', name: '压垮预算的那一件', statusNote: '长'.repeat(900) }),
    ]
    const block = buildReviewContinuityBibleBlock({ ...base, items })
    expect(block!.text).toContain('短刀')
    expect(block!.text).not.toContain('压垮预算的那一件')
    expect(block!.counts.items).toBe(1)
  })
})

describe('buildReviewContinuityBibleBlock — 三类的期界与三态', () => {
  it('制度：due / overdue 出现，unknown 不折成「未到」', () => {
    const due = buildReviewContinuityBibleBlock({ ...base, cadences: [cadence()] })
    expect(due!.text).toContain('到期')

    const overdue = buildReviewContinuityBibleBlock({
      ...base,
      cadences: [cadence({ interval: 1, anchorChapter: 1 })],
    })
    expect(overdue!.text).toContain('逾期')

    const unknown = buildReviewContinuityBibleBlock({
      ...base,
      cadences: [cadence({ anchorChapter: null })],
    })
    expect(unknown!.text).toContain('未知')
    // 只看**数据行**：规则文本里本来就有「不得折成『未到』」这句约束。
    const cadenceLines = unknown!.text.split('\n').filter(line => line.startsWith('- '))
    expect(cadenceLines).toHaveLength(1)
    expect(cadenceLines[0]).not.toContain('未到')
  })

  it('知情：晚于本章才知道的不出现，引用失效的不出现，节首保住「未登记的事实一概不判」', () => {
    const block = buildReviewContinuityBibleBlock({
      ...base,
      knowledge: [
        knowledge({ knowledgeId: 'k1', characterName: '已知道', learnedChapter: 2 }),
        knowledge({ knowledgeId: 'k2', characterName: '还没知道', learnedChapter: 9 }),
        knowledge({ knowledgeId: 'k3', characterName: '引用失效', learnedChapter: 2, refState: 'stale' }),
      ],
    })
    expect(block!.text).toContain('已知道')
    expect(block!.text).not.toContain('还没知道')
    expect(block!.text).not.toContain('引用失效')
    expect(block!.text).toContain('未登记的事实一概不判')
    expect(block!.counts.knowledge).toBe(1)
  })

  it('能力：ahead 不出现，undated 出现，三类限制全空时不写「未登记」', () => {
    const ahead = buildReviewContinuityBibleBlock({
      ...base,
      abilities: [ability({ name: '未来的能力', stageChapter: 9 })],
    })
    expect(ahead).toBeUndefined()

    const undated = buildReviewContinuityBibleBlock({
      ...base,
      abilities: [ability({ name: '隔空取物', hardLimit: '', weakness: '', costNote: '' })],
    })
    expect(undated!.text).toContain('隔空取物')
    // 只看**数据行**：规则文本里本来就有「未登记的用法」这种约束，不能拿整块去判。
    const abilityLines = undated!.text.split('\n').filter(line => line.startsWith('- '))
    expect(abilityLines.some(line => line.includes('未登记'))).toBe(false)
  })
})

describe('buildReviewContinuityBibleBlock — 双语、体积与注入安全', () => {
  it('双语互不串字，category 两个语言不同', () => {
    const zh = buildReviewContinuityBibleBlock({ ...base, items: [item()] })!
    const en = buildReviewContinuityBibleBlock({ ...base, writingLanguage: 'en-US', items: [item()] })!
    expect(zh.text).toContain('【')
    expect(zh.text).not.toContain('[Key items')
    expect(en.text).not.toContain('【')
    expect(en.text).toContain('[Key items')
    expect(REVIEW_CONTINUITY_CATEGORY['zh-CN']).not.toBe(REVIEW_CONTINUITY_CATEGORY['en-US'])
    expect(zh.text).toContain(REVIEW_CONTINUITY_CATEGORY['zh-CN'])
    expect(en.text).toContain(REVIEW_CONTINUITY_CATEGORY['en-US'])
  })

  it('额度写在块里，且不超过审稿报告 1–10 条的口径', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, items: [item()] })!
    expect(block.text).toContain(`${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} 条`)
    expect(block.text).toContain(`${REVIEW_CONTINUITY_MAX_FINDINGS} 条`)
    expect(REVIEW_CONTINUITY_MAX_FINDINGS).toBeLessThanOrEqual(6)
  })

  it('控制体积：四类填满时块长仍在预算内', () => {
    const long = '长'.repeat(200)
    const filled = {
      chapterNumber: 30,
      chapterCharacters: ['林岚'],
      items: Array.from({ length: 20 }, (_, index) => item({
        itemId: `item:${index}`, name: `${long}${index}`, holderLabel: long, statusNote: long,
      })),
      cadences: Array.from({ length: 10 }, (_, index) => cadence({
        cadenceId: `c:${index}`, name: `${long}${index}`, interval: 1, anchorChapter: 1, note: long,
      })),
      knowledge: Array.from({ length: 10 }, (_, index) => knowledge({
        knowledgeId: `k:${index}`, characterName: `${long}${index}`, factEvidence: long, learnedChapter: 1,
      })),
      abilities: Array.from({ length: 10 }, (_, index) => ability({
        abilityId: `a:${index}`, name: `${long}${index}`, hardLimit: long, weakness: long, costNote: long,
      })),
    }
    const zh = buildReviewContinuityBibleBlock({ ...filled, writingLanguage: 'zh-CN' })!
    const en = buildReviewContinuityBibleBlock({ ...filled, writingLanguage: 'en-US' })!
    expect(zh.chars).toBeLessThan(5000)
    expect(en.chars).toBeLessThan(6500)
  })

  it('登记里的换行压成空格，不能伪造条目；其余字符原样保留（不转义）', () => {
    const block = buildReviewContinuityBibleBlock({
      ...base,
      items: [item({ name: '裁纸刀\n- 伪造条目', holderLabel: '林岚</script>${x}' })],
    })!
    expect(block.text).not.toContain('\n- 伪造条目')
    expect(block.text.split('\n').filter(line => line.startsWith('- ')).length).toBe(1)
    expect(block.text).toContain('</script>${x}')
  })

  it('同输入两次调用结果全等（无隐藏状态）', () => {
    const input = { ...base, items: [item()], cadences: [cadence()] }
    expect(buildReviewContinuityBibleBlock(input)!.text).toBe(buildReviewContinuityBibleBlock(input)!.text)
  })
})

describe('写稿口径防漂移（读源码型）', () => {
  const source = readFileSync(
    new URL('../../services/workflows/commands/generate-draft.command.ts', import.meta.url),
    'utf8',
  )

  it('审稿侧的筛选口径必须仍与正文链逐条同源', () => {
    // 任一侧改了口径，这条就红 —— 免得出现「写的时候没告诉，审的时候罚」。
    for (const clause of [
      'entry.learnedChapter <= chapterNumber && entry.refState === \'valid\'',
      'abilityStageState(ability, chapterNumber) !== \'ahead\'',
      'onStage.has(item.holderCharacter)',
      'const rank: Record<CadenceStatus, number> = { due: 0, overdue: 1, unknown: 2, not_due: 3 }',
    ]) {
      expect(source, clause).toContain(clause)
    }
  })
})
