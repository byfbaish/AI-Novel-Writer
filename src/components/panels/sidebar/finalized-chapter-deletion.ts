import type { ProjectData, ProjectSessionContext } from '../../../shared/ipc-channels'
import type { ChapterDeletionResult } from '../../../shared/chapter-deletion'
import { globalEventBus } from '../../../shared/event-bus'
import { ipc } from '../../../services/ipc-client'
import { useDraftStore } from '../../../stores/draft-store'
import { useEditorStore } from '../../../stores/editor-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { confirm } from '../../ui/Confirm'
import { toast } from '../../ui/Toast'
import {
  captureProjectSession,
  isProjectSessionCurrent,
  isProjectSessionPath,
} from '../../project-session-gate'
import { clearChapterTitleCache } from './manuscript-title-cache'

type SessionProject = Pick<ProjectData, 'id' | 'path' | 'sessionLease'>
type DeletionSurface = 'manuscript' | 'revert'
type Localize = (chinese: string, english: string) => string

interface DeleteFinalizedChapterInput {
  project: SessionProject | null | undefined
  projectPath: string
  draftId: number
  chapterNumber: number
  displayName: string
  tabFilePath: string
  surface: DeletionSurface
}

interface DeletionSurfaceConfig {
  confirmation: string
  confirmationTitle: string
  success: string
  partialFailure: (error: string) => string
  prepareRefresh: (tabFilePath: string) => void
  refreshDrafts: (
    projectPath: string,
    chapterNumber: number,
    projectSession: ProjectSessionContext,
  ) => Promise<void>
}

function deletionSurfaceConfig(
  surface: DeletionSurface,
  displayName: string,
  text: Localize,
): DeletionSurfaceConfig {
  const configs: Record<DeletionSurface, DeletionSurfaceConfig> = {
    revert: {
      confirmation: text(
        `确认把「${displayName}」退回草稿？\n正文会保留在草稿箱，可以继续修改后重新定稿；定稿收据、章节要点、角色状态与该章资源变动会一并作废，正文实体稿与知识库文档会被清理。蓝图不受影响。`,
        `Move “${displayName}” back to draft?\nThe manuscript stays in the draft box so you can edit and finalize again. The finalization receipt, chapter notes, character state, and this chapter's resource movements are dropped; the published manuscript file and knowledge document are cleaned up. Blueprints are untouched.`,
      ),
      confirmationTitle: text('退回草稿', 'Move back to draft'),
      success: text(`已把「${displayName}」退回草稿`, `Moved “${displayName}” back to draft`),
      partialFailure: error => text(
        `已退回草稿，但派生投影仍待清理：${error}。请在正文章节下使用“重试清理”。`,
        `Moved back to draft, but derived projections still need cleanup: ${error}. Use “Retry cleanup” below Manuscript chapters.`,
      ),
      prepareRefresh: clearChapterTitleCache,
      refreshDrafts: (projectPath, chapterNumber, projectSession) => (
        useDraftStore.getState().loadChapterDrafts(chapterNumber, projectPath, projectSession)
      ),
    },
    manuscript: {
      confirmation: text(
        `确认删除正文「${displayName}」？\n此操作会删除定稿事实，并清理实体稿、知识库和后处理投影；蓝图会保留。清理失败时可在正文章节下重试。`,
        `Delete manuscript “${displayName}”?\nThis removes the finalized fact and cleans its manuscript file, knowledge document, and post-processing projections. The blueprint is preserved, and failed cleanup can be retried below Manuscript chapters.`,
      ),
      confirmationTitle: text('删除正文', 'Delete manuscript'),
      success: text(
        `已删除正文「${displayName}」及其派生投影`,
        `Deleted manuscript “${displayName}” and its derived projections.`,
      ),
      partialFailure: error => text(
        `正文已删除，但派生投影仍待清理：${error}。请使用“重试清理”。`,
        `The manuscript fact was deleted, but derived projections still need cleanup: ${error}. Use “Retry cleanup”.`,
      ),
      prepareRefresh: clearChapterTitleCache,
      refreshDrafts: (projectPath, _chapterNumber, projectSession) => (
        useDraftStore.getState().loadAllDrafts(projectPath, projectSession)
      ),
    },
  }
  return configs[surface]
}

function emitDeletionStatusUpdated(
  projectPath: string,
  projectSession: ProjectSessionContext,
): void {
  globalEventBus.emit('CHAPTER_DELETION_UPDATED', { projectPath, projectSession })
}

