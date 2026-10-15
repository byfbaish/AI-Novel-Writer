import { chapterTimeContinuity } from '../../../shared/chapter-time-continuity'
import { keyEventsText } from '../../../shared/blueprint-key-events'
import { toBoundaryNotice } from '../../../shared/chapter-boundary'
import { appErrorMessage } from '../../../i18n/app-errors'
import { sanitizeDraftText, composeDraftVisibleContinuation, DRAFT_CONDENSE_PURPOSE, DRAFT_VISIBLE_TEXT_VERSION, isDraftVisibleTextVersion, type DraftVisibleTextVersion } from '../../../shared/draft-visible-text'
import { DRAFT_RECONCILE_PURPOSE, draftReconciliationBlock } from '../../../shared/draft-reconciliation'
import { DRAFT_SHORT_OUTLINE_PURPOSE, draftShortOutlinePrompt, draftShortOutlineBlock } from '../../../shared/draft-short-outline'
export { sanitizeDraftText } from '../../../shared/draft-visible-text'
import { synopsisSettingSectionsForDraft } from '../../../shared/synopsis-projection'
import { projectScopedText } from '../../../shared/text-scope-tags'
export { synopsisSettingSectionsForDraft } from '../../../shared/synopsis-projection'
import { createWorkflowMainGenerationRuntime, type WorkflowMainGenerationRequest } from '../workflow-main-generation'
import type { MainGenerationRunHandle } from '../../generation/generation-runtime'
import { formatResourceUri } from '../../../shared/project-paths'
import {
  BaseWorkflowCommand,
  injectWritingSkillIntoSession,
  injectWritingSkillIntoTask,
  type CommandExecuteParams,
  type LLMCompletion,
} from './base-command'
import { useLLMStore } from '../../../stores/llm-store'
import { useProjectStore } from '../../../stores/project-store'
import { hashAuthorText } from '../../../shared/source-ref'
import { resolvePromptTemplate } from '../../prompt-templates'
import type { PromptTemplate } from '../../builtin-prompt-templates'
import { ChapterPromptBuilder } from '../../prompts/prompt-builder'
import { pushTraceScope, runTraceScopeTeardown, type TraceScope } from '../../prompts/trace-scope'
import { ipc } from '../../ipc-client'
import { unwrapKnowledgeValue } from '../../knowledge-service'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../../shared/project-session-context'
import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import {
  requireWorkflowProjectSession,
  workflowUiText,
  workflowWritingLanguage,
} from '../workflow-project-session'
import {
  DIR_PROMPTS
} from '../../../shared/project-paths'
import type { ChapterInfo } from '../chapter-workflow'
import { normalizeChapterWordsTarget } from '../chapter-creation-parameters'
import {
  type CreateGenerationRuntimeOptions,
  type GenerationRuntime,
} from '../../generation/generation-runtime'
import type {
  GenerationAttemptReceipt,
  GenerationOutcome,
  GenerationSession,
} from '../../generation/generation-harness'
import type { WritingLanguage } from '../../../shared/writing-language'
import type { FinalizedContinuityProjection } from '../../../shared/finalized-continuity'
import type { NarrativeThreadView } from '../../../shared/narrative-thread'
import { promptLanguageText } from '../../prompt-language'
import { countDraftUnits, draftTargetUnitRange } from '../../../shared/draft-units'
import type { RecoveryChapterSource } from '../../../shared/recovery-candidate'
import { CHARACTER_STATE_TEXT_FIELDS } from '../../../shared/character-roster'
import {
  assembleChapterMaterials,
  ChapterMaterialCapacityError,
  type ChapterMaterialAssembly,
  type ChapterMaterialReference,
  type FinalizedMaterialSource,
  type SelectedCandidateDraft,
} from '../chapter-materials'
import type { DraftSourceDependency } from '../../../shared/draft-source-dependency'

export { countDraftUnits } from '../../../shared/draft-units'
export { previousChapterEnding } from '../chapter-materials'

const MAX_AUTO_CONTINUE_ROUNDS = 7
const NEXT_CHAPTER_HEAD_MAX_CHARS = 1200
const CROSS_CHAPTER_REUSE_CJK_NGRAM_CHARS = 8
const CROSS_CHAPTER_REUSE_ENGLISH_NGRAM_CHARS = 20
const CROSS_CHAPTER_REUSE_LONG_RUN_CHARS = 80
const ACTIVE_THREAD_CONTEXT_MAX_CHARS = 1200
const ACTIVE_THREAD_CONTEXT_MAX_ITEMS = 6
const STREAM_PREVIEW_INTERVAL_MS = 250

// 情节大纲的章级投影统一由 `src/shared/synopsis-projection.ts` 提供（见顶部 import/export）：
// 正文侧（设定层投影）与蓝图侧（三段切分投影）共用同一份章标题解析与失败姿态，
// 避免两处口径漂移。此处保留 re-export 以维持既有导入面（跨模块测试直接引用本模块）。

/**
 * 段落级去重指纹。
 *
 * 历史实现用「逐字节精确相等」判重，对「同内容不同 Markdown 形态」完全失效：
 * 旧版项目的 project_core.premise/worldbuilding/synopsis 是带 `#`/`##` 标题的
 * Markdown 大纲，而 novel_config.coreOutline/worldSetting 是同一份内容被剥掉
 * Markdown 标记后的纯文本，两侧切段后字符串永不相等 → 命中 0 段 → 设定整份
 * 注入两遍（实测约 13394 字节 / 占 prompt 26%）。
 *
 * 这里改为「规范化后比较」：只用于判等，不改变最终注入给模型的原文。
 * 仅剥离结构与格式差异（标题符号、列表符号、强调符、空白、标点、大小写），
 * 不做任何语义近似 —— 长度或措辞不同的段落一律视为不重复。
 */
