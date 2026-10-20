import { describe, expect, it } from 'vitest'

import { planSynopsisUnitRewind } from '../synopsis-unit-rewind'

const expected = {
  synopsis: '',
  premise: 'p',
  charactersArch: 'c',
  worldbuilding: 'w',
  plotStructurePlan: 'plan',
  genre: 'g',
  totalChapters: 150,
  wordsPerChapter: 3000,
  writingLanguage: 'zh-CN' as const,
  plotStructure: '',
  narrativePov: '',
  globalGuidance: '',
}

function outline(lines: string[]): string {
  return `# 情节大纲\n\n${lines.join('\n')}`
}

describe('planSynopsisUnitRewind', () => {
  it('只有第 1 卷第 1 单元 ⇒ 回退到全书起点，游标归初始', () => {
    const text = outline([
      '## 第1卷第1单元第1章（全书第1章）：溃烂',
      '正文。',
      '## 第1卷第1单元第2章（全书第2章）：药渣',
      '正文。',
    ])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 2, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.range).toEqual({ from: 1, to: 2 })
    expect(result.plan.coveredTo).toBe(0)
    expect(result.plan.cursor).toEqual({ volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 })
    expect(result.plan.removedChapters).toEqual([1, 2])
    // 新正文只剩标题与进度行（没有章条目）
    expect(result.plan.outlineText).toContain('# 情节大纲')
    expect(result.plan.outlineText).not.toContain('第1卷第1单元第1章')
    expect(result.plan.outlineText).toContain('已覆盖至第 0 章')
  })

  it('两个单元 ⇒ 只退最后一个，前面的原样保留', () => {
    const text = outline([
      '## 第1卷第1单元第1章（全书第1章）：甲',
      '正文一。',
      '## 第1卷第1单元第2章（全书第2章）：乙',
      '正文二。',
      '## 第1卷第2单元第1章（全书第3章）：丙',
      '正文三。',
    ])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 3, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.range).toEqual({ from: 3, to: 3 })
    expect(result.plan.coveredTo).toBe(2)
    expect(result.plan.cursor).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 2 })
    expect(result.plan.outlineText).toContain('## 第1卷第1单元第2章（全书第2章）：乙')
    expect(result.plan.outlineText).not.toContain('第1卷第2单元第1章')
  })

  it('第二卷的单元：卷内已写章数从本卷首章算，不按全书章号算', () => {
    const text = outline([
      '## 第1卷第1单元第1章（全书第1章）：甲',
      '正文一。',
      '## 第2卷第1单元第1章（全书第31章）：乙',
      '正文二。',
      '## 第2卷第1单元第2章（全书第32章）：丙',
      '正文三。',
    ])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 32, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.range).toEqual({ from: 31, to: 32 })
    expect(result.plan.coveredTo).toBe(30)
    // 卷首章 = 31 ⇒ 水位 30 ⇒ 卷内已写 0 章（这一卷前面没写过）
    expect(result.plan.cursor).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 })
  })

  it('正文里没有归属标题 ⇒ fail-closed，不猜边界', () => {
    const text = outline(['## 第1章：甲', '正文。', '## 第2章：乙', '正文。'])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 2, expected,
    })
    expect(result).toEqual({ ok: false, reason: 'no-attribution' })
  })

  it('空大纲 ⇒ nothing-written', () => {
    expect(planSynopsisUnitRewind({
      outlineText: '# 情节大纲', writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 0, expected,
    })).toEqual({ ok: false, reason: 'nothing-written' })
  })

  it('旧进度行不会残留成第二条', () => {
    const text = `${outline(['## 第1卷第1单元第1章（全书第1章）：甲', '正文。'])}\n\n> 本大纲已覆盖至第 1 章（全书 150 章），其余章节将在后续批次继续生成。`
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 1, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.outlineText.match(/已覆盖至第/g)?.length).toBe(1)
  })
})
