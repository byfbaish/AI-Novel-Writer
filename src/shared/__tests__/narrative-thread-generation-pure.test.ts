import { describe, expect, it } from 'vitest'

import {
  buildNarrativeThreadEventTask,
  buildNarrativeThreadPlanTask,
  NARRATIVE_THREAD_CANDIDATE_BUDGET,
  parseNarrativeThreadEventCandidates,
  parseNarrativeThreadPlanCandidates,
  type NarrativeThreadPlanCandidate,
} from '../narrative-thread-generation-pure'
import type { NarrativeThreadView } from '../narrative-thread'
import type { WritingLanguage } from '../writing-language'

const INVALID = 'NARRATIVE_THREAD_CANDIDATES_INVALID'

function validPlanContent(count = 1): string {
  const candidates = Array.from({ length: count }, (_, i) => ({
    title: `伏笔 ${i + 1}`,
    type: 'foreshadow',
    targetStartChapter: 2,
    targetEndChapter: 8,
    authorIntent: `意图 ${i + 1}`,
  }))
  return JSON.stringify({ candidates })
}

function validEventContent(count = 1): string {
  const candidates = Array.from({ length: count }, (_, i) => ({
    type: 'planted',
    evidence: `证据片段${i + 1}`,
    reason: `理由 ${i + 1}`,
  }))
  return JSON.stringify({ candidates })
}

const EVENT_SOURCE = '正文开头。证据片段1 藏在第一段，证据片段2 在第二段。结尾。'

describe('NARRATIVE_THREAD_CANDIDATE_BUDGET', () => {
  it('常量取值与冻结状态', () => {
    expect(NARRATIVE_THREAD_CANDIDATE_BUDGET).toEqual({
      maxAttempts: 1,
      maxRequestedOutputTokens: 4096,
      maxRequestedOutputTokensPerAttempt: 4096,
      deadlineMs: 120_000,
    })
    expect(Object.isFrozen(NARRATIVE_THREAD_CANDIDATE_BUDGET)).toBe(true)
  })
})

