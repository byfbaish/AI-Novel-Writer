# 夜跑 11-11 · DB-9 交叉复核 WB-8 第二意见（零代码，只读）

## 身份与落点
- 你是**豆包**，工作目录 `C:\develop\workspace\AI-writer\wt-1`。
- 卡 ID：`e96023e7-e4fa-4334-99e2-a2c296697588`，报告路径 `C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\e96023e7-e4fa-4334-99e2-a2c296697588.md`。
- 看板 CLI（绝对路径）：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准单测入口；本卡**不跑任何测试**。
2. 禁一切 git 写操作（add / commit / reset / checkout / stash / push）。
3. 只读材料 + 只写卡报告那一份文件；不改代码、不改任何既有报告。
4. 禁 `done`；禁自建自证文件。

## 背景
DB-1 在 wt-1 新增了一个纯函数 + 单测（D9 阶段 2「逐章完成读数」，零调用方、不扩 schema）。WorkBuddy 已对 DB-1 做过一次独立第二意见（WB-8），结论是 PASS 但声明「问 1 的零调用方全局主张无法独立复验（材料只有 3 个复制文件，没有 wt-1 全树）」。**你在 wt-1 里，这个限制对你不存在** —— 所以你的任务是把 WB-8 因权限而无法完成的那部分补上。

## 材料
- `C:\develop\workspace\AI-writer\wt-1\.runtime\crosscheck\DB-1\DB-1-report.md`
- `C:\develop\workspace\AI-writer\wt-1\.runtime\crosscheck\DB-1\batch-completion.ts`（54 行）
- `C:\develop\workspace\AI-writer\wt-1\.runtime\crosscheck\DB-1\batch-completion.test.ts`（50 行）
- `C:\develop\workspace\AI-writer\wt-1\.runtime\crosscheck\DB-1\WB-8-second-opinion.md`（WB-8 报告，14.5K）

## 任务（逐条给「成立 / 不成立 / 无法判定」+ 文件:行号证据）
1. **零调用方，独立复验**：在 `wt-1\src\` 全树 grep `batch-completion` 与该文件的导出名，给出命中数与每处命中（含测试文件）。结论要能回答「它是否真零调用方」。
2. **函数语义 vs 卡面要求**：逐条读 `batch-completion.ts` 的导出与分支，判它覆盖的边界（空批次 / 单卷 / 多单元 / `covered_to` 回退）是否齐全；列出「代码有分支但测试没覆盖」的点。
3. **WB-8 的五问结论是否站得住**：逐条表态（同意/不同意 + 依据）。特别核它说的「不确定项」（例如 `coveredTo` 是否有对应列、DB-1 报告的 `git status` 真伪）——你能在 wt-1 现场查，就查了再判。
4. **WB-8 没看出来的问题**：至少尝试找一条（命名/契约/副作用/可测性/与 D2 失败终态的衔接），找不到就明写「未发现，已检查的方面有 X/Y/Z」。
5. **是否够格进主线的判断**：给定「本函数零调用方、不接线」这一前提，说明它现在合入的风险面（只列风险，不拍板）。

## 交付四段（写在卡报告里）
改动清单（写「零改动」）/ 执行记录（grep 命令与原样输出、读了哪些文件）/ 原始输出（上面五问的证据表）/ 未做项 + 不确定。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
交回：`node … tag e96023e7-e4fa-4334-99e2-a2c296697588 --add review --remove external --release --agent doubao`


