/**
 * 变量投影元数据（P1-3′ 可观测性，2026-10-16）。
 *
 * 设计依据：`docs/design/p1-3-variable-export-scoping-design.md`（§6 附录 D 的 `projection` 元数据）。
 *
 * ## 为什么需要它
 *
 * P0/P1 系列引入了一批「投影」函数（`projectArchitectureForDraft` / `buildBoundaryNotice` /
 * `withSpaceConstraints` / `projectScopedText` 等），它们在**变量值进入 prompt 之前**改写它。
 * 改写本身不留痕迹：trace 只能看到「最终 built」与「变量出口」，看不到「这一步为什么带 / 不带这段」。
 * 作者排查时因此常陷入「过了一天都不知道哪里少了东西」（上级稿原话）。
 *
 * ## 做什么 / 不做什么
 *
 * 只**记录**投影的输入输出口径、供 trace 呈现，**不改任何请求内容**（纯诊断，零行为变更）。
 * 记录是「尽力而为」：追踪关闭时不登记；登记失败绝不影响投影结果与生成流程。
 *
 * ## 与「唯一注入入口 = 改写变量值」的关系
 *
 * 本模块只描述**已被改写**这件事，不参与改写；投影仍各自改写变量值（红线 8-1 / 红线 3 的既有范式）。
 */
export interface PromptProjectionNote {
  /** 被投影的变量名（如 `architecture` / `future_blueprints`）。 */
  variable: string
  /** 投影种类标签（稳定标识，供人读与将来过滤）。 */
  kind: PromptProjectionKind
  /** 投影前字符数（**该投影函数所见输入**的字符数，口径由 `kind` 说明）。 */
  beforeChars: number
  /** 投影后字符数。 */
  afterChars: number
  /** 被整段移除 / 边界化的块标题（无则空数组）。 */
  droppedSections: string[]
}

/**
 * 已知投影种类。
 *
 * - `far-term-section-collapse`：`projectArchitectureForDraft` —— 把 `architecture` 里
 *   整节远期的设定段（§3【隐喻与深层危机】）压成「标题 + 一行声明」。`beforeChars` = 原始变量值长度。
 * - `future-plan-boundary-notice`：`buildBoundaryNotice` —— 把后续蓝图 `keyEvents` 逐字全文
 *   收敛为「本章不可写事件」要点清单。`beforeChars` = **输入事件文本**逐字总长（不含章标题行）。
 */
export type PromptProjectionKind =
  | 'far-term-section-collapse'
  | 'future-plan-boundary-notice'
