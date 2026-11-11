# 夜跑 11-11 · WB-7 browser 全量（唯一允许跑 browser 套件的卡）

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。**本卡经作者明确授权，可以在 wt-2 跑 browser 全量**（其他卡一律禁止）。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：45 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读 + 只跑测试；零代码改动。
2. 只允许这一条命令跑套件：`node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts`（cwd = wt-2）。禁 `pnpm dev`、`pnpm test`、`pnpm test:node`、禁改 `vitest.*.config.ts`。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。
6. 输出先落文件再读（`... 2>&1 | Tee-Object -FilePath .runtime\browser-run.txt`），不要用 `| Select-Object -First` 截断管道。

## 背景数字
- 11-10 全量基线：`30 failed / 808 passed / 838`。
- R2 修复已合入基线（`9c3c913c` / `7a800313`），本树**不含** C1 那两处未提交的测试改动。
- 预期：只剩少量红（B11 `RendererStartup.browser.tsx:137`、B16 `CodeMirrorEditor-generation.browser.tsx:281` 两条为已知；若还多出 `ReviewReport.confirmation` / `f05-writer-immersion` 相关条目，是 C1 改动不在本树所致，**照实记录、不要改测试**）。

## 任务
1. 先 `git -C C:\develop\workspace\AI-writer\wt-2 status --short` 记录脏状态（应为空 + `?? .batch/`）。
2. 跑上面的 browser 全量命令，落盘。
3. 报告：总文件/总用例、passed/failed、**完整 `FAIL ` 行清单**（文件 + 用例名）、以及每条失败的错误首行。
4. 与基线 30 条做集合 diff：消失 N 条（列名）、新增 M 条（列名）。若出现 `pnpm`/`No test files found` 之类环境失败，单独标注。
5. 给一行结论：`达到预期（≤2 条已知红）` / `未达预期（列出多出的条目）`。

## 验收
- 失败清单完整（不要只贴计数），每条能对应到 `文件:行`。
- 不修改任何测试文件（本卡零改动）。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
