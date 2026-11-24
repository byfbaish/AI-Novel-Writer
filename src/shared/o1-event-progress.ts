/**
 * O1（卡 58188c1c）：单元内**逐章事件进度水位**的纯函数。
 *
 * ## 它解决什么
 *
 * 单元模式下每章只写「本单元」的事，但单元内 4–6 个事件在多章之间怎么摊、写到第几章时
 * 该走到第几步，此前没有任何机检口径：要么事件全挤在末章，要么被悄悄漏掉（设计稿
 * `docs/design/architecture/o1-unit-event-progress-design.md` §4）。
 *
 * 本模块把「步数 / 每章应落区间 / 声明解析 / 四条不变量 / 注入行文本」做成纯函数，
 * 不含任何 IO、不读库、不缓存 —— 声明值由调用方从落库大纲里读（`lastDeclaredStep`），
 * 冻结语义只体现在入参（`batchSize` / `startStep`），本卡不建表。
 *
 * ## 口径（实施包 §0.3 / §3 写死，设计稿 §3.2 的「N = 已写章数」已作废）
 *
 * ```
 * b  = 本批章数（to - from + 1）
 * j  = 章在本批内的序号 1..b
 * M  = 事件步数，编号 E0…E(M-1)
 * s0 = 本批首章之前最后一章的声明值；无则 0；钳到 [0, M-1]
 * raw(j)   = s0 + j * (M - 1 - s0) / b
 * lower(j) = max(s0, min(M-1, floor(raw(j))))
 * upper(j) = max(s0, min(M-1, ceil (raw(j))))
 * ```
 *
 * 三条由此成立（都不是"每章最多一步"那种伪不变量）：
 * - 区间宽度恒 ≤ 1（同一有理数的 floor / ceil 之差），与 `b`、`M`、`s0` 无关；
 * - 「每章最多推进 1 步」**只在 `b ≥ M-1-s0` 时成立**，`M=6, b=3` 时每章推进 2 步；
 * - `upper(b) = M-1`（终态，EV-1 的算术来源）；`upper` 已钳到 `M-1`，故 `EM` 这个不存在的步号
 *   不可能出现。
 *
 * ## 为什么步数只从 `splitMinorSteps` 来
 *
 * 切分逻辑（`→` / `->`，段数 < 2 判无效）已经在 `arc-position.ts` 里，且那边注释写明
 * P18 撤回了「逐章上限」用途。这里**再写一份 split 必然与它漂移**，所以只调它、不复制。
 */

import type { WritingLanguage } from './writing-language'
import { splitMinorSteps } from './arc-position'

/** 某章声明值应落的水位区间（闭区间，两端都已钳到 `[startStep, stepCount - 1]`）。 */
export type O1StepBand = {
  readonly lower: number
  readonly upper: number
}

/** 解析出来的一条「章 → 水位」声明。`chapterIndex` 是**本批内**的序号 1..b。 */
export type O1Declaration = {
  readonly chapterIndex: number
  readonly reached: number
}

/** 四条不变量的发现项。全部只提示、不阻断（fail-open）。 */
export type O1Finding = {
  readonly code: 'EV-1' | 'EV-2' | 'EV-3' | 'EV-4'
  readonly chapterIndex: number
  readonly message: string
}

/** 注入行 / 提示文案的双语取词。 */
function t(language: WritingLanguage, zh: string, en: string): string {
  return language === 'en-US' ? en : zh
}

/**
 * 单元事件步（`M = length`）：对每个小弧的 `text` 调既有 `splitMinorSteps`。
 *
 * `text` 切不出 ≥ 2 段（无箭头 / 旧版弧光没有内容）时该小弧**计 1 步**，用 `minor.name` 兜底 ——
 * 一个只有名字的小弧仍然是一个事件，不该被丢掉（`arc-position.ts:49` 写明旧项目 `text` 可缺省）。
 */
export function unitEventSteps(
  minors: readonly { readonly name: string; readonly text?: string }[],
): string[] {
  const steps: string[] = []
  for (const minor of minors) {
    const parts = splitMinorSteps(minor.text)
    if (parts.length >= 2) steps.push(...parts)
    else steps.push(minor.name)
  }
  return steps
}

