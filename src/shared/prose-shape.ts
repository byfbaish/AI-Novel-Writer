/**
 * 正文形态统计器（P17-2）。
 *
 * **测量仪，不是裁判。** 产出当次报告 + 供 P17-3 定向重写的命中位置，
 * 不落 `review_findings`、不卡生成、不进审稿报告。理由：平台是可变属性，
 * 改成起点后旧 findings 全部失效（`writing-capability-assessment.md` §7.2 定则三）。
 *
 * 阈值出处：`docs/design/architecture/arc-prompt-v7-web-test.md:359-360`
 * 「叙述段 40–120 字，对白段豁免；单段不超过 120 字；对话占比 25%–40%；
 *  主叙述句 7–15 字，描写句 15–25 字」。这是作者自己的正文目标，不是外部口径。
 *
 * 单章样本不可靠（C8，`long-form-craft-alignment-assessment.md:236` / P8 复验 #3）：
 * 所以只报**极端偏离**，报告里常驻 `singleChapterSample: true`，
 * 连续多章同向偏离的聚合判断**不在本模块**。
 *
 * ## 不做什么（每一条都是被论证过才砍掉的，不要"补回去"）
 *
 * - **不判章末钩子**。曾有一版用「末段含 `？`/`！`/`……`/`——`/引号」当钩子存在的代理，已删除。
 *   理由两条：① v7 要求的是**具体型**钩子（揭示／行动／威胁／疑问）并**禁状态描述型**，
 *   而 `……`／`——` 恰恰是状态型与 AI 腔的高发标点 —— 用它判「有钩子」等于**奖励 AI 腔**，
 *   与「编辑挑不出 AI 感」直接冲突；② 反过来，「门开了，站在外面的是他自己。」这种
 *   极好的具体型钩子没有任何这类标点，会被判成缺钩子。信噪比接近零且方向错。
 *   **钩子属于语义判断，只能由模型在 P17-3 重写时看上下文决定，纯代码不碰。**
 * - **不判段长/句长下限**。v7 同节明写「多用短句独立成段」「打散均匀长短句」，
 *   短段短句是它**要求**的，加下限会与同一份规则自相矛盾并且大面积误报。
 * - **不判对话占比**。它是全章性指标，定位不到段落，接了会让 P17-3 退化成整章重生成。
 *   只把 `dialogueRatio` 作为读数输出，不产生 violation。
 * - **不落 `review_findings`、不卡生成、不进审稿报告**。平台可变，落库即失效；
 *   本模块是测量仪，不是裁判，`violations` 里没有 severity 概念。
 */
import type { Locale } from '../i18n/types'
import { countDraftUnits } from './draft-units'
import { isRhythmProfileId, type RhythmProfileId } from './rhythm-profile-ids'

export type ProseShapeMetric =
  | 'paragraph-too-long'
  | 'sentence-too-long'

export interface ProseShapeViolation {
  metric: ProseShapeMetric
  /**
   * 0-based 行号，与 `text.split(/\r?\n/)[paragraphIndex]` 直接对应。
   * P17-3 靠它切原文，**不要**改成「非空段序号」——那样跨不过空行。
   */
  paragraphIndex: number
  /** 段内 0-based 句序号；`paragraph-too-long` 无此字段。 */
  sentenceIndex?: number
  /** 实测值（`countDraftUnits` 口径）。 */
  actual: number
  /** 该项的上界。 */
  limit: number
  /** 命中的原文片段（已截断），供重写指令引用。 */
  excerpt: string
}

export interface ProseShapeMetrics {
  /** 非空段落数。 */
  paragraphCount: number
  /** 含对白的段落数。 */
  dialogueParagraphCount: number
  /** 叙述段（不含对白）段长中位数。 */
  narrativeParagraphUnitsP50: number
  /** 全章最长段。 */
  paragraphUnitsMax: number
  /** 非对白句的句长均值。 */
  narrativeSentenceUnitsMean: number
  /** 非对白句的句长最大值。 */
  narrativeSentenceUnitsMax: number
  /** 引号内字数。 */
  dialogueUnits: number
  totalUnits: number
  /** 引号内字数 / 全章字数，0–1。**只报数不判**（见文件头「不做什么」）。 */
  dialogueRatio: number
}

export interface ProseShapeReport {
  profileId: RhythmProfileId
  /** 恒为 true：单章样本不可靠是既有结论，不是可以关掉的开关。 */
  singleChapterSample: true
  metrics: ProseShapeMetrics
  /** 可能为空。全部 severity 隐含 advisory —— 本模块没有 blocking。 */
  violations: ProseShapeViolation[]
}

