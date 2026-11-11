import { describe, expect, it } from 'vitest'

import { buildReport, expandIdCell } from '../check-ledger-snapshot.mjs'

/**
 * 用例来源：2026-11-11 首次运行发现 11 条 MISSING-SNAPSHOT，其中 9 条是
 * 「区间写法整行被跳过」的假阳性（D4–D8 / D9–D11、D16）。这组用例把它钉死。
 */

describe('expandIdCell（编号格的三种写法）', () => {
  it('单编号与粗体单编号', () => {
    expect(expandIdCell('D17')).toEqual(['D17'])
    expect(expandIdCell('**D17**')).toEqual(['D17'])
  })

  it('回归：区间写法必须展开（2026-11-11 假阳性根因）', () => {
    expect(expandIdCell('D4–D8')).toEqual(['D4', 'D5', 'D6', 'D7', 'D8'])
    expect(expandIdCell('D9–D11、D16')).toEqual(['D9', 'D10', 'D11', 'D16'])
  })

  it('连字符 / 波浪号与 en dash 等价', () => {
    expect(expandIdCell('D1-D3')).toEqual(['D1', 'D2', 'D3'])
    expect(expandIdCell('D1~D3')).toEqual(['D1', 'D2', 'D3'])
  })

  it('派生编号不算编号格（挂主项，不参与判定）', () => {
    expect(expandIdCell('D18-①')).toBeNull()
    expect(expandIdCell('D18-②')).toBeNull()
  })

  it('含非编号内容或空格的格不算编号格', () => {
    expect(expandIdCell('')).toBeNull()
    expect(expandIdCell('见 D17')).toBeNull()
    expect(expandIdCell('1')).toBeNull()
    expect(expandIdCell('已实施')).toBeNull()
  })

  it('反向区间不展开（宁可漏判也不凭空造编号）', () => {
    expect(expandIdCell('D8–D4')).toBeNull()
  })
})

describe('buildReport（分区判定）', () => {
  const ledger = [
    '| 序 | 编号 | 状态（2026-11-02 快照 · 勿据此判断现状） |',
    '|---|---|---|',
    '| 1 | D1 | 未开工 |',
    '| 8 | D4–D8 | 未开工 |',
    '| 11 | D18-① | 待定 |',
    '',
    '| 编号 | 现值 |',
    '|---|---|',
    '| D1 | 已实施 |',
    '| D4 | 已实施 |',
    '| D8 | 已实施 |',
  ].join('\n')

  it('区间行展开后 D4..D8 全部命中快照区，不再误报 MISSING-SNAPSHOT', () => {
    const report = buildReport(ledger)
    const byId = Object.fromEntries(report.items.map(it => [it.id, it.verdict]))
    expect(byId.D4).toBe('OK')
    expect(byId.D8).toBe('OK')
  })

  it('派生编号进附注而不进判定', () => {
    const report = buildReport(ledger)
    expect(report.items.some(it => it.id === 'D18')).toBe(false)
    expect(report.unrecognised.some(u => u.label.includes('D18-①'))).toBe(true)
  })

  it('只有现值行、没有快照行的编号判 MISSING-SNAPSHOT', () => {
    const report = buildReport(ledger.replace('| 1 | D1 | 未开工 |\n', ''))
    expect(report.items.find(it => it.id === 'D1').verdict).toBe('MISSING-SNAPSHOT')
  })
})
