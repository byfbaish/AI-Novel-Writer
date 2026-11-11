# 夜跑 11-11 · WB-18 测试运行器选型评审（只读 + 只写报告）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`5db9f31e-aabb-4479-bc1d-c9cce7821022`，报告写到 `wt-2\.dsh-task-board\reports\5db9f31e-aabb-4479-bc1d-c9cce7821022.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」）
1. **纯只读 + 只写报告**：不改 package.json、不改任何配置文件、不改任何测试。
2. **不跑任何测试**（本卡只读配置与源码；`pnpm test` / `test:browser` / `test:node` 全禁）。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件。

## 背景（今晚踩到的真实坑）
今晚遇到两个反复出现的挫折，都指向同一处：
- 外派 agent 想跑 `*.browser.tsx`，`pnpm test <该文件>` 返回 `No test files found` exit 1 —— **结构性收不到**，不是文件写错了；
- `check:fast` 只跑 `tsc` + 文档检查，**不跑任何测试**，所以「typecheck 绿」不等于「测试绿」；今晚已出现过一次「误把 typecheck 输出读成测试通过」。

## 任务（T1）：把三个 runner 摊开对比
1. 读 `package.json` 的 `scripts` 与 `scripts/run-tests-electron.mjs`、`vitest.config.ts`（若存在）、`vitest.browser.config.ts`，把**三个 runner** 各自的：
   - 入口命令 / 配置文件 / `include` glob / `environment` / 是否走 Electron 运行时 / ABI 要求 / 能否在 worktree 里跑 / 能否并发跑，
   列成一张表。
2. 解释清楚：**为什么 `pnpm test` 收不到 `*.browser.tsx`**（逐层给依据：脚本 → fixture → include）。
3. 核 `pnpm check:fast` 的组成（读 `scripts/check-fast.mjs`），明确写出它**做了/没做**什么。
4. 给「选型建议」三档（每档说清适用场景与代价）：
   - A 维持现状（三个入口、各管一段）；
   - B 给 `pnpm test` 加 `--browser` 转发参数；
   - C 引入统一入口（一条命令跑全部，按文件后缀分派）。
   给每档的**最小改动点**（文件:行号）与**风险**（尤其 ABI / 并发 / worktree 红线）。
5. 明确写出「今晚这两次挫折，用哪一档能避免」以及「哪一档也避免不了」。

## 验收
- 三 runner 对比表必须完整（缺项写「未找到」+ 你搜过的路径）。
- 每一条结论都要有 `文件:行号`。
- 建议档位里**不许**出现「改成 X 就好了」而没有代价说明。
- 贴至少 4 条 `Select-String` / `Get-Content` 原样输出。

## 交付
四段报告：结论（推荐哪档 + 一句话理由）/ 改动清单（写「无」）/ 原始输出 / 未做项。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag `5db9f31e-aabb-4479-bc1d-c9cce7821022` --add review --remove external --release --agent workbuddy:worker`
