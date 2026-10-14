import { describe, expect, it } from 'vitest'
import { repairUnescapedStringQuotes } from '../json-text-repair'

/** 实机原文（本地 qwen，2026-10-15）：background 里直接把店名写成英文引号 —— 非法 JSON。 */
const realModelOutput = '{"character":{"name":"老陈","role":"supporting","gender":"男","age":"约五十五岁","personality":"沉默寡言，把\'还是老样子\'当作最大的本事；关怀全塞进那一勺辣子里。","background":"在梅林坳巷口经营"老陈记"早餐摊多年，豆浆油条，不记账不催单。","motivation":"让每个早上走过来的人吃上一口"对的"东西。","notes":"材料仅显示他经营巷口早餐摊。"},"relationships":[{"target":"陈默","relation":"熟客"}]}'

describe('JSON 语法级容错：字符串内未转义的引号', () => {
  it('把实机原文修成可解析的 JSON，且字符内容一字不改', () => {
    expect(() => JSON.parse(realModelOutput)).toThrow()
    const parsed = JSON.parse(repairUnescapedStringQuotes(realModelOutput)) as {
      character: { name: string; background: string; motivation: string }
    }
    expect(parsed.character.name).toBe('老陈')
    // 引号原样保留为内容（只是补上反斜杠），店名与「对的」都不丢。
    expect(parsed.character.background).toContain('经营"老陈记"早餐摊多年')
    expect(parsed.character.motivation).toContain('吃上一口"对的"东西')
  })

  it('合法 JSON 原样返回（容错不参与正常路径）', () => {
    const valid = '{"a":"b","c":[{"d":"e"}],"f":{"g":"含\\"转义\\"的引号"}}'
    expect(repairUnescapedStringQuotes(valid)).toBe(valid)
    expect(JSON.parse(repairUnescapedStringQuotes(valid))).toEqual(JSON.parse(valid))
  })

  it('已转义的引号不被二次转义，收尾引号不被误判', () => {
    const valid = '{"key":"value with \\"quoted\\" word","n":1}'
    expect(repairUnescapedStringQuotes(valid)).toBe(valid)
    // 键的收尾引号后跟冒号；值的收尾引号后跟逗号/花括号 —— 都必须保持结构不变。
    const nested = '{"a":{"b":"c"},"d":["e","f"]}'
    expect(repairUnescapedStringQuotes(nested)).toBe(nested)
  })

  it('未闭合并被截断的文本不会被伪造成合法 JSON', () => {
    const truncated = '{"character":{"name":"老陈","background":"没写完就断了'
    expect(() => JSON.parse(repairUnescapedStringQuotes(truncated))).toThrow()
  })
})
