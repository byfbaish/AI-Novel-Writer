/**
 * 产出层钩子校验（D18 的 C3 / C5）。
 *
 * 这两条是**唯一在正文落盘后跑的**，判的都是"指令与产出的关系"：
 * - C3（照抄）：正文末段把钩子行原样搬了过去 —— 指令被抄进产出；
 * - C5（未落地）：钩子行指认的东西在本章正文里 0 命中 —— 这一章自己没接住。
 *
 * 两条都**只报不改**，且**只判当章**（作者 2026-11-04 裁定 ⑫：主线之外不承诺绝对兑现，
 * 所以这里不建"后面几章必须收"的账）。
 *
 * ## 阈值：0.6 已用真实样本标定过一轮（2026-11-04）
 * 样本＝作者项目《师父派我来除魔》已落盘的 10 章成稿（第 1–10 章），比对端分别取大纲钩子行
 * 与蓝图 `suspenseHook`，共 20 组：
 *
 * - 实测 coverage 最大值 **0.500**（第 2 章：蓝图几乎逐字复述大纲，正文末段却仍是自己的写法），
 *   其余 0.000–0.455；**没有任何一组达到 0.6**。
 * - 也就是说：这批真实产物**不存在"整句照抄"**，0.6 在这里是零误报。
 * - 但这只证明"不误报"，**不证明"能抓到"** —— 抓得到是靠构造样本（单测）验证的。
 *   样本量只有 10 章、且全是旧模板（「收尾：」无类型）产物，够用不够厚；
 *   新模板跑出来的第一批成稿应再回填一次分布。
 *
 * ## 已知限制（实现时实测到的，别当它已经解决）
 * 分母是**钩子的 token 数**，所以钩子越短越敏感：一个 9 字的断点只有 3 个实词，
 * 正文末段只要提到这几个词（哪怕是正常写法）就 100% 重合。真实样本没触发这个边界
 * （钩子普遍 11–30 个实词），但它随时会触发。收紧方向是加"连续公共片段长度"这一层
 * （只有整句被搬才触发），那会偏离设计稿的单一口径 —— 留到下一轮标定再定。
 */

import { parseHookLine, type ParsedHookLine } from './synopsis-hook-line'
import { tokenize } from './suspense-hook-alignment'

/** 正文末段取多少字参与比对（中文网文的章末钩子落在最后 100–200 字，取上限做包围）。 */
export const HOOK_COPY_TAIL_CHARS = 200

/** 首版重合率阈值。已用 10 章真实样本标定过一轮（见文件头），真实产物最高 0.500。 */
export const HOOK_COPY_RATIO_DEFAULT = 0.6

/**
 * 「落地」的最小连续片段长度（字）。低于这个长度视为**没种下去**。
 *
 * 为什么不用"共享实词数为 0"：`tokenize` 是**二元字组**，任何通用词都能救活一条钩子。
 * 实测作者项目第 6 章：蓝图钩子 19 个 bigram，正文只命中「皮肤」一个（覆盖率 0.053），
 * 按"0 命中"判据**不报** —— 而那一章正是台账 D18-C 的事故现场（因果纹 / 寿元 正文 0 次）。
 * 换成"最长公共连续片段"后该章 = 2 字（只剩「第一」），其余九章 = 3–8 字，**唯一可分**。
 *
 * 取 3 的理由：一个中文词的最短可靠长度（「因果纹」= 3）。“第一”“皮肤”这类两字组合
 * 在网文里到处都是，不能当作"这件事写出来了"的证据。
 */
export const HOOK_PLANTED_MIN_RUN = 3

export type PayoffFinding = {
  code: 'C3-copy' | 'C5-unplanted'
  level: 'report'
  message: string
  /** 出问题的原文片段（钩子行或正文末段）。 */
  excerpt: string
  /** C3 = 重合率；C5 = 共享实词数。给标定用，不进界面文案。 */
  metric: number
}

function toSet(tokens: string[]): Set<string> {
  return new Set(tokens)
}

/** 钩子行 token 里有几成出现在比对文本里（分母＝钩子行，因为要抓的是"整句被搬走"）。 */
export function hookTokenCoverage(hookTokens: Set<string>, target: string): number {
  if (hookTokens.size === 0) return 0
  const targetTokens = toSet(tokenize(target))
  let hit = 0
  for (const token of hookTokens) if (targetTokens.has(token)) hit += 1
  return hit / hookTokens.size
}

/** 钩子行与目标文本的共享实词数（标定用，**不作判据** —— 通用词会救活它）。 */
export function hookTokenOverlap(hookTokens: Set<string>, target: string): number {
  const targetTokens = toSet(tokenize(target))
  let hit = 0
  for (const token of hookTokens) if (targetTokens.has(token)) hit += 1
  return hit
}

