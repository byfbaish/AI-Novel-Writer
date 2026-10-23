/**
 * 信息流（谁知道什么）—— P1-1 连续性宿体第三格（2026-10-23）。
 *
 * ## 它回答什么问题
 *
 * 「这个角色在这一章，知道哪件事？」正文里最常见的崩法有两种：**未卜先知**（第 5 章的
 * 角色说出了第 9 章才揭晓的真相）与**集体失忆**（上一章亲眼看见的人，这一章又被蒙在鼓里）。
 * 此前这件事只活在作者记忆里 —— 写的时候没人提醒，回头读才发现。
 *
 * ## 主语是 `characterId`，表里不存名字
 *
 * M02 重建 `characters` 之后 `character_id` 才是主键，`name` 不再唯一。同一部书里
 * 同名不同人、改名、别名都真实存在，所以这里只记 id，显示名由仓储读时 JOIN。
 * 存一份名字就等于存了一份会过期的快照：改名之后登记页与提示词会各说各话。
 *
 * ## 两个「引文」语义不同，不能混
 *
 * - `factEvidence`：作者从**定稿正文**里选的**逐字引文** —— 这条事实的引用主体；
 * - `evidence`：**这条知情关系本身**的出处（哪一章写了「他这才知道」），可空，**不进提示词**
 *   （本节预算 640 字，关系出处会挤掉判定行），只在登记页可见。
 *
 * ## 引用键为什么不用 `continuityStableFactKey`
 *
 * `consistency-preflight.ts:73-91` 的 `continuityStableFactKey` 把模型复述的 `statement`
 * 也算进 key。而 statement 每章重抽都会换措辞 —— 同一件事换个说法，key 就变，作者登记的
 * 知情关系立刻全部指向空气。本模块的键只用两个**不随抽取漂移**的量：
 * 「事实所在章号 + 逐字引文」。`statement` 不参与：一旦允许它参与，就等于承认
 * 「同一引文两种表述 = 两条事实」，封闭默认立刻失效。
 *
 * 键是**引用**不是内容哈希：事实被重抽/改稿时 key 不重算，由 `refState` 判失效 ——
 * 绝不自动改键、不自动删行、不自动迁到「看起来像」的新事实（那等于替作者认定新的就是旧的）。
 *
 * ## 失效三态
 *
 * - `valid`：该章有 `current` 定稿连续性投影，且 key 在其中 ⇒ 参与注入；
 * - `stale`：有 current 投影，但 key 不在其中 ⇒ 该章索引在、这条事实已不在（重抽/改稿），跳过；
 * - `unverifiable`：没有 current 投影（缺失 / `stale` / `legacy`）⇒ 读不到，不能断定，跳过。
 *
 * 判定一律在主进程仓储里算好（渲染层与生成链都不要自己拼）—— 否则「哪一行才是本章当前的
 * 事实」会出现第二套判断。
 *
 * ## 只做正向知情，且封闭默认只在注入文本里成立
 *
 * 只记「谁知道」，不记「谁不知道」，也不做 C1 身份分面。`CHECK(learned_chapter >= fact_chapter)`
 * 挡住「先于事实存在就知道」。节首说明逐字写明：**登记过的事实，未列出的角色视为不知道；
 * 未登记的事实一概不判** —— 前一句是封闭默认，后一句是它的边界，缺了后一句就会被读成
 * 「这本书里谁都不知道别的任何事」。
 *
 * ## 期界
 *
 * `learnedChapter > 本章` 的行**一律不注入**（未来知识＝剧透）。纯函数不知道本章号，
 * 所以这件事由调用方（`generate-draft`）过滤，并有专门用例证明未来行没进上下文。
 */
import type { FinalizedContinuityFactCategory } from './finalized-continuity'
import type { WritingLanguage } from './writing-language'

/** 失效三态。判定在主进程仓储里完成，渲染层只读不判。 */
export type KnowledgeRefState = 'valid' | 'stale' | 'unverifiable'

/** 来源：本期只有作者登记；留 `derived` 是为了以后从定稿抽取时不改表。 */
export type KnowledgeSource = 'author' | 'derived'

