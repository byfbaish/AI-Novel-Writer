import { describe, expect, it } from 'vitest'
import {
  arcSpanForChapters,
  auditArcDensity,
  arcStructureNeedsRescale,
  isTwoLevelArcStructure,
  parseArcStructure,
  projectArcStructureText,
  renderArcPositionBlock,
  splitMinorSteps,
  withArcPositionGuide,
  withProjectedArcGuide,
} from '../arc-position'

const PLAN = [
  '# 弧光结构',
  '',
  '【篇幅预算】',
  '总章数：845 章。',
  '',
  '## 大弧一：【规则初学】（约 100 章）',
  '- 类型：A 因果驱动型',
  '- 接续理由：开篇起点',
  '### 中弧 1：【生存与死线】（约 25 章）',
  '- 类型：A 因果驱动型',
  '- 因果：因为零点大幕开启，所以必须立即破解公寓规则求生。',
  '- 时序：本中弧起点 = 主角在休整区醒来。',
  '- 转折：发现规则存在「被刮平」的痕迹。',
  '- 小弧：【首夜敲门】（约 8 章）；【门缝纸条】（约 9 章）',
  '### 中弧 2：【工程题拆解】（约 25 章）',
  '- 类型：B 目标驱动型',
  '- 目标：从「背诵规则」进化到「寻找规则漏洞」。',
  '- 尝试 1：<观察字面歧义> → 结果 <利用「访客身份」规避停留限制>',
  '- 转折：观众弹幕开始嘲讽主角。',
  '### 中弧 3：【现实线锚点】（约 25 章）',
  '- 类型：C 探索型',
  '- 动机：寻找「妹妹语音」的来源与真假。',
  '### 中弧 4：【老猫入局】（约 25 章）',
  '- 类型：C 探索型',
  '- 动机：需要更多样本验证「执笔人」手法。',
  '## 大弧二：【规则博弈】（约 95 章）',
  '- 类型：A 因果驱动型',
  '### 中弧 1：【旧玩家围猎】（约 30 章）',
  '- 类型：A 因果驱动型',
  '- 因果：因为主角表现过于特殊而被标记为弃子。',
  '### 中弧 2：【指令延迟】（约 30 章）',
  '- 类型：B 目标驱动型',
  '- 目标：破解指令延迟的规律。',
  '### 中弧 3：【记忆样本】（约 35 章）',
  '- 类型：C 探索型',
  '- 动机：收集记忆样本。',
].join('\n')

describe('parseArcStructure', () => {
  it('parses major/mid arcs, their chapter counts and content fields', () => {
    const parsed = parseArcStructure(PLAN)!
    expect(parsed.majors).toHaveLength(2)
    expect(parsed.declaredTotal).toBe(195)
    expect(parsed.majors[0]!.name).toBe('规则初学')
    expect(parsed.majors[0]!.mids.map(mid => mid.name)).toEqual(['生存与死线', '工程题拆解', '现实线锚点', '老猫入局'])
    // 排版性字段（类型/接续理由）不进内容字段，小弧行也不进
    expect(parsed.majors[0]!.mids[0]!.fields.map(([name]) => name)).toEqual(['因果', '时序', '转折'])
    expect(parsed.majors[0]!.mids[1]!.fields.map(([name]) => name)).toEqual(['目标', '尝试 1', '转折'])
    // 「小弧」不进球内容字段，而是拆成带章数的独立条目（P12-3）——
    // 只有它自带章数，能折算成「第 10–18 章」这种精度。
    expect(parsed.majors[0]!.mids[0]!.minors).toEqual([
      { name: '首夜敲门', chapters: 8 },
      { name: '门缝纸条', chapters: 9 },
    ])
    expect(parsed.majors[0]!.mids[1]!.minors).toEqual([])
  })

  it('最后一条小弧带句读、并且带「小弧数」行时，条目一条都不许丢', () => {
    // 实测形态（2026-10-18 作者库）：每条中弧的最后一个小弧写成 `…（约9章）。`，
    // 只认 `$` 的正则会静默吞掉它，剩下的条目再按比例摊满整个中弧 —— 报错为零、
    // 区间全错。同一份弧光还带一行 `- 小弧数：本中弧25章÷10≈2–3 ⇒ 取3个。`，
    // 那是规划元数据，不是内容字段。
    const real = [
      '## 大弧一：【门牌错位与三方围猎】（约 1–50 章）',
      '### 中弧 1：【门牌错位与第一页报告】（约 25 章）',
      '- 转折：他发现漏洞物证同时被三家抢。',
      '- 小弧数：本中弧25章÷10≈2–3 ⇒ 取3个。',
      '- 小弧：错位门牌（约8章）；第一页报告（约8章）；三家人抢一张排班表（约9章）。',
      '- Σ小弧=8+8+9=25章，与本中弧25章差额0（0%）。',
    ].join('\n')
    const mid = parseArcStructure(real)!.majors[0]!.mids[0]!
    expect(mid.minors).toEqual([
      { name: '错位门牌', chapters: 8 },
      { name: '第一页报告', chapters: 8 },
      { name: '三家人抢一张排班表', chapters: 9 },
    ])
    expect(mid.fields.map(([name]) => name)).toEqual(['转折'])
  })

  it('returns null for an enum-style structure guide (no three-level arcs)', () => {
    expect(parseArcStructure('# 故事结构\n\n【三幕结构】\n第一幕：建置')).toBeNull()
    expect(parseArcStructure('')).toBeNull()
    expect(parseArcStructure(null)).toBeNull()
  })
})

