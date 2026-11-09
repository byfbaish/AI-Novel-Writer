/**
 * SYSTEM_NOTICE → 应用内 toast（D10 清空回执落地，2026-11-09 立项、2026-11-10 实施）。
 *
 * 为什么订阅方在服务层、由 App 顶层 effect 拉起，而不是放进某个页面 / 面板组件：
 * 清空入口有两处 —— 侧栏项目树里的「清除项目生成内容」对话框
 * （`components/panels/sidebar/ProjectTree.tsx`）与编辑器「清除误导入正文」恢复路径
 * （`components/editor/ChapterCardEditor.tsx`，直接调 clearProjectData）。而侧栏是视图切换式
 * 挂载（`components/panels/Sidebar.tsx`：`{sidebarView === 'project' && <ProjectTree />}`），
 * 组件级 useEffect 订阅会随视图卸载一起消失，另一条入口触发清空时就又没有订阅者 ——
 * 正是本项要修的那个病。放到窗口生命周期即两处都覆盖。
 *
 * 边界（作者 2026-11-09 裁定 + 2026-11-10「按豆包推荐来」）：
 * - 只消费、不 emit；不改 payload（仍只有 level + message）、不加项目身份，
 *   不新造项目隔离机制。数据层本身不串：clearProjectData 在 emit 之前已复核 lease
 *   （会话切走会 early return，不发回执），只剩「emit 后一帧内切项目」这一个可忽略窗口。
 * - 复用 `components/ui/Toast.tsx` 的门面，不新增组件、不改 ActionToast。
 * - 四档 level 全映射。代价是 `services/project-service.ts` 里 `level: 'error'` 的后台刷新
 *   失败也会弹红 toast（本次范围内的唯一一处非回执生产 emit）。若将来 AppLogger.error 有了
 *   调用点，它会同时走 `WORKFLOW_ERROR` 的 OS 通知与这里的 toast —— 两条通道职责不同
 *   （系统级提醒 vs 应用内提示），属有意保留。
 *
 * 触发链：`project-clear-service.ts` 的 `AppLogger.info(receipt.lines.join(' '))`
 * ⇒ 本模块 ⇒ 右下角**一条** toast。三段回执是**一条**消息里的三行文本，不拆三条。
 */
import { globalEventBus } from '../shared/event-bus'
import { toast } from '../components/ui/Toast'

/** 回执三行数字给 6s 读完；其余档沿用 Toast.tsx 门面自带的默认时长。 */
const INFO_DURATION_MS = 6000

/** 订阅 SYSTEM_NOTICE 并转成应用内 toast；返回解绑函数（由 App 顶层 effect 的 cleanup 调用）。 */
export function initSystemNoticeToast(): () => void {
  return globalEventBus.on('SYSTEM_NOTICE', ({ level, message }) => {
    switch (level) {
      case 'success':
        toast.success(message)
        return
      case 'warn':
        toast.warning(message)
        return
      case 'error':
        toast.error(message)
        return
      case 'info':
      default:
        toast.info(message, INFO_DURATION_MS)
    }
  })
}
