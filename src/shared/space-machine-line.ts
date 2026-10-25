/**
 * 空间机读行（`名称｜hours=…｜entry=…`）：解析、与表格规则对账、生成作者复核清单。
 * 2026-10-22（S-空间 试行）。
 *
 * ## 为什么需要「两者结合」
 *
 * 作者的第 4 维同时写了**三列表格**（语义：准入、离开限制、行为义务、截止日、环境）
 * 和**机读行**（算术：开放窗口）。两者分工不同，谁也替代不了谁：
 *
 * | 载体 | 装什么 | 谁消费 |
 * |---|---|---|
 * | 表格「关键规则」列 | 语义：不得离开、必须回避、25 日前登记、夜间零下 | 模型（经 `extractSpaceConstraints` 摘进 prompt） |
 * | 机读行 `hours=` | 只装「窗口」：什么时候能进 | 纯函数判定 |
 *
 * 实测（作者真实数据）发现的失效形态：`执法殿｜hours=14:00-16:00` 实际是**申请窗口**，
 * 不是空间开放时段 —— 压成一个 `hours` 之后，判定会把「16:00 后进审讯室」误判为违规。
 * 这类**语义压缩**机器判不了，只能进作者复核清单。
 *
 * ## 边界
 *
 * - 只解析**窗口**，不判断"某事件是否越界"（那需要「事件时空锚点」，目前无来源）。
 * - 解析失败一律 `unreadable`：**不猜、不当合规**（判据 CL：缺数据必须显式「未判」）。
 * - 不修改世界观正文、不写库。
 *
 * ## 两档 severity + 三态窗口（2026-10-26，作者两轮实测后定）
 *
 * 作者真实数据：10 个空间报 7 处待确认，其中 5 条是「一次性场景没写 hours」、2 条是「约束装不下」。
 * 第一版把前者降级成提示，被作者当场否掉且理由成立：**分级声明是模型自己写的**，
 * 给一切空间贴「低频」就能免于时间判定（实测 5 个自评低频里至少 3 个明显会复发）。
 *
 * 作者的第二句话给出了正确的轴：「不是所有地图都有窗口期」。缺的不是容错，是**第三种表达** ——
 * `entry=` 写满而 `hours=` 缺失的行是二义的：「漏写」与「本来就不适用」长得一样。于是：
 *
 * | 写法 | 含义 | 判定 |
 * |---|---|---|
 * | `hours=HH:MM-HH:MM` | 有时段 | 参与钟点判定 |
 * | `hours=none` | 显式声明无时段概念（低敏感区/通过型场景） | 不报、不判定 |
 * | 不写 `hours=` | 缺失（漏写或还没决定） | **报 `no-hours`，要作者二选一** |
 *
 * 分级只改**措辞**（一次性场景多给一句「若确实没有时段概念就写 hours=none」），不减免条数。
 * `rule-not-encoded` 与 `end-of-day-2400` 固定为 `info`：这两类作者既补不了也关不掉，计进「待确认」
 * 只会把真正的漏写淹掉。计数只有一处实现（`spaceAuditCounts`），面板与步骤日志共用。
 */

import { extractSpaceConstraints } from './space-constraints'

type Language = 'zh-CN' | 'en-US'

/** 当日分钟数上限（24:00 作为结束时刻的规范值）。 */
const MINUTES_PER_DAY = 24 * 60
/**
 * 「极短窗口」阈值：分钟。
 *
 * 定 10 而不是 30：签到/打卡这类窗口本身就可能只有半小时，30 分钟是正常设计不是笔误
 * （实测作者数据里 06:00-06:30 的签到窗被误报过一次）。真正可疑的是「十分钟以内」，
 * 那更像是把瞬时事件（传送开启）写成了开放时段。
 */
const SHORT_WINDOW_MINUTES = 10

export type ParsedSpaceHours =
  | { kind: 'daily'; start: number; end: number; note?: string }
  | { kind: 'monthly'; day: number; start: number; end: number; note?: string }
  | { kind: 'day-range'; startDay: number; start: number; endDay: number; end: number; note?: string }
  /** 显式声明「这个空间没有时段概念」（低敏感区、通过型场景）。**不是**漏写。 */
  | { kind: 'none' }
  | { kind: 'unreadable'; reason: string }

