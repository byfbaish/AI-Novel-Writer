// 一次性补丁脚本（不进库）：ReadAllText → 精确替换 → WriteAllText(UTF8 无 BOM)
import { readFileSync, writeFileSync } from 'node:fs'

const root = 'C:/develop/workspace/AI-writer/develop/'

function patch(rel, edits) {
  const p = root + rel
  const before = readFileSync(p, 'utf8')
  let text = before
  for (const [oldStr, newStr, label] of edits) {
    const n = text.split(oldStr).length - 1
    if (n !== 1) throw new Error(`[${rel}] ${label}: 命中 ${n} 次（要求恰好 1 次）`)
    text = text.replace(oldStr, newStr)
  }
  writeFileSync(p, text, 'utf8')
  const crlf = (text.match(/\r\n/g) || []).length
  console.log(`${rel}: ${Buffer.byteLength(before, 'utf8')}B -> ${Buffer.byteLength(text, 'utf8')}B, crlf=${crlf}, bom=${text.charCodeAt(0) === 0xfeff}`)
}

const MP = 'scripts/workbuddy/model-policy.mjs'
const TF = 'scripts/workbuddy/__tests__/model-policy.test.mjs'

patch(MP, [
  [
    `/**
 * Hy4 全局禁用开关（2026-11-16 用户拍板：Hy4 优惠时限已到，全线禁用）。
 * true = 不分时段、不分促销期，一律不出 Hy4，白名单里也不再有它。
 * 恢复时只改这一行（false 即回落到旧的促销期/夜间窗逻辑），其余代码无需动。
 */`,
    `/**
 * Hy4 全局禁用开关（2026-11-16 用户拍板：Hy4 优惠时限已到，全线禁用）。
 * true = 不分时段、不分促销期，一律不出 Hy4；白名单里只有 \`Hy4 flash\` 与 DeepSeek-V4.1-Flash。
 * 授权现状：主人 2026-11-17 01:10 主身私聊授权，只开 \`Hy4 flash\`（0.00x 限时免费）；
 * \`Hy4\`(0.29x) 仍禁用，本开关与它的拒绝语义都不许动。
 * 恢复 Hy4 时只改这一行（false 即回落到旧的促销期/夜间窗逻辑），其余代码无需动。
 */`,
    'HY4_DISABLED jsdoc',
  ],
  [
    `export const ALLOWED_MODELS = HY4_DISABLED
  ? [MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]
  : [MODEL_HY4, MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]`,
    `export const ALLOWED_MODELS = HY4_DISABLED
  ? [MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]
  : [MODEL_HY4, MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]

/**
 * 每条白名单模型的授权出处：\`<角色>|<渠道>|<ISO>\`；无法溯源写 \`UNVERIFIED\`。
 * 缺这一行列即判不合格（不是 WARN）——status / help 输出靠它自证「谁在何时授权」。
 */
export const MODEL_AUTH = {
  [MODEL_HY4_FLASH]: '主人|主身私聊|2026-11-17T01:10+08:00',
  [MODEL_DEEPSEEK_FLASH]: 'UNVERIFIED',
  [MODEL_HY4]: 'UNVERIFIED',
}

/** 取某模型的授权出处；白名单外的模型一律 \`UNVERIFIED\`。 */
export function authOf(model) {
  return MODEL_AUTH[model] ?? 'UNVERIFIED'
}`,
    'MODEL_AUTH + authOf',
  ],
  [
    `export function describeModelPolicy(date = new Date()) {
  const picked = pickModel(date)
  if (!picked.ok) {
    return formatClock(date) + ' 高峰 → 不派活（' + formatClock(picked.nextOffPeakAt) + ' 后可自动派活）'
  }
  return formatClock(date) + ' → ' + picked.model + '（' + picked.reason + '）'
}`,
    `export function describeModelPolicy(date = new Date()) {
  const picked = pickModel(date)
  if (!picked.ok) {
    return formatClock(date) + ' 高峰 → 不派活（' + formatClock(picked.nextOffPeakAt) + ' 后可自动派活） auth=UNVERIFIED'
  }
  return formatClock(date) + ' → ' + picked.model + '（' + picked.reason + '） auth=' + authOf(picked.model)
}

/**
 * 白名单逐条的授权出处行：每行以 \`auth=\` 开头，供机检 \`^auth=\` 直接命中。
 * 与 describeModelPolicy 共用同一张 MODEL_AUTH，不存在第二份口径。
 */
export function describeModelAuthLines() {
  return ALLOWED_MODELS.map(model => 'auth=' + authOf(model) + ' model=' + model)
}`,
    'describeModelPolicy + describeModelAuthLines',
  ],
])

patch(TF, [
  [
    `  MODEL_HY4,
  buildPeakBanner,`,
    `  MODEL_HY4,
  MODEL_HY4_FLASH,
  buildPeakBanner,`,
    'import MODEL_HY4_FLASH',
  ],
  [
    ` * - **Hy4 已全线禁用（2026-11-16 用户拍板，HY4_DISABLED = true）**：促销期与夜间窗的旧断言
 *   一律改为「禁用后恒不出 Hy4」，旧逻辑保留在代码里、开关置 false 即可恢复。`,
    ` * - **Hy4 已全线禁用（2026-11-16 用户拍板，HY4_DISABLED = true）**：促销期与夜间窗的旧断言
 *   一律改为「禁用后恒不出 Hy4」，旧逻辑保留在代码里、开关置 false 即可恢复。
 * - **\`Hy4 flash\` 已放开（主人 2026-11-17 01:10 主身私聊授权，只开 \`Hy4 flash\`）**：0.00x 限时免费，
 *   与 0.29x 的 \`Hy4\` 是选择器里两条并列独立选项；\`Hy4\`(0.29x) 仍禁用，其拒绝断言不许动。`,
    'header comment 授权口径',
  ],
  [
    `  it('只放行 Hy4 和 DeepSeek-V4.1-Flash', () => {
    expect(ALLOWED_MODELS).toEqual([MODEL_DEEPSEEK_FLASH])`,
    `  it('只放行 Hy4 flash 和 DeepSeek-V4.1-Flash（Hy4 0.29x 仍禁用）', () => {
    expect(ALLOWED_MODELS).toEqual([MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH])`,
    ':169 用例名 + :170 断言',
  ],
])

console.log('OK')
