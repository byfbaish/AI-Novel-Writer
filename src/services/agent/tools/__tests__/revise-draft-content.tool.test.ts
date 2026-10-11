import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useProjectStore } from '../../../../stores/project-store'
import { useEditorStore } from '../../../../stores/editor-store'
import { createAgentExecutionContext } from '../project-context'
import {
  applyDraftEdits,
  normalizeDraftEdits,
  reviseDraftContentTool,
} from '../revise-draft-content.tool'
import { builtinTools } from '..'

const invoke = vi.fn()
vi.mock('../../../ipc-client', () => ({
  ipc: { invokeWithProjectSession: (...args: unknown[]) => invoke(...args) },
}))

const project = {
  id: 'project-A', sessionLease: 'lease-A', name: 'A', path: 'C:\\novels\\A',
  novelConfig: {
    genre: '规则怪谈', subGenre: '', targetAudience: '青年', totalChapters: 10, wordsPerChapter: 3000,
    plotStructure: 'three_act', narrativePOV: 'third_limited', coreOutline: '', worldSetting: '',
    goldenFinger: '', protagonistProfile: '', globalGuidance: '', writingLanguage: 'zh-CN',
  },
  characterStates: '', createdAt: '', updatedAt: '',
}

const DRAFT_ID = 7
const SOURCE = '【规则一】不要回答。\n\n他抬头，看见墙上多了一行字。\n\n【规则二】不要回头。\n'

/** 记录每次 IPC 调用的参数，便于断言"是否落盘、落盘内容是什么" */
function mockDrafts(status = 'draft', content = SOURCE): void {
  invoke.mockImplementation(async (_session: unknown, channel: string) => {
    if (channel === 'db:draft-list') return [{ id: DRAFT_ID, version: 2, status, chapterNumber: 1 }]
    if (channel === 'db:draft-get-full') return { id: DRAFT_ID, content }
    if (channel === 'db:draft-update-content') return { success: true }
    if (channel === 'db:draft-list-all') return []
    throw new Error(`unexpected channel ${channel}`)
  })
}

function updateCalls(): unknown[][] {
  return invoke.mock.calls.filter(call => call[1] === 'db:draft-update-content')
}

beforeEach(() => {
  invoke.mockReset()
  useProjectStore.setState({ currentProject: project as never })
  useEditorStore.setState({ tabs: [] })
})

afterEach(() => {
  useProjectStore.setState({ currentProject: null })
  useEditorStore.setState({ tabs: [] })
  vi.restoreAllMocks()
})

describe('revise_draft_content registration', () => {
  it('is registered as a confirmation-required write tool', () => {
    const tool = builtinTools.find(item => item.name === 'revise_draft_content')
    expect(tool).toBeDefined()
    expect(tool?.requiresConfirmation).toBe(true)
    expect(tool?.isReadOnly).toBe(false)
    expect(tool?.source).toBe('builtin')
  })

  it('keeps the explicit project-fact proposal tools unchanged', () => {
    const factMutationTools = builtinTools.filter(tool => (
      tool.name.includes('config') || tool.name.includes('blueprint')
    ) && !tool.isReadOnly)
    expect(factMutationTools.map(tool => tool.name)).toEqual([
      'propose_novel_config',
      'propose_chapter_blueprint',
    ])
  })
})

describe('applyDraftEdits', () => {
  it('applies non-overlapping replacements in order', () => {
    const result = applyDraftEdits('甲甲甲', [
      { find: '甲甲甲', replace: '【第一段】' },
    ])
    expect(result.problems).toEqual([])
    expect(result.content).toBe('【第一段】')
  })

  it('reports a find that never matches and returns the untouched source', () => {
    const result = applyDraftEdits('原文', [{ find: '不存在', replace: 'X' }])
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain('未在正文中出现')
    expect(result.content).toBe('原文')
  })

  it('reports an ambiguous find and returns the untouched source', () => {
    const result = applyDraftEdits('甲 甲', [{ find: '甲', replace: '乙' }])
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain('不唯一')
    expect(result.content).toBe('甲 甲')
  })

  it('is atomic: one bad edit discards the whole batch', () => {
    const result = applyDraftEdits('规则一。规则二。', [
      { find: '规则一。', replace: '【规则一】' },
      { find: '不存在', replace: 'X' },
    ])
    expect(result.problems).toHaveLength(1)
    expect(result.content).toBe('规则一。规则二。')
  })

  it('treats $ patterns in replace as literal text', () => {
    const result = applyDraftEdits('占位', [{ find: '占位', replace: '$& $1 $`' }])
    expect(result.problems).toEqual([])
    expect(result.content).toBe('$& $1 $`')
  })
})

