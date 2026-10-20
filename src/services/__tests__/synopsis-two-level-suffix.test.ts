import { describe, expect, it } from 'vitest'
import { getSynopsisTwoLevelSuffix } from '../prompts/synopsis-two-level-suffix'
import { ArchitecturePromptBuilder } from '../prompts/prompt-builder'
import { getBuiltinPromptTemplate } from '../prompt-templates'

/**
 * 两级结构版输出合同。
 *
 * 这些断言守的是 **2026-10-20 两次实证**：
 * - 模型被要求「ID 逐字取自『本批可声明的结构位』清单」、而清单在两级结构下不存在 ⇒ 自造
 *   `覆盖：V1-U1-Start` 等 ID，随「已完成大纲前缀」反复喂回；
 * - 总述里的「正文前的声明行（「覆盖：」与「选择：」）」被当成输出内容抄进每章正文。
 *
 * 所以这里断言的不是文采，是**不能出现哪些词** —— 少一条就等于把那个坑重新打开。
 */
describe('synopsis 两级结构版输出合同', () => {
  const zh = getSynopsisTwoLevelSuffix('zh-CN')
  const en = getSynopsisTwoLevelSuffix('en-US')

  it('中文版不再出现任何弧光三层词汇', () => {
    // 「结构位」留一处否定句（没有可声明的结构位），故只禁正面用法。
    for (const word of ['小弧', '中弧', '大弧', '本批可声明的结构位', '逐字取自']) {
      expect(zh).not.toContain(word)
    }
  })

  it('中文版显式禁止覆盖行与自造 ID', () => {
    expect(zh).toContain('严禁输出「覆盖：」行')
    expect(zh).toContain('不得自造任何形如 V1-U1-Start')
  })

  it('中文版显式禁止抄写格式说明', () => {
    expect(zh).toContain('严禁输出「正文前的声明行」')
    expect(zh).toContain('不得把本节任何一句话抄进正文')
  })

  it('保留选择行 / 收尾行 / 承接 / 因果代价 / 收束五块', () => {
    expect(zh).toContain('【选择：行的写法】')
    expect(zh).toContain('【收尾：行的写法】')
    expect(zh).toContain('【章与章的承接】')
    expect(zh).toContain('【每章正文写成一件事的因果与代价】')
    expect(zh).toContain('【材料只能从这四处取，且必须落在本章所属单元以内】')
    expect(zh).toContain('【收束】')
  })

  it('收束按卷 / 单元口径，不再讲「最后一个大弧的最后一个小弧」', () => {
    expect(zh).toContain('本卷最后一个单元')
    expect(zh).not.toContain('小弧')
  })

  it('保留作者指导占位符（由 PromptBuilder 统一插值）', () => {
    expect(zh).toContain('{{step_guidance}}')
    expect(en).toContain('{{step_guidance}}')
  })

  it('英文版同口径', () => {
    // 同上：「claimable arc slots」只出现在否定句里。
    for (const word of ['minor arc', 'mid arc', 'major arc']) {
      expect(en.toLowerCase()).not.toContain(word)
    }
    expect(en).toContain('Never output a "Covers:" line')
    expect(en).toContain('never invent identifiers')
  })

  it('正文里没有反引号（TS 模板字符串会提前闭合，且模型会照抄）', () => {
    expect(zh).not.toContain('`')
    expect(en).not.toContain('`')
  })
})

/**
 * 接线层：override 必须**只换本次渲染的 suffix**，不能改模板对象。
 *
 * 模板对象整体进 `synopsisInputsFingerprint`（`JSON.stringify(template)`），
 * 一旦被改动，已存在的大纲检查点会全部判成「源事实已变化」而拒绝续批。
 */
describe('PromptBuilder 的 systemSuffix 渲染期替换', () => {
  it('替换生效，且模板对象原样不动', () => {
    const template = getBuiltinPromptTemplate('synopsis', 'zh-CN')
    expect(template).toBeTruthy()
    const originalSuffix = template!.systemSuffix

    const built = new ArchitecturePromptBuilder(template!, 'zh-CN')
      .withCoreSeed('前提')
      .withPlotStructureGuide('结构')
      .withGlobalGuidance('全局')
      .withSystemSuffixOverride('【两级合同·标记】')
      .build()

    expect(built).toContain('【两级合同·标记】')
    // 原内置那份的独特句子必须消失（说明整段被换掉，不是追加）
    expect(built).not.toContain('ID 只能逐字取自')
    expect(template!.systemSuffix).toBe(originalSuffix)
  })

  it('没有 override 时行为不变', () => {
    const template = getBuiltinPromptTemplate('synopsis', 'zh-CN')!
    const built = new ArchitecturePromptBuilder(template, 'zh-CN')
      .withCoreSeed('前提')
      .withPlotStructureGuide('结构')
      .withGlobalGuidance('全局')
      .build()
    expect(built).toContain('ID 只能逐字取自')
  })
})
