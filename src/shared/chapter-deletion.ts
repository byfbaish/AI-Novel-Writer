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
  /**
   * 这条收据是「退回草稿」(`true`) 还是「删除正文」(`false`)。
   *
   * 必须落库：同一个 `draft_id` 只允许一条收据，而两条入口的投影清理一模一样、
   * 只在 `begin` 里分岔（删草稿 / 保草稿）。没有这一列，`begin` 命中旧收据时只能比章号，
   * 「先删后退」会被删除收据接住 → 界面报「已退回」而 `revertChapterFacts` 一次没跑。
   * 存量行一律 `false`（历史语义不可考，见 M23 迁移注释）。
   */
  keepDraft: boolean
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
