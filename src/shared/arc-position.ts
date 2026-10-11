import type { WritingLanguage } from './writing-language'

/**
 * 弧位圈定（2026-10-11）。
 *
 * ## 为什么需要它
 *
 * 大纲是**分批生成**的（每批 ≤10 章，`PLANNING_ACTION_CHAPTER_LIMIT`），而每批只拿到
 * 整份「弧光结构」+ 已确认前缀 —— 模型**不知道自己正落在哪个大弧/中弧里**。
 *
 * 实测后果（845 章项目，前 30 章）：
 * `大弧一【规则初学】` 的中弧 2【工程题拆解】（弧位约 26–50 章）的核心动作 ——
 * 「利用『访客身份』规避停留限制」「铃连续微震指向隐藏出口→逃生」「弹幕开始嘲讽」——
 * **全部在第 9–10 章（中弧 1 内）就执行完了**。大弧层面同理：`大弧二【规则博弈】`
 * 的接续理由是"中弧 4 发现副本残留被改写"，而该发现在第 12–15 章就出现了。
 *
 * 本模块据弧光结构**推算**本批所处的弧位，并把"后续中弧不得提前执行"写成硬约束，
 * 随大纲提示词一起注入。它是**定位辅助**，不修改弧光本身，也不改变大纲的散文形态。
 *
 * ## 换算约定
 *
 * 弧光里的章数是**约数**且合计可能与全书章数不等（实测 880 vs 845，属允许的规划弹性）。
 * 因此绝对章号由**累积求和后按比例折算**得到，并在注入文本里**显式声明**折算事实。
 */

export interface ArcMid {
  /** 弧光里的名称（已去掉【】） */
  name: string
  /** 弧光里的约数章数 */
  chapters: number
  /** 该中弧的规格字段（类型 / 因果|目标|动机 / 时序|尝试|路径 / 转折 …） */
  fields: readonly (readonly [string, string])[]
}

export interface ArcMajor {
  name: string
  chapters: number
  fields: readonly (readonly [string, string])[]
  mids: readonly ArcMid[]
}

export interface ParsedArcStructure {
  majors: readonly ArcMajor[]
  /** 弧光自报的章数合计（用于声明折算比例） */
  declaredTotal: number
}

export interface ArcSpan {
  majorIndex: number
  majorName: string
  majorRange: readonly [number, number]
  midIndex: number
  midName: string
  midRange: readonly [number, number]
  midFields: readonly (readonly [string, string])[]
  /** 同一大弧内、位于本中弧之后的剩余中弧 */
  remainingMids: readonly { name: string; range: readonly [number, number]; gist: string }[]
  /** 本批跨越到下一个中弧时的分界章（含该章起属下一个中弧） */
  nextMidBoundary: number | null
  nextMidName: string | null
}

const MAJOR_HEADING = /^#{2,3}[\t ]*大弧[^：:]*[：:][\t ]*(.+?)[\t ]*(?:（[\t ]*约?[\t ]*([0-9]+)[\t ]*章[\t ]*）)?[\t ]*$/u
const MID_HEADING = /^#{3,4}[\t ]*中弧[\t ]*[0-9]*[\t ]*[：:][\t ]*(.+?)[\t ]*(?:（[\t ]*约?[\t ]*([0-9]+)[\t ]*章[\t ]*）)?[\t ]*$/u
/** `- **类型**：A 因果驱动型` / `- 因果：…` —— 字段名与值 */
const FIELD_LINE = /^[-*][\t ]*\*{0,2}([^：:*]{1,12}?)\*{0,2}[\t ]*[：:][\t ]*(.+?)[\t ]*$/u
/** 只保留能定位内容的字段，忽略纯枚举（类型）与排版字段 */
const SKIP_FIELDS = new Set(['类型', '接续理由', '核心冲突', '结束状态', '小弧', 'Type', 'Minor arcs'])

function stripBrackets(value: string): string {
  return value.replace(/^[【\[]/u, '').replace(/[】\]]$/u, '').trim()
}

function toText(value: string): string {
  return value.replace(/\*\*/gu, '').replace(/\s+/gu, ' ').trim()
}

/**
 * 解析「弧光结构」文本中的大弧 / 中弧骨架。
 * 拿不到章数的条目会被丢弃；一个有效大弧都解析不出时返回 null（调用方据此跳过注入）。
 */
