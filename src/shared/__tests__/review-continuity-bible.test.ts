import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildReviewContinuityBibleBlock,
  REVIEW_CONTINUITY_CATEGORIES,
  REVIEW_CONTINUITY_CATEGORY,
  REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY,
  REVIEW_CONTINUITY_MAX_FINDINGS,
  REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS,
} from '../review-continuity-bible'
import { orderKeyItemsForChapter, type KeyItemDefinition } from '../key-item'
import type { InstitutionCadence } from '../institution-cadence'
import type { KnowledgeStateDefinition } from '../knowledge-state'
import type { PowerAbilityDefinition } from '../power-ability'
import type { SecretDefinition } from '../secret'
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

const secret = (over: Partial<SecretDefinition> = {}): SecretDefinition => ({
  secretId: 'secret:1',
  title: '井里的钥匙是谁放的',
  detail: '钥匙是林岚自己放的',
  holders: ['林岚'],
  unaware: ['周野'],
  revealChapter: 9,
  evidence: '',
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
    // 期 2 由 6 提到 8（五类，新类 2 条）；8 仍在报告 1–10 条的口径内。
    expect(REVIEW_CONTINUITY_MAX_FINDINGS).toBeLessThanOrEqual(8)
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

describe('buildReviewContinuityBibleBlock — 人物状态转移（指针型，期 2）', () => {
  const renderedStates = [
    '顾长风（杂役）状态（按标注章节理解，非永久约束）：',
    '  - location@chapter3: 百草园外园',
    '  - physicalState@chapter7·派生: 左肩刀伤未愈',
  ].join('\n')

  it('没有可解析的状态事实行时整块不产出（含兜底文案、只有姓名、只有卡头）', () => {
    // 生产侧兜底 `（暂无）`、测试夹具的「只有姓名」、以及空串 —— 三者都非空却无一条可比对的基准。
    for (const renderedCharacterStates of ['', '（暂无）', '(none)', '顾长风 (杂役)',
      '顾长风（杂役）状态（按标注章节理解，非永久约束）：']) {
      expect(buildReviewContinuityBibleBlock({ ...base, renderedCharacterStates }), renderedCharacterStates)
        .toBeUndefined()
    }
  })

  it('有状态行时只给指针与规则，不复制任何状态值', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, renderedCharacterStates: renderedStates })!
    expect(block.counts.characters).toBe(2)
    expect(block.text).toContain('【人物状态转移')
    // 数据不得二次渲染：同一批事实只能出现在 prompt 开头那一份（判据 DM）。
    expect(block.text).not.toContain('左肩刀伤未愈')
    expect(block.text).not.toContain('location@chapter3: 百草园外园')
  })

  it('指针点名模板里逐字的标题，并给结构锚点（按「上一段」找必然找错）', () => {
    const zh = buildReviewContinuityBibleBlock({ ...base, renderedCharacterStates: renderedStates })!
    expect(zh.text).toContain('【角色状态】')
    expect(zh.text).toContain('紧跟【待审章节】之后')
    const en = buildReviewContinuityBibleBlock({
      ...base, writingLanguage: 'en-US', renderedCharacterStates: renderedStates,
    })!
    expect(en.text).toContain('[Known character states]')
    expect(en.text).toContain('[Chapter under review]')
  })

  it('规则写死四条边界：只判过程缺失 / 不判可达性 / 不用等于本章的基准行 / 与维度 3 不双报', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, renderedCharacterStates: renderedStates })!
    for (const clause of [
      '不判角色行为是否合情理',
      '一炷香走三百里',
      '标注章号等于本章的行',
      '同一现象只报一次',
      '归【检查维度】第 3 条',
      '基准陈旧时从严',
    ]) expect(block.text, clause).toContain(clause)
  })

  it('与五类同块时排在能力之后、人物状态之前，六项计数各自独立', () => {
    const block = buildReviewContinuityBibleBlock({
      ...base,
      items: [item({ chapterNumber: 1 })],
      cadences: [cadence()],
      knowledge: [knowledge()],
      abilities: [ability()],
      secrets: [secret()],
      renderedCharacterStates: renderedStates,
    })!
    expect(block.counts).toEqual({
      items: 1, cadences: 1, knowledge: 1, knowledgeOmitted: 0, abilities: 1,
      secrets: 1, secretsExempted: 0, characters: 2,
    })
    expect(block.text.indexOf('【能力')).toBeLessThan(block.text.indexOf('【秘密守卫'))
    expect(block.text.indexOf('【秘密守卫')).toBeLessThan(block.text.indexOf('【人物状态转移'))
    expect(block.text).toContain(REVIEW_CONTINUITY_CATEGORIES.items['zh-CN'])
    expect(block.text).toContain(REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY['zh-CN'])
  })

  it('只有角色状态时也产出块，且同时给出两个 category 名', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, renderedCharacterStates: renderedStates })!
    expect(block.text).not.toContain('【关键物品')
    expect(block.text).toContain(REVIEW_CONTINUITY_CATEGORY['zh-CN'])
    expect(block.text).toContain(REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY['zh-CN'])
  })

  it('既有四类且无状态时不含任何新类字节（老项目零影响）', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, items: [item()] })!
    expect(block.counts.characters).toBe(0)
    expect(block.text).not.toContain('人物状态转移')
    expect(block.text).not.toContain(REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY['zh-CN'])
    // 有第五类时标题才带「+ 角色状态」；没数据时标题保持原样。
    expect(block.text).toContain('【连续性核对基准（作者登记；')
  })

  it('英文模板用 ·derived 标记，也要能数出来', () => {
    const en = buildReviewContinuityBibleBlock({
      ...base,
      writingLanguage: 'en-US',
      renderedCharacterStates: 'Gu (servant) state (read as of the annotated chapter, not permanent):\n'
        + '  - physicalState@chapter7·derived: wounded left shoulder',
    })!
    expect(en.counts.characters).toBe(1)
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

  it('审稿模板的【检查维度】第 3 条原文未被改动 —— 与第五类的分工由条件规则承担，不靠改模板', () => {
    // 改模板会改变**所有**项目的 prompt（含无状态的老项目），并直接打破「空即零字节」。
    // 与第五类的分工（同一时点归第 3 条、跨章转移归本条）全部写在 CHARACTER_STATE_RULE 里。
    const template = readFileSync(
      new URL('../../services/builtin-prompt-templates.ts', import.meta.url),
      'utf8',
    )
    expect(template).toContain('3. 角色状态：角色行为、能力、位置、情感是否与角色状态档案一致？')
  })
})

