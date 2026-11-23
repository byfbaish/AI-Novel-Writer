/**
 * 判据 J1／J2 的单测（C1-a）。
 *
 * 夹具是派单点名的 5 张卡：仅关系 / 仅蓝图 / 仅大纲 / 全不中 / 全中。
 * 每张卡的「命中档」都是互斥构造的（名字互不为子串），所以某一张多出一档
 * 一定是实现真错了，不是夹具写松了。
 *
 * 变异对照（§5）：
 * - M1 去掉「同步记录为空 ⇒ 该档不产命中」守卫 ⇒ 「档② 未就绪」两条转红；
 * - M2 并集改交集（`hits.length === 3` 才算命中）⇒ 「三档全开＝全集」等转红。
 */

import { describe, expect, it } from 'vitest'

import {
  CHARACTER_RELEVANCE_ALL_LAYERS,
  blueprintDeclarationsFromSyncOperations,
  characterRelevance,
  characterRelevanceHits,
  characterRelevanceReasonSlots,
  characterRelevanceReasons,
  characterRelevanceVisible,
  compareCharactersByName,
  outlineSourceFromProjectCore,
  relevanceNameMatches,
  sortCharactersForDisplay,
  type CharacterRelevanceContext,
  type CharacterRelevanceEntry,
} from '../character-relevance'

const BLUEPRINT_NAME = '沈砚'
const ALL_HIT_NAME = '程婴'
const OUTLINE_ONLY_NAME = '老陈'
const NO_HIT_NAME = '无名氏'
const RELATION_ONLY_NAME = '程实'

/** 5 卡夹具：relationships 写成既有自由文本（editor 的「角色：关系」行）。 */
function cards(): CharacterRelevanceEntry[] {
  return [
    { name: RELATION_ONLY_NAME, relationships: '周德胜：债主\n老陈：邻居\n钱多多：房东' },
    { name: BLUEPRINT_NAME, relationships: '' },
    { name: OUTLINE_ONLY_NAME, relationships: '' },
    { name: NO_HIT_NAME, relationships: '' },
    { name: ALL_HIT_NAME, relationships: '沈砚：义子' },
  ]
}

function context(): CharacterRelevanceContext {
  return {
    blueprintDeclarations: [{ name: BLUEPRINT_NAME, chapters: [12, 37] }, { name: ALL_HIT_NAME, chapters: [37] }],
    outline: {
      synopsis: '老陈在清平里租下一间铺子，程婴替他看店。',
      plotStructurePlan: '第一卷收束在程婴离城。',
      worldbuilding: '清平里是旧城的商业街。',
    },
  }
}

