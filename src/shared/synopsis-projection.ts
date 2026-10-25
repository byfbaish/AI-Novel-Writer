import type { WritingLanguage } from './writing-language'
import { OUTLINE_TITLE_SEPARATORS, parseOutlineChapterHeading } from './chapter-heading'
import { arcSpanForChapters, parseArcStructure, type ArcMajor } from './arc-position'
import { OUTLINE_L2_RECENT_FULL_CHAPTERS, OUTLINE_L2_SOFT_LIMIT_CHARS } from './outline-prefix-budget'
import { renderPreviousVolumeRealityNotice, type PreviousVolumeReality } from './outline-progress-notice'
import {
  renderVolumeHandoffSection,
  VOLUME_HANDOFF_MAX_CHARS,
  type VolumeHandoffDefinition,
} from './volume-handoff'

/**
 * 情节大纲 → 下游步骤的**章级投影**（2026-10-13，P0-0）。
 *
 * ## 为什么需要它
 *
 * 分层是 弧光 → 情节大纲 → 章节蓝图 → 正文。**正文链早已做章级投影**
 * （`synopsisSettingSectionsForDraft`：只留设定层，章级条目一律不进正文），
 * 但**蓝图链一直拿全书未投影的档案**：`directory-workflow.ts` 把
 * `premise / charactersArch / worldbuilding / synopsis` 四段全量拼接后塞进**每一个**
 * 蓝图批次（每批 ≤5 章）。实测（2026-10-13 上游 trace）：生成第 6–7 章蓝图时，
 * `novel_architecture` 仍携带 15,917 字（含全书 33 章情节大纲）。
 *
 * ## 为什么不能照抄正文侧「全剔章级」
 *
 * 对**蓝图**步骤而言，大纲的章级条目是它的**本步输入**（蓝图就是把它细化成章节蓝图），
 * 不是冗余；剔了蓝图就没有依据。正文侧能全剔，是因为章级内容的权威载体在**下游**
 * （蓝图 / `chapter_info`）。
 *
 * ## 三段切分
 *
 * 按与本批范围 `[from, to]` 的关系切三段：
 *
 * | 段 | 章号 | 与下游关系 | 策略 |
 * |---|---|---|---|
 * | 前序 | `1 … from-1` | 已由 `chapter_list` 承载 | 剔除（**仅剔 `chapter_list` 实际覆盖的章**） |
 * | 本批 | `from … to` | 本步输入 | 原样保留 |
 * | 后续 | `to+1 … end` | 蓝图不该规划 | 降级为边界声明（章号 + 标题，不含事件细节） |
 *
 * ⚠️ `chapter_list` 的窗口是 `previous.slice(-100)`：超过 100 章的项目，**更早的前序章
 * 不在其中** → 那些章的大纲条目**必须保留**（否则信息净损失）。故剔除范围 = 调用方传入的
 * `coveredChapters` 集合，**不是**「所有 `from` 之前的章」。
 *
 * ## 失败姿态
 *
 * 与正文侧同一条纪律：**结构无法可靠解析时整体保持原样——宁可多留，也不猜着丢作者事实。**
 * 含代码围栏 / 一条章标题都没有 / 标题层级不一致 / 章号非严格递增，一律原样返回。
 */

type ChapterHeading = Readonly<{
  lineIndex: number
  from: number
  to: number
  markdownLevel: number
}>

/**
 * ⚠️ 这里曾是第六份自写章标题正则。P2 之后单元批次写成
 * `## 第1卷第1单元第1章（全书第1章）：…`，旧正则一条也认不出 ⇒ `parseOutline` 直接
 * 返回 null ⇒ 投影**原样保留全文**（`projectSettingSections` 不再裁剪）。
 *
 * 那是 fail-safe，不会丢作者事实，但等于投影功能在 P2 格式下静默失效：蓝图批次又会
 * 每批携带整份大纲（2026-10-13 修过一次的 15,917 字问题会复现）。现在走共享解析器。
 *
 * 严格度保持原样：只认阿拉伯数字章号；无 `#` 的裸标题必须紧跟冒号 + 非空标题。
 */
