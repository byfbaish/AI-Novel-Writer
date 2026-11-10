# D1 · A1 判据材料（供作者晨间拍板，不落库）

你是 豆包（外部协作 agent），**夜间无人值守批次**。
- 工作目录：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，已同步主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`。
- 不要提问，时间盒 ≤ 20 分钟；做不完写 BLOCKED 并交代已完成部分。

## 0. 开工先复述红线（三行；不写视为没读，Lead 会拒收）
1. 只读 `develop` 与 `wt-1` 的文件，只写自己的报告；不碰 `wt-2` / `wt-3`，不改仓库文档与代码，不提交 git；
2. 禁起应用、禁跑全量测试、禁 `pnpm dev`、禁任何 git 写命令；
3. 没读到的不要编：找不到就写「本次读取的文件内未找到」；不确定的标「不确定」。

## 1. 背景
正文批量重跑（A1）卡了两周，原判据在 9B 模型上可能永远不达标；作者要晨间拍板改判据还是换模型。**你只做材料，不许替作者决定，也不许把任何判据写进仓库**。

## 2. 必读（按顺序）
1. `C:\develop\workspace\AI-writer\develop\docs\design\product\2026-11-07-batch-acceptance-plan.md` — 重点 §3.2 的 A1 行（原判据：同 run 连续 3 章全成功 + `*_SOURCE_CHANGED` 0 次）；
2. `C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-10-night-closeout-and-next-steps-handoff.md` — A1 段（9B 复现率约 50%；拔护栏直连 10 次 = 干净 3 / 重演 5 / 失控 2；两条候选路径）；
3. `C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-08-d12-closeout-small-model-weakness.md`；
4. 若存在：`C:\develop\workspace\AI-writer\develop\docs\design\product\d12-retry-design-20261109.md`。

## 3. 产出（报告正文按此分节）
A. **原判据逐条拆解**：每一条判据怎么观测（DB 表/字段、日志、事件名，能指到文件:行号就指）；「中断→续跑」场景下它是否还可观测（提示：续跑会新开 run，那「同 run 连续 3 章」还成立吗？）。
B. **证据汇总**：9B 的失败形态分布、复现率、以及「模型固有弱点」的出处（引用原文）。
C. **候选判据 A：换更大模型** — 候选项、成本（时长/积分）、验收线、风险、能/不能解决什么。
D. **候选判据 B：3 章里 ≥2 章成功 + 失败章能靠续跑走完** — 精确定义（什么算「成功」、什么算「走完」）、可观测口径、验收线、风险（会不会把真失败放过去）。
E. **推荐 + 待作者拍板的点**（明确标「以下为候选，不落库，待作者裁定」）。
F. **A1′ 取证跑操作清单草案**（今晚不跑，明早作者在线时用）：要不要先记录断章草稿状态、判定是否拆成「①起点对不对 ②续跑是否真进入 running 并有模型调用」两段、证据四件套是什么。

## 4. 交付
报告：`C:\develop\workspace\AI-writer\wt-1\.batch\night\D1-a1-criteria-brief.md`（目录不存在就建）。
四段：① 一段话结论 ② 证据（文件:行号 + 原文）③ 正文材料（A–F）④ 未决点/待拍板清单。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
