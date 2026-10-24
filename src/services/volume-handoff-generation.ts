/**
 * 卷末交接单的**自动生成**（P1-2 期 2，2026-10-24）。
 *
 * ## 它解决什么
 *
 * 期 1 把「跨卷记忆」的通道建好了，但要求作者在每一卷结束时手填六项。真实写作里这一栏
 * 十有八九空着 —— 空着就等于跨卷仍是老样子。本模块用卷内各章的**定稿要点**
 * （`summary_snapshots.chapter_notes`）生成一份初稿，作者再改。
 *
 * ## 三条不变量（不许在实现里放松）
 *
 * 1. **只产初稿**：调用方写库时一律 `source='generated'`；已有 `source='author'` 的记录
 *    **永不覆盖**。判断在调用方（定稿步骤 / 面板）做，但两边必须调同一个
 *    `isAuthorOwnedHandoff`，不许各写一份 —— 这是作者半小时手改与一次模型调用之间
 *    唯一的闸门。
 * 2. **字数口径只有一个**：`volumeHandoffBodyChars` 直接复用注入侧的
 *    `renderVolumeHandoffSection(..., Number.MAX_SAFE_INTEGER)` 去掉前两行。
 *    生成侧另写一个计数器，就等于给自己造了一份「注入时才发现超了」的隐性缺陷。
 * 3. **不截半句**：超预算整条丢（与 `volume-handoff.ts:28-38` 的五条口径一致）。
 *    丢到只剩一项还超 ⇒ 整次生成判失败，**不写空壳**。空记录会占掉 `volume_id` 的
 *    UNIQUE 槽，并让注入侧渲染成空串 —— 作者会以为「生成成功但没生效」，比失败更难查。
 */
import type { ProjectSessionContext } from '../shared/ipc-channels'
import { renderPrompt } from '../shared/render-prompt'
import {
  renderVolumeHandoffSection,
  VOLUME_HANDOFF_MAX_CHARS,
  VOLUME_HANDOFF_MAX_DEBTS,
  VOLUME_HANDOFF_MAX_EVENTS,
  VOLUME_HANDOFF_MAX_ITEMS,
  type VolumeHandoffDefinition,
} from '../shared/volume-handoff'
import type { WritingLanguage } from '../shared/writing-language'
import { composePromptSystemRole } from './builtin-prompt-templates'
import { resolvePromptTemplate } from './prompt-templates'
import { generateStructuredJson } from './structured-json-call'

/** 内置模板 key（与 `generate_chapter_notes` 同族命名）。 */
export const VOLUME_HANDOFF_PROMPT_KEY = 'generate_volume_handoff'
/** 一次性调用的 purpose，进 `llm_calls` 便于事后取证。 */
export const VOLUME_HANDOFF_GENERATION_PURPOSE = 'volume-handoff-generate'

/**
 * 输入预算：卷内要点合计上限（字符）。
 *
 * 30 章要点实测常在 1.2–3 万字，加上模板与系统合同会挤爆 32k 窗口的本地模型。
 * 超了**整章丢最旧的**（见 `selectVolumeHandoffNotes`），但**末章必留** ——
 * 卷末状态只能从末章读出来。
 */
export const VOLUME_HANDOFF_INPUT_MAX_CHARS = 20_000

export interface VolumeHandoffDraft {
  worldState: string
  heroState: string
  events: string[]
  items: string[]
  debts: string[]
  openThread: string
}

export interface VolumeHandoffNotesEntry {
  chapterNumber: number
  chapterTitle?: string
  notes: string
}

export interface VolumeHandoffGenerationInput {
  volumeIndex: number
  volumeName?: string
  firstChapter: number
  lastChapter: number
  /** 调用方负责按区间过滤；本模块只做预算裁剪与排序。 */
  notes: readonly VolumeHandoffNotesEntry[]
  writingLanguage: WritingLanguage
}