describe('parseNarrativeThreadPlanCandidates', () => {
  it('合法单条候选：输出结构字段齐全且值正确', () => {
    const result = parseNarrativeThreadPlanCandidates(validPlanContent(), 10)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: '伏笔 1',
      type: 'foreshadow',
      targetStartChapter: 2,
      targetEndChapter: 8,
      authorIntent: '意图 1',
    })
  })

  it('多条候选全部返回', () => {
    const result = parseNarrativeThreadPlanCandidates(validPlanContent(3), 10)
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.title)).toEqual(['伏笔 1', '伏笔 2', '伏笔 3'])
  })

  it('输入归一化：字段首尾空白被去除', () => {
    const content = JSON.stringify({
      candidates: [{
        title: '  空白标题  ',
        type: '  foreshadow  ',
        targetStartChapter: 1,
        targetEndChapter: 5,
        authorIntent: '  意图带空白  ',
      }],
    })
    const result = parseNarrativeThreadPlanCandidates(content, 10)
    expect(result[0]).toEqual({
      title: '空白标题',
      type: 'foreshadow',
      targetStartChapter: 1,
      targetEndChapter: 5,
      authorIntent: '意图带空白',
    })
  })

  it('边界：totalChapters=1 且 start=end=1 合法；start/end 取 totalChapters 上限合法', () => {
    const content = JSON.stringify({
      candidates: [
        { title: 'a', type: 't', targetStartChapter: 1, targetEndChapter: 1, authorIntent: 'i' },
        { title: 'b', type: 't', targetStartChapter: 9, targetEndChapter: 10, authorIntent: 'i' },
      ],
    })
    const result = parseNarrativeThreadPlanCandidates(content, 10)
    expect(result).toHaveLength(2)
    expect(result[0].targetStartChapter).toBe(1)
    expect(result[1].targetEndChapter).toBe(10)
  })

  it('空 candidates 数组返回空数组（兜底不抛错）', () => {
    expect(parseNarrativeThreadPlanCandidates('{"candidates":[]}', 10)).toEqual([])
  })

  it('legacyStoredEffect=true：超过 8 条只取前 8 条', () => {
    const result = parseNarrativeThreadPlanCandidates(validPlanContent(10), 10, true)
    expect(result).toHaveLength(8)
  })

  it('legacyStoredEffect=true：非法元素被跳过，合法元素保留', () => {
    const content = JSON.stringify({
      candidates: [
        { title: 'ok', type: 't', targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'i' },
        { title: 'bad', type: 't', targetStartChapter: 0, targetEndChapter: 2, authorIntent: 'i' },
        { title: 'ok2', type: 't', targetStartChapter: 3, targetEndChapter: 4, authorIntent: 'i' },
      ],
    })
    const result = parseNarrativeThreadPlanCandidates(content, 10, true)
    expect(result.map((c) => c.title)).toEqual(['ok', 'ok2'])
  })

  it.each([
    ['非 JSON 文本', 'not-json', 10],
    ['空串', '', 10],
    ['只有空白', '   ', 10],
  ])('非法输入 %s 抛 SyntaxError（JSON.parse 层）', (_, content, total) => {
    expect(() => parseNarrativeThreadPlanCandidates(content, total)).toThrow(SyntaxError)
  })

  it.each([
    ['顶层是数组', JSON.stringify([{ candidates: [] }])],
    ['顶层对象缺 candidates', JSON.stringify({})],
    ['candidates 是对象而非数组', JSON.stringify({ candidates: { 0: {} } })],
    ['candidates 含非对象元素', JSON.stringify({ candidates: ['str'] })],
  ])('%s 抛 NARRATIVE_THREAD_CANDIDATES_INVALID', (_, content) => {
    expect(() => parseNarrativeThreadPlanCandidates(content, 10)).toThrow(INVALID)
  })

  it.each([
    ['缺 title', { type: 't', targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'i' }],
    ['title 只有空白', { title: '  ', type: 't', targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'i' }],
    ['title 超 120 字', { title: 'x'.repeat(121), type: 't', targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'i' }],
    ['缺 type', { title: 'a', targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'i' }],
    ['type 超 60 字', { title: 'a', type: 'x'.repeat(61), targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'i' }],
    ['缺 authorIntent', { title: 'a', type: 't', targetStartChapter: 1, targetEndChapter: 2 }],
    ['authorIntent 超 1000 字', { title: 'a', type: 't', targetStartChapter: 1, targetEndChapter: 2, authorIntent: 'x'.repeat(1001) }],
    ['targetStartChapter 非整数', { title: 'a', type: 't', targetStartChapter: 1.5, targetEndChapter: 2, authorIntent: 'i' }],
    ['targetStartChapter 为 0', { title: 'a', type: 't', targetStartChapter: 0, targetEndChapter: 2, authorIntent: 'i' }],
    ['targetStartChapter 超过 totalChapters', { title: 'a', type: 't', targetStartChapter: 11, targetEndChapter: 12, authorIntent: 'i' }],
    ['targetEndChapter 小于 start', { title: 'a', type: 't', targetStartChapter: 5, targetEndChapter: 4, authorIntent: 'i' }],
    ['targetEndChapter 超过 totalChapters', { title: 'a', type: 't', targetStartChapter: 1, targetEndChapter: 11, authorIntent: 'i' }],
  ])('候选字段非法：%s 抛 NARRATIVE_THREAD_CANDIDATES_INVALID', (_, candidate) => {
    const content = JSON.stringify({ candidates: [candidate] })
    expect(() => parseNarrativeThreadPlanCandidates(content, 10)).toThrow(INVALID)
  })

  it('非 legacy 超过 8 条抛 NARRATIVE_THREAD_CANDIDATES_INVALID', () => {
    expect(() => parseNarrativeThreadPlanCandidates(validPlanContent(9), 10)).toThrow(INVALID)
  })
})

