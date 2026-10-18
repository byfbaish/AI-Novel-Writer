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

/**
 * 中弧下的小弧（P12-3）：弧光里写成 `小弧：A（约 9 章）；B（约 9 章）`。
 *
 * P13（2026-10-18）：小弧从「只有名字」升级为「名字 + 内容」——
 * `<起点状态> → <必发事件> → … → <落点状态>`。名字只有 4–5 个字，撑不起 8 章大纲，
 * 模型只能向上越层取材（实测把下一中弧的「鲁传福替他挡电话」写进第 4 章）。
 */
export interface ArcMinor {
  /** 小弧名（已去掉【】） */
  name: string
  /**
   * 小弧的章数。**P18 起为可选**：弧光层不再做篇幅预算，模型可以完全不写章数。
   * 缺省时按「与其他同级弧等权」参与区间折算（见 `arcWeight`）——
   * 区间仍然有来源，只是来源从「模型自报」变成「个数均分」。
   */
  chapters?: number
  /** 小弧内容（`起点 → 事件 → 落点`）。旧版弧光没有这一项时为 undefined ——
   * 解析与渲染都按「只有名字」退化处理，不报错。 */
  text?: string
}

/**
 * 一条弧参与区间折算的**权重**：有章数用章数，没有就等权 1。
 *
 * P18 的理由（作者裁定）：篇幅只用来算**个数**，不用来定**内容**。模型一旦被要求
 * 逐条写「约 N 章」，就会为对齐 N 而安排事件 —— 与「1500 字下限一到就停」是同一个病。
 * 所以章数从必填变成可选，缺省时按个数均分，大纲层的章号区间照样拿得到。
 */
export function arcWeight(chapters?: number): number {
  return typeof chapters === 'number' && Number.isFinite(chapters) && chapters > 0 ? chapters : 1
}

/**
 * 把一个小弧清单折成**中弧内的**章号区间（闭区间）。
 *
 * `listArcNodes`（结构位坐标）与 `renderArcPositionBlock`（告诉模型哪个 ID 覆盖哪几章）
 * 必须用同一份折算，否则提示词里的区间和审计认的区间会各说各话 —— 这是
 * `isTurnField` 那次「两处各写一份必然漂移」的同一教训。
 */
export function minorRanges(
  minors: readonly ArcMinor[],
  midRange: readonly [number, number],
): Array<{ name: string; range: readonly [number, number]; text?: string }> {
  if (minors.length === 0) return []
  const bounds = scaledBoundaries(minors.map(item => arcWeight(item.chapters)), midRange[1] - midRange[0] + 1)
  return minors.map((minor, offset) => ({
    name: minor.name,
    range: [midRange[0] + bounds[offset]!, midRange[0] + bounds[offset + 1]! - 1] as const,
    ...(minor.text ? { text: minor.text } : {}),
  }))
}

/**
 * 把小弧内容按 `→` 切成有序的**事件步**（含首项起点与末项落点）。
 *
 * ⚠️ **P18 已撤回它的用途**：曾用它算「弧内第 k 章的进度上限」（`minorStepCeiling`），
 * 让模型按章分摊事件。作者裁定那是篇幅陷阱的一种 —— 模型会为对齐步数而填充，
 * 与「1500 字下限一到就停」同源。逐章上限已删除；步数现在只用于体检读事件
 * （`MINOR_NO_COUNTER` 判断事件是否全从主角视角写）。
 *
 * 无 `→`、或切出的步数 < 2 时返回空数组 —— 调用方退化为旧行为，不报错（fail-open）。
 */
export function splitMinorSteps(text?: string): string[] {
  if (!text) return []
  const steps = text
    .split(/→|->/u)
    .map(item => item.trim().replace(/^[、,，;；。\s]+|[、,，;；。\s]+$/gu, ''))
    .filter(item => item.length > 0)
  return steps.length >= 2 ? steps : []
}

export interface ArcMid {
  /** 弧光里的名称（已去掉【】） */
  name: string
  /** 中弧章数（P18 起可选，缺省按个数均分，见 `arcWeight`） */
  chapters?: number
  /** 该中弧的规格字段（类型 / 因果|目标|动机 / 时序|尝试|路径 / 转折 …） */
  fields: readonly (readonly [string, string])[]
  /**
   * 小弧（P12-3）。**单独成一项，不混进 `fields`** —— 小弧自带章数，
   * 能折算成独立区间，而 `fields` 里的每个条目只继承所属中弧的整个区间。
   */
  minors: readonly ArcMinor[]
}

export interface ArcMajor {
  name: string
  /** 大弧章数（P18 起可选，缺省按个数均分，见 `arcWeight`） */
  chapters?: number
  fields: readonly (readonly [string, string])[]
  /**
   * 大弧的「结束状态」原文（P13）。它在 `SKIP_FIELDS` 里（不进 `fields`，因为它是
   * 验收标准而不是推进逻辑），但体检要检查它有没有点名承接它的中弧，所以单独留一份。
   */
  endState?: string
  mids: readonly ArcMid[]
}

