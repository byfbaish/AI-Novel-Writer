import type { WritingLanguage } from './writing-language'

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

const CHAPTER_HEADING = /^\s*(?:(#{1,6})[\t ]+)?(?:第\s*([1-9]\d*)(?:\s*[–—-]\s*([1-9]\d*))?\s*章|Chapters?[\t ]+([1-9]\d*)(?:[\t ]*[–—-][\t ]*([1-9]\d*))?)(?=[\t ]*(?:[:：.．—-]|$))/iu

function parseChapterHeading(line: string, lineIndex: number): ChapterHeading | null {
  const match = CHAPTER_HEADING.exec(line)
  if (!match) return null
  // Bare headings must use the production outline's explicit title separator.
  if (!match[1] && !/^[\t ]*[:：]\s*\S/u.test(line.slice(match[0].length))) return null
  const from = Number(match[2] ?? match[4])
  const to = Number(match[3] ?? match[5] ?? from)
  return { lineIndex, from, to, markdownLevel: match[1]?.length ?? 0 }
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
