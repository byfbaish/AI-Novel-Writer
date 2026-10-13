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
  /**
   * 本批**覆盖到的最后一个中弧**的序号（1-based）。
   *
   * ⚠️ 2026-10-14 修复：批 ≤10 章但中弧可能更短，**本批会跨越中弧边界**；此前
   * 只按 `from` 定位本中弧（`midIndex`），导致后半批所属的新中弧**只拿到一句 gist**、
   * 拿不到规格字段 —— 而弧位块的跨界提示恰恰要求"跨过边界后按新中弧的规格写"。
   * 未跨界时 `endMidIndex === midIndex`。
   */
  endMidIndex: number
  midFields: readonly (readonly [string, string])[]
  /** 同一大弧内、位于**本批之后**的剩余中弧（已进入的中弧不算） */
  remainingMids: readonly { name: string; range: readonly [number, number]; gist: string }[]
  /** 本批跨越到下一个中弧时的分界章（含该章起属下一个中弧） */
  nextMidBoundary: number | null
  nextMidName: string | null
  /** 本批之后第一个中弧的起点章；本批已走到本大弧末尾时为 null */
  afterBatchMidBoundary: number | null
}

/**
 * 弧标题的章数标注：`（约 94 章）` 与 `（约 1–94 章）` **两种都要认**。
 *
 * ⚠️ 2026-10-13 修复（既有缺陷）：原正则的章数捕获只有 `([0-9]+)`，只认单值；
 * 而内置模板 `builtin-prompt-templates.ts:680/704` 给模型的**格式示范本身就写区间**
 * （`## 大弧一：<名称>（约 X–Y 章）`，中弧 `:685` 写单值 `（约 N 章）`）。
 * 作者按模板产出 → 大弧全是区间 → 捕获失败 → `chapters` 全为 0 → 整个结构被
 * `usable` 过滤为空 → **`parseArcStructure` 恒返回 `null`**，弧位块与弧光裁剪
 * **从未生效过**，且失败是静默的（返回 null 后调用方直接跳过）。
 *
 * 区间取 `末 − 首 + 1`：它同时是"该弧含多少章"，与单值标注语义一致。
 */
const CHAPTER_COUNT = '([0-9]+)(?:[\\t ]*[–—~～-][\\t ]*([0-9]+))?[\\t ]*章'
const MAJOR_HEADING = new RegExp(`^#{2,3}[\\t ]*大弧[^：:]*[：:][\\t ]*(.+?)[\\t ]*(?:（[\\t ]*约?[\\t ]*${CHAPTER_COUNT}[\\t ]*）)?[\\t ]*$`, 'u')
const MID_HEADING = new RegExp(`^#{3,4}[\\t ]*中弧[\\t ]*[0-9]*[\\t ]*[：:][\\t ]*(.+?)[\\t ]*(?:（[\\t ]*约?[\\t ]*${CHAPTER_COUNT}[\\t ]*）)?[\\t ]*$`, 'u')
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
 * 从标题捕获组算出该弧的章数。
 * - `start` 缺失（标题没写章数）→ null（该条被丢弃）。
 * - 单值形式 `（约 100 章）` → 章数就是 100（**不是**区间长度）。
 * - 区间形式 `（约 1–94 章）` → 章数 = `末 − 首 + 1`。
 * - 乱序或非正数 → null（该条被丢弃）。
 */