/**
 * 回归：内置模板给模型的格式示范**本身就写区间**（`（约 X–Y 章）`）。
 * 原正则只认单值 → 作者按模板产出时 `chapters` 全为 0 → 结构被过滤为空 →
 * `parseArcStructure` 恒返回 null → 弧位块与弧光裁剪**从未生效**（静默失败）。
 */
describe('parseArcStructure · 区间章数标注（既有缺陷回归）', () => {
  // 与作者真实产出同形：大弧写区间、中弧写单值
  const REAL_SHAPE = [
    '# 弧光结构',
    '',
    '【篇幅预算】',
    '总章数：845 章。',
    '',
    '## 大弧一：第一个读墙的人（约 1–94 章）',
    '- 类型：A 因果驱动型',
    '- 接续理由：开篇起点',
    '### 中弧 1：无声公寓的六个夜晚（约 1–24 章）',
    '- 因果：因为他读了墙。',
    '### 中弧 2：休整区的第一批人（约 25–47 章）',
    '- 目标：从被动应付到主动拆解。',
    '## 大弧二：两个立法者（约 95–185 章）',
    '- 接续理由：因为大弧一末他读懂了墙。',
    '### 中弧 1：两套措辞（约 95–125 章）',
    '- 因果：因为出现了第二套规则。',
  ].join('\n')

  it('区间形式（约 1–94 章）算作 94 章，不再返回 null', () => {
    const parsed = parseArcStructure(REAL_SHAPE)
    expect(parsed).not.toBeNull()
    expect(parsed!.majors).toHaveLength(2)
    expect(parsed!.majors[0]!.chapters).toBe(94)
    expect(parsed!.majors[1]!.chapters).toBe(91)
    // 区间中弧同样算长度：1–24 ⇒ 24，25–47 ⇒ 23，95–125 ⇒ 31
    expect(parsed!.majors[0]!.mids.map(m => m.chapters)).toEqual([24, 23])
    expect(parsed!.majors[1]!.mids[0]!.chapters).toBe(31)
    // 区间大弧合计 94+91=185，用于折算声明
    expect(parsed!.declaredTotal).toBe(185)
  })

  it('单值与区间混用都能解析（模板示范就是混用）', () => {
    const mixed = [
      '## 大弧一：甲（约 100 章）',
      '### 中弧 1：乙（约 25 章）',
      '- 因果：x',
      '## 大弧二：丙（约 101–195 章）',
      '### 中弧 1：丁（约 30 章）',
      '- 因果：y',
    ].join('\n')
    const parsed = parseArcStructure(mixed)!
    expect(parsed.majors.map(m => m.chapters)).toEqual([100, 95])
    expect(parsed.declaredTotal).toBe(195)
  })

  it('区间解析后弧位可定位，弧位块不再为空（真实产出的核心收益）', () => {
    const parsed = parseArcStructure(REAL_SHAPE)!
    // 第 8–10 章应落在 大弧一 / 中弧 1
    const span = arcSpanForChapters(parsed, 845, 8, 10)!
    expect(span.majorName).toBe('第一个读墙的人')
    expect(span.midName).toBe('无声公寓的六个夜晚')
    // 折算：大弧 94/185 章 → 845 章下约 1–429；本中弧 24/47 章 → 约 1–219
    expect(span.majorRange).toEqual([1, 429])
    expect(span.midRange).toEqual([1, 219])
    const block = renderArcPositionBlock(parsed, 845, 8, 10, 'zh-CN')
    expect(block).not.toBe('')
    expect(block).toContain('所在中弧：中弧1【无声公寓的六个夜晚】')
    expect(block).toContain('等比折算') // 185 ≠ 845，必须声明折算
  })

  it('其他分隔符与全角/半角都认（– — ~ ～ -）', () => {
    for (const dash of ['–', '—', '~', '～', '-']) {
      const plan = `## 大弧一：甲（约 1${dash}94 章）\n### 中弧 1：乙（约 1 章）\n- 因果：x`
      const parsed = parseArcStructure(plan)
      expect(parsed, `dash=${dash}`).not.toBeNull()
      expect(parsed!.majors[0]!.chapters, `dash=${dash}`).toBe(94)
    }
  })

  it('P18：章数是可选信息，坏值/缺省都只降级为等权，不再让整份弧光作废', () => {
    // 从前：任何一条弧算不出章数 ⇒ `usable` 过滤 ⇒ 整份返回 null（弧位块静默失效）。
    // P18 起弧光层不做篇幅预算，章数只是折算刻度；算不出就按个数均分，不该连累全篇。
    // 算不出章数的三条：不报错、不丢弃，只是没有章数
    for (const plan of [
      '## 大弧一：甲（约 94–1 章）\n### 中弧 1：乙（约 1 章）\n- 因果：x',
      '## 大弧一：甲（约 0–94 章）\n### 中弧 1：乙（约 1 章）\n- 因果：x',
      '## 大弧一：甲\n### 中弧 1：乙\n- 因果：x',
    ]) {
      const parsed = parseArcStructure(plan)
      expect(parsed, plan).not.toBeNull()
      expect(parsed!.majors[0]!.chapters, plan).toBeUndefined()
    }
    // 大弧合法、中弧乱序：大弧照旧，只有中弧降级
    const half = parseArcStructure('## 大弧一：甲（约 1–94 章）\n### 中弧 1：乙（约 24–1 章）\n- 因果：x')!
    expect(half.majors[0]!.chapters).toBe(94)
    expect(half.majors[0]!.mids[0]!.chapters).toBeUndefined()
  })

  it('没有中弧的大弧不算可用结构（层级没拆出来，弧位块无意义）', () => {
    expect(parseArcStructure('## 大弧一：甲（约 94 章）\n- 因果：x')).toBeNull()
  })
})

