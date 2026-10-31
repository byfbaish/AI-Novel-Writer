import type { InvalidationGroupKind } from '../shared/invalidation-plan'
import { describeDrift, parseUpstreamRefKey, type DerivedDrift } from '../shared/upstream-revisions'

/**
 * 失效清单/清点页共用的双语标签表（S7 抽出）。
 *
 * ## 为什么要抽出来
 *
 * 这两张表原来住在 `InvalidationPlanGatePanel.tsx` 里（模块私有）。S7 的清点页要显示
 * 同样的组名与域名 —— 复制一份就是第二处真相，而这类漂移**不会报错**：
 * 面板写「已定稿章节」、清点页写「定稿正文」，作者会以为是两件事。
 *
 * ## 为什么不放进 `src/shared`
 *
 * `src/shared` 是纯数据层（main / renderer 共用、可被主进程 import），UI 文案进去
 * 会让主进程也背上翻译表。这里是渲染层内部的共享常量。
 */
export type Locale = 'zh-CN' | 'en-US'

/** 组名（顺序无关，渲染顺序由 `plan.groups` 决定）。 */
export const INVALIDATION_GROUP_LABEL: Record<InvalidationGroupKind, [string, string]> = {
  // 期 3b 的中间环：世界观/弧光变了 ⇒ 先说大纲旧了，再由作者决定要不要重生成。
  outline: ['情节大纲', 'Outline'],
  blueprint: ['章节蓝图', 'Chapter blueprints'],
  handoff: ['卷末交接单', 'Volume handoffs'],
  'plot-tree': ['剧情树', 'Plot tree'],
  // S6 / M28：正文是这条链的末端消费者，排在最后与级联顺序一致。
  finalized: ['已定稿章节', 'Finalized chapters'],
}

/**
 * 域名的人类读法。
 *
 * **不复用 `describeDrift` 的中文**：这里要的是双语、可嵌进句子的短名。
 * 两处一旦有一处改域名，另一处不会报 —— 这种漂移只能靠 `_test` 钉。
 */
export const UPSTREAM_DOMAIN_LABEL: Record<string, [string, string]> = {
  worldbuilding: ['世界观', 'Worldbuilding'],
  arc: ['弧光', 'Arc'],
  outline: ['情节大纲', 'Outline'],
}

/** 域名短名。取不到就回落到键本身（不要编一个「未知域」）。 */
export function upstreamDomainLabel(key: string, locale: Locale): string {
  const domain = parseUpstreamRefKey(key)?.domain ?? key
  const pair = UPSTREAM_DOMAIN_LABEL[domain] ?? [domain, domain]
  return locale === 'en-US' ? pair[1] : pair[0]
}

/**
 * 「落后在哪」的一行话。
 *
 * - 中文走 `describeDrift`：带证据（哪几版、什么时候、改过哪几章）—— 这是 S4b / S6c
 *   两层溯源链的成果，**不要再降级成「情节大纲 3 → 5」**。
 * - 英文目前只有短名 + 版本号（`Outline 3→5`）。**已知边界**：英文侧没有证据句，
 *   因为 `describeDrift` 只产中文。要补齐得先给 `DriftChange` 写一套英文格式化，
 *   不在 S7 范围内 —— 但**不要**在英文侧编一句「some chapters changed」，
 *   那比不显示更没有信息量。
 */
export function describeDriftForLocale(behind: readonly DerivedDrift[], locale: Locale): string {
  if (locale !== 'en-US') return describeDrift(behind)
  return behind
    .map((drift) => `${upstreamDomainLabel(drift.key, locale)} ${drift.have}→${drift.need}`)
    .join(', ')
}
