/**
 * C5 的「蹭线」提示（D18 · 独立可插拔，report-only）。
 *
 * ## 它修的是什么失真
 * C5 的判据是「钩子与正文的最长公共连续片段 ≥ `HOOK_PLANTED_MIN_RUN`（3）字 ⇒ 视为已落地」。
 * 这条线在真实产物上会放过一类假通过：**整段公共片段落在人名 / 地名上**。
 *
 * 实测（作者项目第 11 章，2026-11-04，见 D18 设计稿 §11.5b / §11.3③）：钩子靠 6 字
 * 「第三段废料区」过线，而悬念核「记录落在第三页中间」「这一页被谁先翻到」在正文里 0 次。
 * 也就是说：**地名出现了，事没发生**。这不是阈值问题（抬到 5–6 字会误伤第 2、3 章的 3 字贴线），
 * 是「落地」的定义问题 —— 所以不换判据，**另加一条只提示的旁证**。
 *
 * ## 口径（要写进报告、也要能被测试钉住）
 * 1. 取钩子与正文的**最长公共连续片段**（按 Unicode 字符，中文按单字）；
 * 2. 长度 < 3 ⇒ 不算（与 C5 同一条线，避免「第一」「皮肤」这类二字组合误报）；
 * 3. 片段**去掉首尾标点 / 空白**后仍非空；
 * 4. 该片段**整体**被某个专名包含（`noun.includes(trimmed)`）⇒ 命中。
 *
 * 第 3 条是判定「整体落在专名上」的必要一步：片段 `「，陈砚」` 首部带了一个句读，
 * 剔掉标点后整段就是人名「陈砚」，**仍应按命中处理** —— 标点不构成"超出专名"的内容。
 * 反之，片段 `「陈砚把布」` 剔完还是 `「陈砚把布」`，不被任何专名包含 ⇒ 不命中（真落地）。
 *
 * ## 只报不拦、可插拔
 * - 命中只产生一条 `C5-name-graze` finding，走 `hook-payoff-report` 的 C5 文案，
 *   **不阻断保存 / 定稿，也不改稿**。
 * - 开关只有一处：`NAME_GRAZE_HINT_DEFAULT_ENABLED`。改 false，或调用点传 `enabled: false`。
 *   **不建设置面板**（作者 2026-11-05 裁定：先上线看影响，影响小就不必每章提醒）。
 *
 * ## 已知假阳性
 * 专名本身是通用词时（「账本」「灵石」这类被写进 `characters` 的名词）会误报；
 * 第 3 章会命中（贴 3 字线的过线段恰好是专名）—— 需要人判一次，这正是"请人判"的用意。
 *
 * 本模块**零依赖**：不 import 任何东西，便于单独关闭 / 单独测试。
 */

/** 一条蹭线命中。`run` 是原文里的最长公共片段（含首尾标点，未裁剪），`noun` 是容纳它的专名。 */
export interface NameGrazeHit {
  /** 钩子与正文的最长公共连续片段原文。 */
  run: string
  /** `properNouns` 里第一个把 `run`（去首尾标点后）整体包住的那个专名。 */
  noun: string
}

/**
 * **唯一插拔点**。改 `false` 即可全局关掉这条提示（调用点也各自读这个常量）。
 *
 * 默认开：作者 2026-11-05 裁定「先上线，后续看影响决定是否维持」。
 */
export const NAME_GRAZE_HINT_DEFAULT_ENABLED = true

/**
 * 参与判定的最短公共片段长度（字）。
 *
 * 与 `hook-payoff-audit.HOOK_PLANTED_MIN_RUN` 同值同义，这里**独立声明**以保持本模块零依赖；
 * 改一处不够，两处都改（有单测钉住两者相等）。
 */
export const NAME_GRAZE_MIN_RUN = 3

/** 片段首尾的噪声：空白 + 标点 + 符号（`，` `。` `「` `」` `…` 等都归 Unicode P/S）。 */
const EDGE_NOISE = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu

/** 去掉首尾的标点 / 空白（中间的保留 —— 中间有标点说明片段跨了专名之外的内容）。 */
export function trimEdgeNoise(text: string): string {
  return text.replace(EDGE_NOISE, '')
}

/**
 * 两个文本的**最长公共连续片段文本**（同长度取最先结束的一处，保证确定性）。
 *
 * 与 `hook-payoff-audit.longestCommonRunLength` 同一套 DP，区别只在**返回片段文本**
 * 而不是长度 —— 判「这段是不是整个落在专名上」必须有片段本身。
 */
export function longestCommonRunText(a: string, b: string): string {
  const A = [...a]
  const B = [...b]
  if (A.length === 0 || B.length === 0) return ''

  let previous = new Array<number>(B.length + 1).fill(0)
  let best = 0
  let bestEndA = 0
  for (let i = 1; i <= A.length; i += 1) {
    const current = new Array<number>(B.length + 1).fill(0)
    for (let j = 1; j <= B.length; j += 1) {
      if (A[i - 1] === B[j - 1]) {
        const run = previous[j - 1] + 1
        current[j] = run
        if (run > best) {
          best = run
          bestEndA = i
        }
      }
    }
    previous = current
  }
  if (best === 0) return ''
  return A.slice(bestEndA - best, bestEndA).join('')
}

/**
 * 判「过线段整体落在人名 / 地名上」。命中返回 `{ run, noun }`，否则 `null`。
 *
 * 纯函数、无副作用、不抛错：`properNouns` 里的空串 / 非字符串条目直接跳过（fail-open）。
 */
export function detectNameOnlyGraze(
  hookText: string,
  draft: string,
  properNouns: readonly string[],
): NameGrazeHit | null {
  const hook = typeof hookText === 'string' ? hookText.trim() : ''
  const body = typeof draft === 'string' ? draft : ''
  if (!hook || !body.trim()) return null
  if (!Array.isArray(properNouns) || properNouns.length === 0) return null

  const run = longestCommonRunText(hook, body)
  if ([...run].length < NAME_GRAZE_MIN_RUN) return null

  // 首尾标点不算"超出专名"的内容；中间夹标点则说明片段确实越过了专名。
  const trimmed = trimEdgeNoise(run)
  if (!trimmed) return null

  for (const candidate of properNouns) {
    const noun = typeof candidate === 'string' ? candidate.trim() : ''
    if (!noun) continue
    if (noun.includes(trimmed)) return { run, noun }
  }
  return null
}
