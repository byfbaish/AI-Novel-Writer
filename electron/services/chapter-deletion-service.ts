import { randomUUID } from 'node:crypto'

import type {
  ChapterDeletionOperation,
  ChapterDeletionResult,
  DeleteFinalizedChapterRequest,
} from '../../src/shared/chapter-deletion'
import { ChapterDeletionRepository } from '../repositories/chapter-deletion-repository'
import { FinalizationRepository } from '../repositories/finalization-repository'
import { PostProcessRepository } from '../repositories/post-process-repository'
import { knowledgeBaseLoader } from './knowledge-base-loader'
import { removePublishedManuscript } from './manuscript-publisher'
import { readPortableRuntimeFreeze } from './portable-runtime-freeze'

export interface ChapterDeletionProjectionCleaner {
  removeManuscript(projectRoot: string, targetFileName: string): Promise<void>
  removeKnowledgeDocument(projectRoot: string, documentId: string): Promise<void>
}

export interface ChapterDeletionServiceOptions {
  createOperationId?: () => string
  cleaner?: ChapterDeletionProjectionCleaner
}

const defaultCleaner: ChapterDeletionProjectionCleaner = {
  removeManuscript: removePublishedManuscript,
  async removeKnowledgeDocument(projectRoot, documentId) {
    const result = await knowledgeBaseLoader.run((kb) => kb.removeDocument(documentId, projectRoot))
    if (result !== true) {
      if (result && typeof result === 'object' && 'errorCode' in result) {
        throw new Error('知识库原生模块不可用')
      }
      throw new Error('知识库未确认文档已删除')
    }
  },
}

function operationError(operation: ChapterDeletionOperation): string | undefined {
  const failures = [
    operation.manuscriptStatus === 'failed'
      ? `实体稿清理失败：${operation.manuscriptError || '未知错误'}`
      : '',
    operation.knowledgeStatus === 'failed'
      ? `知识库清理失败：${operation.knowledgeError || '未知错误'}`
      : '',
  ].filter(Boolean)
  return failures.length > 0 ? failures.join('；') : undefined
}

function legacyKnowledgeAuthorizationRequired(
  operation: ChapterDeletionOperation,
): ChapterDeletionResult {
  return {
    success: false,
    committed: false,
    operation,
    error: '旧定稿缺少可靠知识文档身份，已保留章节事实和知识库内容；请人工核对后确认没有需要应用自动删除的知识投影',
  }
}

function frozenLegacyOperation(projectRoot: string, operation: ChapterDeletionOperation): ChapterDeletionResult | null {
  if (!readPortableRuntimeFreeze(projectRoot).isFrozen('chapter_deletion_operations', operation.operationId)) return null
  return { success: false, committed: false, error: '旧项目章节删除操作仅保留为历史，不能在新项目中重试或继续清理' }
}

export class ChapterDeletionService {
  private readonly createOperationId: () => string
  private readonly cleaner: ChapterDeletionProjectionCleaner

  constructor(options: ChapterDeletionServiceOptions = {}) {
    this.createOperationId = options.createOperationId ?? randomUUID
    this.cleaner = options.cleaner ?? defaultCleaner
  }

  async delete(
    projectRoot: string,
    request: DeleteFinalizedChapterRequest,
  ): Promise<ChapterDeletionResult> {
    const replayed = await this.resumeExistingOperation(projectRoot, request, '章节删除请求与已冻结操作身份不匹配')
    if (replayed) return replayed
    const requiresLegacyKnowledgeAuthorization = this.requiresLegacyKnowledgeAuthorization(request)
    const frozen = ChapterDeletionRepository.begin({
      operationId: this.createOperationId(),
      draftId: request.draftId,
      chapterNumber: request.chapterNumber,
      legacyKnowledgeAuthorizationRequired: requiresLegacyKnowledgeAuthorization,
    })
    if (requiresLegacyKnowledgeAuthorization) {
      return legacyKnowledgeAuthorizationRequired(frozen)
    }
    return this.resume(projectRoot, frozen.operationId)
  }

  /**
   * 退回草稿（2026-10-23）：撤销定稿事实，**保留正文与草稿行**。
   *
   * 与 `delete` 共用同一条 begin → resume：投影清理（正文实体稿、知识库）完全一样，
   * 差别只在 `begin({ keepDraft: true })` —— 它删收据与派生、但不删 drafts/contents。
   */
  async revert(
    projectRoot: string,
    request: DeleteFinalizedChapterRequest,
  ): Promise<ChapterDeletionResult> {
    const replayed = await this.resumeExistingOperation(projectRoot, request, '退回草稿请求与已冻结操作身份不匹配')
    if (replayed) return replayed
    /**
     * 旧定稿（无可验证的知识文档 ID）**不开退回通道**。
     *
     * 原因：`confirmLegacyKnowledgeAbsent` 走到的是删除分支（会真的删草稿），
     * 而「退回草稿」绝不能删草稿。与其让作者在确认框里踩一个会毁正文的岔路，
     * 不如在这里直接拒绝并给出可行替代。
     */
    if (this.requiresLegacyKnowledgeAuthorization(request)) {
      return {
        success: false,
        committed: false,
        error: '该章是旧定稿且没有可验证的知识文档身份，退回草稿可能留下无法清理的知识投影；'
          + '请先在知识库手动清理这一章的文档，或使用「删除正文」明确删除整章',
      }
    }
    const begun = ChapterDeletionRepository.begin({
      operationId: this.createOperationId(),
      draftId: request.draftId,
      chapterNumber: request.chapterNumber,
      keepDraft: true,
    })
    return this.resume(projectRoot, begun.operationId)
  }

