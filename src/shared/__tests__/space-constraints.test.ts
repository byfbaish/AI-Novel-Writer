import { describe, expect, it } from 'vitest'
import { extractSpaceConstraints, renderSpaceConstraintsBlock, withSpaceConstraints } from '../space-constraints'

/** 取自实机项目 `每天第一句谎话都会成真` 的世界观第 4 维（真实产出形态）。 */
const REAL_WORLDBUILDING = `### 3.【隐喻与深层危机】
略

---

### 4.【空间结构（地图与区域）】

城市沿一条纵贯线分布。空间不是背景，是**能力的使用条件**。

**长期舞台（全书反复出现）**

**梅林坳·39号出租屋**
一句话定位：主角的家，也是全城唯一可以「零触发」的地方。
关键规则：零点刷新点。若零点时他在屋内且独自一人，他可以选择整夜不说话，把当天的能力冻结到出门那一刻。

**老陈记早餐摊（梅林坳巷口）**
一句话定位：全城风险最高的地方，主角每天的第一个谎话大多诞生在此。
关键规则：7:00—10:00 营业，老板老陈爱搭话，客套话密度极高。主角在此说过「今天肯定迟到」之类的话——全部成真。

**康宁医院·六楼肾内科**
一句话定位：母亲住院的地方。
关键规则：探视时间固定（15:00—19:00），过时不让进。

**一次性与低频场景**

- **城市档案馆·旧报微缩胶片室**：一次性线索场景，主角在此查到「零号」痕迹。

---

### 5.【其他】
不应被摘录的内容
关键规则：这条属于别的段落，不能进清单。`

describe('extractSpaceConstraints', () => {
  it('摘录段内带关键规则的空间，且只限第 4 维', () => {
    const result = extractSpaceConstraints(REAL_WORLDBUILDING)
    expect(result.map(item => item.name)).toEqual([
      '梅林坳·39号出租屋',
      '老陈记早餐摊（梅林坳巷口）',
      '康宁医院·六楼肾内科',
    ])
    // 「一次性与低频场景」用 `- **名称**：描述` 的单行形态，没有关键规则 ⇒ 不进清单
    expect(result.some(item => item.name.includes('城市档案馆'))).toBe(false)
    // 段外的关键规则不得混入
    expect(result.some(item => item.rule.includes('别的段落'))).toBe(false)
  })

  it('保留关键规则原文（含时段），不做任何语义解析', () => {
    const result = extractSpaceConstraints(REAL_WORLDBUILDING)
    const stall = result.find(item => item.name.includes('老陈记'))
    expect(stall?.rule).toContain('7:00—10:00 营业')
  })

  it('小节标题与只有定位、没有关键规则的空间都被丢弃', () => {
    const result = extractSpaceConstraints([
      '### 4.【空间结构】',
      '',
      '**长期舞台（全书反复出现）**',
      '',
      '**某空间**',
      '一句话定位：只有定位，没有规则。',
    ].join('\n'))
    expect(result).toEqual([])
  })

  it('fail-open：找不到空间结构段 / 空输入 / 形状不符 ⇒ 空数组', () => {
    expect(extractSpaceConstraints('')).toEqual([])
    expect(extractSpaceConstraints(null)).toEqual([])
    expect(extractSpaceConstraints('### 1. 核心规则\n关键规则：与空间无关')).toEqual([])
  })

  it('en 版按 "Spatial structure" 定位，并支持 Name: role + rule 单行形态', () => {
    const en = [
      '### 4. Spatial structure (map and regions)',
      '',
      '- **Chen\u2019s Corner**: breakfast stall at the lane mouth; key rule: open 07:00\u201310:00, the owner chats up every customer.',
    ].join('\n')
    const result = extractSpaceConstraints(en)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Chen\u2019s Corner")
    expect(result[0].rule).toContain('07:00\u201310:00')
  })
})

describe('renderSpaceConstraintsBlock', () => {
  it('zh 渲染为带标题的独立清单', () => {
    const block = renderSpaceConstraintsBlock(REAL_WORLDBUILDING, 'zh-CN')
    expect(block).toContain('★【空间约束（硬）】')
    expect(block).toContain('老陈记早餐摊（梅林坳巷口）：7:00—10:00 营业')
    expect(block).toContain('不得为了剧情方便而忽略已声明的限制')
  })

  it('en 渲染为英文版', () => {
    const block = renderSpaceConstraintsBlock(
      ['### 4. Spatial structure', '', '- **Chen\u2019s Corner**: open 07:00\u201310:00.'].join('\n'),
      'en-US',
    )
    expect(block).toContain('[Space constraints (hard)]')
    expect(block).toContain('Chen\u2019s Corner')
  })

  it('摘录不到 ⇒ 空串（不注入）', () => {
    expect(renderSpaceConstraintsBlock('没有空间结构段', 'zh-CN')).toBe('')
  })
})

describe('withSpaceConstraints', () => {
  it('追加在原文之后，原文逐字保留', () => {
    const source = REAL_WORLDBUILDING
    const result = withSpaceConstraints(source, 'zh-CN')
    expect(result.startsWith(source.trimEnd())).toBe(true)
    expect(result).toContain('★【空间约束（硬）】')
  })

  it('fail-open：摘录不到时原样返回（字节级相同）', () => {
    const source = '### 1. 核心规则\n无关内容'
    expect(withSpaceConstraints(source, 'zh-CN')).toBe(source)
    expect(withSpaceConstraints(null, 'zh-CN')).toBe('')
  })

  it('幂等：对已含摘录块的文本再跑一次不会重复产出标题', () => {
    // 同一份世界观在链路里可能被多次装配（大纲 / 蓝图各自调用），
    // 重复注入会让清单翻倍 —— 这里锁定「块标题只出现一次」。
    const once = withSpaceConstraints(REAL_WORLDBUILDING, 'zh-CN')
    expect(once.match(/★【空间约束（硬）】/gu)).toHaveLength(1)
    const twice = withSpaceConstraints(once, 'zh-CN')
    expect(twice.match(/★【空间约束（硬）】/gu)).toHaveLength(1)
  })
})
