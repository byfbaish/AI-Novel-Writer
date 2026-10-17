import { describe, expect, it } from 'vitest'

import {
  arcNodesForChapter,
  findArcNode,
  listArcNodes,
  validateArcCovers,
} from '../arc-node'

/**
 * 测试用的弧光结构：与实机产物同格式（`## 大弧一：名（约 X–Y 章）` / `### 中弧 N：名（约 N 章）` /
 * `- 字段：值`），章数按实测 150 章项目配平（52 + 51 + 47 = 150，Σ中弧 = 6）。
 */
const PLAN = `# 弧光结构

## 大弧一：睁眼十秒（约 1–52 章）
- 类型：A 因果驱动型
- 接续理由：开篇起点。

### 中弧 1：门牌错位（约 1–26 章）
- 因果：那句敷衍的"我马上到"落地，门牌与排班单一起错位。
- 转折：他以为闭嘴就能躲过去，结果发现不说话比说谎更贵。

### 中弧 2：三方上门（约 27–52 章）
- 目标：从"靠运气撑过零点"变成"有一套能重复用的拖字诀"。
- 尝试 1：靠沉默和废话拖住第一句。
- 尝试 2：利用"写下来的不算"，用记事本和纸条跟人笔谈。
- 转折：他第一次主动说了一句精心设计过的谎，代价记在鲁传福头上。

## 大弧二：最小代价（约 53–103 章）
- 类型：B 目标驱动型

### 中弧 3：沉默的报价（约 53–78 章）
- 目标：从"被按天叫价"变成"能跟庄家议价"。

### 中弧 4：修半条路（约 79–103 章）
- 目标：把"主动设计一句"变成一套稳定活法。

## 大弧三：自担（约 104–150 章）
- 类型：A 因果驱动型

### 中弧 5：被牵连的人（约 104–127 章）
- 目标：从"把代价转出去"变成"把代价收回来"。

### 中弧 6：自担的那一句（约 128–150 章）
- 转折：他站在被牵连的人身边，自己认账。
`

const TOTAL = 150

describe('listArcNodes', () => {
  it('按原文顺序摊平大弧 / 中弧 / 结构位，并给出折算后的闭区间', () => {
    const nodes = listArcNodes(PLAN, TOTAL)
    const majors = nodes.filter(node => node.kind === 'major')
    const mids = nodes.filter(node => node.kind === 'mid')

    expect(majors.map(node => [node.id, node.range])).toEqual([
      ['M1', [1, 52]],
      ['M2', [53, 103]],
      ['M3', [104, 150]],
    ])
    expect(mids.map(node => [node.id, node.range])).toEqual([
      ['M1-1', [1, 26]],
      ['M1-2', [27, 52]],
      // ⚠️ `midIndex` 是**本大弧内**的序号（与 `ArcSpan.midIndex` 同语义），不是原文里的全局
      // 「中弧 3」。跨大弧辨识看 `midName`：「M2-1」= 中弧 3：沉默的报价。
      ['M2-1', [53, 78]],
      ['M2-2', [79, 103]],
      ['M3-1', [104, 127]],
      ['M3-2', [128, 150]],
    ])
    // 区间首尾相接、无空洞、覆盖全书 —— 折算若错位，这里必然留下缺口。
    expect(mids[0]!.range[0]).toBe(1)
    expect(mids[mids.length - 1]!.range[1]).toBe(TOTAL)
    for (let index = 1; index < mids.length; index += 1) {
      expect(mids[index]!.range[0]).toBe(mids[index - 1]!.range[1] + 1)
    }
  })

  it('结构位继承所属中弧的区间，字段文本取自原文', () => {
    const nodes = listArcNodes(PLAN, TOTAL)
    const turn = findArcNode(nodes, 'M1-2/转折')

    expect(turn).toBeDefined()
    expect(turn!.kind).toBe('field')
    expect(turn!.range).toEqual([27, 52])
    expect(turn!.field).toBe('转折')
    expect(turn!.text).toContain('代价记在鲁传福头上')
    // `尝试 2` 带空格，仍须被 FIELD_LINE 捕获 —— 否则最该被检查的那一格反而缺失。
    expect(findArcNode(nodes, 'M1-2/尝试 2')).toBeDefined()
  })

  it('结构不可解析或全书章数非法时返回空数组（fail-open）', () => {
    expect(listArcNodes('', TOTAL)).toEqual([])
    expect(listArcNodes(null, TOTAL)).toEqual([])
    expect(listArcNodes('# 没有章数标注的结构', TOTAL)).toEqual([])
    expect(listArcNodes(PLAN, 0)).toEqual([])
  })

  it('自报章数与全书章数不等时按比例折算，且仍覆盖全书', () => {
    // 弧光自称 100 章，实际 150 章 ⇒ 区间须等比放大到 150。
    const nodes = listArcNodes(PLAN.replace(/约 ([0-9]+)–?[0-9]* 章/gu, (_match, count: string) => `约 ${Math.round(Number(count) * 2 / 3)} 章`), 100)
    const mids = nodes.filter(node => node.kind === 'mid')
    expect(mids[0]!.range[0]).toBe(1)
    expect(mids[mids.length - 1]!.range[1]).toBe(100)
  })
})