export interface VolumeHandoffFittingReport {
  /** 正文行字数（与注入侧同一口径：不含节标题与说明句）。 */
  bodyChars: number
  /** 因条数上限被截掉的条数（不是因字数）。 */
  droppedByLimit: { events: number; items: number; debts: number }
  /** 因字数预算被整条丢掉的条目（按丢弃顺序，直接进日志）。 */
  droppedByBudget: string[]
}

export interface VolumeHandoffNotesCoverage {
  /** 实际进入提示词的章号（升序）。 */
  usedChapters: number[]
  /** 因输入预算被丢掉的章号（升序）。 */
  droppedChapters: number[]
  /** 区间内没有可用要点的章号（升序）。 */
  missingChapters: number[]
}

export interface VolumeHandoffNotesSelection {
  ok: boolean
  text: string
  coverage: VolumeHandoffNotesCoverage
  reason?: string
}

export type VolumeHandoffFitResult =
  | { ok: true; draft: VolumeHandoffDraft; report: VolumeHandoffFittingReport }
  | { ok: false; reason: string }

export type VolumeHandoffGenerationResult =
  | {
    ok: true
    draft: VolumeHandoffDraft
    report: VolumeHandoffFittingReport
    coverage: VolumeHandoffNotesCoverage
    /** 服务端不接受结构化输出、已按普通补全重试成功。界面要明示。 */
    degraded: boolean
  }
  | { ok: false; reason: string }

const EMPTY_DRAFT: VolumeHandoffDraft = {
  worldState: '', heroState: '', events: [], items: [], debts: [], openThread: '',
}

/**
 * 这份记录是不是作者亲手写的（⇒ 自动生成必须让路）。
 *
 * 放在这里而不是各调用方，是因为「作者版不可覆盖」只有一处判断才守得住：
 * 定稿步骤、面板按钮、将来的批量重生成都必须问同一个函数。
 */
export function isAuthorOwnedHandoff(handoff: Pick<VolumeHandoffDefinition, 'source'> | null | undefined): boolean {
  return handoff?.source === 'author'
}

/**
 * 唯一计数口径：走注入侧同一个渲染函数，取「不含节标题与说明句」的部分。
 *
 * 用 `Number.MAX_SAFE_INTEGER` 作上限 ⇒ 不会出现省略行 ⇒ 量到的就是纯内容字数。
 * 因此「这里 ≤ 1500」等价于「注入时一条都不会被丢」。
 */
export function volumeHandoffBodyChars(draft: VolumeHandoffDraft): number {
  const section = renderVolumeHandoffSection(previewOf(draft), 'zh-CN', 1, Number.MAX_SAFE_INTEGER)
  return section ? section.split('\n').slice(2).join('\n').length : 0
}

/** 只用于渲染/计数的一份占位记录：字段值全来自 draft，区间与来源不参与正文行。 */
function previewOf(draft: VolumeHandoffDraft): VolumeHandoffDefinition {
  return {
    handoffId: '',
    volumeId: '',
    volumeIndex: 1,
    firstChapter: 1,
    lastChapter: 1,
    boundaryBasis: 'actual',
    worldState: draft.worldState,
    heroState: draft.heroState,
    events: draft.events,
    items: draft.items,
    debts: draft.debts,
    openThread: draft.openThread,
    source: 'generated',
    createdAt: '',
    updatedAt: '',
  }
}

function jsonCandidate(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/u)
  const body = fenced ? fenced[1] : raw
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : null
}

/**
 * 把模型输出解析成六项。**不可读 ⇒ `null`**（调用方据此判失败），
 * 但单个字段类型不对只丢那一项 —— 不能因为 events 写成了字符串就整份作废。
 */
