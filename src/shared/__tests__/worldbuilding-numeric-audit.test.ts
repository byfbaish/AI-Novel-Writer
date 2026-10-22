import { describe, expect, it } from 'vitest'
import {
  describeWorldBuildingNumericAudit,
  inspectWorldBuildingNumeric,
  parseChineseNumber,
  type NumericAuditResource,
} from '../worldbuilding-numeric-audit'

/** 取 A-1 类命中。 */
function dailyHoursFindings(text: string, resources?: readonly NumericAuditResource[]) {
  return inspectWorldBuildingNumeric(text, resources).findings.filter((finding) => finding.kind === 'daily-hours')
}

/** 取 A-2 类命中。 */
function ratioFindings(text: string, resources?: readonly NumericAuditResource[]) {
  return inspectWorldBuildingNumeric(text, resources).findings.filter((finding) => finding.kind === 'ratio-without-base')
}

/** A-3：同资源双单位。 */
function dualUnitFindings(text: string, resources?: readonly NumericAuditResource[]) {
  return inspectWorldBuildingNumeric(text, resources).findings.filter((finding) => finding.kind === 'dual-unit')
}

/** A-4：资源名疑似重复定义。 */
function duplicateDefinitionFindings(text: string, resources?: readonly NumericAuditResource[]) {
  return inspectWorldBuildingNumeric(text, resources).findings
    .filter((finding) => finding.kind === 'duplicate-resource-definition')
}

/** 登记表里最普通的一份：灵石（枚），下品灵石（枚）同族高一级。 */
const LINGSHI_REGISTRY: NumericAuditResource[] = [
  { name: '灵石', unit: '枚', familyId: 'spirit-stone', tier: 0 },
  { name: '下品灵石', unit: '枚', familyId: 'spirit-stone', tier: 1 },
]

describe('parseChineseNumber', () => {
  it('parses common Chinese numerals', () => {
    expect(parseChineseNumber('一')).toBe(1)
    expect(parseChineseNumber('两')).toBe(2)
    expect(parseChineseNumber('十二')).toBe(12)
    expect(parseChineseNumber('二十')).toBe(20)
    expect(parseChineseNumber('一百二十')).toBe(120)
    expect(parseChineseNumber('半')).toBe(0.5)
  })

  it('parses arabic numerals and rejects unparsable input', () => {
    expect(parseChineseNumber('24')).toBe(24)
    expect(parseChineseNumber('2.5')).toBe(2.5)
    expect(parseChineseNumber('若干')).toBeNull()
    expect(parseChineseNumber('')).toBeNull()
  })
})

describe('A-1 每日时间量 ≥ 24 小时', () => {
  it('hits a plain daily-total claim and reports the converted hours', () => {
    const findings = dailyHoursFindings('每日劳作十二时辰换取十枚下品灵石。')

    expect(findings).toHaveLength(1)
    expect(findings[0].dailyHours).toBe(24)
    expect(findings[0].quote).toContain('每日劳作十二时辰')
  })

  it('does not need to know what the verb means', () => {
    // 判定依据只有「每日 + 时间量」，与"炼气算不算工作"无关。
    for (const text of ['每日炼气十二时辰', '每日守阵十二时辰', '每日挖矿十二时辰', '每日搬砖十二时辰']) {
      expect(dailyHoursFindings(text), text).toHaveLength(1)
    }
  })

  it('accepts 每天 / 一日 / 一天 as daily markers and 个 as a measure word', () => {
    expect(dailyHoursFindings('每天守阵十二个时辰')).toHaveLength(1)
    expect(dailyHoursFindings('一天十二时辰都在赶路')).toHaveLength(1)
    expect(dailyHoursFindings('一日修习二十四小时')).toHaveLength(1)
  })

  it('sums the time amounts declared in one sentence', () => {
    const findings = dailyHoursFindings('每日劳作六个时辰，巡夜六个时辰')

    expect(findings).toHaveLength(1)
    expect(findings[0].dailyHours).toBe(24)
  })

  it('reads a time amount that falls into the next clause', () => {
    const findings = dailyHoursFindings('每日劳作，十二时辰不得歇息')

    expect(findings).toHaveLength(1)
    expect(findings[0].dailyHours).toBe(24)
  })

  it('stays quiet below the 24-hour threshold', () => {
    expect(dailyHoursFindings('每日劳作六个时辰')).toEqual([])
    expect(dailyHoursFindings('每日劳作六时辰，歇两个时辰')).toEqual([])
  })

  it('stays quiet without a daily marker', () => {
    // 这些都不是「每天如何」的声称：修行、守夜、特定日子。
    for (const text of ['打坐十二时辰', '一夜十二时辰', '每月初一劳作十二时辰']) {
      expect(dailyHoursFindings(text), text).toEqual([])
    }
  })

  it('flags a calendar conversion as a known false positive with neutral wording', () => {
    // 已知误报：历法换算说明。接受它 —— 为这一句引入词表，等于回到枚举的老路。
    const findings = dailyHoursFindings('一月三十日，每日十二时辰')

    expect(findings).toHaveLength(1)
    expect(describeWorldBuildingNumericAudit(inspectWorldBuildingNumeric('一月三十日，每日十二时辰'), 'zh-CN'))
      .toContain('请确认')
  })
})

