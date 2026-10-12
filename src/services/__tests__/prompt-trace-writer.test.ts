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

  it('md 首屏必须是拼装后的完整提示词，而非模板', async () => {
    // 回归：早期只渲染片段 rawText（变量未替换），人看到的还是 `{{architecture}}`，
    // 无法评估提示词质量。首屏必须是替换变量后的成品。
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-built', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({
        template: builtin(),
        variables: { architecture: '【全书设定池】替换后的架构正文' },
        built: '请开始创作这本小说的第一章。\n\n【全书设定池】替换后的架构正文',
        writingLanguage: 'zh-CN',
      })
      await flush()
    } finally { dispose() }

    const md = invoke.mock.calls.find(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.md'))?.[3] as string
    expect(md).toContain('### 拼装后的完整提示词（发送给模型前）')
    // 替换后的内容必须出现在首屏（拼装态）。
    expect(md).toContain('替换后的架构正文')
    // 首屏位置必须早于"片段来源"（模板态）——保证默认看到的是拼装结果。
    expect(md.indexOf('### 拼装后的完整提示词（发送给模型前）'))
      .toBeLessThan(md.indexOf('### 片段来源（可改性归因）'))
  })

  it('无实际请求面时用「system + 组装正文」重建并标注来源', async () => {
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-rebuild', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }

    const md = invoke.mock.calls.find(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.md'))?.[3] as string
    expect(md).toContain('请求面来源：按装配结果重建')
    expect(md).toContain('按装配结果重建')
    expect(md).toContain('#### system')
    expect(md).toContain('#### user')
    // 系统合同段由 composePromptSystemRole 追加，不属于任何片段，必须能被看到。
    expect(md).toContain('不可变系统合同')
    expect(md).toContain('组装结果')
  })

  it('有实际请求面时直接用真实 messages，并与模型收到的一致', async () => {
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-io', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      recordTraceIo({
        messages: [
          { role: 'system', content: '你是作家' },
          { role: 'user', content: '【补充写作 Skill：快节奏】\n\n组装结果（运行时注入后）' },
        ],
        output: '第一章正文',
        finishReason: 'stop',
      })
      await flush()
    } finally { dispose() }

    const md = invoke.mock.calls.find(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.md'))?.[3] as string
    expect(md).toContain('请求面来源：实际发出')
    // 运行时注入的写作 Skill 只在真实请求面里出现，模板/重建都拿不到。
    expect(md).toContain('补充写作 Skill')
    expect(md).toContain('第一章正文')
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
    expect(payload.ioCalls).toHaveLength(1)
    expect(payload.ioCalls[0].output).toBe('第一章正文')
    expect(payload.ioCalls[0].finishReason).toBe('stop')
    expect(payload.ioCalls[0].messages).toHaveLength(2)
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

  it('主进程返回 success:false 时按失败处理，不得误报已写出', async () => {
    // 回归：`fs:write-file` 失败时**返回 `{success:false}` 而非抛错**。
    // 早期版本只 `await` 不判 success，会把越界/租约失效静默当成写成功。
    invoke.mockResolvedValue({ success: false, commitState: 'not_committed', error: '目标超出当前项目范围，已拒绝操作。' } as never)
    const { lastTraceFlushOutcome, resetTraceIoQueue: reset } = await import('../prompts/prompt-trace-writer')
    reset()
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-refused', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }
    const outcome = lastTraceFlushOutcome()
    expect(outcome?.status).toBe('failed')
    expect(outcome?.reason).toContain('超出当前项目范围')
  })
})

