# 夜跑 11-11 · WB-16 D9 阶段 2 接线点「静态可行性复核」（只读）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：**以你 claim 到的那张为准**，报告写到 `wt-2\.dsh-task-board\reports\c1b9e689-5958-4a9f-a9d5-4bc48ee5dcd2.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」，再动手）
1. **纯只读 + 只写报告**：不改产品代码、不改测试、不改任何 `docs/` 文件。
2. 只准跑**单个测试文件**（`node node_modules/vitest/vitest.mjs run <单文件>`）；禁 `pnpm test` 全量 / `test:browser` / `test:node` / `pnpm dev`。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件。

## 背景
今晚豆包交了 DB-1：新增 `src/shared/batch-completion.ts`（逐章完成读数纯函数）+ 单测，**未接线**。WB-8 交叉复核给了三条保留意见，其中两条会在「真正接线时」变成事故：
- ① 「零调用方」无法被独立复验；
- ② `coveredTo` 只补最后完成边界这条核心声明，它的用例覆盖不足；
- ③ 报告把 `batch-interrupt-resume.ts` 里那份「批次终止终态」当成了「完成口径」，而产品里 `TERMINAL_RUN_STATUSES` 是**另一个集合**。

本卡**不接线**，只做接线前的静态可行性判定。

## 任务（T1）
1. 读 `wt-2\src\shared\batch-completion.ts` 与其单测 `wt-2\src\shared\__tests__\batch-completion.test.ts`，列出**导出符号与调用契约**（参数形状、返回值语义）。
2. 在 `wt-2` 全树（`src/`、`electron/`）搜所有**候选接线点**：谁在算「逐章完成 / covered_to / 批量续跑起点」。逐个给 `文件:行号` 与它现在用的状态集。
3. **核心矛盾核对**：把 `TERMINAL_RUN_STATUSES`、`batch-interrupt-resume.ts` 里的终止态集合、以及 `batch-completion.ts` 判定"完成"用的集合**三份并列**，明确写出：哪两份相同、哪一份不同、不同会导致什么行为差异（举一个具体场景）。
4. 判可行性：以现有导出形状，**能不能**在候选接线点直接替换？若不能，缺什么参数（例如需要 `draftChapterNumbers` 或 `rootRunStatuses`）。
5. 给「接线最小改动草图」：只写**文件:行号 + 要传什么参数**，**不写代码**。

## 验收
- 三份状态集必须逐元素列出（不许写"等"）。
- 每个候选接线点都必须给 `文件:行号`（来自 `Select-String`）。
- 「能不能直接替换」给明确结论（能 / 不能 + 缺什么）。
- 贴至少 4 条 `Select-String` 原样输出。

## 交付
四段报告：结论 / 改动清单（写「无」）/ 原始输出 / 未做项（明确写明「本卡未接线、未改任何代码」）。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag c1b9e689-5958-4a9f-a9d5-4bc48ee5dcd2 --add review --remove external --release --agent workbuddy:worker`

