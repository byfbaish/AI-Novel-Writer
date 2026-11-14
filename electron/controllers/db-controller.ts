import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { isProjectSessionContext } from '../../src/shared/project-session-context'
import { closeProjectDatabase, getCurrentProjectPath, getProjectDb } from '../database'
import type { MainGenerationRunHandle } from '../../src/services/generation/generation-runtime'
import { assertGenerationSourcesCurrent, assertGenerationSynopsisCommit, commitGenerationPlotOutlineAuthorEdit, commitGenerationBlueprintAuthorEdit, assertImportGenerationSourcesCurrent, recordGenerationDirectoryCommit, withGenerationAgentChildEffect } from './generation-controller'
import { projectAccess } from '../services/project-access'
import { getProjectDataRoot } from '../services/project-data-locator'
import { readPortableCurrentAuthority } from '../services/portable-current-authority'
import { currentDerivedCharacterFields } from '../services/current-character-projection'
import { assertRequiredExpectedProjectPath } from '../utils/project-context'
import { emptyWorldStateView, WORLD_STATE_NOTES } from '../../src/shared/world-state-view'
import { readWorldState } from '../services/world-state-read'

// 导入所有 Repository
import {
  ProjectCoreRepository,
  ProjectCoreData,
  type ProjectCoreSynopsisCommitRequest,
} from '../repositories/project-core-repository'
import { ProjectClearRepository, ProjectClearOptions } from '../repositories/project-clear-repository'
import { computeInvalidationPlan } from '../../src/shared/invalidation-plan'
import { BOOK_SCOPE, normalizeRevisionReason, upstreamRefKey, type UpstreamDomain } from '../../src/shared/upstream-revisions'
import {
  BlueprintRepository,
  BlueprintData,
  type BlueprintRangeCommitRequest,
} from '../repositories/blueprint-repository'
import { CharacterRepository, hasCharacterIdentitySchema } from '../repositories/character-repository'
import { commitAuthorCharacterRoster } from '../services/character-roster-author'
import { CharacterRosterRepository } from '../repositories/character-roster-repository'
import type { CharacterRosterCommitRequest } from '../../src/shared/character-roster'
import { DraftRepository } from '../repositories/draft-repository'
import { ContentRepository } from '../repositories/content-repository'
import { DraftEditStatsRepository } from '../repositories/draft-edit-stats-repository'
import type { DraftSourceDependency } from '../../src/shared/draft-source-dependency'
import { FinalizedDraftImportRepository } from '../repositories/finalized-draft-import-repository'
import { FinalizationRepository } from '../repositories/finalization-repository'
import type { FinalizedDraftImportRequest } from '../../src/shared/finalized-draft-import'
import { ImportGlobalFactsRepository } from '../repositories/import-global-facts-repository'
import type { ImportGlobalFactsRequest } from '../../src/shared/import-global-facts'
import { ImportRunRepository } from '../repositories/import-run-repository'
import type {
  ImportRunExecutionLease,
  ImportRunPrepareEffectReceiptRequest,
  ImportRunPrepareFromInspectionRequest,
  ImportRunStage,
} from '../../src/shared/import-run'
import {
  AUTHOR_IMPORT_PREVIEW_STALE,
  isAuthorImportPreviewStaleError,
  isImportRunDirectCheckpointStage,
} from '../../src/shared/import-run'
import { ImportSourceIdentityRepository } from '../repositories/import-source-identity-repository'
import { importInspectionStore } from '../services/import-inspection-store'
import { loadApplicationImportSourceSecret } from '../services/import-source-identity-secret'
import { RevisionRepository } from '../repositories/revision-repository'
import { ReviewRepository } from '../repositories/review-repository'
import { ReviewCycleRepository } from '../repositories/review-cycle-repository'
import {
  isSourceDraftChangedError,
  SOURCE_DRAFT_CHANGED,
} from '../repositories/draft-source-guard'
import type { ExpectedDraftSource } from '../../src/shared/ipc-channels'
import { PostProcessRepository } from '../repositories/post-process-repository'

// 沿用的旧表
import { LLMHistoryRepository } from '../repositories/llm-repository'
import { SummaryRepository } from '../repositories/summary-repository'
import { ConsistencyExemptionRepository } from '../repositories/consistency-exemption-repository'
import { NarrativeThreadRepository } from '../repositories/narrative-thread-repository'
import { PlotTreeRepository } from '../repositories/plot-tree-repository'
import { UpstreamRevisionRepository } from '../repositories/upstream-revision-repository'
import { RecoveryCandidateRepository } from '../repositories/recovery-candidate-repository'
import type { RecoveryCandidateRecordInput } from '../../src/shared/recovery-candidate'
import {
  deleteResource,
  hasResourceLedgerSchema,
  listMovementsThrough,
  listResources,
  listScannedLedgerChapters,
  replaceChapterMovements,
  upsertResource,
} from '../repositories/resource-repository'
import type {
  ResourceDefinitionInput,
  ResourceMovementInput,
  ResourceMovementSource,
} from '../../src/shared/resource-ledger'
import { deleteKeyItem, hasKeyItemSchema, listKeyItems, upsertKeyItem } from '../repositories/key-item-repository'
import type { KeyItemInput } from '../../src/shared/key-item'
import {
  deleteInstitutionCadence,
  hasInstitutionCadenceSchema,
  listInstitutionCadences,
  upsertInstitutionCadence,
} from '../repositories/institution-cadence-repository'
import type { InstitutionCadenceInput } from '../../src/shared/institution-cadence'
import {
  deleteKnowledgeState,
  hasKnowledgeSchema,
  listFactCandidates,
  listKnowledgeStates,
  upsertKnowledgeState,
} from '../repositories/knowledge-state-repository'
import type { KnowledgeStateInput } from '../../src/shared/knowledge-state'
import {
  deleteSecret,
  hasSecretSchema,
  listSecrets,
  upsertSecret,
} from '../repositories/secret-repository'
import type { SecretInput } from '../../src/shared/secret'
import {
  deletePowerAbility,
  hasPowerAbilitySchema,
  listPowerAbilities,
  upsertPowerAbility,
} from '../repositories/power-ability-repository'
import type { PowerAbilityInput } from '../../src/shared/power-ability'
import {
  deleteVolumeHandoff,
  findPreviousHandoff,
  hasVolumeHandoffSchema,
  listVolumeHandoffs,
  readVolumeHandoffSourceRef,
  readVolumeHandoffSourceRefs,
  upsertVolumeHandoff,
} from '../repositories/volume-handoff-repository'
import {
  blueprintValidity,
  plotTreeValidity,
  readDerivedReadContext,
  volumeHandoffChapters,
  volumeHandoffValidity,
} from '../services/derived-validity'
import type { VolumeHandoffInput } from '../../src/shared/volume-handoff'
import {
  hasVolumeStructureSchema,
  markVolumeDone,
  readVolumeStructure,
  rebuildVolumes,
} from '../repositories/volume-structure-repository'
import { refreshVolumeProgress, syncVolumeStructureFromCore } from '../services/volume-structure-sync'

type ProjectDatabaseHandler = (event: unknown, ...args: never[]) => unknown