/**
 * 第 `chapterIndex` 章末的水位区间（实施包 §0.3）。
 *
 * 任一入参非安全整数、`chapterIndex < 1`、`batchSize < 1`、`stepCount < 2`、
 * `startStep` 不在 `[0, stepCount - 1]` ⇒ `null`（调用方按「本单元不声明水位」处理）。
 */
export function eventBandOf(input: {
  readonly chapterIndex: number
  readonly batchSize: number
  readonly startStep: number
  readonly stepCount: number
}): O1StepBand | null {
  const { chapterIndex, batchSize, startStep, stepCount } = input
  if (
    !Number.isSafeInteger(chapterIndex)
    || !Number.isSafeInteger(batchSize)
    || !Number.isSafeInteger(startStep)
    || !Number.isSafeInteger(stepCount)
  ) return null
  if (chapterIndex < 1) return null
  if (batchSize < 1) return null
  if (stepCount < 2) return null
  if (startStep < 0 || startStep > stepCount - 1) return null
  const finalStep = stepCount - 1
  const raw = startStep + (chapterIndex * (finalStep - startStep)) / batchSize
  const lower = Math.max(startStep, Math.min(finalStep, Math.floor(raw)))
  const upper = Math.max(startStep, Math.min(finalStep, Math.ceil(raw)))
  return { lower, upper }
}

/**
 * 只认**整行**声明：`进度：E<n>`（zh）或 `Progress: E<n>`（en）。
 *
 * 容全角 / 半角冒号、`E` 大写、行首尾空白（含 `\r`）；不匹配 ⇒ `null`，**不推断、不顺延**。
 * `进度：E 2`（E 与数字之间有空格）、`进度：EX`、`进度：-1` 一律 `null`。
 */
export function parseProgressLine(line: string, language: WritingLanguage): number | null {
  const text = line.trim()
  if (!text) return null
  const pattern = language === 'en-US'
    ? /^Progress[:：]\s?E(\d+)$/u
    : /^进度[:：]E(\d+)$/u
  const matched = pattern.exec(text)
  if (!matched) return null
  const value = Number(matched[1])
  return Number.isSafeInteger(value) ? value : null
}

/**
 * `startStep`（`s0`）的**唯一解析点**：整段大纲正文里的**最后一条**声明（zh / en 都认）。
 *
 * 一条都没有 ⇒ `null`，调用方按 `0` 处理。这里**只能有一个正则入口**（`parseProgressLine`）——
 * 若 `s0` 有两份实现，解析口径一漂就会静默给错水位，且不报错。
 */
export function lastDeclaredStep(outlineText: string): number | null {
  if (!outlineText) return null
  let last: number | null = null
  for (const line of outlineText.split('\n')) {
    const zh = parseProgressLine(line, 'zh-CN')
    if (zh !== null) {
      last = zh
      continue
    }
    const en = parseProgressLine(line, 'en-US')
    if (en !== null) last = en
  }
  return last
}

/**
 * 四条不变量（EV-1..4）。**全部 fail-open**：只产出提示、不拒绝、不重跑、不改请求。
 *
 * - `declarations` 必须是**同单元**的声明，内部按 `chapterIndex` 升序排一次（不改入参）；
 * - 缺行 ＝ 未声明：某章没解析出「进度：」就跳过该章，不参与任何一条，也不按上一章顺延；
 * - `unitComplete === false` 时**不出 EV-1**（少写的单元是"没走到终态"，不是违约）；
 * - `stepCount < 2`、`batchSize < 1`、`declarations` 为空 ⇒ `[]`。
 *
 * 发现项顺序固定：逐章（升序）的 EV-2 / EV-3 与其前一章之间的 EV-4，最后 EV-1。
 */
