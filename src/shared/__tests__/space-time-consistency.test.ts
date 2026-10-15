import { describe, expect, it } from 'vitest'
import {
  findSpaceTimeConflicts,
  isWithinWindow,
  normalizeSpaceRefs,
  parseSpaceRules,
  parseTimeWindow,
  spaceTimeStableFactKey,
} from '../space-time-consistency'

/**
 * B′ 双写：空间—钟点**结构对结构**校验器。
 *
 * 测试的组织方式刻意区分两类断言：
 * - **正向**：确有可判定形式且矛盾 ⇒ 必须判 finding；
 * - **负向（更重要）**：没有可判定形式时**必须不判** —— 这是判据 ⑫（证明只管候选
 *   真正依赖的字段）与 Q4 边界（零语义解析）的落点，也是最容易写成误报的地方。
 */

/** 世界观第 4 维的最小可判定片段。 */
const WORLD = [
  '### 4.【空间结构（地图与区域）】',
  '老陈记：早餐摊，只做早市。',
  '老陈记｜hours=07:00-09:00｜entry=直接进入',
  '市立图书馆｜hours=09:00-17:00｜entry=需刷闸机',
  '夜市｜hours=22:00-02:00｜entry=自由进出',
  '车站：无固定时段。',
  '车站｜entry=凭票进入',
  '',
  '【具名人物登记】',
  '老陈｜老陈记早餐摊摊主｜"还是老样子，加辣？"｜主角每天早上的熟客',
].join('\n')

describe('parseTimeWindow', () => {
  it('接 24 小时制单点与区间', () => {
    expect(parseTimeWindow('14:00')).toEqual({ start: 840, end: 840 })
    expect(parseTimeWindow('07:00-09:00')).toEqual({ start: 420, end: 540 })
    expect(parseTimeWindow('22:00-02:00')).toEqual({ start: 1320, end: 120 })
  })

  it('接各种区间连接符与空白', () => {
    expect(parseTimeWindow('07:00–09:00')).toEqual({ start: 420, end: 540 })
    expect(parseTimeWindow('07:00 ~ 09:00')).toEqual({ start: 420, end: 540 })
    expect(parseTimeWindow(' 7:00-9:00 ')).toBeUndefined()
  })

  it('★ 不做语义推断：中文时段、个位小时、越界钟点一律 undefined', () => {
    for (const raw of ['早上', '下午两点', '白天', '9:00', '7:00-9:00', '24:00', '25:00', '12:60', '', '   ', '营业时间']) {
      expect(parseTimeWindow(raw), raw).toBeUndefined()
    }
  })

  it('非字符串一律 undefined', () => {
    for (const raw of [undefined, null, 42, {}, [], true]) expect(parseTimeWindow(raw)).toBeUndefined()
  })
})

describe('parseSpaceRules', () => {
  it('只收有机读 key 的行；散文行与具名人物登记行都不收', () => {
    const rules = parseSpaceRules(WORLD)
    expect(rules.map(rule => rule.space)).toEqual(['老陈记', '市立图书馆', '夜市', '车站'])
    // 具名人物登记行没有 `=` ⇒ 不被误当成空间。
    expect(rules.some(rule => rule.space === '老陈')).toBe(false)
  })

  it('解析 hours 与 entry，并保留原文取证', () => {
    const rules = parseSpaceRules(WORLD)
    expect(rules[0]).toMatchObject({ space: '老陈记', hours: { start: 420, end: 540 }, hoursRaw: '07:00-09:00', entry: '直接进入' })
    // 只有 entry、没有 hours ⇒ 该空间钟点不可判定。
    expect(rules[3]).toMatchObject({ space: '车站', entry: '凭票进入' })
    expect(rules[3]!.hours).toBeUndefined()
  })

  it('接半角竖线；接行首列表符号', () => {
    const rules = parseSpaceRules('- 茶馆 | hours=10:00-12:00 | entry=自由进出')
    expect(rules).toEqual([{ space: '茶馆', hours: { start: 600, end: 720 }, hoursRaw: '10:00-12:00', entry: '自由进出' }])
  })

  it('空 / 非字符串 / 无机读行 ⇒ []', () => {
    expect(parseSpaceRules('')).toEqual([])
    expect(parseSpaceRules('   ')).toEqual([])
    expect(parseSpaceRules(null)).toEqual([])
    expect(parseSpaceRules(undefined)).toEqual([])
    expect(parseSpaceRules('只是散文，没有任何机读行。')).toEqual([])
  })

  it('同一空间重复登记时后一条覆盖前一条（不静默合并矛盾规则）', () => {
    const rules = parseSpaceRules('茶馆｜hours=10:00-12:00\n茶馆｜hours=14:00-16:00')
    expect(rules).toEqual([{ space: '茶馆', hours: { start: 840, end: 960 }, hoursRaw: '14:00-16:00' }])
  })
})

