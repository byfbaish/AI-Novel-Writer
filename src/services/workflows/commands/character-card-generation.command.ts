import type { CharacterData } from '../../../../electron/repositories/character-repository'
import { keyEventsText } from '../../../shared/blueprint-key-events'
import { parseCharacterBackgroundSynthesis, type ParsedBackgroundSynthesis } from '../../../shared/character-background-synthesis'
import type { BlueprintCharacterSyncOperation, BlueprintData } from '../../../../electron/repositories/blueprint-repository'
import type { CharacterProposalBatch, CharacterStaticFields } from '../../../shared/character-proposal'
import type { MainGenerationRunHandle } from '../../generation/generation-runtime'
import { ipc } from '../../ipc-client'
import { localizeNovelConfigFacts } from '../../../shared/novel-config-localization'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../../shared/project-session-context'
import { composePromptSystemRole, renderPrompt, resolvePromptTemplate } from '../../prompt-templates'
import { useProjectStore } from '../../../stores/project-store'
import { promptLanguageText } from '../../prompt-language'
// 解析器本体已移到 shared（主进程证明需要同一份实现）；这里再导出以保持既有调用点不变。
export { parseCharacterBackgroundSynthesis } from '../../../shared/character-background-synthesis'
export type { ParsedBackgroundSynthesis } from '../../../shared/character-background-synthesis'
import { formatCharacterProposalPreview } from '../character-proposal-preview'
import { characterRosterIdentityKey, type CharacterRosterEntry } from '../../../shared/character-roster'
import { blueprintCandidateNote, pendingBlueprintCandidates } from '../../character-card-generation-sources'
import { requireWorkflowProjectSession, workflowUiText, workflowWritingLanguage } from '../workflow-project-session'
import {
  BaseWorkflowCommand,
  type CommandExecuteParams,
  type WorkflowGenerationRuntimeDependencies,
} from './base-command'

const CHARACTER_BACKGROUND_OPERATION = 'character-background-synthesis'

/**
 * Source D stages exactly one item. The stage seam derives items from the AI
 * artifact alone, so the parsed candidate is carried as the fallback item and
 * the display-only provenance note is attached to the returned batch.
 */
export class SynthesizeCharacterBackgroundCommand extends BaseWorkflowCommand<string> {
  constructor(
    private readonly characterName: string,
    generationDependencies?: WorkflowGenerationRuntimeDependencies,
  ) {
    super(generationDependencies)
  }

  async execute(params: CommandExecuteParams): Promise<string> {
    return this.executeWithGenerationRuntime('text', params, () => this.executeWithinGeneration(params), {
      operation: CHARACTER_BACKGROUND_OPERATION,
      promptKeys: ['character_background_synthesis'],
      skillStages: ['planning'],
      output: 'visible-text',
      authorInputs: [{ id: 'character-generation:name', text: this.characterName.trim() }],
    })
  }

