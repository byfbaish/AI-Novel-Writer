/**
 * 「写前查阅」两节渲染（P0-2 · W7，2026-10-23）—— 正文链与审稿链**共用的唯一渲染入口**。
 *
 * ## 为什么单独立一个模块（判据 DM）
 *
 * 「前文事实」这一行在审稿链早就有了（`review-revision-materials.ts:17-19`），
 * 但正文链只把同批事实的 `evidence` 当定位词去摘原文，`statement`（陈述 + 章号）整层丢掉。
 * 补这一层时若在正文侧重写一份渲染，同一条事实在两处就会有兩種措辞；
 * 模型按 A 版本写、校验按 B 版本判，每章都在「修」一个不存在的错误。
 * 所以：**一个函数产出一行，两条链都调它**（先例 `character-state-lines.ts`）。
 *
 * ## 两节各是什么
 *
 * 1. **前文事实**：来源是定稿连续性索引（`finalized_continuity_facts`），每条带
 *    「来源第 N 章 + 逐字引文」—— 这是唯一能满足「能在前文找到出处」的数据。
 *    它进的是**必需材料块**，所以续写 / 压缩轮也拿得到（续写轮不带任何模板变量）。
 * 2. **关键物品**：来源是作者登记表（`key_items`），回答「谁拿着什么」。
 * 3. **制度**：来源是作者登记表（`institution_cadences`），回答「这一章该不该发生那件
 *    周期性的事」。四态由 `institution-cadence.ts` 的判定表给出，本节只渲染。
 * 4. **本书规则**：来源是世界观原文摘录（`worldbuilding-rules.ts`），出处只标维度。
 *
 * ## 三条边界
 *
 * - **不注入派生数值**（ADR-0022）：这里出现的每个数字都必须能在原文里逐字找到
 *   （章号是索引字段，不是算出来的）。系统算出的余额、增减量一律不进。
 * - **不排序**：顺序由调用方给定（新章在前），本模块只做条数与字数裁剪。
 * - **空即不出现**：没有条目就返回空串，绝不留一个只有标题的空节 ——
 *   空标题会让模型以为「作者确认过没有前文事实」。
 */
import type { FinalizedContinuityFactCategory } from './finalized-continuity'
import { renderCadenceSection, CADENCE_MAX_ITEMS, type CadenceEntry } from './institution-cadence'
import { renderKeyItemLine, type KeyItemDefinition } from './key-item'
import type { WritingLanguage } from './writing-language'
import { renderWorldRulesSection, WORLD_RULES_MAX_ITEMS, type WorldBuildingRule } from './worldbuilding-rules'

/**
 * 可注入的一条前文事实。
 *
 * 是 `FinalizedContinuityFact` 的**结构子集**（多出的 `entities` / `characterRefs` 不参与渲染），
 * 所以调用方可以原样传整条，不需要再做一次映射。
 */
export interface PrewriteFact {
  category: FinalizedContinuityFactCategory
  statement: string
  sourceChapter: number
  evidence: string
}

/** 条数上限，与活跃伏笔同口径（`ACTIVE_THREAD_CONTEXT_MAX_ITEMS`）。 */
export const PREWRITE_FACTS_MAX_ITEMS = 6
/** 正文行总字数上限（不含节标题与说明句）。 */
export const PREWRITE_FACTS_MAX_CHARS = 720
/** 关键物品条数上限：比事实更宽一点，物品清单本来就短。 */
export const PREWRITE_ITEMS_MAX_ITEMS = 8
/** 关键物品正文行字数上限。 */
export const PREWRITE_ITEMS_MAX_CHARS = 640
/**
 * 制度条数上限（P1-1）。与 `institution-cadence.ts` 的 `CADENCE_MAX_ITEMS` 同源 ——
 * 那一节自带渲染入口，这里只做排序与拼接，不再另设一套上限。
 */
export const PREWRITE_CADENCES_MAX_ITEMS = CADENCE_MAX_ITEMS

/** 单行渲染；格式与审稿链逐字相同，改动即两侧同时变（这是判据 DM 的自检点）。 */
export function renderPrewriteFactLine(fact: PrewriteFact, writingLanguage: WritingLanguage): string {
  return writingLanguage === 'en-US'
    ? `- [${fact.category}] ${fact.statement} (source: Chapter ${fact.sourceChapter}; evidence: ${fact.evidence})`
    : `- [${fact.category}] ${fact.statement}（来源第${fact.sourceChapter}章；证据：${fact.evidence}）`
}

/**
 * 渲染【前文事实】整节；空数组返回空串。
 *
 * @param maxChars 正文行总字数上限；超预算**整条丢弃**（不截半句 —— 截断的证据就不再是引文）。
 */
