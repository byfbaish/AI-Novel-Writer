import { describe, expect, it } from 'vitest'

import {
  CHAPTER_WORDS_TARGET_MAX,
  CHAPTER_WORDS_TARGET_MIN,
  createChapterInfoFromDialogInput,
  normalizeChapterWordsTarget,
} from '../chapter-creation-parameters'

describe('chapter creation parameters', () => {
  it('clamps target words at the shared UI and workflow boundary', () => {
    expect(normalizeChapterWordsTarget(99, 3000)).toBe(CHAPTER_WORDS_TARGET_MIN)
    expect(normalizeChapterWordsTarget(20_001, 3000)).toBe(CHAPTER_WORDS_TARGET_MAX)
    expect(normalizeChapterWordsTarget(undefined, 30_000)).toBe(CHAPTER_WORDS_TARGET_MAX)
  })

  it('passes the bounded user-selected target into the created ChapterInfo', () => {
    const chapterInfo = createChapterInfoFromDialogInput({
      projectPath: 'C:\\novels\\single-chapter-target',
      chapterNumber: 2,
      title: '第二章',
      role: '发展',
      purpose: '推进冲突',
      keyEvents: '主角发现线索',
      suspenseHook: '门后有人在等他，他还不知道是谁',
      characters: '林岚，周砚',
      userGuidance: '结尾留下悬念',
      knowledgeQueryHint: '航班编号',
      wordsTarget: 25_000,
      defaultWordsTarget: 6000,
    })

    expect(chapterInfo).toMatchObject({
      chapterNumber: 2,
      title: '第二章',
      characters: ['林岚', '周砚'],
      wordsTarget: CHAPTER_WORDS_TARGET_MAX,
      // 回归（2026-10-17）：单章创作入口曾漏掉 suspenseHook ⇒ 蓝图里设计好的章末钩子
      // 从未进入正文请求（`chapter_info` JSON 里连这个键都没有，被 JSON.stringify 省略）。
      suspenseHook: '门后有人在等他，他还不知道是谁',
    })
  })

  it('collapses a blank suspense hook to undefined instead of an empty JSON field', () => {
    const chapterInfo = createChapterInfoFromDialogInput({
      projectPath: 'C:\\novels\\blank-hook',
      chapterNumber: 1,
      title: '',
      role: '建置',
      purpose: '开场',
      keyEvents: '开场事件',
      suspenseHook: '   ',
      characters: '林岚',
      userGuidance: '',
      knowledgeQueryHint: '',
      wordsTarget: 3000,
      defaultWordsTarget: 3000,
    })

    expect(chapterInfo.suspenseHook).toBeUndefined()
  })
})
