// patch-reboot.mjs — 一次性补丁：ReadAllText → 精确替换 → WriteAllText(UTF8 无 BOM)
//
// 状态：**已执行完毕，仅留档**（CARD-1117-A 入库）。它所做的三处 model-policy
// 改动已经落进提交 b5afcea2（Hy4 flash 授权与 `auth=` 行）。重复运行会因锚点
// 不唯一或不存在而抛错，这是预期行为，不是脚本坏了。
//
// 与旧版的唯一差别：不再打印 before/after 的字节数（裁定 1224ee2b §二·3 废止
// 三元组当凭证），只回一行 `applied <rel>`。
//
// 用法：node scripts/ops/patch-reboot.mjs [root]

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DEFAULT_ROOT = 'C:/develop/workspace/AI-writer/develop/'

/**
 * @param {string} text
 * @param {ReadonlyArray<readonly [string, string, string]>} edits  [旧串, 新串, 标签]
 * @returns {string}
 */
export function applyEdits(text, edits) {
  let out = text
  for (const [from, to, label] of edits) {
    const hits = out.split(from).length - 1
    if (hits !== 1) throw new Error(label + ': 命中 ' + hits + ' 次（要求恰好 1 次）')
    out = out.replace(from, to)
  }
  return out
}

export const PATCHES = [
  {
    rel: 'scripts/workbuddy/model-policy.mjs',
    edits: [
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
    ],
  },
  {
    rel: 'scripts/workbuddy/__tests__/model-policy.test.mjs',
    edits: [
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
    ],
  },
]

/**
 * @param {string} root
 * @param {{rel: string, edits: ReadonlyArray<readonly [string, string, string]>}} patch
 * @returns {string} 打补丁后的目标文件路径
 */
export function patchFile(root, patch) {
  const target = root + patch.rel
  writeFileSync(target, applyEdits(readFileSync(target, 'utf8'), patch.edits), 'utf8')
  return target
}

function main(argv) {
  const root = argv[0] || DEFAULT_ROOT
  for (const patch of PATCHES) {
    patchFile(root, patch)
    console.log('applied ' + patch.rel)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
