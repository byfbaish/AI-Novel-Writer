import type { Locale } from '../i18n/types'
import {
  chapterGoalReviewItems,
  locateGoalEvidence,
  normalizeChapterGoalReview,
  type FrozenChapterGoals,
} from './chapter-goal-review'
import {
  mergeConsistencyFindingsIntoReview,
  type ConsistencyFinding,
  type ReviewLike,
} from './consistency-preflight'
import { CHARACTER_STATE_TEXT_FIELDS, type CharacterStateTextField } from './character-roster'
import type { WritingLanguage } from './writing-language'
import { extractSingleCompleteJsonObject } from './character-proposal-parser'
import { stripDraftThinkingTags } from './draft-visible-text'

const REVIEW_SUMMARY_MAX_CHARACTERS = 120
const REVIEW_DESCRIPTION_MAX_CHARACTERS = 200
const REVIEW_QUOTE_MAX_CHARACTERS = 160
export type ReviewReportVersion = 1 | 2 | 3

interface ReviewResultItem extends Record<string, unknown> {
  category: string
  severity: 'error' | 'warning' | 'pass'
  description: string
  quote?: string
}

interface ReviewResult extends Record<string, unknown> {
  summary: string
  items: ReviewResultItem[]
  goalReviews?: unknown
  stateDelta?: unknown
}

/**
 * 状态差分：**一条观测，不是一个判断**（W3）。
 *
 * 审稿是全文外唯一能同时读到「正文实际写了什么」和「档案里记的是什么」的环节，所以由它
 * 记下差异。但它**不裁决谁对** —— 裁决需要权威值与时效性，那两样在定稿期才有：
 * 审稿发生在定稿之前，此刻既没有 `finalizationId` 也没有不可变正文哈希，差分落不进
 * `finalized_continuity_facts`（那条链路要求 `FinalizedSourceIdentity` 精确定位）。
 * 硬塞进去只能造假锚点，而假锚点会被下游当成证据。
 *
 * 三条边界：
 * 1. 只记**正文明确写出的值**，不记推测、不记「应该会」；`observed` 不得抄档案值。
 * 2. `field` 必须是 `CHARACTER_STATE_TEXT_FIELDS` 之一 —— 与 `cs_*` 一一对应，否则
 *    定稿期无处回写，差分就成了死数据。
 * 3. `quote` 必须在待审正文里**能唯一定位**；定位不了的那条直接丢弃（见
 *    `buildReviewGenerationReport`），因为一个可疑锚点比没有锚点更危险。
 */
export interface ReviewStateDeltaItem {
  /** 正文里出现的人物名，原样照抄。对齐 characterId 是定稿期的事，这里不猜。 */
  characterName: string
  /** 受影响的状态字段，必须落在 `CHARACTER_STATE_TEXT_FIELDS` 内。 */
  field: CharacterStateTextField
  /** 正文实际写出的值（简短）。**不得抄档案值** —— 抄了就变成「正文与档案一致」的假信号。 */
  observed: string
  /** 支撑原文，必须在待审正文里能唯一定位。 */
  quote: string
}

const STATE_DELTA_MAX_ITEMS = 12
const STATE_DELTA_NAME_MAX_CHARACTERS = 40
const STATE_DELTA_OBSERVED_MAX_CHARACTERS = 200
const STATE_DELTA_QUOTE_MAX_CHARACTERS = 400

function isStateDeltaItem(value: unknown): value is ReviewStateDeltaItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  if (Object.keys(item).some(key => !['characterName', 'field', 'observed', 'quote'].includes(key))) return false
  // 超长一律判无效，**不静默截断**：`quote` 被截断就定位不到，`observed` 被截断就
  // 与档案值比对失真 —— 两种截断都会把「模型写多了」变成「数据看起来是对的」。
  return isNonemptyText(item.characterName)
    && item.characterName.trim().length <= STATE_DELTA_NAME_MAX_CHARACTERS
    && isNonemptyText(item.field)
    && (CHARACTER_STATE_TEXT_FIELDS as readonly string[]).includes(item.field)
    && isNonemptyText(item.observed)
    && item.observed.trim().length <= STATE_DELTA_OBSERVED_MAX_CHARACTERS
    && isNonemptyText(item.quote)
    && item.quote.trim().length <= STATE_DELTA_QUOTE_MAX_CHARACTERS
}

