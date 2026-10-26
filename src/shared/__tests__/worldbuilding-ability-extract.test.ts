import { describe, expect, it } from 'vitest'
import {
  MAX_ABILITY_CANDIDATES,
  abilityCandidateToInput,
  extractAbilityCandidates,
} from '../worldbuilding-ability-extract'
import { ABILITY_TEXT_MAX } from '../power-ability'

/**
 * 一份带完整五维标题的世界观片段。
 *
 * 第 1 维必须有一个等级表；末尾的 `### 2.【阶层断层与资源战场】` 是**区段边界**
 * （`locateWorldBuildingSections` 见到下一个标题就结束第 1 维），用来验证表不会漏到第 2 维去。
 */
const HEADING_1 = '### 1.【核心规则与体系漏洞】'
const HEADING_2 = '### 2.【阶层断层与资源战场】'

const TABLE_HEADER = '| 等级名 | 相邻差距 | 卡点 | 升级代价 |'
const TABLE_SEPARATOR = '| --- | --- | --- | --- |'

function ladder(rows: readonly string[]): string {
  return [HEADING_1, '', TABLE_HEADER, TABLE_SEPARATOR, ...rows, '', HEADING_2, '', '外门弟子与内门弟子之间隔着三道考核。'].join('\n')
}

/** 三行标准等级表：首列粗体（模板 ★ 强制的写法）。 */
const STANDARD = ladder([
  '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
  '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
  '| **金丹期** | 百倍 | 需渡三劫 | 损耗三十年寿元 |',
])

describe('extractAbilityCandidates · 入口与维度定位', () => {
  it('null / undefined / 空串 / 纯空白 ⇒ 空候选且 dimensionFound=false', () => {
    for (const input of [null, undefined, '', '   ']) {
      expect(extractAbilityCandidates(input)).toEqual({
        candidates: [],
        dimensionFound: false,
        dropped: 0,
        mismatchedColumnCounts: [],
      })
    }
  })

  it('没有五维标题的自由文本 ⇒ dimensionFound=false（不猜哪一节是第 1 维）', () => {
    const free = ['这本书讲的是一个小门派的兴衰。', '| 等级名 | 相邻差距 | 卡点 | 升级代价 |', '| --- | --- | --- | --- |', '| **练气一层** | 略 | 需引气入体 | 三年苦修 |'].join('\n')
    const set = extractAbilityCandidates(free)
    expect(set.dimensionFound).toBe(false)
    expect(set.candidates).toEqual([])
  })

  it('第 1 维存在但只有散文、没有表格 ⇒ 候选空且 dimensionFound=true', () => {
    const prose = [HEADING_1, '', '本界的灵气有上限，一人一生只能结一次丹。', '', HEADING_2, '', '外门与内门隔着三道考核。'].join('\n')
    const set = extractAbilityCandidates(prose)
    expect(set.dimensionFound).toBe(true)
    expect(set.candidates).toEqual([])
    expect(set.dropped).toBe(0)
  })
})

