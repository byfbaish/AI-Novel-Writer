import { describe, expect, it } from 'vitest'

import {
  describeVolumeHandoffFailure,
  fitVolumeHandoffDraft,
  parseVolumeHandoffDraft,
  selectVolumeHandoffNotes,
  volumeHandoffBodyChars,
  type VolumeHandoffDraft,
} from '../volume-handoff-generation'
import { renderVolumeHandoffSection, VOLUME_HANDOFF_MAX_CHARS } from '../../shared/volume-handoff'

const draft = (over: Partial<VolumeHandoffDraft> = {}): VolumeHandoffDraft => ({
  worldState: '宗门被围，护山大阵只剩三日',
  heroState: '重伤未愈，手里只剩半枚通行令',
  events: ['执法殿夺权', '林岚下山求援'],
  items: ['通行令在林岚手里'],
  debts: ['欠药铺三副药钱'],
  openThread: '谁给执法殿递的信',
  ...over,
})

describe('parseVolumeHandoffDraft', () => {
  it('接受严格 JSON、代码围栏与前后夹带说明文字', () => {
    const json = JSON.stringify({ ...draft() })
    expect(parseVolumeHandoffDraft(json)).toEqual(draft())
    expect(parseVolumeHandoffDraft('```json\n' + json + '\n```')).toEqual(draft())
    expect(parseVolumeHandoffDraft(`结果如下：\n${json}\n以上。`)).toEqual(draft())
  })

  it('拒绝不可解析的输出，以及六个键一个都不认识的 JSON', () => {
    expect(parseVolumeHandoffDraft('抱歉，我无法完成这个任务。')).toBeNull()
    expect(parseVolumeHandoffDraft('{"summary":"这是审稿报告"}')).toBeNull()
    expect(parseVolumeHandoffDraft('[1,2,3]')).toBeNull()
  })

  it('单字段类型不对只丢那一项，不整份作废', () => {
    const parsed = parseVolumeHandoffDraft(JSON.stringify({
      worldState: '  围城  ',
      heroState: '受伤',
      events: '不是数组',
      items: ['刀', '', 42, '  信  '],
      debts: [],
      openThread: '悬案',
    }))
    expect(parsed).toEqual({
      worldState: '围城', heroState: '受伤', events: [], items: ['刀', '信'], debts: [], openThread: '悬案',
    })
  })
})

describe('volumeHandoffBodyChars — 唯一计数口径', () => {
  it('与注入侧同一函数算出来的正文行逐字相等（防两套计数器漂移）', () => {
    const value = draft()
    const section = renderVolumeHandoffSection({
      handoffId: '', volumeId: '', volumeIndex: 1, firstChapter: 1, lastChapter: 1, boundaryBasis: 'actual',
      ...value, source: 'generated', createdAt: '', updatedAt: '',
    }, 'zh-CN', 1, Number.MAX_SAFE_INTEGER)
    expect(volumeHandoffBodyChars(value)).toBe(section.split('\n').slice(2).join('\n').length)
  })

  it('空草稿为 0', () => {
    expect(volumeHandoffBodyChars({ worldState: '', heroState: '', events: [], items: [], debts: [], openThread: '' })).toBe(0)
  })
})

describe('fitVolumeHandoffDraft', () => {
  it('按 5/5/3 裁数组，并如实报告被条数上限截掉的条数', () => {
    const fitted = fitVolumeHandoffDraft(draft({
      events: ['一', '二', '三', '四', '五', '六', '七'],
      items: ['一', '二', '三', '四', '五', '六'],
      debts: ['一', '二', '三', '四', '五'],
    }))
    expect(fitted.ok).toBe(true)
    if (!fitted.ok) return
    expect(fitted.draft.events).toHaveLength(5)
    expect(fitted.draft.items).toHaveLength(5)
    expect(fitted.draft.debts).toHaveLength(3)
    expect(fitted.report.droppedByLimit).toEqual({ events: 2, items: 1, debts: 2 })
  })

  it('超字数时整条丢（不截半句），且丢完仍在预算内', () => {
    const long = '长'.repeat(VOLUME_HANDOFF_MAX_CHARS / 2 + 100)
    const fitted = fitVolumeHandoffDraft(draft({ worldState: long, heroState: long }))
    expect(fitted.ok).toBe(true)
    if (!fitted.ok) return
    expect(fitted.report.bodyChars).toBeLessThanOrEqual(VOLUME_HANDOFF_MAX_CHARS)
    expect(fitted.report.droppedByBudget.length).toBeGreaterThan(0)
    // 丢弃按注入顺序反序：openThread 先走，worldState 最后走。
    expect(fitted.draft.openThread).toBe('')
    expect(fitted.draft.worldState).toBe(long)
    // 没有半句：留下的两条要么完整、要么为空。
    expect(fitted.draft.heroState === long || fitted.draft.heroState === '').toBe(true)
  })

  it('单条自身就超上限 ⇒ OVER_BUDGET（不写半句、不返回残骸）', () => {
    const fitted = fitVolumeHandoffDraft(draft({ worldState: '长'.repeat(VOLUME_HANDOFF_MAX_CHARS + 50) }))
    expect(fitted).toEqual({ ok: false, reason: 'VOLUME_HANDOFF_GENERATION_OVER_BUDGET' })
  })

  it('六项全空 ⇒ EMPTY', () => {
    const fitted = fitVolumeHandoffDraft({ worldState: '', heroState: '', events: [], items: [], debts: [], openThread: '' })
    expect(fitted).toEqual({ ok: false, reason: 'VOLUME_HANDOFF_GENERATION_EMPTY' })
  })
})

