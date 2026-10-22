import type { BlueprintData } from '../../../../electron/repositories/blueprint-repository'
import type { CharacterData } from '../../../../electron/repositories/character-repository'
import type { CharacterProposalBatch, CharacterProposalSource } from '../../../shared/character-proposal'
import { decodeCharacterDetails, validateCharacterDetail, type CharacterDetailOutput } from '../../../shared/character-proposal-parser'
import { characterRosterIdentityKey } from '../../../shared/character-roster'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../../shared/project-session-context'
import type { WritingLanguage } from '../../../shared/writing-language'
import type { MainGenerationRunHandle } from '../../generation/generation-runtime'
import { ipc } from '../../ipc-client'
import { characterArchitecturePrompts } from '../../prompt-language'
import { useProjectStore } from '../../../stores/project-store'
import { formatCharacterProposalPreview } from '../character-proposal-preview'
import { createStructuredBatchExecutor, type StructuredBatchContract } from '../structured-batch-executor'
import { WorkflowGuardError, isWorkflowGuardError } from '../workflow-guard-error'
import {
  requireWorkflowProjectSession,
  workflowUiText,
  workflowWritingLanguage,
} from '../workflow-project-session'
import {
  BaseWorkflowCommand,
  injectWritingSkillIntoSession,
  type CommandExecuteParams,
  type WorkflowGenerationRuntimeDependencies,
} from './base-command'

/**
 * 这两个常量必须与主进程 electron/services/cast-ledger-generation-proof.ts:9-11 完全一致：
 * 主进程按 operation 找到本次 run，并按 authorInputs 的 id 前缀核对「模型确实为这些名字生成」。
 * 渲染层不能直接 import 那个模块（它会把 better-sqlite3 拖进渲染包），所以这里重复声明；
 * 任何一侧改动都必须同步另一侧，否则 proof 会报 CHARACTER_CAST_LEDGER_* 协议错误。
 */
const CAST_LEDGER_COMPLETION_OPERATION = 'cast-ledger-character-completion'
const CAST_LEDGER_NAME_INPUT_PREFIX = 'cast-ledger:name:'
/**
 * 与 architecture.command.ts:1262 的 CHARACTER_DETAIL_BATCH_SIZE 同值（那边是模块私有常量，
 * 没有导出）。3 个角色详情大约落在单次结构化输出的安全区间内。
 */
const CHARACTER_DETAIL_BATCH_SIZE = 3
/** 拼进提示词的上下文上限：只控制规模，真正的字节预算由注入层按实际文本现算。 */
const PREMISE_MAX_CHARS = 1200
const ROSTER_MAX_CHARS = 1500
const MENTION_MAX_CHARS = 800
const ROSTER_FIELD_MAX_CHARS = 80

interface CastLedgerSlot {
  slotId: string
  name: string
}

/**
 * 名单归一化：trim、去空、按身份键去大小写重复，保留**首次出现的原写法**。
 * 保留原写法而不是统一小写，是因为补全产物必须逐字回显名字（proof 与 stage 都按精确字符串比对），
 * 模型看到什么名字就写什么名字，避免「归一化后的名字」和「归位表里的名字」不一致。
 */
export function normalizeCastLedgerCompletionNames(names: readonly string[]): string[] {
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

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const chars = Array.from(trimmed)
  return chars.length <= maxChars ? trimmed : chars.slice(0, maxChars).join('') + '…'
}

/**
 * 与 architecture.command.ts:1273 的会话守卫同一语义：工作流启动时冻结了项目会话，
 * 一旦作者切了项目就必须立刻停下，绝不能在错误的项目上 stage 角色提议。
 */
function assertProjectSessionCurrent(
  projectSession: ReturnType<typeof requireWorkflowProjectSession>,
  context: CommandExecuteParams['context'],
): void {
  if (!sameProjectSessionContext(
    projectSession,
    projectSessionContextFromProject(useProjectStore.getState().currentProject),
  )) {
    throw new WorkflowGuardError(workflowUiText(
      context,
      '当前项目已切换，归位表补全已停止以避免写入错误项目',
      'The current project changed, so cast-ledger completion stopped to avoid writing to the wrong project.',
    ))
  }
}

function buildRosterText(cards: readonly CharacterData[], language: WritingLanguage): string {
  const zh = language === 'zh-CN'
  const lines = cards.map(card => {
    const summary = truncateText(card.personality || card.background || '', ROSTER_FIELD_MAX_CHARS)
    return '- ' + card.name + (zh ? '（定位：' : ' (role: ') + card.role + (zh ? '）' : ')')
      + (summary ? (zh ? '：' : ': ') + summary : '')
  })
  return truncateText(lines.join('\n'), ROSTER_MAX_CHARS)
}

