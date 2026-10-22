import { describe, expect, it } from 'vitest'
import {
  MAX_RESOURCE_CANDIDATES,
  candidateBlockers,
  describeResourceCandidates,
  filterResourceCandidates,
  isCandidateCommittable,
  parseResourceCandidates,
  type ResourceCandidate,
} from '../worldbuilding-resource-extract'

/** 一份够用的世界观片段：所有测试里的引文都从它里面抄。 */
const WORLD = [
  '宗门每月发放三十枚下品灵石，作为外门弟子的月例。',
  '一枚上品灵石可换一百枚下品灵石，坊市里公认。',
  '丹药昂贵，一枚下品灵石只够买最劣等的散气丹。',
].join('\n')

function candidate(overrides: Partial<ResourceCandidate> = {}): ResourceCandidate {
  return {
    name: '下品灵石',
    familyId: '灵石',
    tier: 1,
    unit: '枚',
    period: '月',
    anchorValue: null,
    anchorNote: null,
    anchorQuote: null,
    earnNote: '宗门月例',
    costNote: '购买丹药',
    scarcityNote: '外门弟子的主要开销',
    quote: '宗门每月发放三十枚下品灵石',
    ...overrides,
  }
}

/** 一条有独立依据的换算锚（那句兑换关系确实在 WORLD 里）。 */
const ANCHORED = {
  anchorValue: 100,
  anchorNote: '坊市公认的兑换比',
  anchorQuote: '一枚上品灵石可换一百枚下品灵石',
}

function envelope(items: unknown[]): string {
  return JSON.stringify({ candidates: items })
}

