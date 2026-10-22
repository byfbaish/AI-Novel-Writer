/**
 * 世界观 B 层自审结果（W6a-2，2026-10-22）。
 *
 * ## 与 A 层（`worldbuilding-numeric-audit.ts`）的分工
 *
 * A 层是纯函数 + 正则，能抓「量纲不成立」这类**算得出来**的硬伤；
 * 抓不到「劳作换取报酬」与「签到即得」并存这类**语义**矛盾 —— 那需要一个模型读一遍。
 * 本文件只负责 B 层结果的**解析、校验、成句**，不发起任何模型调用：
 * 调用在 `architecture.command.ts` 的 `GenerateWorldBuildingCommand` 里，
 * 解析与展示在这里，两边共用同一份契约。
 *
 * ## 为什么「引文必须逐字命中」是唯一防线
 *
 * 生成期自审最坏的失败形态不是漏报，而是**编一条不存在的引文**：作者去正文里搜，
 * 搜不到，于是不再相信这个提示条 —— 后面真正的问题也一起被忽略。
 * 所以：
 * - 模型只能给 `quote`，不给「应该改成什么」（判据 CJ）；
 * - `quote` 必须能在本次世界观原文里逐字命中（`filterSelfReviewFindings`），
 *   命不中的**整条丢弃**，并计入 `dropped`，绝不「差不多就算」；
 * - 模型不许做任何算术（判据 DK 的生成期版本），所以这里没有任何余额/合计字段。
 *
 * ## fail-open
 *
 * 坏 JSON / 形状不认识 / `quote` 为空 ⇒ `{ findings: [], unreadable: true }`，不抛错。
 * `unreadable` 与「0 个问题」是两件事：前者说「这次没审成」，后者说「审了，没问题」。
 * 调用方展示时**不得**把前者说成后者。
 */

/** 自审条目的严重度。`conflict` = 两处设定不能同时成立。 */
export type WorldBuildingSelfReviewSeverity = 'conflict' | 'undecidable' | 'suggestion'

/** 自审条目归属的类别；与世界观五个维度大致对应，`other` 兜底。 */
export type WorldBuildingSelfReviewCategory = 'resource' | 'time' | 'space' | 'logic' | 'other'

export interface WorldBuildingSelfReviewFinding {
  severity: WorldBuildingSelfReviewSeverity
  category: WorldBuildingSelfReviewCategory
  /** 世界观原文里的逐字片段（未截断，展示时才裁）。 */
  quote: string
  /** 一句话说明。 */
  why: string
}

export interface WorldBuildingSelfReview {
  findings: WorldBuildingSelfReviewFinding[]
  /** 模型没给出可用结果（调用失败 / 坏 JSON / 形状不认识）。**不等于「没问题」**。 */
  unreadable: boolean
}

/** 一条引文最多展示多少字（够定位，不至于把整段塞进提示条）。 */
export const MAX_SELF_REVIEW_QUOTE = 120

/** 提示条/日志最多展开多少条（其余折叠成「另有 N 条」）。 */
export const MAX_SELF_REVIEW_ITEMS = 6

const SEVERITIES: readonly WorldBuildingSelfReviewSeverity[] = ['conflict', 'undecidable', 'suggestion']
const CATEGORIES: readonly WorldBuildingSelfReviewCategory[] = ['resource', 'time', 'space', 'logic', 'other']

type Language = 'zh-CN' | 'en-US'

function isSeverity(value: unknown): value is WorldBuildingSelfReviewSeverity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value)
}

