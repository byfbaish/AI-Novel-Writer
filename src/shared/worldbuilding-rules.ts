/**
 * 世界观「规则条目」抽取（P0-2 · W7 写前查阅，2026-10-23）。
 *
 * ## 为什么要它
 *
 * 世界观的五维结构（`builtin-prompt-templates.ts:584-589`）是全书手段边界的来源，但它以
 * **整篇长文**注入正文请求（`readArchitecture` → `{{architecture}}`，首章在正文、后续章在
 * systemSuffix）。两个后果：
 * - **续写 / 压缩轮完全拿不到它** —— `draftAuthorMaterialBlock` 只带作者材料块，不带模板变量；
 * - 模型每轮都在一篇几千字里自己找「这章能用什么」，没有出处、没有上限。
 *
 * 本模块把「本章落笔前该看哪几条规则」抽成条目，交给 `prewrite-consultation.ts` 渲染进
 * **必需材料块**（首轮与续写轮同一份）。行业里这件事叫 *consult the bible before writing*：
 * 注入的是**原文摘录 + 出处**，不是重算出来的结论。
 *
 * ## 做什么 / 不做什么
 *
 * 只做「结构对结构」的确定性命中：按五维标题定位 → 段内切条目 → 用模态词筛「规则句」→ 截断。
 * **零模型、零新表、不改世界观正文**。不判断规则对不对、不推演数值、不做语义归一。
 *
 * ## 三条硬约束
 *
 * 1. **第 3 维整维跳过**（判据 DP）。隐喻与深层危机就是远期反转本身；内置模板原文明确要求
 *    「只写悬念、不写本章马上要用的规则」。这里不能依赖 `architecture-projection` 的标题匹配
 *    去挡剧透 —— 那个投影在标题被作者改写时会 fail-open 逐字放行，剧透防线不能挂在它身上。
 * 2. **出处只标维度，不伪造章号**。世界观是设定，不是第 N 章发生的事；写「来源第 3 章」是撒谎，
 *    模型会拿它跟前文对账，对不上就变成新的错误源。维度标签统一取
 *    `worldbuilding-completeness.dimensionLabel()`，那是全项目唯一的维度措辞来源。
 * 3. **第 4 维不另写解析器**。空间条目（`**名称**`+`关键规则：` / 三列表格 / `- **名称**：描述`）
 *    已有 `space-constraints.ts` 的三形态实现，这里只调它的 `extractSpaceConstraintsFromSection`。
 *
 * ## fail-open
 *
 * 定位不到维度标题、某个维度抽不出合格句、全部被预算裁掉 —— 一律返回空数组。调用方据此
 * 让整节不出现，而不是在提示词里留一个「（无规则）」的空标题。
 */
import { dimensionLabel, locateWorldBuildingSections } from './worldbuilding-completeness'
import {
  extractSpaceConstraintsFromSection,
  SPACE_RULE_MAX_CHARS,
} from './space-constraints'
import type { WritingLanguage } from './writing-language'

/** 可注入的维度：3 永远不在此列（剧透，判据 DP）。 */
export type RuleDimension = 1 | 2 | 4 | 5

/** 注入顺序：读起来是「世界怎么运转 → 谁跟谁抢 → 在哪不能做什么 → 什么时候发生」。 */
const DIMENSION_PRIORITY: readonly RuleDimension[] = [1, 2, 4, 5]

/** 总条数上限。8 条以内一眼能扫完，超出的部分模型也用不上。 */
export const WORLD_RULES_MAX_ITEMS = 8
/** 正文行总字数上限（不含节标题与说明句）。 */
export const WORLD_RULES_MAX_CHARS = 640
/**
 * 单一维度最多几条。
 *
 * 轮转分配（见文件末尾的选取循环）已经保证「每维都有机会」，所以这里的上限不再承担
 * 「公平」职责，只剩两个作用：① 防止单维长文把清单吃满（另三维为空时尤其明显）；
 * ② 让抽取阶段的工作量有界。
 *
 * 副作用：非空维不足 3 个时，总条数会小于 `WORLD_RULES_MAX_ITEMS`。这是刻意的 —— 不补空、不重复。
 */
const WORLD_RULES_PER_DIMENSION_MAX = 3

/** 一条可注入的规则。`rule` 永远是世界观原文的**逐字子串**（只做空白压缩与尾部截断）。 */
export interface WorldBuildingRule {
  dimension: RuleDimension
  /** 条目标签（空间名 / `**名称**`）；无名称时为空串。 */
  name: string
  /** 原文摘录，≤ `SPACE_RULE_MAX_CHARS` 字。 */
  rule: string
}

/**
 * 「规则句」的模态词表。
 *
 * 这是**词表**，不是语义判断 —— 宁漏勿误：
 * - 词表保守 ⇒ 少抽几条，作者仍能靠 systemSuffix 里的全量世界观兜底；
 * - 词表激进 ⇒ 清单变成噪声，而噪声会挤掉真正要紧的那几条。
 * 想让它更准，只能改这张表或改世界观写法；**不要**在这里加模型/规则推演，那会变成第二套标准。
 */
