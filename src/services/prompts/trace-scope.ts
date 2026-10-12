/**
 * 追踪作用域：把"当前正在执行哪个生成任务"广播给同步的提示词装配链。
 *
 * 为什么需要它：`BasePromptBuilder.build()` 是同步纯函数，只能在调用栈里读环境，
 * 无法反向拿到工作流上下文。而 `executeWithGenerationRuntime` 是命令级唯一的
 * 执行作用域入口——在它内部设置、退出时恢复，就能让 build() 期间的任意深度的
 * 调用读取到本次任务的 runHandle。
 *
 * 不放进 `prompt-trace.ts` 是为了保持那个模块零依赖、可被主进程/单测单独引用；
 * 本模块同样零依赖（只用内置能力），因此两边都能安全引用。
 *
 * 栈式而非单值：允许未来出现嵌套作用域（如子阶段），退出时按 LIFO 恢复，避免
 * 外层作用域被内层意外清空。
 */

export interface TraceScope {
  /** `mainGenerationRunHandle` 的稳定字符串形式（`projectId/epoch/runId`）。 */
  runHandle?: string
  /** 本次任务的操作名（如 `chapter-draft`），仅用于落盘可读性。 */
  operation?: string
  /** 项目会话，落盘时需要（走 `fs:write-file` 的项目沙箱校验）。 */
  projectSession?: { projectId: string; leaseId: string; projectPath: string }
  /** 章节号等可读定位信息。 */
  chapterNumber?: number
  /** 进入作用域的时刻，用于过滤环形缓冲里属于历史任务的快照。 */
  startedAt?: number
}

const stack: TraceScope[] = []

/** 进入一个追踪作用域，返回退出函数（必须 try/finally 保证调用）。 */
export function pushTraceScope(scope: TraceScope): () => void {
  // 打上开始时刻，供落盘过滤历史快照；同一次 push 只记一次。
  if (scope.startedAt === undefined) scope.startedAt = Date.now()
  stack.push(scope)
  let popped = false
  return () => {
    if (popped) return
    popped = true
    const index = stack.lastIndexOf(scope)
    if (index >= 0) stack.splice(index, 1)
  }
}

/** 当前最内层作用域；无作用域时为 undefined。 */
export function currentTraceScope(): TraceScope | undefined {
  return stack.length > 0 ? stack[stack.length - 1] : undefined
}

/**
 * 作用域收尾钩子。
 *
 * 为什么需要它：落盘器（`prompt-trace-writer`）依赖 ipc-client 与 debug-store，
 * 属于渲染层；而本模块与 `base-command` 是零依赖的工作流核心。用注入而非直接
 * import，既能让命令在退出作用域前得到一个**确定时序**的落盘点，又不会把
 * 渲染层依赖拖进工作流分层（100+ 工作流测试跑在无 window 的 Node 环境）。
 *
 * 未注入时（纯逻辑测试/主进程）退化为 no-op。
 */
let scopeTeardownHook: (() => Promise<void> | void) | null = null

/** 注入作用域收尾钩子；传 null 撤销。 */
export function setTraceScopeTeardownHook(hook: (() => Promise<void> | void) | null): void {
  scopeTeardownHook = hook
}

/**
 * 在退出作用域前调用一次收尾钩子（落盘）。
 *
 * 必须在 `pushTraceScope` 返回的 dispose 之前调用：此刻该作用域仍在栈顶，
 * 落盘器能读到 runHandle/项目会话；同时命令的 IO 面已经就绪。
 */
export async function runTraceScopeTeardown(): Promise<void> {
  if (!scopeTeardownHook) return
  try {
    await scopeTeardownHook()
  } catch {
    /* 追踪是旁路：收尾失败绝不影响生成结果。 */
  }
}

/** 仅用于测试：清空作用域栈。 */
export function resetTraceScope(): void {
  stack.length = 0
}
