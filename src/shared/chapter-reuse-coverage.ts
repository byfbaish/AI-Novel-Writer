import { visibleProseUnitCount } from './visible-text-integrity'
import type { WritingLanguage } from './writing-language'
import {
  BLUEPRINT_COPY_MIN_RUN_CJK,
  BLUEPRINT_COPY_MIN_RUN_ENT,
} from './blueprint-verbatim-overlap'

/**
 * 连续重合多少个码元才算命中。**直接复用** blueprint 照搬检测的同一组常量
 * （中文 16 字 / 英文 40 字母）—— 两个检测器用的是同一种「连续重合」口径，
 * 另立一份等于同一事实活在两处，改一处必漏另一处。
 */
export const CHAPTER_REUSE_MIN_RUN_CJK = BLUEPRINT_COPY_MIN_RUN_CJK
export const CHAPTER_REUSE_MIN_RUN_ENT = BLUEPRINT_COPY_MIN_RUN_ENT

/** 阻断线：正文里复用上一章的比例或绝对量超过它就判定为「阻断」。 */
export const REUSE_RATIO_BLOCKING = 0.35
// 覆盖比例超过此值但未达阻断线，给出 advisory 建议
export const REUSE_RATIO_ADVISORY = 0.15
// ratio > REUSE_RATIO_BLOCKING → 'blocking'
// ratio > REUSE_RATIO_ADVISORY 且 <= BLOCKING → 'advisory'
// 否则 → 'ok'
// 待用存量样本标定

/** 正文里被上一章覆盖的码元数 / 正文总码元数 */
export interface ChapterReuseReport {
  /** 被上一章覆盖的正文码元数 / 正文总码元数，取值 0–1，不允许 NaN */
  ratio: number
  /** 被覆盖的正文码元数 */
  coveredUnits: number
  /** 连续重合段，按 start 升序；相邻段不许重叠 */
  runs: ChapterReuseRun[]
  /** 最长一段的长度，无重合时为 0 */
  longestRun: number
  severity: ChapterReuseSeverity
}

export type ChapterReuseSeverity = 'ok' | 'advisory' | 'blocking'

export interface ChapterReuseRun {
  /** 在 prose 中的起始索引 */
  start: number
  /** 该重合段的长度（码元） */
  length: number
}

export interface ChapterReuseOptions {
  writingLanguage?: WritingLanguage
}

/**
 * 分析正文有多少比例是复用了上一章全文。
 *
 * 算法沿用 `analyzeBlueprintVerbatimCopy` 的口径：
 * - NFKC + 小写 + 折叠空白 + 删标点，保留下标映射
 * - n-gram 切法：中文按字 (16)、英文按字母 (40)
 * - 贪心扫描：每个起点查归一化 k-gram 索引，命中则向后延长取最长，区间不重叠
 * - 返回覆盖率 ratio = coveredUnits / proseUnits (proseUnits 为 0 时记 0)
 *
 * 差异点：
 * - 参考文本换成 **上一章全文**；
 * - 报告里给出 **覆盖率**（coveredUnits / proseUnits），而不只是重合段。
 */