const byName = (name: string, entries: readonly CharacterRelevanceEntry[]): CharacterRelevanceEntry => {
  const found = entries.find(entry => entry.name === name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

describe('characterRelevanceHits（判据 J1）', () => {
  it('return 的命中档固定按 关系 → 蓝图 → 大纲 排序且只含命中项', () => {
    const entries = cards()
    const ctx = context()
    expect(characterRelevanceHits(byName(RELATION_ONLY_NAME, entries), ctx)).toEqual(['relationship'])
    expect(characterRelevanceHits(byName(BLUEPRINT_NAME, entries), ctx)).toEqual(['blueprint'])
    expect(characterRelevanceHits(byName(OUTLINE_ONLY_NAME, entries), ctx)).toEqual(['outline'])
    expect(characterRelevanceHits(byName(NO_HIT_NAME, entries), ctx)).toEqual([])
    expect(characterRelevanceHits(byName(ALL_HIT_NAME, entries), ctx)).toEqual(['relationship', 'blueprint', 'outline'])
  })

  it('名字口径：中文逐字子串、英文大小写不敏感、空名字不匹配任何东西', () => {
    expect(relevanceNameMatches('老陈在清平里', '老陈')).toBe(true)
    expect(relevanceNameMatches('老陈在清平里', '陈')).toBe(true)
    expect(relevanceNameMatches('Alice Chen', 'alice')).toBe(true)
    expect(relevanceNameMatches('Alice Chen', 'CHEN')).toBe(true)
    expect(relevanceNameMatches('Alice Chen', '   ')).toBe(false)
    expect(relevanceNameMatches(null, 'Alice')).toBe(false)
  })
})

describe('三档并集与显示规则（J2 ① ② ⑥）', () => {
  it('① 三档全开时结果集＝未筛：5 张卡全部可见，且不会因"命中数不同"被丢掉', () => {
    const ctx = context()
    const visible = cards().filter(entry => characterRelevanceVisible(characterRelevance(entry, ctx), CHARACTER_RELEVANCE_ALL_LAYERS))
    expect(visible.map(entry => entry.name)).toEqual([
      RELATION_ONLY_NAME,
      BLUEPRINT_NAME,
      OUTLINE_ONLY_NAME,
      NO_HIT_NAME,
      ALL_HIT_NAME,
    ])
  })

  it('② 关档只减不增：关掉「关系对象」只让仅关系命中的卡消失，未命中的卡仍在列表里', () => {
    const ctx = context()
    const layers = { relationship: false, blueprint: true, outline: true }
    const visible = cards()
      .filter(entry => characterRelevanceVisible(characterRelevance(entry, ctx), layers))
      .map(entry => entry.name)
    expect(visible).toEqual([BLUEPRINT_NAME, OUTLINE_ONLY_NAME, NO_HIT_NAME, ALL_HIT_NAME])
    expect(visible).toHaveLength(4)
    // 只减不增：关档后的集合是全开集合的子集
    const all = cards().map(entry => entry.name)
    expect(visible.every(name => all.includes(name))).toBe(true)
  })

  it('② 逐档关闭：只关「蓝图声明」不会动到仅大纲／仅关系／未命中的卡', () => {
    const ctx = context()
    const visible = cards()
      .filter(entry => characterRelevanceVisible(characterRelevance(entry, ctx), { relationship: true, blueprint: false, outline: true }))
      .map(entry => entry.name)
    expect(visible).toEqual([RELATION_ONLY_NAME, OUTLINE_ONLY_NAME, NO_HIT_NAME, ALL_HIT_NAME])
  })

  it('⑥ 全不中：可见，且三档任一组合下都不会被隐藏', () => {
    const ctx = context()
    const entry = byName(NO_HIT_NAME, cards())
    for (const layers of [
      CHARACTER_RELEVANCE_ALL_LAYERS,
      { relationship: false, blueprint: true, outline: true },
      { relationship: false, blueprint: false, outline: false },
    ]) {
      expect(characterRelevanceVisible(characterRelevance(entry, ctx), layers)).toBe(true)
    }
  })
})

describe('命中原因（J2 ③ ④ ⑤ ⑦）', () => {
  it('③ 仅关系命中只出「关系」这一条，并带条数', () => {
    const relevance = characterRelevance(byName(RELATION_ONLY_NAME, cards()), context())
    expect(characterRelevanceReasons(relevance)).toEqual([{ layer: 'relationship', count: 3 }])
  })

  it('④ 仅蓝图命中只出「蓝图」这一条，并带章号（升序去重）', () => {
    const relevance = characterRelevance(byName(BLUEPRINT_NAME, cards()), context())
    expect(characterRelevanceReasons(relevance)).toEqual([{ layer: 'blueprint', chapters: [12, 37] }])
  })

  it('⑤ 仅大纲命中只出「大纲／世界观」这一条，并带命中字段', () => {
    const relevance = characterRelevance(byName(OUTLINE_ONLY_NAME, cards()), context())
    expect(characterRelevanceReasons(relevance)).toEqual([{ layer: 'outline', fields: ['synopsis'] }])
  })

  it('⑦ 三档全中时原因最多显示 2 条，其余收成 +N（N=1）', () => {
    const relevance = characterRelevance(byName(ALL_HIT_NAME, cards()), context())
    const slots = characterRelevanceReasonSlots(relevance)
    expect(slots.shown).toEqual([
      { layer: 'relationship', count: 1 },
      { layer: 'blueprint', chapters: [37] },
    ])
    expect(slots.hidden).toBe(1)
    // 展开后能拿到完整 3 条
    expect(characterRelevanceReasons(relevance)).toHaveLength(3)
  })

  it('⑦ 未命中时没有任何原因（组件据此显示「无剧情线索」）', () => {
    const relevance = characterRelevance(byName(NO_HIT_NAME, cards()), context())
    expect(characterRelevanceReasons(relevance)).toEqual([])
    expect(characterRelevanceReasonSlots(relevance)).toEqual({ shown: [], hidden: 0 })
  })
})

describe('档② 数据未就绪（J2 单列一条）', () => {
  it('同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态"', () => {
    const entries = cards()
    const notReady: CharacterRelevanceContext = { blueprintDeclarations: [], outline: context().outline }
    expect(() => characterRelevanceHits(byName(BLUEPRINT_NAME, entries), notReady)).not.toThrow()
    const relevance = characterRelevance(byName(BLUEPRINT_NAME, entries), notReady)
    expect(relevance.hits).toEqual([])
    expect(relevance.blueprintChapters).toEqual([])
    // 未就绪 ≠ 全不中：卡仍在列表里（隐藏卡才是错）
    expect(characterRelevanceVisible(relevance, CHARACTER_RELEVANCE_ALL_LAYERS)).toBe(true)

    // 三档全中那张只剩关系 + 大纲两档，说明档②单独失效、没有连坐
    expect(characterRelevanceHits(byName(ALL_HIT_NAME, entries), notReady)).toEqual(['relationship', 'outline'])

    // 传 undefined 与传空数组同义
    expect(characterRelevanceHits(byName(BLUEPRINT_NAME, entries), { outline: context().outline })).toEqual([])
  })
})

describe('排序两档（J2 ⑧）', () => {
  it('⑧「有剧情优先」按命中档数降序，同档数按名字', () => {
    const ctx = context()
    const sorted = sortCharactersForDisplay(cards(), 'relevance', ctx)
    // 唯一 3 档全中的卡必须在最前；全不中的卡在最后
    expect(sorted[0].name).toBe(ALL_HIT_NAME)
    expect(characterRelevanceHits(sorted[0], ctx)).toHaveLength(3)
    expect(sorted[sorted.length - 1].name).toBe(NO_HIT_NAME)
    // 沿序列命中档数单调不增
    const counts = sorted.map(entry => characterRelevanceHits(entry, ctx).length)
    expect(counts).toEqual([...counts].sort((left, right) => right - left))
    // 同档数的相邻项按名字升序（不写死中文排序，交给同一比较器判）
    for (let index = 1; index < sorted.length; index += 1) {
      if (counts[index] !== counts[index - 1]) continue
      expect(compareCharactersByName(sorted[index - 1], sorted[index])).toBeLessThanOrEqual(0)
    }
  })

  it('⑧「名字」按名字排序，与命中档数无关', () => {
    const ctx = context()
    const sorted = sortCharactersForDisplay(cards(), 'name', ctx)
    expect(sorted).toHaveLength(5)
    for (let index = 1; index < sorted.length; index += 1) {
      expect(compareCharactersByName(sorted[index - 1], sorted[index])).toBeLessThanOrEqual(0)
    }
    // 全不中的卡不会因为"没剧情"被挪走
    expect(sorted.map(entry => entry.name)).toContain(NO_HIT_NAME)
  })

  it('⑧ 排序稳定：主键相等（同名、同命中数）时保持入参顺序', () => {
    const ctx = context()
    const same: CharacterRelevanceEntry[] = [
      { name: '同名', relationships: '甲：邻居' },
      { name: '同名', relationships: '乙：债主' },
      { name: '同名', relationships: '丙：房东' },
    ]
    const expected = ['甲：邻居', '乙：债主', '丙：房东']
    expect(sortCharactersForDisplay(same, 'relevance', ctx).map(entry => entry.relationships)).toEqual(expected)
    expect(sortCharactersForDisplay(same, 'name', ctx).map(entry => entry.relationships)).toEqual(expected)
  })
})

describe('数据源归一', () => {
  it('蓝图同步记录：跨批次合并章号、升序去重、忽略无效行', () => {
    const declarations = blueprintDeclarationsFromSyncOperations([
      { characterSyncInput: [{ chapterNumber: 37, characters: [' 沈砚 ', '程婴'] }, { chapterNumber: 12, characters: ['沈砚'] }] },
      { characterSyncInput: [{ chapterNumber: 37, characters: ['沈砚'] }, { chapterNumber: 0 as number, characters: ['无效'] }] },
      { characterSyncInput: null },
    ])
    expect(declarations).toEqual([
      { name: '沈砚', chapters: [12, 37] },
      { name: '程婴', chapters: [37] },
    ].sort((left, right) => left.name.localeCompare(right.name)))
  })

  it('蓝图同步记录为空／缺字段时返回空数组（不抛错）', () => {
    expect(blueprintDeclarationsFromSyncOperations([])).toEqual([])
    expect(blueprintDeclarationsFromSyncOperations(null)).toEqual([])
    expect(blueprintDeclarationsFromSyncOperations([{}])).toEqual([])
  })

  it('项目核心三串：缺字段按空串、库列别名 plot_structure_plan 也认', () => {
    expect(outlineSourceFromProjectCore({ synopsis: '甲', plot_structure_plan: '乙', worldbuilding: '丙' }))
      .toEqual({ synopsis: '甲', plotStructurePlan: '乙', worldbuilding: '丙' })
    expect(outlineSourceFromProjectCore(null)).toEqual({ synopsis: '', plotStructurePlan: '', worldbuilding: '' })
  })
})
