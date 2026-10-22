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
 * ## A-3 / A-4（W6a-3）为什么必须等资源登记表
 *
 * A-3（同资源双单位）与 A-4（资源名疑似重复定义）都要比对「资源名」。
 * 没有 `resources` 表时，资源名只能靠"单位词 + 前文名词"猜 —— 猜错就产出一批**假问题**，
 * 而假问题会直接变成作者要一条条处理却永远无法应用的待办（判据 CX）。
 * 所以这两条规则**只在调用方给出资源清单时**运行：清单为空 / 读不出来 ⇒ 直接不跑，
 * 零 finding、零噪声，**绝不退化成猜**（`usableResources` 是唯一的入口闸门）。
 * A-1 / A-2 不依赖资源，任何情况下照常输出。
 *
 * ## fail-open
 *
 * 空文本 ⇒ `unreadable=true`，describe 返回 undefined（没内容可判，不提示）。
 */

/** 一条数值口径问题。 */
export type WorldBuildingNumericKind =
  | 'daily-hours'
  | 'ratio-without-base'
  /** A-3：同一段内同一资源名后跟了两个不同单位词。 */
  | 'dual-unit'
  /** A-4：同一维内两个疑似同一资源的名字各自被"定义"。 */
  | 'duplicate-resource-definition'

export interface WorldBuildingNumericFinding {
  kind: WorldBuildingNumericKind
  /** 证据句原文（已 trim，超长截断保留上下文）。 */
  quote: string
  /** 仅 A-1：换算后该句声称的每日小时数。 */
  dailyHours?: number
  /** 仅 A-3：命中的资源名（取自登记表，非猜测）。 */
  resourceName?: string
  /** 仅 A-3：同段内出现过的单位词，按首次出现排序。 */
  units?: string[]
  /** 仅 A-4：被判为疑似重复定义的两个名字。 */
  resourceNames?: string[]
  /**
   * 稳定键：同一句同一规则恒定，供作者豁免用
   * （`consistency_exemptions.stable_fact_key` 是项目级表，可直接复用）。
   */
  key: string
}

/**
 * A-3 / A-4 需要的资源登记信息（`db:resources-list` 的子集）。
 *
 * 只取这四项：`name` / `unit` 用于单位比对，`familyId` / `tier` 用于同族判定。
 * **不接受**"从正文里现推的资源名"—— 那正是本模块拒绝做的事。
 */
