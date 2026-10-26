/**
 * 审稿侧的「连续性核对基准」判定块（P2-1 期 1，2026-10-24；期 2 加第五类，2026-10-25）。
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
 * 2. **空即零字节**：五类都没有数据时返回 `undefined`，调用方据此不往 prompt 里加任何字符
 *    （老项目没有登记时，审稿 prompt 必须逐字节不变）。
 * 3. **不给结论**：本模块只渲染事实与判定规则，判定由模型做、处置由作者做。
 *    findings 是证据，不是写作禁令（`architecture-consistency-design.md`）。
 *
 * ## 为什么规则要跟着数据一起出现
 *
 * 空类的规则本身就是噪声：没有对照对象时，「不判次数」之类的说明只会稀释正文。
 * 所以某类没数据时，它的规则一并不出现（不是只藏数据、留规则）。
 *
 * ## 第五类为什么是「指针型」（期 2，人物状态转移）
 *
 * 前四类的数据要靠 IPC 现读；人物状态那批字节**早就在审稿 prompt 开头**了
 * （模板的 `{{character_states}}`，由 `formatCharacterStateLines` 渲染）。所以第五类
 * **只加「指针 + 规则」两段**，指回开头那一节，不复制任何 `@chapter` 状态行 ——
 * 复制就是四节的判据 DM 反着做：同一批事实出现两种措辞，写时看 A 版、审时按 B 版判。
 *
 * 由此多一条本模块独有的判据：**「有状态」不等于 `renderedCharacterStates` 非空**。
 * 生产侧兜底会填 `（暂无）`，测试夹具则可能只给一行角色名。必须数「可解析的事实行数」，
 * 否则给所有有角色的项目都注入一段指不到任何东西的规则。
 */
import { CHARACTER_STATE_TEXT_FIELDS } from './character-roster'
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
import {
  activeExemptionKeys,
  renderSecretReviewSection,
  secretExemptionScope,
  secretGuardsChapter,
  SECRET_MAX_CHARS,
  type SecretDefinition,
} from './secret'
import type { ConsistencyExemption } from './consistency-preflight'
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

/**
 * 人物状态转移的独立 `category`（期 2）。
 *
 * 为什么不混用上面那一个：那批 canon 的多数值是**定稿派生的快照**
 * （`cs_provenance.kind === 'derived'`），叫「作者登记」会让模型以为是作者手填的权威值，
 * 于是把「本章与派生快照不同」当成「与作者意图冲突」——那会把正常演进报成错误。
 * 英文用 `transitions` 而非单说 `state`：单说 state 会与模板【检查维度】第 3 条的
 * 静态一致性混淆，而这一条判的是**过程缺失**。
 */
export const REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY: Record<WritingLanguage, string> = {
  'zh-CN': '连续性核对（角色状态）',
  'en-US': 'Continuity check (character state transitions)',
}

/**
 * 按类取名的间接层。
 *
 * 四类指向**同一个对象**（不是四份内容相同的字面量），因此无论谁引用都不会产出不同字节；
 * UI 也仍然只有两个分组键（`ReviewReport.tsx` 按 category 原字符串分组）。
 */
export const REVIEW_CONTINUITY_CATEGORIES = {
  items: REVIEW_CONTINUITY_CATEGORY,
  cadences: REVIEW_CONTINUITY_CATEGORY,
  knowledge: REVIEW_CONTINUITY_CATEGORY,
  abilities: REVIEW_CONTINUITY_CATEGORY,
  characters: REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY,
} as const

/** 同一类的条数上限。写进提示词，**不在代码里裁模型输出**（裁了就等于悄悄改判据）。 */
export const REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS = 2
/**
 * 五类合计上限（四类登记 + 人物状态转移，2026-10-25 起 6→8）。
 * 审稿 items 本身只有 1–10 条，这一段不能把其它维度挤没。
 */
export const REVIEW_CONTINUITY_MAX_FINDINGS = 8

