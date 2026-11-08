/**
 * 甲方案（界面止血）的两处判定 —— 见 `docs/design/features/batch-interrupt-resume-design.md` §6 / §7。
 *
 * 这里只把渲染层**已经拿得到**的数据折算成界面决策：不新增 IPC 字段、不读运行记录、
 * 不改 run 状态机、不改 `generation_batches` / `aborted` 的语义。两个判定单独导出以便单测。
 */
import type { GenerationBatchHistory } from '../shared/generation-owner-contract'
import type { MainGenerationRunView } from './generation/generation-runtime'
import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { WritingLanguage } from '../shared/writing-language'
import { ipc } from './ipc-client'
import { readAuthoritativeNextChapter } from './authoritative-chapter-sequence'

/**
 * 从「权威下一章」起连续顺延，返回第一张没有草稿的章。
 * 只按占用集合逐章走，不用 max(chapter)+1 —— 中间的空章必须停住，不能跳过还没写的章。
 * `authoritativeNextChapter` 由上游 `readAuthoritativeNextChapter` 保证为 ≥1 的安全整数
 * （`authoritative-chapter-sequence.ts:45-51`），这里不重复校验。
 */
export function firstChapterWithoutDraft(
  authoritativeNextChapter: number,
  draftChapterNumbers: readonly number[],
): number {
  const occupied = new Set(draftChapterNumbers.filter(
    chapter => Number.isSafeInteger(chapter) && chapter >= authoritativeNextChapter,
  ))
  let start = authoritativeNextChapter
  while (occupied.has(start)) start += 1
  return start
}

/**
 * root run 落到这三个终态即「这一批已终止」：`paused` 仍属可续。
 * `completed` 不算终止：正常完成批次的 `nextChapterNumber` 为 null，不会出现在候选里；
 * 若出现 completed 且 nextChapterNumber 非 null 的异常组合，按未终止处理（见报告 §5）。
 */
const TERMINATED_ROOT_RUN_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled', 'aborted'])

export interface BatchRecoveryGate {
  /** 已终止：按钮禁用 + 出路文案 */
  terminated: boolean
  /** 来源已变化：沿用原有提示，不与 `terminated` 互相覆盖 */
  sourceChanged: boolean
  canContinue: boolean
  /** 终止时的出路；`null` 表示不需要出路文案 */
  wayOut: { noticeKey: 'batch-terminated-reopen'; chapterNumber: number | null } | null
}

/**
 * `batch` 来自 `generation:list-batches`（`GenerationBatchHistory`，本身没有 status）；
 * `rootRunStatus` 来自同一次 effect 的 `generation:list`（`MainGenerationRunView.status`），
 * 按 `batch.rootHandle.runId` 对齐。取不到状态时不擅自阻断，保持改动前的行为。
 */
export function evaluateBatchRecoveryGate(input: {
  batch: GenerationBatchHistory
  rootRunStatus: MainGenerationRunView['status'] | undefined
}): BatchRecoveryGate {
  const terminated = input.rootRunStatus !== undefined
    && TERMINATED_ROOT_RUN_STATUSES.has(input.rootRunStatus)
  const sourceChanged = !input.batch.sourceCurrent
  return {
    terminated,
    sourceChanged,
    canContinue: !terminated && !sourceChanged,
    wayOut: terminated
      ? { noticeKey: 'batch-terminated-reopen', chapterNumber: input.batch.nextChapterNumber }
      : null,
  }
}

/**
 * 界面取数据的薄封装：权威下一章（`db:draft-authority-sequence`）+ 已有草稿章号
 * （`db:draft-list-all`，既有只读 channel）→ 第一张没有草稿的章。
 * 面板显示与真正启动都走它，避免两处算出不同起点。
 */
export async function readBatchStartChapter(
  projectSession: ProjectSessionContext,
  locale: WritingLanguage,
): Promise<number> {
  const [authoritativeNext, drafts] = await Promise.all([
    readAuthoritativeNextChapter(projectSession, locale),
    ipc.invokeWithProjectSession(projectSession, 'db:draft-list-all', projectSession.projectPath),
  ])
  return firstChapterWithoutDraft(authoritativeNext, drafts.map(draft => draft.chapterNumber))
}
