import { describe, expect, it } from 'vitest'
import {
  DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS,
  draftShortOutlineBlock,
  draftShortOutlinePredecessor,
  draftShortOutlinePrompt,
  shortOutlineSegmentBudget,
  stripDraftShortOutlineBlock,
} from '../draft-short-outline'
import { previousChapterEnding } from '../../services/workflows/chapter-materials'

/** 正文形态区块：任何一条出现在短细纲请求里都说明 P0-1 的载荷收缩被绕过。 */
const PROSE_SHAPE_BLOCKS = [
  '【全书设定池】',
  '【全局写作要求】',
  '【文风要求】',
  '【参考作品】',
  '【本章篇幅合同】',
  '【网文"黄金第一章"创作法则】',
  '【AI 味反制',
  '【作者资料（保留原文',
  '【后续计划边界',
]

describe('draftShortOutlinePrompt（P0-1 分区契约）', () => {
  const chapterInfo = '{"chapterNumber":2,"title":"读信","keyEvents":"读信；回信"}'
  const predecessor = '第一章定稿原文：信已送到门口。'
  const executionContract = '【本章执行合同】\n【作者本章任务】按作者原文含义遵循……'

  it('按「指令 → 本章蓝图 → 分段预算 → 前驱状态 → 本章执行合同」固定块序装配', () => {
    const segmentBudget = '1. 约 1400 字：读信\n合计 1400 字（本章目标 1400 字）。'
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, segmentBudget, predecessor, executionContract })
    // 块头带换行：指令正文里也会提到「【分段预算】」这几个字，不带换行会命中指令而非块头。
    const order = ['只写短细纲（分段执行表）', '【本章蓝图】\n', '【分段预算】\n', '【前驱状态 · 上一章要点 + 结尾片段】\n', '【本章执行合同】']
    const positions = order.map(marker => prompt.indexOf(marker))
    expect(positions.every(at => at >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    for (const body of [chapterInfo, segmentBudget, predecessor, executionContract]) expect(prompt).toContain(body)
  })

  it('没有分段预算时整块省略，并退回要点模式', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, predecessor })
    expect(prompt).not.toContain('【分段预算】\n')
    expect(prompt).toContain('没有【分段预算】时')
  })

  it('指令把段数/顺序/字数定为不得改动的给定条件', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo })
    expect(prompt).toContain('不得增加、删除、合并或重排')
    expect(prompt).toContain('不得新增作者事实')
  })

  it.each(['zh-CN', 'en-US'] as const)('%s 下都不含任何正文形态区块（P0-1 的核心断言）', writingLanguage => {
    const prompt = draftShortOutlinePrompt(writingLanguage, { chapterInfo, predecessor, executionContract })
    for (const block of PROSE_SHAPE_BLOCKS) expect(prompt).not.toContain(block)
  })

  it('无前驱时整块省略（首章是正常态，不是错误）', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, executionContract })
    expect(prompt).not.toContain('【前驱状态 · ')
    expect(prompt).toContain('【本章蓝图】')
    expect(prompt).toContain('【本章执行合同】')
  })

  it('无执行合同时整块省略', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo })
    expect(prompt).not.toContain('【本章执行合同】')
    // 空串与全空白都不得留下一个空标题块。
    expect(draftShortOutlinePrompt('zh-CN', { chapterInfo, predecessor: '   ' })).not.toContain('【前驱状态 · ')
  })

  it('en-US 用英文标签，不混中文块头', () => {
    const prompt = draftShortOutlinePrompt('en-US', { chapterInfo, predecessor, executionContract })
    expect(prompt).toContain('[Current-chapter blueprint]')
    expect(prompt).toContain('[Predecessor state · previous-chapter summary + ending fragment]')
    expect(prompt).not.toContain('【本章蓝图】')
  })

  it('材料原文逐字透传，不做二次改写或摘要', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, predecessor })
    expect(prompt).toContain(predecessor)
    expect(prompt.split(predecessor)).toHaveLength(2)
  })
})