export function parseVolumeHandoffDraft(raw: string): VolumeHandoffDraft | null {
  const candidate = jsonCandidate(raw)
  if (!candidate) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  const one = (key: string) => (typeof record[key] === 'string' ? (record[key] as string).trim() : '')
  const many = (key: string) => (Array.isArray(record[key])
    ? (record[key] as unknown[]).map(value => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    : [])
  // 六个键一个都不认识 ⇒ 这不是交接单（别把别的 JSON 当成功）。
  const keys = ['worldState', 'heroState', 'events', 'items', 'debts', 'openThread']
  if (!keys.some(key => key in record)) return null
  return {
    worldState: one('worldState'),
    heroState: one('heroState'),
    events: many('events'),
    items: many('items'),
    debts: many('debts'),
    openThread: one('openThread'),
  }
}

/** 按注入顺序的**反序**丢一条：注入侧是 `break`，尾巴先死。只整条丢，绝不截字符串。 */
function dropLowestPriority(draft: VolumeHandoffDraft): string | null {
  if (draft.openThread.trim()) {
    const value = draft.openThread
    draft.openThread = ''
    return value
  }
  if (draft.debts.length > 0) return draft.debts.pop() ?? null
  if (draft.items.length > 0) return draft.items.pop() ?? null
  if (draft.events.length > 0) return draft.events.pop() ?? null
  if (draft.heroState.trim()) {
    const value = draft.heroState
    draft.heroState = ''
    return value
  }
  if (draft.worldState.trim()) {
    const value = draft.worldState
    draft.worldState = ''
    return value
  }
  return null
}

/**
 * 裁到可注入：先按 5/5/3 裁数组，再按字数预算逐条丢。
 *
 * 失败两种：`EMPTY`（裁完什么都不剩）与 `OVER_BUDGET`（单条自身就超 1500）。
 * 两者都**不写库** —— 见文件头第 3 条。
 */
export function fitVolumeHandoffDraft(input: VolumeHandoffDraft): VolumeHandoffFitResult {
  const draft: VolumeHandoffDraft = {
    worldState: input.worldState.trim(),
    heroState: input.heroState.trim(),
    events: input.events.map(value => value.trim()).filter(Boolean).slice(0, VOLUME_HANDOFF_MAX_EVENTS),
    items: input.items.map(value => value.trim()).filter(Boolean).slice(0, VOLUME_HANDOFF_MAX_ITEMS),
    debts: input.debts.map(value => value.trim()).filter(Boolean).slice(0, VOLUME_HANDOFF_MAX_DEBTS),
    openThread: input.openThread.trim(),
  }
  const droppedByLimit = {
    events: Math.max(0, input.events.filter(value => value.trim()).length - VOLUME_HANDOFF_MAX_EVENTS),
    items: Math.max(0, input.items.filter(value => value.trim()).length - VOLUME_HANDOFF_MAX_ITEMS),
    debts: Math.max(0, input.debts.filter(value => value.trim()).length - VOLUME_HANDOFF_MAX_DEBTS),
  }
  const droppedByBudget: string[] = []
  // 裁剪前是否有内容：用来区分「本来就空」与「单条太大、全被丢掉」。
  const hadContent = volumeHandoffBodyChars(draft) > 0
  let guard = 0
  while (volumeHandoffBodyChars(draft) > VOLUME_HANDOFF_MAX_CHARS) {
    const dropped = dropLowestPriority(draft)
    if (dropped === null) break
    droppedByBudget.push(dropped)
    if (++guard >= 256) break
  }
  const bodyChars = volumeHandoffBodyChars(draft)
  // 本来有内容、裁完却一件不剩 ⇒ 说明最后剩的那一条自身就超上限（逐条丢一定在能装下时停下）。
  if (bodyChars === 0) {
    return { ok: false, reason: hadContent ? 'VOLUME_HANDOFF_GENERATION_OVER_BUDGET' : 'VOLUME_HANDOFF_GENERATION_EMPTY' }
  }
  if (bodyChars > VOLUME_HANDOFF_MAX_CHARS) return { ok: false, reason: 'VOLUME_HANDOFF_GENERATION_OVER_BUDGET' }
  return { ok: true, draft, report: { bodyChars, droppedByLimit, droppedByBudget } }
}

function noteBlock(entry: VolumeHandoffNotesEntry, writingLanguage: WritingLanguage): string {
  const title = entry.chapterTitle?.trim()
  const head = writingLanguage === 'en-US'
    ? `### Chapter ${entry.chapterNumber}${title ? ` ${title}` : ''}`
    : `### 第${entry.chapterNumber}章${title ? ` ${title}` : ''}`
  return `${head}\n${entry.notes.trim()}`
}

/**
 * 选出能塞进输入预算的要点：**末章必留**，其余从新往旧装，装不下整章丢。
 *
 * `missingChapters` 报的是「区间内压根没有要点」的章 —— 与「因预算被丢」必须分开：
 * 前者要提示作者去补定稿要点，后者是本模块自己的取舍。
 */
export function selectVolumeHandoffNotes(input: {
  notes: readonly VolumeHandoffNotesEntry[]
  firstChapter: number
  lastChapter: number
  writingLanguage: WritingLanguage
  maxChars?: number
}): VolumeHandoffNotesSelection {
  const maxChars = input.maxChars ?? VOLUME_HANDOFF_INPUT_MAX_CHARS
  const blocks = [...input.notes]
    .filter(entry => Number.isSafeInteger(entry.chapterNumber) && entry.notes.trim())
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
    .map(entry => ({ entry, block: noteBlock(entry, input.writingLanguage) }))
  const coverageEmpty: VolumeHandoffNotesCoverage = { usedChapters: [], droppedChapters: [], missingChapters: [] }
  if (blocks.length === 0) {
    return { ok: false, reason: 'VOLUME_HANDOFF_NOTES_EMPTY', text: '', coverage: coverageEmpty }
  }
  const lastBlock = blocks[blocks.length - 1]
  if (lastBlock.block.length > maxChars) {
    return { ok: false, reason: 'VOLUME_HANDOFF_NOTES_OVER_BUDGET', text: '', coverage: coverageEmpty }
  }
  const kept = [lastBlock]
  const dropped: number[] = []
  let used = lastBlock.block.length
  for (let index = blocks.length - 2; index >= 0; index -= 1) {
    const candidate = blocks[index]
    const cost = candidate.block.length + 2
    if (used + cost > maxChars) {
      dropped.push(candidate.entry.chapterNumber)
      continue
    }
    kept.unshift(candidate)
    used += cost
  }
  const usedChapters = kept.map(item => item.entry.chapterNumber)
  const usedSet = new Set([...usedChapters, ...dropped])
  const missingChapters: number[] = []
  for (let chapter = input.firstChapter; chapter <= input.lastChapter; chapter += 1) {
    if (!usedSet.has(chapter)) missingChapters.push(chapter)
  }
  return {
    ok: true,
    text: kept.map(item => item.block).join('\n\n'),
    coverage: { usedChapters, droppedChapters: [...dropped].sort((a, b) => a - b), missingChapters },
  }
}

const FAILURE_TEXT: Record<string, { zh: string; en: string }> = {
  VOLUME_HANDOFF_GENERATION_UNREADABLE: {
    zh: '模型输出不是可解析的交接单 JSON，本次没有生成。',
    en: 'The model output was not a parseable handoff JSON, so nothing was generated.',
  },
  VOLUME_HANDOFF_GENERATION_EMPTY: {
    zh: '模型没有给出任何一条可用的交接内容，本次没有生成。',
    en: 'The model returned no usable handoff content, so nothing was generated.',
  },
  VOLUME_HANDOFF_GENERATION_OVER_BUDGET: {
    zh: `单条内容本身就超过 ${VOLUME_HANDOFF_MAX_CHARS} 字上限，无法裁到可注入，本次没有生成。`,
    en: `A single item alone exceeds the ${VOLUME_HANDOFF_MAX_CHARS}-character limit, so nothing injectable was produced.`,
  },
  VOLUME_HANDOFF_GENERATION_CALL_FAILED: {
    zh: '模型调用失败，本次没有生成。',
    en: 'The model call failed, so nothing was generated.',
  },
  VOLUME_HANDOFF_NOTES_EMPTY: {
    zh: '本卷还没有可用的定稿要点，卷末交接单未生成（定稿「章节剧情要点」后可重试）。',
    en: 'This volume has no usable finalized chapter notes yet, so no handoff was generated.',
  },
  VOLUME_HANDOFF_NOTES_OVER_BUDGET: {
    zh: '本卷末章的要点就超过了输入上限，卷末交接单未生成。',
    en: 'The last chapter notes alone exceed the input budget, so no handoff was generated.',
  },
  VOLUME_HANDOFF_PROMPT_MISSING: {
    zh: '找不到卷末交接单的提示词模板，本次没有生成。',
    en: 'The handoff prompt template could not be found, so nothing was generated.',
  },
}

/** 失败原因 → 作者可读文案；未知原因原样返回（通常是已脱敏的 provider 摘要）。 */
export function describeVolumeHandoffFailure(reason: string, text: (zh: string, en: string) => string): string {
  const known = FAILURE_TEXT[reason]
  return known ? text(known.zh, known.en) : reason
}

/**
 * 生成一份初稿。**已知失败一律走返回值**（`{ok:false}`），不抛 ——
 * 调用方一个是 `critical:false` 的后处理步骤，一个是面板按钮，两者都要能就地降级。
 */
export async function generateVolumeHandoff(
  input: VolumeHandoffGenerationInput & {
    projectSession: ProjectSessionContext
    modelId?: string
    /** 只有测试与主进程侧需要替换传输；模板渲染、解析、裁剪仍走本函数。 */
    complete?: (messages: { system: string; user: string }) => Promise<string>
  },
): Promise<VolumeHandoffGenerationResult> {
  const selection = selectVolumeHandoffNotes({
    notes: input.notes,
    firstChapter: input.firstChapter,
    lastChapter: input.lastChapter,
    writingLanguage: input.writingLanguage,
  })
  if (!selection.ok) return { ok: false, reason: selection.reason ?? 'VOLUME_HANDOFF_NOTES_EMPTY' }

  const template = await resolvePromptTemplate(VOLUME_HANDOFF_PROMPT_KEY, input.projectSession, input.writingLanguage)
  if (!template) return { ok: false, reason: 'VOLUME_HANDOFF_PROMPT_MISSING' }

  const isEn = input.writingLanguage === 'en-US'
  const volumeLabel = isEn
    ? `Volume ${input.volumeIndex}${input.volumeName?.trim() ? ` · ${input.volumeName.trim()}` : ''}`
    : `第${input.volumeIndex}卷${input.volumeName?.trim() ? ` · ${input.volumeName.trim()}` : ''}`
  const chapterRange = isEn
    ? `chapters ${input.firstChapter}–${input.lastChapter}`
    : `第${input.firstChapter}–${input.lastChapter}章`
  const messages = {
    system: composePromptSystemRole(template, input.writingLanguage),
    user: renderPrompt(template, {
      volume_label: volumeLabel,
      chapter_range: chapterRange,
      volume_notes: selection.text,
    }, input.writingLanguage),
  }

  let content: string
  let degraded = false
  if (input.complete) {
    try {
      content = await input.complete(messages)
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
  } else {
    const outcome = await generateStructuredJson({
      messages: [{ role: 'system', content: messages.system }, { role: 'user', content: messages.user }],
      purpose: VOLUME_HANDOFF_GENERATION_PURPOSE,
      reasoningStage: 'review',
      projectSession: input.projectSession,
      ...(input.modelId ? { modelId: input.modelId } : {}),
    })
    if (!outcome.ok) {
      return { ok: false, reason: outcome.error?.trim() || 'VOLUME_HANDOFF_GENERATION_CALL_FAILED' }
    }
    content = outcome.content
    degraded = outcome.degraded
  }

  const parsed = parseVolumeHandoffDraft(content)
  if (!parsed) return { ok: false, reason: 'VOLUME_HANDOFF_GENERATION_UNREADABLE' }
  const fitted = fitVolumeHandoffDraft(parsed)
  if (!fitted.ok) return { ok: false, reason: fitted.reason }
  return { ok: true, draft: fitted.draft, report: fitted.report, coverage: selection.coverage, degraded }
}

export { EMPTY_DRAFT as EMPTY_VOLUME_HANDOFF_DRAFT }
