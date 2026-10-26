import type { FinalizedContinuityFact, FinalizedContinuityFactCategory } from './finalized-continuity'
import { normalizeFactQuote } from './knowledge-state'
import type { WritingLanguage } from './writing-language'

/**
 * P20-3 章末知情候选：**模型只能在既有事实里挑，不能自己写事实**。
 *
 * ## 为什么这个模块的形状长这样
 *
 * 定稿后处理链（`chapter_notes` → `buildFinalizedContinuityFacts`）已经为每章产出一批
 * ≤12 条、**每条都带逐字引文**的连续性事实。这一格缺的从来不是「再抽一遍事实」，
 * 而是「本章谁新得知了其中哪条」—— 那是个需要读语义的判断，确定性代码做不到。
 *
 * 于是模型的权限被压到最小：**输入是系统给的编号清单，输出只有 `{factIndex, characterId}`**。
 * 引文、章号、`factKey` 全部由系统按 `factIndex` 反查已经落库的事实得到，模型碰不到。
 *
 * 这不是「靠 prompt 提醒模型别编」——它**没有任何位置写事实**。所以：
 * - 「模型复述当事实」在结构上不可能发生（这是 P20-3 定义里点名的头号风险）；
 * - 「引文定位」也不再是问题：引文不是模型给的，它天然满足
 *   `content.slice(start,end) === evidence.text`。
 *
 * ## 三条校验都是 fail-closed
 *
 * `factIndex` 越界、`characterId` 不在冻结名单里、同一 `(factKey, characterId)` 重复 —— 一律丢弃，
 * 且每条丢弃都进 `dropped`（界面要报「有几条没通过」，不许静默少给）。
 *
 * **不按名字反查 id**：同名不同人是真实存在的（`buildFinalizedContinuityFacts` 就为此整条丢弃过），
 * 按名字猜 id 等于把一条候选挂到另一个人头上（判据 DE 同族）。
 */

/** 单章候选条数上限：与 M16 的写前查阅预算同量级（6 条以内的知情关系一眼扫完）。 */
export const KNOWLEDGE_CANDIDATES_MAX_ITEMS = 6

/** 进提示词时每条引文的截断长度：模型靠陈述判断，引文只是辅助；再长就是贴原文。 */
export const KNOWLEDGE_CANDIDATE_QUOTE_MAX_CHARS = 60

/**
 * 一条候选：某人自某一章起知道了某条已定稿的事实。
 *
 * **没有 `factKey` 字段。** 候选与事实的联系是 `(factChapter, factEvidence)` ——
 * 那正是 `factKey = kf:sha256(章号 + 归一化引文)` 的定义域，等价，但不需要为每条候选
 * 算一次异步哈希（commit 在同步事务里，await 不进去）。少一个"要跟引文保持同步"的冗余字段，
 * 就少一条「键对了、引文已经被改过」的脱节路径。
 */
export interface KnowledgeCandidate {
  /** 事实所在的章号（可能早于 `learnedChapter`）。 */
  factChapter: number
  /** 逐字引文（模型的输出里没有这一项 —— 它只给 `factIndex`）。 */
  factEvidence: string
  /** 事实陈述，只用于面板显示，**永不入库、永不进提示词**。 */
  statement: string
  /** 知情者，必须来自定稿时冻结的角色名单。 */
  characterId: string
  /** 显示用快照名；按 id 从名单取，不采信模型给的名字。 */
  characterName: string
  /** 自第几章起知道；本步骤产的候选恒等于被定稿的那一章。 */
  learnedChapter: number
}

/** 候选对着**当前**连续性投影反查的结果。 */
export type KnowledgeCandidateRefState = 'valid' | 'stale' | 'orphaned'

export interface KnowledgeCandidateView extends KnowledgeCandidate {
  refState: KnowledgeCandidateRefState
  category: FinalizedContinuityFactCategory | 'unknown'
}

/** 模型原始提议：只有两个字段，其它什么都不许有。 */
export interface KnowledgeCandidateProposal {
  factIndex: number
  characterId: string
}

