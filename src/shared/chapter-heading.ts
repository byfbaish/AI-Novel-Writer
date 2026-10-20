/**
 * 情节大纲**章标题的唯一解析处**（2026-10-20）。
 *
 * ## 为什么要有这个文件
 *
 * 同一件事原本有三个各写各的正则：
 *
 * | 位置 | 用途 | 宽容度 |
 * |---|---|---|
 * | `plot-outline-contract.headings()` | 覆盖章数 / `validPlotOutlineEntry` | 最宽：`#`1–6 或 bullet 或无前缀、中文数字、`第N–M章` |
 * | `arc-node.CHAPTER_HEADING` | 抽 `title` + 把 `覆盖：` 行归到章 | `#`1–4、仅阿拉伯数字、分隔符可有可无 |
 * | `outline-tree.scanChapterLines` | 章标题行号 | 恰好 `##`、仅阿拉伯数字 |
 *
 * 三份正则就是三个独立的失效点。换标题格式时漏一处，后果不是"显示难看"，而是
 * 「覆盖章数算成 0 ⇒ 单元回填判没写出本章标题 ⇒ 整批丢弃」——A6 事故同款。
 *
 * 所以**解析收敛到这里，宽容度差异保留在调用方**（用本文件给出的字段做一行判断）。
 *
 * ## 支持的形状
 *
 * ```
 * ## 第3卷第2单元第3章（全书第45章）：章名      ← 三层归属（必须有「全书第N章」）
 * ## 第3卷第3章（全书第45章）：章名             ← 两级结构（无单元层）
 * ## 第45章：章名                                ← 旧格式，永久兼容
 * ## 第12–15章：章名                             ← 旧格式章组
 * ## Chapter 45: Title                           ← 旧格式英文
 * ```
 *
 * ⚠️ **归属性标题必须带「（全书第N章）」**：没有它就只有「单元内第几章」，无法定位到
 * 全书章号，覆盖水位线会算错。这种情况一律**不识别**（退回 null），不猜。
 */

/** 章号允许的字符：阿拉伯 + 中文数字（`十二` / `二十三`）。 */
const NUMERAL = '[0-9零〇一二两三四五六七八九十百千]+'

const DIGITS: Readonly<Record<string, number>> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}
const UNITS: Readonly<Record<string, number>> = { 十: 10, 百: 100, 千: 1000 }

/** 「十二」→ 12、「3」→ 3；无法解析返回 `NaN`。 */
export function chapterNumberFromToken(token: string): number {
  if (/^\d+$/u.test(token)) return Number(token)
  let result = 0
  let digit = 0
  for (const char of token) {
    if (char in DIGITS) {
      digit = DIGITS[char]!
    } else if (char in UNITS) {
      result += (digit || 1) * UNITS[char]!
      digit = 0
    } else {
      return Number.NaN
    }
  }
  return result + digit
}

const HASH_PREFIXES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const
export type OutlineHeadingPrefix = typeof HASH_PREFIXES[number] | 'bullet' | 'none'

/** 章号后允许的分隔符（三处并集；调用方按自己那份子集再判）。 */
const SEPARATOR = /^[\t ]*([:：.．、·\-—])?[\t ]*/u

/**
 * 大纲类调用方共用的分隔符子集（`plot-outline-contract` / `architecture.command` /
 * `synopsis-projection` 三处同一份）。
 *
 * ⚠️ 之所以要导出：这三个文件曾经**各写一个 Set**，加上各自的正则，等于三套独立标准；
 * 2026-10-20 那次「6 章写完入不了库」就是其中一处漏了新格式。改集合就改这里一处。
 */
export const OUTLINE_TITLE_SEPARATORS: ReadonlySet<string> = new Set([':', '：', '.', '．', '-', '—'])

/**
 * 组：1 hash / 2 bullet / 3 卷 / 4 单元 / 5 单元内章 / 6 全书章 /
 *     7 旧格式起始章 / 8 旧格式区间终点 / 9 英文起始章 / 10 英文区间终点 / 11 分隔符之后
 */
const HEADING = new RegExp(
  '^[\\t ]*'
  // ⚠️ `#{1,6}` 后面是 `*` 而不是 `+`：`arc-node` 与 `outline-tree` 都接受 `##第5章`，
  // 只有 `plot-outline-contract` 要求 `#` 后必须有空白 —— 那由 `prefixSpaced` 表达。
  + '(?:(#{1,6})[\\t ]*|([-*+])[\\t ]+)?'
  + '(?:'
  // ① 带归属：第V卷[第U单元]第C章（全书第N章）
  + `第[\\t ]*(${NUMERAL})[\\t ]*卷[\\t ]*(?:第[\\t ]*(${NUMERAL})[\\t ]*单元[\\t ]*)?第[\\t ]*(${NUMERAL})[\\t ]*章`
  + `[\\t ]*[（(][\\t ]*全书[\\t ]*第[\\t ]*(${NUMERAL})[\\t ]*章[\\t ]*[)）]`
  // ② 旧格式：第N章 / 第N–M章
  + `|第[\\t ]*(${NUMERAL})(?:[\\t ]*[–—-][\\t ]*(${NUMERAL}))?[\\t ]*章`
  // ③ 旧格式英文：Chapter N / Chapters N-M
  + '|Chapters?[\\t ]+(\\d+)(?:[\\t ]*[–—-][\\t ]*(\\d+))?'
  + ')'
  + '([\\s\\S]*)',
  'iu',
)

