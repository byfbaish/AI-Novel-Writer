import { describe, expect, it } from 'vitest'
import {
  arcSpanForChapters,
  arcStructureNeedsRescale,
  parseArcStructure,
  renderArcPositionBlock,
  withArcPositionGuide,
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
