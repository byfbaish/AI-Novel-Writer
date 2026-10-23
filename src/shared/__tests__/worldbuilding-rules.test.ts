import { describe, expect, it } from 'vitest'

import { extractSpaceConstraints } from '../space-constraints'
import {
  extractWorldBuildingRules,
  renderWorldRuleLine,
  renderWorldRulesSection,
  WORLD_RULES_MAX_ITEMS,
} from '../worldbuilding-rules'

/**
 * 五维世界观的最小真实形态（照 `builtin-prompt-templates.ts:585-589` 的标题照抄）。
 *
 * 第 3 维故意写「终极谜团 / 零号档案」这类远期反转：它不是规则，而且**绝不能**出现在
 * 正文提示词的规则清单里（判据 DP —— 注入即剧透）。
 */
const FIVE_DIMENSIONS = `# 世界观

### 1.【核心规则与体系漏洞】

灵潮每甲子退潮一次，退潮期间所有术法消耗减半。
凡以血为引者，必须在三年内偿还同等灵力，否则经脉寸断。
修士每次越阶动用灵力，代价是当场折寿一年。
问：灵力的上限由什么决定？
灵根分为几等？

### 2.【阶层断层与资源战场】

外门弟子每月领取月例灵石三枚，逾期不补。
内门弟子不得超过外门的四成，超额须报备长老会。
每月初三是结算日，所有抽成一律按当日牌价换算。

### 3.【隐喻与深层危机】

本章永不揭晓的终极谜团：零号档案里记着谁的名字。
真正的深层危机是宗门本身即是一座囚笼，这是全书最后一章才揭示的反转。

### 4.【空间结构（地图与区域）】

**青阳山·杂役处**
一句话定位：底层修士居住区。
关键规则：每日06:00-06:30 需签到打卡。

**执法殿**
一句话定位：裁决与刑罚之地。
关键规则：每月十五日开启，须持长老令牌方可进入。

### 5.【时间历法（日序与周期）】

起点：太初元年正月初一，清晨。
一年十二月，每月三十日，无闰。
每旬逢五开市，闭市后禁止一切交易。
`

