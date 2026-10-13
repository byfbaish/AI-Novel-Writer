import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configurePromptTrace,
  recordFragments,
  resetPromptTrace,
  type PromptTraceSink,
} from '../prompts/prompt-trace'
import {
  currentTraceScope,
  declareTraceScopeChapterRange,
  pushTraceScope,
  resetTraceScope,
  type TraceScope,
} from '../prompts/trace-scope'
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

describe('本批章节范围声明', () => {
  // 大纲链没有 chapterNumber、模板里也没有 n/m，章节号只在**后到的**请求 purpose 里；
  // 而文件名在首次落盘时就钉住了 —— 所以范围必须由命令在装配前显式声明。
  it('声明后写入当前作用域', () => {
    const scope: TraceScope = { runHandle: 'p/e/r' }
    const dispose = pushTraceScope(scope)
    declareTraceScopeChapterRange(8, 10)
    expect(currentTraceScope()?.chapterRange).toEqual({ from: 8, to: 10 })
    dispose()
  })

  it('无作用域时静默忽略', () => {
    expect(() => declareTraceScopeChapterRange(8, 10)).not.toThrow()
    expect(currentTraceScope()).toBeUndefined()
  })

  it('文件名已钉住后拒绝再改（否则会写出第二份文件）', () => {
    const scope: TraceScope = {
      runHandle: 'p/e/r',
      traceFileName: '20261013-191720-497-大纲-ch8-10-8650c580',
    }
    const dispose = pushTraceScope(scope)
    declareTraceScopeChapterRange(11, 12)
    expect(scope.chapterRange).toBeUndefined()
    dispose()
  })

  it('拒绝非法范围（非整数 / 越界 / 逆序）', () => {
    const scope: TraceScope = { runHandle: 'p/e/r' }
    const dispose = pushTraceScope(scope)
    declareTraceScopeChapterRange(0, 3)
    declareTraceScopeChapterRange(5, 3)
    declareTraceScopeChapterRange(1.5, 3)
    declareTraceScopeChapterRange(Number.NaN, 3)
    expect(scope.chapterRange).toBeUndefined()
    declareTraceScopeChapterRange(6, 6)
    expect(scope.chapterRange).toEqual({ from: 6, to: 6 })
    dispose()
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
