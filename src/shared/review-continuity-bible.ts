/**
 * 审稿侧的「连续性核对基准」判定块（P2-1 期 1，2026-10-24）。
 *
 * ## 它解决什么
 *
 * P1-1 把四类事实存下来了（物品 M14 / 制度 M15 / 知情 M16 / 能力 M17），但正文链把它们
 * 注入给**写稿**模型之后，**没有任何东西拿同一批事实回头核对写出来的正文**。
 * 于是「写前查阅」只是一次性提醒：模型照不照做，没人查。本模块补的就是这一环 ——
 * 把同一批登记事实作为**核对基准**送进审稿链，由审稿模型产出 findings。
 *
 * ## 三条不能破的边界
 *
 * 1. **同一份字节**：四节一律调 `renderPrewriteItemsSection` / `renderCadenceSection` /
 *    `renderKnowledgeSection` / `renderAbilitySection`，不重写一行。判据 DM：写的时候告诉了
 *    什么，审的时候就只能拿同一批判 —— 两边各写一份，就会造出「写的时候没给、审的时候罚」。
 * 2. **空即零字节**：四类都没有数据时返回 `undefined`，调用方据此不往 prompt 里加任何字符
 *    （老项目没有登记时，审稿 prompt 必须逐字节不变）。
 * 3. **不给结论**：本模块只渲染事实与判定规则，判定由模型做、处置由作者做。
 *    findings 是证据，不是写作禁令（`architecture-consistency-design.md`）。
 *
 * ## 为什么规则要跟着数据一起出现
 *
 * 空类的规则本身就是噪声：没有对照对象时，「不判次数」之类的说明只会稀释正文。
 * 所以某类没数据时，它的规则一并不出现（不是只藏数据、留规则）。
 */
import {
  evaluateCadence,
  renderCadenceSection,
  type CadenceEntry,
  type CadenceStatus,
  type InstitutionCadence,
} from './institution-cadence'
import { orderKeyItemsForChapter, type KeyItemDefinition } from './key-item'
import {
  knowledgeUsableAtChapter,
  renderKnowledgeSection,
  type KnowledgeStateDefinition,
} from './knowledge-state'
import { renderAbilitySection, type PowerAbilityDefinition } from './power-ability'
import { renderPrewriteItemsSection } from './prewrite-consultation'
import type { WritingLanguage } from './writing-language'

/**
 * 这类 finding 在审稿报告里的固定 `category`。
 *
 * 与「确定性一致性预检」（`consistency-preflight.ts` 的 `mergeConsistencyFindingsIntoReview`）
 * 并列且一眼可分：那一条代表「代码算出来的结构性冲突」，这一条代表「模型对照作者登记判出来的」。
 * 固定值同时充当 UI 的分组键（`ReviewReport.tsx` 按 category 原字符串分组），所以不能逐条变化。
 */
export const REVIEW_CONTINUITY_CATEGORY: Record<WritingLanguage, string> = {
  'zh-CN': '连续性核对（作者登记）',
  'en-US': 'Continuity check (author registry)',
}

/** 同一类的条数上限。写进提示词，**不在代码里裁模型输出**（裁了就等于悄悄改判据）。 */
export const REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS = 2
/** 四类合计上限。审稿 items 本身只有 1–10 条，这一段不能把其它维度挤没。 */
export const REVIEW_CONTINUITY_MAX_FINDINGS = 6

/** 本章位置上的四类登记事实；缺省 = 该类没有登记。 */
export interface ReviewContinuityCanon {
  /** 待审正文的章号；非正整数 ⇒ 整块不产出（期界、三态都依赖它）。 */
  chapterNumber: number
  writingLanguage: WritingLanguage
  /** 最近一个登记了日序的已定稿章的故事日；与正文链同口径。缺省 = 制度无法按日序判（降级或未知）。 */
  storyDayOffset?: number | null
  /** 本章蓝图点名的角色：只影响物品/知情的排序，不参与措辞。 */
  chapterCharacters?: readonly string[]
  items?: readonly KeyItemDefinition[]
  cadences?: readonly InstitutionCadence[]
  knowledge?: readonly KnowledgeStateDefinition[]
  abilities?: readonly PowerAbilityDefinition[]
}

