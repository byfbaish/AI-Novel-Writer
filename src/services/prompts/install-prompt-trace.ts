import { configurePromptTrace, isPromptTraceEnabled, setSnapshotSink } from './prompt-trace'
import { currentTraceScope, setTraceScopeTeardownHook } from './trace-scope'
import { noteTraceCapture, recordTraceIo, scheduleTraceFlush, flushTraceNow, releaseTraceScopeState } from './prompt-trace-writer'
import { setHarnessIoObserver } from '../generation/generation-harness'
import { setMainTaskIoObserver } from '../generation/generation-runtime'
import { useDebugStore } from '../../stores/debug-store'
import { promptCatalog } from '../prompt-templates'
import { getActiveProjectSessionContext } from '../../shared/project-session-context'

/**
 * 把 Prompt 片段追踪接到渲染层的 `debug-store` 开关上。
 *
 * 必须在应用启动、任何生成发生之前调用一次（`main.tsx`）。
 * 分开成独立文件是为了让 `prompt-trace` 保持零依赖（可被主进程/测试单独引用），
 * 只在这里引入 store 与 catalog（渲染层专属依赖）。
 *
 * 追踪关闭时 `recordFragments` 首行短路，本装配不会带来运行时开销。
 */
export function installPromptTraceFromDebugStore(): void {
  configurePromptTrace({
    enabled: () => useDebugStore.getState().promptTraceEnabled,
    // 由 `executeWithGenerationRuntime` 通过 trace-scope 在命令执行期内注入。
    runHandle: () => currentTraceScope()?.runHandle,
    hasProjectSession: () => !!currentTraceScope()?.projectSession,
    resolveSource: (key) => {
      try {
        return promptCatalog.peek(key, getActiveProjectSessionContext() ?? undefined)?.source ?? 'builtin'
      } catch {
        return 'builtin'
      }
    },
  })
  // 每捕获一块就安排一次落盘，并累加计数供面板回显「这一轮到底抓到没有」。
  setSnapshotSink(() => {
    noteTraceCapture()
    scheduleTraceFlush()
  })
  // 命令退出作用域前的**确定时序**落盘点：不依赖 30ms 定时器是否被调度到，
  // 只要走过生成运行时（`executeWithGenerationRuntime` 或自建 runtime 的命令）就一定
  // 有一次落盘尝试（含 skipped 回显）。追踪关闭时直接返回，保持零开销。
  // 落盘后释放该作用域的内存态：`pendingIo` 需要跨多次请求累积（不能每次落盘就清），
  // 但作用域结束后必须回收，否则长会话会按 runKey 一直攒着。
  setTraceScopeTeardownHook(async () => {
    try {
      if (isPromptTraceEnabled()) await flushTraceNow()
    } finally {
      releaseTraceScopeState()
    }
  })
  // 抓取真实发出的 messages 与模型输出，与片段快照按 runHandle 归并。
  // 两个观察点互补，覆盖全部执行位置：
  // ① harness：渲染层**本地执行**的生成（architecture 等）；
  // ② main transport：**主进程代跑**的生成（正文等 main-owned），其请求不经本地 harness。
  // 一轮可能发多次请求（短纲 → 正文 → 续写），`purpose` 用于逐次区分，落盘时全部保留。
  const captureIo = (observation: { purpose: string; messages: ReadonlyArray<{ role: string; content: string }>; output: string; finishReason: string }) => {
    if (!isPromptTraceEnabled()) return
    recordTraceIo({
      purpose: observation.purpose,
      messages: [...observation.messages],
      output: observation.output,
      finishReason: observation.finishReason,
    })
  }
  setHarnessIoObserver(captureIo)
  setMainTaskIoObserver(captureIo)
}