describe('A-2 相对量缺分母', () => {
  it('hits a fraction with no stated base', () => {
    const findings = ratioFindings('药钱大概占据五分之一。')

    expect(findings).toHaveLength(1)
    expect(findings[0].quote).toContain('五分之一')
  })

  it('stays quiet once the base is stated', () => {
    expect(ratioFindings('药钱占收入的五分之一')).toEqual([])
    expect(ratioFindings('药钱占日常支出的五分之一')).toEqual([])
    expect(ratioFindings('药钱占月例的五分之一')).toEqual([])
  })

  it('treats percentages as ratio claims only inside a share context', () => {
    expect(ratioFindings('杂役每次抽成百分之三十')).toHaveLength(1)
    expect(ratioFindings('杂役每次抽成 30%')).toHaveLength(1)
    // 不是份额问题：基数是尝试次数，不是收入/支出。
    expect(ratioFindings('成功率百分之三十')).toEqual([])
  })
})

describe('inspectWorldBuildingNumeric / describe', () => {
  it('marks empty text unreadable and stays silent', () => {
    const result = inspectWorldBuildingNumeric('   \n  ')

    expect(result.unreadable).toBe(true)
    expect(result.findings).toEqual([])
    expect(describeWorldBuildingNumericAudit(result, 'zh-CN')).toBeUndefined()
  })

  it('returns no findings for a clean setting and stays silent', () => {
    const clean = [
      '# 世界观',
      '## 2.【阶层断层与资源战场】',
      '灵石是硬通货。每日劳作六个时辰可换十枚下品灵石，药钱占收入的五分之一。',
      '## 5.【时间历法（日序与周期）】',
      '起点：大衍历三年二月廿三，辰时。',
    ].join('\n')

    const result = inspectWorldBuildingNumeric(clean)

    expect(result.findings).toEqual([])
    expect(describeWorldBuildingNumericAudit(result, 'zh-CN')).toBeUndefined()
  })

  it('produces one neutral summary that never suggests a rewrite', () => {
    const text = '每日劳作十二时辰。药钱大概占据五分之一。'
    const summary = describeWorldBuildingNumericAudit(inspectWorldBuildingNumeric(text), 'zh-CN')

    expect(summary).toContain('2 处')
    expect(summary).toContain('不影响使用')
    expect(summary).toContain('请确认')
    // 判据 CJ：没有权威值时不产出可执行修改。
    expect(summary).not.toContain('应改为')
    expect(summary).not.toContain('建议改为')
  })

  it('gives each finding a stable key so the author can exempt it', () => {
    const first = inspectWorldBuildingNumeric('每日劳作十二时辰').findings[0]
    const second = inspectWorldBuildingNumeric('每日劳作十二时辰').findings[0]

    expect(first.key).toBe(second.key)
    expect(first.key).toMatch(/^worldbuilding-numeric:daily-hours:[0-9a-f]{8}$/)
  })

  it('summarises in English when asked', () => {
    const summary = describeWorldBuildingNumericAudit(
      inspectWorldBuildingNumeric('每日劳作十二时辰'),
      'en-US',
    )

    expect(summary).toContain('24 hours per day')
    expect(summary).toContain('not blocked')
  })
})

