import type { FinalizedContinuityProjection } from './finalized-continuity'
import type { BlueprintKeyEvent } from './blueprint-key-events'
import { findSpaceTimeConflicts, type ConsistencySourceLayer, type SpaceTimeFinding } from './space-time-consistency'

export interface ConsistencyExemption {
  stableFactKey: string
  reason: string
  revoked: boolean
}

export interface ConsistencyFinding {
  stableFactKey: string
  severity: 'warning'
  sourceChapter: number
  evidence: string
  issue: { zhCN: string; enUS: string }
  suggestion: { zhCN: string; enUS: string }
  /**
   * 冲突**源层级**：这一条该去哪一层改。
   *
   * 存在的理由：同一条 finding 可能源于世界观设定、也可能是本章蓝图的写法。不写清楚，
   * 作者会一直在当前章里改，而改动根本不可能生效（实施清单 T11：finding 必须带「冲突源层级」）。
   * 老的连续性规则在设定侧与蓝图侧都可能触发，因此该字段对它们是可选的。
   */
  sourceLayer?: ConsistencySourceLayer
}

export interface ReviewLike {
  summary?: string
  items?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface BlueprintForPreflight {
  chapterNumber: number
  title: string
  role: string
  purpose: string
  keyEvents: BlueprintKeyEvent[]
  /**
   * B′ 的蓝图侧结构化空间引用（`spaceRefs` / 存储列 `structured_refs`）。
   * 可选：调用方拿不到时留空，校验器按 fail-open 不判（判据 ⑫）。
   */
  structuredRefs?: unknown
  characters: string[]
  suspenseHook: string
  userGuidance: string
  notes: string
}

function normalizedKeyPart(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function isExplicitTerminalSubject(statement: string, entity: string): boolean {
  const subject = escapeRegExp(entity)
  const divider = String.raw`[\s|:：,，、—-]*`
  const chinese = new RegExp(
    `${subject}${divider}(?:(?:已经|已|被确认(?:为)?|被证实(?:为)?)${divider})?(?:死亡|身亡|牺牲|去世)`,
    'u',
  )
  const english = new RegExp(
    String.raw`${subject}[\s|:,-]+(?:(?:is|was|has(?: been)?)\s+)?(?:dead|died|deceased)\b`,
    'iu',
  )
  return chinese.test(statement) || english.test(statement)
}

export function continuityStableFactKey(fact: {
  category: string
  sourceChapter: number
  entities: string[]
  statement: string
}): string {
  const identity = [
    fact.category,
    fact.sourceChapter,
    fact.entities.map(normalizedKeyPart).sort().join(','),
    normalizedKeyPart(fact.statement),
  ].join(':')
  let hash = 0xcbf29ce484222325n
  for (const character of identity) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return `fact:${hash.toString(16).padStart(16, '0')}`
}

/**
 * Low-cost, deterministic preflight. The first rule is intentionally narrow:
 * a structured terminal character state conflicts with scheduling that same
 * character to appear in the current blueprint.
 * Findings are evidence, never a writing prohibition.
 */
export function findBlueprintContinuityRisks(
  projections: readonly FinalizedContinuityProjection[],
  blueprint: BlueprintForPreflight,
  exemptions: readonly ConsistencyExemption[],
): ConsistencyFinding[] {
  const activeExemptions = new Set(
    exemptions.filter(exemption => !exemption.revoked).map(exemption => exemption.stableFactKey),
  )
  const characters = new Set(blueprint.characters.map(normalizedKeyPart))

  return projections.flatMap(projection => (
    projection.sourceStatus === 'current' ? (projection.facts ?? []) : []
  ).flatMap((fact) => {
    if (fact.category !== 'character-state') return []
    const stableFactKey = continuityStableFactKey(fact)
    if (activeExemptions.has(stableFactKey)) return []
    const subject = fact.entities
      .map(normalizedKeyPart)
      .find(entity => characters.has(entity) && isExplicitTerminalSubject(fact.statement, entity))
    if (!subject) return []
    return [{
      stableFactKey,
      severity: 'warning' as const,
      sourceChapter: fact.sourceChapter,
      evidence: fact.evidence,
      issue: {
        zhCN: `定稿正文绑定的派生索引提示“${subject}”处于死亡终态，但当前蓝图仍将其列为出场角色。请对照原文确认语义。`,
        enUS: `A derived index bound to finalized prose marks “${subject}” as dead, but the current blueprint still schedules the character to appear. Confirm the meaning against the prose.`,
      },
      suggestion: {
        zhCN: '调整蓝图，或说明这是回忆、幻象等刻意安排。',
        enUS: 'Adjust the blueprint, or record an intentional device such as a flashback or vision.',
      },
    }]
  }))
}

/**
 * 新增的 B′ 规则（实施清单 T10/T11）：**设定层的空间登记 vs 蓝图侧的空间引用**。
 *
 * 与上面那条规则同源（都是「设定声明 vs 蓝图使用」），差别只在主体是空间/钟点而不是角色死亡终态。
 * 计算全部在 `space-time-consistency.ts`（纯结构比较、零语义解析、缺字段 fail-open）；
 * 这里只做两件事：**接豁免**与**译成 `ConsistencyFinding`**。
 *
 * `worldBuildingText` 取的是**架构产出的 `project_core.worldbuilding`**（AI 写的那份，
 * 机读行由 T8 的模板要求它输出），不是作者手写的 `worldSetting` —— 后者没有机读行。
 */
export function findBlueprintSpaceTimeRisks(
  worldBuildingText: string | null | undefined,
  blueprint: Pick<BlueprintForPreflight, 'chapterNumber' | 'structuredRefs'>,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[] {
  const activeExemptions = new Set(
    exemptions.filter(exemption => !exemption.revoked).map(exemption => exemption.stableFactKey),
  )
  return findSpaceTimeConflicts({
    chapterNumber: blueprint.chapterNumber,
    worldBuildingText,
    spaceRefs: blueprint.structuredRefs,
  })
    .filter(finding => !activeExemptions.has(finding.stableFactKey))
    // `info` 级不进审稿 items：它不是冲突，只是「没有可判定形式」的说明，落进报告只会变噪声。
    .filter((finding): finding is SpaceTimeFinding & { severity: 'warning' } => finding.severity === 'warning')
    .map(finding => ({
      stableFactKey: finding.stableFactKey,
      severity: finding.severity,
      sourceChapter: finding.sourceChapter,
      evidence: finding.evidence,
      issue: finding.issue,
      suggestion: finding.suggestion,
      sourceLayer: finding.sourceLayer,
    }))
}

/**
 * 本章「在打某一格」却没有声明攻击目标（P11-1 的报告侧）。
 *
 * ## 为什么需要它
 *
 * 实机缺陷（2026-10-18）：第 3 章 `purpose` 是「废掉黑市那版作息表上『晚九点桥格』的定价价值」，
 * 而那一格在第 2 章 20:45–21:00 已经被主角本人兑付。蓝图没有任何字段记录「我在打哪一格」，
 * 于是 `timeRef` 被当成动作时间写成 `09:00-10:00`，正文只能照着在早上七点站桥头 ——
 * 一个与被攻击目标毫无关系的动作。
 *
 * ## 边界
 *
 * 只用**封闭词表**判断「意图是否指向某一格」，不做语义理解；词表命中且全章无 `attacks`
 * 才提示。这是「提示」而非禁止：比喻用法（「把这条线废掉」）也会命中，作者可以忽略。
 */
const SLOT_ATTACK_INTENT = /废掉|作废|废了|搅乱|搅掉|搅黄|证伪|打乱|破坏|抹掉|拆掉|顶掉|invalidate|disprove|scramble|void\b|wipe|undermine/iu

export function findBlueprintSlotAttackRisks(blueprint: BlueprintForPreflight): ConsistencyFinding[] {
  const events = blueprint.keyEvents ?? []
  const declared = events.filter(event => event.attacks)
  if (declared.length > 0) return []
  const haystacks = [blueprint.purpose, ...events.map(event => event.event)].filter(Boolean)
  const hit = haystacks.find(text => SLOT_ATTACK_INTENT.test(text))
  if (!hit) return []
  return [{
    stableFactKey: `slot-attack-missing:${blueprint.chapterNumber}`,
    severity: 'warning' as const,
    sourceChapter: blueprint.chapterNumber,
    evidence: hit,
    issue: {
      zhCN: `本章意图指向某一格（「${hit.slice(0, 40)}」），但没有任何一条 keyEvents 声明 attacks。`
        + '没有攻击目标，复核时无法判断这一格是否还存在 —— 它可能已在前面章节被兑付掉，此时这个动作机制上不成立。',
      enUS: `This chapter aims at a specific slot ("${hit.slice(0, 40)}"), but no keyEvents item declares attacks. `
        + 'Without a target, nothing can check whether that slot still exists — it may already have been paid off '
        + 'in an earlier chapter, in which case the action has no mechanism.',
    },
    suggestion: {
      zhCN: '若本章确实要作废/证伪某一格，在对应 keyEvents 项加 attacks：{"kind":"slot","space":"…","hour":"HH:MM"}'
        + '（hour 填**被攻击那一格**的钟点，不是动手的钟点）。若只是比喻用法，可忽略本条。',
      enUS: 'If the chapter really invalidates or disproves a slot, add attacks to the relevant keyEvents item: '
        + '{"kind":"slot","space":"…","hour":"HH:MM"} (hour is the clock time of the slot being attacked, not when '
        + 'the action happens). Ignore this if the wording is only figurative.',
    },
  }]
}

export function mergeConsistencyFindingsIntoReview(  review: ReviewLike,
  findings: readonly ConsistencyFinding[],
  locale: 'zh-CN' | 'en-US',
): ReviewLike & { items: Array<Record<string, unknown>> } {
  const mapped = findings.map(finding => ({
    category: locale === 'en-US' ? 'Deterministic continuity preflight' : '确定性一致性预检',
    severity: finding.severity,
    description: locale === 'en-US' ? finding.issue.enUS : finding.issue.zhCN,
    quote: finding.evidence,
    stableFactKey: finding.stableFactKey,
    sourceChapter: finding.sourceChapter,
  }))
  return { ...review, items: [...(Array.isArray(review.items) ? review.items : []), ...mapped] }
}

/**
 * 本次预检**实际参与判定**的范围。
 *
 * 存在的理由（实机缺陷 2026-10-15）：B′ 的空间—钟点规则是 fail-open 的 ——
 * 设定层没有机读行时，`findSpaceTimeConflicts` 在 `parseSpaceRules(...).length === 0`
 * 处**直接返回 `[]`**，连一条 `info` 都产生不了。于是「本次根本没判」与
 * 「判过了、没冲突」在界面上**完全同形**（都是安静地继续写），作者会以为机制失灵。
 * 把「有没有可判定形式」显式带出来，静默才不再等于通过。
 */
export interface ConsistencyPreflightCoverage {
  /** 设定层（架构产出的 `worldbuilding`）里已登记的**可判定空间**条数。`null` = 设定层读取失败。 */
  registeredSpaces: number | null
  /** 本次涉及的蓝图里带结构化空间引用（`spaceRefs`）的总条数。 */
  blueprintSpaceRefs: number
}

/**
 * 把覆盖度译成一条给作者看的说明（不判冲突时也要让他知道**为什么没判**）。
 *
 * 这是缺陷 2「维持纯结构、补引导」的落点：不动 Q4 的「零语义解析」边界（不去解析
 * 「下午两点」这类散文），只把「两侧缺机读形式 ⇒ 不判」这个前提与补救方式说清楚。
 */
export function describeSpaceTimeCoverage(
  coverage: ConsistencyPreflightCoverage | undefined,
): { zhCN: string; enUS: string } | undefined {
  if (!coverage) return undefined
  if (coverage.registeredSpaces === null) {
    return {
      zhCN: '空间—钟点一致性核对本次未参与判定：读取设定层失败。',
      enUS: 'The space/time consistency check did not run: the world setting could not be read.',
    }
  }
  if (coverage.registeredSpaces === 0) {
    return {
      zhCN: '空间—钟点一致性核对本次未参与判定：世界观里还没有可判定的机读行。要启用该核对，请重新生成世界观，'
        + '或在世界观第 4 维【空间结构】手工补登记形如「老陈记｜hours=07:00-10:00｜entry=…」的行。'
        + '（手工编辑的蓝图不产生结构化空间引用，同样不参与判定。）',
      enUS: 'The space/time consistency check did not run: the world setting has no machine-readable lines yet. '
        + 'To enable it, regenerate the world setting, or add a line such as "老陈记｜hours=07:00-10:00｜entry=…" '
        + 'by hand under dimension 4 (spatial structure). (A hand-edited blueprint produces no structured space '
        + 'references and likewise does not take part.)',
    }
  }
  if (coverage.blueprintSpaceRefs === 0) {
    return {
      zhCN: `空间—钟点一致性核对本次未参与判定：设定层已登记 ${coverage.registeredSpaces} 个空间，但本章蓝图没有结构化空间引用`
        + '（手工编辑的蓝图不产生该字段）。',
      enUS: `The space/time consistency check did not run: the world setting registers ${coverage.registeredSpaces} `
        + 'space(s), but this blueprint has no structured space references (a hand-edited blueprint produces none).',
    }
  }
  return {
    zhCN: `空间—钟点一致性核对已完成（已登记 ${coverage.registeredSpaces} 个空间 × ${coverage.blueprintSpaceRefs} 条蓝图引用），未发现冲突。`,
    enUS: `Space/time consistency check completed (${coverage.registeredSpaces} registered space(s) × `
      + `${coverage.blueprintSpaceRefs} blueprint reference(s)); no conflicts found.`,
  }
}
