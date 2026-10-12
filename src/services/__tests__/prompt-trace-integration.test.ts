import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushTraceScope, resetTraceScope } from '../prompts/trace-scope'
import { configurePromptTrace, recordFragments, resetPromptTrace, resetScopeDiagnostic } from '../prompts/prompt-trace'
import { getBuiltinPromptTemplate } from '../builtin-prompt-templates'

/**
 * 端到端骨架验证：确认「作用域 → 片段捕获」这条链在模拟真实调用形态下成立。
 *
 * 真实链路上 `callLLMWithBuilder()` 会先 `builder.build()` 再进 `callLLM`，
 * 两者都在 `executeWithGenerationRuntime` 的同步调用栈内。这里用同样的形态验证：
 * 装配发生在作用域内 → 句柄与会话都拿得到；装配发生在作用域外 → 两者皆无
 * （这正是落盘会被安全跳过、且需要诊断提示的情形）。
 */
const templateKey = 'first_chapter_draft'

function template() {
  const found = getBuiltinPromptTemplate(templateKey, 'zh-CN')
  if (!found) throw new Error('内置模板缺失')
  return found
}

afterEach(() => {
  resetPromptTrace()
  resetTraceScope()
  resetScopeDiagnostic()
  configurePromptTrace({ enabled: () => false, runHandle: () => undefined })
})

describe('装配与作用域的关系', () => {
  it('作用域内装配：句柄与会话都可读', () => {
    let seenHandle: string | undefined
    let seenHasSession = false
    configurePromptTrace({
      enabled: () => true,
      runHandle: () => seenHandle,
      hasProjectSession: () => seenHasSession,
    })
    // 模拟 executeWithGenerationRuntime：进作用域 → 装配 → 出作用域
    const dispose = pushTraceScope({
      runHandle: 'proj/lease/run-1',
      operation: 'chapter-draft',
      projectSession: { projectId: 'proj', leaseId: 'lease', projectPath: 'C:/novel' },
    })
    try {
      seenHandle = 'proj/lease/run-1'
      seenHasSession = true
      const snapshot = recordFragments({
        template: template(),
        variables: {},
        built: '组装结果',
        writingLanguage: 'zh-CN',
      })
      expect(snapshot?.runHandle).toBe('proj/lease/run-1')
    } finally { dispose() }
  })

  it('作用域外装配：判为无可落盘定位（应触发诊断）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      configurePromptTrace({ enabled: () => true, runHandle: () => undefined, hasProjectSession: () => false })
      const snapshot = recordFragments({ template: template(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      expect(snapshot).toBeDefined()
      expect(snapshot?.runHandle).toBeUndefined()
      const warned = warn.mock.calls.some(call => String(call[0]).includes('提示词装配发生在生成作用域之外'))
      expect(warned).toBe(true)
    } finally { warn.mockRestore() }
  })

  it('作用域内装配不产生诊断噪音', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      configurePromptTrace({
        enabled: () => true,
        runHandle: () => 'proj/lease/run-2',
        hasProjectSession: () => true,
      })
      recordFragments({ template: template(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      const warned = warn.mock.calls.some(call => String(call[0]).includes('提示词装配发生在生成作用域之外'))
      expect(warned).toBe(false)
    } finally { warn.mockRestore() }
  })
})
