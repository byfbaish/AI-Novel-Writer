/**
 * B′ 双写：空间—钟点的**结构对结构**校验器（实施清单 §3 T10）。
 *
 * 设计边界（Q4 / 判据 ⑫）：
 * - **只比结构**：空间名逐字比对、钟点纯数字比较。**不做任何中文时段推断** ——
 *   不认「下午两点」，只认 `14:00`；不认「早上」，只认 `07:00-09:00`。
 * - **两侧任缺结构化字段 ⇒ 不判**（fail-open）。设定层没给机读行、或蓝图没给
 *   `timeRef` 时，我们**没有**可判定形式，此时判「冲突」就是凭猜测定罪。
 * - 唯一能在缺字段时仍成立的判据是「引用了未登记的空间名」—— 但它同样有前提：
 *   设定层**至少登记过一个**空间。一条机读行都没有时，整层没给可判定形式，
 *   此时一个名字都不该被指为「未登记」（否则旧项目全量误报）。
 *
 * 本模块是纯函数，无 IO、无副作用（守「绝不自动执行」）。
 */

import { parseSpaceHours } from './space-machine-line'

/** 分钟数（自 00:00 起）。区间跨零点时 `start > end`。 */
export interface TimeWindow {
  start: number
  end: number
}

/** 设定层登记的一个空间（第 4 维的机读行）。 */
export interface SpaceRule {
  space: string
  /**
   * 可判定的每日窗口。以下情况为 undefined（该空间的钟点不可判定）：
   * 未声明 `hours=`；或声明的是按月/跨日窗口（`每月D日…`）—— 那需要月历换算，
   * 本系统不做历法推演，因此显式未判而不是硬算。
   */
  hours?: TimeWindow
  /** 声明原文，仅用于 finding 取证。 */
  hoursRaw?: string
  /** `entry=` 的原文（本校验器不判定准入，只随证据带出）。 */
  entry?: string
}

/** 蓝图侧的一条空间引用。 */
export interface BlueprintSpaceRef {
  space: string
  /** 单点或区间；未声明时为 undefined —— 该引用不可判定。 */
  timeRef?: TimeWindow
  timeRefRaw?: string
  beat?: string
}

/**
 * 落库形态的空间引用：**原样保留作者/模型给的字符串**（不预先解析成分钟数）。
 *
 * 与 `keyEvents` 同一理由：存储列存的是"作者写了什么"，解析只在判定时做。
 * 这样 `hours=`/`timeRef` 的原始写法能一路带到 finding 取证里，也便于作者在编辑器里改。
 */
export interface BlueprintSpaceRefRaw {
  space: string
  timeRef?: string
  beat?: string
}

/**
 * 归一化落库形态的 `spaceRefs`（写入路径唯一入口）。
 *
 * fail-open：非数组、非法条目、缺 `space` 一律丢弃，**不抛错** —— 蓝图的
 * `spaceRefs` 是可选伴随字段，它坏了不该废掉整条蓝图提交。
 */
export function normalizeBlueprintSpaceRefs(raw: unknown): BlueprintSpaceRefRaw[] {
  let source: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (!trimmed.startsWith('[')) return []
    try {
      source = JSON.parse(trimmed)
    } catch { return [] }
  }
  if (!Array.isArray(source)) return []
  return source.flatMap((item): BlueprintSpaceRefRaw[] => {
    if (!isRecord(item)) return []
    const space = typeof item.space === 'string' ? item.space.trim() : ''
    if (!space) return []
    const timeRef = typeof item.timeRef === 'string' ? item.timeRef.trim() : ''
    const beat = typeof item.beat === 'string' ? item.beat.trim() : ''
    return [{
      space,
      ...(timeRef ? { timeRef } : {}),
      ...(beat ? { beat } : {}),
    }]
  })
}

/** 落库形态 ⇒ 判定形态。 */
export function toBlueprintSpaceRefs(raw: readonly BlueprintSpaceRefRaw[]): BlueprintSpaceRef[] {
  return normalizeSpaceRefs(raw)
}

/** finding 的**冲突源层级**：告诉作者该改哪一层，而不是无差别地改当前章。 */
export type ConsistencySourceLayer = 'world-building' | 'blueprint'

export interface SpaceTimeFinding {
  stableFactKey: string
  severity: 'warning' | 'info'
  sourceChapter: number
  sourceLayer: ConsistencySourceLayer
  evidence: string
  issue: { zhCN: string; enUS: string }
  suggestion: { zhCN: string; enUS: string }
}

/** 机读行的分隔符：全角 `｜`（U+FF5C）为主，半角 `|` 一并接受。 */
const FIELD_SEPARATOR = /[｜|]/u