export function isStateDelta(value: unknown): value is ReviewStateDeltaItem[] {
  if (!Array.isArray(value) || value.length > STATE_DELTA_MAX_ITEMS) return false
  if (!value.every(isStateDeltaItem)) return false
  const names = value.map(item => `${item.characterName}\u0000${item.field}`)
  // 同一人物同一字段只留一条：两条同字段观测必然互相矛盾（或重复），
  // 而报告体是 append-only 的事实记录，不允许它自带矛盾。
  return new Set(names).size === names.length
}

function isNonemptyText(value: unknown): value is string {
  return typeof value === 'string'
    && Boolean(value.trim())
}

function reportText(value: string, maxCharacters: number, version: ReviewReportVersion): string {
  // V1 is retained only to prove already-saved reports against their original bytes.
  return version === 1 ? Array.from(value.trim()).slice(0, maxCharacters).join('') : value.trim()
}

/**
 * 顶层键白名单按**报告版本**分档。
 *
 * 版本号在这里不是为了好看：读侧靠它决定「这份 body 可能长什么样」。把 `stateDelta`
 * 直接塞进 v2 的白名单，就等于让 v2 同时表示两种形状 —— 而 `saved()` / 便携投影都
 * 会用版本号重算正文再比哈希，歧义一旦进来，重算就成了掷骰子。
 */
const REVIEW_TOP_LEVEL_KEYS: Record<ReviewReportVersion, readonly string[]> = {
  1: ['summary', 'items', 'goalReviews'],
  2: ['summary', 'items', 'goalReviews'],
  3: ['summary', 'items', 'goalReviews', 'stateDelta'],
}

function isReviewShape(value: unknown, version: ReviewReportVersion): value is ReviewResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const review = value as Record<string, unknown>
  const allowed = REVIEW_TOP_LEVEL_KEYS[version]
  if (Object.keys(review).some(key => !allowed.includes(key))
    || typeof review.summary !== 'string'
    || !Array.isArray(review.items)
    || review.items.length < 1
    || review.items.length > 10) return false
  // `stateDelta` 缺失 = 本次未产出；`stateDelta: []` = 判过了、无差异。
  // 两者在 JSON 层天然可分，不需要额外的 status 字段（见判据 CZ）。
  if (review.stateDelta !== undefined && (version !== 3 || !isStateDelta(review.stateDelta))) return false
  return review.items.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const record = item as Record<string, unknown>
    const severity = record.severity
    return !Object.keys(record).some(key => (
      key !== 'category'
      && key !== 'severity'
      && key !== 'description'
      && key !== 'quote'
    ))
      && typeof record.category === 'string'
      && (severity === 'error' || severity === 'warning' || severity === 'pass')
      && typeof record.description === 'string'
      && (record.quote === undefined
        ? severity === 'pass'
        : typeof record.quote === 'string')
  })
}

function isReviewResult(value: unknown, version: ReviewReportVersion): value is ReviewResult {
  return isReviewShape(value, version)
    && isNonemptyText(value.summary)
    && value.items.every(item => (
      Boolean(item.category.trim())
      && isNonemptyText(item.description)
      && (item.quote === undefined || isNonemptyText(item.quote))
    ))
}

