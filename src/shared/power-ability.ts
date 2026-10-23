/**
 * 能力（本书的能力规则）—— P1-1 连续性宿体第四格（2026-10-24）。
 *
 * ## 它回答什么问题
 *
 * 「这条能力能做什么、要付什么代价、什么情况下会被破，这一章能不能用」。此前这件事只活在
 * `golden_finger` 的一段自由文本里，而那段文本**从不进正文请求**（全仓只有
 * `architecture.command.ts` 调 `withGoldenFinger`；正文链的排除清单含 `goldenFinger`）。
 * 现有【本书规则】又从世界观第 1 维抽 ≤3 条，实测三库都恰好 8 条用满 —— 能力规则挤不进去。
 *
 * ## 一行 = 一条**本书级**规则，不是一个人的技能
 *
 * 角色技能的家是 `characters.abilities`，它已经随角色卡进正文。再登一份就是第二套账。
 * 所以本模块**没有** `characterId`：主角的金手指、体系的漏洞、宝物权限才是这里的东西。
 *
 * ## 三类限制分开存，空就整段省略
 *
 * `hardLimit`（永远做不到什么 / 必要前提）、`weakness`（敌人能怎么破）、`costNote`（用一次
 * 要付什么）在正文里是三种不同的失败。哪一段为空就整段不出现，**绝不写「未登记」** ——
 * 注入文本里的「限制未登记」会被模型读成「**没有**限制」，比不写更糟。这是对判据 DN 的
 * **刻意例外**：缺失提示只放在登记页（黄条），不进提示词。
 *
 * ## 三态与期界
 *
 * - `active`（`stageChapter ≤ 本章`）注入，标「自第 N 章起」；
 * - `ahead`（`stageChapter > 本章`）**一律不注入**（剧透）；
 * - `undated`（`stageChapter IS NULL`）注入，标「作者登记，未标章号」——真实数据里这是主路径
 *   （三库「第 N 章」命中 0 次）。**绝不写「第 0 章」或「当前章」**（判据 DN 同型）。
 *
 * 期界过滤由调用方在渲染前做，本模块的渲染入口再兜一次：`ahead` 永远不出现在节里。
 *
 * ## 出处三档
 *
 * `evidenceScope` 决定「这条引文来自哪里」，与 `stageChapter`（从第几章起可用）是两根轴：
 *
 * - `chapter`：只有这一档允许出现「来源第 N 章」；
 * - `golden-finger`：渲染「作者登记 + 出处：金手指原文」，**不出现任何章号**；
 * - `worldbuilding`：渲染「作者登记 + 出处：世界观」，**不出现任何章号**；
 * - `NULL`：只写「作者登记」，不猜出处域。
 *
 * **已知限制**：13 列里没有单独的「引文章号」列，`chapter` 档的 N 只能取 `stageChapter`。
 * 若作者标了 `chapter` 却没填章号，本节**不编造**章号，退回「出处：作者登记」。
 */
import type { WritingLanguage } from './writing-language'

/** 能力相对本章的位置。`ahead` 永不注入。 */
export type AbilityStageState = 'active' | 'ahead' | 'undated'

/** 出处域。只有 `chapter` 允许在渲染行里出现「来源第 N 章」。 */
export type AbilityEvidenceScope = 'golden-finger' | 'worldbuilding' | 'chapter'

/** 来源：本期只有作者登记；留 `derived` 是为了以后从定稿抽取时不改表。 */
export type AbilitySource = 'author' | 'derived'

