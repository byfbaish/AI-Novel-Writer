/**
 * SystemNotifyHub — 把「工作流完成 / 失败 / 定稿完成」翻译成系统级通知（N1 + N2）。
 *
 * 它只做转译与分发：订阅既有事件 → 跑规则 → 交主进程去弹，本地补一个提示音。
 * **绝不 emit**（红线：`WORKFLOW_COMPLETE` 的单一 emit 点是现有优良性质）；
 * **绝不改 emit 点**；也**不接管** App.tsx 里现有的应用内 toast ——
 * 那套是另一份设计稿（task-completion-notify-design.md），先留着。
 */

import { globalEventBus, type EventPayloadMap, type GlobalEventType } from '../../shared/event-bus'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import type {
  SystemNotificationRoute,
  SystemNotificationSound,
} from '../../shared/system-notification'
import {
  projectSessionContextFromProject,
  sameProjectSessionContext,
} from '../../shared/project-session-context'
import { useLayoutStore } from '../../stores/layout-store'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { useWorkflowStore, type WorkflowRun } from '../../stores/workflow-store'
import { ipc } from '../ipc-client'
import { BUILTIN_SYSTEM_NOTIFY_RULES, type SystemNotifyRule } from './rules'
import { DEFAULT_NOTIFICATION_SOUND_VOLUME, playSystemNotificationSound } from './sounds'

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

function isCurrentProjectSession(projectSession: ProjectSessionContext | undefined): boolean {
  return sameProjectSessionContext(
    projectSession,
    projectSessionContextFromProject(useProjectStore.getState().currentProject),
  )
}

/**
 * 声音策略是**设置项**，不是每次事件都要问一遍的东西：初始化时读一次，
 * 设置界面保存后调 `refreshSystemNotifySoundPolicy()` 刷新（静音立即生效）。
 * 每条通知都 `config:get` 一次，会在事件高峰时白白排队。
 */
interface SoundPolicy {
  enabled: boolean
  volume: number
}

const soundPolicy: SoundPolicy = { enabled: true, volume: DEFAULT_NOTIFICATION_SOUND_VOLUME }

/** 重新读声音配置。失败保留上一次的值 —— 不要因为读不到配置就把提示音弄哑。 */
export async function refreshSystemNotifySoundPolicy(): Promise<void> {
  try {
    const config = await ipc.invoke('config:get')
    soundPolicy.enabled = config.notificationSoundEnabled !== false
    soundPolicy.volume = typeof config.notificationSoundVolume === 'number'
      ? config.notificationSoundVolume
      : DEFAULT_NOTIFICATION_SOUND_VOLUME
  } catch {
    // 保持原值
  }
}

/**
 * 声音与弹窗**解耦**：窗口在前台时主进程会拒弹（`suppressed-focused`），
 * 但作者仍然需要「听见」任务结束 —— 设计稿 §5.4 的口径就是「前台时只播音、不弹通知」。
 * 所以这里不看弹窗结果，只看声音开关。
 */
function playSound(sound: SystemNotificationSound): void {
  if (!soundPolicy.enabled) return
  playSystemNotificationSound(sound, { volume: soundPolicy.volume })
}

/**
 * 跑一遍匹配的规则。
 *
 * 一个事件可能命中多条规则（各自独立产卡，与 App.tsx 现状的并行订阅语义一致）；
 * `stillCurrent` 用于「ipc 往返期间项目被切走」的中途复校验 —— 这是判据级细节，
 * 不能省（切了项目还往新会话弹旧任务的完成，是最容易被当成 bug 的那种）。
 */
async function dispatch(
  event: GlobalEventType,
  payload: unknown,
  run: WorkflowRun | null,
  stillCurrent?: () => boolean,
): Promise<void> {
  const text = useLocaleStore.getState().text
  for (const rule of rules) {
    if (!rule.events.includes(event)) continue
    const notification = rule.build(payload, { run, event, text })
    if (!notification) continue
    if (notification.sound) playSound(notification.sound)
    if (stillCurrent && !stillCurrent()) return
    await ipc.invoke('system-notification:show', { ...notification, coalesceKey: rule.id })
  }
}

async function handleWorkflowComplete(payload: EventPayloadMap['WORKFLOW_COMPLETE']): Promise<void> {
  // 事件自带启动时冻结的会话：同一个项目路径重开过之后，旧 run 的完成不许弹给新会话。
  if (!isCurrentProjectSession(payload.projectSession)) return

  const { activeRuns, history } = useWorkflowStore.getState()
  const run = activeRuns.find(candidate => candidate.id === payload.runId)
    ?? history.find(candidate => candidate.id === payload.runId)
  if (!run) return

  await dispatch('WORKFLOW_COMPLETE', payload, run, () => isCurrentProjectSession(payload.projectSession))
}

async function handleFinalizeComplete(payload: EventPayloadMap['FINALIZE_COMPLETE']): Promise<void> {
  // 定稿完成同样带冻结会话：同路径重开的新会话不该收到旧定稿的通知。
  if (!isCurrentProjectSession(payload.projectSession)) return
  await dispatch('FINALIZE_COMPLETE', payload, null, () => isCurrentProjectSession(payload.projectSession))
}

async function handleWorkflowError(payload: EventPayloadMap['WORKFLOW_ERROR']): Promise<void> {
  // 错误载荷里没有会话也没有 run（由 `AppLogger.error` 统一 emit，可能是启动期错误），
  // 所以这里不校验 —— 错过了这条，作者就完全不知道后台失败了。
  await dispatch('WORKFLOW_ERROR', payload, null)
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
  void refreshSystemNotifySoundPolicy()

  const guard = <T>(label: string, handler: (payload: T) => Promise<void>) => (payload: T): void => {
    void handler(payload).catch((error: unknown) => {
      console.warn(`[SystemNotify] 处理${label}事件失败:`, error)
    })
  }

  disposers.push(globalEventBus.on('WORKFLOW_COMPLETE', guard('工作流完成', handleWorkflowComplete)))
  disposers.push(globalEventBus.on('FINALIZE_COMPLETE', guard('定稿完成', handleFinalizeComplete)))
  disposers.push(globalEventBus.on('WORKFLOW_ERROR', guard('工作流失败', handleWorkflowError)))

  disposers.push(ipc.on('system-notification:activated', ({ route }) => {
    navigate(route)
  }))
}

/** 仅测试/热重载使用：摘掉全部订阅与规则。 */
export function disposeSystemNotifyHub(): void {
  while (disposers.length > 0) disposers.pop()?.()
  rules.length = 0
  soundPolicy.enabled = true
  soundPolicy.volume = DEFAULT_NOTIFICATION_SOUND_VOLUME
  initialized = false
}
