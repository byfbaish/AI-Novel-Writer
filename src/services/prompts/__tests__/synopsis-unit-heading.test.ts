import { describe, expect, it } from 'vitest'
import {
  formatAttributedChapterHeading,
  getSynopsisUnitHeadingSection,
} from '../synopsis-unit-heading'

// P2（chapter-position-format-design.md §4.1）：单元模式的章标题带出「卷/单元/章/全书章号」，
// 让 `outline-tree` 拿到归属**真值**（heading source），不再只能按章数等分折算。
describe('getSynopsisUnitHeadingSection：单元批次章标题格式', () => {
  const position = { volumeIndex: 2, unitIndex: 1, from: 22 }

  it('中文：给本批前两章的完整标题行（示例即形态）', () => {
    const text = getSynopsisUnitHeadingSection('zh-CN', position)
    expect(text).toContain('## 第2卷第1单元第1章（全书第22章）：章名')
    expect(text).toContain('## 第2卷第1单元第2章（全书第23章）：章名')
  })

  it('中文：声明覆盖上文写法，并禁止省掉位置', () => {
    const text = getSynopsisUnitHeadingSection('zh-CN', position)
    expect(text).toContain('取代上文任何与之不同的写法')
    expect(text).toContain('## 第22章：章名')
    expect(text).toMatch(/格式错误/u)
  })

  it('中文：位置在冒号前，章名在冒号后', () => {
    const text = getSynopsisUnitHeadingSection('zh-CN', position)
    expect(text).toContain('冒号之前是位置，冒号之后只写章名')
  })

  it('英文：同样的两行示例与覆盖声明', () => {
    const text = getSynopsisUnitHeadingSection('en-US', position)
    expect(text).toContain('## Vol 2 Unit 1 Ch 1 (Book Ch 22): Title')
    expect(text).toContain('## Vol 2 Unit 1 Ch 2 (Book Ch 23): Title')
    expect(text).toContain('overrides any different wording above')
  })
})

describe('formatAttributedChapterHeading', () => {
  it('全书章号由起点 + 单元内序号推出', () => {
    const position = { volumeIndex: 2, unitIndex: 1, from: 22 }
    expect(formatAttributedChapterHeading(position, 1, 'zh-CN'))
      .toBe('## 第2卷第1单元第1章（全书第22章）：章名')
    expect(formatAttributedChapterHeading(position, 4, 'zh-CN'))
      .toBe('## 第2卷第1单元第4章（全书第25章）：章名')
  })

  it('英文版', () => {
    const position = { volumeIndex: 3, unitIndex: 2, from: 45 }
    expect(formatAttributedChapterHeading(position, 3, 'en-US'))
      .toBe('## Vol 3 Unit 2 Ch 3 (Book Ch 47): Title')
  })

  it('渲染出来的行能被共享解析器认回来（生成与解析同口径）', async () => {
    const { parseOutlineChapterHeading } = await import('../../../shared/chapter-heading')
    const position = { volumeIndex: 3, unitIndex: 2, from: 43 }
    const line = formatAttributedChapterHeading(position, 3, 'zh-CN', '牌位')
    expect(parseOutlineChapterHeading(line)).toMatchObject({
      chapter: 45,
      volumeIndex: 3,
      unitIndex: 2,
      chapterInParent: 3,
      attributed: true,
      rest: '牌位',
    })
  })
})
