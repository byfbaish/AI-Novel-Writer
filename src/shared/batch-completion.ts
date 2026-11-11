/**
 * D9 阶段 2：A1「逐章完成读数」纯函数。
 *
 * **零调用方（阶段 2 只交付判定能力）**：本文件不接线任何生产路径，只为后续
 * 「超时 / 中断后按章续跑」提供唯一的判定口径。
 *
 * 口径：
 * - 只有**终态 run**（completed / failed / cancelled / aborted）才可能贡献章节；`running` / `paused`
 *   仍在进行，不得提前计为完成。
 * - **失败 ≠ 整批作废**：正文批量一章一落稿，`failed` 只说明「跑到了失败分支」，此前落稿的章是真完成的，
 *   `completedChapters` 照收（需求稿 `batch-interrupt-resume-design` §7：「失败只废最后一章」）。
 *   `aborted`（进程死亡 / 租约过期，见 D2）同此处理 —— 死之前落了的章确实落了，抹掉会让重开一批撞
 *   「已有草稿不覆盖」。
 * - **取消 = 整批作废**：`cancelled` 是作者主动放弃这一批，其章节一律不计为完成（作者 2026-11-11 口径）。
 * - `completedChapters` 是调用方给出的、已经落盘到产物（草稿/正文）的章号；本函数不推断区间。
 * - **覆盖 ≠ 完成**：`coveredTo` 只在该 run 为 `completed` 时才补进集合。中断的 run 上 `coveredTo`
 *   记的是「尝试覆盖到」，拿它当完成会把废稿章算成写完了（需求稿 §11：批次不完整时
 *   `synopsis_covered_to = range.from - 1`，完成态章只留候选区）。
 * - `lastCompletedChapter` 取集合最大值，因此后一批「覆盖区间更小」不会把读数回退。
 * - 三态显式：`empty`（无 run）/ `no-completed-run`（有 run 但没有任何终态章节证据）/ `ok`。
 */
export interface BatchCompletionRun {
    /** 持久化 run 状态；本函数只认终态，其余按「未完成」处理。 */
    status: string;
    /** 该 run 已确认落盘的章号（缺省/null = 没有逐章证据）。 */
    completedChapters?: readonly number[] | null;
    /** 该 run 覆盖到的最后一章；只补边界，不推区间。 */
    coveredTo?: number | null;
}

export interface BatchCompletionResult {
    completedChapters: number[];
    lastCompletedChapter: number | null;
    reason: 'empty' | 'no-completed-run' | 'ok';
}

/**
 * 「章节证据可信」的终态：跑完 / 跑过但失败 / 进程死亡。
 * `cancelled` 故意不在其中 —— 主动取消意味着整批作废，这一批的章号一条都不算。
 */
const CHAPTER_EVIDENCE_STATUSES: ReadonlySet<string> = new Set(['completed', 'failed', 'aborted']);

/** 只有跑完的 run，`coveredTo` 才是「完成边界」；中断的 run 上它只是「覆盖到」。 */
const COVERED_TO_IS_COMPLETION_STATUS = 'completed';

function validChapter(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function readBatchChapterCompletion(input: { runs: readonly BatchCompletionRun[] }): BatchCompletionResult {
    if (input.runs.length === 0)
        return { completedChapters: [], lastCompletedChapter: null, reason: 'empty' };
    const chapters = new Set<number>();
    for (const run of input.runs) {
        if (!CHAPTER_EVIDENCE_STATUSES.has(run.status))
            continue;
        for (const chapter of run.completedChapters ?? [])
            if (validChapter(chapter)) chapters.add(chapter);
        if (run.status === COVERED_TO_IS_COMPLETION_STATUS && validChapter(run.coveredTo)) chapters.add(run.coveredTo);
    }
    const completedChapters = [...chapters].sort((left, right) => left - right);
    return {
        completedChapters,
        lastCompletedChapter: completedChapters.length ? completedChapters[completedChapters.length - 1] : null,
        reason: completedChapters.length ? 'ok' : 'no-completed-run',
    };
}
