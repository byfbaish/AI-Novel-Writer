/**
 * 系统级通知的跨进程契约（N1）。
 *
 * 分工：主进程负责「弹不弹、点了回哪儿」（OS toast 只能主进程发）；
 * 渲染进程只描述「通知什么、点它去哪」。
 * 设计稿：docs/design/features/system-notification-design.md §5.1
 */

/** 完成音 / 失败音。N1 只透传，声音由渲染侧合成播放（N2）。 */
export type SystemNotificationSound = 'complete' | 'error'

/**
 * 点击通知后的跳转意图。
 * - `ai-output`：打开右栏 AI 输出（沿用 App.tsx 现有行为）；
 * - `characters`：切到左栏角色；
 * - `editor`：**只回前台，不自动打开产物文件** —— 自动开文件会覆盖作者当前内容。
 */
export type SystemNotificationRoute = 'ai-output' | 'editor' | 'characters'

/** 没弹出去的原因（`shown: false` 时必有，便于调用方/日志判定）。 */
export type SystemNotificationSuppressionReason =
  /** 平台不支持（如 Linux 无 notify 服务）。 */
  | 'unsupported'
  /** 通知总开关关着（`config.systemNotificationEnabled === false`）。 */
  | 'suppressed-disabled'
  /** 窗口正在前台（`config.notificationOnlyWhenUnfocused !== false` 时才判）。 */
  | 'suppressed-focused'
  /** 同类通知刚弹过（`coalesceKey` 命中合并窗口）。 */
  | 'suppressed-coalesced'
  /** 请求体不合法：缺正文 / 字段类型不对 / 非法 route。 */
  | 'invalid-request'

export interface SystemNotificationRequest {
  /** 通知标题（OS 通知左上角那行）。缺省由主进程兜底。 */
  title: string
  /** 通知正文。**必填** —— 空正文的通知等于纯骚扰。 */
  body: string
  sound?: SystemNotificationSound
  route?: SystemNotificationRoute
  /**
   * 合并抑制键（N3·§4.3）。同 key 在窗口期内只弹第一条。
   * 规则 id 就是这个 key —— 同一类通知短时间连发时，作者要的是「这事成了」，
   * 不是逐条播报。不传则不合并。
   */
  coalesceKey?: string
}

export type SystemNotificationShowResult =
  | { shown: true }
  | { shown: false; reason: SystemNotificationSuppressionReason }

/**
 * 通知授权状态（macOS 用得上）。
 *
 * ⚠️ 实现说明：Electron 41 主进程只剩 `Notification.isSupported()`，
 * 没有可用的授权查询 API（`systemPreferences.getNotificationSettings` 未随该版本提供）。
 * 所以当前只能区分 `granted` / `unsupported`；`denied` / `default` 留在契约里，
 * 等有可靠读回手段时再填 —— 不靠猜。
 */
export type SystemNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export interface SystemNotificationChannels {
  'system-notification:show': {
    args: [request: SystemNotificationRequest]
    return: SystemNotificationShowResult
  }
  'system-notification:permission': {
    args: []
    return: SystemNotificationPermission
  }
}

export interface SystemNotificationEvents {
  /** 通知被点击、窗口已回到前台之后由主进程推送。 */
  'system-notification:activated': { route: SystemNotificationRoute }
}
