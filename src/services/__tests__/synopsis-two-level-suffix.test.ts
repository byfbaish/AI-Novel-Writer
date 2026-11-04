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

  it('保留选择行 / 钩子行 / 承接 / 因果代价 / 收束五块', () => {
    expect(zh).toContain('【选择：行的写法】')
    // D18：这一节 2026-11-04 从「收尾：行的写法」改名为「钩子：行的写法」。
    expect(zh).toContain('【钩子：行的写法】')
    expect(zh).toContain('【章与章的承接】')
    expect(zh).toContain('【每章正文写成一件事的因果与代价】')
    expect(zh).toContain('【材料只能从这四处取，且必须落在本章所属单元以内】')
    expect(zh).toContain('【收束】')
  })

  it('选择行按力源分面（4 + 2），不再是同面四选一', () => {
    // 依据 docs/design/prompt/choice-source-and-elimination-design.md：
    // 隐/迂/拖 等旧词横跨多个互斥面，压成一维必然交叉；改成力源四面 + 元层两个例外。
    expect(zh).toContain('力源只有四个值')
    expect(zh).toContain('另有两个**例外值**')
    for (const word of ['**自己**', '**他人**', '**规则**', '**交换**', '**破**', '**守**']) {
      expect(zh).toContain(word)
    }
    expect(zh).not.toContain('躲 = 回避接触')
    expect(zh).not.toContain('四选一')
    expect(en).toContain('The source of force has exactly four values')
    expect(en).toContain('Two **exception values**')
    expect(en).not.toContain('avoid = stay away from contact')
  })

  it('选择由角色做：读编号 + 淘汰顺序 + 满意化 + 四分支判定', () => {
    // 三条决策科学依据（Tversky 1972 EBA / Simon 满意化 / 非补偿性），
    // 落地方式是写死推理顺序并要求过程不外露。
    // 2026-10-29 深夜：依据从「第三层做法 D<n>」改成「禁区 X<n> / 筹码 / 软肋」——
    // 三格后做法层取消，禁区全书恒定所以可跨章引用，筹码与软肋按名字引用。
    expect(zh).toContain('只在内部走，过程一个字都不许写进输出')
    expect(zh).toContain('先读他的**禁区**')
    expect(zh).toContain('用当前「倾向」逐条筛')
    expect(zh).toContain('一个强项抵消不了一条倾向')
    expect(zh).toContain('取第一个剩下的，不是最好的那个')
    expect(zh).toContain('① 他做的正对得上 X<n> 那条禁区')
    expect(zh).toContain('③ 对不上任何禁区，但被某样筹码或软肋拿住了')
    expect(zh).toContain('④ 这一章确实没有他的戏 ⇒ 写「无」')
    expect(zh).toContain('必须把这个编号记下来')
    expect(en).toContain('Read his **forbidden lines** first')
    expect(en).toContain('Take the first survivor, not the best one')
    expect(en).toContain('A borrowed citation is no citation at all')
    expect(en).toContain('must carry X<n>')
    expect(en).toContain('③ nothing matches a forbidden line, but a chip or a soft spot is being held')
    expect(en).toContain('④ the chapter has no scene of his ⇒ write "none"')
    // 旧口径必须彻底消失，否则会与角色卡的三格打成两份权威。
    expect(zh).not.toContain('做不出什么')
    expect(zh).not.toContain('D0')
    expect(en).not.toContain('what he cannot bring himself to do')
    expect(en).not.toContain('D0')
  })

  it('破禁区必须付代价，且同一条不能被连着破三次', () => {
    expect(zh).toContain('② 他**破了** X<n> ⇒ 写「顶撞X<n>：<代价>」')
    expect(zh).toContain('**破了禁区的那一章必须付代价**')
    expect(zh).toContain('同一条禁区不能连着破三次')
    expect(en).toContain('② he **breaks** X<n> ⇒ write "break X<n>')
    expect(en).toContain('must make him pay for it')
    expect(en).toContain('the same line may not be broken three chapters running')
  })

  it('两条频率约束：守防拖沓、破防降神', () => {
    expect(zh).toContain('「守」不得连续三章出现')
    expect(zh).toContain('「破」必须有前置')
    expect(en).toContain('"Hold" must not appear in three consecutive chapters')
    expect(en).toContain('"Break" requires setup')
  })

  it('被否掉的选项必须在正文里真实存在', () => {
    expect(zh).toContain('被否掉的那个选项必须真的存在')
    expect(en).toContain('The ruled-out option must really exist')
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

  // 2026-10-29 深夜：兜底路径（做法对不上 → 退底线）随做法层一起取消。
  // 现在守的是「依据必须有名字」——「因为他的弱点」这种说法永远能过关，机器却无从校验。
  it('每一条依据都必须有名字，软肋允许登记前先引用', () => {
    const zh = getSynopsisTwoLevelSuffix('zh-CN')
    const en = getSynopsisTwoLevelSuffix('en-US')
    expect(zh).toContain('必须能在当前角色卡上或本章正文里指出对应物')
    expect(zh).toContain('不许写「他的弱点」「他的执念」这类没有名字的说法')
    expect(zh).toContain('软肋可以写卡上还没登记的')
    expect(zh).toContain('确实没有他的戏')
    expect(en).toContain('must name something you can point at')
    expect(en).toContain('never "his weakness" or "his obsession"')
    expect(en).toContain('soft spot may be named before it is registered')
    expect(en).toContain('truly has no scene of his')
    // 三种依据的名字必须都写进格式行，否则模型只会用其中一种
    for (const basis of ['X<n>：<那条禁区>', '筹码：<名字>', '软肋：<名字>']) expect(zh).toContain(basis)
    for (const basis of ['X<n>: <that forbidden line>', 'chip: <name>', 'soft spot: <name>']) expect(en).toContain(basis)
  })
})
