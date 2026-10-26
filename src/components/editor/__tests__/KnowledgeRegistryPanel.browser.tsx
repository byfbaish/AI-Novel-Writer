import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { KnowledgeFactCandidate, KnowledgeStateDefinition, KnowledgeStateInput } from '../../../shared/knowledge-state'
import type { KnowledgeCandidateView } from '../../../shared/knowledge-candidate'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { KnowledgeRegistryPanel } from '../KnowledgeRegistryPanel'

/**
 * P1-1 知情登记面板（8 条）+ P20-3 章末提议（5 条）。验收口径（计划 §5.1 G3）：
 * 可增删改、**保存前不落库**、同角色同事实重复**整批不提交**、删除要确认，
 * 以及两条本期特有的纪律：
 * - 没有 `characterId` 的老角色**不出现**（不得静默拿名字兜底）；
 * - 引用失效（`stale` / `unverifiable`）的行要标红并给「重选事实」入口。
 *
 * P20-3 那五条守的是同一件事：**模型只提议，作者只采纳，采纳也只是填草稿**。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'knowledge-project',
  leaseId: 'knowledge-lease',
  projectPath: 'C:\\synthetic\\knowledge-project',
}

const FACT_QUOTE = '灵根检测结果被人改过'

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: KnowledgeStateDefinition[]
let candidates: KnowledgeFactCandidate[]
let proposals: KnowledgeCandidateView[]
let deleteOutcome: { success: boolean; error?: string }

const roster = [
  { characterId: 'character:guchangfeng', name: '顾长风', role: 'supporting' },
  { characterId: 'character:xiaozheng', name: '小郑', role: 'minor' },
  // 旧数据：只有名字没有 id。不得出现在选择器里。
  { name: '无编号的老角色', role: 'minor' },
]

function definition(overrides: Partial<KnowledgeStateDefinition> = {}): KnowledgeStateDefinition {
  return {
    knowledgeId: 'knowledge:guchangfeng',
    characterId: 'character:guchangfeng',
    characterName: '顾长风',
    factChapter: 9,
    factEvidence: FACT_QUOTE,
    factEvidenceHash: 'a'.repeat(64),
    factKey: 'kf:0123456789abcdef',
    learnedChapter: 12,
    evidence: '第十二章他听完汇报',
    source: 'author',
    refState: 'valid',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function proposalView(overrides: Partial<KnowledgeCandidateView> = {}): KnowledgeCandidateView {
  return {
    factChapter: 9,
    factEvidence: FACT_QUOTE,
    statement: '检测结果被人改过。',
    characterId: 'character:guchangfeng',
    characterName: '顾长风',
    learnedChapter: 12,
    refState: 'valid',
    category: 'plot',
    ...overrides,
  }
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="knowledge-row"]')]
}

function proposalsShown(): string[] {
  return [...container.querySelectorAll('[data-testid="knowledge-proposal"]')]
    .map(node => node.querySelector('span')?.textContent ?? '')
}

function field(rowIndex: number, name: string): HTMLInputElement {
  const target = rows()[rowIndex]?.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on row ${rowIndex}`)
  return target
}

function select(rowIndex: number, name: string): HTMLSelectElement {
  const target = rows()[rowIndex]?.querySelector<HTMLSelectElement>(`select[data-field="${name}"]`)
  if (!target) throw new Error(`Missing select ${name} on row ${rowIndex}`)
  return target
}

function button(label: string): HTMLButtonElement {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

/** 提议行里的「采纳」按钮：页面上可能同时有多条提议，得按序号取。 */
function adoptButton(index = 0): HTMLButtonElement {
  const target = [...container.querySelectorAll<HTMLElement>('[data-testid="knowledge-proposal"]')][index]
    ?.querySelector('button')
  if (!target) throw new Error(`Missing adopt button on proposal ${index}`)
  return target as HTMLButtonElement
}

