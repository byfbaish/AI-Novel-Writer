import { describe, expect, it } from 'vitest'
import type { CastLedgerEntry } from '../../../../shared/cast-ledger'
import { CHARACTER_STATE_TEXT_FIELDS } from '../../../../shared/character-roster'
import type { WorldStateChapter } from '../../../../shared/world-state-view'
import { emptyWorldStateView } from '../../../../shared/world-state-view'
import {
  SPACE_AUDIT_KIND_LABELS,
  STATE_FIELD_LABELS,
  TIMELINE_UNKNOWN_GROUP_KEY,
  WORLD_STATE_SECTION_LABELS,
  WORLD_STATE_SECTION_ORDER,
  WORLD_STATE_STATUS_LABELS,
  WORLD_STATE_STATUS_ORDER,
  defaultExpandedTimelineKeys,
  describeFieldProvenance,
  describeObservationReason,
  filterContinuityFacts,
  formatStoryDay,
  groupCastLedgerEntries,
  groupTimelineByStoryDay,
  summarizeMentions,
  summarizeSpaceAudit,
  summarizeUnreadable,
} from '../world-state-view-model'

type Status = CastLedgerEntry['status']
type Source = CastLedgerEntry['mentions'][number]['source']

function mention(source: Source, chapterNumber?: number): CastLedgerEntry['mentions'][number] {
  return chapterNumber === undefined
    ? { name: '林砚', source }
    : { name: '林砚', source, chapterNumber }
}

function entry(name: string, status: Status, mentions: CastLedgerEntry['mentions'] = [], characterIds: string[] = []): CastLedgerEntry {
  return { name, status, characterIds, mentions }
}

describe('formatStoryDay', () => {
  it('prefers the author-written story day label', () => {
    expect(formatStoryDay({ storyDayOffset: 2, storyDayLabel: '第三天清晨' }, 'zh-CN')).toBe('第三天清晨')
  })

  it('treats a blank label as absent', () => {
    expect(formatStoryDay({ storyDayOffset: 4, storyDayLabel: '   ' }, 'zh-CN')).toBe('第4日')
  })

  it('returns null when the offset is unknown (never renders day 0 by accident)', () => {
    expect(formatStoryDay({ storyDayOffset: null, storyDayLabel: null }, 'zh-CN')).toBeNull()
  })

  it('renders offset 0 as a real day, distinct from unknown', () => {
    expect(formatStoryDay({ storyDayOffset: 0, storyDayLabel: null }, 'zh-CN')).toBe('第0日')
    expect(formatStoryDay({ storyDayOffset: 0, storyDayLabel: null }, 'en-US')).toBe('Day 0')
  })

  it('renders offsets in English', () => {
    expect(formatStoryDay({ storyDayOffset: 3, storyDayLabel: null }, 'en-US')).toBe('Day 3')
  })
})

describe('summarizeMentions', () => {
  it('aggregates by source and lists deduped, sorted chapter numbers', () => {
    const target = entry('林砚', 'ambiguous', [
      mention('review-state-delta', 3),
      mention('review-state-delta', 3),
      mention('review-state-delta', 5),
      mention('blueprint', 3),
    ])

    expect(summarizeMentions(target, 'zh-CN')).toBe('审稿 2 次 · 蓝图 1 次（第 3、5 章）')
  })

  it('counts mentions without chapter numbers without a chapter suffix', () => {
    const target = entry('林砚', 'orphan', [
      mention('review-state-delta'),
      mention('review-state-delta'),
      mention('finalized-proposal', 1),
    ])

    expect(summarizeMentions(target, 'zh-CN')).toBe('审稿 1 次 · 定稿 1 次（第 1 章）')
  })

  it('renders the English variant', () => {
    const target = entry('林砚', 'ambiguous', [
      mention('review-state-delta', 3),
      mention('review-state-delta', 5),
      mention('blueprint', 3),
    ])

    expect(summarizeMentions(target, 'en-US')).toBe('Review ×2 · Blueprint ×1 (ch. 3, 5)')
  })

  it('returns a no-mention fallback', () => {
    expect(summarizeMentions(entry('林砚', 'orphan'), 'zh-CN')).toBe('无提及')
    expect(summarizeMentions(entry('林砚', 'orphan'), 'en-US')).toBe('No mentions')
  })
})