/**
 * 把故事前提、既有角色卡、蓝图提及拼进 detail 提示词的上下文段。
 * 只做「读」：本命令没有任何写库路径，补全结果经 stage 变成可确认的批次。
 */
function buildDetailsContextText(input: {
  language: WritingLanguage
  premiseText: string
  rosterText: string
  blueprints: readonly BlueprintData[]
  slots: readonly CastLedgerSlot[]
}): string {
  const zh = input.language === 'zh-CN'
  const sections: string[] = []
  sections.push(
    (zh ? '【故事前提】\n' : '[Story premise]\n')
    + (input.premiseText || (zh ? '（作者尚未填写）' : '(not provided)')),
  )
  sections.push(
    (zh
      ? '【已有角色卡（不得重复创建；可据此建立称呼与既有关系）】\n'
      : '[Existing character cards — never duplicate one; reuse names and established relations]\n')
    + (input.rosterText || (zh ? '（暂无）' : '(none)')),
  )
  const mentions = input.slots.map(slot => {
    const chapters = input.blueprints
      .filter(blueprint => blueprint.characters.includes(slot.name))
      .map(blueprint => blueprint.chapterNumber)
    return chapters.length
      ? (zh
          ? '- ' + slot.name + '：蓝图第 ' + chapters.join('、') + ' 章已提及'
          : '- ' + slot.name + ': mentioned in blueprint chapter(s) ' + chapters.join(', '))
      : (zh
          ? '- ' + slot.name + '：蓝图未直接提及（名字来自归位表的其他上下文）'
          : '- ' + slot.name + ': not mentioned in a blueprint chapter by name')
  })
  sections.push(
    (zh
      ? '【蓝图提及的章号（判断角色何时出场）】\n'
      : '[Blueprint mentions — when each name first appears]\n')
    + truncateText(mentions.join('\n'), MENTION_MAX_CHARS),
  )
  sections.push(zh
    ? '【名单纪律】只为上面冻结清单里的 slotId 生成条目；name 必须逐字回显，不得改写、补全姓氏、音译或统一大小写。'
    : '[Name discipline] Emit entries only for the frozen slots above; echo each name verbatim. Never rewrite, expand, transliterate, or re-case a name.')
  return sections.join('\n\n')
}

/**
 * 归位表补全（②补全段）：把「归位表里被提到、但还没有角色卡」的名字补齐静态资料。
 *
 * 与架构详情的关键区别：这里没有身份规划阶段，名单就是唯一身份键。因此
 *  - 生成前先按当前角色卡过滤（已有卡的名字不必再烧一次配额）；
 *  - 生成后、stage 之前**再查一次**角色卡：如果这期间作者已经手工建卡，就放弃本次 stage，
 *    避免把过期名字写进 pending 批次；
 *  - stage 的 source 带本次生成证明（handle + artifacts），主进程会重算 proof 再从 proof 派生
 *    items —— 本命令不能、也不需要自己拼 CharacterProposalItem。
 */
export class CompleteCastLedgerCharactersCommand extends BaseWorkflowCommand<string> {
  constructor(
    private readonly names: readonly string[],
    generationDependencies?: WorkflowGenerationRuntimeDependencies,
  ) {
    super(generationDependencies)
  }

  async execute(params: CommandExecuteParams): Promise<string> {
    const { context, callbacks } = params
    const text = (zhCN: string, enUS: string) => workflowUiText(context, zhCN, enUS)
    const projectSession = requireWorkflowProjectSession(context)
    assertProjectSessionCurrent(projectSession, context)

    const names = normalizeCastLedgerCompletionNames(this.names)
    if (!names.length) {
      throw new Error(text(
        '归位表里没有需要补全的角色名。',
        'There are no cast-ledger names to complete.',
      ))
    }

    // 前置过滤：已经有角色卡的名字不再送去生成。这一步发生在 createRuntime 之前，
    // 所以「全部都有卡」的情况一次模型配额都不会花掉。
    const cards = await ipc.invokeWithProjectSession(
      projectSession,
      'db:character-get-all',
      projectSession.projectPath,
    )
    const existingKeys = new Set(cards.map(card => characterRosterIdentityKey(card.name)))
    const pendingNames = names.filter(name => !existingKeys.has(characterRosterIdentityKey(name)))
    if (!pendingNames.length) {
      const message = text(
        '这些名字都已有角色卡，无需补全。',
        'These names already have character cards; nothing to complete.',
      )
      callbacks.setProgress(100)
      callbacks.log(message)
      return message
    }

    // authorInputs 是主进程 proof 的核对依据：id 必须是 cast-ledger:name:<index>，
    // text 必须与 stage 时 source.names 逐字相同（proof 按 text 集合比对）。
    return this.executeWithGenerationRuntime(
      'character-architecture',
      params,
      () => this.executeWithinGeneration(params, pendingNames),
      {
        operation: CAST_LEDGER_COMPLETION_OPERATION,
        promptKeys: ['character_dynamics'],
        skillStages: ['planning'],
        output: 'structured-data',
        authorInputs: pendingNames.map((name, index) => ({
          id: CAST_LEDGER_NAME_INPUT_PREFIX + index,
          text: name,
        })),
      },
    )
  }