export function analyzeChapterReuse(
  prose: string,
  previousChapter: string,
  options?: ChapterReuseOptions,
): ChapterReuseReport {
  const language = options?.writingLanguage ?? 'zh-CN'
  const gramSize =
    language === 'en-US' ? CHAPTER_REUSE_MIN_RUN_ENT : CHAPTER_REUSE_MIN_RUN_CJK

  // 边界：两者均为空或全空白 → 全 0 / ok
  if (!prose.trim() || !previousChapter.trim()) {
    return {
      ratio: 0,
      coveredUnits: 0,
      runs: [],
      longestRun: 0,
      severity: 'ok',
    }
  }

  const proseUnits = visibleProseUnitCount(prose)
  const prevUnits = visibleProseUnitCount(previousChapter)

  // 两者都短于一个 n-gram → 全 0 / ok（不抛错）
  if (prevUnits < gramSize) {
    return {
      ratio: 0,
      coveredUnits: 0,
      runs: [],
      longestRun: 0,
      severity: 'ok',
    }
  }

  // 正文再短于 n-gram，也视为无法命中
  if (proseUnits < gramSize) {
    return {
      ratio: 0,
      coveredUnits: 0,
      runs: [],
      longestRun: 0,
      severity: 'ok',
    }
  }

  // NFKC + 小写 + 折叠空白 + 删标点，同时保留下标映射
  function normalizeWithMap(text: string): {
    normalized: string
    offsets: number[]
  } {
    const chars: string[] = []
    const offsets: number[] = []
    let lastWasSpace = false
    let offset = 0

    for (const raw of text) {
      for (const folded of raw.normalize('NFKC').toLowerCase()) {
        if (/[\p{P}\p{S}]/u.test(folded)) {
          lastWasSpace = false
          continue
        }
        if (/\s/u.test(folded)) {
          if (lastWasSpace) continue
          chars.push(' ')
          offsets.push(offset)
          lastWasSpace = true
          continue
        }
        chars.push(folded)
        offsets.push(offset)
        lastWasSpace = false
      }
      offset += raw.length
    }

    while (chars.length > 0 && chars[0] === ' ') {
      chars.shift()
      offsets.shift()
    }
    while (chars.length > 0 && chars[chars.length - 1] === ' ') {
      chars.pop()
      offsets.pop()
    }

    return { normalized: chars.join(''), offsets }
  }

  const proseNorm = normalizeWithMap(prose)
  const prevNorm = normalizeWithMap(previousChapter)

  // 如果归一化后的参考文本仍短于 n-gram → 全 0 / ok
  if (prevNorm.normalized.length < gramSize) {
    return {
      ratio: 0,
      coveredUnits: 0,
      runs: [],
      longestRun: 0,
      severity: 'ok',
    }
  }

  // 构建 n-gram 索引
  function buildGramIndex(text: string, gramSize: number): Map<string, number[]> {
    const index = new Map<string, number[]>()
    for (let start = 0; start + gramSize <= text.length; start += 1) {
      const gram = text.slice(start, start + gramSize)
      const bucket = index.get(gram)
      if (bucket) bucket.push(start)
      else index.set(gram, [start])
    }
    return index
  }

  const index = buildGramIndex(prevNorm.normalized, gramSize)

  const runs: ChapterReuseRun[] = []
  let cursor = 0

  // 贪心扫描：每个起点先查 n-gram 索引，命中则向后逐字符延伸取最长，区间不重叠
  while (cursor + gramSize <= proseNorm.normalized.length) {
    const bucket = index.get(
      proseNorm.normalized.slice(cursor, cursor + gramSize),
    )
    if (!bucket) {
      cursor += 1
      continue
    }

    let longest = 0
    for (const candidate of bucket) {
      let length = 0
      while (
        cursor + length < proseNorm.normalized.length
        && candidate + length < prevNorm.normalized.length
        && proseNorm.normalized[cursor + length] === prevNorm.normalized[candidate + length]
      ) {
        length += 1
      }
      if (length > longest) longest = length
    }

    if (longest < gramSize) {
      cursor += 1
      continue
    }

    runs.push({ start: cursor, length: longest })
    cursor += longest
  }

  if (runs.length === 0) {
    return {
      ratio: 0,
      coveredUnits: 0,
      runs: [],
      longestRun: 0,
      severity: 'ok',
    }
  }

  // 计算 coveredUnits：按原文片段，用 offsets 映射回原文计量单位
  const coveredUnits = runs.reduce((total, run) => {
    const originalStart = proseNorm.offsets[run.start] ?? 0
    const end = run.start + run.length
    const originalEnd =
      end < proseNorm.offsets.length ? proseNorm.offsets[end] : prose.length
    return total + visibleProseUnitCount(prose.slice(originalStart, originalEnd))
  }, 0)

  const ratio = proseUnits > 0 ? Math.min(coveredUnits / proseUnits, 1) : 0

  // 确定级别
  let severity: ChapterReuseSeverity
  if (ratio > REUSE_RATIO_BLOCKING) {
    severity = 'blocking'
  } else if (ratio > REUSE_RATIO_ADVISORY) {
    severity = 'advisory'
  } else {
    severity = 'ok'
  }

  // 计算 longestRun
  const longestRun = runs.length > 0
    ? Math.max(...runs.map(r => r.length))
    : 0

  return {
    ratio,
    coveredUnits,
    runs,
    longestRun,
    severity,
  }
}