describe('summarizeUnreadable', () => {
  it('returns null when nothing is unreadable', () => {
    expect(summarizeUnreadable({ review: 0, finalized: 0, blueprint: 0 }, 'zh-CN')).toBeNull()
    expect(summarizeUnreadable({ review: 0, finalized: 0, blueprint: 0 }, 'en-US')).toBeNull()
  })

  it('lists per-source counts and warns the view may be incomplete', () => {
    const zh = summarizeUnreadable({ review: 2, finalized: 1, blueprint: 0 }, 'zh-CN')
    expect(zh).toContain('审稿 2 条')
    expect(zh).toContain('定稿 1 条')
    expect(zh).toContain('蓝图 0 条')
    expect(zh).toContain('不完整')

    const en = summarizeUnreadable({ review: 2, finalized: 1, blueprint: 3 }, 'en-US')
    expect(en).toContain('review 2')
    expect(en).toContain('finalized 1')
    expect(en).toContain('blueprint 3')
    expect(en).toContain('incomplete')
  })
})

describe('summarizeSpaceAudit', () => {
  const audit = {
    tableSpaces: 3,
    machineLines: 2,
    issues: [
      { kind: 'missing-machine-line' as const, space: '藏经阁', detail: '…' },
      { kind: 'hours-unreadable' as const, space: '', detail: '…' },
    ],
    unreadable: false,
  }

  it('renders the three counts in both languages', () => {
    expect(summarizeSpaceAudit(audit, 'zh-CN')).toBe('表格 3 个空间 · 机读行 2 条 · 2 处待确认')
    expect(summarizeSpaceAudit(audit, 'en-US')).toBe('3 table space(s) · 2 machine line(s) · 2 to confirm')
  })

  it('returns null when the audit did not run (never renders 0 issues for unchecked data)', () => {
    expect(summarizeSpaceAudit({ ...audit, unreadable: true }, 'zh-CN')).toBeNull()
    expect(summarizeSpaceAudit(emptyWorldStateView(null).spaceAudit, 'en-US')).toBeNull()
  })
})

describe('groupCastLedgerEntries', () => {
  it('always returns the four status groups in fixed order, even when empty', () => {
    const groups = groupCastLedgerEntries([])
    expect(groups.map((group) => group.status)).toEqual(['orphan', 'ambiguous', 'anchored', 'carded'])
    expect(groups.every((group) => group.entries.length === 0)).toBe(true)
  })

  it('keeps read-layer order inside each group and drops nothing', () => {
    const orphanA = entry('甲', 'orphan')
    const carded = entry('乙', 'carded')
    const anchored = entry('丙', 'anchored')
    const orphanB = entry('丁', 'orphan')
    const ambiguous = entry('戊', 'ambiguous')

    const groups = groupCastLedgerEntries([carded, orphanA, anchored, orphanB, ambiguous])

    expect(groups.map((group) => group.status)).toEqual(['orphan', 'ambiguous', 'anchored', 'carded'])
    expect(groups[0].entries.map((item) => item.name)).toEqual(['甲', '丁'])
    expect(groups[1].entries.map((item) => item.name)).toEqual(['戊'])
    expect(groups[2].entries.map((item) => item.name)).toEqual(['丙'])
    expect(groups[3].entries.map((item) => item.name)).toEqual(['乙'])
  })
})

describe('describeObservationReason', () => {
  it('returns null when the observation carries no reason', () => {
    expect(describeObservationReason(null, 'zh-CN')).toBeNull()
  })

  it('labels all three reasons in both languages', () => {
    expect(describeObservationReason('author-protected', 'zh-CN')).toBe('作者已保护')
    expect(describeObservationReason('author-protected', 'en-US')).toBe('Author-protected')
    expect(describeObservationReason('legacy-protected', 'zh-CN')).toBe('旧数据保护')
    expect(describeObservationReason('legacy-protected', 'en-US')).toBe('Legacy-protected')
    expect(describeObservationReason('review-conflict', 'zh-CN')).toBe('审稿冲突')
    expect(describeObservationReason('review-conflict', 'en-US')).toBe('Review conflict')
  })
})