/** 本章位置上的五类核对基准；缺省 = 该类没有数据。 */
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
  /**
   * P20-2 秘密宿体。**只有审稿链读它** —— `detail` 是真相本体，进正文提示词等于把谜底交给写手。
   *
   * 期界过滤不在调用方做：`renderSecretReviewSection` 自己按 `chapterNumber` 排除
   * 「已经揭穿」的秘密（`secretChapterState`），因为那个判断与章号是同一个量，分两处判会飘。
   */
  secrets?: readonly SecretDefinition[]
  /**
   * 秘密豁免（落在 `consistency_exemptions`）。
   *
   * 两种键：`secret-exempt:<secretId>`（永久，真相人尽皆知）与
   * `secret-exempt:<secretId>#ch<N>`（临时，只免第 N 章）。语义与键格式在 `secret.ts`。
   *
   * 这里收**原始行**而不是已过滤的键集合：`revoked` 由 `activeExemptionKeys` 统一过滤，
   * 免得调用方各写一份「怎么算生效」。
   */
  secretExemptions?: readonly ConsistencyExemption[]
  /**
   * **已渲染好**的角色状态行（`frozen.characterStates`，即模板 `{{character_states}}`
   * 的同一份字节）。只用来数出「有几条可核对的基准行」并决定是否 push 指针，
   * **不解析内容、不重排、不改写、不复制**。
   *
   * 名字带 `rendered` 是刻意的：类型层就说清这是字符串而不是结构化卡片，
   * 免得下一个人以为可以在这里重排或过滤。
   */
  renderedCharacterStates?: string
}

