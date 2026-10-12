import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/ipc-client', () => ({ ipc: { invokeWithProjectSession: vi.fn() } }))
vi.mock('../../stores/debug-store', () => ({
  useDebugStore: { getState: () => ({ promptTraceEnabled: true, traceRoot: null }) },
}))

import { ipc } from '../ipc-client'
import {
  PROMPT_TRACE_DIR_SEGMENTS,
  promptTraceRelativeDir,
  recordTraceIo,
  resetTraceIoQueue,
  scheduleTraceFlush,
} from '../prompts/prompt-trace-writer'
import { pushTraceScope, resetTraceScope } from '../prompts/trace-scope'
import { configurePromptTrace, recordFragments, resetPromptTrace } from '../prompts/prompt-trace'
import { setSnapshotSink } from '../prompts/prompt-trace'
import { getBuiltinPromptTemplate } from '../builtin-prompt-templates'

const invoke = vi.mocked(ipc.invokeWithProjectSession)
const session = { projectId: 'proj', leaseId: 'lease', projectPath: 'C:/novel/海港' }
const templateKey = 'first_chapter_draft'

function builtin() {
  const found = getBuiltinPromptTemplate(templateKey, 'zh-CN')
  if (!found) throw new Error('内置模板缺失')
  return found
}

beforeEach(() => {
  vi.useFakeTimers()
  invoke.mockReset()
  invoke.mockResolvedValue({ success: true, commitState: 'committed' } as never)
  resetPromptTrace()
  resetTraceScope()
  resetTraceIoQueue()
  configurePromptTrace({ enabled: () => true, runHandle: () => undefined })
  setSnapshotSink(scheduleTraceFlush)
})

afterEach(() => {
  setSnapshotSink(null)
  vi.useRealTimers()
})

/** 触发一次落盘并等待定时器与后续 await 完成。 */
async function flush(): Promise<void> {
  await vi.runAllTimersAsync()
}

describe('prompt-trace-writer', () => {
  it('落盘目录固定在项目内的 debug/prompt-trace', () => {
    expect(PROMPT_TRACE_DIR_SEGMENTS).toEqual(['debug', 'prompt-trace'])
    expect(promptTraceRelativeDir()).toBe('debug/prompt-trace')
  })

  it('写出一份 md 与一份 json，路径在项目根内', async () => {
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-1', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }

    const writeCalls = invoke.mock.calls.filter(([, channel]) => channel === 'fs:write-file')
    expect(writeCalls).toHaveLength(2)
    const paths = writeCalls.map(([, , path]) => path as string)
    expect(paths.every(p => p.startsWith('C:/novel/海港/debug/prompt-trace/'))).toBe(true)
    expect(paths.some(p => p.endsWith('.md'))).toBe(true)
    expect(paths.some(p => p.endsWith('.json'))).toBe(true)
    // 每个写入都带上项目根，供主进程做沙箱校验。
    expect(writeCalls.every(([, , , , expected]) => expected === session.projectPath)).toBe(true)
  })

  it('md 含片段表格与来源标注', async () => {
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-2', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }

    const mdCall = invoke.mock.calls.find(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.md'))
    const markdown = mdCall?.[3] as string
    expect(markdown).toContain('# Prompt 追踪快照')
    expect(markdown).toContain('chapter-draft')
    expect(markdown).toContain('proj/lease/run-2')
    expect(markdown).toContain('| 序号 | 来源 | 名称 | 可改 | 生效来源 | 变量 |')
    expect(markdown).toContain('这个步骤的提示词模板正文')
  })

  it('IO 面与片段归并到同一份文件', async () => {
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-3', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      recordTraceIo({ messages: [{ role: 'system', content: '你是作家' }, { role: 'user', content: '写第1章' }], output: '第一章正文', finishReason: 'stop' })
      await flush()
    } finally { dispose() }

    const jsonCall = invoke.mock.calls.find(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.json'))
    const payload = JSON.parse(jsonCall?.[3] as string)
    expect(payload.io.output).toBe('第一章正文')
    expect(payload.io.finishReason).toBe('stop')
    expect(payload.io.messages).toHaveLength(2)
    expect(payload.snapshots).toHaveLength(1)
  })

  it('落盘失败不抛出（旁路不得阻断生成）', async () => {
    invoke.mockRejectedValue(new Error('磁盘写满'))
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-4', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await expect(flush()).resolves.toBeUndefined()
    } finally { dispose() }
  })

  it('缺少项目会话时不落盘', async () => {
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-5', operation: 'chapter-draft' })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }
    expect(invoke.mock.calls.filter(([, channel]) => channel === 'fs:write-file')).toHaveLength(0)
  })

  it('无作用域时不落盘', async () => {
    recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
    await flush()
    expect(invoke.mock.calls.filter(([, channel]) => channel === 'fs:write-file')).toHaveLength(0)
  })
})
