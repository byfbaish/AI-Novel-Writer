import type { Locale } from '../i18n/types'

/**
 * D16：状态栏模型指示器读「实际调用事实源」，不读配置当前选中值。
 *
 * 事实源字段名已取证并写死在报告 §0：持久化在
 * `generation_runs.binding_json.sourceManifest.modelReceipt.{modelId,modelName}`
 * （主进程 `modelProjection()`），渲染期投影为 `llm:begin-execution-lease` 返回的
 * `ModelExecutionLeaseReceipt.{modelId,modelName}`。这里承载的是后者的渲染侧快照。
 */
export interface ActualCallModel {
  modelId: string
  modelName: string
}

/**
 * 有「实际调用模型」时一律显示它；只有尚无任何实际调用记录时，才退回配置选中值作空态兜底
 * （保持「未配置模型」语义，不打坏原来能用的显示）。配置为 `null` 时显示空态。
 */
export function resolveStatusbarModel(
  actual: ActualCallModel | null | undefined,
  configuredModelName: string | null | undefined,
): string | null {
  const executed = actual?.modelName?.trim()
  if (executed) return executed
  const configured = configuredModelName?.trim()
  return configured || null
}

/**
 * 状态栏模型来源。只有这两个值——「实际 / 配置」的措辞只在这里定义，
 * 别处不要自己拼，否则同一条状态栏会出现两套说法。
 */
export type StatusbarModelSource = 'actual' | 'configured'

/**
 * 状态栏模型段文案。
 *
 * 可见文本仍只有模型名（状态栏是常驻区域，不加前缀、不改颜色）；
 * 区分只做在 `title`（tooltip）里：作者排障时能分清「这是真调过的」还是「这只是配的」。
 * 这一层不改变视觉权重，D16 的验收值仍由 `resolveStatusbarModel` 决定。
 */
export function statusbarModelCopy(
  locale: Locale,
  name: string,
  source: StatusbarModelSource,
): { title: string; label: string } {
  if (locale === 'en-US') {
    return {
      title: source === 'actual' ? `Current model (actual): ${name}` : `Current model (configured): ${name}`,
      label: name,
    }
  }
  return {
    title: source === 'actual' ? `当前模型（实际调用）：${name}` : `当前模型（配置）：${name}`,
    label: name,
  }
}

// ===== 2026-11-22 作者裁定 C：常态显示默认模型，两者不同时并列 =====
//
// 为什么改：D16 定的「有实际调用就显示它」在实际使用里很迷惑——换了默认模型，
// 右下角仍停在上一轮跑过的那个模型，作者以为设置没生效（2026-11-22 报的 bug）。
// 作者选 C：常态显示默认模型；只有「实际调用 ≠ 默认」时才并列成 `默认A（实际 B）`，
// 两种情况都不再让人猜。
//
// `resolveStatusbarModel` / `statusbarModelCopy` 保留不动：D16 的验收单测仍在跑，
// 它们现在只作为「来源文案」的历史口径，StatusBar 不再调用。

/** 状态栏模型显示来源：仅配置 / 仅实际 / 两者并列。 */
export type StatusbarModelDisplaySource = 'configured' | 'actual' | 'both'

export interface StatusbarModelDisplay {
  /** 可见文本（状态栏只显示这一段） */
  label: string
  source: StatusbarModelDisplaySource
  configuredName: string | null
  actualName: string | null
  /** 配置与实际调用是否同一个模型（显示名相同即视为同一，避免「A（实际 A）」这种噪音） */
  same: boolean
}

/**
 * 状态栏模型段：常态显示配置（默认）模型；实际调用与配置不同时并列。
 * 只有一侧可用时显示那一侧；都没有时返回 null（调用方渲染「未配置模型」空态）。
 */
export function statusbarModelDisplay(
  actual: ActualCallModel | null | undefined,
  configuredModelName: string | null | undefined,
): StatusbarModelDisplay | null {
  const configured = configuredModelName?.trim() || null
  const executed = actual?.modelName?.trim() || null
  if (configured && executed) {
    const same = configured === executed
    return {
      label: same ? configured : `${configured}（实际 ${executed}）`,
      source: 'both',
      configuredName: configured,
      actualName: executed,
      same,
    }
  }
  if (configured) {
    return { label: configured, source: 'configured', configuredName: configured, actualName: null, same: false }
  }
  if (executed) {
    return { label: executed, source: 'actual', configuredName: null, actualName: executed, same: false }
  }
  return null
}

/**
 * 状态栏模型段 tooltip。可见文本只放模型名，来源分档放 title——
 * 常态是「（配置）」，并列时写清哪一个是实际调用。
 */
export function statusbarModelTitle(display: StatusbarModelDisplay, locale: Locale): string {
  const zh = locale !== 'en-US'
  if (display.source === 'both') {
    if (display.same) {
      return zh
        ? `当前模型：${display.label}（配置与实际调用一致）`
        : `Current model: ${display.label} (configured = actual)`
    }
    return zh
      ? `当前模型（配置）：${display.configuredName} ｜ 实际调用：${display.actualName}`
      : `Current model (configured): ${display.configuredName} | actual: ${display.actualName}`
  }
  if (display.source === 'actual') {
    return zh ? `当前模型（实际调用）：${display.label}` : `Current model (actual): ${display.label}`
  }
  return zh ? `当前模型（配置）：${display.label}` : `Current model (configured): ${display.label}`
}
