import { getProjectDb } from '../database'
import { invalidateContinuityProjectionFrom } from './summary-repository'
import type {
  ChapterDeletionOperation,
  ChapterDeletionProjectionStatus,
} from '../../src/shared/chapter-deletion'

interface ChapterDeletionRow {
  operation_id: string
  draft_id: number
  chapter_number: number
  chapter_title: string
  finalization_id: string
  target_file_name: string
  knowledge_document_id: string
  post_process_run_ids: string
  manuscript_status: ChapterDeletionProjectionStatus
  manuscript_error: string
  knowledge_status: ChapterDeletionProjectionStatus
  knowledge_error: string
  legacy_knowledge_authorization: ChapterDeletionOperation['legacyKnowledgeAuthorization']
  legacy_knowledge_authorized_at: string
  status: ChapterDeletionOperation['status']
  attempt_count: number
  created_at: string
  updated_at: string
  completed_at: string
}

interface FinalizedChapterTarget {
  id: number
  chapter_number: number
  status: string
  content_id: number
  finalization_id: string
  chapter_title: string | null
  target_file_name: string | null
  knowledge_document_id: string | null
}

function requireDatabase() {
  const db = getProjectDb()
  if (!db) throw new Error('项目数据库未打开')
  return db
}

function parsePostProcessRunIds(value: string): string[] | null {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(candidate => typeof candidate === 'string')
      ? parsed
      : null
  } catch {
    return null
  }
}

function requireFinalizedTarget(
  db: ReturnType<typeof requireDatabase>,
  draftId: number,
  chapterNumber: number,
): FinalizedChapterTarget {
  const target = db.prepare(`
    SELECT drafts.id, drafts.chapter_number, drafts.status, drafts.content_id,
           finalization_outbox.finalization_id,
           finalization_outbox.chapter_title,
           finalization_outbox.target_file_name,
           finalization_outbox.knowledge_document_id
    FROM drafts
    LEFT JOIN finalization_outbox ON finalization_outbox.draft_id = drafts.id
    WHERE drafts.id = ?
  `).get(draftId) as (Omit<FinalizedChapterTarget, 'finalization_id'> & {
    finalization_id: string | null
  }) | undefined
  if (!target) throw new Error(`草稿不存在：${draftId}`)
  if (target.chapter_number !== chapterNumber) throw new Error('草稿与待删除章节身份不匹配')
  if (target.status !== 'finalized' || !target.finalization_id) {
    throw new Error('只有具备定稿提交收据的章节才能通过章节生命周期入口删除')
  }
  // 链尾检查**不在这里**：退回草稿允许任意章（ADR-0023），删除正文仍限链尾。
  // 放在 `begin` 里按 keepDraft 分流，避免两条入口各写一份。
  return target as FinalizedChapterTarget
}

/**
 * 只有**定稿链尾部**可以**删除**（2026-10-23 裁定；2026-10-23 晚 ADR-0023 收窄为"仅删除"）。
 *
 * 退回草稿已放开到任意章：它会调 `invalidateContinuityProjectionFrom`，后续章的快照代
 * 相对新世代落后 ⇒ 界面显示「前提已变」、生成链拒绝把它们当前提，失效不再静默。
 * 删除不同 —— 它连正文一起删，后续章没有任何东西可复核，所以仍限链尾。
 *
 * 为什么必须拦中间章：第 N 章一旦定稿，第 N+1 章就是**基于它的事实**写出来并定稿的
 * （角色状态、连续性事实、账本余额、故事日序都从它推）。此时撤掉第 N 章的定稿事实，
 * 后续章节的正文与收据全都还挂着，但它们的依据已经被抽走 —— 这是「静默失去前提」，
 * 比报错严重得多：不会有人发现，直到一致性全面崩掉。
 *
 * 所以允许的只有一种形态：**从最后一章定稿开始，倒着连续退**。退完 N，N-1 自动成为新尾部。
 * 需要跳着退（例如退第 2 章而第 5 章还定稿着）时必须连带回退 3–5 章的正文与派生，
 * 那是「指定连续回退 / 卷回滚」的范畴，属于另一件事，不在这里做。
 */