  /**
   * 已存在同一草稿的操作收据时，怎么回应这次请求。`null` = 收据已作废，走全新流程。
   *
   * 关键一条：`completed` 不等于「现在也是完成态」。库被恢复/回滚之后，收据还写着
   * 已完成，事实却回到了定稿态；此时若直接返回成功，界面会报「已退回/已删除」，
   * 而数据一动没动 —— 2026-10-23 实机就是这么骗了作者一次。所以先复核事实。
   */
  private async resumeExistingOperation(
    projectRoot: string,
    request: DeleteFinalizedChapterRequest,
    mismatchError: string,
  ): Promise<ChapterDeletionResult | null> {
    const existing = ChapterDeletionRepository.getByDraftId(request.draftId)
    if (!existing) return null
    if (existing.draftId !== request.draftId || existing.chapterNumber !== request.chapterNumber) {
      return { success: false, committed: false, error: mismatchError }
    }
    const frozen = frozenLegacyOperation(projectRoot, existing)
    if (frozen) return frozen
    if (
      existing.status === 'completed'
      && ChapterDeletionRepository.factsStillActionable(request.draftId)
    ) {
      ChapterDeletionRepository.discard(existing.operationId)
      return null
    }
    if (existing.legacyKnowledgeAuthorization === 'required') {
      return legacyKnowledgeAuthorizationRequired(existing)
    }
    return this.resume(projectRoot, existing.operationId)
  }

  private requiresLegacyKnowledgeAuthorization(request: DeleteFinalizedChapterRequest): boolean {
    const finalization = FinalizationRepository.getByDraftId(request.draftId)
    if (!finalization || finalization.knowledgeDocumentId) return false
    const run = PostProcessRepository.getLatestRun('chapter_finalize', String(request.chapterNumber))
    const hasKnowledgeProjection = !run || PostProcessRepository.getSteps(run.id)
      .some(step => step.stepKey === 'kb_import')
    return hasKnowledgeProjection
  }

  async confirmLegacyKnowledgeAbsent(
    projectRoot: string,
    operationId: string,
  ): Promise<ChapterDeletionResult> {
    const existing = ChapterDeletionRepository.get(operationId)
    if (existing) {
      const frozen = frozenLegacyOperation(projectRoot, existing)
      if (frozen) return frozen
    }
    const operation = ChapterDeletionRepository.confirmLegacyKnowledgeAbsent(operationId)
    return this.resume(projectRoot, operation.operationId)
  }

  async retry(projectRoot: string, operationId: string): Promise<ChapterDeletionResult> {
    const operation = ChapterDeletionRepository.get(operationId)
    if (!operation) {
      return { success: false, committed: false, error: '未找到可重试的章节删除操作' }
    }
    const frozen = frozenLegacyOperation(projectRoot, operation)
    if (frozen) return frozen
    if (operation.legacyKnowledgeAuthorization === 'required') {
      return legacyKnowledgeAuthorizationRequired(operation)
    }
    return this.resume(projectRoot, operationId)
  }

  listIncomplete(projectRoot: string): ChapterDeletionOperation[] {
    const freeze = readPortableRuntimeFreeze(projectRoot)
    return ChapterDeletionRepository.listIncomplete().filter(operation => !freeze.isFrozen('chapter_deletion_operations', operation.operationId))
  }

  private async resume(projectRoot: string, operationId: string): Promise<ChapterDeletionResult> {
    let operation = ChapterDeletionRepository.get(operationId)
    if (!operation) return { success: false, committed: false, error: '章节删除操作不存在' }
    const frozen = frozenLegacyOperation(projectRoot, operation)
    if (frozen) return frozen
    if (operation.status === 'completed') {
      return { success: true, committed: true, operation }
    }

    operation = ChapterDeletionRepository.startAttempt(operationId)
    if (operation.manuscriptStatus === 'pending' || operation.manuscriptStatus === 'failed') {
      try {
        await this.cleaner.removeManuscript(projectRoot, operation.targetFileName)
        operation = ChapterDeletionRepository.markProjection(operationId, 'manuscript', 'completed')
      } catch (error) {
        operation = ChapterDeletionRepository.markProjection(
          operationId,
          'manuscript',
          'failed',
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    if (operation.knowledgeStatus === 'pending' || operation.knowledgeStatus === 'failed') {
      try {
        await this.cleaner.removeKnowledgeDocument(projectRoot, operation.knowledgeDocumentId)
        operation = ChapterDeletionRepository.markProjection(operationId, 'knowledge', 'completed')
      } catch (error) {
        operation = ChapterDeletionRepository.markProjection(
          operationId,
          'knowledge',
          'failed',
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    operation = ChapterDeletionRepository.get(operationId) ?? operation
    const error = operationError(operation)
    return {
      success: operation.status === 'completed',
      committed: true,
      operation,
      ...(error ? { error } : {}),
    }
  }
}

export const chapterDeletionService = new ChapterDeletionService()