/** 一条本书级能力规则。 */
export interface PowerAbilityDefinition {
  abilityId: string
  /** 能力叫法。UNIQUE：同名两条会让「说的是哪一条」无法回答。 */
  name: string
  /** 形态短语（规则 / 功法 / 天赋 / 知识 / 宝物 / 系统 / 导师，或混合描述）。**词表外照存**。 */
  form: string
  /** 硬限制：永远做不到什么 / 触发的必要前提。 */
  hardLimit: string
  /** 弱点：敌人能怎么破。 */
  weakness: string
  /** 代价短语：用一次要付什么。 */
  costNote: string
  /** 从第几章起可用；`null` = 未标章号（主路径）。 */
  stageChapter: number | null
  /** 阶段描述（境界名 / 开局·中期·后期）。 */
  stageNote: string
  /** 出处逐字引文（来自 `evidenceScope` 指向的那段原文）。 */
  evidence: string
  /** 出处域；`null` = 未标出处（渲染成「作者登记」，不猜）。 */
  evidenceScope: AbilityEvidenceScope | null
  source: AbilitySource
  createdAt: string
  updatedAt: string
}

/** 写入入参：`abilityId` 缺省表示新建。 */
export interface PowerAbilityInput {
  abilityId?: string
  name: string
  form?: string
  hardLimit?: string
  weakness?: string
  costNote?: string
  stageChapter?: number | null
  stageNote?: string
  evidence?: string
  evidenceScope?: AbilityEvidenceScope | null
}

export interface AbilityWriteResult {
  success: boolean
  abilityId?: string
  error?: string
}

export interface AbilityDeleteResult {
  success: boolean
  error?: string
}

/**
 * `form` 的七类提示。**只作 `datalist`，不做 CHECK**：取样里 18 个实例有 3 个横跨两到三类
 * （规则 + 功法 + 天赋寄生），定枚举等于替作者切一个切不开的东西。词表外的值照存、照渲染。
 */
export const ABILITY_FORM_HINTS = ['规则', '功法', '天赋', '知识', '宝物', '系统', '导师'] as const

/** 名称 / 形态 / 三类限制 / 阶段描述的长度上限（与物品、制度的 200 同口径）。 */
export const ABILITY_TEXT_MAX = 200
/** 出处逐字引文的上限：比短语宽，但仍只允许摘一句（不是整段原文）。 */
export const ABILITY_EVIDENCE_MAX = 1_000
/** 条数上限：5 条以内一眼扫完。 */
export const ABILITY_MAX_ITEMS = 5
/** 正文行总字数上限（不含节标题与说明句）。 */
export const ABILITY_MAX_CHARS = 640

const EVIDENCE_SCOPES: readonly AbilityEvidenceScope[] = ['golden-finger', 'worldbuilding', 'chapter']

/** 出处域是否在允许的三档里。面板与仓储共用这一处判定。 */
export function isAbilityEvidenceScope(value: unknown): value is AbilityEvidenceScope {
  return typeof value === 'string' && (EVIDENCE_SCOPES as readonly string[]).includes(value)
}

/**
 * 三态判定的唯一实现。
 *
 * `stageChapter` 缺失 ⇒ `undated`（主路径）；本章或更早 ⇒ `active`；晚于本章 ⇒ `ahead`。
 * 不接受 0 / 负数：表上的 CHECK 挡得住，这里先给可读错误（0 会被读成「序章」）。
 */
export function abilityStageState(
  ability: Pick<PowerAbilityDefinition, 'stageChapter'>,
  chapterNumber: number,
): AbilityStageState {
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) throw new Error('ABILITY_INVALID:chapterNumber')
  const stage = ability.stageChapter
  if (stage === null || stage === undefined) return 'undated'
  if (!Number.isSafeInteger(stage) || stage < 1) throw new Error('ABILITY_INVALID:stageChapter')
  return stage <= chapterNumber ? 'active' : 'ahead'
}

/** 一条「可渲染的能力」= 记录 + 它相对本章的位置。 */
export interface AbilityEntry {
  ability: PowerAbilityDefinition
  state: AbilityStageState
}

/** 出处域在中文里的说法。`chapter` 的章号由调用处单独拼（见 `renderAbilityLine`）。 */
function scopeText(ability: PowerAbilityDefinition): string {
  switch (ability.evidenceScope) {
    case 'golden-finger': return '出处：金手指原文'
    case 'worldbuilding': return '出处：世界观'
    case 'chapter': return ability.stageChapter !== null && ability.stageChapter !== undefined
      ? `来源第${ability.stageChapter}章`
      // 标了 chapter 档却没填章号：不编造，退回「作者登记」（判据 DN 同型）。
      : '出处：作者登记'
    default: return ''
  }
}