describe('arcSpanForChapters', () => {
  const parsed = parseArcStructure(PLAN)!

  it('scales declared chapter counts onto the book total', () => {
    // 弧光自报 195 章，全书按 390 章折算（等比 2 倍）
    const span = arcSpanForChapters(parsed, 390, 30, 39)!
    expect(span.majorRange).toEqual([1, 200])
    expect(span.midRange).toEqual([1, 50])
    expect(arcStructureNeedsRescale(parsed, 390)).toBe(true)
    expect(arcStructureNeedsRescale(parsed, 195)).toBe(false)
  })

  it('locates the batch inside the right mid arc and lists what must not be pulled forward', () => {
    const span = arcSpanForChapters(parsed, 195, 26, 35)!
    expect(span.midName).toBe('工程题拆解')
    expect(span.midRange).toEqual([26, 50])
    expect(span.remainingMids.map(item => item.name)).toEqual(['现实线锚点', '老猫入局'])
    // 后续中弧带一句话定位，供模型识别"这些还不该发生"
    expect(span.remainingMids[0]!.gist).toContain('妹妹语音')
    expect(span.nextMidBoundary).toBeNull()
  })

  it('flags a batch that crosses a mid-arc boundary', () => {
    const span = arcSpanForChapters(parsed, 195, 20, 29)!
    expect(span.midName).toBe('生存与死线')
    expect(span.nextMidBoundary).toBe(26)
    expect(span.nextMidName).toBe('工程题拆解')
  })

  it('handles the last mid arc of the last major arc and rejects out-of-range input', () => {
    const last = arcSpanForChapters(parsed, 195, 190, 195)!
    expect(last.midName).toBe('记忆样本')
    expect(last.remainingMids).toHaveLength(0)
    expect(arcSpanForChapters(parsed, 195, 196, 200)).toBeNull()
    expect(arcSpanForChapters(parsed, 195, 0, 5)).toBeNull()
    expect(arcSpanForChapters(null, 195, 1, 5)).toBeNull()
  })

  /**
   * 回归（2026-10-14）：批 ≤10 章，但中弧可能更短 → 本批会跨越中弧边界。
   * 修复前只按 `from` 定位（`midIndex`），后半批所属的新中弧拿不到规格字段。
   */
  it('本批跨越中弧边界时标记覆盖到的最后一个中弧，且不再把它列为「后续」', () => {
    const cross = arcSpanForChapters(parsed, 195, 20, 29)!
    expect(cross.midName).toBe('生存与死线')
    expect(cross.endMidIndex).toBe(2) // 第 26–29 章已进入 中弧 2【工程题拆解】
    expect(cross.remainingMids.map(item => item.name)).toEqual(['现实线锚点', '老猫入局'])
    expect(cross.afterBatchMidBoundary).toBe(51) // 本批之后的第一个中弧起点
    // 跨界提示仍指向本批跨越的那个边界
    expect(cross.nextMidBoundary).toBe(26)
    expect(cross.nextMidName).toBe('工程题拆解')
  })

  it('未跨界时 endMidIndex 等于 midIndex（行为与从前一致）', () => {
    const within = arcSpanForChapters(parsed, 195, 26, 35)!
    expect(within.endMidIndex).toBe(within.midIndex)
    expect(within.remainingMids.map(item => item.name)).toEqual(['现实线锚点', '老猫入局'])
    expect(within.afterBatchMidBoundary).toBe(51)
  })

  it('本批走到本大弧末尾（或跨大弧）时，不再有本批之后的中弧', () => {
    const overMajor = arcSpanForChapters(parsed, 195, 95, 105)!
    expect(overMajor.majorName).toBe('规则初学')
    expect(overMajor.endMidIndex).toBe(4)
    expect(overMajor.remainingMids).toHaveLength(0)
    expect(overMajor.afterBatchMidBoundary).toBeNull()
  })
})

