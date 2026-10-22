/**
 * 事件时空锚点（`space anchor`）：**把「这一章发生在哪儿、什么时点、第几日」从散文里拎出来，
 * 再拿它去撞空间的开放窗口**。
 *
 * 存在理由（2026-10-22，S-空间）：
 * - `space-machine-line.ts` 已经把世界观第 4 维的 `hours=` 解析成窗口，但**没有事件锚点**，
 *   所以只能对账「表格 × 机读行」，判不了「某事件是否越界」（该文件 §边界 明确写着这一条）。
 * - `story-day-anchor.ts` 已经从章节要点的「时间定位」里取到**整数日序**，但只有日、没有钟点。
 *
 * ## 锚点实际从哪来（2026-10-22 调查结论，别把它当成设想）
 *
 * | 来源 | 文件 | 有没有时空锚点 |
 * |---|---|---|
 * | 章节要点 `summary_snapshots.chapter_notes` | `src/services/builtin-prompt-templates.ts`（`generate_chapter_notes`）<br>`src/services/prompt-language.ts`（英文版） | **只有「时间定位／Time anchor」一节**（故事日、书中写法、依据）。模板**没有**「地点／空间／场景」栏目 |
 * | 审稿报告 v3 `stateDelta` | `src/shared/review-generation-report.ts`、`src/services/builtin-prompt-templates.ts` | 只有**角色级** `field: 'location'` + 自由文本 `observed`，没有章级空间名 |
 * | 定稿连续性事实 `continuity_facts` | `src/shared/finalized-continuity-facts.ts` | **不存在**地点字段，只有自由文本 `statement`（`category` 是按关键词粗分类） |
 * | 蓝图 `spaceRefs` | `src/shared/space-time-consistency.ts`、`blueprints.structured_refs` | **有**：`{ space, timeRef, beat }`，但是**写前计划**，且已由 `findSpaceTimeConflicts` 判定过 |
 *
 * 因此本模块**不假装要点里有地点栏目**：
 * 1. 日序直接复用 `parseStoryDayAnchor`（不重复实现，也不改它）；
 * 2. 时点只在「时间定位／Time anchor」**一节内**、且**独占一行标签**（`时段／时辰／时点／时刻／Time of day`）时才认，
 *    取不到就是 `null`；模板没这个栏目，所以实测大多数章节会是 `null` —— 这是**正确**的缺失，不是 bug；
 * 3. 地点只认**显式栏目**（`## 地点` / `## 空间` / `## 场景` / `## Location` …）。模板不产出这一节，
 *    所以默认 `places = []`。想让地点有内容，调用方必须自己交出白名单（`knownSpaces`，见下）。
 *
 * ## 三条契约
 *
 * 1. **缺数据显式未判**（判据 CL）：`evaluateSpaceAccess` 在时点缺失、空间名对不上、`hours` 解析不了、
 *    窗口按日历日定义而锚点只有日序时，一律返回 `unknown`，**绝不返回 `inside`**。
 * 2. **不换算中文时段词**：「黄昏」「辰时」原样保留，判定时返回 `unknown` 并给出原因 ——
 *    换算需要时区、季节、作者口径，猜一次就会把错误当证据。
 * 3. **不猜地点**：默认不从正文里抽名字。`knownSpaces` 是**逐字包含匹配**的白名单扫描，只在调用方
 *    明确给出名单时启用，且它只说明「这章提到了这个已登记空间」，不说明「这就是本章场景」。
 */
import { parseSpaceHours } from './space-machine-line'
import { parseStoryDayAnchor, STORY_DAY_SECTION_HEADINGS } from './story-day-anchor'

/**
 * 章节要点里的地点类栏目名（中英双语）。
 *
 * `空间锚点` / `Scene anchors`：章节要点模板自 2026-10-22 起正式产出这一节
 * （`generate_chapter_notes`），其余别名兼容模型自己加的小节。
 */
export const SPACE_PLACE_SECTION_HEADINGS = [
  '地点',
  '空间',
  '场景',
  '空间锚点',
  'Scene anchors',
  '地点与空间',
  '场景与地点',
  'Location',
  'Locations',
  'Place',
  'Places',
  'Scene',
  'Scenes',
] as const