/** `HH:MM`（24 小时制，严格两位）。刻意不接 `9:00` / `9点` —— 那是语义推断。 */
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/u

/** 区间连接符：半角/全角连字符、en dash、波浪号。 */
const RANGE_SEPARATOR = /[-–—~～]/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** `HH:MM` ⇒ 分钟数；任何不合形（含 `24:00`、`9:00`、散文）一律 undefined。 */
function clockMinutes(raw: string): number | undefined {
  const match = CLOCK.exec(raw.trim())
  if (!match) return undefined
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * 解析一个钟点表达式：`14:00`（单点）或 `14:00-16:00`（区间）。
 * 解析不了就返回 undefined（fail-open，绝不猜测）。
 */
export function parseTimeWindow(raw: unknown): TimeWindow | undefined {
  if (typeof raw !== 'string') return undefined
  const parts = raw.trim().split(RANGE_SEPARATOR).map(part => part.trim()).filter(Boolean)
  if (parts.length === 1) {
    const point = clockMinutes(parts[0]!)
    return point === undefined ? undefined : { start: point, end: point }
  }
  if (parts.length === 2) {
    const start = clockMinutes(parts[0]!), end = clockMinutes(parts[1]!)
    return start === undefined || end === undefined ? undefined : { start, end }
  }
  return undefined
}

/**
 * 从世界观正文里抽出**已登记的空间机读行**。
 *
 * 只认「首段是空间名 + 后续段是 `key=value`」的行，且 `key` 必须是 `hours` / `entry`：
 * 这样散文行、以及【具名人物登记】的 `人名｜定位｜口吻｜关系` 行（无 `=`）都不会被误收。
 * 同一空间重复登记时**后一条覆盖前一条**（与"命名固定唯一"的要求一致，且不静默合并矛盾规则）。
 */
export function parseSpaceRules(worldBuildingText: string | null | undefined): SpaceRule[] {
  if (typeof worldBuildingText !== 'string' || !worldBuildingText.trim()) return []
  const byName = new Map<string, SpaceRule>()
  for (const line of worldBuildingText.split(/\r?\n/u)) {
    const segments = line.split(FIELD_SEPARATOR).map(segment => segment.trim())
    if (segments.length < 2) continue
    const space = segments[0]!.replace(/^[\s\-*•·]+/u, '').trim()
    if (!space || space.length > 200) continue
    const rule: SpaceRule = { space }
    let machineReadable = false
    for (const segment of segments.slice(1)) {
      const match = /^(hours|entry)\s*=\s*(.*)$/u.exec(segment)
      if (!match) continue
      machineReadable = true
      const value = match[2]!.trim()
      if (match[1] === 'hours') {
        rule.hoursRaw = value
        // 只有「每日 / 当日 HH:MM-HH:MM」能落到 TimeWindow。
        // `每月D日…` 与跨日区间需要「当月第几日」，本系统不做历法推演 ⇒ 保持 undefined，
        // 由判定层产出 info「未提供可判定形式」，而不是把它当成缺失或当成合规。
        const parsed = parseSpaceHours(value)
        rule.hours = parsed.kind === 'daily' ? { start: parsed.start, end: parsed.end } : undefined
      } else if (value) rule.entry = value
    }
    // 没有 `hours=` / `entry=` 的行不是机读行 —— 不收，避免把散文当成登记。
    if (!machineReadable) continue
    byName.set(space, rule)
  }
  return [...byName.values()]
}

/**
 * 归一化蓝图侧的 `spaceRefs`。
 *
 * 与 `normalizeKeyEvents` 同法接双形态：数组（主形态）或 `JSON.stringify` 过的串（存储列）。
 * 其余（undefined / 数字 / 非法 JSON）一律 `[]` —— 不抛错、不猜语义。
 */
export function normalizeSpaceRefs(raw: unknown): BlueprintSpaceRef[] {
  let source: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('[')) return []
    try {
      const parsed: unknown = JSON.parse(trimmed)
      source = parsed
    } catch { return [] }
  }
  if (!Array.isArray(source)) return []
  return source.flatMap((item): BlueprintSpaceRef[] => {
    if (!isRecord(item)) return []
    const space = typeof item.space === 'string' ? item.space.trim() : ''
    if (!space) return []
    const timeRefRaw = typeof item.timeRef === 'string' ? item.timeRef.trim() : ''
    const beat = typeof item.beat === 'string' ? item.beat.trim() : ''
    return [{
      space,
      ...(timeRefRaw ? { timeRefRaw, timeRef: parseTimeWindow(timeRefRaw) } : {}),
      ...(beat ? { beat } : {}),
    }]
  })
}

