/**
 * 蓝图悬念钩子 ↔ 大纲收尾行 对齐校验（D18）。
 *
 * 提交蓝图时对 `suspense_hook` 没有任何校验：第 6 章的蓝图钩子写了「寿元」「因果纹」，
 * 但大纲该章收尾行里没有这些概念，正文里这两个词各出现 0 次。本文件是纯函数机检件，
 * 未接线到任何调用点。
 *
 * ## 分词规则（简单实现）
 *
 * 1. 只保留**汉字连续串**（`/[\u4e00-\u9fa5]+/g`），英文 / 数字 / 标点丢弃；
 * 2. 长度 < 2 的片段丢弃；
 * 3. 对每个片段滑动取二元组（bigram）；
 * 4. 二元组中**任一字符**命中停用词字符集即丢弃（停用词表：`的` `了` `在` `是` `和`
 *    `与` `也` `就` `都` `这` `那` `一个` `什么` `不是` `没有` `自己` `他们` `我们`）；
 * 5. 同一文本内去重，保持首次出现顺序。
 *
 * `sharedTokens` = 两文本 token 交集，按大纲收尾行出现顺序去重；
 * `hookTokens` = 钩子文本 token 去重。`verdict`：交集非空 ⇒ `aligned`，否则 `drifted`。
 *
 * **判定是启发式，只能警示，不能阻断提交。**
 */
export type HookAlignment = {
  verdict: 'aligned' | 'drifted'
  sharedTokens: string[]
  hookTokens: string[]
}

const STOPWORDS = ['的', '了', '在', '是', '和', '与', '也', '就', '都', '这', '那', '一个', '什么', '不是', '没有', '自己', '他们', '我们']

/** 停用词字符集：把停用词逐字拆开，二元组内任一字符命中即丢弃。 */
const STOPWORD_CHARS = new Set(STOPWORDS.flatMap((word) => [...word]))

function tokenize(text: string): string[] {
  const runs = text.match(/[\u4e00-\u9fa5]+/g) ?? []
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const run of runs) {
    if (run.length < 2) continue
    for (let i = 0; i < run.length - 1; i++) {
      const bigram = run.slice(i, i + 2)
      if ([...bigram].some((ch) => STOPWORD_CHARS.has(ch))) continue
      if (!seen.has(bigram)) {
        seen.add(bigram)
        tokens.push(bigram)
      }
    }
  }
  return tokens
}

export function alignSuspenseHook(outlineEnding: string, hook: string): HookAlignment {
  const outlineTokens = tokenize(outlineEnding)
  const hookTokens = tokenize(hook)
  const hookSet = new Set(hookTokens)
  const sharedTokens = outlineTokens.filter((t) => hookSet.has(t))
  return {
    verdict: sharedTokens.length > 0 ? 'aligned' : 'drifted',
    sharedTokens,
    hookTokens,
  }
}