const MUTATING_DATABASE_CHANNELS = new Set([
  'db:close',
  'db:project-core-update',
  'db:project-core-commit-generated',
  'db:project-core-synopsis-commit',
  'db:import-global-facts-commit',
  'db:project-clear-generated-data',
  'db:import-run-prepare-inspection',
  'db:import-run-finalize-parsing',
  'db:import-run-start-resume',
  'db:import-run-effect-receipt-prepare',
  'db:import-run-effect-receipt-commit',
  'db:import-run-renew-execution',
  'db:import-run-restart',
  'db:import-run-request-cancel',
  'db:import-run-cancel-at-boundary',
  'db:import-run-complete-batch',
  'db:import-run-advance-stage',
  'db:import-run-fail',
  'db:import-run-complete',
  'db:blueprint-upsert',
  'db:blueprint-upsert-many',
  'db:blueprint-commit-range',
  'db:blueprint-character-sync-complete',
  'db:blueprint-update-notes',
  'db:blueprint-delete',
  'db:blueprint-clear-all',
  'db:character-roster-commit',
  'db:draft-import-finalized-batch',
  'db:draft-create',
  'db:draft-update-status',
  'db:draft-update-content',
  'db:draft-delete',
  'db:recovery-candidate-record',
  'db:recovery-candidate-update',
  'db:recovery-candidate-resolve',
  'db:finalization-link-knowledge-document',
  'db:revision-create',
  'db:revision-replace-pending',
  'db:revision-mark-merged',
  'db:revision-mark-discarded',
  'db:review-create',
  'db:consistency-exemption-save',
  'db:consistency-exemption-revoke',
  'db:post-process-create-run',
  'db:post-process-mark-step-ok',
  'db:post-process-mark-step-failed',
  'db:log-llm-call',
  'db:save-summary-snapshot',
  'db:narrative-thread-plan-create',
  'db:narrative-thread-plan-update',
  'db:narrative-thread-plan-delete',
  'db:narrative-thread-plan-delete-many',
  'db:narrative-thread-event-confirm',
  'db:plot-tree-save',
  'db:plot-tree-clear',
  'db:resources-upsert',
  'db:resources-delete',
  'db:resource-movements-replace-chapter',
  'db:key-items-upsert',
  'db:key-items-delete',
  // P1-1 制度：只有写通道进集合。读通道（list）不进 —— 它不该在失败时被包成 {success:false}。
  'db:cadences-upsert',
  'db:cadences-delete',
  // P1-1 信息流：同上，只有写通道进集合；`-list` 与 `-fact-candidates` 是只读，不进。
  'db:knowledge-upsert',
  'db:knowledge-delete',
  // P1-1 能力：只有写通道进集合；`-list` 与 `db:golden-finger-read` 是只读，不进。
  'db:abilities-upsert',
  'db:abilities-delete',
  // P1-2 卷末交接单：只有写通道进集合；`-list` 与 `-before` 是只读，不进。
  'db:volume-handoffs-upsert',
  'db:volume-handoffs-delete',
  // P1-2 卷 / 单元结构：`-list` 只读，不进；重建与「标记完成」都写库。
  'db:volumes-rebuild',
  'db:volumes-mark-done',
])

function registerProjectDatabaseHandler(channel: string, handler: ProjectDatabaseHandler): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    const candidate = args.at(-1)
    const context = isProjectSessionContext(candidate) ? candidate : undefined
    if (context) args.pop()
    try {
      projectAccess.assertCurrentProjectContext(context, getCurrentProjectPath())
      return await (handler as (event: unknown, ...handlerArgs: unknown[]) => unknown)(event, ...args)
    } catch (error) {
      if (MUTATING_DATABASE_CHANNELS.has(channel)) {
        return { success: false, error: String(error) }
      }
      throw error
    }
  })
}

/**
 * 新旧正文的最小差异字数：Levenshtein 编辑距离（替换/插入/删除各记 1 字）。
 * 先削掉公共前后缀，只对真正变化的中段做两行动态规划，避免整章全量矩阵。
 */
