import { describe, expect, it } from 'vitest'

import { findArcCoverRisks, arcCoverStableFactKey, type ArcCoverScope } from '../arc-cover-consistency'

/**
 * 夹具照抄 `arc-node.test.ts:17-54` 的 150 章三级结构（52 + 51 + 47 = 150，Σ中弧 = 6）。
 * 本文件只验证「接进预检」这一层，结构解析的判据仍在 `arc-node.test.ts` 里。
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

/** 两级「卷 / 单元」结构：按输出合同不含 `覆盖：` 行，也没有「第 N 章」标题。 */
const TWO_LEVEL_PLAN = `# 故事结构

## 卷 1：起（约 1–12 章）
### 单元 1：开门（约 1–4 章）
- 事件：他应了一声，门牌错了。
### 单元 2：闭口（约 5–12 章）
- 事件：他决定不再解释。

## 卷 2：承（约 13–30 章）
### 单元 3：上门（约 13–20 章）
- 事件：三方上门。
`

/** 造一份只有本章一条目的最小大纲。 */
function synopsisFor(chapterNumber: number, covers: string): string {
  return [`## 第${chapterNumber}章：测试章`, covers, '正文省略。'].join('\n')
}

/** 三级结构下「本章已声明结构位」的标准入参，各负向用例只改一个变量。 */
function baseScope(overrides: Partial<ArcCoverScope> = {}): ArcCoverScope {
  return {
    chapterNumber: 3,
    plotStructurePlan: PLAN,
    synopsis: synopsisFor(3, '覆盖：M1-2/转折'),
    totalChapters: TOTAL,
    ...overrides,
  }
}

describe('findArcCoverRisks · 正向', () => {
  it('#1 提前消耗后续中弧的结构位 ⇒ 一条 INV-1，键不含章号', () => {
    const findings = findArcCoverRisks(baseScope())

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      stableFactKey: 'arc:cover:INV-1-OUT_OF_RANGE:M1-2/转折',
      severity: 'warning',
      sourceChapter: 3,
    })
    // 不写 sourceLayer：面板是二元硬编码，写了会显示成「本章蓝图」（实施包 §2）。
    expect(findings[0]!.sourceLayer).toBeUndefined()
    expect(findings[0]!.evidence).toContain('提前了 24 章')
  })

  it('#2 弧光重排后该 ID 不存在 ⇒ UNKNOWN_NODE，且文案保留「可能拼写错误，或弧光已重排」', () => {
    const findings = findArcCoverRisks(baseScope({ synopsis: synopsisFor(3, '覆盖：M9-9/转折') }))

    expect(findings).toHaveLength(1)
    expect(findings[0]!.stableFactKey).toBe('arc:cover:UNKNOWN_NODE:M9-9/转折')
    expect(findings[0]!.issue.zhCN).toContain('可能拼写错误，或弧光已重排')
  })

  it('#3 声明大弧粒度 ⇒ COARSE_NODE', () => {
    const findings = findArcCoverRisks(baseScope({ synopsis: synopsisFor(3, '覆盖：M1') }))

    expect(findings).toHaveLength(1)
    expect(findings[0]!.stableFactKey).toBe('arc:cover:COARSE_NODE:M1')
  })
})

describe('findArcCoverRisks · fail-open 五连', () => {
  it('#4 本章写「覆盖：无」⇒ 不判', () => {
    expect(findArcCoverRisks(baseScope({ synopsis: synopsisFor(3, '覆盖：无') }))).toEqual([])
  })

  it('#5 大纲里没有本章条目 ⇒ 不判', () => {
    expect(findArcCoverRisks(baseScope({ synopsis: synopsisFor(7, '覆盖：M1-2/转折') }))).toEqual([])
  })

  it('#6 两级「卷 / 单元」结构（按合同没有 `覆盖：` 行）⇒ 不判（显式缺口，见实施包 §1.4）', () => {
    // 输出合同 `synopsis-two-level-suffix.ts:37` 禁止两级结构写 `覆盖：` 行、禁止自造 M1-1 编号，
    // 因此 `parseChapterArcCovers` 恒空 ⇒ 本规则在两级项目上恒 fail-open。
    // 本用例锁住这条边界：缺口写进 S4 收口件，不许悄悄变成「误报」。
    const volumeSynopsis = [
      '## 卷 1：起（约 1–12 章）',
      '### 单元 1：开门（约 1–4 章）',
      '- 事件：他应了一声，门牌错了。',
    ].join('\n')
    expect(findArcCoverRisks({
      chapterNumber: 3,
      plotStructurePlan: TWO_LEVEL_PLAN,
      synopsis: volumeSynopsis,
      totalChapters: 30,
    })).toEqual([])
  })

  it('#7 totalChapters 为 0 / 非整数 / undefined ⇒ 不判', () => {
    expect(findArcCoverRisks(baseScope({ totalChapters: 0 }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ totalChapters: 1.5 }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ totalChapters: undefined }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ totalChapters: null }))).toEqual([])
  })

  it('#8 plotStructurePlan 为空串 / undefined ⇒ 不判（不把每个 ID 报成 UNKNOWN_NODE）', () => {
    expect(findArcCoverRisks(baseScope({ plotStructurePlan: '' }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ plotStructurePlan: undefined }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ plotStructurePlan: '# 没有章数标注的结构' }))).toEqual([])
  })

  it('#9 chapterNumber 为 0 / -1 / 1.5 ⇒ 不判', () => {
    expect(findArcCoverRisks(baseScope({ chapterNumber: 0 }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ chapterNumber: -1 }))).toEqual([])
    expect(findArcCoverRisks(baseScope({ chapterNumber: 1.5 }))).toEqual([])
  })
})

describe('findArcCoverRisks · 豁免与纯函数', () => {
  it('#10 未撤销的豁免命中即不报；撤销后照报（过滤条件必须是 `!revoked`）', () => {
    const stableFactKey = 'arc:cover:INV-1-OUT_OF_RANGE:M1-2/转折'

    expect(findArcCoverRisks(baseScope(), [{ stableFactKey, reason: '已知重排', revoked: false }]))
      .toEqual([])

    const revoked = findArcCoverRisks(baseScope(), [{ stableFactKey, reason: '已知重排', revoked: true }])
    expect(revoked).toHaveLength(1)
    expect(revoked[0]!.stableFactKey).toBe(stableFactKey)
  })

  it('#11 纯函数：同一入参两次调用结果相等，且原入参未被修改', () => {
    const scope = baseScope()
    const snapshot = JSON.parse(JSON.stringify(scope)) as ArcCoverScope

    const first = findArcCoverRisks(scope)
    const second = findArcCoverRisks(scope)

    expect(first).toEqual(second)
    expect(scope).toEqual(snapshot)
    // 键生成也是纯函数：空白被裁掉，不产生第二种写法。
    expect(arcCoverStableFactKey('COARSE_NODE', ' M1 ')).toBe('arc:cover:COARSE_NODE:M1')
  })
})
