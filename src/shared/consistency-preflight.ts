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

export function mergeConsistencyFindingsIntoReview(
  review: ReviewLike,
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