describe('normalizeSpaceRefs', () => {
  it('接数组（主形态）', () => {
    expect(normalizeSpaceRefs([{ space: '老陈记', timeRef: '08:00', beat: '买早饭' }]))
      .toEqual([{ space: '老陈记', timeRef: { start: 480, end: 480 }, timeRefRaw: '08:00', beat: '买早饭' }])
  })

  it('接 JSON 串（存储列形态）', () => {
    expect(normalizeSpaceRefs('[{"space":"老陈记","timeRef":"08:00"}]'))
      .toEqual([{ space: '老陈记', timeRef: { start: 480, end: 480 }, timeRefRaw: '08:00' }])
  })

  it('非法 / 空 / 缺 space 的条目被丢弃，不抛错', () => {
    expect(normalizeSpaceRefs('not json')).toEqual([])
    expect(normalizeSpaceRefs('{"space":"甲"}')).toEqual([])
    expect(normalizeSpaceRefs(undefined)).toEqual([])
    expect(normalizeSpaceRefs([{ space: '' }, { space: '  ' }, 42, null, { timeRef: '08:00' }])).toEqual([])
  })

  it('无 timeRef 的引用保留（供 fail-open 判定）', () => {
    expect(normalizeSpaceRefs([{ space: '老陈记' }])).toEqual([{ space: '老陈记' }])
  })
})

describe('isWithinWindow', () => {
  it('普通窗口按闭区间', () => {
    const window = { start: 420, end: 540 }
    expect(isWithinWindow(420, window)).toBe(true)
    expect(isWithinWindow(480, window)).toBe(true)
    expect(isWithinWindow(540, window)).toBe(true)
    expect(isWithinWindow(419, window)).toBe(false)
    expect(isWithinWindow(541, window)).toBe(false)
  })

  it('跨零点窗口（22:00-02:00）按「晚段或早段」', () => {
    const window = { start: 1320, end: 120 }
    expect(isWithinWindow(1380, window)).toBe(true)  // 23:00
    expect(isWithinWindow(0, window)).toBe(true)     // 00:00
    expect(isWithinWindow(120, window)).toBe(true)   // 02:00
    expect(isWithinWindow(600, window)).toBe(false)  // 10:00
  })
})

