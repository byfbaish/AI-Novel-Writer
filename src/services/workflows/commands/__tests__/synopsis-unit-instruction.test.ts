import { describe, expect, it } from 'vitest'
import { synopsisUnitInstruction } from '../architecture.command'

// E3 T5（e3-unit-batch-implementation-plan.md §3）：
// 逐单元批次的生成范围只给「单元 + 起点 + 离开状态」，**不给 from–to 区间**。
//
// 2026-10-20 P2：范围块**同时负责卷号** —— 章标题要写出「第V卷」，而系统此前只给
// `unitIndex`，模型根本没有卷号可写。章标题的**写法**不在这里，在 suffix 末尾追加的
// 格式段（`getSynopsisUnitHeadingSection`），每个约束只出现一次。
describe('synopsisUnitInstruction：逐单元批次', () => {
  it('中文：给卷号 + 单元 + 起点，不出现章号区间', () => {
    const text = synopsisUnitInstruction('zh-CN', 11, 2, 3, '定价', 60)
    expect(text).toContain('【第 2 卷第 3 单元：定价】')
    expect(text).toContain('从全书第 11 章开始')
    expect(text).toContain('离开状态')
    expect(text).toContain('不得进入下一个单元')
    expect(text).not.toMatch(/第\s*11\s*[–-]\s*\d+\s*章/u)
    expect(text).not.toContain('本次必须对第 11–')
  })

  it('英文：同口径', () => {
    const text = synopsisUnitInstruction('en-US', 11, 2, 3, 'Pricing', 60)
    expect(text).toContain('[volume 2, unit 3: Pricing]')
    expect(text).toContain('starting at book chapter 11')
    expect(text).toContain('exit state')
    expect(text).toContain('do NOT enter the next unit')
    expect(text).not.toMatch(/chapters 11-\d+/iu)
  })

  it('卷号与单元号各归各位，不串位', () => {
    const text = synopsisUnitInstruction('zh-CN', 22, 2, 1, '接管账房', 150)
    expect(text).toContain('第 2 卷第 1 单元')
    expect(text).not.toContain('第 1 卷第 2 单元')
  })

  it('单元名原样带入（不做裁剪/改写）', () => {
    const text = synopsisUnitInstruction('zh-CN', 1, 1, 1, '门牌与赊账页', 150)
    expect(text).toContain('【第 1 卷第 1 单元：门牌与赊账页】')
  })

  it('章标题**写法**不在这里给（避免与 suffix 里的格式段重复渲染）', () => {
    const text = synopsisUnitInstruction('zh-CN', 11, 2, 3, '定价', 60)
    expect(text).not.toContain('（全书第')
    expect(text).not.toContain('单元内序号')
  })

  // D18 §6：跨批交接项。同一批内模型刚写完还看得见；跨批时它排在长前缀末尾最容易丢，
  // 所以把上一单元末章的钩子行**原文**补进请求，并且要放在长前缀（outlineProjection）之前。
  it('有交接项时：中文带上原文，并点明第一章必须回应', () => {
    const handoff = '钩子：悬念截断 — 刀停在半空｜种在：赵铎的尸骨'
    const text = synopsisUnitInstruction('zh-CN', 31, 2, 1, '药渣', 120, handoff)
    expect(text).toContain('【上一单元交接项】')
    expect(text).toContain(handoff)
    expect(text).toContain('第一章')
    expect(text).toContain('必须回应')
  })

  it('有交接项时：英文同口径', () => {
    const text = synopsisUnitInstruction('en-US', 31, 2, 1, 'Dregs', 120, 'Hook: cut-off suspense — the blade stops mid-air')
    expect(text).toContain('[Handoff from the previous unit]')
    expect(text).toContain('the blade stops mid-air')
    expect(text).toContain('first chapter')
  })

  it('没有交接项时：整段不出现（首个单元 / 中断后无已完成文本，都不该留一个空壳标题）', () => {
    expect(synopsisUnitInstruction('zh-CN', 1, 1, 1, '开篇', 60)).not.toContain('上一单元交接项')
    expect(synopsisUnitInstruction('zh-CN', 1, 1, 1, '开篇', 60, null)).not.toContain('上一单元交接项')
    expect(synopsisUnitInstruction('zh-CN', 1, 1, 1, '开篇', 60, '')).not.toContain('上一单元交接项')
    expect(synopsisUnitInstruction('en-US', 1, 1, 1, 'Opening', 60)).not.toContain('Handoff from the previous unit')
  })
})
