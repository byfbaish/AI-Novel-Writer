import { describe, expect, it } from 'vitest'

import {
  balanceAt,
  buildLedgerSeries,
  interruptedSince,
  parseResourceMovementExtraction,
  summarizeLedger,
  type LedgerExtractionResource,
  type LedgerMovement,
  type LedgerResourceRef,
  type ResourceLedgerScanState,
} from '../resource-ledger'

const resource: LedgerResourceRef = { resourceId: 'res:stone', unit: '枚' }

function movement(
  chapterNumber: number,
  delta: number,
  extra: Partial<LedgerMovement> = {},
): LedgerMovement {
  return {
    chapterNumber,
    resourceId: resource.resourceId,
    delta,
    unit: resource.unit,
    source: 'finalized-extract',
    ...extra,
  }
}

/** 开篇起点：`chapter_number=0` 且 `source='author'`（§5.3 规则 2）。 */
function origin(delta: number, extra: Partial<LedgerMovement> = {}): LedgerMovement {
  return movement(0, delta, { source: 'author', ...extra })
}

function scan(...chapters: number[]): ResourceLedgerScanState {
  return { scannedChapters: chapters }
}

const declared: LedgerExtractionResource[] = [
  { resourceId: 'res:stone', name: '下品灵石', unit: '枚' },
  { resourceId: 'res:merit', name: '军功', unit: '点' },
]

/** 引文必须逐字命中，所以正文只用这一段。 */
const CHAPTER_TEXT = '他把袋子推过来，取走一百二十枚，又花掉六枚。掌柜摇头：损失惨重。'

