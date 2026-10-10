import { globalEventBus } from '../../shared/event-bus'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../shared/project-session-context'
import type { CharacterProposalBatch } from '../../shared/character-proposal'
import { localize } from '../../i18n/core'
import type { Locale } from '../../i18n/types'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { workflowResourceKey, type WorkflowDefinition } from '../../stores/workflow-store'
import type { CharacterCardGenerationSourceSelection } from '../character-card-generation-sources'

export interface CharacterCardGenerationWorkflowParams {
  projectSession: ProjectSessionContext
  sources: CharacterCardGenerationSourceSelection
  /** Source D only: the single character to flesh out. */
  characterName: string
  generationModelId: string
}

/**
 * Character-card generation from the merged entry point.
 *
 * Only two shapes exist: bulk (blueprint listing, or premise/material) and
 * single-character synthesis. Both end at the same two-step chain —
 * generate candidates, then confirm — so no source can reach the roster alone.
 */
export function createCharacterCardGenerationWorkflow(
  params: CharacterCardGenerationWorkflowParams,
  uiLocale: Locale = useLocaleStore.getState().locale,
): WorkflowDefinition {
  const text = (zhCNText: string, enUSText: string) => localize(uiLocale, zhCNText, enUSText)
  if (!sameProjectSessionContext(
    params.projectSession,
    projectSessionContextFromProject(useProjectStore.getState().currentProject),
  )) throw new Error(text(
    '当前项目已切换，无法生成角色卡',
    'The project changed, so character cards cannot be generated.',
  ))
  const generationModelId = params.generationModelId.trim()
  if (!generationModelId) throw new Error(text(
    '缺少已确认的生成模型',
    'No confirmed generation model is available.',
  ))
  const projectSession = Object.freeze({ ...params.projectSession })
  const sources = Object.freeze({ ...params.sources })
  const characterName = params.characterName.trim()

  return {
    type: 'post_process',
    title: sources.character
      ? text(`为「${characterName}」补全背景`, `Flesh out "${characterName}"`)
      : text('AI 生成角色卡', 'Generate character cards with AI'),
    projectPath: projectSession.projectPath,
    projectSession,
    generationModelId,
    uiLocale,
    resourceKeys: [workflowResourceKey('character-roster')],
    steps: [
      {
        name: sources.character
          ? text('推断角色背景', 'Infer the character background')
          : text('列出待建卡角色', 'List pending candidates'),
        description: sources.character
          ? text('依据卷纲与蓝图，生成一个有张力的人物模板', 'Draft a high-tension template from the outline and blueprints')
          : text('保留逐章溯源，确认前不写入角色名单', 'Keep per-chapter provenance; do not change the roster before confirmation'),
        executor: async (step, context, callbacks) => {
          if (sources.character) {
            const { SynthesizeCharacterBackgroundCommand } = await import('./commands/character-card-generation.command')
            return new SynthesizeCharacterBackgroundCommand(characterName).execute({ step, context, callbacks })
          }
          const { ListPendingBlueprintCandidatesCommand } = await import('./commands/character-card-generation.command')
          return new ListPendingBlueprintCandidatesCommand().execute({ step, context, callbacks })
        },
      },
      {
        name: text('确认并写入角色卡', 'Confirm and write character cards'),
        description: text('确认采用明确候选，身份不明的提议继续保留', 'Confirm clear candidates and keep unresolved proposals'),
        requiresConfirmation: true,
        executor: async (step, context, callbacks) => {
          const { CommitPlanningMaterialCharactersCommand } = await import('./commands/planning-material.command')
          await new CommitPlanningMaterialCharactersCommand().execute({ step, context, callbacks })
          globalEventBus.emit('REFRESH_RESOURCE', {
            resources: ['all'],
            projectPath: context.projectPath,
            projectSession,
          })
        },
      },
    ],
    onComplete: { mode: 'silent', message: text('角色卡已更新', 'Character cards were updated') },
  }
}

/**
 * 「让旧版生效」的运行载体。
 *
 * 把一个**已经存在的**批次放回确认闸门，因此只有确认步 —— 没有生成步，也不碰模型。
 * 这样做的原因是确认面板绑定在「等待中的运行」上：批次的 operationId 由这次运行提供，
 * 没有运行就没有可提交的授权。批次本身不被改写。
 */
export function createCharacterProposalReviewWorkflow(
  params: { projectSession: ProjectSessionContext; batch: CharacterProposalBatch },
  uiLocale: Locale = useLocaleStore.getState().locale,
): WorkflowDefinition {
  const text = (zhCNText: string, enUSText: string) => localize(uiLocale, zhCNText, enUSText)
  if (!sameProjectSessionContext(
    params.projectSession,
    projectSessionContextFromProject(useProjectStore.getState().currentProject),
  )) throw new Error(text(
    '当前项目已切换，无法恢复旧版候选',
    'The project changed, so earlier candidates cannot be restored.',
  ))
  if (params.batch.status !== 'pending-approval') throw new Error(text(
    '该批次不是待确认状态，无法恢复采用流程',
    'That batch is not awaiting confirmation, so it cannot be reopened.',
  ))
  const projectSession = Object.freeze({ ...params.projectSession })
  const batch = params.batch

  return {
    type: 'post_process',
    title: text('让旧版生效', 'Adopt an earlier version'),
    projectPath: projectSession.projectPath,
    projectSession,
    uiLocale,
    resourceKeys: [workflowResourceKey('character-roster')],
    steps: [
      {
        name: text('确认并写入角色卡', 'Confirm and write character cards'),
        description: text('确认采用明确候选，身份不明的提议继续保留', 'Confirm clear candidates and keep unresolved proposals'),
        // 发布批次供确认面板读取；不写名册。
        executor: async (_step, context, _callbacks) => { context.data.characterProposalBatch = batch },
      },
      {
        name: text('采用旧版候选', 'Adopt the earlier candidates'),
        description: text('仅采用你明确勾选的项；原记录保持不变', 'Adopt only what you explicitly pick; the original record is unchanged'),
        requiresConfirmation: true,
        executor: async (step, context, callbacks) => {
          const { CommitPlanningMaterialCharactersCommand } = await import('./commands/planning-material.command')
          await new CommitPlanningMaterialCharactersCommand().execute({ step, context, callbacks })
          globalEventBus.emit('REFRESH_RESOURCE', {
            resources: ['all'],
            projectPath: context.projectPath,
            projectSession,
          })
        },
      },
    ],
    onComplete: { mode: 'silent', message: text('旧版候选已处理', 'The earlier candidates were handled') },
  }
}
