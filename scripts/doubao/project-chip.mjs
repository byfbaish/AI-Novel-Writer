/**
 * 底栏「项目」chip 的判读（纯函数，无 DOM / 无 CDP）。
 *
 * 为什么要单独一个模块：这里判错一次，代价是**派活跑到错误的项目里**，
 * 而错误表现为「报 ok」—— 2026-11-04 实测过：话题根本没选项目，
 * `bootstrap` 仍然输出 `项目路径 ✓ AI-writer-wt-1 C:\...`。
 * 纯函数才能锁住这种「静默判对」。
 */

/** chip 上出现的占位文本 —— 出现即表示「这个话题没选项目」。 */
export const PROJECT_CHIP_PLACEHOLDERS = ['项目', 'project']

/**
 * chip 是否为空 / 只是占位文本。
 *
 * 不谈菜单、只看 chip 本身：chip 有项目名就一定有值，没选就只剩占位文本。
 * 这一条**必须**先判，不能靠菜单里的 `active` 兜 —— 菜单项可能标着「上次用过」，
 * 那是全局状态，不是当前话题的状态。
 */
export const isUnsetProjectChip = label => {
  const text = String(label ?? '').trim()
  return text === '' || PROJECT_CHIP_PLACEHOLDERS.includes(text.toLowerCase())
}

/**
 * 从菜单项里挑出「chip 上那个项目」。
 *
 * 匹配顺序：`名字 + 空格`（菜单项格式是 `名字 C:\路径`）→ 前缀 → 最后才用 `active`。
 * `active` 放最后是因为它是**兜底**而不是判据：把它放前面，chip 明明写着 A、
 * 菜单里 active 却是 B 时，会静默选中 B 并把 B 的路径当成证据。
 */
export const pickProjectRow = (chipLabel, items) => {
  const chip = String(chipLabel ?? '').trim().toLowerCase()
  const rows = Array.isArray(items) ? items : []
  if (!chip) return null
  return rows.find(item => String(item?.name ?? '').toLowerCase().startsWith(`${chip} `))
    ?? rows.find(item => String(item?.name ?? '').toLowerCase().startsWith(chip))
    ?? rows.find(item => item?.active)
    ?? null
}