const RULE_MARKERS: readonly string[] = [
  // 强制 / 禁止
  '必须', '不得', '禁止', '严禁', '只能', '仅能', '不可', '不允许', '一律', '须', '应当', '需要',
  // 周期 / 结算
  '每日', '每天', '每月', '每年', '每周', '每次', '每隔', '周期', '结算', '按期', '到期',
  // 量纲 / 代价
  '上限', '下限', '最少', '最多', '不超过', '至少', '代价', '消耗', '扣除', '押金', '抽成',
  '分成', '税率', '抽税', '月例', '工钱', '灵石', '折算', '换算', '通兑',
  // 准入 / 时间窗
  '准入', '登记', '申报', '凭证', '宵禁', '开市', '闭市', '时辰',
  // en
  'must', 'must not', 'cannot', 'can not', 'only', 'required', 'requires', 'prohibited',
  'forbidden', 'per day', 'per month', 'per week', 'every', 'at most', 'at least',
  'no more than', 'limit', 'cap', 'cost', 'fee', 'tax', 'rate', 'cooldown', 'unless',
]

/** 疑问句不是规则：第 1/2 维的模板正文本身就是一串问句，不排除就会把提问当规则抄进去。 */
const QUESTION_PATTERNS: readonly RegExp[] = [
  /[？?]\s*$/u,
  /(?:是什么|有哪些|是哪些|为什么|如何|怎么)[？?]?\s*$/u,
  /\b(?:what|which|why|how)\b[^.]*[?]\s*$/iu,
]