function isCategory(value: unknown): value is WorldBuildingSelfReviewCategory {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

/**
 * 只剥掉「整段就是一个代码围栏」这一种包装。
 *
 * 模型偶尔无视 `json_object` 而套一层 ```json。这不算「坏 JSON」，
 * 因为它不是内容错误；除此之外一律按严格 JSON 解析，不做去尾逗号、单引号之类的猜测。
 */
function stripOuterFence(text: string): string {
  const fenced = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/u.exec(text)
  return fenced?.[1]?.trim() ?? text
}

/**
 * 严格解析模型自审结果。
 *
 * 任何一条不合形状（severity/category 不认识、`quote` 或 `why` 为空）都判整份不可读：
 * 宁可说「本次自审未完成」，也不要把半份结果当成全份展示。
 *
 * 纯函数：零 IO、不抛错。
 */
export function parseWorldBuildingSelfReview(raw: string): WorldBuildingSelfReview {
  const unreadable: WorldBuildingSelfReview = { findings: [], unreadable: true }
  if (typeof raw !== 'string' || !raw.trim()) return unreadable

  let parsed: unknown
  try {
    parsed = JSON.parse(stripOuterFence(raw.trim()))
  } catch {
    return unreadable
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return unreadable

  const envelope = parsed as { findings?: unknown; unreadable?: unknown }
  if (!Array.isArray(envelope.findings)) return unreadable

  const findings: WorldBuildingSelfReviewFinding[] = []
  for (const item of envelope.findings) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return unreadable
    const record = item as Record<string, unknown>
    if (!isSeverity(record.severity) || !isCategory(record.category)) return unreadable
    const quote = typeof record.quote === 'string' ? record.quote.trim() : ''
    const why = typeof record.why === 'string' ? record.why.trim() : ''
    if (!quote || !why) return unreadable
    findings.push({ severity: record.severity, category: record.category, quote, why })
  }

  // `unreadable: true` 认自己写进 partial 的信封（`{findings: [], unreadable: true}` 原样读回）。
  return { findings, unreadable: envelope.unreadable === true }
}

/** 抹掉空白后比对：跨行引文（模型把一句话拆成两行）仍算逐字命中，但字序一字不改。 */
function compact(value: string): string {
  return value.replace(/\s+/gu, '')
}

/**
 * 这条引文是否逐字出现在世界观原文里。
 *
 * 先按原样找，再按「抹掉空白」找 —— 后者只容忍换行/空格差异，
 * 不改字、不改正误、不做近似匹配。
 */
export function isQuotePresent(quote: string, worldbuilding: string): boolean {
  const needle = quote.trim()
  if (!needle) return false
  if (worldbuilding.includes(needle)) return true
  const compactNeedle = compact(needle)
  return compactNeedle.length > 0 && compact(worldbuilding).includes(compactNeedle)
}

/**
 * 丢掉引文在世界观原文里找不到的条目（防模型编引文），并按 `severity:quote` 去重。
 *
 * 这是「自审结果能不能被采信」的唯一闸门：调用方在落 `partial` 之前必须过一遍。
 */
export function filterSelfReviewFindings(
  review: WorldBuildingSelfReview,
  worldbuilding: string,
): WorldBuildingSelfReview {
  if (review.findings.length === 0) return review
  const seen = new Set<string>()
  const findings = review.findings.filter((finding) => {
    const key = `${finding.severity}:${finding.quote}`
    if (seen.has(key)) return false
    seen.add(key)
    return isQuotePresent(finding.quote, worldbuilding)
  })
  return { findings, unreadable: review.unreadable }
}

/** 引文过长时截断并加省略号（只用于展示，存储保持逐字原文以便复核）。 */
export function clipSelfReviewQuote(quote: string): string {
  const compacted = quote.replace(/\s+/gu, ' ').trim()
  return compacted.length <= MAX_SELF_REVIEW_QUOTE
    ? compacted
    : `${compacted.slice(0, MAX_SELF_REVIEW_QUOTE)}…`
}

/** 展示顺序：冲突在前，其次不可判定，最后建议。 */
const SEVERITY_ORDER: Record<WorldBuildingSelfReviewSeverity, number> = {
  conflict: 0,
  undecidable: 1,
  suggestion: 2,
}

function severityLabel(severity: WorldBuildingSelfReviewSeverity, language: Language): string {
  if (language === 'en-US') {
    return severity === 'conflict' ? 'conflict' : severity === 'undecidable' ? 'undecidable' : 'suggestion'
  }
  return severity === 'conflict' ? '矛盾' : severity === 'undecidable' ? '无法判定' : '可补充'
}

/**
 * 把自审结果变成一句可读提示；没有条目时返回 undefined（不制造噪声）。
 *
 * `unreadable` 时**必须**说「本次自审未完成」，不能说成「0 个问题」——
 * 两者对作者的含义完全相反：一个是「没查」，一个是「查了没问题」。
 */
export function describeWorldBuildingSelfReview(
  review: WorldBuildingSelfReview,
  language: Language,
): string | undefined {
  if (review.unreadable) {
    return language === 'en-US'
      ? 'Worldbuilding self-review did not complete this run; the generated worldbuilding is unaffected.'
      : '世界观自审未完成：本次没有拿到可用的自审结果（已完成的世界观不受影响）。'
  }
  if (review.findings.length === 0) return undefined

  const ordered = [...review.findings].sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
  ))
  const visible = ordered.slice(0, MAX_SELF_REVIEW_ITEMS)
  const head = language === 'en-US'
    ? `Worldbuilding self-review: ${review.findings.length} item(s) worth confirming (this run is not blocked).`
    : `世界观自审：有 ${review.findings.length} 处设定需要确认（本次不影响使用）。`
  const items = visible.map((finding) => (language === 'en-US'
    ? `"${clipSelfReviewQuote(finding.quote)}" — ${finding.why} (${severityLabel(finding.severity, language)})`
    : `「${clipSelfReviewQuote(finding.quote)}」— ${finding.why}（${severityLabel(finding.severity, language)}）`))
  const rest = review.findings.length - visible.length
  const tail = rest > 0
    ? (language === 'en-US' ? ` ${rest} more not listed.` : `另有 ${rest} 条未展开。`)
    : ''
  return `${head} ${items.join(language === 'en-US' ? ' ' : '')}${tail}`
}
