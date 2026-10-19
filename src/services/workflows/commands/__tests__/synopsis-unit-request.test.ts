import { describe, expect, it } from 'vitest'
import { computeSynopsisUnitRange } from '../architecture.command'

// E3 T4a：游标 + 已覆盖章数 → 逐单元请求（纯函数）。
// **游标是唯一真相**：不从章号反查单元（等分映射一偏离就整体错位，2026-10-20 探针实测）。
const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '- 叙事任务：立规则。',
  '### 单元二：定价',
  '- 叙事任务：把销档变成交易。',
  '## 卷二：销档',
  '### 单元一：配合',
  '- 叙事任务：只剩配合这一条路。',
].join('\n')

// 卷一 30 章 / 2 单元（计划各 15 章），卷二 30 章 / 1 单元，全书 60 章。
describe('computeSynopsisUnitRange：构造逐单元请求', () => {
  it('第一个单元：from = 1，名义上界 = 卷长 ÷ 单元数', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0))
      .toEqual({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
  })

  it('卷二单元一：卷内已写重置为 0，起点接在卷末之后', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 }, 30))
      .toEqual({ from: 31, unitIndex: 1, maxChapters: 30, volumeRemaining: 30 })
  })

  it('卷内第二个单元：名义上界按剩余章数摊到剩余单元', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 15 }, 15))
      .toEqual({ from: 16, unitIndex: 2, maxChapters: 15, volumeRemaining: 15 })
  })

  it('单元实际写少了（12 章 vs 计划 15 章）：下一单元仍可定位，余量滚入本单元', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 12 }, 12))
      .toEqual({ from: 13, unitIndex: 2, maxChapters: 18, volumeRemaining: 18 })
  })

  it('单元超写（20 章）：下一单元用剩下的本卷余量，不跨卷摊', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 20 }, 20))
      .toEqual({ from: 21, unitIndex: 2, maxChapters: 10, volumeRemaining: 10 })
  })

  it('本卷预算写满但本卷还有单元：按卷超写带（10%）给余量，至少 1 章', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 30 }, 30))
      .toEqual({ from: 31, unitIndex: 2, maxChapters: 3, volumeRemaining: 3 })
  })

  it('名义上界不越过全书末尾（本卷余量大于全书剩余时按全书剩余截断）', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 2, unitIndex: 1, writtenInVolume: 25 }, 55))
      .toEqual({ from: 56, unitIndex: 1, maxChapters: 5, volumeRemaining: 5 })
  })

  it('已覆盖全书 / 越界 / 缺游标 / 结构不可解析 ⇒ null', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 60)).toBeNull()
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 3, writtenInVolume: 0 }, 0)).toBeNull()
    expect(computeSynopsisUnitRange(PLAN, 60, null, 0)).toBeNull()
    expect(computeSynopsisUnitRange('', 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0)).toBeNull()
    expect(computeSynopsisUnitRange(PLAN, 0, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0)).toBeNull()
  })
})
