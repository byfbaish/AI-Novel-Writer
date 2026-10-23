/**
 * 世界观五维齐备性检查（§11.7，2026-10-22）。
 *
 * ## 为什么需要它
 *
 * `world_building` 内置模板把世界观拆成五个固定维度（`builtin-prompt-templates.ts:584-589`），
 * 并在第 5 维要求最后单独一行写「起点：<纪年与日期>，<时段名>」（`:628-634`），因为 §11.7
 * 要拿它当日序原点（t0）。但生成结果是模型自由文本：只写前三维、漏掉起点行都很常见，
 * 而写库流程不校验（`architecture.command.ts:2214` 直接整段落库）。漏掉的维度会被下游
 * 弧光 / 大纲 / 蓝图当成「作者没写」而不是「模型没写」，日序更是无从推算。
 *
 * ## 做什么 / 不做什么
 *
 * 只做「按模板固定标题定位五维 + 在第 5 维节内找起点行」这类结构对结构的事：
 * 不解析设定语义、不判断内容好坏、不校验日期是否合法、不改写正文、不拦截生成。
 * 结果只用于**步骤日志里的一句可见提示**（不阻断），写入与返回值保持原样。
 *
 * ## fail-open
 *
 * 输入为空 ⇒ `unreadable=true`，describe 返回 undefined（没内容可判，不提示）。
 * 有内容但一个维度标题都没识别出来 ⇒ `unreadable=true`，describe 只说明
 * 「未能识别五维标题结构，本次未做齐备性检查」，不逐维列缺失（多半是作者改了覆盖版模板）。
 * 识别不了就说识别不了，不猜。
 *
 * 注意 `missing` 在「空文本」与「有内容但识别不出标题」两种情况下语义不同：空文本等于
 * 「没得判」，`missing=[]`（describe 不提示）；有内容但识别不出等于「五维全都无法确认」，
 * `missing=[1,2,3,4,5]`，但 describe 只输出「未能识别」那一句、不逐维列缺失。之所以要区分：
 * 两者在其余字段上完全同形，describe 只能凭 `missing` 是否为空决定提示与否。
 */

/** 五维编号（与内置模板的 1-5 一一对应）。 */
export type WorldBuildingDimension = 1 | 2 | 3 | 4 | 5

/** 五维齐备性检查结果。 */
export interface WorldBuildingCompleteness {
  /** 已识别的维度编号（升序）。 */
  present: number[]
  /** 缺失的维度编号（升序）。 */
  missing: number[]
  /** 第 5 维命中但其节区间内没有「起点：…」行。 */
  missingStoryStart: boolean
  /** 文本为空，或非空但一个维度标题都没识别出来（此时不做齐备性判断）。 */
  unreadable: boolean
}

interface DimensionRule {
  dimension: WorldBuildingDimension
  /** 模板里的中文维度名（用于报错文案）。 */
  zhTitle: string
  /** 内置 en-US 模板里的英文维度名（用于报错文案）。 */
  enTitle: string
  /** 中文标题别名：覆盖模板完整写法与简化写法。 */
  zhAliases: readonly string[]
  /** 英文标题别名（小写；匹配时把标题行也转小写）。 */
  enAliases: readonly string[]
}

/**
 * 五个维度的标题规则。别名按「模板原文子串」匹配，因此：
 * - 完整标题（`核心规则与体系漏洞`）与简化标题（`核心规则`）都能命中；
 * - 英文覆盖模板（`prompt-language.ts:274-356`）的 `Core rules and exploitable asymmetry`
 *   由 `core rules` 命中，`Factions, hierarchy, and scarce resources` 由 `factions` 命中。
 */
const DIMENSIONS: readonly DimensionRule[] = [
  {
    dimension: 1,
    zhTitle: '核心规则与体系漏洞',
    enTitle: 'Core rules and exploitable asymmetry',
    zhAliases: ['核心规则', '体系漏洞'],
    enAliases: ['core rules', 'systemic holes', 'exploitable asymmetry'],
  },
  {
    dimension: 2,
    zhTitle: '阶层断层与资源战场',
    enTitle: 'Factions, hierarchy, and scarce resources',
    zhAliases: ['阶层断层', '资源战场'],
    enAliases: ['factions', 'scarce resources', 'class fault lines', 'resource battlegrounds'],
  },
  {
    dimension: 3,
    zhTitle: '隐喻与深层危机',
    enTitle: 'Hidden history and deep crisis',
    zhAliases: ['隐喻', '深层危机'],
    enAliases: ['hidden history', 'deep crisis', 'metaphor'],
  },
  {
    dimension: 4,
    zhTitle: '空间结构（地图与区域）',
    enTitle: 'Spatial structure (map and regions)',
    zhAliases: ['空间结构', '地图与区域'],
    enAliases: ['spatial structure', 'map and regions'],
  },
  {
    dimension: 5,
    zhTitle: '时间历法（日序与周期）',
    enTitle: 'Calendar (day order and cycles)',
    zhAliases: ['时间历法', '日序与周期'],
    enAliases: ['calendar', 'day order', 'cycles'],
  },
]