export function parseArcStructure(plan: string | null | undefined): ParsedArcStructure | null {
  if (!plan?.trim()) return null
  const majors: ArcMajor[] = []
  let major: { name: string; chapters: number; fields: [string, string][]; mids: { name: string; chapters: number; fields: [string, string][] }[] } | null = null
  let mid: { name: string; chapters: number; fields: [string, string][] } | null = null

  for (const rawLine of plan.split(/\r?\n/u)) {
    const line = rawLine.trim()
    const majorMatch = MAJOR_HEADING.exec(line)
    if (majorMatch?.[2]) {
      major = { name: stripBrackets(majorMatch[1]!), chapters: Number(majorMatch[2]), fields: [], mids: [] }
      majors.push(major as ArcMajor)
      mid = null
      continue
    }
    const midMatch = MID_HEADING.exec(line)
    if (midMatch?.[2] && major) {
      mid = { name: stripBrackets(midMatch[1]!), chapters: Number(midMatch[2]), fields: [] }
      major.mids.push(mid)
      continue
    }
    const fieldMatch = FIELD_LINE.exec(line)
    if (!fieldMatch) continue
    const [, rawName, rawValue] = fieldMatch
    const name = toText(rawName!)
    if (SKIP_FIELDS.has(name)) continue
    const value = toText(rawValue!)
    if (!value) continue
    if (mid) mid.fields.push([name, value])
    else if (major) major.fields.push([name, value])
  }

  const usable = majors.filter(item => item.chapters > 0 && item.mids.length > 0 && item.mids.every(sub => sub.chapters > 0))
  if (!usable.length) return null
  return Object.freeze({
    majors: Object.freeze(usable),
    declaredTotal: usable.reduce((sum, item) => sum + item.chapters, 0),
  })
}

/** 累积边界（含 0 与总计），必要时按 total/declared 等比折算并保证严格递增。 */
function scaledBoundaries(counts: readonly number[], total: number): number[] {
  const declared = counts.reduce((sum, value) => sum + value, 0)
  const factor = declared > 0 && total > 0 ? total / declared : 1
  const bounds: number[] = [0]
  let cumulative = 0
  for (const count of counts) {
    cumulative += count
    const next = Math.round(cumulative * factor)
    bounds.push(Math.max(bounds[bounds.length - 1]! + 1, Math.min(next, total)))
  }
  bounds[bounds.length - 1] = total
  return bounds
}

function gistOf(fields: readonly (readonly [string, string])[]): string {
  const preferred = fields.find(([name]) => /因果|目标|动机|Causality|Goal|Motivation/u.test(name))
  const text = (preferred ?? fields[0])?.[1] ?? ''
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

/** 推算某章范围落在哪个大弧 / 中弧。范围越界或结构不可解析时返回 null。 */
export function arcSpanForChapters(
  parsed: ParsedArcStructure | null,
  totalChapters: number,
  from: number,
  to: number,
): ArcSpan | null {
  if (!parsed || !Number.isSafeInteger(totalChapters) || totalChapters < 1) return null
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from || from > totalChapters) return null

  const majorBounds = scaledBoundaries(parsed.majors.map(item => item.chapters), totalChapters)
  const majorIndex = parsed.majors.findIndex((_, index) => from <= majorBounds[index + 1]!)
  if (majorIndex < 0) return null
  const major = parsed.majors[majorIndex]!
  const majorRange: [number, number] = [majorBounds[majorIndex]! + 1, majorBounds[majorIndex + 1]!]

  const midBounds = scaledBoundaries(major.mids.map(item => item.chapters), majorRange[1] - majorRange[0] + 1)
  const midIndex = major.mids.findIndex((_, index) => from - majorRange[0] + 1 <= midBounds[index + 1]!)
  if (midIndex < 0) return null
  const mid = major.mids[midIndex]!
  const midRange: [number, number] = [majorRange[0] + midBounds[midIndex]!, majorRange[0] + midBounds[midIndex + 1]! - 1]

  const next = major.mids[midIndex + 1]
  const nextMidBoundary = next ? majorRange[0] + midBounds[midIndex + 1]! : null

  return Object.freeze({
    majorIndex: majorIndex + 1,
    majorName: major.name,
    majorRange,
    midIndex: midIndex + 1,
    midName: mid.name,
    midRange,
    midFields: mid.fields,
    remainingMids: major.mids.slice(midIndex + 1).map((item, offset) => Object.freeze({
      name: item.name,
      range: [majorRange[0] + midBounds[midIndex + 1 + offset]!, majorRange[0] + midBounds[midIndex + 2 + offset]! - 1] as const,
      gist: gistOf(item.fields),
    })),
    nextMidBoundary: nextMidBoundary !== null && nextMidBoundary <= to ? nextMidBoundary : null,
    nextMidName: next ? next.name : null,
  })
}

/** 结构里是否声明了与全书章数不同的合计（用于在注入文本里声明折算）。 */
export function arcStructureNeedsRescale(parsed: ParsedArcStructure | null, totalChapters: number): boolean {
  return !!parsed && parsed.declaredTotal > 0 && parsed.declaredTotal !== totalChapters
}