function headingChapterCount(start: string | undefined, end: string | undefined): number | null {
  if (start === undefined) return null
  const first = Number(start)
  if (!Number.isSafeInteger(first) || first < 1) return null
  if (end === undefined) return first
  const last = Number(end)
  if (!Number.isSafeInteger(last) || last < first) return null
  return last - first + 1
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
    const majorChapters = majorMatch ? headingChapterCount(majorMatch[2], majorMatch[3]) : null
    if (majorMatch && majorChapters !== null) {
      major = { name: stripBrackets(majorMatch[1]!), chapters: majorChapters, fields: [], mids: [] }
      majors.push(major as ArcMajor)
      mid = null
      continue
    }
    const midMatch = MID_HEADING.exec(line)
    const midChapters = midMatch ? headingChapterCount(midMatch[2], midMatch[3]) : null
    if (midMatch && midChapters !== null && major) {
      mid = { name: stripBrackets(midMatch[1]!), chapters: midChapters, fields: [] }
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

  // 本批覆盖到哪个中弧为止：批 ≤10 章，中弧可能更短 → 本批会跨越边界。
  // `to` 超出本大弧时按本大弧最后一个中弧算（跨大弧的部分由下一个大弧的 `span` 负责）。
  const withinMajorEnd = Math.min(to, majorRange[1])
  const lastCovered = major.mids.findIndex((_, index) => (
    withinMajorEnd - majorRange[0] + 1 <= midBounds[index + 1]!
  ))
  const endMidIndex = lastCovered < 0 ? major.mids.length - 1 : Math.max(lastCovered, midIndex)
  const afterBatch = major.mids[endMidIndex + 1]
  const afterBatchMidBoundary = afterBatch ? majorRange[0] + midBounds[endMidIndex + 1]! : null

  return Object.freeze({
    majorIndex: majorIndex + 1,
    majorName: major.name,
    majorRange,
    midIndex: midIndex + 1,
    midName: mid.name,
    midRange,
    endMidIndex: endMidIndex + 1,
    midFields: mid.fields,
    remainingMids: major.mids.slice(endMidIndex + 1).map((item, offset) => Object.freeze({
      name: item.name,
      range: [majorRange[0] + midBounds[endMidIndex + 1 + offset]!, majorRange[0] + midBounds[endMidIndex + 2 + offset]! - 1] as const,
      gist: gistOf(item.fields),
    })),
    nextMidBoundary: nextMidBoundary !== null && nextMidBoundary <= to ? nextMidBoundary : null,
    nextMidName: next ? next.name : null,
    afterBatchMidBoundary,
  })
}

/** 结构里是否声明了与全书章数不同的合计（用于在注入文本里声明折算）。 */
export function arcStructureNeedsRescale(parsed: ParsedArcStructure | null, totalChapters: number): boolean {
  return !!parsed && parsed.declaredTotal > 0 && parsed.declaredTotal !== totalChapters
}

/** `- **接续理由**：…` / `- Continuation reason: …` —— 大弧之间的推进理由（B 档要保留）。 */
const CONTINUATION_REASON = /^[-*][\t ]*\*{0,2}(接续理由|Continuation reason|Why this arc follows)\*{0,2}[\t ]*[：:]/iu

function isContinuationReasonLine(line: string): boolean {
  return CONTINUATION_REASON.test(line)
}

/**
 * 在一段中弧正文里挑出**唯一的**一句话定位行（与 `gistOf` 同口径：优先
 * 因果 / 目标 / 动机，否则取第一条内容字段）。返回**原始行**而非截断值 ——
 * 投影只减少"给多少"，不改写作者原文。
 */
function pickGistLine(lines: readonly string[]): string | null {
  let first: string | null = null
  for (const rawLine of lines) {
    const match = FIELD_LINE.exec(rawLine.trim())
    if (!match) continue
    const name = toText(match[1]!)
    if (SKIP_FIELDS.has(name)) continue
    if (!toText(match[2]!)) continue
    if (/因果|目标|动机|Causality|Goal|Motivation/u.test(name)) return rawLine
    if (first === null) first = rawLine
  }
  return first
}

/**
 * 「弧光结构」文本的**分级裁剪**（P0-0b，B 档尺度）。
 *
 * 动机：大纲每批只写 ≤10 章，却携带**全书**弧光结构（实测 12,513 字 / 全书 185 章）。
 * 裁剪按与本批的关系分三级：
 *
 * | 位置 | 保留 |
 * |---|---|
 * | 本批**覆盖到**的中弧（`midIndex … endMidIndex`） | 全字段（本批的执行依据；跨边界时含新进入的中弧） |
 * | 本大弧内其他中弧 | 中弧标题 + 一句话定位（与 `remainingMids` 同形） |
 * | 其他大弧 | 大弧标题 + **接续理由**（弧与弧之间为什么这样接，是作者的规划意图） |
 * | 首个大弧之前的引言 | 原样保留 |
 *
 * **这是投影不是改写**：保留的每一行都是作者原文，只删不改。裁剪后仍由
 * `renderArcPositionBlock` 追加【本批所处弧位】硬约束块。
 *
 * 结构不可解析或本批定位不出弧位时**原样返回** —— 与 `parseArcStructure` 的失败姿态一致。
 */
export function projectArcStructureText(plan: string, span: ArcSpan): string {
  const lines = plan.split(/\r?\n/u)
  const out: string[] = []
  let majorIndex = 0
  let midIndex = 0
  let mode: 'preamble' | 'current-major' | 'other-major' = 'preamble'
  let currentMid = false
  let midBuffer: string[] | null = null

  const flushMidBuffer = () => {
    if (midBuffer === null) return
    const picked = pickGistLine(midBuffer)
    if (picked !== null) out.push(picked)
    midBuffer = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const majorMatch = MAJOR_HEADING.exec(line)
    if (majorMatch?.[2]) {
      flushMidBuffer()
      majorIndex += 1
      midIndex = 0
      currentMid = false
      mode = majorIndex === span.majorIndex ? 'current-major' : 'other-major'
      out.push(rawLine)
      continue
    }
    const midMatch = MID_HEADING.exec(line)
    if (midMatch?.[2] && majorIndex > 0) {
      flushMidBuffer()
      midIndex += 1
      // 本批**覆盖到**的中弧全部保留全字段 —— 批可能跨越中弧边界，后半批的执行依据是
      // 最后一个中弧的规格（弧位块的跨界提示也要求"按新中弧的规格写"，见 `endMidIndex`）。
      currentMid = mode === 'current-major' && midIndex >= span.midIndex && midIndex <= span.endMidIndex
      // 其他大弧只保留大弧级信息（标题 + 接续理由），中弧一律不注入。
      if (mode === 'other-major') continue
      // 本大弧内、非本中弧的：降级为「中弧标题 + 一句话定位」。
      if (!currentMid) midBuffer = []
      out.push(rawLine)
      continue
    }
    if (mode === 'preamble') {
      out.push(rawLine)
      continue
    }
    if (mode === 'other-major') {
      // 其他大弧只留"为什么这样接"；中弧细节与其余字段一律不注入。
      if (isContinuationReasonLine(line)) out.push(rawLine)
      continue
    }
    if (midBuffer !== null) {
      midBuffer.push(rawLine)
      continue
    }
    // 本大弧的大弧级字段，或本中弧正文 —— 全字段保留。
    out.push(rawLine)
  }
  flushMidBuffer()
  return out.join('\n').trim()
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
 * 大纲步骤的**唯一注入入口**（P0-0b）：先按本批弧位分级裁剪弧光结构，再追加弧位硬约束块。
 *
 * 与 `withArcPositionGuide` 的区别只在"裁"这一步：定位不出弧位（结构不可解析 /
 * 本批越界）时不裁剪，退化为改造前行为。
 */
export function withProjectedArcGuide(
  guide: string,
  plan: string | null | undefined,
  totalChapters: number,
  from: number,
  to: number,
  writingLanguage: WritingLanguage,
): string {
  const parsed = parseArcStructure(plan)
  const span = arcSpanForChapters(parsed, totalChapters, from, to)
  const trimmed = span && plan ? projectArcStructureText(plan, span) : guide
  const block = renderArcPositionBlock(parsed, totalChapters, from, to, writingLanguage)
  return block ? `${trimmed}\n\n${block}` : trimmed
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
        ? `\n★ This batch crosses a mid-arc boundary: chapter ${span.nextMidBoundary} onward belongs to mid arc ${span.nextMidName}. Write that part from the NEW mid arc's spec (its full spec is in the arc structure above) — but do not pull in anything from the mid arcs after it.`
        : `\n★ 本批跨越中弧边界：第 ${span.nextMidBoundary} 章起属于 中弧【${span.nextMidName}】。跨过边界后按**新中弧**的规格写（其完整规格见上方「弧光结构」中的该中弧），但**不得**连带把更后面的中弧内容提前。`)
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
2. The goal / attempts / turning point of any mid arc AFTER this batch must NOT happen in this batch — they belong to chapter ${span.afterBatchMidBoundary ?? span.midRange[1] + 1} and beyond.
3. If this batch reaches the turning point of the current mid arc, close it out and ease into the next minor arc; do not jump to the next mid arc's goal.${crossing}`
    : `【本批所处弧位（据「弧光结构」推算，仅用于定位，不改变弧光本身）】
- 本批范围：第 ${from}–${to} 章（全书 ${totalChapters} 章）${rescale}
- 所在大弧：大弧${span.majorIndex}【${span.majorName}】（约第 ${span.majorRange[0]}–${span.majorRange[1]} 章）
- 所在中弧：中弧${span.midIndex}【${span.midName}】（约第 ${span.midRange[0]}–${span.midRange[1]} 章）${spec ? `｜${spec}` : ''}
- 本大弧内**后续**中弧（★ 本批不得提前执行）：
  - ${remaining}
【硬约束·防提前】（实测已发生过，务必遵守）
1. 本批只推进【${span.midName}】内**尚未发生**的内容；
2. 本批之后的中弧，「目标 / 尝试 / 转折」**不得在本批提前实现** —— 它们属于第 ${span.afterBatchMidBoundary ?? span.midRange[1] + 1} 章及以后；
3. 若本批已写到当前中弧的转折点，请在此收束并向下一小弧过渡，**不要**跳到下一个中弧的目标。${crossing}`
}
