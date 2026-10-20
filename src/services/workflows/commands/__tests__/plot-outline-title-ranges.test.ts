import { describe, expect, it } from 'vitest'

import { findPlotOutlineTitleRanges } from '../architecture.command'
import { parseOutlineChapterHeading } from '../../../../shared/chapter-heading'
import { validPlotOutlineEntry } from '../../../../shared/plot-outline-contract'

/**
 * 2026-10-20 实机回归：单元批次改用「第N卷第N单元第N章（全书第N章）」之后，
 * `findPlotOutlineTitleRanges` 里那份**自己写的**正则认不出新格式，于是
 *
 * - 前半段（新格式 1–3 章）一条都抽不到；
 * - 后半段（自动续写漂回旧格式 4–6 章）抽得到；
 * - `assertPlotOutlineTitleCoverage(merged, '', 1, 6)` 判「缺失 3 章、乱序 1 处」，
 *   模型明明写完 6 章却整批不入库。
 *
 * 修法：抽标题统一走 `parseOutlineChapterHeading`，宽容度用本调用方原有那套。
 */
describe('findPlotOutlineTitleRanges', () => {
  const rangeText = (text: string) => findPlotOutlineTitleRanges(text).map(r => [r.from, r.to])

  it('认得三层归属标题，章号取「全书第N章」', () => {
    expect(rangeText('## 第1卷第1单元第3章（全书第45章）：溃烂与空罐')).toEqual([[45, 45]])
  })

  it('认得两级归属标题（无单元层）', () => {
    expect(rangeText('## 第3卷第3章（全书第45章）：溃烂与空罐')).toEqual([[45, 45]])
  })

  it('新旧格式混排时按全书章号连成一条（现场那批：前 3 章新格式、后 3 章旧格式）', () => {
    const merged = [
      '## 第1卷第1单元第1章（全书第1章）：溃烂与空罐',
      '正文一',
      '## 第1卷第1单元第2章（全书第2章）：药渣堆的影',
      '正文二',
      '## 第1卷第1单元第3章（全书第3章）：回魂草与堵门',
      '正文三',
      '## 第4章：药渣堆里的气息',
      '正文四',
      '## 第5章：渣坡深处的咳声',
      '正文五',
      '## 第6章：后山石阶下的剑痕',
      '正文六',
    ].join('\n')
    expect(rangeText(merged)).toEqual([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]])
  })

  it('旧格式的宽容度一点没丢', () => {
    // 章号两侧空格（2026-10-20 整批写成「第 1 章」那次）
    expect(rangeText('## 第 5 章：名')).toEqual([[5, 5]])
    // 中文数字
    expect(rangeText('## 第五章：名')).toEqual([[5, 5]])
    // 章组
    expect(rangeText('## 第12–15章：名')).toEqual([[12, 15]])
    // bullet 前缀
    expect(rangeText('- 第7章：名')).toEqual([[7, 7]])
    // 英文
    expect(rangeText('Chapter 9: Name')).toEqual([[9, 9]])
    expect(rangeText('Chapters 9-12: Name')).toEqual([[9, 12]])
    // 无分隔符、整行只有标题
    expect(rangeText('## 第8章')).toEqual([[8, 8]])
  })

  it('仍然拒掉的几种（与旧实现逐条一致）', () => {
    // `#` 后没有空白：`plot-outline-contract` 不认，这里也不认
    expect(rangeText('##第5章：名')).toEqual([])
    // 章号后接「到」：正文里的表述，不是标题
    expect(rangeText('第1章到第5章')).toEqual([])
    // 正文行里提到章号不算（锚在行首）
    expect(rangeText('他翻到第 7 章：那里写着别的')).toEqual([])
    // 没有归属、也没有「（全书第N章）」的半截写法：不猜
    expect(parseOutlineChapterHeading('## 第1卷第1单元第1章：名')).toBeNull()
  })
})

describe('validPlotOutlineEntry 与 headings 同一把尺子', () => {
  it('归属标题是合法条目', () => {
    expect(validPlotOutlineEntry('## 第1卷第1单元第1章（全书第1章）：溃烂与空罐\n\n正文。', 1)).toBe(true)
    expect(validPlotOutlineEntry('## 第3卷第3章（全书第45章）：溃烂与空罐\n\n正文。', 45)).toBe(true)
  })

  it('章号对不上就不合法（改成全书章号之后要对全书章号）', () => {
    expect(validPlotOutlineEntry('## 第1卷第1单元第1章（全书第45章）：名\n\n正文。', 1)).toBe(false)
  })

  it('原本更严的那几条保留：必须 ##、必须有冒号、章名不能空', () => {
    // 三级标题
    expect(validPlotOutlineEntry('### 第1章：名\n\n正文。', 1)).toBe(false)
    // 无冒号
    expect(validPlotOutlineEntry('## 第1章 名\n\n正文。', 1)).toBe(false)
    // 章名空
    expect(validPlotOutlineEntry('## 第1章：\n\n正文。', 1)).toBe(false)
    // 旧格式照旧合法
    expect(validPlotOutlineEntry('## 第1章：名\n\n正文。', 1)).toBe(true)
  })
})
