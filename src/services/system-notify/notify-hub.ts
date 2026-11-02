/**
 * SystemNotifyHub — 把「工作流完成」翻译成一条系统级通知（N1）。
 *
 * 它只做转译与分发：订阅既有事件 → 找 run → 跑规则 → 交给主进程去弹。
 * **绝不 emit**（红线：`WORKFLOW_COMPLETE` 的单一 emit 点是现有优良性质）；
 * **绝不改 emit 点**；也**不接管** App.tsx 里现有的应用内 toast ——
 * 那套是另一份设计稿（task-completion-notify-design.md），先留着。
 */

import { globalEventBus, type EventPayloadMap } from '../../shared/event-bus'
import type { SystemNotificationRoute } from '../../shared/system-notification'
import {
  projectSessionContextFromProject,
  sameProjectSessionContext,
} from '../../shared/project-session-context'
import { useLayoutStore } from '../../stores/layout-store'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { useWorkflowStore } from '../../stores/workflow-store'
import { ipc } from '../ipc-client'
import { BUILTIN_SYSTEM_NOTIFY_RULES, type SystemNotifyRule } from './rules'

const rules: SystemNotifyRule[] = []

/**
 * 注册一条规则（热插拔）。同 id 覆盖 —— 同场景换了文案不该并列两条。
 * 返回注销函数；注销时只摘自己那一份，避免把后来的同 id 规则一起带走。
 */
export function registerSystemNotifyRule(rule: SystemNotifyRule): () => void {
  const existing = rules.findIndex(candidate => candidate.id === rule.id)
  if (existing >= 0) rules[existing] = rule
  else rules.push(rule)
  return () => {
    const index = rules.findIndex(candidate => candidate === rule)
    if (index >= 0) rules.splice(index, 1)
  }
}

/** 通知被点击后的跳转。route 语义见 shared/system-notification.ts 顶部注释。 */
function navigate(route: SystemNotificationRoute): void {
  const layout = useLayoutStore.getState()
  switch (route) {
    case 'ai-output':
      layout.openRightPanel('ai-output')
      break
    case 'characters':
      layout.setSidebarView('characters')
      break
    case 'editor':
      // 故意什么都不做：窗口已经被主进程拉回前台了。
      // 自动打开产物文件会盖掉作者当前正在写的内容 —— 那是打断，不是帮助。
      break
  }
}

function isCurrentProjectSession(projectSession: EventPayloadMap['WORKFLOW_COMPLETE']['projectSession']): boolean {
  return sameProjectSessionContext(
    projectSession,
    projectSessionContextFromProject(useProjectStore.getState().currentProject),
  )
}

async function handleWorkflowComplete(payload: EventPayloadMap['WORKFLOW_COMPLETE']): Promise<void> {
  // 事件自带启动时冻结的会话：同一个项目路径重开过之后，旧 run 的完成不许弹给新会话。
  if (!isCurrentProjectSession(payload.projectSession)) return

  const { activeRuns, history } = useWorkflowStore.getState()
  const run = activeRuns.find(candidate => candidate.id === payload.runId)
    ?? history.find(candidate => candidate.id === payload.runId)
  if (!run) return

  const text = useLocaleStore.getState().text
  for (const rule of rules) {
    if (!rule.events.includes('WORKFLOW_COMPLETE')) continue
    const notification = rule.build(payload, { run, event: 'WORKFLOW_COMPLETE', text })
    if (!notification) continue
    // 上一条发出去可能已经过了一拍；切过项目就不再往下发。
    if (!isCurrentProjectSession(payload.projectSession)) return
    await ipc.invoke('system-notification:show', notification)
  }
}

let initialized = false
const disposers: Array<() => void> = []

/**
 * 启动通知中心。幂等：StrictMode 会把 App 的 effect 跑两次，这里只认第一次。
 * 生命周期与 App 一致（与 `initProjectService()` 同一套做法）。
 */
export function initSystemNotifyHub(): void {
  if (initialized) return
  initialized = true

  for (const rule of BUILTIN_SYSTEM_NOTIFY_RULES) registerSystemNotifyRule(rule)

  disposers.push(globalEventBus.on('WORKFLOW_COMPLETE', (payload) => {
    void handleWorkflowComplete(payload).catch((error: unknown) => {
      console.warn('[SystemNotify] 处理工作流完成事件失败:', error)
    })
  }))

  disposers.push(ipc.on('system-notification:activated', ({ route }) => {
    navigate(route)
  }))
}

/** 仅测试/热重载使用：摘掉全部订阅与规则。 */
export function disposeSystemNotifyHub(): void {
  while (disposers.length > 0) disposers.pop()?.()
  rules.length = 0
  initialized = false
}
