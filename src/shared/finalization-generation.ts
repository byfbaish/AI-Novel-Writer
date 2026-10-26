import type { MainGenerationRunHandle, MainGenerationRunView, MainGenerationExecuteReceipt } from '../services/generation/generation-runtime'
import type { FinalizedCharacterContext, FinalizedContinuityFact, FinalizedSourceIdentity } from './finalized-continuity'
import type { KnowledgeCandidateDrop } from './knowledge-candidate'
import type { FinalizedCharacterArtifact, FinalizedCharacterGenerationReceipt } from './finalized-character-generation'
import type { PromptTemplate } from '../services/builtin-prompt-templates'
import type { WritingLanguage } from './writing-language'

/** 定稿后处理的步骤。新增步骤只改下面那张表 + 各自的 commit 分支。 */
export type FinalizationStepKey = 'chapter_notes' | 'character_cards' | 'knowledge_candidates'

export interface FinalizationGenerationSlot {
  source: FinalizedSourceIdentity
  stepKey: FinalizationStepKey
}

/**
 * 步骤规格：**唯一真相**。
 *
 * 这套判断原先散落在七处二元/三元表达式里 —— `finalizationSlotKey` 的白名单、
 * `readFinalizationGenerationContext` 的 operation 判断、`finalizationGenerationTask` 的分支、
 * `main-generation-owner` 的两处准入白名单、`generation-source-binding` 的 prompt 选择、
 * `begin` 里的 promptKeys 与 output。
 *
 * 漏改任何一处都**不报编译错**，只在运行时抛 `GENERATION_FINALIZATION_ADMISSION_REQUIRED` ——
 * 步骤静默不执行（这正是 P20-3 设计稿 §7 点出的实施风险）。收敛成这张表后，加步骤只改这里。
 */
export interface FinalizationStepSpec {
  /** 生成运行的 operation，准入白名单按它判断。 */
  operation: string
  /** 计费与日志用的 purpose（与 operation 语义不同，别合并）。 */
  purpose: string
  /** `begin` 与模板加载用的 prompt key（对应 `builtin-prompt-templates` 的 key）。 */
  promptKey: string
  /** 输出合同类型（判据 CU：合同可能带 overrides，别按字面量硬比）。 */
  output: 'visible-text' | 'structured-data'
  skillStage: 'review'
}

export const FINALIZATION_STEP_SPECS: Record<FinalizationStepKey, FinalizationStepSpec> = {
  chapter_notes: {
    operation: 'finalized-chapter-notes',
    purpose: 'finalized-chapter-notes',
    promptKey: 'generate_chapter_notes',
    output: 'visible-text',
    skillStage: 'review',
  },
  character_cards: {
    operation: 'finalized-character-state',
    purpose: 'finalized-character-state',
    promptKey: 'update_character_cards',
    output: 'structured-data',
    skillStage: 'review',
  },
  knowledge_candidates: {
    operation: 'finalized-knowledge-candidates',
    purpose: 'finalized-knowledge-candidates',
    promptKey: 'propose_knowledge_candidates',
    output: 'structured-data',
    skillStage: 'review',
  },
}

export const FINALIZATION_STEP_KEYS = Object.keys(FINALIZATION_STEP_SPECS) as FinalizationStepKey[]

export function isFinalizationStepKey(value: unknown): value is FinalizationStepKey {
  return typeof value === 'string' && Object.hasOwn(FINALIZATION_STEP_SPECS, value)
}

/** 取步骤规格。调用方已持有 `FinalizationStepKey` 类型时用这个，别再写三元。 */
export function finalizationStepSpec(stepKey: FinalizationStepKey): FinalizationStepSpec {
  return FINALIZATION_STEP_SPECS[stepKey]
}

/** 该 operation 是否属于定稿后处理（准入闸门用；输入是任意字符串，来自运行清单）。 */
export function isFinalizationOperation(operation: unknown): boolean {
  return FINALIZATION_STEP_KEYS.some(key => FINALIZATION_STEP_SPECS[key].operation === operation)
}

export interface FinalizationGenerationContext {
  slot: FinalizationGenerationSlot
  identity: FinalizedCharacterContext
  chapterTitle: string
  chapterEntities: string[]
  writingLanguage: WritingLanguage
  template: PromptTemplate
  /** Actual prior derived notes, used only as a commit-time comparison baseline. */
  notesBaseline: { blueprint: { exists: boolean; notes: string }; continuityHash: string }
  /**
   * 本章**当前定稿**的连续性事实。只有 `knowledge_candidates` 步骤带它 ——
   * 其它步骤不需要，带上只会让它们的 context 指纹无谓地依赖快照（`chapter_notes` 甚至
   * 是产出事实的那一步，捕获时必然还没有）。
   *
   * 空数组不是「读取失败」，是「本章还没有可用的事实」—— 通常是 `chapter_notes` 没跑。
   * 调用方必须把这两种情形分开说（判据 DN）。
   */
  continuityFacts?: FinalizedContinuityFact[]
}
export type FinalizationGenerationEffect = {
  success: true
  stepKey: 'chapter_notes'
  chapterNotes: string
  factCount: number
  blueprintUpdated: boolean
  /** 本章距 t0 的天数（t0 = 0）；null = 未取到，不等于 0。 */
  storyDayOffset?: number | null
  /** 取不到日序时置真，供 UI 显式提示作者去补，而不是静默留空。 */
  storyDayMissing?: boolean
} | (FinalizedCharacterGenerationReceipt & { success: true; stepKey: 'character_cards' })
  | {
    success: true
    stepKey: 'knowledge_candidates'
    /** 落库的候选条数（已通过全部校验）。 */
    candidateCount: number
    /** 被丢弃的提议，逐条带原因 —— 不许静默少给。 */
    dropped: KnowledgeCandidateDrop[]
    /** 本章可用的事实条数；0 说明前置（`chapter_notes`）没跑。 */
    factCount: number
  }
export interface FinalizationGenerationRecovery {
  attemptCount: number
  view: MainGenerationRunView
  modelId: string
  context: FinalizationGenerationContext
  sourceStatus: 'current' | 'conflict'
  effect?: FinalizationGenerationEffect
}
export interface FinalizationGenerationChannels {
  'finalization-generation:read': { args: [{ slot: FinalizationGenerationSlot }]; return: FinalizationGenerationRecovery | null }
  'finalization-generation:begin': { args: [{ slot: FinalizationGenerationSlot; modelId: string; parentRootActionId?: string }]; return: FinalizationGenerationRecovery }
  'finalization-generation:execute': { args: [{ handle: MainGenerationRunHandle }]; return: MainGenerationExecuteReceipt }
  'finalization-generation:commit': { args: [{ handle: MainGenerationRunHandle; artifact: FinalizedCharacterArtifact }]; return: FinalizationGenerationEffect }
  'finalization-generation:cancel': { args: [{ handle: MainGenerationRunHandle }]; return: MainGenerationRunView }
}