// ============================================================================
// W6a-3：A-3 同资源双单位 / A-4 资源名疑似重复定义
// ============================================================================

describe('A-3 同资源双单位', () => {
  it('hits when one resource is written with two different units in one paragraph', () => {
    const text = '灵石（枚）是硬通货。灵石（块）用于大额交易。'
    const findings = dualUnitFindings(text, LINGSHI_REGISTRY)

    expect(findings).toHaveLength(1)
    expect(findings[0].resourceName).toBe('灵石')
    expect(findings[0].units).toEqual(['枚', '块'])
    // 引的是「第二种单位」那一句 —— 它才是把两种单位摆在一起的地方。
    expect(findings[0].quote).toContain('灵石（块）')
  })

  it('hits when the second unit is attached through a quantity, not a parenthesis', () => {
    // 量词形式只认**登记表里已有的单位词**（这里是另一条资源的「块」）——
    // 不登记就不认，避免把「一百句话灵石…」里的任意名词当成单位（判据 CX）。
    const registry: NumericAuditResource[] = [
      ...LINGSHI_REGISTRY,
      { name: '灵砂', unit: '块', familyId: 'spirit-sand', tier: 0 },
    ]
    const text = '灵石（枚）是硬通货。一百块灵石才能买下一座宅子。'

    expect(dualUnitFindings(text, registry)).toHaveLength(1)
  })

  it('stays quiet when the same unit is used everywhere', () => {
    const text = '灵石（枚）是硬通货。十枚灵石可买一张符。灵石三百枚换一株灵草。'

    expect(dualUnitFindings(text, LINGSHI_REGISTRY)).toEqual([])
    expect(inspectWorldBuildingNumeric(text, LINGSHI_REGISTRY).findings).toEqual([])
  })

  it('does not read a longer registered name as the short one', () => {
    // 「下品灵石（块）」不该被判成「灵石」用了「块」。
    const text = '下品灵石（块）很便宜。灵石（枚）是硬通货。'

    expect(dualUnitFindings(text, LINGSHI_REGISTRY)).toEqual([])
  })

  it('keeps the check inside one paragraph', () => {
    // 作用域是「段」（空行分隔）：隔段的两次出现不合并，宁可漏也不跨段猜。
    const text = '灵石（枚）是硬通货。\n\n灵石（块）用于大额交易。'

    expect(dualUnitFindings(text, LINGSHI_REGISTRY)).toEqual([])
  })
})

describe('A-4 资源名疑似重复定义', () => {
  it('hits when a family and its tier are both defined in the same dimension', () => {
    const text = [
      '## 2.【阶层断层与资源战场】',
      '灵石：硬通货，可用于交易与修炼。',
      '下品灵石：最常见的一档，杂役月俸即以此结算。',
    ].join('\n')
    const findings = duplicateDefinitionFindings(text, LINGSHI_REGISTRY)

    expect(findings).toHaveLength(1)
    expect(findings[0].resourceNames).toEqual(['灵石', '下品灵石'])
    expect(findings[0].quote).toContain('灵石')
  })

  it('hits on a same-family pair that is joined only by familyId + tier', () => {
    const registry: NumericAuditResource[] = [
      { name: '灵石', unit: '枚', familyId: 'currency', tier: 0 },
      { name: '灵玉', unit: '枚', familyId: 'currency', tier: 2 },
    ]
    const text = '## 2.【资源】\n灵石：硬通货。\n灵玉：高阶货币，大宗交易才用。'

    expect(duplicateDefinitionFindings(text, registry)).toHaveLength(1)
  })

  it('stays quiet when the second name is only referenced, never defined', () => {
    const text = '## 2.【资源】\n灵石是硬通货，下品灵石最便宜。宗门按枚发放。'

    expect(duplicateDefinitionFindings(text, LINGSHI_REGISTRY)).toEqual([])
  })

  it('stays quiet when the two names sit in different dimensions', () => {
    const text = [
      '## 2.【资源战场】',
      '灵石：硬通货。',
      '## 5.【时间历法】',
      '下品灵石：此处只是举例，与上一维无关。',
    ].join('\n')

    expect(duplicateDefinitionFindings(text, LINGSHI_REGISTRY)).toEqual([])
  })
})

