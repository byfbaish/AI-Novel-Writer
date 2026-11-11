# 夜跑 11-11 · WB-8 交叉复核 DB-1 产物（只读）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`（分支 agent/wt-2）。
- 卡 ID：`d438ab0c-4272-414d-8f51-8d6c520f3dc7`（先 `claim` 再开工，做完 `tag` 交 review）。
- 看板 CLI（绝对路径）：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告路径（唯一产物）：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\d438ab0c-4272-414d-8f51-8d6c520f3dc7.md`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准单测入口 `pnpm test <单个测试文件>`；**禁** `pnpm test` 全量 / `pnpm test:browser` / `pnpm test:node` / `pnpm dev` / 打包。
2. 禁一切 git 写操作（add / commit / reset / checkout / stash / push / merge）。
3. 只改任务书点名的路径（本卡是只读卡，**不改任何代码**）。
4. 禁 `done`；禁自建自证文件；只写上面那一份报告。

## 任务
DB-1 声称在 wt-1 新增了一个纯函数 + 单测（D9 阶段 2 的「逐章完成读数」），零调用方、不扩 schema。你要做**独立第二意见**，只读，不跑测试。

材料（已复制到你工作区内，不要动原件）：
- `C:\develop\workspace\AI-writer\wt-2\.runtime\crosscheck\DB-1\batch-completion.ts`（54 行）
- `C:\develop\workspace\AI-writer\wt-2\.runtime\crosscheck\DB-1\batch-completion.test.ts`（50 行）
- `C:\develop\workspace\AI-writer\wt-2\.runtime\crosscheck\DB-1\DB-1-report.md`（DB-1 自己的报告）

核这几件事，每条给「成立 / 不成立 / 无法判定 + 证据（文件:行号 + 原文）」：
1. **真的零调用方吗**：在 `wt-2` 源码里 grep 这个模块的导出名（例如 `computeBatchCompletion` 之类）与文件路径 `batch-completion`，看有没有人 import。给出 grep 命中数。
2. **函数语义是否真的对应「逐章完成读数」**：读函数签名与分支，判断它对「空批次 / 单卷 / 多单元 / covered_to 回退」四种输入是否都有明确行为；没有就点名缺哪种。
3. **单测是否真的覆盖它声称覆盖的边界**：逐条列出测试用例名 + 覆盖的边界，指出「代码里有分支但测试没覆盖」的。
4. **是否真不扩 schema / 不碰数据库**：看有没有 import 迁移、repository、db 类型。
5. **报告与代码是否一致**：DB-1-report.md 里声称的行数 / 边界 / 不确定项，与两份源文件实际内容是否对得上；对不上就给出具体原句。

## 允许命令（白名单）
- `git -C C:\develop\workspace\AI-writer\wt-2 status --short`
- `git -C C:\develop\workspace\AI-writer\wt-2 grep -n <pattern>`
- `Get-Content <路径> -TotalCount N` / `Select-String -Path <路径> -Pattern <pattern>`
- `node <上面的看板 CLI> claim/tag/review`

不许：跑测试（本卡无需测试）、改文件、写卡以外的产物。

## 交付（报告四段）
1. 结论（一段话：这份 DB-1 产物够不够格进主线）；
2. 证据（五问逐条，文件:行号 + 原文）；
3. 改动清单：**本卡零改动**，写明；
4. 未做项（没跑的测试、没核的东西逐条列）。

报告末行必须是 `## [T1] DONE` 或 `## [T1] BLOCKED <一句话原因>`。
交回：`node … tag d438ab0c-4272-414d-8f51-8d6c520f3dc7 --add review --remove external --release --agent workbuddy:worker`


