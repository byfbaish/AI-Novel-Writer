/**
 * WorkBuddy 通道的「用哪个模型」策略（纯函数层，零依赖）。
 *
 * 规则来自用户拍板 + 官方公告：
 * - **Hy4 已全线禁用（2026-11-16 用户拍板：优惠时限已到）**：不分时段、不分促销期，一律不出 Hy4；
 *   `HY4_DISABLED = true` 是唯一开关，恢复时只改这一行。下面两条 Hy4 旧规则仅作历史说明保留。
 * - **Hy4 flash（0.00x，限时免费，2026-11-17 用户拍板放开）**：与 0.29x 的 `Hy4` 是选择器里两条
 *   并列的独立选项，逐字文本 `Hy4 flash`（flash 全小写、中间一个半角空格）。只开这一条，`Hy4` 仍禁用。
 * - Hy4 **全天限免促销（≤2026-11-15，含当天）**：作者 2026-11-07 20:2x 订正 —— 促销期内
 *   任何时段免费，但**日内有额度上限**；撞上限按 §13 识别特征（连续两次秒回 + 兜底文案）
 *   切 DeepSeek-V4.1-Flash，本模块不做额度探测（status 不返回剩余额度）。
 * - Hy4 常规夜间限免（促销期后）：每天 23:00–次日 08:00（腾讯公告，IT之家 2026-10-02 转载）。
 *   Hy3 全天免费但能力弱，本通道**禁用**。
 * - DeepSeek-V4.1-Flash：WorkBuddy 积分倍率 0.11x；周一至周五 09:00–12:00、
 *   14:00–18:00 是高峰（原价），其余时段 5 折（腾讯云开发者社区 2026-10-22）。
 *   高峰期不派活 —— 脚本直接拦下，避免原价烧积分。促销期内走 Hy4，故高峰拦截自然不触发。
 * - 除这两个模型外的任何模型都不选（用户明确：除了这两个以外的 API 不要选择）。
 *
 * 时段常量集中在这里；规则变了只改这一处。`WORKBUDDY_MODEL_POLICY=off` 可关掉自动选型，
 * `--model <名字>` 可显式指定（视为人工授权，绕过高峰拦截）。
 */

/**
 * Hy4 全局禁用开关（2026-11-16 用户拍板：Hy4 优惠时限已到，全线禁用）。
 * true = 不分时段、不分促销期，一律不出 Hy4；白名单里只有 `Hy4 flash` 与 DeepSeek-V4.1-Flash。
 * 授权现状：主人 2026-11-17 01:10 主身私聊授权，只开 `Hy4 flash`（0.00x 限时免费）；
 * `Hy4`(0.29x) 仍禁用，本开关与它的拒绝语义都不许动。
 * 恢复 Hy4 时只改这一行（false 即回落到旧的促销期/夜间窗逻辑），其余代码无需动。
 */
export const HY4_DISABLED = true

/** 允许出现的模型名（必须与模型选择器里 .cr-model-selector__item-name 的文本完全一致） */
export const MODEL_HY4 = 'Hy4'
export const MODEL_HY4_FLASH = 'Hy4 flash'
export const MODEL_DEEPSEEK_FLASH = 'DeepSeek-V4.1-Flash'
export const ALLOWED_MODELS = HY4_DISABLED
  ? [MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]
  : [MODEL_HY4, MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]

/**
 * 跨源评审可临时点名的模型（2026-11-25 主人要求：重要评审要跨家族）。
 * `--force` 只对这一组生效——白名单外但不在名单里的名字一律拒绝，防止 --force 变成通用后门。
 */
export const CROSS_SOURCE_MODELS = ['GLM-5.3', 'GLM 5.4', 'Qwen 3.8 Flash', 'Qwen 4 Max', 'Kimi K3.1 Pro', 'Kimi K3']