/** 某一行草稿上的按钮。不能用 `button()` —— 它会返回**第一行**的同名按钮。 */
function rowButton(rowIndex: number, label: string): HTMLButtonElement {
  const target = [...(rows()[rowIndex]?.querySelectorAll('button') ?? [])]
    .find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label} on row ${rowIndex}`)
  return target as HTMLButtonElement
}

async function fill(rowIndex: number, name: string, value: string) {
  await act(async () => {
    const input = field(rowIndex, name)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function choose(rowIndex: number, name: string, value: string) {
  await act(async () => {
    const target = select(rowIndex, name)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(target, value)
    target.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, KnowledgeStateInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:knowledge-upsert') as Array<
    [string, KnowledgeStateInput, string]
  >
}

function deleteCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:knowledge-delete') as unknown[][]
}

async function renderPanel() {
  await act(async () => {
    root.render(<KnowledgeRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:knowledge-list')).toBe(true))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  candidates = [{ chapterNumber: 9, factKey: 'kf:0123456789abcdef', factEvidence: FACT_QUOTE, statement: '检测结果被人改过。', category: 'plot' }]
  proposals = []
  deleteOutcome = { success: true }
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '知情测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:knowledge-list') return { success: true, entries: stored }
    if (channel === 'db:character-get-all') return roster
    if (channel === 'db:knowledge-fact-candidates') return { success: true, candidates }
    if (channel === 'db:knowledge-candidates-list') return { success: true, entries: proposals }
    if (channel === 'db:knowledge-upsert') {
      const input = args[0] as KnowledgeStateInput
      return { success: true, knowledgeId: input.knowledgeId ?? `knowledge:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:knowledge-delete') return deleteOutcome
    throw new Error(`Unexpected IPC ${channel}`)
  })
  Object.defineProperty(window, 'aiNovelAPI', {
    configurable: true,
    value: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() },
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  setActiveProjectSessionContext(null)
  delete (window as typeof window & { aiNovelAPI?: unknown }).aiNovelAPI
})