/** 一条知情关系（= 谁 + 哪条事实 + 从哪一章起知道）。 */
export interface KnowledgeStateDefinition {
  knowledgeId: string
  /** 主语：角色 id。表里不存名字，显示名由仓储 JOIN `characters` 得到。 */
  characterId: string
  /** 显示名（读时 JOIN）：角色已被删除时为空串。 */
  characterName: string
  /** 这条事实写在哪一章的定稿正文里。 */
  factChapter: number
  /** 作者从定稿正文里选的**逐字引文**。 */
  factEvidence: string
  /** 逐字引文的完整 sha256（64 hex），供人工核对引文是否被改过。 */
  factEvidenceHash: string
  /** 引用键 `kf:<16 hex>`：`factChapter` + 归一化引文。改稿不重算。 */
  factKey: string
  /** 从哪一章起知道。必须 ≥ `factChapter`。 */
  learnedChapter: number
  /** 这条知情关系本身的出处（可空，**不进提示词**）。 */
  evidence: string
  source: KnowledgeSource
  /** 引用是否仍对得上当前定稿投影（仓储算好）。 */
  refState: KnowledgeRefState
  createdAt: string
  updatedAt: string
}

/**
 * 写入入参。
 *
 * **不接受 `factKey` / `factEvidenceHash`**：两者都由主进程从 `factChapter + factEvidence`
 * 重新算。让渲染层传 key 就等于让它决定「这条登记指向哪条事实」，改一个字就能把 A 事实
 * 的知情关系挂到 B 事实上。
 */
export interface KnowledgeStateInput {
  knowledgeId?: string
  characterId: string
  factChapter: number
  factEvidence: string
  learnedChapter: number
  evidence?: string
}

export interface KnowledgeWriteResult {
  success: boolean
  knowledgeId?: string
  error?: string
}

export interface KnowledgeDeleteResult {
  success: boolean
  error?: string
}

/**
 * 面板「选事实」用的候选：来自**已定稿且投影为 current** 的各章连续性索引。
 *
 * `statement` 只用于面板显示（帮作者认出是哪条），**永不入库、永不进提示词**。
 */
export interface KnowledgeFactCandidate {
  chapterNumber: number
  factKey: string
  factEvidence: string
  statement: string
  category: FinalizedContinuityFactCategory
}

/** 关系出处（`evidence`）的长度上限；与制度备注、物品备注的 200 同口径。 */
export const KNOWLEDGE_TEXT_MAX = 200
/** 条数上限（与写前查阅其它节同一量级：6 条以内一眼扫完）。 */
export const KNOWLEDGE_MAX_ITEMS = 6
/** 正文行总字数上限（不含节标题与说明句）。 */
export const KNOWLEDGE_MAX_CHARS = 640
/** 单条引文进提示词时的截断长度：再长就不是引文而是原文段落。 */
export const KNOWLEDGE_QUOTE_MAX_CHARS = 60
/** 引文本身的长度上限（写入时拦）：超过它多半是贴了整段原文。 */
export const KNOWLEDGE_EVIDENCE_MAX = 1_000

/**
 * 引文归一化：`trim` + 连续空白压成一个空格。
 *
 * **不做 Unicode 归一**（不 NFKC / 不转全角半角）：定位用的是原文切片，归一过的文本
 * 会与定稿正文对不上，作者按归一后的字串去正文里搜就搜不到。
 */
export function normalizeFactQuote(text: string): string {
  return text.trim().replace(/\s+/gu, ' ')
}

/** SHA-256 → 小写 hex。与 `source-ref.ts` 的 `hashAuthorText` 同一写法，共享层严禁 `node:crypto`。 */
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
}

/**
 * 引用键：`kf:` + `sha256(`${factChapter}\u001f${归一化引文}`)` 的前 16 hex。
 *
 * 用 `\u001f`（Unit Separator）分隔：它在正文里不会出现，所以「章号 1 + 引文 23…」与
 * 「章号 12 + 引文 3…」不会拼出同一个字串。
 */
export async function knowledgeFactKey(factChapter: number, factEvidence: string): Promise<string> {
  if (!Number.isSafeInteger(factChapter) || factChapter < 1) throw new Error('KNOWLEDGE_INVALID:factChapter')
  if (!normalizeFactQuote(factEvidence)) throw new Error('KNOWLEDGE_INVALID:factEvidence')
  return `kf:${(await sha256Hex(`${factChapter}\u001f${normalizeFactQuote(factEvidence)}`)).slice(0, 16)}`
}

/**
 * 引文的完整内容指纹（全 64 hex）。归一化后取哈希：只改空白不算改引文，
 * 与 `factKey` 同一口径 —— 否则「哈希变了但 key 没变」会让作者以为出错了。
 */
export async function knowledgeFactEvidenceHash(factEvidence: string): Promise<string> {
  if (!normalizeFactQuote(factEvidence)) throw new Error('KNOWLEDGE_INVALID:factEvidence')
  return sha256Hex(normalizeFactQuote(factEvidence))
}