describe('selectVolumeHandoffNotes', () => {
  const notes = (chapterNumber: number, body = '要点'.repeat(20)) => ({
    chapterNumber,
    chapterTitle: `章${chapterNumber}`,
    notes: body,
  })

  it('超输入预算时从最旧的整章丢，末章必留', () => {
    const selection = selectVolumeHandoffNotes({
      notes: Array.from({ length: 60 }, (_, index) => notes(index + 1)),
      firstChapter: 1,
      lastChapter: 60,
      writingLanguage: 'zh-CN',
      maxChars: 500,
    })
    expect(selection.ok).toBe(true)
    expect(selection.coverage.usedChapters).toContain(60)
    expect(selection.coverage.droppedChapters).toContain(1)
    expect(selection.coverage.droppedChapters).not.toContain(60)
    // 丢掉的一定比留下的更旧。
    expect(Math.min(...selection.coverage.usedChapters)).toBeGreaterThan(Math.max(...selection.coverage.droppedChapters))
  })

  it('末章要点自身就超预算 ⇒ NOTES_OVER_BUDGET（不是静默降级）', () => {
    const selection = selectVolumeHandoffNotes({
      notes: [notes(1), notes(2, '长'.repeat(600))],
      firstChapter: 1,
      lastChapter: 2,
      writingLanguage: 'zh-CN',
      maxChars: 500,
    })
    expect(selection.ok).toBe(false)
    expect(selection.reason).toBe('VOLUME_HANDOFF_NOTES_OVER_BUDGET')
  })

  it('「区间内没有要点」与「因预算被丢」分得开', () => {
    const selection = selectVolumeHandoffNotes({
      notes: [notes(2), notes(4)],
      firstChapter: 1,
      lastChapter: 4,
      writingLanguage: 'zh-CN',
    })
    expect(selection.coverage.usedChapters).toEqual([2, 4])
    expect(selection.coverage.droppedChapters).toEqual([])
    expect(selection.coverage.missingChapters).toEqual([1, 3])
  })

  it('没有任何要点 ⇒ NOTES_EMPTY', () => {
    const selection = selectVolumeHandoffNotes({
      notes: [], firstChapter: 1, lastChapter: 3, writingLanguage: 'zh-CN',
    })
    expect(selection.ok).toBe(false)
    expect(selection.reason).toBe('VOLUME_HANDOFF_NOTES_EMPTY')
  })

  it('每章要点都带章号标题，中英各自成形', () => {
    const zh = selectVolumeHandoffNotes({ notes: [notes(7)], firstChapter: 7, lastChapter: 7, writingLanguage: 'zh-CN' })
    expect(zh.text).toContain('### 第7章 章7')
    const en = selectVolumeHandoffNotes({ notes: [notes(7)], firstChapter: 7, lastChapter: 7, writingLanguage: 'en-US' })
    expect(en.text).toContain('### Chapter 7 章7')
  })
})

describe('describeVolumeHandoffFailure', () => {
  it('已知原因给中英文案，未知原因原样透传（provider 摘要已脱敏）', () => {
    const text = (zh: string, en: string) => `${zh}|${en}`
    expect(describeVolumeHandoffFailure('VOLUME_HANDOFF_NOTES_EMPTY', text)).toContain('定稿要点')
    expect(describeVolumeHandoffFailure('VOLUME_HANDOFF_GENERATION_EMPTY', text)).toContain('no usable handoff')
    expect(describeVolumeHandoffFailure('401 unauthorized', text)).toBe('401 unauthorized')
  })
})
