import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VolumeHandoffGate } from '../../../shared/volume-handoff-gate'
import type { VolumeHandoffDefinition } from '../../../shared/volume-handoff'
import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import { useLLMStore } from '../../../stores/llm-store'
import { useLocaleStore } from '../../../stores/locale-store'
import VolumeHandoffGatePanel from '../VolumeHandoffGatePanel'

/**
 * 开写闸门面板（P1-2 期 2b）。验收口径：
 * - 三种状态各自说清「上一卷缺什么」；
 * - **生成初稿 → 展示摘要 → 作者点「就用这份」才算确认**（不替作者点头）；
 * - 「已人工复查」写一条可撤销的确认，然后才放行；
 * - 生成失败必须可见，且**一个字都不写库**。
 */
vi.mock('../../../services/prompt-templates', () => ({
  resolvePromptTemplate: async () => ({
    key: 'generate_volume_handoff',
    content: '{{volume_label}} {{chapter_range}}\n{{volume_notes}}',
  }),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SESSION: ProjectSessionContext = {
  projectId: 'gate-project',
  leaseId: 'gate-lease',
  projectPath: 'C:\\synthetic\\gate-project',
}

const RANGE = {
  volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
  first: 1, last: 20, basis: 'headings' as const, actualLast: null,
}

const DRAFT_JSON = JSON.stringify({
  worldState: '灵潮退去',
  heroState: '顾长风左臂未愈',
  events: ['玄火令被夺'],
  items: [],
  debts: [],
  openThread: '监天台为何要玄火令',
})

const definition = (over: Partial<VolumeHandoffDefinition> = {}): VolumeHandoffDefinition => ({
  handoffId: 'handoff:1', volumeId: 'volume:1', volumeIndex: 1,
  firstChapter: 1, lastChapter: 20, boundaryBasis: 'headings',
  worldState: '草稿世界', heroState: '草稿主角', events: [], items: [], debts: [], openThread: '',
  source: 'generated', createdAt: '', updatedAt: '',
  ...over,
})

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let llmReply: unknown
let upserts: Array<Record<string, unknown>>
let saves: Array<[string, string]>

const gate = (state: VolumeHandoffGate['state'], handoff: VolumeHandoffDefinition | null): VolumeHandoffGate => ({
  state, range: RANGE, handoff,
})

function button(label: string): HTMLButtonElement {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`missing button ${label}`)
  return target as HTMLButtonElement
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

async function renderPanel(value: VolumeHandoffGate, overrides: {
  onProceed?: () => void
  onDismiss?: () => void
} = {}) {
  const onProceed = overrides.onProceed ?? vi.fn()
  const onDismiss = overrides.onDismiss ?? vi.fn()
  await act(async () => {
    root.render(
      <VolumeHandoffGatePanel
        gate={value}
        projectSession={SESSION}
        writingLanguage="zh-CN"
        onProceed={onProceed}
        onDismiss={onDismiss}
      />,
    )
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return { onProceed, onDismiss }
}

beforeEach(() => {
  vi.clearAllMocks()
  llmReply = { success: true, content: DRAFT_JSON, finishReason: 'stop' }
  upserts = []
  saves = []
  useLocaleStore.setState({ locale: 'zh-CN' })
  useLLMStore.setState({ defaultModelId: 'model-1' })
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:continuity-list-before') {
      expect(args[0]).toBe(RANGE.last + 1)
      return [
        { chapterNumber: 1, chapterTitle: '一', chapterNotes: '第一章要点' },
        { chapterNumber: 2, chapterTitle: '二', chapterNotes: '第二章要点' },
      ]
    }
    if (channel === 'db:volume-handoffs-upsert') {
      upserts.push(args[0] as Record<string, unknown>)
      return { success: true, entry: definition({ handoffId: 'handoff:new' }) }
    }
    if (channel === 'db:consistency-exemption-save') {
      saves.push([String(args[0]), String(args[1])])
      return { success: true }
    }
    if (channel === 'llm:generate') return llmReply
    throw new Error(`Unexpected IPC: ${channel}`)
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
  delete (window as typeof window & { aiNovelAPI?: unknown }).aiNovelAPI
})

describe('开写闸门面板', () => {
  it('上一卷没有交接单：说清缺什么，给三个出口', async () => {
    await renderPanel(gate('missing', null))
    expect(container.textContent).toContain('还没有卷末交接单')
    expect(container.textContent).toContain('第1卷')
    expect(container.textContent).toContain('第1–20章')
    expect(button('生成初稿给我看')).toBeTruthy()
    expect(button('已人工复查，继续')).toBeTruthy()
    expect(button('取消，我先去处理')).toBeTruthy()
    // 只打开面板不写任何东西
    expect(upserts).toHaveLength(0)
    expect(saves).toHaveLength(0)
  })

  it('只有模型初稿：明说「还没经你确认」', async () => {
    await renderPanel(gate('unreviewed-draft', definition()))
    expect(container.textContent).toContain('只有一份模型初稿')
    expect(container.textContent).toContain('还没经你确认')
  })

  it('「已人工复查」：写一条带理由的确认，然后才放行', async () => {
    const { onProceed } = await renderPanel(gate('missing', null))
    await click(button('已人工复查，继续'))
    await vi.waitFor(() => expect(onProceed).toHaveBeenCalledOnce())
    expect(saves).toHaveLength(1)
    expect(saves[0]![0]).toBe('volume-handoff:volume:1')
    expect(saves[0]![1]).toContain('人工复查')
    expect(upserts).toHaveLength(0)
  })

  it('生成初稿：读要点 → 调一次模型 → 写 source=generated，再让作者决定', async () => {
    const { onProceed } = await renderPanel(gate('missing', null))
    await click(button('生成初稿给我看'))
    await vi.waitFor(() => expect(upserts).toHaveLength(1))
    expect(upserts[0]).toMatchObject({ volumeId: 'volume:1', source: 'generated', worldState: '灵潮退去' })
    expect(upserts[0]).not.toHaveProperty('handoffId')
    await vi.waitFor(() => expect(container.textContent).toContain('已生成初稿'))
    // 生成完**不自动放行**：初稿还没被看过。
    expect(onProceed).not.toHaveBeenCalled()
    expect(saves).toHaveLength(0)
    expect(button('就用这份，继续写')).toBeTruthy()
  })

  it('「就用这份」：确认 + 放行（生成时不替作者点头）', async () => {
    const { onProceed } = await renderPanel(gate('missing', null))
    await click(button('生成初稿给我看'))
    await vi.waitFor(() => expect(container.textContent).toContain('就用这份'))
    await click(button('就用这份，继续写'))
    await vi.waitFor(() => expect(onProceed).toHaveBeenCalledOnce())
    expect(saves).toHaveLength(1)
    expect(saves[0]![1]).toContain('采用本次生成')
    expect(upserts).toHaveLength(1)
  })

  it('已有初稿时重新生成：覆盖同一行（带 handoffId）', async () => {
    await renderPanel(gate('unreviewed-draft', definition({ handoffId: 'handoff:g' })))
    await click(button('生成初稿给我看'))
    await vi.waitFor(() => expect(upserts).toHaveLength(1))
    expect(upserts[0]).toMatchObject({ handoffId: 'handoff:g', source: 'generated' })
  })

  it('生成失败：错误可见，且一个字都不写库', async () => {
    llmReply = { success: false, content: '', finishReason: 'error', error: '401 unauthorized' }
    const { onProceed } = await renderPanel(gate('missing', null))
    await click(button('生成初稿给我看'))
    await vi.waitFor(() => expect(container.textContent).toContain('401 unauthorized'))
    expect(upserts).toHaveLength(0)
    expect(saves).toHaveLength(0)
    expect(onProceed).not.toHaveBeenCalled()
  })

  it('取消：什么都不写，也不放行', async () => {
    const { onProceed, onDismiss } = await renderPanel(gate('missing', null))
    await click(button('取消，我先去处理'))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onProceed).not.toHaveBeenCalled()
    expect(upserts).toHaveLength(0)
    expect(saves).toHaveLength(0)
  })
})