describe('短细纲产出块的往返（既有行为回归）', () => {
  it('拼入正文后能被逐字剥离', () => {
    for (const language of ['zh-CN', 'en-US'] as const) {
      const base = '初始正文 prompt'
      const output = '计划：读信。'
      const composed = `${base}\n\n${draftShortOutlineBlock(language, output)}`
      expect(composed.startsWith(base)).toBe(true)
      expect(stripDraftShortOutlineBlock(composed, output)).toBe(base)
    }
  })

  it('空白产出抛错（沿用既有契约），非末尾块剥离返回 null', () => {
    expect(() => draftShortOutlineBlock('zh-CN', '  ')).toThrow('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
    expect(stripDraftShortOutlineBlock('别的正文', '计划')).toBeNull()
  })
})

describe('shortOutlineSegmentBudget（代码算预算，模型只执行）', () => {
  const events = [
    { event: '老陈追问', estimatedUnits: 700 },
    { event: '多端一碗汤', estimatedUnits: 500 },
  ]

  it('按 estimatedUnits 比例折算，合计严格等于本章目标', () => {
    const text = shortOutlineSegmentBudget('zh-CN', events, 2400)
    expect(text).toContain('1. 约 1400 字：老陈追问')
    // 末段吃掉余数，保证 Σ 不漂
    expect(text).toContain('合计 2400 字（本章目标 2400 字）')
  })

  it('四舍五入不顶超目标（奇数比例）', () => {
    const text = shortOutlineSegmentBudget('zh-CN', [
      { event: 'A', estimatedUnits: 300 },
      { event: 'B', estimatedUnits: 300 },
      { event: 'C', estimatedUnits: 300 },
    ], 1000)
    expect(text).toContain('合计 1000 字（本章目标 1000 字）')
  })

  it('没有 units 时等分，仍然保证合计', () => {
    const text = shortOutlineSegmentBudget('zh-CN', [{ event: 'A' }, { event: 'B' }], 900)
    expect(text).toContain('合计 900 字')
  })

  it('没有事件或没有目标字数时返回空串（整块省略）', () => {
    expect(shortOutlineSegmentBudget('zh-CN', [], 2400)).toBe('')
    expect(shortOutlineSegmentBudget('zh-CN', events, 0)).toBe('')
  })

  it('en-US 用英文单位，不混中文字', () => {
    const text = shortOutlineSegmentBudget('en-US', events, 2400)
    expect(text).toContain('1. ~1400 characters: 老陈追问')
    expect(text).toContain('Total 2400 characters (chapter target 2400).')
  })
})

describe('draftShortOutlinePredecessor（R6：要点 + 结尾片段）', () => {
  const notes = '时间定位：第二日卯时。空间锚点：碑坪。剧情节点：点卯已毕。'
  const ending = '陈砚把铜锣挂回钉上，手还悬在半空。'

  it('两块都给：要点在前，结尾片段在后，片段标明只作承接', () => {
    const text = draftShortOutlinePredecessor('zh-CN', { notes, ending })
    expect(text.indexOf(notes)).toBeLessThan(text.indexOf(ending))
    expect(text).toContain(`上一章最后约 ${DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS} 字`)
    expect(text).toContain('上一章已完成的事')
  })

  it('只有要点时不留结尾空标题（老项目没有结尾摘录是正常态）', () => {
    const text = draftShortOutlinePredecessor('zh-CN', { notes })
    expect(text).toContain(notes)
    expect(text).not.toContain('上一章最后约')
  })

  it('只有结尾时也成立：要点缺失不能把片段一起吞掉', () => {
    const text = draftShortOutlinePredecessor('zh-CN', { ending })
    expect(text).toContain(ending)
    expect(text).not.toContain('上一章已完成的事')
  })

  it('两块都空时返回空串（首章整块省略，不是错误）', () => {
    expect(draftShortOutlinePredecessor('zh-CN', {})).toBe('')
    expect(draftShortOutlinePredecessor('zh-CN', { notes: '  ', ending: '\n' })).toBe('')
  })

  it('en-US 不混中文块头', () => {
    const text = draftShortOutlinePredecessor('en-US', { notes, ending })
    expect(text).toContain('What the previous chapter completed')
    expect(text).not.toContain('上一章')
  })

  it('要点里的换行与措辞逐字透传，不做二次摘要', () => {
    const multiline = '一、时间\n二、空间\n三、事件'
    expect(draftShortOutlinePredecessor('zh-CN', { notes: multiline })).toContain(multiline)
  })
})


/** 六栏骨架：真实模板（`src/services/builtin-prompt-templates.ts:1622-1676`）产出的栏名。 */
const SIX_COLUMN_HEADINGS = [
  '## 时间定位',
  '## 空间锚点',
  '## 剧情节点',
  '## 角色动态',
  '## 新增设定',
  '## 伏笔与钩子',
]

/** 常见档：394 码元（剧情 3 条、角色表 2 行、伏笔 1 条）。 */
const TYPICAL_NOTES = [
  '# 第七章 送药 要点',
  '## 时间定位',
  '- 故事日：7',
  '- 书中写法：二月廿七',
  '- 依据：正文「昨儿夜里落了霜」，与第六章「霜降次日」相接',
  '## 空间锚点',
  '- 场景：青阳山·杂役处｜时段：06:15',
  '- 场景：青阳山·药王殿·丹房',
  '## 剧情节点',
  '- [触发] 点卯时管事点名，林昭被派去后山药王殿送药',
  '- [转折] 途中遇雨，药箱磕在石阶上摔开，朱砂袋破口',
  '- [结果] 丹房执事记下短缺，限三日内补齐，否则扣月钱',
  '## 角色动态',
  '| 角色 | 本章变化/状态 |',
  '|------|-------------|',
  '| 林昭 | 由杂役调去药房帮工，欠丹房一味朱砂 |',
  '| 周执事 | 对林昭起了疑心，暂未发作 |',
  '## 新增设定',
  '- 药王殿丹房按月核药，短缺记在执事私册上',
  '## 伏笔与钩子',
  '- [埋] 摔碎的药箱底刻着半枚火纹，与林昭幼时所见相同',
].join('\n')

/** 丰富档：576 码元（角色表 3 行、钩子 3 条）。 */
const RICH_NOTES = [
  '# 第七章 送药 要点',
  '## 时间定位',
  '- 故事日：7',
  '- 书中写法：二月廿七',
  '- 依据：正文「昨儿夜里落了霜」，与第六章末尾「霜降次日卯时」相接，未跨日',
  '## 空间锚点',
  '- 场景：青阳山·杂役处｜时段：06:15',
  '- 场景：青阳山·药王殿·丹房｜时段：09:40',
  '- 场景：青阳山·后山石阶',
  '## 剧情节点',
  '- [触发] 点卯时管事当众点名，把送药的差事派给林昭，并说明「丹房只点卯时收货」',
  '- [转折] 后山石阶遇雨湿滑，林昭为护药箱摔在阶上，朱砂袋破口撒出小半',
  '- [结果] 丹房周执事当面称过，短了四钱二分，记在私册上，限三日内补齐，「补不上就扣三个月月钱」',
  '## 角色动态',
  '| 角色 | 本章变化/状态 |',
  '|------|-------------|',
  '| 林昭 | 由杂役调去药房帮工；欠丹房朱砂四钱二分；三日期限已开始计算 |',
  '| 周执事 | 对林昭起疑，认为摔箱「不像是失手」；暂未上报，只在私册记账 |',
  '| 管事刘全 | 派活时知情不提点，事后未再过问 |',
  '## 新增设定',
  '- 药王殿丹房按月核药，短缺记在执事私册；私册不归宗务堂过目',
  '## 伏笔与钩子',
  '- [埋] 摔碎的药箱底刻着半枚火纹，与林昭幼时在旧宅门楣所见相同',
  '- [钩] 朱砂真实去向未查；周执事私册记账的动机未明',
  '- [钩] 三日期限与第六章「七日后宗门大比」时间上相撞',
].join('\n')

/** 上一章夹具：40 段互不同句，合计约 1,000 码元。 */
const PREVIOUS_PARAGRAPHS = Array.from({ length: 40 }, (_, index) => {
  const stem = String.fromCharCode(0x4e00 + index * 7)
  return `第${index + 1}段，${stem}${stem}${stem}落在檐下，风从谷口穿过，铜铃响了两声，没有人抬头。`
})
const PREVIOUS_CHAPTER = PREVIOUS_PARAGRAPHS.join('\n')

function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(heading)
  if (start < 0) return ''
  const rest = text.slice(start + heading.length)
  const next = rest.search(/\n## /)
  return next < 0 ? rest : rest.slice(0, next)
}

/** 角色动态表的实际数据行（去掉表头与分隔行）。 */
function dataRowCount(notes: string): number {
  return sectionOf(notes, '## 角色动态')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|[\s:-]+\|/.test(line))
    .length - 1
}

