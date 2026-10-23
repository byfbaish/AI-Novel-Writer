import { describe, expect, it } from 'vitest'

import {
  ABILITY_MAX_CHARS,
  ABILITY_MAX_ITEMS,
  abilityNameCandidates,
  abilityStageState,
  renderAbilityLine,
  renderAbilitySection,
  type PowerAbilityDefinition,
} from '../power-ability'

/**
 * P1-1 期 4b 能力（本书级能力规则）· 纯函数。
 *
 * 这一组守的不是排版，而是六件会决定生成质量的事：
 * 1. **三态**：`undated` 是主路径、`active` 才标章号、`ahead` 永不注入；
 * 2. **空字段产生零字节**：绝不写「未登记」（那会被读成「没有限制」，比不写更糟）；
 * 3. **`evidence_scope` 三档**：只有 `chapter` 允许出现「来源第 N 章」；
 * 4. **码元序排序**（不用 `localeCompare`，它的结果随宿主 locale 变）；
 * 5. **上限整条丢弃**，不截半行（截断的限制句会变成一条更宽松的规则）；
 * 6. **`form` 词表外原样渲染**（不设 CHECK 的证明）。
 */
const ability = (over: Partial<PowerAbilityDefinition> = {}): PowerAbilityDefinition => ({
  abilityId: 'ability:1',
  name: '噬魂推演录',
  form: '规则',
  hardLimit: '必须击杀仇敌后方可掠夺功法记忆',
  weakness: '蚀毒未清时强注灵力即经脉爆裂',
  costNote: '每次吞噬向天道发送一次坐标',
  stageChapter: null,
  stageNote: '',
  evidence: '',
  evidenceScope: null,
  source: 'author',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const entry = (over: Partial<PowerAbilityDefinition> = {}, chapter = 5) => {
  const value = ability(over)
  return { ability: value, state: abilityStageState(value, chapter) }
}

describe('abilityStageState（三态）', () => {
  it('未标章号 ⇒ undated（真实数据的主路径）', () => {
    expect(abilityStageState(ability({ stageChapter: null }), 5)).toBe('undated')
  })

  it('本章或更早 ⇒ active；晚于本章 ⇒ ahead', () => {
    expect(abilityStageState(ability({ stageChapter: 5 }), 5)).toBe('active')
    expect(abilityStageState(ability({ stageChapter: 3 }), 5)).toBe('active')
    expect(abilityStageState(ability({ stageChapter: 6 }), 5)).toBe('ahead')
    // 章号 0/负数不是「序章」，是非法数据。
    expect(() => abilityStageState(ability({ stageChapter: 0 }), 5)).toThrow('ABILITY_INVALID:stageChapter')
    expect(() => abilityStageState(ability(), 0)).toThrow('ABILITY_INVALID:chapterNumber')
  })
})

describe('renderAbilityLine（逐字对齐提案 §5）', () => {
  it('中文两行与提案样例逐字节一致', () => {
    expect(renderAbilityLine(entry({
      name: '噬魂推演录',
      form: '规则·功法·天赋混合',
      hardLimit: '必须击杀仇敌后方可掠夺功法记忆，每日只能承受一次超越境界的灵力注入',
      costNote: '每次吞噬向天道发送一次坐标，雷劫难度随之上升',
      weakness: '蚀毒未清时强注灵力即经脉爆裂',
    }), 'zh-CN')).toBe(
      '- 噬魂推演录（规则·功法·天赋混合；作者登记，未标章号）：硬限制——必须击杀仇敌后方可掠夺功法记忆，'
      + '每日只能承受一次超越境界的灵力注入；代价——每次吞噬向天道发送一次坐标，雷劫难度随之上升；'
      + '弱点——蚀毒未清时强注灵力即经脉爆裂',
    )
    expect(renderAbilityLine(entry({
      abilityId: 'ability:2',
      name: '每日一次的现实编辑权',
      form: '规则',
      hardLimit: '一天只有第一句、不可撤销、不可预知',
      costNote: '成真素材从最近的记忆里挪用',
      weakness: '当面指出这句话是假且尚未落地时，现实会打架',
    }), 'zh-CN')).toBe(
      '- 每日一次的现实编辑权（规则；作者登记，未标章号）：硬限制——一天只有第一句、不可撤销、不可预知；'
      + '代价——成真素材从最近的记忆里挪用；弱点——当面指出这句话是假且尚未落地时，现实会打架',
    )
  })

  it('三类限制全空 ⇒ 整段省略，且**不写「未登记」**（零字节）', () => {
    const line = renderAbilityLine(entry({
      name: '只有名字的能力', form: '', hardLimit: '', weakness: '', costNote: '',
    }), 'zh-CN')
    expect(line).toBe('- 只有名字的能力（作者登记，未标章号）')
    for (const forbidden of ['硬限制', '弱点', '代价', '未登记', 'undefined', 'null']) {
      expect(line).not.toContain(forbidden)
    }
  })

  it('单段为空只省略那一段，其余两段照常', () => {
    const line = renderAbilityLine(entry({ costNote: '', weakness: '' }), 'zh-CN')
    expect(line).toContain('硬限制——')
    expect(line).not.toContain('代价——')
    expect(line).not.toContain('弱点——')
  })

  it('active 标「自第 N 章起」；undated 绝不写「第 0 章」或「当前章」', () => {
    const active = renderAbilityLine(entry({ stageChapter: 3 }), 'zh-CN')
    expect(active).toContain('自第3章起')
    const undated = renderAbilityLine(entry({ stageChapter: null }), 'zh-CN')
    expect(undated).toContain('作者登记，未标章号')
    expect(undated).not.toContain('第0章')
    expect(undated).not.toContain('当前章')
  })

  it('evidence_scope = chapter：只有这一档渲染「来源第 N 章」', () => {
    const line = renderAbilityLine(entry({ stageChapter: 3, evidenceScope: 'chapter' }), 'zh-CN')
    expect(line).toContain('来源第3章')
  })

  it('evidence_scope = golden-finger：作者登记 + 出处域，渲染行里没有任何章号', () => {
    const line = renderAbilityLine(entry({ evidenceScope: 'golden-finger' }), 'zh-CN')
    expect(line).toContain('作者登记')
    expect(line).toContain('出处：金手指原文')
    expect(line).not.toMatch(/来源第\d+章/u)
    // undated 主路径下整行不出现任何章号（active 的「自第 N 章起」是作者填的阶段，不是出处）。
    expect(line).not.toMatch(/第\d+章/u)
  })

  it('evidence_scope = worldbuilding：作者登记 + 出处域，渲染行里没有任何章号', () => {
    const line = renderAbilityLine(entry({ evidenceScope: 'worldbuilding' }), 'zh-CN')
    expect(line).toContain('作者登记')
    expect(line).toContain('出处：世界观')
    expect(line).not.toMatch(/第\d+章/u)
  })

  it('非 chapter 档即便作者手填了阶段章号，行内也不出现任何章号（G4a 条件 1）', () => {
    // 阶段章号仍参与 ahead 过滤（未来行根本不进本节），但不许印在行里。
    for (const evidenceScope of ['golden-finger', 'worldbuilding'] as const) {
      const line = renderAbilityLine(entry({ stageChapter: 3, evidenceScope }), 'zh-CN')
      expect(line).not.toMatch(/第\d+章/u)
      expect(line).toContain('作者登记')
    }
  })

  it('evidence_scope = NULL：只写「作者登记」，不猜出处域', () => {
    const line = renderAbilityLine(entry({ evidenceScope: null }), 'zh-CN')
    expect(line).toContain('作者登记')
    expect(line).not.toContain('出处：')
    expect(line).not.toContain('来源第')
  })

  it('词表外的 form 原样渲染一字不差', () => {
    const exotic = '规则·功法·天赋混合（寄生于重生神魂）'
    expect(renderAbilityLine(entry({ form: exotic }), 'zh-CN')).toContain(`（${exotic}；`)
  })

  it('英文对称：结构相同，不是只翻一半', () => {
    const line = renderAbilityLine(entry({
      name: 'Soul Devour', form: 'rule',
      hardLimit: 'kill first', costNote: 'signal the heavens', weakness: 'meridian burst',
    }), 'en-US')
    expect(line).toBe('- Soul Devour (rule; author entry, no chapter): Hard limit \u2014 kill first; '
      + 'Cost \u2014 signal the heavens; Weakness \u2014 meridian burst')
    expect(renderAbilitySection([ability()], 'en-US', 5)).toContain('[Abilities (this book\'s ability rules')
  })
})

describe('renderAbilitySection', () => {
  it('空数组返回空串：没有登记就不留空标题（材料块逐字节不变）', () => {
    expect(renderAbilitySection([], 'zh-CN', 5)).toBe('')
  })

  it('ahead（未来章号）一律不注入，且不影响 active / undated', () => {
    const section = renderAbilitySection([
      ability({ abilityId: 'a:undated', name: '未标章号的能力', stageChapter: null }),
      ability({ abilityId: 'a:ahead', name: '未来才解锁的能力', stageChapter: 9 }),
      ability({ abilityId: 'a:active', name: '现在就能用的能力', stageChapter: 3 }),
    ], 'zh-CN', 5)
    expect(section).toContain('未标章号的能力')
    expect(section).toContain('现在就能用的能力')
    expect(section).not.toContain('未来才解锁的能力')
    expect(section.split('\n').filter(line => line.startsWith('- '))).toHaveLength(2)
  })

  it('只有 ahead 时整节不出现（不是只剩标题）', () => {
    expect(renderAbilitySection([ability({ stageChapter: 9 })], 'zh-CN', 5)).toBe('')
  })

  it('active 与 undated 混排，按 name 码元序（丙 < 乙 < 甲）', () => {
    const section = renderAbilitySection([
      ability({ abilityId: 'a:1', name: '甲', stageChapter: null }),
      ability({ abilityId: 'a:2', name: '丙', stageChapter: 3 }),
      ability({ abilityId: 'a:3', name: '乙', stageChapter: null }),
    ], 'zh-CN', 5)
    const lines = section.split('\n').filter(line => line.startsWith('- '))
    expect(lines.map(line => line.slice(2, 3))).toEqual(['丙', '乙', '甲'])
  })

  it('条数上限 5：超出的整条丢弃，不截半行', () => {
    const many = Array.from({ length: ABILITY_MAX_ITEMS + 2 }, (_, index) =>
      ability({ abilityId: `a:${index}`, name: `能力${index}` }))
    const section = renderAbilitySection(many, 'zh-CN', 5)
    expect(section.split('\n').filter(line => line.startsWith('- '))).toHaveLength(ABILITY_MAX_ITEMS)
    expect(section).not.toContain(`能力${ABILITY_MAX_ITEMS}`)
  })

  it('字数上限：单行就吃满预算时一条都不出，也不出半行', () => {
    expect(ABILITY_MAX_CHARS).toBeGreaterThan(100)
    expect(renderAbilitySection([ability()], 'zh-CN', 5, 10)).toBe('')
  })

  it('节首说明逐字包含「不得据此推定无限制」（缺了会被读成「没登记 = 没有限制」）', () => {
    const section = renderAbilitySection([ability()], 'zh-CN', 5)
    expect(section.split('\n')[0]).toBe('【能力（本书的能力规则：能做什么、要付什么、什么情况下会被破）】')
    expect(section).toContain('未登记的用法不在本节范围内，不得据此推定无限制。')
    expect(renderAbilitySection([ability()], 'en-US', 5))
      .toContain('must not be read as unlimited')
  })
})

describe('abilityNameCandidates（面板「从金手指原文取名字」）', () => {
  it('首行带「金手指名称：」与 Markdown 装饰时，标题提取干净', () => {
    expect(abilityNameCandidates('**金手指名称：噬魂推演录**\n\n来源机制：掠夺……'))
      .toEqual({ title: '噬魂推演录', quoted: '' })
  })

  it('首行没有名字时，引号短语作为第二候选（都市本 A 的形状）', () => {
    const text = '卖点清单：\n主角获得「每日一次的现实编辑权」，但不可撤销。'
    expect(abilityNameCandidates(text)).toEqual({
      title: '卖点清单：',
      quoted: '每日一次的现实编辑权',
    })
  })

  it('通篇没有名字时两个候选都可以为空（面板只剩手填，不编造）', () => {
    expect(abilityNameCandidates('2：主角不是全能的。\n1：被动触发。'))
      .toEqual({ title: '2：主角不是全能的。', quoted: '' })
    expect(abilityNameCandidates('')).toEqual({ title: '', quoted: '' })
  })
})