/** 「时间定位」一节里承载钟点/时段的行标签（只能在那一节内出现，避免跨栏目抓时间）。 */
export const SPACE_TIME_OF_DAY_LABELS = [
  '时段',
  '时辰',
  '时点',
  '时刻',
  'Time of day',
  'Clock time',
] as const

/** 一章的时空锚点。任一项取不到就是 `null` / `[]`，**不填默认值**。 */
export interface ChapterSpaceAnchor {
  /** 距 t0 的天数（t0 = 0）；复用 `parseStoryDayAnchor`，缺失为 `null`。 */
  dayOffset: number | null
  /** 原文时点（`14:30` 或「黄昏」「辰时」这类词），缺失为 `null`；**不做任何换算**。 */
  timeOfDay: string | null
  /** 显式点名 / 白名单命中的空间名，逐字保留；缺失为 `[]`。 */
  places: string[]
}

export interface ParseChapterSpaceAnchorOptions {
  /**
   * 已登记空间名单（世界观第 4 维机读行的名字）。
   *
   * 给出时，在整份要点里做**逐字包含匹配**并把命中的空间并入 `places`；
   * 不给就完全不扫正文（默认行为，避免把「路过某地」当成「本章场景」）。
   */
  knownSpaces?: readonly string[]
}

export type SpaceAccessVerdict = 'inside' | 'outside' | 'unknown'

export interface SpaceAccessResult {
  verdict: SpaceAccessVerdict
  /** 人读原因（判定依据或「为什么未判」），**必须**能直接贴给作者看。 */
  reason: string
}

export interface SpaceAccessOptions {
  /** 已登记空间名单；非空时，`spaceName` 必须逐字命中其中一项，否则 `unknown`。 */
  knownSpaces?: readonly string[]
}

const ANY_HEADING_PATTERN = /^#{1,6}\s+/
const TIME_ANCHOR_HEADING_PATTERN = headingPattern(STORY_DAY_SECTION_HEADINGS)
const PLACE_HEADING_PATTERN = headingPattern(SPACE_PLACE_SECTION_HEADINGS)

/** 单点钟点：`9:00` / `09:00` / `23:59`。刻意不收 `24:00`（它是「当日结束」，不是事件时点）。 */
const CLOCK_POINT_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/u
const LABELLED_PLACE_PATTERN = new RegExp(
  `^(?:[-*•]\\s*)?(?:${['地点', '空间', '场景', '位置', 'location', 'place', 'scene', 'setting'].join('|')})\\s*[:：]\\s*(.+)$`,
  'iu',
)
const BULLET_PATTERN = /^(?:[-*•]|\d+[.)、])\s*(.+)$/u
const TABLE_HEADER_CELL_PATTERN = /^(?:地点|空间|场景|位置|location|places?|scenes?|setting)$/iu
const EMPTY_PLACE_PATTERN = /^(?:无|未定|暂无|不详|无明示|none|n\/?a|—|-)$/iu
const SENTENCE_PUNCTUATION_PATTERN = /[。！？!?；;]/u
/** 地点条目里「名字到此为止」的截断符：冒号后是说明，逗号/分号后是别的信息。 */
const PLACE_STOP_PATTERN = /[：:（(；;，,|｜]/u

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function headingPattern(headings: readonly string[]): RegExp {
  return new RegExp(`^#{1,6}\\s*(?:${headings.map(escapeRegExp).join('|')})\\s*$`, 'iu')
}

/** 取出所有命中标题的**节内行**（到下一个标题为止）。 */
function readSections(notes: string, heading: RegExp): string[] {
  const lines = notes.replace(/\r\n?/gu, '\n').split('\n')
  const sections: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (!heading.test(lines[index]!.trim())) continue
    let end = lines.length
    for (let next = index + 1; next < lines.length; next += 1) {
      if (ANY_HEADING_PATTERN.test(lines[next]!)) { end = next; break }
    }
    sections.push(lines.slice(index + 1, end).join('\n'))
    index = end - 1
  }
  return sections
}

