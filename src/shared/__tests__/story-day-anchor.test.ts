import { describe, expect, it } from 'vitest'
import {
  formatStoryDayAnchorLine,
  formatStoryDayAnchorLines,
  parseStoryDayAnchor,
  storyDayRegression,
} from '../story-day-anchor'

const notes = (section: string) => `# 第4章 要点

${section}

## 剧情节点
- [触发] 顾长风数到 27 枚灵石，与日序无关。
`

describe('parseStoryDayAnchor', () => {
  it('解析标准栏目：整数 + 书中写法', () => {
    expect(parseStoryDayAnchor(notes('## 时间定位\n- 故事日：7\n- 书中写法：二月廿七\n- 依据：正文「昨儿夜里」'))).toEqual({
      offset: 7,
      label: '二月廿七',
    })
  })

  it('接受「第7日」包装与行尾标点', () => {
    expect(parseStoryDayAnchor(notes('## 时间定位\n- 故事日：第 7 日；\n'))?.offset).toBe(7)
  })

  it('写「未定」时返回 null（缺失不是 0）', () => {
    expect(parseStoryDayAnchor(notes('## 时间定位\n- 故事日：未定\n- 书中写法：未定'))).toBeNull()
  })

  it('不把日期里的月日误当成日序（2月27日 不得抓成 2）', () => {
    expect(parseStoryDayAnchor(notes('## 时间定位\n- 故事日：2月27日\n'))).toBeNull()
  })

  it('栏目缺失时返回 null，且不跨栏目抓数字', () => {
    expect(parseStoryDayAnchor(notes('## 剧情节点\n- [触发] 故事日：7 出现在别处'))).toBeNull()
    expect(parseStoryDayAnchor('# 第4章 要点\n\n## 剧情节点\n- 数到 27 枚灵石')).toBeNull()
  })

  it('英文栏目同样可解析', () => {
    expect(parseStoryDayAnchor(notes('## Time anchor\n- Story day: 7\n- In-world label: the 27th of the second month')))
      .toEqual({ offset: 7, label: 'the 27th of the second month' })
  })

  it('负数与空内容返回 null', () => {
    expect(parseStoryDayAnchor(notes('## 时间定位\n- 故事日：-1'))).toBeNull()
    expect(parseStoryDayAnchor('')).toBeNull()
  })

  it('栏目到下一个标题即结束，不吞下一节的整数', () => {
    const text = '## 时间定位\n- 书中写法：二月廿七\n\n## 剧情节点\n- 故事日：9\n'
    expect(parseStoryDayAnchor(text)).toBeNull()
  })
})

describe('formatStoryDayAnchorLine', () => {
  it('给最近一章的日序，并写明不得早于该日', () => {
    const line = formatStoryDayAnchorLine(
      [{ chapterNumber: 3, storyDayOffset: 6, storyDayLabel: '二月廿六' }],
      { writingLanguage: 'zh-CN', currentChapter: 4 },
    )
    expect(line).toContain('第3章')
    expect(line).toContain('第6日')
    expect(line).toContain('二月廿六')
    expect(line).toContain('不得早于第6日')
  })

  it('最近一章缺日序时明说缺失，不退回更早的章', () => {
    const line = formatStoryDayAnchorLine(
      [
        { chapterNumber: 2, storyDayOffset: 3, storyDayLabel: '二月廿三' },
        { chapterNumber: 3, storyDayOffset: null, storyDayLabel: null },
      ],
      { writingLanguage: 'zh-CN', currentChapter: 4 },
    )
    expect(line).toContain('第3章')
    expect(line).toContain('缺失')
    expect(line).not.toContain('第3日')
  })

  it('没有任何前章时返回空串', () => {
    expect(formatStoryDayAnchorLine([], { writingLanguage: 'zh-CN', currentChapter: 1 })).toBe('')
  })
})

describe('formatStoryDayAnchorLines', () => {
  it('逐章列出，缺失行标缺失而不是 0', () => {
    const block = formatStoryDayAnchorLines(
      [
        { chapterNumber: 1, storyDayOffset: 0, storyDayLabel: '二月二十' },
        { chapterNumber: 2, storyDayOffset: null, storyDayLabel: null },
      ],
      { writingLanguage: 'zh-CN', currentChapter: 3 },
    )
    expect(block).toContain('第1章：第0日（二月二十）')
    expect(block).toContain('第2章：（缺失')
    expect(block).toContain('不是 0')
  })

  it('晚于当前章的锚不注入（防剧透）', () => {
    const block = formatStoryDayAnchorLines(
      [
        { chapterNumber: 1, storyDayOffset: 0, storyDayLabel: '' },
        { chapterNumber: 9, storyDayOffset: 40, storyDayLabel: '' },
      ],
      { writingLanguage: 'zh-CN', currentChapter: 2 },
    )
    expect(block).toContain('第1章')
    expect(block).not.toContain('第9章')
  })
})

describe('storyDayRegression', () => {
  it('倒退时报出两章数值', () => {
    expect(storyDayRegression(
      { chapterNumber: 3, storyDayOffset: 6 },
      { chapterNumber: 4, storyDayOffset: 5 },
    )).toEqual({ previousChapter: 3, previousOffset: 6, currentOffset: 5 })
  })

  it('持平与前进都放行', () => {
    expect(storyDayRegression({ chapterNumber: 3, storyDayOffset: 6 }, { chapterNumber: 4, storyDayOffset: 6 })).toBeUndefined()
    expect(storyDayRegression({ chapterNumber: 3, storyDayOffset: 6 }, { chapterNumber: 4, storyDayOffset: 9 })).toBeUndefined()
  })

  it('任一侧缺失时不判倒退', () => {
    expect(storyDayRegression({ chapterNumber: 3, storyDayOffset: null }, { chapterNumber: 4, storyDayOffset: 1 })).toBeUndefined()
    expect(storyDayRegression(undefined, { chapterNumber: 4, storyDayOffset: 1 })).toBeUndefined()
  })
})
