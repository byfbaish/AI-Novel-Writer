import type { MainGenerationRunHandle, MainGenerationSnapshot } from '../services/generation/generation-runtime'
import type { GenerationAuthorInput, VisibleCompositionReceipt } from './generation-owner-contract'
import type { ExpectedDraftSource, NovelConfig } from './ipc-channels'
import type { DraftStatus } from './draft-status'
import type { Locale } from '../i18n/types'
import type { WritingLanguage } from './writing-language'
import type { FrozenChapterGoals } from './chapter-goal-review'
import type { BlueprintForPreflight, ConsistencyFinding } from './consistency-preflight'
import type { FinalizedContinuityProjection, FinalizedSourceIdentity } from './finalized-continuity'
import type { HumanConfirmedReviewSnapshot } from './human-confirmed-review'
import type { ReviewCycleRecheckContext } from './review-cycle'
import { renderHumanConfirmedReviewBrief } from './human-confirmed-review'
import { writingLanguageText } from './writing-language'
import { keyEventsText } from './blueprint-key-events'

export type ReviewRevisionOperation = 'review-chapter' | 'refine-draft' | 'refine-from-review'
/** Asserts the author's selected version; prose and all stored facts are loaded by main. */
export interface PrepareReviewRevisionRequest {
  operation: ReviewRevisionOperation
  draftId: number
  expectedDraft: { chapterNumber: number; version: number; status: DraftStatus; contentHash: string }
  reviewSourceId?: number
  confirmedReviewContent?: string
  reviewCycleId?: string
  expectedMergedHash?: string
  authorInputs: GenerationAuthorInput[]
  uiLocale: Locale
}
/**
 * 一条材料的来源身份：主进程捕获的、S10A 选择契约所需的最小集合。
 *
 * 它是**只增不减**字段。渲染层只能消费主进程给出的身份，绝不自行编造来源；
 * 缺少身份的材料不能进入上下文（必需项缺失时整体显式失败）。
 * `provenance` 用选择契约的词汇，未知来源不得被洗成 author。
 *
 * **它必须与会话无关**：这里绝不保存 `epoch`（会话租约）。同一项目重开后租约必然改变，
 * 把租约冻进来源清单会让比较与准入在重开后假失败（见
 * `generation-source-binding.ts` 跨会话比较时对 `SourceRef.epoch` 的剥离，
 * 两者是同一条规则）。活跃租约由使用方在构造 `SourceRef` 时按当前会话补上。
 */
export interface ReviewMaterialIdentity {
  projectId: string
  sourceId: string
  revision: number
  /** SHA-256 of the unmodified UTF-8 bytes of the material source. */
  contentHash: string
  provenance: 'finalized' | 'legacy' | 'author' | 'derived' | 'generated' | 'unknown'
}
export interface ReviewFinalizedMaterial {
  draftId: number
  chapterNumber: number
  chapterTitle: string
  content: string
  source?: FinalizedSourceIdentity
  /** Only current projections may supply derived facts; other rows supply original prose. */
  projection?: FinalizedContinuityProjection
  /** 主进程捕获的来源身份；渲染层据此做准入，不据此编造事实。 */
  identity?: ReviewMaterialIdentity
}
/** Main-issued frozen prompt and normalization inputs; not a second writable fact store. */
export interface ReviewRevisionContext {
  version: 1
  operation: ReviewRevisionOperation
  source: ExpectedDraftSource
  sourceHash: string
  config: NovelConfig
  writingLanguage: WritingLanguage
  uiLocale: Locale
  authorInputs: GenerationAuthorInput[]
  characterStates: string
  /**
   * 故事日序块（W2）：每章的「第几天」取自定稿要点，不按章号推算。
   * 缺省 = 没有可用快照（旧项目 / 首次审稿前尚未定稿），此时不渲染这一段。
   */
  storyDayAnchors?: string
  worldbuilding: string
  history: ReviewFinalizedMaterial[]
  /** Exact saved predecessor bound by the source draft, never an inferred latest version. */
  predecessor?: ReviewFinalizedMaterial
  blueprints: BlueprintForPreflight[]
  frozenGoals: FrozenChapterGoals
  preflightFindings: ConsistencyFinding[]
  confirmation?: { reviewSourceId: number; content: string; originalReviewContentHash: string; snapshot: HumanConfirmedReviewSnapshot }
  recheck?: ReviewCycleRecheckContext
}

/** 蓝图进 prompt 的投影：`keyEvents` 收敛为「一行一条」文本（设计稿 §3 文本呈现）。 */
type PromptBlueprint = Omit<BlueprintForPreflight, 'keyEvents'> & { keyEvents: string }
function blueprintForPrompt(blueprint: BlueprintForPreflight): PromptBlueprint {
  return { ...blueprint, keyEvents: keyEventsText(blueprint.keyEvents) }
}

