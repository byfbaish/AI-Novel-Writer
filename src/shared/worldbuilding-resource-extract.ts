/**
 * 资源登记提案（W6a-4，2026-10-23）。
 *
 * ## 它补的是哪一环
 *
 * 设计稿 §3.4 早就写了「模型只能提议，落库前必须确认」，但 §9 分期表没有任何一期实现
 * 这个通道 ⇒ `resources` 是空表 ⇒ W6b 抽取提示词里的 `resources_json` 是空清单
 * （`finalize-chapter.command.ts:402`）⇒ 一条变动都抽不出来 ⇒ W6c 空转。
 * 本文件就是那一环的**解析与校验**，模型调用在两个触发点（设计稿 §4.6.3）。
 *
 * ## 与 B 层自审（`worldbuilding-self-review.ts`）的关系与分歧
 *
 * 共用同一条纪律：**引文必须能在世界观原文里逐字命中，命不中即丢**（防模型编引文）。
 *
 * 但有一处**刻意不同**：自审是「任何一条不合形状 ⇒ 整份 `unreadable`」，
 * 这里是**逐条丢弃并计数 `dropped`**。理由：自审产出的是一张**结论列表**，半份会被
 * 当成全份展示（作者以为"就这些问题"）；候选是**逐行勾选**的，每行自带引文，
 * 丢掉三行里的两行不会误导 —— 剩下一行照样有据可查。所以这里不需要"全有或全无"。
 *
 * ## 只填有逐字依据的列（判据 DN / CS / DK）
 *
 * 十列里只有 `name` 与三条 note 是"事实"，其余六列都是"判断"，而判断猜错的代价不同：
 * - `unit` 猜错 ⇒ 全部历史变动判成 `unit-mismatch`（§5.1 要防的正是静默重解释）；
 * - `anchorValue` 猜错 ⇒ 凭空造出一个汇率，而**留空的语义是安全的"不可通兑"**；
 * - `period` 猜错 ⇒ 同一数额日结/月结双口径（审稿第 9 维要抓的正是这个）。
 *
 * 所以本文件**不做任何推断**：模型没给就留 `null`，值不合法也归 `null`，
 * **绝不填 0 充数**（判据 DN / CS）。缺 `unit` 的候选由 UI 拦住不给落库（§4.6.4）。
 */

import { isQuotePresent } from './worldbuilding-self-review'

/** 一条资源登记提案。**模型给的，不是权威值** —— 作者确认后才进 `resources` 表。 */
export interface ResourceCandidate {
  name: string
  /** 资源族：只在原文明确出现同族多品阶时才非 null。 */
  familyId: string | null
  tier: number
  /** null = 原文里没出现单位 ⇒ **不给落库**（§4.6.4）。 */
  unit: string | null
  /** null = 原文没写结算周期。 */
  period: string | null
  /** null = 不可通兑。**不是 0**。 */
  anchorValue: number | null
  anchorNote: string | null
  /**
   * 换算锚的**独立依据**：必须能在世界观原文里逐字命中，否则 `anchorValue` 作废。
   *
   * 为什么锚值要单独要一条引文，而单位/周期不用：
   * - 单位填错 ⇒ 之后每条变动判成 `unit-mismatch`，**有冲突机制兜住**；
   * - 周期填错 ⇒ 审稿第 9 维「计量口径」专门抓日结/月结双口径，**有机制兜住**；
   * - **锚值填错 ⇒ 没有任何机制能发现**。它只是把两个品阶按一个假汇率折算，
   *   账本全程"算得通"，直到作者某天发现"一百枚下品怎么换了一枚上品"。
   *
   * 所以锚值是十列里唯一**必须自带可核对依据**的列 —— 抄不出原句就归 null，
   * 而 null 的语义（不可通兑）是安全的。
   */
  anchorQuote: string | null
  earnNote: string | null
  costNote: string | null
  /** 设计意图：仅展示，不参与任何计算（判据 DL）。 */
  scarcityNote: string | null
  /** 支撑这条提案的逐字引文；必须能在世界观原文里命中。 */
  quote: string
}