function scopeTextEn(ability: PowerAbilityDefinition): string {
  switch (ability.evidenceScope) {
    case 'golden-finger': return 'source: golden-finger text'
    case 'worldbuilding': return 'source: worldbuilding'
    case 'chapter': return ability.stageChapter !== null && ability.stageChapter !== undefined
      ? `source: Chapter ${ability.stageChapter}`
      : 'source: author entry'
    default: return ''
  }
}

/**
 * 一条能力在提示词里的**唯一**渲染入口（正文链与将来的审稿链共用，判据 DM 同型）。
 *
 * 中文件逐字对齐提案 §5 的两行：
 * `- 噬魂推演录（规则·功法·天赋混合；作者登记，未标章号）：硬限制——…；代价——…；弱点——…`
 *
 * 三类限制全部为空时**连冒号都不出现**：空段产生零字节，不是「未登记」。
 */
export function renderAbilityLine(entry: AbilityEntry, writingLanguage: WritingLanguage): string {
  const ability = entry.ability
  const isEn = writingLanguage === 'en-US'
  const name = ability.name.trim() || (isEn ? 'unnamed ability' : '未命名能力')
  const parts: string[] = []
  const form = ability.form.trim()
  if (form) parts.push(form)

  const stage = entry.state === 'undated'
    ? (isEn ? 'author entry, no chapter' : '作者登记，未标章号')
    // G4a 条件 1：`golden-finger` / `worldbuilding` 两档**不得出现任何章号**。
    // `stage_chapter` 是「从第几章起可用」，仍是章号 —— 所以这两档只写「作者登记」，
    // 阶段章号只参与 `ahead` 过滤（未来行根本不进本节），不在行内显示。
    : ability.evidenceScope === 'golden-finger' || ability.evidenceScope === 'worldbuilding'
      ? (isEn ? 'author entry' : '作者登记')
      : (isEn ? `from Chapter ${ability.stageChapter}` : `自第${ability.stageChapter}章起`)
  parts.push(stage)

  const scope = isEn ? scopeTextEn(ability) : scopeText(ability)
  if (scope) parts.push(scope)
  // 无出处域 + 有章号时，「作者登记」这一事实不能被吞掉（NULL 档必须写作者登记）。
  if (!scope && entry.state !== 'undated') parts.push(isEn ? 'author entry' : '作者登记')

  const segments: string[] = []
  const hardLimit = ability.hardLimit.trim()
  const costNote = ability.costNote.trim()
  const weakness = ability.weakness.trim()
  if (hardLimit) segments.push(isEn ? `Hard limit \u2014 ${hardLimit}` : `硬限制——${hardLimit}`)
  if (costNote) segments.push(isEn ? `Cost \u2014 ${costNote}` : `代价——${costNote}`)
  if (weakness) segments.push(isEn ? `Weakness \u2014 ${weakness}` : `弱点——${weakness}`)

  const head = isEn ? `- ${name} (${parts.join('; ')})` : `- ${name}（${parts.join('；')}）`
  return segments.length > 0 ? `${head}${isEn ? ': ' : '：'}${segments.join(isEn ? '; ' : '；')}` : head
}

/**
 * 排序：`active` 与 `undated` **混排**，统一按 `name` 的码元序（`<` 比较，不用 `localeCompare`）。
 *
 * 不按强度（需要派生数值，ADR-0022）、不按出场角色（本表没有 `character_id`）、
 * 不按解锁先后（`undated` 无章号可比）。5 条以内顺序不承载语义，固定码元序才可测。
 */
function orderEntries(entries: readonly AbilityEntry[]): AbilityEntry[] {
  return [...entries].sort((left, right) => {
    const byName = left.ability.name < right.ability.name ? -1 : left.ability.name > right.ability.name ? 1 : 0
    if (byName !== 0) return byName
    return left.ability.abilityId < right.ability.abilityId ? -1
      : left.ability.abilityId > right.ability.abilityId ? 1 : 0
  })
}