/** 钟点是否落在营业窗口内。跨零点（`start > end`）按「晚段或早段」判。 */
export function isWithinWindow(point: number, window: TimeWindow): boolean {
  return window.start <= window.end
    ? point >= window.start && point <= window.end
    : point >= window.start || point <= window.end
}

/**
 * 与连续性 finding 同一套键算法（FNV-1a 64），但用**独立前缀** `space:` ——
 * 两族 finding 的豁免互不串扰（豁免按 `stableFactKey` 精确匹配）。
 */
export function spaceTimeStableFactKey(parts: readonly string[]): string {
  const identity = parts.map(part => part.trim().replace(/\s+/gu, ' ')).join(':')
  let hash = 0xcbf29ce484222325n
  for (const character of identity) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return `space:${hash.toString(16).padStart(16, '0')}`
}

export interface SpaceTimeValidationInput {
  chapterNumber: number
  /** 设定层原文（世界观产出）。 */
  worldBuildingText: string | null | undefined
  /** 蓝图侧的结构化空间引用（数组或存储列 JSON 串）。 */
  spaceRefs: unknown
}

/**
 * 校验一条蓝图的空间引用是否与设定层的空间登记自洽。
 *
 * 判定顺序（先判可判定的，再降级为 info）：
 * 1. 设定层**一条机读行都没有** ⇒ 整层不可判定，返回 `[]`（不误报"未登记"）；
 * 2. 空间名逐字命中（trim 后全等）⇒ 未命中判 **warning**「引用了未登记的空间名」；
 * 3. 命中但该空间**未声明 `hours`**，或引用**未声明 `timeRef`** ⇒ 记一条 **info**
 *    「未提供可判定形式」，**不阻塞**；
 * 4. 两者都有 ⇒ 纯数字比较；越界判 **warning**。
 *
 * 返回顺序稳定（按 `spaceRefs` 原序），便于测试与界面展示。
 */
