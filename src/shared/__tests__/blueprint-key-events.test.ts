import { describe, expect, it } from 'vitest'
import { allocateEventChars, keyEventCharTargetsText, keyEventId, keyEventsText, normalizeKeyEvents } from '../blueprint-key-events'
import { shortOutlineSegmentBudget } from '../draft-short-outline'

describe('normalizeKeyEvents', () => {
  it('把单段字符串视为一条事件并逐字保留', () => {
    expect(normalizeKeyEvents('顾舟遗失潮汐钟', { chapterNumber: 7 }))
      .toEqual([{ id: 'ch7:E1', event: '顾舟遗失潮汐钟', estimatedUnits: 0 }])
  })

  it('按换行切分旧字符串', () => {
    expect(normalizeKeyEvents('第一件事\n第二件事', { chapterNumber: 3 }).map(event => event.event))
      .toEqual(['第一件事', '第二件事'])
  })

  it('按全角与半角分号切分（与 chapter-goal-review 原规则逐字一致）', () => {
    expect(normalizeKeyEvents('甲；乙;丙').map(event => event.event)).toEqual(['甲', '乙', '丙'])
  })

  it('丢弃空行与纯空白条目', () => {
    expect(normalizeKeyEvents('甲\n\n   \n乙\n').map(event => event.event)).toEqual(['甲', '乙'])
  })

  it('数组输入取 event 字段，并重算 id（覆盖模型自报值）', () => {
    expect(normalizeKeyEvents([
      { id: 'model-said-E9', event: '甲', estimatedUnits: 120 },
      { id: 'x', event: ' 乙 ' },
    ], { chapterNumber: 2 })).toEqual([
      { id: 'ch2:E1', event: '甲', estimatedUnits: 120 },
      { id: 'ch2:E2', event: '乙', estimatedUnits: 0 },
    ])
  })

  it('数组里的非字符串与缺 event 项被丢弃', () => {
    expect(normalizeKeyEvents(['甲', 42, null, { event: '' }, { event: '乙' }, {}]).map(event => event.event))
      .toEqual(['甲', '乙'])
  })

  it('未声明 estimatedUnits 时按目标字数均分', () => {
    expect(normalizeKeyEvents('甲\n乙\n丙\n丁', { chapterNumber: 1, targetUnits: 3000 }).map(event => event.estimatedUnits))
      .toEqual([750, 750, 750, 750])
  })

  it('声明了 estimatedUnits 的条目不被均分值覆盖', () => {
    expect(normalizeKeyEvents([
      { event: '甲', estimatedUnits: 2000 },
      { event: '乙' },
    ], { targetUnits: 1000 }).map(event => event.estimatedUnits)).toEqual([2000, 500])
  })

  it('非法 estimatedUnits 视同未声明', () => {
    expect(normalizeKeyEvents([{ event: '甲', estimatedUnits: -5 }], { targetUnits: 600 }).map(event => event.estimatedUnits))
      .toEqual([600])
  })

  it('空值与非法输入一律得到空数组', () => {
    for (const raw of [undefined, null, '', 0, 42, true, {}, []]) {
      expect(normalizeKeyEvents(raw)).toEqual([])
    }
  })

  it('把存储列里的 JSON 数组串解析成事件（改造后的库内形态）', () => {
    const stored = JSON.stringify([
      { id: 'ch5:E1', event: '甲', estimatedUnits: 0 },
      { id: 'ch5:E2', event: '乙', estimatedUnits: 300 },
    ])
    expect(normalizeKeyEvents(stored, { chapterNumber: 5 })).toEqual([
      { id: 'ch5:E1', event: '甲', estimatedUnits: 0 },
      { id: 'ch5:E2', event: '乙', estimatedUnits: 300 },
    ])
  })

  it('以 [ 开头但不是 JSON 数组的文本仍按旧规则切分（不误吞）', () => {
    expect(normalizeKeyEvents('[甲] ；乙').map(event => event.event)).toEqual(['[甲]', '乙'])
  })

  it('JSON 数组串为空数组时得到空数组', () => {
    expect(normalizeKeyEvents('[]')).toEqual([])
  })

  it('编号为 ch{N}:E{i}，序号从 1 起', () => {
    expect(keyEventId(12, 0)).toBe('ch12:E1')
    expect(keyEventId(12, 4)).toBe('ch12:E5')
  })
})

