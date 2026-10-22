import { describe, expect, it } from 'vitest'
import {
  describeWorldBuildingNumericAudit,
  inspectWorldBuildingNumeric,
  parseChineseNumber,
} from '../worldbuilding-numeric-audit'

/** 取 A-1 类命中。 */
function dailyHoursFindings(text: string) {
  return inspectWorldBuildingNumeric(text).findings.filter((finding) => finding.kind === 'daily-hours')
}

/** 取 A-2 类命中。 */
function ratioFindings(text: string) {
  return inspectWorldBuildingNumeric(text).findings.filter((finding) => finding.kind === 'ratio-without-base')
}

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
