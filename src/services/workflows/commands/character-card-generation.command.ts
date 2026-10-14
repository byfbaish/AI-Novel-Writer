import type { CharacterData } from '../../../../electron/repositories/character-repository'
import { keyEventsText } from '../../../shared/blueprint-key-events'
import type { BlueprintCharacterSyncOperation, BlueprintData } from '../../../../electron/repositories/blueprint-repository'
import type { CharacterProposalBatch, CharacterStaticFields } from '../../../shared/character-proposal'
import type { CharacterRole } from '../../../shared/character-role'
import { CHARACTER_ROLES } from '../../../shared/character-role'
import type { MainGenerationRunHandle } from '../../generation/generation-runtime'
import { ipc } from '../../ipc-client'
import { localizeNovelConfigFacts } from '../../../shared/novel-config-localization'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../../shared/project-session-context'
import { composePromptSystemRole, renderPrompt, resolvePromptTemplate } from '../../prompt-templates'
import { useProjectStore } from '../../../stores/project-store'
import { promptLanguageText } from '../../prompt-language'
import { formatCharacterProposalPreview } from '../character-proposal-preview'
import { characterRosterIdentityKey } from '../../../shared/character-roster'
import { blueprintCandidateNote, pendingBlueprintCandidates } from '../../character-card-generation-sources'
import { requireWorkflowProjectSession, workflowUiText, workflowWritingLanguage } from '../workflow-project-session'
import {
  BaseWorkflowCommand,
  type CommandExecuteParams,
  type WorkflowGenerationRuntimeDependencies,
} from './base-command'

const CHARACTER_BACKGROUND_OPERATION = 'character-background-synthesis'

interface ParsedCharacterCard {
  name: string
  role?: CharacterRole
  gender?: string
  age?: string
  appearance?: string
  personality?: string
  background?: string
  abilities?: string
  motivation?: string
  arc?: string
  notes?: string
}

export interface ParsedBackgroundSynthesis {
  characterCard: ParsedCharacterCard
  relationships: { targetName: string; relation: string }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Accepts exactly one JSON root or one complete fenced JSON block; never scans prose. */
function parseJsonRoot(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  const candidate = fenced ? fenced[1].trim() : trimmed
  if (!candidate || !/^[{[]/u.test(candidate)) throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  try {
    return JSON.parse(candidate) as unknown
  } catch {
    throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  }
}

export function parseCharacterBackgroundSynthesis(raw: string): ParsedBackgroundSynthesis {
  const parsed = parseJsonRoot(raw)
  const record = isRecord(parsed) && isRecord(parsed.character) ? parsed.character : parsed
  if (!isRecord(record)) throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  const name = optionalText(record.name)
  if (!name) throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  const role = optionalText(record.role)
  const characterCard: ParsedCharacterCard = {
    name,
    ...(role && CHARACTER_ROLES.includes(role as CharacterRole) ? { role: role as CharacterRole } : {}),
    ...(optionalText(record.gender) ? { gender: optionalText(record.gender)! } : {}),
    ...(optionalText(record.age) ? { age: optionalText(record.age)! } : {}),
    ...(optionalText(record.appearance) ? { appearance: optionalText(record.appearance)! } : {}),
    ...(optionalText(record.personality) ? { personality: optionalText(record.personality)! } : {}),
    ...(optionalText(record.background) ? { background: optionalText(record.background)! } : {}),
    ...(optionalText(record.abilities) ? { abilities: optionalText(record.abilities)! } : {}),
    ...(optionalText(record.motivation) ? { motivation: optionalText(record.motivation)! } : {}),
    ...(optionalText(record.arc) ? { arc: optionalText(record.arc)! } : {}),
    ...(optionalText(record.notes) ? { notes: optionalText(record.notes)! } : {}),
  }
  const rawRelationships = isRecord(parsed) ? (parsed.relationships ?? parsed.relationshipCandidates) : undefined
  const relationships = Array.isArray(rawRelationships)
    ? rawRelationships.flatMap(candidate => {
      if (!isRecord(candidate)) return []
      const targetName = optionalText(candidate.target) ?? optionalText(candidate.targetName)
      const relation = optionalText(candidate.relation)
      return targetName && relation ? [{ targetName, relation }] : []
    })
    : []
  return { characterCard, relationships }
}

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
    const operations = await ipc.invokeWithProjectSession(
      projectSession, 'db:blueprint-character-sync-list-pending', expectedProjectPath,
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
      callbacks.setProgress(100)
      return text('没有待建卡角色：蓝图声明的新角色均已有角色卡。', 'No pending candidates: every character declared by blueprints already has a card.')
    }
    // The durable per-blueprint sync operation already owns this candidate set,
    // so listing must never re-stage it and clone the completion receipt.
    const lines = pending.map(candidate => `- ${candidate.name} · ${blueprintCandidateNote(candidate.chapterNumber)}`)
    callbacks.setProgress(100)
    callbacks.log(text(
      `发现 ${pending.length} 个待建卡角色（含逐章溯源）`,
      `Found ${pending.length} pending candidate(s) with per-chapter provenance`,
    ))
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