export interface ReviewContinuityBibleBlock {
  /** 要拼进审稿 prompt 的整段文本。 */
  text: string
  /** 实际进入提示词的条数（按通过裁剪的行数回报，日志说几条就真是几条）。 */
  counts: { items: number; cadences: number; knowledge: number; abilities: number }
  /** `text.length`，供调用方打日志观测体积。 */
  chars: number
}

const CADENCE_RANK: Record<CadenceStatus, number> = { due: 0, overdue: 1, unknown: 2, not_due: 3 }

/**
 * 把对象里所有字符串字段的换行压成空格（**只在副本上改**）。
 *
 * 不做的后果：一条登记里的换行可以伪造出一行 `- ` 条目或一个 `【…】` 标题，
 * 等于让作者在自己不知情的情况下往系统提示词里插话。
 * 刻意**不做** HTML/XML 转义：这是纯文本提示词，`</` 与 `${}` 无害，转义反而污染原文。
 */
function collapseNewlines<T extends object>(value: T): T {
  const copy: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    copy[key] = typeof raw === 'string' ? raw.replace(/\r?\n/gu, ' ') : raw
  }
  return copy as T
}

function orderCadenceEntries(
  cadences: readonly InstitutionCadence[],
  chapterNumber: number,
  storyDayOffset: number | null,
): CadenceEntry[] {
  const position = { chapterNumber, storyDayOffset }
  return cadences
    .map(cadence => ({ cadence, evaluation: evaluateCadence(cadence, position) }))
    // 同状态按名字的码元序（不用 localeCompare：它的结果随宿主 locale 变，测试会飘）。
    .sort((left, right) => CADENCE_RANK[left.evaluation.status] - CADENCE_RANK[right.evaluation.status]
      || (left.cadence.name < right.cadence.name ? -1 : left.cadence.name > right.cadence.name ? 1 : 0))
}

/** 按通过裁剪的行数回报；与 `buildPrewriteConsultationBlock` 的计数口径一致。 */
function countLines(section: string): number {
  return section ? section.split('\n').filter(line => line.startsWith('- ')).length : 0
}

function headerText(chapterNumber: number, isEn: boolean): string {
  return isEn
    ? [
      `[Continuity check basis (author registry; this chapter is Chapter ${chapterNumber})]`,
      'The sections below are the author\'s registered basis for checking, not content this chapter must restate. '
      + 'Categories not present here, and facts never registered, are not judged at all.',
      'Registry text is not prose: every finding\'s quote must be one verbatim, contiguous excerpt that occurs exactly '
      + 'once in the draft under review. Sentences and quotes from this block must never be used as quote; '
      + 'registry-side facts belong in description, marked "registry: Chapter N" or "registry: author entry".',
      'Report only when two statements cannot both be true. Anything with a compatible explanation (memory, dream, '
      + 'vision, hearsay, rumour, metaphor, a character deliberately lying) is not reportable.',
      'Keep each description within 200 characters: state the conflict, its source and which side to change, and end '
      + 'with either "change this chapter: ..." or "check the registry: ...".',
      `category must be exactly "${REVIEW_CONTINUITY_CATEGORY['en-US']}"; at most `
      + `${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} per class and ${REVIEW_CONTINUITY_MAX_FINDINGS} in total. `
      + 'Never add a pass item just to cover a class.',
    ].join('\n')
    : [
      `【连续性核对基准（作者登记；本章为第 ${chapterNumber} 章）】`,
      '以下各节是作者登记的核对基准，不是本章必须复述的内容；没有出现的类别、没有登记的事实一概不判。',
      '登记原文不是正文：每条 finding 的 quote 必须是待审正文中逐字连续、全文只出现一次的单一摘录；'
      + '本节里的句子与引文不得填进 quote。登记侧的事实只写进 description，并标明「登记：第 N 章」或「登记：作者条目」。',
      '只有两处陈述不能同时为真才报；存在可兼容解释（回忆、梦境、幻象、转述、传闻、比喻、角色故意撒谎）一律不报。',
      'description 不超过 200 字，须写清「冲突点 + 来源 + 改法指向」，结尾二选一：改本章：… / 核对登记：…。',
      `category 必须逐字写「${REVIEW_CONTINUITY_CATEGORY['zh-CN']}」；同一类最多 `
      + `${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} 条，合计不超过 ${REVIEW_CONTINUITY_MAX_FINDINGS} 条；`
      + '不得为覆盖类别而凑 pass。',
    ].join('\n')
}

