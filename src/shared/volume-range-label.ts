import type { VolumeRange } from './volume-structure'

type LocaleText = (zh: string, en: string) => string

/**
 * 卷区间的展示文案（唯一实现）。
 *
 * 形如「第41–60章 · 折算（已写 48）」，来源必须露出来，作者才知道能不能信。
 *
 * ## basis 四态（可信度从高到低，界面必须分开标）
 *
 * `actual`（该卷已标记写完，末章来自定稿章）→ 实际 / actual；`headings`（synopsis
 * 归属标题精确观测）→ 精确 / exact；`declared`（按大纲自报章数折算）→ 折算 / scaled；
 * `even`（按卷数均分，**估算**）→ 估算 / estimated。不许把 `even` 报成 `headings`。
 *
 * ## 「已写 N」只在进度落后于边界时出现（D19）
 *
 * D19 之后 `last` 是**计划边界**、`actualLast` 是**进度**，两者不再互相改写。只有
 * `actualLast !== null && actualLast !== last`（进度落后于边界）时才带出「已写 N」——
 * 否则「第7–10章 · 估算（已写 10）」既重复又误导：进度正好等于边界时不需要进度提示。
 */
export function formatVolumeRangeLabel(range: VolumeRange | undefined, text: LocaleText): string {
  if (!range) return text('—', '—')
  if (range.first === null || range.last === null) return text('起止未定', 'unresolved')
  const basis = range.basis === 'actual' ? text('实际', 'actual')
    : range.basis === 'headings' ? text('精确', 'exact')
      : range.basis === 'declared' ? text('折算', 'scaled')
        : text('估算', 'estimated')
  const progress = range.actualLast !== null && range.actualLast !== range.last
    ? text(`（已写 ${range.actualLast}）`, ` (written ${range.actualLast})`)
    : ''
  return text(
    `第${range.first}–${range.last}章 · ${basis}${progress}`,
    `ch ${range.first}–${range.last} · ${basis}${progress}`,
  )
}
