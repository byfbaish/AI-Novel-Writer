# W4 · D9 挂点取证（只取证，不改码）

你是 WorkBuddy（外部实现 agent），**夜间无人值守批次**。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`；通道：`docs/agents/workbuddy-channel.md`。
- 时间盒 ≤ 15 分钟；不要提问；不写代码。

## 0. 开工先复述三条红线（三行；不写视为没读）
1. 只读/只改 `wt-2`，不碰 develop / wt-1 / wt-3（本任务**只读**）；
2. 只跑单测与 `pnpm typecheck`；禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`、任何起应用进程/切 ABI 的命令；
3. 不 commit / push / merge / 切分支 / git reset / 不改全局配置与基线文件。

## 1. 背景（D9 单次调用超时）
D9 的修法要选一个「挂点」（watchdog 挂在什么边界上）。候选三选一：
- **候选 1**：单次模型调用边界（每次 LLM 调用包一层超时）；
- **候选 2**：生成命令层（`generate-*`/`finalize-*` 命令级超时）；
- **候选 3**：owner 层（run/lease 持有者级超时）。

已知事实（请复核，不要照抄）：`createSingleCallWatchdog` / `finalizeFailedGeneration` 目前**生产调用点为零**。

参考：`C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-07-d9-d16-structural-design-handoff.md`（D9 部分）。

## 2. 任务
1. 用 `grep`/Select-String 在 `src/` 下取证：
   - `createSingleCallWatchdog`、`finalizeFailedGeneration`、`*Watchdog*`、`abortController`、`AbortSignal.timeout`、`executionLease` 的**定义点与调用点**（文件:行号，调用点为零也要明确写 0）；
   - 现有超时机制散落在哪些文件（列举，含行号）；
2. 对三个候选挂点各写：需要改的调用链（文件:行号）、新增/修改的接口、能覆盖哪些失败形态（模型卡死 / 命令卡死 / owner 卡死）、**不能**覆盖哪些、单测落点；
3. 给出**推荐挂点**与理由，并列出「若按此挂点实施」的最小改动文件清单（不要改）；
4. 明确指出：是否有任何一处已存在的超时机制可以直接复用（能复用就别新增）。

## 3. 交付
报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W4-d9-hook-points.md`
① 结论一段话（推荐哪个挂点、最小改动几个文件）；② 现状证据表（符号/定义位置/调用点）；③ 三候选对比表（覆盖面/改动量/风险/单测）；④ 实施清单（文件:行号级，不改码）。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
