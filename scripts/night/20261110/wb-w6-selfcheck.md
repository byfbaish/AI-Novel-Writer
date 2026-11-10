# W6 · 夜间收口自检（selfcheck）

你是 WorkBuddy（外部实现 agent），**夜间无人值守批次**。这是收口自检，**只读+只跑验证**，不许改任何文件。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线主线 HEAD `74ad3236`）。
- 时间盒 ≤ 18 分钟；不要提问。

## 0. 开工先复述三条红线（三行；不写视为没读）
1. 只读 `wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测（一次一个文件）与 `pnpm typecheck`；禁全量 `pnpm test`、`test:browser`、`test:node`、`pnpm dev`；
3. 不 commit / push / merge / 切分支 / git reset / 不改任何文件（本任务零写入，只写自己的报告）。

## 1. 任务
1. `git -C C:\develop\workspace\AI-writer\wt-2 status --porcelain` 与 `git -C ... diff --stat`（记录改动文件数与行数）；
2. 读本夜产出的全部报告：
   - `.batch\night\W1-browser-red-a.md`
   - `.batch\night\W2-browser-red-b.md`
   - `.batch\night\W3-browser-drift-patch.md`（+ 若存在 `.batch\night\w3-drift.patch`）
   - `.batch\night\W4-d9-hook-points.md`
   - `.batch\night\W5-incomplete-chapter-discard-draft.md`
3. 逐份核对：声称的改动是否真在 `git diff` 里；声称跑过的命令是否可复现；有没有越界文件（改到 `develop/`、`wt-1/`、`wt-3/`、全局配置、基线文件、或自建 SUMMARY/VERIFICATION/FINAL/DONE 之类自证文件）；
4. 复跑 W1–W5 触及的单测（**一次一个文件**）+ `pnpm typecheck`，贴真实输出；
5. 汇总表：「任务 / 声明状态 / 改动文件数 / 测试结果 / 证据是否自洽 / 可合并性」；
6. 显式结论：哪几份可信、哪几份**不可信**（虚报或证据不成立就直说）。

## 2. 交付
报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W6-selfcheck.md`
① 结论一段话；② 汇总表；③ 逐份核对明细（含不可信点）；④ 验证命令与原始输出。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
