import { describe, expect, it } from 'vitest'
import { keyEventId, keyEventsText, normalizeKeyEvents } from '../blueprint-key-events'

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
