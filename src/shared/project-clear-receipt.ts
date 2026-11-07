import type { Locale } from '../i18n/types'
import type { ProjectClearCounts } from './ipc-channels'

/**
 * D10 清空回执：三档（故事架构 / 章节规划 / 正文与审稿）「各清了几类、各多少条」。
 * `counts` 由主进程在清空事务前后逐表 `COUNT(*)` 作差得到（= DB 实际删除行数），
 * `lines` 是按语种渲染好的三行文案；回执计数与 DB 删除计数同源，不另算、不硬编码。
 */
export interface ProjectClearReceipt {
  counts: ProjectClearCounts
  lines: string[]
}

export const PROJECT_CLEAR_SCOPES = ['creativeFields', 'blueprints', 'generatedText'] as const

const LABELS: Record<(typeof PROJECT_CLEAR_SCOPES)[number], { zh: string; en: string }> = {
  creativeFields: { zh: '故事架构', en: 'Story architecture' },
  blueprints: { zh: '章节规划', en: 'Chapter planning' },
  generatedText: { zh: '正文与审稿', en: 'Drafts and reviews' },
}

export function emptyClearCounts(): ProjectClearCounts {
  return {
    creativeFields: { categories: 0, rows: 0 },
    blueprints: { categories: 0, rows: 0 },
    generatedText: { categories: 0, rows: 0 },
  }
}

export function formatClearReceipt(locale: Locale, counts: ProjectClearCounts): ProjectClearReceipt {
  const en = locale === 'en-US'
  const lines = PROJECT_CLEAR_SCOPES.map(scope => {
    const { categories, rows } = counts[scope]
    return en
      ? `${LABELS[scope].en}: cleared ${categories} categories, ${rows} records.`
      : `${LABELS[scope].zh}：清了 ${categories} 类，共 ${rows} 条。`
  })
  return { counts, lines }
}