describe('prompt-trace-markdown（纯渲染模块，零运行时依赖）', () => {
  it('旧版数据缺 systemMessage 时不崩溃，并给出可读说明', async () => {
    // 兼容性：本字段是 P2.3 才加的，此前落盘的 .json 没有它（离线重渲染会走到这里）。
    const { buildTraceMarkdown } = await import('../prompts/prompt-trace-markdown')
    const markdown = buildTraceMarkdown({
      operation: 'chapter-draft',
      writtenAt: 0,
      snapshots: [{
        promptKey: 'first_chapter_draft',
        writingLanguage: 'zh-CN',
        capturedAt: 0,
        builtLength: 4,
        built: '组装结果',
        fragments: [{
          order: 1, sourceKind: 'override-systemRole', label: '创作角色定位（system）',
          editable: true, resolvedFrom: 'global', rawText: '你是作家', variables: [],
        }],
      }],
    })
    expect(markdown).toContain('#### system')
    expect(markdown).toContain('尚未采集 system message')
    // user 正文仍必须完整呈现——它才是评估提示词的主体。
    expect(markdown).toContain('组装结果')
  })

  it('没有真实请求面时不伪造「实际发出」', async () => {
    const { buildTraceMarkdown } = await import('../prompts/prompt-trace-markdown')
    const markdown = buildTraceMarkdown({
      writtenAt: 0,
      snapshots: [{ promptKey: 'k', writingLanguage: 'zh-CN', capturedAt: 0, builtLength: 1, built: 'x', systemMessage: 's', fragments: [] }],
    })
    expect(markdown).toContain('请求面来源：按装配结果重建')
    expect(markdown).not.toContain('请求面来源：实际发出')
  })
})

