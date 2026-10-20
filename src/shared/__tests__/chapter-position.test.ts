import { describe, expect, it } from 'vitest'
import { formatChapterPosition } from '../chapter-position'

// 位置写法统一为「第3卷第2单元第3章（全书第45章）」。
// 降级必须逐级退化、且**绝不瞎补** —— 缺单元层就不能编出一个「第 1 单元」。
describe('formatChapterPosition', () => {
  it('三层：卷 / 单元 / 单元内章 / 全书章', () => {
    expect(formatChapterPosition({ chapter: 45, volumeIndex: 3, unitIndex: 2, chapterInParent: 3 }, 'zh-CN'))
      .toBe('第3卷第2单元第3章（全书第45章）')
  })

  it('chapterInParent 省略即 1（绝大多数调用点表达的是「本批起点」）', () => {
    expect(formatChapterPosition({ chapter: 6, volumeIndex: 1, unitIndex: 2 }, 'zh-CN'))
      .toBe('第1卷第2单元第1章（全书第6章）')
  })

  it('两级结构（无单元层）：第V卷第C章', () => {
    expect(formatChapterPosition({ chapter: 45, volumeIndex: 3, unitIndex: null, chapterInParent: 3 }, 'zh-CN'))
      .toBe('第3卷第3章（全书第45章）')
  })

  it('没有卷结构：退回纯章号', () => {
    expect(formatChapterPosition({ chapter: 45 }, 'zh-CN')).toBe('第45章')
    expect(formatChapterPosition({ chapter: 45, volumeIndex: null, unitIndex: 2 }, 'zh-CN')).toBe('第45章')
  })

  it('只有单元没有卷：也退回纯章号（不编卷号）', () => {
    expect(formatChapterPosition({ chapter: 45, unitIndex: 2 }, 'zh-CN')).toBe('第45章')
  })

  it('英文', () => {
    expect(formatChapterPosition({ chapter: 45, volumeIndex: 3, unitIndex: 2, chapterInParent: 3 }, 'en-US'))
      .toBe('Vol 3 Unit 2 Ch 3 (Book Ch 45)')
    expect(formatChapterPosition({ chapter: 45, volumeIndex: 3, chapterInParent: 3 }, 'en-US'))
      .toBe('Vol 3 Ch 3 (Book Ch 45)')
    expect(formatChapterPosition({ chapter: 45 }, 'en-US')).toBe('Chapter 45')
  })

  it('非法输入不产出半截文案', () => {
    expect(formatChapterPosition({ chapter: Number.NaN }, 'zh-CN')).toBe('第 ? 章')
    expect(formatChapterPosition({ chapter: 0 }, 'en-US')).toBe('chapter ?')
    expect(formatChapterPosition({ chapter: 45, volumeIndex: 0, unitIndex: -1 }, 'zh-CN')).toBe('第45章')
  })
})
