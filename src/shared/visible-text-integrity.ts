import { localize } from '../i18n/core'
import type { Locale } from '../i18n/types'
import type { WritingLanguage } from './writing-language'

export const ZH_CN_TRUNCATION_MARKER = '\n…[内容已按上下文预算截断]…\n'
export const EN_US_TRUNCATION_MARKER = '\n…[content truncated to fit the context budget]…\n'
const MAX_META_OPENING_VISIBLE_UNITS = 200
const MIN_OBVIOUS_DUPLICATE_PARAGRAPH_VISIBLE_UNITS = 120

export function visibleProseUnitCount(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0
}

function mechanicalCompletionError(uiLocale: Locale, zhCNReason: string, enUSReason: string): Error {
  return new Error(localize(
    uiLocale,
    `AI 输出包含${zhCNReason}，可能仍不完整，结果未被保存。`,
    `AI output contains ${enUSReason} and may still be incomplete, so it was not saved.`,
  ))
}

/**
 * The single mechanical-integrity gate for AI-produced visible prose. A `stop`
 * finish reason does not prove the text passed it, so every path that accepts
 * such text (first execution, recovery resume, main-process commit) shares it.
 */
export function assertMechanicallyCompleteVisibleText(content: string, uiLocale: Locale, source = ''): void {
  const trimmed = content.trim()
  if (visibleProseUnitCount(trimmed) === 0) {
    throw mechanicalCompletionError(uiLocale, '空白或无可见正文', 'blank or no visible prose')
  }
  if (/(?:^|\n)\s*```/u.test(trimmed)) {
    throw mechanicalCompletionError(uiLocale, '代码围栏', 'a code fence')
  }
  if (/<\/?\s*think(?:\s|>|$)/iu.test(trimmed)) {
    throw mechanicalCompletionError(uiLocale, 'think 标签残片', 'a leftover think tag')
  }

  const paragraphs = trimmed
    .split(/\n\s*\n+/u)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
  const opening = trimmed.split(/\r?\n/u).map(line => line.trim()).find(Boolean) ?? ''
  if (
    visibleProseUnitCount(opening) <= MAX_META_OPENING_VISIBLE_UNITS
    && (
      /^(?:以下|下面)(?:是|为)(?:(?:根据|按照)(?:您|用户)(?:的)?(?:要求|指示))?(?:(?:修订|修改|重写|生成|完成|提供)(?:后)?的?)?(?:完整的?)?(?:正文|章节(?:正文)?|内容)\s*(?:[：:]|[。.!！]?$)/u.test(opening)
      || /^(?:(?:certainly|as\s+requested)[,!:]?\s+)?(?:here|below)\s+is\s+(?:(?:the|your)\s+)?(?:(?:revised|rewritten|generated|complete|full|updated|requested)\s+)*(?:text|chapter|content|revision|version|draft|prose)\s*(?:[:：]|[.!]?$)/iu.test(opening)
      || /^(?:(?:根据|按照)(?:您|用户).{0,40}(?:要求|指示)|这是(?:我为您|根据您的要求)).{0,30}(?:修订|修改|重写|生成|提供).{0,10}(?:正文|章节|内容)[。！：:]?$/u.test(opening)
      || /^(?:(?:as\s+requested|certainly)[,!:]?\s+)?i(?:'ve|\s+have|\s+will)\s+(?:revised|rewritten|generated|provide|write|revise)\s+(?:(?:the|your|this|complete|full|revised)\s+)*(?:text|chapter|content|revision|version|draft|prose)[.!:：]?$/iu.test(opening)
    )
  ) {
    throw mechanicalCompletionError(uiLocale, '首段元话术', 'opening meta commentary')
  }

  if (
    trimmed.includes(ZH_CN_TRUNCATION_MARKER.trim())
    || trimmed.includes(EN_US_TRUNCATION_MARKER.trim())
    || paragraphs.some(paragraph => /^(?:…\s*)?(?:\[(?:内容已按上下文预算截断|内容截断|输出被截断|content truncated to fit the context budget|truncated)\]|[（(]?(?:未完待续|未完)[）)]?)(?:\s*…)?$/iu.test(paragraph))
  ) {
    throw mechanicalCompletionError(uiLocale, '截断标记', 'a truncation marker')
  }

  const groups = [(text: string) => text.split(/\n\s*\n+/u), (text: string) => text.split(/\r?\n/u)]
  for (const split of groups) {
    const sourceCounts = new Map<string, number>()
    for (const paragraph of split(source)) {
      const normalized = paragraph.replace(/\s+/gu, ' ').trim()
      sourceCounts.set(normalized, (sourceCounts.get(normalized) ?? 0) + 1)
    }
    const seenParagraphs = new Map<string, number>()
    const candidates = split(trimmed)
    for (const paragraph of candidates) {
      const normalized = paragraph.replace(/\s+/gu, ' ').trim()
      if (visibleProseUnitCount(normalized) < MIN_OBVIOUS_DUPLICATE_PARAGRAPH_VISIBLE_UNITS) continue
      const count = (seenParagraphs.get(normalized) ?? 0) + 1
      if (count > Math.max(1, sourceCounts.get(normalized) ?? 0)) {
        throw mechanicalCompletionError(uiLocale, '明显重复段落', 'an obviously duplicated paragraph')
      }
      seenParagraphs.set(normalized, count)
    }
  }
}

/**
 * 退化检测的类别。
 *
 * `truncated`（截断）不在此列——它由上面的截断标记判据与
 * `finishReason !== 'stop'` / `mergedDelta < 300` 共同承载，再加一条启发式只会误伤。
 */
export type VisibleTextDegeneracyKind = 'verbatim-repeat' | 'placeholder-leak' | 'meta-leak'

export interface VisibleTextDegeneracy {
  kind: VisibleTextDegeneracyKind
  severity: 'blocking' | 'advisory'
  /** 命中原文摘要（≤40 字），用于日志与报错定位。 */
  detail: string
  /** 命中次数：repeat 类是同一句出现的次数，其余是命中条数。 */
  count: number
}

export interface VisibleTextDegeneracyOptions {
  /**
   * 只查这些类别，缺省查全部三类。
   *
   * **短细纲必须传 `['verbatim-repeat', 'placeholder-leak']`**：细纲本来就写「本章 / 蓝图 / 分段预算」，
   * 且 `shortSegmentBudget` 会逐字复制 `keyEvents`，跑 `meta-leak` 必然自相残杀。
   */
  classes?: readonly VisibleTextDegeneracyKind[]
  /** 已有正文：同一句在 source 里出现过的次数先抵扣（修稿 / 续写场景）。 */
  source?: string
  writingLanguage?: WritingLanguage
}

/** 同一句 / 相邻段的最小计量单位数（zh 按汉字，en 按字母数字，见 `visibleProseUnitCount`）。 */
const REPEAT_MIN_SENTENCE_UNITS_ZH = 12
const REPEAT_MIN_SENTENCE_UNITS_EN = 40
const REPEAT_MIN_COUNT = 3
const ADJACENT_MIN_PARAGRAPH_UNITS_ZH = 8
const ADJACENT_MIN_PARAGRAPH_UNITS_EN = 32
const META_DETAIL_MAX_CHARS = 40
/** 行首多少个字符内出现「本章 / 下一章」才算工程词泄漏。 */
const META_CHAPTER_HEAD_CHARS = 6
const META_CHAPTER_LINE_MAX_UNITS = 40

/** 只属于写作工序的词汇：小说正文里不应当出现。出现即 blocking。 */
const META_BLUEPRINT_VOCABULARY = /细纲|情节点|本章蓝图|任务描述|chapter\s+outline|plot\s+beat|task\s+description/iu

/** 「本章 / 下一章」单独出现太常见，只有「行首 + 短行 + 无句末标点」这种提纲式行才降级提示。 */
const META_CHAPTER_HEAD = /(?:本章|下一章)/u

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^\s*(?:作为(?:一个)?\s*AI|我是(?:AI|一个人工智能)|我无法继续)/iu,
  /(?:抱歉|对不起)[，,][^。！？!?\n]{0,20}(?:无法|不能)/u,
  /(?:此处|以下|这里)\s*省略|略去\s*\d+\s*字/u,
  /\uFFFD/u,
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u,
]

const DEGENERACY_REASON: Record<VisibleTextDegeneracyKind, { zh: string; en: string }> = {
  'verbatim-repeat': { zh: '复读（同一长句反复出现）', en: 'verbatim repetition of a long sentence' },
  'placeholder-leak': { zh: '占位或拒绝语', en: 'a placeholder or refusal phrase' },
  'meta-leak': { zh: '写作工序词泄漏', en: 'writing-process vocabulary leakage' },
}

function degenerationError(uiLocale: Locale, zhCNReason: string, enUSReason: string): Error {
  return new Error(localize(
    uiLocale,
    `AI 输出出现${zhCNReason}，属模型退化而非文风问题，结果未被保存。请重新生成本章，不要改写这一句。`,
    `AI output shows ${enUSReason}, which is model degeneration rather than a style problem, so it was not saved. Regenerate the chapter instead of rewriting that sentence.`,
  ))
}

/**
 * 句级切分：**只按句末标点与换行切，不做 n-gram 滑窗**。
 *
 * 滑窗会把 `'正文'.repeat(2500)` 这类结构化夹具整片判成复读；按句切则它们只是一句话出现一次。
 */
function splitProseSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?…])|\r?\n+/u)
    .map(sentence => sentence.replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
}

function splitProseParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/u)
    .map(paragraph => paragraph.replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
}

function countPieces(text: string, split: (value: string) => string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const piece of split(text)) counts.set(piece, (counts.get(piece) ?? 0) + 1)
  return counts
}

function findVerbatimRepeats(trimmed: string, source: string, language: WritingLanguage): VisibleTextDegeneracy[] {
  const isEnglish = language === 'en-US'
  const minSentenceUnits = isEnglish ? REPEAT_MIN_SENTENCE_UNITS_EN : REPEAT_MIN_SENTENCE_UNITS_ZH
  const minParagraphUnits = isEnglish ? ADJACENT_MIN_PARAGRAPH_UNITS_EN : ADJACENT_MIN_PARAGRAPH_UNITS_ZH
  const findings: VisibleTextDegeneracy[] = []

  const sentenceSource = countPieces(source, splitProseSentences)
  for (const [sentence, count] of countPieces(trimmed, splitProseSentences)) {
    if (count < REPEAT_MIN_COUNT) continue
    if (visibleProseUnitCount(sentence) < minSentenceUnits) continue
    const allowed = Math.max(1, sentenceSource.get(sentence) ?? 0)
    if (count <= allowed) continue
    findings.push({
      kind: 'verbatim-repeat',
      severity: 'blocking',
      detail: sentence.slice(0, META_DETAIL_MAX_CHARS),
      count,
    })
  }

  const paragraphSource = countPieces(source, splitProseParagraphs)
  const paragraphs = splitProseParagraphs(trimmed)
  for (let index = 1; index < paragraphs.length; index += 1) {
    const current = paragraphs[index]
    if (current !== paragraphs[index - 1]) continue
    if (visibleProseUnitCount(current) < minParagraphUnits) continue
    if (Math.max(1, paragraphSource.get(current) ?? 0) > 1) continue
    findings.push({
      kind: 'verbatim-repeat',
      severity: 'blocking',
      detail: current.slice(0, META_DETAIL_MAX_CHARS),
      count: 2,
    })
    while (index + 1 < paragraphs.length && paragraphs[index + 1] === current) index += 1
  }

  return findings
}

function findPlaceholderLeaks(trimmed: string): VisibleTextDegeneracy[] {
  const findings: VisibleTextDegeneracy[] = []
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = pattern.exec(trimmed)
    if (!match) continue
    const start = Math.max(0, (match.index ?? 0) - 20)
    findings.push({
      kind: 'placeholder-leak',
      severity: 'blocking',
      detail: trimmed.slice(start, start + META_DETAIL_MAX_CHARS),
      count: 1,
    })
  }
  return findings
}

function findMetaLeaks(trimmed: string): VisibleTextDegeneracy[] {
  const findings: VisibleTextDegeneracy[] = []

  const vocabulary = META_BLUEPRINT_VOCABULARY.exec(trimmed)
  if (vocabulary) {
    const start = Math.max(0, (vocabulary.index ?? 0) - 20)
    findings.push({
      kind: 'meta-leak',
      severity: 'blocking',
      detail: trimmed.slice(start, start + META_DETAIL_MAX_CHARS),
      count: 1,
    })
  }

  for (const line of trimmed.split(/\r?\n/u).map(value => value.trim()).filter(Boolean)) {
    if (!META_CHAPTER_HEAD.test(line.slice(0, META_CHAPTER_HEAD_CHARS))) continue
    if (visibleProseUnitCount(line) > META_CHAPTER_LINE_MAX_UNITS) continue
    if (/[。！？!?…]$/u.test(line)) continue
    findings.push({
      kind: 'meta-leak',
      severity: 'advisory',
      detail: line.slice(0, META_DETAIL_MAX_CHARS),
      count: 1,
    })
    break
  }

  return findings
}

/**
 * 找出模型退化痕迹（复读 / 占位拒绝语 / 写作工序词）。
 *
 * 与 `assertMechanicallyCompleteVisibleText` 互补而不重叠：那个查「输出是否完整」，
 * 这个查「输出是不是模型在打转」。误差方向一律选**漏报**——正文链上误杀比漏报贵得多。
 */
export function findVisibleTextDegeneracies(
  text: string,
  options: VisibleTextDegeneracyOptions = {},
): VisibleTextDegeneracy[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const classes = options.classes ?? (['verbatim-repeat', 'placeholder-leak', 'meta-leak'] as const)
  const language = options.writingLanguage ?? 'zh-CN'
  const source = options.source ?? ''

  const findings: VisibleTextDegeneracy[] = []
  if (classes.includes('verbatim-repeat')) findings.push(...findVerbatimRepeats(trimmed, source, language))
  if (classes.includes('placeholder-leak')) findings.push(...findPlaceholderLeaks(trimmed))
  if (classes.includes('meta-leak')) findings.push(...findMetaLeaks(trimmed))
  return findings
}

/**
 * 只对 blocking 类退化抛错；advisory 交调用方记录日志。
 *
 * 文案落点是「重新生成本章，不要改写这一句」——退化是模型故障，改稿改不掉。
 */
export function assertNotDegenerateVisibleText(
  text: string,
  uiLocale: Locale,
  options: VisibleTextDegeneracyOptions = {},
): void {
  const blocking = findVisibleTextDegeneracies(text, options).find(finding => finding.severity === 'blocking')
  if (!blocking) return
  const reason = DEGENERACY_REASON[blocking.kind]
  throw degenerationError(uiLocale, reason.zh, reason.en)
}
