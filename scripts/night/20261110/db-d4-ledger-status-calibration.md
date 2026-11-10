# D4 · C 层状态行校准草案（只写现值，不改历史格）

你是 豆包（外部协作 agent），**夜间无人值守批次**。
- 工作目录：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，已同步主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`；文档放置与状态行规则见 `docs\agents\documentation-charter.md` §5.1–5.3、§6。
- 不要提问，时间盒 ≤ 18 分钟；做不完写 BLOCKED。

## 0. 开工先复述红线（三行；不写视为没读）
1. 只读 `develop` 与 `wt-1`，只写自己的报告；**不改台账/设计稿/缺陷稿/任何仓库文档**、不提交 git；
2. 禁起应用、禁跑全量测试、禁 `pnpm dev`、禁 git 写；
3. 没读到不要编；找不到写「本次读取的文件内未找到」。

## 1. 背景
C 层（已有结论只差收口）的状态行没回填。流程第 4 步（2026-11-09 作者定）：卡结项 ≠ 产品裁定已定，Lead 必须把台账/设计稿/缺陷稿的**状态行**回填为现值；只写现值，不改历史格。

## 2. 已知事实（请核实后引用，不要照抄）
- D4 / D5 / D20：修复已落地，**待实机**；
- D13：**未实机**；
- D18：六个函数**已接线、只报不拦**（卡在 C1 重跑权限未开放）；
- 上一轮交接稿：`C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-10-night-closeout-and-next-steps-handoff.md` C 层段。

## 3. 任务
1. 找到真源（用 `Select-String` 在 `develop\docs` 下搜 `D13` / `D18` / `D20` / `defects` / `缺陷`，定位台账文件与设计稿；候选：`develop\docs\design\product\live-pipeline-acceptance-defects-assessment.md`、`develop\docs\plans\prompt-assembly-backlog.md`）；
2. 对 D4 / D5 / D13 / D18 / D20 各出一行：
   - 真源位置（文件:行号）+ **当前状态行原文**；
   - 建议现值（一句话，含「已实施（未实机）」这类合规措辞）；
   - 依据（修复提交/设计稿段落/交接稿原文）；
   - 是否需作者裁定（是/否 + 一句话）。
3. 如发现真源里根本没有这五项中的某一项 → 写「未找到条目，需补登记」，不要臆造。

## 4. 交付
报告：`C:\develop\workspace\AI-writer\wt-1\.batch\night\D4-ledger-status-calibration.md`
① 结论一段话 ② 五项校准表 ③ 证据（文件:行号 + 原文）④ 需 Lead 动手的回填清单（只列位置与建议文本，**不要自己改**）。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