/** 去掉 markdown 强调、列表符与行内代码，压缩空白。 */
function flatten(raw: string): string {
  return raw
    .replace(/^\s*[-*+]\s*/u, '')
    .replace(/[*_`>]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function truncate(text: string): string {
  const flat = flatten(text)
  return flat.length > SPACE_RULE_MAX_CHARS ? `${flat.slice(0, SPACE_RULE_MAX_CHARS)}…` : flat
}

/** 命中模态词且不是疑问句、且长度过短阈值的才算规则句。 */
function isRuleSentence(text: string): boolean {
  const flat = flatten(text)
  if (flat.length < 6) return false
  if (QUESTION_PATTERNS.some(pattern => pattern.test(flat))) return false
  const lower = flat.toLowerCase()
  return RULE_MARKERS.some(marker => lower.includes(marker.toLowerCase()))
}

const BOLD_ONLY = /^\*\*(.+?)\*\*\s*$/u
const BOLD_INLINE = /^(?:[-*+]\s*)?\*\*(.+?)\*\*\s*[:：]\s*(.+)$/u
/** `关键规则：…` 这类标签行：标签本身不是规则内容，要剥掉。 */
const RULE_LABEL_PATTERNS: readonly RegExp[] = [
  /^(?:关键规则|规则|限制|约束|代价)[：:]\s*/u,
]

/**
 * 段内切条目。不做标题定位（那是 `locateWorldBuildingSections` 的职责）。
 *
 * 五种形态按「显式 → 兜底」依次吃：
 * 1. `**名称**` 独占行 ⇒ 之后到空行/下一个粗体之间的行都算这个名称下的候选；
 * 2. `关键规则：…` / `规则：…` ⇒ 归给当前名称，标签剥掉；
 * 3. 表格行（首列 `**粗体**`）⇒ 名称取首列、候选取末列；
 * 4. `- **名称**：描述` ⇒ 名称与候选同排；
 * 5. 其余非空行 ⇒ 无名称候选（散文里的规则句多半落在这一档）。
 */
function candidatesOf(body: readonly string[]): Array<{ name: string; text: string }> {
  const out: Array<{ name: string; text: string }> = []
  let currentName = ''
  for (const raw of body) {
    const line = raw.trim()
    if (!line) continue
    const boldOnly = BOLD_ONLY.exec(line)
    if (boldOnly) {
      currentName = flatten(boldOnly[1] ?? '')
      continue
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(cell => cell.trim())
      if (cells.length < 2) continue
      const bold = BOLD_ONLY.exec(cells[0] ?? '')
      if (!bold) continue
      const name = flatten(bold[1] ?? '')
      const text = cells[cells.length - 1] ?? ''
      if (name && !/^[-:\s]+$/u.test(text)) out.push({ name, text })
      continue
    }
    const inline = BOLD_INLINE.exec(line)
    if (inline) {
      out.push({ name: flatten(inline[1] ?? ''), text: inline[2] ?? '' })
      continue
    }
    const label = RULE_LABEL_PATTERNS.find(pattern => pattern.test(line))
    if (label) {
      out.push({ name: currentName, text: line.replace(label, '') })
      continue
    }
    out.push({ name: currentName, text: line })
  }
  return out
}

/**
 * 从世界观正文抽取可注入的规则条目。
 *
 * @param text 世界观原文（`project_core.worldbuilding`）。空 / 未识别到维度 ⇒ `[]`。
 */
export function extractWorldBuildingRules(text: string | null | undefined): WorldBuildingRule[] {
  const sections = locateWorldBuildingSections(text)
  if (sections.length === 0) return []

  const byDimension = new Map<RuleDimension, WorldBuildingRule[]>()
  const seen = new Set<string>()
  for (const section of sections) {
    // 判据 DP：第 3 维是远期反转本身，整维跳过。
    if (section.dimension === 3) continue
    const dimension = section.dimension as RuleDimension
    const rules: WorldBuildingRule[] = []
    if (dimension === 4) {
      // 第 4 维复用现成的三形态解析（含表格与机读块附近的结构），不另写一份。
      for (const entry of extractSpaceConstraintsFromSection(section.body)) {
        const rule = truncate(entry.rule)
        if (rule) rules.push({ dimension, name: entry.name, rule })
      }
    } else {
      for (const candidate of candidatesOf(section.body)) {
        if (!isRuleSentence(candidate.text)) continue
        const rule = truncate(candidate.text)
        if (!rule) continue
        rules.push({ dimension, name: candidate.name, rule })
      }
    }
    const deduped: WorldBuildingRule[] = []
    for (const rule of rules) {
      const key = rule.rule.replace(/\s+/gu, '')
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(rule)
      if (deduped.length >= WORLD_RULES_PER_DIMENSION_MAX) break
    }
    if (deduped.length > 0) byDimension.set(dimension, deduped)
  }

  // 轮转分配（2026-10-24 修）：第 k 轮每维各取第 k 条，按 DIMENSION_PRIORITY 推进。
  // 旧实现是「一维取满再换下一维」⇒ 前三维总量一旦够 8 条，第 5 维永远是 0 条
  // （第 1 维 3 + 第 2 维 3 + 第 4 维 2 = 8，与样本无关，是算术必然）。
  // 三条边界：
  // 1. 某维为空只跳过该维，不影响其它维的轮次推进 —— 其余维照常逐轮补齐，不塌方；
  // 2. 各维都被 PER_DIMENSION_MAX 截断后仍不满 8 ⇒ 原样返回，**不补空、不重复**
  //    （`< 8` 是合法结果；旧实现在「只有两维有内容」时同样只返回 6 条）；
  // 3. 同维内部保持原文行序，跨维按轮次交错。
  const pools = DIMENSION_PRIORITY.map(dimension => byDimension.get(dimension) ?? [])
  const deepest = pools.reduce((max, pool) => Math.max(max, pool.length), 0)
  const ordered: WorldBuildingRule[] = []
  for (let round = 0; round < deepest; round += 1) {
    for (const pool of pools) {
      if (ordered.length >= WORLD_RULES_MAX_ITEMS) return ordered
      const rule = pool[round]
      if (rule) ordered.push(rule)
    }
  }
  return ordered
}

/** 一条规则的行式渲染：出处只标维度（第 4 维额外带空间名），绝不出现章号。 */
export function renderWorldRuleLine(rule: WorldBuildingRule, writingLanguage: WritingLanguage): string {
  const label = dimensionLabel(rule.dimension, writingLanguage)
  const name = rule.name.trim()
  return writingLanguage === 'en-US'
    ? `- (Worldbuilding · ${label}${name ? ` · ${name}` : ''}) ${rule.rule}`
    : `- （世界观·${label}${name ? `· ${name}` : ''}）${rule.rule}`
}

/**
 * 渲染【本书规则】整节；空数组返回空串（**不要**产出只有标题的空节）。
 *
 * @param maxChars 正文行总字数上限；预算外整条丢弃，不截半句。
 */
export function renderWorldRulesSection(
  rules: readonly WorldBuildingRule[],
  writingLanguage: WritingLanguage,
  maxChars: number = WORLD_RULES_MAX_CHARS,
): string {
  const lines: string[] = []
  let used = 0
  for (const rule of rules.slice(0, WORLD_RULES_MAX_ITEMS)) {
    const line = renderWorldRuleLine(rule, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const isEn = writingLanguage === 'en-US'
  const heading = isEn
    ? '[World rules (verbatim excerpts from the world-building; not exhaustive)]'
    : '【本书规则（世界观原文摘录，不保证穷尽）】'
  const lead = isEn
    ? 'Excerpted from this book\u2019s world-building for consultation before writing. Sources are labelled by dimension only, never by chapter. If an excerpt conflicts with the full world-building text, the full text prevails.'
    : '以下条目摘自本书世界观原文，供本章落笔前查阅；出处只标维度、不标章号。与世界观原文冲突时以原文为准。'
  return `${heading}\n${lead}\n${lines.join('\n')}`
}
