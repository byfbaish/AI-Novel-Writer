import { describe, expect, it } from 'vitest'
import {
  CHAPTER_FAILURE_CODE_VOCABULARY,
  CHAPTER_FAILURE_CODES,
  chapterFailureMeta,
  incompleteFinishReasonCode,
  isChapterFailureCode,
} from '../chapter-failure'
import type { LLMFinishReason } from '../ipc-channels'

describe('D13 chapter-failure 失败契约', () => {
  it('词表内每个码都有对人话版本的契约（layer / detail / suggestions）', () => {
    for (const code of CHAPTER_FAILURE_CODE_VOCABULARY) {
      const meta = chapterFailureMeta(code)
      expect(meta, `missing meta for ${code}`).toBeDefined()
      expect(meta!.code).toBe(code)
      expect(['call', 'content', 'compose']).toContain(meta!.layer)
      expect(meta!.detail.length).toBeGreaterThan(0)
      expect(Array.isArray(meta!.suggestions)).toBe(true)
    }
  })

  it('词表码是稳定的受控码：无空白、统一前缀、互不重复', () => {
    expect(new Set(CHAPTER_FAILURE_CODE_VOCABULARY).size).toBe(CHAPTER_FAILURE_CODE_VOCABULARY.length)
    for (const code of CHAPTER_FAILURE_CODE_VOCABULARY) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]{4,63}$/)
      expect(code.startsWith('DRAFT_') || code.startsWith('GENERATION_COMPOSITION_')).toBe(true)
      expect(isChapterFailureCode(code)).toBe(true)
    }
    // 常量表与词表一一对应（不允许多出一个没契约的码）
    const constantCodes = Object.values(CHAPTER_FAILURE_CODES)
    expect(constantCodes.length).toBe(CHAPTER_FAILURE_CODE_VOCABULARY.length)
    for (const code of constantCodes) expect(isChapterFailureCode(code)).toBe(true)
  })

  it('码必须来自词表：词表外字符串一律不通过 isChapterFailureCode，也不产生 meta', () => {
    for (const stray of ['DRAFT_INCOMPLETE_OUTPUT', 'GENERATION_FAILED', 'draft_too_short', 'CANCELLED', '']) {
      expect(isChapterFailureCode(stray)).toBe(false)
      expect(chapterFailureMeta(stray)).toBeUndefined()
    }
  })

  it('incompleteFinishReasonCode 覆盖设计稿 §5.2 的 4 个非 stop 取值；error 不映射（现场裁决）', () => {
    const mapped: Exclude<LLMFinishReason, 'stop'>[] = [
      'length', 'content_filter', 'cancelled', 'unknown',
    ]
    for (const reason of mapped) {
      const code = incompleteFinishReasonCode(reason)
      expect(code, `unmapped reason ${reason}`).toBeDefined()
      expect(isChapterFailureCode(code!)).toBe(true)
      expect(code!.startsWith('DRAFT_INCOMPLETE_')).toBe(true)
    }
    // 'error' 不映射：设计稿 §5.2 只列 4 值；既有测试 generate-draft.command.test.ts:5341
    // 钉死「provider error + 不可信失败文本不得变成显示码」，红线禁止改该断言。
    expect(incompleteFinishReasonCode('error')).toBeUndefined()
    expect(incompleteFinishReasonCode('stop')).toBeUndefined()
    expect(incompleteFinishReasonCode('not-a-reason')).toBeUndefined()
  })

  it('detail 只写现象：不含行号、内部术语与「设计」「方案」等自指词', () => {
    const internalTerms = /:\d{2,}|：\d{2,}|IPC|electron|recoveryFailureCode|BoundedCompletion|Object\.assign/
    for (const code of CHAPTER_FAILURE_CODE_VOCABULARY) {
      const meta = chapterFailureMeta(code)!
      expect(meta.detail, `${code} detail leaks internals`).not.toMatch(internalTerms)
      for (const suggestion of meta.suggestions) {
        expect(suggestion, `${code} suggestion leaks internals`).not.toMatch(internalTerms)
      }
    }
  })

  it('压缩轮取消码与 CANCELLED 不重复：DRAFT_CANCELLED 是独立受控码', () => {
    expect(CHAPTER_FAILURE_CODES.DRAFT_CANCELLED).toBe('DRAFT_CANCELLED')
    expect(CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CANCELLED).toBe('DRAFT_INCOMPLETE_CANCELLED')
    expect(CHAPTER_FAILURE_CODES.DRAFT_CANCELLED).not.toBe(CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CANCELLED)
  })
})
