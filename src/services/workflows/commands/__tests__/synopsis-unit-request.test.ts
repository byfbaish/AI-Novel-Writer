import { describe, expect, it } from 'vitest'
import { computeSynopsisUnitRange } from '../architecture.command'

// E3 T4a：游标 + 已覆盖章数 → 逐单元请求（纯函数）。
// 不变量：游标必须指向 coveredTo+1 所在单元；不一致 ⇒ null（fail-closed）。
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

describe('computeSynopsisUnitRange：构造逐单元请求', () => {
  it('第一个单元：from = 1，名义上界 = 卷长 ÷ 单元数', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0))
      .toEqual({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
  })

  it('卷二单元一：游标卷内已写重置为 0，起点接在卷末之后', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 }, 30))
      .toEqual({ from: 31, unitIndex: 1, maxChapters: 30, volumeRemaining: 30 })
  })

  it('卷内第二个单元：名义上界按剩余章数摊到剩余单元', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 15 }, 15))
      .toEqual({ from: 16, unitIndex: 2, maxChapters: 15, volumeRemaining: 15 })
  })

  it('游标与章号映射不一致 ⇒ null（绝不按章号猜单元）', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 15 }, 15)).toBeNull()
  })

  it('已覆盖全书 / 越界 / 缺游标 / 结构不可解析 ⇒ null', () => {
    expect(computeSynopsisUnitRange(PLAN, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 60)).toBeNull()
    expect(computeSynopsisUnitRange(PLAN, 60, null, 0)).toBeNull()
    expect(computeSynopsisUnitRange('', 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0)).toBeNull()
    expect(computeSynopsisUnitRange(PLAN, 0, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0)).toBeNull()
  })
})