describe('keyEventsText', () => {
  it('以换行连接事件正文', () => {
    expect(keyEventsText(normalizeKeyEvents('甲\n乙'))).toBe('甲\n乙')
  })

  it('空清单得到空字符串', () => {
    expect(keyEventsText([])).toBe('')
    expect(keyEventsText(undefined)).toBe('')
  })

  it('与旧字符串切分后再聚合的形态一致（分号归一为换行）', () => {
    expect(keyEventsText(normalizeKeyEvents('甲；乙'))).toBe('甲\n乙')
  })

  // ★ 回归（2026-10-14）：续写恢复链路读回的 `draft:chapter-info` 里 `keyEvents` 是字符串
  // （`toWriterChapterInfo` 的投影），若这里只接数组会抛
  // `TypeError: (events ?? []).map is not a function`，作者续写直接失败。
  it('直接传入旧字符串时逐字返回（不重新切分，保住作者原文）', () => {
    expect(keyEventsText('核查遇阻；承担代价')).toBe('核查遇阻；承担代价')
    expect(keyEventsText('甲\n乙')).toBe('甲\n乙')
    expect(keyEventsText('  单条事件  ')).toBe('单条事件')
  })

  it('空字符串与 null 都得到空字符串', () => {
    expect(keyEventsText('')).toBe('')
    expect(keyEventsText(null)).toBe('')
  })
})

// ============================================================
// P11-1：`attacks`（把「作废某一格」写成可对账的目标）
// ============================================================

describe('normalizeKeyEvents · attacks', () => {
  it('合法 attacks 挂到对应事件上，钟点规范化为 HH:MM', () => {
    const events = normalizeKeyEvents([{
      id: 'x:E1',
      event: '他站进有摄像头的那截，故意留时间戳',
      estimatedUnits: 700,
      attacks: { kind: 'slot', space: '望海桥中段', hour: '9：05', rationale: '同钟点出现在别处才能证伪该格' },
    }], { chapterNumber: 3 })

    expect(events[0]!.attacks).toEqual({
      kind: 'slot',
      space: '望海桥中段',
      hour: '09:05',
      rationale: '同钟点出现在别处才能证伪该格',
    })
    // 其余字段不受影响
    expect(events[0]).toMatchObject({ id: 'ch3:E1', event: '他站进有摄像头的那截，故意留时间戳', estimatedUnits: 700 })
  })

  it('没有 rationale 时仍然合法（它是可选的）', () => {
    const events = normalizeKeyEvents([{ event: '甲', attacks: { kind: 'slot', space: '望海桥', hour: '21:00' } }])
    expect(events[0]!.attacks).toEqual({ kind: 'slot', space: '望海桥', hour: '21:00' })
  })

  it('缺 space / 缺 hour / 非法 kind ⇒ 整条 attacks 丢弃，事件本身保留', () => {
    const events = normalizeKeyEvents([
      { event: '缺钟点', attacks: { kind: 'slot', space: '望海桥' } },
      { event: '缺空间', attacks: { kind: 'slot', hour: '21:00' } },
      { event: '类型待定', attacks: { kind: 'thread', space: '望海桥', hour: '21:00' } },
      { event: '钟点越界', attacks: { kind: 'slot', space: '望海桥', hour: '24:00' } },
    ])
    expect(events.map(item => item.event)).toEqual(['缺钟点', '缺空间', '类型待定', '钟点越界'])
    expect(events.every(item => item.attacks === undefined)).toBe(true)
  })

  it('没有 attacks 时**不产生该键** —— 旧形状逐字不变，不影响既有快照哈希', () => {
    const events = normalizeKeyEvents([{ id: '1:E1', event: '甲', estimatedUnits: 700 }])
    expect(Object.keys(events[0]!)).toEqual(['id', 'event', 'estimatedUnits'])
  })

  it('空事件被丢弃时，后续条目的 estimatedUnits / attacks 不会整体错位（回归 2026-10-18）', () => {
    const events = normalizeKeyEvents([
      { event: '', estimatedUnits: 999, attacks: { kind: 'slot', space: '错位空间', hour: '01:00' } },
      { event: '乙', estimatedUnits: 500, attacks: { kind: 'slot', space: '望海桥', hour: '21:00' } },
    ], { chapterNumber: 2 })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: 'ch2:E1', event: '乙', estimatedUnits: 500 })
    expect(events[0]!.attacks).toMatchObject({ space: '望海桥' })
  })
})