describe('normalizeDraftEdits', () => {
  it.each([
    ['edits 不是数组', 'nope'],
    ['edits 为空', []],
    ['元素不是对象', ['x']],
    ['find 为空串', [{ find: '', replace: 'x' }]],
    ['replace 不是字符串', [{ find: 'a', replace: 1 }]],
  ])('rejects %s', (_label, raw) => {
    expect(normalizeDraftEdits(raw)).toHaveProperty('error')
  })

  it('accepts a well-formed list', () => {
    expect(normalizeDraftEdits([{ find: 'a', replace: 'b' }])).toEqual({
      edits: [{ find: 'a', replace: 'b' }],
    })
  })
})

describe('revise_draft_content execution', () => {
  it('writes the edited draft through the same channel the editor save uses', async () => {
    mockDrafts()
    const result = await reviseDraftContentTool.execute({
      chapter_number: 1,
      edits: [{ find: '【规则二】不要回头。', replace: '【规则二】不要回头。\n【规则三】不要数台阶。' }],
    }, createAgentExecutionContext())

    expect(result.success).toBe(true)
    expect(updateCalls()).toHaveLength(1)
    const [, , draftId, content, wordCount] = updateCalls()[0]
    expect(draftId).toBe(DRAFT_ID)
    expect(content).toContain('【规则三】不要数台阶。')
    expect(typeof wordCount).toBe('number')
    expect(result.artifacts?.[0]).toMatchObject({ type: 'file_modified' })
  })

  it('never touches the draft when an edit cannot be applied', async () => {
    mockDrafts()
    const result = await reviseDraftContentTool.execute({
      chapter_number: 1,
      edits: [{ find: '根本没这行', replace: 'X' }],
    }, createAgentExecutionContext())

    expect(result.success).toBe(false)
    expect(result.error).toContain('未在正文中出现')
    expect(updateCalls()).toHaveLength(0)
  })

  it('refuses to modify a finalized draft', async () => {
    mockDrafts('finalized')
    const result = await reviseDraftContentTool.execute({
      chapter_number: 1,
      content: '重写全章',
    }, createAgentExecutionContext())

    expect(result.success).toBe(false)
    expect(result.error).toContain('定稿')
    expect(updateCalls()).toHaveLength(0)
  })

  it('refuses when the chapter is open in the editor with unsaved changes', async () => {
    mockDrafts()
    useEditorStore.setState({
      tabs: [{
        id: 'tab-1', name: '第1章', type: 'chapter', projectKey: project.path,
        draftId: DRAFT_ID, dirty: true, content: '作者手头未保存的版本',
      }] as never,
    })
    const result = await reviseDraftContentTool.execute({
      chapter_number: 1,
      content: '重写全章',
    }, createAgentExecutionContext())

    expect(result.success).toBe(false)
    expect(result.error).toContain('未保存')
    expect(updateCalls()).toHaveLength(0)
  })

  it('syncs an open, clean editor tab instead of overwriting unsaved input', async () => {
    mockDrafts()
    useEditorStore.setState({
      tabs: [{
        id: 'tab-1', name: '第1章', type: 'chapter', projectKey: project.path,
        draftId: DRAFT_ID, dirty: false, content: SOURCE, contentRevision: 1,
      }] as never,
    })
    const result = await reviseDraftContentTool.execute({
      chapter_number: 1,
      content: '全新的正文',
    }, createAgentExecutionContext())

    expect(result.success).toBe(true)
    const tab = useEditorStore.getState().tabs.find(item => item.id === 'tab-1')
    expect(tab?.content).toBe('全新的正文')
    expect(tab?.dirty).toBe(false)
  })

  it('requires exactly one of edits or content', async () => {
    mockDrafts()
    const both = await reviseDraftContentTool.execute({
      chapter_number: 1,
      edits: [{ find: 'a', replace: 'b' }],
      content: 'x',
    }, createAgentExecutionContext())
    expect(both.success).toBe(false)

    mockDrafts()
    const neither = await reviseDraftContentTool.execute({ chapter_number: 1 }, createAgentExecutionContext())
    expect(neither.success).toBe(false)
  })

  it('rejects an invalid chapter number before touching IPC', async () => {
    mockDrafts()
    const result = await reviseDraftContentTool.execute({
      chapter_number: 0,
      content: 'x',
    }, createAgentExecutionContext())

    expect(result.success).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('reports an empty chapter instead of writing blank content', async () => {
    mockDrafts('draft', '   ')
    const result = await reviseDraftContentTool.execute({
      chapter_number: 1,
      content: '新内容',
    }, createAgentExecutionContext())

    expect(result.success).toBe(false)
    expect(updateCalls()).toHaveLength(0)
  })
})