/** 伏笔与钩子的条目行。 */
function hookItemCount(notes: string): number {
  return sectionOf(notes, '## 伏笔与钩子')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .length
}

function windows(text: string, size: number): string[] {
  const result: string[] = []
  for (let index = 0; index + size <= text.length; index += 1) result.push(text.slice(index, index + size))
  return result
}

describe('短细纲前驱状态：口径 v3 结构判据（要点不设上限）', () => {
  it('按块计：结尾块 ≤300 码元，要点块整份带入，两块不合并算', () => {
    const ending = previousChapterEnding(PREVIOUS_CHAPTER, DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS)
    expect(ending.length).toBeLessThanOrEqual(DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS)

    const text = draftShortOutlinePredecessor('zh-CN', { notes: TYPICAL_NOTES, ending })
    expect(text).toContain(TYPICAL_NOTES)
    const endingBlock = sectionOf(text, '（只用于承接语气、未完成的动作与站位）：')
    expect(endingBlock.trim()).toBe(ending)
    expect(endingBlock.trim().length).toBeLessThanOrEqual(DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS)
  })

  it.each([
    ['常见档 394 码元', TYPICAL_NOTES, 2, 1],
    ['丰富档 576 码元', RICH_NOTES, 3, 3],
  ])('%s：六栏标题全在、角色表行数不变、伏笔条目数不变', (_label, notes, rows, hooks) => {
    expect(dataRowCount(notes)).toBe(rows)
    expect(hookItemCount(notes)).toBe(hooks)

    const text = draftShortOutlinePredecessor('zh-CN', {
      notes,
      ending: previousChapterEnding(PREVIOUS_CHAPTER, DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS),
    })
    for (const heading of SIX_COLUMN_HEADINGS) expect(text).toContain(heading)
    expect(dataRowCount(text)).toBe(rows)
    expect(hookItemCount(text)).toBe(hooks)
    expect(text.length).toBeGreaterThan(notes.length)
  })

  it('全文不在场：上一章中段任一 80 码元连续片段都不出现在短细纲请求里', () => {
    const ending = previousChapterEnding(PREVIOUS_CHAPTER, DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS)
    const text = draftShortOutlinePredecessor('zh-CN', { notes: RICH_NOTES, ending })
    const middle = PREVIOUS_PARAGRAPHS.slice(9, 30).join('\n')
    const leaked = windows(middle, 80).filter((window) => text.includes(window))
    expect(leaked).toEqual([])
  })

  it('要点为空时只出现结尾块，不留空标题', () => {
    const text = draftShortOutlinePredecessor('zh-CN', {
      notes: '   ',
      ending: previousChapterEnding(PREVIOUS_CHAPTER, DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS),
    })
    expect(text).not.toContain('上一章已完成的事（要点）')
    expect(text).not.toContain('## ')
  })
})