export interface OutlineChapterHeadingFields {
  /** 全书章号（章组取起始章）——**唯一机器锚点** */
  chapter: number
  /** 章组终点；单章时等于 `chapter` */
  chapterTo: number
  /** `第N–M章` / `Chapters N-M` */
  grouped: boolean
  /** 标题前缀种类 */
  prefix: OutlineHeadingPrefix
  /** hash 级数；非 hash 前缀为 0 */
  hashLevel: number
  /**
   * hash 前缀后是否紧跟空白（`## 第5章` = true，`##第5章` = false）。
   * `plot-outline-contract` 要求 true；`arc-node` / `outline-tree` 不看这个字段。
   */
  prefixSpaced: boolean
  /** 章号 token 是否纯阿拉伯数字（`arc-node` / `outline-tree` 只认这种） */
  arabic: boolean
  /** 章号写法：`第N章`（`cn`）还是 `Chapter N`（`en`）。`outline-tree` 只认 `cn` */
  style: 'cn' | 'en'
  /** 章号后紧邻的原文（含分隔符，未切）——调用方按自己的分隔符子集再切 */
  after: string
  /** 章号后紧邻的分隔符原文（按**三处并集**探测）；无分隔符为 `null` */
  separator: string | null
  /**
   * 分隔符之后的剩余内容（按**并集**切，未 trim）。
   * ⚠️ `arc-node` 的分隔符集合比并集窄（不含全角句点 `．`），它必须自己从 `after` 切。
   */
  rest: string
  /** 卷号；无归属为 `null` */
  volumeIndex: number | null
  /** 单元号；两级结构（无单元层）为 `null` */
  unitIndex: number | null
  /**
   * 在**所属层级**内的序号：有单元层 = 单元内第几章；只有卷层 = 卷内第几章。
   * 旧格式为 `null`。
   */
  chapterInParent: number | null
  /** 标题是否写明归属（`第V卷…（全书第N章）`） */
  attributed: boolean
}

function positiveInteger(value: number): number | null {
  return Number.isSafeInteger(value) && value >= 1 ? value : null
}

/**
 * 解析一行章标题。不是章标题（或归属不完整）返回 `null`。
 *
 * 只处理**单行**：调用方自己切行（`split(/\r?\n/u)`），自己算行号与偏移。
 */
export function parseOutlineChapterHeading(line: string): OutlineChapterHeadingFields | null {
  if (!line) return null
  const match = HEADING.exec(line)
  if (!match) return null

  const after = match[11] ?? ''
  const separatorMatch = SEPARATOR.exec(after)
  const separator = separatorMatch?.[1] ?? null
  const rest = after.slice(separatorMatch?.[0].length ?? 0)

  const hashLevel = match[1]?.length ?? 0
  const prefix: OutlineHeadingPrefix = hashLevel > 0 && hashLevel <= 6
    ? HASH_PREFIXES[hashLevel - 1]!
    : match[2] ? 'bullet' : 'none'
  // `##第5章`（无空白）在 `arc-node` / `outline-tree` 是合法的，在 `plot-outline-contract` 不是。
  const prefixSpaced = hashLevel === 0 || /^[\t ]*#{1,6}[\t ]/u.test(line)

  // ① 三层 / 两级归属
  if (match[3] !== undefined) {
    const volumeIndex = positiveInteger(chapterNumberFromToken(match[3]!))
    const unitIndex = match[4] !== undefined ? positiveInteger(chapterNumberFromToken(match[4]!)) : null
    const chapterInParent = positiveInteger(chapterNumberFromToken(match[5]!))
    const chapter = positiveInteger(chapterNumberFromToken(match[6]!))
    if (volumeIndex === null || chapterInParent === null || chapter === null) return null
    if (match[4] !== undefined && unitIndex === null) return null
    return {
      chapter,
      chapterTo: chapter,
      grouped: false,
      prefix,
      hashLevel,
      prefixSpaced,
      style: 'cn',
      after,
      separator,
      rest,
      arabic: /^\d+$/u.test(match[6]!),
      volumeIndex,
      unitIndex,
      chapterInParent,
      attributed: true,
    }
  }

  // ② / ③ 旧格式（无归属）
  const fromToken = match[7] ?? match[9]
  const toToken = match[8] ?? match[10]
  if (fromToken === undefined) return null
  const chapter = positiveInteger(chapterNumberFromToken(fromToken))
  const chapterTo = toToken === undefined ? chapter : positiveInteger(chapterNumberFromToken(toToken))
  if (chapter === null || chapterTo === null || chapterTo < chapter) return null
  return {
    chapter,
    chapterTo,
    grouped: toToken !== undefined || /Chapters[\t ]/iu.test(match[0]),
    prefix,
    hashLevel,
    prefixSpaced,
    style: match[7] !== undefined ? 'cn' : 'en',
    after,
    separator,
    rest,
    arabic: /^\d+$/u.test(fromToken),
    volumeIndex: null,
    unitIndex: null,
    chapterInParent: null,
    attributed: false,
  }
}