describe('知情登记面板', () => {
  it('挂载只读四个通道，不写库；空表给出引导', async () => {
    await renderPanel()
    expect(new Set(invoke.mock.calls.map(([channel]) => channel))).toEqual(new Set([
      'db:knowledge-list', 'db:character-get-all', 'db:knowledge-fact-candidates',
      'db:knowledge-candidates-list',
    ]))
    expect(container.textContent).toContain('还没有登记任何知情关系')
    expect(rows()).toHaveLength(0)
    // 没有提议就不该空占一块地方。
    expect(container.querySelector('[data-testid="knowledge-proposals"]')).toBeNull()
  })

  it('没有 characterId 的老角色不出现，并在面板写明原因（不拿名字兜底）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    const options = [...select(0, 'characterId').options].map(option => option.textContent)
    expect(options).toContain('顾长风')
    expect(options).toContain('小郑')
    expect(options).not.toContain('无编号的老角色')
    expect(container.querySelector('[data-testid="knowledge-legacy-characters"]')?.textContent)
      .toContain('不会出现在下面的选择器里')
  })

  it('已有行原样回显：关系出处回填，refState 文案按三态显示', async () => {
    stored = [
      definition(),
      definition({ knowledgeId: 'knowledge:xiaozheng', characterId: 'character:xiaozheng', characterName: '小郑', refState: 'stale' }),
    ]
    await renderPanel()
    expect(rows()).toHaveLength(2)
    expect(select(0, 'characterId').value).toBe('character:guchangfeng')
    expect(field(0, 'factChapter').value).toBe('9')
    expect(field(0, 'factEvidence').value).toBe(FACT_QUOTE)
    expect(field(0, 'learnedChapter').value).toBe('12')
    expect(field(0, 'evidence').value).toBe('第十二章他听完汇报')
    const states = [...container.querySelectorAll('[data-testid="knowledge-ref-state"]')].map(node => node.textContent)
    expect(states[0]).toContain('引用有效')
    expect(states[1]).toContain('引用失效')
    // 失效行给「重选事实」入口
    expect([...container.querySelectorAll('button')].some(node => node.textContent?.includes('重选事实'))).toBe(true)
  })

  it('从候选里选事实：自动填章号与逐字引文，保存只提交一份（键由主进程算）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await choose(0, 'characterId', 'character:guchangfeng')
    await choose(0, 'factPicker', 'kf:0123456789abcdef')
    await fill(0, 'learnedChapter', '12')
    // 选完就不该再要求手填引文
    expect(rows()[0]?.querySelector('input[data-field="factEvidence"]')).toBeNull()
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    const input = upsertCalls()[0]![1]
    expect(input).toMatchObject({
      characterId: 'character:guchangfeng', factChapter: 9, factEvidence: FACT_QUOTE, learnedChapter: 12,
    })
    // 面板不得自报 key / 指纹：那是主进程从章号 + 引文重算的。
    expect(input).not.toHaveProperty('factKey')
    expect(input).not.toHaveProperty('factEvidenceHash')
    expect(container.textContent).toContain('已保存 1 条知情')
  })

  it('手填章号 + 逐字引文同样可保存（不强制从候选中选）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await choose(0, 'characterId', 'character:xiaozheng')
    await fill(0, 'factChapter', '9')
    await fill(0, 'factEvidence', FACT_QUOTE)
    await fill(0, 'learnedChapter', '13')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0]![1]).toMatchObject({ characterId: 'character:xiaozheng', factChapter: 9, factEvidence: FACT_QUOTE, learnedChapter: 13 })
  })

  it('同角色同事实重复：整批不提交（本地先算 key，不等数据库报 UNIQUE）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await click(button('新增一条'))
    for (const index of [0, 1]) {
      await choose(index, 'characterId', 'character:guchangfeng')
      await choose(index, 'factPicker', 'kf:0123456789abcdef')
      await fill(index, 'learnedChapter', '12')
    }
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 1 行还需要修改，本次没有提交')
    expect(container.textContent).toContain('同一角色对同一条事实重复登记了')
  })

  it('得知章早于事实章：本地拦住，不落库', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await choose(0, 'characterId', 'character:guchangfeng')
    await fill(0, 'factChapter', '9')
    await fill(0, 'factEvidence', FACT_QUOTE)
    await fill(0, 'learnedChapter', '8')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('得知章不能早于事实所在章')
  })

  it('删除要确认：第一次点击只进入确认态，确认后才真删', async () => {
    stored = [definition()]
    await renderPanel()
    await click(button('删除'))
    expect(deleteCalls()).toHaveLength(0)
    expect([...container.querySelectorAll('button')].some(node => node.textContent?.includes('确认删除'))).toBe(true)

    await click(button('确认删除'))
    await click(button('保存'))
    expect(deleteCalls()).toHaveLength(1)
    // 前三个参数是通道 / id / 项目路径（其后是会话上下文，不属于契约）。
    expect(deleteCalls()[0]!.slice(0, 3)).toEqual(['db:knowledge-delete', 'knowledge:guchangfeng', session.projectPath])
  })

  it('候选读不到时仍可手填（不因为选不了事实就挡住整页）', async () => {
    invoke = vi.fn(async (channel: string) => {
      if (channel === 'db:knowledge-list') return { success: true, entries: [] }
      if (channel === 'db:character-get-all') return roster
      if (channel === 'db:knowledge-fact-candidates') return { success: false, error: 'boom' }
      if (channel === 'db:knowledge-candidates-list') return { success: true, entries: [] }
      if (channel === 'db:knowledge-upsert') return { success: true, knowledgeId: 'knowledge:x' }
      throw new Error(`Unexpected IPC ${channel}`)
    })
    Object.defineProperty(window, 'aiNovelAPI', {
      configurable: true,
      value: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() },
    })
    await renderPanel()
    await click(button('新增一条'))
    // 候选为空 ⇒ 只剩一个「手填」选项
    expect([...select(0, 'factPicker').options]).toHaveLength(1)
    await choose(0, 'characterId', 'character:guchangfeng')
    await fill(0, 'factChapter', '9')
    await fill(0, 'factEvidence', FACT_QUOTE)
    await fill(0, 'learnedChapter', '12')
    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(1)
  })
})

/**
 * P20-3（5 条）：章末提议只是**建议**。
 *
 * 这五条钉住的都是「谁说了算」：模型只说「第 3 条事实、顾长风」，章号与引文由系统反查；
 * 作者点「采纳」只是把一行草稿填好，落库仍需「保存」；事实变了就不许采纳。
 */
