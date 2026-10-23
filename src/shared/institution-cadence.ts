/**
 * 制度（周期事件：月例 / 签到 / 送账）—— P1-1 连续性宿体第二格（2026-10-23）。
 *
 * ## 它回答什么问题
 *
 * 「这一章该不该发生那件周期性的事」—— 月例发没发、七日一次的送账日到没到。
 * 正文里最常见的崩法是：上一章刚领过月例，这一章又领一次；或者连写十章都没提送账，
 * 读者替作者数着日子。此前这件事只活在作者记忆里，**没有任何东西会提醒**。
 *
 * ## 锚是「上次真的发生」，不是起算点
 *
 * `anchorChapter` / `anchorStoryDay` 记的是**上一次真的发生**的那一点，不是「制度从第几章
 * 开始生效」。用起算点 t0 就必须做模运算（`(当前 - t0) % interval`），一旦中间漏写一轮，
 * 模运算会把「漏掉的那一轮」悄悄吞掉，此后永久错位；用「上次发生」则错位只影响一轮，
 * 作者更新一次锚就恢复。所以这里没有 t0，只有 anchor。
 *
 * ## `chapter_number` 与 `anchor_chapter` 不是重复
 *
 * - `chapter_number`：这条制度**写在哪一章**（登记出处，作者自己看）；
 * - `anchor_chapter`：这件周期事件**上次发生在哪一章**（判定用的唯一锚）。
 * 两者经常不同（第 3 章登记了「月例」，但上次月例发生在第 12 章）。合成一列就无法表达
 * 「很早登记、最近刚发生」这种最常见的情形。
 *
 * ## 只判「该不该发生」，绝不判「应发多少」
 *
 * 这一节只产出四个状态（`due` / `not_due` / `overdue` / `unknown`），**不产出任何数量**：
 * 不发「该发三枚灵石」、不算「累计欠了几轮」的金额。原因是 ADR-0022 —— 派生数值不进
 * 上下文，模型会拿它当既定事实写进正文，而那个数字从来没有作者确认过。
 *
 * ## 自持 cadence，永不引用 `resources.period`
 *
 * 周期在这一格里是**判定轴**（每 N 章 / 每 N 日），在资源账本里 `period` 是**口径说明**
 * （「按月结算」）。`prompt-builder.ts:318-330` 的资源类型只收 `name` / `unit`，period 从未
 * 进过提示词（判据 DK：模型会拿费率算钱）。两处语义不同、形状不同，**不共用字段**。
 *
 * ## 四态与「缺失就说缺失」
 *
 * - `overdue`：`elapsed >= 2N`，至少漏了一整轮 —— 和 `due` 分开，因为作者要处理的不是
 *   「该不该写」而是「中间漏了」；
 * - `unknown`：**锚缺失**或**本章日序不可知**。`unknown` 与 `not_due` 在类型、渲染、测试
 *   三处都分开（判据 DN 同型）：把「不知道」渲染成「未到」，作者就再也不会去看它。
 * - 降级只发生在**运行时值缺失**这一侧：日序轴缺锚 ⇒ 永远 `unknown`，**绝不折成 not_due**；
 *   锚有但本章日序不可知 ⇒ 有 `fallback_interval_chapters` 才按章判（`chapter-fallback`）。
 */
import type { WritingLanguage } from './writing-language'

/** 判定轴：按章推进，还是按书内日序推进。 */
export type CadenceAxis = 'chapter' | 'story-day'

/** 四态。`overdue` 是 `due` 的加强版，`unknown` 与它们全部互斥。 */
export type CadenceStatus = 'due' | 'not_due' | 'overdue' | 'unknown'

/** 这一判定实际走的轴：按章 / 按日 / 按章降级 / 没有可用轴。 */
export type CadenceBasis = 'chapter' | 'story-day' | 'chapter-fallback' | 'none'

/** `unknown` 的原因。三者互斥，且都必须能渲染成人话。 */
export type CadenceUnknownReason = 'anchor-missing' | 'anchor-in-future' | 'story-day-missing'