export function findSpaceTimeConflicts(input: SpaceTimeValidationInput): SpaceTimeFinding[] {
  const chapterNumber = Number.isSafeInteger(input.chapterNumber) && input.chapterNumber >= 0 ? input.chapterNumber : 0
  const rules = parseSpaceRules(input.worldBuildingText)
  if (!rules.length) return []
  const byName = new Map(rules.map(rule => [rule.space, rule]))
  const refs = normalizeSpaceRefs(input.spaceRefs)

  return refs.flatMap((ref): SpaceTimeFinding[] => {
    const rule = byName.get(ref.space)
    if (!rule) {
      return [{
        stableFactKey: spaceTimeStableFactKey(['unregistered-space', String(chapterNumber), ref.space]),
        severity: 'warning' as const,
        sourceChapter: chapterNumber,
        sourceLayer: 'blueprint' as const,
        evidence: `spaceRefs.space = ${ref.space}`,
        issue: {
          zhCN: `本章蓝图引用了空间「${ref.space}」，但世界观第 4 维【空间结构】里没有逐字登记这个名字。`,
          enUS: `This chapter's blueprint references the space “${ref.space}”, but dimension 4 (spatial structure) of the world setting does not register that exact name.`,
        },
        suggestion: {
          zhCN: `把蓝图里的空间名改成设定层登记过的写法，或在世界观第 4 维补登记「${ref.space}」的机读行（\`${ref.space}｜hours=HH:MM-HH:MM｜entry=…\`）。冲突源在**世界观**层 —— 只改第 ${chapterNumber} 章不会解决。`,
          enUS: `Either rename the space in the blueprint to a registered spelling, or add a machine-readable line for “${ref.space}” in dimension 4 (\`${ref.space}｜hours=HH:MM-HH:MM｜entry=…\`). The conflict originates in the **world setting** — editing only chapter ${chapterNumber} will not resolve it.`,
        },
      }]
    }
    // 缺任一结构化字段 ⇒ 没有可判定形式：只记 info，绝不判冲突（判据 ⑫）。
    if (rule.hours === undefined || ref.timeRef === undefined) {
      // 三种「不可判定」必须分开说，否则作者会照着错的提示去补一个本来就在的东西：
      // ① 世界观完全没声明 hours=；
      // ② 声明了，但写的是「每月D日…」这类按月/跨日窗口 —— 需要「故事第几日 → 当月第几日」的
      //    月历换算。本项目不做历法推演（背景是为剧情服务，不是模拟世界），所以显式未判；
      // ③ 世界观给了每日窗口，蓝图没给 timeRef。
      const missingHours = rule.hoursRaw === undefined
      const monthlyWindow = !missingHours && rule.hours === undefined
      return [{
        stableFactKey: spaceTimeStableFactKey(['undecidable-time', String(chapterNumber), ref.space, ref.timeRefRaw ?? '']),
        severity: 'info' as const,
        sourceChapter: chapterNumber,
        sourceLayer: rule.hours === undefined ? 'world-building' as const : 'blueprint' as const,
        evidence: `space=${ref.space}｜hours=${rule.hoursRaw ?? '(未声明)'}｜timeRef=${ref.timeRefRaw ?? '(未声明)'}`,
        issue: {
          zhCN: `空间「${ref.space}」的钟点无法判定：${missingHours ? '世界观未给该空间的 `hours=`' : monthlyWindow ? `该空间登记的是按月窗口（${rule.hoursRaw}），判断它需要月历换算，本系统不做历法推演` : '蓝图未给该引用的 `timeRef`'}。未提供可判定的每日窗口，因此不判冲突。`,
          enUS: `The time window for “${ref.space}” cannot be judged: ${missingHours ? 'the world setting declares no `hours=` for this space' : monthlyWindow ? `this space is registered with a monthly window (${rule.hoursRaw}), which would need calendar conversion; this system does not simulate calendars` : 'the blueprint declares no `timeRef` for this reference'}. No decidable daily window was provided, so no conflict is reported.`,
        },
        suggestion: {
          zhCN: missingHours
            ? `若确实需要判定，请在世界观第 4 维给「${ref.space}」补一行 \`${ref.space}｜hours=HH:MM-HH:MM\`；不需要判定则忽略本条。`
            : monthlyWindow
              ? `这条不用补 —— 按月窗口本来就不做自动判定，请作者自己盯「${ref.space}」在剧情里被使用的日期；若希望它变成可判定的，把它改成每日窗口 \`hours=HH:MM-HH:MM\`。`
              : `若确实需要判定，请在本章蓝图给该引用补 \`timeRef\`（24 小时制「HH:MM」或「HH:MM-HH:MM」）；不需要判定则忽略本条。`,
          enUS: missingHours
            ? `If a check is actually wanted, add \`${ref.space}｜hours=HH:MM-HH:MM\` in dimension 4 of the world setting; otherwise ignore this.`
            : monthlyWindow
              ? `Nothing to add here — monthly windows are deliberately not auto-judged; keep an eye on when “${ref.space}” is used in the story. To make it checkable, rewrite it as a daily window (\`hours=HH:MM-HH:MM\`).`
              : `If a check is actually wanted, add a \`timeRef\` to this reference in the blueprint (\`HH:MM\` or \`HH:MM-HH:MM\`, 24-hour); otherwise ignore this.`,
        },
      }]
    }
    const window = rule.hours, ref0 = ref.timeRef
    const outside = [ref0.start, ref0.end].filter(point => !isWithinWindow(point, window))
    if (!outside.length) return []
    const label = ref0.start === ref0.end ? `单点 ${ref.timeRefRaw}` : `区间 ${ref.timeRefRaw}`
    return [{
      stableFactKey: spaceTimeStableFactKey(['time-outside-window', String(chapterNumber), ref.space, ref.timeRefRaw ?? '']),
      severity: 'warning' as const,
      sourceChapter: chapterNumber,
      sourceLayer: 'blueprint' as const,
      evidence: `space=${ref.space}｜hours=${rule.hoursRaw ?? ''}｜timeRef=${ref.timeRefRaw ?? ''}${ref.beat ? `｜beat=${ref.beat}` : ''}`,
      issue: {
        zhCN: `本章蓝图把「${ref.space}」安排在 ${label}，但世界观登记的该空间时段是 ${rule.hoursRaw}（${outside.length > 1 ? '两端都' : '该钟点'}落在窗口外）。`,
        enUS: `This chapter's blueprint places “${ref.space}” at ${label}, but the world setting registers that space as open ${rule.hoursRaw} (${outside.length > 1 ? 'both ends fall' : 'that time falls'} outside the window).`,
      },
      suggestion: {
        zhCN: `把该引用的 \`timeRef\` 移到 ${rule.hoursRaw} 之内，或调整世界观里该空间的 \`hours=\`。冲突源在**空间规则**层，不要靠改正文绕开。`,
        enUS: `Move this reference's \`timeRef\` inside ${rule.hoursRaw}, or adjust the space's \`hours=\` in the world setting. The conflict originates in the **space rule** — do not work around it in the prose.`,
      },
    }]
  })
}
