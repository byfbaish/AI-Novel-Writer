import { describe, expect, it } from 'vitest'
import { parseOutlineChapterHeading } from '../chapter-heading'
import { plotOutlineCoveredTo, validPlotOutlineEntry } from '../plot-outline-contract'
import { parseChapterArcCovers } from '../arc-node'
import { buildOutlineTree } from '../outline-tree'

// 章标题解析收敛到 `chapter-heading.ts`：三处调用方（覆盖章数 / 覆盖行归属 / 三层树）
// 共用一份正则，各自的宽容度差异变成调用方约束。这里把那些差异逐条钉住 ——
// 换格式时任何一处松弛或收紧都会在这里翻红，而不是等到「整批大纲被丢弃」。

const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '### 单元二：定价',
  '',
  '## 卷二：销档',
  '### 单元一：配合',
].join('\n')

describe('parseOutlineChapterHeading：形状识别', () => {
  it('三层归属：卷 / 单元 / 单元内章 / 全书章', () => {
    const fields = parseOutlineChapterHeading('## 第3卷第2单元第3章（全书第45章）：章名')!
    expect(fields).toMatchObject({
      chapter: 45, chapterTo: 45, grouped: false, hashLevel: 2, prefixSpaced: true,
      style: 'cn', arabic: true, attributed: true,
      volumeIndex: 3, unitIndex: 2, chapterInParent: 3, separator: '：', rest: '章名',
    })
  })

  it('两级结构（无单元层）：第V卷第C章', () => {
    expect(parseOutlineChapterHeading('## 第3卷第3章（全书第45章）：章名')).toMatchObject({
      chapter: 45, volumeIndex: 3, unitIndex: null, chapterInParent: 3, attributed: true,
    })
  })

  it('归属标题缺「（全书第N章）」⇒ 不识别（无法定位全书章号，不猜）', () => {
    expect(parseOutlineChapterHeading('## 第3卷第2单元第3章：章名')).toBeNull()
  })

  it('归属标题的括号允许半角与中文数字（`arabic` 只看全书章号）', () => {
    expect(parseOutlineChapterHeading('## 第二卷第三单元第四章(全书第十二章)：章名')).toMatchObject({
      chapter: 12, volumeIndex: 2, unitIndex: 3, chapterInParent: 4, arabic: false,
    })
    expect(parseOutlineChapterHeading('## 第二卷第三单元第四章(全书第 12 章)：章名')).toMatchObject({
      chapter: 12, arabic: true,
    })
  })

  it('旧格式：第N章 / 第N–M章 / 中文数字', () => {
    expect(parseOutlineChapterHeading('## 第12章：甲')).toMatchObject({ chapter: 12, chapterTo: 12, grouped: false, attributed: false })
    expect(parseOutlineChapterHeading('## 第12–15章：甲')).toMatchObject({ chapter: 12, chapterTo: 15, grouped: true })
    expect(parseOutlineChapterHeading('## 第十二章：甲')).toMatchObject({ chapter: 12, arabic: false })
  })

  it('旧格式英文：Chapter N 与 Chapters N-M（后者恒 grouped）', () => {
    expect(parseOutlineChapterHeading('## Chapter 4: T')).toMatchObject({ chapter: 4, style: 'en', grouped: false })
    expect(parseOutlineChapterHeading('## Chapters 7: g')).toMatchObject({ chapter: 7, grouped: true })
    expect(parseOutlineChapterHeading('## Chapters 20-22: g')).toMatchObject({ chapter: 20, chapterTo: 22, grouped: true })
  })

  it('前缀：井号 1–6 / bullet / 无前缀，以及 `##第5章` 的 prefixSpaced', () => {
    expect(parseOutlineChapterHeading('### 第8章：甲')).toMatchObject({ hashLevel: 3, prefix: 'h3' })
    expect(parseOutlineChapterHeading('- 第5章：甲')).toMatchObject({ hashLevel: 0, prefix: 'bullet' })
    expect(parseOutlineChapterHeading('第5章：甲')).toMatchObject({ hashLevel: 0, prefix: 'none' })
    expect(parseOutlineChapterHeading('## 第7章：甲')).toMatchObject({ prefixSpaced: true })
    expect(parseOutlineChapterHeading('##第7章：甲')).toMatchObject({ prefixSpaced: false })
  })

  it('章号两侧容忍空格', () => {
    expect(parseOutlineChapterHeading('## 第 6 章：昏迷的边缘')).toMatchObject({ chapter: 6 })
  })

  it('章号非法（0 / 越界）或不是章标题 ⇒ null', () => {
    expect(parseOutlineChapterHeading('## 第0章：甲')).toBeNull()
    expect(parseOutlineChapterHeading('## 第1章到第5章的内容')).toMatchObject({ chapter: 1, separator: null })
    expect(parseOutlineChapterHeading('这是一段正文')).toBeNull()
  })
})

