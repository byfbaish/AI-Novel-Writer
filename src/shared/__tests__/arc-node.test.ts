import { describe, expect, it } from 'vitest'

import {
  arcNodesForChapter,
  auditArcCovers,
  findArcNode,
  isClaimableArcNode,
  listArcNodes,
  parseChapterArcCovers,
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
- 时序：本中弧起点 = 全书开篇的那个清晨。
- 转折：他以为闭嘴就能躲过去，结果发现不说话比说谎更贵。
- 小弧：睁眼十秒（约 9 章）；纸门牌（约 9 章）；第一笔登记账（约 8 章）

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

describe('parseChapterArcCovers', () => {
  it('解析章标题与紧随其后的覆盖行，含标题、行号与空行容忍', () => {
    const synopsis = [
      '## 第1章：睁眼十秒那句"我马上到"',
      '',
      '覆盖：M1-1/因果',
      '他应了一声，门牌错了。',
      '',
      '## 第2章：额度用完了',
      '覆盖：M1-1/转折',
    ].join('\n')

    const chapters = parseChapterArcCovers(synopsis)
    expect(chapters).toHaveLength(2)
    expect(chapters[0]).toMatchObject({
      chapterNumber: 1,
      title: '睁眼十秒那句"我马上到"',
      covers: ['M1-1/因果'],
      coverLine: 3,
    })
    expect(chapters[1]).toMatchObject({ chapterNumber: 2, covers: ['M1-1/转折'], coverLine: 7 })
  })

  it('写「覆盖：无」视为不声明任何结构位，而不是未知 ID', () => {
    const chapters = parseChapterArcCovers('## 第3章：过渡\n覆盖：无\n随便写点。')
    expect(chapters[0]!.covers).toEqual([])
    expect(chapters[0]!.coverLine).toBe(2)
  })

  it('一章出现多行覆盖时只取第一行 —— 合并会让「一章声明两格」悄悄通过', () => {
    const chapters = parseChapterArcCovers([
      '## 第4章：桥上',
      '覆盖：M1-1/时序',
      '正文里又提到覆盖：M1-2/转折',
    ].join('\n'))
    expect(chapters[0]!.covers).toEqual(['M1-1/时序'])
  })

  it('兼容英文标题与 Covers / 加粗写法', () => {
    const chapters = parseChapterArcCovers([
      '## Chapter 12: The Bridge',
      '**Covers:** M1-1/turning point',
    ].join('\n'))
    expect(chapters[0]).toMatchObject({ chapterNumber: 12, covers: ['M1-1/turning point'] })
  })

  it('没有章标题的大纲（枚举故事结构 / 自由散文）返回空数组，fail-open', () => {
    expect(parseChapterArcCovers('# 故事结构\n第一幕：建置\n覆盖：M1-1/因果')).toEqual([])
    expect(parseChapterArcCovers('')).toEqual([])
  })

  it('多 ID 用顿号分隔时全部保留（ID 内的 / 不参与分隔）', () => {
    const chapters = parseChapterArcCovers('## 第5章：两格\n覆盖：M1-1/时序、M1-1/转折')
    expect(chapters[0]!.covers).toEqual(['M1-1/时序', 'M1-1/转折'])
  })
})

describe('auditArcCovers', () => {
  const nodes = listArcNodes(PLAN, TOTAL)

  it('INV-2：同一「转折」被两章声明 ⇒ 报重复（转折是一次性额度）', () => {
    const chapters = parseChapterArcCovers([
      '## 第3章：先花一格',
      '覆盖：M1-1/转折',
      '## 第4章：再花同一格',
      '覆盖：M1-1/转折',
    ].join('\n'))

    const audit = auditArcCovers(nodes, chapters, { from: 1, to: 5 })
    const duplicates = audit.violations.filter(item => item.code === 'INV-2-DUPLICATE')
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]!.message).toContain('第 3 章已被声明过')
  })

  it('小弧是「归属」不是额度：连续多章写同一个 ID 不算重复消费（P12-4）', () => {
    // 一个小弧天然跨 8–9 章，这 8–9 章都属于它。老逻辑把「两章声明同一格」一律判成
    // 超额兑现，会逼出「只有收束章写 ID、其余写覆盖：无」的写法 —— 5 章里 4 章空白。
    const chapters = parseChapterArcCovers([
      '## 第1章：开篇',
      '覆盖：M1-1/小弧:睁眼十秒',
      '## 第2章：闭口',
      '覆盖：M1-1/小弧:睁眼十秒',
      '## 第3章：还是同一段',
      '覆盖：M1-1/小弧:睁眼十秒',
    ].join('\n'))

    const audit = auditArcCovers(nodes, chapters, { from: 1, to: 5 })
    expect(audit.violations.filter(item => item.code === 'INV-2-DUPLICATE')).toHaveLength(0)
    // 该小弧已被认领 ⇒ 不该出现在漏覆盖里
    expect(audit.uncovered.map(node => node.id)).not.toContain('M1-1/小弧:睁眼十秒')
  })

  it('INV-1：提前使用后续中弧的结构位当场报错（实机 ch2 的形态）', () => {
    const chapters = parseChapterArcCovers('## 第2章：笔谈\n覆盖：M1-2/尝试 2')
    const audit = auditArcCovers(nodes, chapters, { from: 1, to: 5 })
    const outOfRange = audit.violations.filter(item => item.code === 'INV-1-OUT_OF_RANGE')
    expect(outOfRange).toHaveLength(1)
    expect(outOfRange[0]!.id).toBe('M1-2/尝试 2')
  })

  it('INV-3：小弧落在本批区间内却没被任何一章声明 ⇒ 提示（仅提示，不拦）', () => {
    // 第 1–5 章全写「覆盖：无」⇒ 它们明明属于「睁眼十秒」[1,9]，却没人认领。
    const chapters = parseChapterArcCovers('## 第1章：开篇\n覆盖：无')
    const audit = auditArcCovers(nodes, chapters, { from: 1, to: 5 })
    const uncoveredIds = audit.uncovered.map(node => node.id)
    expect(uncoveredIds).toContain('M1-1/小弧:睁眼十秒')
    // 纸门牌 [10,18] 与本批无交集；M1-2 的转折更远 ⇒ 都不判。
    expect(uncoveredIds).not.toContain('M1-1/小弧:纸门牌')
    expect(uncoveredIds).not.toContain('M1-2/转折')
    expect(audit.declaredChapters).toBe(1)
  })

  it('INV-3：转折是额度 —— 未到期不报，整条中弧写完仍未出现才报', () => {
    // 中弧 1 是第 1–26 章，转折本来就该在后段发生。第 1–5 章没花掉它，不是漏。
    // 旧实现在这里恒定报一条「M1-1/转折 未声明」，每批都报、永远消不掉。
    const early = parseChapterArcCovers('## 第1章：开篇\n覆盖：M1-1/小弧:睁眼十秒')
    expect(auditArcCovers(nodes, early, { from: 1, to: 5 }).uncovered.map(node => node.id))
      .not.toContain('M1-1/转折')

    // 本批已写到第 26 章（中弧 1 的末尾），转折仍未出现 ⇒ 额度过期，真漏。
    const late = parseChapterArcCovers('## 第26章：收束\n覆盖：M1-1/小弧:第一笔登记账')
    expect(auditArcCovers(nodes, late, { from: 20, to: 26 }).uncovered.map(node => node.id))
      .toContain('M1-1/转折')
  })
})