describe('label tables', () => {
  it('covers every status with a badge label at four fixed slots', () => {
    expect(WORLD_STATE_STATUS_ORDER).toEqual(['orphan', 'ambiguous', 'anchored', 'carded'])
    for (const status of WORLD_STATE_STATUS_ORDER) {
      expect(WORLD_STATE_STATUS_LABELS[status].zh.length).toBeGreaterThan(0)
      expect(WORLD_STATE_STATUS_LABELS[status].en.length).toBeGreaterThan(0)
    }
  })

  it('keeps the six sections in fixed order: people, things, events, then the space check last', () => {
    // 「人 / 物 / 事」并列（设计稿 §6）：resources（物）紧跟 characters（人）；
    // space 是检查结果而非世界状态本身，仍在末尾。
    // resources 已下线（ADR-0022）：账本余额对写作没有用处，组件保留但不列出。
    expect(WORLD_STATE_SECTION_ORDER).toEqual(['cast', 'timeline', 'characters', 'facts', 'space'])
    for (const section of WORLD_STATE_SECTION_ORDER) {
      expect(WORLD_STATE_SECTION_LABELS[section].zh.length).toBeGreaterThan(0)
      expect(WORLD_STATE_SECTION_LABELS[section].en.length).toBeGreaterThan(0)
    }
    expect(WORLD_STATE_SECTION_LABELS.resources).toEqual({ zh: '资源', en: 'Resources' })
    expect(WORLD_STATE_SECTION_LABELS.space).toEqual({ zh: '空间检查', en: 'Space check' })
  })

  it('labels every space-audit issue kind in both languages', () => {
    const kinds = Object.keys(SPACE_AUDIT_KIND_LABELS)
    expect(kinds).toHaveLength(10)
    for (const kind of kinds) {
      expect(SPACE_AUDIT_KIND_LABELS[kind as keyof typeof SPACE_AUDIT_KIND_LABELS].zh.length).toBeGreaterThan(0)
      expect(SPACE_AUDIT_KIND_LABELS[kind as keyof typeof SPACE_AUDIT_KIND_LABELS].en.length).toBeGreaterThan(0)
    }
  })

  it('keeps the six state-field labels aligned with the character panel wording', () => {
    const expected: Record<string, [string, string]> = {
      location: ['位置', 'Location'],
      powerLevel: ['能力等级', 'Power level'],
      physicalState: ['身体状态', 'Physical state'],
      mentalState: ['心理状态', 'Mental state'],
      keyItems: ['关键物品', 'Key items'],
      recentEvents: ['近期事件', 'Recent events'],
    }

    for (const field of CHARACTER_STATE_TEXT_FIELDS) {
      expect(STATE_FIELD_LABELS[field].zh).toBe(expected[field][0])
      expect(STATE_FIELD_LABELS[field].en).toBe(expected[field][1])
    }
  })
})

describe('describeFieldProvenance', () => {
  it('returns null for an unknown slot', () => {
    expect(describeFieldProvenance(null, 'zh-CN')).toBeNull()
    expect(describeFieldProvenance(undefined, 'zh-CN')).toBeNull()
  })

  it('labels author / derived / legacy provenance with chapter numbers', () => {
    expect(describeFieldProvenance({ kind: 'author', chapterNumber: 3 }, 'zh-CN')).toBe('作者 ch3')
    expect(describeFieldProvenance({ kind: 'derived', chapterNumber: 2 }, 'zh-CN')).toBe('定稿派生 ch2')
    expect(describeFieldProvenance({ kind: 'legacy' }, 'zh-CN')).toBe('旧数据')
    expect(describeFieldProvenance({ kind: 'author', chapterNumber: 3 }, 'en-US')).toBe('Author ch3')
    expect(describeFieldProvenance({ kind: 'derived', chapterNumber: 2 }, 'en-US')).toBe('Finalized-derived ch2')
    expect(describeFieldProvenance({ kind: 'legacy' }, 'en-US')).toBe('Legacy')
  })
})

