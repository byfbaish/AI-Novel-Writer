# W1 · browser 存量红分类判读（A 组）

你是 WorkBuddy（外部实现 agent），本轮为**夜间无人值守批次**。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，已重置到主线 HEAD `74ad3236`，工作区应为干净）。
- 项目章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`；通道约束：`C:\develop\workspace\AI-writer\develop\docs\agents\workbuddy-channel.md`。
- 夜间不等人：**不要提问**，时间盒 ≤ 15 分钟；做不完就写 BLOCKED 并交代已完成部分。本任务**不改任何代码**。

## 0. 开工先复述三条红线（三行；不写视为没读，Lead 会拒收）
1. 只改 `C:\develop\workspace\AI-writer\wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测 `pnpm test <具体测试文件路径>`；禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`、任何起应用进程/切 ABI 的命令；
3. 不 commit / push / merge / 切分支 / git reset / `git checkout -- .` / 不改全局配置（config.json / models.json / recent-projects.json）与 `docs/agents/doc-placement-baseline.json`。

允许命令白名单：读文件（Get-Content / Select-String）、`git status` / `git diff` / `git log` / `git show`、`pnpm typecheck`。其余命令先自问「是否会改代码或起进程」，是则不要执行。

## 1. 背景
主工作区刚跑完一次全量 browser 套件，完整输出已落盘：
`C:\develop\workspace\AI-writer\develop\.runtime\night\browser-20261110.log`

已知基线：**30 failed / 808 passed / 838**，全部是存量债（非本夜引入）。你的任务是把其中 **A 组 14 例**逐条判「漂移还是真缺陷」。

A 组清单（以日志里的实际失败为准，下面括号是文件名关键词）：
- `chapter-writing-model-selector.browser.tsx` 8 例（已知现象：模型下拉多出「不指定（按内容定）」一项）
- `batch-chapter-completion-mode.browser.tsx` 3 例
- `project-writing-language.browser.tsx` 2 例
- `CharactersView.search.browser.tsx` 1 例

## 2. 判读要求（逐例一行，不要批量下结论）
对每条失败给出：
1. 测试文件:行号 + 测试名；
2. 失败断言原文 + 日志里的实际差异（expected/actual 原样摘）；
3. **产品源码真值**：到组件/服务源码里找到该断言对应的现实现（文件:行号 + 3–5 行原文片段）。找不到就写「本次读取的文件内未找到」；
4. 判读 ∈ {`漂移`（测试期望过期，产品行为是既定变更）|`真缺陷`（产品行为错，测试是对的）|`需实机确认`（静态读不出）}；
5. 依据一句话（为什么是漂移/缺陷）；
6. 建议动作：漂移→给出「建议改动的断言 diff 片段」；真缺陷→写出最小修法所在文件与函数；需实机→写出实机要看什么。
7. 若判漂移，必须同时指出**哪次变更引入**（git log/blame 能查到就写提交号，查不到写「未追溯到」）。

纪律：**不许批量改期望值来凑绿**；同一条失败若拿不准，判「需实机确认」而不是猜漂移。

## 3. 交付
报告写到：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W1-browser-red-a.md`（目录不存在就建）。四段：
① 结论一段话（14 例里漂移/真缺陷/需实机各几条，最值得先修的是哪条）；
② 逐例判读表（建议 Markdown 表格 + 每例证据行号）；
③ 建议动作清单（可直接给 W3 用的 diff 片段，按测试文件分组）；
④ 验证：本任务未改码，写「未改码，未跑测试」；如你顺手跑了 `pnpm typecheck`，贴命令与真实输出。

末尾必须写 `## [T1] DONE`（或 `## [T1] BLOCKED <一句话原因>`）。
