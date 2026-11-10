# W3 · browser 纯漂移 patch（只改测试期望，不动产品代码）

你是 WorkBuddy（外部实现 agent），**夜间无人值守批次**。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`；通道：`docs/agents/workbuddy-channel.md`。
- 时间盒 ≤ 15 分钟；不要提问；做不完写 BLOCKED 并说明已落地部分。

## 0. 开工先复述三条红线（三行；不写视为没读）
1. 只改 `C:\develop\workspace\AI-writer\wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测 `pnpm test <具体测试文件路径>` 与 `pnpm typecheck`；禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`、任何起应用进程/切 ABI 的命令；
3. 不 commit / push / merge / 切分支 / git reset / `git checkout -- .` / 不改全局配置与 `docs/agents/doc-placement-baseline.json`。

## 1. 输入
- W1 报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W1-browser-red-a.md`
- W2 报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W2-browser-red-b.md`
- 若两份报告不存在 → 直接写 BLOCKED（原因：上游报告缺失），不要自行猜测。

## 2. 任务（只做「漂移」判定项）
1. 从 W1/W2 报告里收集**判读 = 漂移**的条目（判「真缺陷」/「需实机确认」的一律不动）；
2. 只改 `src/**/__tests__/*.browser.tsx` 里的**期望值 / 选择器 / 文案匹配 / 计数**，让测试追平既有产品行为；
3. **禁止改产品代码**（`src/**` 非测试文件一律不改）。若某条漂移必须改产品才能修 → 跳过并在报告里写「需改产品，已跳过」；
4. 每改一处，注释里不要写日期/作者；保持仓库既有风格；
5. 改完跑：`pnpm typecheck`；再跑**你改动涉及的测试文件**（`pnpm test <单个测试文件路径>`，一次一个文件；禁 `test:browser` 命令，若该测试必须 browser 配置才能跑就跳过并说明——**不要**自行拼 vitest browser config 全量跑）。

## 3. 交付
1. 生成 patch：`git -C C:\develop\workspace\AI-writer\wt-2 diff --output=C:\develop\workspace\AI-writer\wt-2\.batch\night\w3-drift.patch`
2. 报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W3-browser-drift-patch.md`
   ① 结论一段话（改了几条、跳过几条、为什么）；② 逐条改动清单（文件:行号 + 前后对比）；③ 跳过的条目及原因；④ 验证（`pnpm typecheck` 命令+原样输出；涉及的测试文件重跑结果，或说明为何无法在本地跑 browser）。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
