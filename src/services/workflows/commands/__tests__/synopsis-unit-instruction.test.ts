import { describe, expect, it } from 'vitest'
import { synopsisUnitInstruction } from '../architecture.command'

// E3 T5（e3-unit-batch-implementation-plan.md §3）：
// 逐单元批次的生成范围只给「单元 + 起点 + 离开状态」，**不给 from–to 区间**。
describe('synopsisUnitInstruction：逐单元批次', () => {
  it('中文：只给单元与起点，不出现章号区间', () => {
    const text = synopsisUnitInstruction('zh-CN', 11, 2, '定价', 60)
    expect(text).toContain('【单元 2：定价】')
    expect(text).toContain('从第 11 章开始')
    expect(text).toContain('离开状态')
    expect(text).toContain('不得进入下一个单元')
    expect(text).not.toMatch(/第\s*11\s*[–-]\s*\d+\s*章/u)
    expect(text).not.toContain('本次必须对第 11–')
  })

  it('英文：同口径', () => {
    const text = synopsisUnitInstruction('en-US', 11, 2, 'Pricing', 60)
    expect(text).toContain('[Unit 2: Pricing]')
    expect(text).toContain('starting at chapter 11')
    expect(text).toContain('exit state')
    expect(text).toContain('do NOT enter the next unit')
    expect(text).not.toMatch(/chapters 11-\d+/iu)
  })

  it('单元名原样带入（不做裁剪/改写）', () => {
    const text = synopsisUnitInstruction('zh-CN', 1, 1, '门牌与赊账页', 150)
    expect(text).toContain('【单元 1：门牌与赊账页】')
  })
})
