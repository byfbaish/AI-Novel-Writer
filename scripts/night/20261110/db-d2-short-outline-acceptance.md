# D2 · B5 短细纲验收草案（D12 遗留 3）

你是 豆包（外部协作 agent），**夜间无人值守批次**。
- 工作目录：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，已同步主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`。
- 不要提问，时间盒 ≤ 18 分钟；做不完写 BLOCKED。

## 0. 开工先复述红线（三行；不写视为没读）
1. 只读 `develop` 与 `wt-1`，只写自己的报告；不改仓库文档与代码、不提交 git；
2. 禁起应用、禁跑全量测试、禁 `pnpm dev`；
3. 没读到不要编，找不到写「本次读取的文件内未找到」，不确定标「不确定」。

## 1. 背景
短细纲已裁「另立项」，但**验收标准还没定**。D12 遗留第 3 项是：验「预算有没有产出」——已知实测有「字数 0 处」、判决句「掌握主动权」的现象。作者要的是一份**可执行验收草案**，不是实现。

## 2. 必读
1. `C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-10-night-closeout-and-next-steps-handoff.md` — B5 段；
2. `C:\develop\workspace\AI-writer\develop\docs\handoffs\2026-11-08-d12-closeout-small-model-weakness.md` — D12 遗留 3 的原始记录；
3. 用 `Select-String` 在 `develop\docs` 下搜「短细纲」/「预算有没有产出」/「掌握主动权」，把相关文件列全（只读）。

## 3. 产出
A. **现象取证**：「预算有没有产出」到底指什么（引用原文）；「字数 0 处」「判决句『掌握主动权』」分别出现在哪（文件:行号 + 原文）；
B. **验收草案**：
   - 度量点（预算条目→产出章节的映射怎么量、量什么字段）；
   - 阈值建议（给出数字，并说明为什么是这个数量级；没有依据就写「建议值，待作者定」）；
   - 判定线（什么情况判通过 / 判不通过 / 判不可测）；
   - 证据采集步骤（要跑什么、记录什么表/文件/截图）；
C. **反例与陷阱**：只看字数会漏什么、只看判决句会误判什么；
D. **待拍板点**（标「待裁定，不落库」）。

## 4. 交付
报告：`C:\develop\workspace\AI-writer\wt-1\.batch\night\D2-short-outline-acceptance.md`
① 结论一段话 ② 证据（文件:行号）③ 验收草案正文 ④ 未决点。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
