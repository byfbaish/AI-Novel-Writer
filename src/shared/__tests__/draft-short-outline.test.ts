import { describe, expect, it } from 'vitest'
import {
  draftShortOutlineBlock,
  draftShortOutlinePrompt,
  stripDraftShortOutlineBlock,
} from '../draft-short-outline'

/** 正文形态区块：任何一条出现在短细纲请求里都说明 P0-1 的载荷收缩被绕过。 */
const PROSE_SHAPE_BLOCKS = [
  '【全书设定池】',
  '【全局写作要求】',
  '【文风要求】',
  '【参考作品】',
  '【本章篇幅合同】',
  '【网文"黄金第一章"创作法则】',
  '【AI 味反制',
  '【作者资料（保留原文',
  '【后续计划边界',
]

describe('draftShortOutlinePrompt（P0-1 分区契约）', () => {
  const chapterInfo = '{"chapterNumber":2,"title":"读信","keyEvents":"读信；回信"}'
  const predecessor = '第一章定稿原文：信已送到门口。'
  const executionContract = '【本章执行合同】\n【作者本章任务】按作者原文含义遵循……'

  it('按「指令 → 本章蓝图 → 前驱状态 → 本章执行合同」固定块序装配', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, predecessor, executionContract })
    const order = ['只写短细纲，不写正文', '【本章蓝图】', '【前驱状态 · 上一章定稿原文】', '【本章执行合同】']
    const positions = order.map(marker => prompt.indexOf(marker))
    expect(positions.every(at => at >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    for (const body of [chapterInfo, predecessor, executionContract]) expect(prompt).toContain(body)
  })

  it.each(['zh-CN', 'en-US'] as const)('%s 下都不含任何正文形态区块（P0-1 的核心断言）', writingLanguage => {
    const prompt = draftShortOutlinePrompt(writingLanguage, { chapterInfo, predecessor, executionContract })
    for (const block of PROSE_SHAPE_BLOCKS) expect(prompt).not.toContain(block)
  })

  it('无前驱时整块省略（首章是正常态，不是错误）', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, executionContract })
    expect(prompt).not.toContain('【前驱状态 · 上一章定稿原文】')
    expect(prompt).toContain('【本章蓝图】')
    expect(prompt).toContain('【本章执行合同】')
  })

  it('无执行合同时整块省略', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo })
    expect(prompt).not.toContain('【本章执行合同】')
    // 空串与全空白都不得留下一个空标题块。
    expect(draftShortOutlinePrompt('zh-CN', { chapterInfo, predecessor: '   ' })).not.toContain('【前驱状态')
  })

  it('en-US 用英文标签，不混中文块头', () => {
    const prompt = draftShortOutlinePrompt('en-US', { chapterInfo, predecessor, executionContract })
    expect(prompt).toContain('[Current-chapter blueprint]')
    expect(prompt).toContain('[Predecessor state · finalized prose of the previous chapter]')
    expect(prompt).not.toContain('【本章蓝图】')
  })

  it('材料原文逐字透传，不做二次改写或摘要', () => {
    const prompt = draftShortOutlinePrompt('zh-CN', { chapterInfo, predecessor })
    expect(prompt).toContain(predecessor)
    expect(prompt.split(predecessor)).toHaveLength(2)
  })
})

describe('短细纲产出块的往返（既有行为回归）', () => {
  it('拼入正文后能被逐字剥离', () => {
    for (const language of ['zh-CN', 'en-US'] as const) {
      const base = '初始正文 prompt'
      const output = '计划：读信。'
      const composed = `${base}\n\n${draftShortOutlineBlock(language, output)}`
      expect(composed.startsWith(base)).toBe(true)
      expect(stripDraftShortOutlineBlock(composed, output)).toBe(base)
    }
  })

  it('空白产出抛错（沿用既有契约），非末尾块剥离返回 null', () => {
    expect(() => draftShortOutlineBlock('zh-CN', '  ')).toThrow('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
    expect(stripDraftShortOutlineBlock('别的正文', '计划')).toBeNull()
  })
})