/** 来源：本期只有作者登记；留 `derived` 是为了以后从定稿抽取时不改表。 */
export type CadenceSource = 'author' | 'derived'

/** 一条制度（= 一个周期事件）的完整记录。 */
export interface InstitutionCadence {
  cadenceId: string
  /** 周期事件的叫法（`月例` / `送账日` / `巡夜`）。UNIQUE。 */
  name: string
  axis: CadenceAxis
  /** 每隔多少个「轴单位」发生一次。正整数。 */
  interval: number
  /** 上次发生所在的章；`null` = 没登记过。 */
  anchorChapter: number | null
  /** 上次发生时的书中日序（第 0 日起算）；`null` = 没登记过。 */
  anchorStoryDay: number | null
  /**
   * 日序轴的按章降级间隔：本章日序不可知时，用「每 N 章」兜底判一次。
   * `null` = 作者没有给出降级轴（此时写前日序判定就是 `unknown`，这是设计，不是缺陷）。
   */
  fallbackIntervalChapters: number | null
  /** 作者备注（登记页可见，**不进提示词** —— 本节预算 480 字，注释会挤掉判定行）。 */
  note: string
  /** 这条制度**写在哪一章**（登记出处）；与 `anchorChapter`（上次发生在哪章）不是一回事。 */
  chapterNumber: number | null
  /** 出处逐字引文；空串 = 没有引文。 */
  evidence: string
  source: CadenceSource
  createdAt: string
  updatedAt: string
}

/** 写入入参：`cadenceId` 缺省表示新建。 */
export interface InstitutionCadenceInput {
  cadenceId?: string
  name: string
  axis: CadenceAxis
  interval: number
  anchorChapter?: number | null
  anchorStoryDay?: number | null
  fallbackIntervalChapters?: number | null
  note?: string
  chapterNumber?: number | null
  evidence?: string
}

export interface CadenceWriteResult {
  success: boolean
  cadenceId?: string
  error?: string
}

export interface CadenceDeleteResult {
  success: boolean
  error?: string
}

/** 名称 / 备注 / 引文的长度上限（与关键物品、资源登记的 200 同口径）。 */
export const CADENCE_TEXT_MAX = 200
/** 条数上限（与写前查阅其它节同一量级：6 条以内一眼扫完）。 */
export const CADENCE_MAX_ITEMS = 6
/** 正文行总字数上限（不含节标题与说明句）。 */
export const CADENCE_MAX_CHARS = 480

/** 一次判定的结果。`reason` 只在 `unknown` 时出现，其余状态不允许带原因。 */
export interface CadenceEvaluation {
  status: CadenceStatus
  basis: CadenceBasis
  reason?: CadenceUnknownReason
}

/** 一条「可渲染的制度」= 记录 + 对本章位置的判定。 */
export interface CadenceEntry {
  cadence: InstitutionCadence
  evaluation: CadenceEvaluation
}

/** 判定用的当前位置。新章自己的日序**通常为 null**（还没写，没人知道是第几天）。 */
export interface CadencePosition {
  chapterNumber: number
  storyDayOffset: number | null
}

/** 三档判定的唯一实现：`elapsed` 必须是非负差值。 */
function classify(elapsed: number, interval: number, basis: CadenceBasis): CadenceEvaluation {
  if (elapsed >= interval * 2) return { status: 'overdue', basis }
  if (elapsed >= interval) return { status: 'due', basis }
  return { status: 'not_due', basis }
}

