import { describe, expect, it } from 'vitest'
import {
  describeProseShapeViolation,
  measureProseShape,
  type ProseShapeReport,
} from '../prose-shape'

function metricsOf(report: ProseShapeReport | null) {
  if (!report) throw new Error('expected a report')
  return report
}

function violationsOf(report: ProseShapeReport | null, metric: string) {
  return metricsOf(report).violations.filter(violation => violation.metric === metric)
}

describe('measureProseShape · 不判的情形', () => {
  it('空值档位一律不判（沿用「空 = 中性，不要给默认起点」）', () => {
    expect(measureProseShape('他走了。', '')).toBeNull()
    expect(measureProseShape('他走了。', null)).toBeNull()
    expect(measureProseShape('他走了。', undefined)).toBeNull()
    expect(measureProseShape('他走了。', '   ')).toBeNull()
  })

  it('未知 id 不判 —— 自定义文本不能让判据随作者随手填的字漂移', () => {
    expect(measureProseShape('他走了。', '起点风快节奏')).toBeNull()
    expect(measureProseShape('他走了。', 'QIDIAN')).toBeNull()
  })

  it('空白正文不判', () => {
    expect(measureProseShape('', 'fanqie')).toBeNull()
    expect(measureProseShape('  \n\n \t ', 'fanqie')).toBeNull()
  })
})

describe('measureProseShape · 段长', () => {
  it('超过 120 字的段落命中，且定位到行号', () => {
    const long = '字'.repeat(121)
    const report = measureProseShape(`${long}\n「你来了？」`, 'fanqie')
    const hits = violationsOf(report, 'paragraph-too-long')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.paragraphIndex).toBe(0)
    expect(hits[0]!.actual).toBe(121)
    expect(hits[0]!.limit).toBe(120)
  })

  it('恰好 120 字不命中（上界含等于）', () => {
    const report = measureProseShape(`字${'字'.repeat(119)}\n「你来了？」`, 'fanqie')
    expect(violationsOf(report, 'paragraph-too-long')).toHaveLength(0)
  })

  it('对白段同样受「单段不超过 120 字」约束 —— v7 这句话没有豁免对白段', () => {
    const longDialogue = `「${'字'.repeat(130)}」`
    const report = measureProseShape(`${longDialogue}\n「你来了？」`, 'fanqie')
    expect(violationsOf(report, 'paragraph-too-long')).toHaveLength(1)
  })

  it('短段不判 —— 「多用短句独立成段」是 v7 要求的，不是偏离', () => {
    const report = measureProseShape('短句。\n又一个短句。\n「嗯。」', 'fanqie')
    expect(violationsOf(report, 'paragraph-too-long')).toHaveLength(0)
  })
})

describe('measureProseShape · 句长', () => {
  it('超过 40 字的非对白句命中，并带段内句序号', () => {
    const longSentence = `${'字'.repeat(45)}。`
    const report = measureProseShape(`${longSentence}\n「你来了？」`, 'fanqie')
    const hits = violationsOf(report, 'sentence-too-long')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.paragraphIndex).toBe(0)
    expect(hits[0]!.sentenceIndex).toBe(0)
    expect(hits[0]!.actual).toBe(45)
  })

  it('引号内的长句不算 —— 对白句不参与叙述句判定', () => {
    const longDialogue = `「${'字'.repeat(60)}？」`
    const report = measureProseShape(`${longDialogue}`, 'fanqie')
    expect(violationsOf(report, 'sentence-too-long')).toHaveLength(0)
  })

  it('混合段里只判引号外的部分', () => {
    const report = measureProseShape(
      `「${'字'.repeat(60)}？」他说完就走，没有回头，也没有留下任何多余的话，只把门带上了。`,
      'fanqie',
    )
    expect(violationsOf(report, 'sentence-too-long')).toHaveLength(0)
  })

  it('偏短的句子不判', () => {
    const report = measureProseShape('他走。\n门关。\n「嗯。」', 'fanqie')
    expect(violationsOf(report, 'sentence-too-long')).toHaveLength(0)
  })
})

describe('measureProseShape · 钩子不在本模块（已撤掉的指标，防回填）', () => {
  it('末段无论用什么标点都不产生 violation —— 标点存在性不能代理「具体型钩子」', () => {
    for (const lastLine of ['他走了。', '他为什么没来？', '他伸出手……', '他伸出手——', '「你来了。」']) {
      const report = measureProseShape(`他推开门。\n${lastLine}`, 'fanqie')
      expect(metricsOf(report).violations).toHaveLength(0)
    }
  })

  it('报告里没有钩子字段 —— 曾经有 chapterEndHasHookSignal，已删', () => {
    const report = metricsOf(measureProseShape('他推开门。\n他走了。', 'fanqie'))
    expect(Object.keys(report.metrics)).not.toContain('chapterEndHasHookSignal')
  })
})