export type KnowledgeCandidateDropReason =
  /** `factIndex` 不是正整数，或超出清单范围。 */
  | 'fact-index-out-of-range'
  /** `characterId` 不在定稿时冻结的名单里。 */
  | 'character-not-in-roster'
  /** 同一事实 + 同一人重复出现。 */
  | 'duplicated'
  /** 缺字段或类型不对。 */
  | 'invalid-shape'
  /** 超出单章条数上限。 */
  | 'over-limit'

export interface KnowledgeCandidateDrop {
  /** 拿不到编号时（形状坏）记 null，界面照样要显示有这么一条被丢。 */
  factIndex: number | null
  characterId: string
  reason: KnowledgeCandidateDropReason
}

export interface KnowledgeCandidateResolution {
  candidates: KnowledgeCandidate[]
  dropped: KnowledgeCandidateDrop[]
}

/** 冻结名单里的一行（`FinalizedCharacterContext.characters` 的最小投影）。 */
export interface KnowledgeCandidateRosterEntry {
  characterId: string
  name: string
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** 引文截断：超长加「…」，绝不悄悄少字（少了字的引文就不再是引文）。 */
function clip(text: string, max: number): string {
  const trimmed = text.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}

/**
 * 把本章事实渲染成**编号清单**给模型看。编号从 1 开始（人读友好），
 * `resolveKnowledgeCandidates` 用的也是同一套编号 —— 两边必须一致，改动只在这里。
 */
export function formatKnowledgeCandidateFacts(
  facts: readonly FinalizedContinuityFact[],
  writingLanguage: WritingLanguage,
): string {
  if (facts.length === 0) return writingLanguage === 'en-US' ? '(none)' : '（无）'
  return facts.map((fact, index) => `${index + 1}. ${fact.statement.trim()}\n   ${
    writingLanguage === 'en-US' ? 'quote' : '原文'}：${clip(fact.evidence, KNOWLEDGE_CANDIDATE_QUOTE_MAX_CHARS)}`
  ).join('\n')
}

/**
 * 解析模型回答。**只做形状解析，不做业务校验**（那是 `resolveKnowledgeCandidates` 的事）。
 *
 * 容错方向是「宁可少认，不猜」：`knowledge` 不是数组 ⇒ 空；每项缺字段或类型不对 ⇒ 丢该项并记账。
 * 不认 `characterName`（按名字反查 id 会把候选挂到同名的人头上）。
 */
export function parseKnowledgeCandidateResponse(text: string): {
  proposals: KnowledgeCandidateProposal[]
  dropped: KnowledgeCandidateDrop[]
} {
  const proposals: KnowledgeCandidateProposal[] = []
  const dropped: KnowledgeCandidateDrop[] = []
  let parsed: unknown
  try { parsed = JSON.parse(text.trim()) } catch { return { proposals, dropped } }
  const list = (parsed as { knowledge?: unknown } | null)?.knowledge
  if (!Array.isArray(list)) return { proposals, dropped }
  for (const item of list) {
    const entry = item as { factIndex?: unknown; characterId?: unknown } | null
    const factIndex = entry?.factIndex
    const characterId = entry?.characterId
    const indexLabel = positiveInteger(factIndex) ? factIndex : null
    const idLabel = typeof characterId === 'string' ? characterId.trim() : ''
    if (!positiveInteger(factIndex) || !idLabel) {
      dropped.push({ factIndex: indexLabel, characterId: idLabel, reason: 'invalid-shape' })
      continue
    }
    proposals.push({ factIndex, characterId: idLabel })
  }
  return { proposals, dropped }
}

/**
 * 把提议落到具体事实与具体人上：**引文、章号全部在这里产生**。
 *
 * 纯同步函数（不含哈希）—— `commit` 在同步事务里调用它，`await` 进不去。
 */
export function resolveKnowledgeCandidates(input: {
  proposals: readonly KnowledgeCandidateProposal[]
  /** 本章的定稿事实，顺序即编号顺序（第 1 条 = `factIndex: 1`）。 */
  facts: readonly FinalizedContinuityFact[]
  /** 定稿时冻结的角色名单。 */
  roster: readonly KnowledgeCandidateRosterEntry[]
  /** 被定稿的章号 —— 候选的 `learnedChapter` 恒为它。 */
  chapterNumber: number
  /** 上一阶段（解析）已经丢掉的那些，合并后一起返回，界面只读一处。 */
  dropped?: readonly KnowledgeCandidateDrop[]
}): KnowledgeCandidateResolution {
  const { proposals, facts, roster, chapterNumber } = input
  const dropped: KnowledgeCandidateDrop[] = [...(input.dropped ?? [])]
  const candidates: KnowledgeCandidate[] = []
  const byId = new Map(roster.map(entry => [entry.characterId, entry]))
  const seen = new Set<string>()

  for (const proposal of proposals) {
    const fact = facts[proposal.factIndex - 1]
    if (!fact) {
      dropped.push({ factIndex: proposal.factIndex, characterId: proposal.characterId, reason: 'fact-index-out-of-range' })
      continue
    }
    const person = byId.get(proposal.characterId)
    if (!person) {
      dropped.push({ factIndex: proposal.factIndex, characterId: proposal.characterId, reason: 'character-not-in-roster' })
      continue
    }
    const identity = knowledgeCandidateFactIdentity(fact.sourceChapter, fact.evidence)
    const dedupeKey = `${identity}\u001f${person.characterId}`
    if (seen.has(dedupeKey)) {
      dropped.push({ factIndex: proposal.factIndex, characterId: proposal.characterId, reason: 'duplicated' })
      continue
    }
    if (candidates.length >= KNOWLEDGE_CANDIDATES_MAX_ITEMS) {
      dropped.push({ factIndex: proposal.factIndex, characterId: proposal.characterId, reason: 'over-limit' })
      continue
    }
    seen.add(dedupeKey)
    candidates.push({
      factChapter: fact.sourceChapter,
      factEvidence: fact.evidence,
      statement: fact.statement,
      characterId: person.characterId,
      characterName: person.name,
      learnedChapter: chapterNumber,
    })
  }

  return { candidates, dropped }
}

/**
 * 事实身份：`(章号, 归一化逐字引文)`。**这正是 `factKey` 的定义域** ——
 * 用它反查比重算 sha256 快，且不需要 async。
 */
export function knowledgeCandidateFactIdentity(chapterNumber: number, evidence: string): string {
  return `${chapterNumber}\u001f${normalizeFactQuote(evidence)}`
}

/**
 * 读取侧：把候选对着**当前**投影反查，标出还能不能采纳。
 *
 * - `valid`：该事实仍在该章 current 投影里 —— 可采纳；
 * - `stale`：投影还在、但这条引文已经不在（章重定稿过）—— 不可采纳，**也不删除**
 *   （作者可能想看到它曾被提议过）；
 * - `orphaned`：那一章已经没有可用投影（章被删 / 投影失效）。
 *
 * 反查键是 `knowledgeCandidateFactIdentity` 而不是候选里的 `factKey`：
 * 两者定义域相同，但后者要算哈希；而且**引文才是事实本身**，用引文反查不会出现
 * 「键对了、引文已经被改过」这种脱节。
 */
export function markKnowledgeCandidates(
  candidates: readonly KnowledgeCandidate[],
  /** 当前可用的「事实身份」集合（调用方按章从投影里取）。 */
  availableFactIdentities: ReadonlySet<string>,
  /** 仍有 current 投影的章号集合。 */
  chaptersWithProjection: ReadonlySet<number>,
  /** 事实身份 → 分类，来自投影；缺省即 `unknown`。 */
  categories: ReadonlyMap<string, FinalizedContinuityFactCategory> = new Map(),
): KnowledgeCandidateView[] {
  return candidates.map(candidate => {
    const identity = knowledgeCandidateFactIdentity(candidate.factChapter, candidate.factEvidence)
    return {
      ...candidate,
      refState: availableFactIdentities.has(identity)
        ? 'valid'
        : chaptersWithProjection.has(candidate.factChapter) ? 'stale' : 'orphaned',
      category: categories.get(identity) ?? 'unknown',
    }
  })
}