/**
 * 判定一条周期事件在本章「该不该发生」。判定表逐行实现（见计划 §1.1）：
 *
 * | 轴 | 条件 | 结果 |
 * |---|---|---|
 * | chapter | 锚空 | `unknown / none / anchor-missing` |
 * | chapter | 锚 > 本章 | `unknown / none / anchor-in-future` |
 * | chapter | 差值 ≥ 2N | `overdue / chapter` |
 * | chapter | N ≤ 差值 < 2N | `due / chapter` |
 * | chapter | 差值 < N | `not_due / chapter` |
 * | story-day | 锚空（**即使有按章降级也不降**） | `unknown / none / anchor-missing` |
 * | story-day | 本章日序有值 | 用日差套上面三档，`basis='story-day'` |
 * | story-day | 本章日序空 + 降级轴与章锚都有 | 用章差套三档，`basis='chapter-fallback'` |
 * | story-day | 本章日序空 + 缺降级轴 | `unknown / none / story-day-missing` |
 *
 * 差值出现负数（锚被登记到了本章之后）一律判 `unknown / anchor-in-future`：那是登记错了，
 * 不是「未到」—— 判成 `not_due` 会让这条制度永远沉默。
 */
export function evaluateCadence(
  cadence: Pick<InstitutionCadence,
    'axis' | 'interval' | 'anchorChapter' | 'anchorStoryDay' | 'fallbackIntervalChapters'>,
  current: CadencePosition,
): CadenceEvaluation {
  const interval = cadence.interval
  if (cadence.axis === 'chapter') {
    const anchor = cadence.anchorChapter
    if (anchor === null || anchor === undefined) return { status: 'unknown', basis: 'none', reason: 'anchor-missing' }
    const elapsed = current.chapterNumber - anchor
    if (elapsed < 0) return { status: 'unknown', basis: 'none', reason: 'anchor-in-future' }
    return classify(elapsed, interval, 'chapter')
  }

  // 日序轴：缺锚永远 unknown —— 绝不折成 not_due（缺的是「上次什么时候」，不是「还不到」）。
  const dayAnchor = cadence.anchorStoryDay
  if (dayAnchor === null || dayAnchor === undefined) return { status: 'unknown', basis: 'none', reason: 'anchor-missing' }
  if (current.storyDayOffset !== null && current.storyDayOffset !== undefined) {
    const elapsed = current.storyDayOffset - dayAnchor
    if (elapsed < 0) return { status: 'unknown', basis: 'none', reason: 'anchor-in-future' }
    return classify(elapsed, interval, 'story-day')
  }
  // 本章日序不可知：只有作者给了按章降级**并且**章锚也在，才允许按章判。
  const fallback = cadence.fallbackIntervalChapters
  const chapterAnchor = cadence.anchorChapter
  if (fallback !== null && fallback !== undefined
    && chapterAnchor !== null && chapterAnchor !== undefined) {
    const elapsed = current.chapterNumber - chapterAnchor
    if (elapsed < 0) return { status: 'unknown', basis: 'none', reason: 'anchor-in-future' }
    return classify(elapsed, fallback, 'chapter-fallback')
  }
  return { status: 'unknown', basis: 'none', reason: 'story-day-missing' }
}

function statusText(evaluation: CadenceEvaluation, isEn: boolean): string {
  switch (evaluation.status) {
    case 'due': return isEn ? 'due' : '到期'
    case 'not_due': return isEn ? 'not due' : '未到'
    case 'overdue': return isEn ? 'overdue (at least one cycle missed)' : '逾期（至少漏了一轮）'
    case 'unknown': {
      const reason = evaluation.reason ?? 'anchor-missing'
      if (isEn) {
        return reason === 'anchor-in-future'
          ? 'unknown (anchor recorded after this chapter)'
          : reason === 'story-day-missing'
            ? 'unknown (this chapter\u2019s story day is unknown)'
            : 'unknown (no anchor recorded)'
      }
      return reason === 'anchor-in-future'
        ? '未知（上次记录在本章之后）'
        : reason === 'story-day-missing'
          ? '未知（本章日序不可知）'
          : '未知（没有登记上次发生）'
    }
  }
}

/**
 * 一条制度在提示词里的**唯一**渲染入口（正文链与将来的审稿链共用，判据 DM 同型）。
 *
 * 行里的数字只有三个来源：`interval`（每 N 一次）、`anchorChapter` / `anchorStoryDay`
 * （上次在哪），以及 `fallbackIntervalChapters`（按章降级的 N）。**当前章号与算出来的差值
 * 一律不进** —— 模型会拿它去推算「那现在应该是第几次」（ADR-0022）。
 *
 * 出处三段式，缺失就说缺失（不伪造章号）：
 * - 有锚 + 有引文 ⇒ `第12章（书中第9日）`
 * - 有锚 + 无引文 ⇒ `第12章（书中第9日，作者登记）`
 * - 无锚 + 无引文 ⇒ `作者登记`
 */
