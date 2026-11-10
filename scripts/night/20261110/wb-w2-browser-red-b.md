# W2 · browser 存量红分类判读（B 组）

你是 WorkBuddy（外部实现 agent），本轮为**夜间无人值守批次**。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，已重置到主线 HEAD `74ad3236`）。
- 项目章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`；通道约束：`C:\develop\workspace\AI-writer\develop\docs\agents\workbuddy-channel.md`。
- 夜间不等人：**不要提问**，时间盒 ≤ 15 分钟；做不完写 BLOCKED。本任务**不改任何代码**。

## 0. 开工先复述三条红线（三行；不写视为没读）
1. 只改 `C:\develop\workspace\AI-writer\wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测 `pnpm test <具体测试文件路径>`；禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`、任何起应用进程/切 ABI 的命令；
3. 不 commit / push / merge / 切分支 / git reset / `git checkout -- .` / 不改全局配置与 `docs/agents/doc-placement-baseline.json`。

允许命令白名单：读文件、`git status/diff/log/show`、`pnpm typecheck`。

## 1. 背景
全量 browser 输出落盘：`C:\develop\workspace\AI-writer\develop\.runtime\night\browser-20261110.log`
基线：**30 failed / 808 passed / 838**，全存量债。本任务判 **B 组 16 例**：

- `f05-writer-graph.browser.tsx` 5 例
- `f05-writer-feedback.browser.tsx` 3 例
- `ReviewReport.confirmation.browser.tsx` 2 例
- `RendererStartup.browser.tsx` 1 例
- `v3-shell.browser.tsx` 1 例（已知现象：rail 9 vs 8）
- `v3-settings-backup.browser.tsx` 1 例
- `v3-characters.browser.tsx` 1 例
- `f05-writer-immersion.browser.tsx` 1 例
- `CodeMirrorEditor-generation.browser.tsx` 1 例

注意：其中可能有**行为断言类**（如 `status:'failed'` vs `'completed'`、权威定稿缺第 4 章、长度 1 vs 2）——这类**不要判漂移**，除非你能指出产品行为的既定变更出处；否则判「真缺陷」或「需实机确认」。

## 2. 判读要求（逐例）
1. 测试文件:行号 + 测试名；
2. 失败断言原文 + 日志实际差异（expected/actual 原样）；
3. **产品源码真值**（文件:行号 + 片段），找不到写「本次读取的文件内未找到」；
4. 判读 ∈ {`漂移` | `真缺陷` | `需实机确认`}；
5. 依据一句话；
6. 建议动作（漂移→断言 diff 片段；真缺陷→最小修法文件与函数；需实机→要看什么）；
7. 漂移的尽量追溯到引入提交，查不到写「未追溯到」。

## 3. 交付
报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W2-browser-red-b.md`
① 结论一段话（16 例分布 + 先修哪条）；② 逐例判读表；③ 建议动作清单（按文件分组，可直接给 W3 用）；④ 验证（本任务未改码；若跑 typecheck 贴真实输出）。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
