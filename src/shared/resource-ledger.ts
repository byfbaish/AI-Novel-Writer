/** W6 资源账本的跨进程契约（主进程仓储 / IPC / 渲染层共用）。
 *
 * 只放「形状」，不放算术：余额、中断判定属于纯函数层（设计稿 §5.3），不在这里。
 */

/** 一条资源定义（`resources`）。`resource_id` 是稳定键，永不复用。 */
export interface ResourceDefinition {
  resourceId: string
  /** 资源族：同族多品阶共享（如「灵石」）；单例资源为 null。 */
  familyId: string | null
  name: string
  tier: number
  unit: string
  /** 换算锚；null = 不可通兑。**不是 0** —— 0 会被读成「免费兑换」。 */
  anchorValue: number | null
  period: string
  earnNote: string
  costNote: string
  /** W4b 的「设计意图栏」：仅展示、不参与算术（判据 DL）。 */
  scarcityNote: string
  anchorNote: string
  createdAt: string
  updatedAt: string
}

/** 作者登记/修改时的入参；`resourceId` 缺省表示新建。 */
export interface ResourceDefinitionInput {
  resourceId?: string
  familyId?: string | null
  name: string
  tier?: number
  unit: string
  anchorValue?: number | null
  period: string
  earnNote?: string
  costNote?: string
  scarcityNote?: string
  anchorNote?: string
}

export type ResourceMovementSource = 'finalized-extract' | 'author'

/** 一条逐章变动（`resource_movements`）。`chapter_number=0` 专表开篇起点。 */
export interface ResourceMovement {
  id: number
  chapterNumber: number
  resourceId: string
  delta: number
  /** 记账当时的单位快照；与 `resources.unit` 不一致即显式冲突，不静默合并。 */
  unit: string
  evidence: string
  source: ResourceMovementSource
  createdAt: string
}

/** 写入一条变动。`unit` 缺省时取写库当刻的 `resources.unit`（快照语义）。 */
export interface ResourceMovementInput {
  resourceId: string
  delta: number
  unit?: string
  evidence: string
}

export type ResourceWriteResult =
  | { success: true; resourceId: string }
  | { success: false; error: string }

export type ResourceDeleteResult =
  | { success: true }
  /** 已有账本行时拒绝删除，且**不级联**清历史（外键 ON DELETE RESTRICT 的第二道保险）。 */
  | { success: false; error: string; movementCount?: number }

export type ResourceMovementReplaceResult =
  | { success: true; inserted: number }
  | { success: false; error: string }