/** 一条机读行。 */
export interface SpaceMachineLine {
  name: string
  /** 原始 hours 值（没有该字段时为 null）。 */
  hours: string | null
  /** 原始 entry 值。 */
  entry: string | null
  /** 原始行（供作者定位）。 */
  raw: string
}

/**
 * issue 的处置档。
 *
 * - `attention`：**需要作者动手**。计入「N 处待确认」，缺了就是真的缺（漏写窗口、区间倒置、
 *   两处时间不一致、表里有这个空间却没机读行）。
 * - `info`：**设计内提示**，作者没事可做。典型两类：① 机读行按设计就装不下的语义约束
 *   （`rule-not-encoded`）—— 它的事实归属是 prompt 里的规则原文，报出来只是告诉作者
 *   「这条不走机器判定」；② 已经归一过的写法（`end-of-day-2400`）；③ 声明为一次性/低频
 *   场景却缺 `hours` —— 一次性场景没有「开放窗口」这回事，缺是正确状态。
 *
 * 分开的理由（2026-10-26，作者实测反馈「空间检查没有容错」）：两档混在一个计数里，
 * 作者确认过的固定项会**每次刷新都重新数一遍**，7 条一堆、永远清不掉，于是这一节被
 * 训练成"看见就跳过"—— 真正的漏写（两处时间不一致）反而没人看。
 */
export type SpaceAuditSeverity = 'attention' | 'info'

/**
 * 空间的出场分级：长期舞台 vs 一次性/低频场景。
 *
 * 世界观模板第 4 维要求「说明哪些空间是长期舞台、哪些是一次性场景」（`builtin-prompt-templates.ts`
 * 第 4 维），因此这是一条**模板声明过的结构**，不是从散文里猜语义。
 */
export type SpaceStage = 'recurring' | 'one-off'

/** `extractSpaceStaging` 的产出。`declared=false` 时调用方**必须**保持原判定（fail-open）。 */
export interface SpaceStaging {
  /** 分级声明是否覆盖到至少一个真实空间名。 */
  declared: boolean
  /** 归一化空间名 → 分级。未被声明的空间不在表里。 */
  byName: ReadonlyMap<string, SpaceStage>
}

export type SpaceAuditIssueKind =
  /** 表格里有这个空间，机读行里没有。 */
  | 'missing-machine-line'
  /** 机读行里有，表格里没有（表格是语义权威）。 */
  | 'missing-table-entry'
  /** hours 解析不了。 */
  | 'hours-unreadable'
  /** hours 与表格规则里写的时间不一致。 */
  | 'hours-mismatch'
  /** 窗口 ≤ 30 分钟，疑笔误。 */
  | 'short-window'
  /** 结束不晚于开始（同日），或跨日区间倒置。 */
  | 'inverted-range'
  /** 用了 24:00，已按当日结束处理。 */
  | 'end-of-day-2400'
  /** 机读行只有 entry、没有 hours（自由进出时正常，其余需确认）。 */
  | 'no-hours'
  /** 表格规则里有 entry 装不下的约束（离开限制 / 行为义务 / 截止日 / 环境条件）。 */
  | 'rule-not-encoded'
  /** hours 可能是"申请/办理窗口"而不是空间开放时段。 */
  | 'window-semantics-ambiguous'

export interface SpaceAuditIssue {
  kind: SpaceAuditIssueKind
  /** `attention` 计入「待确认」；`info` 只是设计内提示，不需要作者动手。 */
  severity: SpaceAuditSeverity
  /** 空间名；无法定位到具体空间时为空串。 */
  space: string
  /** 给作者看的具体说明（含原文片段或数值）。 */
  detail: string
}

export interface SpaceLocationAudit {
  /** 表格/bold 摘到的空间数。 */
  tableSpaces: number
  /** 机读行数。 */
  machineLines: number
  issues: SpaceAuditIssue[]
  /** 世界观为空或一个空间都没识别到。 */
  unreadable: boolean
}

