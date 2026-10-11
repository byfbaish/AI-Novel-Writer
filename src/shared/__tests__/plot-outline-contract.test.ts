import { describe, expect, it } from 'vitest'
import { validPlotOutlineEntry, plotOutlineConfirmedPrefix, renderPlotOutlineRange, renderPlotOutlineSynopsis, validPlotOutlineAuthorPrefix, plotOutlineCoveredTo, plotOutlineContinuationStart } from '../plot-outline-contract'
import type { ProjectCoreSynopsisExpected } from '../../../electron/repositories/project-core-repository'
import { synopsisSettingSectionsForDraft } from '../../services/workflows/commands/generate-draft.command'

describe('chapter Markdown outline contract', () => {
  it.each([
    ['## 第一章：起点\n当前章事实。', '## 第二章：后续\n后续章事实。'],
    ['- 第1章：起点\n当前章事实。', '- 第2章：后续\n后续章事实。'],
    ['# 第1章：起点\n当前章事实。', '## 第2章：后续\n后续章事实。'],
  ])('keeps unparseable chapter styles verbatim — the projection cannot split author text from chapter entries', (first, second) => {
    const synopsis = `${first}\n\n${second}`
    expect(synopsisSettingSectionsForDraft(synopsis)).toBe(synopsis)
    expect([first, second].every((entry, index) => validPlotOutlineEntry(entry, index + 1))).toBe(false)
  })
  it('counts the full entry in Unicode code points without truncating a 1201 point entry', () => {
    const heading = '## 第1章：标题\n'
    const maximum = heading + '😀'.repeat(1200 - [...heading].length)
    expect([...maximum]).toHaveLength(1200)
    expect(maximum.length).toBeGreaterThan(1200)
    expect(validPlotOutlineEntry(maximum, 1)).toBe(true)
    expect(validPlotOutlineEntry(`${maximum}尾`, 1)).toBe(true)
  })
  it.each([
    '第1–2章：组\n正文', 'Chapters 1-2: Group\nBody', 'Chapters 1: Group\nBody',
    '前言\n第1章：题\n正文', '第1章：题\n正文\nChapter 2: Other\nBody',
    '第1章：题\n正文\n## 章外概览\n正文', '第1章：题', '第2章：错章\n正文',
    '第1章：题\n正文\n> 后续概览：第二章', '```\n第1章：题\n正文\n```',
  ])('refuses a structurally ambiguous or extra-chapter entry: %s', text => {
    expect(validPlotOutlineEntry(text, 1)).toBe(false)
  })
  it.each(['## 第1章：起点\n行动和结果。', '## Chapter 1: Beginning\nAction and result.'])('accepts a uniform single chapter heading: %s', text => {
    expect(validPlotOutlineEntry(text, 1)).toBe(true)
  })
  it('retains a confirmed prefix and the untouched tail when replacing an earlier chapter', () => {
    const expected: ProjectCoreSynopsisExpected = { synopsis: '', premise: '前提', charactersArch: '角色', worldbuilding: '世界', plotStructurePlan: '',
      genre: '悬疑', totalChapters: 3, wordsPerChapter: 2000, writingLanguage: 'zh-CN', plotStructure: 'three_act', narrativePov: 'third_limited', globalGuidance: '' }
    const prefix = '## 第1章：作者已确认\n原事实必须保留。'
    expected.synopsis = renderPlotOutlineSynopsis(prefix, 1, expected)
    expect(plotOutlineConfirmedPrefix(expected, { from: 2, to: 3 })).toBe(prefix)
    expect(() => plotOutlineConfirmedPrefix(expected, { from: 3, to: 3 })).toThrow('GENERATION_PLOT_OUTLINE_PREFIX_INVALID')
    expected.synopsis = renderPlotOutlineSynopsis(`${prefix}\n\n## 第2章：确认尾部\n不能丢失。`, 2, expected)
    expect(plotOutlineConfirmedPrefix(expected, { from: 1, to: 1 })).toBe('')
    const replacement = renderPlotOutlineRange('## 第1章：新章\n替换首章。', { from: 1, to: 1 }, expected)
    expect(replacement.slice(replacement.indexOf('## 第2章'))).toBe(expected.synopsis.slice(expected.synopsis.indexOf('## 第2章')))
  })
  it('accepts only a complete continuous author prefix within the original selection and keeps prior author chapters exact', () => {
    const expected: ProjectCoreSynopsisExpected = { synopsis: '', premise: '前提', charactersArch: '角色', worldbuilding: '世界', plotStructurePlan: '',
      genre: '悬疑', totalChapters: 4, wordsPerChapter: 2000, writingLanguage: 'zh-CN', plotStructure: 'three_act', narrativePov: 'third_limited', globalGuidance: '' }
    const confirmedPrefix = '## 第1章：已确认\n保留原章。'
    expected.synopsis = renderPlotOutlineSynopsis(confirmedPrefix, 1, expected)
    const progress = { range: { from: 2, to: 3 }, sourceExpected: expected, confirmedPrefix }
    const authored = '## 第2章：补齐\n完整作者内容。'
    expect(validPlotOutlineAuthorPrefix(renderPlotOutlineSynopsis(`${confirmedPrefix}\n\n${authored}`, 2, expected), progress, { from: 2, to: 2 })).toBe(true)
    for (const body of [authored, `${confirmedPrefix}\n\n## 第2章：\n`, `${confirmedPrefix}\n\n## 第3章：跳章\n完整作者内容。`,
      `${confirmedPrefix.replace('保留原章', '替换原章')}\n\n${authored}`, `${confirmedPrefix}\n\n${authored}\n\n## 第4章：越界\n未来。`]) {
      expect(validPlotOutlineAuthorPrefix(renderPlotOutlineSynopsis(body, 2, expected), progress, { from: 2, to: 2 })).toBe(false)
    }
  })
})

