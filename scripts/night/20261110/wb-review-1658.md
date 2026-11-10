# 复核 · 07:00 复核文档（REVIEW-0700.md）技术评审 — 只读，不改任何文件

你是 WorkBuddy（外部实现 agent）。本任务是**白天补派的技术评审**，目标是把夜间 07:00 那份复核文档本身再评一遍：它判得对不对、证据等不等于真凭实据、能不能据此合并。

- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`；通道：`docs/agents/workbuddy-channel.md`。
- 时间盒 ≤ 25 分钟。**不要提问**；做不完就按「已完成部分 + 未完成项」写 BLOCKED。
- 本轮授权：**只读 + 只写一份报告**。不改产品代码、不改测试、不改夜间那 11 份报告，不 commit / push / merge / 切分支 / git reset / 不 stash。

## 0. 开工先复述三条红线（三行；不写视为没读）
1. 只读 `wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测与 `pnpm typecheck`；禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`、任何起应用进程 / 占端口 / 切 ABI 的命令；
3. 不 commit / push / merge / 切分支 / git reset / 不改全局配置与基线文件。

## 1. 对象文件
- 被评审文档：`C:\develop\workspace\AI-writer\wt-2\.batch\night\REVIEW-0700.md`（约 245 行，31912 B，07:15 落盘）。
- 它评的 11 份夜间产物（都在同一目录）：
  `W1-browser-red-a.md`、`W2-browser-red-b.md`、`W3-browser-drift-patch.md` + `w3-drift.patch`、`W5-incomplete-chapter-discard-draft.md`、`w6-selfcheck.md`；
  豆包侧在 `C:\develop\workspace\AI-writer\wt-1\.batch\night\`：`D1-a1-criteria-brief.md`、`D2-short-outline-acceptance.md`、`D3-browser-red-second-opinion.md`、`D4-ledger-status-calibration.md`、`D5-morning-digest.md`（**只读**，不要改 wt-1）。
- 相关任务书在 `C:\develop\workspace\AI-writer\develop\scripts\night\20261110\`。

## 2. 要你独立核的七件事（逐件给「成立 / 不成立 / 待核」+ 证据）

### R1 总判定的证据链
REVIEW-0700 断言「11 份报告无虚报，只有 W3 有代码 diff」。请你自己跑 `git -C . status --short`、`git diff --numstat`、`git diff --name-only`，确认：
- 当前工作树到底有没有代码 diff？几个文件、几加几删？
- 若有 diff，是否**全部**落在 `*.browser.tsx`？有没有混进产品代码 / schema / 主进程 / IPC / prompt 文件？
- 报告里「W3 之外零改动」这句，与你亲眼看到的 diff 是否一致？

### R2 W3 的「无运行时复绿证据」是否成立，理由对不对
报告说 `pnpm test <browser 文件>` 返回 `No test files found` 故无复绿证据。请核实：
- `package.json` 里 `test` 与 `test:browser` 各自的命令行；
- `scripts/run-tests-electron.mjs`（或等价入口）的 include/exclude 是否会把 `*.browser.tsx` 排除在外；
- 结论：W3 想验证只能怎么跑？在你当前权限与红线内**能不能**给出复绿证据？给出你能做到的最近替代验证（例如对每条改动指出对应的失败断言原文位置）。
- 另：`w3-drift.patch` 能否干净回退，用 `git apply --check -R --verbose .batch/night/w3-drift.patch` 验（只 check，不真 apply）。

### R3「W2 §3.6 的修复建议不可执行」这个否定是否站得住
REVIEW-0700 判 W2 REWORK，理由是 W2 建议改用 `.writer-statusbar-segment`，而夹具 `f05-writer-immersion.browser.tsx` 传的是自定义 `statusBar={<p>状态</p>}`，该 class 取不到。请核实：
- 夹具实际传参与 `ShellV2` 对 `statusBar` 的透传关系（文件:行号 + 原文）；
- `.writer-statusbar-segment` 到底在哪些文件里出现（全仓 grep，含行号）；
- 该用例真实失败原因是什么（读报告或源码判断：是「左栏按钮搬迁」还是别的）；
- 判：**W2 的建议是"确实不可执行"还是"只是这一条落点选错、另有可行落点"**？若另有可行落点，请给出一条可执行的具体改法（文件:行号级、只写不改）。

### R4 W4 报告缺失的定因
W4 产物 `W4-d9-hook-points.md` **不存在**，但任务书 `wb-w4-d9-hook-points.md` 存在、且投递脚本当时返回 exit 0。请给出你能拿到的证据（文件时间戳、`.batch\workbuddy\` 或 `develop\.runtime\workbuddy\` 下有没有该次 attach 的产物目录、WorkBuddy 侧有没有对应会话），判断属于以下哪种，并说明依据：
（a）投递没成功；（b）投递成功但 WorkBuddy 没执行；（c）执行了但报告写到了别处 / 写失败；（d）无法判定。
**不要**替 W4 补做它的取证工作——本任务只定因。

### R5 W6 自检与 REVIEW 的交叉一致性
`w6-selfcheck.md`（W6 自检）与 `REVIEW-0700.md` 两份对同一批报告的判定是否互相矛盾？列出**所有**不一致项（任务名 / W6 判 / REVIEW 判 / 你判）。特别关注 W6 有没有复跑测试、REVIEW 说「W6 的 73+48 未复跑」是否属实。

### R6 报告自身的形式质量
- 头行自述「模型 / 会话是否新建 / 复核时间」是否可信、有无自相矛盾处；
- 它列的行号抽查是否真的对得上（**自己抽查至少 6 处**，报对/错数量与错的那些行）；
- 有没有「未经取证就下结论」的句子（列出原文 + 行号），有没有把某条证据的强度说过头。

### R7 剩余风险 7 条还差什么
REVIEW-0700 末尾列了 7 条剩余风险。逐条判：哪些**今晚已经可以关**（有证据）、哪些**必须作者拍板**、哪些**需要实机**（跑应用才能验）。给一张三分类表。

## 3. 交付
报告写到：`C:\develop\workspace\AI-writer\wt-2\.batch\night\REVIEW-RECHECK-1658.md`

结构：
1. **一段话总判定**：REVIEW-0700 这份文档**可信 / 部分可信 / 不可信**，其中哪几条判定要改（写出改成什么），据此「W3 能不能合并」的结论。
2. **逐项证据**：R1–R7 每项一小节，格式「判定 + 证据（文件:行号 + 原文照抄）+ 你跑过的命令与原始输出」。
3. **命令与原始输出**：把你实际执行过的每条命令**原样贴出**（含 `$LASTEXITCODE` / `$?` 原值）。**要求：每条命令单独一次 PowerShell 调用、输出先落文件再读文件，不要用 `| Out-String` 或管道拼 `$LASTEXITCODE`**（上一轮 `pnpm typecheck` 的 EXIT=0 就是这么误读的）。
4. **改动清单**：必须写「无（只读任务）」。
5. **未做项**：写清哪些没做完、为什么。
6. 最后一行：`## [T1] DONE` 或 `## [T1] BLOCKED <一句话原因>`。

## 4. 硬约束
- 报告只能写这一个文件；**不要**新建 SUMMARY / VERIFICATION / FINAL / DONE 之类的额外自证文件。
- 不要修改 `.batch\night\` 下已有的任何报告（包括 `REVIEW-0700.md`）。
- 判定一律以你自己的命令输出为准；报告里出现的每个数字都必须有你自己的输出支撑，查不到就写「本次未取证」。
