# 夜跑 11-11 · P-DB 就绪探针（豆包）

你是豆包。本卡由 Lead 通过外部看板派发，用于验证「External 认领 → 写报告 → 交回 review」链路可用。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，基线 `5e031021`）
- 看板 CLI（绝对路径）：
  `node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 你的卡 ID：认领时 CLI 输出；报告写到
  `C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：10 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只写自己 worktree 的报告文件；不碰 `develop` / `wt-2` / `wt-3`；不改源码。
2. 只跑单测命令；禁 `pnpm dev`、`pnpm test` 全量、`pnpm test:browser`、`pnpm test:node`。
3. 禁一切 git 写操作（commit / push / merge / reset / checkout / stash）。
4. 禁 `done`；禁自建 SUMMARY / VERIFICATION 类自证文件；只产出报告。
5. 遇到确认框、提权弹窗 → 立刻停止，报告写 `BLOCKED` 并附原文。

## 任务
1. `git -C C:\develop\workspace\AI-writer\wt-1 log --oneline -1` 与 `git status --short`。
2. 跑一条快单测：`node node_modules/vitest/vitest.mjs run src/shared/__tests__/generation-call-timeout.test.ts`（cwd = wt-1），记录通过数与退出码。
3. 只读确认 `C:\develop\workspace\AI-writer\develop\AGENTS.md` 存在（可用 `Get-Content -TotalCount 3` 或等价方式证明读到）。

## 验收
- 四段报告齐全（改动清单写「无源码改动」），末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