export interface ParsedArcStructure {
  majors: readonly ArcMajor[]
  /** 弧光自报的章数合计（用于声明折算比例）。无任何章数时等于权重合计，不参与折算提示。 */
  declaredTotal: number
  /**
   * 弧光里**有没有任何一条弧自报过章数**（P18）。
   *
   * 没有时 `declaredTotal` 只是"个数"，不能再拿它跟全书章数比 —— 否则会印出
   * 「弧光合计 3 章，以下章号已按全书 150 章等比折算」这种无意义提示。
   */
  declaredChapters: boolean
  /**
   * 这份结构用的是哪套词（v7）。
   *
   * `volume` = 标题写的是「卷 / 单元」（行业词）；缺省 = 旧「大弧 / 中弧」。
   * 它**只影响措辞**，不影响解析、折算或定位：同一份结构换成哪套词，算出来的
   * 区间与结构位 ID 完全一样。渲染弧位块时据此决定叫「中弧」还是「单元」——
   * 不能用"有没有小弧"来替代：旧项目里也有缺小弧的形态，会被误判成改词。
   */
  naming?: 'volume'
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
  /** `endMidIndex` 那个中弧的章号区间（未跨界时与 `midRange` 相同）。 */
  endMidRange: readonly [number, number]
  midFields: readonly (readonly [string, string])[]
  /**
   * 本批**最后一个覆盖到**的中弧（`endMidIndex`）的字段。
   *
   * 批跨中弧边界时，后半批的结构位属于这个中弧；只列 `midFields` 会让后半批
   * 拿不到可引用的 ID。未跨界时与 `midFields` 相同。
   */
  endMidFields: readonly (readonly [string, string])[]
  /**
   * 本批所在中弧（`midIndex`）的小弧清单（P12-3）。
   *
   * 小弧是弧光里唯一天然带章数、因而唯一定能折算成独立区间的层级 —— 中弧的
   * 因果/时序/目标/动机是整段规格而非一次性节点，真正「用掉一格」的里程碑是小弧。
   */
  midMinors: readonly ArcMinor[]
  /** 本批最后一个覆盖到的中弧（`endMidIndex`）的小弧；未跨界时与 `midMinors` 相同。 */
  endMidMinors: readonly ArcMinor[]
  /** 同一大弧内、位于**本批之后**的剩余中弧（已进入的中弧不算） */
  remainingMids: readonly { name: string; midIndex: number; range: readonly [number, number]; gist: string }[]
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
// v7（2026-10-19）：弧光改用行业词「卷 / 单元」，旧方案的「大弧 / 中弧」必须继续可解析
//（旧项目 plot_structure_plan 是只读存量，不做任何文本迁移）。别名只用"或"，不做字符串替换。
// 中弧的序号历史上只认阿拉伯数字；v7 写「单元一」，中文序号必须一起认，否则整份结构解析为空。
const MAJOR_HEADING = new RegExp(`^#{2,3}[\\t ]*(?:大弧|卷)[^：:]*[：:][\\t ]*(.+?)[\\t ]*(?:（[\\t ]*约?[\\t ]*${CHAPTER_COUNT}[\\t ]*）)?[\\t ]*$`, 'u')
const MID_HEADING = new RegExp(`^#{3,4}[\\t ]*(?:中弧|单元)[\\t ]*[0-9一二三四五六七八九十百]*[\\t ]*[：:][\\t ]*(.+?)[\\t ]*(?:（[\\t ]*约?[\\t ]*${CHAPTER_COUNT}[\\t ]*）)?[\\t ]*$`, 'u')
/** `- **类型**：A 因果驱动型` / `- 因果：…` —— 字段名与值 */
const FIELD_LINE = /^[-*][\t ]*\*{0,2}([^：:*]{1,12}?)\*{0,2}[\t ]*[：:][\t ]*(.+?)[\t ]*$/u
/** 只保留能定位内容的字段，忽略纯枚举（类型）与排版字段 */
const SKIP_FIELDS = new Set([
  '类型', '接续理由', '核心冲突', '结束状态', '小弧', '小弧数',
  'Type', 'Minor arcs', 'Minor arc count', 'Minor arcs count',
])
/** 小弧行的字段名（中文 / 英文）。它不进球 `fields`，而是拆成 `minors`。 */
const MINOR_FIELD_NAMES = new Set(['小弧', 'Minor arcs'])
/**
 * `【首夜敲门】（约 8 章）` / `【首夜敲门】（约 8 章）：起点 → 事件 → 落点`
 *
 * 末尾允许句读 —— 弧光常把最后一条写成 `三家人抢一张排班表（约9章）。`，
 * 只认 `$` 会把**每条中弧的最后一个小弧**静默丢掉（实测 16 个只解析出 10 个），
 * 剩下的条目再按比例摊满整个中弧，区间被前一条吃掉，看不出任何异常。
 *
 * P13 起还允许章数后面接「：内容」—— 这是小弧层真正承载剧情的地方（见 `ArcMinor.text`）。
 */
const MINOR_ITEM_ZH = /^(.+?)[\t ]*[（(][\t ]*约?[\t ]*([0-9]+)[\t ]*章[\t ]*[）)][\t ]*(?:[：:][\t ]*(.+?))?[\t ]*[。．.、,，]?$/u
/** `Opening Night Knocks (about 8 chapters)` 同上，可带 `: content` */
const MINOR_ITEM_EN = /^(.+?)[\t ]*[（(][\t ]*(?:about[\t ]*|~[\t ]*)?([0-9]+)[\t ]*chapters?[\t ]*[）)][\t ]*(?:[：:][\t ]*(.+?))?[\t ]*[.,]?$/iu
/** 任何列表项；真正的判定交给 `MINOR_ITEM_ZH/EN`（它们要求带「（约 N 章）」） */
const BULLET_LINE = /^[-*][\t ]+(.+)$/u
/**
 * 小弧**清单表头**行：`小弧：A（约 8 章）；B（约 9 章）`。
 *
 * 它必须留给 `FIELD_LINE` → `parseMinorArcs` 处理。若被当成单条小弧，
 * 贪婪的 `(.+?)` 会一路吃到**最后一个**「（约 N 章）」，得到一个
 * 「小弧：【首夜敲门】（约 8 章）；【门缝纸条」这样的假条目 —— 实测一次就丢掉了
 * 整条中弧的全部小弧。
 */
const MINOR_LIST_HEADER = /^(?:小弧数|小弧|minor[\t ]*arc[\t ]*count|minor[\t ]*arcs)[\t ]*[：:]/iu

/**
 * P18：**无章数**的小弧行 —— `【错位门牌】：目标 … ｜ 起点 → 事件 → 落点`。
 *
 * 弧光层不再做篇幅预算后，模型可以完全不写「（约 N 章）」。此时必须另有东西把小弧行
 * 与普通字段行区分开：认开头的【】。普通字段是 `- 因果：…`，不会被误认。
 */
const MINOR_ITEM_BARE = /^[【\[](.+?)[】\]][\t ]*(?:[：:][\t ]*(.+?))?[\t ]*[。．.、,，]?$/u

/** 从正则匹配结果造一个 `ArcMinor`；名字/章数非法时返回 null。 */
function toMinor(match: RegExpExecArray): ArcMinor | null {
  const name = stripBrackets(toText(match[1]!))
  const chapters = Number(match[2])
  if (!name || !Number.isSafeInteger(chapters) || chapters < 1) return null
  const text = match[3] ? toText(match[3]) : ''
  return text ? { name, chapters, text } : { name, chapters }
}

/** P18：无章数形态。章数缺省 ⇒ 参与折算时等权（`arcWeight`）。 */
function toMinorBare(match: RegExpExecArray): ArcMinor | null {
  const name = stripBrackets(toText(match[1]!))
  if (!name) return null
  const text = match[2] ? toText(match[2]) : ''
  return text ? { name, text } : { name }
}

/**
 * 拆「小弧：A（约 9 章）；B（约 9 章）；C（约 8 章）　Σ = 9+9+8 = 26（本中弧 26，差额 0）」。
 *
 * 尾部那条 `Σ = …（本中弧 26，差额 0）` 不匹配条目正则，会被自然丢弃；
 * 合计与中弧章数不符是允许的规划弹性（实测 27 vs 26），由 `scaledBoundaries` 折算。
 * 解析不出任何条目时返回空数组 —— 调用方退化为「本中弧没有小弧」，不报错。
 */
function parseMinorArcs(value: string): ArcMinor[] {
  // 弧光习惯在末尾附一句合计：`Σ = 9+9+8 = 26（本中弧 26，差额 0）`。它**挂在最后
  // 一个小弧后面**（不是独立行），不先截掉就会把最后一条整个吞掉 —— 实测 16 个小弧
  // 只能解析出 10 个，缺的全部是各中弧的最后一个小弧。
  const head = value.split(/[Σ∑]/u)[0] ?? value
  const result: ArcMinor[] = []
  for (const raw of head.split(/[;；]/u)) {
    const item = raw.trim()
    if (!item) continue
    const match = MINOR_ITEM_ZH.exec(item) ?? MINOR_ITEM_EN.exec(item)
    if (match) {
      const minor = toMinor(match)
      if (minor) result.push(minor)
      continue
    }
    // P18：无章数形态（模型没写「约 N 章」）—— 用【】认。
    const bare = MINOR_ITEM_BARE.exec(item.replace(/^[-*][\t ]+/u, ''))
    const minor = bare ? toMinorBare(bare) : null
    if (minor) result.push(minor)
  }
  return result
}

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
  type MutableMid = { name: string; chapters?: number; fields: [string, string][]; minors: ArcMinor[] }
  let major: { name: string; chapters?: number; fields: [string, string][]; mids: MutableMid[]; endState?: string } | null = null
  let mid: MutableMid | null = null
  /** v7：这份结构用的是「卷 / 单元」这套词（只影响渲染措辞，不影响任何换算）。 */
  let naming: 'volume' | undefined

