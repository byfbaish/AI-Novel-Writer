import type { WritingLanguage } from './writing-language'

/**
 * 大纲字数探针（E4，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §8（探针）。
 *
 * 为什么需要它：大纲每章目标 300 字（`outlineTargetUnits`），实测写到 469（正文）/591（含结构行），
 * 是目标的 1.6–2.0 倍。**大纲超写会直接放大上下文压力**——长篇 666 章时 20 万字变 31 万字，
 * 前缀爆点提前一半。所以先让人看见，**不自动收紧**（作者 2026-10-19 裁定：「这东西可以在 UI 里
 * 自己调整……自己改一改数字」）。
 *
 * 纯函数、无 IO、不读库；调用方负责把结果写进日志/体检报告。
 */

/** 连续多少章超写才报（单章波动是正常的，连续超写才是趋势）。 */
export const OUTLINE_OVERSHOOT_RUN = 3
/** 单章超写判定倍数：实际字数 > 目标 × 该倍数。 */
export const OUTLINE_OVERSHOOT_FACTOR = 1.5
/** 全书总量判定倍数：实际总字数 > 目标 × 章数 × 该倍数。 */
export const OUTLINE_TOTAL_OVERSHOOT_FACTOR = 1.3

export interface OutlineChapterLength {
  /** 章号，1 起 */
  chapter: number
  /** 该章大纲正文字数（由调用方统计；口径由调用方决定，本函数不重新切分） */
  chars: number
}

export type OutlineLengthFindingCode = 'OUTLINE_OVERSHOOT' | 'OUTLINE_TOTAL_OVERSHOOT'

export interface OutlineLengthFinding {
  code: OutlineLengthFindingCode
  /** 出问题的位置，如 `第 12–14 章` / `全书 42 章` */
  where: string
  zh: string
  en: string
}

/** 去掉空白后计字数 —— 与 `auditArcDensity` 的 `densityLength` 同一口径。 */
export function outlineLengthOf(text: string): number {
  return text.replace(/\s+/gu, '').length
}

/**
 * 连续超写检测：**从尾部连续**统计（不要求整段连续，而是「任一连续窗口 ≥ N 章」即报）。
 *
 * 只报**最长的一段**，避免 100 章超写刷 98 条告警。
 */
function longestOvershootRun(
  chapters: readonly OutlineChapterLength[],
  targetUnits: number,
): { from: number; to: number; count: number } | null {
  const threshold = targetUnits * OUTLINE_OVERSHOOT_FACTOR
  let best: { from: number; to: number; count: number } | null = null
  let runStart: number | null = null
  let runCount = 0
  let runLast = 0
  const flush = () => {
    if (runStart !== null && runCount >= OUTLINE_OVERSHOOT_RUN && (!best || runCount > best.count)) {
      best = { from: runStart, to: runLast, count: runCount }
    }
    runStart = null
    runCount = 0
  }
  for (const item of chapters) {
    if (item.chars > threshold) {
      if (runStart === null) runStart = item.chapter
      runCount += 1
      runLast = item.chapter
    } else {
      flush()
    }
  }
  flush()
  return best
}

/**
 * 大纲超写体检：两条，**只报告不阻断**。
 *
 * - `OUTLINE_OVERSHOOT`：连续 ≥3 章实际字数 > 目标 × 1.5；
 * - `OUTLINE_TOTAL_OVERSHOOT`：实际总字数 > 目标 × 章数 × 1.3。
 *
 * 目标非法（≤0 / 非整数）或没有章节时返回空数组 —— fail-open，调用方据此不打印。
 */
export function auditOutlineLength(
  chapters: readonly OutlineChapterLength[],
  targetUnits: number,
): OutlineLengthFinding[] {
  if (!Array.isArray(chapters) || chapters.length === 0) return []
  if (!Number.isSafeInteger(targetUnits) || targetUnits < 1) return []
  const usable = chapters.filter(item => Number.isSafeInteger(item.chapter) && item.chapter >= 1
    && Number.isFinite(item.chars) && item.chars >= 0)
  if (usable.length === 0) return []

  const findings: OutlineLengthFinding[] = []
  const run = longestOvershootRun(usable, targetUnits)
  if (run) {
    findings.push({
      code: 'OUTLINE_OVERSHOOT',
      where: `第 ${run.from}–${run.to} 章`,
      zh: `第 ${run.from}–${run.to} 章连续 ${run.count} 章大纲超出目标（每章 ${targetUnits} 字）的 ${OUTLINE_OVERSHOOT_FACTOR} 倍。`
        + '大纲超写会直接放大上下文压力：前缀是随章数线性增长的，写超的部分会在后面每一批里重复付一次。'
        + '可以在「AI 生成架构」里调低每章目标字数，或把这几章拆细。**这只是提示，不阻断生成。**',
      en: `Chapters ${run.from}-${run.to} run ${run.count} chapters above ${OUTLINE_OVERSHOOT_FACTOR}x the ${targetUnits}-word target. `
        + 'Oversized outline entries inflate the prompt prefix, which is paid again in every later batch. '
        + 'Lower the per-chapter target in “Generate story architecture” or split these chapters. This is advisory only.',
    })
  }

  const total = usable.reduce((sum, item) => sum + item.chars, 0)
  const chapterCount = usable.length
  const expected = targetUnits * chapterCount
  if (total > expected * OUTLINE_TOTAL_OVERSHOOT_FACTOR) {
    const ratio = total / expected
    findings.push({
      code: 'OUTLINE_TOTAL_OVERSHOOT',
      where: `全书 ${chapterCount} 章`,
      zh: `已写 ${chapterCount} 章大纲共 ${total} 字，是目标（${expected} 字）的 ${ratio.toFixed(2)} 倍。`
        + '按这个比例外推，长篇的大纲总量会提前撞上上下文上限。'
        + '可调低每章目标字数，或接受它并在后续批次里依靠投影控制输入。**这只是提示，不阻断生成。**',
      en: `${chapterCount} chapters total ${total} words — ${ratio.toFixed(2)}x the ${expected}-word target. `
        + 'Extrapolated, a long book would hit the context ceiling earlier. '
        + 'Lower the per-chapter target or rely on prefix projection. This is advisory only.',
    })
  }
  return findings
}

/** 体检结果 → 一段可读日志；空数组返回 null（调用方直接不打印）。 */
export function renderOutlineLengthReport(
  findings: readonly OutlineLengthFinding[],
  language: WritingLanguage,
): string | null {
  if (findings.length === 0) return null
  const head = language === 'en-US'
    ? '⚠ Outline length check (advisory only, does not affect this run):'
    : '⚠️ 大纲字数体检（只提示，不影响本次生成）：'
  return [head, ...findings.map(item => `- ${language === 'en-US' ? item.en : item.zh}`)].join('\n')
}
