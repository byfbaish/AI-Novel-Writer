import type { WritingLanguage } from './writing-language'

export const DRAFT_SHORT_OUTLINE_PURPOSE = 'chapter-draft-short-outline' as const

/**
 * 短细纲这一步**允许看到**的材料（P0-1 契约）。
 *
 * 为什么要有这个契约：此前这一步直接吃「整份初始正文 prompt」（实测 16,736 字 ——
 * 全书设定池 5,049 / 参考作品 3,071 / 文风要求 1,492 / 全局写作要求 315 / 篇幅合同 /
 * 黄金第一章法则 / AI 味反制…），而短细纲调用**没有 system 消息**：模型看到的唯一
 * 输入就是「指令 + 材料」。材料全是正文形态纪律 → 等于在教它写正文（实测输出 1,747
 * 字散文）。这不是模型不听话，是载荷在误导。
 *
 * 现在只喂四块：本章蓝图（主料）、分段预算、前驱状态、本章执行合同。
 * 作者裁定：**后续计划边界不给**（已有蓝图，不应再多给信息）；前驱给**上一章定稿全文**；
 * 本章执行合同**给**。取舍记录见 `docs/design/prompt/p0-1-short-outline-scoping-design.md` §6。
 *
 * 2026-10-19：这一步从「第二个规划者」改成**预算执行者**。此前它不消费 `estimatedUnits`，
 * 只做定性组织（最多六条要点），结果与蓝图 `keyEvents` 重复；而 `estimatedUnits` 在全仓
 * 没有任何下游消费者（`keyEventsText` 投影时还把它丢掉了）。现在由**代码**把每个事件的
 * `estimatedUnits` 按本章目标字数折算成分段预算（比例式不让模型算，判据 AZ），这一步只负责
 * 按「段数 / 顺序 / 每段字数」落成执行表 —— 它不再需要创作判断，也就不会侵入作者意图。
 */
export interface DraftShortOutlineMaterial {
  /** 本章蓝图 JSON（原样透传，不二次改写）。 */
  chapterInfo: string
  /** 前驱状态：上一章定稿原文。首章、或前驱尚未定稿时省略。 */
  predecessor?: string
  /** 本章执行合同规则（自带 `【本章执行合同】` 标题，不要再套一层）。 */
  executionContract?: string
  /**
   * 分段预算（由代码按蓝图 `keyEvents[].estimatedUnits` 折算成本章字数，已渲染成文本）。
   *
   * 为什么由代码算：单位→字数的比例是比例式，模型算不准（判据 AZ：同一 Σ 代码算必须
   * 严格相等，模型自报可 ±10%）。这一步的职责是**执行**预算，不是重新估一遍。
   */
  segmentBudget?: string
}

/** 指令主体：与材料无关的纪律，两条语言各自成段。 */
const INSTRUCTION_CORE: Readonly<Record<'zh-CN' | 'en-US', string>> = {
  'zh-CN': '只写短细纲（分段执行表），不写正文。严格按【分段预算】给出的段数、顺序与字数，为每一段写一条：这一段发生什么（只写要点，不写对话、不写描写）；这一段结束时停在哪。段数与字数一律照抄【分段预算】，不得增加、删除、合并或重排 —— 预算是给定条件（蓝图的事件字数预算按本章目标字数折算而来），不要为了"用满字数"而加事，也不要因为"没什么可写"就把两段并成一段。只能用材料里已有的事件与约束：不得新增作者事实、禁令或目标，不得改动本章目标，也不得把计划写成已经发生的事实。没有【分段预算】时，才退回最多六条要点：原目标；前驱已完成的事；明确时点和约束；本章拟写的具体行动与结果；结尾状态。',
  'en-US': 'Prepare a short chapter outline as a segment execution table, not prose. Follow the segment count, order, and per-segment length given in [Segment budget] exactly: for each segment, state what happens (key points only — no dialogue, no description) and where the segment stops. Copy the count and lengths verbatim: never add, drop, merge, or reorder segments. The budget is a given condition (the blueprint\'s event budgets converted to this chapter\'s target length), so do not invent events to fill it and do not merge two segments because there seems little to write. Use only the events and constraints supplied: add no author facts, prohibitions, or goals, change no goal, and never present planned events as established facts. When no [Segment budget] is supplied, fall back to at most six concise bullets: original goals; what the predecessor already completed; explicit time and constraints; proposed concrete actions and their results in this chapter; ending state.',
}

/** 材料范围声明：明说本步只给什么、不给什么。 */
const INSTRUCTION_SCOPE: Readonly<Record<'zh-CN' | 'en-US', string>> = {
  'zh-CN': '以下只给本步需要的材料：本章蓝图、分段预算、前驱状态、本章执行合同。全书设定与正文形态要求不在此步范围，也不得据此改变本章目标；此步只做计划。',
  'en-US': 'Only the material this step needs follows: the current-chapter blueprint, the segment budget, the predecessor state, and the current-chapter execution contract. Whole-book settings and prose-format requirements are out of scope here and must not change this chapter\'s goals; this step produces a plan only.',
}

