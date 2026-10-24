import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import {
  VOLUME_HANDOFF_MAX_CHARS,
  type VolumeHandoffDefinition,
  type VolumeHandoffInput,
} from '../../../shared/volume-handoff'
import type { VolumeDefinition } from '../../../shared/volume-structure'
import { useLLMStore } from '../../../stores/llm-store'
import { useProjectStore } from '../../../stores/project-store'
import { VolumeHandoffRegistryPanel } from '../VolumeHandoffRegistryPanel'

// P1-2 期 2：重新生成走「模板 → 渲染 → 模型 → 解析 → 裁剪 → 写库」这条链。
// 取模板要读提示词目录（走 IPC），浏览器测试里替掉这一层，其余全用真实现。
vi.mock('../../../services/prompt-templates', () => ({
  resolvePromptTemplate: async () => ({
    key: 'generate_volume_handoff',
    content: '{{volume_label}} {{chapter_range}}\n{{volume_notes}}',
  }),
  renderPrompt: (template: { content: string }, variables: Record<string, string>) =>
    Object.entries(variables).reduce(
      (rendered: string, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
      template.content,
    ),
}))

/**
 * P1-2 期 1b 卷末交接登记面板（11 条）。验收口径：
 * - **只选卷、不填章号**：区间由 `volumes` 派生，页面只读展示并标出来源（实际 / 精确 / 折算 / 估算）；
 * - 同一卷两份 **整批不提交**（一行错不让别的行偷偷落库）；
 * - `state='empty'` 时**自动建一次**卷结构；`stale` 只提示、重建要作者点；
 * - 「标记本卷已完成」写的是定稿事实，失败时**不清空**已填正文；
 * - 三个数组字段用多行文本域，空行丢弃；字数超限只红字提示，**照常可保存**。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'handoff-project',
  leaseId: 'handoff-lease',
  projectPath: 'C:\\synthetic\\handoff-project',
}

type PanelState = 'ready' | 'stale' | 'empty' | 'unparsed'

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: VolumeHandoffDefinition[]
let volumes: VolumeDefinition[]
let volumeState: PanelState
let markDoneResult: { success: boolean; volume?: VolumeDefinition; actualLast?: number; error?: string }
/** 模型回包（`llm:generate`）；测试按需改成失败或挂起。 */
let llmReply: unknown
/** 非 null 时 `llm:generate` 返回一个挂起的 Promise，用来断言「生成中」这一瞬间的禁用态。 */
let llmGate: ((value: unknown) => void) | null = null
/** 已确认的跨卷衔接（豁免行）。 */
let exemptions: Array<{ stableFactKey: string; reason: string; revoked: boolean }>

const DRAFT_JSON = JSON.stringify({
  worldState: '灵潮退去，北境三城封关',
  heroState: '顾长风左臂仍未复原',
  events: ['玄火令被夺'],
  items: ['玄火令在监天台手中'],
  debts: ['欠沈砚一条命'],
  openThread: '监天台为何要玄火令',
})

const NOTES = [
  { chapterNumber: 1, chapterTitle: '一', chapterNotes: '第一章要点' },
  { chapterNumber: 2, chapterTitle: '二', chapterNotes: '第二章要点' },
]

function volumeDef(overrides: Partial<VolumeDefinition> = {}): VolumeDefinition {
  return {
    volumeId: 'volume:1',
    volumeIndex: 1,
    name: '杂役处',
    plannedFirst: 1,
    plannedLast: 20,
    plannedSource: 'headings',
    actualLast: null,
    actualSource: null,
    outlineHash: 'hash:1',
    source: 'outline',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function definition(overrides: Partial<VolumeHandoffDefinition> = {}): VolumeHandoffDefinition {
  return {
    handoffId: 'handoff:1',
    volumeId: 'volume:1',
    volumeIndex: 1,
    firstChapter: 1,
    lastChapter: 20,
    boundaryBasis: 'headings',
    worldState: '灵潮退去，北境三城封关',
    heroState: '顾长风的左臂仍未复原',
    events: ['玄火令被夺', '沈砚投靠监天台'],
    items: ['玄火令在监天台手中'],
    debts: ['欠沈砚一条命'],
    openThread: '监天台为何要玄火令',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function summaryRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="volume-handoff-row"]')]
}

function details(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="volume-handoff-detail"]')]
}

function field(detailIndex: number, name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const target = details()[detailIndex]?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on detail ${detailIndex}`)
  return target
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const target = [...scope.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

async function fill(detailIndex: number, name: string, value: string) {
  await act(async () => {
    const input = field(detailIndex, name)
    if (input instanceof HTMLSelectElement) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(input, value)
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, VolumeHandoffInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:volume-handoffs-upsert') as Array<
    [string, VolumeHandoffInput, string]
  >
}

function channels(): string[] {
  return invoke.mock.calls.map(([channel]) => channel as string)
}

async function renderPanel() {
  await act(async () => {
    root.render(<VolumeHandoffRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(channels()).toContain('db:volumes-list'))
  await vi.waitFor(() => expect(channels()).toContain('db:volume-handoffs-list'))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  volumes = [
    volumeDef(),
    volumeDef({ volumeId: 'volume:2', volumeIndex: 2, name: '百草园', plannedFirst: 21, plannedLast: 40 }),
  ]
  volumeState = 'ready'
  markDoneResult = { success: true, volume: volumeDef({ actualLast: 18, actualSource: 'finalized' }), actualLast: 18 }
  exemptions = []
  llmReply = { success: true, content: DRAFT_JSON, finishReason: 'stop' }
  llmGate = null
  useLLMStore.setState({ defaultModelId: 'model-1' })
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '交接测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:volumes-list') {
      return { success: true, volumes, state: volumeState, warnings: [] }
    }
    if (channel === 'db:volumes-rebuild') {
      volumes = [
        volumeDef(),
        volumeDef({ volumeId: 'volume:2', volumeIndex: 2, name: '百草园', plannedFirst: 21, plannedLast: 40 }),
      ]
      volumeState = 'ready'
      return { success: true, volumes, warnings: [], retained: [], removed: 0 }
    }
    if (channel === 'db:volumes-mark-done') return markDoneResult
    if (channel === 'db:volume-handoffs-list') return { success: true, entries: stored }
    if (channel === 'db:consistency-exemption-list') return exemptions
    if (channel === 'db:consistency-exemption-revoke') {
      exemptions = exemptions.map(item => (item.stableFactKey === args[0] ? { ...item, revoked: true } : item))
      return { success: true }
    }
    if (channel === 'db:volume-handoffs-upsert') {
      const input = args[0] as VolumeHandoffInput
      const volume = volumes.find(item => item.volumeId === input.volumeId)
      return {
        success: true,
        entry: definition({
          handoffId: input.handoffId ?? `handoff:new-${invoke.mock.calls.length}`,
          volumeId: input.volumeId,
          volumeIndex: volume?.volumeIndex ?? null,
          firstChapter: volume?.plannedFirst ?? null,
          lastChapter: volume?.actualLast ?? volume?.plannedLast ?? null,
          boundaryBasis: volume?.actualLast ? 'actual' : (volume?.plannedSource ?? null),
          worldState: input.worldState ?? '',
          heroState: input.heroState ?? '',
          events: [...(input.events ?? [])],
          items: [...(input.items ?? [])],
          debts: [...(input.debts ?? [])],
          openThread: input.openThread ?? '',
        }),
      }
    }
    if (channel === 'db:volume-handoffs-delete') return { success: true }
    if (channel === 'db:continuity-list-before') return NOTES
    if (channel === 'llm:generate') {
      if (llmGate) {
        return new Promise(resolve => {
          llmGate = value => {
            llmGate = null
            resolve(value)
          }
        })
      }
      return llmReply
    }
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

describe('卷末交接登记面板', () => {
  it('空表给出引导；挂载读两个通道，不自动重建（结构已就绪）', async () => {
    await renderPanel()
    expect(new Set(channels())).toEqual(new Set([
      'db:volumes-list', 'db:volume-handoffs-list', 'db:consistency-exemption-list',
    ]))
    expect(container.textContent).toContain('还没有登记任何卷末交接单')
    expect(summaryRows()).toHaveLength(0)
  })

  it('卷结构为空时自动建一次（表空没有东西可删）', async () => {
    volumes = []
    volumeState = 'empty'
    await renderPanel()
    await vi.waitFor(() => expect(channels()).toContain('db:volumes-rebuild'))
    // 自动建过之后下拉里就有卷了。
    await click(button('新增一卷'))
    expect(details()).toHaveLength(1)
    expect(field(0, 'volumeId')).toHaveProperty('value', '')
  })

  it('列表渲染：卷名 / 区间带来源 / 世界 / 三个计数；详情里区间只读', async () => {
    stored = [definition()]
    await renderPanel()
    expect(summaryRows()).toHaveLength(1)
    const row = summaryRows()[0]!
    expect(row.querySelector('[data-field="volume-cell"]')?.textContent).toContain('第1卷')
    expect(row.querySelector('[data-field="range-cell"]')?.textContent).toBe('第1–20章 · 精确')
    expect(row.querySelector('[data-field="worldState-cell"]')?.textContent).toBe('灵潮退去，北境三城封关')
    expect(row.querySelector('[data-field="events-cell"]')?.textContent).toBe('2')
    expect(row.querySelector('[data-field="items-cell"]')?.textContent).toBe('1')
    expect(row.querySelector('[data-field="debts-cell"]')?.textContent).toBe('1')
    // 默认收起：详情表单不占位。
    expect(details()).toHaveLength(0)
    await click(button('编辑', row))
    expect(details()).toHaveLength(1)
    expect(field(0, 'volumeId')).toHaveProperty('value', 'volume:1')
    // 区间是只读展示，不是输入框。
    expect(details()[0]!.querySelector('[data-field="range-readonly"]')?.textContent).toContain('第1–20章')
    expect(details()[0]!.querySelector('input[data-field="firstChapter"]')).toBeNull()
    expect(container.textContent).not.toContain('章号请对照大纲里该卷的最后几章填写')
  })

  it('新增一行并保存：入参只有 volumeId（没有章号），数组按行拆分、空行丢弃', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    expect(details()).toHaveLength(1)
    await fill(0, 'volumeId', 'volume:2')
    await fill(0, 'worldState', '北境封关')
    await fill(0, 'events', '玄火令被夺\n\n  沈砚投靠监天台  \n')
    await fill(0, 'items', '玄火令')
    await fill(0, 'debts', '\n')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    const input = upsertCalls()[0]![1]
    expect(input).toMatchObject({
      volumeId: 'volume:2',
      worldState: '北境封关',
      heroState: '',
      events: ['玄火令被夺', '沈砚投靠监天台'],
      items: ['玄火令'],
      debts: [],
      openThread: '',
    })
    // 章号字段彻底不在入参里 —— 区间由卷结构派生。
    expect(input).not.toHaveProperty('firstChapter')
    expect(input).not.toHaveProperty('lastChapter')
    expect(upsertCalls()[0]![2]).toBe(session.projectPath)
  })

  it('同一卷选两次：整批不提交，两行都标红', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeId', 'volume:1')
    await click(button('新增一卷'))
    await fill(1, 'volumeId', 'volume:1')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 2 行还需要修改，本次没有提交')
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(2)
    expect(container.textContent).toContain('第1卷登记了不止一份')
  })

  it('没选卷就保存：整批不提交并提示「请选择卷」', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('请选择卷')
  })

  it('卷结构建不起来（unparsed）⇒ 禁用新增并说明原因', async () => {
    volumes = []
    volumeState = 'unparsed'
    await renderPanel()
    expect(container.textContent).toContain('大纲里没有可识别的卷 / 单元结构')
    expect(button('新增一卷').disabled).toBe(true)
    expect(container.textContent).toContain('先在「重建卷结构」里从大纲建出卷')
  })

  it('stale：只提示，点「重建卷结构」才写库', async () => {
    volumeState = 'stale'
    await renderPanel()
    expect(container.textContent).toContain('卷结构已过期')
    // 挂载时不重建 —— 作者可能正在改大纲。
    expect(channels()).not.toContain('db:volumes-rebuild')
    await click(button('重建卷结构'))
    await vi.waitFor(() => expect(channels()).toContain('db:volumes-rebuild'))
  })

  it('标记本卷已完成：调通道后区间变「实际」', async () => {
    stored = [definition()]
    await renderPanel()
    await click(button('编辑', summaryRows()[0]!))
    await click(button('标记本卷已完成', details()[0]!))
    await vi.waitFor(() => expect(channels()).toContain('db:volumes-mark-done'))
    // 只 patch 本地 volumes，不重载交接单（作者未保存的正文不丢）。
    expect(channels().filter(channel => channel === 'db:volume-handoffs-list')).toHaveLength(1)
    await vi.waitFor(() => expect(
      summaryRows()[0]!.querySelector('[data-field="range-cell"]')?.textContent,
    ).toBe('第1–18章 · 实际'))
    expect(container.textContent).toContain('实际到第18章')
  })

  it('标记失败：行内报错，已填正文不清空', async () => {
    stored = [definition({ worldState: '作者手写的卷末世界' })]
    markDoneResult = { success: false, error: 'VOLUME_MARK_DONE_NO_FINALIZED' }
    await renderPanel()
    await click(button('编辑', summaryRows()[0]!))
    await click(button('标记本卷已完成', details()[0]!))
    await vi.waitFor(() => expect(container.textContent).toContain('这一卷还没有已定稿的章'))
    expect(field(0, 'worldState')).toHaveProperty('value', '作者手写的卷末世界')
  })

  it('下拉文案标出来源：估算 / 折算 / 精确各一档', async () => {
    volumes = [
      volumeDef({ plannedSource: 'headings' }),
      volumeDef({ volumeId: 'volume:2', volumeIndex: 2, name: '百草园', plannedFirst: 21, plannedLast: 40, plannedSource: 'declared' }),
      volumeDef({ volumeId: 'volume:3', volumeIndex: 3, name: '执法殿', plannedFirst: 41, plannedLast: 60, plannedSource: 'even' }),
    ]
    await renderPanel()
    await click(button('新增一卷'))
    const options = [...(field(0, 'volumeId') as HTMLSelectElement).options].map(option => option.textContent ?? '')
    expect(options.some(option => option.includes('精确'))).toBe(true)
    expect(options.some(option => option.includes('折算'))).toBe(true)
    expect(options.some(option => option.includes('估算'))).toBe(true)
  })

  it('retained 的卷在下拉里标「大纲已无此卷」', async () => {
    volumes = [volumeDef({ source: 'retained' })]
    await renderPanel()
    await click(button('新增一卷'))
    const options = [...(field(0, 'volumeId') as HTMLSelectElement).options].map(option => option.textContent ?? '')
    expect(options.some(option => option.includes('大纲已无此卷，保留'))).toBe(true)
  })

  it('字数提示：超 1500 红字但**不阻断**保存', async () => {
    await renderPanel()
    await click(button('新增一卷'))
    await fill(0, 'volumeId', 'volume:1')
    await fill(0, 'worldState', '墨'.repeat(VOLUME_HANDOFF_MAX_CHARS + 50))
    const hint = container.querySelector('[data-testid="volume-handoff-chars"]')
    expect(hint?.textContent).toContain(`/ ${VOLUME_HANDOFF_MAX_CHARS} 字`)
    expect(hint?.textContent).toContain('超出部分注入时会按顺序丢弃，仍可保存')

    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(1)
    expect(upsertCalls()[0]![1].worldState).toHaveLength(VOLUME_HANDOFF_MAX_CHARS + 50)
  })
})

/**
 * P1-2 期 2：面板侧的自动生成。
 *
 * 验收口径三条：**来源可辨**（作者版 / 初稿）· **作者版不可重生成**（按钮禁用 + 说明）·
 * **只把动过的行升格为作者版**（整页一存不该冻死没碰过的初稿）。
 */
describe('卷末交接单的自动生成', () => {
  const expandFirstRow = async () => {
    await click(button('编辑', summaryRows()[0]!))
  }
  const regenerateButton = () => {
    const target = container.querySelector<HTMLButtonElement>('[data-action="regenerate-handoff"]')
    if (!target) throw new Error('missing regenerate button')
    return target
  }

  it('来源列分得清作者版与初稿', async () => {
    stored = [
      definition({ handoffId: 'handoff:a', volumeId: 'volume:1', source: 'author' }),
      definition({
        handoffId: 'handoff:g', volumeId: 'volume:2', volumeIndex: 2,
        firstChapter: 21, lastChapter: 40, source: 'generated',
      }),
    ]
    await renderPanel()
    expect(container.querySelector('[data-testid="volume-handoff-source-author"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="volume-handoff-source-generated"]')).not.toBeNull()
  })

  it('作者版的「重新生成」禁用，并说明为什么不会被覆盖', async () => {
    stored = [definition({ handoffId: 'handoff:a', source: 'author' })]
    await renderPanel()
    await expandFirstRow()
    const target = regenerateButton()
    expect(target.disabled).toBe(true)
    expect(target.getAttribute('title')).toContain('不会被自动覆盖')
  })

  it('初稿行重新生成：读要点、调一次模型、覆盖时带原 handoffId', async () => {
    stored = [definition({ handoffId: 'handoff:g', source: 'generated' })]
    await renderPanel()
    await expandFirstRow()
    await click(regenerateButton())
    await vi.waitFor(() => expect(upsertCalls()).toHaveLength(1))
    expect(channels()).toContain('db:continuity-list-before')
    expect(channels()).toContain('llm:generate')
    expect(upsertCalls()[0]![1]).toMatchObject({
      handoffId: 'handoff:g', volumeId: 'volume:1', source: 'generated',
    })
    await vi.waitFor(() => expect(container.textContent).toContain('已生成初稿'))
  })

  it('生成中：按钮显示「生成中…」并连同保存一起禁用', async () => {
    stored = [definition({ handoffId: 'handoff:g', source: 'generated' })]
    await renderPanel()
    await expandFirstRow()
    llmGate = () => undefined
    await click(regenerateButton())
    await vi.waitFor(() => expect(regenerateButton().textContent).toContain('生成中'))
    expect(regenerateButton().disabled).toBe(true)
    expect(button('保存').disabled).toBe(true)
    await act(async () => { llmGate?.(llmReply) })
    await vi.waitFor(() => expect(upsertCalls()).toHaveLength(1))
  })

  it('模型调用失败：把脱敏后的原因写在行下方，不静默', async () => {
    stored = [definition({ handoffId: 'handoff:g', source: 'generated' })]
    llmReply = { success: false, content: '', finishReason: 'error', error: '401 unauthorized' }
    await renderPanel()
    await expandFirstRow()
    await click(regenerateButton())
    await vi.waitFor(() => expect(container.textContent).toContain('401 unauthorized'))
    expect(upsertCalls()).toHaveLength(0)
  })

  it('只改 A 行后保存：A 升格作者版，未编辑的 B 仍留初稿', async () => {
    stored = [
      definition({ handoffId: 'handoff:a', volumeId: 'volume:1', source: 'generated' }),
      definition({
        handoffId: 'handoff:b', volumeId: 'volume:2', volumeIndex: 2,
        firstChapter: 21, lastChapter: 40, source: 'generated',
      }),
    ]
    await renderPanel()
    await expandFirstRow()
    await fill(0, 'worldState', '改过的卷末世界')
    await click(button('保存'))
    await vi.waitFor(() => expect(upsertCalls()).toHaveLength(2))
    const byId = new Map(upsertCalls().map(([, input]) => [input.handoffId, input]))
    expect(byId.get('handoff:a')!.source).toBe('author')
    expect(byId.get('handoff:b')!.source).toBe('generated')
  })
})

/**
 * P1-2 期 2b：开写闸门写的「已人工复查」确认。
 *
 * 面板只负责**看见与撤销** —— 确认本身在开写时写。没有这个入口，那句
 * 「撤销一条，下次会重新提醒」就是一句空话。
 */
describe('已确认的跨卷衔接', () => {
  it('列出已确认的卷与理由，撤销后立即消失', async () => {
    exemptions = [{
      stableFactKey: 'volume-handoff:volume:1',
      reason: '作者确认已人工复查第1卷的跨卷衔接（第1–20章）并继续写作',
      revoked: false,
    }]
    await renderPanel()
    const section = container.querySelector('[data-testid="volume-handoff-acks"]')
    expect(section).not.toBeNull()
    expect(section!.textContent).toContain('第1卷')
    expect(section!.textContent).toContain('人工复查')

    const revoke = section!.querySelector<HTMLButtonElement>('[data-action="revoke-handoff-ack"]')!
    await click(revoke)
    await vi.waitFor(() => expect(channels()).toContain('db:consistency-exemption-revoke'))
    await vi.waitFor(() => expect(container.querySelector('[data-testid="volume-handoff-acks"]')).toBeNull())
    expect(container.textContent).toContain('已撤销确认')
  })

  it('没有确认时不渲染这一块（不制造空面板）', async () => {
    await renderPanel()
    expect(container.querySelector('[data-testid="volume-handoff-acks"]')).toBeNull()
  })
})