const ITEM_RULE = {
  'en-US': [
    '[Rules — key items] A registered holder with a chapter only describes that moment. Report only when this chapter '
    + 'puts the item in someone else\'s hands and the prose shows no transfer (handing over, being taken, picked up, '
    + 'bought, stolen, deposited, destroyed).',
    'Do not report: unregistered items; a transfer that is shown; merely seeing someone hold it; a memory or retelling '
    + 'of older events; a registration without a chapter (the time point is unknown).',
    'Never report "he cannot have this item" — a registration is a snapshot, not an interval.',
    'severity: error = a core prop changes hands and later prose keeps using the new holder; warning = a minor item '
    + 'mentioned once.',
    'Remedy: default "change this chapter: show the transfer"; if the chapter\'s transfer is complete and the registry '
    + 'is stale, write "check the registry: update the holder at Chapter N".',
  ].join('\n'),
  'zh-CN': [
    '核对规则（物品）：登记里标了章号的归属只代表那一刻。本章把物品换到别人手里、而正文没有写出转交过程'
    + '（交出、被夺、拾得、购得、偷取、寄存、损毁）才算成立。',
    '不判：未登记的物品；本章写明了转交；只是「看见某人拿着」；本章是回忆或旧事复述；登记没标章号（时点不明）。',
    '不得判「他不可能有这件东西」—— 登记是快照，不是区间。',
    'severity：error = 核心道具换手且后文按新持有者继续使用；warning = 次要物品一次提及。',
    '改法：默认「改本章：补出转交过程」；若本章转交完整而登记旧了，写「核对登记：更新第 N 章归属」。',
  ].join('\n'),
}

const CADENCE_RULE = {
  'en-US': [
    '[Rules — cadences] Report only when the status is "due" or "overdue" and this chapter\'s prose itself shows the '
    + 'cycle being pushed into this round or the previous one ("received it again", "last time was Chapter N", "that '
    + 'round is already past").',
    'Do not report: status "unknown" (no anchor means no judgement, never downgrade it to "not due"); "not due"; '
    + 'a chapter that never mentions it; any question of how much should be issued.',
    'Never derive intervals and never demand quantities.',
    'severity: error = two issuances in the same round (prose shows two collections or deliveries); warning = one '
    + 'missed round mentioned only in passing.',
    'Remedy: "change this chapter: remove the duplicate round / show this round happening"; if the anchor is clearly '
    + 'stale, write "check the registry: last occurrence".',
  ].join('\n'),
  'zh-CN': [
    '核对规则（制度）：只有状态为「到期」或「逾期」、且本章正文自身写出把周期推进到本轮或上一轮的句子'
    + '（又领了一次、上次是第 X 章、这一轮已经过去）才算成立。',
    '不判：状态「未知」（缺锚一律不判，不得折成「未到」）；「未到」；本章只字未提；问「应发多少」。',
    '不得推算间隔，也不得要求具体数量。',
    'severity：error = 同一轮连发两次（正文写出两处领取或送达）；warning = 逾期一轮但正文只轻描。',
    '改法：「改本章：删去重复的一轮 / 补出这一轮的过程」；锚明显过期时写「核对登记：上次发生」。',
  ].join('\n'),
}

const KNOWLEDGE_RULE = {
  'en-US': [
    '[Rules — knowledge] Report only when (a) a character states or acts on something registered as learned in '
    + 'Chapter L, while this chapter is earlier than L, or (b) the prose says "he only just learned it / heard it for '
    + 'the first time" while the registry has him knowing it much earlier.',
    'Do not report: unregistered facts; a chapter that simply does not mention what he knows; silence; retelling '
    + 'someone else\'s words; a chapter that is not earlier than L.',
    'Never report "why does he not know" — the registry only records positive knowledge and a lower bound.',
    'severity: error = key information revealed too early, or a key character forgets and acts on the forgetting; '
    + 'warning = a single line oversteps.',
    'Remedy: "change this chapter: make him not know it / show how he learned it"; if the registration itself is '
    + 'wrong, write "check the registry: learned_chapter".',
  ].join('\n'),
  'zh-CN': [
    '核对规则（知情）：角色在本章说出或使用了登记为「自第 L 章才知道」的事，而本章早于第 L 章；'
    + '或正文写「他这才知道 / 第一次听说」而登记为早已知道 —— 两者之一才算成立。',
    '不判：未登记的事实；本章只是没提到他知道；沉默不表态；转述他人说法；本章不早于第 L 章。',
    '不得判「他为什么不知道」—— 登记只有正向知情与下界。',
    'severity：error = 关键信息提前揭示，或关键人物失忆并据此行动；warning = 一句台词越界。',
    '改法：「改本章：改为不知道 / 补出获知过程」；登记时点本身错时写「核对登记：learned_chapter」。',
  ].join('\n'),
}