/** 节首说明（中文逐字）：缺了后半句会被读成「没登记 = 没有限制」。 */
const ZH_LEAD = '以下是作者登记的能力规则；未登记的用法不在本节范围内，不得据此推定无限制。'
const EN_LEAD = 'Only author-registered ability rules are listed; uses that were never registered are outside this section and must not be read as unlimited.'

/**
 * 渲染【能力】整节；没有可注入的条目就返回空串（**不要**产出只有标题的空节）。
 *
 * `ahead`（`stageChapter > 本章`）在这里再过滤一次：调用方已经滤过一遍，但这一层是
 * 「未来能力不进上下文」的最后一道闸 —— 将来若有第二个调用方忘了滤，也不会剧透。
 *
 * @param maxChars 正文行总字数上限；预算外**整条丢弃**，不截半行（截断的限制句会变成一条更宽松的规则）。
 */
export function renderAbilitySection(
  abilities: readonly PowerAbilityDefinition[],
  writingLanguage: WritingLanguage,
  chapterNumber: number,
  maxChars: number = ABILITY_MAX_CHARS,
): string {
  const entries = orderEntries(
    abilities
      .filter(ability => ability.name?.trim())
      .map(ability => ({ ability, state: abilityStageState(ability, chapterNumber) }))
      .filter(entry => entry.state !== 'ahead'),
  )
  const lines: string[] = []
  let used = 0
  for (const entry of entries.slice(0, ABILITY_MAX_ITEMS)) {
    const line = renderAbilityLine(entry, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const isEn = writingLanguage === 'en-US'
  const heading = isEn
    ? "[Abilities (this book's ability rules: what it can do, what it costs, how it can be broken)]"
    : '【能力（本书的能力规则：能做什么、要付什么、什么情况下会被破）】'
  return `${heading}\n${isEn ? EN_LEAD : ZH_LEAD}\n${lines.join('\n')}`
}

/** 面板「从金手指原文取名字」的两个候选。只作候选，作者可改。 */
export interface AbilityNameCandidates {
  /** 首行标题（去掉 Markdown 装饰与「金手指名称：」这类标签）。 */
  title: string
  /** 第一个引号短语（`「噬魂推演录」` / `“每日一次的现实编辑权”`）。 */
  quoted: string
}

/**
 * 从金手指原文里抽两个名字候选。
 *
 * 为什么必须有这个入口：三本取样书里只有 1 本有现成名字，另 1 本只有引号短语，还有 1 本
 * **通篇没有名字**。`name` 是唯一必填项，卡在这里作者就进不去登记页。
 *
 * 这里只做**机械抽取**（首行 / 引号），不猜「哪个是名字」—— 候选进输入框后由作者改。
 */
export function abilityNameCandidates(goldenFinger: string): AbilityNameCandidates {
  const lines = String(goldenFinger ?? '').split(/\r?\n/u).map(line => line.trim()).filter(Boolean)
  let title = (lines[0] ?? '')
    // Markdown 装饰：`#` / `**` / `>` / 列表符号
    .replace(/^[#>*\-\s]+/u, '')
    .replace(/[*\s]+$/u, '')
    // 「金手指名称：」「能力名字:」这类标签
    .replace(/^(?:金手指|能力)?(?:名称|名字)\s*[：:]\s*/u, '')
    .trim()
  if (title.startsWith('「') || title.startsWith('“')) title = title.slice(1)
  if (title.endsWith('」') || title.endsWith('”')) title = title.slice(0, -1)
  title = title.trim().slice(0, ABILITY_TEXT_MAX)

  const quoted = /[「『“"]([^」』”"\n]{1,40})[」』”"]/u.exec(String(goldenFinger ?? ''))?.[1]?.trim() ?? ''
  return { title, quoted: quoted.slice(0, ABILITY_TEXT_MAX) }
}
