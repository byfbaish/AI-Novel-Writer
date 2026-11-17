import { describe, expect, it } from 'vitest'

import {
  RULE_TRAILING,
  RULE_VERSIONED,
  checkTrailingNewline,
  checkVersionedName,
  collectViolations,
  inScope,
  renderReport,
} from '../check-batch-hygiene.mjs'

describe('尾行换行规则', () => {
  it('末行有换行且不是连续空行 ⇒ 合规', () => {
    expect(checkTrailingNewline('# 标题\n正文\n')).toBeNull()
  })

  it('末行缺换行 ⇒ 不合规', () => {
    expect(checkTrailingNewline('# 标题\n正文')).toMatch('末行缺换行')
  })

  it('以连续空行结尾 ⇒ 不合规', () => {
    expect(checkTrailingNewline('# 标题\n\n')).toMatch('连续空行')
  })

  it('空文件 ⇒ 不合规', () => {
    expect(checkTrailingNewline('')).toMatch('内容为空')
  })

  it('CRLF 结尾按换行算，不误判', () => {
    expect(checkTrailingNewline('# 标题\r\n正文\r\n')).toBeNull()
  })
})

describe('禁版本号文件名规则', () => {
  it('cards 下 .v3.md ⇒ 不合规', () => {
    expect(checkVersionedName('.batch/night/cards/CARD-1117-A.v3.md')).toMatch('版本号')
  })

  it('reports 下 -v7 结尾 ⇒ 不合规', () => {
    expect(checkVersionedName('.batch/night/reports/report-v7.md')).toMatch('版本号')
  })

  it('archive 下豁免', () => {
    expect(checkVersionedName('.batch/night/archive/staging/no-at-count.v2.mjs')).toBeNull()
  })

  it('staging 下豁免', () => {
    expect(checkVersionedName('.batch/night/staging/pointer-plan.v4.md')).toBeNull()
  })

  it('普通文件名不误判', () => {
    expect(checkVersionedName('.batch/night/reports/CARD-1117-A-report.md')).toBeNull()
  })
})

describe('范围与汇总', () => {
  it('只检查 .batch/night/**', () => {
    expect(inScope('.batch/night/reports/x.md')).toBe(true)
    expect(inScope('.batch/night')).toBe(true)
    expect(inScope('docs/notes.md')).toBe(false)
    expect(inScope('.batch/other/x.md')).toBe(false)
  })

  it('collectViolations 跳过范围外文件，并按规则分类', () => {
    const violations = collectViolations([
      { path: 'docs/a.v3.md', content: 'no newline' },
      { path: '.batch/night/reports/b.v3.md', content: '# 标题\n' },
      { path: '.batch/night/reports/c.md', content: '# 标题' },
    ])
    expect(violations.map((v) => `${v.rule}:${v.path}`)).toEqual([
      `${RULE_VERSIONED}:.batch/night/reports/b.v3.md`,
      `${RULE_TRAILING}:.batch/night/reports/c.md`,
    ])
  })

  it('汇总行只报条目数，不出现字节／md5／行数', () => {
    const report = renderReport([
      { path: '.batch/night/reports/c.md', rule: RULE_TRAILING, reason: '末行缺换行' },
    ])
    expect(report).toContain('.batch/night/reports/c.md · trailing-newline · 末行缺换行')
    expect(report.split('\n').pop()).toBe('1 项不合规')
    expect(report).not.toMatch(/字节|md5|MD5|行数/u)
  })
})