export interface ResourceCandidateSet {
  candidates: ResourceCandidate[]
  /** 模型没给出可用结果（调用失败 / 坏 JSON / 形状不认识）。**不等于「这本书没有资源」**。 */
  unreadable: boolean
  /** 被丢弃的条数：引文命不中 / 资源名在原文里搜不到 / 形状不对 / 重名。 */
  dropped: number
}

/** 一次最多给多少条候选（够用；多了就变成作者要逐条筛的负担，判据 CX）。 */
export const MAX_RESOURCE_CANDIDATES = 12

/** 单条 note 的长度上限（超过就截断，不丢整条）。 */
const MAX_NOTE_LENGTH = 200

/** 资源名长度上限：超过基本可以确定是模型把一整句塞进来了。 */
const MAX_NAME_LENGTH = 40

type Language = 'zh-CN' | 'en-US'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 取字符串；空/非字符串一律 null（**空串不许冒充"有值"**）。 */
function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readNote(value: unknown): string | null {
  const text = readText(value)
  if (text === null) return null
  return text.length <= MAX_NOTE_LENGTH ? text : text.slice(0, MAX_NOTE_LENGTH)
}

/** 模型偶尔无视 `json_object` 而套一层 ```json —— 剥掉这一种包装，其余按严格 JSON 解析。 */
function stripOuterFence(text: string): string {
  const fenced = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/u.exec(text)
  return fenced?.[1]?.trim() ?? text
}

function emptySet(unreadable: boolean, dropped = 0): ResourceCandidateSet {
  return { candidates: [], unreadable, dropped }
}

/**
 * 严格解析模型的资源提案。
 *
 * 纯函数：零 IO、不抛错。坏 JSON ⇒ `{ candidates: [], unreadable: true }`。
 */