function toMinutes(hour: number, minute: number): number | null {
  if (!Number.isSafeInteger(hour) || !Number.isSafeInteger(minute)) return null
  if (minute < 0 || minute > 59) return null
  // 24:00 是唯一被容忍的越界写法（表示"到当日结束"），其它一律算不可读。
  if (hour === 24 && minute === 0) return MINUTES_PER_DAY
  if (hour < 0 || hour > 23) return null
  return hour * 60 + minute
}

function formatMinutes(value: number): string {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const SEP = '[\\-—~至]'

const DAILY_PATTERN = new RegExp(`^(?:当日|每日|每天)?\\s*(\\d{1,2}):(\\d{2})\\s*${SEP}\\s*(\\d{1,2}):(\\d{2})$`, 'u')
const DAY_RANGE_PATTERN = new RegExp(
  `^每月\\s*(\\d{1,2})\\s*日\\s*(\\d{1,2}):(\\d{2})\\s*${SEP}\\s*(\\d{1,2})\\s*日\\s*(\\d{1,2}):(\\d{2})$`,
  'u',
)
const MONTHLY_PATTERN = new RegExp(
  `^每月\\s*(\\d{1,2})\\s*日\\s*(\\d{1,2}):(\\d{2})\\s*${SEP}\\s*(\\d{1,2}):(\\d{2})$`,
  'u',
)

/**
 * 解析 `hours=` 的值。支持三种窗口形态 + 一种显式「无时段」：
 *
 * - `HH:MM-HH:MM` / `当日HH:MM-HH:MM` / `每日…`  → `daily`
 * - `每月DD日HH:MM-HH:MM`                        → `monthly`
 * - `每月DD日HH:MM-DD日HH:MM`                    → `day-range`
 * - `none`（大小写不敏感）                        → `none` = 作者声明「本空间无时段概念」
 *
 * `24:00` 作为结束时刻被容忍（`note` 里说明），其余越界一律 `unreadable`。
 *
 * 为什么要有 `none`：`entry=` 写满、`hours=` 缺失的行是**二义**的 —— 「漏写」与「本来就不适用」
 * 长得一模一样。作者实测的一句话点破了这件事：**不是所有地图都有窗口期**（低敏感区、通过型场景
 * 本来就没有开放时间）。但机器没有第三种表达，就只能把两者都报成「缺窗口」，报到最后没人看。
 * 加一个显式取值，机器就能把「没写」和「写了不适用」分开 —— 前者是漏，后者是决定。
 */
export function parseSpaceHours(raw: string): ParsedSpaceHours {
  const text = raw.trim()
  if (!text) return { kind: 'unreadable', reason: 'hours 为空' }
  if (/^none$/iu.test(text)) return { kind: 'none' }

  const dayRange = DAY_RANGE_PATTERN.exec(text)
  if (dayRange) {
    const startDay = Number(dayRange[1])
    const start = toMinutes(Number(dayRange[2]), Number(dayRange[3]))
    const endDay = Number(dayRange[4])
    const end = toMinutes(Number(dayRange[5]), Number(dayRange[6]))
    if (start === null || end === null) return { kind: 'unreadable', reason: '钟点越界' }
    return { kind: 'day-range', startDay, start, endDay, end }
  }

  const monthly = MONTHLY_PATTERN.exec(text)
  if (monthly) {
    const day = Number(monthly[1])
    const start = toMinutes(Number(monthly[2]), Number(monthly[3]))
    const end = toMinutes(Number(monthly[4]), Number(monthly[5]))
    if (start === null || end === null) return { kind: 'unreadable', reason: '钟点越界' }
    return { kind: 'monthly', day, start, end }
  }

  const daily = DAILY_PATTERN.exec(text)
  if (daily) {
    const start = toMinutes(Number(daily[1]), Number(daily[2]))
    const end = toMinutes(Number(daily[3]), Number(daily[4]))
    if (start === null || end === null) return { kind: 'unreadable', reason: '钟点越界' }
    const note = end === MINUTES_PER_DAY ? '24:00 已按当日结束处理' : undefined
    return { kind: 'daily', start, end, ...(note ? { note } : {}) }
  }

  return { kind: 'unreadable', reason: '不是「每日/当月日 + 钟点区间」的可识别写法' }
}

/** 从世界观正文里抽机读行。半角 `|` 也接受（模型常写半角），但不收以 `|` 开头的表格行。 */
export function extractSpaceMachineLines(worldbuilding: string | null | undefined): SpaceMachineLine[] {
  if (!worldbuilding) return []
  const lines = worldbuilding.replace(/\r\n?/gu, '\n').split('\n')
  const result: SpaceMachineLine[] = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('|') || line.startsWith('#') || line.startsWith('-')) continue
    const separator = line.includes('｜') ? '｜' : (line.includes('|') && line.includes('=') ? '|' : null)
    if (!separator) continue
    const parts = line.split(separator).map(part => part.trim())
    if (parts.length < 2) continue
    const name = parts[0]
    if (!name || name.includes('=')) continue
    const fields = new Map<string, string>()
    for (const part of parts.slice(1)) {
      const match = /^([A-Za-z_]+)\s*=\s*(.+)$/u.exec(part)
      if (match) fields.set(match[1].toLowerCase(), match[2].trim())
    }
    if (fields.size === 0) continue
    result.push({
      name,
      hours: fields.get('hours') ?? null,
      entry: fields.get('entry') ?? null,
      raw: line,
    })
  }
  return result
}

