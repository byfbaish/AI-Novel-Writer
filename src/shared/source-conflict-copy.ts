import type { Locale } from '../i18n/types'

/**
 * D4：来源冲突的两层并列后果，唯一事实源。
 *
 * 同一份 `sourceStatus='conflict'` 要同时驱动两条文案：
 * - 产物层：这一稿不能保存，仍可复制（「仅可复制」语义不能丢）；
 * - 批次层：后续单元不再执行，需重新发起。
 *
 * 这里只产出文案，不改生成判定逻辑、不新增交互范式。
 */
export type SourceConflictStatus = 'current' | 'conflict'

export interface SourceConflictCopy {
  /** 产物层：这一稿不能保存，仍可复制。 */
  output: string
  /** 批次层：后续单元不再执行，需重新发起。 */
  batch: string
}

export function sourceConflictCopy(locale: Locale, status: SourceConflictStatus): SourceConflictCopy | null {
  if (status !== 'conflict') return null
  return locale === 'en-US'
    ? {
        output: 'Sources changed: this draft cannot be saved, but can still be copied.',
        batch: 'Sources changed: later units will not run. Start a new task to continue.',
      }
    : {
        output: '来源已变化：这一稿不能保存，仍可复制。',
        batch: '来源已变化：后续单元不再执行，需重新发起。',
      }
}

/**
 * 给只能承载单条字符串的提示位（例如错误态 `setAiError`）用：
 * 两条并列文案拼进同一条提示，保证「冲突态下两条语义同时出现」。
 */
export function sourceConflictNoticeText(locale: Locale, status: SourceConflictStatus): string | null {
  const copy = sourceConflictCopy(locale, status)
  return copy ? `${copy.output} ${copy.batch}` : null
}