describe('章末知情提议', () => {
  it('按得知章分组显示，写明「只在已有事实里挑」，挂载不写库', async () => {
    proposals = [
      proposalView(),
      proposalView({ characterId: 'character:xiaozheng', characterName: '小郑' }),
      proposalView({ factChapter: 4, factEvidence: '他早就知道灵根的事', learnedChapter: 20 }),
    ]
    await renderPanel()

    const groups = [...container.querySelectorAll('[data-testid="knowledge-proposal-group"]')]
    expect(groups).toHaveLength(2)
    // 章号大的排前面：越靠近当前进度越该先看。
    expect(groups[0]!.textContent).toContain('第 20 章提议')
    expect(groups[1]!.textContent).toContain('第 12 章提议（2 条')
    expect(proposalsShown()).toEqual(['顾长风', '顾长风', '小郑'])
    expect(container.querySelector('[data-testid="knowledge-proposals"]')?.textContent)
      .toContain('只在「本章已有的事实」里挑人')
    // 提议是只读来的，一个写通道都没走过。
    expect(upsertCalls()).toHaveLength(0)
    expect(rows()).toHaveLength(0)
  })

  it('采纳只填一行草稿：不写库，保存时才走与手工登记完全相同的一条路', async () => {
    proposals = [proposalView()]
    await renderPanel()
    await click(adoptButton())

    // 关键断言：采纳动作本身不发 upsert。
    expect(upsertCalls()).toHaveLength(0)
    expect(rows()).toHaveLength(1)
    expect(select(0, 'characterId').value).toBe('character:guchangfeng')
    expect(field(0, 'factChapter').value).toBe('9')
    expect(field(0, 'factEvidence').value).toBe(FACT_QUOTE)
    expect(field(0, 'learnedChapter').value).toBe('12')
    expect(container.textContent).toContain('点「保存」后才生效')

    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0]![1]).toMatchObject({
      characterId: 'character:guchangfeng', factChapter: 9, factEvidence: FACT_QUOTE, learnedChapter: 12,
    })
  })

  it('已登记（或刚采纳未保存）的同角色同事实不再出现在提议里；删掉草稿后提议回来', async () => {
    proposals = [proposalView(), proposalView({
      characterId: 'character:xiaozheng', characterName: '小郑',
      factChapter: 4, factEvidence: '他早就知道灵根的事',
    })]
    stored = [definition()]
    await renderPanel()

    // 库里已有一条一模一样（顾长风 / 第 9 章 / 同一引文）⇒ 只剩小郑那条。
    expect(proposalsShown()).toEqual(['小郑'])

    await click(adoptButton())
    // 刚采纳的那条也立刻消失，不会给第二次采纳的机会。
    expect(proposalsShown()).toEqual([])
    expect(rows()).toHaveLength(2)

    // 反悔：删掉那行草稿（未落库，直接消失），提议应该回来。
    await click(rowButton(1, '删除'))
    expect(rows()).toHaveLength(1)
    expect(proposalsShown()).toEqual(['小郑'])
  })

  it('事实已变更 / 投影已失效的提议不可采纳，并写明原因', async () => {
    proposals = [
      proposalView({ refState: 'valid' }),
      proposalView({ characterId: 'character:xiaozheng', characterName: '小郑', refState: 'stale' }),
      proposalView({ factChapter: 4, factEvidence: '旧的引文', refState: 'orphaned' }),
    ]
    await renderPanel()

    const broken = [...container.querySelectorAll('[data-testid="knowledge-proposal-broken"]')]
      .map(node => node.textContent)
    expect(broken).toEqual([
      '所依据的定稿事实已变更，不可采纳',
      '该章定稿投影已失效，不可采纳',
    ])
    expect(adoptButton(0).disabled).toBe(false)
    expect(adoptButton(1).disabled).toBe(true)
    expect(adoptButton(2).disabled).toBe(true)

    // 点失效项的按钮也必须什么都不发生。
    await click(adoptButton(1))
    expect(rows()).toHaveLength(0)
  })

  it('提议读不到不挡整页：登记列表照常回显、照常可保存', async () => {
    stored = [definition()]
    invoke = vi.fn(async (channel: string) => {
      if (channel === 'db:knowledge-list') return { success: true, entries: stored }
      if (channel === 'db:character-get-all') return roster
      if (channel === 'db:knowledge-fact-candidates') return { success: true, candidates }
      if (channel === 'db:knowledge-candidates-list') return { success: false, error: 'boom' }
      if (channel === 'db:knowledge-upsert') return { success: true, knowledgeId: 'knowledge:x' }
      throw new Error(`Unexpected IPC ${channel}`)
    })
    Object.defineProperty(window, 'aiNovelAPI', {
      configurable: true,
      value: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() },
    })
    await renderPanel()

    expect(rows()).toHaveLength(1)
    expect(container.querySelector('[data-testid="knowledge-proposals"]')).toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(1)
  })
})