/** 表格规则里出现的第一个 `HH:MM-HH:MM`，用于和机读行比对。 */
const RULE_TIME_RANGE = new RegExp(`(\\d{1,2}):(\\d{2})\\s*${SEP}\\s*(\\d{1,2}):(\\d{2})`, 'u')

/** 规则里"entry 装不下"的约束类型。 */
const UNENCODABLE_HINTS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /不得|禁止|严禁|不许/u, label: '禁止/离开限制' },
  { pattern: /必须|应当/u, label: '行为义务' },
  { pattern: /前完成|前登记|截止|之前/u, label: '截止日' },
  { pattern: /零下|酷寒|高温|瘴气|剧毒/u, label: '环境条件' },
]

/** 规则里出现这些词，且 hours 存在 ⇒ 该 hours 可能装的是申请/办理窗口。 */
const APPLICATION_WINDOW_HINT = /申请|受理|办理|登记时间|接待窗口/u

/** entry 里出现这些词 ⇒ 缺 hours 是合理的（自由进出）。 */
const FREE_ACCESS_HINT = /自由|无限制|不限|任意进出|开放/u

/** 分级提示词：长期舞台侧。 */
const RECURRING_STAGE_HINT = /长期舞台|长期场景|复访场景|反复出现的空间|反复出场/u
/** 分级提示词：一次性/低频侧。 */
const ONE_OFF_STAGE_HINT = /一次性|低频|单次到访|过场场景/u

/**
 * 判断一段文字把空间归到哪一级。
 *
 * 两侧都出现时取**最后出现的那个**：模板要求把分级写在条目末尾，汇总句也写在整段末尾，
 * 所以「后出现的声明」才是结论（「…长期舞台。低频/一次性场景。」这类混写里，后者生效）。
 */
function stageOfText(text: string): SpaceStage | null {
  const recurring = RECURRING_STAGE_HINT.exec(text)
  const oneOff = ONE_OFF_STAGE_HINT.exec(text)
  if (!recurring && !oneOff) return null
  if (recurring && !oneOff) return 'recurring'
  if (oneOff && !recurring) return 'one-off'
  return (oneOff as RegExpExecArray).index > (recurring as RegExpExecArray).index ? 'one-off' : 'recurring'
}

