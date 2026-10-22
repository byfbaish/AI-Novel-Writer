/**
 * 世界观数值规则检查（W6a-1，2026-10-22）。
 *
 * ## 为什么需要它
 *
 * 灵石案：世界观写「每日劳作十二时辰换取十枚下品灵石」。十二时辰 = 24 小时 = 一整日全部时长，
 * 零睡眠零进食 —— 这是**纯算术**上的不可能，跟题材、动词、行业都无关。正文第 2–4 章之所以越写越乱，
 * 起点就在这里。而写库流程读完就存（`architecture.command.ts:2215`），没人再算一遍。
 *
 * ## 判定依据是句法 + 算术，不是语义
 *
 * 这里刻意**不判断"这是不是工时"**。判断「劳作 / 打坐 / 炼气 / 挖矿 哪个算工作」需要一张动词表，
 * 而那是**这本书的世界观特征，不是通用规则** —— 作者写「每日炼气十二时辰」「每日守阵十二时辰」
 * 「每日挖矿十二时辰」，词表永远追不上；漏报（真问题抓不到）比误报更糟。
 *
 * 所以 A-1 只认两件事：
 * 1. 句中出现日常量词：每日 / 每天 / 一日 / 一天；
 * 2. 该句（或紧邻下一分句）里出现时间量，换算后合计 ≥ 24 小时。
 *
 * 「每日炼气十二时辰」命中 —— 不需要知道"炼气"是什么。
 * 「打坐十二时辰」不命中 —— 没有日常量词，不构成日常作息声称。
 * 「一夜十二时辰」不命中 —— "一夜"不是"每日"。
 *
 * ## 已知误报（接受，不引入词表）
 *
 * 「一月三十日，每日十二时辰」这类历法换算说明会命中。措辞中性（"请确认是否为设定"），
 * 作者扫一眼即可判定。这类句式在设定里出现频率极低 —— 为它引入词表，等于回到枚举的老路。
 *
 * ## 输出级别
 *
 * 全部 findings 级别固定为「不可判定」（undecidable）：不阻断、不判 error、
 * **不给"应该改成什么"**（判据 CJ：没有权威值时不产出可执行修改）。
 *
 * ## fail-open
 *
 * 空文本 ⇒ `unreadable=true`，describe 返回 undefined（没内容可判，不提示）。
 */

/** 一条数值口径问题。 */
export type WorldBuildingNumericKind = 'daily-hours' | 'ratio-without-base'

export interface WorldBuildingNumericFinding {
  kind: WorldBuildingNumericKind
  /** 证据句原文（已 trim，超长截断保留上下文）。 */
  quote: string
  /** 仅 A-1：换算后该句声称的每日小时数。 */
  dailyHours?: number
  /**
   * 稳定键：同一句同一规则恒定，供作者豁免用
   * （`consistency_exemptions.stable_fact_key` 是项目级表，可直接复用）。
   */
  key: string
}

export interface WorldBuildingNumericAudit {
  findings: WorldBuildingNumericFinding[]
  /** 文本为空：没得判（describe 保持沉默）。 */
  unreadable: boolean
}

type Language = 'zh-CN' | 'en-US'

/** 每句最多保留的引文字数（够定位，不至于把整段塞进日志）。 */
const QUOTE_LIMIT = 60
/** 单次检查最多报多少条（防长文本刷屏）。 */
const MAX_FINDINGS = 20

/** 日常量词：出现其一才认为在声称"每天如何"。 */
const DAILY_MARKERS = /(?:每日|每天|每一天|一日|一天)/u

/** 时间量：数字 + 时间单位（含「十二个时辰」这种带量词的写法）。 */
const TIME_AMOUNT =
  /(半|零|[一二两三四五六七八九十百千]+|\d+(?:\.\d+)?)\s*(?:个)?\s*(时辰|小时|時辰|更|刻)/gu