export function parseResourceCandidates(raw: string): ResourceCandidateSet {
  if (typeof raw !== 'string' || !raw.trim()) return emptySet(true)

  let parsed: unknown
  try {
    parsed = JSON.parse(stripOuterFence(raw.trim()))
  } catch {
    return emptySet(true)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptySet(true)

  const envelope = parsed as { candidates?: unknown }
  if (!Array.isArray(envelope.candidates)) return emptySet(true)

  const candidates: ResourceCandidate[] = []
  const seen = new Set<string>()
  let dropped = 0

  for (const item of envelope.candidates.slice(0, MAX_RESOURCE_CANDIDATES)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { dropped += 1; continue }
    const record = item as Record<string, unknown>

    const name = readText(record.name)
    const quote = readText(record.quote)
    // name 与 quote 是这条提案的地基：缺任一项就没有"可核对的依据"，直接丢。
    if (!name || !quote || name.length > MAX_NAME_LENGTH) { dropped += 1; continue }

    if (seen.has(name)) { dropped += 1; continue }
    seen.add(name)

    // 换算锚：非有限数 / ≤ 0 ⇒ null。**0 会被读成「免费兑换」**，与「不可通兑」是反的。
    const anchorRaw = record.anchorValue
    const anchorValue = isFiniteNumber(anchorRaw) && anchorRaw > 0 ? anchorRaw : null

    const tierRaw = record.tier
    const tier = isFiniteNumber(tierRaw) && Number.isInteger(tierRaw) && tierRaw >= 0 ? tierRaw : 0

    const anchorQuote = anchorValue === null ? null : readText(record.anchorQuote)

    candidates.push({
      name,
      familyId: readText(record.familyId),
      tier,
      unit: readText(record.unit),
      period: readText(record.period),
      // 没有独立依据的锚值**当场作废**：留空 = 不可通兑（安全），填一个猜的 = 假汇率（无机制可发现）。
      anchorValue: anchorQuote === null ? null : anchorValue,
      anchorNote: anchorQuote === null ? null : readNote(record.anchorNote),
      anchorQuote,
      earnNote: readNote(record.earnNote),
      costNote: readNote(record.costNote),
      scarcityNote: readNote(record.scarcityNote),
      quote,
    })
  }

  // 超出上限的部分也要计入 dropped，否则「丢了 N 条」会说谎。
  if (envelope.candidates.length > MAX_RESOURCE_CANDIDATES) {
    dropped += envelope.candidates.length - MAX_RESOURCE_CANDIDATES
  }

  return { candidates, unreadable: false, dropped }
}

/**
 * 丢掉「依据站不住」的候选，去重并按名字稳定排序。
 *
 * 四道闸门，缺一不可：
 * 1. **引文必须逐字命中**世界观原文（防模型编引文）；
 * 2. **资源名必须能在原文里搜到**（防凭空造一个资源名）；
 * 3. **换算锚的独立依据必须逐字命中**，命不中 ⇒ 锚值作废（保留该行，锚归 null）；
 * 4. 按名字去重（`parseResourceCandidates` 已做过一次，这里是跨来源合并时的第二道）。
 *
 * 调用方在展示/落库之前**必须**过一遍。
 */
export function filterResourceCandidates(
  set: ResourceCandidateSet,
  worldbuilding: string,
): ResourceCandidateSet {
  if (set.candidates.length === 0) return set
  const seen = new Set<string>()
  const candidates: ResourceCandidate[] = []
  let dropped = set.dropped

  for (const candidate of set.candidates) {
    if (seen.has(candidate.name)) { dropped += 1; continue }
    seen.add(candidate.name)
    if (!isQuotePresent(candidate.quote, worldbuilding)) { dropped += 1; continue }
    if (!isQuotePresent(candidate.name, worldbuilding)) { dropped += 1; continue }
    // 锚值依据抄不实 ⇒ 只作废锚值、保留这一行：缺锚值是「不可通兑」（可用状态），
    // 不是「这条资源不存在」。整行丢掉反而让作者以为这本书没有这个资源。
    if (candidate.anchorQuote !== null && !isQuotePresent(candidate.anchorQuote, worldbuilding)) {
      candidates.push({ ...candidate, anchorValue: null, anchorNote: null, anchorQuote: null })
      continue
    }
    candidates.push(candidate)
  }

  candidates.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  return { candidates, unreadable: set.unreadable, dropped }
}

/** 这条候选能不能落库。**缺单位一律否**（§4.6.4）。 */
export function isCandidateCommittable(candidate: ResourceCandidate): boolean {
  return candidate.unit !== null
}

/** 缺什么（用于 UI 提示）。目前只有单位会拦住落库，其余留空都是合法状态。 */
export function candidateBlockers(candidate: ResourceCandidate): string[] {
  return candidate.unit === null ? ['unit'] : []
}

/**
 * 一行日志/提示语。
 *
 * `unreadable` 时**必须**说「本次没拿到可用结果」，不能说成「这本书没有资源」——
 * 两者对作者的含义完全相反。
 */
export function describeResourceCandidates(
  set: ResourceCandidateSet,
  language: Language,
): string | undefined {
  if (set.unreadable) {
    return language === 'en-US'
      ? 'Resource proposal pass did not return a usable result this run; the generated worldbuilding is unaffected.'
      : '资源登记提案未完成：本次没有拿到可用的提案结果（已完成的世界观不受影响）。'
  }
  if (set.candidates.length === 0) return undefined

  const head = language === 'en-US'
    ? `Resource proposals: ${set.candidates.length} candidate(s) awaiting your confirmation before they are registered.`
    : `资源登记提案：${set.candidates.length} 条候选，需你确认后才会登记。`
  const tail = set.dropped > 0
    ? (language === 'en-US'
      ? ` ${set.dropped} discarded (evidence not found in the text).`
      : `另有 ${set.dropped} 条因在原文里找不到依据被丢弃。`)
    : ''
  return `${head}${tail}`
}