describe('groupTimelineByStoryDay', () => {
  function chapter(
    chapterNumber: number,
    storyDayOffset: number | null,
    storyDayLabel: string | null = null,
  ): WorldStateChapter {
    return {
      chapterNumber,
      title: null,
      storyDayOffset,
      storyDayLabel,
      draftStatus: 'finalized',
      observations: [],
    }
  }

  it('groups chapters that share a story day and keeps chapter order inside the group', () => {
    const groups = groupTimelineByStoryDay(
      [chapter(3, 9), chapter(1, 9), chapter(2, 9), chapter(4, 10)],
      'zh-CN',
    )

    expect(groups.map(group => group.key)).toEqual(['story-day:9', 'story-day:10'])
    expect(groups[0].chapters.map(item => item.chapterNumber)).toEqual([1, 2, 3])
    expect(groups[0].label).toBe('第9日')
    expect(groups[1].chapters.map(item => item.chapterNumber)).toEqual([4])
  })

  it('sorts day groups by story-day offset regardless of input order', () => {
    const groups = groupTimelineByStoryDay([chapter(5, 12), chapter(1, 2), chapter(3, 7)], 'zh-CN')

    expect(groups.map(group => group.storyDayOffset)).toEqual([2, 7, 12])
  })

  it('keeps unknown story days in their own trailing group instead of collapsing them to day 0', () => {
    const groups = groupTimelineByStoryDay([chapter(2, null), chapter(1, 0), chapter(3, null)], 'zh-CN')

    expect(groups.map(group => group.key)).toEqual(['story-day:0', TIMELINE_UNKNOWN_GROUP_KEY])
    // 0 是合法日序，必须与「未知」分开显示。
    expect(groups[0].label).toBe('第0日')
    expect(groups[1].storyDayOffset).toBeNull()
    expect(groups[1].label).toBe('日序未知')
    expect(groups[1].chapters.map(item => item.chapterNumber)).toEqual([2, 3])
  })

  it('prefers the author-written story day label over the numeric offset', () => {
    const groups = groupTimelineByStoryDay(
      [chapter(1, 3, '第三天清晨'), chapter(2, 3)],
      'zh-CN',
    )

    expect(groups[0].label).toBe('第三天清晨')
  })

  it('labels the unknown group in English when the locale is en-US', () => {
    const groups = groupTimelineByStoryDay([chapter(1, null)], 'en-US')

    expect(groups[0].label).toBe('Unknown story day')
    expect(groups[0].chapters).toHaveLength(1)
  })

  it('returns no groups for an empty timeline', () => {
    expect(groupTimelineByStoryDay([], 'zh-CN')).toEqual([])
  })
})

describe('defaultExpandedTimelineKeys', () => {
  const groups = [1, 2, 3, 4, 5].map(offset => ({
    key: `story-day:${offset}`,
    storyDayOffset: offset,
    label: `第${offset}日`,
    chapters: [],
  }))

  it('expands only the most recent three groups', () => {
    expect(defaultExpandedTimelineKeys(groups)).toEqual(['story-day:3', 'story-day:4', 'story-day:5'])
  })

  it('expands everything when there are fewer groups than the limit', () => {
    expect(defaultExpandedTimelineKeys(groups.slice(0, 2))).toEqual(['story-day:1', 'story-day:2'])
  })

  it('returns an empty list for an empty timeline', () => {
    expect(defaultExpandedTimelineKeys([])).toEqual([])
  })
})

describe('filterContinuityFacts', () => {
  const facts = [
    { chapterNumber: 1, text: '林舟在下品灵石矿脉取走一百二十枚' },
    { chapterNumber: 2, text: '林舟只剩二十枚灵石' },
    { chapterNumber: 12, text: '执法堂封了矿脉' },
  ]

  it('returns every fact for a blank query', () => {
    expect(filterContinuityFacts(facts, '   ')).toHaveLength(3)
  })

  it('matches the fact text', () => {
    expect(filterContinuityFacts(facts, '灵石').map(fact => fact.chapterNumber)).toEqual([1, 2])
    expect(filterContinuityFacts(facts, '矿脉').map(fact => fact.chapterNumber)).toEqual([1, 12])
  })

  it('matches a chapter number with or without the Chinese prefix/suffix', () => {
    expect(filterContinuityFacts(facts, '12').map(fact => fact.chapterNumber)).toEqual([12])
    expect(filterContinuityFacts(facts, '第12章').map(fact => fact.chapterNumber)).toEqual([12])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterContinuityFacts(facts, '不存在的东西')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const result = filterContinuityFacts(facts, '')

    expect(result).not.toBe(facts)
    expect(facts).toHaveLength(3)
  })
})
