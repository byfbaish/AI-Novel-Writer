import { describe, expect, it } from 'vitest'
import {
  OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS,
  type CharacterNudgeStorage,
  dismissOutlineCharacterNudge,
  hasOutlineContent,
  outlineCharacterNudgeKey,
  outlineNudgeDraftVersion,
  outlineNudgeVolumeIdentity,
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

// 每批正文都在增长（旧 `c<覆盖数>:l<正文长度>` 指纹会逐批失效 ⇒ 每批都重弹）。
// D11 的去重键按卷，正文怎么长都不该让同一卷再弹第二次。
const OUTLINE = '## 第1章：无声公寓\n沈舟在规则里找漏洞，反复核对每一条说明……'.repeat(6)
const VOLUME_1 = outlineNudgeVolumeIdentity({ volumeIndex: 1, synopsisIncomplete: true })
const VOLUME_1_FINAL = outlineNudgeVolumeIdentity({ volumeIndex: 1, synopsisIncomplete: false })
const VOLUME_2 = outlineNudgeVolumeIdentity({ volumeIndex: 2, synopsisIncomplete: true })
const VOLUME_2_FINAL = outlineNudgeVolumeIdentity({ volumeIndex: 2, synopsisIncomplete: false })

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
    expect(hasOutlineContent(OUTLINE)).toBe(true)
  })
})

describe('outlineNudgeVolumeIdentity', () => {
  it('normalizes missing / invalid volume numbers and the final-draft flag', () => {
    expect(outlineNudgeVolumeIdentity({})).toEqual({ volumeIndex: null, synopsisIncomplete: false })
    expect(outlineNudgeVolumeIdentity({ volumeIndex: null })).toEqual({ volumeIndex: null, synopsisIncomplete: false })
    expect(outlineNudgeVolumeIdentity({ volumeIndex: 3, synopsisIncomplete: true })).toEqual({ volumeIndex: 3, synopsisIncomplete: true })
    // 非法卷号（NaN/Infinity）按无卷处理，不落进指纹
    expect(outlineNudgeVolumeIdentity({ volumeIndex: Number.NaN }).volumeIndex).toBeNull()
  })
})

// 指纹函数单独断言（任务书 D11 要求）
describe('outlineNudgeDraftVersion (卷级指纹)', () => {
  it('is keyed by volume + outline final-draft state, never by length/coverage', () => {
    expect(outlineNudgeDraftVersion(VOLUME_1)).toBe('v1:wip')
    expect(outlineNudgeDraftVersion(VOLUME_1_FINAL)).toBe('v1:final')
    expect(outlineNudgeDraftVersion(VOLUME_2)).toBe('v2:wip')
    // 明确不再返回旧的 c<覆盖数>:l<正文长度> 形式
    expect(outlineNudgeDraftVersion(VOLUME_1)).not.toMatch(/^c\d+:l\d+$/u)
  })

  it('stays identical for the same volume + same final-draft state', () => {
    expect(outlineNudgeDraftVersion(outlineNudgeVolumeIdentity({ volumeIndex: 1, synopsisIncomplete: true })))
      .toBe(outlineNudgeDraftVersion(VOLUME_1))
  })

  it('changes when crossing volumes', () => {
    expect(outlineNudgeDraftVersion(VOLUME_1)).not.toBe(outlineNudgeDraftVersion(VOLUME_2))
  })

  it('changes when the volume outline goes from in-progress to final', () => {
    expect(outlineNudgeDraftVersion(VOLUME_1)).not.toBe(outlineNudgeDraftVersion(VOLUME_1_FINAL))
  })

  it('normalizes a missing volume index to "n"', () => {
    expect(outlineNudgeDraftVersion(outlineNudgeVolumeIdentity({}))).toBe('vn:final')
  })
})