  for (const rawLine of plan.split(/\r?\n/u)) {
    const line = rawLine.trim()
    const majorMatch = MAJOR_HEADING.exec(line)
    const majorChapters = majorMatch ? headingChapterCount(majorMatch[2], majorMatch[3]) : null
    // P18：标题不带章数也收（弧光层已不做篇幅预算）。缺省 → `chapters` undefined → 等权折算。
    if (majorMatch) {
      if (/^#{2,3}[\t ]*卷/u.test(line)) naming = 'volume'
      major = { name: stripBrackets(majorMatch[1]!), ...(majorChapters !== null ? { chapters: majorChapters } : {}), fields: [], mids: [] }
      majors.push(major as ArcMajor)
      mid = null
      continue
    }
    const midMatch = MID_HEADING.exec(line)
    const midChapters = midMatch ? headingChapterCount(midMatch[2], midMatch[3]) : null
    if (midMatch && major) {
      if (/^#{3,4}[\t ]*单元/u.test(line)) naming = 'volume'
      mid = { name: stripBrackets(midMatch[1]!), ...(midChapters !== null ? { chapters: midChapters } : {}), fields: [], minors: [] }
      major.mids.push(mid)
      continue
    }
    // 多行小弧形态（P13）：`- 错位门牌（约 8 章）：起点 → 事件 → 落点`。
    // 必须在 FIELD_LINE 之前拦下 —— 否则它会被当成一个叫「错位门牌（约8章）」的字段，
    // 悄悄混进 `fields`，既污染中弧规格，又让 `minors` 为空（区间折算随之全错）。
    const bullet = BULLET_LINE.exec(line)
    if (bullet && mid && !MINOR_LIST_HEADER.test(bullet[1]!.trim())) {
      const body = bullet[1]!.trim()
      const item = MINOR_ITEM_ZH.exec(body) ?? MINOR_ITEM_EN.exec(body)
      const minor = item ? toMinor(item) : null
      if (minor) {
        mid.minors.push(minor)
        continue
      }
      // P18：无章数的小弧行，用【】认（`- 【错位门牌】：目标 … ｜ 起点 → …`）。
      const bare = MINOR_ITEM_BARE.exec(body)
      const bareMinor = bare ? toMinorBare(bare) : null
      if (bareMinor) {
        mid.minors.push(bareMinor)
        continue
      }
    }
    const fieldMatch = FIELD_LINE.exec(line)
    if (!fieldMatch) continue
    const [, rawName, rawValue] = fieldMatch
    const name = toText(rawName!)
    const value = toText(rawValue!)
    if (SKIP_FIELDS.has(name)) {
      // 小弧行不进球内容字段，但它的每一条都是独立的可选声明单位（P12-3）。
      if (mid && MINOR_FIELD_NAMES.has(name) && value) mid.minors.push(...parseMinorArcs(value))
      // 大弧的「结束状态」单独留档：体检要问「这卷的收尾有几条有中弧承接」（P13）。
      else if (!mid && major && /^(结束状态|End state)$/iu.test(name) && value) major.endState = value
      continue
    }
    if (!value) continue
    if (mid) mid.fields.push([name, value])
    else if (major) major.fields.push([name, value])
  }

  // P18：不再要求每条弧自报章数 —— 只要求「有中弧」这件事成立，章数缺省时按等权折算。
  const usable = majors.filter(item => item.mids.length > 0)
  if (!usable.length) return null
  return Object.freeze({
    majors: Object.freeze(usable),
    declaredTotal: usable.reduce((sum, item) => sum + arcWeight(item.chapters), 0),
    declaredChapters: usable.some(item => typeof item.chapters === 'number'),
    ...(naming ? { naming } : {}),
  })
}

/**
 * 两级结构判定（v7）：卷 → 单元，没有小弧。
 *
 * 判定必须用**结构**而不是"有没有【】"：小弧的记号是形态特征，两级结构的
 * 单元同样可能带【】。`minors` 全空 + `mids` 非空，就是两级。
 *
 * 两级不是降级形态：`arcWeight` / `scaledBoundaries` / `listArcNodes` 都已经
 * 按"有几个算几个"工作，小弧为空只是少了最细一层的区间，不影响卷/单元两级的定位。
 */
export function isTwoLevelArcStructure(parsed: ParsedArcStructure | null): boolean {
  if (!parsed?.majors.length) return false
  return parsed.majors.every(major => major.mids.length > 0 && major.mids.every(mid => mid.minors.length === 0))
}

/**
 * 累积边界（含 0 与总计），必要时按 total/declared 等比折算并保证严格递增。
 *
 * ⚠️ 导出是为了让 `arc-node.ts` 复用同一份换算实现。**不要在别处复写这套折算**
 * ——弧光自报章数与全书章数不等时（实测 880 vs 845），两份实现必然漂移，
 * 于是「结构位归属哪一章」会出现两个互相矛盾的答案。
 */
export function scaledBoundaries(counts: readonly number[], total: number): number[] {
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

  const majorBounds = scaledBoundaries(parsed.majors.map(item => arcWeight(item.chapters)), totalChapters)
  const majorIndex = parsed.majors.findIndex((_, index) => from <= majorBounds[index + 1]!)
  if (majorIndex < 0) return null
  const major = parsed.majors[majorIndex]!
  const majorRange: [number, number] = [majorBounds[majorIndex]! + 1, majorBounds[majorIndex + 1]!]

  const midBounds = scaledBoundaries(major.mids.map(item => arcWeight(item.chapters)), majorRange[1] - majorRange[0] + 1)
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
    endMidRange: [
      majorRange[0] + midBounds[endMidIndex]!,
      majorRange[0] + midBounds[endMidIndex + 1]! - 1,
    ] as const,
    midFields: mid.fields,
    endMidFields: major.mids[endMidIndex]!.fields,
    midMinors: mid.minors,
    endMidMinors: major.mids[endMidIndex]!.minors,
    remainingMids: major.mids.slice(endMidIndex + 1).map((item, offset) => Object.freeze({
      name: item.name,
      midIndex: endMidIndex + 2 + offset,
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
  return !!parsed && parsed.declaredChapters && parsed.declaredTotal > 0 && parsed.declaredTotal !== totalChapters
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
    // 小弧子项（`- 错位门牌（约8章）：起点 → …`）不是字段，别看错成「一句话定位」。
    const bullet = BULLET_LINE.exec(rawLine.trim())
    if (bullet && (MINOR_ITEM_ZH.test(bullet[1]!.trim()) || MINOR_ITEM_EN.test(bullet[1]!.trim()))) continue
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
 * 「转折」是每个中弧都有的**一次性**节点（实测 6/6 个中弧都有），因此是唯一
 * 能按章声明的字段。中弧的 因果 / 时序 / 目标 / 动机 / 路径 / 尝试 N 是**整段规格**，
 * 不是额度：把它们也列进可声明清单，模型会拿「本中弧起点」这种早已发生过的格子
 * 去认领后面的章（实测第 6 章挂 `M1-1/时序`、第 7 章挂 `M1-1/因果`，形式合规、语义空转）。
 *
 * 导出是为了让 `arc-node.ts` 的判断与本文件的渲染清单共用同一份定义 —— 两处各写一份
 * 正则必然漂移，于是「提示词允许声明什么」和「审计认可什么」会对不上。
 */
export function isTurnField(name: string): boolean {
  // v7（两级：卷/单元）没有「转折」字段，它的等价物是「逼法」——单元结束时逼法从 X 变成 Y，
  // 就是这一格的主动权/压力反转。不认它，两级结构在大纲层会一个可声明位都没有。
  return /^(转折|逼法|turning[\t ]*point|escalation)$/iu.test(name)
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
  // 措辞跟着**结构自己的用词**走：`volume` 才换词。不能用"有没有小弧"判断 ——
  // 旧项目里也存在缺小弧的形态，那样会被误改名（实测：已有用例的旧结构被错换成「卷/单元」）。
  const volumeWording = parsed.naming === 'volume'
  const spec = span.midFields.map(([name, value]) => `${name}：${value}`).join('；')
  const rescale = arcStructureNeedsRescale(parsed, totalChapters)
    ? (en
        ? ` (the arc structure totals ${parsed.declaredTotal} chapters; chapter positions below are scaled to the book's ${totalChapters})`
        : `（弧光合计 ${parsed.declaredTotal} 章，以下章号已按全书 ${totalChapters} 章等比折算）`)
    : ''
  const remaining = span.remainingMids.length
    ? span.remainingMids
        .map(item => (en
          ? `mid arc ${item.name} (M${span.majorIndex}-${item.midIndex}, ch. ${item.range[0]}–${item.range[1]}) — ${item.gist}`
          : `中弧【${item.name}】（M${span.majorIndex}-${item.midIndex}，约第 ${item.range[0]}–${item.range[1]} 章）— ${item.gist}`))
        .join('\n  - ')
    : (en ? '(none — this is the last mid arc of the major arc)' : '（无 —— 这是本大弧的最后一个中弧）')

  // P12-4：小弧 = **归属**（一个小弧跨 8–9 章，这 8–9 章都该声明它，重复是常态）；
  // 转折 = **一次性额度**（一个中弧只有一个，只能在其中一章声明）。
  // 清单必须带**区间**：只说「可声明这些 ID」而不说「哪个 ID 覆盖哪几章」，模型只能猜 ——
  // 实测猜测的结果是 5 章里 4 章写「覆盖：无」，声明彻底失去信息量。
  const slotLines = (
    midIndex: number,
    range: readonly [number, number],
    fields: readonly (readonly [string, string])[],
    minors: readonly ArcMinor[],
  ): string[] => {
    const turn = fields.find(([field]) => isTurnField(field))
    const lines: string[] = []
    const minorItems = minorRanges(minors, range)
    if (minorItems.length) {
      lines.push(en
        ? '  - Minor arcs (claim the one whose range contains this chapter; the same minor arc repeats across every chapter it spans — that is correct, not a duplicate):'
        : '  - 小弧（**本章章号落在哪个区间就写哪个**；同一小弧会在它覆盖的每一章重复出现，这是对的，不是重复消费）：')
      for (const item of minorItems) {
        lines.push(en
          ? `    - M${span.majorIndex}-${midIndex}/小弧:${item.name} — ch. ${item.range[0]}–${item.range[1]}`
          : `    - M${span.majorIndex}-${midIndex}/小弧:${item.name} — 第 ${item.range[0]}–${item.range[1]} 章`)
      }
    }
    if (turn) {
      lines.push(en
        ? `  - Turning point (one-shot — claim it once, in the chapter where it actually happens): M${span.majorIndex}-${midIndex}/${turn[0]}`
        : `  - 转折（一次性 —— 只在它真正发生的那一章写一次）：M${span.majorIndex}-${midIndex}/${turn[0]}`)
    }
    if (lines.length === 0) {
      lines.push(en
        ? '  - This mid arc exposes no claimable slot; write "Covers: none" for every chapter.'
        : '  - 本中弧没有可声明的结构位 —— 每章都写「覆盖：无」。')
    }
    return lines
  }
  const coverableLabel = [
    en
      ? '- Slots this batch may claim (exactly one ID per chapter\'s "Covers:" line):'
      : '- 本批可声明的结构位（每章「覆盖：」只写一个 ID）：',
    ...slotLines(span.midIndex, span.midRange, span.midFields, span.midMinors),
    ...(span.endMidIndex > span.midIndex
      ? slotLines(span.endMidIndex, span.endMidRange, span.endMidFields, span.endMidMinors)
      : []),
  ].join('\n')

  const crossing = span.nextMidBoundary !== null && span.nextMidName
    ? (en
        ? `\n★ This batch crosses a mid-arc boundary: chapter ${span.nextMidBoundary} onward belongs to mid arc ${span.nextMidName}. Write that part from the NEW mid arc's spec (its full spec is in the arc structure above) — but do not pull in anything from the mid arcs after it.`
        : `\n★ 本批跨越中弧边界：第 ${span.nextMidBoundary} 章起属于 中弧【${span.nextMidName}】。跨过边界后按**新中弧**的规格写（其完整规格见上方「弧光结构」中的该中弧），但**不得**连带把更后面的中弧内容提前。`)
    : ''

  const body = en
    ? `[ARC POSITION for this batch — derived from the arc structure, for placement only]
- This batch: chapters ${from}–${to} of ${totalChapters}${rescale}
- Major arc ${span.majorIndex} "${span.majorName}" (approx. ch. ${span.majorRange[0]}–${span.majorRange[1]})
- Mid arc ${span.midIndex} "${span.midName}" (approx. ch. ${span.midRange[0]}–${span.midRange[1]})${spec ? ` | ${spec}` : ''}
${coverableLabel}
- Remaining mid arcs inside this major arc (do NOT execute them early, and never claim their slots):
  - ${remaining}
[HARD RULE — this failure has actually happened]
1. Advance only what is still unplayed inside "${span.midName}".
2. The goal / attempts / turning point of any mid arc AFTER this batch must NOT happen in this batch, and must NOT appear in any chapter's "Covers:" line — they belong to chapter ${span.afterBatchMidBoundary ?? span.midRange[1] + 1} and beyond.
3. If this batch reaches the turning point of the current mid arc, close it out and ease into the next minor arc; do not jump to the next mid arc's goal.
4. The "ending state" of major arc ${span.majorIndex} is the **acceptance criterion for chapter ${span.majorRange[1]}**, not material you may use now. Do not pay off any of its clauses in this batch (e.g. a character taking on their first ledger entry, someone quoting a price for the first time) — those are the business of later mid arcs.
5. A minor arc's chapter span is a **given, not an estimate**: 8 chapters means 8 chapters of content — never compress it into 1–2 chapters and fold the free ones into the next minor arc.
   Its end state belongs to its **last** chapters: when there is no new event to advance, unfolding the consequences of the same step is allowed, but the end state may not be paid off early.
   ★ The chapter count is a **given condition** (divided from the arc counts), not a writing budget: do not add material just to fill those chapters, and do not stall because they are not used up — whether a chapter is worth reading depends on its situation, not on which slot it occupies.
   This holds **even when the batch covers the whole arc** — covering the whole arc is not permission to write it in one go, it is an obligation to spread it chapter by chapter.${crossing}`
    : `【本批所处弧位（据「弧光结构」推算，仅用于定位，不改变弧光本身）】
- 本批范围：第 ${from}–${to} 章（全书 ${totalChapters} 章）${rescale}
- 所在大弧：大弧${span.majorIndex}【${span.majorName}】（约第 ${span.majorRange[0]}–${span.majorRange[1]} 章）
- 所在中弧：中弧${span.midIndex}【${span.midName}】（约第 ${span.midRange[0]}–${span.midRange[1]} 章）${spec ? `｜${spec}` : ''}
${coverableLabel}
- 本大弧内**后续**中弧（★ 本批不得提前执行，也不得写进覆盖声明）：
  - ${remaining}
【硬约束·防提前】（实测已发生过，务必遵守）
1. 本批只推进【${span.midName}】内**尚未发生**的内容；
2. 本批之后的中弧，「目标 / 尝试 / 转折」**不得在本批提前实现，也不得出现在任何一章的「覆盖：」声明里** —— 它们属于第 ${span.afterBatchMidBoundary ?? span.midRange[1] + 1} 章及以后；
3. 若本批已写到当前中弧的转折点，请在此收束并向下一小弧过渡，**不要**跳到下一个中弧的目标；
4. 大弧${span.majorIndex}【${span.majorName}】的「结束状态」是本卷**第 ${span.majorRange[1]} 章才成立的验收标准**，不是本批可用的材料 —— 不得把其中任何一条在本批写掉（实测：第 4 章就把「鲁传福替他挡」写成事实，而那属于后续中弧的尝试 1）；
5. 一个小弧的章数区间是**给定条件，不是估计值**：跨 8 章就得写出 8 章的内容，**不得**压缩进 1–2 章、再把空出来的章并进下一个小弧。
   它的「落点状态」是**最后几章**才到的地方：没有新事件可推进时，写同一步的后果是允许的（这一章的任务是展开上一步的影响），但不得提前兑现落点。
   ★ 章数只是**给定条件**（由弧光的个数均分而来），不是写作预算：不要为了"用满这几章"而加料，
   也不要因为"这几章还没用完"而拖延 —— 一章值不值得看，取决于这一章的局面，不取决于它占第几格。
   这一条在本批覆盖整条弧时**同样成立** —— 覆盖整弧不是"可以一次写完"的许可，而是"必须逐章分摊"。${crossing}`

  if (!volumeWording) return body

  // v7 两级（卷 / 单元）：结构里的词已经是「卷/单元」，而本块是按「大弧/中弧/小弧」写的。
  // 只在最后统一换词，不改上面任何一条约束的语义 —— 换词会同时把规则 3、5 里的「中弧/小弧」
  // 替换成「单元」，这正是两级结构下它们该指的对象。旧三级结构走不到这里，措辞逐字不变。
  return body
    .replaceAll('大弧', '卷')
    .replaceAll('中弧', '单元')
    .replaceAll('小弧', '单元')
    .replaceAll('mid arcs', 'units')
    .replaceAll('mid arc', 'unit')
    .replaceAll('Mid arc', 'Unit')
    .replaceAll('minor arcs', 'units')
    .replaceAll('minor arc', 'unit')
    .replaceAll('major arc', 'volume')
}

/**
 * 弧光分层**信息量体检**（P13）。
 *
 * ## 为什么需要它
 *
 * 「剧情提前兑现」不是模型随机跑偏，而是**分层信息量倒置**的必然结果。实测
 * （2026-10-18 作者 150 章弧光，单位 = 去空白后的字数 / 每章）：
 *
 * | 层 | 覆盖 | 信息密度 |
 * |---|---|---|
 * | 大弧 | 50 章 | ~3.5 字/章 |
 * | 中弧 | 25 章 | 5.0–9.0 字/章 |
 * | 小弧 | 8–13 章 | **0.36–0.72 字/章** |
 *
 * 小弧层是唯一**信息量下降**的一层：三个小弧合起来只有 18 字，却要撑 25 章大纲。
 * 大纲在本层拿不到材料，就只能向上越层取材 —— 于是第 4 章写掉了本属后续中弧的
 * 「鲁传福替他挡电话」，而它当时唯一的线索是大弧「结束状态」里的
 * 「鲁传福背上第一笔登记账」。
 *
 * **判据 AY**：层级不是空间，是信息。每下一层的对应切片必须**严格多于**上一层；
 * 某一层若只是上一层的同义改写（甚至更短），它就没有展开能力，下层必然越层取材。
 *
 * 体检只报告不拦截（与弧光覆盖对账同策略）：作者可能有意让某层简写。
 */
export interface ArcDensityFinding {
  code:
    | 'MINORS_NAMELESS'
    | 'MINOR_LAYER_THINNER'
    | 'MAJOR_NO_MID_PROGRESSION'
    | 'MAJOR_END_STATE_UNASSIGNED'
    /** 中弧只规定了「他失败」的位置，没有「对手失手」的位置（P16） */
    | 'MID_ONE_SIDED'
    /** 小弧的全部事件都从主角视角写，没有一条是对手出招落空（P16） */
    | 'MINOR_NO_COUNTER'
    /** 中弧的「位置行」没有点名由哪个小弧兑现，等于只是声明（P17） */
    | 'MID_SLOT_UNLINKED'
  /** 出问题的层级，如 `大弧1【门牌错位与三方围猎】` */
  where: string
  zh: string
  en: string
}

const densityLength = (value: string): number => value.replace(/\s+/gu, '').length
/** 小弧内容少于这个字数就当「只有名字」—— 一个能撑起 8 章的句子里程碑写不满 20 字。 */
const MINOR_CONTENT_FLOOR = 20
const MAJOR_PROGRESSION_FIELD = /中弧推进|mid[-\t ]*arc[-\t ]*progression/iu
const NAMES_A_MID = /中弧[\t ]*[0-9０-９一二三四五六七八九十]|mid[\t ]*arc[\t ]*[0-9]/iu
/**
 * 三型各自规定「他失败」的位置：A=阻塞、B=尝试、C=扑空。
 *
 * P16 的背景：这三行是 P15 加的（治"一路顺利"），但它们**只加了失败**。于是弧光
 * 从"每条都顺利"摆到了另一头——作者 150 章弧光的中弧1 里，12 条事件 10 条受挫、
 * 2 条还是"什么都不做也算赢"，对手一次没失手。读者的读感就是「被动挨打」。
 * 所以每一型都补了一个「赢回来」字段，这两组判定用来核对它们有没有被写出来。
 */
const FAILURE_SLOT_FIELD = /阻塞|尝试|扑空|block|attempt|dead[\t ]*end/iu
const WINBACK_SLOT_FIELD = /反制|得手|反获|counter|score|recovery/iu
/** 「他想要…」是模板给的事件句式；全部事件都用它 = 视角全在主角的失败上。 */
const HERO_WANTS_OPENER = /^[他她]想要/u
/**
 * 中弧里的「位置行」——它们各占一个具体的事发点，必须点名由哪一个小弧兑现（P17）。
 *
 * 背景：这几行是 P15/P16 加的，但代码从来没有解析过它们的取值 —— 它们只作为
 * `mid.fields` 的自由文本被原样注入下游，既不校验、也没有任何小弧字段引用它们。
 * 于是它们只是**声明**：写成什么都合规，逐章展开时可以一次都不兑现
 * （实测一条 25 章的中弧写了「反制」，它下面 3 个小弧无一对应，那 25 章里对手一次没失手）。
 * 大弧的「结束状态」早有同一条规矩（`NAMES_A_MID`：必须点名承接它的中弧），
 * 中弧这一层却漏了 —— 同一个病下移了一层。
 */
const SLOT_FIELD = /阻塞|反制|得手|扑空|反获|转折|block|counter|score|dead[\t ]*end|recovery|turning[\t ]*point/iu
/** 位置行末尾的兑现点：`（小弧 1）` / `(minor arc 2)` */
const SLOT_LINK = /小弧[\t ]*[0-9０-９一二三四五六七八九十]|minor[\t ]*arc[\t ]*[0-9]/iu

export function auditArcDensity(parsed: ParsedArcStructure | null): ArcDensityFinding[] {
  if (!parsed) return []
  // v7 两级（卷/单元）用的是另一套字段（叙事任务 / 进入·离开 / 段间推进 / 逼法）。
  // 下面七条全部针对三级规格（「中弧推进」「位置行点名」「小弧密度」）—— 在两级结构上
  // 逐条都会误报（例如"没有中弧推进"对每个卷都成立）。两级自己的体检（交手类型 /
  // 档位）另行接入；在那之前，这里对 volume 词表保持静默，而不是刷一屏假告警。
  if (parsed.naming === 'volume') return []
  const findings: ArcDensityFinding[] = []
  parsed.majors.forEach((major, majorOffset) => {
    const majorIndex = majorOffset + 1
    const majorWhere = `大弧${majorIndex}【${major.name}】`
    if (!major.fields.some(([name]) => MAJOR_PROGRESSION_FIELD.test(name))) {
      findings.push({
        code: 'MAJOR_NO_MID_PROGRESSION',
        where: majorWhere,
        zh: `${majorWhere} 没有「中弧推进」—— 只交代了为什么接在上一大弧之后，没有一个字交代内部几个中弧怎么驱动，这一层的类型是空标签。`,
        en: `${majorWhere} has no mid-arc progression line — it says why it follows the previous major arc but nothing about how its own mid arcs drive each other, so its type is an empty label.`,
      })
    }
    if (major.endState && !NAMES_A_MID.test(major.endState)) {
      findings.push({
        code: 'MAJOR_END_STATE_UNASSIGNED',
        where: majorWhere,
        zh: `${majorWhere} 的「结束状态」没有点名任何中弧来承接 —— 这一卷的收尾没有落点。`,
        en: `${majorWhere}'s end state names no mid arc — nothing in this volume is assigned to pay it off.`,
      })
    }
    major.mids.forEach((mid, midOffset) => {
      const midWhere = `大弧${majorIndex}/中弧${midOffset + 1}【${mid.name}】`
      const nameless = mid.minors.filter(item => densityLength(item.text ?? '') < MINOR_CONTENT_FLOOR)
      if (nameless.length > 0) {
        // P18：弧光可以不带章数，报"覆盖多少章"时按可得信息退化，不能编一个数字出来。
        const namelessChapters = nameless.reduce((sum, item) => sum + (item.chapters ?? 0), 0)
        const scope = namelessChapters > 0 ? `这 ${namelessChapters} 章` : '这一段'
        const scopeEn = namelessChapters > 0 ? `the ${namelessChapters} chapters` : 'this stretch of'
        findings.push({
          code: 'MINORS_NAMELESS',
          where: midWhere,
          zh: `${midWhere} 有 ${nameless.length}/${mid.minors.length} 个小弧只有名字、没有必然事件 —— 这些小弧覆盖的${scope}大纲拿不到本层材料，只能向上越层取材。`,
          en: `${midWhere}: ${nameless.length}/${mid.minors.length} minor arcs carry a name only, with no required events — ${scopeEn} they cover has no material at this layer and must borrow from a coarser one.`,
        })
      }
      const minorWords = mid.minors.reduce((sum, item) => sum + densityLength(item.name) + densityLength(item.text ?? ''), 0)
      const fieldWords = mid.fields.reduce((sum, [, value]) => sum + densityLength(value), 0)
      // 已经有「只有名字」那条时不再报这一条 —— 它说的是同一个病的另一面，两条并列只会
      // 让报告翻倍（实测 6 个中弧出 18 行），真信号被自己的回声淹没。
      if (nameless.length === 0 && mid.minors.length > 0 && minorWords <= fieldWords) {
        findings.push({
          code: 'MINOR_LAYER_THINNER',
          where: midWhere,
          zh: `${midWhere} 的小弧内容合计 ${minorWords} 字，不多于该中弧自身的 ${fieldWords} 字 —— 信息量在这一层没有增加，等于没有真正细分。`,
          en: `${midWhere}: minor-arc content totals ${minorWords} chars, no more than the mid arc's own ${fieldWords} — information does not grow at this layer, so it was never really subdivided.`,
        })
      }

      // ---- P16：受挫偏置 ----
      // 三型原本都只有「他失败」的位置（阻塞 / 尝试 / 扑空），没有「对手失手」的位置。
      // 一条 25 章的中弧里，唯一还能写"赢"的地方只剩「转折」一处 —— 于是整弧读起来
      // 就是一路挨打。这里核对每型有没有补上「赢回来」那一行。
      const hasFailureSlot = mid.fields.some(([name]) => FAILURE_SLOT_FIELD.test(name))
      const hasWinBackSlot = mid.fields.some(([name]) => WINBACK_SLOT_FIELD.test(name))
      if (!hasWinBackSlot) {
        const span = mid.chapters ? `${mid.chapters} 章` : '整段'
        const spanEn = mid.chapters ? `${mid.chapters} chapters` : 'this whole arc'
        findings.push({
          code: 'MID_ONE_SIDED',
          where: midWhere,
          zh: hasFailureSlot
            ? `${midWhere} 只写了"他失败"的位置（阻塞 / 尝试 / 扑空），没有写"对手失手"的位置（反制 / 得手 / 反获）—— 这${span}里他一直在挨打。`
            : `${midWhere} 既没有"他失败"的位置，也没有"对手失手"的位置（旧格式）—— 这一弧的推进只剩"然后呢"。`,
          en: hasFailureSlot
            ? `${midWhere} defines only where he fails (Block / Attempt / Dead end) and never where the opponent loses (Counter / Score / Recovery) — across ${spanEn} he only takes hits.`
            : `${midWhere} defines neither where he fails nor where the opponent loses (legacy format) — this arc progresses on "and then" alone.`,
        })
      } else {
        // 中弧已有赢回位置时才查小弧层面：中弧缺那一行时，同一条病报两遍只会淹没真信号。
        for (const minor of mid.minors) {
          const steps = splitMinorSteps(minor.text)
          const events = steps.slice(1, -1)
          if (events.length >= 3 && events.every(item => HERO_WANTS_OPENER.test(item))) {
            findings.push({
              code: 'MINOR_NO_COUNTER',
              where: `${midWhere}/小弧【${minor.name}】`,
              zh: `${midWhere}/小弧【${minor.name}】的 ${events.length} 条事件全部写成「他想要…结果…」—— 视角全在他的失败上，没有一条是对手出招落空。`,
              en: `${midWhere}/minor arc [${minor.name}]: all ${events.length} events are written as "he wants … and gets …" — the whole arc is his failures, with no event where the opponent's plan fails.`,
            })
          }
        }
      }

      // ---- P17：位置行有没有落到某个小弧上 ----
      // 只查形状（末尾有没有「（小弧 N）」），不查语义 —— 但这一条恰恰是"声明"与
      // "约束"的分界：不点名，那几行没有任何东西会来兑现它。
      const slotFields = mid.fields.filter(([name]) => SLOT_FIELD.test(name))
      const unlinked = slotFields.filter(([, value]) => !SLOT_LINK.test(value))
      if (unlinked.length > 0 && mid.minors.length > 0) {
        const names = unlinked.map(([name]) => name).join(' / ')
        findings.push({
          code: 'MID_SLOT_UNLINKED',
          where: midWhere,
          zh: `${midWhere} 的「${names}」没有点名由哪个小弧兑现 —— 它们只是声明，逐章展开时这几个事发点可以一次都不发生。`,
          en: `${midWhere}: ${names} name no minor arc that pays them off — they stay declarations, and the chaptered expansion may never let one of them happen.`,
        })
      }
    })
  })
  return findings
}
