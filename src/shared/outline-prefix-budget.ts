import type { WritingLanguage } from './writing-language'
import { parseArcStructure, scaledBoundaries, arcWeight, type ParsedArcStructure } from './arc-position'

/**
 * 大纲前缀投影的**只读预估**（E4c，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §3.3 / §5.2 / §10（E4c）。
 *
 * ## 为什么需要它
 *
 * 每个批次都把**整段已完成大纲前缀**塞进 prompt（`architecture.command.ts:2378-2380`），
 * 成本 O(已写章数)。按作者给的两个规模：短篇 160 章 × 300 字 = 4.8 万字；长篇 666 章 = 20 万字。
 * 20 万字 ≈ 133k–200k tokens，**比 128k 上下文还大**。
 *
 * 所以先只读：**算出投影前后各多少字、按当前速度还能写几章**，写进日志。
 * 这一步**不改变任何行为**（与 E1.5 的 `summarizeUnitBudget` 同一策略）——先拿到真实读数，
 * 再决定投影怎么切。
 *
 * ## 投影口径（三层，见设计稿 §5.2）
 *
 * | 层 | 内容 | 体积 |
 * |---|---|---|
 * | L2 本卷已写 | 本卷第 1 章 → 本批前一章，**全文** | 本卷章数 × 每章字数 |
 * | L3 上一卷快照 | 只保上一卷的 `handoff`（§5.4），此处按**估算**计入 | 固定 ≤1,500 字 |
 * | L4 最近 K 章 | 末尾 3 章全文 | 3 × 每章字数 |
 *
 * 本模块**只做估算**，不真的切分文本——切分要等 E4d 拿到实测对比后再做。
 */

/** 投影保留的「最近 K 章」全文。 */
export const OUTLINE_RECENT_CHAPTERS = 3
/** 上一卷交接单的估算体积上限（设计稿 §5.4.1）。 */
export const VOLUME_HANDOFF_CHARS = 1500
/** 中文 token 折算区间：1 token ≈ 1–1.5 字（设计稿 §3 口径）。 */
export const CHARS_PER_TOKEN_MIN = 1
export const CHARS_PER_TOKEN_MAX = 1.5

export interface OutlinePrefixEstimate {
  /** 已写章节数（= 前缀里的章级条目数） */
  writtenChapters: number
  /** 整段前缀的字数（今天的实际形态） */
  fullPrefixChars: number
  /** 投影后的估算字数（L2 + L3 + L4 + 设定层） */
  projectedChars: number
  /** 投影省下的比例（0–1）；整段为 0 时为 0 */
  savedRatio: number
  /** 整段前缀折算的 token 区间（下界 / 上界） */
  fullTokens: readonly [number, number]
  /** 投影后折算的 token 区间（下界 / 上界） */
  projectedTokens: readonly [number, number]
  /** 本批所在卷的卷内已写章数（用于 L2 估算）；定位失败为 null */
  volumeWritten: number | null
}

export interface OutlinePrefixEstimateInput {
  /** 已确认的大纲正文（synopsis_result），不含批次进度行 */
  prefix: string
  /** 每章平均字数；缺省用 fallbackCharsPerChapter */
  charsPerChapter?: number | null
  /** 缺省时按整段前缀 ÷ 章数推算 */
  fallbackCharsPerChapter?: number
  /** 弧光结构文本（用于定位本批所在卷；不可解析时 volumeWritten 为 null） */
  arcPlan?: string | null
  /** 全书章数 */
  totalChapters?: number | null
  /** 本批起始章号（含）；缺省则无法定位卷 */
  from?: number | null
  /** 设定层字数（大纲开头的非章级段落）；缺省按 0 计 */
  settingChars?: number
}

const charCount = (text: string): number => text.replace(/\s+/gu, '').length
const toTokens = (chars: number): [number, number] => [
  Math.ceil(chars / CHARS_PER_TOKEN_MAX),
  Math.ceil(chars / CHARS_PER_TOKEN_MIN),
]

/** 定位某章落在哪个卷、本卷已写多少章（结构不可解析时返回 null）。 */
function locateVolume(
  arcPlan: string | null | undefined,
  totalChapters: number | null | undefined,
  from: number | null | undefined,
): { volumeWritten: number; majorIndex: number } | null {
  if (!arcPlan) return null
  if (!Number.isSafeInteger(totalChapters) || (totalChapters ?? 0) < 1) return null
  if (!Number.isSafeInteger(from) || (from ?? 0) < 1) return null
  const parsed: ParsedArcStructure | null = parseArcStructure(arcPlan)
  if (!parsed || parsed.majors.length === 0) return null
  const bounds = scaledBoundaries(parsed.majors.map(item => arcWeight(item.chapters)), totalChapters!)
  const index = parsed.majors.findIndex((_, i) => from! <= bounds[i + 1]!)
  if (index < 0) return null
  const volumeStart = bounds[index]! + 1
  return { volumeWritten: Math.max(0, from! - volumeStart), majorIndex: index + 1 }
}

/**
 * 估算前缀投影前后的体积。**纯函数，不切分文本、不改任何行为。**
 *
 * 返回 null 表示不适用（前缀为空 / 章数算不出）——调用方据此不打印。
 */
