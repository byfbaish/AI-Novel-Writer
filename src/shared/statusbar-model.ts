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
