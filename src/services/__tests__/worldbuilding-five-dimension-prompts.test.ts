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
})
