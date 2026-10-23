import { describe, expect, it } from 'vitest'

import {
  CADENCE_MAX_ITEMS,
  evaluateCadence,
  renderCadenceLine,
  renderCadenceSection,
  type CadenceEntry,
  type InstitutionCadence,
} from '../institution-cadence'

/**
 * 制度判定表（计划 §1.1）。九行逐行钉死，另外一条钉「渲染行里的数字只能来自输入字段」。
 *
 * 这里最要紧的不是 `due` 算得对不对，而是**三种 unknown 与 not_due 绝不混淆**：
 * 把「不知道」渲染成「未到」，作者就再也不会去看它（判据 DN 同型）。
 */
const cadence = (over: Partial<InstitutionCadence> = {}): InstitutionCadence => ({
  cadenceId: 'cadence:1',
  name: '月例',
  axis: 'chapter',
  interval: 10,
  anchorChapter: 12,
  anchorStoryDay: null,
  fallbackIntervalChapters: null,
  note: '',
  chapterNumber: null,
  evidence: '',
  source: 'author',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const entry = (over: Partial<InstitutionCadence>, evaluation: CadenceEntry['evaluation']): CadenceEntry => ({
  cadence: cadence(over),
  evaluation,
})

describe('evaluateCadence：判定表逐行', () => {
  it('按章轴：锚空 ⇒ unknown / none / anchor-missing（不是 not_due）', () => {
    const result = evaluateCadence(cadence({ anchorChapter: null }), { chapterNumber: 20, storyDayOffset: null })
    expect(result).toEqual({ status: 'unknown', basis: 'none', reason: 'anchor-missing' })
    expect(result.status).not.toBe('not_due')
  })

  it('按章轴：锚在本章之后 ⇒ unknown / none / anchor-in-future', () => {
    const result = evaluateCadence(cadence({ anchorChapter: 30 }), { chapterNumber: 20, storyDayOffset: null })
    expect(result).toEqual({ status: 'unknown', basis: 'none', reason: 'anchor-in-future' })
    expect(result.status).not.toBe('not_due')
  })

  it('按章轴：差值 ≥ 2N ⇒ overdue（至少漏了一整轮）', () => {
    // 锚 12、本章 32：差值 20 = 2 × 10，正好两轮
    expect(evaluateCadence(cadence({ interval: 10 }), { chapterNumber: 32, storyDayOffset: null }))
      .toEqual({ status: 'overdue', basis: 'chapter' })
    expect(evaluateCadence(cadence({ interval: 10 }), { chapterNumber: 40, storyDayOffset: null }))
      .toEqual({ status: 'overdue', basis: 'chapter' })
  })

  it('按章轴：N ≤ 差值 < 2N ⇒ due', () => {
    expect(evaluateCadence(cadence({ interval: 10 }), { chapterNumber: 22, storyDayOffset: null }))
      .toEqual({ status: 'due', basis: 'chapter' })
    expect(evaluateCadence(cadence({ interval: 10 }), { chapterNumber: 31, storyDayOffset: null }))
      .toEqual({ status: 'due', basis: 'chapter' })
  })

  it('按章轴：差值 < N ⇒ not_due', () => {
    expect(evaluateCadence(cadence({ interval: 10 }), { chapterNumber: 21, storyDayOffset: null }))
      .toEqual({ status: 'not_due', basis: 'chapter' })
    // 差值 0（本章就是上次发生那章）也属于未到
    expect(evaluateCadence(cadence({ interval: 10 }), { chapterNumber: 12, storyDayOffset: null }))
      .toEqual({ status: 'not_due', basis: 'chapter' })
  })

  it('日序轴：锚空 ⇒ 永远 unknown（即使有按章降级也不降级）', () => {
    const result = evaluateCadence(cadence({
      axis: 'story-day', interval: 7, anchorChapter: 12, anchorStoryDay: null, fallbackIntervalChapters: 3,
    }), { chapterNumber: 40, storyDayOffset: 30 })
    expect(result).toEqual({ status: 'unknown', basis: 'none', reason: 'anchor-missing' })
    expect(result.status).not.toBe('not_due')
  })

  it('日序轴：本章日序有值 ⇒ 用日差套三档（basis=story-day）', () => {
    const base = cadence({ axis: 'story-day', interval: 7, anchorStoryDay: 9, anchorChapter: 12 })
    expect(evaluateCadence(base, { chapterNumber: 20, storyDayOffset: 9 }))
      .toEqual({ status: 'not_due', basis: 'story-day' })
    expect(evaluateCadence(base, { chapterNumber: 20, storyDayOffset: 16 }))
      .toEqual({ status: 'due', basis: 'story-day' })
    expect(evaluateCadence(base, { chapterNumber: 20, storyDayOffset: 23 }))
      .toEqual({ status: 'overdue', basis: 'story-day' })
  })

  it('日序轴：本章日序空 + 降级轴与章锚都有 ⇒ 用章差（chapter-fallback）', () => {
    const base = cadence({
      axis: 'story-day', interval: 7, anchorChapter: 12, anchorStoryDay: 9, fallbackIntervalChapters: 3,
    })
    expect(evaluateCadence(base, { chapterNumber: 13, storyDayOffset: null }))
      .toEqual({ status: 'not_due', basis: 'chapter-fallback' })
    expect(evaluateCadence(base, { chapterNumber: 15, storyDayOffset: null }))
      .toEqual({ status: 'due', basis: 'chapter-fallback' })
    expect(evaluateCadence(base, { chapterNumber: 18, storyDayOffset: null }))
      .toEqual({ status: 'overdue', basis: 'chapter-fallback' })
  })

  it('日序轴：本章日序空 + 缺降级轴 ⇒ unknown / story-day-missing（不是 not_due）', () => {
    const noFallback = evaluateCadence(
      cadence({ axis: 'story-day', interval: 7, anchorChapter: 12, anchorStoryDay: 9 }),
      { chapterNumber: 40, storyDayOffset: null },
    )
    expect(noFallback).toEqual({ status: 'unknown', basis: 'none', reason: 'story-day-missing' })
    expect(noFallback.status).not.toBe('not_due')
    // 有降级轴但没有章锚，同样缺轴
    const noAnchor = evaluateCadence(
      cadence({ axis: 'story-day', interval: 7, anchorChapter: null, anchorStoryDay: 9, fallbackIntervalChapters: 3 }),
      { chapterNumber: 40, storyDayOffset: null },
    )
    expect(noAnchor).toEqual({ status: 'unknown', basis: 'none', reason: 'story-day-missing' })
  })
})

describe('renderCadenceLine / renderCadenceSection', () => {
  it('渲染：数字只来自输入字段；三种出处与四态逐字对齐计划样例；超限整条丢弃；中英对称', () => {
    // ---- ① 数字纪律：锚 12、每 10 章、本章 22 ⇒ 差值 10。行里只能出现 10 与 12。 ----
    const due = renderCadenceLine(
      entry({ interval: 10, anchorChapter: 12 }, { status: 'due', basis: 'chapter' }),
      'zh-CN',
    )
    expect(due).toBe('- 月例 — 每10章一次；上次：第12章（作者登记）⇒ 本章：到期')
    expect(due).not.toContain('22')
    expect(new Set(due.match(/\d+/gu) ?? [])).toEqual(new Set(['10', '12']))

    // ---- ② 三种出处：有锚无引文 / 有锚有引文 / 无锚 ----
    expect(renderCadenceLine(
      entry({ axis: 'story-day', interval: 7, anchorStoryDay: 9, anchorChapter: 12, evidence: '' },
        { status: 'unknown', basis: 'none', reason: 'story-day-missing' }),
      'zh-CN',
    )).toBe('- 月例 — 每7日一次；上次：第12章（书中第9日，作者登记）⇒ 本章：未知（本章日序不可知）')

    expect(renderCadenceLine(
      entry({ axis: 'story-day', interval: 3, anchorStoryDay: 9, anchorChapter: 12, fallbackIntervalChapters: 3,
        evidence: '巡夜的梆子响了三下' },
      { status: 'due', basis: 'chapter-fallback' }),
      'zh-CN',
    )).toBe('- 月例 — 每3日一次；上次：第12章（书中第9日）⇒ 本章：到期（按章降级：每3章）')

    // 一个锚都没登记：如实写「作者登记」，不伪造章号（也绝不出现「第0章」）
    const noAnchor = renderCadenceLine(
      entry({ anchorChapter: null, anchorStoryDay: null }, { status: 'unknown', basis: 'none', reason: 'anchor-missing' }),
      'zh-CN',
    )
    expect(noAnchor).toBe('- 月例 — 每10章一次；上次：作者登记⇒ 本章：未知（没有登记上次发生）')
    expect(noAnchor).not.toContain('第0章')

    // ---- ③ 四态文案：unknown 与 not_due 措辞不同（判据 DN 同型） ----
    const render = (evaluation: CadenceEntry['evaluation']) => renderCadenceLine(entry({}, evaluation), 'zh-CN')
    expect(render({ status: 'due', basis: 'chapter' })).toContain('本章：到期')
    expect(render({ status: 'not_due', basis: 'chapter' })).toContain('本章：未到')
    expect(render({ status: 'overdue', basis: 'chapter' })).toContain('本章：逾期（至少漏了一轮）')
    expect(render({ status: 'unknown', basis: 'none', reason: 'anchor-in-future' }))
      .toContain('本章：未知（上次记录在本章之后）')
    expect(render({ status: 'unknown', basis: 'none', reason: 'anchor-in-future' })).not.toContain('未到')

    // ---- ④ 空数组不留空标题；超条数上限整条丢弃 ----
    expect(renderCadenceSection([], 'zh-CN')).toBe('')
    const many = Array.from({ length: CADENCE_MAX_ITEMS + 2 }, (_, index) => entry(
      { name: `事件${index}`, anchorChapter: 12 },
      { status: 'due', basis: 'chapter' },
    ))
    const section = renderCadenceSection(many, 'zh-CN')
    expect(section.split('\n').filter(line => line.startsWith('- ')).length).toBe(CADENCE_MAX_ITEMS)
    expect(section).not.toContain('事件6')

    // ---- ⑤ 英文与中文对称 ----
    const english = renderCadenceSection([
      entry({}, { status: 'due', basis: 'chapter' }),
      entry({ name: '巡夜', axis: 'story-day', interval: 3, anchorStoryDay: 9, anchorChapter: 12,
        fallbackIntervalChapters: 3, evidence: '梆子响了三下' },
      { status: 'unknown', basis: 'none', reason: 'story-day-missing' }),
    ], 'en-US')
    expect(english).toContain('[Institutional cadences (recurring events: is it due?)]')
    expect(english).toContain('should happen')
    expect(english).toContain('this chapter: due')
    expect(english).toContain('unknown (this chapter\u2019s story day is unknown)')
    expect(english).toContain('author entry')
  })
})
