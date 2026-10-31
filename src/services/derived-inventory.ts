import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { DerivedInventory } from '../shared/invalidation-plan'
import { isProjectSessionCurrent } from '../components/project-session-gate'
import { ipc } from './ipc-client'

/**
 * 派生清点（S7）的读侧唯一实现。
 *
 * ## 为什么是三种状态，不是「一个 `DerivedInventory | null`」
 *
 * 三个失败面必须分开，否则作者会把「拿不到」读成「没问题」：
 *
 * - `missing`：库没开 / 版本表不存在（v24 之前的老项目）——「这本书还没有版本记录」；
 * - `unavailable`：请求抛了 ——「这次没读到，可以刷新重试」；
 * - `ok` 且 `groups.length === 0`：「确实没有需要处置的」。
 *
 * 折成 `null` 会让后两种一定被渲染成第一种，而 §9.2 的纪律正是
 * **不能把「不知道」显示成「0 项」**。
 *
 * ## 为什么失败不 throw
 *
 * 这个页面是**只读观察窗**，不是闸门：读不到就如实说读不到，让作者能继续干活。
 * 与 `readInvalidationPlan` 的 fail-open 同一条理由（那边更不能拦人，它挡在写入前）。
 *
 * 设计稿：[`docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md`](../../docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md) §四 S7
 */
export type DerivedInventoryRead =
  | { state: 'ok'; inventory: DerivedInventory }
  | { state: 'missing' }
  | { state: 'unavailable'; error?: string }

export async function readDerivedInventory(
  session: ProjectSessionContext | null,
): Promise<DerivedInventoryRead> {
  if (!session || !isProjectSessionCurrent(session)) return { state: 'unavailable' }
  try {
    const result = await ipc.invokeWithProjectSession(
      session,
      'db:derived-inventory',
      session.projectPath,
    )
    if (!isProjectSessionCurrent(session)) return { state: 'unavailable' }
    if (!result?.success) {
      return result?.missing ? { state: 'missing' } : { state: 'unavailable', error: result?.error }
    }
    // `success` 但没给 inventory：按「读不到」处理，**不要**造一份空清单。
    if (!result.inventory) return { state: 'unavailable' }
    return { state: 'ok', inventory: result.inventory }
  } catch (error) {
    return { state: 'unavailable', error: String(error) }
  }
}