describe('resource ledger arithmetic (§5.3)', () => {
  it('累加起点与逐章变动，并回报算到第几章', () => {
    const movements = [origin(30), movement(1, 10), movement(2, -6), movement(3, 120)]
    expect(balanceAt(resource, movements, 3, scan(1, 2, 3)))
      .toEqual({ kind: 'known', value: 154, throughChapter: 3 })
    // 端点含该章：算到第 2 章只吃 ch0..ch2。
    expect(balanceAt(resource, movements, 2, scan(1, 2))).toEqual({ kind: 'known', value: 34, throughChapter: 2 })
    // 只算起点（第 0 章）也是合法问题。
    expect(balanceAt(resource, movements, 0, scan())).toEqual({ kind: 'known', value: 30, throughChapter: 0 })
  })

  it('起点缺失 ⇒ 第 1 章起 unknown，绝不假定 0', () => {
    const movements = [movement(1, 10), movement(2, -6)]
    expect(balanceAt(resource, movements, 1, scan(1, 2)))
      .toEqual({ kind: 'unknown', reason: 'no-origin', fromChapter: 1 })
    expect(balanceAt(resource, movements, 2, scan(1, 2)))
      .toEqual({ kind: 'unknown', reason: 'no-origin', fromChapter: 1 })
  })

  it('只有起点、且该章未扫 ⇒ unknown（不是「等于起点」）', () => {
    const movements = [origin(30)]
    expect(balanceAt(resource, movements, 1, scan()))
      .toEqual({ kind: 'unknown', reason: 'not-scanned', fromChapter: 1 })
    expect(balanceAt(resource, movements, 1, scan(1))).toEqual({ kind: 'known', value: 30, throughChapter: 1 })
  })

  it('中间某章未扫 ⇒ 该章及之后全 unknown，不跨过中断继续累加', () => {
    const movements = [origin(30), movement(1, 10), movement(2, 5), movement(3, 120)]
    // 第 2 章漏扫：第 2 章是「不知道」，第 3 章绝不能算成 165。
    expect(balanceAt(resource, movements, 2, scan(1, 3)))
      .toEqual({ kind: 'unknown', reason: 'not-scanned', fromChapter: 2 })
    expect(balanceAt(resource, movements, 3, scan(1, 3)))
      .toEqual({ kind: 'unknown', reason: 'not-scanned', fromChapter: 2 })
    // 中断之前的章仍然可算。
    expect(balanceAt(resource, movements, 1, scan(1, 3))).toEqual({ kind: 'known', value: 40, throughChapter: 1 })
  })

  it('连续多章未扫 ⇒ 起点取第一个缺口', () => {
    const movements = [origin(30), movement(1, 10), movement(4, 1)]
    expect(balanceAt(resource, movements, 5, scan(1)))
      .toEqual({ kind: 'unknown', reason: 'not-scanned', fromChapter: 2 })
    expect(interruptedSince(scan(1), 5)).toBe(2)
    expect(interruptedSince(scan(1, 2, 3, 4, 5), 5)).toBeNull()
  })

  it('空的 movements ⇒ no-origin（不是余额 0）', () => {
    expect(balanceAt(resource, [], 1, scan(1)))
      .toEqual({ kind: 'unknown', reason: 'no-origin', fromChapter: 1 })
    expect(balanceAt(resource, [], 3, scan(1, 2, 3)))
      .toEqual({ kind: 'unknown', reason: 'no-origin', fromChapter: 1 })
  })

  it('单位不一致判显式冲突：不合并、不换算', () => {
    const movements = [origin(30), movement(2, 5, { unit: '块' }), movement(3, 100)]
    const balance = balanceAt(resource, movements, 3, scan(1, 2, 3))
    expect(balance).toEqual({
      kind: 'conflict',
      reason: 'unit-mismatch',
      units: ['枚', '块'],
      fromChapter: 2,
    })
    // 冲突时**没有** value：任何一种「折合成枚」的猜测都会静默改写历史。
    expect(balance).not.toHaveProperty('value')
  })

  it('作者事后改单位：历史行仍是旧单位，冲突从历史行那一章起', () => {
    // 历史记「枚」，作者把 resources.unit 改成「块」—— 历史 delta 不能被重新解释成「块」。
    const movements = [origin(30), movement(1, 10)]
    expect(balanceAt({ resourceId: resource.resourceId, unit: '块' }, movements, 1, scan(1)))
      .toEqual({ kind: 'conflict', reason: 'unit-mismatch', units: ['块', '枚'], fromChapter: 0 })
  })

  it('逐章序列里未知章是 null，不是 0', () => {
    const movements = [origin(30), movement(1, 10), movement(2, -6), movement(3, 120)]
    expect(buildLedgerSeries(resource, movements, scan(1, 2), 4)).toEqual([
      { chapterNumber: 1, value: 40 },
      { chapterNumber: 2, value: 34 },
      { chapterNumber: 3, value: null },
      { chapterNumber: 4, value: null },
    ])
  })

  it('序列在起点缺失时整条都是 null', () => {
    expect(buildLedgerSeries(resource, [movement(1, 10)], scan(1), 2)).toEqual([
      { chapterNumber: 1, value: null },
      { chapterNumber: 2, value: null },
    ])
  })

  it('一句话摘要：已知说数，未知只说中断，永不写「0 枚」', () => {
    const movements = [origin(30), movement(1, 10), movement(2, -6)]
    expect(summarizeLedger(resource, movements, scan(1, 2), 2)).toBe('第 2 章余额 34 枚')

    const interrupted = summarizeLedger(resource, movements, scan(1), 3)
    expect(interrupted).toContain('第 2 章起账本中断')
    expect(interrupted).not.toContain('0 枚')

    // 没有起点说「未登记开篇余额」，不说「中断」：两者修法不同
    // （补一条第 0 章登记 vs 补扫那一章），而 W7 的注入文本会直接引用这句。
    const missingOrigin = summarizeLedger(resource, movements.slice(1), scan(1, 2), 2)
    expect(missingOrigin).toContain('未登记开篇余额')
    expect(missingOrigin).not.toContain('中断：')
    expect(missingOrigin).toContain('不是 0')

    const conflict = summarizeLedger(
      resource,
      [origin(30), movement(2, 5, { unit: '块' })],
      scan(1, 2),
      2,
    )
    expect(conflict).toContain('单位冲突')
    expect(conflict).toContain('不合并、不换算')
  })

  it('英文摘要同样不把未知说成 0', () => {
    const movements = [origin(30), movement(1, 10)]
    expect(summarizeLedger(resource, movements, scan(), 2, 'en-US')).toContain('interrupted from chapter 1')
    expect(summarizeLedger(resource, movements, scan(), 2, 'en-US')).not.toContain('0')
  })

  it('delta=0 的行在算术上是无操作（写入口与解析层都已禁止它出现）', () => {
    // 防御性断言：即使库里真的混进一条 0 行，也不会改变余额，更不会被当成中断。
    const movements = [origin(30), movement(1, 0)]
    expect(balanceAt(resource, movements, 1, scan(1))).toEqual({ kind: 'known', value: 30, throughChapter: 1 })
  })

  it('不同资源的变动互不干扰', () => {
    const movements = [origin(30), movement(1, 10), movement(1, 7, { resourceId: 'res:merit', unit: '点' })]
    expect(balanceAt(resource, movements, 1, scan(1))).toEqual({ kind: 'known', value: 40, throughChapter: 1 })
    expect(balanceAt({ resourceId: 'res:merit', unit: '点' }, movements, 1, scan(1)))
      .toEqual({ kind: 'unknown', reason: 'no-origin', fromChapter: 1 })
  })
})

