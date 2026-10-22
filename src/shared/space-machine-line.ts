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
 * 解析 `hours=` 的值。支持三种形态：
 *
 * - `HH:MM-HH:MM` / `当日HH:MM-HH:MM` / `每日…`  → `daily`
 * - `每月DD日HH:MM-HH:MM`                        → `monthly`
 * - `每月DD日HH:MM-DD日HH:MM`                    → `day-range`
 *
 * `24:00` 作为结束时刻被容忍（`note` 里说明），其余越界一律 `unreadable`。
 */
export function parseSpaceHours(raw: string): ParsedSpaceHours {
  const text = raw.trim()
  if (!text) return { kind: 'unreadable', reason: 'hours 为空' }

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

  // 1) 表格有、机读行没有
  for (const entry of tableEntries) {
    if (!byName.has(normalizeName(entry.name))) {
      issues.push({
        kind: 'missing-machine-line',
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
        issues.push({
          kind: 'no-hours',
          space: line.name,
          detail: '机读行没有 hours，entry 里也没写"自由进出/不限"⇒ 请确认是全天开放还是漏写。',
        })
      }
    } else {
      const parsed = parseSpaceHours(line.hours)
      if (parsed.kind === 'unreadable') {
        issues.push({
          kind: 'hours-unreadable',
          space: line.name,
          detail: `hours="${line.hours}" 解析不了（${parsed.reason}）⇒ 本次按「未判」处理，不当合规。`,
        })
      } else {
        if (parsed.kind === 'daily' && parsed.note) {
          issues.push({ kind: 'end-of-day-2400', space: line.name, detail: `hours="${line.hours}"：${parsed.note}。` })
        }
        if (parsed.kind === 'day-range' && parsed.endDay < parsed.startDay) {
          issues.push({
            kind: 'inverted-range',
            space: line.name,
            detail: `hours="${line.hours}"：结束日早于开始日，跨月区间暂不支持。`,
          })
        }

        const duration = logicalDuration(parsed)
        if (duration !== null) {
          if (duration <= 0) {
            issues.push({
              kind: 'inverted-range',
              space: line.name,
              detail: `hours="${line.hours}"：结束不晚于开始；若想表达跨夜请拆成两段。`,
            })
          } else if (duration <= SHORT_WINDOW_MINUTES) {
            issues.push({
              kind: 'short-window',
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
              space: line.name,
              detail: `表格写 ${formatMinutes(ruleStart)}-${formatMinutes(ruleEnd)}，机读行写 ${line.hours} ⇒ 两处不一致。`,
            })
          }
        }
      }
    }

    // 4) 语义压缩：规则是"申请/办理窗口"，但被压成了空间开放 hours
    if (line.hours !== null && APPLICATION_WINDOW_HINT.test(rule)) {
      issues.push({
        kind: 'window-semantics-ambiguous',
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
          space: line.name,
          detail: `规则含「${hits.join('、')}」，机读行装不下 ⇒ 只能靠 prompt 里的规则原文。`,
        })
      }
    }
  }

  return {
    tableSpaces: tableEntries.length,
    machineLines: machineLines.length,
    issues,
    unreadable: false,
  }
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
  const head = zh
    ? `空间检查：表格 ${audit.tableSpaces} 个空间 / 机读行 ${audit.machineLines} 条，发现 ${audit.issues.length} 处需要确认（不阻断写作）。`
    : `Space check: ${audit.tableSpaces} table space(s) / ${audit.machineLines} machine line(s); ${audit.issues.length} item(s) to confirm (does not block drafting).`

  if (audit.issues.length === 0) {
    return zh
      ? `${head} 未发现结构问题。仍需人工确认一项：机读行 hours 装的是「空间开放时段」，不是「申请/办理窗口」。`
      : `${head} No structural issue found. One manual check remains: whether each hours window is the space's opening time rather than an application window.`
  }

  const visible = audit.issues.slice(0, Math.max(1, maxItems))
  const lines = visible.map((issue, index) => {
    const label = zh ? SPACE_AUDIT_ISSUE_LABELS[issue.kind].zh : SPACE_AUDIT_ISSUE_LABELS[issue.kind].en
    return zh
      ? `${index + 1}. 【${label}】${issue.space || '（未定位）'}：${issue.detail}`
      : `${index + 1}. [${label}] ${issue.space || '(unlocated)'}: ${issue.detail}`
  })
  const rest = audit.issues.length - visible.length
  if (rest > 0) {
    lines.push(zh ? `…另 ${rest} 处同类，未逐条展开。` : `... ${rest} more of the same kind not listed.`)
  }

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

  return [head, ...lines, '', ...manual].join('\n')
}
