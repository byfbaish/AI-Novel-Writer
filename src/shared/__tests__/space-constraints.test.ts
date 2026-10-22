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

/**
 * 取自作者真实世界观（2026-10-22 第 4 维）：三列表格 + 末尾机读行代码块。
 * 原实现在这份数据上摘到 **0 条** ⇒ 整维规则从未进过 prompt。
 */
const AUTHORED_TABLE_WORLDBUILDING = `### 4.【空间结构（地图与区域）】

| 空间定位 | 一句话描述 | 关键规则 |
|---------|-----------|---------|
| **青阳山·杂役处** | 底层修士居住区，无围墙的临时落脚点 | 每日06:00-06:30 需签到否则扣除灵石额度；未经许可不得擅自离开山体范围 |
| **外门广场** | 内门巡视检查区，杂役必经之地 | 工作时间08:00-17:00 开放；其余时间禁入；巡查队出现时必须低头回避 |
| **试炼峰·聚气台** | 每月开放一次的晋升考核点 | 需在当月25日前登记报名；通过凝元境测试者获得转正资格；未通过者扣除三月贡献点 |
| **百草园·禁地方块** | 九转回魂草所在地，九重阵法环绕 | 每月1日起三天有效窗口期；需持有内门令牌且通过三重符阵验证；无权限者靠近即触发警报 |
| **执法殿·审讯室** | 宗门裁决争议的场所，阴森压抑 | 申请时间为每日14:00-16:00；提交材料需包含两名见证人签名；证据不足者当场定罪 |
| **藏书阁·外楼** | 普通功法存放地，残缺不全 | 阅览时间09:00-12:00；取阅时需归还等额价值物品作为押金；涉及禁忌内容者直接上报高层 |
| **废弃矿洞·地下三层** | 古战场遗迹，充满危险气息 | 无任何准入限制；夜间温度骤降至零下二十度；存在未知生物活动迹象 |
| **青冥海·边缘岛屿** | 神魔封印残余能量聚集地，后期重要场景 | 需金丹期修为方可抵御海水侵蚀；每月十五月圆之夜开启传送通道 |

**机读约束行：**

\`\`\`
青阳山·杂役处｜hours=06:00-06:30｜entry=需签到打卡
外门广场｜hours=08:00-17:00｜entry=禁止擅入
\`\`\`
`

describe('extractSpaceConstraints · markdown 表格形态', () => {
  it('摘到表格里的全部空间，且顺序与表格一致', () => {
    const result = extractSpaceConstraints(AUTHORED_TABLE_WORLDBUILDING)

    expect(result.map(item => item.name)).toEqual([
      '青阳山·杂役处',
      '外门广场',
      '试炼峰·聚气台',
      '百草园·禁地方块',
      '执法殿·审讯室',
      '藏书阁·外楼',
      '废弃矿洞·地下三层',
      '青冥海·边缘岛屿',
    ])
  })

  it('规则取最后一列原文，不做解析', () => {
    const result = extractSpaceConstraints(AUTHORED_TABLE_WORLDBUILDING)
    const trial = result.find(item => item.name.includes('试炼峰'))

    expect(trial?.rule).toContain('25日前登记报名')
    expect(trial?.rule).toContain('扣除三月贡献点')
    // 只取关键规则列，不把「一句话描述」拼进来
    expect(trial?.rule).not.toContain('晋升考核点')
  })

  it('机读行不被当成条目摘录（表头 / 分隔行 / 代码块都要跳过）', () => {
    const result = extractSpaceConstraints(AUTHORED_TABLE_WORLDBUILDING)

    // 机读行若被误摘，rule 里会出现 hours=
    expect(result.every(item => !item.rule.includes('hours='))).toBe(true)
    // 表头与分隔行不可成为条目名
    expect(result.every(item => !item.name.includes('空间定位'))).toBe(true)
    expect(result.every(item => !item.name.includes('---'))).toBe(true)
  })

  it('bold 与表格并存时取并集，同名只保留一条', () => {
    const mixed = [
      '### 4.【空间结构】',
      '',
      '**梅林坳·39号出租屋**',
      '关键规则：零点刷新点。',
      '',
      '| 空间定位 | 关键规则 |',
      '|---|---|',
      '| **梅林坳·39号出租屋** | 同一空间的另一条写法 |',
      '| **老陈记早餐摊** | 7:00—10:00 营业。 |',
    ].join('\n')

    const result = extractSpaceConstraints(mixed)

    expect(result.map(item => item.name)).toEqual(['梅林坳·39号出租屋', '老陈记早餐摊'])
    expect(result[0].rule).toContain('零点刷新点')
  })

  it('渲染块能带上表格摘到的规则', () => {
    const block = renderSpaceConstraintsBlock(AUTHORED_TABLE_WORLDBUILDING, 'zh-CN')

    expect(block).toContain('★【空间约束（硬）】')
    expect(block).toContain('青阳山·杂役处：每日06:00-06:30 需签到')
  })
})