function requireFinalizedChainTail(
  db: ReturnType<typeof requireDatabase>,
  chapterNumber: number,
): void {
  const latest = db.prepare(
    "SELECT COALESCE(MAX(chapter_number), 0) FROM drafts WHERE status = 'finalized'",
  ).pluck().get() as number
  if (chapterNumber >= latest) return
  throw Object.assign(
    new Error(
      `第 ${chapterNumber} 章后面还有第 ${latest} 章的定稿在引用它的事实，`
      + `只能从最后一章（第 ${latest} 章）开始倒着连续退回；`
      + `要直接退第 ${chapterNumber} 章，需要连同第 ${chapterNumber + 1}–${latest} 章一起回退（指定连续回退 / 卷回滚，尚未实现）`,
    ),
    {
      code: 'FINALIZED_CHAIN_TAIL_REQUIRED' as const,
      chapterNumber,
      latestFinalizedChapter: latest,
    },
  )
}

function listPostProcessRunIds(
  db: ReturnType<typeof requireDatabase>,
  chapterNumber: number,
  finalizationId: string,
): string[] {
  const rows = db.prepare(`
    SELECT id FROM post_process_runs
    WHERE trigger_source_type = 'chapter_finalize' AND trigger_source_id IN (?, ?)
    ORDER BY id
  `).all(String(chapterNumber), `finalization:${finalizationId}`) as Array<{ id: string }>
  return rows.map(row => row.id)
}

function deleteChapterFacts(
  db: ReturnType<typeof requireDatabase>,
  target: FinalizedChapterTarget,
  postProcessRunIds: readonly string[],
): void {
  invalidateContinuityProjectionFrom(db, target.chapter_number)
  const contentIds = new Set<number>([target.content_id])
  const revisionContents = db.prepare(`
    SELECT content_id FROM revisions WHERE base_draft_id = ?
  `).all(target.id) as Array<{ content_id: number }>
  const reviewContents = db.prepare(`
    SELECT content_id FROM reviews WHERE base_draft_id = ?
  `).all(target.id) as Array<{ content_id: number }>
  for (const row of [...revisionContents, ...reviewContents]) contentIds.add(row.content_id)

  for (const runId of postProcessRunIds) {
    db.prepare('DELETE FROM post_process_runs WHERE id = ?').run(runId)
  }
  db.prepare('DELETE FROM drafts WHERE id = ?').run(target.id)
  for (const contentId of contentIds) {
    try {
      db.prepare('DELETE FROM contents WHERE id = ?').run(contentId)
    } catch {
      // A content row shared by another still-live fact is not a deletion
      // target. Foreign keys preserve it without weakening this commit.
    }
  }
}

/**
 * 「退回草稿」（2026-10-23）：撤销定稿，但**保留正文与草稿行**。
 *
 * 为什么必须有这条路：每章通常只有一条草稿 v1，它就是定稿。此前作者想改本章正文，
 * 唯一入口是「删除定稿」—— 而那条路会把这条草稿与正文一起删掉，正文彻底消失
 * （2026-10-23 实机：第 2、3 章被删后草稿箱直接空掉，只能靠备份恢复）。
 *
 * 定稿事实消失 ⇒ **依赖它的派生必须一并失效**，这条不能省：
 * - 定稿收据 `finalization_outbox`（删）
 * - 该章后处理跑批 `post_process_runs`（删；要点/角色状态等随之失效）
 * - `summary_snapshots`（删：章节要点与角色状态来自定稿正文）
 * - `resource_movements`（删：账本变动来自定稿正文，留着会与「未定稿」矛盾）
 * - 连续性投影自该章起失效（`invalidateContinuityProjectionFrom`）
 *
 * 正文实体稿与知识库文档由 service 的投影清理统一处理（与删除同一条路）。
 */
