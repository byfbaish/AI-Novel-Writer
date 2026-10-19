import { describe, expect, it } from 'vitest'
import {
  OUTLINE_RECENT_CHAPTERS,
  VOLUME_HANDOFF_CHARS,
  estimateOutlinePrefix,
  planOutlinePrefixBudget,
  renderOutlinePrefixBudget,
} from '../outline-prefix-budget'

// 设计稿 volume-quota-context-budget-design.md §3.3 / §5.2 / §10（E4c）
// 真实项目实测：150 章 / 7 卷 28 单元 / 591 字每章。
const ARC = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '### 单元二：定价',
  '',
  '## 卷二：销档',
  '### 单元一：配合',
].join('\n')

const ARC4 = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '## 卷二：销档',
  '### 单元一：配合',
  '## 卷三：立卷',
  '### 单元一：取证',
  '## 卷四：摊牌',
  '### 单元一：设局',
].join('\n')

const prefixOf = (chapters: number, charsPerChapter = 600) =>
  Array.from({ length: chapters }, (_, i) => `## 第${i + 1}章：标题\n` + '正'.repeat(charsPerChapter - 8)).join('\n\n')

describe('estimateOutlinePrefix：前缀体积', () => {
  it('第一卷内：投影后 = 本卷全文，省不下多少（正确行为，不是 bug）', () => {
    const estimate = estimateOutlinePrefix({
      prefix: prefixOf(10),
      charsPerChapter: 600,
      arcPlan: ARC,
      totalChapters: 60,
      from: 11,
    })!
    expect(estimate.writtenChapters).toBe(10)
    expect(estimate.fullPrefixChars).toBeGreaterThan(5000)
    expect(estimate.volumeWritten).toBe(10) // 卷一是第 1–30 章，本批从 11 起 ⇒ 卷内已写 10
    // 全部已写内容都在本卷内 ⇒ 投影只能保住它们，省不下；第一卷也没有上一卷交接单。
    expect(estimate.projectedChars).toBe(estimate.volumeWritten! * 600)
    expect(estimate.savedRatio).toBeLessThan(0.05)
  })

  it('跨卷之后：投影后远小于整段（这才是投影要解决的情况）', () => {
    // 写到第 4 卷中段（本批从第 100 章起，卷四是第 91–120 章）⇒ 卷内已写 9 章
    const estimate = estimateOutlinePrefix({
      prefix: prefixOf(99),
      charsPerChapter: 600,
      arcPlan: ARC4,
      totalChapters: 120,
      from: 100,
    })!
    expect(estimate.volumeWritten).toBe(9)
    expect(estimate.fullPrefixChars).toBeGreaterThan(50_000)
    expect(estimate.projectedChars).toBe(9 * 600 + VOLUME_HANDOFF_CHARS)
    expect(estimate.savedRatio).toBeGreaterThan(0.8)
  })

  it('token 区间下界 < 上界，且按 1–1.5 字/token 折算', () => {
    const estimate = estimateOutlinePrefix({ prefix: prefixOf(10), charsPerChapter: 600 })!
    const [low, high] = estimate.fullTokens
    expect(low).toBeLessThan(high)
    expect(low).toBe(Math.ceil(estimate.fullPrefixChars / 1.5))
    expect(high).toBe(Math.ceil(estimate.fullPrefixChars / 1))
  })

  it('弧光不可解析时 volumeWritten 为 null，仍能估算', () => {
    const estimate = estimateOutlinePrefix({ prefix: prefixOf(10), charsPerChapter: 600 })!
    expect(estimate.volumeWritten).toBeNull()
    expect(estimate.projectedChars).toBeGreaterThan(0)
  })

  it('设定层字数计入投影后的体积', () => {
    const base = estimateOutlinePrefix({ prefix: prefixOf(10), charsPerChapter: 600 })!
    const withSetting = estimateOutlinePrefix({ prefix: prefixOf(10), charsPerChapter: 600, settingChars: 2000 })!
    expect(withSetting.projectedChars).toBe(base.projectedChars + 2000)
  })

  it('空前缀返回 null', () => {
    expect(estimateOutlinePrefix({ prefix: '' })).toBeNull()
    expect(estimateOutlinePrefix({ prefix: '   \n\t ' })).toBeNull()
  })

  it('每章字数算不出时返回 null（fail-open）', () => {
    expect(estimateOutlinePrefix({ prefix: prefixOf(5) })).toBeNull()
    expect(estimateOutlinePrefix({ prefix: prefixOf(5), charsPerChapter: 0 })).toBeNull()
    expect(estimateOutlinePrefix({ prefix: prefixOf(5), charsPerChapter: Number.NaN })).toBeNull()
  })

  it('fallbackCharsPerChapter 可作为缺省', () => {
    const estimate = estimateOutlinePrefix({ prefix: prefixOf(10), fallbackCharsPerChapter: 600 })!
    expect(estimate.writtenChapters).toBe(10)
  })
})

describe('planOutlinePrefixBudget：还能写几章', () => {
  it('跨卷之后：投影后还能写的章数显著多于整段', () => {
    const budget = planOutlinePrefixBudget({
      prefix: prefixOf(99),
      charsPerChapter: 600,
      arcPlan: ARC4,
      totalChapters: 120,
      from: 100,
      availableChars: 200_000,
    })!
    expect(budget.chaptersLeftFull).toBeGreaterThan(0)
    expect(budget.chaptersLeftProjected).toBeGreaterThan(budget.chaptersLeftFull!)
  })

  it('第一卷内：两个数相同（投影省不下，符合预期）', () => {
    const budget = planOutlinePrefixBudget({
      prefix: prefixOf(10),
      charsPerChapter: 600,
      arcPlan: ARC,
      totalChapters: 60,
      from: 11,
      availableChars: 200_000,
    })!
    expect(budget.chaptersLeftProjected).toBe(budget.chaptersLeftFull)
  })

  it('不给可用输入时两个数都是 null', () => {
    const budget = planOutlinePrefixBudget({ prefix: prefixOf(10), charsPerChapter: 600 })!
    expect(budget.chaptersLeftFull).toBeNull()
    expect(budget.chaptersLeftProjected).toBeNull()
  })

  it('前缀已超可用输入时给出 ≤0（写不动了）', () => {
    const budget = planOutlinePrefixBudget({
      prefix: prefixOf(10),
      charsPerChapter: 600,
      availableChars: 1000,
    })!
    expect(budget.chaptersLeftFull!).toBeLessThanOrEqual(0)
  })
})

describe('renderOutlinePrefixBudget：日志行', () => {
  it('中文含「只读」与三行读数', () => {
    const budget = planOutlinePrefixBudget({ prefix: prefixOf(10), charsPerChapter: 600, availableChars: 200_000 })!
    const zh = renderOutlinePrefixBudget(budget, 'zh-CN')!
    expect(zh).toContain('只读');
    expect(zh).toContain('整段前缀');
    expect(zh).toContain('投影后');
  })

  it('英文同口径', () => {
    const budget = planOutlinePrefixBudget({ prefix: prefixOf(10), charsPerChapter: 600 })!
    expect(renderOutlinePrefixBudget(budget, 'en-US')).toContain('read-only');
  })

  it('null 输入返回 null', () => {
    expect(renderOutlinePrefixBudget(null, 'zh-CN')).toBeNull()
  })
})

describe('常量：与设计稿一致', () => {
  it('最近 3 章 / 交接单 1500 字', () => {
    expect(OUTLINE_RECENT_CHAPTERS).toBe(3)
    expect(VOLUME_HANDOFF_CHARS).toBe(1500)
  })
})
