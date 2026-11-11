# 夜跑 11-11 · DB-1 D9 阶段 2：A1 逐章完成读数（纯函数，不接线）

你是豆包。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：60 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只新增/修改本卡点名的文件与该新函数的单测；不碰 `develop` / `wt-2` / `wt-3`。
2. 只跑单测：`node node_modules/vitest/vitest.mjs run <单文件>`；禁全量 / `test:browser` / `test:node` / `pnpm dev`；允许 `pnpm typecheck`。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
D9 阶段 1 已落地（`5e031021`）：单次调用 10 分钟上限 + `GENERATION_CALL_TIMEOUT` + 界面两档。**阶段 2 要做的是「A1 逐章完成读数」**：把「这一批哪些章真的完成了」变成一个可测的纯函数，为后续「超时后按章续跑」提供判定基础。本卡**只写纯函数与单测，不接线任何调用方**。

## 任务
1. 先读（只读）：`docs/plans/prompt-assembly-backlog.md` 里 D9 那一段（约 `:132`）、`src/services/batch-interrupt-resume.ts`（甲方案：`readBatchStartChapter` / `firstChapterWithoutDraft`）、`electron/services/generation-run-service.ts`（阶段 1 的超时落点），把「完成」在数据上能怎么判据出来写清（候选：`generation_runs.status === 'completed'` + `next_chapter_number` / `covered_to` / 章节草稿存在性）。
2. 新增一个纯函数（建议 `src/shared/batch-completion.ts`，函数名自拟但要说明语义），输入为最小必要数据（如 runs 列表 + 每个 run 的 `status`/`nextChapterNumber`/`coveredTo`/`completedChapters`），输出 `{ completedChapters: number[], lastCompletedChapter: number | null, reason: 'empty' | 'no-completed-run' | 'ok' }` 这类显式三态结构。
3. 单测覆盖至少：空输入、单卷单批、多单元/多批、`covered_to` 回退（后一批覆盖区间比前一批小）、批次中断（最后一章废稿）四种情形；断言具体的章号集合，不要只断言「非空」。
4. **不接线**：不得修改任何生产调用点；在函数头注释里写明「零调用方（阶段 2 只交付判定能力）」。
5. 跑新增单测 + `pnpm typecheck`。
6. 报告里写清「这个函数如何被阶段 3 用」的一段话（不超过 5 行），供后续接线时判断语义是否够用。

## 验收
- 新函数 + 单测全绿（贴通过数）；typecheck 0；`git status` 只多出这两个文件。
- 报告里明写「零调用方」。

## 交付
四段报告 + `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