/** 付费 Hy4（0.29x）无论有没有 --force 都不许出现：它是被主人明令禁用的那一条，与 `Hy4 flash` 不是一个模型。 */
export function isPaidHy4(model) {
  return String(model == null ? '' : model).replace(/\s+/g, ' ').trim().toLowerCase() === 'hy4'
}

/**
 * 每条白名单模型的授权出处：`<角色>|<渠道>|<ISO>`；无法溯源写 `UNVERIFIED`。
 * 缺这一行列即判不合格（不是 WARN）——status / help 输出靠它自证「谁在何时授权」。
 */
export const MODEL_AUTH = {
  [MODEL_HY4_FLASH]: '主人|主身私聊|2026-11-17T01:10+08:00',
  [MODEL_DEEPSEEK_FLASH]: 'UNVERIFIED',
  [MODEL_HY4]: 'UNVERIFIED',
}

/** 取某模型的授权出处；白名单外的模型一律 `UNVERIFIED`。 */
export function authOf(model) {
  return MODEL_AUTH[model] ?? 'UNVERIFIED'
}

/** 夜间限免窗口：23:00 → 次日 08:00（跨午夜）；HY4_DISABLED=false 时生效 */
export const HY4_FREE_WINDOW = { startHour: 23, endHour: 8 }

/**
 * Hy4 全天限免促销截止日（含当天，本地日期 YYYY-MM-DD）。
 * 作者 2026-11-07 订正：11-15 之前全天候免费，但日内有额度上限。
 * 促销结束后自动回落到 HY4_FREE_WINDOW 夜间窗，无需改代码。
 */
export const HY4_PROMO_ALL_DAY_UNTIL = '2026-11-15'

/** DeepSeek 高峰：工作日（周一–周五）两段，左闭右开，单位=当天分钟数 */
export const DEEPSEEK_PEAK_WEEKDAYS = [1, 2, 3, 4, 5]
export const DEEPSEEK_PEAK_RANGES = [
  { startHour: 9, endHour: 12 },
  { startHour: 14, endHour: 18 },
]

const pad = value => String(value).padStart(2, '0')

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes()
}