  private async executeWithinGeneration({ context, callbacks }: CommandExecuteParams): Promise<string> {
    const text = (zh: string, en: string) => workflowUiText(context, zh, en)
    const projectSession = requireWorkflowProjectSession(context)
    const writingLanguage = workflowWritingLanguage(context)
    const name = this.characterName.trim()
    if (!name) throw new Error(text('请填写要补全背景的角色名。', 'Enter the character name to flesh out.'))

    const project = useProjectStore.getState().currentProject
    const expectedProjectPath = projectSession.projectPath
    const blueprints = await ipc.invokeWithProjectSession(projectSession, 'db:blueprint-get-all', expectedProjectPath) as BlueprintData[]
    const cards = await ipc.invokeWithProjectSession(projectSession, 'db:character-get-all', expectedProjectPath) as CharacterData[]
    const facts = project ? localizeNovelConfigFacts(project.novelConfig, writingLanguage) : undefined
    const config = project?.novelConfig
    const missing = promptLanguageText(writingLanguage, '（未填写）', '(not provided)')

    const mentions = blueprints
      .filter(blueprint => blueprint.characters.includes(name)
        || blueprint.newCharacterCandidates?.some(candidate => candidate.name === name))
      .map(blueprint => `【第 ${blueprint.chapterNumber} 章 · ${blueprint.title}】\n${blueprint.purpose}\n${keyEventsText(blueprint.keyEvents)}`)
      .join('\n\n')
      || promptLanguageText(writingLanguage, '（蓝图未提到该角色）', '(No blueprint mentions this character)')
    const roster = cards
      .map(card => `- ${card.name}｜${card.role ?? ''}｜${card.personality || card.background || ''}`)
      .join('\n')
      || promptLanguageText(writingLanguage, '（暂无既有角色卡）', '(No existing cards)')

    const template = await resolvePromptTemplate('character_background_synthesis', projectSession, writingLanguage)
    if (!template) throw new Error('CHARACTER_BACKGROUND_TEMPLATE_MISSING')
    const generation = this.requireGenerationExecution()
    const outcome = await generation.session.complete({
      purpose: CHARACTER_BACKGROUND_OPERATION,
      output: 'visible-text',
      messages: [
        { role: 'system', content: composePromptSystemRole(template, writingLanguage) },
        {
          role: 'user',
          content: renderPrompt(template, {
            character_name: name,
            mainline: [config?.coreOutline, config?.globalGuidance, facts?.genre].filter(Boolean).join('\n') || missing,
            mentions,
            existing_roster: roster,
          }, writingLanguage),
        },
      ],
    })
    if (outcome.status !== 'completed') throw new Error(text('角色背景生成未完成。', 'Character-background generation did not complete.'))

    this.assertNotCancelled(context)
    const parsed = parseCharacterBackgroundSynthesis(outcome.content)
    const handle = context.mainGenerationRunHandle as MainGenerationRunHandle | undefined
    const artifact = outcome.receipt.visibleArtifact
    if (!handle || !artifact) throw new Error('CHARACTER_PROPOSAL_GENERATION_ARTIFACT_REQUIRED')
    const batch = await ipc.invokeWithProjectSession(projectSession, 'character-proposal:stage', {
      source: { kind: 'generation', inputKind: 'planning-material', handle,
        artifacts: [{ artifactId: artifact.artifactId, revision: artifact.revision, textHash: artifact.textHash }] },
    })
    const enriched = attachSynthesisFallback(batch, parsed)
    context.data.characterProposalBatch = enriched
    callbacks.setProgress(100)
    callbacks.log(text(
      `已为「${name}」生成 1 张待确认角色卡模板，角色名单尚未更改`,
      `Generated one candidate template for "${name}"; the roster is unchanged.`,
    ))
    return formatCharacterProposalPreview(enriched, text)
  }
}