describe('plot outline coverage (续写起点)', () => {
  const expected = {
    synopsis: '', premise: '', charactersArch: '', worldbuilding: '', plotStructurePlan: '', genre: '',
    totalChapters: 845, wordsPerChapter: 2000, writingLanguage: 'zh-CN' as const,
    plotStructure: '', narrativePov: '', globalGuidance: '',
  }
  const body = ['## 第1章：零点抽取', '正文。', '', '## 第2章：别答应', '正文。', '', '## 第3章：第六下', '正文。'].join('\n')

  it('derives coverage from chapter headings, not from the trailing progress line', () => {
    expect(plotOutlineCoveredTo('')).toBe(0)
    expect(plotOutlineCoveredTo(null)).toBe(0)
    expect(plotOutlineCoveredTo('# 情节大纲')).toBe(0)
    // 有末尾提示行时以标题为准
    expect(plotOutlineCoveredTo(renderPlotOutlineSynopsis(body, 3, expected))).toBe(3)
    // 提示行被手改/删除也不影响（标题才是下游切片的依据）
    expect(plotOutlineCoveredTo(`${body}\n\n> 本大纲已覆盖至第 99 章（全书 845 章），其余章节将在后续批次继续生成。`)).toBe(3)
    // 英文标题同样识别
    expect(plotOutlineCoveredTo('## Chapter 7: 标题\n正文。')).toBe(7)
  })

  it('starts the next batch right after the covered chapter', () => {
    // 还没有任何章级条目时从头开始（对话框只在已覆盖 > 0 时才提供勾选项）。
    expect(plotOutlineContinuationStart('', 845)).toBe(1)
    expect(plotOutlineContinuationStart(body, 845)).toBe(4)
    // 已写满全书 → 无可续写
    expect(plotOutlineContinuationStart(body, 3)).toBeNull()
    expect(plotOutlineContinuationStart(body, 2)).toBeNull()
  })
})