export function renderCadenceLine(entry: CadenceEntry, writingLanguage: WritingLanguage): string {
  const { cadence, evaluation } = entry
  const isEn = writingLanguage === 'en-US'
  // 锚的主体是「上次在哪」：章号优先做主体，日序与「作者登记」进括号（计划样例的形态）。
  const chapter = cadence.anchorChapter
  const day = cadence.anchorStoryDay
  const hasChapter = chapter !== null && chapter !== undefined
  const hasDay = day !== null && day !== undefined
  const base = hasChapter
    ? (isEn ? `Chapter ${chapter}` : `第${chapter}章`)
    : hasDay ? (isEn ? `story day ${day}` : `书中第${day}日`) : ''
  const inner: string[] = []
  if (hasChapter && hasDay) inner.push(isEn ? `story day ${day}` : `书中第${day}日`)
  // 没有引文就明说这是作者登记，不假装有出处（判据 DN 同型：缺失就说缺失）。
  if (!cadence.evidence.trim()) inner.push(isEn ? 'author entry' : '作者登记')
  let anchorText: string
  if (!base) anchorText = inner.length > 0 ? inner.join(isEn ? ', ' : '，') : (isEn ? 'not recorded' : '未登记')
  else anchorText = inner.length > 0
    ? `${base}${isEn ? ` (${inner.join(', ')})` : `（${inner.join('，')}）`}`
    : base
  const unit = cadence.axis === 'chapter'
    ? (isEn ? `chapter${cadence.interval === 1 ? '' : 's'}` : '章')
    : (isEn ? `day${cadence.interval === 1 ? '' : 's'}` : '日')
  const cadenceText = isEn ? `every ${cadence.interval} ${unit}` : `每${cadence.interval}${unit}一次`
  const head = isEn
    ? `- ${cadence.name} — ${cadenceText}; last: ${anchorText} => this chapter: `
    : `- ${cadence.name} — ${cadenceText}；上次：${anchorText}⇒ 本章：`
  const status = statusText(evaluation, isEn)
  const fallback = evaluation.basis === 'chapter-fallback' && cadence.fallbackIntervalChapters !== null
    ? (isEn
        ? ` (chapter fallback: every ${cadence.fallbackIntervalChapters} chapter${cadence.fallbackIntervalChapters === 1 ? '' : 's'})`
        : `（按章降级：每${cadence.fallbackIntervalChapters}章）`)
    : ''
  return `${head}${status}${fallback}`
}

/**
 * 渲染【制度】整节；空数组返回空串（**不要**产出只有标题的空节）。
 *
 * @param maxChars 正文行总字数上限；预算外整条丢弃，不截半句（截断的判定行会变成错误判据）。
 */
export function renderCadenceSection(
  entries: readonly CadenceEntry[],
  writingLanguage: WritingLanguage,
  maxChars: number = CADENCE_MAX_CHARS,
): string {
  const lines: string[] = []
  let used = 0
  for (const entry of entries.slice(0, CADENCE_MAX_ITEMS)) {
    if (!entry.cadence.name?.trim()) continue
    const line = renderCadenceLine(entry, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const isEn = writingLanguage === 'en-US'
  const heading = isEn
    ? '[Institutional cadences (recurring events: is it due?)]'
    : '【制度（周期事件：到没到点）】'
  const lead = isEn
    ? 'Each line answers only whether it should happen, never how much. Entries without an anchor are marked "unknown" and must not be projected from chapter numbers.'
    : '以下每条只回答「该不该发生」，不回答「应发多少」；没有锚的标「未知」，不得按章号推算。'
  return `${heading}\n${lead}\n${lines.join('\n')}`
}
