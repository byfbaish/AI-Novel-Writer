/**
 * 系统通知规则注册表（N1·§5.2）
 *
 * 一条规则 = 「哪类事件 → 弹什么文案 → 点它去哪」。新增场景只加规则，不改 Hub。
 * 规则**只描述通知本身**：弹不弹（总开关 / 聚焦抑制）由主进程按配置判定，
 * 规则里不重复一遍——两处判据迟早会分叉。
 *
 * 硬约束：`build` 必须同步。返回 Promise 会让 `if (!result)` 永远为假，
 * 最后把 Promise 当 payload 发出去（设计稿 §5.2 明确要求同步）。
 */

import type { GlobalEventType } from '../../shared/event-bus'
import type {
  SystemNotificationRoute,
  SystemNotificationSound,
} from '../../shared/system-notification'
import type { WorkflowRun } from '../../stores/workflow-store'

export interface SystemNotifyContext {
  run: WorkflowRun
  event: GlobalEventType
  /** 双语函数，与组件里用的是同一个 `text(zh, en)`。 */
  text: (zhCNText: string, enUSText: string) => string
}

export interface SystemNotifyPayload {
  title: string
  body: string
  sound?: SystemNotificationSound
  route?: SystemNotificationRoute
}

export interface SystemNotifyRule {
  /** 去重键。同 id 重复注册 = 后者覆盖（热替换）。 */
  id: string
  events: readonly GlobalEventType[]
  /** 返回 `null` = 这条不提示（静默跳过，不算失败）。 */
  build: (payload: unknown, ctx: SystemNotifyContext) => SystemNotifyPayload | null
}

function appTitle(text: SystemNotifyContext['text']): string {
  return text('AI小说作家', 'AI Novel Writer')
}

/**
 * `WORKFLOW_COMPLETE` 按 run.type 分流（设计稿 §5.2 分流表，作者 2026-10-17 裁定「可以」）。
 *
 * `batch_generate` 的「N 章」取不到：`WorkflowRun` 上没有章数字段，设计稿写明
 * 「取不到则退化为通用文案（不猜数据来源）」，所以这里不编数字。
 */
const workflowCompleteRule: SystemNotifyRule = {
  id: 'workflow-complete',
  events: ['WORKFLOW_COMPLETE'],
  build(_payload, { run, text }) {
    const subject = run.title.trim() || text('任务', 'Task')
    const completedBody = text(`「${subject}」已完成`, `“${subject}” completed`)
    switch (run.type) {
      case 'batch_generate':
        return {
          title: appTitle(text),
          body: text(`「${subject}」批量生成已完成`, `“${subject}” batch generation finished`),
          sound: 'complete',
          route: 'editor',
        }
      // 产物是编辑器里的东西：回前台即可，**不自动打开文件**（会盖掉作者正在写的那一章）。
      case 'chapter_creation':
      case 'architecture_generation':
      case 'directory':
      case 'novel_import':
        return { title: appTitle(text), body: completedBody, sound: 'complete', route: 'editor' }
      // 没有明确的编辑器产物：沿用现状落到右栏 AI 输出。
      case 'config_generation':
      case 'post_process':
      case 'new_project_setup':
        return { title: appTitle(text), body: completedBody, sound: 'complete', route: 'ai-output' }
      default:
        return null
    }
  },
}

/** N1 只上这一条；`workflow-error` / `finalize-complete` 属 N2。 */
export const BUILTIN_SYSTEM_NOTIFY_RULES: readonly SystemNotifyRule[] = [workflowCompleteRule]
