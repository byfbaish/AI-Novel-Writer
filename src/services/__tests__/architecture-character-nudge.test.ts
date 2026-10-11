import { describe, expect, it } from 'vitest'
import {
  OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS,
  type CharacterNudgeStorage,
  dismissOutlineCharacterNudge,
  hasOutlineContent,
  outlineCharacterNudgeKey,
  readOutlineCharacterNudgeDismissed,
  rearmOutlineCharacterNudge,
  shouldNudgeOutlineCharacterSupplement,
} from '../architecture-character-nudge'

function memoryStorage(): CharacterNudgeStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    removeItem: key => { map.delete(key) },
    dump: () => Object.fromEntries(map),
  }
}

describe('hasOutlineContent', () => {
  it('requires more than the minimum number of non-whitespace characters', () => {
    expect(hasOutlineContent('')).toBe(false)
    expect(hasOutlineContent(null)).toBe(false)
    expect(hasOutlineContent(undefined)).toBe(false)
    expect(hasOutlineContent('短')).toBe(false)
    // 只有空白也不算内容
    expect(hasOutlineContent('\n'.repeat(200))).toBe(false)
    expect(hasOutlineContent('x'.repeat(OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS + 1))).toBe(true)
    // 空白不计入有效字数
    expect(hasOutlineContent(`${'\n'.repeat(500)}${'x'.repeat(OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS + 1)}`)).toBe(true)
  })
})

describe('shouldNudgeOutlineCharacterSupplement', () => {
  const outline = '## 第1章：无声公寓\n沈舟在规则里找漏洞……'.repeat(6)

  it('prompts only when an outline exists and the notice was not handled', () => {
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: outline, dismissed: false })).toBe(true)
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: outline, dismissed: true })).toBe(false)
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: '', dismissed: false })).toBe(false)
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: outline, dismissed: false })).toBe(true)
  })
})

describe('outline character nudge state', () => {
  it('remembers the dismissal per project and re-arms on demand', () => {
    const storage = memoryStorage()
    const projectA = 'C:/books/a'
    const projectB = 'C:/books/b'

    expect(readOutlineCharacterNudgeDismissed(projectA, storage)).toBe(false)
    dismissOutlineCharacterNudge(projectA, storage)
    expect(readOutlineCharacterNudgeDismissed(projectA, storage)).toBe(true)
    // 逐项目隔离：不能因为 A 关过就静音 B
    expect(readOutlineCharacterNudgeDismissed(projectB, storage)).toBe(false)

    // 新的大纲生成 → 重新武装
    rearmOutlineCharacterNudge(projectA, storage)
    expect(readOutlineCharacterNudgeDismissed(projectA, storage)).toBe(false)
    expect(storage.dump()[outlineCharacterNudgeKey(projectA)]).toBeUndefined()
  })

  it('degrades quietly without storage or a project path', () => {
    expect(readOutlineCharacterNudgeDismissed(null, memoryStorage())).toBe(false)
    expect(readOutlineCharacterNudgeDismissed('C:/books/a', null)).toBe(false)
    expect(() => dismissOutlineCharacterNudge('C:/books/a', null)).not.toThrow()
    expect(() => rearmOutlineCharacterNudge(undefined, memoryStorage())).not.toThrow()
  })
})
