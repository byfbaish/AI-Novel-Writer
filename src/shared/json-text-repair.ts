/**
 * 一个**只**在严格解析失败后才使用的本地容错：修掉字符串值里未转义的双引号。
 *
 * 实机案例（2026-10-15，本地 qwen）：模型输出
 *   {"background":"在梅林坳巷口经营"老陈记"早餐摊多年，…"}
 * —— 合法 JSON 里内层引号必须写成 \"，模型却按中文习惯直接写了英文引号，
 * 于是 JSON.parse 在第 205 字符处失败、整条工作流报废。
 *
 * 判据：这是**语法**问题，不是语义问题 —— 与「框架不解析自然语言」的边界裁定无关，
 * 它连一个中文字都不必读懂：只要能在不改变字符内容的前提下把结构补回合法即可。
 *
 * 保守性设计：
 * - 仅在 `JSON.parse` 失败后调用；解析成功时永不触碰原文；
 * - 只处理引号，不猜测缺失逗号/括号，也不展开 Markdown；
 * - 判定「收尾引号」的标准是其后第一个非空白字符属于结构分隔符（`, : } ]` 或文末），
 *   其余一律按「内容里的引号」转义 —— 保留原字符，只加反斜杠。
 */
export function repairUnescapedStringQuotes(input: string): string {
  let output = ''
  let inString = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    // 已转义的序列整段抄走，避免把 \" 当成收尾引号。
    if (inString && char === '\\') {
      output += char + (input[index + 1] ?? '')
      index += 1
      continue
    }
    if (char !== '"') {
      output += char
      continue
    }
    if (!inString) {
      inString = true
      output += char
      continue
    }
    let lookahead = index + 1
    while (lookahead < input.length && /\s/u.test(input[lookahead])) lookahead += 1
    const next = input[lookahead]
    const closes = next === undefined || next === ',' || next === ':' || next === '}' || next === ']'
    if (closes) {
      inString = false
      output += char
    } else output += '\\"'
  }
  return output
}

/** 全角标点 → ASCII（仅在结构位置使用；字符串内部属于正文，不动）。 */
const FULL_WIDTH_STRUCTURAL: Readonly<Record<string, string>> = {
  '，': ',', '：': ':', '“': '"', '”': '"', '｛': '{', '｝': '}', '［': '[', '］': ']',
}

/**
 * 结构标点归一：模型偶尔用全角标点充当 JSON 分隔符 —— 实机（本地 qwen，2026-10-15）：
 * `"characters":["陈默"，"李慧兰"]`（全角逗号）与 `"purpose":"…”，“characters":…`（全角右引号 + 全角逗号）。
 *
 * 与 `repairUnescapedStringQuotes` 同一原则：**语法级**、不做任何语义判断。区别是它还要
 * 判断「哪个全角引号其实在当收尾引号用」—— 判据是该引号之后（跳过空白）紧跟结构分隔符，
 * 那种位置不可能是正常的中文引号收尾。
 *
 * ⚠️ `closeFullWidthQuotes` 有启发式成分（正文里也可能出现 `”，`），所以调用方必须用它
 * **先试低风险档、再试高风险档**，并以「能解析 + 通过证据闸门」为准 —— 猜错就退回原文本。
 */
export function repairJsonStructuralPunctuation(
  input: string,
  options: { closeFullWidthQuotes?: boolean } = {},
): string {
  const closeFullWidth = options.closeFullWidthQuotes ?? false
  const afterQuote = (index: number): string | undefined => {
    let lookahead = index + 1
    while (lookahead < input.length && /\s/u.test(input[lookahead])) lookahead += 1
    return input[lookahead]
  }
  // 收尾引号之后只可能是这些结构字符（含全角写法）。
  const closes = (character: string | undefined): boolean =>
    character === undefined || ',:}]，：｝］'.includes(character)

  let output = ''
  let inString = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (inString) {
      if (character === '\\') {
        output += character + (input[index + 1] ?? '')
        index += 1
        continue
      }
      if (character === '"') {
        if (closes(afterQuote(index))) { inString = false; output += '"' } else output += '\\"'
        continue
      }
      if (closeFullWidth && (character === '”' || character === '“') && closes(afterQuote(index))) {
        inString = false
        output += '"'
        continue
      }
      // JSON 不允许字符串里出现裸控制字符（实机：模型在长句里换了行）。
      // 这是纯语法层面的转义，字符本身一个不丢。
      if (character.charCodeAt(0) < 0x20) {
        output += character === '\n' ? '\\n' : character === '\r' ? '\\r' : character === '\t' ? '\\t'
          : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
        continue
      }
      output += character
      continue
    }
    const mapped = FULL_WIDTH_STRUCTURAL[character]
    if (mapped) {
      if (mapped === '"') inString = true
      output += mapped
      continue
    }
    if (character === '"') inString = true
    output += character
  }
  return output
}
