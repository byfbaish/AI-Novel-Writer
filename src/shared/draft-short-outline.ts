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
 * 现在只喂三块：本章蓝图（主料）、前驱状态、本章执行合同。
 * 作者裁定：**后续计划边界不给**（已有蓝图，不应再多给信息）；前驱给**上一章定稿全文**；
 * 本章执行合同**给**。取舍记录见 `docs/design/p0-1-short-outline-scoping-design.md` §6。
 *
 * ⚠️ 字段只收录「本步确有读取点」的项（YAGNI）：短细纲不消费 `estimatedUnits`，
 * 故蓝图 `keyEvents` 的结构化改造**不在本步依赖链上**。
 */
export interface DraftShortOutlineMaterial {
  /** 本章蓝图 JSON（原样透传，不二次改写）。 */
  chapterInfo: string
  /** 前驱状态：上一章定稿原文。首章、或前驱尚未定稿时省略。 */
  predecessor?: string
  /** 本章执行合同规则（自带 `【本章执行合同】` 标题，不要再套一层）。 */
  executionContract?: string
}

/** 指令主体：与材料无关的纪律，两条语言各自成段。 */
const INSTRUCTION_CORE: Readonly<Record<'zh-CN' | 'en-US', string>> = {
  'zh-CN': '只写短细纲，不写正文。仅组织原本章目标与已有材料，最多六条短要点，分清：原目标；前驱已完成的事；明确时点和约束；本章拟写的具体行动与结果；结尾状态。要求本章推进的目标不能用旧事复述替代；作者只要求维持状态时，不强造新事件。不得增加作者事实或禁令、改变目标，或把计划说成已经发生的事实。',
  'en-US': 'Prepare a short chapter execution outline, not prose. Use only the original chapter goals and supplied material. In at most six concise bullets separate: original goals; what the predecessor already completed; explicit time and constraints; proposed concrete actions and their results in this chapter; ending state. Recalling an old event cannot satisfy a goal requiring progress here. If the author only requests maintaining a state, do not invent an event. Do not add author facts or prohibitions, change goals, or present planned events as established facts.',
}

/** 材料范围声明：明说本步只给什么、不给什么。 */
const INSTRUCTION_SCOPE: Readonly<Record<'zh-CN' | 'en-US', string>> = {
  'zh-CN': '以下只给本步需要的材料：本章蓝图、前驱状态、本章执行合同。全书设定与正文形态要求不在此步范围，也不得据此改变本章目标；此步只做计划。',
  'en-US': 'Only the material this step needs follows: the current-chapter blueprint, the predecessor state, and the current-chapter execution contract. Whole-book settings and prose-format requirements are out of scope here and must not change this chapter\'s goals; this step produces a plan only.',
}

const SECTION_LABELS = {
  chapterInfo: { 'zh-CN': '本章蓝图', 'en-US': 'Current-chapter blueprint' },
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
    material.predecessor?.trim() ? label('predecessor', material.predecessor.trim()) : '',
    material.executionContract?.trim() ?? '',
  ].filter(Boolean)
  return [INSTRUCTION_CORE[language], INSTRUCTION_SCOPE[language], ...sections].join('\n\n')
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
