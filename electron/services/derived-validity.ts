import type BetterSqlite3 from 'better-sqlite3'
import {
  derivedStatusForChapters,
  expandChapterRange,
  notApplicable,
  type DerivedSourceRef,
  type DerivedValidity,
  type ParsedChangedChapters,
  type UpstreamRefKey,
  type UpstreamRevisionSnapshot,
} from '../../src/shared/upstream-revisions'
import type { VolumeHandoffDefinition } from '../../src/shared/volume-handoff'
import { UpstreamRevisionRepository } from '../repositories/upstream-revision-repository'

/**
 * 读取侧判定（P2-2 期 2）：把「这一行基于哪一版上游」与「上游现在是哪一版」
 * 比一次，得到 `valid` / `stale` / `legacy` / `not-applicable`。
 *
 * ## 判定在主进程
 *
 * `upstream_revisions` 只有主进程能读。让渲染侧自己再拉一次版本表算，就有了第二份
 * 判定语义；IPC 边界是所有消费者必经之处（正文链、面板、agent 工具都走它）。
 *
 * ## 成本纪律（设计稿 §5.6）
 *
 * `get-all` 可能返回上千行。所以：
 * 1. **一个 handler 只建一次上下文** —— `snapshot()` + `changeLog()` 各一条
 *    `SELECT * FROM upstream_revisions`（行数 = 域数，≤5）；
 * 2. **禁止在逐行循环里调** `snapshot()` / `read()` / `readRev()`：每个都再探一次
 *    `sqlite_master`，N 行就是 N 次系统目录查询；
 * 3. 判定本身是纯内存 Map 比较（1000 章 × 4 键 ≈ 4000 次查表，无感）。
 */
export interface DerivedReadContext {
  readonly revisions: UpstreamRevisionSnapshot
  readonly changes: ReadonlyMap<UpstreamRefKey, ParsedChangedChapters>
}

const EMPTY_CONTEXT: DerivedReadContext = Object.freeze({
  revisions: new Map<UpstreamRefKey, number>(),
  changes: new Map<UpstreamRefKey, ParsedChangedChapters>(),
})

/**
 * 建一次上下文。版本表不存在（未升到 v24）⇒ 空上下文。
 *
 * 空上下文下所有派生都判 `legacy`（不是 `valid`）：`derivedStatusForChapters`
 * 对「没有来源记录」返回 `legacy`，对「有记录但版本表空」返回 `stale`。
 * 后者是**对的** —— 库被恢复成更早的备份时正是这个形状。
 */
export function readDerivedReadContext(
  db: BetterSqlite3.Database | null | undefined,
): DerivedReadContext {
  if (!db) return EMPTY_CONTEXT
  return {
    revisions: UpstreamRevisionRepository.snapshot(db),
    changes: UpstreamRevisionRepository.changeLog(db),
  }
}

/** 章节蓝图：只覆盖自己这一章（`[N]`）。 */
export function blueprintValidity(
  context: DerivedReadContext,
  sourceRef: DerivedSourceRef | null | undefined,
  chapterNumber: number,
): DerivedValidity {
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) {
    return notApplicable('章号不合法')
  }
  return derivedStatusForChapters(sourceRef, context.revisions, context.changes, [chapterNumber])
}

/**
 * 卷末交接单覆盖的章集合。
 *
 * **只有 `basis === 'actual'` 且首末章都是正整数时才展开**（设计稿 R4）。其余档位
 * （`declared` 估算 / `even` 均分 / `headings` 标题观测 / `null` 卷已删）的区间是
 * **推算出来的**，拿它去收窄等于用估算值决定「哪一章被改了」—— 估错就漏判。
 * 所以那几档一律返回 `[]`（= 覆盖全部章，保守方向）。
 */
export function volumeHandoffChapters(
  handoff: Pick<VolumeHandoffDefinition, 'boundaryBasis' | 'firstChapter' | 'lastChapter'>,
): number[] {
  if (handoff.boundaryBasis !== 'actual') return []
  const { firstChapter, lastChapter } = handoff
  if (firstChapter === null || lastChapter === null) return []
  return expandChapterRange({ from: firstChapter, to: lastChapter })
}

export function volumeHandoffValidity(
  context: DerivedReadContext,
  sourceRef: DerivedSourceRef | null | undefined,
  handoff: Pick<VolumeHandoffDefinition, 'boundaryBasis' | 'firstChapter' | 'lastChapter'>,
): DerivedValidity {
  return derivedStatusForChapters(
    sourceRef,
    context.revisions,
    context.changes,
    volumeHandoffChapters(handoff),
  )
}

/**
 * 剧情树：全书一份（`null`）。
 *
 * 与 `sourceRevision`（内容 sha256）**各管一段、不取严**（设计稿裁定 5）：
 * 那个 hash 管「这次的素材与生成时是不是同一批」，这里管「我基于的上游是哪一版」。
 */
export function plotTreeValidity(
  context: DerivedReadContext,
  sourceRef: DerivedSourceRef | null | undefined,
): DerivedValidity {
  return derivedStatusForChapters(sourceRef, context.revisions, context.changes, null)
}
