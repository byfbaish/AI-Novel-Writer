import { globalEventBus } from '../../shared/event-bus'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { characterRosterIdentityKey } from '../../shared/character-roster'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../shared/project-session-context'
import { localize } from '../../i18n/core'
import type { Locale } from '../../i18n/types'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { workflowResourceKey, type WorkflowDefinition } from '../../stores/workflow-store'

export interface CastLedgerCompletionWorkflowParams {
  projectSession: ProjectSessionContext
  /** 归位表里「被提到但没有卡」的名字。可以是待补全的候选全集，命令会再按角色卡过滤。 */
  names: string[]
  generationModelId: string
}

/**
 * 名单归一化：trim、去空、按身份键去大小写重复，保留首次出现的原写法。
 *
 * 与 commands/cast-ledger-completion.command.ts 里的 normalizeCastLedgerCompletionNames 同一规则。
 * 这里不 import 命令模块，是因为工厂必须同步返回 WorkflowDefinition（不能 await 动态 import），
 * 而静态 import 命令会把生成运行时/提示词装配整条链拖进「只想打开工作流」的调用方。
 */
function normalizeNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const name of names) {
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (!trimmed) continue
    const key = characterRosterIdentityKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
  }
  return normalized
}

/**
 * 归位表补全工作流（阶段3b）。
 *
 * 两段式与既有角色卡生成链完全同构：先补全资料（只读 + 生成，stage 出 pending 批次），
 * 再确认写入（approve 才真正改角色名单）。理由是把「烧配额」和「写名单」拆成两次显式动作：
 * 补全阶段绝不改名单，作者不确认就只有一个待确认批次，删掉即可。
 */
export function createCastLedgerCompletionWorkflow(
  params: CastLedgerCompletionWorkflowParams,
  uiLocale: Locale = useLocaleStore.getState().locale,
): WorkflowDefinition {
  const text = (zhCNText: string, enUSText: string) => localize(uiLocale, zhCNText, enUSText)
  if (!sameProjectSessionContext(
    params.projectSession,
    projectSessionContextFromProject(useProjectStore.getState().currentProject),
  )) throw new Error(text(
    '当前项目已切换，无法补齐归位表角色卡',
    'The project changed, so cast-ledger cards cannot be completed.',
  ))
  const generationModelId = params.generationModelId.trim()
  if (!generationModelId) throw new Error(text(
    '缺少已确认的生成模型',
    'No confirmed generation model is available.',
  ))
  const projectSession = Object.freeze({ ...params.projectSession })
  // 冻结名单：工作流运行期间作者再改归位表也不会改变本次要补的名字。
  const names: readonly string[] = Object.freeze(normalizeNames(params.names))
  if (!names.length) throw new Error(text(
    '归位表里没有需要补全的名字',
    'There are no cast-ledger names to complete.',
  ))

  return {
    type: 'post_process',
    title: text('补齐归位表角色卡', 'Fill in cast-ledger cards'),
    projectPath: projectSession.projectPath,
    projectSession,
    generationModelId,
    uiLocale,
    // 只写角色名单；蓝图只读（读取章号提及作为上下文）。
    resourceKeys: [workflowResourceKey('character-roster')],
    readResourceKeys: [workflowResourceKey('blueprints')],
    steps: [
      {
        name: text('补全缺失角色资料', 'Fill missing character details'),
        description: text(
          '为归位表里提到但还没有卡的名字生成资料；确认前不写入角色名单',
          'Draft records for names mentioned in the cast ledger that have no card yet; do not change the roster before confirmation',
        ),
        executor: async (step, context, callbacks) => {
          const { CompleteCastLedgerCharactersCommand } = await import('./commands/cast-ledger-completion.command')
          return new CompleteCastLedgerCharactersCommand(names).execute({ step, context, callbacks })
        },
      },
      {
        name: text('确认并写入角色卡', 'Confirm and write character cards'),
        description: text(
          '确认采用明确候选，身份不明的提议继续保留',
          'Confirm clear candidates and keep unresolved proposals',
        ),
        requiresConfirmation: true,
        executor: async (step, context, callbacks) => {
          // 确认步复用既有审批命令：它消费 context.data.characterProposalBatch，
          // 按默认选择 approve 后才写入角色名单。
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
    onComplete: {
      mode: 'silent',
      message: text('归位表角色卡已更新', 'Cast-ledger cards were updated'),
    },
  }
}
