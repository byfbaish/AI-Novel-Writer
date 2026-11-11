import type { Locale } from '../i18n/types'

/**
 * D4：来源冲突的两层并列后果，唯一事实源。
 *
 * 同一份 `sourceStatus='conflict'` 驱动三处文案：
 * - 产物层（面板）：这一稿不能保存，仍可复制；
 * - 产物层（内联气泡）：这一稿不能保存，请重新选中后再试（气泡无复制控件，故不承诺复制）；
 * - 批次层：后续单元不再执行，需重新发起（只在真有批次语义的位置出现）。
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
  /** 批次层：后续单元不再执行，需重新发起。只在真有批次语义的位置出现。 */
  batch: string
}

export function sourceConflictCopy(locale: Locale, status: SourceConflictStatus): SourceConflictCopy | null {
  if (status !== 'conflict') return null
  return locale === 'en-US'
    ? {
        output: 'Sources changed: this draft cannot be saved, but can still be copied.',
        outputInline: 'Sources changed: this draft cannot be saved. Select the text again and retry.',
        batch: 'Sources changed: later units will not run. Start a new task to continue.',
      }
    : {
        output: '来源已变化：这一稿不能保存，仍可复制。',
        outputInline: '来源已变化：这一稿不能保存，请重新选中后再试。',
        batch: '来源已变化：后续单元不再执行，需重新发起。',
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
