/**
 * 工作流守卫错误：项目已切换、工作流已取消、缺少冻结项目会话等。
 *
 * 为什么需要单独的类：这类错误的 message **由本项目自己撰写**，不含任何凭据，
 * 是可以安全回显给作者用来定位问题的（"一次请求都没发出就失败"这类症状尤其需要它）。
 * 而 provider / session 抛出的任意错误可能内嵌 API Key，必须保持隐藏——见
 * `structured-batch-executor` 的「不泄漏意外会话错误消息」用例。
 *
 * 用显式标记（而不是 `instanceof`）做判别，是为了让跨 Electron IPC / 打包边界后
 * 丢失类身份的同类错误仍能被识别出来。
 */
export class WorkflowGuardError extends Error {
  readonly workflowGuard = true

  constructor(message: string) {
    super(message)
    this.name = 'WorkflowGuardError'
  }
}

export function isWorkflowGuardError(error: unknown): error is WorkflowGuardError {
  return Boolean(error) && (error as { workflowGuard?: unknown }).workflowGuard === true
}
