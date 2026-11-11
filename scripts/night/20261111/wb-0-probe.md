# 夜跑 11-11 · P-WB 就绪探针（WorkBuddy）

你是 WorkBuddy。本卡由 Lead 通过外部看板派发，用于验证「External 认领 → 写报告 → 交回 review」整条链路可用。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI（绝对路径，所有命令都从这里调）：
  `node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 你的卡 ID：认领时 CLI 会输出；本卡报告写到
  `C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：10 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只写自己 worktree 的报告文件，不碰 `develop` / `wt-1` / `wt-3`，不改任何源码。
2. 只跑单测命令；禁 `pnpm dev`、`pnpm test` 全量、`pnpm test:browser`、`pnpm test:node`。
3. 禁一切 git 写操作（commit / push / merge / reset / checkout / stash）。
4. 禁 `done`；禁自建 SUMMARY / VERIFICATION / FINAL 之类自证文件。只产出报告这一个文件。
5. 遇到任何确认框、提权弹窗、权限提示 → 立刻停止，报告写 `BLOCKED` 并附弹窗原文。

## 任务
1. `git -C C:\develop\workspace\AI-writer\wt-2 log --oneline -1` 与 `git status --short`，确认分支与脏文件。
2. 跑 `node node_modules/vitest/vitest.mjs run electron/services/__tests__/generation-run-service.test.ts`（cwd 用 wt-2），记录通过/失败数与退出码。
3. 跑 `pnpm typecheck`，记录退出码与最后 5 行输出。
4. 只读确认：`Test-Path C:\develop\workspace\AI-writer\develop\AGENTS.md`（应 True），`Test-Path C:\develop\workspace\AI-writer\develop\.runtime\night`（应 True）。

## 验收
- 报告四段齐全：改动清单（应写「无源码改动」）、执行记录（每条命令 + 退出码）、原始输出（贴真实片段，不要概括）、未做项。
- 结尾一行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