describe('三处调用方的宽容度差异（换格式时最先塌的地方）', () => {
  it('覆盖章数：认归属标题、认 Chapter N、认中文数字、认章组', () => {
    const text = [
      '## 第3卷第2单元第3章（全书第45章）：甲',
      '## 第3卷第3章（全书第46章）：乙',
      '## Chapter 47: T',
      '## 第四十八章：丁',
      '## 第49–50章：组',
    ].join('\n')
    expect(plotOutlineCoveredTo(text)).toBe(50)
  })

  it('覆盖章数：`##第5章`（井号后无空白）与「第1章到第5章」都不认', () => {
    expect(plotOutlineCoveredTo('##第5章：甲')).toBe(0)
    expect(plotOutlineCoveredTo('## 第1章到第5章的内容')).toBe(0)
  })

  it('覆盖行归属：只认 `#`1–4、单章、阿拉伯数字；title 从 `after` 自切（全角句点不算分隔符）', () => {
    expect(parseChapterArcCovers('## 第5章：甲\n覆盖：M1-1')).toMatchObject([{ chapterNumber: 5, title: '甲', covers: ['M1-1'] }])
    expect(parseChapterArcCovers('## 第5章．甲')).toMatchObject([{ title: '．甲' }])
    expect(parseChapterArcCovers('## Chapter 4: T')).toMatchObject([{ chapterNumber: 4, title: 'T' }])
    expect(parseChapterArcCovers('## 第5–6章：组\n覆盖：M1-1')).toEqual([])
    expect(parseChapterArcCovers('## 第五十章：甲')).toEqual([])
  })

  it('覆盖行归属：`##第5章`（无空白）在本模块合法', () => {
    expect(parseChapterArcCovers('##第7章：甲\n覆盖：M1-1')).toMatchObject([{ chapterNumber: 7, title: '甲', covers: ['M1-1'] }])
  })

  it('三层树：只认 `##` + 阿拉伯 + `第N章`（不认 Chapter N、不认章组）', () => {
    const synopsis = '## 第1章：甲\n正文\n## Chapter 2: T\n正文\n## 第3–4章：组\n正文'
    const tree = buildOutlineTree(PLAN, synopsis, 10)!
    const numbers = tree.volumes.flatMap(v => v.units.flatMap(u => u.chapters.map(c => c.number)))
    expect(numbers).toEqual([1])
  })

  it('三层树：归属标题带出章号（P2 起 source 会变 heading，当前仍按折算）', () => {
    const synopsis = '## 第3卷第2单元第3章（全书第45章）：甲\n正文'
    const tree = buildOutlineTree(PLAN, synopsis, 60)!
    const numbers = tree.volumes.flatMap(v => v.units.flatMap(u => u.chapters.map(c => c.number)))
    expect(numbers).toEqual([45])
  })
})

describe('validPlotOutlineEntry：入库仍是严格单章', () => {
  it('旧格式通过', () => {
    expect(validPlotOutlineEntry('## 第5章：甲\n正文内容。', 5)).toBe(true)
  })

  it('归属标题通过（P2 放开的合同：章号对全书章号）', () => {
    expect(validPlotOutlineEntry('## 第3卷第2单元第3章（全书第45章）：甲\n正文内容。', 45)).toBe(true)
    // 两级结构（无单元层）同样通过
    expect(validPlotOutlineEntry('## 第3卷第3章（全书第45章）：甲\n正文内容。', 45)).toBe(true)
    // 但章号仍必须对得上：拿单元内序号当全书章号不行
    expect(validPlotOutlineEntry('## 第3卷第2单元第3章（全书第45章）：甲\n正文内容。', 3)).toBe(false)
  })
})
