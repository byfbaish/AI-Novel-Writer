import { describe, expect, it } from 'vitest'
import {
  OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS,
  type CharacterNudgeStorage,
  dismissOutlineCharacterNudge,
  hasOutlineContent,
  outlineCharacterNudgeKey,
  outlineNudgeDraftVersion,
  readOutlineCharacterNudgeDismissedVersion,
  rearmAllOutlineCharacterNudges,
  rearmOutlineCharacterNudge,
  shouldNudgeOutlineCharacterSupplement,
} from '../architecture-character-nudge'

/** 内存版 localStorage：带 length / key()，用来覆盖「枚举前缀」那条恢复路径。 */
function memoryStorage(): CharacterNudgeStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    removeItem: key => { map.delete(key) },
    get length() { return map.size },
    key: (index: number) => [...map.keys()][index] ?? null,
    dump: () => Object.fromEntries(map),
  }
}

const OUTLINE_A = '## 第1章：无声公寓\n沈舟在规则里找漏洞……'.repeat(6)
const OUTLINE_B = `${OUTLINE_A}\n## 第7章：新的门\n他又数了一遍。`

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

describe('outlineNudgeDraftVersion', () => {
  it('changes when the outline really moves, and stays put for the same draft', () => {
    expect(outlineNudgeDraftVersion('')).toBe('empty')
    // 同一份内容始终同一个指纹
    expect(outlineNudgeDraftVersion(OUTLINE_A)).toBe(outlineNudgeDraftVersion(OUTLINE_A))
    // 多了第 7 章 → 覆盖数变了，必须重新提示
    expect(outlineNudgeDraftVersion(OUTLINE_A)).not.toBe(outlineNudgeDraftVersion(OUTLINE_B))
  })

  it('accepts spaced chapter headings, same as the outline backfill', () => {
    // 「第 9 章」（章号两侧带空格）必须认得出，否则修好的回填与提醒会两套口径。
    expect(outlineNudgeDraftVersion('## 第 1 章：甲\n## 第 9 章：乙').startsWith('c9:')).toBe(true)
    expect(outlineNudgeDraftVersion('## 第1章：甲\n## 第9章：乙').startsWith('c9:')).toBe(true)
  })
})

describe('shouldNudgeOutlineCharacterSupplement', () => {
  it('prompts only when an outline exists and this draft was not handled yet', () => {
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: OUTLINE_A, dismissedVersion: null })).toBe(true)
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE_A,
      dismissedVersion: outlineNudgeDraftVersion(OUTLINE_A),
    })).toBe(false)
    // 大纲更新过 → 上一稿的处理记录不算数
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE_B,
      dismissedVersion: outlineNudgeDraftVersion(OUTLINE_A),
    })).toBe(true)
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: '', dismissedVersion: null })).toBe(false)
  })

  it('stays silent when the global switch is off, even for a fresh draft', () => {
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE_A,
      dismissedVersion: null,
      globallyDisabled: true,
    })).toBe(false)
  })
})

describe('outline character nudge state', () => {
  it('remembers the handled draft per project and re-arms on demand', () => {
    const storage = memoryStorage()
    const projectA = 'C:/books/a'
    const projectB = 'C:/books/b'

    expect(readOutlineCharacterNudgeDismissedVersion(projectA, storage)).toBeNull()
    dismissOutlineCharacterNudge(projectA, OUTLINE_A, storage)
    expect(readOutlineCharacterNudgeDismissedVersion(projectA, storage)).toBe(outlineNudgeDraftVersion(OUTLINE_A))
    // 逐项目隔离：不能因为 A 关过就静音 B
    expect(readOutlineCharacterNudgeDismissedVersion(projectB, storage)).toBeNull()

    // 新的大纲生成 → 重新武装
    rearmOutlineCharacterNudge(projectA, storage)
    expect(readOutlineCharacterNudgeDismissedVersion(projectA, storage)).toBeNull()
    expect(storage.dump()[outlineCharacterNudgeKey(projectA)]).toBeUndefined()
  })

  it('treats the legacy permanent "dismissed" value as unhandled', () => {
    const storage = memoryStorage()
    const project = 'C:/books/legacy'
    // 旧版本把「一次点掉、永久消失」存成字符串 dismissed，不能当永久承诺继承。
    storage.setItem(outlineCharacterNudgeKey(project), 'dismissed')
    expect(readOutlineCharacterNudgeDismissedVersion(project, storage)).toBeNull()
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE_A,
      dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
    })).toBe(true)
  })

  it('clears every project when the global switch is turned back on', () => {
    const storage = memoryStorage()
    dismissOutlineCharacterNudge('C:/books/a', OUTLINE_A, storage)
    dismissOutlineCharacterNudge('C:/books/b', OUTLINE_A, storage)
    storage.setItem('unrelated-key', 'keep me')

    rearmAllOutlineCharacterNudges(storage)

    expect(readOutlineCharacterNudgeDismissedVersion('C:/books/a', storage)).toBeNull()
    expect(readOutlineCharacterNudgeDismissedVersion('C:/books/b', storage)).toBeNull()
    // 只清自己的前缀，别去动别人的键
    expect(storage.dump()['unrelated-key']).toBe('keep me')
  })

  it('degrades quietly without storage or a project path', () => {
    expect(readOutlineCharacterNudgeDismissedVersion(null, memoryStorage())).toBeNull()
    expect(readOutlineCharacterNudgeDismissedVersion('C:/books/a', null)).toBeNull()
    expect(() => dismissOutlineCharacterNudge('C:/books/a', OUTLINE_A, null)).not.toThrow()
    expect(() => rearmOutlineCharacterNudge(undefined, memoryStorage())).not.toThrow()
    expect(() => rearmAllOutlineCharacterNudges(null)).not.toThrow()
    // 不可枚举的存储：没有 length/key，直接跳过，不抛错
    const opaque: CharacterNudgeStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
    expect(() => rearmAllOutlineCharacterNudges(opaque)).not.toThrow()
  })
})