describe('arcNodesForChapter', () => {
  it('返回本章所处中弧及其全部结构位，外加所属大弧', () => {
    const nodes = listArcNodes(PLAN, TOTAL)
    const forChapter = arcNodesForChapter(nodes, 40)
    const ids = forChapter.map(node => node.id)

    expect(ids).toContain('M1')
    expect(ids).toContain('M1-2')
    expect(ids).toContain('M1-2/转折')
    expect(ids).toContain('M1-2/尝试 2')
    // 不属于本章的后续中弧不得出现。
    expect(ids).not.toContain('M1-1/转折')
  })

  it('落在中弧边界上时归属该中弧（闭区间），越界返回空', () => {
    const nodes = listArcNodes(PLAN, TOTAL)
    expect(arcNodesForChapter(nodes, 27).some(node => node.id === 'M1-2')).toBe(true)
    expect(arcNodesForChapter(nodes, 52).some(node => node.id === 'M1-2')).toBe(true)
    expect(arcNodesForChapter(nodes, 53).some(node => node.id === 'M2-1')).toBe(true)
    expect(arcNodesForChapter(nodes, 151)).toEqual([])
  })
})

describe('validateArcCovers', () => {
  const nodes = listArcNodes(PLAN, TOTAL)

  it('INV-1：提前使用后续中弧的结构位即报错，并算出提前了多少章', () => {
    // 实机数据：第 2 章用了中弧 2 的「尝试 2」（原定 27–52 章）。
    const violations = validateArcCovers(nodes, ['M1-2/尝试 2'], 2)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      code: 'INV-1-OUT_OF_RANGE',
      id: 'M1-2/尝试 2',
      chapterNumber: 2,
      range: [27, 52],
    })
    expect(violations[0]!.message).toContain('提前了 25 章')
  })

  it('落在区间内不报错（含两个端点）', () => {
    expect(validateArcCovers(nodes, ['M1-2/转折'], 27)).toEqual([])
    expect(validateArcCovers(nodes, ['M1-2/转折'], 52)).toEqual([])
  })

  it('未知结构位报 UNKNOWN_NODE，不静默放过', () => {
    const violations = validateArcCovers(nodes, ['M1-2/并不存在的字段'], 40)
    expect(violations).toHaveLength(1)
    expect(violations[0]!.code).toBe('UNKNOWN_NODE')
  })

  it('中弧粒度只提示细化，不算越界', () => {
    const violations = validateArcCovers(nodes, ['M1-2'], 40)
    expect(violations).toHaveLength(1)
    expect(violations[0]!.code).toBe('COARSE_NODE')
  })

  it('缺失 covers 时 fail-open', () => {
    expect(validateArcCovers(nodes, [], 2)).toEqual([])
    expect(validateArcCovers(nodes, ['  '], 2)).toEqual([])
  })
})
