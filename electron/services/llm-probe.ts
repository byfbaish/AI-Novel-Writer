/**
 * LLM 生成探针（诊断用，默认关闭）。
 *
 * ## 为什么需要它
 *
 * 分层应当是：弧光 → 情节大纲 → 章节蓝图 → 正文，正文只吃「本章蓝图」。
 * 2026-10-11 实机核对确认：正文 prompt 里同时存在两份对**同一章**的表述 ——
 * `readArchitecture()` 注入的大纲「本章那一段」，与本章蓝图 `keyEvents`，
 * 两者并排注入且模板里没有任何优先级声明，冲突时模型只能自己猜。
 * （已处置：大纲只保留非章级设定段。见 docs/plans/llm-probe-observation-plan.md）
 *
 * 要判断这件事是否真的发生、发生在哪一步，光看代码不够，必须看
 * **实际发出去的 messages**。本探针就是干这个的：把每次 LLM 请求的
 * messages 与响应原样落盘，并附带关键信号，供人直接核对。
 *
 * ## 开关与落盘
 *
 * - 开关：**dev 默认开启**；`AI_NOVEL_LLM_PROBE=0` 关闭，`=1` 强制开启。
 *   打包后的应用默认关闭，生产行为零变化。
 * - 位置：`<全局数据根>/debug/llm-probe-<YYYY-MM-DD>.jsonl`，一天一个文件，
 *   每行一条 JSON（request / response 两条一组，用 `sequence` 关联）。
 *
 * ## 纪律
 *
 * 探针**只做诊断**：任何异常都必须被吞掉，绝不改变生成结果、耗时特征或
 * IPC 返回值 —— 与 `recordProviderOutcome` 同一原则。
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { LLMFinishReason, LLMRequest, TokenUsage } from '../../src/shared/ipc-channels'
import { getGlobalDataRoot } from './app-data-locator'

const PROBE_DIRECTORY = 'debug'
/** 单条记录落盘字符上限：整份大纲可以把一次请求推到几万 token，避免写爆文件。 */
const MAX_RECORD_CHARS = 2_000_000

