import { describe, expect, it } from 'vitest'
import { deriveSynopsisUnitCursor } from '../architecture.command'

// E3 T7：单元游标由检查点的「已覆盖到第几章」推导——**只用于旧检查点迁移**。
// 新检查点一律使用写入时的显式游标（实际章数偏离计划后，章号→单元的等分映射会整体错位）。
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

describe('deriveSynopsisUnitCursor：旧检查点迁移', () => {
  it('卷一单元一内：章号 → 单元 + 卷内已写', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 1)).toEqual({ volumeIndex: 1, unitIndex: 1, writtenInVolume: 1 })
    expect(deriveSynopsisUnitCursor(PLAN, 60, 15)).toEqual({ volumeIndex: 1, unitIndex: 1, writtenInVolume: 15 })
  })

  it('跨单元：第 16 章落在单元二，卷内已写从卷首算起', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 16)).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 16 })
    expect(deriveSynopsisUnitCursor(PLAN, 60, 30)).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 30 })
  })

  it('跨卷：卷内已写按卷首重置', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 31)).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 1 })
  })

  it('未写任何章 / 越界 / 非法输入 ⇒ null（fail-open）', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 0)).toBeNull()
    expect(deriveSynopsisUnitCursor(PLAN, 60, 61)).toBeNull()
    expect(deriveSynopsisUnitCursor(PLAN, 60, Number.NaN)).toBeNull()
    expect(deriveSynopsisUnitCursor(PLAN, 60, 1.5)).toBeNull()
    expect(deriveSynopsisUnitCursor(PLAN, 0, 1)).toBeNull()
  })

  it('结构不可解析 ⇒ null（不猜）', () => {
    expect(deriveSynopsisUnitCursor('', 60, 5)).toBeNull()
    expect(deriveSynopsisUnitCursor(undefined, 60, 5)).toBeNull()
    expect(deriveSynopsisUnitCursor('没有卷与单元的自由文本', 60, 5)).toBeNull()
  })
})
