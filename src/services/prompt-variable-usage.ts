/**
 * 模板正文（content）与「补充创作指导」（taskGuidance）共用同一套 `{{变量}}` 语法，
 * 而两者是**分别渲染**后拼进同一条请求的 —— 同一个变量写成两处，就会把同一份内容
 * 注入两遍：白占上下文，还会让同一件事出现两种措辞、稀释彼此。
 *
 * 这两个函数只做「识别」，不做任何改写：设置面板据此给变量打标记、对已经重复的给出提示，
 * 但绝不自动替作者删字。
 */

/** 按出现顺序返回文本里引用到的变量名（已去重）。 */
export function extractTemplateVariables(source: string): string[] {
  const pattern = /\{\{([A-Za-z0-9_]+)\}\}/gu
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]!))]
}

/**
 * 找出「模板正文已经渲染过、却又在补充指导里再写一遍」的变量。
 * 返回顺序跟随补充指导里的出现顺序，便于提示里按作者书写顺序列出。
 */
export function findDuplicatedBodyVariables(body: string, guidance: string): string[] {
  const bodyVariables = new Set(extractTemplateVariables(body))
  return extractTemplateVariables(guidance).filter((name) => bodyVariables.has(name))
}
