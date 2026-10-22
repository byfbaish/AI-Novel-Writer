import { describe, expect, it } from 'vitest'
import type { CastLedgerEntry } from '../../../../shared/cast-ledger'
import { CHARACTER_STATE_TEXT_FIELDS } from '../../../../shared/character-roster'
import {
  STATE_FIELD_LABELS,
  WORLD_STATE_STATUS_LABELS,
  WORLD_STATE_STATUS_ORDER,
  describeFieldProvenance,
  describeObservationReason,
  formatStoryDay,
  groupCastLedgerEntries,
  summarizeMentions,
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
