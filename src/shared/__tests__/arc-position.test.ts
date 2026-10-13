import { describe, expect, it } from 'vitest'
import {
  arcSpanForChapters,
  arcStructureNeedsRescale,
  parseArcStructure,
  projectArcStructureText,
  renderArcPositionBlock,
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
  })

  it('returns null for an enum-style structure guide (no three-level arcs)', () => {
    expect(parseArcStructure('# 故事结构\n\n【三幕结构】\n第一幕：建置')).toBeNull()
    expect(parseArcStructure('')).toBeNull()
    expect(parseArcStructure(null)).toBeNull()
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
