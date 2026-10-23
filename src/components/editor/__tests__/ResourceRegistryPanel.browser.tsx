import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResourceDefinition, ResourceDefinitionInput } from '../../../shared/resource-ledger'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useLLMStore } from '../../../stores/llm-store'
import { useProjectStore } from '../../../stores/project-store'
import { ResourceRegistryPanel } from '../ResourceRegistryPanel'

// 抽取走的是「渲染层一次性调用」：取模板要读提示词目录（走 IPC），浏览器测试里替掉这一层，
// 只保留「模板 → 渲染 → 模型 → 解析 → 过滤」这条真正要验的链路。
vi.mock('../../../services/prompt-templates', () => ({
  resolvePromptTemplate: async () => ({
    key: 'world_building_resource_extract',
    content: '世界观原文：{{world_building}}',
  }),
  renderPrompt: (template: { content: string }, variables: Record<string, string>) =>
    Object.entries(variables).reduce(
      (rendered: string, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
      template.content,
    ),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** 世界观样本：三条候选的引文都能在这里逐字命中。 */
const WORLDBUILDING = [
  '## 第 2 维 阶层断层与资源战场',
  '宗门每月发放三十枚下品灵石。',
  '一枚中品灵石可换一百枚下品灵石。',
  '药钱按日结算，每日约两枚下品灵石。',
].join('\n')

/**
 * 三条候选，各代表一道闸门：
 * - 下品灵石：齐全，可勾；
 * - 中品灵石：齐全 + 带换算锚依据（`anchorQuote` 必须展示）；
 * - 药钱：缺 `unit`（模型没抽到单位）⇒ 不可勾，行内补上才解锁。
 */
const CANDIDATES_JSON = JSON.stringify({
  candidates: [
    {
      name: '下品灵石', familyId: '灵石', tier: 1, unit: '枚', period: '月',
      anchorValue: null, anchorNote: null, anchorQuote: null,
      earnNote: '宗门月例', costNote: '购买丹药', scarcityNote: '底层修士的主要开销',
      quote: '宗门每月发放三十枚下品灵石',
    },
    {
      name: '中品灵石', familyId: '灵石', tier: 2, unit: '枚', period: '次',
      anchorValue: 100, anchorNote: '一百换一', anchorQuote: '一枚中品灵石可换一百枚下品灵石',
      earnNote: null, costNote: null, scarcityNote: null,
      quote: '一枚中品灵石可换一百枚下品灵石',
    },
    {
      name: '药钱', familyId: null, tier: 0, unit: null, period: '日',
      anchorValue: null, anchorNote: null, anchorQuote: null,
      earnNote: null, costNote: '每日约两枚下品灵石', scarcityNote: null,
      quote: '药钱按日结算，每日约两枚下品灵石',
    },
  ],
})

const session = {
  projectId: 'resource-project',
  leaseId: 'resource-lease',
  projectPath: 'C:\\synthetic\\resource-project',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: ResourceDefinition[]
let deleteOutcome: { success: boolean; error?: string; movementCount?: number }
let llm: { success: boolean; content: string; finishReason: string; error?: string }

function definition(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    resourceId: 'res:stone',
    familyId: null,
    name: '灵石',
    tier: 1,
    unit: '块',
    anchorValue: null,
    period: '章',
    earnNote: '',
    costNote: '',
    scarcityNote: '',
    anchorNote: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="resource-row"]')]
}

function field(rowIndex: number, name: string): HTMLInputElement {
  const target = rows()[rowIndex]?.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on row ${rowIndex}`)
  return target
}

function button(label: string): HTMLButtonElement {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

async function fill(rowIndex: number, name: string, value: string) {
  await act(async () => {
    const input = field(rowIndex, name)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, ResourceDefinitionInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:resources-upsert') as Array<
    [string, ResourceDefinitionInput, string]
  >
}

function deleteCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:resources-delete')
}

async function fillRow(rowIndex: number, name: string) {
  await fill(rowIndex, 'name', name)
  await fill(rowIndex, 'unit', '块')
  await fill(rowIndex, 'period', '章')
}

async function renderPanel(props: {
  worldbuilding?: string
  storedCandidates?: string
} = {}) {
  await act(async () => {
    root.render(<ResourceRegistryPanel projectKey={session.projectPath} {...props} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:resources-list')).toBe(true))
}

function candidateRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="resource-candidate"]')]
}

function candidateRow(name: string): HTMLTableRowElement {
  // 不按索引定位：候选按名称排序，顺序随排版规则变，索引断言会变成脆弱测试。
  const target = candidateRows().find(row => row.querySelector('td:nth-child(2)')?.textContent?.trim() === name)
  if (!target) throw new Error(`Missing candidate row ${name}`)
  return target
}

/** 候选行 + 它下面那行依据（引文/锚依据/闸门原因都在第二行）。 */
function candidateText(name: string): string {
  const row = candidateRow(name)
  return `${row.textContent ?? ''}${row.nextElementSibling?.textContent ?? ''}`
}

function candidateCheckbox(name: string): HTMLInputElement {
  const target = candidateRow(name).querySelector<HTMLInputElement>('input[data-field="candidate-select"]')
  if (!target) throw new Error(`Missing candidate checkbox for ${name}`)
  return target
}

function candidateInput(name: string, field: string): HTMLInputElement {
  const target = candidateRow(name).querySelector<HTMLInputElement>(`input[data-field="${field}"]`)
  if (!target) throw new Error(`Missing candidate field ${field} on ${name}`)
  return target
}

async function fillCandidate(name: string, field: string, value: string) {
  await act(async () => {
    const input = candidateInput(name, field)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** 点「从世界观抽取候选」。 */
async function extract() {
  await click(button('从世界观抽取候选'))
}

function llmCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'llm:generate')
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  deleteOutcome = { success: true }
  llm = { success: true, content: CANDIDATES_JSON, finishReason: 'stop' }
  useLLMStore.setState({ defaultModelId: 'test-model' })
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '资源测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:resources-list') return { success: true, resources: stored }
    if (channel === 'db:resources-upsert') {
      const input = args[0] as ResourceDefinitionInput
      return { success: true, resourceId: input.resourceId ?? `res:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:resources-delete') return deleteOutcome
    if (channel === 'llm:generate') return llm
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

describe('资源登记面板', () => {
  it('空账本给出引导', async () => {
    await renderPanel()

    expect(rows()).toHaveLength(0)
    expect(container.textContent).toContain('先登记本书的资源')
    expect(container.textContent).toContain('灵石分品阶就填同一个资源族')
    expect(upsertCalls()).toHaveLength(0)
  })

  it('就地增行删行，未点保存前不落库', async () => {
    await renderPanel()

    await click(button('增行'))
    expect(rows()).toHaveLength(1)
    // 判据 DL 的可见化：这一列永远不参与算术。
    expect(container.textContent).toContain('设计意图')
    expect(container.textContent).toContain('仅展示，不参与任何计算')
    await fillRow(0, '灵石')
    // 编辑本身不发写请求。
    expect(upsertCalls()).toHaveLength(0)

    await click(button('增行'))
    expect(rows()).toHaveLength(2)
    // 未落库的新行删除后直接消失，不产生 delete 调用。
    await click(rows()[1].querySelector('button') as HTMLButtonElement)
    expect(rows()).toHaveLength(1)
    expect(deleteCalls()).toHaveLength(0)
    expect(field(0, 'name').value).toBe('灵石')
  })

  it('重名就地拒绝，整批不提交', async () => {
    await renderPanel()

    await click(button('增行'))
    await click(button('增行'))
    await fillRow(0, '灵石')
    await fillRow(1, '灵石')

    await click(button('保存'))

    expect(container.textContent).toContain('名称与上面的行重复：灵石')
    expect(container.textContent).toContain('本次没有提交')
    expect(upsertCalls()).toHaveLength(0)
  })

  it('换算锚填 0 会被拦下（0 是免费兑换，不是不可通兑）', async () => {
    await renderPanel()

    await click(button('增行'))
    await fillRow(0, '灵石')
    await fill(0, 'anchorValue', '0')

    await click(button('保存'))

    expect(container.textContent).toContain('换算锚只能留空或填正数')
    expect(upsertCalls()).toHaveLength(0)
  })

  it('保存时按行一次性提交：每行一次 upsert，没有逐格写入', async () => {
    await renderPanel()

    await click(button('增行'))
    await click(button('增行'))
    await fillRow(0, '下品灵石')
    await fillRow(1, '上品灵石')
    await fill(1, 'tier', '3')
    await fill(1, 'anchorValue', '100')
    await fill(1, 'scarcityNote', '上品灵石只在宗门内流通')
    await fill(1, 'familyId', '灵石')

    expect(upsertCalls()).toHaveLength(0)

    await click(button('保存'))
    await vi.waitFor(() => expect(container.textContent).toContain('已保存 2 条资源定义'))

    const calls = upsertCalls()
    expect(calls).toHaveLength(2)
    // 每行一次完整定义，而不是每个单元格一次。
    expect(Object.keys(calls[0][1]).sort()).toEqual([
      'anchorNote', 'anchorValue', 'costNote', 'earnNote', 'familyId',
      'name', 'period', 'scarcityNote', 'tier', 'unit',
    ])
    expect(calls[0][1]).toMatchObject({ name: '下品灵石', unit: '块', period: '章', anchorValue: null })
    expect(calls[1][1]).toMatchObject({
      name: '上品灵石',
      familyId: '灵石',
      tier: 3,
      anchorValue: 100,
      scarcityNote: '上品灵石只在宗门内流通',
    })
    // 只有「读清单 + 逐行 upsert」两种通道，没有别的写入口。
    expect(new Set(invoke.mock.calls.map(([channel]) => channel)))
      .toEqual(new Set(['db:resources-list', 'db:resources-upsert']))
  })

  it('删除已有账本记录的资源时就地说明原因，不静默失败也不提示重试', async () => {
    stored = [definition({ resourceId: 'res:stone', name: '灵石' })]
    deleteOutcome = { success: false, error: 'RESOURCE_HAS_MOVEMENTS', movementCount: 7 }
    await renderPanel()

    expect(rows()).toHaveLength(1)
    await click(button('删除'))
    await click(button('保存'))

    await vi.waitFor(() => expect(container.textContent).toContain('该资源已有 7 条账本记录'))
    expect(container.textContent).toContain('删定义会丢掉历史')
    expect(container.textContent).not.toContain('重试')
    // 行没有被抹掉，定义还在原处，作者能接着改。
    expect(rows()).toHaveLength(1)
    expect(field(0, 'name').value).toBe('灵石')
    expect(deleteCalls()).toHaveLength(1)
  })
})

describe('资源登记提案（W6a-4）', () => {
  it('抽取后每行都显示原文依据，换算锚另给一条依据', async () => {
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(3))

    // 作者敢不敢勾的唯一依据就是这句原文，必须逐字展示。
    expect(candidateText('下品灵石')).toContain('宗门每月发放三十枚下品灵石')
    expect(candidateText('中品灵石')).toContain('一枚中品灵石可换一百枚下品灵石')
    expect(container.textContent).toContain('换算锚依据')
    // 不可通兑渲染成「—」；渲染成 0 会被读成「免费兑换」。
    expect(candidateRow('下品灵石').textContent).toContain('—')

    // 一次抽取只调一次模型；不改表格、不写库。
    expect(llmCalls()).toHaveLength(1)
    const payload = llmCalls()[0][1] as { purpose: string; responseFormat: { type: string }; messages: Array<{ content: string }> }
    expect(payload.purpose).toBe('world-building-resource-extract')
    expect(payload.responseFormat).toEqual({ type: 'json_object' })
    // 正文确实进了提示词（renderPrompt 接对了）。
    expect(payload.messages[1].content).toContain('宗门每月发放三十枚下品灵石')
    expect(upsertCalls()).toHaveLength(0)
    expect(rows()).toHaveLength(0)
  })

  it('缺单位的候选不可勾选，行内补上单位后解锁，且不产生任何写请求', async () => {
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(3))

    expect(candidateCheckbox('药钱').disabled).toBe(true)
    expect(candidateText('药钱')).toContain('缺单位')

    // 没有可选项时「登记选中」是禁用的；点了也不会发出 upsert。
    await click(button('登记选中'))
    expect(upsertCalls()).toHaveLength(0)

    await fillCandidate('药钱', 'candidate-unit', '枚')
    expect(candidateCheckbox('药钱').disabled).toBe(false)
    expect(candidateText('药钱')).not.toContain('缺单位')
  })

  it('与已登记资源同名的候选标「已登记」且不可勾选', async () => {
    stored = [definition({ resourceId: 'res:stone', name: '下品灵石', unit: '枚' })]
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(3))

    expect(candidateCheckbox('下品灵石').disabled).toBe(true)
    expect(candidateText('下品灵石')).toContain('已登记')
  })

  it('勾选后逐条登记：未勾的不发请求，落库成功后给出补扫引导', async () => {
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(3))

    await click(candidateCheckbox('下品灵石'))
    await click(candidateCheckbox('中品灵石'))
    expect(container.textContent).toContain('已选 2 条')
    await click(button('登记选中'))

    await vi.waitFor(() => expect(upsertCalls()).toHaveLength(2))
    const calls = upsertCalls()
    const lower = calls.find(call => call[1].name === '下品灵石')?.[1]
    const middle = calls.find(call => call[1].name === '中品灵石')?.[1]
    expect(lower).toMatchObject({
      name: '下品灵石', familyId: '灵石', tier: 1, unit: '枚', period: '月',
      anchorValue: null, earnNote: '宗门月例', costNote: '购买丹药',
    })
    expect(middle).toMatchObject({
      name: '中品灵石', tier: 2, unit: '枚', period: '次', anchorValue: 100, anchorNote: '一百换一',
    })
    // 药钱没勾 ⇒ 一条请求都不该有。
    expect(calls.some(call => call[1].name === '药钱')).toBe(false)

    // 成功的候选离开候选区，表格里多出对应两行（只 append，不重读清单）。
    expect(candidateRows()).toHaveLength(1)
    expect(rows()).toHaveLength(2)
    expect(container.textContent).toContain('已登记 2 条资源定义')
    // 登记完不补扫，账本仍然是空的 —— 这句引导不能省。
    expect(container.textContent).toContain('补扫第 1–N 章')
  })

  it('抽取调用失败：说「没拿到可用结果」，不冒充「这本书没有资源」，也不动表格', async () => {
    llm = { success: false, content: '', finishReason: 'error', error: 'boom' }
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()

    await vi.waitFor(() => expect(container.textContent).toContain('没有拿到可用的提案结果'))
    expect(container.textContent).not.toContain('没有找到可登记的资源')
    expect(candidateRows()).toHaveLength(0)
    expect(upsertCalls()).toHaveLength(0)
    expect(rows()).toHaveLength(0)
  })

  it('坏 JSON 与调用失败同样处理（读不出来 ≠ 没有资源）', async () => {
    llm = { success: true, content: '这不是 JSON', finishReason: 'stop' }
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()

    await vi.waitFor(() => expect(container.textContent).toContain('没有拿到可用的提案结果'))
    expect(candidateRows()).toHaveLength(0)
  })

  it('世界观正文改掉之后，已展示的候选里失去依据的那几行会消失', async () => {
    await renderPanel({ worldbuilding: WORLDBUILDING })
    await extract()
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(3))

    // 正文被改（这里模拟编辑器重载后传来的新正文）：三条候选的引文一条都不在了。
    await renderPanel({ worldbuilding: '只剩一句无关的设定。' })
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(0))
  })

  it('检查点里的候选走同一套展示；引文在当前正文里找不到就整行不发', async () => {
    await renderPanel({ worldbuilding: WORLDBUILDING, storedCandidates: CANDIDATES_JSON })
    await vi.waitFor(() => expect(candidateRows()).toHaveLength(3))
    // 读检查点不该再调一次模型。
    expect(llmCalls()).toHaveLength(0)

    const stale = JSON.stringify({
      candidates: [{
        name: '灵石', familyId: null, tier: 0, unit: '枚', period: '月',
        anchorValue: null, anchorNote: null, anchorQuote: null,
        earnNote: null, costNote: null, scarcityNote: null,
        quote: '灵石矿脉由三家把持', // 正文里没有这句 ⇒ 陈引文
      }],
    })
    await act(async () => { root.unmount() })
    container.remove()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await renderPanel({ worldbuilding: WORLDBUILDING, storedCandidates: stale })

    await vi.waitFor(() => expect(container.textContent).toContain('已经找不到了'))
    expect(candidateRows()).toHaveLength(0)
  })
})