const DIMENSION_NUMBERS: readonly WorldBuildingDimension[] = [1, 2, 3, 4, 5]

/** 行首 `#{1,6}` + 空白（不把正文里的 `#` 当标题，也不吃缩进代码块）。 */
const HEADING_LINE = /^#{1,6}[ \t]+(.*)$/u
/** 标题里可选的编号：`1.` / `1、` / `1)`（也容忍 `1 .` 这类写法）。 */
const LEADING_NUMBER = /^\d+\s*[.、)]\s*/u

/**
 * 第 5 维节区间里的起点行：中文 `起点：` / `故事起点：`，英文 `Start:` / `Starting point:` /
 * `Story start date:` 等。中文模板固定写「起点：」，en-US 模板固定写 `Origin:`
 * （`prompt-language.ts:339`），所以英文分支额外接受 `origin`——否则英文项目五维齐全也会误报。
 */
const STORY_START_PATTERNS: readonly RegExp[] = [
  /^\s*(?:[-*+]\s*)?(?:故事)?起点\s*[:：]/u,
  /^\s*(?:[-*+]\s*)?(?:(?:story\s+)?start(?:ing)?\s*(?:point|date)?|(?:story\s+)?origin)\s*[:：]/iu,
]

/** 标题行 → 维度编号；不是五维标题返回 null。 */
function matchDimension(line: string): WorldBuildingDimension | null {
  const heading = HEADING_LINE.exec(line)
  if (!heading) return null
  const title = (heading[1] ?? '').replace(LEADING_NUMBER, '').trim()
  if (!title) return null
  const lower = title.toLowerCase()
  for (const rule of DIMENSIONS) {
    if (rule.zhAliases.some((alias) => title.includes(alias))) return rule.dimension
    if (rule.enAliases.some((alias) => lower.includes(alias))) return rule.dimension
  }
  return null
}

/** 第 5 维标题行之后、下一个标题之前的行里是否出现起点行。 */
function hasStoryStartLine(lines: readonly string[], headingIndex: number): boolean {
  for (let index = headingIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (index > headingIndex && HEADING_LINE.test(line)) break
    if (STORY_START_PATTERNS.some((pattern) => pattern.test(line))) return true
  }
  return false
}

/**
 * 检查世界观正文是否齐备五个维度、第 5 维是否带起点行。
 *
 * 纯函数：不读文件、不写文件、不访问数据库。
 */
export function inspectWorldBuildingCompleteness(text: string): WorldBuildingCompleteness {
  const normalized = text.replace(/\r\n?/gu, '\n')
  if (!normalized.trim()) {
    return { present: [], missing: [], missingStoryStart: false, unreadable: true }
  }

  const lines = normalized.split('\n')
  const present: WorldBuildingDimension[] = []
  let dimension5HeadingLine = -1
  for (let index = 0; index < lines.length; index += 1) {
    const dimension = matchDimension(lines[index] ?? '')
    if (dimension === null) continue
    if (!present.includes(dimension)) present.push(dimension)
    if (dimension === 5 && dimension5HeadingLine < 0) dimension5HeadingLine = index
  }

  if (present.length === 0) {
    // 有内容但识别不出结构：五维全都无法确认。不能返回 missing=[]，否则与空文本同形，
    // describe 就无法既对空文本保持沉默、又对有内容的自由文本提示「未做检查」。
    return {
      present: [],
      missing: [...DIMENSION_NUMBERS],
      missingStoryStart: false,
      unreadable: true,
    }
  }

  present.sort((a, b) => a - b)
  const presentSet = new Set<number>(present)
  return {
    present,
    missing: DIMENSION_NUMBERS.filter((dimension) => !presentSet.has(dimension)),
    missingStoryStart: dimension5HeadingLine >= 0 && !hasStoryStartLine(lines, dimension5HeadingLine),
    unreadable: false,
  }
}

