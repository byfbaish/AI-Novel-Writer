import { visibleProseUnitCount } from './visible-text-integrity'
import type { WritingLanguage } from './writing-language'

/**
 * 正文逐字复用「蓝图必需事件」的检测。
 *
 * ## 它抓的是什么
 *
 * 作者在蓝图里写的 `keyEvents` 是**必须发生的事件**，通常已经写成叙事句
 * （「李明推开门，看见父亲坐在黑暗里」）。模型如果把这句**逐字搬进正文**，
 * 正文就退化成了细纲的扩写——读起来是提纲，不是小说。
 *
 * ## 为什么基准只用 keyEvents
 *
 * 不用 `user_guidance`（指导语，正文体现它是正常的）、不用 `suspense_hook`（目标状态）、
 * 更不用 `JSON.stringify(投影)`（字段名与引号会被当基准，命中率虚高）。
 * `title` / `role` / `purpose` 也不能用：它们极短（夹具默认就是「开端」「建立冲突」），拿来比对必然误判。
 *
 * ## 为什么分级而不是一律阻断
 *
 * 作者的 `keyEvents` 常写成现成叙事句，模型复用其中措辞是可能发生的。
 * 一律阻断会造出「作者自己也满足不了」的约束，所以只有「正文基本就是细纲扩写」才算故障。
 */

/** 连续重合多少个归一化单元才算命中。中文按字，英文按字母（16 字母只有 3 个词，故抬高）。 */
export const BLUEPRINT_COPY_MIN_RUN_CJK = 16
export const BLUEPRINT_COPY_MIN_RUN_ENT = 40

/** 阻断线：正文里逐字复用的比例或绝对量超过它就判定为「扩写而非创作」。 */
const BLOCKING_RATIO = 0.25
const BLOCKING_COVERED_UNITS = 400
/** 提示线。 */
const ADVISORY_RUNS = 2
const ADVISORY_COVERED_UNITS = 32

const EXCERPT_MAX_CHARS = 60

export interface BlueprintCopyRun {
  /** 命中区间在**正文归一化串**里的起始下标。 */
  start: number
  /** 归一化长度（已去标点与重复空白）。 */
  length: number
  /** 从**正文原文**切回的片段，用于日志定位。 */
  excerpt: string
}

export interface BlueprintCopyReport {
  proseUnits: number
  blueprintUnits: number
  runs: BlueprintCopyRun[]
  /** 命中区间覆盖的正文计量单位数（按原文计，非归一化长度）。 */
  coveredUnits: number
  /** `coveredUnits / proseUnits`，proseUnits 为 0 时记 0。 */
  ratio: number
  severity: 'none' | 'advisory' | 'blocking'
}

export interface BlueprintCopyOptions {
  writingLanguage?: WritingLanguage
}

interface NormalizedText {
  normalized: string
  /** 归一化下标 → 原文下标（按 code point 前缀和，代理对不会错位）。 */
  offsets: number[]
}

const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]/u
const WHITESPACE = /\s/u

/**
 * NFKC + 小写 + 折叠空白 + 删标点符号，同时保留下标映射。
 *
 * 删标点是为了让「他推开门，看见父亲。」与「他推开门 看见父亲」能对上；
 * 保留**单个空格**是为了让英文分词不至于粘连。
 */
function normalizeWithMap(text: string): NormalizedText {
  const chars: string[] = []
  const offsets: number[] = []
  let lastWasSpace = false
  let offset = 0

  for (const raw of text) {
    for (const folded of raw.normalize('NFKC').toLowerCase()) {
      if (PUNCTUATION_OR_SYMBOL.test(folded)) {
        lastWasSpace = false
        continue
      }
      if (WHITESPACE.test(folded)) {
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

function excerptOf(prose: string, offsets: number[], start: number, end: number): string {
  const originalStart = offsets[start] ?? 0
  const originalEnd = end < offsets.length ? offsets[end] : prose.length
  return prose.slice(originalStart, originalEnd).replace(/\s+/gu, ' ').trim().slice(0, EXCERPT_MAX_CHARS)
}

/**
 * 分析正文逐字复用了蓝图必需事件多少内容。
 *
 * 贪心扫描：每个起点先查归一化 k-gram 索引，命中则向后逐字符延伸取最长，区间不重叠。
 * 复杂度 ≈ O(n·k)（3000 字正文 × 16 ≈ 5 万次比较），不需要二分。
 */
export function analyzeBlueprintVerbatimCopy(
  prose: string,
  blueprintText: string,
  options: BlueprintCopyOptions = {},
): BlueprintCopyReport {
  const language = options.writingLanguage ?? 'zh-CN'
  const gramSize = language === 'en-US' ? BLUEPRINT_COPY_MIN_RUN_ENT : BLUEPRINT_COPY_MIN_RUN_CJK
  const proseUnits = visibleProseUnitCount(prose)
  const blueprintUnits = visibleProseUnitCount(blueprintText)

  const empty: BlueprintCopyReport = {
    proseUnits,
    blueprintUnits,
    runs: [],
    coveredUnits: 0,
    ratio: 0,
    severity: 'none',
  }
  if (!prose.trim() || !blueprintText.trim() || blueprintUnits < gramSize) return empty

  const proseText = normalizeWithMap(prose)
  const blueprint = normalizeWithMap(blueprintText)
  if (blueprint.normalized.length < gramSize) return empty

  const index = buildGramIndex(blueprint.normalized, gramSize)
  const runs: BlueprintCopyRun[] = []
  let cursor = 0

  while (cursor + gramSize <= proseText.normalized.length) {
    const bucket = index.get(proseText.normalized.slice(cursor, cursor + gramSize))
    if (!bucket) {
      cursor += 1
      continue
    }

    let longest = 0
    for (const candidate of bucket) {
      let length = 0
      while (
        cursor + length < proseText.normalized.length
        && candidate + length < blueprint.normalized.length
        && proseText.normalized[cursor + length] === blueprint.normalized[candidate + length]
      ) {
        length += 1
      }
      if (length > longest) longest = length
    }

    if (longest < gramSize) {
      cursor += 1
      continue
    }

    runs.push({
      start: cursor,
      length: longest,
      excerpt: excerptOf(prose, proseText.offsets, cursor, cursor + longest),
    })
    cursor += longest
  }

  if (runs.length === 0) return empty

  const coveredUnits = runs.reduce((total, run) => {
    const originalStart = proseText.offsets[run.start] ?? 0
    const end = run.start + run.length
    const originalEnd = end < proseText.offsets.length ? proseText.offsets[end] : prose.length
    return total + visibleProseUnitCount(prose.slice(originalStart, originalEnd))
  }, 0)
  const ratio = proseUnits > 0 ? coveredUnits / proseUnits : 0

  const severity: BlueprintCopyReport['severity'] = (
    ratio >= BLOCKING_RATIO || coveredUnits >= BLOCKING_COVERED_UNITS
      ? 'blocking'
      : coveredUnits >= ADVISORY_COVERED_UNITS || runs.length >= ADVISORY_RUNS
        ? 'advisory'
        : 'none'
  )

  return { proseUnits, blueprintUnits, runs, coveredUnits, ratio, severity }
}