interface ShapeThreshold {
  /** 单段字数上界（所有段落，含对白段）。 */
  maxParagraphUnits: number
  /** 单个非对白句的字数上界。 */
  maxNarrativeSentenceUnits: number
}

/**
 * 两档目前**共用同一组数字**，这是刻意的，不是漏填。
 *
 * 理由：段长上限和句长上限是**手机阅读的排版物理约束**，不是平台口味——
 * 起点和番茄都在手机上读，「一段 120 字以上」在两边都难读。真正随平台变的是
 * 「对话占比」和「钩子密度」，而这两项本版一个不判、一个只判存在性。
 *
 * 所以 `Record` 结构保留只为将来接差异，**在没有作者给出起点档口径之前不要凭感觉调数字**。
 * ——宁可两档相同，也不要编一组看着专业的差异值。这是「不自己制造标准」的直接应用。
 */
const SHAPE_THRESHOLDS: Record<RhythmProfileId, ShapeThreshold> = {
  qidian: { maxParagraphUnits: 120, maxNarrativeSentenceUnits: 40 },
  fanqie: { maxParagraphUnits: 120, maxNarrativeSentenceUnits: 40 },
}

/** 中文小说常见的成对引号；`"` 无开闭之分，靠深度判断。 */
const OPEN_QUOTE_CHARS = new Set(['「', '『', '\u201C', '\u2018'])
const CLOSE_QUOTE_CHARS = new Set(['」', '』', '\u201D', '\u2019'])
const AMBIGUOUS_QUOTE = '"'

/** 段长/句长命中时附带的原文片段上限。 */
const EXCERPT_MAX_UNITS = 80

const SENTENCE_PATTERN = /[^。！？…；!?;]+[。！？…；!?;]*/gu

function excerptOf(text: string): string {
  const trimmed = text.trim()
  if (countDraftUnits(trimmed) <= EXCERPT_MAX_UNITS) return trimmed
  // 按字符粗略截断即可：片段只用于指示位置，不参与任何判定。
  return `${trimmed.slice(0, EXCERPT_MAX_UNITS * 2)}…`
}

/**
 * 返回段内所有「引号内区间」。支持嵌套与跨行内多段对白。
 * 未闭合的开引号一直延伸到段末（网文里长对白断段时会出现）。
 */
function quotedRanges(paragraph: string): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = []
  let depth = 0
  let start = -1
  for (let i = 0; i < paragraph.length; i++) {
    const char = paragraph[i]!
    const opensAsAmbiguous = char === AMBIGUOUS_QUOTE && depth === 0
    const isOpen = OPEN_QUOTE_CHARS.has(char) || opensAsAmbiguous
    const isClose = CLOSE_QUOTE_CHARS.has(char) || (char === AMBIGUOUS_QUOTE && depth > 0)
    if (isOpen) {
      if (depth === 0) start = i
      depth += 1
    } else if (isClose && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        ranges.push([start, i])
        start = -1
      }
    }
  }
  if (depth > 0 && start >= 0) ranges.push([start, paragraph.length - 1])
  return ranges
}