export function enforceEventProgress(input: {
  readonly stepCount: number
  readonly batchSize: number
  readonly startStep: number
  readonly declarations: readonly O1Declaration[]
  readonly language: WritingLanguage
  readonly unitComplete: boolean
}): O1Finding[] {
  const { stepCount, batchSize, startStep, declarations, language, unitComplete } = input
  if (stepCount < 2 || batchSize < 1 || declarations.length === 0) return []
  const finalStep = stepCount - 1
  const sorted = [...declarations].sort((left, right) => left.chapterIndex - right.chapterIndex)
  const findings: O1Finding[] = []
  let previous: O1Declaration | null = null
  for (const declaration of sorted) {
    const band = eventBandOf({
      chapterIndex: declaration.chapterIndex,
      batchSize,
      startStep,
      stepCount,
    })
    if (band) {
      if (declaration.reached > band.upper) {
        findings.push({
          code: 'EV-2',
          chapterIndex: declaration.chapterIndex,
          message: t(
            language,
            `第${declaration.chapterIndex}章提前推进到 E${declaration.reached}（上限 E${band.upper}）`,
            `Chapter ${declaration.chapterIndex} advanced early to E${declaration.reached} (ceiling E${band.upper})`,
          ),
        })
      }
      if (declaration.reached < band.lower) {
        findings.push({
          code: 'EV-3',
          chapterIndex: declaration.chapterIndex,
          message: t(
            language,
            `第${declaration.chapterIndex}章水位落后（下限 E${band.lower}）`,
            `Chapter ${declaration.chapterIndex} fell behind (floor E${band.lower})`,
          ),
        })
      }
    }
    if (previous && declaration.reached < previous.reached) {
      findings.push({
        code: 'EV-4',
        chapterIndex: declaration.chapterIndex,
        message: t(
          language,
          `第${declaration.chapterIndex}章水位回退（E${previous.reached} → E${declaration.reached}）`,
          `Chapter ${declaration.chapterIndex} went backwards (E${previous.reached} → E${declaration.reached})`,
        ),
      })
    }
    previous = declaration
  }
  if (unitComplete && previous && previous.reached !== finalStep) {
    findings.push({
      code: 'EV-1',
      chapterIndex: previous.chapterIndex,
      message: t(
        language,
        `本单元事件未走完：末章停在 E${previous.reached}，共 E${finalStep}`,
        `This unit's events did not finish: the last chapter stopped at E${previous.reached} of E${finalStep}`,
      ),
    })
  }
  return findings
}

/**
 * 注入行：**一行**纯文本，只出现在单元弧位块的**末尾**（一条请求只注入一次）。
 *
 * 只给 `j=1` 与 `j=b` 两端做示例 —— 把整张表铺进提示词等于让模型按章数抄表格。
 * `stepCount < 2`、`batchSize < 1`、`startStep` 越界时返回 `''`（整行不出现、不留空行）。
 */
export function renderEventProgressHint(
  input: { readonly stepCount: number; readonly batchSize: number; readonly startStep: number },
  language: WritingLanguage,
): string {
  const { stepCount, batchSize, startStep } = input
  const first = eventBandOf({ chapterIndex: 1, batchSize, startStep, stepCount })
  const last = eventBandOf({ chapterIndex: batchSize, batchSize, startStep, stepCount })
  if (!first || !last) return ''
  const finalStep = stepCount - 1
  if (language === 'en-US') {
    return `Event progress for this unit: ${stepCount} steps (E0–E${finalStep}); `
      + `${batchSize} chapters in this batch starting from E${startStep}; `
      + `chapter 1 should end at E${first.lower}–E${first.upper}, `
      + `chapter ${batchSize} at E${last.lower}–E${last.upper} (final state E${finalStep}). `
      + 'Declaration only; generation is not blocked.'
  }
  return `本单元事件进度：本单元共 ${stepCount} 步（E0–E${finalStep}）；`
    + `本批 ${batchSize} 章，起点 E${startStep}；`
    + `第 1 章末应落在 E${first.lower}–E${first.upper}，`
    + `第 ${batchSize} 章末应落在 E${last.lower}–E${last.upper}，`
    + `即终态 E${finalStep}。只核声明，不阻断生成。`
}
