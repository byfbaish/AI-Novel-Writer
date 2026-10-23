export type ChapterDeletionProjectionStatus = 'pending' | 'completed' | 'failed' | 'not_required'
export type ChapterDeletionStatus = 'authorization_required' | 'pending' | 'failed' | 'completed'
export type LegacyKnowledgeAuthorization = 'not_required' | 'required' | 'consumed'

export interface DeleteFinalizedChapterRequest {
  draftId: number
  chapterNumber: number
}

export interface ChapterDeletionOperation {
  operationId: string
  draftId: number
  chapterNumber: number
  chapterTitle: string
  finalizationId: string
  targetFileName: string
  knowledgeDocumentId: string
  postProcessRunIds: string[]
  manuscriptStatus: ChapterDeletionProjectionStatus
  manuscriptError: string
  knowledgeStatus: ChapterDeletionProjectionStatus
  knowledgeError: string
  legacyKnowledgeAuthorization: LegacyKnowledgeAuthorization
  legacyKnowledgeAuthorizedAt: string
  status: ChapterDeletionStatus
  attemptCount: number
  createdAt: string
  updatedAt: string
  completedAt: string
}

export interface ChapterDeletionResult {
  success: boolean
  committed: boolean
  operation?: ChapterDeletionOperation
  error?: string
  /** 机器可判的失败原因；界面据此出双语文案，不要靠匹配 `error` 字符串。 */
  errorCode?: 'FINALIZED_CHAIN_TAIL_REQUIRED'
  /** 与 `errorCode` 配套的结构化数据（例如要退的章与当前尾部章）。 */
  errorDetails?: { chapterNumber: number; latestFinalizedChapter: number }
}
