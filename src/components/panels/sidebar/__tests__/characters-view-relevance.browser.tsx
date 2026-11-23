/**
 * C1-a 组件面断言（判据 J2 的 [mock] 层）。
 *
 * 结构与同目录 `CharactersView.search.browser.tsx` 一致：直接渲染
 * `CharactersView`，只把主进程 invoke 换成夹具。这里**不测**主进程，
 * 也不测 `db:blueprint-character-sync-list-all` / `db:project-core-get` 的真实返回——
 * 那是 C1-b 之外的事，本卡只需要「列表读到了之后怎么显示与筛选」。
 *
 * 夹具沿用 `src/shared/__tests__/character-relevance.test.ts` 的 5 张卡：
 * 仅关系 / 仅蓝图 / 仅大纲 / 全不中 / 全中。
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { page } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectData } from '../../../../shared/ipc-channels'
import { setActiveProjectSessionContext } from '../../../../shared/project-session-context'
import { useCharacterStore, type CharacterCard } from '../../../../stores/character-store'
import { useLocaleStore } from '../../../../stores/locale-store'
import { useProjectStore } from '../../../../stores/project-store'
import CharactersView from '../CharactersView'

const PROJECT_PATH = 'C:\\novels\\character-relevance'
const RELATION_ONLY = 'c-rel'
const BLUEPRINT_ONLY = 'c-bp'
const OUTLINE_ONLY = 'c-outline'
const NO_HIT = 'c-none'
const ALL_HIT = 'c-all'

const BLUEPRINT_OPERATIONS = [
  {
    operationId: 'op-1',
    startChapter: 12,
    endChapter: 37,
    characterSyncInput: [
      { chapterNumber: 12, characters: ['沈砚'] },
      { chapterNumber: 37, characters: ['沈砚', '程婴'] },
    ],
  },
]

const PROJECT_CORE = {
  synopsis: '老陈在清平里租下一间铺子，程婴替他看店。',
  plotStructurePlan: '第一卷收束在程婴离城。',
  worldbuilding: '清平里是旧城的商业街。',
}

const originalCharacterState = useCharacterStore.getState()
const originalLocaleState = useLocaleStore.getState()
const originalProjectState = useProjectStore.getState()

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

function project(): ProjectData {
  return {
    id: 'character-relevance',
    sessionLease: 'character-relevance-lease',
    name: 'Character Relevance',
    path: PROJECT_PATH,
    novelConfig: {
      genre: 'Mystery', subGenre: '', targetAudience: 'General', totalChapters: 40,
      wordsPerChapter: 2500, plotStructure: 'three_act', narrativePOV: 'third_limited',
      coreOutline: '', worldSetting: '', goldenFinger: '', protagonistProfile: '', globalGuidance: '',
    },
    characterStates: '', createdAt: '', updatedAt: '',
  }
}

function card(characterId: string, name: string, relationships: string): CharacterCard {
  return {
    characterId, name, role: 'supporting', gender: '', age: '', appearance: '', personality: '',
    background: '', abilities: '', motivation: '', relationships: relationships, arc: '', notes: '',
  }
}

function fiveCards(): CharacterCard[] {
  return [
    card(RELATION_ONLY, '程实', '周德胜：债主\n老陈：邻居\n钱多多：房东'),
    card(BLUEPRINT_ONLY, '沈砚', ''),
    card(OUTLINE_ONLY, '老陈', ''),
    card(NO_HIT, '无名氏', ''),
    card(ALL_HIT, '程婴', '沈砚：义子'),
  ]
}

function installBridge(options: { operations?: unknown[]; core?: unknown } = {}): void {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'db:blueprint-character-sync-list-all') return options.operations ?? BLUEPRINT_OPERATIONS
    if (channel === 'db:project-core-get') return options.core ?? PROJECT_CORE
    if (channel === 'finalized-character:list-state-candidates') return []
    if (channel === 'finalized-character:list-card-deltas') return { pending: [], hits: [] }
    return { success: true, avatars: [] }
  })
  window.aiNovelAPI = { invoke } as unknown as typeof window.aiNovelAPI
}

/** 组件里的读库 effect 是异步的：多抖两拍再断言，避免读到首帧。 */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function mount(cards: CharacterCard[] = fiveCards(), options: { operations?: unknown[]; core?: unknown } = {}): Promise<void> {
  installBridge(options)
  setActiveProjectSessionContext({
    projectId: 'character-relevance', leaseId: 'character-relevance-lease', projectPath: PROJECT_PATH,
  })
  useCharacterStore.setState({
    characters: cards,
    dataProjectKey: PROJECT_PATH,
    loadingProjectKey: null,
    lastError: null,
    identityBusy: false,
    selectedId: null,
  } as never)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<CharactersView />))
  await settle()
}

const rows = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('[data-character-id]'))
const rowIds = (): (string | null)[] => rows().map(row => row.getAttribute('data-character-id'))
const rowOf = (characterId: string): HTMLElement | undefined => rows().find(row => row.getAttribute('data-character-id') === characterId)
const relevanceOf = (characterId: string): string | null | undefined => (
  rowOf(characterId)?.querySelector('[data-relevance]')?.getAttribute('data-relevance')
)
const reasonTextOf = (characterId: string): string => (
  rowOf(characterId)?.querySelector('[data-relevance]')?.textContent ?? ''
)