describe('shouldNudgeOutlineCharacterSupplement', () => {
  it('同卷连续 3 批只提示 1 次（正文逐批增长也不再重弹）', () => {
    const storage = memoryStorage()
    const project = 'C:/books/vol'
    let prompts = 0
    // 模拟连写 3 批：每批都重新读 dismissedVersion、正文都比上一批长
    for (let batch = 0; batch < 3; batch += 1) {
      const longerOutline = `${OUTLINE}\n## 第${batch + 7}章：新单元\n又多了一批内容。`
      if (shouldNudgeOutlineCharacterSupplement({
        synopsis: longerOutline,
        dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
        volume: VOLUME_1_FINAL,
      })) {
        prompts += 1
        dismissOutlineCharacterNudge(project, VOLUME_1_FINAL, storage)
      }
    }
    expect(prompts).toBe(1)
  })

  it('该卷未定稿（synopsis_incomplete=true）期间一次都不提示，正文每批增长也不提示', () => {
    const storage = memoryStorage()
    const project = 'C:/books/wip'
    let prompts = 0
    for (let batch = 0; batch < 3; batch += 1) {
      const longerOutline = `${OUTLINE}\n## 第${batch + 7}章：新单元\n又多了一批内容。`
      expect(shouldNudgeOutlineCharacterSupplement({
        synopsis: longerOutline,
        dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
        volume: VOLUME_1,
      })).toBe(false)
      if (shouldNudgeOutlineCharacterSupplement({
        synopsis: longerOutline,
        dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
        volume: VOLUME_1,
      })) {
        prompts += 1
        dismissOutlineCharacterNudge(project, VOLUME_1, storage)
      }
    }
    expect(prompts).toBe(0)
    // 定稿那一刻才提示：同一卷、同一份正文，只因为定稿态翻了
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE,
      dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
      volume: VOLUME_1_FINAL,
    })).toBe(true)
  })

  it('跨卷提示第 2 次', () => {
    const storage = memoryStorage()
    const project = 'C:/books/vol'
    const should = (volume: typeof VOLUME_1) => shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE,
      dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
      volume,
    })
    // 卷 1：第一次提示，处理后本卷静音
    expect(should(VOLUME_1_FINAL)).toBe(true)
    dismissOutlineCharacterNudge(project, VOLUME_1_FINAL, storage)
    expect(should(VOLUME_1_FINAL)).toBe(false)
    // 卷 2：跨卷 ⇒ 第 2 次提示（同一份进程内，与内存链无关）
    expect(should(VOLUME_2_FINAL)).toBe(true)
  })

  it('prompts only when an outline exists and this volume was not handled yet', () => {
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: OUTLINE, dismissedVersion: null, volume: VOLUME_1_FINAL })).toBe(true)
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE,
      dismissedVersion: outlineNudgeDraftVersion(VOLUME_1_FINAL),
      volume: VOLUME_1_FINAL,
    })).toBe(false)
    expect(shouldNudgeOutlineCharacterSupplement({ synopsis: '', dismissedVersion: null, volume: VOLUME_1_FINAL })).toBe(false)
  })

  it('stays silent when the global switch is off, even for a fresh volume', () => {
    expect(shouldNudgeOutlineCharacterSupplement({
      synopsis: OUTLINE,
      dismissedVersion: null,
      volume: VOLUME_1_FINAL,
      globallyDisabled: true,
    })).toBe(false)
  })
})

describe('outline character nudge state', () => {
  it('remembers the handled volume per project and re-arms on demand', () => {
    const storage = memoryStorage()
    const projectA = 'C:/books/a'
    const projectB = 'C:/books/b'

    expect(readOutlineCharacterNudgeDismissedVersion(projectA, storage)).toBeNull()
    dismissOutlineCharacterNudge(projectA, VOLUME_1, storage)
    expect(readOutlineCharacterNudgeDismissedVersion(projectA, storage)).toBe(outlineNudgeDraftVersion(VOLUME_1))
    // 逐项目隔离：不能因为 A 关过就静音 B
    expect(readOutlineCharacterNudgeDismissedVersion(projectB, storage)).toBeNull()

    // 跨卷/新大纲生成 → 重新武装
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
      synopsis: OUTLINE,
      dismissedVersion: readOutlineCharacterNudgeDismissedVersion(project, storage),
      volume: VOLUME_1_FINAL,
    })).toBe(true)
  })

  it('clears every project when the global switch is turned back on', () => {
    const storage = memoryStorage()
    dismissOutlineCharacterNudge('C:/books/a', VOLUME_1, storage)
    dismissOutlineCharacterNudge('C:/books/b', VOLUME_1, storage)
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
    expect(() => dismissOutlineCharacterNudge('C:/books/a', VOLUME_1, null)).not.toThrow()
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
