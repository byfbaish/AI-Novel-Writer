import type { DraftEditStatRow } from '../../shared/ipc-channels'

export type DraftEditMetricInput = Pick<DraftEditStatRow, 'origin' | 'changed_chars' | 'new_chars'>

export interface DraftEditMetricsSummary {
  /** 该草稿的全部计量行数。 */
  saveCount: number
  /** 只算作者本人产生实际改动的保存；AI 修稿与空保存都不算。 */
  authorActions: number
  /** 作者改动字数 / 作者产出字数 × 1000，保留 1 位；分母为 0 时显示「—」。 */
  changedPerKChars: string
}

/**
 * 审稿报告顶部「本章编辑计量」的唯一口径入口。
 *
 * 保存次数包含 AI 行；作者动作与千字改动都只看 `origin === 'human'`。
 * 千字改动的分母是作者行的 `new_chars` 之和，不是旧正文长度。
 */
export function summarizeDraftEditMetrics(rows: readonly DraftEditMetricInput[]): DraftEditMetricsSummary {
  const humanRows = rows.filter(row => row.origin === 'human')
  const authorActions = humanRows.filter(row => row.changed_chars > 0).length
  const changedChars = humanRows.reduce((sum, row) => sum + row.changed_chars, 0)
  const newChars = humanRows.reduce((sum, row) => sum + row.new_chars, 0)
  const changedPerKChars = newChars > 0
    ? (changedChars / newChars * 1000).toFixed(1)
    : '—'
  return {
    saveCount: rows.length,
    authorActions,
    changedPerKChars,
  }
}