const ABILITY_RULE = {
  'en-US': [
    '[Rules — abilities] Report only when one of these holds: the ability is used before its registered "from Chapter '
    + 'N" stage; the use directly violates a registered limit (hard limit / weakness / cost); or the prose says no '
    + 'price is paid while a cost is registered.',
    'Do not report: uses that were never registered (never infer that means unlimited); a limit the registry does not '
    + 'state; mere differences of power level or style; counts and intervals.',
    'Counts, cooldowns and accumulation are never judged (ADR-0022).',
    'severity: error = violates a hard limit, or used before its stage and changes the outcome; warning = the cost is '
    + 'glossed over but the outcome still holds.',
    'Remedy: "change this chapter: rewrite the use / show the cost"; if the registry and the prose disagree for long, '
    + 'write "check the registry: ability limits".',
  ].join('\n'),
  'zh-CN': [
    '核对规则（能力）：本章早于「自第 N 章起」使用该能力；或用法直接违反登记的限制（硬限制 / 弱点 / 代价）；'
    + '或正文写出「无需付出 / 没有代价」而登记了代价 —— 三者之一才算成立。',
    '不判：未登记的用法（不得据此推定无限制）；登记没有写该限制；只是威力强弱或写得好看；次数与间隔。',
    '不判次数、冷却、累计（ADR-0022）。',
    'severity：error = 违反硬限制，或阶段未到即用并改变结果；warning = 代价一笔带过但结果仍然成立。',
    '改法：「改本章：改写用法 / 补出代价」；登记与正文长期不符时写「核对登记：能力限制」。',
  ].join('\n'),
}

/**
 * 组装整块；四类都没有可渲染内容时返回 `undefined`（调用方据此不产生任何字节）。
 *
 * 顺序与写稿节序一致：物品 → 制度 → 知情 → 能力。**本函数不做任何判定**，只排版事实与规则。
 */
export function buildReviewContinuityBibleBlock(
  canon: ReviewContinuityCanon,
): ReviewContinuityBibleBlock | undefined {
  const { chapterNumber, writingLanguage } = canon
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return undefined
  const isEn = writingLanguage === 'en-US'
  const chapterCharacters = canon.chapterCharacters ?? []
  const storyDayOffset = canon.storyDayOffset ?? null

  const itemsSection = renderPrewriteItemsSection(
    orderKeyItemsForChapter((canon.items ?? []).map(collapseNewlines), chapterCharacters),
    writingLanguage,
  )
  const cadencesSection = renderCadenceSection(
    orderCadenceEntries((canon.cadences ?? []).map(collapseNewlines), chapterNumber, storyDayOffset),
    writingLanguage,
  )
  const knowledgeSection = renderKnowledgeSection(
    (canon.knowledge ?? [])
      .map(collapseNewlines)
      .filter(entry => knowledgeUsableAtChapter(entry, chapterNumber)),
    writingLanguage,
    chapterCharacters,
  )
  const abilitiesSection = renderAbilitySection(
    (canon.abilities ?? []).map(collapseNewlines),
    writingLanguage,
    chapterNumber,
  )

  const counts = {
    items: countLines(itemsSection),
    cadences: countLines(cadencesSection),
    knowledge: countLines(knowledgeSection),
    abilities: countLines(abilitiesSection),
  }
  if (counts.items + counts.cadences + counts.knowledge + counts.abilities === 0) return undefined

  const parts: string[] = [headerText(chapterNumber, isEn)]
  if (itemsSection) parts.push(itemsSection, ITEM_RULE[writingLanguage])
  if (cadencesSection) parts.push(cadencesSection, CADENCE_RULE[writingLanguage])
  if (knowledgeSection) parts.push(knowledgeSection, KNOWLEDGE_RULE[writingLanguage])
  if (abilitiesSection) parts.push(abilitiesSection, ABILITY_RULE[writingLanguage])
  const text = parts.join('\n\n')
  return { text, counts, chars: text.length }
}