function revertChapterFacts(
  db: ReturnType<typeof requireDatabase>,
  target: FinalizedChapterTarget,
  postProcessRunIds: readonly string[],
): void {
  invalidateContinuityProjectionFrom(db, target.chapter_number)
  for (const runId of postProcessRunIds) {
    db.prepare('DELETE FROM post_process_runs WHERE id = ?').run(runId)
  }
  db.prepare('DELETE FROM summary_snapshots WHERE draft_id = ?').run(target.id)
  db.prepare('DELETE FROM resource_movements WHERE chapter_number = ?').run(target.chapter_number)
  db.prepare('DELETE FROM finalization_outbox WHERE draft_id = ?').run(target.id)
  // 状态回到「已修订待定稿」：正文还在，作者可以继续改，改完重新定稿会重建收据。
  db.prepare("UPDATE drafts SET status = 'revised', updated_at = datetime('now') WHERE id = ?").run(target.id)
}

function rowToOperation(row: ChapterDeletionRow): ChapterDeletionOperation {
  const postProcessRunIds = parsePostProcessRunIds(row.post_process_run_ids) ?? []
  return {
    operationId: row.operation_id,
    draftId: row.draft_id,
    chapterNumber: row.chapter_number,
    chapterTitle: row.chapter_title,
    finalizationId: row.finalization_id,
    targetFileName: row.target_file_name,
    knowledgeDocumentId: row.knowledge_document_id,
    postProcessRunIds,
    manuscriptStatus: row.manuscript_status,
    manuscriptError: row.manuscript_error,
    knowledgeStatus: row.knowledge_status,
    knowledgeError: row.knowledge_error,
    legacyKnowledgeAuthorization: row.legacy_knowledge_authorization,
    legacyKnowledgeAuthorizedAt: row.legacy_knowledge_authorized_at,
    status: row.status,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

function getRow(operationId: string): ChapterDeletionRow | undefined {
  return requireDatabase().prepare(`
    SELECT * FROM chapter_deletion_operations WHERE operation_id = ?
  `).get(operationId) as ChapterDeletionRow | undefined
}

function refreshAggregateStatus(operationId: string): void {
  const db = requireDatabase()
  const row = getRow(operationId)
  if (!row) throw new Error(`章节删除操作不存在：${operationId}`)
  const finished = (status: ChapterDeletionProjectionStatus) => (
    status === 'completed' || status === 'not_required'
  )
  const status: ChapterDeletionOperation['status'] = (
    finished(row.manuscript_status) && finished(row.knowledge_status)
  ) ? 'completed' : (
    row.manuscript_status === 'failed' || row.knowledge_status === 'failed'
  ) ? 'failed' : 'pending'
  db.prepare(`
    UPDATE chapter_deletion_operations
    SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE '' END,
        updated_at = datetime('now')
    WHERE operation_id = ?
  `).run(status, status, operationId)
}

export class ChapterDeletionRepository {
  static begin(input: {
    operationId: string
    draftId: number
    chapterNumber: number
    legacyKnowledgeAuthorizationRequired?: boolean
    /** true = 退回草稿（保留正文与草稿行），false/缺省 = 删除章节事实。 */
    keepDraft?: boolean
  }): ChapterDeletionOperation {
    const db = requireDatabase()
    const transaction = db.transaction(() => {
      const existing = db.prepare(`
        SELECT * FROM chapter_deletion_operations WHERE draft_id = ?
      `).get(input.draftId) as ChapterDeletionRow | undefined
      if (existing) {
        if (existing.chapter_number !== input.chapterNumber) {
          throw new Error('章节删除请求与已冻结操作不匹配')
        }
        return existing.operation_id
      }

      const target = requireFinalizedTarget(db, input.draftId, input.chapterNumber)
      // 删除正文不可逆，仍只允许从链尾开始；退回草稿保留正文，允许任意章（ADR-0023）。
      if (!input.keepDraft) requireFinalizedChainTail(db, target.chapter_number)
      const postProcessRunIds = listPostProcessRunIds(db, input.chapterNumber, target.finalization_id)

      db.prepare(`
        INSERT INTO chapter_deletion_operations (
          operation_id, draft_id, chapter_number, chapter_title, finalization_id,
          target_file_name, knowledge_document_id, post_process_run_ids,
          manuscript_status, knowledge_status, legacy_knowledge_authorization, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.operationId,
        target.id,
        target.chapter_number,
        target.chapter_title ?? '',
        target.finalization_id,
        target.target_file_name ?? '',
        target.knowledge_document_id ?? '',
        JSON.stringify(postProcessRunIds),
        target.target_file_name ? 'pending' : 'not_required',
        input.legacyKnowledgeAuthorizationRequired || target.knowledge_document_id
          ? 'pending'
          : 'not_required',
        input.legacyKnowledgeAuthorizationRequired ? 'required' : 'not_required',
        input.legacyKnowledgeAuthorizationRequired ? 'authorization_required' : 'pending',
      )

      if (input.legacyKnowledgeAuthorizationRequired) return input.operationId
      if (input.keepDraft) revertChapterFacts(db, target, postProcessRunIds)
      else deleteChapterFacts(db, target, postProcessRunIds)
      return input.operationId
    })

    const operationId = transaction()
    const operation = ChapterDeletionRepository.get(operationId)
    if (!operation) throw new Error(`章节删除操作不存在：${operationId}`)
    return operation
  }

  static confirmLegacyKnowledgeAbsent(operationId: string): ChapterDeletionOperation {
    const db = requireDatabase()
    const transaction = db.transaction(() => {
      const row = db.prepare(`
        SELECT * FROM chapter_deletion_operations WHERE operation_id = ?
      `).get(operationId) as ChapterDeletionRow | undefined
      if (!row) throw new Error(`章节删除操作不存在：${operationId}`)
      if (
        row.status !== 'authorization_required'
        || row.legacy_knowledge_authorization !== 'required'
      ) {
        throw new Error('legacy 知识投影人工确认是一次性授权，当前删除收据不允许再次确认')
      }

      const target = requireFinalizedTarget(db, row.draft_id, row.chapter_number)
      if (
        target.finalization_id !== row.finalization_id
        || (target.chapter_title ?? '') !== row.chapter_title
        || (target.target_file_name ?? '') !== row.target_file_name
        || (target.knowledge_document_id ?? '') !== ''
      ) {
        throw new Error('章节事实或定稿收据在人工确认前已变化，已拒绝继续删除')
      }

      const frozenRunIds = parsePostProcessRunIds(row.post_process_run_ids)
      if (!frozenRunIds) throw new Error('删除收据中的后处理身份损坏，已拒绝继续删除')
      const currentRunIds = listPostProcessRunIds(db, row.chapter_number, row.finalization_id)
      if (JSON.stringify(currentRunIds) !== JSON.stringify(frozenRunIds)) {
        throw new Error('章节后处理记录在人工确认前已变化，已拒绝继续删除')
      }

      const updated = db.prepare(`
        UPDATE chapter_deletion_operations
        SET legacy_knowledge_authorization = 'consumed',
            legacy_knowledge_authorized_at = datetime('now'),
            knowledge_status = 'not_required', knowledge_error = '',
            status = 'pending', updated_at = datetime('now')
        WHERE operation_id = ?
          AND status = 'authorization_required'
          AND legacy_knowledge_authorization = 'required'
      `).run(operationId)
      if (updated.changes !== 1) {
        throw new Error('legacy 知识投影人工确认是一次性授权，当前删除收据不允许再次确认')
      }
      deleteChapterFacts(db, target, frozenRunIds)
      return operationId
    })

    const confirmedOperationId = transaction()
    const operation = ChapterDeletionRepository.get(confirmedOperationId)
    if (!operation) throw new Error(`章节删除操作不存在：${confirmedOperationId}`)
    return operation
  }

  /**
   * 该草稿的定稿事实是否**仍然站着**（可被删除/退回）。
   *
   * 用途：`completed` 的删除收据只有在这个值为 false 时才可信 —— 事实都推不动了，
   * 说明删除确实发生过。反过来，收据说"已完成"而事实仍完美站着，只可能是
   * 数据被备份恢复/回滚过（2026-10-23 实机：恢复第 2、3 章后旧的删除收据仍在，
   * 于是「退回草稿」直接返回成功、什么都没做，界面却报「已退回」）。
   */
  static factsStillActionable(draftId: number): boolean {
    const row = requireDatabase().prepare(`
      SELECT drafts.status AS status, finalization_outbox.finalization_id AS finalizationId
      FROM drafts
      LEFT JOIN finalization_outbox ON finalization_outbox.draft_id = drafts.id
      WHERE drafts.id = ?
    `).get(draftId) as { status: string; finalizationId: string | null } | undefined
    return !!row && row.status === 'finalized' && !!row.finalizationId
  }

  /** 作废一条陈旧收据（事实已回滚，收据不再描述现实）。`draft_id` 有 UNIQUE，删掉才能重新登记。 */
  static discard(operationId: string): void {
    requireDatabase().prepare('DELETE FROM chapter_deletion_operations WHERE operation_id = ?').run(operationId)
  }

  static get(operationId: string): ChapterDeletionOperation | null {
    const row = getRow(operationId)
    return row ? rowToOperation(row) : null
  }

  static getByDraftId(draftId: number): ChapterDeletionOperation | null {
    const row = requireDatabase().prepare(`
      SELECT * FROM chapter_deletion_operations WHERE draft_id = ?
    `).get(draftId) as ChapterDeletionRow | undefined
    return row ? rowToOperation(row) : null
  }

  static listIncomplete(): ChapterDeletionOperation[] {
    const rows = requireDatabase().prepare(`
      SELECT * FROM chapter_deletion_operations
      WHERE status != 'completed'
      ORDER BY created_at, operation_id
    `).all() as ChapterDeletionRow[]
    return rows.map(rowToOperation)
  }

  static startAttempt(operationId: string): ChapterDeletionOperation {
    const db = requireDatabase()
    const result = db.prepare(`
      UPDATE chapter_deletion_operations
      SET attempt_count = attempt_count + 1, status = 'pending', updated_at = datetime('now')
      WHERE operation_id = ? AND status != 'authorization_required'
    `).run(operationId)
    if (result.changes !== 1) throw new Error(`章节删除操作不存在：${operationId}`)
    return ChapterDeletionRepository.get(operationId)!
  }

  static markProjection(
    operationId: string,
    projection: 'manuscript' | 'knowledge',
    status: Exclude<ChapterDeletionProjectionStatus, 'pending'>,
    error = '',
  ): ChapterDeletionOperation {
    const db = requireDatabase()
    const statusColumn = projection === 'manuscript' ? 'manuscript_status' : 'knowledge_status'
    const errorColumn = projection === 'manuscript' ? 'manuscript_error' : 'knowledge_error'
    const result = db.prepare(`
      UPDATE chapter_deletion_operations
      SET ${statusColumn} = ?, ${errorColumn} = ?, updated_at = datetime('now')
      WHERE operation_id = ?
    `).run(status, error, operationId)
    if (result.changes !== 1) throw new Error(`章节删除操作不存在：${operationId}`)
    refreshAggregateStatus(operationId)
    return ChapterDeletionRepository.get(operationId)!
  }
}