/**
 * 两个文本的**最长公共连续片段**长度（按字符算，中文按单字）。
 *
 * C5 的判据：钩子里至少要有一个 `HOOK_PLANTED_MIN_RUN` 字以上的连续片段出现在正文里，
 * 才算"这件事被写出来了"。用连续片段而不是 bigram 集合，是因为后者会被通用二字词救活。
 */
export function longestCommonRunLength(a: string, b: string): number {
  const A = [...a]
  const B = [...b]
  if (A.length === 0 || B.length === 0) return 0
  let previous = new Array<number>(B.length + 1).fill(0)
  let best = 0
  for (let i = 1; i <= A.length; i += 1) {
    const current = new Array<number>(B.length + 1).fill(0)
    for (let j = 1; j <= B.length; j += 1) {
      if (A[i - 1] === B[j - 1]) {
        const run = previous[j - 1] + 1
        current[j] = run
        if (run > best) best = run
      }
    }
    previous = current
  }
  return best
}

export type DraftHookAuditInput = {
  /** 大纲里该章的「钩子：」整行（**含标记**）。与 `hookText` 二选一。 */
  hookLine?: string
  /**
   * 裸文本钩子（**没有**「钩子：」标记），即蓝图 `suspenseHook` 的原文。
   *
   * 为什么要这个入口：正文 prompt 注入的是**蓝图** `suspenseHook`（`withSuspenseHook`），
   * 不是大纲那一行。若只拿大纲行来判 C3/C5，判的就是**模型没看过的文本** ——
   * 实测（2026-11-04，作者项目 10 章成稿）第 6 章蓝图写「因果纹 / 寿元透支」、正文 0 命中，
   * 而大纲行与正文有 4 个共享实词，C5 不报。判据得对着"模型实际被告知的那句话"。
   *
   * ⚠️ 这不是裁定 ⑩ 要否掉的那个判据：⑩ 不判的是"蓝图有没有偏离大纲"；
   * 这里不比较两份文本，只判"注入给模型的那句钩子在成稿里种下去没有"。
   */
  hookText?: string
  /** 该章成稿正文（落盘文本）。 */
  draft: string
  /** 覆盖默认阈值（标定用）。 */
  copyRatioThreshold?: number
}

/**
 * 校验一章的成稿。
 *
 * 无论走 `hookLine`（大纲整行）还是 `hookText`（蓝图裸文本），取到的都是**断点**；
 * 解析不出断点时**返回空数组**：那不是这两条判据的职责，结构问题由大纲侧的 C1 已经报过，
 * 别在产出侧再报一遍制造重复噪声。注意这条豁免只对 `hookLine` 成立 ——
 * `hookText` 本来就是裸文本，没有"解析失败"这回事，空串才算没有。
 */
export function auditDraftHook(input: DraftHookAuditInput): PayoffFinding[] {
  const parsed: ParsedHookLine | null = input.hookLine ? parseHookLine(input.hookLine) : null
  const breakPoint = (input.hookText ?? parsed?.breakPoint ?? '').trim()
  if (!breakPoint) return []

  const hookTokens = toSet(tokenize(breakPoint))
  if (hookTokens.size === 0) return []

  const draft = input.draft ?? ''
  if (!draft.trim()) return []

  const findings: PayoffFinding[] = []
  const threshold = input.copyRatioThreshold ?? HOOK_COPY_RATIO_DEFAULT

  // C3 · 照抄：正文最后 N 字与钩子行的重合率过高。
  const tail = draft.slice(-HOOK_COPY_TAIL_CHARS)
  const coverage = hookTokenCoverage(hookTokens, tail)
  if (coverage >= threshold) {
    findings.push({
      code: 'C3-copy',
      level: 'report',
      message:
        `正文末段与钩子行的重合率 ${(coverage * 100).toFixed(0)}%（阈值 ${(threshold * 100).toFixed(0)}%）：`
        + '钩子行是给模型的指令，被整句搬进了正文。改写末段，只写它指向的那件事，不写它的措辞。',
      excerpt: tail.slice(-80),
      metric: coverage,
    })
  }

  // C5 · 未落地：钩子和正文没有任何 ≥3 字的连续片段 —— 这一章没把它写出来。
  const plantedRun = longestCommonRunLength(breakPoint, draft)
  if (plantedRun < HOOK_PLANTED_MIN_RUN) {
    findings.push({
      code: 'C5-unplanted',
      level: 'report',
      message:
        `钩子与本章正文的最长共同片段只有 ${plantedRun} 字（少于 ${HOOK_PLANTED_MIN_RUN} 字）：`
        + `「${breakPoint.slice(0, 40)}」在正文里没有对应的写法。`
        + '可改钩子、改正文，或知悉放行 —— 这一条只判当章，不追下一章。',
      excerpt: breakPoint.slice(0, 120),
      metric: plantedRun,
    })
  }

  return findings
}