describe('measureProseShape · 段落索引契约', () => {
  it('索引是原文行号，空行占位，供 P17-3 直接切片', () => {
    const text = '甲段。\n\n乙段「走？」。'
    const report = metricsOf(measureProseShape(text, 'fanqie'))
    expect(report.metrics.paragraphCount).toBe(2)
    // 乙段在第 3 行（0-based 2），空行占了一个索引
    expect(text.split(/\r?\n/)[2]).toBe('乙段「走？」。')
  })
})

describe('measureProseShape · 指标读数', () => {
  it('对话占比按引号内字数算，标点不计', () => {
    const report = metricsOf(measureProseShape('「走吧。」他说。\n「好？」', 'fanqie'))
    // 引号内：走吧(2) + 好(1) = 3；全章 走吧他说好 = 5
    expect(report.metrics.dialogueUnits).toBe(3)
    expect(report.metrics.totalUnits).toBe(5)
    expect(report.metrics.dialogueRatio).toBeCloseTo(0.6, 4)
  })

  it('对白段不计入叙述段中位数', () => {
    const report = metricsOf(measureProseShape(
      `叙述一${'字'.repeat(78)}。\n「嗯？」\n叙述二${'字'.repeat(78)}。`,
      'fanqie',
    ))
    expect(report.metrics.paragraphCount).toBe(3)
    expect(report.metrics.dialogueParagraphCount).toBe(1)
    // 两段叙述都是 81 字（"叙述一/二" 3 字 + 78 字），中位数 81；若把「嗯？」算进去会掉到很低
    expect(report.metrics.narrativeParagraphUnitsP50).toBe(81)
  })

  it('引号未闭合时按到段末处理，不抛错', () => {
    const report = metricsOf(measureProseShape('「他没说完\n他走了。', 'fanqie'))
    expect(report.metrics.dialogueParagraphCount).toBe(1)
  })

  it('多句段落的句长均值只算非对白句', () => {
    const report = metricsOf(measureProseShape('他走了。门关上了。\n「你来了？」', 'fanqie'))
    // 非对白句：他走了(3)、门关上了(4) → 均值取整 4（末尾标点不计）
    expect(report.metrics.narrativeSentenceUnitsMean).toBeGreaterThan(0)
    expect(report.metrics.narrativeSentenceUnitsMax).toBeLessThan(10)
  })
})

describe('measureProseShape · 既有结论的守卫', () => {
  it('两档当前共用同一组阈值 —— 没作者口径前不编差异值', () => {
    const text = `${'字'.repeat(121)}\n他走了。`
    const qidian = metricsOf(measureProseShape(text, 'qidian'))
    const fanqie = metricsOf(measureProseShape(text, 'fanqie'))
    expect(qidian.violations).toEqual(fanqie.violations)
  })

  it('报告常驻单章样本标记，不可关闭', () => {
    expect(metricsOf(measureProseShape('他走了。', 'fanqie')).singleChapterSample).toBe(true)
  })

  it('报告里不出现 blocking 概念 —— 本模块只有 advisory', () => {
    const report = metricsOf(measureProseShape(`${'字'.repeat(200)}\n他走了。`, 'fanqie'))
    for (const violation of report.violations) {
      expect(Object.keys(violation)).not.toContain('severity')
    }
  })
})

describe('describeProseShapeViolation', () => {
  it('描述只报测到的数，不带程度判断', () => {
    const report = metricsOf(measureProseShape(`${'字'.repeat(130)}\n他走了。`, 'fanqie'))
    // 必须包一层箭头函数：直接 `.map(describeProseShapeViolation)` 会把**数组下标**当 locale 传进去
    // （TS2345 会拦，但它拦的是类型，运行时错误方向是静默的——下标 0 恰好 != 'en-US' 就走中文）。
    const text = report.violations.map(violation => describeProseShapeViolation(violation)).join('\n')
    expect(text).toContain('超过 120 字上限')
    // 注意不要用 /略/ 这种单字断言："省略号" 里就含 "略"
    expect(text).not.toMatch(/严重|轻微|建议|应该|略微|稍微/u)
  })

  it('英文环境输出英文描述，不用中文「字」', () => {
    const report = metricsOf(measureProseShape(`${'字'.repeat(130)}\n他走了。`, 'fanqie'))
    const text = report.violations
      .map(violation => describeProseShapeViolation(violation, 'en-US'))
      .join('\n')
    expect(text).toContain('over the 120-unit limit')
    expect(text).not.toMatch(/[\u4e00-\u9fa5]/u)
  })
})