/**
 * 被「定稿链尾部」守卫拒绝时说的是**规则**，不是一个失败。
 *
 * 这条不是异常，是设计约束：中间章的定稿事实还撑着后面几章，撤掉它等于让后续章节
 * 静默失去前提。用「删除失败」开头会让人以为重试或换个顺序就能过，所以单独出文案。
 * 章号来自 `errorDetails`，不靠匹配错误字符串。
 */
function showUncommittedError(result: ChapterDeletionResult, text: Localize): void {
  if (result.errorCode === 'FINALIZED_CHAIN_TAIL_REQUIRED') {
    const target = result.errorDetails?.chapterNumber
    const latest = result.errorDetails?.latestFinalizedChapter
    toast.warning(text(
      `不能退回第 ${target ?? '?'} 章：后面还有第 ${latest ?? '?'} 章的定稿引用它的事实。\n\n`
        + '只能从最后一章定稿开始，一章一章往回退；跳章退回要连同后面的章节一起回退（与卷回滚一起做，尚未实现）。',
      `Chapter ${target ?? '?'} cannot be reverted: Chapter ${latest ?? '?'} was finalized on top of its facts.\n\n`
        + 'Unwind from the latest finalized chapter, one chapter at a time. Skipping chapters requires rolling back the later ones as well (to be designed together with volume rollback).',
    ), 10_000)
    return
  }
  toast.error(text(
    `删除失败\n\n${result.error ?? '未知错误'}`,
    `Delete failed\n\n${result.error ?? 'Unknown error'}`,
  ))
}

async function finishCommittedDeletion(
  input: DeleteFinalizedChapterInput,
  projectSession: ProjectSessionContext,
  result: ChapterDeletionResult,
  config: DeletionSurfaceConfig,
  text: Localize,
): Promise<ChapterDeletionResult | null> {
  const editor = useEditorStore.getState()
  const tab = editor.tabs.find(candidate =>
    candidate.projectKey === input.projectPath
    && (candidate.id === input.tabFilePath || candidate.filePath === input.tabFilePath)
  )
  if (tab) editor.closeTab(tab.id)

  config.prepareRefresh(input.tabFilePath)
  await config.refreshDrafts(input.projectPath, input.chapterNumber, projectSession)
  if (!isProjectSessionCurrent(projectSession)) return null
  globalEventBus.emit('REFRESH_RESOURCE', {
    resources: ['drafts', 'fileTree'],
    projectPath: input.projectPath,
    projectSession,
  })

  if (result.success) {
    toast.success(config.success)
  } else {
    toast.warning(config.partialFailure(result.error ?? text('未知错误', 'Unknown error')), 8000)
  }
  return result
}

async function confirmLegacyKnowledgeAbsent(
  input: DeleteFinalizedChapterInput,
  operationId: string,
  projectSession: ProjectSessionContext,
  config: DeletionSurfaceConfig,
  text: Localize,
): Promise<ChapterDeletionResult | null> {
  const confirmed = await confirm(text(
    '此旧定稿没有可验证的知识文档 ID。只有在我已人工核对/清理，并确认该定稿没有需要应用自动删除的知识投影时，才能继续；应用不会删除来源不明的 reference 文档。',
    'This legacy finalization has no verifiable knowledge document ID. Continue only if I have manually checked or cleaned the knowledge base and confirm there is no knowledge projection for the app to remove; the app will not delete reference documents of unknown provenance.',
  ), {
    title: text('确认旧定稿知识投影状态', 'Confirm legacy knowledge projection'),
    confirmText: text('我已人工核对/清理，继续删除', 'I have checked; continue deletion'),
    danger: true,
  })
  if (!confirmed || !isProjectSessionCurrent(projectSession)) return null

  const result = await ipc.invokeWithProjectSession(
    projectSession,
    'chapter:confirm-legacy-knowledge-absent',
    operationId,
    input.projectPath,
  )
  if (!isProjectSessionCurrent(projectSession)) return null
  emitDeletionStatusUpdated(input.projectPath, projectSession)
  if (!result.committed) {
    showUncommittedError(result, text)
    return result
  }
  return finishCommittedDeletion(input, projectSession, result, config, text)
}