/** 单位 → 小时。更 = 2 小时（五更即 10 小时，本身不会触顶），刻 = 1/4 时辰 = 0.25 小时。 */
const UNIT_HOURS: Record<string, number> = {
  时辰: 2,
  時辰: 2,
  小时: 1,
  更: 2,
  刻: 0.25,
}

/** 一日总时长阈值。 */
const DAY_HOURS = 24

/** 中文数字单字。 */
const CN_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

/** 中文数字 → 数值；解析不了返回 null（宁可不判，不猜）。 */
export function parseChineseNumber(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  if (/^\d+(?:\.\d+)?$/u.test(text)) return Number(text)
  if (text === '半') return 0.5

  let total = 0
  let pending = 0
  let touched = false
  for (const char of text) {
    const digit = CN_DIGITS[char]
    if (digit !== undefined) {
      pending = digit
      touched = true
      continue
    }
    const unit = char === '十' ? 10 : char === '百' ? 100 : char === '千' ? 1000 : null
    if (unit === null) return null
    total += (pending === 0 ? 1 : pending) * unit
    pending = 0
    touched = true
  }
  if (!touched) return null
  const value = total + pending
  return value > 0 ? value : null
}

/** 分句：句号 / 分号 / 叹问号 / 换行。 */
function splitSentences(normalized: string): string[] {
  return normalized
    .split(/[。；;！!？?\n]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function clipQuote(sentence: string): string {
  const compact = sentence.replace(/\s+/gu, ' ').trim()
  return compact.length <= QUOTE_LIMIT ? compact : `${compact.slice(0, QUOTE_LIMIT)}…`
}

/** FNV-1a：只为了让同一句话得到同一个稳定键，不需要密码学强度。 */
function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function findingKey(kind: WorldBuildingNumericKind, quote: string): string {
  return `worldbuilding-numeric:${kind}:${stableHash(quote)}`
}

/** 一句里的时间量合计（小时）；一个都没有返回 null。 */
function sumDailyHours(sentence: string): { hours: number; sawAny: boolean } {
  let hours = 0
  let sawAny = false
  TIME_AMOUNT.lastIndex = 0
  for (const match of sentence.matchAll(TIME_AMOUNT)) {
    const amount = parseChineseNumber(match[1] ?? '')
    const unitHours = UNIT_HOURS[match[2] ?? '']
    if (amount === null || unitHours === undefined) continue
    hours += amount * unitHours
    sawAny = true
  }
  return { hours, sawAny }
}

/** 相对量：`五分之一` 这类分式，或百分数（`30%` / `百分之三十`）。 */
const FRACTION = /(?:[一二两三四五六七八九十百千]+|\d+(?:\.\d+)?)\s*分之\s*[一二两三四五六七八九十百千\d]+/u
const PERCENT = /(?:\d+(?:\.\d+)?\s*[%％]|百分之[一二两三四五六七八九十百千\d]+)/u
/** 同上，带 g 用于抹掉百分数片段 —— 否则「百分之三十」会被当成「三十分之…」的分式。 */
const PERCENT_TEXT = /(?:\d+(?:\.\d+)?\s*[%％]|百分之[一二两三四五六七八九十百千\d]+)/gu
/**
 * 百分数只有出现在"份额语境"里才算「相对量缺分母」。
 * 「成功率百分之三十」不是这类问题（它的基数是尝试次数，不是收入/支出），
 * 不加这道门槛会把设定里所有百分比都报一遍。
 */
const PERCENT_CONTEXT = /(?:占|比例|份额|抽成|分成|提成)/u

/** 相对量的分母词：句中出现任一即认为分母已声明。 */
const BASE_WORDS = [
  '收入', '总收入', '进项',
  '支出', '总支出', '开销', '花费', '成本',
  '月例', '月钱', '月收入', '工钱',
]

function lacksRatioBase(sentence: string): boolean {
  const hasPercent = PERCENT.test(sentence) && PERCENT_CONTEXT.test(sentence)
  // 「百分之三十」字面上像「三十分之…」，先抹掉百分数片段再找真分式。
  const hasFraction = FRACTION.test(sentence.replace(PERCENT_TEXT, '·'))
  if (!hasFraction && !hasPercent) return false
  return !BASE_WORDS.some((word) => sentence.includes(word))
}

/**
 * 检查世界观正文里的两类数值口径问题（A-1 每日时长、A-2 相对量缺分母）。
 *
 * 纯函数：不读文件、不写文件、不访问数据库、不调用模型。
 */
export function inspectWorldBuildingNumeric(text: string): WorldBuildingNumericAudit {
  const normalized = text.replace(/\r\n?/gu, '\n')
  if (!normalized.trim()) return { findings: [], unreadable: true }

  const sentences = splitSentences(normalized)
  const findings: WorldBuildingNumericFinding[] = []

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index] ?? ''

    // A-1：日常量词 + 时间量合计 ≥ 24h。时间量可以落在紧邻的下一分句里
    // （「每日劳作，十二时辰」这种断句），所以两句一起算。
    if (DAILY_MARKERS.test(sentence)) {
      const own = sumDailyHours(sentence)
      const next = own.sawAny ? null : sumDailyHours(sentences[index + 1] ?? '')
      const hours = own.sawAny ? own.hours : (next?.hours ?? 0)
      if (hours >= DAY_HOURS) {
        const quote = clipQuote(sentence)
        findings.push({
          kind: 'daily-hours',
          quote,
          dailyHours: hours,
          key: findingKey('daily-hours', quote),
        })
      }
    }

    // A-2：相对量缺分母。
    if (lacksRatioBase(sentence)) {
      const quote = clipQuote(sentence)
      findings.push({
        kind: 'ratio-without-base',
        quote,
        key: findingKey('ratio-without-base', quote),
      })
    }

    if (findings.length >= MAX_FINDINGS) break
  }

  // 同一句同一规则只留一条（规则之间互不影响）。
  const deduped: WorldBuildingNumericFinding[] = []
  const seen = new Set<string>()
  for (const finding of findings) {
    if (seen.has(finding.key)) continue
    seen.add(finding.key)
    deduped.push(finding)
  }

  return { findings: deduped, unreadable: false }
}