describe('parseResourceCandidates', () => {
  it('坏 JSON / 空串 / 形状不认识 ⇒ unreadable，且没有候选', () => {
    for (const raw of ['', '   ', 'not json', '[]', '{}', '{"candidates":"x"}', 'null']) {
      const parsed = parseResourceCandidates(raw)
      expect(parsed.unreadable).toBe(true)
      expect(parsed.candidates).toEqual([])
    }
  })

  it('剥掉「整段就是一个代码围栏」这一种包装', () => {
    const raw = '```json\n' + envelope([candidate()]) + '\n```'
    expect(parseResourceCandidates(raw).unreadable).toBe(false)
    expect(parseResourceCandidates(raw).candidates).toHaveLength(1)
  })

  it('字段齐全时逐字照收', () => {
    const parsed = parseResourceCandidates(envelope([
      {
        name: '下品灵石',
        familyId: '灵石',
        tier: 1,
        unit: '枚',
        period: '月',
        ...ANCHORED,
        earnNote: '宗门月例',
        costNote: '购买丹药',
        scarcityNote: '外门弟子的主要开销',
        quote: '宗门每月发放三十枚下品灵石',
      },
    ]))
    expect(parsed.unreadable).toBe(false)
    expect(parsed.dropped).toBe(0)
    expect(parsed.candidates[0]).toEqual({
      name: '下品灵石',
      familyId: '灵石',
      tier: 1,
      unit: '枚',
      period: '月',
      ...ANCHORED,
      earnNote: '宗门月例',
      costNote: '购买丹药',
      scarcityNote: '外门弟子的主要开销',
      quote: '宗门每月发放三十枚下品灵石',
    })
  })

  /** 判据 DN / CS：未知不得填 0。0 会被读成「免费兑换」，与「不可通兑」正好相反。 */
  it('anchorValue 为 0 / 负数 / 非数字 ⇒ null（绝不填 0 充数）', () => {
    for (const bad of [0, -1, '100', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const parsed = parseResourceCandidates(envelope([{ ...candidate(), anchorValue: bad }]))
      expect(parsed.candidates[0]?.anchorValue).toBeNull()
    }
  })

  it('anchorValue 为空时 anchorNote 一并清空（没有汇率就不该留着汇率说明）', () => {
    const parsed = parseResourceCandidates(envelope([
      { ...candidate(), anchorValue: 0, anchorNote: '一枚上品换一百枚下品', anchorQuote: '一枚上品灵石可换一百枚下品灵石' },
    ]))
    expect(parsed.candidates[0]?.anchorValue).toBeNull()
    expect(parsed.candidates[0]?.anchorNote).toBeNull()
    expect(parsed.candidates[0]?.anchorQuote).toBeNull()
  })

  /**
   * 十列里只有换算锚要求**另给一条可核对的引文**。理由写在 `ResourceCandidate.anchorQuote`
   * 的注释里：单位错了会被判成冲突、周期错了会被审稿抓到，**只有汇率错了没有任何机制能发现**。
   */
  it('anchorValue 没有 anchorQuote ⇒ 当场作废（不猜汇率）', () => {
    const parsed = parseResourceCandidates(envelope([
      { ...candidate(), anchorValue: 100, anchorNote: '一枚上品换一百枚下品', anchorQuote: null },
      { ...candidate(), name: '上品灵石', anchorValue: 100, anchorQuote: '   ' },
    ]))
    for (const item of parsed.candidates) {
      expect(item.anchorValue).toBeNull()
      expect(item.anchorNote).toBeNull()
      expect(item.anchorQuote).toBeNull()
    }
  })

  it('anchorQuote 给了但原文里搜不到 ⇒ filter 只作废锚值、保留这一行', () => {
    const set = parseResourceCandidates(envelope([
      { ...candidate(), anchorValue: 100, anchorNote: '编的', anchorQuote: '坊市里公认一比三十' },
    ]))
    expect(set.candidates[0]?.anchorValue).toBe(100) // 解析阶段还没核到原文
    const filtered = filterResourceCandidates(set, WORLD)
    // 缺锚值是「不可通兑」（可用状态），不是「这条资源不存在」——所以整行要留下。
    expect(filtered.candidates).toHaveLength(1)
    expect(filtered.candidates[0]?.anchorValue).toBeNull()
    expect(filtered.candidates[0]?.anchorNote).toBeNull()
    expect(filtered.candidates[0]?.unit).toBe('枚')
  })

  it('anchorQuote 命中原文 ⇒ 锚值与说明都保留', () => {
    const set = parseResourceCandidates(envelope([{ ...candidate(), ...ANCHORED }]))
    const filtered = filterResourceCandidates(set, WORLD)
    expect(filtered.candidates[0]?.anchorValue).toBe(100)
    expect(filtered.candidates[0]?.anchorNote).toBe('坊市公认的兑换比')
  })

  it('空串不当成「有值」：unit / period / familyId 的空串一律归一成 null', () => {
    const parsed = parseResourceCandidates(envelope([
      { ...candidate(), unit: '   ', period: '', familyId: '  ' },
    ]))
    expect(parsed.candidates[0]?.unit).toBeNull()
    expect(parsed.candidates[0]?.period).toBeNull()
    expect(parsed.candidates[0]?.familyId).toBeNull()
  })

  it('tier 非法（负数 / 小数 / 字符串 / 缺失）⇒ 0，不猜', () => {
    for (const bad of [-1, 1.5, '2', undefined, null]) {
      const parsed = parseResourceCandidates(envelope([{ ...candidate(), tier: bad }]))
      expect(parsed.candidates[0]?.tier).toBe(0)
    }
  })

  it('缺 name 或缺 quote ⇒ 整条丢弃并计入 dropped（没有可核对的依据）', () => {
    const parsed = parseResourceCandidates(envelope([
      { ...candidate(), name: '' },
      { ...candidate(), quote: '  ' },
      { ...candidate(), name: 'x'.repeat(41) },
      candidate(),
    ]))
    expect(parsed.candidates).toHaveLength(1)
    expect(parsed.dropped).toBe(3)
  })

  it('同名只留一条', () => {
    const parsed = parseResourceCandidates(envelope([candidate(), candidate()]))
    expect(parsed.candidates).toHaveLength(1)
    expect(parsed.dropped).toBe(1)
  })

  it('超出上限的部分计入 dropped（「丢了 N 条」不许说谎）', () => {
    const items = Array.from({ length: MAX_RESOURCE_CANDIDATES + 3 }, (_unused, index) => (
      { ...candidate(), name: `资源${index}` }
    ))
    const parsed = parseResourceCandidates(envelope(items))
    expect(parsed.candidates).toHaveLength(MAX_RESOURCE_CANDIDATES)
    expect(parsed.dropped).toBe(3)
  })

  it('过长的 note 截断，不丢整条', () => {
    const parsed = parseResourceCandidates(envelope([
      { ...candidate(), earnNote: '很'.repeat(400) },
    ]))
    expect(parsed.candidates[0]?.earnNote).toHaveLength(200)
  })
})

describe('filterResourceCandidates', () => {
  it('引文在世界观原文里找不到 ⇒ 丢弃（防模型编引文）', () => {
    const set = parseResourceCandidates(envelope([
      { ...candidate(), quote: '坊市里一枚灵石能买三斤灵米' },
    ]))
    const filtered = filterResourceCandidates(set, WORLD)
    expect(filtered.candidates).toEqual([])
    expect(filtered.dropped).toBe(1)
  })

  it('资源名在原文里搜不到 ⇒ 丢弃（防凭空造一个资源名）', () => {
    const set = parseResourceCandidates(envelope([
      { ...candidate(), name: '幽冥玄铁', quote: '宗门每月发放三十枚下品灵石' },
    ]))
    expect(filterResourceCandidates(set, WORLD).candidates).toEqual([])
  })

  it('合法的留下，并按名字稳定排序', () => {
    const set = parseResourceCandidates(envelope([
      { ...candidate(), name: '上品灵石', quote: '一枚上品灵石可换一百枚下品灵石' },
      { ...candidate(), name: '下品灵石', quote: '宗门每月发放三十枚下品灵石' },
    ]))
    const filtered = filterResourceCandidates(set, WORLD)
    expect(filtered.candidates.map(c => c.name)).toEqual(['上品灵石', '下品灵石'])
    expect(filtered.dropped).toBe(0)
  })

  it('unreadable 透传，不被过滤动作抹掉', () => {
    expect(filterResourceCandidates({ candidates: [], unreadable: true, dropped: 0 }, WORLD).unreadable).toBe(true)
  })
})

describe('isCandidateCommittable / candidateBlockers', () => {
  /** §4.6.4 作者裁定：缺单位不给落库 —— 空单位会让之后每条变动都判成 unit-mismatch。 */
  it('缺单位 ⇒ 不可落库，且 blocker 写明是 unit', () => {
    const noUnit = candidate({ unit: null })
    expect(isCandidateCommittable(noUnit)).toBe(false)
    expect(candidateBlockers(noUnit)).toEqual(['unit'])
  })

  it('其余字段留空都不拦（留空是合法状态，不是缺口）', () => {
    const sparse = candidate({ familyId: null, tier: 0, period: null, anchorValue: null, earnNote: null, costNote: null, scarcityNote: null })
    expect(isCandidateCommittable(sparse)).toBe(true)
    expect(candidateBlockers(sparse)).toEqual([])
  })
})

describe('describeResourceCandidates', () => {
  it('unreadable 说「本次没拿到结果」，不说成「这本书没有资源」', () => {
    const line = describeResourceCandidates({ candidates: [], unreadable: true, dropped: 0 }, 'zh-CN')
    expect(line).toBeDefined()
    expect(line).not.toContain('没有资源')
    expect(line).toContain('未完成')
  })

  it('0 条且读成功了 ⇒ 不制造噪声', () => {
    expect(describeResourceCandidates({ candidates: [], unreadable: false, dropped: 0 }, 'zh-CN')).toBeUndefined()
  })

  it('有候选时报条数，有丢弃时补一句', () => {
    const line = describeResourceCandidates({ candidates: [candidate()], unreadable: false, dropped: 2 }, 'zh-CN')
    expect(line).toContain('1 条候选')
    expect(line).toContain('2 条')
  })

  it('英文侧同样存在，不静默回退中文', () => {
    expect(describeResourceCandidates({ candidates: [], unreadable: true, dropped: 0 }, 'en-US')).toContain('did not')
    expect(describeResourceCandidates({ candidates: [candidate()], unreadable: false, dropped: 0 }, 'en-US')).toContain('candidate')
  })
})