describe('renderArcPositionBlock / withArcPositionGuide', () => {
  const parsed = parseArcStructure(PLAN)!

  it('states the hard rule against executing later mid arcs early', () => {
    const block = renderArcPositionBlock(parsed, 195, 16, 25, 'zh-CN')
    expect(block).toContain('所在中弧：中弧1【生存与死线】')
    expect(block).toContain('不得在本批提前实现')
    expect(block).toContain('工程题拆解')
    // 折算只在需要时声明
    expect(block).not.toContain('等比折算')
    expect(renderArcPositionBlock(parsed, 390, 16, 25, 'zh-CN')).toContain('等比折算')
  })

  it('跨越中弧边界时，防提前的章号指向本批之后的中弧（2026-10-14 修复）', () => {
    const block = renderArcPositionBlock(parsed, 195, 20, 29, 'zh-CN')
    expect(block).toContain('本批跨越中弧边界：第 26 章起属于 中弧【工程题拆解】')
    // 修复前取 nextMidBoundary(26) ⇒ 写成"不得提前…属于第 26 章及以后"，与"本批含第 26–29 章"自相矛盾
    expect(block).toContain('它们属于第 51 章及以后')
    expect(block).not.toContain('它们属于第 26 章及以后')
    // 未跨界时与从前一致（下一个中弧起点 = 本中弧末尾 + 1）
    expect(renderArcPositionBlock(parsed, 195, 16, 25, 'zh-CN')).toContain('它们属于第 26 章及以后')
  })

  it('可声明清单只列「转折」与小弧，并且给出每个小弧的章号区间（P12-4 归属语义）', () => {
    const block = renderArcPositionBlock(parsed, 195, 1, 10, 'zh-CN')
    expect(block).toContain('M1-1/转折')
    // 只说「可以声明这些 ID」而不说「哪个覆盖哪几章」，模型只能猜 —— 实测猜成 5 章里 4 章写「无」。
    expect(block).toContain('M1-1/小弧:首夜敲门 — 第 1–12 章')
    expect(block).toContain('M1-1/小弧:门缝纸条 — 第 13–25 章')
    // 因果/时序 覆盖整个中弧区间，声明它们永远不越界 ⇒ 不列进可声明清单
    expect(block).not.toContain('M1-1/因果')
    expect(block).not.toContain('M1-1/时序')
    // 归属语义：小弧跨 8–9 章，这 8–9 章写同一个 ID 是对的，不是重复消费
    expect(block).toContain('本章章号落在哪个区间就写哪个')
    expect(block).toContain('这是对的，不是重复消费')
    expect(block).not.toContain('大多数章节应当写「覆盖：无」')
  })

  it('renderArcPositionBlock 在无小弧时只列「转折」；英文侧用同一套 ID', () => {
    const zh = renderArcPositionBlock(parsed, 195, 26, 35, 'zh-CN')
    expect(zh).toContain('M1-2/转折')
    expect(zh).not.toContain('M1-2/小弧:')
    const en = renderArcPositionBlock(parsed, 195, 1, 10, 'en-US')
    // 「小弧:」是固定的命名空间前缀，与写作语言无关 —— ID 只用于对账，不面向读者
    expect(en).toContain('M1-1/小弧:首夜敲门')
    expect(en).not.toContain('M1-1/Causality')
  })

  it('renders the English block and appends to the guide only when parseable', () => {
    expect(renderArcPositionBlock(parsed, 195, 16, 25, 'en-US')).toContain('[ARC POSITION for this batch')
    expect(withArcPositionGuide('GUIDE', PLAN, 195, 16, 25, 'zh-CN')).toContain('GUIDE\n\n【本批所处弧位')
    // 枚举兜底结构不注入 —— 行为与从前完全一致
    expect(withArcPositionGuide('GUIDE', '第一幕：建置', 195, 16, 25, 'zh-CN')).toBe('GUIDE')
    expect(renderArcPositionBlock(parseArcStructure('第一幕：建置'), 195, 16, 25, 'zh-CN')).toBe('')
  })
})

