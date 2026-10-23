import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { ResourceRegistryEditor } from '../ResourceRegistryEditor'

// 抽取按钮会取提示词模板；浏览器测试里替掉这一层读取（同 ResourceRegistryPanel 的测试）。
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

const session = {
  projectId: 'registry-page',
  leaseId: 'registry-lease',
  projectPath: 'C:\\synthetic\\registry-page',
}

const WORLDBUILDING = '宗门每月发放三十枚下品灵石。'

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let core: Record<string, unknown>
let partial: Record<string, unknown>

function button(label: string): HTMLButtonElement {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target
}

async function render() {
  await act(async () => {
    root.render(<ResourceRegistryEditor projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(
    container.querySelector('[data-testid="resource-registry-panel"]'),
  ).not.toBeNull())
}

beforeEach(() => {
  vi.clearAllMocks()
  core = { synopsis: '', worldbuilding: WORLDBUILDING, totalChapters: 20, writingLanguage: 'zh-CN' }
  partial = {}
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '资源页测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '', writingLanguage: 'zh-CN' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string) => {
    if (channel === 'db:project-core-get') return core
    if (channel === 'fs:read-json') return { success: true, data: partial }
    if (channel === 'db:resources-list') return { success: true, resources: [] }
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

describe('资源登记独立页面', () => {
  it('读到世界观后抽取按钮可用；只读三个通道，渲染不写库', async () => {
    await render()

    expect(container.textContent).toContain('资源登记')
    expect(button('从世界观抽取候选').disabled).toBe(false)

    const channels = new Set(invoke.mock.calls.map(([channel]) => String(channel)))
    expect(channels).toEqual(new Set(['db:project-core-get', 'fs:read-json', 'db:resources-list']))
  })

  it('世界观为空时抽取按钮禁用并说明原因', async () => {
    core = { ...core, worldbuilding: '' }
    await render()

    expect(button('从世界观抽取候选').disabled).toBe(true)
    expect(button('从世界观抽取候选').getAttribute('title')).toContain('世界观还没有内容')
  })

  it('检查点里的候选直接进候选区，且引文在当前正文里命不中的整行不发', async () => {
    partial = {
      world_building_resource_candidates: JSON.stringify({
        candidates: [
          {
            name: '下品灵石', familyId: '灵石', tier: 1, unit: '枚', period: '月',
            anchorValue: null, anchorNote: null, anchorQuote: null,
            earnNote: '宗门月例', costNote: null, scarcityNote: null,
            quote: '宗门每月发放三十枚下品灵石',
          },
          {
            name: '灵石', familyId: null, tier: 0, unit: '枚', period: null,
            anchorValue: null, anchorNote: null, anchorQuote: null,
            earnNote: null, costNote: null, scarcityNote: null,
            quote: '灵石矿脉由三家把持', // 当前正文里没有这句 ⇒ 陈引文
          },
        ],
      }),
    }
    await render()

    await vi.waitFor(() => expect(
      container.querySelectorAll('[data-testid="resource-candidate"]').length,
    ).toBe(1))
    const zone = container.querySelector('[data-testid="resource-candidate-zone"]')
    expect(zone?.textContent).toContain('下品灵石')
    expect(zone?.textContent).toContain('宗门每月发放三十枚下品灵石')
    expect(zone?.textContent).not.toContain('灵石矿脉由三家把持')
  })
})