/** 一个维度区段：维度号 + 标题行原文 + 标题之后到下一个标题之前的原始行。 */
export interface WorldBuildingDimensionSection {
  dimension: WorldBuildingDimension
  /** 维度标题行（已 trim，便于日志与调试）。 */
  heading: string
  /** 标题之后、下一个标题之前的原始行（保留空行）。 */
  body: readonly string[]
}

/**
 * 按五维标题把世界观正文切成区段，供各维条目解析器消费（P0-2「写前查阅」）。
 *
 * **为什么放在这里**：五维标题别名表（`DIMENSIONS`）与 `matchDimension` 是全项目唯一的维度定位实现。
 * 此前 `space-constraints.ts` 另写过一份「空间结构」标题正则，`worldbuilding-rules.ts` 若再写一份就是第三份；
 * 两处拼法一旦漂移，同一份世界观在不同链上会被切成不同的节。所以定位统一在这里，各处只做自己那一段的解析。
 *
 * **区段边界**：与 `space-constraints.ts` 的 `ANY_HEADING` 同口径 —— 下一个 markdown 标题**或**
 * 以 `【` 开头的块标记行即结束。这不是随手定的：`withSpaceConstraints` 会往提示词尾部追加
 * `★【空间约束（硬）】` 这类块，取同样的边界才能保证第 4 维在两条链上切出同一段。
 *
 * fail-open：文本为空或一个维度标题都没识别出来 ⇒ 返回 `[]`，不抛、不告警。
 * 同一维度出现多次时只取**第一次**（与齐备性检查的 `present` 语义一致）。
 */
export function locateWorldBuildingSections(text: string | null | undefined): WorldBuildingDimensionSection[] {
  if (!text) return []
  const lines = text.replace(/\r\n?/gu, '\n').split('\n')
  const sections: WorldBuildingDimensionSection[] = []
  const seen = new Set<WorldBuildingDimension>()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const dimension = matchDimension(line)
    if (dimension === null || seen.has(dimension)) continue
    seen.add(dimension)
    const body: string[] = []
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor] ?? ''
      if (HEADING_LINE.test(next) || next.trimStart().startsWith('【')) break
      body.push(next)
    }
    sections.push({ dimension, heading: line.trim(), body })
  }
  return sections
}

/** 报错文案里的维度标签。 */
export function dimensionLabel(dimension: number, language: 'zh-CN' | 'en-US'): string {
  const rule = DIMENSIONS.find((entry) => entry.dimension === dimension)
  if (!rule) return String(dimension)
  return language === 'en-US'
    ? `dimension ${dimension} [${rule.enTitle}]`
    : `第 ${dimension} 维【${rule.zhTitle}】`
}

function joinLabels(labels: readonly string[], language: 'zh-CN' | 'en-US'): string {
  if (language === 'zh-CN') return labels.join('、')
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

/**
 * 把检查结果变成一句可见提示；无需提示时返回 undefined。
 *
 * 文案与 `consistency-preflight.ts:256` 的 `describeSpaceTimeCoverage` 同一原则：
 * 说明「缺什么 / 为什么下游会受影响」，同时明确「本次不影响使用」，不制造阻断感。
 */
export function describeWorldBuildingCompleteness(
  result: WorldBuildingCompleteness,
  language: 'zh-CN' | 'en-US',
): string | undefined {
  if (result.unreadable) {
    // 空文本（missing=[]）没内容可判，保持沉默；有内容但识别不出标题才提示未做检查。
    if (result.missing.length === 0) return undefined
    return language === 'en-US'
      ? 'Could not recognize the five-dimension heading structure, so the completeness check did not run this time.'
      : '未能识别五维标题结构，本次未做齐备性检查。'
  }

  const parts: string[] = []
  if (result.missing.length > 0) {
    const labels = result.missing.map((dimension) => dimensionLabel(dimension, language))
    parts.push(language === 'en-US'
      ? `The world setting was written, but the five dimensions are incomplete: missing ${joinLabels(labels, language)}. Add the missing dimensions and regenerate; this run is not affected.`
      : `世界观已写入，但五个维度不齐备：缺${joinLabels(labels, language)}。补写后再生成即可，本次不影响使用。`)
  }
  if (result.missingStoryStart) {
    parts.push(language === 'en-US'
      ? 'In dimension 5 [Calendar (day order and cycles)] the line "Origin: <date in this world\'s calendar>, <time of day>" was not found, so the day-order origin (t0) cannot be determined.'
      : '第 5 维【时间历法（日序与周期）】里没找到「起点：<纪年与日期>，<时段名>」这一行，日序原点（t0）无法确定。')
  }
  if (parts.length === 0) return undefined
  return parts.join(language === 'en-US' ? ' ' : '')
}