describe('extractAbilityCandidates · 表格形状', () => {
  it('标准四列表 3 行 ⇒ 3 条候选，四个字段逐字对齐', () => {
    const set = extractAbilityCandidates(STANDARD)
    expect(set.dimensionFound).toBe(true)
    expect(set.dropped).toBe(0)
    expect(set.candidates).toEqual([
      {
        name: '练气一层',
        hardLimit: '需引气入体',
        costNote: '三年苦修',
        evidence: '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
        evidenceScope: 'worldbuilding',
      },
      {
        name: '筑基期',
        hardLimit: '需筑基丹一枚',
        costNote: '一枚中品灵石',
        evidence: '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
        evidenceScope: 'worldbuilding',
      },
      {
        name: '金丹期',
        hardLimit: '需渡三劫',
        costNote: '损耗三十年寿元',
        evidence: '| **金丹期** | 百倍 | 需渡三劫 | 损耗三十年寿元 |',
        evidenceScope: 'worldbuilding',
      },
    ])
  })

  it('首列没有粗体也接受（模型常漏掉加粗，等级名照样在首列）', () => {
    const noBold = ladder([
      '| 练气一层 | 略 | 需引气入体 | 三年苦修 |',
      '| 筑基期 | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
    ])
    expect(extractAbilityCandidates(noBold).candidates.map(c => c.name)).toEqual(['练气一层', '筑基期'])
  })

  it('表头行不被当成数据（表格块首行恒为表头）', () => {
    const set = extractAbilityCandidates(STANDARD)
    expect(set.candidates.map(c => c.name)).not.toContain('等级名')
    expect(set.candidates.map(c => c.name)).not.toContain('相邻差距')
  })

  it('分隔行本身不被当成数据', () => {
    const set = extractAbilityCandidates(STANDARD)
    for (const candidate of set.candidates) {
      expect(candidate.name).not.toMatch(/^-+$/)
      expect(candidate.evidence).not.toBe(TABLE_SEPARATOR)
    }
    expect(set.dropped).toBe(0)
  })

  it('纯三列表（价格表）⇒ 候选 0 条、dropped 0，但要把「找到表格、列数 3」报出来', () => {
    const price = [HEADING_1, '', '| 物品 | 价格 | 说明 |', '| --- | --- | --- |', '| 散气丹 | 三枚下品灵石 | 最劣等丹药 |', '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(price)
    expect(set.dimensionFound).toBe(true)
    expect(set.candidates).toEqual([])
    expect(set.dropped).toBe(0)
    // 源文本里明明有表格 ⇒ 界面不许说成「没找到表格」（判据 DN 同型）。
    expect(set.mismatchedColumnCounts).toEqual([3])
  })

  it('三列表在前 + 四列表在后（同一维）⇒ 只抽四列表那几行', () => {
    const mixed = [HEADING_1, '',
      '| 物品 | 价格 | 说明 |', '| --- | --- | --- |', '| 散气丹 | 三枚下品灵石 | 最劣等 |', '',
      TABLE_HEADER, TABLE_SEPARATOR,
      '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
      '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
      '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(mixed)
    expect(set.candidates.map(c => c.name)).toEqual(['练气一层', '筑基期'])
    expect(set.dropped).toBe(0)
    expect(set.mismatchedColumnCounts).toEqual([3])
  })
})

/**
 * 对抗形态（2026-10-26 验收补齐）。
 *
 * 这几条都是「模型真会这么写」的变体，而原规格没写、实现也就没防 —— 属于规格漏洞，
 * 不是实现偏离。每条都对应一个真实后果，注释里写清是哪个。
 */
describe('extractAbilityCandidates · 对抗形态（验收补齐）', () => {
  it('★ 没有分隔行时表头仍不进候选（块首恒为表头，不依赖可省略的分隔行）', () => {
    // 判据：markdown 的 `| --- |` 是**可选**语法，模型常省略。旧实现靠「下一行是分隔行」认表头，
    // 漏写分隔行 ⇒ 表头变成一条 `name='等级名'` 的候选，勾选后真的会被登记进库（脏数据）。
    const noSeparator = [HEADING_1, '',
      TABLE_HEADER,
      '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
      '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
      '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(noSeparator)
    expect(set.candidates.map(c => c.name)).toEqual(['练气一层', '筑基期'])
    expect(set.candidates.map(c => c.name)).not.toContain('等级名')
    expect(set.dropped).toBe(0)
  })

  it('★ 五列表（多写一列「备注」）⇒ 不抽，但必须报出「找到表格、列数是 5」', () => {
    // 判据 DN 同型：「没抽到」不能说成「没有」。源文本里有表格，界面的空态文案必须据此区分。
    const five = [HEADING_1, '',
      '| 等级名 | 相邻差距 | 卡点 | 升级代价 | 备注 |',
      '| --- | --- | --- | --- | --- |',
      '| **练气一层** | 略 | 需引气入体 | 三年苦修 | 外门 |',
      '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(five)
    expect(set.dimensionFound).toBe(true)
    expect(set.candidates).toEqual([])
    // 不计 dropped：整表不认 ≠ 丢了某几行，混进去会让「已丢弃 N 条」说谎。
    expect(set.dropped).toBe(0)
    expect(set.mismatchedColumnCounts).toEqual([5])
  })

  it('行首缩进的表格照样识别（判定前先 trim，缩进不影响）', () => {
    const indented = [HEADING_1, '',
      '   | 等级名 | 相邻差距 | 卡点 | 升级代价 |',
      '   | --- | --- | --- | --- |',
      '   | **练气一层** | 略 | 需引气入体 | 三年苦修 |',
      '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(indented)
    expect(set.candidates.map(c => c.name)).toEqual(['练气一层'])
    expect(set.dropped).toBe(0)
  })

  it('两个表格块被散文隔开 ⇒ 两块的首行都跳过，只有数据行成为候选', () => {
    const two = [HEADING_1, '',
      TABLE_HEADER, TABLE_SEPARATOR,
      '| **练气一层** | 略 | 需引气入体 | 三年苦修 |', '',
      '本界的灵气有上限，一人一生只能结一次丹。', '',
      TABLE_HEADER, TABLE_SEPARATOR,
      '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
      '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(two)
    expect(set.candidates.map(c => c.name)).toEqual(['练气一层', '筑基期'])
    expect(set.dropped).toBe(0)
  })

  it('已知代价：完全没写表头、首行直接是数据 ⇒ 首行被当表头跳过（不是丢了数据行）', () => {
    // 这条**不是**缺陷，是「块首即表头」的必然代价：markdown 表格以表头起始，
    // 没有表头的 `| a | b |` 连续行在语法上本来就是一张表的表头 + 数据。
    // 锁住它是为了让将来改这块的人看见「首行消失」时知道这是设计，不是要修的 bug。
    const noHeader = [HEADING_1, '',
      '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
      '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
      '', HEADING_2, ''].join('\n')
    const set = extractAbilityCandidates(noHeader)
    expect(set.candidates.map(c => c.name)).toEqual(['筑基期'])
    expect(set.dropped).toBe(0) // 表头不是「丢了的数据」
  })
})

describe('extractAbilityCandidates · 丢弃纪律', () => {
  it('同表出现两次同名 ⇒ 只留首次，dropped=1', () => {
    const dup = ladder([
      '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
      '| **练气一层** | 略 | 需引气入体（重修） | 六年苦修 |',
    ])
    const set = extractAbilityCandidates(dup)
    expect(set.candidates).toHaveLength(1)
    expect(set.candidates[0]?.costNote).toBe('三年苦修')
    expect(set.dropped).toBe(1)
  })

  it('costNote 超 200 字 ⇒ 整条丢弃、dropped=1，且不出现截断痕迹', () => {
    const long = '很'.repeat(ABILITY_TEXT_MAX + 20)
    const set = extractAbilityCandidates(ladder([
      `| **练气一层** | 略 | 需引气入体 | ${long} |`,
      '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
    ]))
    expect(set.candidates).toHaveLength(1)
    expect(set.candidates[0]?.name).toBe('筑基期')
    expect(set.dropped).toBe(1)
    // 截断等于改写原文：不许出现任何「剩下的一条被砍过」的痕迹。
    expect(set.candidates[0]?.costNote).toBe('一枚中品灵石')
    expect(set.candidates[0]?.costNote).not.toContain('…')
    expect(set.candidates[0]?.evidence).not.toContain('…')
  })

  it(`造 ${MAX_ABILITY_CANDIDATES + 2} 行合法数据 ⇒ 取 ${MAX_ABILITY_CANDIDATES} 条、dropped=2（超上限也要计数）`, () => {
    const rows = Array.from({ length: MAX_ABILITY_CANDIDATES + 2 }, (_unused, index) => (
      `| **境界${index}** | 略 | 卡点${index} | 代价${index} |`
    ))
    const set = extractAbilityCandidates(ladder(rows))
    expect(set.candidates).toHaveLength(MAX_ABILITY_CANDIDATES)
    expect(set.dropped).toBe(2)
  })
})

describe('extractAbilityCandidates · 行序', () => {
  /**
   * 与资源先例（`filterResourceCandidates` 用 `localeCompare`）唯一的**有意偏差**：
   * 等级表的行序就是阶梯顺序，排序会把「练气 → 筑基 → 金丹」洗成字典序。
   * 这里用一组同时逆于码元序与拼音序的名字，任何排序都会立刻暴露。
   */
  it('候选序列等于表格行序，且不等于字典序', () => {
    const order = ladder([
      '| **练气** | 一 | 引气 | 三年 |',
      '| **筑基** | 十 | 筑基丹 | 一枚灵石 |',
      '| **金丹** | 百 | 渡劫 | 三十年寿元 |',
      '| **元婴** | 千 | 碎丹 | 半条命 |',
    ])
    const names = extractAbilityCandidates(order).candidates.map(c => c.name)
    expect(names).toEqual(['练气', '筑基', '金丹', '元婴'])
    expect(names).not.toEqual([...names].sort()) // 码元序
    expect(names).not.toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))) // 拼音序
  })
})

describe('abilityCandidateToInput', () => {
  it('映射逐字：evidenceScope=worldbuilding、stageChapter=null、三个空串、无 source 键', () => {
    const candidate = extractAbilityCandidates(STANDARD).candidates[0]
    expect(candidate).toBeDefined()
    const result = abilityCandidateToInput(candidate!)
    expect(result).toEqual({
      name: '练气一层',
      hardLimit: '需引气入体',
      costNote: '三年苦修',
      evidence: '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
      evidenceScope: 'worldbuilding',
      stageChapter: null,
      form: '',
      weakness: '',
      stageNote: '',
    })
    // source 由仓储硬编码成 'author'，前端传不进去也不该传。
    expect('source' in result).toBe(false)
  })
})