describe('allocateEventChars（861ab163：单位→字数的唯一判据）', () => {
  it('按 estimatedUnits 比例分配，且合计严格等于目标字数', () => {
    const allocation = allocateEventChars([
      { event: '甲', estimatedUnits: 550 },
      { event: '乙', estimatedUnits: 550 },
      { event: '丙', estimatedUnits: 500 },
      { event: '丁', estimatedUnits: 450 },
      { event: '戊', estimatedUnits: 450 },
    ], 1500)

    expect(allocation.map(item => item.chars)).toEqual([330, 330, 300, 270, 270])
    expect(allocation.reduce((sum, item) => sum + item.chars, 0)).toBe(1500)
  })

  it('除不尽时末段吃掉余数，合计仍严格等于目标（不让总数被四舍五入顶超）', () => {
    const allocation = allocateEventChars([
      { event: '甲', estimatedUnits: 1 },
      { event: '乙', estimatedUnits: 1 },
      { event: '丙', estimatedUnits: 1 },
    ], 1000)

    expect(allocation.reduce((sum, item) => sum + item.chars, 0)).toBe(1000)
    expect(allocation.every(item => item.chars > 0)).toBe(true)
  })

  it('全部未声明 units 时退化成等分', () => {
    const allocation = allocateEventChars([{ event: '甲' }, { event: '乙' }], 1000)
    expect(allocation.map(item => item.chars)).toEqual([500, 500])
  })

  it('只有部分条目有 units 时，按有值的那些分配（0 的不占权重）', () => {
    const allocation = allocateEventChars([
      { event: '甲', estimatedUnits: 0 },
      { event: '乙', estimatedUnits: 300 },
    ], 900)
    expect(allocation.map(item => item.chars)).toEqual([1, 899])
  })

  it('事件为空或目标字数 ≤0 时返回空数组（调用方据此整块省略）', () => {
    expect(allocateEventChars([], 1500)).toEqual([])
    expect(allocateEventChars([{ event: '   ', estimatedUnits: 100 }], 1500)).toEqual([])
    expect(allocateEventChars([{ event: '甲', estimatedUnits: 100 }], 0)).toEqual([])
    expect(allocateEventChars(undefined, 1500)).toEqual([])
  })
})

describe('keyEventCharTargetsText（861ab163：降级路径的篇幅表）', () => {
  it('只给场次与字数，不复述事件原文（避免同一轮内作者字段重复）', () => {
    const text = keyEventCharTargetsText([{ event: '甲', estimatedUnits: 700 }, { event: '乙', estimatedUnits: 300 }], 1000)
    expect(text).toContain('第 1 场：约 700 字')
    expect(text).toContain('第 2 场：约 300 字')
    expect(text).toContain('合计 1000 字')
    expect(text).not.toContain('甲')
    expect(text).not.toContain('乙')
  })

  it('英文版块标题与行格式', () => {
    const text = keyEventCharTargetsText([{ event: 'a', estimatedUnits: 1 }], 500, 'en-US')
    expect(text).toContain('Scene 1: ~500 characters')
    expect(text).toContain('Total 500 characters')
  })

  it('字符串入参返回空串（拿不到分条，不猜）', () => {
    expect(keyEventCharTargetsText('甲；乙', 1500)).toBe('')
  })

  it('事件为空或目标 ≤0 时返回空串，调用方整块省略', () => {
    expect(keyEventCharTargetsText([], 1500)).toBe('')
    expect(keyEventCharTargetsText([{ event: '甲', estimatedUnits: 100 }], 0)).toBe('')
  })

  it('与 shortOutlineSegmentBudget 同源：同一条事件在两处的字数相同', () => {
    const events = [{ event: '甲', estimatedUnits: 700 }, { event: '乙', estimatedUnits: 300 }]
    const targets = keyEventCharTargetsText(events, 2000)
    const shortOutline = shortOutlineSegmentBudget('zh-CN', events, 2000)
    expect(targets).toContain('第 1 场：约 1400 字')
    expect(shortOutline).toContain('1. 约 1400 字：甲')
    expect(targets).toContain('第 2 场：约 600 字')
    expect(shortOutline).toContain('2. 约 600 字：乙')
  })
})
