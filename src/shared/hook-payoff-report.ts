/**
 * 产出层钩子体检的报告文案（D18 的 C3 / C5）。
 *
 * 判据与阈值都在 `hook-payoff-audit.ts`；这里只做「什么时候说话、说什么」，
 * 好让两个生产调用点（草稿落盘、正文定稿）共用同一套文案，也便于单测。
 * 两条都**只报不改、不阻断**（设计稿 §7）。
 */

import type { PayoffFinding } from './hook-payoff-audit'

export type HookPayoffUiText = (zhCNText: string, enUSText: string) => string

function messagesOf(findings: PayoffFinding[], code: PayoffFinding['code'], uiText: HookPayoffUiText): string[] {
  // shared 层的 finding.message 目前只有中文；英文界面下先原样输出，避免拼出半英半中的句子。
  return findings.filter(item => item.code === code).map(item => uiText(item.message, item.message).replace(/。$/u, ''))
}

/** C3 · 照抄体检（正文落盘后跑）。无命中返回 null。 */
export function summarizeDraftCopyFindings(
  findings: PayoffFinding[],
  uiText: HookPayoffUiText,
): string | null {
  const problems = messagesOf(findings, 'C3-copy', uiText)
  if (problems.length === 0) return null
  const hint = uiText(
    '（草稿已保存；这是提示，不阻断，也不改稿。）',
    '(The draft is saved; this is advisory only — no block, no rewrite.)',
  )
  return uiText(
    `⚠️ 钩子照抄体检（C3）：${problems.join('；')}。${hint}`,
    `⚠️ Hook copy check (C3): ${problems.join('; ')}. ${hint}`,
  )
}

/** C5 · 未落地体检（正文定稿后跑）。无命中返回 null。 */
export function summarizeDraftPayoffFindings(
  findings: PayoffFinding[],
  uiText: HookPayoffUiText,
): string | null {
  const problems = messagesOf(findings, 'C5-unplanted', uiText)
  if (problems.length === 0) return null
  const hint = uiText(
    '（正文已定稿；这是提示，不阻断，也不改稿。）',
    '(The manuscript is finalized; this is advisory only — no block, no rewrite.)',
  )
  return uiText(
    `⚠️ 钩子未落地体检（C5）：${problems.join('；')}。${hint}`,
    `⚠️ Unplanted-hook check (C5): ${problems.join('; ')}. ${hint}`,
  )
}