function deduplicationFingerprint(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/^\s*#{1,6}\s*/gmu, '') // 去 Markdown 标题前缀
    .replace(/^\s*[-*+>]\s+/gmu, '') // 去列表 / 引用前缀
    .replace(/[*_`~]/gu, '') // 去行内强调 / 代码符号
    .replace(/[\s\p{P}\p{S}]+/gu, '') // 折叠空白与标点，只留实义字符
    .toLowerCase()
}

function splitParagraphs(content: string): string[] {
  return content.split(/\r?\n\s*\r?\n/u).map(paragraph => paragraph.trim()).filter(Boolean)
}

function paragraphFingerprints(values: readonly string[]): ReadonlySet<string> {
  const fingerprints = new Set<string>()
  for (const value of values) {
    for (const paragraph of splitParagraphs(value)) {
      const fingerprint = deduplicationFingerprint(paragraph)
      if (fingerprint) fingerprints.add(fingerprint)
    }
  }
  return fingerprints
}

function authoredFactFingerprints(values: readonly string[]): ReadonlySet<string> {
  const fingerprints = new Set<string>(paragraphFingerprints(values))
  // 整块指纹：某个作者配置字段整体就等于架构里的某一字段时，
  // 其内部单个段落可能换行方式不同而导致段级指纹不匹配；整块指纹兜住这种情况。
  for (const value of values) {
    const whole = deduplicationFingerprint(value)
    if (whole) fingerprints.add(whole)
  }
  return fingerprints
}

/**
 * 按规范化指纹剔除与作者配置重复的段落，并保留未重复段落的原文。
 * 只有「规范化后完全相等」才剔除；其余一律原样保留。
 */
function withoutDuplicateParagraphs(content: string, duplicates: ReadonlySet<string>): string {
  const kept = splitParagraphs(content).filter(paragraph => {
    const fingerprint = deduplicationFingerprint(paragraph)
    return !fingerprint || !duplicates.has(fingerprint)
  })
  // 若去重后只剩下「纯标题」这类结构残骸（其正文段落已被作者配置覆盖），
  // 该块不再贡献任何事实，整块省略，避免留下 `# 世界观` 这种孤立标题。
  if (kept.every(isHeadingOnlyParagraph)) return ''
  return kept.join('\n\n')
}

/** 段落在去掉 Markdown 标题符号后没有实义字符时，视为纯结构标记。 */
function isHeadingOnlyParagraph(paragraph: string): boolean {
  const withoutHeadingMarkers = paragraph.replace(/^\s*(?:#{1,6}|[-*+>])\s*/gmu, '').trim()
  return withoutHeadingMarkers.length === 0
}

/** 整块与作者配置相同（规范化后相等）时返回 true，用于整块级兜底。 */
function isFullyDuplicatedBlock(content: string, duplicates: ReadonlySet<string>): boolean {
  const fingerprint = deduplicationFingerprint(content)
  return Boolean(fingerprint) && duplicates.has(fingerprint)
}


const THINKING_TAGS = ['<think>', '</think>'] as const

/**
 * Convert the cumulative raw stream into safe provisional prose. A suffix that
 * could still become a thinking tag is withheld so split tags never flash in
 * the writing panel before the next chunk arrives.
 */
export function visibleDraftStreamText(rawText: string): string {
  const lower = rawText.toLowerCase()
  let safeEnd = rawText.length
  const longestTag = Math.max(...THINKING_TAGS.map(tag => tag.length))
  for (let length = 1; length < longestTag && length <= rawText.length; length += 1) {
    const suffix = lower.slice(-length)
    if (THINKING_TAGS.some(tag => tag.startsWith(suffix))) {
      safeEnd = rawText.length - length
    }
  }
  return sanitizeDraftText(rawText.slice(0, safeEnd))
}

function createDraftStreamPreview(
  replaceText: ((text: string) => void) | undefined,
  composeVisibleText: (rawText: string) => string,
  initialRenderedText = '',
): { push(chunk: string): void; snapshot(): string; stop(): void } {
  let active = true
  let rawText = ''
  let renderedText = initialRenderedText
  let lastRenderedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const render = () => {
    timer = undefined
    if (!active || !replaceText) return
    const nextText = composeVisibleText(rawText)
    if (nextText === renderedText) return
    renderedText = nextText
    lastRenderedAt = Date.now()
    replaceText(nextText)
  }

  return {
    push(chunk) {
      if (!active) return
      rawText += chunk
      if (!replaceText || timer) return
      if (lastRenderedAt === 0) {
        render()
        return
      }
      const delay = Math.max(0, STREAM_PREVIEW_INTERVAL_MS - (Date.now() - lastRenderedAt))
      timer = setTimeout(render, delay)
    },
    snapshot() {
      return composeVisibleText(rawText)
    },
    stop() {
      active = false
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}

export const DRAFT_GENERATION_BUDGET = Object.freeze({
  maxAttempts: 9,
  maxRequestedOutputTokens: 32_768,
  maxRequestedOutputTokensPerAttempt: 8192,
  deadlineMs: 20 * 60_000,
})

export interface GenerateDraftCommandDependencies {
  createRuntime(options: CreateGenerationRuntimeOptions, mainRequest?: WorkflowMainGenerationRequest): Promise<GenerationRuntime>
}

export interface GenerateDraftCommandOptions {
  /** Exact saved draft versions selected by this batch; never inferred as finalized history. */
  readonly selectedCandidateDrafts?: readonly SelectedCandidateDraft[]
  readonly resumeHandle?: MainGenerationRunHandle
  readonly batchId?: string
  readonly dependencies?: Partial<GenerateDraftCommandDependencies>
}

const DEFAULT_DEPENDENCIES: GenerateDraftCommandDependencies = {
  createRuntime: (_options, mainRequest) => {
    if (!mainRequest) throw new Error('DRAFT_MAIN_GENERATION_REQUEST_REQUIRED')
    return createWorkflowMainGenerationRuntime(mainRequest)
  },
}

/**
 * 渲染进 prompt 的章节蓝图投影。
 *
 * `keyEvents` 在此**收敛为「一行一条」文本** —— 结构化事件清单是领域契约，
 * 但写稿 prompt 的「必需事件」「authorInputs 指纹」都按文本消费（设计稿 §3 消费侧取值规则），
 * 因此投影后仍是字符串，写稿载荷与改造前逐字一致。
 */
type WriterChapterInfo = Omit<Pick<ChapterInfo,
  | 'chapterNumber'
  | 'title'
  | 'role'
  | 'purpose'
  | 'characters'
  | 'keyEvents'
  | 'suspenseHook'
  | 'userGuidance'
>, 'keyEvents'> & { keyEvents: string }

/** Keep workflow metadata out of both initial and continuation writer prompts. */
function toWriterChapterInfo(chapterInfo: ChapterInfo): WriterChapterInfo {
  return {
    chapterNumber: chapterInfo.chapterNumber,
    title: chapterInfo.title,
    role: chapterInfo.role,
    purpose: chapterInfo.purpose,
    characters: chapterInfo.characters,
    keyEvents: keyEventsText(chapterInfo.keyEvents),
    suspenseHook: chapterInfo.suspenseHook,
    userGuidance: chapterInfo.userGuidance,
  }
}

/**
 * P1 Phase 2 · 渲染进 prompt 的章节蓝图投影。
 *
 * 背景：`user_guidance` 在**初始请求**里会被渲染两次 ——
 * 一次是 `BasePromptBuilder.build()` 追加的内置模板 `systemSuffix`
 * 里的 ★【作者对本步骤的额外指导（最高优先级）】★ 块；
 * 一次是蓝图 JSON 的 `userGuidance` 字段（Phase 0 实测 D6 = 2）。
 *
 * 但**续写 / 压缩请求不走 `build()`**（它们由 `draftAuthorMaterialBlock` 手工拼装，
 * 只带【本章蓝图】JSON），那里没有 ★ 块，`userGuidance` 只能靠蓝图 JSON 承载。
 * 实测：初始请求 `usrStar=true`、续写 `usrStar=false usrGuide=false`。
 *
 * 因此按请求类型区分：
 * - 初始请求：模板已渲染 ★ 块 → 从蓝图投影里移除 `userGuidance`，收敛为 1 次；
 * - 续写 / 压缩：无 ★ 块 → 保留 `userGuidance`，否则作者指导会整段丢失。
 *
 * 注意：**不改 `toWriterChapterInfo` / `writerChapterInfo` 本身** ——
 * 它还用于 `authorInputs` 的恢复指纹（`JSON.stringify(writerChapterInfo)`），
 * 改动会让进行中的 resume handle 报 `GENERATION_DRAFT_RECOVERY_AUTHOR_INPUT_CHANGED`。
 * 这里只做「渲染投影」，影响面严格限制在 prompt 文本。
 */
function toBlueprintProjection(
  chapterInfo: WriterChapterInfo,
  options: { dropUserGuidance?: boolean } = {},
): Record<string, unknown> {
  if (!options.dropUserGuidance) return { ...chapterInfo }
  const { userGuidance: _userGuidance, ...rest } = chapterInfo
  return rest
}

function hasSubstantialPreviousChapterReuse(
  previousEnding: string,
  draft: string,
  writingLanguage: WritingLanguage,
): boolean {
  const ngramCharacters = writingLanguage === 'en-US'
    ? CROSS_CHAPTER_REUSE_ENGLISH_NGRAM_CHARS
    : CROSS_CHAPTER_REUSE_CJK_NGRAM_CHARS
  const normalize = (text: string) => text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
  const previous = normalize(previousEnding)
  const nextHead = normalize(draft.slice(0, NEXT_CHAPTER_HEAD_MAX_CHARS))
  if (previous.length < ngramCharacters || nextHead.length < ngramCharacters) {
    return false
  }

  const previousNgrams = new Set<string>()
  for (let index = 0; index <= previous.length - ngramCharacters; index += 1) {
    previousNgrams.add(previous.slice(index, index + ngramCharacters))
  }

  const covered = new Uint8Array(nextHead.length)
  for (let index = 0; index <= nextHead.length - ngramCharacters; index += 1) {
    if (!previousNgrams.has(nextHead.slice(index, index + ngramCharacters))) continue
    for (let offset = index; offset < index + ngramCharacters; offset += 1) {
      covered[offset] = 1
    }
  }

  let runLength = 0
  for (let index = 0; index <= covered.length; index += 1) {
    if (covered[index]) {
      runLength += 1
      continue
    }
    if (runLength >= CROSS_CHAPTER_REUSE_LONG_RUN_CHARS) return true
    runLength = 0
  }
  return false
}

function observeWorkflowCancellation(context: CommandExecuteParams['context']): {
  signal: AbortSignal
  dispose(): void
} {
  const controller = new AbortController()
  const timer = setInterval(() => {
    if (context.cancelled) controller.abort()
  }, 25)
  if (context.cancelled) controller.abort()
  return {
    signal: controller.signal,
    dispose: () => clearInterval(timer),
  }
}

/**
 * 生成尝试的预算日志。
 *
 * 语义澄清（避免误读）：一次物理请求涉及三个互不相同的量——
 * 1. 本次实际请求输出 requestedOutputTokens：模型本次被要求生成的输出量。
 * 2. 单次预留上限 reservedOutputTokens：为「模型能力未知」等预留的额度上限，
 *    与本次实际请求无关，常见远大于第 1 项（旧文案把它写成「租约请求上限」，
 *    导致用户误以为要生成 6 万多 token）。
 * 3. 本次输入估算上界 estimatedInputTokens：真正会推高成本的是输入，不是预留。
 * 累计行同样区分「实际请求累计」与「工作流总额度」。
 */
function logDraftAttempt(
  callbacks: CommandExecuteParams['callbacks'],
  context: CommandExecuteParams['context'],
  phase: { zhCN: string; enUS: string },
  receipt: GenerationAttemptReceipt,
): void {
  const { budget } = receipt
  const reservedOutputTokens = receipt.promptBudget?.reservedOutputTokens
  const estimatedInputTokens = receipt.promptBudget?.estimatedInputTokens
  const attemptLabel = `${budget.attempt}/${budget.maxAttempts}`
  callbacks.log(workflowUiText(
    context,
    `  ${phase.zhCN}：本次请求输出 ${budget.requestedOutputTokens} Tokens`
      + (typeof estimatedInputTokens === 'number' ? `；输入估算上界 ${estimatedInputTokens} Tokens` : '')
      + `；尝试 ${attemptLabel}`
      + `（单次预留上限 ${typeof reservedOutputTokens === 'number' ? reservedOutputTokens : budget.maxRequestedOutputTokensPerAttempt}`
      + `；本工作流累计请求 ${budget.cumulativeRequestedOutputTokens}/${budget.maxRequestedOutputTokens}）`,
    `  ${phase.enUS}: requested output ${budget.requestedOutputTokens} tokens`
      + (typeof estimatedInputTokens === 'number' ? `; estimated input upper bound ${estimatedInputTokens} tokens` : '')
      + `; attempt ${attemptLabel}`
      + ` (per-attempt reservation ${typeof reservedOutputTokens === 'number' ? reservedOutputTokens : budget.maxRequestedOutputTokensPerAttempt}`
      + `; workflow cumulative request ${budget.cumulativeRequestedOutputTokens}/${budget.maxRequestedOutputTokens})`,
  ))
}

function completionFromOutcome(outcome: GenerationOutcome): LLMCompletion {
  return { content: outcome.content, finishReason: outcome.finishReason, receipt: outcome.receipt }
}

function workflowGenerationModelId(context: CommandExecuteParams['context']): string | undefined {
  return context.generationModelId?.trim() || undefined
}

function recoveryFailureCode(error: unknown, cancelled: boolean): string {
  if (cancelled) return 'CANCELLED'
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 160)
  }
  return 'GENERATION_FAILED'
}

type DraftCandidate = { text: string; finishReason: 'stop' | 'length' }

function draftTooShortError(
  context: CommandExecuteParams['context'],
  units: number,
  targetUnits: number,
): Error {
  return new Error(workflowUiText(
    context,
    `模型已声明生成结束，但正文仅约 ${units}/${targetUnits} 字，明显未达到章节目标，结果未保存。` +
      '请提高最大输出 Tokens、降低本章目标字数，或改用输出能力更强的模型后重试。',
    `The model reported completion, but the draft is only about ${units}/${targetUnits} units and clearly misses the chapter target, so it was not saved. ` +
      'Increase the maximum output tokens, lower the chapter target, or use a model with greater output capacity and try again.',
  ))
}

function chapterLengthContractText(writingLanguage: WritingLanguage, targetUnits: number): string {
  const { minimum, maximum } = draftTargetUnitRange(targetUnits)
  const aimLow = Math.round(targetUnits * 0.85)
  return promptLanguageText(
    writingLanguage,
    `【本章篇幅合同】\n目标 ${targetUnits} 字（按汉字计，不含标点）；请写到约 ${aimLow}–${targetUnits} 字。${maximum} 字是参考上限，超出时只提示并保留完整正文；少于 ${minimum} 字会被退回。篇幅紧张时，压缩描写与过渡、减少场景数量，而不是删掉必需事件；本章蓝图中的全部作者任务和必需事件都要落实，不得删除、改写或截断，也不要为凑字数增加无关内容。`,
    `[Chapter length contract]\nTarget: ${targetUnits} words (counted as words, excluding punctuation); aim for about ${aimLow}-${targetUnits} words. ${maximum} words is a reference maximum; longer complete drafts are kept with a notice. Drafts under ${minimum} words are rejected. When space is tight, compress description and transitions and use fewer scenes rather than dropping required events; realize every author task and required event in the chapter blueprint without deleting, rewriting, or truncating them, and do not add unrelated content to fill space.`,
  )
}

/**
 * P1 Phase 1 · 判断生效模板是否会把「本章信息」渲染进请求。
 *
 * `chapterExecutionContractText().authorItems`（作者原文重列）是**兜底**：
 * 当自定义模板删掉了 `{{chapter_info}}` 占位符时，作者三个字段（必需事件/章节钩子/作者本章指导）
 * 就只剩这一处呈现，必须注入。
 *
 * 但内置模板（first/next_chapter_draft）都含 `{{chapter_info}}`，
 * 且其 JSON 已逐字包含同样的三个字段 —— 此时再注入 authorItems 就是**同一份作者原文在同一轮请求里装两遍**
 * （Phase 0 实测 D1：初始与续写各 2 次）。
 *
 * 所以统一按「模板是否渲染 chapter_info」来决定是否注入兜底，而不是无条件注入。
 */
function templateRendersChapterInfo(template: Pick<PromptTemplate, 'content' | 'systemSuffix' | 'taskGuidance'>): boolean {
  return [template.content, template.systemSuffix, template.taskGuidance]
    .some(section => typeof section === 'string' && section.includes('{{chapter_info}}'))
}

/**
 * 固定解释规则与作者原文分开角色；规则仅按写作语言和是否有前驱分支。
 * 首稿、续写、压缩和历史恢复共用规则，但不扩大各次请求的操作范围。
 */
function chapterExecutionContractText(writingLanguage: WritingLanguage, chapterInfo: WriterChapterInfo): {
  rules: string
  authorItems: string
} {
  const executionItems = [
    { zhCN: '必需事件', enUS: 'Required events', value: chapterInfo.keyEvents },
    { zhCN: '章节钩子', enUS: 'Chapter hook', value: chapterInfo.suspenseHook },
    { zhCN: '作者本章指导', enUS: 'Author guidance for this chapter', value: chapterInfo.userGuidance },
  ]
  const zhItems = executionItems.flatMap(item => item.value?.trim() ? [`- ${item.zhCN}: ${item.value}`] : []).join('\n')
  const enItems = executionItems.flatMap(item => item.value?.trim() ? [`- ${item.enUS}: ${item.value}`] : []).join('\n')
  const hasPredecessor = chapterInfo.chapterNumber > 1
  const rules = promptLanguageText(
    writingLanguage,
    `【本章执行合同】
【作者本章任务】按作者原文含义遵循：明确要求在本章发生的事件与收束须由正文动作或结果落实；持续状态、知情边界、禁止事项和文风要求是叙述约束，不要仅为证明遵守而新增或反复确认动作、对话或解释。悬念按原文揭示时点处理，留待后文的事不得提前写成已完成；作者明确要求的回顾、回忆、动作、揭示或反复仍按原文执行。后一项动作必须承接正文实际形成的物品持有、人物知情和计划完成状态。
【本章可推进的事件】可以写与既有事实相容的新行动和结果；普通无代价情节无需增加代价。${hasPredecessor ? `
【前文已定稿事实】本章蓝图、章节计划或必需事件的措辞与已定稿章节中确立的事实（包括作者在定稿中的最新更正）冲突时，以定稿事实为准：按与定稿事实一致的方式落实该条目，不得把已撤回、取消或被取代的计划追溯写成已执行。人物身份、物品持有、人物知情、付款与收回及事件时点应承接前文；付款、收回、失去等状态改变必须按事件先后写清，不能把同一笔钱款或物品同时写成已收回与仍然失去。
【前文计划与本章决定】人物的等待、暂停或撤回是当时的计划状态，不是作者禁令；本章可以先写出人物基于既有事实作出的新决定、理由及连续性依据，再推进或替换计划，但不能违反作者明确禁令、必需呈现或既成事实。
【本章事件兑现】作者或本章蓝图要求在本章发生的事件，必须在本章通过具体行动及其实际后果发生；复述、确认或记账前章已发生的结果不能替代本章要求发生的动作或结果。
【前文待核实问题】定稿只发现疑点、提出猜测或写明待核实时，不能把某一解释、原因或哪一方出错写成已确认事实；本章可以通过新线索和调查推进并解决疑点，但须先写出与既有事实相容且足以支持结论的核验过程与证据，证据不足时保留疑点，结论的方向、时间和因果前后必须一致。
${chapterTimeContinuity('zh-CN')}` : ''}
【操作边界】本合同不扩大本次请求的操作范围：续写及无进展恢复只接续已有正文，不重写旧文；已达目标篇幅时只补完断句并收束。压缩只删减既有正文，不新增情节或修补缺失事件。`,
    `[Current-chapter execution contract]
[Author tasks for this chapter] Follow the author text according to its meaning: events and outcomes explicitly required in this chapter must be realized through manuscript action or outcome. Ongoing states, knowledge boundaries, prohibitions, and style requests are narrative constraints; do not add or repeatedly confirm actions, dialogue, or explanations merely to prove compliance. Follow the reveal timing specified by the author; do not present what is reserved for later chapters as already completed. Still carry out explicitly requested recollections, flashbacks, actions, reveals, or repetition. Each later action must continue from the item ownership, character knowledge, and plan-completion state actually established in the prose.
[Events this chapter may advance] New actions and outcomes consistent with established facts are allowed. Ordinary events need no added cost.${hasPredecessor ? `
[Established finalized facts] When the chapter blueprint, chapter plans, or the wording of required events conflict with facts established in finalized chapters (including the author's latest corrections in them), the finalized facts prevail: realize the item consistently and never retroactively portray a withdrawn, cancelled, or superseded plan as executed. Preserve identities, item ownership, character knowledge, payments and recoveries, and event times from prior prose. Keep the order and result of paying, recovering, or losing money or property consistent; do not describe the same amount or item as both recovered and still lost.
[Prior plans and current decisions] Characters' waiting, paused, or withdrawn plans describe their prior intention, not an author prohibition; this chapter may first show a new decision grounded in established facts, the character's reason, and continuity evidence, then advance or replace the plan without violating explicit author prohibitions, required on-page events, or completed facts.
[Required events in this chapter] Events required by the author or this chapter blueprint to happen in this chapter must happen through concrete action and actual consequence here; merely repeating, confirming, or accounting for an outcome already completed in an earlier chapter cannot replace the action or outcome required in this chapter.
[Unverified prior questions] If a finalized chapter only discovers a discrepancy, raises a suspicion, or leaves a question for verification, do not present an explanation, cause, or which side is wrong as confirmed. This chapter may pursue new clues and resolve the question, but first show a verification process and evidence sufficient for a conclusion consistent with established facts; otherwise keep it unresolved. The conclusion's direction, timing, and causality must remain consistent throughout.
${chapterTimeContinuity('en-US')}` : ''}
[Operation boundary] This contract does not expand the current request's scope: continuation and no-progress recovery only append to existing prose without rewriting it; at the target length, only finish the truncated sentence and close. Condensing only cuts existing prose and must not add plot or repair missing events.`,
  )
  return { rules, authorItems: promptLanguageText(writingLanguage, zhItems, enItems) }
}

/** 自动续写与压缩修订共用的作者资料块：本章蓝图、全局写作要求、文风、小说配置事实与章节材料。 */
function draftAuthorMaterialBlock(writingLanguage: WritingLanguage, material: {
  chapterInfo: WriterChapterInfo
  globalGuidance: string
  writingStyle: string
  novelConfigFacts: string
  chapterMaterials: string
  /** 生成前定稿对账注入块；无对账时为空。 */
  reconciliation?: string
  /**
   * 是否追加「作者原文重列」兜底（authorItems）。
   *
   * 本块开头的【本章蓝图】JSON 已逐字包含必需事件/章节钩子/作者本章指导三个字段，
   * 再拼一份 authorItems 就是同一轮内重复装载（Phase 0 实测 D1）。
   * 仅当本轮 system / 模板都未呈现这些字段时才需要兜底 → 默认不追加。
   */
  includeAuthorItemsFallback?: boolean
}): string {
  const reconciliation = material.reconciliation ? `${material.reconciliation}\n\n` : ''
  const authorItems = material.includeAuthorItemsFallback
    ? chapterExecutionContractText(writingLanguage, material.chapterInfo).authorItems
    : ''
  // 续写 / 压缩请求没有 ★ 额外指导★ 块（那只在 promptBuilder.build() 中渲染），
  // 故 blueprint JSON 必须继续承载 userGuidance，否则作者指导会整段丢失。
  const blueprintJson = JSON.stringify(toBlueprintProjection(material.chapterInfo), null, 2)
  return promptLanguageText(
    writingLanguage,
    `【本章蓝图】
${blueprintJson}

【全局写作要求】
${material.globalGuidance}

【文风要求】
${material.writingStyle || '（无）'}

【文风适用边界】
- 文风仅用于选择表达方式，不是新增事实或事件要求；无需逐条强行兑现。
- 作者明确事实与指导、实际前文、本章关键因果和本章篇幅优先。不得用文风改写这些内容或仅为兑现文风增加场景、动作或事件；不得把作者明确事实或要求降格为推测。

【小说配置事实】
${material.novelConfigFacts}

${material.chapterMaterials}

${reconciliation}${authorItems}`,
    `[Current chapter blueprint]
${blueprintJson}

[Project-wide writing guidance]
${material.globalGuidance}

[Writing style]
${material.writingStyle || '(none)'}

[Writing-style applicability]
- Writing style selects expression only; it adds no facts or events, and not every item must be forced into the manuscript.
- Explicit author facts and guidance, actual prior prose, the chapter's key causality, and its target length take priority. Do not use style guidance to rewrite them, relabel explicit author facts or requirements as guesses, or add scenes, actions, or events merely to satisfy style guidance.

[Novel configuration facts]
${material.novelConfigFacts}

${material.chapterMaterials}

${reconciliation}${authorItems}`,
  )
}

function recoveryChapterSource(chapter: ChapterInfo): RecoveryChapterSource {
  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    role: chapter.role,
    purpose: chapter.purpose,
    keyEvents: chapter.keyEvents,
    characters: [...chapter.characters],
    suspenseHook: chapter.suspenseHook ?? '',
    userGuidance: chapter.userGuidance ?? '',
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Join a visible continuation without allowing a repeated prompt tail to count as new prose. */
export function appendVisibleDraftContinuation(draft: string, continuation: string,
  version: DraftVisibleTextVersion = DRAFT_VISIBLE_TEXT_VERSION): string {
  return composeDraftVisibleContinuation(draft, continuation, version)
}

export class GenerateDraftCommand extends BaseWorkflowCommand {
  private readonly dependencies: GenerateDraftCommandDependencies
  private readonly selectedCandidateDrafts: readonly SelectedCandidateDraft[]
  private readonly resumeHandle?: MainGenerationRunHandle
  private readonly batchId?: string

  constructor(
    private chapterInfo: ChapterInfo,
    options: GenerateDraftCommandOptions = {},
  ) {
    super()
    this.dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies }
    this.resumeHandle = options.resumeHandle ? Object.freeze({ ...options.resumeHandle }) : undefined
    this.batchId = options.batchId
    this.selectedCandidateDrafts = Object.freeze([...(options.selectedCandidateDrafts ?? [])])
  }

  async execute({ step, context, callbacks }: CommandExecuteParams): Promise<string> {
    const uiText = (zhCNText: string, enUSText: string) => workflowUiText(context, zhCNText, enUSText)
    const expectedProjectPath = this.chapterInfo.projectPath
    const projectSession = requireWorkflowProjectSession(context)
    const project = useProjectStore.getState().currentProject
    if (!project || !sameProjectSessionContext(
      projectSession,
      projectSessionContextFromProject(project),
    )) {
      throw new Error(uiText(
        '当前项目已切换，章节生成已停止',
        'The project changed, so chapter generation was stopped.',
      ))
    }
    const novelConfig = Object.freeze({ ...project.novelConfig })
    const writingLanguage = workflowWritingLanguage(context)
    const defaultMain = this.dependencies.createRuntime === DEFAULT_DEPENDENCIES.createRuntime
    const isFirstChapter = this.chapterInfo.chapterNumber === 1
    const templateKey = isFirstChapter ? 'first_chapter_draft' : 'next_chapter_draft'
    const writerChapterInfo = toWriterChapterInfo(this.chapterInfo)
    const targetChars = normalizeChapterWordsTarget(this.chapterInfo.wordsTarget, novelConfig.wordsPerChapter)
    const knowledgeQueryHint = this.chapterInfo.knowledgeQueryHint?.trim() ?? ''
    const searchQuery = [knowledgeQueryHint, this.chapterInfo.title, keyEventsText(this.chapterInfo.keyEvents),
      this.chapterInfo.characters.join(' ')].filter(Boolean).join(' ')
    const authorInputs = [{ id: 'draft:chapter-info', text: JSON.stringify(writerChapterInfo) },
      { id: 'draft:author-config', text: JSON.stringify(novelConfig) },
      { id: 'draft:target-units', text: String(targetChars) }]
    const earlyRecovery = defaultMain && this.resumeHandle
      ? await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: this.resumeHandle }) : null
    if (earlyRecovery?.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
    if (earlyRecovery?.draftSave.kind === 'current') {
      const saved = earlyRecovery.draftSave.receipt
      if (earlyRecovery.operation !== 'chapter-draft' || earlyRecovery.chapterNumber !== this.chapterInfo.chapterNumber
        || saved.contentHash !== await sha256Hex(saved.content)) throw new Error('GENERATION_DRAFT_RECOVERY_SCOPE_INVALID')
      this.assertNotCancelled(context)
      context.mainGenerationRunHandle = this.resumeHandle
      return this.publishSavedDraft({ context, callbacks, projectSession, expectedProjectPath,
        cleanDraftText: saved.content, id: saved.id, nextVersion: saved.version, mergedGuidance: '',
        targetChars: Number(earlyRecovery.authorInputs.find(input => input.id === 'draft:target-units')?.text) })
    }
    if (defaultMain) context.generationModelId = workflowGenerationModelId(context) || useLLMStore.getState().defaultModelId || undefined
    const prepared = defaultMain && !this.resumeHandle
      ? await ipc.invokeWithProjectSession(projectSession, 'generation:prepare-draft-context', {
        chapterNumber: this.chapterInfo.chapterNumber, modelId: context.generationModelId!,
        promptKeys: [templateKey], skillStages: ['drafting'], authorInputs, query: searchQuery,
        selectedDraftIds: [...new Set(this.selectedCandidateDrafts.filter(item => item.chapterNumber < this.chapterInfo.chapterNumber).map(item => item.draftId))],
        ...(this.batchId ? { batchId: this.batchId } : {}),
      }).catch(error => {
        const code = error instanceof Error ? /(?:^|:\s)(KNOWLEDGE_BASE_NATIVE_UNAVAILABLE|LEGACY_VECTOR_MIGRATION_BLOCKED)$/u.exec(error.message)?.[1] : undefined
        if (code) throw Object.assign(new Error(appErrorMessage(context.uiLocale ?? 'zh-CN', { code })), { code })
        throw error
      }) : null
    const knowledgeSnapshot = prepared?.knowledgeSnapshot ?? earlyRecovery?.knowledgeSnapshot
    // Recovery uses the original main snapshot, including retrieval hints outside the writer prompt.
    if (defaultMain && (!knowledgeSnapshot || prepared && knowledgeSnapshot.query !== searchQuery))
      throw new Error('GENERATION_DRAFT_KNOWLEDGE_SNAPSHOT_REQUIRED')
    const sourceDraft = await ipc.invokeWithProjectSession(
      projectSession,
      'db:draft-get-latest',
      this.chapterInfo.chapterNumber,
      expectedProjectPath,
    )

    callbacks.log(uiText(
      '拼装章节上下文 (强类型注入中)...',
      'Building chapter context...',
    ))

    const { coreOutline, worldSetting, goldenFinger, protagonistProfile } = novelConfig
    const authoredConfigFacts = [coreOutline, worldSetting, goldenFinger, protagonistProfile]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    const architecture = await this.readArchitecture(
      expectedProjectPath,
      projectSession,
      authoredConfigFacts,
    )
    const projectPrompts = await this.readProjectPrompts(
      expectedProjectPath,
      projectSession,
      writingLanguage,
    )
    // 自由文本按步骤分区（段级标签）：正文链只取「正文」档与未标注段。
    // 两个来源（作者全局写作要求 / 项目级补充指导）是两段独立自由文本 → 标签各自生效，故先投影再合并。
    // 无标签时 `projectScopedText` 逐字返回原文，旧项目行为不变。
    const mergedGuidance = [
      projectScopedText(novelConfig.globalGuidance?.trim() || '', 'draft').text,
      projectScopedText(projectPrompts, 'draft').text,
    ].filter(Boolean).join('\n\n')

    const characterProfilesResult = await this.readCharacterProfiles(
      expectedProjectPath,
      projectSession,
      writingLanguage,
      this.chapterInfo.characters,
    )
    const characterProfiles = characterProfilesResult.text
    if (characterProfilesResult.missingNames.length > 0) {
      // 数据缺口软提示：蓝图点名了角色，但名册里没有对应卡片。不阻断生成，
      // 只把缺口显式告知作者，避免「明明写了却没注入」的静默困惑。
      const missing = characterProfilesResult.missingNames.join('、')
      callbacks.log(uiText(
        `  提示：本章出场角色「${missing}」在角色名册里没有卡片，将不注入其档案。`
          + '如需其设定参与生成，请先为该角色创建角色卡。',
        `  Notice: chapter character(s) "${missing}" have no card in the character roster, so no profile was injected. `
          + 'Create a character card for them if their settings should inform this chapter.',
      ))
    }
    // P1-1：后续计划只作为「禁写边界」下发 —— 压成按章分组的事件要点，不再逐字搬全文。
    // 逐个后续章只给首句要点（上限 80 字），模型因此看不出「这件事长什么样」，只看到「别在本章做」。
    // 若一个后续蓝图都没有（或都无事件），保留兜底文案，块本身恒在（核心合同按名引用了它的标题）。
    let futureBlueprintsStr = promptLanguageText(
      writingLanguage,
      '（无后续蓝图）',
      '(no future chapter blueprints)',
    )
    try {
      const { loadDirectoryBlueprints } = await import('../directory-workflow')
      const allBlueprints = await loadDirectoryBlueprints(expectedProjectPath, projectSession)
      const futureBlueprintsArr = allBlueprints.filter(
        b => b.chapterNumber > this.chapterInfo.chapterNumber && b.chapterNumber <= this.chapterInfo.chapterNumber + 5
      )
      if (futureBlueprintsArr.length > 0) {
        const notice = toBoundaryNotice(writingLanguage, {
          chapters: futureBlueprintsArr.map(b => ({
            chapterNumber: b.chapterNumber,
            title: b.title,
            keyEvents: b.keyEvents,
          })),
        })
        if (notice) futureBlueprintsStr = notice
      }
    } catch { /* 忽略 */ }

    const template = await resolvePromptTemplate(templateKey, projectSession, writingLanguage)
    if (!template) throw new Error(uiText(
      `未找到模板: ${templateKey}`,
      `Template not found: ${templateKey}`,
    ))

    // ==========================================
    // Prompt 构建——按「稳定前缀 → 可变后缀」排列
    // 以最大化 LLM 上下文缓存命中率
    // ==========================================
    // 文风与参考作品同样走段级标签投影：两者都只在正文链注入（架构侧没有这两个槽位），
    // 打标签时按「正文」档取舍；不打标签则逐字不变。
    const writingStyle = projectScopedText(novelConfig.writingStyle?.trim() || '', 'draft').text
    // 参考作品与文风同属「表达层」配置：它们只影响怎么写，不影响写什么。
    // 单独成段注入（而非塞进 novel_config JSON），既让模型看清其「仅供借鉴」的边界，
    // 也避免与【不可偏离的作者事实】混为一谈。
    const referenceWorks = projectScopedText(novelConfig.referenceWorks?.trim() || '', 'draft').text
    const promptOnlyConfigKeys = new Set([
      'globalGuidance',
      'writingStyle',
      'referenceWorks',
      'coreOutline',
      'worldSetting',
      'goldenFinger',
      'protagonistProfile',
    ])
    const novelConfigFacts = Object.fromEntries(
      Object.entries(novelConfig).filter(([key]) => !promptOnlyConfigKeys.has(key)),
    )
    const novelConfigFactsJson = JSON.stringify(novelConfigFacts, null, 2)
    let knowledgeReferences: ChapterMaterialReference[] = []
    try {
      callbacks.log(uiText(
        '  检索知识库相关片段...',
        '  Searching the knowledge base for relevant passages...',
      ))
      if (knowledgeQueryHint) {
        callbacks.log(uiText(
          `  追加用户检索关键词：${knowledgeQueryHint}`,
          `  Added author search keywords: ${knowledgeQueryHint}`,
        ))
      }
      const results = defaultMain ? knowledgeSnapshot!.items : unwrapKnowledgeValue(await ipc.invokeWithProjectSession(
        projectSession,
        'kb:search-writing-context',
        searchQuery,
        5,
        expectedProjectPath,
      ))
      if (results.length > 0) {
        knowledgeReferences = results.map((result: { fileName: string; score: number; text: string }, index: number) => ({
          text: result.text,
          rendered: promptLanguageText(
            writingLanguage,
            `[${index + 1}] (${result.fileName}, 相关度 ${(result.score * 100).toFixed(0)}%)\n${result.text}`,
            `[${index + 1}] (${result.fileName}, relevance ${(result.score * 100).toFixed(0)}%)\n${result.text}`,
          ),
          deduplicateAgainstFinalized: true,
        }))
      } else {
        const emptyContext = promptLanguageText(writingLanguage, '（知识库中无相关内容）', '(no relevant knowledge-base context)')
        knowledgeReferences = [{ text: emptyContext, rendered: emptyContext }]
      }
    } catch {
      const unavailableContext = promptLanguageText(writingLanguage, '（知识库检索不可用）', '(knowledge-base search unavailable)')
      knowledgeReferences = [{ text: unavailableContext, rendered: unavailableContext }]
    }
    const chapterLengthContract = chapterLengthContractText(writingLanguage, targetChars)
    const promptBuilder = new ChapterPromptBuilder(template, writingLanguage)
      // ---- 缓存命中区（跨章稳定，前缀对齐）----
      .withArchitecture(architecture)
      .withGlobalGuidance(mergedGuidance)
      .withWritingStyle(writingStyle)
      .withReferenceWorks(referenceWorks)
      .withNovelConfig(novelConfigFactsJson)
      .withWordNumber(targetChars)
      // ---- 章节公共区（首章与后续章都必须完整注入）----
      // P1 Phase 2：初始请求的 ★额外指导★ 块（build() 追加的 systemSuffix）已承载 user_guidance，
      // 故蓝图 JSON 投影里不再重复携带，避免同一轮内逐字出现 2 次（Phase 0 实测 D6）。
      // 续写 / 压缩请求没有 ★ 块，走 draftAuthorMaterialBlock，那里保留 userGuidance。
      .withChapterInfo(toBlueprintProjection(writerChapterInfo, { dropUserGuidance: true }))
      .withCharacterStates('')
      .withFutureBlueprints('')
      .withFilteredContext('')
      .withUserGuidance(this.chapterInfo.userGuidance?.trim() || promptLanguageText(
        writingLanguage,
        '（无微操指导）',
        '(no author guidance)',
      ))

    let finalizedSources: FinalizedMaterialSource[] = []
    let activeThreadContext = ''
    if (!isFirstChapter) {
      const finalized = await this.readFinalizedMaterials(
        expectedProjectPath,
        this.chapterInfo.chapterNumber,
        projectSession,
        this.chapterInfo.characters,
      )
      finalizedSources = finalized.sources
      callbacks.log(uiText(
        `  已定位定稿连续性原文（${finalized.locatedFactCandidates} 条候选）`,
        `  Located finalized continuity excerpts (${finalized.locatedFactCandidates} candidates)`,
      ))
      const activeThreads = await this.readActiveNarrativeThreads(
        expectedProjectPath,
        projectSession,
        writingLanguage,
      )
      callbacks.log(uiText(
        `  已加载相关活跃叙事线索（${activeThreads.count} 条）`,
        `  Loaded relevant active narrative threads (${activeThreads.count})`,
      ))
      activeThreadContext = activeThreads.text
      promptBuilder
        // Old summaries, currentState and previous-ending slots stay empty. One
        // source-labelled material package is appended below.
        .withGlobalSummary('')
        .withPreviousEnding('')
        .withShortSummary('')
    }

    if (defaultMain && earlyRecovery?.selectedDraftIds.length && !earlyRecovery.selectedDrafts)
      throw new Error('GENERATION_DRAFT_SOURCE_CHANGED')
    const explicitlyRequiredDraftIds = new Set(this.selectedCandidateDrafts
      .filter(candidate => candidate.required === true).map(candidate => candidate.draftId))
    const selectedCandidateDrafts = (defaultMain ? prepared?.selectedDrafts ?? earlyRecovery?.selectedDrafts ?? [] : this.selectedCandidateDrafts)
      .filter(candidate => candidate.chapterNumber < this.chapterInfo.chapterNumber)
      .map(candidate => explicitlyRequiredDraftIds.has(candidate.draftId) && candidate.required !== true
        ? { ...candidate, required: true }
        : candidate)
      .sort((left, right) => left.chapterNumber - right.chapterNumber)
    const previousChapterNumber = this.chapterInfo.chapterNumber - 1
    const hasRequiredPreviousCandidate = selectedCandidateDrafts.some(candidate => (
      candidate.chapterNumber === previousChapterNumber && Boolean(candidate.content.trim())
    ))
    const requiredFinalizedSource = finalizedSources.find(source => (
      source.chapterNumber === previousChapterNumber
      && source.sourceStatus !== 'invalid'
      && Boolean(source.content.trim())
    ))
    if (!isFirstChapter && !hasRequiredPreviousCandidate && !requiredFinalizedSource) {
      throw new Error(uiText(
        `无法固定第 ${previousChapterNumber} 章的必需定稿来源，已停止生成。请修复或重新定稿该章后再试。`,
        `The required finalized source for Chapter ${previousChapterNumber} could not be fixed, so generation stopped. Repair or re-finalize that chapter and try again.`,
      ))
    }
    let chapterMaterials: ChapterMaterialAssembly
    try {
      chapterMaterials = await assembleChapterMaterials({
        identity: { projectId: projectSession.projectId, epoch: projectSession.leaseId },
        writingLanguage,
        budgetChars: 8_000,
        authorProjectFacts: authoredConfigFacts,
        characterProfiles,
        futurePlans: futureBlueprintsStr,
        references: [
          ...(activeThreadContext ? [{ text: activeThreadContext, rendered: activeThreadContext }] : []),
          ...knowledgeReferences,
        ],
        finalized: finalizedSources,
        candidates: selectedCandidateDrafts,
        relevanceTerms: [
          this.chapterInfo.title,
          keyEventsText(this.chapterInfo.keyEvents),
          ...this.chapterInfo.characters,
        ],
      })
    } catch (error) {
      if (!(error instanceof ChapterMaterialCapacityError)) throw error
      const blocked = error.decision.decision === 'capacity-conflict'
        ? `${error.decision.blockingSourceId}:${error.decision.blockingReason}`
        : error.decision.remainingRequired.join('、')
      callbacks.log(uiText(
        `  必需材料超出上下文容量（${error.decision.decision}）：${blocked}`,
        `  Required material exceeds the context capacity (${error.decision.decision}): ${blocked}`,
      ))
      throw new Error(uiText(
        '本章必需材料（作者资料、角色档案、后续计划、上一章正文）超出上下文容量，已停止生成。请精简这些内容后重试。',
        'The required material for this chapter (author facts, character profiles, future plans, previous chapter prose) exceeds the context capacity, so generation stopped. Trim it and try again.',
      ))
    }
    const admittedCandidateSourceIds = new Set(chapterMaterials.selection.included
      .map(material => material.ref.sourceId)
      .filter(sourceId => sourceId.startsWith('candidate:')))
    if (selectedCandidateDrafts.length > 0 && admittedCandidateSourceIds.size === 0) {
      throw new Error('GENERATION_DRAFT_REQUIRED_PREDECESSOR_NOT_ADMITTED')
    }
    if (selectedCandidateDrafts.length === 0 && requiredFinalizedSource
      && !chapterMaterials.selection.included.some(material => material.ref.sourceId === `finalized:${requiredFinalizedSource.draftId}`)) {
      throw new Error('GENERATION_DRAFT_REQUIRED_PREDECESSOR_NOT_ADMITTED')
    }
    if (chapterMaterials.omissions.length > 0) {
      callbacks.log(uiText(
        `  可选材料覆盖缺口：${chapterMaterials.omissions.length} 项`,
        `  Optional material coverage gaps: ${chapterMaterials.omissions.length}`,
      ))
    }
    // 仅历史恢复沿用已记录的对账块；新 run 直接使用作者材料与定稿事实。
    const chapterExecutionContract = chapterExecutionContractText(writingLanguage, writerChapterInfo)
    const systemRole = `${promptBuilder.getSystemRole()}\n\n${chapterExecutionContract.rules}`
    // P1 Phase 1：生效模板已渲染 {{chapter_info}}（其 JSON 逐字含作者三字段）时，
    // 不再追加 authorItems 兜底，避免同一份作者原文在同一轮请求里装两遍。
    const templateCoversAuthorFields = templateRendersChapterInfo(template)
    const authorItemsFallback = templateCoversAuthorFields ? '' : chapterExecutionContract.authorItems
    const composeInitialPrompt = (reconciliationBlock: string) => [chapterMaterials.text, promptBuilder.build(),
      reconciliationBlock, authorItemsFallback, chapterLengthContract]
      .filter(Boolean)
      .join('\n\n')
    const prompt = composeInitialPrompt('')
    const previousEnding = chapterMaterials.previousEnding
    // P0-1：短细纲只喂该步材料。此前它直接吃 `prompt`（整份初始正文 prompt，实测
    // 16,736 字：全书设定池 5,049 / 参考作品 3,071 / 文风要求 1,492 / 全局写作要求 315 /
    // 篇幅合同 / 黄金第一章法则 / AI 味反制…），而这一步的调用**没有 system 消息** ——
    // 模型看到的唯一输入就是「指令 + 正文写作材料」，材料形态本身在教它写散文
    //（实测输出 1,747 字）。取舍与裁定见 docs/design/p0-1-short-outline-scoping-design.md §6。
    const outlinePrompt = draftShortOutlinePrompt(writingLanguage, {
      // 本步没有 system 消息，作者本章指导只能靠蓝图 JSON 承载 → 不 drop userGuidance。
      chapterInfo: JSON.stringify(toBlueprintProjection(writerChapterInfo), null, 2),
      // 前驱取上一章**定稿**原文（作者裁定给全文）；首章、或前驱仍是未定稿候选时退回
      // 结尾摘录 —— 宁可少给，也不把未定稿候选当成已确立事实喂进"计划"。
      predecessor: chapterMaterials.consumedFinalizedSources
        .find(source => source.chapterNumber === this.chapterInfo.chapterNumber - 1)?.content?.trim()
        || previousEnding,
      executionContract: chapterExecutionContract.rules,
    })
    const withSkill = (content: string) => injectWritingSkillIntoTask({ purpose: 'chapter-draft', output: 'visible-text',
      messages: [{ role: 'user', content }] }, context, 'drafting').task.messages[0]!.content
    const materialDecision = { ...chapterMaterials.decision, promptHash: await hashAuthorText(withSkill(prompt)),
      ...(!this.resumeHandle ? { shortOutlinePromptHash: await hashAuthorText(withSkill(outlinePrompt)) } : {}) }

    callbacks.log(uiText(
      '调用 AI 生成章节草稿...',
      'Calling AI to generate the chapter draft...',
    ))
    let mainOwned = false
    let alreadySaved = false
    let draftPersisted = false
    let recoverableDraftCandidate = ''
    const priorSave = this.resumeHandle
      ? await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: this.resumeHandle })
      : null
    if (priorSave?.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
    let planning = true
    const workflowStepId = step && typeof step === 'object' && 'id' in step && typeof step.id === 'string'
      ? step.id
      : 'generate-draft'
    try {
      this.assertNotCancelled(context)
      const cancellation = observeWorkflowCancellation(context)
      // 正文生成不经过 `executeWithGenerationRuntime`（它需要专用预算并自建 runtime），
      // 因此在这里手动广播追踪作用域：否则 `build()` 期间的提示词装配会落在作用域外，
      // 提示词追踪既拿不到 runHandle、也定位不到落盘目录。
      // 必须放在本层 try 内，才能与下面的 finally 配对（内层 try 只有 catch）。
      const traceScope: TraceScope = {
        operation: 'chapter-draft',
        chapterNumber: this.chapterInfo.chapterNumber,
        projectSession,
      }
      const disposeTraceScope = pushTraceScope(traceScope)
      let runtime: GenerationRuntime | null = null
      let cleanDraftText: string
      let acknowledgedPreview = ''
      let replacingPreview = false
      let compositionVersion: DraftVisibleTextVersion = DRAFT_VISIBLE_TEXT_VERSION
      // 对账输出不是正文：对账请求进行期间不把它的快照显示到写作面板。
      const mainCallbacks = { ...callbacks,
        appendText: (text: string) => { if (!planning) callbacks.appendText(text) },
        ...(callbacks.replaceText ? { replaceText: (text: string) => {
          if (!planning) callbacks.replaceText?.(replacingPreview ? text : composeDraftVisibleContinuation(acknowledgedPreview, text, compositionVersion))
        } } : {}),
      }
      try {
        const generationModelId = workflowGenerationModelId(context)
        if (priorSave?.draftSave.kind === 'current') {
          if (priorSave.operation !== 'chapter-draft' || priorSave.chapterNumber !== this.chapterInfo.chapterNumber)
            throw new Error('GENERATION_DRAFT_RECOVERY_SCOPE_INVALID')
          mainOwned = true
          alreadySaved = true
          context.mainGenerationRunHandle = this.resumeHandle
          cleanDraftText = priorSave.draftSave.receipt.content
        } else {
        runtime = await this.dependencies.createRuntime({
          budget: DRAFT_GENERATION_BUDGET,
          ...(generationModelId ? { modelId: generationModelId } : {}),
        }, { context, callbacks: mainCallbacks, selection: {
          operation: 'chapter-draft', chapterNumber: this.chapterInfo.chapterNumber,
          ...(prepared ? { preparationId: prepared.preparationId } : {}),
          ...(this.batchId ? { batchId: this.batchId } : {}),
          promptKeys: [templateKey], skillStages: ['drafting'], output: 'visible-text',
          selectedDraftIds: [...new Set(selectedCandidateDrafts.map(item => item.draftId))],
          selectedFinalizedDraftIds: [...new Set(chapterMaterials.consumedFinalizedSources.map(item => item.draftId))],
          selectedBlueprintChapterNumbers: Array.from({ length: 6 }, (_, index) => this.chapterInfo.chapterNumber + index),
          // S10B 步骤 3：本次准入的脱敏收据随冻结上下文一起进主进程，并被恢复指纹绑定。
          materialDecision,
          authorInputs: [{ id: 'draft:chapter-info', text: JSON.stringify(writerChapterInfo) },
            { id: 'draft:author-config', text: JSON.stringify(novelConfig) },
            { id: 'draft:target-units', text: String(targetChars) }],
          ...(this.resumeHandle ? { resumeHandle: this.resumeHandle } : {}),
        } })
        mainOwned = (runtime as { mainOwned?: boolean }).mainOwned === true
        cleanDraftText = await runtime.execute(async ({ session }) => {
          // runHandle 由 begin 阶段写入 context，必须进入执行体之后才能读到；
          // 写回作用域对象，让落盘时能用它以 `项目/纪元/运行` 做文件名与归并键。
          const openedHandle = context.mainGenerationRunHandle
          traceScope.runHandle = openedHandle
            ? `${openedHandle.projectId}/${openedHandle.epoch}/${openedHandle.runId}`
            : undefined
          let recovery = mainOwned && this.resumeHandle
            ? await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: context.mainGenerationRunHandle! })
            : null
          if (recovery?.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
          if (this.resumeHandle && !mainOwned) throw new Error('GENERATION_DRAFT_LEGACY_RESUME_REFUSED')
          let reconciliationArtifactIds = new Set([...(recovery?.draftReconciliation?.artifactIds ?? []), ...(recovery?.draftShortOutline?.artifactIds ?? [])])
          const retryOutline = recovery?.draftShortOutline?.retry?.kind === 'available'
          const outlinedOnly = !!recovery?.draftShortOutline?.completedOutput && !recovery.composition
            && recovery.attemptedPurposes.every(purpose => purpose === DRAFT_SHORT_OUTLINE_PURPOSE)
          // 对账已完成而首稿尚未发出（如进程在两者之间中断）：沿用记录的对账结果直接生成首稿。
          const reconciledOnly = !!recovery && !recovery.composition && recovery.draftSave.kind === 'absent' && recovery.attemptedPurposes.length > 0
            && recovery.attemptedPurposes.every(purpose => purpose === DRAFT_RECONCILE_PURPOSE)
          const failedBatchView = recovery && this.batchId && recovery.batchId === this.batchId
            && !recovery.composition && recovery.draftSave.kind === 'absent' && recovery.lastCompositionFinishReason === null
            && recovery.attemptedPurposes.at(-1) === 'chapter-draft'
            ? await ipc.invokeWithProjectSession(projectSession, 'generation:read', this.resumeHandle!) : null
          const lastAttempt = failedBatchView?.budgetDiagnostics?.at(-1)
          const retryFailedBatch = !!failedBatchView && failedBatchView.status === 'running' && !failedBatchView.nonReplayable
            && failedBatchView.handle.runId === this.resumeHandle?.runId && (failedBatchView.ledger?.physicalRequests ?? 0) > 0
            && !failedBatchView.ledger?.blockedCode && lastAttempt?.finishReason === null
            && (lastAttempt.failureCode === 'GENERATION_PROVIDER_FAILED' || lastAttempt.failureCode === 'NETWORK_ERROR')
            && ![...failedBatchView.artifacts, ...(failedBatchView.candidates ?? [])].some(artifact => !reconciliationArtifactIds.has(artifact.artifactId) && artifact.text.trim())
            && !failedBatchView.unsavedTails?.some(tail => tail.text.trim())
          if (recovery && (recovery.operation !== 'chapter-draft'
            || recovery.chapterNumber !== this.chapterInfo.chapterNumber
            || !retryOutline && !retryFailedBatch && !reconciledOnly && !outlinedOnly && (!recovery.composition || !isDraftVisibleTextVersion(recovery.composition.algorithm)
              || !['stop', 'length'].includes(recovery.lastCompositionFinishReason ?? ''))))
            throw new Error('GENERATION_DRAFT_RECOVERY_EVIDENCE_REQUIRED')
          if (recovery?.composition && isDraftVisibleTextVersion(recovery.composition.algorithm))
            compositionVersion = recovery.composition.algorithm
          const expectedInputs = [{ id: 'draft:chapter-info', text: JSON.stringify(writerChapterInfo) },
            { id: 'draft:author-config', text: JSON.stringify(novelConfig) },
            { id: 'draft:target-units', text: String(targetChars) }]
          const recoveredAuthorInputs = recovery?.authorInputs
          if (recoveredAuthorInputs && expectedInputs.some(input => recoveredAuthorInputs.find(item => item.id === input.id)?.text !== input.text))
            throw new Error('GENERATION_DRAFT_RECOVERY_AUTHOR_INPUT_CHANGED')
          const sameIds = (a: readonly number[], b: readonly number[]) => JSON.stringify([...new Set(a)].sort((a, b) => a - b)) === JSON.stringify([...new Set(b)].sort((a, b) => a - b))
          if (recovery && (!sameIds(recovery.selectedDraftIds, selectedCandidateDrafts.map(item => item.draftId))
            || !sameIds(recovery.selectedFinalizedDraftIds, chapterMaterials.consumedFinalizedSources.map(item => item.draftId))
            || !sameIds(recovery.selectedBlueprintChapterNumbers, Array.from({ length: 6 }, (_, index) => this.chapterInfo.chapterNumber + index))))
            throw new Error('GENERATION_DRAFT_RECOVERY_SOURCE_SELECTION_CHANGED')
          let acknowledgedIds: string[] = [...(recovery?.composition?.artifactIds ?? [])]
          acknowledgedPreview = recovery?.composition?.text ?? ''
          const acknowledge = async (outcome: GenerationOutcome, text: string) => {
            if (!mainOwned || !text || !['stop', 'length'].includes(outcome.finishReason)) return
            const handle = context.mainGenerationRunHandle
            const artifact = outcome.receipt.visibleArtifact
            if (!handle || !artifact) throw new Error('GENERATION_COMPOSITION_ARTIFACT_REQUIRED')
            if (reconciliationArtifactIds.has(artifact.artifactId)) throw new Error('GENERATION_COMPOSITION_SOURCE_INVALID')
            const hash = await sha256Hex(text)
            const expectedIds = [...acknowledgedIds, artifact.artifactId]
            const receipt = await ipc.invokeWithProjectSession(projectSession, 'generation:compose-visible',
              handle, expectedIds, hash, compositionVersion)
            if (receipt.text !== text || receipt.textHash !== hash || receipt.algorithm !== compositionVersion
              || JSON.stringify(receipt.artifactIds) !== JSON.stringify(expectedIds))
              throw new Error('GENERATION_COMPOSITION_RECEIPT_MISMATCH')
            acknowledgedIds = [...receipt.artifactIds]
            acknowledgedPreview = receipt.text
          }
          const draftingSession = injectWritingSkillIntoSession(session, context, 'drafting')
          if (context.writingSkills?.drafting) {
            callbacks.log(uiText(
              `本次 drafting 阶段使用已冻结写作 Skill：${context.writingSkills.drafting.name}`,
              `Using the workflow-start-frozen writing skill for drafting: ${context.writingSkills.drafting.name}`,
            ))
          }
          const recordedReconciliation = recovery?.draftReconciliation?.completedOutput
          let shortOutline = recovery?.draftShortOutline?.completedOutput ?? ''
          // 首次生成必须排在重试分支之前：全新运行时 recovery 为 null，重试分支必然被跳过；
          // 首次失败会落成 run 里唯一的 attempt，重试授权随即可用，紧随其后的分支据此自动重试一次。
          // 见 docs/design/short-outline-first-failure-retry-design.md
          let outlined: GenerationOutcome | undefined
          if (!recovery) {
            callbacks.log(uiText('生成短细纲...', 'Generating a short chapter outline...'))
            outlined = await draftingSession.complete({ purpose: DRAFT_SHORT_OUTLINE_PURPOSE, output: 'visible-text',
              reasoningStage: 'planning', budgetDemand: { kind: 'draft-units', writingLanguage, requestedUnits: 500, segmentable: false },
              messages: [{ role: 'user', content: outlinePrompt }] }, { signal: cancellation.signal })
            logDraftAttempt(callbacks, context, { zhCN: '短细纲', enUS: 'Short outline' }, outlined.receipt)
            if (outlined.status === 'completed' && outlined.finishReason === 'stop' && outlined.content.trim()) {
              shortOutline = outlined.content
            } else if (mainOwned) {
              // 首次失败已落库 ⇒ 重试授权此时可用，重读上下文取得它。
              recovery = await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: context.mainGenerationRunHandle! })
              if (recovery.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
            }
          }
          if (recovery?.draftShortOutline?.retry?.kind === 'available') {
            this.assertNotCancelled(context)
            callbacks.log(uiText('重新生成短细纲...', 'Retrying the short chapter outline...'))
            const retried = await ipc.invokeWithProjectSession(projectSession, 'generation:retry-draft-short-outline', {
              handle: context.mainGenerationRunHandle!, failedAttemptId: recovery.draftShortOutline.retry.failedAttemptId,
            })
            outlined = retried.outcome
            // 日志无条件记录：重试失败也要留痕（校验保持条件式）。
            logDraftAttempt(callbacks, context, { zhCN: '短细纲', enUS: 'Short outline' }, outlined.receipt)
            if (outlined.status === 'completed' && outlined.finishReason === 'stop' && outlined.content.trim()) {
              recovery = await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: context.mainGenerationRunHandle! })
              if (recovery.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
              shortOutline = recovery.draftShortOutline?.completedOutput ?? ''
              if (shortOutline !== outlined.content || !outlined.receipt.visibleArtifact
                || !recovery.draftShortOutline?.artifactIds.includes(outlined.receipt.visibleArtifact.artifactId))
                throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
              reconciliationArtifactIds = new Set([...(recovery.draftReconciliation?.artifactIds ?? []), ...recovery.draftShortOutline.artifactIds])
            }
          }
          // 两条分支的 outcome 在此统一判定：以可读文案说明失败原因，代码以子串保留供既有断言匹配。
          if (outlined && (outlined.status !== 'completed' || outlined.finishReason !== 'stop' || !outlined.content.trim())) {
            const reason = outlined.finishReason === 'length'
              ? uiText('模型输出被截断', 'the model output was truncated')
              : !outlined.content.trim() ? uiText('模型未返回可见内容', 'the model returned no visible content')
                : uiText('模型未正常完成输出', 'the model did not complete the output normally')
            throw new Error(uiText(`短细纲生成失败：${reason}。正文尚未开始。`,
              `The short chapter outline failed: ${reason}. Drafting has not started.`)
              + ` (GENERATION_DRAFT_SHORT_OUTLINE_FAILED; status=${outlined.status}; finishReason=${outlined.finishReason})`)
          }
          if (recovery?.draftShortOutline && !shortOutline) throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
          const reconciliationBlock = [recordedReconciliation ? draftReconciliationBlock(writingLanguage, recordedReconciliation) : '',
            shortOutline ? draftShortOutlineBlock(writingLanguage, shortOutline) : ''].filter(Boolean).join('\n\n')
          const initialPrompt = shortOutline ? `${prompt}\n\n${draftShortOutlineBlock(writingLanguage, shortOutline)}`
            : composeInitialPrompt(reconciliationBlock)
          const originalDraftTask = recovery?.draftShortOutline?.initialDraftTask
          if (recovery?.draftShortOutline && (recovery.draftShortOutline.promptHash !== await hashAuthorText(withSkill(outlinePrompt))
            || recovery.attemptedPurposes.includes('chapter-draft') && !originalDraftTask
            || originalDraftTask && (originalDraftTask.messages.find(message => message.role === 'user')?.content !== withSkill(initialPrompt)
              || originalDraftTask.messages.find(message => message.role === 'system')?.content !== systemRole)))
            throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_IDENTITY_CHANGED')
          planning = false
          this.assertNotCancelled(context)
          callbacks.setProgress(10)
          const preview = createDraftStreamPreview(
            callbacks.replaceText,
            visibleDraftStreamText,
          )
          let initialVisibleDraft: string
          let initialFinishReason: LLMCompletion['finishReason']
          let initialFailureCode: GenerationAttemptReceipt['failureCode']
          let initialReasoning = true
          if (recovery?.composition) {
            initialVisibleDraft = recovery.composition!.text
            initialFinishReason = recovery.lastCompositionFinishReason as 'stop' | 'length'
            preview.stop()
          } else {
            let initialOutcome: GenerationOutcome
            try {
              initialOutcome = await draftingSession.complete({
                purpose: 'chapter-draft',
                budgetDemand: { kind: 'draft-units', writingLanguage, requestedUnits: targetChars, segmentable: false },
                reasoningStage: 'drafting',
                output: 'visible-text',
                messages: [
                  { role: 'system', content: systemRole },
                  { role: 'user', content: initialPrompt },
                ],
              }, {
                signal: cancellation.signal,
                ...(!mainOwned ? { onChunk: (chunk: string) => {
                  if (context.cancelled) return
                  preview.push(chunk)
                } } : {}),
              })
            } catch (error) {
              recoverableDraftCandidate = preview.snapshot()
              throw error
            } finally {
              preview.stop()
            }
            const initialCompletion = completionFromOutcome(initialOutcome)
            logDraftAttempt(
              callbacks,
              context,
              { zhCN: '初始生成', enUS: 'Initial generation' },
              initialOutcome.receipt,
            )
            callbacks.log(uiText(
              `  初始生成响应结束：finishReason=${initialCompletion.finishReason}`,
              `  Initial generation response ended: finishReason=${initialCompletion.finishReason}`,
            ))
            initialVisibleDraft = sanitizeDraftText(this.stripThinkingTags(initialCompletion.content), compositionVersion)
            initialFinishReason = initialCompletion.finishReason
            initialFailureCode = initialOutcome.receipt.failureCode
            initialReasoning = initialOutcome.receipt.capabilities.reasoning === true
            await acknowledge(initialOutcome, initialVisibleDraft)
            }
          recoverableDraftCandidate = initialVisibleDraft
          callbacks.log(uiText(
            `  初始生成可见单位：visibleUnits=${countDraftUnits(initialVisibleDraft)}`,
            `  Initial generation visible units: visibleUnits=${countDraftUnits(initialVisibleDraft)}`,
          ))
          callbacks.replaceText?.(initialVisibleDraft)
          callbacks.setProgress(90)
          this.assertNotCancelled(context)
          const completedDraft = await this.extendDraftIfNeeded({
            session: draftingSession,
            compositionVersion,
            mainOwned,
            acknowledge,
            signal: cancellation.signal,
            initialDraft: initialVisibleDraft,
            initialFinishReason,
            initialFailureCode,
            initialRounds: recovery?.attemptedPurposes.filter(purpose => purpose === 'chapter-draft-continuation' || purpose === 'chapter-draft-no-progress-recovery').length,
            noProgressRecoveryUsed: recovery?.attemptedPurposes.includes('chapter-draft-no-progress-recovery'),
            targetChars,
            callbacks,
            context,
            systemRole,
            chapterInfo: writerChapterInfo,
            globalGuidance: mergedGuidance,
            writingStyle,
            novelConfigFacts: novelConfigFactsJson,
            chapterMaterials: chapterMaterials.text,
            reconciliation: reconciliationBlock,
            writingLanguage,
            reasoning: initialReasoning,
            // 续写的【本章蓝图】JSON 已含作者三字段；仅模板未渲染 chapter_info 时才需兜底。
            includeAuthorItemsFallback: !templateCoversAuthorFields,
            onRecoverableCandidate: candidate => { recoverableDraftCandidate = candidate },
          })
          recoverableDraftCandidate = completedDraft.text
          replacingPreview = true
          const lengthCheckedDraft = await this.condenseDraftIfNeeded({
            session: draftingSession,
            compositionVersion,
            acknowledge,
            signal: cancellation.signal,
            candidate: completedDraft,
            alreadyAttempted: recovery?.attemptedPurposes.includes(DRAFT_CONDENSE_PURPOSE) === true,
            targetChars,
            callbacks,
            context,
            systemRole,
            chapterInfo: writerChapterInfo,
            globalGuidance: mergedGuidance,
            writingStyle,
            novelConfigFacts: novelConfigFactsJson,
            chapterMaterials: chapterMaterials.text,
            reconciliation: reconciliationBlock,
            writingLanguage,
            // 压缩同理：本块蓝图 JSON 已含作者三字段，仅模板未渲染时才兜底。
            includeAuthorItemsFallback: !templateCoversAuthorFields,
          })
          recoverableDraftCandidate = lengthCheckedDraft
          return lengthCheckedDraft
        })
        }
      } catch (error) {
        if (context.cancelled) throw new Error(uiText('工作流已取消', 'Workflow was cancelled.'))
        throw error
      } finally {
        // 落盘收尾必须排在退出作用域之前：此刻真实请求的 messages 与模型输出都已就绪，
        // 且作用域仍在栈顶，落盘器能读到 runHandle。追踪是旁路，失败不影响生成结果。
        await runTraceScopeTeardown()
        disposeTraceScope()
        cancellation.dispose()
        if (runtime) {
          try { await runtime.close() } catch { /* execute close failure already fails before persistence */ }
        }
      }
      this.assertNotCancelled(context)
      if (!alreadySaved) {
        const units = countDraftUnits(cleanDraftText)
        const range = draftTargetUnitRange(targetChars)
        if (units < range.minimum) throw draftTooShortError(context, units, targetChars)
      }
      if (!alreadySaved && hasSubstantialPreviousChapterReuse(previousEnding, cleanDraftText, writingLanguage)) {
        throw new Error(uiText(
          '新章节开头与上一章结尾存在大段重演，结果未保存。请重新生成，并让本章从上一章已完成事件之后继续。',
          'The new chapter substantially replays the previous ending, so it was not saved. Regenerate it and continue after the events already completed in the previous chapter.',
        ))
      }

      // 落于数据库
      if (!sameProjectSessionContext(
        projectSession,
        projectSessionContextFromProject(useProjectStore.getState().currentProject),
      )) {
        throw new Error(uiText(
          '当前项目已切换，已拒绝保存章节草稿',
          'The project changed, so saving the chapter draft was refused.',
        ))
      }
      this.assertNotCancelled(context)
      if (mainOwned && !alreadySaved
        && JSON.stringify(useProjectStore.getState().currentProject?.novelConfig) !== JSON.stringify(novelConfig))
        throw new Error('GENERATION_DRAFT_AUTHOR_CONFIG_CHANGED')
      const createResult = mainOwned ? await (async () => {
        const handle = context.mainGenerationRunHandle
        if (!handle) throw new Error('GENERATION_COMPOSITION_HANDLE_REQUIRED')
        const saved = await ipc.invokeWithProjectSession(projectSession, 'generation:commit-draft', {
          handle, chapterNumber: this.chapterInfo.chapterNumber, source: 'write',
          ...(this.batchId ? { batchId: this.batchId } : {}),
          expectedCompositionHash: await sha256Hex(cleanDraftText),
        })
        if (saved.content !== cleanDraftText || saved.contentHash !== await sha256Hex(cleanDraftText))
          throw new Error('GENERATION_DRAFT_COMMIT_RECEIPT_MISMATCH')
        return saved
      })() : await (async () => {
        const nextVersion: number = await ipc.invokeWithProjectSession(
          projectSession,
          'db:draft-next-version',
          this.chapterInfo.chapterNumber,
          expectedProjectPath,
        )
        this.assertNotCancelled(context)
        const finalizedDependencies: DraftSourceDependency[] = await Promise.all(
          chapterMaterials.consumedFinalizedSources.map(async source => source.sourceIdentity?.kind === 'finalized'
            ? {
                kind: 'finalized' as const,
                draftId: source.draftId,
                chapterNumber: source.chapterNumber,
                finalizationId: source.sourceIdentity.finalizationId,
                contentHash: source.sourceIdentity.contentHash,
              }
            : {
                kind: 'legacy-finalized' as const,
                draftId: source.draftId,
                chapterNumber: source.chapterNumber,
                contentHash: await sha256Hex(source.content),
              }),
        )
        const finalizedDraftIds = new Set(finalizedDependencies.map(dependency => dependency.draftId))
        const candidateDependencies: DraftSourceDependency[] = await Promise.all(
          selectedCandidateDrafts
            .filter(candidate => admittedCandidateSourceIds.has(`candidate:${candidate.draftId}`)
              && !finalizedDraftIds.has(candidate.draftId))
            .map(async candidate => ({
              draftId: candidate.draftId,
              contentHash: await sha256Hex(candidate.content),
            })),
        )
        const saved = await ipc.invokeWithProjectSession(projectSession, 'db:draft-create', {
          chapterNumber: this.chapterInfo.chapterNumber,
          version: nextVersion,
          source: 'write',
          content: cleanDraftText,
          wordCount: countDraftUnits(cleanDraftText),
          sourceDependencies: [...candidateDependencies, ...finalizedDependencies],
        }, expectedProjectPath)
          return { ...saved, version: nextVersion }
      })()
      const nextVersion = createResult.version
      if (!createResult.success || !createResult.id) {
        throw new Error(('error' in createResult ? String(createResult.error) : '') || uiText('章节草稿保存失败', 'Failed to save the chapter draft.'))
      }
      this.assertNotCancelled(context)
      draftPersisted = true
      return this.publishSavedDraft({ context, callbacks, projectSession, expectedProjectPath,
        cleanDraftText, id: createResult.id, nextVersion, mergedGuidance, targetChars })
    } catch (error) {
      if (!mainOwned && !draftPersisted && recoverableDraftCandidate) {
        callbacks.replaceText?.(recoverableDraftCandidate)
        const failureCode = recoveryFailureCode(error, context.cancelled)
        const failureReason = error instanceof Error ? error.message : String(error)
        try {
          const result = await ipc.invokeWithProjectSession(
            projectSession,
            'db:recovery-candidate-record',
            {
              runId: context.runId,
              stepId: workflowStepId,
              chapterNumber: this.chapterInfo.chapterNumber,
              chapterTitle: this.chapterInfo.title,
              source: recoveryChapterSource(this.chapterInfo),
              sourceDraft: sourceDraft ? { id: sourceDraft.id, version: sourceDraft.version } : null,
              visibleText: recoverableDraftCandidate,
              failureCode,
              failureReason,
            },
            expectedProjectPath,
          )
          if (!result.success || !result.candidate) {
            throw new Error(result.error || uiText('未知存储错误', 'Unknown storage error.'))
          }
          callbacks.log(uiText(
            '生成未能安全完成；已收到的可见正文已保存为项目恢复候选，未进入草稿库。',
            'Generation could not complete safely. The visible prose was saved as a project recovery candidate and was not added to the draft library.',
          ))
        } catch (persistenceError) {
          const persistenceReason = persistenceError instanceof Error
            ? persistenceError.message
            : String(persistenceError)
          callbacks.log(uiText(
            `恢复候选保存失败；可见正文仍保留在当前步骤中：${persistenceReason}`,
            `Saving the recovery candidate failed. The visible prose remains in the current step: ${persistenceReason}`,
          ))
          throw new Error(uiText(
            `${failureReason}；恢复候选保存失败：${persistenceReason}`,
            `${failureReason}; saving the recovery candidate failed: ${persistenceReason}`,
          ))
        }
      } else if (!mainOwned && !draftPersisted) {
        callbacks.replaceText?.('')
      }
      throw error
    }
  }

  private async publishSavedDraft({ context, callbacks, projectSession, expectedProjectPath,
    cleanDraftText, id, nextVersion, mergedGuidance, targetChars }: {
    context: CommandExecuteParams['context']; callbacks: CommandExecuteParams['callbacks']
    projectSession: ProjectSessionContext; expectedProjectPath: string
    cleanDraftText: string; id: number; nextVersion: number; mergedGuidance: string; targetChars: number
  }): Promise<string> {
    const uiText = (zh: string, en: string) => workflowUiText(context, zh, en)
    callbacks.replaceText?.(cleanDraftText)

    const pseudoPath = formatResourceUri({ kind: 'draft', id })

    context.data.draft = cleanDraftText
    context.data.draftContent = cleanDraftText
    context.data.draftPath = pseudoPath
    context.data.draftId = id
    context.data.draftVersion = nextVersion
    context.data.chapterNumber = this.chapterInfo.chapterNumber
    context.data.chapterInfo = this.chapterInfo
    context.data.mergedGuidance = mergedGuidance
    context.data.shortSummary = ''

    await useProjectStore.getState().refreshFileTree(expectedProjectPath, undefined, projectSession)
    try {
      const { useDraftStore } = await import('../../../stores/draft-store')
      await useDraftStore.getState().loadAllDrafts(expectedProjectPath, projectSession)
    } catch { /* 忽略 */ }

    try {
      if (!sameProjectSessionContext(
        projectSession,
        projectSessionContextFromProject(useProjectStore.getState().currentProject),
      )) throw new Error(uiText(
        '当前项目已切换，已拒绝打开旧草稿',
        'The project changed, so opening the old draft was refused.',
      ))
      const { useEditorStore } = await import('../../../stores/editor-store')
      useEditorStore.getState().openFile({
        id: pseudoPath,
        name: uiText(
        `第${this.chapterInfo.chapterNumber}章 ${this.chapterInfo.title} v${nextVersion}`,
        `Chapter ${this.chapterInfo.chapterNumber} ${this.chapterInfo.title} v${nextVersion}`,
        ),
        type: 'chapter',
        filePath: pseudoPath,
        content: cleanDraftText,
        savedContent: cleanDraftText,
        projectKey: expectedProjectPath,
      })
    } catch { /* 忽略 */ }

    callbacks.log(uiText(
      `草稿已自动入库保存为版本 v${nextVersion}（${countDraftUnits(cleanDraftText)} 字）`,
      `Draft saved automatically as version v${nextVersion} (${countDraftUnits(cleanDraftText)} units)`,
    ))
    const units = countDraftUnits(cleanDraftText), { maximum } = draftTargetUnitRange(targetChars)
    if (units > maximum) callbacks.log(uiText(
      `第${this.chapterInfo.chapterNumber}章字数超过约定`,
      `Chapter ${this.chapterInfo.chapterNumber} exceeds the agreed length.`,
    ))
    return cleanDraftText
  }

  private shouldAutoContinue(
    currentText: string,
    targetChars: number,
    rounds: number,
    finishReason: LLMCompletion['finishReason'],
  ): boolean {
    if (rounds >= MAX_AUTO_CONTINUE_ROUNDS) return false
    const currentChars = countDraftUnits(currentText)
    if (currentChars > draftTargetUnitRange(targetChars).maximum) return false
    if (finishReason === 'stop') {
      return currentChars < draftTargetUnitRange(targetChars).minimum
    }
    return finishReason === 'length'
  }

  private async extendDraftIfNeeded(params: {
    session: GenerationSession
    compositionVersion: DraftVisibleTextVersion
    mainOwned?: boolean
    acknowledge?: (outcome: GenerationOutcome, text: string) => Promise<void>
    signal: AbortSignal
    initialDraft: string
    initialRounds?: number
    noProgressRecoveryUsed?: boolean
    initialFinishReason: LLMCompletion['finishReason']
    initialFailureCode?: GenerationAttemptReceipt['failureCode']
    targetChars: number
    callbacks: CommandExecuteParams['callbacks']
    context: CommandExecuteParams['context']
    systemRole: string
    chapterInfo: WriterChapterInfo
    globalGuidance: string
    writingStyle: string
    novelConfigFacts: string
    chapterMaterials: string
    reconciliation?: string
    writingLanguage: WritingLanguage
    reasoning: boolean
    /** P1 Phase 1：本轮是否需要追加 authorItems 兜底（见 draftAuthorMaterialBlock）。 */
    includeAuthorItemsFallback?: boolean
    onRecoverableCandidate(candidate: string): void
  }): Promise<DraftCandidate> {
    const uiText = (zhCNText: string, enUSText: string) => workflowUiText(
      params.context,
      zhCNText,
      enUSText,
    )
    let draft = params.initialDraft
    let rounds = params.initialRounds ?? 0
    let lastFinishReason = params.initialFinishReason
    let lastFailureCode = params.initialFailureCode
    let noProgressRecoveryUsed = params.noProgressRecoveryUsed ?? false
    let recoveryPending = false

    if (
      params.reasoning
      && lastFinishReason === 'length'
      && countDraftUnits(draft) < 100
    ) {
      throw new Error(
        uiText(
          '模型的输出预算主要消耗在推理阶段，尚未产生足够正文。无法安全续接隐藏推理过程；' +
            '请关闭模型思考模式、提高最大输出 Tokens，或改用更适合正文创作的非推理模型。',
          'The model spent most of its output budget on reasoning and did not produce enough prose. Hidden reasoning cannot be continued safely. ' +
            'Disable reasoning mode, increase the maximum output tokens, or use a non-reasoning model better suited to drafting.',
        ),
      )
    }

    while (this.shouldAutoContinue(draft, params.targetChars, rounds, lastFinishReason)) {
      if (params.context.cancelled) break
      rounds += 1
      const currentChars = countDraftUnits(draft)
      params.callbacks.log(uiText(
        `  自动续写第 ${rounds} 段：当前约 ${currentChars}/${params.targetChars} 字`,
        `  Auto-continuation ${rounds}: currently about ${currentChars}/${params.targetChars} units`,
      ))

      // 续写额度：未到目标时补足剩余篇幅；已到目标（长度截断）时只允许补完断句并收束。两者都不得越过门禁上限。
      const range = draftTargetUnitRange(params.targetChars)
      const remaining = Math.max(0, params.targetChars - currentChars)
      const ceiling = Math.max(0, range.maximum - currentChars)
      const allowance = remaining > 0 ? Math.min(remaining, ceiling) : Math.min(150, ceiling)
      const visibleDraft = sanitizeDraftText(draft, params.compositionVersion)
      const recoveryInstruction = recoveryPending
        ? promptLanguageText(
            params.writingLanguage,
            '上一轮续写达到输出上限且没有增加足够的新正文，已被全部丢弃。\n'
              + '这是本次任务唯一一次无进展恢复机会：请直接推进下一事件、动作或对话，禁止复述已写末尾。\n\n',
            'The previous continuation reached the output limit without adding enough new prose, so it was discarded in full.\n'
              + 'This is the only no-progress recovery attempt: advance directly to the next event, action, or line of dialogue without repeating the existing ending.\n\n',
          )
        : ''
      const lengthInstruction = remaining > 0
        ? promptLanguageText(
            params.writingLanguage,
            `- 本次续写补足约 ${allowance} 字即可，新增部分绝不超过 ${ceiling} 字；接近时按本章结束状态收束，停在完整句子和自然段落末尾。`,
            `- Add about ${allowance} words in this continuation and never more than ${ceiling}; as you approach that length, close at the chapter's ending state and stop at the end of a complete sentence and paragraph.`,
          )
        : promptLanguageText(
            params.writingLanguage,
            `- 本章已达到目标篇幅：只补完被截断的句子并收束当前场景，新增部分约 ${allowance} 字以内、绝不超过 ${ceiling} 字，不要展开新事件。`,
            `- The chapter has reached its target length: only finish the truncated sentence and close the current scene in about ${allowance} words or fewer, never more than ${ceiling}; do not start new events.`,
          )
      const authorMaterial = draftAuthorMaterialBlock(params.writingLanguage, params)
      const lengthContract = chapterLengthContractText(params.writingLanguage, params.targetChars)
      const continuationPrompt = promptLanguageText(
        params.writingLanguage,
        `${recoveryInstruction}请无缝续写当前章节正文。

【硬性要求】
- 只输出新增正文，不要复述已写内容。
- 根据下方本章已写正文全文，从末尾自然接下去，保持同一场景逻辑或合理转场。
${lengthInstruction}
- 不要输出标题、解释、总结、Markdown、思考过程或“点我继续”。
- 避免重复已写正文中的整句、整段、动作链和意象。
- 不提前写后续章节，只完成本章蓝图允许的内容。

${lengthContract}

${authorMaterial}

【本章已写正文全文】
${visibleDraft}`,
        `${recoveryInstruction}Continue the current chapter seamlessly.

[Requirements]
- Output only new manuscript prose; do not repeat existing text.
- Read the full existing manuscript below and continue naturally from its ending, preserving the same scene logic or making a justified transition.
${lengthInstruction}
- Do not output a title, explanation, summary, Markdown, reasoning, or an interface continuation prompt.
- Avoid repeating complete sentences, paragraphs, action sequences, or imagery from the existing manuscript.
- Complete only the current chapter blueprint; do not advance later chapters.

${lengthContract}

${authorMaterial}

[Full existing manuscript for this chapter]
${visibleDraft}`,
      )

      const preview = createDraftStreamPreview(
        params.callbacks.replaceText,
        rawText => appendVisibleDraftContinuation(draft, visibleDraftStreamText(rawText)),
        draft,
      )
      let outcome: GenerationOutcome
      try {
        outcome = await params.session.complete({
          purpose: recoveryPending
            ? 'chapter-draft-no-progress-recovery'
            : 'chapter-draft-continuation',
          reasoningStage: 'drafting',
          output: 'visible-text',
          budgetDemand: { kind: 'draft-units', writingLanguage: params.writingLanguage, requestedUnits: Math.max(1, allowance), segmentable: false },
          messages: [
            { role: 'system', content: params.systemRole },
            { role: 'user', content: continuationPrompt },
          ],
        }, {
          signal: params.signal,
          ...(!params.mainOwned ? { onChunk: (chunk: string) => {
            if (params.context.cancelled) return
            preview.push(chunk)
          } } : {}),
        })
      } catch (error) {
        params.onRecoverableCandidate(preview.snapshot())
        throw error
      } finally {
        preview.stop()
      }
      const addition = completionFromOutcome(outcome)
      lastFailureCode = outcome.receipt.failureCode
      logDraftAttempt(
        params.callbacks,
        params.context,
        { zhCN: `自动续写第 ${rounds} 段`, enUS: `Auto-continuation ${rounds}` },
        outcome.receipt,
      )
      params.callbacks.log(uiText(
        `  自动续写第 ${rounds} 段响应结束：finishReason=${addition.finishReason}`,
        `  Auto-continuation ${rounds} response ended: finishReason=${addition.finishReason}`,
      ))
      this.assertNotCancelled(params.context)
      const beforeChars = countDraftUnits(draft)
      const visibleAddition = sanitizeDraftText(this.stripThinkingTags(addition.content), params.compositionVersion)
      const candidateDraft = appendVisibleDraftContinuation(
        draft,
        visibleAddition,
        params.compositionVersion,
      )
      const mergedDelta = countDraftUnits(candidateDraft) - beforeChars
      const accepted = addition.finishReason === 'stop' || mergedDelta >= 300
      params.callbacks.log(uiText(
        `  自动续写可见单位：visibleUnitsBefore=${beforeChars} `
          + `candidateVisibleUnits=${countDraftUnits(visibleAddition)} `
          + `mergedDelta=${mergedDelta} accepted=${accepted}`,
        `  Auto-continuation visible units: visibleUnitsBefore=${beforeChars} `
          + `candidateVisibleUnits=${countDraftUnits(visibleAddition)} `
          + `mergedDelta=${mergedDelta} accepted=${accepted}`,
      ))
      if (addition.finishReason === 'length' && mergedDelta < 300) {
        params.callbacks.replaceText?.(draft)
        if (noProgressRecoveryUsed) {
          throw new Error(uiText(
            '唯一一次无进展恢复请求仍未增加足够的新正文，结果未保存。请缩短章节目标后重试。',
            'The single no-progress recovery request still did not add enough new prose, so the result was not saved. Shorten the chapter target and try again.',
          ))
        }
        noProgressRecoveryUsed = true
        recoveryPending = true
        lastFinishReason = addition.finishReason
        params.callbacks.log(uiText(
          '  本轮低增量截断内容已丢弃，将使用剩余预算执行一次无进展恢复请求',
          '  Discarded this low-progress truncated continuation; using the remaining budget for one no-progress recovery request',
        ))
        continue
      }
      await params.acknowledge?.(outcome, candidateDraft)
      draft = candidateDraft
      params.onRecoverableCandidate(draft)
      params.callbacks.replaceText?.(draft)
      lastFinishReason = addition.finishReason
      recoveryPending = false
      if (mergedDelta < 300) break
    }

    this.assertNotCancelled(params.context)
    if (lastFinishReason === 'length'
      && countDraftUnits(draft) > draftTargetUnitRange(params.targetChars).maximum) return { text: draft, finishReason: lastFinishReason }
    if (lastFinishReason !== 'stop') {
      const error = this.createIncompleteCompletionError(lastFinishReason)
      if (lastFailureCode === 'GENERATION_PROVIDER_FAILED' || lastFailureCode === 'NETWORK_ERROR')
        Object.assign(error, { code: lastFailureCode })
      error.message = uiText(error.message, (() => {
        switch (lastFinishReason) {
          case 'length':
            return 'AI output reached the model maximum length and is incomplete. Increase the maximum output tokens or shorten the task, then try again.'
          case 'content_filter':
            return 'AI output was stopped by content restrictions, so the result was not saved.'
          case 'cancelled':
            return 'AI generation was cancelled, so the result was not saved.'
          default:
            return 'AI generation did not complete normally, so the result was not saved.'
        }
      })())
      throw error
    }

    const lowerBound = draftTargetUnitRange(params.targetChars).minimum
    const draftUnits = countDraftUnits(draft)
    if (draftUnits < lowerBound) throw draftTooShortError(params.context, draftUnits, params.targetChars)

    return { text: draft, finishReason: lastFinishReason }
  }

  private async condenseDraftIfNeeded(params: {
    session: GenerationSession
    compositionVersion: DraftVisibleTextVersion
    acknowledge: (outcome: GenerationOutcome, text: string) => Promise<void>
    signal: AbortSignal
    candidate: DraftCandidate
    alreadyAttempted: boolean
    targetChars: number
    callbacks: CommandExecuteParams['callbacks']
    context: CommandExecuteParams['context']
    systemRole: string
    chapterInfo: WriterChapterInfo
    globalGuidance: string
    writingStyle: string
    novelConfigFacts: string
    chapterMaterials: string
    reconciliation?: string
    writingLanguage: WritingLanguage
    /** P1 Phase 1：本轮是否需要追加 authorItems 兜底（见 draftAuthorMaterialBlock）。 */
    includeAuthorItemsFallback?: boolean
  }): Promise<string> {
    const uiText = (zhCNText: string, enUSText: string) => workflowUiText(params.context, zhCNText, enUSText)
    const range = draftTargetUnitRange(params.targetChars)
    const original = () => {
      this.assertNotCancelled(params.context)
      if (params.candidate.finishReason !== 'stop') throw this.createIncompleteCompletionError(params.candidate.finishReason)
      params.callbacks.replaceText?.(params.candidate.text)
      return params.candidate.text
    }
    const originalUnits = countDraftUnits(params.candidate.text)
    if (originalUnits <= range.maximum || params.alreadyAttempted) return original()
    params.callbacks.log(uiText(
      `  正文约 ${originalUnits} 字，超出参考上限 ${range.maximum} 字，执行唯一一次压缩修订`,
      `  Draft is about ${originalUnits} units, above the reference maximum of ${range.maximum}; running the single condense revision`,
    ))
    // 顺序：任务与硬性要求 → 作者资料块 → 篇幅合同 → 待压缩正文；固定执行规则在 system。
    const authorMaterial = draftAuthorMaterialBlock(params.writingLanguage, params)
    const lengthContract = chapterLengthContractText(params.writingLanguage, params.targetChars)
    // 篇幅现状：告知模型待压缩正文当前长度与需删量（只说“须落入区间”时，模型常原样返回而压缩不足）。
    // 压缩仅在 originalUnits > range.maximum 时触发，故 cutUnits > 0；ceilUnits 不超过 range.maximum 且必大于 aimUnits。
    const aimUnits = Math.round(params.targetChars * 0.89)
    const ceilUnits = Math.min(range.maximum, Math.max(Math.round(params.targetChars * 1.05), aimUnits + 1))
    const cutUnits = originalUnits - aimUnits
    const cutPercent = Math.round(cutUnits / originalUnits * 100)
    const condensePrompt = promptLanguageText(
      params.writingLanguage,
      `请把下面的本章正文压缩修订到可接受篇幅内，输出修订后的完整正文。

【篇幅现状】待压缩正文当前约 ${originalUnits} 字，超出上限。请压缩到约 ${aimUnits} 字（参考上限 ${ceilUnits} 字），即删去约 ${cutUnits} 字，约占全文 ${cutPercent}%。做法：逐段压缩，每段都删减描写、重复动作和心理，不要只删某一段。

【硬性要求】
- 修订后正文建议在 ${range.minimum}–${range.maximum} 字之间；完整事件和作者事实优先，仍超长时保留完整正文。按下方篇幅合同写到约 ${Math.round(params.targetChars * 0.85)}–${params.targetChars} 字。
- 保留本章蓝图中的全部必需事件、作者任务和情节事实，保留人物身份与关系，保留本章结尾的收束与钩子。
- 只通过删减冗余描写、重复动作、重复心理和啰嗦对话来缩短；不得新增情节、人物、设定或事实，不得改变事件顺序与因果。
- 只输出修订后的完整正文；不要输出标题、解释、总结、Markdown、思考过程或“点我继续”。

${authorMaterial}

${lengthContract}

【待压缩正文】
${params.candidate.text}`,
      `Condense the chapter manuscript below into the acceptable length and output the complete revised manuscript.

[Current length] The manuscript to condense is about ${originalUnits} words, above the ceiling. Condense it to about ${aimUnits} words (reference maximum ${ceilUnits} words), which means cutting about ${cutUnits} words, roughly ${cutPercent}% of the text. Method: condense paragraph by paragraph, trimming description, repeated actions, and repeated introspection in every paragraph rather than cutting only one part.

[Requirements]
- Aim for between ${range.minimum} and ${range.maximum} words; complete events and author facts take priority, and a longer complete manuscript is retained. Following the length contract below, aim for about ${Math.round(params.targetChars * 0.85)}-${params.targetChars} words.
- Keep every required event, author task, and plot fact from the chapter blueprint, keep character identities and relationships, and keep the chapter ending and hook.
- Shorten only by cutting redundant description, repeated actions, repeated introspection, and wordy dialogue; do not add plot, characters, setting, or facts, and do not change event order or causality.
- Output only the complete revised manuscript; do not output a title, explanation, summary, Markdown, reasoning, or an interface continuation prompt.

${authorMaterial}

${lengthContract}

[Manuscript to condense]
${params.candidate.text}`,
    )
    let outcome: GenerationOutcome
    try {
      outcome = await params.session.complete({
        purpose: DRAFT_CONDENSE_PURPOSE,
        reasoningStage: 'drafting',
        output: 'visible-text',
        budgetDemand: { kind: 'draft-units', writingLanguage: params.writingLanguage, requestedUnits: params.targetChars, segmentable: false },
        messages: [
          { role: 'system', content: params.systemRole },
          { role: 'user', content: condensePrompt },
        ],
      }, { signal: params.signal })
    } catch (error) {
      if (params.context.cancelled || params.signal.aborted) throw error
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (code !== 'GENERATION_PROVIDER_FAILED' && code !== 'NETWORK_ERROR') throw error
      params.callbacks.log(uiText(
        `  压缩修订未完成，保留原稿：${error instanceof Error ? error.message : String(error)}`,
        `  Condense revision did not complete; keeping the original draft: ${error instanceof Error ? error.message : String(error)}`,
      ))
      return original()
    }
    this.assertNotCancelled(params.context)
    if (outcome.finishReason === 'cancelled') throw this.createIncompleteCompletionError('cancelled')
    logDraftAttempt(params.callbacks, params.context, { zhCN: '压缩修订', enUS: 'Condense revision' }, outcome.receipt)
    const condensed = sanitizeDraftText(this.stripThinkingTags(outcome.content), params.compositionVersion)
    const units = countDraftUnits(condensed)
    const accepted = outcome.finishReason === 'stop' && units >= range.minimum
    params.callbacks.log(uiText(
      `  压缩修订响应结束：finishReason=${outcome.finishReason} visibleUnits=${units} accepted=${accepted}`,
      `  Condense revision response ended: finishReason=${outcome.finishReason} visibleUnits=${units} accepted=${accepted}`,
    ))
    if (!accepted) return original()
    await params.acknowledge(outcome, condensed)
    params.callbacks.replaceText?.(condensed)
    return condensed
  }

  // --- 抽取自原文件的辅助方法 ---
  private async readArchitecture(
    projectPath: string,
    projectSession: ProjectSessionContext,
    authoredConfigFacts: readonly string[],
  ): Promise<string> {
    const core = await ipc.invokeWithProjectSession(projectSession, 'db:project-core-get', projectPath)
    const duplicates = authoredFactFingerprints(authoredConfigFacts)
    const parts: string[] = []
    const append = (content: string | undefined) => {
      if (!content?.trim()) return
      // 整块已被作者配置覆盖时整块省略；否则只剔除逐字重复的段落，保留其余原文。
      if (isFullyDuplicatedBlock(content, duplicates)) return
      const remaining = withoutDuplicateParagraphs(content, duplicates)
      if (remaining) parts.push(remaining)
    }
    append(core?.premise)
    append(core?.worldbuilding)
    // 情节大纲只投影「非章级设定段」。分层为 弧光 → 情节大纲 → 章节蓝图 → 正文：
    // 大纲的章级条目与本章蓝图（chapter_info）说的是同一件事，此前两者并排进入正文
    // prompt 且没有任何优先级声明，模型会在两份表述之间自由取舍。实机核对见
    // docs/plans/llm-probe-observation-plan.md。章级内容一律由蓝图承载。
    if (core?.synopsis) append(synopsisSettingSectionsForDraft(core.synopsis))
    return parts.filter(Boolean).join('\n\n---\n\n')
  }

  private async readProjectPrompts(
    projectPath: string,
    projectSession: ProjectSessionContext,
    writingLanguage: WritingLanguage,
  ): Promise<string> {
    try {
      const files = await ipc.invokeWithProjectSession(
        projectSession,
        'fs:list-dir',
        `${projectPath}/${DIR_PROMPTS}`,
        projectPath,
      )
      const mdFiles = files.filter((f: { isDir: boolean; name: string }) => !f.isDir && f.name.endsWith('.md'))
      if (mdFiles.length === 0) return ''
      const parts: string[] = []
      for (const f of mdFiles) {
        const result = await ipc.invokeWithProjectSession(projectSession, 'fs:read-file', f.path, projectPath)
        if (result.success && result.content.trim()) {
          parts.push(promptLanguageText(
            writingLanguage,
            `## 项目专属指导（${f.name.replace(/\.md$/, '')}）\n${result.content.trim()}`,
            `## Project-specific guidance (${f.name.replace(/\.md$/, '')})\n${result.content.trim()}`,
          ))
        }
      }
      return parts.join('\n\n')
    } catch { return '' }
  }

  /**
   * 读取本章出场角色的作者档案。
   *
   * 返回注入文本，以及「蓝图点名但名册里没有卡片 / 无法唯一匹配」的角色名，
   * 供调用方给出软提示 —— 章节蓝图可能提到尚无卡片的人物，这是数据缺口而非组装错误，
   * 因此不阻断生成，只把缺口显式告知作者，避免静默跳过。
   */
  private async readCharacterProfiles(
    projectPath: string,
    projectSession: ProjectSessionContext,
    writingLanguage: WritingLanguage,
    relevantCharacterNames: readonly string[],
  ): Promise<{ text: string; missingNames: string[] }> {
    try {
      const roster = await ipc.invokeWithProjectSession(projectSession, 'db:character-roster-read', projectPath)
      if (roster.status !== 'ready' && roster.status !== 'empty') {
        return {
          text: promptLanguageText(
            writingLanguage,
            '（角色资料来源未知或待修复；未作为作者事实注入）',
            '(character-profile provenance is unknown or needs repair; it was not injected as author fact)',
          ),
          missingNames: [],
        }
      }
      const profiles: string[] = []
      const relevantNames = new Set(relevantCharacterNames.map(name => name.trim()).filter(Boolean))
      const selected = new Set<typeof roster.entries[number]>()
      const matchedNames = new Set<string>()
      const missingNames: string[] = []
      for (const name of relevantNames) {
        const named = roster.entries.filter(card => card.name === name)
        const renamed = roster.entries.filter(card => card.name !== name && card.characterId
          && roster.aliases?.some(alias => alias.name === name && alias.characterId === card.characterId))
        // 旧名被另一角色复用时无法判断蓝图指谁，宁可不注入也不注入错的档案或中断写稿。
        if (renamed.length === 0) {
          if (named.length === 0) missingNames.push(name)
          for (const card of named) { selected.add(card); matchedNames.add(name) }
        } else if (named.length === 0 && renamed.length === 1) {
          selected.add(renamed[0]); matchedNames.add(name)
        } else if (named.length === 0) {
          // 旧名被多个角色复用，无法唯一匹配：不计入缺口（是歧义而非无卡）。
          matchedNames.add(name)
        }
      }
      for (const card of selected) {
        const facts = [
          card.gender && `gender: ${card.gender}`,
          card.age && `age: ${card.age}`,
          card.appearance && `appearance: ${card.appearance}`,
          card.personality && `personality: ${card.personality}`,
          card.background && `background: ${card.background}`,
          card.abilities && `abilities: ${card.abilities}`,
          card.motivation && `motivation: ${card.motivation}`,
          card.arc && `arc: ${card.arc}`,
          card.notes && `notes: ${card.notes}`,
        ].filter(Boolean)
        for (const relationship of card.relationships ?? []) {
          const target = relationship.target?.trim()
          const relation = relationship.relation?.trim()
          if (target && relation) facts.push(`relationship: ${target} (${relation})`)
        }
        const legacyRelationshipNotes = card.legacyRelationshipNotes?.trim()
        if (legacyRelationshipNotes) {
          facts.push(promptLanguageText(
            writingLanguage,
            `relationship（legacy 来源未知）: ${legacyRelationshipNotes}`,
            `relationship (legacy provenance unknown): ${legacyRelationshipNotes}`,
          ))
        }
        for (const field of CHARACTER_STATE_TEXT_FIELDS) {
          const provenance = card.currentState?.provenance?.[field]
          const value = card.currentState?.[field]?.trim()
          if (provenance?.kind === 'author' && value) {
            facts.push(`${field}@chapter${provenance.chapterNumber}: ${value}`)
          }
        }
        profiles.push(`${card.name} (${card.role || 'unknown'})${facts.length ? ` | ${facts.join(' | ')}` : ''}`)
      }
      return {
        text: profiles.length > 0 ? profiles.join('\n') : '',
        missingNames: missingNames.sort((left, right) => left.localeCompare(right, 'zh-CN')),
      }
    } catch {
      return {
        text: promptLanguageText(
          writingLanguage,
          '（角色资料读取失败；未把旧 currentState 或 characters_arch 当作作者事实）',
          '(character profiles unavailable; legacy currentState and characters_arch were not treated as author facts)',
        ),
        missingNames: [],
      }
    }
  }

  private async readFinalizedMaterials(
    projectPath: string,
    currentChapter: number,
    projectSession: ProjectSessionContext,
    currentEntities: readonly string[],
  ): Promise<{ sources: FinalizedMaterialSource[]; locatedFactCandidates: number }> {
    const FULL_WINDOW = 5
    let finalizedContinuity: FinalizedContinuityProjection[] = []
    try {
      finalizedContinuity = await ipc.invokeWithProjectSession(
        projectSession,
        'db:continuity-list-before',
        currentChapter,
        projectPath,
      )
    } catch { /* Optional derived index may be unavailable; finalized prose still loads below. */ }

    const selected = finalizedContinuity.flatMap(projection => {
      const isRecent = projection.chapterNumber >= currentChapter - FULL_WINDOW
      const factEvidence = (projection.facts ?? []).filter(fact => {
        const entityRelevant = fact.entities.some(entity => currentEntities.includes(entity))
          || currentEntities.some(entity => (
            fact.statement.includes(entity) || fact.evidence.includes(entity)
          ))
        return isRecent || entityRelevant
      }).map(fact => fact.evidence).filter(Boolean)
      const candidateEvidence = (projection.characterStateCandidates ?? [])
        .filter(candidate => isRecent || currentEntities.includes(candidate.characterName))
        .map(candidate => candidate.value || candidate.characterName)
        .filter(Boolean)
      const evidence = [...new Set([...factEvidence, ...candidateEvidence])]
      return evidence.length > 0 ? [{ projection, evidence }] : []
    }).sort((left, right) => right.projection.chapterNumber - left.projection.chapterNumber).slice(0, 12)

    const sources: FinalizedMaterialSource[] = []
    for (const { projection, evidence } of selected) {
      try {
        const sourceDraftId = projection.sourceStatus === 'stale' && projection.currentFinalizedDraftId
          ? projection.currentFinalizedDraftId : projection.draftId
        const sourceRead = await ipc.invokeWithProjectSession(
          projectSession,
          'db:continuity-read-source',
          sourceDraftId,
          projectPath,
        )
        const content = sourceRead.status === 'valid'
          ? sourceRead.snapshot.content
          : sourceRead.status === 'legacy'
            ? sourceRead.content
            : ''
        if (projection.chapterNumber === currentChapter - 1 && !content.trim()) continue
        sources.push({
          chapterNumber: projection.chapterNumber,
          draftId: sourceDraftId,
          title: sourceRead.status === 'valid' ? sourceRead.snapshot.chapterTitle : sourceRead.status === 'legacy' ? sourceRead.chapterTitle : projection.chapterTitle,
          content,
          evidence,
          includeEnding: projection.chapterNumber === currentChapter - 1,
          sourceStatus: sourceRead.status === 'invalid'
            ? 'invalid'
            : sourceRead.status === 'legacy'
              ? 'legacy'
              : projection.sourceStatus ?? 'current',
          ...(sourceRead.status === 'valid'
            ? {
                sourceIdentity: {
                  kind: 'finalized' as const,
                  finalizationId: sourceRead.snapshot.source.finalizationId,
                  contentHash: sourceRead.snapshot.source.contentHash,
                },
              }
            : sourceRead.status === 'legacy'
              ? { sourceIdentity: { kind: 'legacy-finalized' as const } }
              : {}),
        })
      } catch {
        if (projection.chapterNumber === currentChapter - 1) continue
        sources.push({
          chapterNumber: projection.chapterNumber,
          draftId: projection.draftId,
          title: projection.chapterTitle,
          content: '',
          evidence,
          includeEnding: projection.chapterNumber === currentChapter - 1,
          sourceStatus: 'invalid',
        })
      }
    }

    if (!sources.some(source => (
      source.chapterNumber === currentChapter - 1
      && source.sourceStatus !== 'invalid'
      && Boolean(source.content.trim())
    ))) {
      try {
        const meta = await ipc.invokeWithProjectSession(
          projectSession,
          'db:draft-get-finalized',
          currentChapter - 1,
          projectPath,
        )
        if (meta) {
          try {
            const sourceRead = await ipc.invokeWithProjectSession(
              projectSession,
              'db:continuity-read-source',
              meta.id,
              projectPath,
            )
            sources.push({
              chapterNumber: currentChapter - 1,
              draftId: meta.id,
              title: sourceRead.status === 'valid'
                ? sourceRead.snapshot.chapterTitle
                : sourceRead.status === 'legacy'
                  ? sourceRead.chapterTitle
                  : meta.chapterTitle ?? '',
              content: sourceRead.status === 'valid'
                ? sourceRead.snapshot.content
                : sourceRead.status === 'legacy'
                  ? sourceRead.content
                  : '',
              evidence: [],
              includeEnding: true,
              sourceStatus: sourceRead.status === 'valid' ? 'current' : sourceRead.status,
              ...(sourceRead.status === 'valid'
                ? {
                    sourceIdentity: {
                      kind: 'finalized' as const,
                      finalizationId: sourceRead.snapshot.source.finalizationId,
                      contentHash: sourceRead.snapshot.source.contentHash,
                    },
                  }
                : sourceRead.status === 'legacy'
                  ? { sourceIdentity: { kind: 'legacy-finalized' as const } }
                  : {}),
            })
          } catch {
            sources.push({
              chapterNumber: currentChapter - 1,
              draftId: meta.id,
              title: meta.chapterTitle ?? '',
              content: '',
              evidence: [],
              includeEnding: true,
              sourceStatus: 'invalid',
            })
          }
        }
      } catch { /* Existing guard owns absence; do not invent a source identity. */ }
    }
    return { sources, locatedFactCandidates: selected.reduce((sum, item) => sum + item.evidence.length, 0) }
  }

  private async readActiveNarrativeThreads(
    projectPath: string,
    projectSession: ProjectSessionContext,
    writingLanguage: WritingLanguage,
  ): Promise<{ text: string; count: number }> {
    let threads: NarrativeThreadView[] = []
    try {
      threads = await ipc.invokeWithProjectSession(
        projectSession,
        'db:narrative-thread-list-relevant',
        {
          chapterNumber: this.chapterInfo.chapterNumber,
          title: this.chapterInfo.title,
          keyEvents: this.chapterInfo.keyEvents,
          characters: [...this.chapterInfo.characters],
        },
        projectPath,
      )
    } catch {
      return { text: '', count: 0 }
    }

    const header = promptLanguageText(
      writingLanguage,
      '【当前相关活跃叙事线索】',
      '[Relevant active narrative threads]',
    )
    const lines: string[] = []
    let usedChars = header.length + 1
    for (const thread of threads.slice(0, ACTIVE_THREAD_CONTEXT_MAX_ITEMS)) {
      const source = thread.events.at(-1)
      const line = promptLanguageText(
        writingLanguage,
        `- ${thread.title} [${thread.status}]（目标第${thread.targetStartChapter}–${thread.targetEndChapter}章；作者意图：${thread.authorIntent}${source ? `；来源第${source.chapterNumber}章：${source.evidence}` : ''}）`,
        `- ${thread.title} [${thread.status}] (target Chapters ${thread.targetStartChapter}–${thread.targetEndChapter}; author intent: ${thread.authorIntent}${source ? `; source Chapter ${source.chapterNumber}: ${source.evidence}` : ''})`,
      )
      const nextLength = line.length + (lines.length > 0 ? 1 : 0)
      if (usedChars + nextLength > ACTIVE_THREAD_CONTEXT_MAX_CHARS) break
      lines.push(line)
      usedChars += nextLength
    }
    if (lines.length === 0) return { text: '', count: 0 }
    return {
      text: `${header}\n${lines.join('\n')}`,
      count: lines.length,
    }
  }
}