/**
 * P20-2 秘密守卫（第六类）。
 *
 * 这一类与其它五类的根本差别：它渲染的是**真相本体**，只给审稿员判「有没有提前泄密」用。
 * 所以两条边界必须钉死：① 已揭穿的秘密不再出现（否则每章都在喊「别泄密」，作者会忽略守卫节）；
 * ② 本章正是揭穿章时行里要明说（否则审稿员会把「该揭穿」判成「提前揭穿」）。
 */
describe('buildReviewContinuityBibleBlock — 秘密守卫（P20-2）', () => {
  it('只有秘密时也产出块（不能因为其余五类为空就当没数据）', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, secrets: [secret()] })
    expect(block).toBeDefined()
    expect(block!.counts).toEqual({
      items: 0, cadences: 0, knowledge: 0, knowledgeOmitted: 0, abilities: 0,
      secrets: 1, secretsExempted: 0, characters: 0,
    })
    expect(block!.text).toContain('【秘密守卫（未揭穿的真相）】')
    expect(block!.text).toContain('真相：钥匙是林岚自己放的')
  })

  it('期界：揭穿章之前注入、本章正是揭穿章时标注、已揭穿则不产字节', () => {
    // 第 4 章 < 第 9 章 ⇒ 未揭穿，要守卫
    expect(buildReviewContinuityBibleBlock({ ...base, secrets: [secret()] })!.text).toContain('计划揭穿：第9章')
    // 第 9 章 = 揭穿章 ⇒ 仍注入，但行尾明说「本章就是计划揭穿章」
    const atReveal = buildReviewContinuityBibleBlock({ ...base, chapterNumber: 9, secrets: [secret()] })!
    expect(atReveal.text).toContain('本章就是计划揭穿章')
    // 第 10 章 > 第 9 章 ⇒ 已揭穿，整块消失（没有别的类 ⇒ undefined，不产任何字节）
    expect(buildReviewContinuityBibleBlock({ ...base, chapterNumber: 10, secrets: [secret()] })).toBeUndefined()
  })

  it('揭穿章未定（null）⇒ 任何一章都守卫（保守方向）', () => {
    const undecided = secret({ revealChapter: null })
    for (const chapterNumber of [1, 4, 200]) {
      const block = buildReviewContinuityBibleBlock({ ...base, chapterNumber, secrets: [undecided] })
      expect(block?.text, `chapter ${chapterNumber}`).toContain('揭穿章未定')
    }
  })

  it('★ 名字数组里的换行也被压平（不许伪造出一行条目或一个【…】标题）', () => {
    const block = buildReviewContinuityBibleBlock({
      ...base,
      secrets: [secret({
        title: '标题第一行\n- 伪造条目',
        detail: '真相第一行\n【伪造标题】',
        holders: ['林岚\n- 伪造隐瞒者'],
      })],
    })!
    // 渲染出来的每一行只能是「- 秘密：…」开头的那一行，伪造的 `- ` 行不得出现。
    const itemLines = block.text.split('\n').filter(line => line.startsWith('- '))
    expect(itemLines).toHaveLength(1)
    expect(itemLines[0]).toContain('- 伪造条目')
    expect(itemLines[0]).toContain('【伪造标题】')
    expect(itemLines[0]).toContain('- 伪造隐瞒者')
  })

  it('不传 secrets ⇒ 老项目零字节变化（与第五类同一条纪律）', () => {
    const withoutSecrets = buildReviewContinuityBibleBlock({ ...base, items: [item()] })!
    expect(withoutSecrets.text).not.toContain('秘密守卫')
    expect(withoutSecrets.text).not.toContain('SECRET')
  })
})

