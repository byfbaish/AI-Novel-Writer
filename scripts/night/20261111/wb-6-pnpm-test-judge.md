# 夜跑 11-11 · WB-6 pnpm test 全量判读

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。**判读卡**：全量测试由 Lead 在主区跑并落盘。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 产物目录：`C:\develop\workspace\AI-writer\wt-2\.runtime\judge\M3\`（Lead 放：`pnpm-test-after.txt`、`pnpm-test-baseline.txt`、`README.md`）
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：45 分钟；产物缺失 → `BLOCKED`。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读，零代码改动；不要自己再跑全量（会切 ABI / 打断 dev）。
2. 不跑任何测试/构建。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 任务
1. 解析两份输出，给出：总文件数/总数、通过、失败、跳过；两次运行的差异。
2. 做**失败集合 diff**：新增红（baseline 没有、after 有）、消失红（baseline 有、after 没有）、两边都红。逐条给「文件:用例名」。
3. 对每条新增/持续失败，从输出里摘出错误首行（`AssertionError` / `Error:` 原文），并标注它属于：`已知存量` / `本次改动引入` / `环境性（如超时）` —— 判断依据写出来。
4. 单独确认：`generation-run-service.execution_owner` 或 D9 相关失败是否出现在 after 里（本次夜班 WB-1 想修的就是这类）。
5. 给一行结论：`无新增红` / `有新增红 N 条`。

## 验收
- 表格：用例 | baseline | after | 归类 | 证据首行。
- 结论明确可执行（若「有新增红」，列出必须 revert 的提交范围或最小排查方向）。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