/** `# 情节大纲` / `# Plot Outline` —— 出现即说明这份 prompt 里带了大纲正文。 */
const PLOT_OUTLINE_TITLE = /^#{1,3}[\t ]*(?:情节大纲|Plot Outline)[\t ]*$/mu
/** 章级条目：`## 第12章：` / `## Chapter 12:`。计数是区分「整份注入 vs 按章切片」的杀手指标。 */
const CHAPTER_ENTRY = /^[\t ]*(?:#{1,6}[\t ]+)?(?:第[\t ]*([0-9]+)[\t ]*章|Chapter[\t ]+([0-9]+))(?=[\t ]*[：:])/gmu
/** 弧光结构标志。 */
const ARC_MARKERS = /(?:【篇幅预算】|^#{2,4}[\t ]*(?:大弧|Major arc)|^#{3,5}[\t ]*(?:中弧|Mid arc))/gmu
/** 章节蓝图的结构化字段名。 */
const BLUEPRINT_FIELDS = /"(?:keyEvents|suspenseHook|purpose|relationships)"[\t ]*:/gu
/** 正文提示词里的「本章蓝图」小节标题。 */
const BLUEPRINT_HEADING = /(?:【本章写作方向与核心任务】|\[Chapter brief\])/u

export type LlmProbePurposeKind = 'arc' | 'outline' | 'blueprint' | 'draft' | 'other'

export type LlmProbeTransport = 'invoke' | 'stream'

/** 一次请求的可核对信号。人工判读只看这一段就够。 */
export interface LlmProbeSignals {
  /** 全部 message 的字符数合计。 */
  chars: number
  /** 每条 message 的角色与字符数，用来定位「大纲占了多少」。 */
  messageSizes: Array<{ role: string; chars: number }>
  /** prompt 里出现的章级条目次数。 */
  chapterEntries: number
  /** 第一条 / 最后一条章级条目的章号（无则 null）。 */
  firstChapter: number | null
  lastChapter: number | null
  /** 是否出现 `# 情节大纲` 标题。 */
  hasPlotOutlineTitle: boolean
  /** 弧光结构标志出现次数。 */
  arcMarkers: number
  /** 章节蓝图字段出现次数。 */
  blueprintFields: number
  /** 是否出现正文侧的「本章写作方向与核心任务」小节。 */
  hasBlueprintHeading: boolean
}

export interface LlmProbeHandle {
  sequence: number
  startedAt: number
  purpose: string | null
  purposeKind: LlmProbePurposeKind
}

let sequence = 0
let cachedFilePath: { day: string; path: string } | null = null
let warned = false

export function isLlmProbeEnabled(): boolean {
  const value = process.env.AI_NOVEL_LLM_PROBE?.trim().toLowerCase()
  if (value) return !['0', 'false', 'off', 'no'].includes(value)
  // 未显式设置时：**dev 默认开启**。忘了设环境变量是最常见的失败模式 ——
  // 2026-10-11 首次实机观察就因此一条数据都没拿到。
  // 打包后的应用里 VITE_DEV_SERVER_URL 不存在 → 默认关闭，生产行为零变化。
  return Boolean(process.env.VITE_DEV_SERVER_URL)
}

/** 用途分类：决定「这次请求按设计应该看到什么」。 */
export function classifyLlmProbePurpose(purpose: string): LlmProbePurposeKind {
  if (/^chapter-blueprint/u.test(purpose)) return 'blueprint'
  if (/^plot-outline/u.test(purpose)) return 'outline'
  if (/^chapter-draft/u.test(purpose)) return 'draft'
  if (/arc|plot-structure|stage-structure/u.test(purpose)) return 'arc'
  return 'other'
}

/** 从 messages 提取判读信号。纯函数，可单测。 */
export function inspectLlmProbeMessages(
  messages: readonly { role: string; content: string }[],
): LlmProbeSignals {
  const full = messages.map(message => message.content).join('\n')
  const chapters = [...full.matchAll(CHAPTER_ENTRY)].map(match => Number(match[1] ?? match[2]))
  return {
    chars: full.length,
    messageSizes: messages.map(message => ({ role: message.role, chars: message.content.length })),
    chapterEntries: chapters.length,
    firstChapter: chapters.length ? chapters[0]! : null,
    lastChapter: chapters.length ? chapters[chapters.length - 1]! : null,
    hasPlotOutlineTitle: PLOT_OUTLINE_TITLE.test(full),
    arcMarkers: [...full.matchAll(ARC_MARKERS)].length,
    blueprintFields: [...full.matchAll(BLUEPRINT_FIELDS)].length,
    hasBlueprintHeading: BLUEPRINT_HEADING.test(full),
  }
}

/** 记录一次请求。返回的 handle 交给 `probeLlmResponse` 关联响应。 */
export function probeLlmRequest(
  request: LLMRequest,
  transport: LlmProbeTransport,
): LlmProbeHandle | null {
  if (!isLlmProbeEnabled()) return null
  const startedAt = Date.now()
  const purpose = request.purpose?.trim() || null
  const purposeKind = classifyLlmProbePurpose(purpose ?? '')
  const handle: LlmProbeHandle = { sequence: ++sequence, startedAt, purpose, purposeKind }
  try {
    const clamped = clampMessages(request.messages)
    writeProbeRecord({
      v: 1,
      ts: new Date(startedAt).toISOString(),
      kind: 'request',
      sequence: handle.sequence,
      transport,
      purpose,
      purposeKind,
      modelId: request.modelId,
      projectPath: request.projectSession?.projectPath ?? null,
      signals: inspectLlmProbeMessages(request.messages),
      truncated: clamped.truncated,
      messages: clamped.messages,
    })
  } catch (error) {
    warnOnce(error)
  }
  return handle
}

/** 记录一次响应。`handle` 为 null（探针未开）时直接返回。 */
export function probeLlmResponse(
  handle: LlmProbeHandle | null,
  outcome: {
    content?: string
    finishReason?: LLMFinishReason | string
    usage?: TokenUsage
    error?: string
  },
): void {
  if (!handle) return
  try {
    const content = outcome.content ?? ''
    const truncated = content.length > MAX_RECORD_CHARS
    writeProbeRecord({
      v: 1,
      ts: new Date().toISOString(),
      kind: 'response',
      sequence: handle.sequence,
      purpose: handle.purpose,
      purposeKind: handle.purposeKind,
      durationMs: Date.now() - handle.startedAt,
      contentChars: content.length,
      content: truncated ? content.slice(0, MAX_RECORD_CHARS) : content,
      finishReason: outcome.finishReason ?? null,
      usage: outcome.usage ?? null,
      error: outcome.error ?? null,
      truncated,
    })
  } catch (error) {
    warnOnce(error)
  }
}

function clampMessages(
  messages: readonly { role: string; content: string }[],
): { messages: Array<{ role: string; content: string; chars: number }>; truncated: boolean } {
  let remaining = MAX_RECORD_CHARS
  let truncated = false
  const output = messages.map(message => {
    const content = message.content.length <= remaining
      ? message.content
      : message.content.slice(0, Math.max(0, remaining))
    if (content.length < message.content.length) truncated = true
    remaining -= content.length
    return { role: message.role, content, chars: message.content.length }
  })
  return { messages: output, truncated }
}

function writeProbeRecord(record: Record<string, unknown>): void {
  const file = probeFilePath()
  if (!file) return
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8')
}

function probeFilePath(): string | null {
  const day = new Date().toISOString().slice(0, 10)
  if (cachedFilePath?.day === day) return cachedFilePath.path
  try {
    const directory = join(getGlobalDataRoot(), PROBE_DIRECTORY)
    mkdirSync(directory, { recursive: true })
    cachedFilePath = { day, path: join(directory, `llm-probe-${day}.jsonl`) }
    return cachedFilePath.path
  } catch {
    // 全局数据目录尚未就绪（启动早期）或不可写 —— 静默跳过，绝不打断生成。
    return null
  }
}

function warnOnce(error: unknown): void {
  if (warned) return
  warned = true
  console.warn('[AI Novel Writer] LLM 探针记录失败（不影响生成）。', error)
}