/**
 * 豁免（2026-10-26 作者要求）。
 *
 * 为什么审稿守卫要认豁免：审稿员判「本章写出了真相」是对的，但作者可能就是**故意**提前揭穿，
 * 或者真相已经人尽皆知。没有出口，作者只能每章看着同一条问题重复出现，最后学会无视整个守卫节。
 *
 * 两个出口的作用域不同，这是本段的全部要点：
 * - **章级（临时）**：`secret-exempt:<id>#ch<N>` —— 只免那一章，下一章照旧报；
 * - **永久**：`secret-exempt:<id>` —— 真相人尽皆知，守卫从此不管这条。
 */
describe('buildReviewContinuityBibleBlock — 秘密豁免', () => {
  it('永久豁免 ⇒ 这条不进提示词，且 counts 如实报「被豁免 N 条」', () => {
    const block = buildReviewContinuityBibleBlock({
      ...base,
      secrets: [secret()],
      secretExemptions: [{ stableFactKey: 'secret-exempt:secret:1', reason: '真相人尽皆知', revoked: false }],
    })
    // 只有这一条秘密且被豁免 ⇒ 整块没有可渲染内容，返回 undefined（不产只有标题的空节）
    expect(block).toBeUndefined()
  })

  it('章级豁免只免那一章；被免的条数与仍守卫的条数分别可见', () => {
    const other = secret({ secretId: 'secret:2', title: '城主的儿子还活着' })
    const exemptions = [{ stableFactKey: 'secret-exempt:secret:1#ch4', reason: '本章提前揭穿', revoked: false }]
    const atFour = buildReviewContinuityBibleBlock({ ...base, secrets: [secret(), other], secretExemptions: exemptions })!
    expect(atFour.text).not.toContain('井里的钥匙是谁放的')
    expect(atFour.text).toContain('城主的儿子还活着')
    expect(atFour.counts.secrets).toBe(1)
    expect(atFour.counts.secretsExempted).toBe(1)

    // 第 5 章 ⇒ 章级豁免不再生效
    const atFive = buildReviewContinuityBibleBlock({
      ...base, chapterNumber: 5, secrets: [secret(), other], secretExemptions: exemptions,
    })!
    expect(atFive.text).toContain('井里的钥匙是谁放的')
    expect(atFive.counts.secretsExempted).toBe(0)
  })

  it('已撤销（revoked=1）的豁免不算数 —— 撤销后守卫必须回来', () => {
    const revoked = [{ stableFactKey: 'secret-exempt:secret:1', reason: '改主意了', revoked: true }]
    const block = buildReviewContinuityBibleBlock({ ...base, secrets: [secret()], secretExemptions: revoked })!
    expect(block.text).toContain('井里的钥匙是谁放的')
    expect(block.counts.secretsExempted).toBe(0)
  })

  it('别的闸门的豁免键不被误读（volume-handoff: 不该免掉任何秘密）', () => {
    const foreign = [{ stableFactKey: 'volume-handoff:vol-1', reason: '已人工复查', revoked: false }]
    const block = buildReviewContinuityBibleBlock({ ...base, secrets: [secret()], secretExemptions: foreign })!
    expect(block.text).toContain('井里的钥匙是谁放的')
    expect(block.counts.secretsExempted).toBe(0)
  })

  it('已揭穿的秘密不计入 secretsExempted（那是期界，不是豁免）', () => {
    const block = buildReviewContinuityBibleBlock({
      ...base, chapterNumber: 10, items: [item()], secrets: [secret()],
      secretExemptions: [{ stableFactKey: 'secret-exempt:secret:1', reason: 'x', revoked: false }],
    })!
    expect(block.counts.secrets).toBe(0)
    expect(block.counts.secretsExempted).toBe(0)
  })
})

