# D5 · 晨间 digest（夜跑收口材料）

你是 豆包（外部协作 agent）。**这是本夜最后一项派给豆包的任务**。
- 工作目录：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`）。
- 不要提问，时间盒 ≤ 20 分钟；做不完写 BLOCKED。

## 0. 开工先复述红线（三行；不写视为没读）
1. 只读、只写自己的报告；不改任何仓库文件、不提交 git；
2. 禁起应用、禁跑全量测试、禁 `pnpm dev`、禁 git 写；
3. 报告只写「读到的」；找不到写「缺」，不要凭印象补。

## 1. 输入（逐个读，缺的写「缺」）
WorkBuddy 侧（`C:\develop\workspace\AI-writer\wt-2\.batch\night\`）：
- `W1-browser-red-a.md`、`W2-browser-red-b.md`、`W3-browser-drift-patch.md`（及 `w3-drift.patch` 是否存在）、`W4-d9-hook-points.md`、`W5-incomplete-chapter-discard-draft.md`、`W6-selfcheck.md`

豆包侧（`C:\develop\workspace\AI-writer\wt-1\.batch\night\`）：
- `D1-a1-criteria-brief.md`、`D2-short-outline-acceptance.md`、`D3-browser-red-second-opinion.md`、`D4-ledger-status-calibration.md`

工作区实况（只读命令）：`git -C C:\develop\workspace\AI-writer\wt-2 status --porcelain`、`git -C ... diff --stat`、`git -C C:\develop\workspace\AI-writer\wt-1 status --porcelain`。

## 2. 产出结构（照 11-09 夜跑 digest 的形态）
1. **一页结论表**：任务 / 判定（PASS / REWORK / BLOCKED / 缺）/ 证据强度（强/中/弱）/ 合并建议（可合并 / 需改 / 不合并 / 仅材料）；
2. **关键发现**（3–6 条，每条一句结论 + 证据文件:行号）；
3. **交叉验证**：W1/W2 与 D3 的判读是否一致（一致/冲突/部分冲突），冲突点逐条列；
4. **未决与待作者拍板**（编号清单，每条一句话 + 推荐选项，如果材料里有推荐）；
5. **晨间收口建议**：哪些 patch 可以合并、合并顺序、合并前必须跑什么；哪些必须回炉。

## 3. 交付
报告：`C:\develop\workspace\AI-writer\wt-1\.batch\night\D5-morning-digest.md`
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
