import { describe, expect, it } from 'vitest'
import { reviewFarTermSettingRule } from '../../shared/review-far-term-setting'

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