function inWindow(minutes, { startHour, endHour }) {
  const start = startHour * 60
  const end = endHour * 60
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/** 本地日期键 YYYY-MM-DD（不走 UTC，避免晚上跨时区判错） */
function localDateKey(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

/** 是否处于 Hy4 全天限免促销期（≤ HY4_PROMO_ALL_DAY_UNTIL，含当天）。 */
export function isHy4PromoAllDay(date = new Date()) {
  return localDateKey(date) <= HY4_PROMO_ALL_DAY_UNTIL
}

/** 促销期内全天免费；促销期外只有 23:00–08:00（含跨午夜）。Hy4 全局禁用时恒 false。 */
export function isHy4FreeAt(date = new Date()) {
  if (HY4_DISABLED) return false
  if (isHy4PromoAllDay(date)) return true
  return inWindow(minutesOfDay(date), HY4_FREE_WINDOW)
}

export function isDeepSeekPeakAt(date = new Date()) {
  if (!DEEPSEEK_PEAK_WEEKDAYS.includes(date.getDay())) return false
  const minutes = minutesOfDay(date)
  return DEEPSEEK_PEAK_RANGES.some(range => inWindow(minutes, range))
}

function atHour(date, hour) {
  const next = new Date(date.getTime())
  next.setHours(hour, 0, 0, 0)
  return next
}

/** 当前正处在高峰时，返回这一段高峰结束的时刻（= 可以开工的最早时间）。 */
export function nextOffPeakAt(date = new Date()) {
  const minutes = minutesOfDay(date)
  for (const range of DEEPSEEK_PEAK_RANGES) {
    const start = range.startHour * 60
    const end = range.endHour * 60
    if (minutes >= start && minutes < end) return atHour(date, range.endHour)
  }
  // 不在高峰：返回下一段高峰的结束点没有意义，直接给当下
  return new Date(date.getTime())
}

export function formatClock(date) {
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

/**
 * 当前该用哪个模型。
 * @returns {{ok: true, model: string, window: string, reason: string} | {ok: false, blocked: true, model: null, reason: string, nextOffPeakAt: Date}}
 */
export function pickModel(date = new Date()) {
  if (!HY4_DISABLED && isHy4PromoAllDay(date)) {
    return {
      ok: true,
      model: MODEL_HY4,
      window: 'hy4-promo-all-day',
      reason: 'Hy4 全天限免促销（截止 ' + HY4_PROMO_ALL_DAY_UNTIL + '），日内有额度上限，撞上限切 DeepSeek-V4.1-Flash',
    }
  }
  if (!HY4_DISABLED && isHy4FreeAt(date)) {
    return { ok: true, model: MODEL_HY4, window: 'hy4-free-night', reason: 'Hy4 夜间限免（23:00–08:00），免费且比 Hy3 强' }
  }
  if (isDeepSeekPeakAt(date)) {
    return {
      ok: false,
      blocked: true,
      model: null,
      reason: 'DeepSeek 高峰（原价）',
      nextOffPeakAt: nextOffPeakAt(date),
    }
  }
  return { ok: true, model: MODEL_DEEPSEEK_FLASH, window: 'deepseek-off-peak', reason: '非高峰时段，DeepSeek-V4.1-Flash 计 0.11x 且 5 折' }
}

/** 高峰拦截横幅：给人在窗口里直接抄的重跑命令。 */
export function buildPeakBanner({ now = new Date(), target, command = 'task', prompt } = {}) {
  const next = nextOffPeakAt(now)
  const rerunPrompt = String(prompt ?? '你的任务').split('\n')[0].slice(0, 60)
  const line = '-'.repeat(72)
  return [
    line,
    '⏸  现在是 DeepSeek 高峰时段，不派活（原价，不享 5 折）',
    '   现在：' + formatClock(now) + '（周一至周五 09:00–12:00、14:00–18:00 为高峰）',
    '   最早可开工：' + formatClock(next) + '（今天）',
    '',
    '   现在就要跑（明确接受原价）可以加 --model ' + MODEL_DEEPSEEK_FLASH + '：',
    '     node scripts/workbuddy/workbuddy-attach.mjs ' + command + ' "' + rerunPrompt + '" --model ' + MODEL_DEEPSEEK_FLASH,
    '',
    line,
    'PEAK_HOURS',
  ].join('\n')
}

/** status / help 用的一行摘要。 */
export function describeModelPolicy(date = new Date()) {
  const picked = pickModel(date)
  if (!picked.ok) {
    return formatClock(date) + ' 高峰 → 不派活（' + formatClock(picked.nextOffPeakAt) + ' 后可自动派活） auth=UNVERIFIED'
  }
  return formatClock(date) + ' → ' + picked.model + '（' + picked.reason + '） auth=' + authOf(picked.model)
}

/**
 * 白名单逐条的授权出处行：每行以 `auth=` 开头，供机检 `^auth=` 直接命中。
 * 与 describeModelPolicy 共用同一张 MODEL_AUTH，不存在第二份口径。
 */
export function describeModelAuthLines() {
  return ALLOWED_MODELS.map(model => 'auth=' + authOf(model) + ' model=' + model)
}

/** 模型名比较：选择器文本可能带空白，统一按「去空白 + 忽略大小写」比对。 */
export function sameModel(a, b) {
  const norm = value => String(value ?? '').replace(/\s+/g, '').toLowerCase()
  return norm(a) === norm(b)
}

/** 只接受白名单里的模型；返回 null 表示放行，否则返回拒绝原因。 */
export function rejectUnknownModel(model) {
  if (!model) return null
  const hit = ALLOWED_MODELS.find(allowed => sameModel(allowed, model))
  if (hit) return null
  return '模型「' + model + '」不在白名单（只允许 ' + ALLOWED_MODELS.join(' / ') + '）'
}
