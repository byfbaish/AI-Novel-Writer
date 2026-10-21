import type { CommandExecuteParams, WorkflowGenerationRuntimeDependencies } from './base-command'
import type { ChapterInfo } from '../chapter-workflow'
import type { PreparedReviewRevisionContext } from '../../../shared/review-revision-generation'
import { ReviewRevisionCommand, type ReviewRevisionCommandSource } from './review-revision-command'
import { resolvePromptTemplate } from '../../prompt-templates'
import { ChapterPromptBuilder } from '../../prompts/prompt-builder'
import { promptLanguageText } from '../../prompt-language'
import { projectScopedText } from '../../../shared/text-scope-tags'
import {
  ChapterMaterialCapacityError,
  type ReviewRevisionMaterialAdmission,
} from '../chapter-materials'
import { requireWorkflowProjectSession, workflowUiText } from '../workflow-project-session'
import { selectFrozenReviewRevisionMaterials } from './review-revision-materials'
import { refinementFarTermSettingRule } from '../../../shared/review-far-term-setting'

export interface RefineDraftParams extends ReviewRevisionCommandSource {
  chapterInfo: ChapterInfo
  mergedGuidance?: string
  userRefinePrompt?: string
  shortSummary?: string
}

export { reviewHistoryMaterials as refineHistoryMaterials } from './review-revision-materials'

export class RefineDraftCommand extends ReviewRevisionCommand {
  constructor(params: RefineDraftParams, dependencies?: WorkflowGenerationRuntimeDependencies) {
    super('refine-draft', params, [
      { id: 'user-prompt', text: params.userRefinePrompt ?? '' },
      { id: 'merged-guidance', text: params.mergedGuidance ?? '' },
    ], {}, dependencies)
  }

  protected async generateAndCommit(prepared: PreparedReviewRevisionContext, params: CommandExecuteParams) {
    if (this.recovery?.composition && this.recovery.lastCompositionFinishReason === 'stop') {
      return this.generateRevision(prepared, params, '', '')
    }
    const frozen = prepared.context
    const language = frozen.writingLanguage
    params.callbacks.log(workflowUiText(params.context, '正在精修章节...', 'Refining the chapter...'))
    const projectSession = requireWorkflowProjectSession(params.context)
    const template = await resolvePromptTemplate('refine_chapter', projectSession, language)
    if (!template) throw new Error(workflowUiText(params.context, '未找到修稿模板', 'The revision prompt template was not found.'))
    const blueprint = frozen.blueprints.find(item => item.chapterNumber === frozen.source.chapterNumber)
    const guidance = frozen.authorInputs.find(input => input.id === 'merged-guidance')?.text || frozen.config.globalGuidance || ''
    const userPrompt = frozen.authorInputs.find(input => input.id === 'user-prompt')?.text || ''
    const userPromptBlock = userPrompt.trim() ? promptLanguageText(language,
      `【用户额外修稿指导（最高优先级）】\n${userPrompt}`,
      `[Additional author revision guidance — highest priority]\n${userPrompt}`) : ''
    // 与写稿/审稿路径同一套准入：定稿历史按身份整段纳入或整段省略，绝不无预算地整段拼接。
    const current = { projectId: projectSession.projectId, epoch: projectSession.leaseId }
    let admission: ReviewRevisionMaterialAdmission
    try {
      admission = await selectFrozenReviewRevisionMaterials(frozen, current)
    } catch (error) {
      if (!(error instanceof ChapterMaterialCapacityError)) throw error
      const blocked = error.decision.decision === 'capacity-conflict'
        ? `${error.decision.blockingSourceId}:${error.decision.blockingReason}`
        : error.decision.remainingRequired.join('、')
      params.callbacks.log(workflowUiText(params.context,
        `  必需材料超出上下文容量（${error.decision.decision}）：${blocked}`,
        `  Required material exceeds the context capacity (${error.decision.decision}): ${blocked}`))
      throw new Error(workflowUiText(params.context,
        '本章修稿的必需材料超出上下文容量，已停止修稿。请精简相关作者材料或前驱后重试。',
        'The required material for this revision exceeds the context capacity, so the revision stopped. Trim the required author material or predecessor and try again.'))
    }
    // Render only admitted materials; the frozen source text is never truncated.
    const historySummary = admission.admitted.filter(material => material.category === 'finalized-history').map(material => material.text).join('\n\n')
    const builder = new ChapterPromptBuilder(template, language)
      .withDraftContent(frozen.source.content)
      .withChapterInfo({ projectPath: params.context.projectPath, chapterNumber: frozen.source.chapterNumber,
        title: blueprint?.title ?? '', role: blueprint?.role ?? '', purpose: blueprint?.purpose ?? '',
        characters: blueprint?.characters ?? [], keyEvents: blueprint?.keyEvents ?? [] })
      .withGlobalGuidance(projectScopedText(guidance, 'draft').text)
      // 【同源摘要注入】2026-10-21 起，精修基座正文不再引用下面两个变量（恢复线索见
      // `builtin-prompt-templates.ts` 的 `refine_chapter` 注释）。保留注入是为了：
      // ① 作者自定义模板若仍写 `{{global_summary}}` / `{{short_summary}}`，不会渲染成裸占位符；
      // ② 恢复内置正文时不必再动这条命令。
      //
      // 历史问题：这两行原本喂的是同一个 `historySummary`（定稿历史全文），
      // 在内置正文「全书进度摘要 / 近期回顾」里渲染成两段逐字相同的长文
      // （`20261021-143750-201-精修` 实测各 4575 字符，约占该次请求 27%），
      // 且标签语义与内容不符——「全书摘要」里装的是上一章全文。
      // 以后若要真接上「近三章摘要」，必须分别取两份不同内容，不得复用同一字符串。
      .withGlobalSummary(historySummary)
      .withShortSummary(historySummary)
      .withWordNumber(frozen.config.wordsPerChapter)
      .withWritingStyle(projectScopedText(frozen.config.writingStyle || '', 'draft').text)
      .withUserRefinePrompt(userPromptBlock)
    // 修稿链的「远期设定使用规则」：本 prompt 经材料块含全量世界观（含 §3 终局谜底），
    // 须限定它不得被当作修稿要求（详见 shared/review-far-term-setting.ts 的 JSDoc）。
    //
    // 定稿历史为什么回到材料块（2026-10-21）：精修基座正文不再引用
    // `{{global_summary}}` / `{{short_summary}}`（同源注入已停用，见模板注释）。
    // 这两个变量原本是定稿历史唯一的入 prompt 通道，本行因此必须把
    // `finalized-history` 也并回材料块，否则精修请求会**完全没有前文**。
    // 准入决策（超额可选块整体省略 / 必需前驱必须存活 / 8MiB 上限）已经在
    // `selectFrozenReviewRevisionMaterials` 里跑过，这里只做渲染，不自己裁。
    const prompt = [builder.build(), ...admission.admitted.map(material => material.text),
      refinementFarTermSettingRule(language)].join('\n\n')
    await this.bindMaterialDecision(params, admission.decision, prompt)
    return this.generateRevision(prepared, params, prompt, builder.getSystemRole())
  }
}