beforeEach(() => {
  useCharacterStore.setState(originalCharacterState)
  // 组件文案走 zh-CN 分支（与 setup-locale 的默认基线一致）
  useLocaleStore.setState({ ...originalLocaleState, locale: 'zh-CN', initialized: true })
  useProjectStore.setState({ ...originalProjectState, currentProject: project() })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useCharacterStore.setState(originalCharacterState)
  useLocaleStore.setState(originalLocaleState)
  useProjectStore.setState(originalProjectState)
  setActiveProjectSessionContext(null)
  delete window.aiNovelAPI
})

describe('角色列表相关性筛选', () => {
  it('J2① 三档全开：5 张卡全部在列表里，且每行标出命中的档', async () => {
    await mount()
    expect(rowIds()).toHaveLength(5)
    expect(relevanceOf(RELATION_ONLY)).toBe('relationship')
    expect(relevanceOf(BLUEPRINT_ONLY)).toBe('blueprint')
    expect(relevanceOf(OUTLINE_ONLY)).toBe('outline')
    expect(relevanceOf(NO_HIT)).toBe('none')
    expect(relevanceOf(ALL_HIT)).toBe('relationship,blueprint,outline')
  })

  it('J2③④⑤⑥ 每行只出自己那一档的原因，全不中出「无剧情线索」', async () => {
    await mount()
    expect(reasonTextOf(RELATION_ONLY)).toContain('有 3 条关系')
    expect(reasonTextOf(RELATION_ONLY)).not.toContain('蓝图声明过')

    expect(reasonTextOf(BLUEPRINT_ONLY)).toContain('蓝图声明过（第 12、37 章）')
    expect(reasonTextOf(BLUEPRINT_ONLY)).not.toContain('条关系')

    expect(reasonTextOf(OUTLINE_ONLY)).toContain('出现在大纲／世界观')
    expect(reasonTextOf(NO_HIT)).toContain('无剧情线索')
    // 未命中的卡仍然在列表里（不是被藏起来）
    expect(rowOf(NO_HIT)).toBeTruthy()
  })

  it('J2⑦ 三档全中只显示 2 条原因 + 「+1」，点开才给全', async () => {
    await mount()
    const before = reasonTextOf(ALL_HIT)
    expect(before).toContain('有 1 条关系')
    expect(before).toContain('蓝图声明过（第 37 章）')
    expect(before).toContain('+1')
    expect(before).not.toContain('出现在大纲／世界观')

    const expand = rowOf(ALL_HIT)?.querySelector('button')
    expect(expand).toBeTruthy()
    await act(async () => { (expand as HTMLButtonElement).click() })
    await settle()
    const after = reasonTextOf(ALL_HIT)
    expect(after).toContain('出现在大纲／世界观')
    expect(after).not.toContain('+1')
  })

  it('J2② 关掉「有关系对象」只减不增：仅关系命中的卡消失，未命中的卡仍在', async () => {
    await mount()
    await act(async () => { await page.getByRole('checkbox', { name: '有关系对象' }).click() })
    await settle()

    // 列表按「有剧情优先」排（剩余 4 张里 c-all 命中 2 档，最前）
    expect(rowIds()).toEqual([ALL_HIT, OUTLINE_ONLY, BLUEPRINT_ONLY, NO_HIT])
    // 只减不增：剩下的集合是全开集合的子集
    expect(rowOf(RELATION_ONLY)).toBeUndefined()
    // 全不中的卡没有被"顺手清理"
    expect(rowOf(NO_HIT)).toBeTruthy()
  })

  it('档② 未就绪（无蓝图）：不报错、不隐藏，只把该档的命中清空', async () => {
    await mount(fiveCards(), { operations: [] })
    expect(rowIds()).toHaveLength(5)
    expect(relevanceOf(BLUEPRINT_ONLY)).toBe('none')
    expect(reasonTextOf(BLUEPRINT_ONLY)).toContain('无剧情线索')
    // 全中那张只剩关系 + 大纲，说明档②单独失效、没有连坐
    expect(relevanceOf(ALL_HIT)).toBe('relationship,outline')
    expect(container.textContent).not.toContain('角色列表读取失败')
  })

  it('J2⑧ 排序两档：默认「有剧情优先」把三档全中排在最前，切「名字」后按名字重排', async () => {
    await mount()
    expect(rowIds()[0]).toBe(ALL_HIT)

    await act(async () => { await page.getByRole('combobox', { name: '角色排序' }).selectOptions('name') })
    await settle()

    const expected = ['程实', '无名氏', '老陈', '沈砚', '程婴'].sort((left, right) => left.localeCompare(right, 'zh-CN'))
    const actual = rows().map(row => row.querySelector('.font-medium')?.textContent ?? '')
    expect(actual).toEqual(expected)
  })

  it('J2⑧ 只标不勾：「全选」仍等于当前筛选结果，三档过滤本身不改变勾选', async () => {
    await mount()
    await act(async () => { await page.getByRole('checkbox', { name: '有关系对象' }).click() })
    await settle()
    await act(async () => { await page.getByRole('button', { name: '批量删除' }).click() })
    await settle()

    // 过滤不会替作者勾选任何卡
    expect(container.textContent).toContain('已选 0')

    await act(async () => { await page.getByRole('button', { name: '全选' }).click() })
    await settle()
    // 4 = 关掉关系档后的当前筛选结果（不是全集 5）
    expect(container.textContent).toContain('已选 4')
  })
})
