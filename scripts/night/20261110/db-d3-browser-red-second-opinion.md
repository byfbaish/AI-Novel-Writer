# D3 · browser 存量红独立交叉判读（第二意见）

你是 豆包（外部协作 agent），**夜间无人值守批次**。
- 工作目录：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，已同步主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`。
- 不要提问，时间盒 ≤ 20 分钟；做不完写 BLOCKED。

## 0. 开工先复述红线（三行；不写视为没读）
1. 只读 `develop` 与 `wt-1`，只写自己的报告；不改任何代码/文档、不提交 git；
2. 禁起应用、禁跑全量测试、禁 `pnpm dev`、禁 git 写；
3. 没读到不要编；找不到写「本次读取的文件内未找到」，不确定标「不确定」。

## 1. 任务：给 30 例存量红一份**独立**第二意见
输入（唯一证据源）：
`C:\develop\workspace\AI-writer\develop\.runtime\night\browser-20261110.log`
（主区全量 browser 套件输出：30 failed / 808 passed / 838，全部存量债，非本夜引入）

**独立性要求**：不要读 `C:\develop\workspace\AI-writer\wt-2\.batch\night\W1-browser-red-a.md` / `W2-browser-red-b.md`（那是另一个 agent 的判读，读完就不独立了）。只读日志 + `develop` 源码 + 测试源码。

## 2. 产出（逐例）
1. 测试文件:行号 + 测试名；
2. 失败断言原文 + expected/actual 原样摘；
3. 到 `develop\src` 里找该断言对应的产品现实现（文件:行号 + 片段）；找不到写「本次读取的文件内未找到」；
4. 判读 ∈ {`漂移`（测试期望过期）|`真缺陷`（产品行为错）|`需实机确认`}；
5. 依据一句话；
6. 若判漂移，给「测试该怎么改」的一行建议（不要真的改）。

## 3. 交付
报告：`C:\develop\workspace\AI-writer\wt-1\.batch\night\D3-browser-red-second-opinion.md`
① 结论一段话（分布统计 + 与「30 例全是漂移」这一常见假设是否一致）；② 逐例判读表；③ 需要人看/实机确认的清单。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
