import { describe, expect, it } from 'vitest'
import {
  CHARACTER_EVENT_TYPES,
  EVENT_TYPE_IDS,
  eventTypeCatalogMarkdown,
  eventTypeLabel,
  eventTypeOf,
  isEventTypeId,
} from '../character-event-types'

describe('处境类型库', () => {
  it('id 表与类型表一一对应，且顺序一致（顺序即展示顺序）', () => {
    expect(CHARACTER_EVENT_TYPES.map(type => type.id)).toEqual([...EVENT_TYPE_IDS])
    expect(new Set(EVENT_TYPE_IDS).size).toBe(EVENT_TYPE_IDS.length)
  })

  it('数量落在 8–12 区间附近，且每类都能独立指认', () => {
    // 草案定的是 8–12 类；本库 13 类 = 12 个日常压力 + 1 个收束类（退路与终局）。
    // 过细会回到枚举（作者 2026-10-29 02:53 明确否掉），过粗会退化成 D1 引力。
    expect(CHARACTER_EVENT_TYPES.length).toBe(13)
    for (const type of CHARACTER_EVENT_TYPES) {
      expect(type.name.length, type.id).toBeGreaterThan(1)
      expect(type.nameEn.length, type.id).toBeGreaterThan(3)
    }
  })

  // 反例是粒度的护栏：写不出反例，说明这一类划得太粗；两类之间找不到反例，说明该合并。
  it('每一类都必须带反例 —— 没有反例的类型等于没划边界', () => {
    for (const type of CHARACTER_EVENT_TYPES) {
      expect(type.definition.trim().length, `${type.id}.definition`).toBeGreaterThan(6)
      expect(type.counterExample.trim().length, `${type.id}.counterExample`).toBeGreaterThan(6)
      expect(type.definitionEn.trim().length, `${type.id}.definitionEn`).toBeGreaterThan(10)
      expect(type.counterExampleEn.trim().length, `${type.id}.counterExampleEn`).toBeGreaterThan(10)
    }
  })

  it('定义写的是「要他付出什么」的结构，不是场面', () => {
    // 场面会绑道具/地点/人名；这条只查最明显的几类泄漏，不做语义判断。
    const sceneWordsZh = ['纸', '手印', '桌', '门口', '房间', '刀']
    const sceneWordsEn = ['paper', 'thumbprint', 'desk', 'doorway', 'room', 'knife']
    for (const type of CHARACTER_EVENT_TYPES) {
      for (const word of sceneWordsZh) {
        expect(type.definition.includes(word), `${type.id}: ${word}`).toBe(false)
      }
      for (const word of sceneWordsEn) {
        expect(type.definitionEn.toLowerCase().includes(word), `${type.id}: ${word}`).toBe(false)
      }
    }
  })

  it('isEventTypeId / eventTypeOf 收敛未知输入', () => {
    expect(isEventTypeId('guarantee')).toBe(true)
    expect(isEventTypeId('nope')).toBe(false)
    expect(isEventTypeId('')).toBe(false)
    expect(isEventTypeId(null)).toBe(false)
    expect(eventTypeOf('hostage_anchor')?.name).toBe('押住他在乎的人')
    expect(eventTypeOf('nope')).toBeNull()
  })

  it('eventTypeLabel 跟随写作语言，未知 id 原样返回', () => {
    expect(eventTypeLabel('old_deed', 'zh-CN')).toBe('拿旧事要挟')
    expect(eventTypeLabel('old_deed', 'en-US')).toBe('Leveraging his past')
    expect(eventTypeLabel('nope', 'zh-CN')).toBe('nope')
    expect(eventTypeLabel(null, 'zh-CN')).toBe('')
  })

  it('目录 markdown 每类都带上反例，中英各一份', () => {
    const zh = eventTypeCatalogMarkdown('zh-CN')
    const en = eventTypeCatalogMarkdown('en-US')
    for (const type of CHARACTER_EVENT_TYPES) {
      expect(zh, type.id).toContain(type.name)
      expect(zh, type.id).toContain(type.counterExample)
      expect(en, type.id).toContain(type.nameEn)
      expect(en, type.id).toContain(type.counterExampleEn)
    }
    expect(zh).toContain('写不出反例')
    expect(en).toContain('counter-example is the guard rail')
  })

  // 第 12 类与第四层的关系在草案里就标了"类型库帮不上忙"：那是第四层判据的问题。
  // 这里只固定住一件事 —— 它的反例必须点明"代价不够就不触发第四层"。
  it('押住他在乎的人：反例说明代价不够时不触发第四层', () => {
    const type = eventTypeOf('hostage_anchor')!
    expect(type.counterExample).toContain('代价不够')
    expect(type.counterExampleEn).toContain('too low to reach layer 4')
  })
})