describe('小弧子节点（P12-3）', () => {
  const nodes = listArcNodes(PLAN, TOTAL)

  it('小弧生成独立节点，区间在本中弧内再折算一次', () => {
    // 中弧 1 = 第 1–26 章；小弧 9+9+8 = 26 ⇒ 逐段对齐，不留缝不重叠。
    expect(findArcNode(nodes, 'M1-1/小弧:睁眼十秒')).toMatchObject({
      kind: 'minor', minorName: '睁眼十秒', range: [1, 9],
    })
    expect(findArcNode(nodes, 'M1-1/小弧:纸门牌')).toMatchObject({
      kind: 'minor', minorName: '纸门牌', range: [10, 18],
    })
    expect(findArcNode(nodes, 'M1-1/小弧:第一笔登记账')).toMatchObject({
      kind: 'minor', minorName: '第一笔登记账', range: [19, 26],
    })
  })

  it('只有「转折」与小弧是可声明的一次性额度，整段规格字段不是', () => {
    expect(isClaimableArcNode(findArcNode(nodes, 'M1-1/转折')!)).toBe(true)
    expect(isClaimableArcNode(findArcNode(nodes, 'M1-1/小弧:纸门牌')!)).toBe(true)
    expect(isClaimableArcNode(findArcNode(nodes, 'M1-1/因果')!)).toBe(false)
    // 实机第 6 章就是拿它认领的：原文是「本中弧起点 = 全书开篇的那个清晨」。
    expect(isClaimableArcNode(findArcNode(nodes, 'M1-1/时序')!)).toBe(false)
  })

  it('声明整段规格字段报 NOT_CLAIMABLE —— 它永不越界，等于不产生信息', () => {
    const violations = validateArcCovers(nodes, ['M1-1/时序'], 6)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ code: 'NOT_CLAIMABLE', id: 'M1-1/时序' })
    expect(violations[0]!.message).toContain('整段规格')
  })

  it('小弧可被提前使用检出，且精确到章（中弧粒度做不到）', () => {
    const violations = validateArcCovers(nodes, ['M1-1/小弧:纸门牌'], 3)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      code: 'INV-1-OUT_OF_RANGE', range: [10, 18], chapterNumber: 3,
    })
    expect(violations[0]!.message).toContain('提前了 7 章')
  })

  it('漏覆盖不统计 因果/时序 这类整段规格，也不把未到期的转折算漏', () => {
    const chapters = parseChapterArcCovers('## 第1章：开篇\n覆盖：M1-1/小弧:睁眼十秒')
    const audit = auditArcCovers(nodes, chapters, { from: 1, to: 9 })
    const uncoveredIds = audit.uncovered.map(node => node.id)
    expect(uncoveredIds).not.toContain('M1-1/因果')
    expect(uncoveredIds).not.toContain('M1-1/时序')
    expect(uncoveredIds).not.toContain('M1-1/小弧:睁眼十秒')
    // 本批只走到中弧 1 的前 1/3，转折本来就该在后段发生 ⇒ 不该恒报。
    expect(uncoveredIds).not.toContain('M1-1/转折')
  })
})