/** Task approval does not turn an AI-proposed replacement into an author fact. */
export function reviewRevisionAiBrief(context: ReviewRevisionContext): string {
  const snapshot = context.confirmation?.snapshot
  return snapshot ? renderHumanConfirmedReviewBrief({ ...snapshot, authorGuidance: '',
    items: snapshot.items.filter(item => item.origin === 'ai') }, context.writingLanguage) : ''
}

/**
 * 审稿链可从作者材料块中**省略**的字段（P7，2026-10-16）。
 *
 * 存在的理由：审稿链的模板（`consistency_check`）已用 `builder.withWorldBuilding` /
 * `withCharacterStates` 单独注入了这两项，而作者材料块**也含同名内容** ⇒ 同一份材料
 * 在一个请求里出现两遍（实机 ch2：世界观 6,220 + 6,221 = user 的 38.3%）。
 *
 * **只删材料侧一份**：精修（`refine-from-review`）与改写（`refine-draft`）的 builder
 * **不注入**这两项，材料块是它们**唯一**来源 ⇒ 绝不能无条件删字段（否则毁掉另两链）。
 * 故用**可选参数**实现，默认行为逐字不变。
 */
export type ReviewAuthorMaterialOmittable = 'worldbuilding' | 'characterStates'

/**
 * **单点判定**：某个审稿/修稿操作是否省略作者材料块中「已由模板变量注入」的字段。
 *
 * ⚠️ **渲染层与主进程必须调用同一个函数**。渲染层用它构造 prompt 与 `materialDecision`
 * 的 `contentHash`；主进程 `electron/services/generation-source-binding.ts` 会**重算同一
 * 文本**来核对哈希。两边各写一份判断 ⇒ 一旦漂移就是
 * 「渲染层按省略版算 hash、主进程按完整版核对」⇒ `GENERATION_MATERIAL_DECISION_INVALID`
 * —— **2026-10-16 P7 实施时实际踩过**（只改了渲染层，主进程没跟上）。
 *
 * - **审稿链**（`review-chapter`，含其 `recheck`）：**省略** —— 模板 `consistency_check`
 *   已用 `withWorldBuilding` / `withCharacterStates` 单独注入这两项，材料块再给一份就是重复。
 * - **修稿链**（`refine-draft` / `refine-from-review`）：**不省略** —— 它们的 builder 不注入
 *   这两项，材料块是**唯一**来源。
 */
export function authorMaterialOmitForOperation(
  operation: string,
): { omit: readonly ReviewAuthorMaterialOmittable[] } | undefined {
  // **白名单式**：只有审稿链省略。新增 operation 时默认**不省略** —— 宁可重复下发，
  // 不可静默丢材料（`generation-source-binding.ts` 已把 operation 限定在四个之内）。
  return operation === 'review-chapter'
    ? { omit: ['worldbuilding', 'characterStates'] }
    : undefined
}