/** 分级声明里的名字清洗：去 markdown、去句读、去「等」；不是名字的碎句返回空串。 */
function cleanStageName(raw: string): string {
  const cleaned = raw
    .replace(/[*_`]/gu, '')
    .replace(/^[\s（(【]+/u, '')
    .replace(/[\s）)】。、，,：:；;]+$/u, '')
    .replace(/等$/u, '')
    .trim()
  if (!cleaned || cleaned.length > 20) return ''
  // 声明句里的说明词不是空间名（「一次性场景」「哪些空间」会被切成这种碎句）。
  if (/场景|空间|哪些|说明|条目|本条|本维/u.test(cleaned)) return ''
  return cleaned
}

/** 形态 1：逐条后缀（`**碑坪**：…。长期舞台。`）。 */
function stagingFromEntries(text: string): Map<string, SpaceStage> {
  const found = new Map<string, SpaceStage>()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const bold = /^(?:[-*+]\s*)?\*\*(.+?)\*\*/u.exec(line)
    if (!bold) continue
    const stage = stageOfText(line)
    if (!stage) continue
    const name = cleanStageName(bold[1])
    if (name) found.set(normalizeName(name), stage)
  }
  return found
}

/** 形态 2：汇总句（`长期舞台：碑坪、断脉岭矿洞。低频/一次性：内门活脉、山门。`）。 */
function stagingFromDeclarations(text: string): Map<string, SpaceStage> {
  const found = new Map<string, SpaceStage>()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    for (const clause of line.split(/[。；;]/u)) {
      const stage = stageOfText(clause)
      if (!stage) continue
      const colon = clause.search(/[：:]/u)
      if (colon < 0) continue
      for (const part of clause.slice(colon + 1).split(/[、，,／/]/u)) {
        const name = cleanStageName(part)
        if (name) found.set(normalizeName(name), stage)
      }
    }
  }
  return found
}

/**
 * 抽「长期舞台 / 一次性场景」的分级声明。
 *
 * 为什么需要它：`no-hours` 原先对所有缺 `hours` 的空间一视同仁 —— 但一次性场景
 * （山门、下山道、试药房）**本来就没有开放窗口**，报「请确认是全天开放还是漏写」
 * 是假警报。作者实测 10 个空间里 5 个是一次性场景，7 条提示里 5 条来自这个误判。
 *
 * 边界：**只用于降级、不用于升级**。识别到的分级只能把 `no-hours` 从「待确认」降到
 * 「提示」，永远不会让一条本该报的问题消失；识别不到（`declared=false`）时调用方
 * 保持原判定 —— 解析失败绝不放行（判据 CL：缺数据必须显式「未判」，不能当合规）。
 */
export function extractSpaceStaging(worldbuilding: string | null | undefined): SpaceStaging {
  const byName = new Map<string, SpaceStage>()
  if (!worldbuilding) return { declared: false, byName }
  const text = worldbuilding.replace(/\r\n?/gu, '\n')
  for (const [name, stage] of stagingFromEntries(text)) byName.set(name, stage)
  // 汇总句后写：同一空间两处冲突时以汇总句为准（它是一条显式清单，不是散文里的顺带一提）。
  for (const [name, stage] of stagingFromDeclarations(text)) byName.set(name, stage)
  return { declared: byName.size > 0, byName }
}

/**
 * 表格规则 × 机读行 对账。
 *
 * 只做结构对结构的检查：**不判定任何剧情事件是否越界**，也**不猜**规则语义。
 */
export function auditSpaceLocations(worldbuilding: string | null | undefined): SpaceLocationAudit {
  const tableEntries = extractSpaceConstraints(worldbuilding)
  const machineLines = extractSpaceMachineLines(worldbuilding)
  if (tableEntries.length === 0 && machineLines.length === 0) {
    return { tableSpaces: 0, machineLines: 0, issues: [], unreadable: true }
  }

  const issues: SpaceAuditIssue[] = []
  const byName = new Map<string, SpaceMachineLine>()
  for (const line of machineLines) byName.set(normalizeName(line.name), line)
  const tableNames = new Set(tableEntries.map(entry => normalizeName(entry.name)))

  /**
   * 分级声明只在**命中真实空间名**时才生效。
   *
   * 两条独立的失效保护：① 抽不到声明 ⇒ `declared=false`，一切照原判定；
   * ② 抽到了但一个名字都对不上（散文里顺带提到「一次性」被误吃）⇒ 同样不生效。
   * 少了这两道，一次解析漂移就会把真正的漏写静默降级成「提示」。
   */
  const staging = extractSpaceStaging(worldbuilding)
  const stagingUsable = staging.declared
    && [...staging.byName.keys()].some(name => byName.has(name) || tableNames.has(name))
  const stageOf = (space: string): SpaceStage | null =>
    (stagingUsable ? staging.byName.get(normalizeName(space)) ?? null : null)

  // 1) 表格有、机读行没有
  for (const entry of tableEntries) {
    if (!byName.has(normalizeName(entry.name))) {
      issues.push({
        kind: 'missing-machine-line',
        severity: 'attention',
        space: entry.name,
        detail: '表格里写了这个空间的规则，但机读行里没有它 ⇒ 窗口无法参与判定。',
      })
    }
  }

  // 2) 机读行有、表格没有
  for (const line of machineLines) {
    if (!tableNames.has(normalizeName(line.name))) {
      issues.push({
        kind: 'missing-table-entry',
        severity: 'attention',
        space: line.name,
        detail: '只有机读行、表格里没有这个空间 ⇒ 没有语义规则可参照，只有窗口。',
      })
    }
  }

  // 3) 逐条解析 + 与表格时间比对
  const ruleByName = new Map(tableEntries.map(entry => [normalizeName(entry.name), entry.rule]))
  for (const line of machineLines) {
    const rule = ruleByName.get(normalizeName(line.name)) ?? ''

    if (line.hours === null) {
      const freeAccess = line.entry ? FREE_ACCESS_HINT.test(line.entry) : false
      if (!freeAccess) {
        // **缺字段一律报**，不管它是长期舞台还是自评一次性：机器分不清「漏写」与「不适用」，
        // 而分不清就必须问（判据 CL）。自评分级只用来把问题问得更准，不用来免检 ——
        // 否则模型给一切空间贴「低频」就能让整期检查名存实亡（作者 2026-10-26 当面指出）。
        const oneOff = stageOf(line.name) === 'one-off'
        issues.push({
          kind: 'no-hours',
          severity: 'attention',
          space: line.name,
          detail: oneOff
            ? '该空间自评为「一次性/低频」但没有 hours ⇒ 若它确实没有时段概念（低敏感区、通过型场景），'
              + '请把机读行写成 hours=none 显式声明；若它会再次出现，请补窗口。现在「没写」两者都算。'
            : '机读行既没有 hours 也没有 hours=none ⇒ 请写窗口，或写 hours=none 声明「本空间无时段概念」。',
        })
      }
    } else {
      const parsed = parseSpaceHours(line.hours)
      if (parsed.kind === 'none') {
        // 显式「无时段」：作者已经做过决定，不算漏写、不参与窗口判定。
      } else if (parsed.kind === 'unreadable') {
        issues.push({
          kind: 'hours-unreadable',
          severity: 'attention',
          space: line.name,
          detail: `hours="${line.hours}" 解析不了（${parsed.reason}）⇒ 本次按「未判」处理，不当合规。`,
        })
      } else {
        if (parsed.kind === 'daily' && parsed.note) {
          issues.push({
            kind: 'end-of-day-2400',
            severity: 'info',
            space: line.name,
            detail: `hours="${line.hours}"：${parsed.note}。`,
          })
        }
        if (parsed.kind === 'day-range' && parsed.endDay < parsed.startDay) {
          issues.push({
            kind: 'inverted-range',
            severity: 'attention',
            space: line.name,
            detail: `hours="${line.hours}"：结束日早于开始日，跨月区间暂不支持。`,
          })
        }

        const duration = logicalDuration(parsed)
        if (duration !== null) {
          if (duration <= 0) {
            issues.push({
              kind: 'inverted-range',
              severity: 'attention',
              space: line.name,
              detail: `hours="${line.hours}"：结束不晚于开始；若想表达跨夜请拆成两段。`,
            })
          } else if (duration <= SHORT_WINDOW_MINUTES) {
            issues.push({
              kind: 'short-window',
              severity: 'attention',
              space: line.name,
              detail: `hours="${line.hours}" 只有 ${duration} 分钟 —— 若这是瞬时事件（如传送开启）则正常，若是开放时段请确认不是笔误。`,
            })
          }
        }

        // 与表格规则里写的时间比对（只比第一个 HH:MM-HH:MM，且两边都能解析时）
        const ruleRange = RULE_TIME_RANGE.exec(rule)
        if (ruleRange && parsed.kind === 'daily') {
          const ruleStart = toMinutes(Number(ruleRange[1]), Number(ruleRange[2]))
          const ruleEnd = toMinutes(Number(ruleRange[3]), Number(ruleRange[4]))
          if (ruleStart !== null && ruleEnd !== null && (ruleStart !== parsed.start || ruleEnd !== parsed.end)) {
            issues.push({
              kind: 'hours-mismatch',
              severity: 'attention',
              space: line.name,
              detail: `表格写 ${formatMinutes(ruleStart)}-${formatMinutes(ruleEnd)}，机读行写 ${line.hours} ⇒ 两处不一致。`,
            })
          }
        }
      }
    }

    // 4) 语义压缩：规则是"申请/办理窗口"，但被压成了空间开放 hours
    //    `hours=none` 不算"有窗口"，所以这一条对它不适用。
    if (line.hours !== null && !/^none$/iu.test(line.hours.trim()) && APPLICATION_WINDOW_HINT.test(rule)) {
      issues.push({
        kind: 'window-semantics-ambiguous',
        severity: 'attention',
        space: line.name,
        detail: '表格里的时间是「申请/受理/办理」窗口，机读行却当成空间开放时段 ⇒ 判定前请确认这两者是不是一回事。',
      })
    }

    // 5) 规则里有 entry 装不下的约束
    if (rule) {
      const hits = UNENCODABLE_HINTS.filter(hint => hint.pattern.test(rule)).map(hint => hint.label)
      if (hits.length > 0) {
        issues.push({
          kind: 'rule-not-encoded',
          // 设计内提示，不是待办：这条约束的归属地就是 prompt 里的规则原文，
          // 作者既无法「补齐」也无法「关掉」它 —— 计数只会把真正的漏写淹掉。
          severity: 'info',
          space: line.name,
          detail: `规则含「${hits.join('、')}」，机读行装不下 ⇒ 只能靠 prompt 里的规则原文。`,
        })
      }
    }
  }

  // 6) 「自评一次性/低频」不再单独成条：分级只影响 `no-hours` 的措辞，不再是免检依据。
  //    免检的唯一凭据是**显式** `hours=none` —— 作者做过的决定，而不是模型贴的标签。

  return {
    tableSpaces: tableEntries.length,
    machineLines: machineLines.length,
    issues,
    unreadable: false,
  }
}

/**
 * 两个计数：`attention` 进「N 处待确认」，`info` 只作为设计内提示展示。
 *
 * 唯一实现放在这里：面板（`summarizeSpaceAudit`）与步骤日志（`describeSpaceReviewChecklist`）
 * 都调它 —— 两处各数一遍，迟早会出现「面板说 0 处、日志说 7 处」。
 */
export function spaceAuditCounts(audit: SpaceLocationAudit): { attention: number; info: number } {
  let attention = 0
  let info = 0
  for (const issue of audit.issues) {
    if (issue.severity === 'info') info += 1
    else attention += 1
  }
  return { attention, info }
}

function normalizeName(name: string): string {
  return name.replace(/[\s·・._-]/gu, '').toLocaleLowerCase('zh-CN')
}

/** 窗口的逻辑时长（分钟）；跨日区间按整天累加。仅用于「过短/倒置」体检，不参与跨章判定。 */
function logicalDuration(parsed: ParsedSpaceHours): number | null {
  if (parsed.kind === 'daily' || parsed.kind === 'monthly') return parsed.end - parsed.start
  if (parsed.kind === 'day-range') {
    return (parsed.endDay - parsed.startDay) * MINUTES_PER_DAY + (parsed.end - parsed.start)
  }
  return null
}

/**
 * issue 标签的唯一来源。
 *
 * 导出而不是让 UI 层各抄一份：同一批 kind 在两处维护，改一处忘一处就会
 * 「日志说『极短窗口』、面板说『窗口过短』」—— 判据 DG 的同型问题。
 */
export const SPACE_AUDIT_ISSUE_LABELS: Record<SpaceAuditIssueKind, { zh: string; en: string }> = {
  'missing-machine-line': { zh: '缺机读行', en: 'No machine line' },
  'missing-table-entry': { zh: '缺表格条目', en: 'No table entry' },
  'hours-unreadable': { zh: '窗口解析失败', en: 'Unreadable window' },
  'hours-mismatch': { zh: '两处时间不一致', en: 'Window mismatch' },
  'short-window': { zh: '极短窗口', en: 'Very short window' },
  'inverted-range': { zh: '区间倒置', en: 'Inverted range' },
  'end-of-day-2400': { zh: '24:00 已归一', en: '24:00 normalized' },
  'no-hours': { zh: '缺窗口', en: 'Missing window' },
  'rule-not-encoded': { zh: '约束装不下', en: 'Constraint not encodable' },
  'window-semantics-ambiguous': { zh: '窗口语义待确认', en: 'Window semantics unclear' },
}

/**
 * 生成「作者复核清单」：机器能判的逐条列出，机器判不了的给出固定复核项。
 *
 * 为什么不是一份通用 checklist：本书的真实问题（申请窗口、离开限制、截止日）
 * 只有对着数据才点得出来；通用清单作者看两眼就会跳过。
 *
 * 计数口径（2026-10-26）：只数 `attention`。`info` 汇总成一句「设计内提示」——
 * 逐条列出来会把真正的漏写埋掉，而它们本来就没有可执行动作。
 */
export function describeSpaceReviewChecklist(
  audit: SpaceLocationAudit,
  language: Language,
  maxItems = 6,
): string {
  if (audit.unreadable) {
    return language === 'en-US'
      ? 'No space table or machine line was recognized in the world-building, so the space check did not run.'
      : '世界观里没识别到空间表格或机读行，本次未做空间检查。'
  }

  const zh = language !== 'en-US'
  const { attention, info } = spaceAuditCounts(audit)
  const pending = audit.issues.filter(issue => issue.severity !== 'info')
  const hints = audit.issues.filter(issue => issue.severity === 'info')
  const head = zh
    ? `空间检查：表格 ${audit.tableSpaces} 个空间 / 机读行 ${audit.machineLines} 条，${attention} 处需要确认（不阻断写作）。`
    : `Space check: ${audit.tableSpaces} table space(s) / ${audit.machineLines} machine line(s); ${attention} item(s) to confirm (does not block drafting).`

  const hintLine = (): string => {
    if (hints.length === 0) return ''
    const byKind = new Map<SpaceAuditIssueKind, number>()
    for (const issue of hints) byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1)
    const parts = [...byKind.entries()].map(([kind, count]) => `${zh ? SPACE_AUDIT_ISSUE_LABELS[kind].zh : SPACE_AUDIT_ISSUE_LABELS[kind].en} ×${count}`)
    return zh
      ? `另有 ${hints.length} 条设计内提示（${parts.join('、')}），不需要处理。`
      : `Plus ${hints.length} informational note(s) (${parts.join(', ')}), no action needed.`
  }

  if (attention === 0) {
    const tail = zh
      ? '未发现需确认的结构问题。仍需人工确认一项：机读行 hours 装的是「空间开放时段」，不是「申请/办理窗口」。'
      : 'No structural issue needs confirmation. One manual check remains: whether each hours window is the space\u2019s opening time rather than an application window.'
    return [head, tail, hintLine()].filter(Boolean).join('\n')
  }

  const visible = pending.slice(0, Math.max(1, maxItems))
  const lines = visible.map((issue, index) => {
    const label = zh ? SPACE_AUDIT_ISSUE_LABELS[issue.kind].zh : SPACE_AUDIT_ISSUE_LABELS[issue.kind].en
    return zh
      ? `${index + 1}. 【${label}】${issue.space || '（未定位）'}：${issue.detail}`
      : `${index + 1}. [${label}] ${issue.space || '(unlocated)'}: ${issue.detail}`
  })
  const rest = pending.length - visible.length
  if (rest > 0) {
    lines.push(zh ? `…另 ${rest} 处同类，未逐条展开。` : `... ${rest} more of the same kind not listed.`)
  }
  if (info > 0) lines.push(hintLine())

  const manual = zh
    ? [
      '人工复核固定项（机器判不了）：',
      '① 每条 hours 是「空间开放时段」还是「申请/办理窗口」——两者压成一个字段会误判；',
      '② 规则里的截止日、离开限制、行为义务，机读行装不下 ⇒ 确认这些已写进表格原文（会随 prompt 下发）。',
    ]
    : [
      'Always check by hand (not machine-decidable):',
      '① whether each hours window is the space opening time or an application window;',
      '② deadlines, exit limits and behavioural duties cannot fit in the machine line — confirm they stay in the table text (which is sent to the model).',
    ]

  return [head, ...lines, '', ...manual].filter(line => line !== '').join('\n')
}
