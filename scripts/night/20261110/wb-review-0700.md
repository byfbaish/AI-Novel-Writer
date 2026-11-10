# 夜跑 07:00 · 独立技术复核（WorkBuddy 干净会话）

你是 WorkBuddy 复核 agent。本任务在**新建的干净会话**里执行（由 Lead 用 `--new` 投递），**只读复核，不改任何文件、不派活、不执行夜间任务**。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`。
- 夜间无人值守：不要提问；时间盒 ≤ 20 分钟；做不完写 BLOCKED 并交代已完成部分。

## 0. 开工先复述五条红线（五行；不写视为没读）
1. 只读 `wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测 `pnpm test <具体测试文件路径>` 与 `pnpm typecheck`；禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`、任何起应用进程/切 ABI 的命令；
3. 不 commit / push / merge / 切分支 / git reset / 不改任何文件；
4. 不建 SUMMARY / VERIFICATION / FINAL / DONE 之类自证文件，只产出一份报告；
5. 报告里所有结论必须有证据（文件:行号 + 原文），不许只给判断。

## 1. 复核对象
A. 夜间报告（wt-2）：`.batch\night\` 下 `W1-browser-red-a.md`、`W2-browser-red-b.md`、`W3-browser-drift-patch.md`（+ `w3-drift.patch`）、`W4-d9-hook-points.md`、`W5-incomplete-chapter-discard-draft.md`、`W6-selfcheck.md`；缺失的写「缺」。
B. 夜间报告（wt-1，豆包）：`C:\develop\workspace\AI-writer\wt-1\.batch\night\` 下 `D1`–`D5` 报告；缺失的写「缺」。
C. 本轮计划与授权：`C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-10-night-shift-plan.md`；上一轮交接稿：`...\docs\handoffs\2026-11-10-night-closeout-and-next-steps-handoff.md`。
D. 工作区实况：`git -C C:\develop\workspace\AI-writer\wt-2 status --porcelain`、`git diff --stat`、`git stash list`、`git log --oneline -5`。

## 2. 六件判定（逐件给证据）
1. **改动是否真在 diff**：每份报告声称的改动，对照 `git diff` 核实；虚报直接写「不可信」；
2. **独立验证**：对 W3 的 patch，自己跑 `pnpm typecheck` + 至少一个相关单测（一次一个文件），贴真实输出；W3 是否**只改了 `*.browser.tsx`**、有没有偷改产品代码；
3. **判定**：对每份报告给 `PASS | REWORK | BLOCKED`，并写一句理由；
4. **可合并性**：逐份评估（schema / 主进程 / IPC / prompt / 数据丢失风险）；
5. **证据可信度**：报告里的行号是否还对得上（行号漂移要指出）；有没有「声称跑了但无法复现」；
6. **越界检查**：有没有改到 `develop/`、`wt-1/`、`wt-3/`、全局配置、`doc-placement-baseline.json`；有没有自证文件；有没有 git 写操作痕迹（`git log`/reflog 看 HEAD 是否被动过）。

额外两条：
7. 本轮授权是「可改码 + 可提交（不含推送）」，复核有没有**未授权的仓库文档改动**（设计稿/台账/交接稿被改却没登记）；
8. 本夜 A1/A2 实机被作者明确顺延（中控不执行）——只记录「未执行」，不算缺陷。

## 3. 交付
报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\REVIEW-0700.md`
- 头行写：模型（界面读到的）、会话是否新建、复核时间；
- 正文结构：一段话总结论 → 证据（文件:行号 + 原文）→ 逐任务判定 → 越界检查 → 最后一张表「任务 / 判定 / 关键证据 / 合并建议」；
- 末尾必须写 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
