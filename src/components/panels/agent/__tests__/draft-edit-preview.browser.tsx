import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useLocaleStore } from '../../../../stores/locale-store'
import { useProjectStore } from '../../../../stores/project-store'
import { useAgentStore } from '../../../../stores/agent-store'
import ConfirmCard from '../ConfirmCard'
import DraftEditPreview from '../DraftEditPreview'
import type { ToolCallInfo } from '../../../../services/agent/agent-engine'

const resolveToolConfirmation = vi.fn()
const cancelGeneration = vi.fn()
const invoke = vi.fn()

const session = { projectId: 'A', leaseId: 'lease-A', projectPath: 'C:\\novels\\A' }
const project = {
  id: 'A', sessionLease: 'lease-A', path: session.projectPath, name: 'A', characterStates: '', createdAt: '', updatedAt: '',
  novelConfig: {
    genre: '规则怪谈', subGenre: '', targetAudience: '青年', totalChapters: 10, wordsPerChapter: 3000,
    plotStructure: 'three_act', narrativePOV: 'third_limited', coreOutline: '', worldSetting: '',
    goldenFinger: '', protagonistProfile: '', globalGuidance: '',
  },
}

let container: HTMLDivElement
let root: Root
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function toolCall(overrides: Partial<ToolCallInfo>): ToolCallInfo {
  return {
    id: 'revise-1', toolName: 'revise_draft_content', arguments: {},
    status: 'waiting_confirm', source: 'builtin', projectSession: session,
    ...overrides,
  } as ToolCallInfo
}

beforeEach(() => {
  resolveToolConfirmation.mockReset()
  cancelGeneration.mockReset()
  invoke.mockReset()
  invoke.mockImplementation(async () => [])
  useLocaleStore.setState({ locale: 'zh-CN', initialized: true })
  useAgentStore.setState({ resolveToolConfirmation, cancelGeneration })
  useProjectStore.setState({ currentProject: project as never })
  Object.defineProperty(window, 'aiNovelAPI', {
    configurable: true,
    value: {
      invoke, on: vi.fn(), once: vi.fn(), send: vi.fn(),
      setZoomLevel: vi.fn(), setZoomFactor: vi.fn(), getZoomLevel: vi.fn(),
    },
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useProjectStore.setState({ currentProject: null })
})

describe('DraftEditPreview', () => {
  it('lists every replacement as before and after text', async () => {
    await act(async () => root.render(<DraftEditPreview toolCall={toolCall({
      arguments: {
        chapter_number: 1,
        edits: [
          { find: '【规则二】不要回头。', replace: '【规则二】不要回头。\n【规则三】不要数台阶。' },
          { find: '弹幕：大哥别去', replace: '弹幕：【大哥别去】' },
        ],
      },
    })} />))

    const body = container.textContent ?? ''
    expect(body).toContain('修改第 1 章正文')
    expect(body).toContain('共 2 处替换')
    expect(body).toContain('【规则二】不要回头。')
    expect(body).toContain('【规则三】不要数台阶。')
    expect(body).toContain('弹幕：【大哥别去】')
  })

  it('summarizes a whole-chapter replacement instead of dumping the text', async () => {
    await act(async () => root.render(<DraftEditPreview toolCall={toolCall({
      arguments: { chapter_number: 3, content: '第一章 开端\n\n他抬起头。' },
    })} />))

    const body = container.textContent ?? ''
    expect(body).toContain('修改第 3 章正文')
    expect(body).toContain('整章覆盖')
    expect(body).toContain('10 字')
  })

  it('collapses very long edit lists', async () => {
    const edits = Array.from({ length: 25 }, (_, index) => ({ find: `旧${index}`, replace: `新${index}` }))
    await act(async () => root.render(<DraftEditPreview toolCall={toolCall({
      arguments: { chapter_number: 2, edits },
    })} />))

    const body = container.textContent ?? ''
    expect(body).toContain('共 25 处替换')
    expect(body).toContain('另有 5 处未展开')
  })

  it('renders nothing for other tools', async () => {
    await act(async () => root.render(<DraftEditPreview toolCall={toolCall({ toolName: 'write_file' })} />))
    expect((container.textContent ?? '').trim()).toBe('')
  })
})

describe('ConfirmCard integration', () => {
  it('shows the per-edit preview and hides the raw JSON payload', async () => {
    await act(async () => root.render(<ConfirmCard toolCall={toolCall({
      arguments: { chapter_number: 1, edits: [{ find: '甲', replace: '乙' }] },
    })} />))

    const body = container.textContent ?? ''
    expect(body).toContain('需要确认操作')
    expect(body).toContain('将修改第 1 章正文（1 处替换）')
    expect(body).toContain('甲')
    expect(body).not.toContain('"edits"')
  })
})