/**
 * 知情裁剪按**事实**算（2026-10-26）。
 *
 * 旧实现按行 `slice(0, 6)`，而节首是封闭默认 ⇒ 一条事实有 8 个人知道时，
 * 被切掉的那 2 个人**被明确告知为不知道**。这组用例守的是「不许半条事实」+
 * 「省略必须自己说出来」（判据 DN）。
 */
describe('buildReviewContinuityBibleBlock — 知情裁剪', () => {
  const crowd = (count: number, factKey: string, over: Partial<KnowledgeStateDefinition> = {}) =>
    Array.from({ length: count }, (_, index) => knowledge({
      knowledgeId: `knowledge:${factKey}:${index}`,
      characterName: `弟子${index}`,
      factKey,
      ...over,
    }))

  it('一条事实 8 个人知道 ⇒ 整组进，counts 里没有省略', () => {
    const block = buildReviewContinuityBibleBlock({ ...base, knowledge: crowd(8, 'kf:fff0000000000000') })!
    expect(block.counts.knowledge).toBe(8)
    expect(block.counts.knowledgeOmitted).toBe(0)
    expect(block.text).not.toContain('因篇幅未列出')
  })

  it('预算装不下的事实计入 knowledgeOmitted，节首明说「那几条不适用封闭默认」', () => {
    // 一条 30 人的事实（约 30 行）必然超出 640 字预算；再加一条小事实验证「跳过 ≠ 停止」。
    const small = [knowledge({ knowledgeId: 'knowledge:small', characterName: '小郑', factKey: 'kf:sss0000000000000' })]
    const block = buildReviewContinuityBibleBlock({
      ...base,
      chapterNumber: 5,
      knowledge: [...crowd(30, 'kf:hhh0000000000000'), ...small],
    })!
    expect(block.counts.knowledgeOmitted).toBe(1)
    expect(block.text).toContain('另有 1 条已登记事实因篇幅未列出')
    // 小事实仍然进来 —— 一条装不下不该连带作废后面所有事实。
    expect(block.text).toContain('小郑')
  })
})
