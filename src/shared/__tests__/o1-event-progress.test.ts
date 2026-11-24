import { describe, expect, it } from 'vitest'
import {
  enforceEventProgress,
  eventBandOf,
  lastDeclaredStep,
  parseProgressLine,
  renderEventProgressHint,
  unitEventSteps,
} from '../o1-event-progress'
import { getBuiltinPromptTemplate } from '../../services/prompt-templates'
import {
  promptRenderSignature,
  synopsisInputFingerprintParts,
} from '../../services/workflows/commands/architecture.command'

/**
 * O1（卡 58188c1c）验收：单元内逐章事件进度水位。
 *
 * 口径以实施包 §0.3 / §3 为准（`b = to - from + 1`、带起点偏移 `s0`、上界钳 `M-1`），
 * 设计稿 §3.2 的「N = 已写章数」是算术错误（`k` 与 `N` 同步增长 ⇒ `band=[M,M]`），不按它实现。
 */

describe('J1 unitEventSteps：M 的唯一取法（复用 splitMinorSteps，不另写切分）', () => {
  it('空小弧列表 ⇒ []（M<2 ⇒ 本单元不声明水位）', () => {
    expect(unitEventSteps([])).toEqual([])
  })

  it('两个小弧各两步 ⇒ 4 步（M = 4）', () => {
    expect(unitEventSteps([
      { name: '甲', text: 'A→B' },
      { name: '乙', text: 'C->D' },
    ])).toEqual(['A', 'B', 'C', 'D'])
  })

  it('小弧 text 无箭头 ⇒ 该小弧计 1 步，用 name 兜底', () => {
    expect(unitEventSteps([{ name: '只有名字这件事', text: '一句没有箭头的话' }]))
      .toEqual(['只有名字这件事'])
  })

  it('小弧 text 缺省 ⇒ 1 步（旧项目弧光没有内容，不报错、不丢事件）', () => {
    expect(unitEventSteps([{ name: '开门' }])).toEqual(['开门'])
  })

  it('混合：有箭头的 2 步 + 无内容的 1 步 ⇒ 3 步', () => {
    expect(unitEventSteps([
      { name: '甲', text: '起点 → 必发事件' },
      { name: '乙' },
    ])).toEqual(['起点', '必发事件', '乙'])
  })
})

describe('J1b lastDeclaredStep：s0 的唯一解析点', () => {
  it('没有声明 ⇒ null（不推断、不顺延）', () => {
    expect(lastDeclaredStep('')).toBeNull()
    expect(lastDeclaredStep('## 第1章：雨夜\n正文一段，没有声明行。')).toBeNull()
  })

  it('多行只取最后一条（顺序颠倒时取的是靠后那条）', () => {
    expect(lastDeclaredStep('## 第1章：雨夜\n进度：E1\n## 第2章：门\n进度：E3')).toBe(3)
    expect(lastDeclaredStep('进度：E3\n进度：E1')).toBe(1)
  })

  it('形态全认：全角 / 半角冒号、en、行首尾空白', () => {
    expect(lastDeclaredStep('进度：E2')).toBe(2)
    expect(lastDeclaredStep('进度:E2')).toBe(2)
    expect(lastDeclaredStep('Progress: E2')).toBe(2)
    expect(lastDeclaredStep('Progress:E2')).toBe(2)
    expect(lastDeclaredStep('\n  进度：E4  \n')).toBe(4)
  })

  it('负例一律 null：缺数字 / 非数字 / 空 / 负号 / E 后带空格', () => {
    for (const line of ['进度:E', '进度：EX', '进度：E', '进度：-1', '进度：E 2']) {
      expect(lastDeclaredStep(line)).toBeNull()
    }
  })

  it('声明行夹在正文中间（前后都有说明文字）仍命中', () => {
    expect(lastDeclaredStep('前面一段说明\n进度：E2\n后面一段说明')).toBe(2)
  })

  it('前导零按数值认：进度：E03 ⇒ 3', () => {
    expect(lastDeclaredStep('进度：E03')).toBe(3)
  })

  it('parseProgressLine 只认整行（doctype 行内出现不算）', () => {
    expect(parseProgressLine('  进度：E2  ', 'zh-CN')).toBe(2)
    expect(parseProgressLine('本章进度：E2', 'zh-CN')).toBeNull()
    expect(parseProgressLine('进度：E2 之后又说了一句', 'zh-CN')).toBeNull()
    expect(parseProgressLine('Progress: E5', 'en-US')).toBe(5)
    expect(parseProgressLine('进度：E5', 'en-US')).toBeNull()
  })
})

