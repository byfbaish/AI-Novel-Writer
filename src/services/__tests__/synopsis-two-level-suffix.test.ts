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
    // 落地方式是写死推理顺序并要求过程不外露；
    // 依据从「禁区」改为角色卡上带编号的三个档位（D1 日常 / D2 代价 / D3 破例）。
    expect(zh).toContain('只在内部走，过程一个字都不许写进输出')
    expect(zh).toContain('先读他的**性格倾向**')
    expect(zh).toContain('用当前「倾向」逐条筛')
    expect(zh).toContain('一个强项抵消不了一条倾向')
    expect(zh).toContain('取第一个剩下的，不是最好的那个')
    // 2026-10-29：选择行必须写依据 —— 「因为他的哪一条」永远能过关，「因为 D2」可以被查。
    // 同日作者裁定补了兜底路径：做法一条都对不上时退到底线，不许直接跳到 D0。
    expect(zh).toContain('① 他做的正是 D<n> 那条的当前「倾向」')
    expect(zh).toContain('③ 做法都对不上、但他碰到了底线 ⇒ 写「底线<n>」')
    expect(zh).toContain('④ 这一章确实没有他的戏 ⇒ 写 D0')
    expect(zh).toContain('⑤ 编号写了，但这一章的局面和那条的「局面」根本不是一类')
    expect(zh).toContain('必须把这个编号记下来')
    expect(en).toContain('Read his **standing tendencies** first')
    expect(en).toContain('Take the first survivor, not the best one')
    expect(en).toContain('A borrowed citation is no citation at all')
    expect(en).toContain('must carry D<n>')
    expect(en).toContain('③ no practice matches but a bottom line does ⇒ write "bottom <n>"')
    expect(en).toContain('④ the chapter truly has no scene of his ⇒ write D0')
    // 旧口径必须彻底消失，否则会与角色卡的倾向字段打成两份权威。
    expect(zh).not.toContain('做不出什么')
    expect(en).not.toContain('what he cannot bring himself to do')
  })

  it('成长 = 已登记的位移，且必须付代价', () => {
    expect(zh).toContain('② 不是，但这一章是 D<n> 里**已登记的位移点**')
    expect(zh).toContain('**写位移的那一章必须付代价**')
    expect(en).toContain('this chapter is a **registered Shift**')
    expect(en).toContain('must make him pay for it')
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

  // 2026-10-29 作者裁定：定性写「无」不等于「没有性格」。
  // 做法是他平日的习惯，底线是他这个人 —— 做法一条都对不上时要兜底到第一层底线，
  // 这是 try / catch 里的 catch，不是"这一章没他的戏"。这条守的是兜底措辞不许被改回去。
  it('定性写「无」时退到底线兜底，D0 只留给他不在场', () => {
    const zh = getSynopsisTwoLevelSuffix('zh-CN')
    const en = getSynopsisTwoLevelSuffix('en-US')
    expect(zh).toContain('没有现成做法，不等于没有性格')
    expect(zh).toContain('兜底路径')
    expect(zh).toContain('因为 底线<n>')
    expect(zh).toContain('确实没有他的戏')
    expect(en).toContain('No standing practice does not mean no character')
    expect(en).toContain('fallback path')
    expect(en).toContain('bottom <n>')
    expect(en).toContain('truly has no scene of his')
    // 底线的编号来自角色卡第一层，与第三层的 D 编号是两套，不许混
    expect(zh).toContain('底线<n>')
    expect(en).toContain('bottom <n>')
  })
})