describe('落盘结果回显（状态面板数据源）', () => {
  it('写出文件后回报 ok 与相对路径', async () => {
    const { lastTraceFlushOutcome, resetTraceIoQueue: reset } = await import('../prompts/prompt-trace-writer')
    reset()
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-ok', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }
    const outcome = lastTraceFlushOutcome()
    expect(outcome?.status).toBe('ok')
    expect(outcome?.files).toHaveLength(2)
    expect(outcome?.files?.[0]).toMatch(/^debug\/prompt-trace\//)
    expect(outcome?.operation).toBe('chapter-draft')
  })

  it('缺少项目会话时回报 skipped 并说明原因', async () => {
    const { lastTraceFlushOutcome, resetTraceIoQueue: reset } = await import('../prompts/prompt-trace-writer')
    reset()
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-ns', operation: 'chapter-draft' })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }
    const outcome = lastTraceFlushOutcome()
    expect(outcome?.status).toBe('skipped')
    expect(outcome?.reason).toContain('项目会话')
  })

  it('写入失败时回报 failed 与原因', async () => {
    const { lastTraceFlushOutcome, resetTraceIoQueue: reset } = await import('../prompts/prompt-trace-writer')
    reset()
    invoke.mockRejectedValue(new Error('磁盘写满'))
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-fail', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose() }
    const outcome = lastTraceFlushOutcome()
    expect(outcome?.status).toBe('failed')
    expect(outcome?.reason).toContain('磁盘写满')
  })

  it('订阅者能收到结果，且订阅者抛错不影响落盘', async () => {
    const { subscribeTraceFlushOutcome, resetTraceIoQueue: reset } = await import('../prompts/prompt-trace-writer')
    reset()
    const seen: string[] = []
    const unsubscribe = subscribeTraceFlushOutcome((o) => { seen.push(o.status); throw new Error('订阅方炸了') })
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-sub', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
    } finally { dispose(); unsubscribe() }
    expect(seen).toEqual(['ok'])
  })

  it('作用域外装配必须回显 skipped，面板不得永远停在「等待落盘」', async () => {
    // 回归：装配发生在 `executeWithGenerationRuntime` 之外时，旧实现静默 return，
    // 面板只会停在「已捕获 N 块，等待落盘」——无从判断是"没跑"还是"跑失败"。
    const { lastTraceFlushOutcome, resetTraceIoQueue: reset } = await import('../prompts/prompt-trace-writer')
    reset()
    recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
    await flush()
    const outcome = lastTraceFlushOutcome()
    expect(outcome?.status).toBe('skipped')
    expect(outcome?.reason).toContain('生成作用域之外')
  })

  it('短定时器与作用域收尾命中同一作用域时只写一份文件', async () => {
    // 一轮命令里落盘会被触发两次：片段捕获后的 30ms 定时器 + 退出作用域前的收尾。
    // 内容没变时第二次必须跳过，否则每次生成都会留下两份重复文件。
    const { flushTraceNow } = await import('../prompts/prompt-trace-writer')
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-once', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
      await flushTraceNow()
    } finally { dispose() }
    expect(invoke.mock.calls.filter(([, channel]) => channel === 'fs:write-file')).toHaveLength(2)
  })

  it('收尾时若 IO 后到，则覆盖写一次以带上输出面', async () => {
    const { flushTraceNow } = await import('../prompts/prompt-trace-writer')
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-io-late', operation: 'chapter-draft', projectSession: session })
    try {
      // 片段先到，30ms 定时器先写一份"只有片段"的。
      recordFragments({ template: builtin(), variables: {}, built: 'x', writingLanguage: 'zh-CN' })
      await flush()
      // IO 后到，收尾时必须再写一次把输出面带上。
      recordTraceIo({ messages: [{ role: 'user', content: '写第1章' }], output: '第一章正文', finishReason: 'stop' })
      await flushTraceNow()
    } finally { dispose() }
    const writeCalls = invoke.mock.calls.filter(([, channel]) => channel === 'fs:write-file')
    const jsonCalls = writeCalls.filter(([, , path]) => String(path).endsWith('.json'))
    expect(jsonCalls).toHaveLength(2)
    const lastPayload = JSON.parse(jsonCalls[1][3] as string)
    expect(lastPayload.ioCalls[0].output).toBe('第一章正文')
  })

  it('一轮内多次 LLM 调用时写同一份文件，且每一次请求与输出都保留', async () => {
    // 回归（作者实测）：正文一轮会发多次请求（短纲 → 正文 → 续写）。
    // 旧实现把 IO 存成单值，后一次直接覆盖前一次 —— 文件里的"模型输出"只剩最后一次，
    // 中间的提示词与产出全部丢失，无从评估。现在必须按序全留。
    const { flushTraceNow } = await import('../prompts/prompt-trace-writer')
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-multi', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      await flush()
      recordTraceIo({ purpose: 'chapter-draft-short-outline', messages: [{ role: 'user', content: '第一跳：短纲' }], output: '短纲结果', finishReason: 'stop' })
      await flushTraceNow()
      recordTraceIo({ purpose: 'chapter-draft', messages: [{ role: 'user', content: '第二跳：正文' }], output: '正文结果', finishReason: 'stop' })
      await flushTraceNow()
      recordTraceIo({ purpose: 'chapter-draft-continuation', messages: [{ role: 'user', content: '第三跳：续写' }], output: '续写结果', finishReason: 'stop' })
      await flushTraceNow()
    } finally { dispose() }

    const writes = invoke.mock.calls.filter(([, channel]) => channel === 'fs:write-file')
    const mdPaths = writes.filter(([, , path]) => String(path).endsWith('.md')).map(([, , path]) => String(path))
    const jsonPaths = writes.filter(([, , path]) => String(path).endsWith('.json')).map(([, , path]) => String(path))
    // 文件名按作用域稳定：多次落盘（无 IO → 三次调用）都指向同一份文件。
    expect(new Set(mdPaths).size).toBe(1)
    expect(new Set(jsonPaths).size).toBe(1)

    const last = writes.filter(([, , path]) => String(path).endsWith('.json')).at(-1)
    const payload = JSON.parse(last?.[3] as string)
    expect(payload.ioCalls).toHaveLength(3)
    expect(payload.ioCalls.map((call: { purpose: string }) => call.purpose)).toEqual([
      'chapter-draft-short-outline', 'chapter-draft', 'chapter-draft-continuation',
    ])
    expect(payload.ioCalls.map((call: { output: string }) => call.output)).toEqual(['短纲结果', '正文结果', '续写结果'])

    // 人读面：三次请求与三次输出都必须出现（只留最后一次是不可接受的）。
    const md = writes.filter(([, , path]) => String(path).endsWith('.md')).at(-1)?.[3] as string
    expect(md).toContain('实际发出的请求与输出（3 次调用）')
    expect(md).toContain('第一跳：短纲')
    expect(md).toContain('第二跳：正文')
    expect(md).toContain('第三跳：续写')
    expect(md).toContain('短纲结果')
    expect(md).toContain('续写结果')
  })

  it('恰好一次调用且请求含该快照正文时，首屏直接用真实请求，不重复贴同一段提示词', async () => {
    const { flushTraceNow } = await import('../prompts/prompt-trace-writer')
    const dispose = pushTraceScope({ runHandle: 'proj/lease/run-single', operation: 'chapter-draft', projectSession: session })
    try {
      recordFragments({ template: builtin(), variables: {}, built: '组装结果', writingLanguage: 'zh-CN' })
      recordTraceIo({ purpose: 'chapter-draft', messages: [{ role: 'user', content: '前置材料\n\n组装结果\n\n后置合同' }], output: '唯一输出', finishReason: 'stop' })
      await flushTraceNow()
    } finally { dispose() }
    const md = invoke.mock.calls.filter(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.md')).at(-1)?.[3] as string
    // 请求只在首屏出现一次；下方只给输出，不重复整段请求。
    expect(md.match(/前置材料/g)).toHaveLength(1)
    expect(md).toContain('唯一输出')
    expect(md).toContain('其请求已在上方「拼装后的完整提示词」中逐字呈现')
  })

  it('唯一一次调用与该快照无关时（如只录到续写、快照是首次成稿）不得张冠李戴', async () => {
    // 回归：作者实测的正文一轮里，唯一录到的请求是「自动续写」，而快照是「首次成稿」。
    // 若仅凭"数量都是 1"就关联，首屏会把续写请求当成首次成稿的提示词 —— 直接误导调优。
    const { buildTraceMarkdown } = await import('../prompts/prompt-trace-markdown')
    const md = buildTraceMarkdown({
      operation: 'chapter-draft',
      writtenAt: 0,
      snapshots: [{ promptKey: 'first_chapter_draft', writingLanguage: 'zh-CN', capturedAt: 0, builtLength: 4, built: '首次成稿的组装正文', systemMessage: 's', fragments: [] }],
      ioCalls: [{ purpose: 'chapter-draft-continuation', messages: [{ role: 'user', content: '自动续写用的另一种提示词' }], output: '续写片段', finishReason: 'stop' }],
    })
    expect(md).toContain('按装配结果重建')
    expect(md).toContain('首次成稿的组装正文')
    // 真实请求仍要完整列出（它在下方"实际发出的请求与输出"里）。
    expect(md).toContain('实际发出的请求与输出（1 次调用）')
    expect(md).toContain('自动续写用的另一种提示词')
    expect(md).toContain('续写片段')
  })

  it('作用域收尾会释放该轮的内存态（不按 runKey 累积）', async () => {
    const { releaseTraceScopeState, flushTraceNow } = await import('../prompts/prompt-trace-writer')
    const scope = { runHandle: 'proj/lease/run-release', operation: 'chapter-draft', projectSession: session }
    const dispose = pushTraceScope(scope)
    try {
      recordTraceIo({ purpose: 'chapter-draft', messages: [{ role: 'user', content: 'A' }], output: 'a', finishReason: 'stop' })
      await flushTraceNow()
      releaseTraceScopeState(scope)
      // 释放后再记录时不应把上一轮的调用带进来。
      recordTraceIo({ purpose: 'chapter-draft-continuation', messages: [{ role: 'user', content: 'B' }], output: 'b', finishReason: 'stop' })
      await flushTraceNow()
    } finally { dispose() }
    const last = invoke.mock.calls.filter(([, channel, path]) => channel === 'fs:write-file' && String(path).endsWith('.json')).at(-1)
    const payload = JSON.parse(last?.[3] as string)
    expect(payload.ioCalls).toHaveLength(1)
    expect(payload.ioCalls[0].output).toBe('b')
  })
})