describe('resource movement extraction parsing (§5.2)', () => {
  it('中文数字归一成整数，引文逐字保留', () => {
    const result = parseResourceMovementExtraction(
      '{"movements":[{"resource":"下品灵石","delta":"一百二十","unit":"枚","quote":"取走一百二十枚"}]}',
      CHAPTER_TEXT,
      declared,
    )
    expect(result.unreadable).toBe(false)
    expect(result.movements).toEqual([{
      resourceId: 'res:stone',
      delta: 120,
      unit: '枚',
      evidence: '取走一百二十枚',
    }])
    expect(result.dropped).toEqual({
      unknownResource: 0,
      unreadableDelta: 0,
      zeroDelta: 0,
      missingQuote: 0,
      unitMismatch: 0,
    })
  })

  it('支出记为负数（"-6" 与数字 -6 等价）', () => {
    const result = parseResourceMovementExtraction(
      '{"movements":[{"resource":"下品灵石","delta":"-6","quote":"花掉六枚"},{"resource":"下品灵石","delta":-6,"quote":"又花掉六枚"}]}',
      CHAPTER_TEXT,
      declared,
    )
    expect(result.movements.map((row) => row.delta)).toEqual([-6, -6])
  })

  it('模糊表述不产生行', () => {
    const result = parseResourceMovementExtraction('{"movements":[]}', CHAPTER_TEXT, declared)
    expect(result.movements).toEqual([])
    expect(result.unreadable).toBe(false)
  })

  it('引文命不中正文 ⇒ 丢弃并计数', () => {
    const result = parseResourceMovementExtraction(
      '{"movements":[{"resource":"下品灵石","delta":120,"quote":"取走一百二十块灵石"}]}',
      CHAPTER_TEXT,
      declared,
    )
    expect(result.movements).toEqual([])
    expect(result.dropped.missingQuote).toBe(1)
  })

  it('坏 JSON 不抛错，只标 unreadable', () => {
    for (const raw of ['', '抱歉我不能', '{"movements":[', '{"movements":{}}', '[]']) {
      const result = parseResourceMovementExtraction(raw, CHAPTER_TEXT, declared)
      expect(result.movements).toEqual([])
      expect(result.unreadable, raw).toBe(true)
    }
  })

  it('资源名不在登记表 ⇒ 丢弃并计数（空表时全部丢弃）', () => {
    const paid = '{"movements":[{"resource":"中品灵石","delta":3,"quote":"取走一百二十枚"}]}'
    expect(parseResourceMovementExtraction(paid, CHAPTER_TEXT, declared).dropped.unknownResource).toBe(1)
    // 资源表为空：这是全新项目的正常状态 —— 解析层不报错，只丢弃。
    const empty = parseResourceMovementExtraction(paid, CHAPTER_TEXT, [])
    expect(empty.unreadable).toBe(false)
    expect(empty.movements).toEqual([])
    expect(empty.dropped.unknownResource).toBe(1)
  })

  it('delta 归一失败或为 0 ⇒ 丢弃并分别计数', () => {
    const result = parseResourceMovementExtraction(
      '{"movements":['
      + '{"resource":"下品灵石","delta":"若干","quote":"取走一百二十枚"},'
      + '{"resource":"下品灵石","delta":"半","quote":"花掉六枚"},'
      + '{"resource":"下品灵石","delta":0,"quote":"又花掉六枚"},'
      + '{"resource":"下品灵石","delta":1.5,"quote":"取走一百二十枚"}]}',
      CHAPTER_TEXT,
      declared,
    )
    expect(result.movements).toEqual([])
    expect(result.dropped.unreadableDelta).toBe(3)
    expect(result.dropped.zeroDelta).toBe(1)
  })

  it('单位与登记不同：保留该条并计数，让下游判成显式冲突', () => {
    const result = parseResourceMovementExtraction(
      '{"movements":[{"resource":"下品灵石","delta":120,"unit":"块","quote":"取走一百二十枚"}]}',
      CHAPTER_TEXT,
      declared,
    )
    expect(result.dropped.unitMismatch).toBe(1)
    expect(result.movements).toEqual([{
      resourceId: 'res:stone',
      delta: 120,
      unit: '块',
      evidence: '取走一百二十枚',
    }])
  })

  it('顶层余额字段一律忽略（判据 DK）', () => {
    const result = parseResourceMovementExtraction(
      '{"balance":9999,"movements":[{"resource":"下品灵石","delta":120,"quote":"取走一百二十枚"}]}',
      CHAPTER_TEXT,
      declared,
    )
    expect(result.movements).toHaveLength(1)
    expect(JSON.stringify(result.movements)).not.toContain('9999')
  })

  it('代码围栏与前后引导语都能被剥掉', () => {
    const raw = '好的，结果如下：\n```json\n{"movements":[{"resource":"军功","delta":"七","unit":"点","quote":"取走一百二十枚"}]}\n```\n'
    const result = parseResourceMovementExtraction(raw, CHAPTER_TEXT, declared)
    expect(result.movements).toEqual([{
      resourceId: 'res:merit',
      delta: 7,
      unit: '点',
      evidence: '取走一百二十枚',
    }])
  })
})