describe('projectArcStructureText · B 档分级裁剪', () => {
  const parsed = parseArcStructure(PLAN)!
  // 第 26–35 章落在 大弧一 / 中弧 2【工程题拆解】
  const span = arcSpanForChapters(parsed, 195, 26, 35)!
  const projected = projectArcStructureText(PLAN, span)

  it('本中弧保留全字段（本批的执行依据）', () => {
    expect(projected).toContain('### 中弧 2：【工程题拆解】（约 25 章）')
    expect(projected).toContain('目标：从「背诵规则」进化到「寻找规则漏洞」。')
    expect(projected).toContain('尝试 1：<观察字面歧义> → 结果 <利用「访客身份」规避停留限制>')
    expect(projected).toContain('转折：观众弹幕开始嘲讽主角。')
  })

  it('本大弧内的其他中弧降级为「标题 + 一句话定位」，丢弃其余字段', () => {
    expect(projected).toContain('### 中弧 3：【现实线锚点】（约 25 章）')
    expect(projected).toContain('动机：寻找「妹妹语音」的来源与真假。')
    // 该中弧的类型字段被丢弃（标题 + 一句话之外不注入）
    expect(projected).not.toContain('类型：C 探索型')
    expect(projected).toContain('### 中弧 4：【老猫入局】（约 25 章）')
    expect(projected).toContain('动机：需要更多样本验证「执笔人」手法。')
  })

  it('其他大弧只保留标题 + 接续理由，中弧与其余字段一律不注入', () => {
    expect(projected).toContain('## 大弧二：【规则博弈】（约 95 章）')
    expect(projected).not.toContain('旧玩家围猎')
    expect(projected).not.toContain('指令延迟')
    expect(projected).not.toContain('记忆样本')
    expect(projected).not.toContain('因为主角表现过于特殊而被标记为弃子')
  })

  it('保留其他大弧声明的接续理由（弧间推进是作者规划意图）', () => {
    const plan = [
      '# 弧光结构',
      '',
      '## 大弧一：【规则初学】（约 100 章）',
      '- 接续理由：开篇起点',
      '### 中弧 1：【生存与死线】（约 50 章）',
      '- 因果：必须立即破解公寓规则求生。',
      '### 中弧 2：【工程题拆解】（约 50 章）',
      '- 目标：寻找规则漏洞。',
      '## 大弧二：【规则博弈】（约 95 章）',
      '- 接续理由：因为大弧一末主角已被观察者标记，所以进入主动博弈。',
      '### 中弧 1：【旧玩家围猎】（约 95 章）',
      '- 因果：因为主角表现过于特殊而被标记为弃子。',
    ].join('\n')
    const localParsed = parseArcStructure(plan)!
    const localSpan = arcSpanForChapters(localParsed, 195, 1, 10)!
    const out = projectArcStructureText(plan, localSpan)
    expect(out).toContain('接续理由：因为大弧一末主角已被观察者标记，所以进入主动博弈。')
    expect(out).not.toContain('因为主角表现过于特殊而被标记为弃子')
  })

  it('引言（首个大弧之前的内容）原样保留', () => {
    expect(projected).toContain('【篇幅预算】')
    expect(projected).toContain('总章数：845 章。')
  })

  it('本批跨越中弧边界时，新进入的中弧同样保留全字段（2026-10-14 修复）', () => {
    const crossSpan = arcSpanForChapters(parsed, 195, 20, 29)!
    const out = projectArcStructureText(PLAN, crossSpan)
    // 本批覆盖的两个中弧都是本批的执行依据 → 都保留全字段
    expect(out).toContain('时序：本中弧起点 = 主角在休整区醒来。')
    expect(out).toContain('目标：从「背诵规则」进化到「寻找规则漏洞」。')
    expect(out).toContain('尝试 1：<观察字面歧义> → 结果 <利用「访客身份」规避停留限制>')
    // 仍未进入的中弧继续降级为「标题 + 一句话定位」
    expect(out).toContain('### 中弧 3：【现实线锚点】（约 25 章）')
    expect(out).not.toContain('类型：C 探索型')
  })

  it('定位到最后一个大弧时，其他大弧只留标题（其中弧全部降级）', () => {
    // 第 101–110 章落在 大弧二（1–100 为 大弧一）
    const lastSpan = arcSpanForChapters(parsed, 195, 101, 110)!
    expect(lastSpan.majorName).toBe('规则博弈')
    const out = projectArcStructureText(PLAN, lastSpan)
    // 其他大弧保留标题（给出"往哪去"的钩子），但其中弧一律不注入
    expect(out).toContain('## 大弧一：【规则初学】（约 100 章）')
    expect(out).not.toContain('生存与死线')
    expect(out).not.toContain('工程题拆解')
    // 本大弧的中弧保留
    expect(out).toContain('### 中弧 1：【旧玩家围猎】（约 30 章）')
    expect(out).toContain('因果：因为主角表现过于特殊而被标记为弃子。')
  })
})

describe('withProjectedArcGuide · 投影 + 弧位块', () => {
  it('裁剪后仍追加弧位硬约束块', () => {
    const out = withProjectedArcGuide(PLAN, PLAN, 195, 26, 35, 'zh-CN')
    expect(out).toContain('### 中弧 2：【工程题拆解】（约 25 章）')
    expect(out).toContain('【本批所处弧位')
    expect(out).toContain('不得在本批提前实现')
  })

  it('结构不可解析时原样返回（枚举故事结构行为与从前一致）', () => {
    expect(withProjectedArcGuide('第一幕：建置', '第一幕：建置', 195, 16, 25, 'zh-CN')).toBe('第一幕：建置')
    expect(withProjectedArcGuide('GUIDE', null, 195, 16, 25, 'zh-CN')).toBe('GUIDE')
  })

  it('本批越界定位不出弧位时不裁剪', () => {
    expect(withProjectedArcGuide(PLAN, PLAN, 195, 196, 200, 'zh-CN')).toBe(PLAN)
  })
})