describe('parseNarrativeThreadEventCandidates', () => {
  it('合法单条候选：输出结构字段齐全', () => {
    const result = parseNarrativeThreadEventCandidates(validEventContent(), EVENT_SOURCE)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'planted', evidence: '证据片段1', reason: '理由 1' })
  })

  it('多条候选全部返回，四种 type 均合法', () => {
    const content = JSON.stringify({
      candidates: [
        { type: 'planted', evidence: '证据片段1', reason: 'r1' },
        { type: 'progressing', evidence: '证据片段2', reason: 'r2' },
        { type: 'resolved', evidence: '证据片段2', reason: 'r3' },
        { type: 'abandoned', evidence: '证据片段1', reason: 'r4' },
      ],
    })
    const result = parseNarrativeThreadEventCandidates(content, EVENT_SOURCE)
    expect(result).toHaveLength(4)
    expect(result.map((c) => c.type)).toEqual(['planted', 'progressing', 'resolved', 'abandoned'])
  })

  it('输入归一化：evidence 与正文忽略空白后逐字匹配', () => {
    const content = JSON.stringify({
      candidates: [{ type: 'planted', evidence: '证 据 片 段 1', reason: '  理由带空白  ' }],
    })
    // 正文里「证据片段1」无空白，evidence 带空白仍应匹配（两侧均去空白后比较）
    const result = parseNarrativeThreadEventCandidates(content, EVENT_SOURCE)
    expect(result[0]).toEqual({ type: 'planted', evidence: '证 据 片 段 1', reason: '理由带空白' })
  })

  it('空 candidates 数组返回空数组（兜底不抛错）', () => {
    expect(parseNarrativeThreadEventCandidates('{"candidates":[]}', EVENT_SOURCE)).toEqual([])
  })

  it('legacyStoredEffect=true：超过 5 条只取前 5 条', () => {
    const source = Array.from({ length: 7 }, (_, i) => `片段${i + 1}`).join('，')
    const candidates = Array.from({ length: 7 }, (_, i) => ({
      type: 'planted',
      evidence: `片段${i + 1}`,
      reason: `理由 ${i + 1}`,
    }))
    const result = parseNarrativeThreadEventCandidates(JSON.stringify({ candidates }), source, true)
    expect(result).toHaveLength(5)
    expect(result[0].evidence).toBe('片段1')
    expect(result[4].evidence).toBe('片段5')
  })

  it('legacyStoredEffect=true：非法元素被跳过', () => {
    const content = JSON.stringify({
      candidates: [
        { type: 'planted', evidence: '证据片段1', reason: 'r1' },
        { type: 'done', evidence: '证据片段1', reason: 'r2' },
        { type: 'planted', evidence: '证据片段2', reason: 'r3' },
      ],
    })
    const result = parseNarrativeThreadEventCandidates(content, EVENT_SOURCE, true)
    expect(result.map((c) => c.evidence)).toEqual(['证据片段1', '证据片段2'])
  })

  it('非 JSON / 空串抛 SyntaxError', () => {
    expect(() => parseNarrativeThreadEventCandidates('not-json', EVENT_SOURCE)).toThrow(SyntaxError)
    expect(() => parseNarrativeThreadEventCandidates('', EVENT_SOURCE)).toThrow(SyntaxError)
  })

  it.each([
    ['type 非法值', { type: 'done', evidence: '证据片段1', reason: 'r' }],
    ['缺 type', { evidence: '证据片段1', reason: 'r' }],
    ['evidence 不在正文', { type: 'planted', evidence: '正文里没有这段', reason: 'r' }],
    ['evidence 只有空白', { type: 'planted', evidence: '  ', reason: 'r' }],
    ['evidence 超 240 字', { type: 'planted', evidence: '证'.repeat(241), reason: 'r' }],
    ['reason 超 500 字', { type: 'planted', evidence: '证据片段1', reason: 'x'.repeat(501) }],
  ])('候选字段非法：%s 抛 NARRATIVE_THREAD_CANDIDATES_INVALID', (_, candidate) => {
    const content = JSON.stringify({ candidates: [candidate] })
    expect(() => parseNarrativeThreadEventCandidates(content, EVENT_SOURCE)).toThrow(INVALID)
  })

  it('非 legacy 超过 5 条抛 NARRATIVE_THREAD_CANDIDATES_INVALID', () => {
    expect(() => parseNarrativeThreadEventCandidates(validEventContent(6), EVENT_SOURCE)).toThrow(INVALID)
  })
})