/** One immutable author-material block shared by renderer admission and main hash validation. */
export function reviewRevisionAuthorMaterial(
  context: ReviewRevisionContext,
  options?: { omit?: readonly ReviewAuthorMaterialOmittable[] },
): string {
  const text = (zh: string, en: string) => writingLanguageText(context.writingLanguage, zh, en)
  const snapshot = context.confirmation?.snapshot
  const omit = new Set<ReviewAuthorMaterialOmittable>(options?.omit ?? [])
  // Keep each source label, but emit an identical text/prefix only at its longest source.
  // The frozen originals stay intact for recovery and source validation.
  //
  // ⚠️ P7：省略 `worldbuilding` 后**必须**把它从比较基准中一并移除。否则若
  // `config.worldSetting` 恰是 `worldbuilding` 的完整前缀，`authorText` 会把它换成
  // 「见 worldbuilding 原文」，而被引用的那一份并不在 prompt 里 ⇒ **作者设定静默丢失**。
  const sources: [string, string | undefined][] = [
    ['config.worldSetting', context.config.worldSetting],
    ['config.coreOutline', context.config.coreOutline],
    ...(omit.has('worldbuilding')
      ? []
      : [['worldbuilding', context.worldbuilding] as [string, string | undefined]]),
  ]
  sources.sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0))
  const authorText = (source: string, value: string | undefined) => {
    const original = value && sources.find(([, candidate]) => candidate?.startsWith(value))
    return original && original[0] !== source
      ? text(`（本来源原文与 ${original[0]} 的完整前缀相同，见该来源原文。）`,
        `(This source exactly matches a complete prefix of ${original[0]}; see that original text.)`)
      : value
  }
  return [
    text('【作者确认项目配置｜约束而非已发生事实】', '[Author-confirmed project configuration | constraints, not established history]'),
    JSON.stringify({ ...context.config, ...(context.operation === 'refine-draft' ? { writingStyle: undefined } : {}), globalGuidance: undefined,
      coreOutline: authorText('config.coreOutline', context.config.coreOutline),
      worldSetting: authorText('config.worldSetting', context.config.worldSetting) }, null, 2),
    text('【作者全局创作指导｜约束而非已发生事实】', '[Author global creative guidance | constraints, not established history]'),
    context.config.globalGuidance,
    ...(omit.has('worldbuilding')
      ? []
      : [text('【世界观设定】', '[Worldbuilding]'), authorText('worldbuilding', context.worldbuilding)]),
    ...(omit.has('characterStates')
      ? []
      : [text('【作者角色状态｜以标注时点为准】', '[Author character state | scoped to its annotated time]'), context.characterStates]),
    // 日序块**不受 omit 影响**：它不是世界观或角色状态，模板里也没有别的变量承载它。
    // 审稿要判「这一章的时间和前面能不能算上」，没有它就只能凭印象。
    ...(context.storyDayAnchors ? [context.storyDayAnchors] : []),
    text('【本章作者指导｜约束】', '[Current chapter author guidance | constraints]'),
    // `keyEvents` 是结构化事件清单，但**进 prompt 必须收敛为文本**：否则会把代码账目
    // （`id` / `estimatedUnits`）暴露给模型，且与正文路径（`keyEventsText`）不一致。
    JSON.stringify(context.blueprints.filter(blueprint => blueprint.chapterNumber === context.source.chapterNumber)
      .map(blueprintForPrompt), null, 2),
    text('【后续蓝图/计划｜非既定历史】', '[Future blueprints/plans | not established history]'),
    JSON.stringify(context.blueprints.filter(blueprint => blueprint.chapterNumber !== context.source.chapterNumber)
      .map(blueprintForPrompt), null, 2),
    text('【本章冻结目标｜须由正文证明】', '[Frozen chapter goals | require manuscript evidence]'),
    JSON.stringify(context.frozenGoals),
    ...context.authorInputs.map(input => input.text),
    ...(snapshot ? [renderHumanConfirmedReviewBrief({ ...snapshot,
      items: snapshot.items.filter(item => item.origin === 'author') }, context.writingLanguage)] : []),
  ].filter(Boolean).join('\n\n')
}
export interface PreparedReviewRevisionContext {
  contextId: string
  context: ReviewRevisionContext
  /** Derived by main from the saved original AI review, never supplied as authority by renderer. */
  parentRootActionId?: string
  modelId?: string
}
export interface ReviewGenerationCommitRequest {
  contextId: string
  handle: MainGenerationRunHandle
  artifact: { artifactId: string; revision: number; textHash: string }
}
export interface RevisionGenerationCommitRequest {
  contextId: string
  handle: MainGenerationRunHandle
  expectedCompositionHash: string
}
export interface ReviewRevisionCommitReceipt {
  success: true
  kind: 'review' | 'revision'
  id: number
  index: number
  content: string
  contentHash: string
  source: ExpectedDraftSource
  revisionStatus?: 'pending' | 'merged' | 'discarded'
  reviewCycle?: { cycleId: string; revisionStatus: 'merge-committed'; recheckCount: 0 | 1;
    disposition: 'required' | 'not-required' | 'completed' }
}
export interface ReviewRevisionRecovery {
  handle: MainGenerationRunHandle
  context: ReviewRevisionContext
  modelId: string
  sourceStatus: 'current' | 'conflict'
  /** False when a terminal candidate failed deterministic save validation and is copy-only. */
  canResume: boolean
  contextId?: string
  saved?: ReviewRevisionCommitReceipt
  composition?: VisibleCompositionReceipt
  lastCompositionFinishReason?: string | null
  latestArtifact?: MainGenerationSnapshot
  latestArtifactFinishReason?: string | null
  attemptedPurposes: string[]
}
export interface ReviewRevisionGenerationInvokeChannels {
  'review-revision:prepare': { args: [request: PrepareReviewRevisionRequest]; return: PreparedReviewRevisionContext }
  'review-revision:commit-review': { args: [request: ReviewGenerationCommitRequest]; return: ReviewRevisionCommitReceipt }
  'review-revision:commit-revision': { args: [request: RevisionGenerationCommitRequest]; return: ReviewRevisionCommitReceipt }
  'review-revision:read-recovery': { args: [request: { handle: MainGenerationRunHandle }]; return: ReviewRevisionRecovery }
  /**
   * 尽力探测通道：与 read-recovery 校验完全相同，但**不可恢复时返回 null 而不抛错**。
   * 供「列出所有候选」这类批量只读探测使用——账本指认整体不一致（例如审稿后草稿又被动过）
   * 只是「这个候选没得恢复」，不是故障；走 read-recovery 会让 Electron 给每次探测打一坨
   * 未捕获 handler 异常。真正要执行恢复仍必须走 read-recovery 的硬失败语义。
   */
  'review-revision:probe-recovery': { args: [request: { handle: MainGenerationRunHandle }]; return: ReviewRevisionRecovery | null }
}