export interface ReviewContinuityBibleBlock {
  /** 要拼进审稿 prompt 的整段文本。 */
  text: string
  /**
   * 实际进入提示词的条数（按通过裁剪的行数回报，日志说几条就真是几条）。
   *
   * ⚠️ `characters` 的口径与其它四项**不同**：本节本身不产出数据行（第五节是指针型），
   * 它数的是「指针覆盖了几条可核对的基准状态行」。写日志时说的是「覆盖」，不是「产出」。
   */
  counts: {
    items: number; cadences: number; knowledge: number; abilities: number
    secrets: number
    /** 被作者豁免、因此**没进提示词**的秘密条数（`secrets: 0` 的第二种含义）。 */
    secretsExempted: number
    characters: number
  }
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

function headerText(chapterNumber: number, isEn: boolean, hasCharacterStates: boolean): string {
  // 标题与 category 句是**唯一**随「有没有第五类」变化的两处：第五类的基准不是「作者登记」，
  // 继续写单一 category 会让模型把角色状态当成登记值。其余各行逐字不变。
  const title = isEn
    ? (hasCharacterStates
      ? `[Continuity check basis (author registry + character state; this chapter is Chapter ${chapterNumber})]`
      : `[Continuity check basis (author registry; this chapter is Chapter ${chapterNumber})]`)
    : (hasCharacterStates
      ? `【连续性核对基准（作者登记 + 角色状态；本章为第 ${chapterNumber} 章）】`
      : `【连续性核对基准（作者登记；本章为第 ${chapterNumber} 章）】`)
  const categoryLine = isEn
    ? (hasCharacterStates
      ? `category must be exactly "${REVIEW_CONTINUITY_CATEGORY['en-US']}" for items, cadences, knowledge and abilities, `
        + `and "${REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY['en-US']}" for character state transitions; at most `
        + `${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} per class and ${REVIEW_CONTINUITY_MAX_FINDINGS} in total. `
        + 'Never add a pass item just to cover a class.'
      : `category must be exactly "${REVIEW_CONTINUITY_CATEGORY['en-US']}"; at most `
        + `${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} per class and ${REVIEW_CONTINUITY_MAX_FINDINGS} in total. `
        + 'Never add a pass item just to cover a class.')
    : (hasCharacterStates
      ? `category 必须逐字写：物品 / 制度 / 知情 / 能力四类写「${REVIEW_CONTINUITY_CATEGORY['zh-CN']}」，`
        + `人物状态转移写「${REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY['zh-CN']}」；同一类最多 `
        + `${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} 条，合计不超过 ${REVIEW_CONTINUITY_MAX_FINDINGS} 条；`
        + '不得为覆盖类别而凑 pass。'
      : `category 必须逐字写「${REVIEW_CONTINUITY_CATEGORY['zh-CN']}」；同一类最多 `
        + `${REVIEW_CONTINUITY_MAX_FINDINGS_PER_CLASS} 条，合计不超过 ${REVIEW_CONTINUITY_MAX_FINDINGS} 条；`
        + '不得为覆盖类别而凑 pass。')
  return isEn
    ? [
      title,
      'The sections below are the author\'s registered basis for checking, not content this chapter must restate. '
      + 'Categories not present here, and facts never registered, are not judged at all.',
      'Registry text is not prose: every finding\'s quote must be one verbatim, contiguous excerpt that occurs exactly '
      + 'once in the draft under review. Sentences and quotes from this block must never be used as quote; '
      + 'registry-side facts belong in description, marked "registry: Chapter N" or "registry: author entry".',
      'Report only when two statements cannot both be true. Anything with a compatible explanation (memory, dream, '
      + 'vision, hearsay, rumour, metaphor, a character deliberately lying) is not reportable.',
      'Keep each description within 200 characters: state the conflict, its source and which side to change, and end '
      + 'with either "change this chapter: ..." or "check the registry: ...".',
      categoryLine,
    ].join('\n')
    : [
      title,
      '以下各节是作者登记的核对基准，不是本章必须复述的内容；没有出现的类别、没有登记的事实一概不判。',
      '登记原文不是正文：每条 finding 的 quote 必须是待审正文中逐字连续、全文只出现一次的单一摘录；'
      + '本节里的句子与引文不得填进 quote。登记侧的事实只写进 description，并标明「登记：第 N 章」或「登记：作者条目」。',
      '只有两处陈述不能同时为真才报；存在可兼容解释（回忆、梦境、幻象、转述、传闻、比喻、角色故意撒谎）一律不报。',
      'description 不超过 200 字，须写清「冲突点 + 来源 + 改法指向」，结尾二选一：改本章：… / 核对登记：…。',
      categoryLine,
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
 * 第五节「人物状态转移」的判定规则（期 2，指针型）。
 *
 * 与四类规则的差别：**本节不含数据**，基准在 prompt 开头的【角色状态】。
 * 文案里有四件事是刻意写死的，动它之前先想清楚：
 * - 「基准不在这里」：不写这句，模型会把本节标题当成数据节、把标题当事实；
 * - 「标注章号等于本章的行不判」：重审已定稿章时，`upToChapter === 本章` 会让状态行
 *   包含本章自己的快照（它就是从本章正文抽出来的），拿它判本章等于自证矛盾；
 * - 「陈旧时从严」：位置快照可能几十章没更新，仅凭「地点不同」在长篇后期必然大面积误报；
 * - 「不得判一炷香走三百里」：本项目**没有任何**移动耗时 / 距离 / 可达性数据，
 *   放这条口子出去，模型只能凭空造判据（与设计稿 §5「拒绝伪造判据」同一条边界）。
 */
/**
 * 第六节「秘密守卫」的判定规则（P20-2）。
 *
 * 三件事是刻意写死的，动它之前先想清楚：
 * - **只判「写出了真相」**：写出谜底才算泄密；遮掩、暗示、回避、"你别问了" 都是合规写法。
 *   放宽到「暗示太重」会让守卫节变成文风批评，作者会开始忽略它。
 * - **本章就是计划揭穿章时不算泄密**：`revealed-now` 的行自带一句提示，审稿员不能把
 *   「该揭穿」判成「提前揭穿」—— 这是最容易被误判的一类。
 * - **「尚不知情」为「未填」时不得反推**：与知情格那条「未登记的事实一概不判」同一条边界，
 *   否则作者没填的空格会被读成「所有人都不知道」。
 */
const SECRET_RULE = {
  'en-US': [
    '[Rules — secret guard] Report only when the reviewed chapter states the truth of a secret listed above '
    + '(the "truth" field), while that secret is not yet revealed in this chapter.',
    'Do not report: hints, evasions, someone refusing to answer, a character suspecting something, or a partial '
    + 'clue that does not state the truth; a chapter listed as "this is the planned reveal chapter".',
    'Never infer "nobody is unaware" from an "unaware: not filled in" line; that only means the author did not '
    + 'register it.',
    'severity: error = the truth itself appears in prose before its reveal chapter; warning = a single line states '
    + 'the conclusion rather than the evidence.',
    'Remedy: "change this chapter: cut the truth and keep only the hint"; if the reveal chapter itself is wrong, '
    + 'write "check the registry: reveal chapter".',
  ].join('\n'),
  'zh-CN': [
    '核对规则（秘密守卫）：正文在被审章里写出了上列某个秘密的「真相」栏内容，而该秘密在本章尚未揭穿 —— '
    + '只有这一条成立才算泄密。',
    '不判：暗示、回避、不肯说、角色起疑、只给出线索而没说出真相；标注「本章就是计划揭穿章」的不算泄密。',
    '「尚不知情」写「未填」时不得反推「所有人都知道」或「没有人不知道」—— 那只表示作者没登记。',
    'severity：error = 真相本体在揭穿章之前出现在正文；warning = 一句话直接给出结论而不是证据。',
    '改法：「改本章：删去真相，只保留暗示」；揭穿章本身定错时写「核对登记：揭穿章」。',
  ].join('\n'),
}

const CHARACTER_STATE_RULE = {
  'en-US': [
    '[Rules — character state transitions] The basis is the "[Known character states]" section near the top of this '
    + 'prompt, not this section; each basis line reads `field@chapterN: value`, and `·derived` marks a value '
    + 'extracted from a finalized chapter. '
    + 'Report only when all three hold: (a) a basis line with a chapter number lower than this chapter records this '
    + 'character\'s location, physical state, power level, mental state or carried items; '
    + '(b) the draft gives the same aspect a different value and the two cannot both be true; '
    + '(c) the draft shows no transition for that change — no departure, journey or arrival for a location; no '
    + 'injury, treatment, rest or passage of time for an injury or depletion; no source for a power gain; no '
    + 'acquisition or loss for an item.',
    'Do not report: no such basis line above; the chapter merely omits the character or the location (silence is not '
    + 'a change); a place change inside this chapter with no cross-chapter basis; memory, dream, vision, hearsay, '
    + 'rumour, metaphor or a deliberate lie; '
    + 'a basis line whose chapter number equals this chapter (when a finalized chapter is re-reviewed, that line may '
    + 'be this chapter\'s own snapshot — never use it against this chapter); '
    + 'wording that differs only in scope or phrasing ("wounded left shoulder" vs "has wounds") rather than in truth '
    + 'value; a transition that is shown but rough, slow or fast; a time skip stated in the draft ("the next day", '
    + '"three days later"), which counts as the process being shown.',
    'Staleness rule: when the basis line is many chapters older than this chapter and nothing in between updated it, '
    + 'judge strictly — report location only when the draft itself contradicts that place in the same scene (two '
    + 'places at once, or leaving a place the draft says the character never reached). A different place alone is '
    + 'not enough.',
    'This class judges only a missing transition, never whether a character\'s behaviour, motive or emotion is '
    + 'plausible — those remain review dimension 3. '
    + 'Division from dimension 3: dimension 3 judges "at the same point in time the draft directly conflicts with a '
    + 'value annotated as this chapter"; this class judges "a value from an earlier chapter is replaced in this '
    + 'chapter with no process shown". '
    + 'A conflict with an author value annotated as this chapter belongs to dimension 3, not here. Report each '
    + 'phenomenon once and never repeat it under dimension 3.',
    'Hard boundary: report only "the draft and the basis state cannot both be true". Never report that a character '
    + 'could not have travelled three hundred li in the time of one incense stick, or any inference needing travel '
    + 'time, distance or reachability data — this project stores none, so such a finding would be fabricated. Never '
    + 'infer impossibility from an unstated distance.',
    'severity: error = location or physical state silently rewritten and later prose keeps acting on the new state; '
    + 'warning = a single passing mention that changes no later event.',
    'Remedy: default "change this chapter: show the transition (departure / treatment / acquisition)"; if the '
    + 'chapter\'s process is complete and the registry value is stale, write "check the registry: update the state '
    + 'at Chapter N".',
  ].join('\n'),
  'zh-CN': [
    '核对规则（人物状态转移）：基准在本次 prompt 开头的【角色状态】节（不是本节），每行形如 `field@chapterN: value`，'
    + '`·派生` 表示该值由某一已定稿章抽取。'
    + '三者同时成立才报：① 上方存在章号小于本章的基准行，记着该角色的位置 / 身体 / 能力 / 心理 / 随身物品；'
    + '② 本章正文把同一项写成另一个值，两值不能同时为真；'
    + '③ 正文没有写出这次变化的转移过程 —— 位置变化没有动身 / 途中 / 抵达，伤势或消耗没有受伤 / 治疗 / 休息 / '
    + '时间流逝，能力提升没有来源，物品没有取得或失去。',
    '不判：上方没有该角色该项的基准行；本章只是没提到该角色、没提位置（沉默不等于状态改变）；'
    + '本章内部的地点变化没有跨章基准可对；回忆、梦境、幻象、转述、传闻、比喻、角色故意撒谎；'
    + '标注章号等于本章的行（重审已定稿章时，那一行可能是本章自身的快照，不得拿来判本章矛盾）；'
    + '只是范围或措辞不同（「左肩刀伤」与「身上有伤」）而非真值冲突；正文写明了转移过程但过程粗糙、耗时过长或过短；'
    + '正文以时间跳跃（翌日、三日后）交代了间隔，视为过程已写出。',
    '基准陈旧时从严：若基准行的章号明显早于本章、且中间没有任何章节更新过它，位置类只在正文自身与该地点直接矛盾时才报'
    + '（同一场景出现两个地点，或从未抵达却写「从某地出来」）；仅地点不同不报。',
    '本条只判「状态转移过程缺失」，不判角色行为是否合情理，不判性格、动机、情绪是否得体 —— 那些仍归【检查维度】第 3 条。'
    + '与第 3 条的分工：第 3 条判「同一时点上，本章正文与标注为本章的登记值直接冲突」；'
    + '本条判「跨章的旧值在本章被换掉却没有过程」。'
    + '与标注为本章的**作者**登记值冲突时归第 3 条，不归本条。同一现象只报一次，已按本条报出的不要再按第 3 条重复。',
    '硬边界：只能判「本章正文与基准状态不能同时为真」；不得判「一炷香走三百里不可能」这类需要移动耗时、距离或'
    + '可达性数据的推断 —— 本项目没有这类数据，判了就是伪造判据；两个地点之间没写距离，也不得据此推定不可能。',
    'severity：error = 位置或身体状态被无声改写且后文按新状态继续演；warning = 一次性提及、不影响后续事件。',
    '改法：默认「改本章：补出转移过程（动身 / 治疗 / 取得）」；若正文过程完整而登记值早已过期，'
    + '写「核对登记：更新第 N 章的状态」。',
  ].join('\n'),
}

/**
 * 第五节标题（**指针**，不含任何数据）。
 *
 * 点在两处：① 点名模板里的**逐字**标题 —— 中文与英文的模板标题不同
 * （`【角色状态】` / `[Known character states]`），只写一个必然有一边指空；
 * ② 给**结构**锚点（紧跟【待审章节】），因为本节与基准相隔整份 prompt，
 * 按「上一段」找必然找错。
 */
function characterStateSectionHeader(chapterNumber: number, isEn: boolean): string {
  return isEn
    ? `[Character state transitions (this chapter is Chapter ${chapterNumber}; the basis is NOT here — it is the `
      + '"[Known character states]" section near the top of this prompt, immediately after "[Chapter under review]")]'
    : `【人物状态转移（本章为第 ${chapterNumber} 章；基准不在这里，在本次 prompt 开头、紧跟【待审章节】之后的【角色状态】节）】`
}

/** 可核对的状态事实行：`  - field@chapterN[:·派生]: value`（两空格缩进，见 `character-state-lines.ts`）。 */
const CHARACTER_STATE_FACT_LINE = new RegExp(
  `^ {2}- (?:${CHARACTER_STATE_TEXT_FIELDS.join('|')})@chapter\\d+(?:·(?:派生|derived))?: \\S`,
  'u',
)

/**
 * 数「可核对的状态事实行」。
 *
 * **不是判空**：`renderedCharacterStates` 在生产侧可能是兜底的 `（暂无）`，
 * 在测试夹具里可能是只有姓名的角色行 —— 两者都非空却无一条可比对的基准。
 * 按非空判会把规则注入到所有有角色的项目，且立刻打破无数据路径的字节锚点。
 */
function countCharacterStateFacts(rendered: string | undefined): number {
  return rendered ? rendered.split('\n').filter(line => CHARACTER_STATE_FACT_LINE.test(line)).length : 0
}

/**
 * 组装整块；六类都没有可渲染内容时返回 `undefined`（调用方据此不产生任何字节）。
 *
 * 顺序与写稿节序一致：物品 → 制度 → 知情 → 能力 → 秘密守卫 → 人物状态转移。
 * **本函数不做任何判定**，只排版事实与规则（唯一例外是秘密的期界：它与章号是同一个量，
 * 分两处判会飘，所以留在 `renderSecretReviewSection` 里）。
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
  // P20-2：期界在渲染函数内部按章号判（`secretChapterState`），这里只压换行与去空。
  const secretKeys = activeExemptionKeys(canon.secretExemptions ?? [])
  const secretsSection = renderSecretReviewSection(
    (canon.secrets ?? []).map(collapseNewlines),
    chapterNumber,
    writingLanguage,
    SECRET_MAX_CHARS,
    secretKeys,
  )
  const characterStateFacts = countCharacterStateFacts(canon.renderedCharacterStates)

  const counts = {
    items: countLines(itemsSection),
    cadences: countLines(cadencesSection),
    knowledge: countLines(knowledgeSection),
    abilities: countLines(abilitiesSection),
    secrets: countLines(secretsSection),
    /**
     * 被作者豁免、因此**没进提示词**的秘密条数。
     *
     * 单独报的理由是判据 DN：`secrets: 0` 有两种完全不同的含义 ——
     * 「没有未揭穿的秘密」和「有，但都被豁免了」。只报 0 会让作者以为守卫在干活。
     */
    secretsExempted: (canon.secrets ?? []).filter(entry => entry.title.trim() && entry.detail.trim()
      && secretGuardsChapter(entry, chapterNumber)
      && secretExemptionScope(entry, chapterNumber, secretKeys) !== 'none').length,
    characters: characterStateFacts,
  }
  if (counts.items + counts.cadences + counts.knowledge + counts.abilities
    + counts.secrets + counts.characters === 0) {
    return undefined
  }

  const parts: string[] = [headerText(chapterNumber, isEn, characterStateFacts > 0)]
  if (itemsSection) parts.push(itemsSection, ITEM_RULE[writingLanguage])
  if (cadencesSection) parts.push(cadencesSection, CADENCE_RULE[writingLanguage])
  if (knowledgeSection) parts.push(knowledgeSection, KNOWLEDGE_RULE[writingLanguage])
  if (abilitiesSection) parts.push(abilitiesSection, ABILITY_RULE[writingLanguage])
  if (secretsSection) parts.push(secretsSection, SECRET_RULE[writingLanguage])
  // 第五类只 push「指针 + 规则」：数据已在 prompt 开头，这里再渲染一份就是判据 DM 反着做。
  if (characterStateFacts > 0) {
    parts.push(characterStateSectionHeader(chapterNumber, isEn), CHARACTER_STATE_RULE[writingLanguage])
  }
  const text = parts.join('\n\n')
  return { text, counts, chars: text.length }
}
