import { describe, expect, it } from 'vitest'
import {
  GOLDEN_TRAITS,
  goldenTraitCatalogMarkdown,
  goldenTraitOf,
  type GoldenTraitValue,
} from '../golden-traits'

/** Schwartz 十项基本价值（2012，44 国 25000 人）—— 底线清单的参照系，不是自造概念。 */
const SCHWARTZ_VALUES: readonly GoldenTraitValue[] = [
  '自主',
  '刺激',
  '享乐',
  '成就',
  '权力',
  '安全',
  '顺从',
  '传统',
  '仁善',
  '普世',
]

describe('golden traits', () => {
  // V6（作者 2026-10-29 裁定）：普世、仁善排在前两位的角色是圣母不是人，读者讨厌。
  // 这两项恰恰是模型最容易自作主张顶上去的 —— 训练语料里它们就是"正确"答案。
  // 期 4 落地时只做了人工核对，没有测试兜底，这条把判据钉成机检。
  it('never ranks benevolence or universalism in the top two', () => {
    for (const trait of GOLDEN_TRAITS) {
      expect(trait.values.length, trait.id).toBeGreaterThanOrEqual(3)
      expect(trait.values.length, trait.id).toBeLessThanOrEqual(5)
      expect(['仁善', '普世'], trait.id).not.toContain(trait.values[0])
      expect(['仁善', '普世'], trait.id).not.toContain(trait.values[1])
    }
  })

  it('only uses the ten Schwartz values', () => {
    for (const trait of GOLDEN_TRAITS) {
      for (const value of trait.values) {
        expect(SCHWARTZ_VALUES, `${trait.id}:${value}`).toContain(value)
      }
    }
  })

  it('keeps the anchor hint concrete and the price non-empty', () => {
    for (const trait of GOLDEN_TRAITS) {
      for (const field of [trait.anchorHint, trait.price, trait.daily, trait.costed, trait.exception]) {
        expect(field.trim().length, trait.id).toBeGreaterThan(0)
      }
      // 锚点必须是"他交出去的"，不是"他守住的"
      expect(trait.anchorHint, trait.id).not.toMatch(/^尊严$|^信念$|^面子$/)
    }
  })

  // 2026-10-29 夜：角色卡已由「三档压力」改为四层。词条库是**素材**，不是三档卡。
  // catalog 里留着〔日常〕/〔代价〕/〔破例〕会让作者以为还是三档 ——
  // 而按处境分档的实测后果是 20 章里 10 章「无」，且 D1 成了引力中心。
  it('presents itself as raw material for the four layers, not a three-tier card', () => {
    const zh = goldenTraitCatalogMarkdown('zh-CN')
    const en = goldenTraitCatalogMarkdown('en-US')

    for (const gone of ['〔日常〕', '〔代价〕', '〔破例〕']) {
      expect(zh, gone).not.toContain(gone)
    }
    for (const gone of ['[Daily]', '[Costed]', '[Exception]']) {
      expect(en, gone).not.toContain(gone)
    }

    // 三个素材各自落进哪一层，必须写出来，否则读者无从理解映射
    expect(zh).toContain('第三层')
    expect(zh).toContain('第四层')
    expect(en).toContain('layer 3')
    expect(en).toContain('layer 4')
  })

  it('exposes every trait by id', () => {
    for (const trait of GOLDEN_TRAITS) {
      expect(goldenTraitOf(trait.id)).toBe(trait)
    }
  })
})
