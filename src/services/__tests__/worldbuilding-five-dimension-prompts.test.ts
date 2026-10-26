import { describe, expect, it } from 'vitest'

import { getBuiltinPromptTemplate } from '../prompt-templates'
import { inspectWorldBuildingCompleteness } from '../../shared/worldbuilding-completeness'
import { extractWorldBuildingRules } from '../../shared/worldbuilding-rules'

/**
 * N1 守卫：第 1/2 维问句改硬后的合同。
 *
 * 为什么需要这个文件。改这两维的问句有三个连带面，类型检查全都看不见：
 *
 * ① **五维标题文字被顺手改了** ⇒ `locateWorldBuildingSections` 识别不到，日志变成
 *    「未能识别五维标题结构，本次未做齐备性检查」。标题是齐备性、规则抽取、空间约束
 *    三条链的共同锚点，动问句时最容易「顺手统一措辞」把它改掉。
 * ② **只改中文没改英文** —— 英文是 `prompt-language.ts` 里独立的一整套，
 *    漏改不会报错，只会让英文用户拿到旧问句。
 * ③ **硬要求写成陈述句** ⇒ 模型照抄后会被 `isRuleSentence` 当成世界规则抽走注入下游。
 *    那条排除逻辑只认 `QUESTION_PATTERNS`（以 `？` 结尾 / 含「是什么｜有哪些｜如何」等），
 *    所以「建议写成要求」与「写成要求」的区别，在抽取层就是一个问号。
 *
 * ③ 无法靠措辞完全消除（表格说明了「升级代价」这一列，词本身必须出现），
 * 所以这里不假装能守到零污染；改为**正向守住设计意图**：按新格式产出的等级阶梯表
 * 必须能被抽成规则（见最后一个用例）——列序不是排版偏好，是给 `candidatesOf` 用的，
 * 它取**末列**当规则正文。
 */
describe('N1 · 五维世界观第 1/2 维问句合同', () => {
  /** 模板里那五行 `### N. 标题` —— 模型要照抄的标题文字。 */
  function headingLines(language: 'zh-CN' | 'en-US'): string[] {
    const content = getBuiltinPromptTemplate('world_building', language)!.content
    return content.split('\n').map(line => line.trim()).filter(line => /^###\s*\d/u.test(line))
  }

  it.each(['zh-CN', 'en-US'] as const)('%s：五个维度标题仍能被齐备性检查识别（改问句不许动标题）', language => {
    const headings = headingLines(language)
    expect(headings).toHaveLength(5)

    const completeness = inspectWorldBuildingCompleteness(headings.join('\n'))
    expect(completeness.unreadable).toBe(false)
    expect(completeness.missing).toEqual([])
  })

  it.each([
    ['zh-CN', '体系漏洞', '等级阶梯', '等级名', '升级代价'],
    ['en-US', 'systemic hole', 'Progression ladder', 'Tier name', 'Advancement cost'],
  ] as const)('%s：第 1 维问到了标题承诺的「体系漏洞」，且要求等级阶梯表（末列为代价）', (language, hole, ladder, tierName, cost) => {
    const content = getBuiltinPromptTemplate('world_building', language)!.content
    // 标题「核心规则与体系漏洞」承诺了「漏洞」，旧模板两问里一次都没问过 —— 这是本条的存在理由。
    expect(content).toContain(hole)
    expect(content).toContain(ladder)
    // 列序：抽取器取**末列**，所以代价必须在最后一列。
    expect(content).toContain(tierName)
    expect(content).toContain(cost)
  })

  it.each([
    ['zh-CN', '攒满', '每一档各付什么'],
    ['en-US', 'keeps accumulating until it hits a threshold', 'What does each stage cost'],
  ] as const)('%s：第 1 维问到了「攒满的阈值」与「阶段性代价」', (language, threshold, stageCost) => {
    const content = getBuiltinPromptTemplate('world_building', language)!.content
    // 两格缺一不可（2026-10-26 作者现场发现「纹满遭天劫」没写多少算满）：
    // 只有边界没有坡度 ⇒ 中段读起来一样安全，紧张感全压在「满」那一章；
    // 只有坡度没有边界 ⇒ 读者不知道终点，先疲劳。行业里分别叫 capacity 与 escalating cost。
    expect(content).toContain(threshold)
    expect(content).toContain(stageCost)
  })

  it.each([
    ['zh-CN', '阶层能不能流动', '翻脸条件'],
    ['en-US', 'move between classes', 'breaking condition'],
  ] as const)('%s：第 2 维问到了「阶层流动」与「关系翻脸条件」', (language, mobility, breaking) => {
    const content = getBuiltinPromptTemplate('world_building', language)!.content
    expect(content).toContain(mobility)
    expect(content).toContain(breaking)
  })

  it.each([
    ['zh-CN', '禁止用不可判定的词代替刻度'],
    ['en-US', 'Do not substitute unjudgeable words for a scale'],
  ] as const)('%s：有禁止空泛刻度的条款', (language, clause) => {
    const content = getBuiltinPromptTemplate('world_building', language)!.content
    expect(content).toContain(clause)
  })

  it('按新格式产出的等级阶梯表能被抽成规则（末列承重，不是排版偏好）', () => {
    const output = [
      '### 1.【核心规则与体系漏洞】',
      '| **炼气** | 高一阶可压制三个低一阶 | 走火入魔 | 每月三块灵石 |',
      '| **筑基** | 跨一阶需两倍灵石 | 经脉逆行 | 每阶消耗一枚筑基丹 |',
    ].join('\n')
    const rules = extractWorldBuildingRules(output)
    expect(rules.map(rule => rule.dimension)).toEqual([1, 1])
    expect(rules.map(rule => rule.name)).toEqual(['炼气', '筑基'])
    // 取的是末列（升级代价），不是「相邻差距」或「卡点」——列序改了这条就会红。
    expect(rules[0]!.rule).toContain('每月三块灵石')
  })

  it('按新要求写出的分档代价能进第 1 维规则精选（但只认带模态词的那几档）', () => {
    const output = [
      '### 1.【核心规则与体系漏洞】',
      '| **炼气** | 高一阶可压制三个低一阶 | 走火入魔 | 每月三块灵石 |',
      '| **筑基** | 跨一阶需两倍灵石 | 经脉逆行 | 每阶一枚筑基丹 |',
      '等级最高到筑基封顶。',
      '道纹九道为满。',
      '第 1 到 3 道：无代价。',
      '第 4 到 6 道：寿元每次减一年。',
      '第 7 道起：瞒不住，宗门会盯着。',
      '第 9 道：天劫必至。',
    ].join('\n')
    const rules = extractWorldBuildingRules(output)
    // ★ 这条**如实记录现状，不是设计目标**（2026-10-27 实测）：
    // 抽取按 `RULE_MARKERS` 词表筛句、按原文行序每维只取前 3 条，于是
    // 「无代价」「每次」命中词表 ⇒ 分档进得去；「瞒不住」「必至」不在词表里 ⇒ 那两档进不去。
    // 最后一档抽不到**不影响正确性**：世界观原文另有整篇全量注入路径（首章在正文、
    // 后续章在 systemSuffix），精选清单只是 8 条预算内的聚焦，不是完整性保证。
    // 谁要动 `RULE_MARKERS`，先看这条会怎么变。
    expect(rules.every(rule => rule.dimension === 1)).toBe(true)
    expect(rules.some(rule => rule.rule.includes('无代价'))).toBe(true)
    expect(rules.some(rule => rule.rule.includes('必至'))).toBe(false)
  })
})