/** 引文进提示词时的截断：超长加「…」，绝不悄悄少字（少了字的引文就不再是引文）。 */
function clipQuote(quote: string): string {
  const normalized = normalizeFactQuote(quote)
  return normalized.length <= KNOWLEDGE_QUOTE_MAX_CHARS
    ? normalized
    : `${normalized.slice(0, KNOWLEDGE_QUOTE_MAX_CHARS)}…`
}

/**
 * 一条知情关系在提示词里的**唯一**渲染入口（正文链与将来的审稿链共用，判据 DM 同型）。
 *
 * 行里只有三个数字来源：事实所在章、从哪一章知道、（截断后的）引文 —— 全部来自输入字段，
 * 没有任何推算（ADR-0022）。
 *
 * 单行写法**不因角色是否在本章出场而改变**：同一事实对同一角色只能有一种写法，否则
 * 登记页与提示词会长得不一样。「本章出场优先」只影响整节排序，由 `renderKnowledgeSection`
 * 用 `chapterCharacters` 完成 —— 所以这条单行入口不需要本章角色名单（计划里的第三参数
 * 因此没有落地：一个不改变输出的参数只会让人以为它在起作用）。
 */
export function renderKnowledgeLine(
  entry: KnowledgeStateDefinition,
  writingLanguage: WritingLanguage,
): string {
  const isEn = writingLanguage === 'en-US'
  const name = entry.characterName.trim() || (isEn ? 'unknown character' : '未命名角色')
  const quote = clipQuote(entry.factEvidence)
  return isEn
    ? `- ${name}: knows (fact: Chapter ${entry.factChapter} "${quote}"; learned in Chapter ${entry.learnedChapter})`
    : `- ${name}：知道（事实出处：第${entry.factChapter}章「${quote}」；自第${entry.learnedChapter}章得知）`
}

/** 节首说明（中文逐字；测试钉「未登记的事实一概不判」）。 */
const ZH_LEAD = '以下只列已登记的事实：登记过的事实，未列出的角色视为不知道；未登记的事实一概不判。'
const EN_LEAD = 'Only registered facts are listed: for any registered fact, characters not listed here are treated as not knowing it; facts that were never registered are not judged at all.'

/**
 * 排序：**本章出场角色优先** → `learnedChapter` 降序 → 角色名。
 *
 * 出场角色优先是因为「这一章要写他，他此时知道什么」才是作者当场要核对的事；同等条件下
 * 更晚知道的排前面（越新越可能与本章冲突）。角色名用码元序比较，不用 `localeCompare`
 * （它的结果随宿主 locale 变，测试会飘）。
 */
function orderKnowledgeStates(
  entries: readonly KnowledgeStateDefinition[],
  chapterCharacters: readonly string[],
): KnowledgeStateDefinition[] {
  const onStage = new Set(chapterCharacters.map(name => name.trim()).filter(Boolean))
  const rank = (entry: KnowledgeStateDefinition) => (onStage.has(entry.characterName.trim()) ? 0 : 1)
  return [...entries].sort((left, right) => rank(left) - rank(right)
    || right.learnedChapter - left.learnedChapter
    || (left.characterName < right.characterName ? -1 : left.characterName > right.characterName ? 1 : 0)
    || left.factChapter - right.factChapter)
}

/**
 * 渲染【知情】整节；没有可注入的条目就返回空串（**不要**产出只有标题的空节）。
 *
 * 只注入 `refState === 'valid'`：`stale` / `unverifiable` 跳过并在登记页提示重选 ——
 * 它们指的是「这条登记已对不上定稿」，不是「这个角色不知道」。
 *
 * @param maxChars 正文行总字数上限；预算外**整条丢弃**，不截半行（半行会读成另一条事实）。
 */
export function renderKnowledgeSection(
  entries: readonly KnowledgeStateDefinition[],
  writingLanguage: WritingLanguage,
  chapterCharacters: readonly string[] = [],
  maxChars: number = KNOWLEDGE_MAX_CHARS,
): string {
  const lines: string[] = []
  let used = 0
  const usable = orderKnowledgeStates(
    entries.filter(entry => entry.refState === 'valid' && entry.factEvidence.trim() && entry.characterName.trim()),
    chapterCharacters,
  )
  for (const entry of usable.slice(0, KNOWLEDGE_MAX_ITEMS)) {
    const line = renderKnowledgeLine(entry, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const isEn = writingLanguage === 'en-US'
  const heading = isEn ? '[Knowledge state (who knows what)]' : '【知情（谁知道什么）】'
  return `${heading}\n${isEn ? EN_LEAD : ZH_LEAD}\n${lines.join('\n')}`
}
