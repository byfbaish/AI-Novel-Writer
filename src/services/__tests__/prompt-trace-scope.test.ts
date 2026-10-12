import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configurePromptTrace,
  recordFragments,
  resetPromptTrace,
  type PromptTraceSink,
} from '../prompts/prompt-trace'
import { currentTraceScope, pushTraceScope, resetTraceScope, type TraceScope } from '../prompts/trace-scope'
import { resetTraceIoQueue } from '../prompts/prompt-trace-writer'
import { getBuiltinPromptTemplate } from '../builtin-prompt-templates'

const templateKey = 'first_chapter_draft'

function template() {
  const builtin = getBuiltinPromptTemplate(templateKey, 'zh-CN')
  if (!builtin) throw new Error('内置模板缺失')
  return builtin
}

function sink(overrides: Partial<PromptTraceSink> = {}): PromptTraceSink {
  return { enabled: () => true, runHandle: () => currentTraceScope()?.runHandle, ...overrides }
}

afterEach(() => {
  resetPromptTrace()
  resetTraceScope()
  resetTraceIoQueue()
  configurePromptTrace({ enabled: () => false, runHandle: () => undefined })
})

describe('trace-scope', () => {
  it('在无作用域时不暴露句柄', () => {
    expect(currentTraceScope()).toBeUndefined()
  })

  it('进入作用域后可读取，退出后清空', () => {
    const dispose = pushTraceScope({ runHandle: 'p/e/r', operation: 'chapter-draft' })
    expect(currentTraceScope()?.runHandle).toBe('p/e/r')
    expect(currentTraceScope()?.operation).toBe('chapter-draft')
    dispose()
    expect(currentTraceScope()).toBeUndefined()
  })

  it('自动打上开始时刻', () => {
    const scope: TraceScope = { runHandle: 'p/e/r' }
    const before = Date.now()
    const dispose = pushTraceScope(scope)
    expect(scope.startedAt).toBeGreaterThanOrEqual(before)
    dispose()
  })

  it('嵌套时按栈序恢复外层作用域', () => {
    const outer = pushTraceScope({ runHandle: 'outer' })
    const inner = pushTraceScope({ runHandle: 'inner' })
    expect(currentTraceScope()?.runHandle).toBe('inner')
    inner()
    expect(currentTraceScope()?.runHandle).toBe('outer')
    outer()
    expect(currentTraceScope()).toBeUndefined()
  })

  it('重复调用退出函数不会误删同名其它作用域', () => {
    const first = pushTraceScope({ runHandle: 'same' })
    const second = pushTraceScope({ runHandle: 'same' })
    first()
    first()
    expect(currentTraceScope()?.runHandle).toBe('same')
    second()
    expect(currentTraceScope()).toBeUndefined()
  })
})

describe('片段捕获与作用域协同', () => {
  it('把当前作用域的句柄写进快照', () => {
    configurePromptTrace(sink())
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-1', operation: 'chapter-draft' })
    try {
      const snapshot = recordFragments({
        template: template(),
        variables: {},
        built: '组装结果',
        writingLanguage: 'zh-CN',
      })
      expect(snapshot?.runHandle).toBe('proj/lease/run-1')
    } finally {
      dispose()
    }
  })

  it('作用域外捕获时不带句柄', () => {
    configurePromptTrace(sink())
    const snapshot = recordFragments({
      template: template(),
      variables: {},
      built: '组装结果',
      writingLanguage: 'zh-CN',
    })
    expect(snapshot).toBeDefined()
    expect(snapshot?.runHandle).toBeUndefined()
  })

  it('捕获快照会通知落盘钩子', async () => {
    const { setSnapshotSink } = await import('../prompts/prompt-trace')
    const onCapture = vi.fn()
    setSnapshotSink(onCapture)
    configurePromptTrace(sink())
    try {
      recordFragments({ template: template(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      expect(onCapture).toHaveBeenCalledOnce()
    } finally {
      setSnapshotSink(null)
    }
  })

  it('落盘钩子抛错不影响片段捕获', async () => {
    const { setSnapshotSink } = await import('../prompts/prompt-trace')
    setSnapshotSink(() => { throw new Error('落盘炸了') })
    configurePromptTrace(sink())
    try {
      expect(() => recordFragments({ template: template(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })).not.toThrow()
    } finally {
      setSnapshotSink(null)
    }
  })
})