function changedCharsBetween(oldBody: string, newBody: string): number {
  if (oldBody === newBody) return 0
  let prefix = 0
  const maxPrefix = Math.min(oldBody.length, newBody.length)
  while (prefix < maxPrefix && oldBody[prefix] === newBody[prefix]) prefix += 1
  let suffix = 0
  const maxSuffix = Math.min(oldBody.length - prefix, newBody.length - prefix)
  while (suffix < maxSuffix
    && oldBody[oldBody.length - 1 - suffix] === newBody[newBody.length - 1 - suffix]) suffix += 1
  const oldMiddle = oldBody.slice(prefix, oldBody.length - suffix)
  const newMiddle = newBody.slice(prefix, newBody.length - suffix)
  if (!oldMiddle.length) return newMiddle.length
  if (!newMiddle.length) return oldMiddle.length

  let previous = Array.from({ length: newMiddle.length + 1 }, (_, index) => index)
  for (let i = 1; i <= oldMiddle.length; i += 1) {
    const current = new Array<number>(newMiddle.length + 1)
    current[0] = i
    for (let j = 1; j <= newMiddle.length; j += 1) {
      const substitution = previous[j - 1] + (oldMiddle[i - 1] === newMiddle[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
    }
    previous = current
  }
  return previous[newMiddle.length]
}

export function registerDatabaseController() {
  // 所有 db:* 都通过同一会话门禁；下面现有 handler 保留业务参数与错误语义。
  const ipcMain = { handle: registerProjectDatabaseHandler }
  ipcMain.handle('db:close', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    closeProjectDatabase()
    projectAccess.invalidateCurrentSession()
    return { success: true }
  })

  // ============================================================
  // 1. project_core — 项目主台账
  // ============================================================
  ipcMain.handle('db:project-core-get', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ProjectCoreRepository.get()
  })

  ipcMain.handle('db:project-core-update', async (
    _event,
    data: Partial<ProjectCoreData>,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      ProjectCoreRepository.update(data)
      // D14：作者手动改架构（含直接编辑卷 / 单元结构）同样要重建。
      if ('plotStructurePlan' in data || 'synopsis' in data) {
        const database = getProjectDb()
        if (database) syncVolumeStructureFromCore(database)
      }
      return { success: true }
    } catch (err) {
      console.error('[db:project-core-update] 失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:project-core-commit-generated', async (
    _event, request: { data: Partial<ProjectCoreData>; generationRunHandle: MainGenerationRunHandle }, expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const database = getProjectDb()
      if (!database || !request.generationRunHandle) throw new Error('GENERATION_OWNER_REQUIRED')
      database.transaction(() => withGenerationAgentChildEffect(request.generationRunHandle, () => {
        assertGenerationSourcesCurrent(request.generationRunHandle)
        ProjectCoreRepository.update(request.data)
      })).immediate()
      // D14：卷结构是 `plot_structure_plan` 的结构化投影，架构一改就该重建。
      // 此前全库只有「卷末交接」面板那一次手动点击会建卷，导致 volumes 长期为空、
      // `l3-handoff-missing` 变成必然状态。幂等、失败不阻断（见 volume-structure-sync.ts 头注）。
      if ('plotStructurePlan' in request.data || 'synopsis' in request.data) {
        syncVolumeStructureFromCore(database)
      }
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('db:project-core-synopsis-commit', async (
    _event,
    request: ProjectCoreSynopsisCommitRequest,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    if (Object.hasOwn(request, 'authorRecovery')) {
      const database = getProjectDb()
      if (!database) throw new Error('GENERATION_DATABASE_NOT_READY')
      const receipt = database.transaction(() => commitGenerationPlotOutlineAuthorEdit(request)).immediate()
      return { success: true, receipt }
    }
    const commit = () => {
      if (request.generationRunHandle && assertGenerationSynopsisCommit(request.generationRunHandle, request.synopsis, request.expected)) return true
      return ProjectCoreRepository.commitSynopsis(request)
    }
    const database = getProjectDb()
    if (request.generationRunHandle && !database) throw new Error('GENERATION_DATABASE_NOT_READY')
    if (!(request.generationRunHandle ? database!.transaction(() => withGenerationAgentChildEffect(request.generationRunHandle!, commit)).immediate() : commit())) {
      return { success: false, error: '项目数据已变化，已拒绝覆盖情节大纲' }
    }
    return { success: true }
  })

  ipcMain.handle('db:import-global-facts-commit', async (
    _event,
    request: ImportGlobalFactsRequest,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, receipt: ImportGlobalFactsRepository.commit(request) }
  })

  ipcMain.handle('db:project-clear-generated-data', async (
    _event,
    options: ProjectClearOptions,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const session = projectAccess.captureCurrentSession()
      const result = ProjectClearRepository.clearGeneratedData(options,
        session ? { projectId: session.projectId, epoch: session.leaseId } : undefined)
      return { success: true, ...result }
    } catch (err) {
      console.error('[db:project-clear-generated-data] 失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:import-run-prepare-inspection', async (
    event,
    request: ImportRunPrepareFromInspectionRequest,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const webContentsId = (event as IpcMainInvokeEvent).sender.id
    const inspected = importInspectionStore.peek(request.inspectionId, webContentsId, request.purpose)
    if (request.purpose === 'author-manuscript') {
      const preview = FinalizedDraftImportRepository.preview(inspected.chapters.map(chapter => ({
        chapterNumber: chapter.number,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount,
      })))
      if (
        preview.authorityFingerprint !== request.authorityFingerprint
        || preview.manifestFingerprint !== request.manifestFingerprint
      ) return { success: false as const, errorCode: AUTHOR_IMPORT_PREVIEW_STALE }
    }
    const inspection = importInspectionStore.consume(request.inspectionId, webContentsId)
    const sourceIdentity = ImportSourceIdentityRepository.resolveEncodedSources(
      inspection.sources.map(source => ({
        locationAliasDigest: source.locationAliasDigest,
        fileAliasDigest: source.fileAliasDigest,
      })),
      request.purpose,
      loadApplicationImportSourceSecret(),
    )
    const sourceDisplay = inspection.sources.map(source => ({
      displayName: source.displayName,
      mediaType: source.mediaType,
      size: source.size,
    }))
    if (request.purpose === 'author-manuscript') {
      try {
        return {
          success: true as const,
          preparation: ImportRunRepository.prepare({
            runId: request.runId,
            purpose: request.purpose,
            sourceFingerprint: sourceIdentity.sourceFingerprint,
            sourceIds: sourceIdentity.sourceIds,
            sourceFingerprints: sourceIdentity.sourceFingerprints,
            sourceDisplay,
            locale: request.locale,
            authorityFingerprint: request.authorityFingerprint,
            expectedManifestFingerprint: request.manifestFingerprint,
            chapters: inspection.chapters,
          }),
        }
      } catch (error) {
        if (isAuthorImportPreviewStaleError(error)) {
          return { success: false as const, errorCode: AUTHOR_IMPORT_PREVIEW_STALE }
        }
        throw error
      }
    }
    const parsingRun = ImportRunRepository.beginParsing({
      runId: request.runId,
      purpose: request.purpose,
      sourceFingerprint: sourceIdentity.sourceFingerprint,
      sourceIds: sourceIdentity.sourceIds,
      sourceFingerprints: sourceIdentity.sourceFingerprints,
      legacySourceFingerprints: sourceIdentity.legacySourceFingerprints,
      legacyCollectionFingerprint: sourceIdentity.legacyCollectionFingerprint,
      sourceDisplay,
      locale: request.locale,
    })
    for (let sourceIndex = 0; sourceIndex < sourceIdentity.sourceIds.length; sourceIndex++) {
      const sourceId = sourceIdentity.sourceIds[sourceIndex]!
      const chapters = inspection.chapters
        .filter(chapter => chapter.sourceIndex === sourceIndex)
        .map(chapter => ({
          number: chapter.sourceChapterNumber,
          sourceChapterNumber: chapter.sourceChapterNumber,
          title: chapter.title,
          content: chapter.content,
          contentFingerprint: chapter.contentFingerprint,
          contentSize: chapter.contentSize,
        }))
      try {
        ImportRunRepository.commitParsedSource(parsingRun.id, sourceId, chapters)
      } catch (error) {
        ImportRunRepository.failParsedSource(
          parsingRun.id,
          sourceId,
          error instanceof Error ? error.message : String(error),
        )
        throw error
      }
    }
    return { success: true, preparation: ImportRunRepository.finalizeParsing(parsingRun.id) }
  })

  ipcMain.handle('db:import-run-finalize-parsing', async (
    _event,
    runId: string,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, preparation: ImportRunRepository.finalizeParsing(runId) }
  })

  ipcMain.handle('db:import-run-author-preview', async (
    event,
    inspectionId: string,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const inspection = importInspectionStore.peek(
      inspectionId,
      (event as IpcMainInvokeEvent).sender.id,
      'author-manuscript',
    )
    return FinalizedDraftImportRepository.preview(inspection.chapters.map(chapter => ({
      chapterNumber: chapter.number,
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount,
    })))
  })

  ipcMain.handle('db:import-run-get', async (_event, runId: string, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ImportRunRepository.get(runId)
  })

  ipcMain.handle('db:import-run-list-resumable', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ImportRunRepository.listResumable()
  })

  ipcMain.handle('db:import-run-list-chapters', async (
    _event,
    runId: string,
    afterChapterNumber: number,
    limit: number,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ImportRunRepository.listChapterBatch(runId, { afterChapterNumber, limit })
  })

  ipcMain.handle('db:import-run-effect-receipt-get', async (
    _event,
    runId: string,
    stage: ImportRunStage,
    batchId: string,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ImportRunRepository.getEffectReceipt(runId, stage, batchId)
  })

  ipcMain.handle('db:import-run-effect-receipt-prepare', async (
    _event,
    request: ImportRunPrepareEffectReceiptRequest,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, receipt: ImportRunRepository.prepareEffectReceipt(request, execution, Date.now(), assertImportGenerationSourcesCurrent) }
  })

  ipcMain.handle('db:import-run-effect-receipt-commit', async (
    _event,
    runId: string,
    stage: ImportRunStage,
    batchId: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, result: ImportRunRepository.commitEffectReceipt(runId, stage, batchId, execution, Date.now(), (handle, slot) => assertImportGenerationSourcesCurrent(handle, slot, true)) }
  })

  ipcMain.handle('db:import-run-start-resume', async (
    _event,
    runId: string,
    owner: string,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, start: ImportRunRepository.startOrResume(runId, owner) }
  })

  ipcMain.handle('db:import-run-renew-execution', async (
    _event,
    runId: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, execution: ImportRunRepository.renewExecution(runId, execution) }
  })

  ipcMain.handle('db:import-run-restart', async (
    _event,
    runId: string,
    nextRunId: string,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, run: ImportRunRepository.restart(runId, nextRunId) }
  })

  ipcMain.handle('db:import-run-request-cancel', async (
    _event,
    runId: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, run: ImportRunRepository.requestCancel(runId, execution) }
  })

  ipcMain.handle('db:import-run-cancel-at-boundary', async (
    _event,
    runId: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, run: ImportRunRepository.cancelAtBoundary(runId, execution) }
  })

  ipcMain.handle('db:import-run-complete-batch', async (
    _event,
    runId: string,
    stage: ImportRunStage,
    batchId: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    if (!isImportRunDirectCheckpointStage(stage)) throw new Error('该导入阶段不接受直接 checkpoint')
    return { success: true, ...ImportRunRepository.completeBatch(runId, stage, batchId, execution) }
  })

  ipcMain.handle('db:import-run-advance-stage', async (
    _event,
    runId: string,
    completedStage: ImportRunStage,
    nextStage: ImportRunStage,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, run: ImportRunRepository.advanceStage(runId, completedStage, nextStage, execution) }
  })

  ipcMain.handle('db:import-run-fail', async (
    _event,
    runId: string,
    stage: ImportRunStage,
    errorMessage: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, run: ImportRunRepository.fail(runId, stage, errorMessage, execution) }
  })

  ipcMain.handle('db:import-run-complete', async (
    _event,
    runId: string,
    execution: ImportRunExecutionLease,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, run: ImportRunRepository.complete(runId, execution) }
  })

  // ============================================================
  // 2. blueprints — 章节蓝图
  // ============================================================
  // 读取侧判定（P2-2 期 2）：**上下文只建一次**，然后逐行纯内存比较。
  // 不要在 `.map()` 里调 `snapshot()` / `readRev()` —— 每个都再探一次
  // `sqlite_master`，上千章就是上千次系统目录查询（设计稿 §5.6）。
  ipcMain.handle('db:blueprint-get-all', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const db = getProjectDb()
    const context = readDerivedReadContext(db)
    const sourceRefs = db ? BlueprintRepository.readSourceRefs(db) : new Map()
    return BlueprintRepository.getAll().map(entry => ({
      ...entry,
      validity: blueprintValidity(context, sourceRefs.get(entry.chapterNumber), entry.chapterNumber),
    }))
  })

  ipcMain.handle('db:blueprint-get', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const entry = BlueprintRepository.getByChapter(chapterNumber)
    if (!entry) return null
    const db = getProjectDb()
    const context = readDerivedReadContext(db)
    const sourceRef = db ? BlueprintRepository.readSourceRef(chapterNumber, db) : null
    return { ...entry, validity: blueprintValidity(context, sourceRef, chapterNumber) }
  })

  ipcMain.handle('db:blueprint-upsert', async (_event, data: BlueprintData, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      // 单章卡保存也是「改上游」（章节卡进正文 prompt）：仓储内部把「bump 大纲版本
      // + 写行」包在同一事务里。这里不自己取库 —— 这一层的守卫是项目上下文，
      // 库是否就绪由仓储的 `requireProjectDb()` 判，两处各判一次就会有两个错误码。
      BlueprintRepository.upsert(data, undefined, { bumpOutline: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:blueprint-upsert-many', async (_event, items: BlueprintData[], expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      BlueprintRepository.upsertMany(items)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:blueprint-commit-range', async (
    _event,
    request: BlueprintRangeCommitRequest,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      if (request.authorRecovery) {
        const database = getProjectDb()
        if (!database) throw new Error('GENERATION_DATABASE_NOT_READY')
        return { success: true, receipt: database.transaction(() => commitGenerationBlueprintAuthorEdit(request)).immediate() }
      }
      if (!request.generationRunHandle) return { success: true, receipt: BlueprintRepository.commitRange(request) }
      const database = getProjectDb(), requested = request.generationRequestedRange ?? { startChapter: request.startChapter, endChapter: request.endChapter }
      if (!database) throw new Error('GENERATION_DATABASE_NOT_READY')
      if (!Number.isSafeInteger(requested.startChapter) || !Number.isSafeInteger(requested.endChapter)
        || requested.startChapter !== request.startChapter || requested.endChapter < request.endChapter || requested.endChapter - requested.startChapter >= 10000)
        throw new Error('GENERATION_DIRECTORY_RANGE_INVALID')
      const commit = () => {
        const committed = BlueprintRepository.commitRange(request, () => assertGenerationSourcesCurrent(request.generationRunHandle!, requested))
        return { ...committed, generationProgress: recordGenerationDirectoryCommit(request.generationRunHandle!, requested, committed) }
      }
      const receipt = database.transaction(() => BlueprintRepository.getCommittedRangeOperation(request.operationId)
        ? commit() : withGenerationAgentChildEffect(request.generationRunHandle!, commit)).immediate()
      return { success: true, receipt }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:blueprint-character-sync-list-pending', async (
    _event,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return BlueprintRepository.listPendingCharacterSyncOperations()
  })

  ipcMain.handle('db:blueprint-character-sync-list-all', async (
    _event,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return BlueprintRepository.listAllCharacterSyncOperations()
  })

  ipcMain.handle('db:blueprint-character-sync-get', async (
    _event,
    operationId: string,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return BlueprintRepository.getCharacterSyncOperation(operationId)
  })

  ipcMain.handle('db:blueprint-character-sync-complete', async (
    _event,
    operationId: string,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      return {
        success: true,
        operation: BlueprintRepository.completeCharacterSyncOperation(operationId),
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:blueprint-update-notes', async (_event, _chapterNumber: number, _notes: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      // Derived finalization notes are committed with their artifact and ACK in one main transaction.
      throw new Error('GENERATION_FINALIZATION_ADMISSION_REQUIRED')
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:blueprint-delete', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      BlueprintRepository.delete(chapterNumber)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:blueprint-clear-all', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      BlueprintRepository.clearAll()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // 3. characters — 角色卡
  // ============================================================
  ipcMain.handle('db:character-get-all', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return CharacterRepository.getAll()
  })

  ipcMain.handle('db:character-roster-read', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const roster = CharacterRosterRepository.read()
    const database = getProjectDb()
    const session = projectAccess.captureCurrentSession()
    let currentDerivedFields = {}
    if (database && session) {
      try {
        const authority = readPortableCurrentAuthority({ database, projectStorageRoot: getProjectDataRoot(session.rootPath), projectId: session.projectId })
        currentDerivedFields = currentDerivedCharacterFields(database, session.projectId, authority?.originProjectId)
      } catch { /* Missing source proof never makes a derived field current; raw author/history remains readable. */ }
    }
    return { ...roster, currentDerivedFields }
  })

  ipcMain.handle('db:character-roster-commit', async (
    _event,
    request: CharacterRosterCommitRequest,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const authorDb = getProjectDb()
      if (request.intent === 'manual_edit' && authorDb && hasCharacterIdentitySchema(authorDb)) {
        const authorSession = projectAccess.captureCurrentSession()
        if (!authorSession) throw new Error('CHARACTER_AUTHOR_SCOPE_REQUIRED')
        return { success: true, receipt: commitAuthorCharacterRoster(authorDb, request,
          { projectId: authorSession.projectId, epoch: authorSession.leaseId }, () => {
            projectAccess.assertCurrentSession(authorSession)
            assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
          }) }
      }
      return { success: true, receipt: CharacterRosterRepository.commit(request,
        request.generationRunHandle ? () => assertGenerationSourcesCurrent(request.generationRunHandle!) : undefined) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // 4. drafts — 草稿
  // ============================================================
  ipcMain.handle('db:draft-import-finalized-batch', async (
    _event,
    request: FinalizedDraftImportRequest,
    expectedProjectPath: string,
  ) => {
    const currentProjectPath = getCurrentProjectPath()
    assertRequiredExpectedProjectPath(currentProjectPath, expectedProjectPath)
    if (!currentProjectPath) throw new Error('项目数据库未打开')
    return {
      success: true,
      receipt: FinalizedDraftImportRepository.commit(currentProjectPath, request),
    }
  })

  ipcMain.handle('db:draft-create', async (_event, params: {
    chapterNumber: number
    version: number
    source: 'write' | 'rewrite'
    content: string
    wordCount: number
    sourceDependencies?: DraftSourceDependency[]
  }, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const id = DraftRepository.create(params)
      return { success: true, id }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:draft-list', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.listByChapter(chapterNumber)
  })

  ipcMain.handle('db:draft-list-all', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.listAll()
  })

  ipcMain.handle('db:draft-get-meta', async (_event, id: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.getMeta(id)
  })

  ipcMain.handle('db:draft-get-full', async (_event, id: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.getFull(id)
  })

  ipcMain.handle('db:draft-get-latest', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.getLatestByChapter(chapterNumber)
  })

  ipcMain.handle('db:draft-get-finalized', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.getFinalizedByChapter(chapterNumber)
  })

  ipcMain.handle('db:draft-get-max-finalized-chapter', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.getMaxFinalizedChapter()
  })

  ipcMain.handle('db:draft-authority-sequence', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return FinalizedDraftImportRepository.authoritySequence()
  })

  ipcMain.handle('db:draft-export-snapshot', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return FinalizationRepository.listAuthoritativeForExport()
  })

  ipcMain.handle('db:draft-export-authority-current', async (_event, receipt, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)
  })

  ipcMain.handle('db:continuity-save-finalized', async (_event, _request, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      throw new Error('GENERATION_FINALIZATION_ADMISSION_REQUIRED')
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:continuity-save-character-state-candidates', async (_event, _request, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      throw new Error('GENERATION_FINALIZATION_ADMISSION_REQUIRED')
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:continuity-list-before', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return SummaryRepository.listFinalizedContinuityBefore(chapterNumber)
  })

  ipcMain.handle('db:chapter-staleness-ack', async (
    _event,
    chapterNumber: number,
    reason: string,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      return { success: true as const, ...SummaryRepository.acknowledgeChapterStaleness(chapterNumber, reason) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        success: false as const,
        errorCode: message === 'STALENESS_ACK_REASON_REQUIRED' ? 'REASON_REQUIRED' as const
          : message === 'STALENESS_ACK_CHAPTER_NOT_FINALIZED' ? 'CHAPTER_NOT_FINALIZED' as const
          : undefined,
        error: message,
      }
    }
  })

  ipcMain.handle('db:chapter-staleness-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      return { success: true as const, ...SummaryRepository.chapterStalenessSnapshot() }
    } catch (error) {
      return { success: false as const, error: String(error) }
    }
  })

  ipcMain.handle('db:continuity-read-source', async (_event, draftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return SummaryRepository.readFinalizedSource(draftId)
  })

  ipcMain.handle('db:consistency-exemption-list', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ConsistencyExemptionRepository.list()
  })

  ipcMain.handle('db:consistency-exemption-save', async (_event, stableFactKey: string, reason: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      ConsistencyExemptionRepository.save(stableFactKey, reason)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('db:consistency-exemption-revoke', async (_event, stableFactKey: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      ConsistencyExemptionRepository.revoke(stableFactKey)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('db:narrative-thread-list', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return NarrativeThreadRepository.list()
  })

  ipcMain.handle('db:narrative-thread-list-relevant', async (_event, context, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return NarrativeThreadRepository.listRelevantActive(context)
  })

  ipcMain.handle('db:narrative-thread-plan-create', async (_event, input, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, plan: NarrativeThreadRepository.createPlan(input) }
  })

  ipcMain.handle('db:narrative-thread-plan-update', async (_event, id: number, input, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, plan: NarrativeThreadRepository.updatePlan(id, input) }
  })

  ipcMain.handle('db:narrative-thread-plan-delete', async (_event, id: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    NarrativeThreadRepository.deletePlan(id)
    return { success: true }
  })

  ipcMain.handle('db:narrative-thread-plan-delete-many', async (_event, ids: number[], expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    // 一条语句删多条：原子 + 外键级联清理 confirmations，避免 N 次事务。
    return { success: true, deleted: NarrativeThreadRepository.deletePlans(ids) }
  })

  ipcMain.handle('db:narrative-thread-event-confirm', async (_event, input, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return { success: true, event: NarrativeThreadRepository.confirmEvent(input) }
  })

  ipcMain.handle('db:plot-tree-read', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const bundle = PlotTreeRepository.read()
    const db = getProjectDb()
    // 徽标只看 `plot_tree_source_ref`（rev），**不看 `sourceRevision` 那个 hash**
    // —— 作者新增一条伏笔、或定稿后 `notes` 被提取，hash 都会变而 rev 不变，
    // 拿 hash 当徽标会让剧情树长期挂着"已过期"（设计稿 §七 / R10）。
    //
    // 加在返回值的**外层**、不进 `snapshot`：`targetBaselineHash` 是
    // `textHash(plot_tree_snapshot)`，往 JSON 里加字段会让正在跑的生成判来源变更（R9）。
    return {
      ...bundle,
      validity: plotTreeValidity(readDerivedReadContext(db), db ? PlotTreeRepository.readSourceRef(db) : null),
    }
  })

  /**
   * 交接单在清单里的标签：一句话让作者认得出是哪一卷（施工图 §四 S3 的文案口径）。
   * 标签在调用方拼 —— 纯函数那一层只搬运数据，不生产文案。
   */
  function handoffLabel(entry: { volumeIndex: number | null; volumeId: string; lastChapter: number | null }): string {
    const volume = entry.volumeIndex !== null ? `第 ${entry.volumeIndex} 卷` : entry.volumeId
    return entry.lastChapter !== null ? `${volume}第 ${entry.lastChapter} 章交接单` : `${volume}交接单`
  }

  /**
   * 组装 `computeInvalidationPlan` 的全部入参（除 `overrides` / `reason`）。
   *
   * **两个 handler 共用**：`db:invalidation-plan`（「再改一版会怎样」）与
   * `db:derived-inventory`（「现在已经怎样」，S7）。
   *
   * 抽出来不是为省几行：两处各写一遍读取，迟早有一处漏掉新加的那张表
   * （S6 的定稿章就是这样进候选的）。漏的那一侧表现为「清点页说没事，
   * 点重建却列出一堆」，而作者会先信清点页 —— 那比不做清点更糟。
   */
  function readPlanInputs(db: NonNullable<ReturnType<typeof getProjectDb>>) {
    // 只读一次：一次上下文、两份 Map（设计稿 §5.6：禁止在逐行循环里查）。
    const context = readDerivedReadContext(db)
    const blueprintRefs = BlueprintRepository.readSourceRefs(db)
    const handoffRefs = readVolumeHandoffSourceRefs(db)
    const handoffs = hasVolumeHandoffSchema(db) ? listVolumeHandoffs(db) : []
    return {
      revisions: context.revisions,
      changes: context.changes,
      blueprints: [...blueprintRefs.entries()].map(([chapterNumber, sourceRef]) => ({ chapterNumber, sourceRef })),
      handoffs: handoffs.map((entry) => ({
        label: handoffLabel(entry),
        // 要不要展开成章集合由 `volumeHandoffChapters` 决定（边界非 actual ⇒ [] = 覆盖全部章）。
        chapters: volumeHandoffChapters(entry),
        sourceRef: handoffRefs.get(entry.handoffId) ?? null,
      })),
      plotTreeSourceRef: PlotTreeRepository.readSourceRef(db),
      // P2-3 期 3b：中间环。`synopsis` 有没有内容与「记没记来源」是两件事 ——
      // 前者决定要不要把大纲当候选，后者决定它是否可信。合成一个 null 会让
      // 新建项目第一次生成大纲时先吃到一张「1 项无法判断」。
      synopsisSourceRef: ProjectCoreRepository.readSynopsisSourceRef(db),
      hasSynopsis: Boolean(ProjectCoreRepository.get(db)?.synopsis?.trim()),
      // S6 / M28：已定稿章节。判「改了第 12 章大纲，会不会影响第 8 章定稿正文」。
      finalizedDrafts: FinalizationRepository.readFinalizedOutlineRevs(db),
    }
  }

  /**
   * P2-3 期 3a：重建前的失效清单（主稿 §九 步 4）。
   *
   * **整个 handler 一个字节都不写**（plan 阶段 bump rev 是红线，§8.1）：作者在弹窗上
   * 点「取消」，那就必须是真的没发生过任何事。真要 bump，是作者点了继续之后的事，
   * 不在这个 handler 里。
   */
  ipcMain.handle('db:invalidation-plan', async (
    _event,
    request: { domain: UpstreamDomain; scope?: string; rev: number; reason?: string },
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // 「拿不到清单」必须和「影响 0 项」分开：返回一份空 plan，UI 会显示「不影响任何东西」，
      // 而作者会据此判断「这一刀没有代价」。所以拿不到就报 `missing`，不是给空清单。
      if (!db || !UpstreamRevisionRepository.hasTable(db)) return { success: false, missing: true }
      // 入参组装与清点页共用（见 `readPlanInputs`）——两处各写一遍，迟早在某张表上分家。
      const inputs = readPlanInputs(db)
      // ⚠️ 施工期补的口径（施工图未钉，已登记在 §六，待作者裁定）：
      // `rev <= 0` ⇒ 「假想这个域再改一版」（当前 rev + 1）。
      // 为什么需要它：UI 手边没有当前版本号（没有读版本表的 IPC），而它要问的正是
      // 「再改一版会怎样」。借 0 这个「不是合法版本号」的值表达，是为了不动施工图
      // 钉死的 `rev: number` 签名 —— 增字段或增 channel 都要先改设计。
      const requestedKey = upstreamRefKey(request.domain, request.scope ?? BOOK_SCOPE)
      const hypotheticalRev = request.rev > 0
        ? request.rev
        : (inputs.revisions.get(requestedKey) ?? 0) + 1
      const plan = computeInvalidationPlan({
        overrides: [{ domain: request.domain, scope: request.scope, rev: hypotheticalRev }],
        ...inputs,
        // 回显这次动作的来由（`rollback` 时文案要逐层列出）。`normalizeRevisionReason`
        // 把来路不明的值收敛到 `unknown` —— 渲染侧只该认取值表里的那六个。
        reason: normalizeRevisionReason(request.reason),
      })
      return { success: true, plan }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /**
   * S7：派生清点（「这本书现在哪儿旧了」）。**整个 handler 一个字节都不写。**
   *
   * 与上面的 `db:invalidation-plan` 只差一个入参：`overrides: []` ⇒ 假想快照
   * 就是真实版本表 ⇒ 判出来的**就是现状**。共用同一份 `computeInvalidationPlan`，
   * 所以「清点页说没事、点重建却列出一堆」这种自相矛盾在结构上不可能发生。
   *
   * **不返回 `tier` / `unaffected`**（理由见 `DerivedInventory` 的注释）：清点页不是闸门。
   */
  ipcMain.handle('db:derived-inventory', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // 同上面的失败口径：拿不到就 `missing`，绝不返回一份空清单冒充「一切正常」。
      if (!db || !UpstreamRevisionRepository.hasTable(db)) return { success: false, missing: true }
      const inputs = readPlanInputs(db)
      const plan = computeInvalidationPlan({ overrides: [], ...inputs })
      return {
        success: true,
        inventory: {
          groups: plan.groups,
          unseen: plan.unseen,
          upstream: UpstreamRevisionRepository.listLines(db),
          // 跳转用：定稿章 → draftId。**不参与判定**，`plan` 那边只要章号与版本。
          finalizedDrafts: inputs.finalizedDrafts.map((draft) => ({
            chapterNumber: draft.chapterNumber,
            draftId: draft.draftId,
          })),
          scannedAt: new Date().toISOString(),
        },
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:plot-tree-save', async (
    _event,
    _snapshot,
    _expectedSourceRevision: string,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      throw new Error('GENERATION_GRAPH_ADMISSION_REQUIRED')
    } catch (error) {
      const message = String(error)
      return {
        success: false,
        ...(message.includes('剧情资料在生成期间已更新')
          ? { errorCode: 'sources-changed' as const }
          : {}),
        error: message,
      }
    }
  })

  ipcMain.handle('db:plot-tree-clear', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    PlotTreeRepository.clear()
    return { success: true }
  })

  ipcMain.handle('db:draft-next-version', async (_event, chapterNumber: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftRepository.getNextVersion(chapterNumber)
  })

  ipcMain.handle('db:draft-update-status', async (_event, id: number, status: string, wordCount: number | undefined, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      DraftRepository.updateStatus(id, status, wordCount)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:draft-update-content', async (_event, id: number, content: string, wordCount: number, expectedProjectPath: string, origin?: 'human' | 'ai') => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const draft = DraftRepository.getMeta(id)
      if (!draft) throw new Error(`草稿不存在：${id}`)
      if (draft.status === 'finalized') {
        throw new Error('已定稿正文为只读内容，不能再修改')
      }
      // 旧正文只在这里还能读到：updateContent 会就地覆盖 contents.body，且没有历史表。
      const oldBody = ContentRepository.getBody(draft.contentId) ?? ''
      const changedChars = changedCharsBetween(oldBody, content)
      DraftRepository.updateContent(id, content, wordCount)
      try {
        DraftEditStatsRepository.record({
          draftId: id,
          // 缺省必须按 ai 计：update-content 会被 AI 修稿复用，宁可少记人工。
          origin: origin === 'human' ? 'human' : 'ai',
          changedChars,
          oldChars: oldBody.length,
          newChars: content.length,
        })
      } catch (metricError) {
        // 计量失败不回滚已成功的正文保存，也不改变保存结果。
        console.warn('[db:draft-update-content] 编辑计量写入失败', metricError)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:draft-edit-stats', async (_event, draftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftEditStatsRepository.listForDraft(draftId)
  })

  // P48：只回最近 N 章的原始行，中位数口径在渲染层算（P37 判例）。
  ipcMain.handle('db:draft-edit-stats-recent-chapters', async (
    _event,
    chapterLimit: number,
    expectedProjectPath: string,
  ) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return DraftEditStatsRepository.listRecentChaptersForProject(chapterLimit)
  })

  ipcMain.handle('db:draft-delete', async (_event, id: number, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      DraftRepository.delete(id)
      return { success: true }
    } catch (err) {
      if (
        err
        && typeof err === 'object'
        && 'code' in err
        && err.code === 'FINALIZED_DRAFT_DELETE_REQUIRED'
      ) {
        return { success: false, errorCode: 'FINALIZED_DRAFT_DELETE_REQUIRED' as const }
      }
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:recovery-candidate-record', async (
    _event,
    request: RecoveryCandidateRecordInput,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const active = projectAccess.captureCurrentSession()
      if (!active) throw new Error('缺少当前项目会话，已拒绝保存恢复候选')
      const candidate = RecoveryCandidateRepository.record({ ...request, projectId: active.projectId })
      return { success: true, candidate }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('db:recovery-candidate-list', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return RecoveryCandidateRepository.listPending()
  })

  ipcMain.handle('db:recovery-candidate-update', async (
    _event,
    candidateId: string,
    visibleText: string,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const candidate = RecoveryCandidateRepository.updatePending(candidateId, visibleText)
      return { success: true, candidate }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('db:recovery-candidate-resolve', async (
    _event,
    candidateId: string,
    status: 'continued' | 'discarded',
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      RecoveryCandidateRepository.resolve(candidateId, status)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('db:finalization-link-knowledge-document', async (
    _event,
    draftId: number,
    documentId: string,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      return {
        success: true,
        finalization: FinalizationRepository.linkKnowledgeDocument(draftId, documentId),
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // 5. revisions — 修稿
  // ============================================================
  ipcMain.handle('db:revision-create', async (_event, params: {
    baseDraftId: number
    revisionType: 'refine' | 'review-fix'
    userPrompt?: string
    reviewSourceId?: number
    content: string
    wordCount: number
    expectedSource?: ExpectedDraftSource
  }, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const created = RevisionRepository.create(params)
      return { success: true, id: created.id, revisionIndex: created.revisionIndex }
    } catch (err) {
      return {
        success: false,
        ...(isSourceDraftChangedError(err) ? { errorCode: SOURCE_DRAFT_CHANGED } : {}),
        error: String(err),
      }
    }
  })

  ipcMain.handle('db:revision-replace-pending', async (_event, params: {
    baseDraftId: number
    revisionType: 'refine' | 'review-fix'
    userPrompt?: string
    reviewSourceId?: number
    content: string
    wordCount: number
    expectedSource?: ExpectedDraftSource
  }, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const created = RevisionRepository.replacePending(params)
      return { success: true, id: created.id, revisionIndex: created.revisionIndex }
    } catch (err) {
      return {
        success: false,
        ...(isSourceDraftChangedError(err) ? { errorCode: SOURCE_DRAFT_CHANGED } : {}),
        error: String(err),
      }
    }
  })

  ipcMain.handle('db:revision-list', async (_event, baseDraftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return RevisionRepository.listByDraft(baseDraftId)
  })

  ipcMain.handle('db:revision-get-pending', async (_event, baseDraftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return RevisionRepository.getPending(baseDraftId)
  })

  ipcMain.handle('db:revision-get-full', async (_event, id: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return RevisionRepository.getFull(id)
  })

  ipcMain.handle('db:revision-next-index', async (_event, baseDraftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return RevisionRepository.getNextIndex(baseDraftId)
  })

  ipcMain.handle('db:revision-merge', async (_event, request: Parameters<typeof RevisionRepository.mergeIntoDraft>[0], expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      return { success: true, receipt: RevisionRepository.mergeIntoDraft(request) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:revision-mark-merged', async (_event, id: number, mergedToDraftId: number, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      RevisionRepository.markMerged(id, mergedToDraftId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:revision-mark-discarded', async (_event, id: number, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      RevisionRepository.markDiscarded(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // 6. reviews — 审稿
  // ============================================================
  ipcMain.handle('db:review-create', async (_event, params: {
    baseDraftId: number
    reviewIndex?: number
    content: string
    expectedSource?: ExpectedDraftSource
    reviewCycleId?: string
  }, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) throw new Error('[ReviewRepository] 数据库未连接')
      const created = db.transaction(() => {
        const saved = ReviewRepository.create({ baseDraftId: params.baseDraftId, reviewIndex: params.reviewIndex,
          content: params.content, expectedSource: params.expectedSource }, db)
        if (params.reviewCycleId) ReviewCycleRepository.commitAuthorConfirmation({
          cycleId: params.reviewCycleId,
          confirmationReviewId: saved.id,
        }, db)
        return saved
      })()
      return { success: true, id: created.id, reviewIndex: created.reviewIndex }
    } catch (err) {
      return {
        success: false,
        ...(isSourceDraftChangedError(err) ? { errorCode: SOURCE_DRAFT_CHANGED } : {}),
        error: String(err),
      }
    }
  })

  ipcMain.handle('db:review-list', async (_event, baseDraftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ReviewRepository.listByDraft(baseDraftId)
  })

  ipcMain.handle('db:review-get-latest', async (_event, baseDraftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ReviewRepository.getLatestByDraft(baseDraftId)
  })

  ipcMain.handle('db:review-get-full', async (_event, id: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ReviewRepository.getFull(id)
  })

  ipcMain.handle('db:review-cycle-get', async (_event, reviewId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const db = getProjectDb()
    if (!db) return null
    return ReviewCycleRepository.getByReviewId(reviewId, db)
  })

  ipcMain.handle('db:review-next-index', async (_event, baseDraftId: number, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return ReviewRepository.getNextIndex(baseDraftId)
  })

  // ============================================================
  // 7. post_process — 后处理跑批
  // ============================================================
  ipcMain.handle('db:post-process-create-run', async (
    _event,
    params: {
      triggerSourceType: string
      triggerSourceId: string
      sourceLabel: string
      steps: Array<{ key: string; label: string; critical: boolean }>
      finalizedSource?: import('../../src/shared/finalized-continuity').FinalizedSourceIdentity
    },
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const id = PostProcessRepository.createRun(params)
      return { success: true, id }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:post-process-get-latest-run', async (_event, sourceType: string, sourceId: string, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return PostProcessRepository.getLatestRun(sourceType, sourceId)
  })

  ipcMain.handle('db:post-process-get-steps', async (_event, runId: string, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return PostProcessRepository.getSteps(runId)
  })

  ipcMain.handle('db:post-process-mark-step-ok', async (_event, runId: string, stepKey: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      PostProcessRepository.markStepOk(runId, stepKey)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:post-process-mark-step-failed', async (_event, runId: string, stepKey: string, errorMsg: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      PostProcessRepository.markStepFailed(runId, stepKey, errorMsg)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:post-process-is-all-passed', async (_event, sourceType: string, sourceId: string, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return PostProcessRepository.isAllCriticalPassed(sourceType, sourceId)
  })

  // ============================================================
  // W5 世界状态（只读视图）
  // ============================================================
  ipcMain.handle('world-state:read', async (_event, expectedProjectPath: string) => {
    // 项目上下文校验必须发生在读任何数据之前：过期路径这里直接抛出，不返回旧项目的数据。
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    const db = getProjectDb()
    // 库尚未打开：返回空视图而不是抛错，渲染层可以用 notes 提示「项目未就绪」。
    if (!db) return emptyWorldStateView(null, [WORLD_STATE_NOTES.projectNotOpen])
    return readWorldState(db, getCurrentProjectPath())
  })

  // ============================================================
  // W6 资源账本（资源定义 + 逐章变动）
  // ============================================================
  ipcMain.handle('db:resources-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M11 之前 / 库未打开：降级成空列表，不报错（设计稿 §9）。
      if (!db || !hasResourceLedgerSchema(db)) return { success: true, resources: [] }
      return { success: true, resources: listResources(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:resources-upsert', async (_event, input: ResourceDefinitionInput, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = upsertResource(db, input)
      return result.success ? { success: true, resourceId: result.resourceId } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:resources-delete', async (_event, resourceId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = deleteResource(db, resourceId)
      return result.success ? { success: true } : { success: false, error: result.error, movementCount: result.movementCount }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:resource-movements-replace-chapter', async (
    _event,
    chapterNumber: number,
    rows: ResourceMovementInput[],
    source: ResourceMovementSource,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = replaceChapterMovements(db, chapterNumber, rows ?? [], source)
      return result.success ? { success: true, inserted: result.inserted } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 账本读视图：一次取回「资源定义 + 截至本章的变动 + 已扫章号」。
  // 中断判定必须和余额同一个快照，否则中间插入一次抽取会让 UI 显示「余额已变、中断未变」。
  ipcMain.handle('db:resource-ledger-read', async (_event, throughChapter: number, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M11 之前的库 / 未打开：降级成空视图，不报错（设计稿 §9）。
      if (!db || !hasResourceLedgerSchema(db)) {
        return { success: true, resources: [], movements: [], scannedChapters: [] }
      }
      return {
        success: true,
        resources: listResources(db),
        movements: listMovementsThrough(db, throughChapter),
        scannedChapters: listScannedLedgerChapters(db),
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P1-1 关键物品（谁拿着什么；不是账本，没有余额与变动）
  // ============================================================
  ipcMain.handle('db:key-items-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M14 之前 / 库未打开：降级成空列表，不报错（与资源登记同一纪律）。
      if (!db || !hasKeyItemSchema(db)) return { success: true, items: [] }
      return { success: true, items: listKeyItems(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:key-items-upsert', async (_event, input: KeyItemInput, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = upsertKeyItem(db, input)
      return result.success ? { success: true, itemId: result.itemId } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:key-items-delete', async (_event, itemId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = deleteKeyItem(db, itemId)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P1-1 制度（周期事件：月例 / 签到 / 送账；只判该不该发生）
  // ============================================================
  ipcMain.handle('db:cadences-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M15 之前 / 库未打开：降级成空列表，不报错（与资源、关键物品同一纪律）。
      if (!db || !hasInstitutionCadenceSchema(db)) return { success: true, cadences: [] }
      return { success: true, cadences: listInstitutionCadences(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:cadences-upsert', async (
    _event,
    input: InstitutionCadenceInput,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = upsertInstitutionCadence(db, input)
      return result.success
        ? { success: true, cadenceId: result.cadenceId }
        : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:cadences-delete', async (_event, cadenceId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = deleteInstitutionCadence(db, cadenceId)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P1-1 信息流（谁知道什么）。失效三态由仓储算好再返回 —— 渲染层与生成链都不自己判。
  // ============================================================
  ipcMain.handle('db:knowledge-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M16 之前 / 库未打开：降级成空列表，不报错（与资源、关键物品、制度同一纪律）。
      if (!db || !hasKnowledgeSchema(db)) return { success: true, entries: [] }
      return { success: true, entries: await listKnowledgeStates(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:knowledge-upsert', async (
    _event,
    input: KnowledgeStateInput,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = await upsertKnowledgeState(db, input)
      return result.success
        ? { success: true, knowledgeId: result.knowledgeId }
        : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:knowledge-delete', async (_event, knowledgeId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = deleteKnowledgeState(db, knowledgeId)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:knowledge-fact-candidates', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: true, candidates: [] }
      return { success: true, candidates: await listFactCandidates(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P20-3 章末知情候选（只读）。
  // 采纳走既有的 `db:knowledge-upsert` —— 这里**刻意没有**「自动写知情行」的通道，
  // 否则「模型提议 + 作者采纳」就退化成「模型写入」。
  // 失效三态由 `listKnowledgeCandidateViews` 算好，渲染层不自己拼。
  // ============================================================
  ipcMain.handle('db:knowledge-candidates-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // 库未打开 / M22 之前：降级成空列表，不报错（与其它宿体同一纪律）。
      if (!db) return { success: true, entries: [] }
      return { success: true, entries: SummaryRepository.listKnowledgeCandidateViews(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P20-2 秘密宿体（谁在捂什么 / 谁还不知道 / 第几章穿）。
  // 只有登记页与审稿链用它 —— 真相本体绝不进正文提示词（判据 DP 同族），
  // 所以这里刻意不提供「给正文链取守卫」的通道。
  // ============================================================
  ipcMain.handle('db:secrets-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M21 之前 / 库未打开：降级成空列表，不报错（与其它宿体同一纪律）。
      if (!db || !hasSecretSchema(db)) return { success: true, entries: [] }
      return { success: true, entries: listSecrets(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:secrets-upsert', async (
    _event,
    input: SecretInput,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = upsertSecret(db, input)
      return result.success
        ? { success: true, secretId: result.secretId }
        : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:secrets-delete', async (_event, secretId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = deleteSecret(db, secretId)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P1-1 能力（本书级能力规则）。只登「没有角色归属」的那一半 —— 角色技能在角色卡里。
  // ============================================================
  ipcMain.handle('db:abilities-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M17 之前 / 库未打开：降级成空列表，不报错（与资源、物品、制度、知情同一纪律）。
      if (!db || !hasPowerAbilitySchema(db)) return { success: true, abilities: [] }
      return { success: true, abilities: listPowerAbilities(db) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:abilities-upsert', async (
    _event,
    input: PowerAbilityInput,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = upsertPowerAbility(db, input)
      return result.success
        ? { success: true, abilityId: result.abilityId }
        : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:abilities-delete', async (_event, abilityId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = deletePowerAbility(db, abilityId)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P1-2 卷末交接单。一条记录 = 一卷，正文链只用 `-before` 这一条读取入口。
  // ============================================================
  ipcMain.handle('db:volume-handoffs-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      // M18 之前 / 库未打开：降级成空列表，不报错（与资源、物品、制度、知情、能力同一纪律）。
      if (!db || !hasVolumeHandoffSchema(db)) return { success: true, entries: [] }
      const context = readDerivedReadContext(db)
      const sourceRefs = readVolumeHandoffSourceRefs(db)
      return {
        success: true,
        entries: listVolumeHandoffs(db).map(entry => ({
          ...entry,
          validity: volumeHandoffValidity(context, sourceRefs.get(entry.handoffId), entry),
        })),
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 返回值加了 `missing` 与 `validity`（P2-2 期 2）。必须分得开三件事：
  //   读失败（`success:false`）/ 没有上一卷（`missing:true`）/ 读到了但它旧了（`stale`）。
  // 原来「表缺 / 库没开 / 这卷没有前置」全折成 `entry:null`，正文链拿到 null 只能当
  // 「不用注入」—— 于是**已知过期的交接单照样进每一次正文请求**，而这是设计稿
  // §5.3 里最靠前的一处必拦点。
  ipcMain.handle('db:volume-handoffs-before', async (
    _event,
    beforeChapter: number,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db || !hasVolumeHandoffSchema(db)) {
        return { success: true, entry: null, missing: true }
      }
      const entry = findPreviousHandoff(db, beforeChapter)
      if (!entry) return { success: true, entry: null, missing: true }
      const context = readDerivedReadContext(db)
      return {
        success: true,
        entry,
        missing: false,
        validity: volumeHandoffValidity(context, readVolumeHandoffSourceRef(db, entry.handoffId), entry),
      }
    } catch (err) {
      return { success: false, error: String(err), missing: false }
    }
  })

  ipcMain.handle('db:volume-handoffs-upsert', async (
    _event,
    input: VolumeHandoffInput,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      return { success: true, entry: upsertVolumeHandoff(db, input) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:volume-handoffs-delete', async (_event, handoffId: string, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      return deleteVolumeHandoff(db, handoffId)
        ? { success: true }
        : { success: false, error: 'VOLUME_HANDOFF_NOT_FOUND' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // P1-2 卷 / 单元结构（M19）。计划列从大纲物化；`actual_last` 只由「标记本卷已完成」写。
  // ============================================================
  ipcMain.handle('db:volumes-list', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db || !hasVolumeStructureSchema(db)) {
        // v20 之前 / 库未打开：四态里的「建不起来」比抛错对面板友好得多。
        return { success: true, volumes: [], state: 'unparsed', warnings: [] }
      }
      const read = readVolumeStructure(db)
      return { success: true, volumes: read.volumes, state: read.state, warnings: read.warnings }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:volumes-rebuild', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      if (!hasVolumeStructureSchema(db)) return { success: false, error: 'VOLUME_STRUCTURE_SCHEMA_MISSING' }
      const core = ProjectCoreRepository.get(db)
      if (!core) return { success: false, error: 'VOLUME_STRUCTURE_UNPARSED' }
      const result = rebuildVolumes(db, {
        plan: core.plotStructurePlan,
        synopsis: core.synopsis,
        totalChapters: core.totalChapters,
      })
      // 「重建卷结构」的语义是「按当前大纲和正文重算」：计划列来自大纲，
      // `actual_*` 来自已定稿的草稿。只重算前者会让作者看到「6 章都写完了，
      // 进度还是空的」。`refreshVolumeProgress` 是纯查询，不会覆盖任何作者决定。
      refreshVolumeProgress(db)
      return {
        success: true,
        volumes: result.volumes,
        warnings: result.warnings,
        retained: result.retained,
        removed: result.removed,
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:volumes-mark-done', async (
    _event,
    volumeId: string,
    expectedProjectPath: string,
  ) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      const db = getProjectDb()
      if (!db) return { success: false, error: 'PROJECT_NOT_OPEN' }
      const result = markVolumeDone(db, volumeId)
      return { success: true, volume: result.volume, actualLast: result.actualLast }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /**
   * 只读：金手指原文。登记页用它给「取首行标题 / 取引号短语」两个候选 —— 取样里 2/3 的书
   * 没有现成名字，`name` 又是唯一必填项，没有这个入口作者就进不去。
   *
   * 走 `ProjectCoreRepository.get()` 而不是另写 SQL：`project_core` 的读路径只有这一处，
   * 多一份 SELECT 就会长出第二套字段映射。**永不写库**，因此不进 MUTATING 集合。
   */
  ipcMain.handle('db:golden-finger-read', async (_event, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      if (!getProjectDb()) return { success: true, goldenFinger: '' }
      return { success: true, goldenFinger: ProjectCoreRepository.get()?.goldenFinger ?? '' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ============================================================
  // 沿用旧表
  // ============================================================
  ipcMain.handle('db:log-llm-call', async (_event, call, expectedProjectPath: string) => {
    try {
      assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
      LLMHistoryRepository.logCall(call)
      return { success: true }
    } catch (error) {
      console.error('[db:log-llm-call] Error:', error)
      return { success: false }
    }
  })

  ipcMain.handle('db:get-llm-stats', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return LLMHistoryRepository.getStats()
  })

  ipcMain.handle('db:get-llm-history', async (_event, limit: number | undefined, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return LLMHistoryRepository.getHistory(limit ?? 50)
  })

  ipcMain.handle('db:save-summary-snapshot', async (_event, chapterNumber: number, characterStates: string, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    SummaryRepository.saveSnapshot(chapterNumber, characterStates)
    return { success: true }
  })

  ipcMain.handle('db:get-latest-summary', async (_event, expectedProjectPath: string) => {
    assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
    return SummaryRepository.getLatestSnapshot()
  })
}
