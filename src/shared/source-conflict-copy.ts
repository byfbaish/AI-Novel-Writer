import type { Locale } from '../i18n/types'

/**
 * D4：来源冲突的两层并列后果，唯一事实源。
 *
 * 同一份 `sourceStatus='conflict'` 驱动三处文案：
 * - 产物层（面板）：这一稿不能保存，仍可复制；
 * - 产物层（内联气泡）：这一稿不能保存，请重新选中后再试（气泡无复制控件，故不承诺复制）；
 * - 批次层：后续单元不再执行，需重新发起（**只在批次确实已停止时出现**，条件来自真实批状态）。
 *
 * 这里只产出文案，不改生成判定逻辑、不新增交互范式。
 */
export type SourceConflictStatus = 'current' | 'conflict'

export interface SourceConflictCopy {
  /** 产物层（输出面板用）：这一稿不能保存，仍可复制。面板卡片内有复制按钮，语义成立。 */
  output: string
  /**
   * 产物层（编辑器内联气泡用）：同一后果，但**不承诺复制**。
   * 内联气泡只有单条错误槽位、没有复制控件（替换按钮此时还是 disabled），
   * 因此不能复用 `output` 那句「仍可复制」——那是在承诺一个界面里做不到的动作。
   */
  outputInline: string
  /** 批次层（不带章号的通用版）：后续单元不再执行，需重新发起。只在批次确实已停止时出现，见 `sourceConflictBatchLayer`。 */
  batch: string
}

function batchLayerText(locale: Locale, chapterNumber: number | null): string {
  if (locale === 'en-US') {
    return chapterNumber === null
      ? 'This batch has stopped: later units will not run. Start a new batch to continue.'
      : `This batch has stopped: later units will not run. Start a new batch from Chapter ${chapterNumber}.`
  }
  return chapterNumber === null
    ? '本批已停止：后续单元不再执行，需重新发起本批。'
    : `本批已停止：后续单元不再执行，需从第${chapterNumber}章重新发起本批。`
}

/**
 * D4 批次层文案：**只在批次确实已停止时**使用。
 *
 * 「批次确实已停止」由 `evaluateBatchRecoveryGate({ batch, rootRunStatus }).terminated`
 * 判定（root run 终态 ∈ failed/cancelled/aborted），**不能**用 `sourceStatus === 'conflict'`
 * 代替——单稿来源冲突不代表整批停了，拿前者当条件会把「整批已停」误报到只坏了一稿的场景。
 *
 * `chapterNumber` 是 `gate.wayOut.chapterNumber`（这一批停在哪、要从哪章重开）；
 * 取不到时退回不带章号的版本，不编造章号。
 */
export function sourceConflictBatchLayer(locale: Locale, chapterNumber: number | null = null): string {
  return batchLayerText(locale, chapterNumber)
}

export function sourceConflictCopy(locale: Locale, status: SourceConflictStatus): SourceConflictCopy | null {
  if (status !== 'conflict') return null
  return locale === 'en-US'
    ? {
        output: 'Sources changed: this draft cannot be saved, but can still be copied.',
        outputInline: 'Sources changed: this draft cannot be saved. Select the text again and retry.',
        batch: batchLayerText('en-US', null),
      }
    : {
        output: '来源已变化：这一稿不能保存，仍可复制。',
        outputInline: '来源已变化：这一稿不能保存，请重新选中后再试。',
        batch: batchLayerText('zh-CN', null),
      }
}

/**
 * 原 `sourceConflictNoticeText()`（把两条并列文案拼进单条字符串）已于 2026-11-11 删除。
 *
 * 它唯一的消费者是编辑器内联气泡的 `setAiError`，而那正是不该出现批次层文案的位置：
 * 内联是单次调用，没有「后续单元」，拼进去等于把批次语义搬进没有批次的场景。
 * 内联改调 `sourceConflictCopy(...).outputInline` 后，该函数已无生产调用点，留作死代码会
 * 让「同一后果两套拼法」并存，故整体移除。
 *
 * 迁移导航：历史证据稿（`docs/handoffs/2026-11-11-night-evidence/*.md`、`scripts/night/20261111/*.md`）
 * 里仍按旧行号引用本函数名——那是当晚的现场记录，按「历史不改写」保留原样。要查当时的实现，
 * 用 `git show 90770846^:src/shared/source-conflict-copy.ts`；当前口径以本文件为准。
 */
