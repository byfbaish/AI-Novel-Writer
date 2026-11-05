/**
 * 尖括号占位符守卫（纯函数层，由卷 / 单元结构写库前调用）。
 *
 * 背景：模型会把格式模板里的 `<七点>`、`<钩子>` 这类占位符原样抄进正文，此前无任何机检。
 * 本模块只负责「找出正文里形如占位符的尖括号片段」，是否豁免由调用方在接线时决定。
 *
 * 判据：
 * - 半角 `<` 与 `>` 成对包裹、内部有效内容（trim 后）非空；
 * - 内部不是下列 HTML 标签名（大小写不敏感；允许闭合前缀 `/` 与自闭合后缀 `/`）：
 *   br p b i em strong span div ul ol li table tr td a img h1–h6。
 *
 * 实现选择说明：豁免判定把内部内容去掉首尾 `/` 后与标签名全等比较——
 * 即 `</strong>`、`<br/>` 豁免，而 `<span class="x">`、`<br />`（内部为 `br /`）不豁免，
 * 后者内部并非纯标签名，按判据字面仍属命中。
 */

const EXEMPT_TAGS = new Set([
  'br', 'p', 'b', 'i', 'em', 'strong', 'span', 'div',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'a', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

export interface PlaceholderHit {
  /** 命中的完整片段，含尖括号 */
  raw: string
  /** 在原文中的起始下标（全文，UTF-16 码元，与 JS 字符串下标一致） */
  index: number
  /** 1 起的行号 */
  line: number
}

export function findAngleBracketPlaceholders(text: string): PlaceholderHit[] {
  const hits: PlaceholderHit[] = []
  const lines = text.split('\n')
  const pattern = /<([^<>]+)>/g
  let lineStart = 0
  for (let i = 0; i < lines.length; i++) {
    const content = lines[i]
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const inner = match[1]
      const name = inner.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
      if (!name || EXEMPT_TAGS.has(name)) continue
      hits.push({ raw: match[0], index: lineStart + match.index, line: i + 1 })
    }
    lineStart += content.length + 1
  }
  return hits
}
