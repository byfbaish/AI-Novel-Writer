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

/** 状态栏模型段的 zh/en 文案（纯函数，便于单测钉「双语不串」）。 */
export function statusbarModelCopy(locale: Locale, name: string): { title: string; label: string } {
  return locale === 'en-US'
    ? { title: `Current model: ${name}`, label: name }
    : { title: `当前模型：${name}`, label: name }
}
