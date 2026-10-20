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
  it('单元未写完：游标仍是这个单元，卷内已写 = coveredTo', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 1)).toEqual({ volumeIndex: 1, unitIndex: 1, writtenInVolume: 1 })
    expect(deriveSynopsisUnitCursor(PLAN, 60, 14)).toEqual({ volumeIndex: 1, unitIndex: 1, writtenInVolume: 14 })
  })

  it('coveredTo 是单元末章：游标指向下一个单元（不是刚写完的这个）', () => {
    // 单元一 = 1–15 章。写到 15 章 ⇒ 下一个要写的是单元二，卷内已写 15。
    // 旧写法在这里返回 {1,1,15}，下一批就会顶着单元一的名写单元二的内容（B 项目实测）。
    expect(deriveSynopsisUnitCursor(PLAN, 60, 15)).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 15 })
  })

  it('跨单元：第 16 章落在单元二，卷内已写从卷首算起', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 16)).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 16 })
    expect(deriveSynopsisUnitCursor(PLAN, 60, 29)).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 29 })
  })

  it('跨卷：卷内已写按卷首重置；卷末章 ⇒ 下一卷单元一、已写 0', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 30)).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 })
    expect(deriveSynopsisUnitCursor(PLAN, 60, 31)).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 1 })
  })

  it('该书已写到最后一章 ⇒ null（没有下一个单元）', () => {
    expect(deriveSynopsisUnitCursor(PLAN, 60, 60)).toBeNull()
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
