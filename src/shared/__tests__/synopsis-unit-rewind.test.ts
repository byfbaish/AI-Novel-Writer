import { describe, expect, it } from 'vitest'

import { removeOutlineChapterEntries } from '../synopsis-unit-rewind'

describe('removeOutlineChapterEntries', () => {
  it('删中间单元：前后单元与设定层都留着', () => {
    const text = [
      '# 情节大纲',
      '',
      '## 第1卷第1单元第1章（全书第1章）：溃烂与空罐',
      '选择：认',
      '收尾：未决。',
      '',
      '## 第1卷第1单元第2章（全书第2章）：药渣堆的影',
      '选择：躲',
      '',
      '## 第1卷第2单元第1章（全书第3章）：石隙边',
      '选择：认',
    ].join('\n')
    const result = removeOutlineChapterEntries(text, { from: 1, to: 2 })
    expect(result.removed).toEqual([1, 2])
    expect(result.text).toContain('# 情节大纲')
    expect(result.text).toContain('## 第1卷第2单元第1章（全书第3章）：石隙边')
    expect(result.text).not.toContain('全书第1章')
    expect(result.text).not.toContain('全书第2章')
  })

  it('删最后一个单元：尾部更新提示行一起清掉（渲染时会重新生成）', () => {
    const text = [
      '# 情节大纲',
      '',
      '## 第1章：甲',
      '正文甲。',
      '',
      '## 第2章：乙',
      '正文乙。',
      '',
      '> 本大纲已覆盖至第 2 章（全书 150 章），其余章节将在后续批次继续生成。',
    ].join('\n')
    const result = removeOutlineChapterEntries(text, { from: 2, to: 2 })
    expect(result.removed).toEqual([2])
    expect(result.text).toBe('# 情节大纲\n\n## 第1章：甲\n正文甲。')
  })

  it('删唯一单元：只剩设定层', () => {
    const text = '# 情节大纲\n\n## 第1章：甲\n正文。\n'
    expect(removeOutlineChapterEntries(text, { from: 1, to: 6 }).text).toBe('# 情节大纲')
  })

  it('章组与目标区间有交集 ⇒ 整块删（不拆半块）', () => {
    const text = '## 第1–3章：组\n正文。\n\n## 第4章：丁\n正文。'
    const result = removeOutlineChapterEntries(text, { from: 2, to: 3 })
    expect(result.removed).toEqual([1])
    expect(result.text).toBe('## 第4章：丁\n正文。')
  })

  it('区间外的章条目原样保留，不改动内部排版', () => {
    const text = '## 第5章：甲\n\n正文一\n\n正文二\n\n## 第6章：乙\n正文三'
    expect(removeOutlineChapterEntries(text, { from: 9, to: 12 })).toEqual({ text, removed: [], removedChars: 0 })
  })

  it('空正文 / 无章条目 ⇒ 不炸、全保留', () => {
    expect(removeOutlineChapterEntries('', { from: 1, to: 6 })).toEqual({ text: '', removed: [], removedChars: 0 })
    const settingsOnly = '世界观：某地\n前提：某人'
    expect(removeOutlineChapterEntries(settingsOnly, { from: 1, to: 6 }).text).toBe(settingsOnly)
  })

  it('旧格式与带空格章号一并认（删得干净，不留半章）', () => {
    const text = '## 第 1 章：甲\n正文。\n\n## 第2章：乙\n正文。'
    expect(removeOutlineChapterEntries(text, { from: 1, to: 2 }).removed).toEqual([1, 2])
  })
})