describe('判据 CX：资源未登记 ⇒ 零输出', () => {
  const dualUnitText = '灵石（枚）是硬通货。灵石（块）用于大额交易。'
  const definitionText = '## 2.【资源】\n灵石：硬通货。\n下品灵石：最常见的一档。'

  it('returns an empty array (not "found then filtered") when no registry is passed', () => {
    expect(inspectWorldBuildingNumeric(dualUnitText).findings).toEqual([])
    expect(inspectWorldBuildingNumeric(definitionText).findings).toEqual([])
    expect(inspectWorldBuildingNumeric(dualUnitText).unreadable).toBe(false)
  })

  it('returns an empty array for an empty registry', () => {
    expect(inspectWorldBuildingNumeric(dualUnitText, []).findings).toEqual([])
    expect(inspectWorldBuildingNumeric(definitionText, []).findings).toEqual([])
  })

  it('ignores registry entries that lack a name or a unit instead of guessing them', () => {
    const broken: NumericAuditResource[] = [
      { name: '', unit: '枚' },
      { name: '灵石', unit: '' },
    ]

    expect(inspectWorldBuildingNumeric(dualUnitText, broken).findings).toEqual([])
    expect(inspectWorldBuildingNumeric(definitionText, broken).findings).toEqual([])
  })

  it('produces no noise on a clean setting', () => {
    const clean = [
      '# 世界观',
      '## 2.【阶层断层与资源战场】',
      '灵石是硬通货。每日劳作六个时辰可换十枚下品灵石，药钱占收入的五分之一。',
      '## 5.【时间历法（日序与周期）】',
      '起点：大衍历三年二月廿三，辰时。',
    ].join('\n')
    const result = inspectWorldBuildingNumeric(clean, LINGSHI_REGISTRY)

    expect(result.findings).toEqual([])
    expect(describeWorldBuildingNumericAudit(result, 'zh-CN')).toBeUndefined()
  })
})

describe('A-3 / A-4 的产出形态', () => {
  it('uses undecidable kinds with stable, exemptable keys', () => {
    const text = '灵石（枚）是硬通货。灵石（块）用于大额交易。'
    const first = dualUnitFindings(text, LINGSHI_REGISTRY)[0]
    const second = dualUnitFindings(text, LINGSHI_REGISTRY)[0]

    expect(first.key).toBe(second.key)
    expect(first.key).toMatch(/^worldbuilding-numeric:dual-unit:[0-9a-f]{8}$/)

    const definitionKey = duplicateDefinitionFindings(
      '## 2.【资源】\n灵石：硬通货。\n下品灵石：最常见的一档。',
      LINGSHI_REGISTRY,
    )[0].key
    expect(definitionKey).toMatch(/^worldbuilding-numeric:duplicate-resource-definition:[0-9a-f]{8}$/)
  })

  it('merges into the existing one-line summary with neutral wording', () => {
    const text = '每日劳作十二时辰。灵石（枚）是硬通货。灵石（块）用于大额交易。'
    const summary = describeWorldBuildingNumericAudit(
      inspectWorldBuildingNumeric(text, LINGSHI_REGISTRY),
      'zh-CN',
    )

    expect(summary).toContain('2 处')
    expect(summary).toContain('请确认')
    expect(summary).toContain('两种单位')
    // 判据 CJ：不给"应该改成什么"。
    expect(summary).not.toContain('应改为')
    expect(summary).not.toContain('建议改为')
  })

  it('summarises the new rules in English too', () => {
    const summary = describeWorldBuildingNumericAudit(
      inspectWorldBuildingNumeric('灵石（枚）是硬通货。灵石（块）用于大额交易。', LINGSHI_REGISTRY),
      'en-US',
    )

    expect(summary).toContain('two different units')
    expect(summary).toContain('confirm')
  })
})
