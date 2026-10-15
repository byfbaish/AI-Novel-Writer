import { describe, expect, it } from 'vitest'
import { refinementFarTermSettingRule, reviewFarTermSettingRule } from '../../shared/review-far-term-setting'

describe('reviewFarTermSettingRule（C1 路子 B）', () => {
  it('中文声明同时含「用途限定」与「不得报缺失/不得要求兑现」两类硬约束', () => {
    const zh = reviewFarTermSettingRule('zh-CN')
    expect(zh).toContain('【远期设定使用规则】')
    expect(zh).toContain('长期谜团、终局真相或后文才展开的设定')
    expect(zh).toContain('只用于判断正文是否过早泄露、误解或误用远期真相')
    expect(zh).toContain('不得因正文未写出这些内容而报缺失')
    expect(zh).toContain('也不得要求正文提前兑现这些结论')
    // 正向指引：仍须与同时段设定比对（不能读成「世界观不用管」）。
    expect(zh).toContain('与正文同时段的规则、空间与人物设定')
  })

  it('英文声明与中文同构', () => {
    const en = reviewFarTermSettingRule('en-US')
    expect(en).toContain('[Rule for far-term settings]')
    expect(en).toContain('long-term mysteries, endgame truths, or later-stage developments')
    expect(en).toContain('not established facts of this chapter')
    expect(en).toContain('Do not report a missing item merely because the draft omits them')
    expect(en).toContain('do not demand that the draft pay them off in advance')
    expect(en).toContain('rules, spaces and character settings that apply at the same time')
  })

  it('是纯函数：同语言重复调用逐字相同（可作哈希基线）', () => {
    expect(reviewFarTermSettingRule('zh-CN')).toBe(reviewFarTermSettingRule('zh-CN'))
    expect(reviewFarTermSettingRule('en-US')).toBe(reviewFarTermSettingRule('en-US'))
  })
})

describe('refinementFarTermSettingRule（修稿链 · 2026-10-16 追加）', () => {
  it('中文声明：执行侧语义（不得据其要求修稿后的正文兑现）+ 保留作者明确要求余地', () => {
    const zh = refinementFarTermSettingRule('zh-CN')
    expect(zh).toContain('【远期设定使用规则】')
    expect(zh).toContain('长期谜团、终局真相或后文才展开的设定')
    // 执行侧：不是「不得报缺失」（那是审稿的职责），而是「不得要求正文兑现」。
    expect(zh).toContain('不得据其要求修稿后的正文提前写出结论、兑现远期结果或补齐尚未揭示的真相')
    // 依据仍须与同时段设定比对；且作者明确要求优先。
    expect(zh).toContain('与正文同时段的规则、空间与人物设定')
    expect(zh).toContain('作者明确提出的修改要求本身')
  })

  it('英文声明与中文同构', () => {
    const en = refinementFarTermSettingRule('en-US')
    expect(en).toContain('[Rule for far-term settings]')
    expect(en).toContain('not established facts of this chapter')
    expect(en).toContain('do not use them to require the revised manuscript to state those conclusions early')
    expect(en).toContain("the author's explicit revision requests themselves")
  })

  it('★ 与审稿版语义不同：审稿版是判断侧（不得报缺失），修稿版是执行侧（不得要求兑现）', () => {
    const review = reviewFarTermSettingRule('zh-CN')
    const refinement = refinementFarTermSettingRule('zh-CN')
    expect(review).toContain('不得因正文未写出这些内容而报缺失')
    expect(refinement).not.toContain('不得因正文未写出这些内容而报缺失')
    expect(refinement).toContain('不得据其要求修稿后的正文提前写出结论')
    // 两版不得混用（防止未来有人误把审稿版注入修稿链）。
    expect(review).not.toBe(refinement)
  })

  it('是纯函数：同语言重复调用逐字相同', () => {
    expect(refinementFarTermSettingRule('zh-CN')).toBe(refinementFarTermSettingRule('zh-CN'))
    expect(refinementFarTermSettingRule('en-US')).toBe(refinementFarTermSettingRule('en-US'))
  })
})
