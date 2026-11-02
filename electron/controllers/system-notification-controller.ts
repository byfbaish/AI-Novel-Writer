import { BrowserWindow, ipcMain, Notification } from 'electron'
import type { GlobalConfig } from '../../src/shared/ipc-channels'
import type {
  SystemNotificationPermission,
  SystemNotificationRequest,
  SystemNotificationRoute,
  SystemNotificationShowResult,
} from '../../src/shared/system-notification'
import { DEFAULT_GLOBAL_CONFIG, GLOBAL_CONFIG_PATH, readJsonFile } from '../utils/config-utils'

/**
 * 系统级通知 Controller（N1·§6）
 *
 * 只做三件事，别的都不做：
 * 1. **弹不弹**：总开关、聚焦抑制（作者盯着界面时弹 toast 是纯打扰）；
 * 2. **弹什么**：标题 + 正文，声音交给渲染侧（N2），所以这里恒 `silent: true`；
 * 3. **点了去哪**：把窗口拉回前台，再把 route 回推渲染进程，由 layout-store 执行跳转。
 *
 * 红线：不碰 `globalEventBus`、不碰 emit 点、不碰 DB schema。
 */

const ROUTES: readonly SystemNotificationRoute[] = ['ai-output', 'editor', 'characters']

/** 缺标题时的兜底名（与窗口标题同一套叫法）。 */
const FALLBACK_TITLE = 'AI Novel Writer'

function isRoute(value: unknown): value is SystemNotificationRoute {
  return typeof value === 'string' && (ROUTES as readonly string[]).includes(value)
}

/**
 * 逐字段收窄外部输入。IPC 参数来自渲染进程，不能信其形状：
 * 任何一个字段不合格就整条拒掉（宁可少弹一条，也不弹一条畸形通知）。
 */
function parseRequest(value: unknown): SystemNotificationRequest | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.body !== 'string' || raw.body.trim() === '') return null
  // route 传了但非法 ⇒ 拒绝。悄悄降级成不可点会让人以为「点了没反应」。
  if (raw.route !== undefined && !isRoute(raw.route)) return null
  const sound = raw.sound === 'complete' || raw.sound === 'error' ? raw.sound : undefined
  const title = typeof raw.title === 'string' && raw.title.trim() !== ''
    ? raw.title.trim()
    : FALLBACK_TITLE
  const coalesceKey = typeof raw.coalesceKey === 'string' && raw.coalesceKey.trim() !== ''
    ? raw.coalesceKey.trim()
    : undefined
  return { title, body: raw.body.trim(), sound, route: raw.route, coalesceKey }
}

/**
 * 合并抑制（N3·§4.3）：同 `coalesceKey` 在窗口期内只弹第一条。
 *
 * 与设计稿原文「只保留最后一条」的实现差异，理由要记在这里：
 * 「延后 3 秒再弹、期间替换」会让**单条**任务完成的反馈也迟到 3 秒 ——
 * 而绝大多数事件都是单条。提示类通知的价值在及时，同一 key 的正文差异
 * （章节号）也不值得为它牺牲及时性。所以取「窗口内首条即弹、后续丢弃」，
 * 效果上就是「3 秒内同类只弹一条」，这是 §4.3 的真实目的。
 */
const COALESCE_WINDOW_MS = 3_000
const lastShownAtByKey = new Map<string, number>()

function shownRecently(key: string, now: number): boolean {
  const last = lastShownAtByKey.get(key)
  return last !== undefined && now - last < COALESCE_WINDOW_MS
}

/** 记一次「真的弹了」。被抑制的不记 —— 否则切回前台后的第一条会被自己的抑制挡掉。 */
function rememberShown(key: string, now: number): void {
  lastShownAtByKey.set(key, now)
  // 键来自规则 id，数量本来有限；顺手清过期的，避免进程长跑时无界增长。
  for (const [candidate, at] of lastShownAtByKey) {
    if (now - at >= COALESCE_WINDOW_MS) lastShownAtByKey.delete(candidate)
  }
}

/**
 * 读全局配置决定抑制策略。
 *
 * 旧配置文件必然缺这两个新键（`readJsonFile` 不与默认值逐字段合并，见设计稿 §2），
 * 所以判据一律「宽容判断」：`=== false` 才算关、`!== false` 才算开。
 */
function readNotificationPolicy(): Pick<GlobalConfig, 'systemNotificationEnabled' | 'notificationOnlyWhenUnfocused'> {
  try {
    return readJsonFile<GlobalConfig>(GLOBAL_CONFIG_PATH, DEFAULT_GLOBAL_CONFIG)
  } catch (error) {
    // 全局数据根尚未就绪 / 文件不可读：按默认值（都开）处理，宁可弹一条也不要整条链路崩。
    console.warn('[SystemNotify] 读取通知配置失败，按默认策略处理:', error)
    return DEFAULT_GLOBAL_CONFIG
  }
}

/** 点击通知：窗口回前台 → 推送 route。窗口已销毁就什么都不做。 */
function focusAndActivate(win: BrowserWindow, route: SystemNotificationRoute | undefined): void {
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (!route || win.webContents.isDestroyed()) return
  win.webContents.send('system-notification:activated', { route })
}

/**
 * 发一条系统通知。同步完成：`Notification.show()` 不返回 Promise，
 * 包成 async 只会制造「看起来在等什么」的错觉。
 */
export function showSystemNotification(
  rawRequest: unknown,
  win: BrowserWindow | null,
): SystemNotificationShowResult {
  if (!Notification.isSupported()) return { shown: false, reason: 'unsupported' }
  if (!win || win.isDestroyed()) return { shown: false, reason: 'unsupported' }

  const request = parseRequest(rawRequest)
  if (!request) return { shown: false, reason: 'invalid-request' }

  const config = readNotificationPolicy()
  if (config.systemNotificationEnabled === false) return { shown: false, reason: 'suppressed-disabled' }

  const suppressWhenFocused = config.notificationOnlyWhenUnfocused !== false
  if (suppressWhenFocused && win.isFocused() && !win.isMinimized()) {
    return { shown: false, reason: 'suppressed-focused' }
  }

  // 合并判定放在聚焦抑制之后：前台被挡掉的请求不该占用窗口，
  // 否则作者切走后 3 秒内的第一条会被一条「其实没弹出去」的通知挡掉。
  const now = Date.now()
  if (request.coalesceKey && shownRecently(request.coalesceKey, now)) {
    return { shown: false, reason: 'suppressed-coalesced' }
  }

  const notification = new Notification({
    title: request.title,
    body: request.body,
    // 声音归渲染侧（N2 的 Web Audio 合成）。这里保持 silent，
    // 免得 OS 默认音和合成音一起响，音量/静音开关也就管不住了。
    silent: true,
  })
  notification.on('click', () => focusAndActivate(win, request.route))
  notification.show()
  if (request.coalesceKey) rememberShown(request.coalesceKey, now)
  return { shown: true }
}

export function registerSystemNotificationController(): void {
  ipcMain.handle('system-notification:show', async (event, request) => {
    return showSystemNotification(request, BrowserWindow.fromWebContents(event.sender))
  })

  // 必须是 handle 而不是 on：`ipcMain.on` 的返回值会被丢弃，
  // 渲染侧 await 一个永远不会来的结果，只能靠超时收场。
  ipcMain.handle('system-notification:permission', async (): Promise<SystemNotificationPermission> => {
    return Notification.isSupported() ? 'granted' : 'unsupported'
  })
}
