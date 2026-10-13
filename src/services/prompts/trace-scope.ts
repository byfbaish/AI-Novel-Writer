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
  /**
   * 本批覆盖的章节范围（由命令在**装配之前**显式声明，见 `declareTraceScopeChapterRange`）。
   *
   * 为什么需要显式声明：大纲链既没有 `chapterNumber`，模板变量里也没有 `n`/`m`——
   * 它唯一的章节号来源是**请求的 `purpose`**（`plot-outline:chapter:N`），而 `purpose`
   * 要等 IO 回传才拿到，首次落盘时还不存在。名字一旦钉住（`traceFileName`），
   * 章节段就永久丢了。命令在装配前把本批范围报出来即可补上。
   */
  chapterRange?: { from: number; to: number }
  /** 进入作用域的时刻，用于过滤环形缓冲里属于历史任务的快照。 */
  startedAt?: number
  /**
   * 首次落盘时钉住的文件名（由落盘器写入，作用域内只算一次）。
   *
   * 为什么必须钉住：文件名里的「章节段」是从"当前已收到的 ioCalls"现算的，而一次生成
   * 会多次落盘、ioCalls 逐次增多（大纲逐章生成：0 次 → `ch11` → `ch11-12`）。若每次重算，
   * 同一作用域会写出三份各不完整的文件（旧的不会被清掉）。钉住后只覆盖写同一份。
   */
  traceFileName?: string
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
 * 声明当前作用域覆盖的章节范围（只影响文件名里的「章节段」）。
 *
 * 为什么不作为 `pushTraceScope` 的参数：范围是**命令体内部**才算出来的
 * （大纲的 from/to 依赖断点检查点、已覆盖水位与总章数），`pushTraceScope` 时还不知道。
 *
 * 两条守卫：
 * - 无作用域 → 静默返回（追踪未开启，或该链路不在生成作用域内）；
 * - 名字已钉住（`traceFileName`）→ 不再改。否则"晚到的范围"会让同一作用域写出第二份文件，
 *   正是 2026-10-13 修掉的那类回归。所以调用方必须在**首次落盘之前**（即装配之前）声明。
 */
export function declareTraceScopeChapterRange(from: number, to: number): void {
  const scope = currentTraceScope()
  if (!scope || scope.traceFileName) return
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return
  scope.chapterRange = { from, to }
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