/** Shared renderer action for both finalized-chapter sidebar surfaces. */
export async function deleteFinalizedChapter(
  input: DeleteFinalizedChapterInput,
): Promise<ChapterDeletionResult | null> {
  const text = useLocaleStore.getState().text
  const config = deletionSurfaceConfig(input.surface, input.displayName, text)
  const projectSession = captureProjectSession(input.project)
  if (!projectSession || !isProjectSessionPath(projectSession, input.projectPath)) return null

  const confirmed = await confirm(config.confirmation, {
    title: config.confirmationTitle,
    confirmText: text('删除', 'Delete'),
    danger: true,
  })
  if (!confirmed || !isProjectSessionCurrent(projectSession)) return null

  const result = await ipc.invokeWithProjectSession(
    projectSession,
    'chapter:delete-finalized',
    { draftId: input.draftId, chapterNumber: input.chapterNumber },
    input.projectPath,
  )
  if (!isProjectSessionCurrent(projectSession)) return null
  emitDeletionStatusUpdated(input.projectPath, projectSession)
  if (result.operation?.legacyKnowledgeAuthorization === 'required') {
    return confirmLegacyKnowledgeAbsent(
      input,
      result.operation.operationId,
      projectSession,
      config,
      text,
    )
  }
  if (!result.committed) {
    showUncommittedError(result, text)
    return result
  }
  return finishCommittedDeletion(input, projectSession, result, config, text)
}

/**
 * 把一章定稿**退回草稿**（2026-10-23）。
 *
 * 与「删除正文」是两件事，刻意分开：
 * - 退回：正文留在草稿箱，定稿收据 / 章节要点 / 角色状态 / 该章资源变动作废，
 *   实体稿与知识库文档清理，**蓝图保留**；改完可以重新定稿；
 * - 删除：连正文草稿一起删（在「正文章节」那条入口）。
 *
 * 旧定稿（无可验证知识文档身份）由主进程直接拒绝：那条路会走到「删除事实」分支，
 * 与本动作「绝不删正文」的前提冲突。此时 `committed=false`，错误文案即原因。
 */
export async function revertFinalizedChapter(
  input: Omit<DeleteFinalizedChapterInput, 'surface'>,
): Promise<ChapterDeletionResult | null> {
  const text = useLocaleStore.getState().text
  const config = deletionSurfaceConfig('revert', input.displayName, text)
  const projectSession = captureProjectSession(input.project)
  if (!projectSession || !isProjectSessionPath(projectSession, input.projectPath)) return null

  // 退回任意章都会让其后章节的派生相对新世代过期 —— 确认框必须先说清波及范围，
  // 否则作者点完才发现列表里多出一排「前提已变」。
  let scopeNote = ''
  try {
    const snapshot = await ipc.invokeWithProjectSession(
      projectSession,
      'db:chapter-staleness-list',
      input.projectPath,
    )
    const tail = snapshot.success ? (snapshot.latestFinalizedChapter ?? 0) : 0
    if (tail > input.chapterNumber) {
      scopeNote = text(
        `\n\n退回后，第 ${input.chapterNumber + 1}–${tail} 章会被标记为「前提已变」，`
          + '需逐章处置：重新定稿、修复后处理，或确认无需改动。',
        `\n\nAfter reverting, chapters ${input.chapterNumber + 1}–${tail} will be marked "stale" and need one of: re-finalize, repair post-processing, or confirm no change.`,
      )
    }
  } catch {
    // 拿不到范围就按原文案确认：不阻塞动作，只是少一句提示
  }

  const confirmed = await confirm(config.confirmation + scopeNote, {
    title: config.confirmationTitle,
    confirmText: text('退回草稿', 'Move back to draft'),
  })
  if (!confirmed || !isProjectSessionCurrent(projectSession)) return null

  const result = await ipc.invokeWithProjectSession(
    projectSession,
    'chapter:revert-finalized',
    { draftId: input.draftId, chapterNumber: input.chapterNumber },
    input.projectPath,
  )
  if (!isProjectSessionCurrent(projectSession)) return null
  emitDeletionStatusUpdated(input.projectPath, projectSession)
  if (!result.committed) {
    showUncommittedError(result, text)
    return result
  }
  return finishCommittedDeletion({ ...input, surface: 'revert' }, projectSession, result, config, text)
}

/** Resume a persisted legacy-provenance receipt from the Manuscript status row. */
export async function confirmLegacyKnowledgeAbsentAndContinue(
  input: DeleteFinalizedChapterInput,
  operationId: string,
): Promise<ChapterDeletionResult | null> {
  const text = useLocaleStore.getState().text
  const config = deletionSurfaceConfig(input.surface, input.displayName, text)
  const projectSession = captureProjectSession(input.project)
  if (!projectSession || !isProjectSessionPath(projectSession, input.projectPath)) return null
  return confirmLegacyKnowledgeAbsent(input, operationId, projectSession, config, text)
}