export function estimateOutlinePrefix(input: OutlinePrefixEstimateInput): OutlinePrefixEstimate | null {
  const prefix = input.prefix ?? ''
  const fullPrefixChars = charCount(prefix)
  if (fullPrefixChars <= 0) return null

  const settingChars = Math.max(0, input.settingChars ?? 0)
  const charsPerChapter = typeof input.charsPerChapter === 'number' && Number.isFinite(input.charsPerChapter) && input.charsPerChapter > 0
    ? input.charsPerChapter
    : typeof input.fallbackCharsPerChapter === 'number' && input.fallbackCharsPerChapter > 0 ? input.fallbackCharsPerChapter : null
  if (charsPerChapter === null) return null
  const writtenChapters = Math.max(1, Math.round((fullPrefixChars - settingChars) / charsPerChapter))

  const located = locateVolume(input.arcPlan, input.totalChapters, input.from)
  const volumeWritten = located ? located.volumeWritten : null
  // L2：本卷已写全文；定位失败时保守地只按「最近 K 章」估。
  // ⚠️ L4（最近 K 章）是 L2 的**子集**（它们都在本卷内），不能叠加——
  //    叠加会在卷内只写了 10 章时算出「投影后比整段还大」的荒谬结果。
  const recentChars = OUTLINE_RECENT_CHAPTERS * charsPerChapter
  const l2Chars = volumeWritten === null ? recentChars : Math.max(volumeWritten * charsPerChapter, recentChars)
  // L3：上一卷交接单（估算上限）；**第一卷没有上一卷**，不能凭空加 1,500 字。
  const l3Chars = located && located.majorIndex > 1 ? VOLUME_HANDOFF_CHARS : 0
  const projectedChars = Math.round(settingChars + l2Chars + l3Chars)

  const savedRatio = fullPrefixChars === 0 ? 0 : Math.max(0, 1 - projectedChars / fullPrefixChars)
  return Object.freeze({
    writtenChapters,
    fullPrefixChars,
    projectedChars,
    savedRatio,
    fullTokens: Object.freeze(toTokens(fullPrefixChars)) as readonly [number, number],
    projectedTokens: Object.freeze(toTokens(projectedChars)) as readonly [number, number],
    volumeWritten,
  })
}

export interface OutlinePrefixBudget extends OutlinePrefixEstimate {
  /** 按**整段前缀**算，还能写几章（≤0 表示写不动了）；算不出为 null */
  chaptersLeftFull: number | null
  /** 按**投影后**算，还能写几章；算不出为 null */
  chaptersLeftProjected: number | null
}

/** 在估算基础上，推算「按当前速度还能写几章」（整段 vs 投影后）。 */
export function planOutlinePrefixBudget(input: OutlinePrefixEstimateInput & {
  availableChars?: number | null
}): OutlinePrefixBudget | null {
  const estimate = estimateOutlinePrefix(input)
  if (!estimate) return null
  const perChapter = typeof input.charsPerChapter === 'number' && input.charsPerChapter > 0
    ? input.charsPerChapter
    : typeof input.fallbackCharsPerChapter === 'number' && input.fallbackCharsPerChapter > 0
      ? input.fallbackCharsPerChapter : null
  const available = typeof input.availableChars === 'number' && Number.isFinite(input.availableChars) && input.availableChars > 0
    ? input.availableChars : null
  const left = (used: number): number | null => (perChapter === null || available === null
    ? null
    : Math.floor((available - used) / perChapter))
  return Object.freeze({
    ...estimate,
    chaptersLeftFull: left(estimate.fullPrefixChars),
    chaptersLeftProjected: left(estimate.projectedChars),
  })
}

/** 预算 → 一段可读日志。null 返回 null（调用方直接不打印）。 */
export function renderOutlinePrefixBudget(
  budget: OutlinePrefixBudget | null,
  language: WritingLanguage,
): string | null {
  if (!budget) return null
  const pct = (value: number) => Math.round(value * 100) + '%'
  const left = (value: number | null) => (value === null ? '—' : String(value))
  if (language === 'en-US') {
    return [
      '⚖️ Outline prefix estimate (read-only, not injected):',
      '- written ' + budget.writtenChapters + ' chapters; full prefix ' + budget.fullPrefixChars
        + ' chars (' + budget.fullTokens[0] + '–' + budget.fullTokens[1] + ' tokens)',
      '- projected ' + budget.projectedChars + ' chars (' + budget.projectedTokens[0] + '–' + budget.projectedTokens[1]
        + ' tokens), saves ' + pct(budget.savedRatio),
      '- chapters left at this rate: full prefix ' + left(budget.chaptersLeftFull)
        + ', projected ' + left(budget.chaptersLeftProjected),
    ].join('\n')
  }
  return [
    '⚖️ 大纲前缀预估（只读，不写进提示词）：',
    '- 已写 ' + budget.writtenChapters + ' 章；整段前缀 ' + budget.fullPrefixChars
      + ' 字（' + budget.fullTokens[0] + '–' + budget.fullTokens[1] + ' tokens）',
    '- 投影后 ' + budget.projectedChars + ' 字（' + budget.projectedTokens[0] + '–' + budget.projectedTokens[1]
      + ' tokens），省 ' + pct(budget.savedRatio),
    '- 按当前速度还能写：整段前缀 ' + left(budget.chaptersLeftFull) + ' 章，投影后 '
      + left(budget.chaptersLeftProjected) + ' 章',
  ].join('\n')
}