describe('小弧内容（P13）：从「只有名字」升级为「名字 + 起点→事件→落点」', () => {
  const PLAN_WITH_CONTENT = [
    '## 大弧一：门牌错位（约 25 章）',
    '- 类型：A 因果驱动型',
    '- 接续理由：开篇起点',
    '### 中弧 1：门牌错位与第一页报告（约 25 章）',
    '- 类型：A 因果驱动型',
    '- 因果：因为"我马上到"成真，所以门牌集体错位。',
    '- 时序：本中弧起点 = 程实刚醒。',
    '- 转折：三家同时抢物证。',
    '- 小弧：',
    '  - 错位门牌（约 8 章）：17 号换成 71 号 → 街坊说法不一 → 找周德胜对质 → 拿到排班单 → 手里有物证但不知能证明什么',
    '  - 第一页报告（约 8 章）：观察科递来登记回执 → 沈砚上门问话 → 回执被拍照 → 被写进第一页报告',
    '  - 三家人抢一张排班表（约 9 章）：庄家找上门 → 自媒体直播围堵 → 物证被三家同时认领',
  ].join('\n')

  it('多行子项各自成一条，既不吞并、也不混进中弧字段', () => {
    const parsed = parseArcStructure(PLAN_WITH_CONTENT)!
    const mid = parsed.majors[0]!.mids[0]!
    expect(mid.minors.map(item => item.name)).toEqual(['错位门牌', '第一页报告', '三家人抢一张排班表'])
    expect(mid.minors.map(item => item.chapters)).toEqual([8, 8, 9])
    expect(mid.minors[0]!.text).toContain('17 号换成 71 号')
    // 子项若被 FIELD_LINE 吃掉，中弧会凭空多出三条叫「错位门牌（约 8 章）」的字段
    expect(mid.fields.map(([name]) => name)).toEqual(['因果', '时序', '转折'])
  })

  it('单行清单形态也能带内容（旧格式向后兼容）', () => {
    const oneLine = [
      '## 大弧一：A（约 50 章）',
      '### 中弧 1：B（约 25 章）',
      '- 小弧：甲（约 8 章）：起点甲 → 事件甲 → 落点甲；乙（约 9 章）：起点乙 → 事件乙 → 落点乙',
    ].join('\n')
    const minors = parseArcStructure(oneLine)!.majors[0]!.mids[0]!.minors
    expect(minors.map(item => item.name)).toEqual(['甲', '乙'])
    expect(minors.map(item => item.chapters)).toEqual([8, 9])
    expect(minors[1]!.text).toContain('事件乙')
  })

  it('没有内容时 text 为 undefined（旧弧光不因此变成空串或报错）', () => {
    const minors = parseArcStructure(PLAN)!.majors[0]!.mids[0]!.minors
    expect(minors.length).toBeGreaterThan(0)
    expect(minors[0]!.text).toBeUndefined()
  })

  it('小弧内容随「弧光结构」一起进入本批 prompt（投影不丢子项）', () => {
    const parsed = parseArcStructure(PLAN_WITH_CONTENT)!
    const span = arcSpanForChapters(parsed, 50, 1, 8)!
    const text = projectArcStructureText(PLAN_WITH_CONTENT, span)
    expect(text).toContain('17 号换成 71 号')
    expect(text).toContain('三家人抢一张排班表（约 9 章）')
  })
})

/**
 * P14：小弧「事件步数」与逐章进度上限。
 *
 * 实测背景（2026-10-18，作者 150 章弧光）：一条 8 章小弧给了 6 段事件，大纲**第 1 章
 * 就全部写完**，第 2–8 章越弧取材；而旧的硬约束 5 是「本批若只落在小弧前段才收着写」——
 * 批 1–10 覆盖整条 1–8 章弧时该条件不成立，守卫在最需要它的那一批里静默关掉（判据 BJ）。
 */