export interface NumericAuditResource {
  name: string
  unit: string
  /** 资源族；null / 缺省 = 单例资源。 */
  familyId?: string | null
  /** 品阶；缺省按 0 处理。 */
  tier?: number
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

// ============================================================================
// A-3 / A-4 —— 需要资源登记表（W6a-3）
// ============================================================================

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/** 单位归一：`枚` / `枚/日` / `枚 每天` 都取斜杠前的量词部分。 */
function normalizeUnit(raw: string): string {
  const compact = raw.replace(/\s+/gu, '')
  return compact.split(/[/／|]/u)[0] ?? compact
}

/** 登记表里真正能参与比对的一条资源（名字与单位都已归一，缺一即剔除）。 */
interface UsableResource {
  name: string
  /** 归一后的登记单位，用于比对。 */
  normalizedUnit: string
  familyId: string | null
  tier: number
}

/**
 * 唯一闸门（判据 CX）：**资源清单为空 / 全部残缺 ⇒ 返回空数组**，
 * 上层 A-3 / A-4 由此整体不运行 —— 没有资源名就闭嘴，不靠单位词猜。
 */
function usableResources(resources: readonly NumericAuditResource[] | undefined): UsableResource[] {
  if (!resources || resources.length === 0) return []
  const seen = new Set<string>()
  const usable: UsableResource[] = []
  for (const resource of resources) {
    const name = (resource?.name ?? '').trim()
    const unit = (resource?.unit ?? '').trim()
    // 名字或单位缺失 ⇒ 这条没法比对。跳过，不补、不猜。
    if (!name || !unit) continue
    if (seen.has(name)) continue
    seen.add(name)
    usable.push({
      name,
      normalizedUnit: normalizeUnit(unit),
      familyId: resource.familyId ?? null,
      tier: typeof resource.tier === 'number' && Number.isFinite(resource.tier) ? resource.tier : 0,
    })
  }
  return usable
}

/** 段：空行分隔的块；块内的 markdown 标题行先剔除（标题不是正文证据）。 */
function splitParagraphs(normalized: string): string[] {
  return normalized
    .split(/\n[ \t]*\n/u)
    .map((block) => block
      .split('\n')
      .filter((line) => !/^\s{0,3}#{1,6}\s/u.test(line))
      .join('\n')
      .trim())
    .filter(Boolean)
}

/** 维：以 markdown 标题为界的一节（A-4 的作用域）。没有标题时整篇算一维。 */
function splitSections(normalized: string): string[] {
  const sections: string[][] = [[]]
  for (const line of normalized.split('\n')) {
    if (/^\s{0,3}#{1,6}\s/u.test(line)) {
      sections.push([])
      continue
    }
    sections[sections.length - 1]?.push(line)
  }
  return sections
    .map((lines) => lines.join('\n').trim())
    .filter(Boolean)
}

/**
 * 把"更长的已登记资源名"抹成等长占位符，避免短名在长名内部误命中
 * （「下品灵石（块）」不该被判成「灵石」用了「块」）。
 */
function maskLongerNames(text: string, names: readonly string[]): string {
  let masked = text
  for (const name of names) {
    if (!name) continue
    masked = masked.split(name).join('·'.repeat(name.length))
  }
  return masked
}

interface UnitMention {
  unit: string
  sentence: string
}

/** 括注里允许当单位的外形：短、无空白、无句读。 */
const PAREN_UNIT_BODY = '[^\\s（）()，。；、：:！？!?“”‘’"《》]{1,8}'
/** 数量前缀：中文数字 / 阿拉伯数字（只要挨着单位，就说明那是个量词）。 */
const COUNT_PREFIX = '[一二两三四五六七八九十百千零几数十\\d]+'

/**
 * 收集一段里"明确挂在这个资源名上的单位词"。
 *
 * 只认两种外形，其余一律不认（多认一种外形就多一批误报）：
 * 1. `<资源名>（<单位>）`：括注紧跟名字，如「灵石（枚）」；
 * 2. 数量 + **已登记单位** 紧贴名字：「三百枚灵石」「灵石三百枚」。
 *    —— 单位词必须出现在登记表里，正文自创的词不会被当单位（判据 CX）。
 */
function collectUnitMentions(
  sentences: readonly string[],
  resource: UsableResource,
  knownUnits: readonly string[],
  longerNames: readonly string[],
): UnitMention[] {
  const namePattern = escapeRegExp(resource.name)
  const parenForm = new RegExp(
    `${namePattern}[ \\t]*[（(][ \\t]*(${PAREN_UNIT_BODY})[ \\t]*[)）]`,
    'gu',
  )
  const unitAlt = knownUnits.length > 0 ? knownUnits.map(escapeRegExp).join('|') : null
  // 单位放在捕获组里：不靠 `includes` 反查，避免单位词恰好是资源名的一部分时认错。
  const beforeForm = unitAlt
    ? new RegExp(`${COUNT_PREFIX}[ \\t]*(${unitAlt})[ \\t]*的?[ \\t]*${namePattern}`, 'gu')
    : null
  const afterForm = unitAlt
    ? new RegExp(`${namePattern}[ \\t]*${COUNT_PREFIX}[ \\t]*(${unitAlt})`, 'gu')
    : null

  const mentions: UnitMention[] = []
  for (const sentence of sentences) {
    const masked = maskLongerNames(sentence, longerNames)
    for (const match of masked.matchAll(parenForm)) {
      const unit = normalizeUnit(match[1] ?? '')
      if (unit) mentions.push({ unit, sentence })
    }
    for (const pattern of [beforeForm, afterForm]) {
      if (!pattern) continue
      for (const match of masked.matchAll(pattern)) {
        const unit = normalizeUnit(match[1] ?? '')
        if (unit) mentions.push({ unit, sentence })
      }
    }
  }
  return mentions
}

/**
 * A-3：同一段内，同一个资源名挂了两个不同单位词。
 *
 * 判据是「两个」而不是「一个与登记不符」：只出现一个单位时无法区分
 * "作者改了单位"与"这一段只提到了另一种计量"，报出来就是假问题。
 */
function inspectResourceUnits(
  paragraphs: readonly string[],
  resources: readonly UsableResource[],
): WorldBuildingNumericFinding[] {
  const knownUnits = [...new Set(resources.map((resource) => resource.normalizedUnit).filter(Boolean))]
  const findings: WorldBuildingNumericFinding[] = []

  for (const paragraph of paragraphs) {
    const sentences = splitSentences(paragraph)
    if (sentences.length === 0) continue
    for (const resource of resources) {
      const longerNames = resources
        .filter((other) => other.name.length > resource.name.length)
        .map((other) => other.name)
      const mentions = collectUnitMentions(sentences, resource, knownUnits, longerNames)

      const units: string[] = []
      for (const mention of mentions) {
        if (!units.includes(mention.unit)) units.push(mention.unit)
      }
      if (units.length < 2) continue

      // 引用"第二个不同单位"出现的那一句 —— 它才是把两种单位摆在一起的地方。
      const secondUnit = units[1]
      const evidence = mentions.find((mention) => mention.unit === secondUnit)?.sentence
        ?? mentions[0]?.sentence
        ?? ''
      const quote = clipQuote(evidence)
      findings.push({
        kind: 'dual-unit',
        quote,
        resourceName: resource.name,
        units,
        key: findingKey('dual-unit', `${resource.name}|${units.join('|')}`),
      })
    }
  }
  return findings
}

/** 资源名左侧边界：行首 / 标点 / 空白 / markdown 记号都算，汉字不算（避免长名内部命中）。 */
function isNameBoundary(char: string | undefined): boolean {
  if (char === undefined) return true
  return !/[\u3400-\u4dbf\u4e00-\u9fff]/u.test(char)
}

/** 名字后面直接跟的定义式：`：` / `是` / `指的是`（不认 `不是` `是否`）。 */
const DEFINE_AFTER_NAME = /^[ \t]*(?:[：:]|(?:指的?是|是)(?![否非不]))/u
/** 名字后面出现的分类式：`分为` / `分成` / `包括` / `共 N 种`。 */
const DEFINE_SPLIT = /(?:分为|分成|包括|共[一二两三四五六七八九十百千零\d]+种)/u

/**
 * 这一句是不是在**定义**这个资源。
 *
 * 保守判定（判据 CX：宁可漏，不把正常引用报成定义）：
 * - 名字必须落在左边界上（`下品灵石：…` 不算"灵石"的定义）；
 * - 只认两种句式：「名字 + 冒号 / 是」，或「名字 … 分为 / 包括 / 共 N 种」
 *   （分类式，名字必须在标记之前）。其余叙述一律不算。
 */
function isDefinitionSentence(
  sentence: string,
  resource: UsableResource,
  longerNames: readonly string[],
): boolean {
  const masked = maskLongerNames(sentence, longerNames)
  const namePattern = new RegExp(escapeRegExp(resource.name), 'gu')
  const splitMatch = DEFINE_SPLIT.exec(masked)
  const splitIndex = splitMatch?.index ?? -1

  for (const match of masked.matchAll(namePattern)) {
    const index = match.index
    if (index === undefined) continue
    if (!isNameBoundary(masked[index - 1])) continue

    const rest = masked.slice(index + resource.name.length)
    if (DEFINE_AFTER_NAME.test(rest)) return true
    if (splitIndex >= 0 && index < splitIndex) return true
  }
  return false
}

/** 两个名字是不是"疑似同一个资源"：同族不同阶，或一个名字包含另一个。 */
function relatedResourceNames(a: UsableResource, b: UsableResource): boolean {
  if (a.name === b.name) return false
  // 同族 + 阶不同：登记表已经承认它们是同一资源的两级，正文却各给了一段定义。
  if (a.familyId !== null && a.familyId === b.familyId && a.tier !== b.tier) return true
  const [shorter, longer] = a.name.length <= b.name.length ? [a.name, b.name] : [b.name, a.name]
  // 单字名不参与包含判定（「力」会被「灵力」吃掉，全是噪音）。
  return shorter.length >= 2 && longer.includes(shorter)
}

/**
 * A-4：同一维内，两个疑似同一资源的名字**各自都被定义**。
 *
 * 只有"双方都有定义式"才报 —— 一方定义、另一方只是引用，是最正常的层级写法
 * （「灵石：硬通货。下品灵石最便宜。」），报它等于制造假问题。
 */
function inspectResourceDefinitions(
  sections: readonly string[],
  resources: readonly UsableResource[],
): WorldBuildingNumericFinding[] {
  const findings: WorldBuildingNumericFinding[] = []

  for (const section of sections) {
    const sentences = splitSentences(section)
    if (sentences.length === 0) continue

    const defined = new Map<UsableResource, string>()
    for (const resource of resources) {
      const longerNames = resources
        .filter((other) => other.name.length > resource.name.length)
        .map((other) => other.name)
      const hit = sentences.find((sentence) => isDefinitionSentence(sentence, resource, longerNames))
      if (hit) defined.set(resource, hit)
    }

    const definedList = [...defined.keys()]
    for (let left = 0; left < definedList.length; left += 1) {
      for (let right = left + 1; right < definedList.length; right += 1) {
        const a = definedList[left]
        const b = definedList[right]
        if (!a || !b || !relatedResourceNames(a, b)) continue
        const quote = clipQuote(defined.get(a) ?? defined.get(b) ?? '')
        findings.push({
          kind: 'duplicate-resource-definition',
          quote,
          resourceNames: [a.name, b.name],
          key: findingKey(
            'duplicate-resource-definition',
            [a.name, b.name].sort().join('|'),
          ),
        })
      }
    }
  }
  return findings
}

/**
 * 检查世界观正文里的数值 / 资源口径问题。
 *
 * - A-1 每日时长 ≥ 24h、A-2 相对量缺分母：始终运行，不依赖任何外部数据；
 * - A-3 同资源双单位、A-4 资源名疑似重复定义：**只在 `resources` 非空时运行**
 *   （判据 CX：没有资源登记表就闭嘴，绝不靠"单位词 + 前文名词"猜资源名）。
 *
 * 纯函数：不读文件、不写文件、不访问数据库、不调用模型。
 */
export function inspectWorldBuildingNumeric(
  text: string,
  resources?: readonly NumericAuditResource[],
): WorldBuildingNumericAudit {
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

  // A-3 / A-4：**资源未登记 ⇒ 这里整块不执行**，findings 与只跑 A-1/A-2 时逐字相同。
  // 这是判据 CX 的落点：宁可一条都不报，也不拿单位词去猜"这大概是个资源名"。
  const usable = usableResources(resources)
  if (usable.length > 0) {
    const resourceFindings = [
      ...inspectResourceUnits(splitParagraphs(normalized), usable),
      ...inspectResourceDefinitions(splitSections(normalized), usable),
    ]
    const room = Math.max(0, MAX_FINDINGS - findings.length)
    findings.push(...resourceFindings.slice(0, room))
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
  if (finding.kind === 'dual-unit') {
    const name = finding.resourceName ?? ''
    const units = (finding.units ?? []).join(' / ')
    return language === 'en-US'
      ? `"${name}" is written with two different units (${units}); confirm whether both are intended.`
      : `「${name}」在设定里出现了两种单位（${units}），请确认是否都为设定本意。`
  }
  if (finding.kind === 'duplicate-resource-definition') {
    const names = (finding.resourceNames ?? []).join('」与「')
    return language === 'en-US'
      ? `"${names}" are each given their own definition in the same part of the setting; confirm whether they are one resource (or two tiers of it).`
      : `「${names}」在同一维里各自都有一段定义，请确认是否为同一资源（或同一资源的不同品阶）。`
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
    ? `Numeric & resource check: ${result.findings.length} statement(s) need a stated basis or a single unit (this run is not blocked).`
    : `数值与资源口径检查：有 ${result.findings.length} 处需要确认口径或单位（本次不影响使用）。`

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