/**
 * 把弧位块拼到「弧光结构」文本之后 —— 这是大纲步骤的注入点。
 * 结构不可解析（例如作者用的是枚举故事结构模板）时原样返回，不注入、不干扰。
 */
export function withArcPositionGuide(
  guide: string,
  plan: string | null | undefined,
  totalChapters: number,
  from: number,
  to: number,
  writingLanguage: WritingLanguage,
): string {
  const block = renderArcPositionBlock(parseArcStructure(plan), totalChapters, from, to, writingLanguage)
  return block ? `${guide}\n\n${block}` : guide
}

/**
 * 渲染注入块。`parsed` 为空（例如作者用的是枚举故事结构、没有三层弧光）时返回空串 ——
 * 不注入、不干扰，行为与从前完全一致。
 */
export function renderArcPositionBlock(
  parsed: ParsedArcStructure | null,
  totalChapters: number,
  from: number,
  to: number,
  writingLanguage: WritingLanguage,
): string {
  const span = arcSpanForChapters(parsed, totalChapters, from, to)
  if (!parsed || !span) return ''
  const en = writingLanguage === 'en-US'
  const spec = span.midFields.map(([name, value]) => `${name}：${value}`).join('；')
  const rescale = arcStructureNeedsRescale(parsed, totalChapters)
    ? (en
        ? ` (the arc structure totals ${parsed.declaredTotal} chapters; chapter positions below are scaled to the book's ${totalChapters})`
        : `（弧光合计 ${parsed.declaredTotal} 章，以下章号已按全书 ${totalChapters} 章等比折算）`)
    : ''
  const remaining = span.remainingMids.length
    ? span.remainingMids
        .map(item => (en
          ? `mid arc ${item.name} (ch. ${item.range[0]}–${item.range[1]}) — ${item.gist}`
          : `中弧【${item.name}】（约第 ${item.range[0]}–${item.range[1]} 章）— ${item.gist}`))
        .join('\n  - ')
    : (en ? '(none — this is the last mid arc of the major arc)' : '（无 —— 这是本大弧的最后一个中弧）')

  const crossing = span.nextMidBoundary !== null && span.nextMidName
    ? (en
        ? `\n★ This batch crosses a mid-arc boundary: chapter ${span.nextMidBoundary} onward belongs to mid arc ${span.nextMidName}. Write that part from the NEW mid arc's spec — but do not pull in anything from the mid arcs after it.`
        : `\n★ 本批跨越中弧边界：第 ${span.nextMidBoundary} 章起属于 中弧【${span.nextMidName}】。跨过边界后按**新中弧**的规格写，但**不得**连带把更后面的中弧内容提前。`)
    : ''

  return en
    ? `[ARC POSITION for this batch — derived from the arc structure, for placement only]
- This batch: chapters ${from}–${to} of ${totalChapters}${rescale}
- Major arc ${span.majorIndex} "${span.majorName}" (approx. ch. ${span.majorRange[0]}–${span.majorRange[1]})
- Mid arc ${span.midIndex} "${span.midName}" (approx. ch. ${span.midRange[0]}–${span.midRange[1]})${spec ? ` | ${spec}` : ''}
- Remaining mid arcs inside this major arc (do NOT execute them early):
  - ${remaining}
[HARD RULE — this failure has actually happened]
1. Advance only what is still unplayed inside "${span.midName}".
2. The goal / attempts / turning point of any LATER mid arc must NOT happen in this batch — they belong to chapter ${span.nextMidBoundary ?? span.midRange[1] + 1} and beyond.
3. If this batch reaches the turning point of the current mid arc, close it out and ease into the next minor arc; do not jump to the next mid arc's goal.${crossing}`
    : `【本批所处弧位（据「弧光结构」推算，仅用于定位，不改变弧光本身）】
- 本批范围：第 ${from}–${to} 章（全书 ${totalChapters} 章）${rescale}
- 所在大弧：大弧${span.majorIndex}【${span.majorName}】（约第 ${span.majorRange[0]}–${span.majorRange[1]} 章）
- 所在中弧：中弧${span.midIndex}【${span.midName}】（约第 ${span.midRange[0]}–${span.midRange[1]} 章）${spec ? `｜${spec}` : ''}
- 本大弧内**后续**中弧（★ 本批不得提前执行）：
  - ${remaining}
【硬约束·防提前】（实测已发生过，务必遵守）
1. 本批只推进【${span.midName}】内**尚未发生**的内容；
2. 后续中弧的「目标 / 尝试 / 转折」**不得在本批提前实现** —— 它们属于第 ${span.nextMidBoundary ?? span.midRange[1] + 1} 章及以后；
3. 若本批已写到当前中弧的转折点，请在此收束并向下一小弧过渡，**不要**跳到下一个中弧的目标。${crossing}`
}