describe('findSpaceTimeConflicts · 正向（有可判定形式且矛盾 ⇒ 必须判）', () => {
  it('钟点越界 ⇒ warning，且带冲突源层级', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 6, worldBuildingText: WORLD,
      spaceRefs: [{ space: '老陈记', timeRef: '14:00', beat: '买早饭' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', sourceChapter: 6, sourceLayer: 'blueprint' })
    expect(findings[0]!.issue.zhCN).toContain('14:00')
    expect(findings[0]!.issue.zhCN).toContain('07:00-09:00')
    // 冲突源提示必须指出「改第 6 章没用」这类层级信息。
    expect(findings[0]!.suggestion.zhCN).toContain('空间规则')
  })

  it('引用了未登记的空间名 ⇒ warning，冲突源指向世界观层', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 3, worldBuildingText: WORLD,
      spaceRefs: [{ space: '查无此店', timeRef: '08:00' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', sourceLayer: 'blueprint' })
    expect(findings[0]!.issue.zhCN).toContain('查无此店')
    expect(findings[0]!.suggestion.zhCN).toContain('世界观')
    expect(findings[0]!.suggestion.zhCN).toContain('第 3 章')
  })

  it('区间引用两端都越界 ⇒ 单条 finding 覆盖（不重复报两条）', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 2, worldBuildingText: WORLD,
      spaceRefs: [{ space: '老陈记', timeRef: '14:00-16:00' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.issue.zhCN).toContain('两端都')
  })

  it('区间引用只有一端越界 ⇒ 也判，措辞用「该钟点」', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 2, worldBuildingText: WORLD,
      spaceRefs: [{ space: '老陈记', timeRef: '08:00-14:00' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.issue.zhCN).toContain('该钟点')
  })

  it('跨零点空间的合法引用不判', () => {
    expect(findSpaceTimeConflicts({
      chapterNumber: 9, worldBuildingText: WORLD,
      spaceRefs: [{ space: '夜市', timeRef: '23:00' }, { space: '夜市', timeRef: '01:00' }],
    })).toEqual([])
  })

  it('跨零点空间的越界引用要判', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 9, worldBuildingText: WORLD,
      spaceRefs: [{ space: '夜市', timeRef: '10:00' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.severity).toBe('warning')
  })

  it('区间恰好落在窗口边界上算合法（闭区间）', () => {
    expect(findSpaceTimeConflicts({
      chapterNumber: 1, worldBuildingText: WORLD,
      spaceRefs: [{ space: '老陈记', timeRef: '07:00-09:00' }],
    })).toEqual([])
  })

  it('存储列形态（JSON 串）与数组形态判定结果一致', () => {
    const input = { chapterNumber: 4, worldBuildingText: WORLD }
    const array = findSpaceTimeConflicts({ ...input, spaceRefs: [{ space: '老陈记', timeRef: '14:00' }] })
    const stored = findSpaceTimeConflicts({ ...input, spaceRefs: '[{"space":"老陈记","timeRef":"14:00"}]' })
    expect(stored).toEqual(array)
  })
})

describe('findSpaceTimeConflicts · 负向（无可判定形式 ⇒ 必须不判）', () => {
  it('★ 设定层一条机读行都没有 ⇒ 整层不可判定，返回 []（旧项目零误报）', () => {
    const proseOnly = '### 4.【空间结构】\n老陈记：早餐摊，早上营业。\n图书馆：白天开门。'
    expect(findSpaceTimeConflicts({
      chapterNumber: 1, worldBuildingText: proseOnly,
      spaceRefs: [{ space: '老陈记', timeRef: '14:00' }],
    })).toEqual([])
  })

  it('★ 设定层为空 / 缺失 ⇒ 返回 []', () => {
    for (const world of ['', '   ', null, undefined]) {
      expect(findSpaceTimeConflicts({ chapterNumber: 1, worldBuildingText: world, spaceRefs: [{ space: '甲', timeRef: '14:00' }] })).toEqual([])
    }
  })

  it('★ 空间未声明 hours ⇒ 只记 info「未提供可判定形式」，不判冲突、不阻塞', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 5, worldBuildingText: WORLD,
      spaceRefs: [{ space: '车站', timeRef: '14:00' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'info', sourceLayer: 'world-building' })
    expect(findings[0]!.issue.zhCN).toContain('不判冲突')
  })

  it('★ 引用未声明 timeRef ⇒ 只记 info，源层级指向蓝图', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 5, worldBuildingText: WORLD,
      spaceRefs: [{ space: '老陈记' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'info', sourceLayer: 'blueprint' })
  })

  it('★ timeRef 不是合法 24 小时制（如「早上」）⇒ 视为未声明，只记 info', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 5, worldBuildingText: WORLD,
      spaceRefs: [{ space: '老陈记', timeRef: '早上' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.severity).toBe('info')
  })

  it('★ hours 不是合法 24 小时制（如「07:00–09:00」全角连字符可解析，但「早上」不可）⇒ 只记 info', () => {
    const world = '茶馆｜hours=早上｜entry=自由进出'
    const findings = findSpaceTimeConflicts({
      chapterNumber: 1, worldBuildingText: world,
      spaceRefs: [{ space: '茶馆', timeRef: '14:00' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.severity).toBe('info')
  })

  it('★ 蓝图没有 spaceRefs（空数组 / 缺字段 / 非法）⇒ 不判', () => {
    for (const refs of [[], undefined, null, '', 'not json', '{}', 42]) {
      expect(findSpaceTimeConflicts({ chapterNumber: 1, worldBuildingText: WORLD, spaceRefs: refs }), String(refs)).toEqual([])
    }
  })

  it('合法引用一律不判（无 finding 噪声）', () => {
    expect(findSpaceTimeConflicts({
      chapterNumber: 7, worldBuildingText: WORLD,
      spaceRefs: [
        { space: '老陈记', timeRef: '08:00', beat: '买早饭' },
        { space: '市立图书馆', timeRef: '10:00-16:00', beat: '查资料' },
        { space: '夜市', timeRef: '23:30' },
      ],
    })).toEqual([])
  })

  it('未命中空间名与钟点越界可以同时出现，各自独立成条', () => {
    const findings = findSpaceTimeConflicts({
      chapterNumber: 8, worldBuildingText: WORLD,
      spaceRefs: [{ space: '查无此店', timeRef: '08:00' }, { space: '老陈记', timeRef: '20:00' }],
    })
    expect(findings).toHaveLength(2)
    expect(findings.every(finding => finding.severity === 'warning')).toBe(true)
    expect(new Set(findings.map(finding => finding.stableFactKey)).size).toBe(2)
  })
})

describe('spaceTimeStableFactKey', () => {
  it('稳定且与连续性 finding 的命名空间隔离', () => {
    const key = spaceTimeStableFactKey(['unregistered-space', '1', '甲'])
    expect(key).toBe(spaceTimeStableFactKey(['unregistered-space', '1', '甲']))
    expect(key.startsWith('space:')).toBe(true)
    expect(key).not.toMatch(/^fact:/u)
  })

  it('不同事实 ⇒ 不同键', () => {
    expect(spaceTimeStableFactKey(['a', '1'])).not.toBe(spaceTimeStableFactKey(['a', '2']))
    expect(spaceTimeStableFactKey(['a', '1'])).not.toBe(spaceTimeStableFactKey(['b', '1']))
  })

  it('空白归一化：仅空白差异视为同一事实', () => {
    expect(spaceTimeStableFactKey(['unregistered-space', ' 甲 '])).toBe(spaceTimeStableFactKey(['unregistered-space', '甲']))
  })
})
