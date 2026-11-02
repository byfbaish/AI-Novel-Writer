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

import type { EventPayloadMap, GlobalEventType } from '../../shared/event-bus'
import type {
  SystemNotificationRoute,
  SystemNotificationSound,
} from '../../shared/system-notification'
import type { WorkflowRun } from '../../stores/workflow-store'

export interface SystemNotifyContext {
  /**
   * 本次事件对应的 run，**可能为 null**：只有 `WORKFLOW_COMPLETE` 能按 runId 查实。
   * `FINALIZE_COMPLETE` / `WORKFLOW_ERROR` 的载荷里没有 runId，硬造一个只会让
   * 规则误以为拿到了自己需要的东西。
   */
  run: WorkflowRun | null
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
    if (!run) return null
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

/**
 * 失败提示（N2·§5.2）。**与完成音区分开**：`error` 走下行三角波，听感明确，
 * 不必看屏幕也知道是坏消息。
 *
 * 正文必须带错误摘要：通知正文为空等于纯骚扰（契约里 `body` 必填）。但也只取
 * **第一行前 120 字** —— 完整栈在应用内的 AlertDialog 里，系统通知放全文会变成
 * 一块读不完的砖。
 */
const workflowErrorRule: SystemNotifyRule = {
  id: 'workflow-error',
  events: ['WORKFLOW_ERROR'],
  build(payload, { text }) {
    const error = payload as EventPayloadMap['WORKFLOW_ERROR'] | null
    const subject = typeof error?.title === 'string' ? error.title.trim() : ''
    if (!subject) return null
    const headline = text(`「${subject}」失败`, `“${subject}” failed`)
    const detail = summarizeError(error?.error)
    return {
      title: appTitle(text),
      body: detail ? `${headline}：${detail}` : headline,
      sound: 'error',
      // 失败链在应用内有 AlertDialog 强提示兜底，这里只是「你可能没在看窗口」时的辅助，
      // 落右栏 AI 输出（错误详情就在那儿），不抢编辑器焦点。
      route: 'ai-output',
    }
  },
}

/**
 * 定稿完成（N2·§5.2）。
 *
 * 为什么值得单独一条：定稿链会跑一长串后处理，作者常常切走干别的；等回来时
 * 章已经落定，却没有任何「好了」的痕迹。应用内的自动开下一章窗口一旦被关掉，
 * 这条就也没有了。
 */
const finalizeCompleteRule: SystemNotifyRule = {
  id: 'finalize-complete',
  events: ['FINALIZE_COMPLETE'],
  build(payload, { text }) {
    const finalization = payload as EventPayloadMap['FINALIZE_COMPLETE'] | null
    const chapterNumber = finalization?.chapterNumber
    if (typeof chapterNumber !== 'number' || !Number.isFinite(chapterNumber)) return null
    const chapterTitle = typeof finalization?.chapterTitle === 'string' ? finalization.chapterTitle.trim() : ''
    return {
      title: appTitle(text),
      body: chapterTitle
        ? text(`第${chapterNumber}章「${chapterTitle}」已定稿`, `Chapter ${chapterNumber} “${chapterTitle}” finalized`)
        : text(`第${chapterNumber}章已定稿`, `Chapter ${chapterNumber} finalized`),
      sound: 'complete',
      route: 'editor',
    }
  },
}

const MAX_ERROR_DETAIL = 120

/** 错误摘要：取第一行有内容的文本，过长截断。多行栈不进通知。 */
function summarizeError(error: unknown): string {
  if (typeof error !== 'string') return ''
  const firstLine = error.split('\n').map(line => line.trim()).find(line => line !== '')
  if (!firstLine) return ''
  return firstLine.length > MAX_ERROR_DETAIL ? `${firstLine.slice(0, MAX_ERROR_DETAIL)}…` : firstLine
}

/** 内置规则集（§5.2 三条全覆盖）。 */
export const BUILTIN_SYSTEM_NOTIFY_RULES: readonly SystemNotifyRule[] = [
  workflowCompleteRule,
  workflowErrorRule,
  finalizeCompleteRule,
]