const SECTION_LABELS = {
  chapterInfo: { 'zh-CN': '本章蓝图', 'en-US': 'Current-chapter blueprint' },
  segmentBudget: { 'zh-CN': '分段预算', 'en-US': 'Segment budget' },
  predecessor: { 'zh-CN': '前驱状态 · 上一章定稿原文', 'en-US': 'Predecessor state · finalized prose of the previous chapter' },
} as const

/**
 * 短细纲的完整请求文本（指令 + 分区材料）。
 *
 * 块序固定：指令 → 本章蓝图 → 前驱状态 → 本章执行合同。
 * `predecessor` / `executionContract` 缺省即整块省略（首章没有前驱是正常态，不是错误）。
 */
export function draftShortOutlinePrompt(language: WritingLanguage, material: DraftShortOutlineMaterial): string {
  const label = (key: keyof typeof SECTION_LABELS, body: string) => language === 'en-US'
    ? `[${SECTION_LABELS[key]['en-US']}]\n${body}`
    : `【${SECTION_LABELS[key]['zh-CN']}】\n${body}`
  const sections = [
    label('chapterInfo', material.chapterInfo),
    material.segmentBudget?.trim() ? label('segmentBudget', material.segmentBudget.trim()) : '',
    material.predecessor?.trim() ? label('predecessor', material.predecessor.trim()) : '',
    material.executionContract?.trim() ?? '',
  ].filter(Boolean)
  return [INSTRUCTION_CORE[language], INSTRUCTION_SCOPE[language], ...sections].join('\n\n')
}

/**
 * 分段预算：把蓝图每个事件的 `estimatedUnits` 按本章目标字数折算成字数。
 *
 * 为什么由代码算：单位→字数是一个比例式，模型算不稳（判据 AZ：同一 Σ 代码算必须严格
 * 相等，模型自报可 ±10%）。先按 floor 分配、末段吃掉余数，**保证合计严格等于本章目标**。
 *
 * 蓝图没给 units（或全为 0）时退化成等分 —— 至少让"分几段"有个确定的形状。
 * 事件为空时返回空串：材料块整块省略，短细纲退回要点模式。
 */
export function shortOutlineSegmentBudget(
  writingLanguage: WritingLanguage,
  events: readonly { event?: string; estimatedUnits?: number }[] | undefined,
  targetChars: number,
): string {
  const items = (events ?? [])
    .map(item => ({ text: String(item?.event ?? '').trim(), units: Number(item?.estimatedUnits) }))
    .filter(item => item.text.length > 0)
  if (items.length === 0 || !(targetChars > 0)) return ''

  const weights = items.map(item => (Number.isFinite(item.units) && item.units > 0 ? item.units : 0))
  const weightsTotal = weights.reduce((sum, value) => sum + value, 0)
  const shares = weightsTotal > 0 ? weights : items.map(() => 1)
  const shareTotal = shares.reduce((sum, value) => sum + value, 0)

  let allocated = 0
  const lines = items.map((item, index) => {
    const isLast = index === items.length - 1
    // 末段吃掉余数：既保证合计等于 targetChars，也避免四舍五入把总字数顶超。
    const chars = isLast
      ? Math.max(1, targetChars - allocated)
      : Math.max(1, Math.floor((targetChars * shares[index]!) / shareTotal))
    allocated += chars
    return writingLanguage === 'en-US'
      ? `${index + 1}. ~${chars} characters: ${item.text}`
      : `${index + 1}. 约 ${chars} 字：${item.text}`
  })

  return [
    ...lines,
    writingLanguage === 'en-US'
      ? `Total ${allocated} characters (chapter target ${targetChars}).`
      : `合计 ${allocated} 字（本章目标 ${targetChars} 字）。`,
  ].join('\n')
}

export function draftShortOutlineBlock(language: WritingLanguage, text: string): string {
  if (!text.trim()) throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
  return language === 'en-US'
    ? `[Generated short outline — plan, not evidence]\nThis organizes the original goals only. Author facts, constraints and actual prior prose take priority; the plan establishes no fact.\n${text.trim()}\n[End generated short outline]`
    : `【生成短细纲：计划，不是事实依据】\n仅用于组织原目标；作者事实、约束和实际前文优先，计划不确立任何事实。\n${text.trim()}\n【生成短细纲结束】`
}

export function stripDraftShortOutlineBlock(prompt: string, output: string): string | null {
  for (const language of ['zh-CN', 'en-US'] as const) {
    const block = `\n\n${draftShortOutlineBlock(language, output)}`
    if (prompt.endsWith(block)) return prompt.slice(0, -block.length)
  }
  return null
}