describe('J2 eventBandOf：区间按 b（本批章数）+ s0（起点偏移）折算，上界钳 M-1', () => {
  const band = (chapterIndex: number, batchSize: number, startStep: number, stepCount: number) =>
    eventBandOf({ chapterIndex, batchSize, startStep, stepCount })

  it('s0=0、M=4、b=10：j=1 [0,1]、j=4 [1,2]、j=10 [3,3]', () => {
    expect(band(1, 10, 0, 4)).toEqual({ lower: 0, upper: 1 })
    expect(band(4, 10, 0, 4)).toEqual({ lower: 1, upper: 2 })
    expect(band(10, 10, 0, 4)).toEqual({ lower: 3, upper: 3 })
  })

  it('s0=3＝M-1：整批恒 [3,3]（重新折算不会把已走到的水位往回拉）', () => {
    for (let j = 1; j <= 10; j += 1) {
      expect(band(j, 10, 3, 4)).toEqual({ lower: 3, upper: 3 })
    }
  })

  it('s0=0、M=6、b=3：[1,2] [3,4] [5,5]（每章推进 2 步，区间宽度仍 ≤1）', () => {
    expect(band(1, 3, 0, 6)).toEqual({ lower: 1, upper: 2 })
    expect(band(2, 3, 0, 6)).toEqual({ lower: 3, upper: 4 })
    expect(band(3, 3, 0, 6)).toEqual({ lower: 5, upper: 5 })
  })

  it('s0=1、M=4、b=2：[2,2] [3,3]', () => {
    expect(band(1, 2, 1, 4)).toEqual({ lower: 2, upper: 2 })
    expect(band(2, 2, 1, 4)).toEqual({ lower: 3, upper: 3 })
  })

  it('全枚举 0≤s0<M≤12、1≤b≤10、1≤j≤b：0≤s0≤lower≤upper≤M-1 且 upper-lower≤1', () => {
    for (let stepCount = 2; stepCount <= 12; stepCount += 1) {
      const finalStep = stepCount - 1
      for (let startStep = 0; startStep < stepCount; startStep += 1) {
        for (let batchSize = 1; batchSize <= 10; batchSize += 1) {
          for (let chapterIndex = 1; chapterIndex <= batchSize; chapterIndex += 1) {
            const result = band(chapterIndex, batchSize, startStep, stepCount)!
            expect(result).not.toBeNull()
            expect(result.lower).toBeGreaterThanOrEqual(startStep)
            expect(result.lower).toBeLessThanOrEqual(result.upper)
            expect(result.upper).toBeLessThanOrEqual(finalStep)
            expect(result.upper - result.lower).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it('j=b 时上界恒 = M-1（终态，EV-1 的算术来源）', () => {
    for (let stepCount = 2; stepCount <= 12; stepCount += 1) {
      for (let startStep = 0; startStep < stepCount; startStep += 1) {
        for (let batchSize = 1; batchSize <= 10; batchSize += 1) {
          expect(band(batchSize, batchSize, startStep, stepCount)!.upper).toBe(stepCount - 1)
        }
      }
    }
  })

  it('非法入参 ⇒ null（越界 s0 / b<1 / M<2 / 非整数 / j<1）', () => {
    expect(band(1, 10, 4, 4)).toBeNull()
    expect(band(1, 0, 0, 4)).toBeNull()
    expect(band(1, 10, 0, 1)).toBeNull()
    expect(band(0, 10, 0, 4)).toBeNull()
    expect(band(1.5, 10, 0, 4)).toBeNull()
    expect(band(1, 10, -1, 4)).toBeNull()
  })
})

describe('J3 enforceEventProgress：EV-1..4 各两条边界（全部 fail-open）', () => {
  const enforce = (
    declarations: Array<{ chapterIndex: number; reached: number }>,
    options: { stepCount?: number; batchSize?: number; startStep?: number; unitComplete?: boolean } = {},
  ) => enforceEventProgress({
    stepCount: options.stepCount ?? 4,
    batchSize: options.batchSize ?? 10,
    startStep: options.startStep ?? 0,
    declarations,
    language: 'zh-CN',
    unitComplete: options.unitComplete ?? false,
  })
  const codes = (declarations: Array<{ chapterIndex: number; reached: number }>, options = {}) =>
    enforce(declarations, options).map(item => item.code)

  it('EV-1 只在 unitComplete===true 且末章声明不等于 M-1 时触发', () => {
    const findings = enforce([{ chapterIndex: 10, reached: 2 }], { unitComplete: true })
    expect(findings.map(item => item.code)).toContain('EV-1')
    expect(findings.find(item => item.code === 'EV-1')!.message).toBe('本单元事件未走完：末章停在 E2，共 E3')
    // 走到终态 ⇒ 不触发
    expect(codes([{ chapterIndex: 10, reached: 3 }], { unitComplete: true })).not.toContain('EV-1')
  })

  it('unitComplete=false 的两个来源各一条：末批但末章没写 / 非末批', () => {
    // 来源一：本批是单元末批、但名义末章没写出来（backfill.to < to）
    expect(codes([{ chapterIndex: 9, reached: 2 }], { unitComplete: false })).not.toContain('EV-1')
    // 来源二：本批根本不是单元末批
    expect(codes([{ chapterIndex: 10, reached: 1 }], { unitComplete: false })).not.toContain('EV-1')
  })

  it('EV-2：reached === upper 不触发，upper+1 触发', () => {
    expect(codes([{ chapterIndex: 1, reached: 1 }, { chapterIndex: 10, reached: 3 }])).not.toContain('EV-2')
    const findings = enforce([{ chapterIndex: 1, reached: 2 }])
    expect(findings.map(item => item.code)).toContain('EV-2')
    expect(findings.find(item => item.code === 'EV-2')!.message).toBe('第1章提前推进到 E2（上限 E1）')
  })

  it('EV-2：upper 已钳到 M-1，故上限处不存在可触发值', () => {
    // 末章 band=[3,3]，reached 上限就是 3（=M-1）；写 3 不报，写 4 已不合法但仍只报 EV-2
    expect(codes([{ chapterIndex: 10, reached: 3 }])).not.toContain('EV-2')
  })

  it('EV-3：reached === lower 不触发，lower-1 触发', () => {
    expect(codes([{ chapterIndex: 4, reached: 1 }])).not.toContain('EV-3')
    const findings = enforce([{ chapterIndex: 4, reached: 0 }])
    expect(findings.map(item => item.code)).toContain('EV-3')
    expect(findings.find(item => item.code === 'EV-3')!.message).toBe('第4章水位落后（下限 E1）')
  })

  it('EV-4：相邻两章相等不触发，回退触发', () => {
    expect(codes([{ chapterIndex: 1, reached: 2 }, { chapterIndex: 2, reached: 2 }], { stepCount: 6, batchSize: 3 }))
      .not.toContain('EV-4')
    expect(codes([{ chapterIndex: 1, reached: 2 }, { chapterIndex: 2, reached: 1 }], { stepCount: 6, batchSize: 3 }))
      .toContain('EV-4')
  })

  it('M<2 ⇒ 一律 []（不声明水位）', () => {
    expect(codes([{ chapterIndex: 1, reached: 0 }], { stepCount: 1, unitComplete: true })).toEqual([])
  })

  it('缺行 ＝ 未声明：没解析出「进度：」的章不参与任何一条，也不按上一章顺延', () => {
    // 只声明了第 1 章；第 2、3 章缺行 ⇒ 不产生它们的 EV-2/EV-3/EV-4 告警
    const findings = enforce([{ chapterIndex: 1, reached: 1 }], { stepCount: 6, batchSize: 3 })
    expect(findings.map(item => item.chapterIndex)).toEqual([])
  })

  it('declarations 乱序传入 ⇒ 内部先按 chapterIndex 排序，结果仍正确且不改入参', () => {
    const declarations = [{ chapterIndex: 3, reached: 5 }, { chapterIndex: 1, reached: 1 }]
    const before = declarations.map(item => item.chapterIndex)
    expect(codes(declarations, { stepCount: 6, batchSize: 3 })).toEqual([])
    expect(declarations.map(item => item.chapterIndex)).toEqual(before)
  })

  it('EV-4 文案写清上一章与本章的水位', () => {
    const findings = enforce([{ chapterIndex: 1, reached: 2 }, { chapterIndex: 2, reached: 1 }], { stepCount: 6, batchSize: 3 })
    expect(findings.find(item => item.code === 'EV-4')!.message).toBe('第2章水位回退（E2 → E1）')
  })

  it('en-US 文案同义（不阻断口径写在同一句族里）', () => {
    const findings = enforceEventProgress({
      stepCount: 4,
      batchSize: 10,
      startStep: 0,
      declarations: [{ chapterIndex: 10, reached: 2 }],
      language: 'en-US',
      unitComplete: true,
    })
    expect(findings.find(item => item.code === 'EV-1')!.message).toBe('This unit\'s events did not finish: the last chapter stopped at E2 of E3')
  })
})

describe('J4 指纹不变：只改渲染期 suffix，内置模板一个字节没动', () => {
  const expected = {
    synopsis: '',
    premise: '故事前提：主角在铁砧镇当学徒，宗门封锁后必须找到失落传承。',
    charactersArch: '角色图谱：主角、引导者、执法者。',
    worldbuilding: '世界观：灵脉决定城邦兴衰。',
    plotStructurePlan: '',
    genre: '玄幻',
    totalChapters: 100,
    wordsPerChapter: 3000,
    writingLanguage: 'zh-CN' as const,
    plotStructure: 'three_act',
    narrativePov: 'third_limited',
    globalGuidance: '保持因果推进。',
  }
  const range = { from: 1, to: 100 }
  // 与 architecture.command.test.ts 的 `stableTemplate` 同一份字面量（外部基准，不是从当前实现反算）。
  const stableTemplate = {
    key: 'synopsis',
    name: '稳定模板',
    description: '测试用模板',
    content: '正文',
    variables: {},
  }

  it('combined 与 D20 落地时的字面值逐字相等（存量大纲检查点不受影响）', () => {
    expect(synopsisInputFingerprintParts(expected, '', range, stableTemplate).combined).toBe('2mj55g')
  })

  it('promptRenderSignature 在内置 synopsis 模板上逐字不变（内置 systemSuffix 进签名，它变这条必红）', () => {
    // 常量按本卡首次实测写入；本卡只改渲染期 suffix、不碰内置模板，故改动前后同一值
    // （上面 `combined` 的 `2mj55g` 与 D20 外部基准逐字相等，是同一条断言的旁证）。
    expect(promptRenderSignature(getBuiltinPromptTemplate('synopsis', 'zh-CN')!, 'zh-CN')).toBe('t84789')
  })

  it('内置 systemSuffix 里没有「进度：」（新行只落在渲染期 suffix）', () => {
    expect(getBuiltinPromptTemplate('synopsis', 'zh-CN')!.systemSuffix ?? '').not.toContain('进度：E')
  })

  it('负用例：把一段 suffix 塞进临时模板 ⇒ combined 必变（证明上一条不是恒真）', () => {
    expect(synopsisInputFingerprintParts(expected, '', range, { ...stableTemplate, systemSuffix: '进度：E<n>' }).combined)
      .not.toBe('2mj55g')
  })
})

describe('J4c 冻结语义：同一入参可重放，换入参才换结果', () => {
  const input = { stepCount: 10, batchSize: 10, startStep: 0 }

  it('同参重复调用逐字相同', () => {
    const first = eventBandOf({ ...input, chapterIndex: 2 })
    const second = eventBandOf({ ...input, chapterIndex: 2 })
    expect(second).toEqual(first)
    const declarations = [{ chapterIndex: 2, reached: 3 }]
    const once = enforceEventProgress({ ...input, declarations, language: 'zh-CN', unitComplete: true })
    const twice = enforceEventProgress({ ...input, declarations, language: 'zh-CN', unitComplete: true })
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
  })

  it('batchSize 换了（10 → 8）⇒ 同一章 j=2 的区间必不同', () => {
    expect(eventBandOf({ chapterIndex: 2, stepCount: 10, batchSize: 10, startStep: 0 })).toEqual({ lower: 1, upper: 2 })
    expect(eventBandOf({ chapterIndex: 2, stepCount: 10, batchSize: 8, startStep: 0 })).toEqual({ lower: 2, upper: 3 })
  })

  it('startStep 换了（0 → 1，M=4、b=2）⇒ j=1 的区间必不同', () => {
    expect(eventBandOf({ chapterIndex: 1, stepCount: 4, batchSize: 2, startStep: 0 })).toEqual({ lower: 1, upper: 2 })
    expect(eventBandOf({ chapterIndex: 1, stepCount: 4, batchSize: 2, startStep: 1 })).toEqual({ lower: 2, upper: 2 })
  })
})

describe('J4d 未写章不预判：只对已声明章取值', () => {
  it('只写到第 6 章（b=6）⇒ 不产生第 7 章的告警', () => {
    const findings = enforceEventProgress({
      stepCount: 5,
      batchSize: 6,
      startStep: 0,
      language: 'zh-CN',
      unitComplete: false,
      declarations: [
        { chapterIndex: 1, reached: 0 },
        { chapterIndex: 2, reached: 1 },
        { chapterIndex: 3, reached: 2 },
        { chapterIndex: 4, reached: 3 },
        { chapterIndex: 5, reached: 3 },
        { chapterIndex: 6, reached: 4 },
      ],
    })
    expect(findings).toEqual([])
    expect(findings.some(item => item.chapterIndex > 6)).toBe(false)
  })

  it('unitComplete=false ⇒ 末章 reached<M-1 也不报 EV-1', () => {
    const findings = enforceEventProgress({
      stepCount: 5,
      batchSize: 6,
      startStep: 0,
      language: 'zh-CN',
      unitComplete: false,
      declarations: [{ chapterIndex: 6, reached: 3 }],
    })
    expect(findings.filter(item => item.code === 'EV-1')).toEqual([])
  })
})

describe('renderEventProgressHint：一行、两端示例、越界返回空串', () => {
  it('zh 一行（M=6、b=3、s0=0）', () => {
    expect(renderEventProgressHint({ stepCount: 6, batchSize: 3, startStep: 0 }, 'zh-CN'))
      .toBe('本单元事件进度：本单元共 6 步（E0–E5）；本批 3 章，起点 E0；第 1 章末应落在 E1–E2，第 3 章末应落在 E5–E5，即终态 E5。只核声明，不阻断生成。')
  })

  it('en 一行（同参数）', () => {
    expect(renderEventProgressHint({ stepCount: 6, batchSize: 3, startStep: 0 }, 'en-US'))
      .toBe('Event progress for this unit: 6 steps (E0–E5); 3 chapters in this batch starting from E0; chapter 1 should end at E1–E2, chapter 3 at E5–E5 (final state E5). Declaration only; generation is not blocked.')
  })

  it('M<2 / b<1 / s0 越界 ⇒ 空串（整行不出现，也不留空行）', () => {
    expect(renderEventProgressHint({ stepCount: 1, batchSize: 3, startStep: 0 }, 'zh-CN')).toBe('')
    expect(renderEventProgressHint({ stepCount: 6, batchSize: 0, startStep: 0 }, 'zh-CN')).toBe('')
    expect(renderEventProgressHint({ stepCount: 4, batchSize: 3, startStep: 4 }, 'zh-CN')).toBe('')
  })
})