  private async executeWithinGeneration(
    params: CommandExecuteParams,
    names: readonly string[],
  ): Promise<string> {
    const { context, callbacks } = params
    const text = (zhCN: string, enUS: string) => workflowUiText(context, zhCN, enUS)
    const projectSession = requireWorkflowProjectSession(context)
    const writingLanguage = workflowWritingLanguage(context)
    assertProjectSessionCurrent(projectSession, context)

    const [core, cards, blueprints] = await Promise.all([
      ipc.invokeWithProjectSession(projectSession, 'db:project-core-get', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:character-get-all', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:blueprint-get-all', projectSession.projectPath),
    ])
    const prompts = characterArchitecturePrompts(writingLanguage)
    // slotId 用「全量名单下标」而不是批次下标：分批生成时同一名字在两批里也不会拿到不同身份键。
    const manifest: CastLedgerSlot[] = names.map((name, index) => ({
      slotId: 'cast-' + (index + 1),
      name,
    }))
    const slotById = new Map(manifest.map(slot => [slot.slotId, slot]))
    const premiseText = truncateText(core?.premise ?? '', PREMISE_MAX_CHARS)
    const rosterText = buildRosterText(cards, writingLanguage)

    const contract: StructuredBatchContract<CastLedgerSlot, CharacterDetailOutput> = {
      buildTask: ({ items, validatedPrefix }) => {
        this.assertNotCancelled(context)
        assertProjectSessionCurrent(projectSession, context)
        // 冻结清单只放**本批** slot：名单彼此独立，全量放进去只会引诱模型输出批外条目
        // （executor 会以 unexpected_item 直接判失败），分批时也必须让每批自洽。
        const frozenManifest = JSON.stringify({ slots: items })
        const slotIds = items.map(slot => slot.slotId).join(', ')
        const validatedPrefixJson = JSON.stringify(validatedPrefix.map(entry => ({
          slotId: entry.slotId,
          name: entry.name,
          role: entry.role,
        })))
        return {
          // purpose 与 operation 同名：主进程按它识别这次结构化调用属于归位表补全。
          purpose: CAST_LEDGER_COMPLETION_OPERATION,
          output: 'structured-data',
          messages: [
            { role: 'system', content: prompts.detailSystem },
            {
              role: 'user',
              content: prompts.detailTask({
                context: buildDetailsContextText({
                  language: writingLanguage,
                  premiseText,
                  rosterText,
                  blueprints,
                  slots: items,
                }),
                manifest: frozenManifest,
                slotIds,
                validatedPrefix: validatedPrefixJson,
              }),
            },
          ],
          // 故意不提供 promptBudget：写作技能注入会按实际字节现算上限，
          // 自带一个写死的 limitUtf8Bytes 反而会在注入 skill 后误报 PromptBudgetExceededError。
        }
      },
      inputKey: slot => slot.slotId,
      outputKey: entry => entry.slotId,
      decode: decodeCharacterDetails,
      validateItem: entry => {
        const basicError = validateCharacterDetail(entry)
        if (basicError) return basicError
        const slot = slotById.get(entry.slotId)
        if (!slot) return '归位表补全结果包含名单外的 slotId：' + entry.slotId
        // 名字必须逐字相等：主进程 parseCastLedgerCompletion 按精确字符串比对名字集合，
        // 差一个字符就会整批报 CHARACTER_CAST_LEDGER_NAMES_MISMATCH。
        if (slot.name !== entry.name) return '归位表补全结果的角色名与冻结名单不一致：' + entry.name
        return undefined
      },
    }

    const generationExecution = this.requireGenerationExecution()
    const execution = await createStructuredBatchExecutor<CastLedgerSlot, CharacterDetailOutput>({
      contract,
      session: injectWritingSkillIntoSession(generationExecution.session, context, 'planning'),
      writingLanguage,
      onAttempt: receipt => this.reportGenerationPromptBudget(callbacks, receipt),
      // 只回显本项目自己撰写的守卫说明；模型/传输层的外部 message 一律不外泄。
      describeError: error => (isWorkflowGuardError(error) ? error.message : undefined),
    }).execute({
      items: manifest,
      limits: { maxBatchItems: CHARACTER_DETAIL_BATCH_SIZE },
      signal: generationExecution.signal,
    })
    this.assertNotCancelled(context)

    if (!execution.ok) {
      const failure = execution.failure
      const diagnostic = failure.diagnostic
      const attempts = execution.receipt.attempts
      const failureReceipt = [
        'code=' + failure.code,
        'reason=' + (failure.reason ?? 'unknown'),
        ...(diagnostic
          ? ['diagnosticCode=' + diagnostic.code
            + ' diagnosticPath=' + diagnostic.path
            + ' diagnosticField=' + diagnostic.field]
          : []),
        ...(failure.errorName ? ['errorName=' + failure.errorName] : []),
        ...(failure.errorCode ? ['errorCode=' + failure.errorCode] : []),
        'attempts=' + (attempts.length
          ? attempts
            .map(attempt => 'purpose=' + (attempt.purpose ?? 'unknown') + ' finishReason=' + attempt.finishReason)
            .join('; ')
          : 'none'),
      ].join(' ')
      throw new Error(text(
        '归位表角色补全失败，未写入任何角色提议。失败收据：' + failureReceipt,
        'Cast-ledger character completion failed; nothing was staged. Receipt: ' + failureReceipt,
      ))
    }
    if (execution.items.length !== manifest.length) {
      // 批次数与名单对不上说明有名字没被生成 —— 宁可失败，也不 stage 一个缺项批次
      // （缺项批次会让部分名字永远停留在「待确认」）。
      throw new Error(text(
        '归位表补全结果没有覆盖全部名字，已停止写入。',
        'The completion result does not cover every cast-ledger name, so nothing was staged.',
      ))
    }

    const handle = context.mainGenerationRunHandle
    const acceptedArtifacts = execution.receipt.acceptedArtifacts ?? []
    // 优先用「已验证通过」的产物；只有在执行器没有记录 acceptedArtifacts 时（旧形状/降级）
    // 才回退到 attempt 上的 visibleArtifact，并按 artifactId 去重。
    const collectedArtifacts = acceptedArtifacts.length
      ? acceptedArtifacts.map(entry => entry.artifact)
      : execution.receipt.attempts.flatMap(attempt => (attempt.visibleArtifact ? [attempt.visibleArtifact] : []))
    const artifactById = new Map(collectedArtifacts.map(artifact => [artifact.artifactId, artifact]))
    const artifacts = [...artifactById.values()].map(artifact => ({
      artifactId: artifact.artifactId,
      revision: artifact.revision,
      textHash: artifact.textHash,
    }))
    if (!handle || !artifacts.length) {
      // 裸错误码：generation-controller 只透传 ^CHARACTER_[A-Z_]+$ 的 message，
      // 拼中文会让整条错误退化成 GENERATION_REQUEST_FAILED。
      throw new Error('CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    }

    // stage 之前再查一次角色卡：生成本身是长任务，期间作者可能已经手工建卡。
    // 名字一旦已建卡，stage 出的 pending 批次就必然是过期数据，直接拒绝。
    const currentCards = await ipc.invokeWithProjectSession(
      projectSession,
      'db:character-get-all',
      projectSession.projectPath,
    )
    const currentKeys = new Set(currentCards.map(card => characterRosterIdentityKey(card.name)))
    if (names.some(name => currentKeys.has(characterRosterIdentityKey(name)))) {
      throw new Error(text(
        '名单已变化，请刷新世界状态后重试。',
        'The name list changed. Refresh the world state and try again.',
      ))
    }

    const source: CharacterProposalSource = {
      kind: 'cast-ledger',
      names: [...names],
      // 只传 proof 认识的 4 个键：主进程 readCastLedgerGenerationProof 会拒绝带外键的 handle。
      handle: {
        projectId: handle.projectId,
        epoch: handle.epoch,
        rootActionId: handle.rootActionId,
        runId: handle.runId,
      } satisfies MainGenerationRunHandle,
      artifacts,
    }
    // stage 失败直接冒泡：CHARACTER_CAST_LEDGER_* 是既有协议码，包装只会丢掉它的可透传性。
    const batch = await ipc.invokeWithProjectSession(projectSession, 'character-proposal:stage', { source }) as CharacterProposalBatch
    context.data.characterProposalBatch = batch
    callbacks.setProgress(100)
    callbacks.log(text(
      '已为 ' + names.length + ' 个名字补齐资料，等待确认后建卡；角色名单尚未更改。',
      'Filled in details for ' + names.length + ' name(s); cards are created only after confirmation, and the roster is unchanged.',
    ))
    return formatCharacterProposalPreview(batch, text)
  }
}