function stripMarkup(value: string): string {
  return value.replace(/[*`]/gu, '').trim()
}

/** 去掉行尾标点与包裹引号；`「黄昏」` / `黄昏。` 都归一成 `黄昏`。 */
function trimValue(value: string): string {
  let text = stripMarkup(value)
  for (let round = 0; round < 2; round += 1) {
    text = text
      .replace(/^[「『“"']/u, '')
      .replace(/[」』”"']$/u, '')
      .replace(/[。；;，,、\s]+$/u, '')
      .trim()
  }
  return text
}

/**
 * 从「时间定位」一节里取时点。只认独占一行的标签，且只在该节内 ——
 * 整份要点别处也会出现钟点（「依据」引的原文、剧情节点里的事件时间），跨栏目抓就是猜。
 */
function parseTimeOfDay(notes: string): string | null {
  const linePattern = new RegExp(
    `^(?:[-*•]\\s*)?(?:${SPACE_TIME_OF_DAY_LABELS.map(escapeRegExp).join('|')})\\s*[:：]\\s*(.+)$`,
    'iu',
  )
  for (const section of readSections(notes, TIME_ANCHOR_HEADING_PATTERN)) {
    for (const rawLine of section.split('\n')) {
      const match = linePattern.exec(rawLine.trim())
      if (!match) continue
      const value = trimValue(match[1]!)
      if (!value) continue
      const clock = CLOCK_POINT_PATTERN.exec(value)
      if (!clock) return value
      return `${clock[1]!.padStart(2, '0')}:${clock[2]!}`
    }
  }
  return null
}

/** 一条地点原文 ⇒ 0..n 个空间名。`执法殿：审讯` 取 `执法殿`；`甲、乙` 拆成两条。 */
function splitPlaceEntries(raw: string, allowBare: boolean): string[] {
  const text = stripMarkup(raw)
  if (!text || EMPTY_PLACE_PATTERN.test(text)) return []
  const stop = text.search(PLACE_STOP_PATTERN)
  const head = (stop >= 0 ? text.slice(0, stop) : text).trim()
  if (!head) return []
  const names = head.split(/[、/]/u).map(part => trimValue(part)).filter(Boolean)
  return names.filter((name) => {
    if (name.length > 40) return false
    if (SENTENCE_PUNCTUATION_PATTERN.test(name)) return false
    // 裸条目没有「地点：」标签兜底，只能靠长度收紧 —— 宁可漏，不可把整句话当地点。
    return allowBare ? name.length <= 24 : true
  })
}

function collectPlaces(section: string): string[] {
  const places: string[] = []
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('|')) {
      const cells = line.split('|').map(cell => cell.trim())
      const first = cells[1] ?? ''
      if (!first || /^[-: ]+$/u.test(first)) continue
      if (TABLE_HEADER_CELL_PATTERN.test(first)) continue
      places.push(...splitPlaceEntries(first, false))
      continue
    }
    const labelled = LABELLED_PLACE_PATTERN.exec(line)
    if (labelled) {
      places.push(...splitPlaceEntries(labelled[1]!, false))
      continue
    }
    const bullet = BULLET_PATTERN.exec(line)
    if (bullet) {
      places.push(...splitPlaceEntries(bullet[1]!, true))
      continue
    }
    // 段落散文不抽名字：这是本模块最容易越界的地方，明确不做。
  }
  return places
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = value.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

/**
 * 在任意文本里找**已登记**的空间名（逐字包含匹配）。
 *
 * 这是一次「提及扫描」，不是「场景归属」判定：被提到的空间会被收进 `places`，
 * 但正文顺带提一句远方地名同样会命中。需要场景归属时请以作者/大纲为准，别拿它当证据。
 * 少于 2 个字的名单项会被跳过（单字地名放进来只会误命中）。
 */
export function findMentionedSpaces(text: string, knownSpaces: readonly string[]): string[] {
  if (!text) return []
  return unique(knownSpaces
    .map(space => space.trim())
    .filter(space => space.length >= 2 && text.includes(space)))
}

/**
 * 从章节要点解析时空锚点。取不到就是 `null` / `[]`，**不猜、不填 0**。
 *
 * 日序复用 `parseStoryDayAnchor`（同一套「只认冒号后的整数」规则），
 * 因此本函数与生成链/审稿链对日序的理解不会分叉。
 */
export function parseChapterSpaceAnchor(
  notes: string,
  options: ParseChapterSpaceAnchorOptions = {},
): ChapterSpaceAnchor {
  const empty: ChapterSpaceAnchor = { dayOffset: null, timeOfDay: null, places: [] }
  if (!notes || !notes.trim()) return empty

  const dayOffset = parseStoryDayAnchor(notes)?.offset ?? null
  const timeOfDay = parseTimeOfDay(notes)
  const structuralPlaces = readSections(notes, PLACE_HEADING_PATTERN).flatMap(collectPlaces)
  const mentionedPlaces = options.knownSpaces?.length
    ? findMentionedSpaces(notes, options.knownSpaces)
    : []

  return {
    dayOffset,
    timeOfDay,
    places: unique([...structuralPlaces, ...mentionedPlaces]),
  }
}

function clockMinutes(raw: string): number | null {
  const match = CLOCK_POINT_PATTERN.exec(raw.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function unknown(reason: string): SpaceAccessResult {
  return { verdict: 'unknown', reason }
}

/**
 * 单点判定：本章的这个时点，落不落在该空间的 `hours=` 窗口内。
 *
 * 只有同时满足下面全部条件时才可能返回 `inside` / `outside`：
 * 1. 有锚点、且 `timeOfDay` 能转成分钟（`HH:MM`，**不含**「黄昏」这类中文时段词）；
 * 2. `hours` 能被 `parseSpaceHours` 解析成 `daily`（`monthly` / `day-range` 需要当月日期，而锚点只有日序）；
 * 3. 给了 `knownSpaces` 时，`spaceName` 在名单内；
 * 4. 锚点列了地点时，`spaceName` 在其中；
 * 5. 锚点日序与调用方给的本章日序不矛盾（两边都有值时必须相等）。
 *
 * `anchor.places` 为空（实测常态，见文件头）**不会**单独导致 `unknown`：此时空间由调用方负责
 * （例如蓝图 `spaceRefs.space`），`reason` 里会写明「按调用方给出的空间判定」。
 * 反过来，`places` 非空但没点名该空间 ⇒ `unknown` —— 那时我们确实有「本章不在这儿」的证据。
 *
 * 跨夜 `daily`（`22:00-02:00`）按「晚段或早段」的并集判定，与 `space-time-consistency.isWithinWindow` 同口径。
 */
export function evaluateSpaceAccess(
  anchor: ChapterSpaceAnchor | null | undefined,
  spaceName: string,
  hours: string | null | undefined,
  dayOffsetOfChapter: number | null,
  options: SpaceAccessOptions = {},
): SpaceAccessResult {
  if (!anchor) return unknown('没有本章时空锚点（章节要点缺失或为空），未判')
  const target = (spaceName ?? '').trim()
  if (!target) return unknown('空间名为空，未判')
  if (!hours || !hours.trim()) return unknown(`空间「${target}」没有 hours=（窗口未声明），未判`)

  const known = unique((options.knownSpaces ?? []).map(space => space.trim()).filter(Boolean))
  if (known.length > 0 && !known.includes(target)) {
    return unknown(`空间「${target}」不在世界观第 4 维登记的机读行名单内，未判`)
  }
  if (anchor.places.length > 0 && !anchor.places.includes(target)) {
    return unknown(`本章要点列出的地点（${anchor.places.join('、')}）里没有「${target}」，未判`)
  }

  if (!anchor.timeOfDay) return unknown('本章要点没有时点（只有日序定不了钟点），未判')
  const point = clockMinutes(anchor.timeOfDay)
  if (point === null) {
    return unknown(`时点「${anchor.timeOfDay}」不是 24 小时制钟点；中文时段词不自行换算，请作者确认后改写为 HH:MM`)
  }

  if (anchor.dayOffset !== null && dayOffsetOfChapter !== null && anchor.dayOffset !== dayOffsetOfChapter) {
    return unknown(`锚点日序（第${anchor.dayOffset}日）与本章日序（第${dayOffsetOfChapter}日）不一致，未判`)
  }
  const dayOffset = anchor.dayOffset ?? dayOffsetOfChapter

  const parsed = parseSpaceHours(hours)
  if (parsed.kind === 'unreadable') return unknown(`hours="${hours}" 解析不了（${parsed.reason}），未判`)
  if (parsed.kind === 'monthly') {
    return unknown(`hours 按「每月 ${parsed.day} 日」定义，锚点只有故事日序、没有当月日期，未判`)
  }
  if (parsed.kind === 'day-range') {
    return unknown(`hours 跨日历日（每月 ${parsed.startDay} 日–${parsed.endDay} 日），锚点没有当月日期，未判`)
  }

  const overnight = parsed.start > parsed.end
  const inside = overnight
    ? point >= parsed.start || point <= parsed.end
    : point >= parsed.start && point <= parsed.end
  const caveat = anchor.places.length === 0 ? '；要点未列地点，按调用方给出的空间判定' : ''
  const dayText = dayOffset === null ? '日序缺失' : `第${dayOffset}日`
  const windowText = `${formatMinutes(parsed.start)}-${formatMinutes(parsed.end)}`
  return {
    verdict: inside ? 'inside' : 'outside',
    reason: `${dayText} ${formatMinutes(point)} 对「${target}」hours=${windowText}：${inside ? '在窗口内' : '在窗口外'}${caveat}`,
  }
}

/**
 * 「空间锚点」一节里的一条场景：地点 + 可选时段。
 *
 * 为什么按场景逐条记、而不是全章只留一个锚点：一章常常跨多个空间（杂役处 → 执法殿），
 * 每个空间各有自己的开放窗口，只留一个就判不全。**时段缺失就是缺失** ——
 * 不拿同章别处的钟点补，也不把「黄昏」折算成 18:00。
 */
export interface ChapterSceneAnchor {
  /** 空间名，逐字保留（章节要点模板要求逐字复制第 4 维的登记名）。 */
  place: string
  /** 原文时点（`06:15` 或「黄昏」这类词）；缺失为 `null`。**不做换算。** */
  timeOfDay: string | null
}

/** 单份要点最多取几条场景锚点（与章节要点模板声明的「最多 3 条」一致）。 */
const MAX_SCENE_ANCHORS = 3

const SCENE_ANCHOR_HEADING_PATTERN = headingPattern(['空间锚点', 'Scene anchors'])

/** `时段：06:15` / `Time: 07:10` —— 取到行尾或下一个分隔符为止。 */
const SCENE_TIME_PATTERN = new RegExp(
  `(?:${['时段', '时辰', '时点', '时刻', 'time', 'clock time'].map(escapeRegExp).join('|')})\\s*[:：]\\s*([^|｜\\n]+)`,
  'iu',
)

/**
 * 解析「空间锚点」一节：每行一条 `场景：<空间名>｜时段：HH:MM`。
 *
 * - 只在**该节内**解析（跨节抓钟点就是猜）；
 * - 空间名走与地点节相同的截断规则（遇到 `｜` / 冒号 / 逗号即止）；
 * - 没有时段就是 `null`，中文时段词原样保留。
 */
export function parseChapterSceneAnchors(notes: string): ChapterSceneAnchor[] {
  if (typeof notes !== 'string' || !notes.trim()) return []
  const scenes: ChapterSceneAnchor[] = []
  for (const section of readSections(notes, SCENE_ANCHOR_HEADING_PATTERN)) {
    for (const rawLine of section.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('|')) continue
      const labelled = LABELLED_PLACE_PATTERN.exec(line)
      const bullet = labelled ? null : BULLET_PATTERN.exec(line)
      const payload = labelled?.[1] ?? bullet?.[1]
      if (!payload) continue
      const places = splitPlaceEntries(payload, false)
      if (places.length === 0) continue
      const timeMatch = SCENE_TIME_PATTERN.exec(payload)
      const timeOfDay = timeMatch ? trimValue(timeMatch[1]!) : null
      for (const place of places) {
        scenes.push({ place, timeOfDay: timeOfDay || null })
        if (scenes.length >= MAX_SCENE_ANCHORS) return scenes
      }
    }
  }
  return scenes
}