export function renderPrewriteFactsSection(
  facts: readonly PrewriteFact[],
  writingLanguage: WritingLanguage,
  maxChars: number = PREWRITE_FACTS_MAX_CHARS,
): string {
  const lines: string[] = []
  let used = 0
  for (const fact of facts.slice(0, PREWRITE_FACTS_MAX_ITEMS)) {
    // 没有引文就没有出处；宁可少一条，也不给一条无法回查的陈述。
    if (!fact.evidence.trim() || !fact.statement.trim()) continue
    const line = renderPrewriteFactLine(fact, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const isEn = writingLanguage === 'en-US'
  const heading = isEn
    ? '[Established facts from earlier chapters (auto-excerpted from the finalized continuity index; not exhaustive)]'
    : '【前文事实（定稿连续性索引自动摘录，不保证穷尽）】'
  const lead = isEn
    ? 'Each line carries its source chapter and a verbatim quote; the summary is an index digest, not the prose. If it conflicts with the finalized text, the finalized text prevails.'
    : '以下每条都带来源章与逐字引文；摘要只是索引的缩略，不是原文，与定稿原文冲突时以定稿原文为准。'
  return `${heading}\n${lead}\n${lines.join('\n')}`
}

/**
 * 渲染【关键物品】整节；空数组返回空串。
 *
 * 这一节回答的是「谁拿着什么」，不是「有多少」—— 没有任何数字是算出来的（ADR-0022）。
 * 归属**按时点理解**（与六槽同一措辞）：标了章号就是那一刻的状态，没标就是作者登记的当前状态。
 */
export function renderPrewriteItemsSection(
  items: readonly KeyItemDefinition[],
  writingLanguage: WritingLanguage,
  maxChars: number = PREWRITE_ITEMS_MAX_CHARS,
): string {
  const lines: string[] = []
  let used = 0
  for (const item of items.slice(0, PREWRITE_ITEMS_MAX_ITEMS)) {
    if (!item.name?.trim()) continue
    const line = renderKeyItemLine(item, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const isEn = writingLanguage === 'en-US'
  const heading = isEn
    ? '[Key items (author registry: who holds what)]'
    : '【关键物品（作者登记：谁拿着什么）】'
  const lead = isEn
    ? 'Ownership is time-bound when a chapter is given; entries marked "author entry" have no chapter. Do not move an item to another holder without showing the transfer in the prose.'
    : '标了章号的归属按那一刻理解，不是永久状态；没标章号的是作者登记。没有写出转交过程，不得把物品换到别人手里。'
  return `${heading}\n${lead}\n${lines.join('\n')}`
}

/**
 * 组装四节（前文事实 / 关键物品 / 制度 / 本书规则）；返回实际进入提示词的条数。
 *
 * 顺序按计划 §0 定死：**事实 → 物品 → 制度 → 规则**。事实与物品靠前（先看 canon），
 * 规则最后（像约束条款，收尾位最不易被忽略）。
 *
 * 全部为空 ⇒ `text=''`，调用方据此不产生任何字节（材料块逐字节不变，护栏靠这个成立）。
 */
export function buildPrewriteConsultationBlock(
  input: {
    facts?: readonly PrewriteFact[]
    items?: readonly KeyItemDefinition[]
    /** 已按本章位置判定并排序过的周期事件（排序在调用方，本层只渲染）。 */
    cadences?: readonly CadenceEntry[]
    rules?: readonly WorldBuildingRule[]
  },
  writingLanguage: WritingLanguage,
): { text: string; factCount: number; itemCount: number; cadenceCount: number; ruleCount: number } {
  const facts = input.facts ?? []
  const items = input.items ?? []
  const cadences = input.cadences ?? []
  const rules = input.rules ?? []
  const factsSection = renderPrewriteFactsSection(facts, writingLanguage)
  const itemsSection = renderPrewriteItemsSection(items, writingLanguage)
  const cadencesSection = renderCadenceSection(cadences, writingLanguage)
  const rulesSection = renderWorldRulesSection(rules, writingLanguage)
  const text = [factsSection, itemsSection, cadencesSection, rulesSection].filter(Boolean).join('\n\n')
  if (!text) return { text: '', factCount: 0, itemCount: 0, cadenceCount: 0, ruleCount: 0 }
  // 条数按**通过裁剪**的行数回报：日志说"注入了 6 条"就必须真是 6 条。
  const count = (section: string) => (section ? section.split('\n').filter(line => line.startsWith('- ')).length : 0)
  return {
    text,
    // 极端情况下条目多于上限：按常量兜住，避免日志与常量说法打架。
    factCount: Math.min(count(factsSection), PREWRITE_FACTS_MAX_ITEMS),
    itemCount: Math.min(count(itemsSection), PREWRITE_ITEMS_MAX_ITEMS),
    cadenceCount: Math.min(count(cadencesSection), CADENCE_MAX_ITEMS),
    ruleCount: Math.min(count(rulesSection), WORLD_RULES_MAX_ITEMS),
  }
}