function describeFinding(finding: WorldBuildingNumericFinding, language: Language): string {
  if (finding.kind === 'daily-hours') {
    const hours = finding.dailyHours ?? DAY_HOURS
    return language === 'en-US'
      ? `this line claims ${hours} hours per day; confirm whether that is intended.`
      : `该句声称每日占用 ${hours} 小时，请确认是否为设定。`
  }
  return language === 'en-US'
    ? 'this line uses a ratio but never says what the base is (income, expenses, or monthly allowance), so it cannot be checked.'
    : '这里用了比例但没写分母（占收入、占支出还是占月例），无法核对。'
}

/**
 * 把检查结果变成一句可见提示；没有问题时返回 undefined。
 *
 * 措辞原则同 `describeWorldBuildingCompleteness`：说明"哪里需要确认"，明确"不影响使用"，
 * 不制造阻断感，也不给修改建议。
 */
export function describeWorldBuildingNumericAudit(
  result: WorldBuildingNumericAudit,
  language: Language,
): string | undefined {
  if (result.unreadable || result.findings.length === 0) return undefined

  const head = language === 'en-US'
    ? `Numeric check: ${result.findings.length} statement(s) need a stated basis (this run is not blocked).`
    : `数值口径检查：有 ${result.findings.length} 处数值需要确认口径（本次不影响使用）。`

  const visible = result.findings.slice(0, 3)
    .map((finding) => (language === 'en-US'
      ? `"${finding.quote}" — ${describeFinding(finding, language)}`
      : `「${finding.quote}」— ${describeFinding(finding, language)}`))
  const rest = result.findings.length - visible.length
  const tail = rest > 0
    ? (language === 'en-US' ? ` ${rest} more of the same kind not listed.` : `另 ${rest} 处同类问题未展开。`)
    : ''

  return `${head} ${visible.join(language === 'en-US' ? ' ' : '')}${tail}`
}