describe('buildNarrativeThreadPlanTask', () => {
  const blueprint = { key: 'blueprint-stub' }

  function build(language: WritingLanguage) {
    return buildNarrativeThreadPlanTask({
      writingLanguage: language,
      totalChapters: 30,
      blueprint: blueprint as never,
    })
  }

  it('输出结构字段齐全', () => {
    const task = build('zh-CN')
    expect(task.purpose).toBe('narrative-thread-plan-candidate')
    expect(task.reasoningStage).toBe('planning')
    expect(task.output).toBe('structured-data')
    expect(task.messages).toHaveLength(2)
    expect(task.messages[0].role).toBe('system')
    expect(task.messages[1].role).toBe('user')
  })

  it('system 文案携带 totalChapters 范围（1..N）', () => {
    const task = build('zh-CN')
    expect(task.messages[0].content).toContain('1..30')
  })

  it('user 载荷包含 totalChapters 与 blueprint', () => {
    const task = build('zh-CN')
    const payload = JSON.parse(task.messages[1].content) as { totalChapters: number; blueprint: unknown }
    expect(payload.totalChapters).toBe(30)
    expect(payload.blueprint).toEqual(blueprint)
  })

  it('语言切换：en-US 使用英文文案，zh-CN 使用中文文案', () => {
    const zh = build('zh-CN').messages[0].content
    const en = build('en-US').messages[0].content
    expect(zh).toContain('小说结构编辑')
    expect(en).toContain('fiction structure editor')
    expect(zh).not.toBe(en)
  })
})

describe('buildNarrativeThreadEventTask', () => {
  const plan: NarrativeThreadView = {
    id: 7,
    title: '赵铎用律条锁人',
    type: 'foreshadow',
    targetStartChapter: 3,
    targetEndChapter: 9,
    authorIntent: '锁人之后翻盘',
    status: 'progressing',
    dormantChapters: 1,
    overdue: false,
    events: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }

  function build(language: WritingLanguage) {
    return buildNarrativeThreadEventTask({
      writingLanguage: language,
      plan,
      draftId: 42,
      chapterNumber: 5,
      finalizedContent: '定稿正文。',
    })
  }

  it('输出结构字段齐全', () => {
    const task = build('zh-CN')
    expect(task.purpose).toBe('narrative-thread-event-candidate')
    expect(task.reasoningStage).toBe('review')
    expect(task.output).toBe('structured-data')
    expect(task.messages).toHaveLength(2)
  })

  it('user 载荷包含 chapterNumber、plan 关键字段与 finalizedContent', () => {
    const task = build('zh-CN')
    const payload = JSON.parse(task.messages[1].content) as {
      chapterNumber: number
      plan: Record<string, unknown>
      finalizedContent: string
    }
    expect(payload.chapterNumber).toBe(5)
    expect(payload.finalizedContent).toBe('定稿正文。')
    expect(payload.plan).toEqual({
      title: '赵铎用律条锁人',
      type: 'foreshadow',
      targetStartChapter: 3,
      targetEndChapter: 9,
      authorIntent: '锁人之后翻盘',
      currentStatus: 'progressing',
    })
    // 载荷只应含结构所需字段，不携带 id / dormantChapters / overdue / events / 时间戳
    expect(Object.keys(payload.plan)).toEqual([
      'title', 'type', 'targetStartChapter', 'targetEndChapter', 'authorIntent', 'currentStatus',
    ])
  })

  it('语言切换：en-US 使用英文文案', () => {
    const en = build('en-US').messages[0].content
    expect(en).toContain('You review finalized fiction facts')
  })
})

// 类型层面确认导出别名可用（NarrativeThreadPlanCandidate = NarrativeThreadPlanInput）
const _typeProbe: NarrativeThreadPlanCandidate | undefined = undefined
void _typeProbe
