# 夜跑 11-11 · WB-10 落地 WB-2 方案 A（只改测试，≤10 行）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，HEAD 应含 `5e031021`）。
- 卡 ID：`3830d5fa-5c57-459e-baf3-d59e0aa7f446`（先 `claim` 再开工，做完 `tag` 交 review）。
- 看板 CLI（绝对路径）：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告路径：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\3830d5fa-5c57-459e-baf3-d59e0aa7f446.md`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准单测入口 `pnpm test <单个测试文件>`；**禁** `pnpm test` 全量 / `pnpm test:browser` / `pnpm test:node` / `pnpm dev` / 打包。本卡**不需要跑任何测试**（见下）。
2. 禁一切 git 写操作（add / commit / reset / checkout / stash / push / merge）。
3. **只改一个文件**：`src/components/startup/__tests__/RendererStartup.browser.tsx`。**不许改产品代码**。
4. 禁 `done`；禁自建自证文件。

## 背景
B11 是 `RendererStartup.browser.tsx:137` 的 `expect(listeners.size).toBe(1)` 实得 2。你在 WB-2 里已给出三个方案，其中：
- **方案 A（本卡要落地的）**：在 `:136` 的 `vi.waitFor` 之后补一次 `await act(async () => {})`，等 React passive effects（让位 effect 的 cleanup 与新 Workspace 的订阅）完全 flush 后再读 `listeners.size`。
- 方案 B/C 本卡不做。

## 任务（T1）
1. 读 `src/components/startup/__tests__/RendererStartup.browser.tsx`，定位 `:130`–`:140` 的 `it(...)` 块。
2. 严格按方案 A 落地：只在 `vi.waitFor(...)` 之后插入一次 flush（`await act(async () => {})`，`act` 需已从 React 导入；若该文件没有导入 `act`，就补 import —— 这也是允许的，但**只许改这一个文件**）。
   - **不许**把 `:137` 的期望值改成 `2`（那会把潜在真泄漏洗白，WB-2 报告三·D 已论证）。
   - 若落地时发现需要改第二个断言（`:139-140`）才能自洽，**不要改**，改写到报告「需要 Lead 裁决」一节。
3. 落地后**不要跑测试**（browser 套件本卡禁用；`pnpm test <该文件>` 也收不到 `*.browser.tsx`，跑了必然是 `No test files found`——不要浪费时间）。
4. 报告里必须给出：改动前后该段代码的 **逐字对照**（≤10 行 diff 文本，手写也行）、**为什么这不改变断言语义**（一段话）、以及「这个修法在实机/全量套件里没被验证过」的明示。

## 允许命令（白名单）
- `git -C C:\develop\workspace\AI-writer\wt-2 status --short`
- `git -C C:\develop\workspace\AI-writer\wt-2 diff -- src/components/startup/__tests__/RendererStartup.browser.tsx`
- `Get-Content` / `Select-String`
- `node <看板 CLI> claim/tag`

不许：跑测试、跑 dev、改产品代码、改其它测试文件。

## 交付四段（写在卡报告里）
1. 改动清单（只有 1 个文件，给出行号与新增行）；
2. 执行记录（读了哪些区段、命令）；
3. 原始输出（`git diff` 原样）；
4. 未做项 + 需要 Lead 裁决的事项。

报告末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
交回：`node … tag 3830d5fa-5c57-459e-baf3-d59e0aa7f446 --add review --remove external --release --agent workbuddy:worker`