function insideRanges(ranges: Array<readonly [number, number]>, position: number): boolean {
  return ranges.some(([from, to]) => position >= from && position <= to)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

/**
 * 统计一章正文的形态。
 *
 * @param text 章节正文（可含空行；段落索引取**行号**，与原文一一对应）
 * @param profileId `project_core.rhythm_profile`
 * @returns 空值 / 未知 id / 空白正文 → `null`（**一律不判**）
 *
 * 为什么未知 id 也返回 null：`rhythm_profiles` 允许作者填自定义文本，
 * 形态判据不能随作者随手填的字漂移（`writing-capability-assessment.md` §7.2 定则二）。
 */
export function measureProseShape(
  text: string,
  profileId: string | null | undefined,
): ProseShapeReport | null {
  if (!isRhythmProfileId(profileId)) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  const threshold = SHAPE_THRESHOLDS[profileId]
  const lines = text.split(/\r?\n/u)

  const violations: ProseShapeViolation[] = []
  const narrativeParagraphUnits: number[] = []
  const narrativeSentenceUnits: number[] = []
  let paragraphCount = 0
  let dialogueParagraphCount = 0
  let paragraphUnitsMax = 0
  let dialogueUnits = 0
  let totalUnits = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const paragraph = lines[lineIndex]!.trim()
    if (!paragraph) continue
    paragraphCount += 1

    const paragraphUnits = countDraftUnits(paragraph)
    totalUnits += paragraphUnits
    if (paragraphUnits > paragraphUnitsMax) paragraphUnitsMax = paragraphUnits

    const ranges = quotedRanges(paragraph)
    const hasDialogue = ranges.length > 0
    if (hasDialogue) dialogueParagraphCount += 1
    else narrativeParagraphUnits.push(paragraphUnits)

    for (const [from, to] of ranges) {
      dialogueUnits += countDraftUnits(paragraph.slice(from, to + 1))
    }

    // 单段上界对所有段落生效（v7「单段不超过 120 字」没有豁免对白段）。
    if (paragraphUnits > threshold.maxParagraphUnits) {
      violations.push({
        metric: 'paragraph-too-long',
        paragraphIndex: lineIndex,
        actual: paragraphUnits,
        limit: threshold.maxParagraphUnits,
        excerpt: excerptOf(paragraph),
      })
    }

    // 句长只判**非对白句**，且只判超长。
    // 为什么不判「偏短」：v7 同节明写「多用短句独立成段」「打散均匀长短句」——
    // 短句是它**要求的**，不是偏离。加下限检查会与同一份规则自相矛盾，并且大面积误报。
    const sentences = paragraph.match(SENTENCE_PATTERN) ?? []
    let cursor = 0
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
      const sentence = sentences[sentenceIndex]!
      const position = paragraph.indexOf(sentence, cursor)
      cursor = position < 0 ? cursor : position + sentence.length
      if (position < 0 || insideRanges(ranges, position)) continue
      const sentenceUnits = countDraftUnits(sentence)
      if (sentenceUnits === 0) continue
      narrativeSentenceUnits.push(sentenceUnits)
      if (sentenceUnits > threshold.maxNarrativeSentenceUnits) {
        violations.push({
          metric: 'sentence-too-long',
          paragraphIndex: lineIndex,
          sentenceIndex,
          actual: sentenceUnits,
          limit: threshold.maxNarrativeSentenceUnits,
          excerpt: excerptOf(sentence),
        })
      }
    }
  }

  if (paragraphCount === 0) return null

  const narrativeSentenceTotal = narrativeSentenceUnits.reduce((sum, value) => sum + value, 0)

  return {
    profileId,
    singleChapterSample: true,
    metrics: {
      paragraphCount,
      dialogueParagraphCount,
      narrativeParagraphUnitsP50: median(narrativeParagraphUnits),
      paragraphUnitsMax,
      narrativeSentenceUnitsMean: narrativeSentenceUnits.length === 0
        ? 0
        : Math.round(narrativeSentenceTotal / narrativeSentenceUnits.length),
      narrativeSentenceUnitsMax: narrativeSentenceUnits.length === 0
        ? 0
        : Math.max(...narrativeSentenceUnits),
      dialogueUnits,
      totalUnits,
      dialogueRatio: totalUnits === 0 ? 0 : Math.round((dialogueUnits / totalUnits) * 10_000) / 10_000,
    },
    violations,
  }
}

/**
 * 供 P17-3 重写指令引用的一句话化描述。
 *
 * 只描述**测到了什么**，不给「应该怎么写」——那是 P17-3 携带平台目标后由模型决定的事。
 * 不带任何「差一点」的措辞：本模块不做程度判断。
 *
 * `uiLocale` 默认为中文以保持旧的单参调用可用；英文侧用 `units` 而不是 `words`，
 * 因为 `countDraftUnits` 在英文写作下按词计、中文下按字计，`words` 在中文语料上会说不通。
 */
export function describeProseShapeViolation(
  violation: ProseShapeViolation,
  uiLocale: Locale = 'zh-CN',
): string {
  const isEnglish = uiLocale === 'en-US'
  switch (violation.metric) {
    case 'paragraph-too-long':
      return isEnglish
        ? `line ${violation.paragraphIndex + 1}: paragraph is ${violation.actual} units, over the ${violation.limit}-unit limit`
        : `第 ${violation.paragraphIndex + 1} 行段落 ${violation.actual} 字，超过 ${violation.limit} 字上限`
    case 'sentence-too-long':
      return isEnglish
        ? `line ${violation.paragraphIndex + 1}, sentence ${(violation.sentenceIndex ?? 0) + 1}: ${violation.actual} units, over the ${violation.limit}-unit limit`
        : `第 ${violation.paragraphIndex + 1} 行第 ${(violation.sentenceIndex ?? 0) + 1} 句 ${violation.actual} 字，超过 ${violation.limit} 字上限`
  }
}
