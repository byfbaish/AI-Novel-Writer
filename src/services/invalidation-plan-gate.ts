import type { ProjectSessionContext } from '../shared/ipc-channels'
import { HYPOTHETICAL_NEXT_REV, type InvalidationPlan } from '../shared/invalidation-plan'
import type { UpstreamDomain } from '../shared/upstream-revisions'
import { isProjectSessionCurrent } from '../components/project-session-gate'
import { ipc } from './ipc-client'

/**
 * 重建前的失效清单：读侧的唯一实现（P2-3 期 3a）。
 *
 * ## 为什么单独抽一层
 *
 * 期 3a 有两个入口要问同一件事 —— `ArchFileViewer` 的「继续规划」和
 * `ArchitectureConfirmDialog` 的「确认生成」。两边各写一遍 IPC 调用本身不致命，
 * 致命的是**失败口径**：一处 fail-open、另一处 fail-closed，作者就会遇到
 * 「同一次重建，从这条路口进去能写、从那条进去写不了」。闸门存在的理由是把代价
 * 摆出来，不是用来挡人的 —— 这个判断只许有一个出处。
 *
 * ## 为什么失败一律返回 `null`（= 放行）
 *
 * 库没开、版本表不存在、请求抛了 —— 三种都不该让作者写不了字。调用方拿到 `null`
 * 就当作「无事可报」，直接发射。**不要在这里加 throw**：加了就等于把
 * 「清单拿不到」升级成「不能写」，这与主稿 §8.3「闸门不是门禁」相反。
 *
 * ## 假想版本号从哪来
 *
 * `HYPOTHETICAL_NEXT_REV`（= 0，handler 折算成 current + 1）。UI 手边没有读版本表的
 * 通道，而要问的正是「再改一版会怎样」——口径与理由见
 * [`docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md`](../../docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md) §六。
 */
export async function readInvalidationPlan(
  session: ProjectSessionContext | null,
  domain: UpstreamDomain,
): Promise<InvalidationPlan | null> {
  if (!session || !isProjectSessionCurrent(session)) return null
  try {
    const result = await ipc.invokeWithProjectSession(
      session,
      'db:invalidation-plan',
      { domain, rev: HYPOTHETICAL_NEXT_REV },
      session.projectPath,
    )
    return result?.success ? result.plan ?? null : null
  } catch {
    return null
  }
}
