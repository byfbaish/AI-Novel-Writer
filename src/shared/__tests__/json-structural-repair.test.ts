import { describe, expect, it } from 'vitest'
import { repairJsonStructuralPunctuation } from '../json-text-repair'
import { preservesStructuredJsonEvidence } from '../../services/workflows/structured-syntax-repair'

/**
 * 实机（本地 qwen，2026-10-15）的两类语法缺陷，以及「证据闸门必须读得动候选」这条前提：
 * 闸门原先遇到 `，`（全角）或字符串里的裸换行就返回 undefined ⇒ 任何修复都被判
 * 「改变了非结构证据」，修复轮无论多正确都被拒，整条蓝图生成失败。
 */
function repaired(candidate: string): string {
  // 与执行器同序：先低风险档，再允许「全角引号当收尾」。
  return ([false, true] as const)
    .map(closeFullWidthQuotes => repairJsonStructuralPunctuation(candidate, { closeFullWidthQuotes }))
    .find(value => value !== candidate && preservesStructuredJsonEvidence(candidate, value)) ?? ''
}

describe('结构标点归一（语法级）', () => {
  it('全角逗号当成员分隔符时可修，且标量证据不变', () => {
    const candidate = '{"blueprints":[{"chapterNumber":1,"title":"甲"，"purpose":"乙"}]}'
    expect(() => JSON.parse(candidate)).toThrow()
    expect(repaired(candidate)).toBe('{"blueprints":[{"chapterNumber":1,"title":"甲","purpose":"乙"}]}')
  })

  it('全角右引号 + 全角逗号当「字符串收尾 + 分隔」时可修', () => {
    const candidate = '{"blueprints":[{"chapterNumber":1,"title":"甲”，“purpose":"乙"}]}'
    expect(() => JSON.parse(candidate)).toThrow()
    expect(repaired(candidate)).toBe('{"blueprints":[{"chapterNumber":1,"title":"甲","purpose":"乙"}]}')
  })

  it('字符串里的裸换行按转义修（字符不丢）', () => {
    const candidate = '{"blueprints":[{"purpose":"第一行\n第二行"}]}'
    expect(() => JSON.parse(candidate)).toThrow()
    const fixed = repaired(candidate)
    expect(JSON.parse(fixed)).toEqual({ blueprints: [{ purpose: '第一行\n第二行' }] })
  })

  it('字符串内部的全角标点属于正文，低风险档一个字不动', () => {
    const candidate = '{"purpose":"他说：“站住”，然后跑了。"}'
    expect(repairJsonStructuralPunctuation(candidate, { closeFullWidthQuotes: false })).toBe(candidate)
    // 该文本本身合法，执行器不会走到修复路径（这里只断言"归一不会误改正文"）。
    expect(() => JSON.parse(candidate)).not.toThrow()
  })

  it('真实失败原文的两档启发式：低风险档不够、高风险档成功且过闸门', () => {
    // 摘取实机原文的两处缺陷：全角逗号 + 全角引号收尾，外加字符串内裸换行。
    const candidate = '{\n  "blueprints": [\n    {\n      "title": "甲"，\n      "purpose": "第一行\n第二行”，“characters": ["陈默"]\n    }\n  ]\n}'
    expect(() => JSON.parse(candidate)).toThrow()
    const fixed = repaired(candidate)
    expect(fixed).not.toBe('')
    const parsed = JSON.parse(fixed) as { blueprints: { purpose: string; characters: string[] }[] }
    expect(parsed.blueprints[0].characters).toEqual(['陈默'])
    expect(parsed.blueprints[0].purpose).toContain('\n')
  })
})

describe('证据闸门对语法类缺陷可读、对内容改写仍拒绝', () => {
  it('读得动含全角标点与裸控制字符的候选', () => {
    const candidate = '{"a":"甲"，"b":"第一行\n第二行"}'
    const fixed = repairJsonStructuralPunctuation(candidate, { closeFullWidthQuotes: true })
    expect(preservesStructuredJsonEvidence(candidate, fixed)).toBe(true)
  })

  it('改写标量事实仍被拒（放行逻辑不是后门）', () => {
    const candidate = '{"a":"甲"，"b":"乙"}'
    const tampered = '{"a":"甲","b":"丙"}'
    expect(preservesStructuredJsonEvidence(candidate, tampered)).toBe(false)
  })

  it('新增字段（超出"仅补闭合"的允许范围）被拒', () => {
    const candidate = '{"a":"甲"，"b":"乙"}'
    const extended = '{"a":"甲","b":"乙","c":"丁"}'
    expect(preservesStructuredJsonEvidence(candidate, extended)).toBe(false)
  })
})
