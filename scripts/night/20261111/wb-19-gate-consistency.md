# 夜跑 11-11 · WB-19 五个闸门脚本的行为一致性核查（只读 + 只写报告）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`2a034878-0b1d-4edc-8a14-6c283a42a358`，报告写到 `wt-2\.dsh-task-board\reports\2a034878-0b1d-4edc-8a14-6c283a42a358.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」）
1. **纯只读 + 只写报告**：不改任何脚本、配置、测试。
2. **不跑任何测试/构建/dev**；可以跑 `node <脚本> --help` 一类**只打印用法**的调用，但要说清你跑了什么。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件。

## 为什么做这个
今晚已发生两次「把闸门读数当成结论」的险情：
- `check:fast` 全绿被当成「测试绿」，实际它**不跑测试**；
- `pnpm typecheck` 的输出被管道/`$LASTEXITCODE` 组合读成 `EXIT1=0`，结论险些写反。

闸门自己也会撒谎。本卡把它们**逐个摊开**，明确每个脚本「能证明什么、不能证明什么、什么情况会静默放行」。

## 任务（T1）
对下面五个入口，逐个给：`入口 | 是否会静默放行 | 退出码语义 | 覆盖范围 | 已知盲区 | 今晚是否踩过`
1. `pnpm check:fast`（读 `scripts/check-fast.mjs`）
2. `node scripts/check-doc-links.mjs`（路径以实际为准；先 `ls scripts` 找）
3. `node scripts/check-doc-placement.mjs`
4. `node scripts/check-ledger-snapshot.mjs`（今晚新增，已在 wt-2 工作区）
5. `node scripts/run-tests-electron.mjs`（`pnpm test` 的实现）
6. 额外：`package.json` 里 `typecheck` / `lint` / `test:browser` 的真实命令。

重点回答四个问题：
- **Q1** 有哪些脚本在「发现问题」时仍然 exit 0？（列出具体行号与条件）
- **Q2** 有哪些脚本把**解析失败/文件缺失**当成「没问题」而不是报错？
- **Q3** 哪些脚本的输出需要**人读**才能判断红绿（不是靠退出码）？
- **Q4** 如果一个人只看退出码，最容易被哪一个骗？（给一个具体例子）

## 验收
- 六个入口全覆盖，缺的写「未找到 + 你搜过的路径」。
- Q1–Q4 每条都要 `文件:行号`。
- 「今晚是否踩过」列必须具体（例：踩过 = `check:fast` 不含测试）。
- 贴至少 4 条 `Select-String` / `Get-Content` 原样输出。

## 交付
四段报告：结论（最危险的一个闸门）/ 改动清单（写「无」）/ 原始输出 / 未做项。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag `2a034878-0b1d-4edc-8a14-6c283a42a358` --add review --remove external --release --agent workbuddy:worker`