/** Accept one complete visible report with optional prose/fences; retain the model shape gate. */
export function parseReviewGenerationResult(content: string, reportVersion: ReviewReportVersion = 2): ReviewResult {
  if (!REVIEW_TOP_LEVEL_KEYS[reportVersion]) throw new Error('invalid review contract')
  const trimmed = stripDraftThinkingTags(content)
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(trimmed)
  let parsed: unknown
  try {
    parsed = JSON.parse(fenced?.[1]?.trim() ?? trimmed)
  } catch {
    parsed = JSON.parse(extractSingleCompleteJsonObject(trimmed, true))
  }
  if (!isReviewShape(parsed, reportVersion)) throw new Error('invalid review contract')
  const bounded: ReviewResult = {
    ...(parsed.goalReviews === undefined ? {} : { goalReviews: parsed.goalReviews }),
    summary: reportText(parsed.summary, REVIEW_SUMMARY_MAX_CHARACTERS, reportVersion),
    items: parsed.items.map(item => ({
      category: item.category,
      severity: item.severity,
      description: reportText(item.description, REVIEW_DESCRIPTION_MAX_CHARACTERS, reportVersion),
      ...(item.quote === undefined || (item.severity === 'pass' && !item.quote.trim())
        ? {}
        : { quote: reportText(item.quote, REVIEW_QUOTE_MAX_CHARACTERS, reportVersion) }),
    })),
    // 只在 v3 透传。v1/v2 走到这里时 `stateDelta` 必然 undefined（形状门已拒收）。
    ...(reportVersion !== 3 || parsed.stateDelta === undefined ? {} : {
      stateDelta: (parsed.stateDelta as ReviewStateDeltaItem[]).map(item => ({
        characterName: item.characterName.trim(),
        field: item.field,
        observed: item.observed.trim(),
        quote: item.quote.trim(),
      })),
    }),
  }
  if (!isReviewResult(bounded, reportVersion)) throw new Error('invalid review contract')
  return bounded
}

/**
 * 只留下锚点成立的差分条目，并把 `quote` 归一成**正文的精确切片**。
 *
 * 判据 CZ：定位不到、或能定位到两处的 quote 不是弱证据，而是**错证据** —— 定稿期若拿它
 * 回写，会把 A 段的行为记到 B 段头上。所以丢弃，不降级保留。
 *
 * 但丢弃必须计数：`diagnostics` 是调用方传进来的出参，用来把「本次丢了几条」带到回执/日志里。
 * 不计数就等于「模型引文质量变差」这件事永远不可见（判据 CL 的老坑）。
 */
function retainLocatableStateDelta(
  items: readonly ReviewStateDeltaItem[],
  sourceContent: string,
  diagnostics?: { stateDeltaDropped: number },
): ReviewStateDeltaItem[] {
  const kept: ReviewStateDeltaItem[] = []
  for (const item of items) {
    // requireUnique：差分的 span 会被拿去回写字段，锚点必须唯一。
    const located = locateGoalEvidence(item.quote, sourceContent, { requireUnique: true })
    if (!located) continue
    kept.push({ ...item, quote: located.quote })
  }
  if (diagnostics) diagnostics.stateDeltaDropped = items.length - kept.length
  return kept
}

/** Assemble the saved report using only the caller's frozen source and preflight evidence. */
export function buildReviewGenerationReport(input: {
  content: string
  sourceContent: string
  frozenGoals: FrozenChapterGoals
  writingLanguage: WritingLanguage
  uiLocale: Locale
  preflightFindings: readonly ConsistencyFinding[]
  reportVersion?: ReviewReportVersion
  /** 出参：本次被丢弃的差分条数（引文定位不成立）。用于回执与诊断，不进报告体。 */
  diagnostics?: { stateDeltaDropped: number }
}): ReviewLike & { items: Array<Record<string, unknown>> } {
  const parsedResult: ReviewLike = parseReviewGenerationResult(input.content, input.reportVersion)
  const goalReview = normalizeChapterGoalReview(
    parsedResult.goalReviews,
    input.frozenGoals,
    input.sourceContent,
    input.writingLanguage,
  )
  delete parsedResult.goalReviews
  parsedResult.goalReview = goalReview
  if (Array.isArray(parsedResult.stateDelta)) {
    parsedResult.stateDelta = retainLocatableStateDelta(
      parsedResult.stateDelta as ReviewStateDeltaItem[], input.sourceContent, input.diagnostics)
  }
  parsedResult.items = [...(parsedResult.items ?? []), ...chapterGoalReviewItems(goalReview, input.writingLanguage)]
  if (parsedResult.items.some(item => item.severity === 'unknown')) {
    parsedResult.summary = input.uiLocale === 'en-US'
      ? 'The review contains unresolved items and is not an overall pass.'
      : '审稿包含待核实项目，不能视为全部通过。'
  } else if (goalReview.items.some(item => item.status === 'unmet')) {
    parsedResult.summary = input.uiLocale === 'en-US'
      ? 'Some chapter goals are unmet; check their evidence.'
      : '本章存在尚未完成的目标，请核对逐项证据。'
  }
  return mergeConsistencyFindingsIntoReview(parsedResult, input.preflightFindings, input.uiLocale)
}