describe('extractWorldBuildingRules', () => {
  it('从五个维度里抽出条目，且每条都是原文的逐字子串（不编引文）', () => {
    const rules = extractWorldBuildingRules(FIVE_DIMENSIONS)
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      // 截断过的不可能是完整子串，所以这条断言只在未截断的条目上生效；
      // 本用例的条目都短于上限。
      expect(rule.rule).not.toContain('…')
      expect(FIVE_DIMENSIONS).toContain(rule.rule)
    }
    expect(rules.some(rule => rule.dimension === 1)).toBe(true)
    expect(rules.some(rule => rule.dimension === 2)).toBe(true)
    expect(rules.some(rule => rule.dimension === 4)).toBe(true)
  })

  it('第 5 维（历法/周期）也抽得到：周期本身就是规则', () => {
    const rules = extractWorldBuildingRules(`### 5.【时间历法（日序与周期）】

起点：太初元年正月初一，清晨。
一年十二月，每月三十日，无闰。
每旬逢五开市，闭市后禁止一切交易。
`)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.every(rule => rule.dimension === 5)).toBe(true)
    expect(rules.map(rule => rule.rule)).toContain('每旬逢五开市，闭市后禁止一切交易。')
  })

  it('第 3 维整维跳过：远期反转不得进规则清单（判据 DP）', () => {
    const rules = extractWorldBuildingRules(FIVE_DIMENSIONS)
    // `RuleDimension` 在类型上就不含 3，所以这条断言运行时是冗余的 ——
    // 留着是为了让读测试的人看到「第 3 维被排除」是刻意设计，而不是刚好没抽到。
    expect(rules.map(rule => rule.dimension as number)).not.toContain(3)
    expect(JSON.stringify(rules)).not.toContain('终极谜团')
    expect(JSON.stringify(rules)).not.toContain('零号档案')
  })

  it('疑问句不算规则：模板正文本身就是一串提问', () => {
    const rules = extractWorldBuildingRules(FIVE_DIMENSIONS)
    expect(JSON.stringify(rules)).not.toContain('灵力的上限由什么决定')
    expect(JSON.stringify(rules)).not.toContain('灵根分为几等')
  })

  it('第 4 维与 extractSpaceConstraints 同源（防第三份空间解析）', () => {
    const fromRules = extractWorldBuildingRules(FIVE_DIMENSIONS)
      .filter(rule => rule.dimension === 4)
      .map(rule => `${rule.name}→${rule.rule}`)
    const fromSpace = extractSpaceConstraints(FIVE_DIMENSIONS).map(entry => `${entry.name}→${entry.rule}`)
    expect(fromRules).toEqual(fromSpace)
  })

  it('单维最多 3 条、总计最多 8 条，超出部分整条丢弃', () => {
    const many = `### 1.【核心规则与体系漏洞】

甲必须每月缴纳一枚灵石。
乙不得在夜间外出。
丙只能使用木属性术法。
丁必须在三日内归还。
戊不得私斗。
己只能带一人随行。

### 2.【阶层断层与资源战场】

外门每月领取三枚。
内门不得超过四成。
长老会每月结算一次。

### 5.【时间历法（日序与周期）】

每旬逢五开市。
每年冬至闭市。
每月初一必须登记。
`
    const rules = extractWorldBuildingRules(many)
    expect(rules.length).toBe(WORLD_RULES_MAX_ITEMS)
    expect(rules.filter(rule => rule.dimension === 1).length).toBeLessThanOrEqual(3)
    // 第 9 条（第 5 维第三条）被总量上限切掉
    expect(JSON.stringify(rules)).not.toContain('每月初一必须登记')
  })

  it('超长句截断到 90 字并以省略号结尾', () => {
    const long = `### 1.【核心规则与体系漏洞】

修士必须 ${'灵'.repeat(120)} 否则经脉寸断。
`
    const rules = extractWorldBuildingRules(long)
    expect(rules.length).toBe(1)
    expect(rules[0].rule.endsWith('…')).toBe(true)
    expect(rules[0].rule.length).toBe(91)
  })

  it('空输入 / 识别不出维度 / 没有合格句一律返回空数组，不抛', () => {
    expect(extractWorldBuildingRules('')).toEqual([])
    expect(extractWorldBuildingRules(null)).toEqual([])
    expect(extractWorldBuildingRules(undefined)).toEqual([])
    expect(extractWorldBuildingRules('# 随便写的一段没有维度的散文。')).toEqual([])
    expect(extractWorldBuildingRules('### 1.【核心规则与体系漏洞】\n\n只有一句平铺直叙的描写。\n')).toEqual([])
  })
})

describe('renderWorldRuleLine / renderWorldRulesSection', () => {
  it('出处只标维度，绝不出现章号', () => {
    const line = renderWorldRuleLine({ dimension: 1, name: '', rule: '必须偿还同等灵力' }, 'zh-CN')
    expect(line).toBe('- （世界观·第 1 维【核心规则与体系漏洞】）必须偿还同等灵力')
    expect(line).not.toContain('章')
    expect(renderWorldRuleLine({ dimension: 2, name: '', rule: 'x' }, 'en-US'))
      .toContain('Worldbuilding · dimension 2 [Factions, hierarchy, and scarce resources]')
  })

  it('有名称时附在维度之后（空间名对「在哪不能做什么」是有用信息）', () => {
    expect(renderWorldRuleLine({ dimension: 4, name: '执法殿', rule: '须持令牌' }, 'zh-CN'))
      .toContain('【空间结构（地图与区域）】· 执法殿）')
  })

  it('空数组返回空串：不留只有标题的空节', () => {
    expect(renderWorldRulesSection([], 'zh-CN')).toBe('')
  })

  it('超预算整条丢弃，不截半句', () => {
    const rules = [
      { dimension: 1 as const, name: '', rule: '甲'.repeat(80) },
      { dimension: 2 as const, name: '', rule: '乙'.repeat(80) },
      { dimension: 5 as const, name: '', rule: '丙'.repeat(80) },
    ]
    const text = renderWorldRulesSection(rules, 'zh-CN', 120)
    expect(text).toContain('甲')
    expect(text).not.toContain('乙')
    expect(text).not.toContain('丙')
  })
})