describe('小弧事件步与逐章进度上限（P14）', () => {
  const PLAN_WITH_STEPS = [
    '## 大弧一：门牌错位（约 25 章）',
    '- 类型：A 因果驱动型',
    '- 接续理由：开篇起点',
    '### 中弧 1：门牌错位与第一页报告（约 25 章）',
    '- 类型：A 因果驱动型',
    '- 因果：因为"我马上到"成真，所以门牌集体错位。',
    '- 时序：本中弧起点 = 程实刚醒。',
    '- 转折：三家同时抢物证。',
    '- 小弧：',
    '  - 错位门牌（约 8 章）：被周德胜敲门催租 → 他说"我马上到" → 三户门牌与记忆错位 → 老陈记常客争论谁住几号 → 记事本"今天不说谎"不算数 → 巷里出现第一处对不上的门牌',
    '  - 第一页报告（约 8 章）：观察科递来登记回执 → 沈砚上门问话 → 回执被拍照 → 被写进第一页报告',
    '  - 三家人抢一张排班表（约 9 章）：庄家找上门 → 直播围堵 → 物证被三家认领',
  ].join('\n')

  it('splitMinorSteps 按 → 切成有序步，起点与落点各占一步', () => {
    expect(splitMinorSteps('起点甲 → 事件乙 → 落点丙')).toEqual(['起点甲', '事件乙', '落点丙'])
    // 旧弧光没有内容、或没写 →：返回空数组，调用方退化为旧行为（fail-open）
    expect(splitMinorSteps(undefined)).toEqual([])
    expect(splitMinorSteps('只有一句没有箭头的描述')).toEqual([])
    // ASCII 箭头也认
    expect(splitMinorSteps('A -> B -> C')).toEqual(['A', 'B', 'C'])
  })

  it('P18 已撤回逐章上限：步数不再换算成「第 N 章→第 M 步」', () => {
    const parsed = parseArcStructure(PLAN_WITH_STEPS)!
    for (const language of ['zh-CN', 'en-US'] as const) {
      const block = renderArcPositionBlock(parsed, 25, 1, 10, language)!
      expect(block).not.toContain('逐章上限')
      expect(block).not.toContain('Per-chapter ceiling')
      expect(block).not.toContain('本弧共')
      expect(block).not.toContain('→第1步')
    }
    // 弧位块本身还在（小弧归属仍是可声明的结构位）
    expect(renderArcPositionBlock(parsed, 25, 1, 10, 'zh-CN')).toContain('小弧')
  })

  it('P18 弧光不写章数时，区间按**个数**均分（区间必须有来源，只是不再来自模型）', () => {
    const noChapters = `## 大弧一：开局
### 中弧 1：门牌
- 类型：A 因果驱动型
- 因果：上一段他刚醒，靠一句谎走进本中弧
- 小弧：
  - 【错位门牌】：目标 天亮前换回牌子 ｜ 赌注 换不回去就没了住处 ｜ 他刚醒 → 街坊各记一套 → 门牌全错
  - 【第一页报告】：目标 让报告上不出现他 ｜ 赌注 名字落上去就抹不掉 ｜ 观察科递来回执 → 有人上门问话 → 他被写进报告
  - 【三家抢单】：目标 把单子攥住 ｜ 赌注 交出去就是替人认账 ｜ 庄家上门 → 三家同时认领 → 谁都退不了
### 中弧 2：定价
- 类型：B 目标驱动型
- 目标：从撑过今天 到 摸清谁在定价
- 小弧：
  - 【加班】：目标 把第一句拖到零点 ｜ 赌注 零点前开口就白撑了 ｜ 他躲进棚里 → 登记来电 → 只能留到半夜
`
    const parsed = parseArcStructure(noChapters)!
    expect(parsed.majors[0]!.chapters).toBeUndefined()
    expect(parsed.majors[0]!.mids[0]!.minors.map(m => m.name)).toEqual(['错位门牌', '第一页报告', '三家抢单'])
    expect(parsed.majors[0]!.mids[0]!.minors[0]!.chapters).toBeUndefined()
    // 两个中弧等权 ⇒ 9 章对半分：中弧 1 拿第 1–5 章
    const span = arcSpanForChapters(parsed, 9, 1, 1)!
    expect(span.midRange).toEqual([1, 5])
  })

  it('P18 有章数与无章数混排：有章数的按比例，没章数的按 1 计权', () => {
    const mixed = `## 大弧一：开局
### 中弧 1：门牌
- 类型：A 因果驱动型
- 小弧：
  - 错位门牌（约 8 章）：他想换回牌子 → 街坊各记一套
  - 【第一页报告】：目标 让报告上不出现他 ｜ 赌注 名字落上去就抹不掉 ｜ 观察科递来回执 → 他被写进报告
`
    const parsed = parseArcStructure(mixed)!
    expect(parsed.majors[0]!.mids[0]!.minors.map(m => m.chapters)).toEqual([8, undefined])
    const span = arcSpanForChapters(parsed, 18, 1, 1)!
    expect(span.midRange).toEqual([1, 18])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// v7（2026-10-19）：行业词「卷 / 单元」+ 两级结构（没有小弧）
// ─────────────────────────────────────────────────────────────────────────────
const V7_PLAN = [
  '# 卷 / 单元结构',
  '',
  '【全书问题】程实能不能在零点前不把第一句话交出去？',
  '',
  '## 卷一：一句我马上到，整条巷门牌全歪了',
  '- 卷叙事任务：让读者看清第一句话是账单，不是许愿。',
  '- 进入状态：他把日子压到最小。',
  '- 离开状态：观察科立卷，黑市报价。',
  '- 换的阻力：熟人关心换成按天标价。',
  '- 结账：少了工卡，因为被登记；从此沈砚拿刷卡记录来问。',
  '- 时间密度：单日倒计时，因为额度零点翻篇。',
  '',
  '### 单元一：老陈问还是老样子，他点头点歪门牌',
  '- 叙事任务：立规则，代价落在最近的人身上。',
  '- 进入状态：刚醒，嘴比脑子快。',
  '- 离开状态：门牌错位，观察科第一次写进报告。',
  '- 段间推进：卷首，靠早上敷衍房东走到这里。',
  '- 逼法：老陈用关心逼他接话 → 结束时变成周德胜拿房租报新价（交手：堵门；档：关心→标价）',
  '',
  '### 单元二：鲁传福拿机器故障挡笔录，挡不住',
  '- 叙事任务：把代价从自己挪到鲁传福。',
  '- 进入状态：他躲进回声棚。',
  '- 离开状态：笔录落在鲁传福名下。',
  '- 段间推进：拿房租新价当由头躲进棚里。',
  '- 逼法：沈砚要他写书面说明 → 结束时变成把笔录落在鲁传福名下（交手：取证；档：标价→立卷）',
  '',
  '## 卷二：想销档案，先给观察科凑三处细节',
  '- 卷叙事任务：销档是拿三处细节换的。',
  '- 进入状态：工卡没了。',
  '- 离开状态：会用假合同把成真引到现成路径。',
  '- 换的阻力：观察科销档流程。',
  '- 结账：少了面摊灶位，因为场所封；从此庞大勇每天来问解封。',
  '- 时间密度：销档流程量级。',
  '',
  '### 单元一：沈砚拿销档表，换他一次配合',
  '- 叙事任务：把销档从愿望变成交易。',
  '- 进入状态：只剩配合这一条路。',
  '- 离开状态：销档表变成债务。',
  '- 段间推进：刷卡记录让沈砚有由头叫他。',
  '- 逼法：沈砚拿销档表换配合 → 结束时变成按三处细节补时间线（交手：取证；档：立卷→债务）',
].join('\n')

describe('v7 两级结构（卷 / 单元）', () => {
  it('认行业词标题，且中文序号可解析', () => {
    const parsed = parseArcStructure(V7_PLAN)
    expect(parsed).not.toBeNull()
    expect(parsed!.majors.map(m => m.name)).toEqual([
      '一句我马上到，整条巷门牌全歪了',
      '想销档案，先给观察科凑三处细节',
    ])
    expect(parsed!.majors[0]!.mids.map(m => m.name)).toEqual([
      '老陈问还是老样子，他点头点歪门牌',
      '鲁传福拿机器故障挡笔录，挡不住',
    ])
    // 没有小弧 —— 两级结构的定义特征
    expect(parsed!.majors[0]!.mids[0]!.minors).toEqual([])
  })

  it('两级判定：卷/单元为两级，旧「大弧/中弧」不是', () => {
    expect(isTwoLevelArcStructure(parseArcStructure(V7_PLAN))).toBe(true)
    expect(isTwoLevelArcStructure(parseArcStructure(PLAN))).toBe(false)
    expect(isTwoLevelArcStructure(null)).toBe(false)
  })

  it('弧位块换成「卷 / 单元」措辞，并给出可声明的「逼法」结构位', () => {
    const block = renderArcPositionBlock(parseArcStructure(V7_PLAN), 60, 1, 6, 'zh-CN')
    expect(block).toContain('所在卷：卷1【一句我马上到，整条巷门牌全歪了】')
    expect(block).toContain('所在单元：单元1【老陈问还是老样子，他点头点歪门牌】')
    // 两级结构的"转折"等价物是逼法：不给它，大纲层一个可声明位都没有
    expect(block).toContain('M1-1/逼法')
    expect(block).not.toContain('中弧')
    expect(block).not.toContain('小弧')
  })

  it('旧三级结构的弧位块措辞逐字不变', () => {
    const block = renderArcPositionBlock(parseArcStructure(PLAN), 845, 1, 20, 'zh-CN')
    expect(block).toContain('所在大弧：大弧1【')
    expect(block).toContain('所在中弧：中弧1【')
  })
})

describe('v7 两级体检：读（交手／档）标注，不猜语义', () => {
  const BAD = [
    '# 卷 / 单元结构',
    '## 卷一：门牌全歪了',
    '- 卷叙事任务：立规则。',
    '### 单元一：面摊',
    '- 叙事任务：立规则。',
    '- 逼法：老陈逼他接话 → 变成房东催租（交手：堵门；档：关心→立卷）',
    '### 单元二：巷口',
    '- 叙事任务：再立一次。',
    '- 逼法：邻居围门 → 变成房东再催（交手：堵门；档：立卷→立卷）',
  ].join('\n')

  it('相邻同类型 + 档位没动，两条都报', () => {
    const codes = auditArcDensity(parseArcStructure(BAD)).map(item => item.code)
    expect(codes).toContain('ARC_SAME_HAND_TYPE')
    expect(codes).toContain('ARC_TIER_STUCK')
  })

  it('正常两级结构（类型不同、档位爬升）零告警', () => {
    expect(auditArcDensity(parseArcStructure(V7_PLAN))).toEqual([])
  })

  it('没有标注的历史两级 plan 不报（v6 产出无从修）', () => {
    const legacyTwoLevel = V7_PLAN.replace(/（交手：[^）]*）/gu, '')
    expect(auditArcDensity(parseArcStructure(legacyTwoLevel))).toEqual([])
  })

  it('三级旧结构仍然走原来的七条，不被两级体检接管', () => {
    const codes = auditArcDensity(parseArcStructure(PLAN)).map(item => item.code)
    expect(codes).not.toContain('ARC_SAME_HAND_TYPE')
  })
})
