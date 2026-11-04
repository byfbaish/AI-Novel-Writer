/**
 * 「钩子：」行的解析（D18 章尾钩子合同）。
 *
 * 大纲每章末尾一行：`钩子：<类型> — <断点>｜种在：<本章哪一处>`。
 * 2026-11-04 之前它叫「收尾：」—— 历史大纲是作者资产，**不逼重生成**，
 * 所以解析侧两种都认；模板只写新名（`docs/design/prompt/d18-chapter-hook-contract-design.md` 附录 A）。
 *
 * 为什么单独一个模块：这一行的形状被三处消费 ——
 * ① 单元批拼「上一单元交接项」（取最后一个章块的钩子行）；
 * ② 校验 C1/C1b/C2（结构、版式、空钩外挂）；
 * ③ 蓝图 `suspenseHook` 的锚点比对。
 * 形状一变三处都要改，所以只在这里定义一次。
 */

/** 六值枚举。**不是行业标准分类**，是本项目的操作化命名（D18 §1）。 */
export const HOOK_TYPES = [
  '悬念截断',
  '危机降临',
  '信息炸弹',
  '两难选择',
  '情绪断裂',
  '落点',
] as const

export type HookType = (typeof HOOK_TYPES)[number]

export type ParsedHookLine = {
  /** 整行原文（含行名，去掉前缀符号与空白）。 */
  raw: string
  /** 六值之一；旧格式（无类型段）或类型不认识时为 `null`。 */
  type: HookType | null
  /** 类型之后、`｜种在：` 之前的那一段 —— 旧格式下就是整句。 */
  breakPoint: string
  /** 「种在：」指认的那一段；没写为 `null`。 */
  plantedIn: string | null
  /** 是不是旧名「收尾：」（兼容读取，不影响判定）。 */
  legacy: boolean
}

/**
 * 行首允许几个常见的前缀符号：Markdown 列表符、引用符、缩进。
 * 大纲是模型产出的纯文本，实测这几种前缀都出现过（`- 收尾：…` / `> 收尾：…`）。
 */
const HOOK_LINE_RE = /^[ \t>*\-—]*?(钩子|收尾)[：:][ \t]*(.*)$/

/**
 * 类型与断点之间的分隔符：em dash（可叠一或两枚）、en dash、hyphen。
 *
 * 只取**第一处**出现的位置，且切出来的前半段必须逐字等于六值之一才认 ——
 * 这样断点里出现连字符（`A-7 号仓`）不会被误切。
 */
const TYPE_SEPARATOR_RE = /[—–]{1,2}|-/

/** `｜种在：` 的两种竖线写法（全角 / 半角）。 */
const PLANTED_IN_RE = /[｜|][ \t]*种在[：:][ \t]*/

function normalizeType(token: string): HookType | null {
  const trimmed = token.trim()
  return (HOOK_TYPES as readonly string[]).includes(trimmed) ? (trimmed as HookType) : null
}

/**
 * 解析单独一行。不是钩子行（或行名为别的）时返回 `null`。
 *
 * 两代格式都接：
 * - 新：`钩子：悬念截断 — 刀停在半空｜种在：赵铎的尸骨`
 * - 旧：`收尾：门没关。`（无类型、无「种在」，`type` 与 `plantedIn` 都是 `null`）
 */
export function parseHookLine(line: string): ParsedHookLine | null {
  const match = HOOK_LINE_RE.exec(line.trim())
  if (!match) return null
  const legacy = match[1] === '收尾'
  const raw = `${match[1]}：${match[2] ?? ''}`.trim()
  let rest = (match[2] ?? '').trim()
  if (!rest) return { raw, type: null, breakPoint: '', plantedIn: null, legacy }

  let plantedIn: string | null = null
  const plantedMatch = PLANTED_IN_RE.exec(rest)
  if (plantedMatch) {
    const after = rest.slice(plantedMatch.index + plantedMatch[0].length).trim()
    plantedIn = after || null
    rest = rest.slice(0, plantedMatch.index).trim()
  }

  // 类型段只可能是「第一个分隔符之前的那一小段」，且必须是六值之一；
  // 否则整段都算断点（旧格式、或作者手写了一句没有类型的话）。
  let type: HookType | null = null
  let breakPoint = rest
  const separator = TYPE_SEPARATOR_RE.exec(rest)
  if (separator && separator.index > 0) {
    const candidate = normalizeType(rest.slice(0, separator.index))
    if (candidate) {
      type = candidate
      breakPoint = rest.slice(separator.index + separator[0].length).trim()
    }
  }
  if (!type) {
    // 允许「钩子：落点｜种在：…」这种不带破折号的写法（`种在` 已在上一步剥离）
    const candidate = normalizeType(rest)
    if (candidate) {
      type = candidate
      breakPoint = ''
    }
  }

  return { raw, type, breakPoint: breakPoint.trim(), plantedIn, legacy }
}

/**
 * 从一段（可能跨多章的）大纲文本里取**最后一条**钩子行。
 *
 * 用途：单元批拼「上一单元交接项」—— 需要的是上一单元**末章**那一条，
 * 而末章就是文本里最后出现的钩子行。取不到返回 `null`（调用方按"不注入、不拦"处理）。
 */
export function extractLastHookLine(text: string | null | undefined): ParsedHookLine | null {
  if (!text) return null
  const lines = text.split(/\r?\n/)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseHookLine(lines[index] ?? '')
    if (parsed) return parsed
  }
  return null
}

/** 把一条钩子行压成单行文本（注入请求用）—— 去换行、去多余空白。 */
export function formatHookLineForPrompt(parsed: ParsedHookLine): string {
  return parsed.raw.replace(/\s+/g, ' ').trim()
}

/**
 * 取最后一条钩子行的单行文本，给「上一单元交接项」直接用。
 * 取不到返回 `null` —— 调用方按"不注入、不拦、不报"处理（首个单元本来就没有上一单元）。
 */
export function formatLastHookLine(text: string | null | undefined): string | null {
  const parsed = extractLastHookLine(text)
  return parsed ? formatHookLineForPrompt(parsed) : null
}