function parseChapterHeading(line: string, lineIndex: number): ChapterHeading | null {
  const fields = parseOutlineChapterHeading(line)
  if (!fields) return null
  // 投影**不认 bullet 前缀**（`- 第1章：…` 原正则就没认过）：那是作者手写列表，
  // 与「机器生成的章节条目」不是一回事，认了会把设定层整段剔空。
  if (fields.prefix === 'bullet') return null
  if (fields.hashLevel !== 0 && !fields.prefixSpaced) return null
  if (fields.separator === null) {
    if (fields.rest.trim() !== '') return null
  } else if (!OUTLINE_TITLE_SEPARATORS.has(fields.separator)) {
    return null
  }
  if (!fields.arabic) return null
  // Bare headings must use the production outline's explicit title separator.
  if (fields.hashLevel === 0 && (fields.separator !== ':' && fields.separator !== '：')) return null
  if (fields.hashLevel === 0 && !fields.rest.trim()) return null
  return { lineIndex, from: fields.chapter, to: fields.chapterTo, markdownLevel: fields.hashLevel }
}

interface ParsedOutline {
  lines: readonly string[]
  headings: readonly ChapterHeading[]
  firstLevel: number
}

/** 解析不可靠时返回 null —— 调用方据此原样保留作者原文。 */
function parseOutline(synopsis: string): ParsedOutline | null {
  // Quoted examples can contain chapter-like headings; do not interpret them.
  if (/^\s*(?:`{3,}|~{3,})/mu.test(synopsis)) return null
  const lines = synopsis.trim().split(/\r?\n/u)
  const headings = lines
    .map((line, lineIndex) => parseChapterHeading(line, lineIndex))
    .filter((heading): heading is ChapterHeading => heading !== null)
  // 一条章标题都没有 = 整份都是设定层文本（老项目的手写大纲就是这种形态）→ 原样保留。
  if (!headings.length) return null

  const firstLevel = headings[0]!.markdownLevel
  const hasConsistentHeadingStyle = headings.every(heading => heading.markdownLevel === firstLevel)
  const hasStrictChapterOrder = headings.every((heading, index) => (
    heading.from <= heading.to
    && (index === 0 || heading.from > headings[index - 1]!.to)
  ))
  if (!hasConsistentHeadingStyle || !hasStrictChapterOrder) return null
  return { lines, headings, firstLevel }
}

function projectSettingSections(synopsis: string): string {
  const parsed = parseOutline(synopsis)
  if (!parsed) return synopsis.trim()
  const { lines, headings, firstLevel } = parsed
  const headingsByLine = new Map(headings.map(heading => [heading.lineIndex, heading]))
  let insideChapterRange = false
  const projected: string[] = []
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!
    if (headingsByLine.has(lineIndex)) {
      insideChapterRange = true
    } else {
      const markdownHeading = /^\s*(#{1,6})\s+/u.exec(line)
      if (markdownHeading && (firstLevel === 0 || markdownHeading[1]!.length <= firstLevel)) {
        insideChapterRange = false
      }
    }
    if (!insideChapterRange) projected.push(line)
  }
  return projected.join('\n').trim()
}

/**
 * 情节大纲 → 正文的**设定层投影**：只保留非章级的段落（全书总纲、全局禁则等），
 * 章级条目一律不进正文。
 *
 * 分层是 弧光 → 情节大纲 → 章节蓝图 → 正文：大纲的章级条目与本章蓝图（chapter_info）
 * 说的是同一件事；两者并排进入正文 prompt 且没有任何优先级声明时，模型会在两份表述
 * 之间自由取舍（2026-10-11 第 1 章实机核对，见 docs/plans/llm-probe-observation-plan.md）。
 * 正文的章级内容只由本章蓝图与后续蓝图承载。
 *
 * 但作者写在大纲里的**全局**设定/禁则在大纲之外没有第二个存放位置，所以一律原样保留。
 * 结构无法可靠解析时整体保持原样：宁可多留，也不猜着丢作者事实。
 */
export function synopsisSettingSectionsForDraft(synopsis: string): string {
  const sections = projectSettingSections(synopsis)
  // 只剩悬空标题 = 没有设定层内容（机器生成大纲开头的「# 情节大纲」就是这样）→ 不注入。
  const hasSubstance = sections.split(/\r?\n/u)
    .some(line => line.trim() && !/^\s*#{1,6}[\t ]+\S/u.test(line))
  return hasSubstance ? sections : ''
}

export type BlueprintArchitecturePartKind = 'premise' | 'characters-arch' | 'worldbuilding' | 'synopsis'

/** 蓝图侧「故事架构」的组成段。只有 `synopsis` 参与章级投影，其余是设定事实源。 */
export interface BlueprintArchitecturePart {
  kind: BlueprintArchitecturePartKind
  text: string
}

export interface BlueprintSynopsisProjectionOptions {
  /** 本批起始章号（含）。 */
  from: number
  /** 本批结束章号（含）。 */
  to: number
  /** `chapter_list` 实际覆盖的章号集合（= 蓝图侧前序梗概的物理范围）。 */
  coveredChapters: ReadonlySet<number>
  writingLanguage: WritingLanguage
}

type OutlineSegment =
  | { kind: 'setting'; lines: readonly string[] }
  | { kind: 'chapter'; heading: ChapterHeading; headingLine: string; bodyLines: readonly string[] }

function splitOutlineSegments(synopsis: string): readonly OutlineSegment[] | null {
  const parsed = parseOutline(synopsis)
  if (!parsed) return null
  const { lines, headings, firstLevel } = parsed
  const headingsByLine = new Map(headings.map(heading => [heading.lineIndex, heading]))
  const segments: OutlineSegment[] = []
  let setting: string[] = []
  let chapter: { heading: ChapterHeading; headingLine: string; bodyLines: string[] } | null = null

  const flushSetting = () => {
    if (setting.some(line => line.trim())) segments.push({ kind: 'setting', lines: setting })
    setting = []
  }
  const flushChapter = () => {
    if (chapter) segments.push({ kind: 'chapter', ...chapter })
    chapter = null
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!
    const heading = headingsByLine.get(lineIndex)
    if (heading) {
      flushSetting()
      flushChapter()
      chapter = { heading, headingLine: line, bodyLines: [] }
      continue
    }
    const markdownHeading = /^\s*(#{1,6})\s+/u.exec(line)
    if (markdownHeading && (firstLevel === 0 || markdownHeading[1]!.length <= firstLevel)) flushChapter()
    if (chapter) chapter.bodyLines.push(line)
    else setting.push(line)
  }
  flushSetting()
  flushChapter()
  return segments
}

function fullyCovered(heading: ChapterHeading, covered: ReadonlySet<number>): boolean {
  for (let chapter = heading.from; chapter <= heading.to; chapter += 1) {
    if (!covered.has(chapter)) return false
  }
  return true
}

function boundaryNotice(heading: ChapterHeading, writingLanguage: WritingLanguage): string {
  const range = heading.from === heading.to
    ? `第 ${heading.from} 章`
    : `第 ${heading.from}–${heading.to} 章`
  const rangeEn = heading.from === heading.to
    ? `chapter ${heading.from}`
    : `chapters ${heading.from}–${heading.to}`
  return writingLanguage === 'en-US'
    ? `(later ${rangeEn} — boundary declaration only; do not execute its events in this batch)`
    : `（后续${range}，仅作边界声明；本批不得提前执行其中的事件）`
}

/**
 * 情节大纲 → 蓝图步骤的**三段切分投影**。行为见文件头注释。
 * 解析不可靠时返回原文（trim 后），调用方无需再判断。
 */
export function projectSynopsisForBlueprint(
  synopsis: string,
  options: BlueprintSynopsisProjectionOptions,
): string {
  const segments = splitOutlineSegments(synopsis)
  // 解析不可靠时原样保留：宁可多留，也不猜着丢作者事实。
  if (!segments) return synopsis.trim()

  const projected: string[] = []
  for (const segment of segments) {
    if (segment.kind === 'setting') {
      projected.push(...segment.lines)
      continue
    }
    const { heading, headingLine, bodyLines } = segment
    if (heading.to < options.from) {
      // 前序：已由 chapter_list 承载 → 剔除。未被 chapter_list 覆盖的更早章保留。
      if (fullyCovered(heading, options.coveredChapters)) continue
      projected.push(headingLine, ...bodyLines)
      continue
    }
    if (heading.from > options.to) {
      // 后续：降级为边界声明（章号 + 标题，不含事件细节）。
      projected.push(headingLine, boundaryNotice(heading, options.writingLanguage))
      continue
    }
    // 本批：本步输入，原样保留。
    projected.push(headingLine, ...bodyLines)
  }
  return projected.join('\n').trim()
}

/**
 * 按本批范围渲染蓝图侧的「故事架构」。
 *
 * 非 `synopsis` 段（前提 / 角色图谱 / 世界观）是**设定事实源**，与章级无关，一律原样保留；
 * 只有 `synopsis` 段走三段切分。连接符与 `directory-workflow.ts` 的既有口径一致。
 */
export function renderBlueprintArchitecture(
  parts: readonly BlueprintArchitecturePart[],
  options: BlueprintSynopsisProjectionOptions,
): string {
  const rendered: string[] = []
  for (const part of parts) {
    if (part.kind !== 'synopsis') {
      rendered.push(part.text)
      continue
    }
    const projected = projectSynopsisForBlueprint(part.text, options)
    if (projected) rendered.push(projected)
  }
  return rendered.join('\n\n---\n\n')
}

// ===== 大纲链：L2/L3 分层投影（P1-2 期 3，2026-10-25）=====
//
// 与蓝图侧的三段切分不同：大纲链要的是「按**层**给出的已写大纲」，因为
// 「本卷已写」和「上一卷发生了什么」在模型眼里是两种不同权威 ——
// 前者是它马上要接续的文本，后者只能来自交接单（实际）或卷纲摘要（计划）。
//
// ## 一处与设计稿不同的取舍：不再单独渲染 L4
//
// 设计稿的 L4 是「最近 K 章全文」，口径与 L2 重叠（L4 ⊆ L2 恒成立）。在
// 「L2 只取本卷、卷首不跨卷」两条口径下，L4 永远没有独占内容：折叠时保留的
// 最近 12 章已经覆盖 L4 的 3 章，卷首又明确不给上一卷。所以 L4 并入 L2 的
// 折叠策略（`OUTLINE_L2_RECENT_FULL_CHAPTERS`），不再单列一层 —— 否则
// prompt 里同一段事件会出现两遍，比不做投影更费 token。

/** 结构型游标：不 import 命令层类型（shared 不依赖 services）。 */
export interface OutlineCursor {
  volumeIndex: number
  unitIndex: number
  writtenInVolume: number
}

export interface OutlineVolumePosition {
  volumeIndex: number | null
  /** 本卷第一章的章号；`null` = 定位失败。 */
  volumeFirstChapter: number | null
  basis: 'cursor' | 'arc-span' | 'none'
}

/**
 * 「本批起点落在第几卷、本卷从第几章起」。
 *
 * 优先用检查点游标（`from - writtenInVolume`）：写超时（计划 20 章写到 25 章）
 * 它仍然正确。没有游标（两级结构：没有单元层）时才退回弧光折算，并标记 degraded ——
 * 弧光按自报章数等分，实际偏离后会整体错位，所以它是**退路不是首选**。
 */
export function resolveOutlineVolumePosition(input: {
  from: number
  cursor: OutlineCursor | null
  arcPlan: string | null | undefined
  totalChapters: number
}): OutlineVolumePosition {
  const { from, cursor } = input
  if (cursor && Number.isSafeInteger(cursor.volumeIndex) && cursor.volumeIndex >= 1
    && Number.isSafeInteger(cursor.writtenInVolume) && cursor.writtenInVolume >= 0) {
    const first = from - cursor.writtenInVolume
    if (first >= 1) return { volumeIndex: cursor.volumeIndex, volumeFirstChapter: first, basis: 'cursor' }
  }
  const parsed = parseArcStructure(input.arcPlan ?? '')
  const span = arcSpanForChapters(parsed, input.totalChapters, from, from)
  if (span) return { volumeIndex: span.majorIndex, volumeFirstChapter: span.majorRange[0], basis: 'arc-span' }
  return { volumeIndex: null, volumeFirstChapter: null, basis: 'none' }
}

export type OutlineProjectionDegraded =
  | 'outline-unparsable'
  | 'volume-position-unknown'
  | 'l2-group-straddles-volume-start'
  | 'l2-group-straddles-batch-start'
  | 'l2-collapsed-over-budget'
  | 'l2-still-over-budget'
  | 'l3-handoff-missing'
  | 'l3-volume-plan-unavailable'

export interface OutlinePrefixLayer {
  /** 渲染出来的整段文本（已含小标题由 render 侧加）。 */
  text: string
  chars: number
}

export interface OutlinePrefixProjection {
  from: number
  volumeIndex: number | null
  volumeFirstChapter: number | null
  /** 设定层（全书总纲/禁则）：始终保留，不计入 L2 预算。 */
  setting: OutlinePrefixLayer
  l2: OutlinePrefixLayer & {
    firstChapter: number | null
    lastChapter: number | null
    groupCount: number
    /** 为了不超预算而只留标题行的章组数。 */
    omittedGroups: number
    collapsed: boolean
  }
  l3: OutlinePrefixLayer & {
    kind: 'actual' | 'plan' | 'none'
    /** 上一卷卷号（`null` = 判断不出）。 */
    volumeIndex: number | null
  }
  reality: PreviousVolumeReality | null
  degraded: readonly OutlineProjectionDegraded[]
  totalChars: number
}

export interface OutlinePrefixProjectionOptions {
  /** 本批起始章（= 已确认前缀覆盖到 from − 1）。 */
  from: number
  position: OutlineVolumePosition
  arcPlan: string | null | undefined
  writingLanguage: WritingLanguage
  /** 上一卷交接单：调用方必须按 `volumeIndex === 本卷 − 1` **精确匹配**，禁止「取最近一份」。 */
  previousHandoff: VolumeHandoffDefinition | null
  /** 上一卷是否已整卷定稿；`null` = 判断不出（卷结构不可用）。 */
  previousVolumeFinalized: boolean | null
  /** 正文整体定稿到第几章（用于「只覆盖已写部分」的措辞）。 */
  proseFinalizedThrough: number
  l2SoftLimitChars?: number
  l2RecentFullChapters?: number
}

/** 卷五格 + 卷末状态的**计划**摘要（L3 的退化源）。 */
export function renderArcMajorSummary(major: ArcMajor, writingLanguage: WritingLanguage): string {
  const en = writingLanguage === 'en-US'
  const lines: string[] = []
  if (major.name.trim()) lines.push(en ? `- Volume: ${major.name.trim()}` : `- 卷名：${major.name.trim()}`)
  for (const [label, value] of major.fields) {
    const text = value.trim()
    if (text) lines.push(`- ${label}：${text}`)
  }
  const endState = major.endState?.trim()
  if (endState) lines.push(en ? `- Volume end state: ${endState}` : `- 卷末状态：${endState}`)
  return lines.join('\n')
}

function chapterSegmentText(segment: { headingLine: string; bodyLines: readonly string[] }): string {
  return [segment.headingLine, ...segment.bodyLines].join('\n').trim()
}

function charsOf(text: string): number {
  return text.replace(/\s+/gu, '').length
}

/**
 * 已确认前缀 → 分层投影。**只用于注入**：调用方必须保留原始 `confirmedPrefix` 用于
 * 落库、指纹与续写拼接 —— 把投影结果写回去会把库里的大纲永久压短。
 */
export function projectSynopsisForOutline(
  synopsis: string,
  options: OutlinePrefixProjectionOptions,
): OutlinePrefixProjection {
  const degraded: OutlineProjectionDegraded[] = []
  const from = options.from
  const volumeIndex = options.position.volumeIndex
  const volumeFirstChapter = options.position.volumeFirstChapter
  if (options.position.basis !== 'cursor') degraded.push('volume-position-unknown')

  const emptyProjection = (text: string, extra: OutlineProjectionDegraded[]): OutlinePrefixProjection => ({
    from,
    volumeIndex,
    volumeFirstChapter,
    setting: { text: '', chars: 0 },
    l2: { text, chars: charsOf(text), firstChapter: null, lastChapter: null, groupCount: 0, omittedGroups: 0, collapsed: false },
    l3: { text: '', chars: 0, kind: 'none', volumeIndex: null },
    reality: null,
    degraded: [...degraded, ...extra],
    totalChars: charsOf(text),
  })

  const segments = splitOutlineSegments(synopsis)
  // 解析不可靠 ⇒ 原样返回（宁可多留，也不猜着丢作者事实）。
  if (!segments) {
    const text = synopsis.trim()
    return emptyProjection(text, ['outline-unparsable'])
  }

  const settingLines: string[] = []
  const chapters: Array<{ heading: ChapterHeading; headingLine: string; bodyLines: readonly string[] }> = []
  for (const segment of segments) {
    if (segment.kind === 'setting') settingLines.push(...segment.lines)
    else chapters.push(segment)
  }
  const settingText = settingLines.join('\n').trim()

  // ---- L2：本卷已写。定位失败 ⇒ 退化为 [1, from-1]（不静默丢内容，靠 degraded 说明）。
  const vStart = volumeFirstChapter ?? 1
  const inL2 = chapters.filter(chapter => chapter.heading.to >= vStart && chapter.heading.from <= from - 1)
  for (const chapter of inL2) {
    if (chapter.heading.from < vStart && chapter.heading.to >= vStart) degraded.push('l2-group-straddles-volume-start')
    if (chapter.heading.to > from - 1) degraded.push('l2-group-straddles-batch-start')
  }

  const softLimit = options.l2SoftLimitChars ?? OUTLINE_L2_SOFT_LIMIT_CHARS
  const recentFull = options.l2RecentFullChapters ?? OUTLINE_L2_RECENT_FULL_CHAPTERS
  let l2Texts = inL2.map(chapterSegmentText)
  let omittedGroups = 0
  const fullChars = l2Texts.reduce((total, text) => total + charsOf(text), 0)
  if (fullChars > softLimit) {
    degraded.push('l2-collapsed-over-budget')
    // 从末尾往前累计「章数」到 recentFull：跨界的章组整组计入、整组保留。
    const keepFull = new Set<number>()
    let kept = 0
    for (let index = inL2.length - 1; index >= 0 && kept < recentFull; index -= 1) {
      const heading = inL2[index]!.heading
      keepFull.add(index)
      kept += heading.to - heading.from + 1
    }
    omittedGroups = inL2.length - keepFull.size
    l2Texts = inL2.map((chapter, index) => keepFull.has(index) ? l2Texts[index]! : chapter.headingLine.trim())
    if (l2Texts.reduce((total, text) => total + charsOf(text), 0) > softLimit) degraded.push('l2-still-over-budget')
  }
  const l2Text = l2Texts.join('\n\n').trim()
  const firstInL2 = inL2[0]?.heading
  const lastInL2 = inL2[inL2.length - 1]?.heading

  // ---- L3：上一卷。有交接单就给实际，否则给计划并标注。
  const previousIndex = volumeIndex === null ? null : volumeIndex - 1
  const handoff = previousIndex === null ? null : options.previousHandoff
  const handoffText = handoff
    ? renderVolumeHandoffSection(handoff, options.writingLanguage, from, VOLUME_HANDOFF_MAX_CHARS)
    : ''
  const finalized = options.previousVolumeFinalized
  let l3Kind: 'actual' | 'plan' | 'none' = 'none'
  let l3Text = ''
  let reality: PreviousVolumeReality | null = null
  if (previousIndex !== null && previousIndex >= 1) {
    if (handoffText) {
      l3Kind = 'actual'
      l3Text = handoffText
      reality = finalized === true
        ? { kind: 'finalized' }
        : { kind: 'partial', volumeIndex: previousIndex, finalizedThrough: options.proseFinalizedThrough }
    } else {
      const major = parseArcStructure(options.arcPlan ?? '')?.majors[previousIndex - 1] ?? null
      const brief = major ? renderArcMajorSummary(major, options.writingLanguage) : ''
      if (brief) {
        l3Kind = 'plan'
        l3Text = brief
      } else {
        degraded.push('l3-volume-plan-unavailable')
      }
      degraded.push('l3-handoff-missing')
      reality = finalized === true
        ? { kind: 'plan-only', volumeIndex: previousIndex, reason: 'no-handoff' }
        : finalized === false
          ? { kind: 'plan-only', volumeIndex: previousIndex, reason: 'unfinalized', finalizedThrough: options.proseFinalizedThrough }
          : { kind: 'plan-only', volumeIndex: previousIndex, reason: 'unresolved' }
    }
  }

  const totalChars = charsOf(settingText) + charsOf(l2Text) + charsOf(l3Text)
  return {
    from,
    volumeIndex,
    volumeFirstChapter,
    setting: { text: settingText, chars: charsOf(settingText) },
    l2: {
      text: l2Text,
      chars: charsOf(l2Text),
      firstChapter: firstInL2?.from ?? null,
      lastChapter: lastInL2?.to ?? null,
      groupCount: inL2.length,
      omittedGroups,
      collapsed: omittedGroups > 0,
    },
    l3: { text: l3Text, chars: charsOf(l3Text), kind: l3Kind, volumeIndex: previousIndex },
    reality,
    degraded,
    totalChars,
  }
}

/**
 * 渲染注入用的整块文本。**外层节标题 `【已完成大纲前缀】` 逐字保留** ——
 * 既有断言（`plot-outline-batch.command.test.ts`）与模型习惯都依赖它；
 * 分层信息只加在内层小标题上。
 */
export function renderOutlinePrefixBlock(
  projection: OutlinePrefixProjection,
  writingLanguage: WritingLanguage,
): string {
  const en = writingLanguage === 'en-US'
  const blocks: string[] = [
    en ? '[Confirmed outline prefix]' : '【已完成大纲前缀】',
    en
      ? `(This batch starts at chapter ${projection.from}; the layers below are the outline already written, not the whole book.)`
      : `（本批从第 ${projection.from} 章起；以下按层给出已写大纲，不是全书）`,
  ]
  if (projection.setting.text) {
    blocks.push(en ? '[Setting and global constraints]' : '【设定与全局约束】', projection.setting.text)
  }
  // 即使摘要取不到也要出这一节：**缺则 unknown 必须显式**。静默省略会让模型以为
  // 「上一卷没什么要交代的」，那正是期 2 要消除的失真形态。
  if (projection.l3.text || projection.reality) {
    const index = projection.l3.volumeIndex
    const label = index === null ? '' : (en ? ` ${index}` : `${index}`)
    const heading = projection.l3.kind === 'actual'
      ? (en ? `[Previous volume (${label.trim()}) handoff · actual]` : `【上一卷（第${label}卷）交接 · 实际】`)
      : projection.l3.kind === 'plan'
        ? (en ? `[Previous volume (${label.trim()}) outline summary · plan]` : `【上一卷（第${label}卷）卷纲摘要 · 计划】`)
        : (en ? `[Previous volume (${label.trim()}) · no summary available]` : `【上一卷（第${label}卷）· 无可用摘要】`)
    blocks.push(heading)
    const notice = projection.reality ? renderPreviousVolumeRealityNotice(projection.reality, writingLanguage) : ''
    if (notice) blocks.push(notice)
    blocks.push(projection.l3.text || (en
      ? '(No volume handoff and no usable volume outline summary is available.)'
      : '（上一卷既无卷末交接单，也没有可用的卷纲摘要）'))
  }
  if (projection.l2.text) {
    const range = projection.l2.firstChapter !== null && projection.l2.lastChapter !== null
      ? (en
          ? `chapters ${projection.l2.firstChapter}–${projection.l2.lastChapter}`
          : `第${projection.l2.firstChapter}–${projection.l2.lastChapter}章`)
      : (en ? 'range unresolved' : '起止未定')
    blocks.push(en
      ? `[Outline already written in this volume (${range}, ${projection.l2.groupCount} entr${projection.l2.groupCount === 1 ? 'y' : 'ies'})]`
      : `【本卷已写大纲（${range}，共 ${projection.l2.groupCount} 条）】`)
    blocks.push(projection.l2.text)
    if (projection.l2.omittedGroups > 0) {
      blocks.push(en
        ? `(Earlier ${projection.l2.omittedGroups} chapter group(s) are reduced to heading lines only; the stored outline remains authoritative.)`
        : `（已省略更早的 ${projection.l2.omittedGroups} 个章组，只保留标题行；完整原文以数据库大纲为准）`)
    }
  } else if (projection.volumeIndex !== null) {
    blocks.push(en
      ? `[No outline written yet in this volume — this batch starts its first chapter]`
      : '【本卷尚未写任何正文】')
  }
  return blocks.filter(Boolean).join('\n\n').trim()
}
