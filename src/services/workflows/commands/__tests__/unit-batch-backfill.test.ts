import { describe, expect, it } from 'vitest'
import { advanceUnitCursor, backfillUnitBatch } from '../architecture.command'
import { parseArcStructure } from '../../../../shared/arc-position'

// E3 T9：请求期没有 to，生成后数出实际章数；单元完成后推进游标。
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
const parsed = parseArcStructure(PLAN)!

const chapters = (from: number, count: number) => Array.from({ length: count }, (_, index) =>
  `## 第${from + index}章：标题\n正文。`).join('\n\n')

describe('backfillUnitBatch：由正文回填实际章数', () => {
  it('数出本批覆盖的章数并回填 to', () => {
    expect(backfillUnitBatch(chapters(11, 4), 11, 60)).toEqual({ actualChapters: 4, to: 14, overflow: false })
  })

  it('正文没覆盖到起点 ⇒ null（不猜）', () => {
    expect(backfillUnitBatch(chapters(1, 3), 11, 60)).toBeNull()
    expect(backfillUnitBatch('', 11, 60)).toBeNull()
  })

  it('写过了全书末尾：to clamp 到总章数，并把 overflow 标出来', () => {
    expect(backfillUnitBatch(chapters(11, 5), 11, 13)).toEqual({ actualChapters: 5, to: 13, overflow: true })
  })

  it('非法 from / total ⇒ null', () => {
    expect(backfillUnitBatch(chapters(1, 2), 0, 60)).toBeNull()
    expect(backfillUnitBatch(chapters(1, 2), 1, 0)).toBeNull()
    expect(backfillUnitBatch(chapters(1, 2), 10, 5)).toBeNull()
  })
})

describe('advanceUnitCursor：单元完成后推进', () => {
  it('本卷还有下一个单元：卷内已写累加', () => {
    expect(advanceUnitCursor(parsed, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 5))
      .toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 })
  })

  it('本卷最后一个单元：进入下一卷，卷内已写重置', () => {
    expect(advanceUnitCursor(parsed, 60, { volumeIndex: 1, unitIndex: 2, writtenInVolume: 15 }, 5))
      .toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 })
  })

  it('全书最后一个单元完成 ⇒ null（没有下一批）', () => {
    expect(advanceUnitCursor(parsed, 60, { volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 }, 30)).toBeNull()
  })

  it('非法 actual / 游标 ⇒ null', () => {
    expect(advanceUnitCursor(parsed, 60, { volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 }, 0)).toBeNull()
    expect(advanceUnitCursor(parsed, 60, { volumeIndex: 3, unitIndex: 1, writtenInVolume: 0 }, 5)).toBeNull()
    expect(advanceUnitCursor(parsed, 60, { volumeIndex: 1, unitIndex: 0, writtenInVolume: 0 }, 5)).toBeNull()
  })
})
