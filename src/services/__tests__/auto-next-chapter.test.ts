import { normalizeKeyEvents } from '../../shared/blueprint-key-events'
import { describe, expect, it } from 'vitest'

import { getAutoNextChapterPrefill } from '../auto-next-chapter'

const blueprint = {
  chapterNumber: 2,
  title: '雨夜来信',
  role: '发展',
  purpose: '推进调查',
  keyEvents: normalizeKeyEvents('收到密信', { chapterNumber: 2 }),
  characters: ['林舟', '苏雨'],
  userGuidance: '保留悬念',
  suspenseHook: '信是谁寄的还没答案。',
}

describe('getAutoNextChapterPrefill', () => {
  it('opens the immediate next blueprint only when the user enabled the setting', () => {
    const prefill = getAutoNextChapterPrefill(true, 1, blueprint, false)
    expect(prefill).toEqual({
      chapterNumber: 2,
      title: '雨夜来信',
      role: '发展',
      purpose: '推进调查',
      keyEvents: '收到密信',
      suspenseHook: '信是谁寄的还没答案。',
      characters: '林舟、苏雨',
      userGuidance: '保留悬念',
    })
    // 回归（2026-10-17）：这份 prefill 是**手工列字段**构造的，此前漏了 suspenseHook，
    // 导致创作弹窗「结尾钩子」栏只剩 placeholder。锁住键集合 —— 将来新增要从蓝图
    // 注入弹窗的字段时，这里会红，逼着同步（判据 T：手工列字段是漏字段的固定断点）。
    expect(Object.keys(prefill!).sort()).toEqual([
      'chapterNumber', 'characters', 'keyEvents', 'purpose', 'role', 'suspenseHook', 'title', 'userGuidance',
    ])
  })

  it.each([
    [false, 1, blueprint, false],
    [true, 1, { ...blueprint, chapterNumber: 3 }, false],
    [true, 1, blueprint, true],
  ])('does not open an unsafe or unavailable next chapter', (enabled, completedChapter, nextBlueprint, hasDraft) => {
    expect(getAutoNextChapterPrefill(enabled, completedChapter, nextBlueprint, hasDraft)).toBeNull()
  })
})
