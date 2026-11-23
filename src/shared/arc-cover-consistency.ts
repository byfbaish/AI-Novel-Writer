/**
 * AC3/S3：弧层引用闭合 —— 把既有的 `validateArcCovers` 接进预检通路。
 *
 * 计算全在 `arc-node.ts`（纯结构比较、零语义解析、缺字段 fail-open）；
 * 这里只做三件事：**取本章声明的结构位**、**接豁免**、**译成 `ConsistencyFinding`**。
 *
 * 输入取 `project_core` 的三项（`totalChapters` / `plot_structure_plan` / `synopsis`），
 * 与 `architecture.command.ts` 的 `summarizeArcCoverFindings` 同源，但**只看一章**。
 */
import { listArcNodes, parseChapterArcCovers, validateArcCovers, type ArcCoverViolation } from './arc-node'
import type { ConsistencyExemption, ConsistencyFinding } from './consistency-preflight'

export const ARC_COVER_KEY_PREFIX = 'arc:cover:'

/** 键**不含章号**：同一格的问题一次豁免全书生效（与 `roster:` / `named:` 两族同口径）。 */
export function arcCoverStableFactKey(code: string, id: string): string {
  return `${ARC_COVER_KEY_PREFIX}${code}:${id.trim()}`
}

export interface ArcCoverScope {
  chapterNumber: number
  /** `project_core.plot_structure_plan`；缺省按不可解析处理。 */
  plotStructurePlan?: string | null
  /** `project_core.synopsis`；`覆盖：` 行从这里来。 */
  synopsis?: string | null
  /** `project_core.total_chapters`；非法即不判。 */
  totalChapters?: number | null
}

interface MessagePair {
  issue: { zhCN: string; enUS: string }
  suggestion: { zhCN: string; enUS: string }
}

/**
 * 四种违规各自的说法。文案**不许收窄**：`UNKNOWN_NODE` 必须保留「可能拼写错误，或弧光已重排」，
 * 否则作者会以为是别处的毛病，而唯一解是改 ID 或重排。
 */
function messageFor(code: ArcCoverViolation['code'], id: string, chapterNumber: number): MessagePair {
  if (code === 'UNKNOWN_NODE') {
    return {
      issue: {
        zhCN: `第 ${chapterNumber} 章声明了未知结构位「${id}」——弧光结构里没有这一格（可能拼写错误，或弧光已重排）。`,
        enUS: `Chapter ${chapterNumber} claims an unknown story slot "${id}" — no such node exists in the arc structure (typo, or the arc was reordered).`,
      },
      suggestion: {
        zhCN: '核对弧光结构里的结构位 ID；若弧光已重排，把本章声明改成重排后仍存在的那一格。',
        enUS: 'Check the slot ID against the arc structure; if the arc was reordered, point this chapter at a slot that still exists.',
      },
    }
  }
  if (code === 'INV-1-OUT_OF_RANGE') {
    return {
      issue: {
        zhCN: `第 ${chapterNumber} 章声明了结构位「${id}」，但该格不覆盖本章 —— 提前消耗了后续弧光。`,
        enUS: `Chapter ${chapterNumber} claims slot "${id}", but that slot does not cover this chapter — later arc material is consumed early.`,
      },
      suggestion: {
        zhCN: '把声明改成覆盖本章的那一格，或调整弧光结构的章数划分。',
        enUS: 'Claim a slot that covers this chapter, or adjust the chapter split in the arc structure.',
      },
    }
  }
  if (code === 'COARSE_NODE') {
    return {
      issue: {
        zhCN: `第 ${chapterNumber} 章声明的「${id}」是大弧 / 中弧粒度，无法据此检测重复兑现。`,
        enUS: `Chapter ${chapterNumber} claims "${id}" at major/mid-arc granularity, which cannot detect duplicate pay-offs.`,
      },
      suggestion: {
        zhCN: `细化到具体结构位（如「${id}/转折」或「${id}/小弧:<小弧名>」）。`,
        enUS: `Refine it to a concrete slot (e.g. "${id}/转折" or "${id}/小弧:<name>").`,
      },
    }
  }
  return {
    issue: {
      zhCN: `第 ${chapterNumber} 章声明的「${id}」是整段规格，不是一次性节点 —— 声明它既不产生信息，也无法被重复消费检测。`,
      enUS: `Chapter ${chapterNumber} claims "${id}", which is a whole-span specification rather than a one-shot node — claiming it yields no information and cannot be duplicate-checked.`,
    },
    suggestion: {
      zhCN: '改声明「转折」或一个小弧。',
      enUS: 'Claim the turning point or a minor arc instead.',
    },
  }
}

/**
 * 本章的弧层引用是否闭合。
 *
 * 守卫顺序（任一命中即不判，fail-open）：
 * ① 章号非正整数；② `totalChapters` 非正整数；③ 弧光结构摊平后没有结构位；
 * ④ 大纲里找不到本章、或本章 `covers` 为空（含「覆盖：无」）。
 */
export function findArcCoverRisks(
  scope: ArcCoverScope,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[] {
  const chapterNumber = scope.chapterNumber
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return []
  const totalChapters = scope.totalChapters
  if (typeof totalChapters !== 'number' || !Number.isSafeInteger(totalChapters) || totalChapters < 1) return []

  const nodes = listArcNodes(scope.plotStructurePlan ?? '', totalChapters)
  if (nodes.length === 0) return []

  const chapter = parseChapterArcCovers(scope.synopsis ?? '')
    .find(item => item.chapterNumber === chapterNumber)
  if (!chapter || chapter.covers.length === 0) return []

  const activeExemptions = new Set(
    exemptions.filter(item => !item.revoked).map(item => item.stableFactKey),
  )
  const findings: ConsistencyFinding[] = []
  for (const violation of validateArcCovers(nodes, chapter.covers, chapterNumber)) {
    const stableFactKey = arcCoverStableFactKey(violation.code, violation.id)
    if (activeExemptions.has(stableFactKey)) continue
    const message = messageFor(violation.code, violation.id, chapterNumber)
    findings.push({
      stableFactKey,
      severity: 'warning',
      sourceChapter: chapterNumber,
      evidence: violation.message,
      issue: message.issue,
      suggestion: message.suggestion,
    })
  }
  return findings
}