/** Source B read-only listing for the merged entry point. */
export class ListPendingBlueprintCandidatesCommand extends BaseWorkflowCommand<string> {
  async execute({ context, callbacks }: CommandExecuteParams): Promise<string> {
    const text = (zh: string, en: string) => workflowUiText(context, zh, en)
    const projectSession = requireWorkflowProjectSession(context)
    if (!sameProjectSessionContext(projectSession, projectSessionContextFromProject(useProjectStore.getState().currentProject))) {
      throw new Error(text('当前项目已切换，角色卡生成已停止。', 'The project changed, so generation stopped.'))
    }
    const expectedProjectPath = projectSession.projectPath
    // 必须看全量操作：completion 只说明"提议已暂存过"，不说明"作者已处理"。
    // 只看 pending 的话，批次一旦暂存过（哪怕后来被取消），这个入口就永久失效（实机：老陈案）。
    const operations = await ipc.invokeWithProjectSession(
      projectSession, 'db:blueprint-character-sync-list-all', expectedProjectPath,
    ) as BlueprintCharacterSyncOperation[]
    const cards = await ipc.invokeWithProjectSession(
      projectSession, 'db:character-get-all', expectedProjectPath,
    ) as CharacterData[]
    // 作者已确认为「功能配角、不建卡」的名字同样是已处理项，否则该清单永远清不空。
    const declined = await ipc.invokeWithProjectSession(
      projectSession, 'character-proposal:list-declined',
    ) as string[]
    const pending = pendingBlueprintCandidates(operations, cards.map(card => card.name), declined)
    if (!pending.length) {
      // 空也要落键：确认步以该键区分"没得确认"（优雅收场）与"提取步没跑"（配置错误）。
      context.data.planningMaterialCharacterCandidates = []
      callbacks.setProgress(100)
      return text('没有待建卡角色：蓝图声明的新角色都已有角色卡，或已登记为功能配角。', 'No pending candidates: every character declared by blueprints already has a card or is registered as an anchored supporting role.')
    }
    // The durable per-blueprint sync operation already owns this candidate set,
    // so listing must never re-stage it and clone the completion receipt.
    const lines = pending.map(candidate => `- ${candidate.name} · ${blueprintCandidateNote(candidate.chapterNumber)}`)
    callbacks.setProgress(100)
    callbacks.log(text(
      `发现 ${pending.length} 个待建卡角色（含逐章溯源）`,
      `Found ${pending.length} pending candidate(s) with per-chapter provenance`,
    ))
    // 把候选接上确认闸门：对仍含未决定候选的操作幂等 stage（stage 对 proposalBatchId 幂等）。
    // 取消过的批次在这里重开 —— 取消不落任何身份效果，作者常因保存报错而取消，应能重来。
    let confirmed: CharacterProposalBatch | undefined
    for (const operation of operations) {
      const opNames = new Set(pendingBlueprintCandidates([operation], cards.map(card => card.name), declined).map(item => characterRosterIdentityKey(item.name)))
      if (!opNames.size) continue
      let batch = await ipc.invokeWithProjectSession(projectSession, 'character-proposal:stage',
        { source: { kind: 'directory', operationId: operation.operationId } }) as CharacterProposalBatch
      if (batch.status === 'cancelled') {
        batch = await ipc.invokeWithProjectSession(projectSession, 'character-proposal:reopen',
          { proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision }) as CharacterProposalBatch
        callbacks.log(text('此前的候选批次曾被取消，已重新打开供确认。', 'An earlier cancelled batch was reopened for confirmation.'))
      }
      if (batch.status === 'pending-approval' && !confirmed) confirmed = batch
    }
    if (confirmed) {
      context.data.characterProposalBatch = confirmed
      // 确认步以该键区分"没得确认"与"提取步没跑"；写入路径只消费批次，条目仅作闸门。
      context.data.planningMaterialCharacterCandidates = confirmed.items.map(item => ({
        name: item.fields.name, role: item.fields.role || 'supporting',
      })) as unknown as CharacterRosterEntry[]
    }
    return [text('## 待建卡角色', '## Pending character candidates'), ...lines].join('\n')
  }
}

/**
 * Attach display-only provenance and fall back to the parsed candidate when the
 * stage seam produced no items. Neither path touches the frozen batch record.
 */
export function attachSynthesisFallback(batch: CharacterProposalBatch, parsed: ParsedBackgroundSynthesis): CharacterProposalBatch {
  const fallback: CharacterProposalBatch['items'][number] = {
    selectionKey: `background:${characterRosterIdentityKey(parsed.characterCard.name)}`,
    sourceId: `character-background:${parsed.characterCard.name}`,
    fields: parsed.characterCard as CharacterStaticFields,
    relationships: parsed.relationships.map(relation => ({ targetName: relation.targetName, relation: relation.relation, raw: relation })),
    rawValue: parsed,
    resolution: { status: 'unresolved', candidateIds: [] },
  }
  const items = batch.items.length ? batch.items : [fallback]
  return { ...batch, items }
}

/** Blueprint-sourced candidates carry their chapter so the note is never a guess. */
export function blueprintSourceNotes(pending: readonly { name: string; chapterNumber: number }[]): Map<string, string> {
  return new Map(pending.map(candidate => [characterRosterIdentityKey(candidate.name), blueprintCandidateNote(candidate.chapterNumber)]))
}
