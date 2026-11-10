# R2 · 浏览器存量红修复（WorkBuddy）：夹具补齐 + 断言重写

**身份**：WorkBuddy
**工作目录**：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，开工 HEAD 应为 `530ca39a`）
**本轮授权**：可改码（**仅限本任务书列出的文件**）；**不提交、不推送、不合并**。
**作者口径（2026-11-10 20:10）**：「先改不测」——本轮**不要运行任何测试**（禁 `pnpm test` 全量、`test:browser`、`test:node`、`pnpm dev`）；全部改完后允许跑**一次** `pnpm typecheck` 自检。
**时间盒**：≤40 分钟。做不完就写 `## [Tn] BLOCKED` 说明卡点，**不要猜、不要扩散改动范围**。

## 必读（开工前）
1. `C:\develop\workspace\AI-writer\develop\AGENTS.md`
2. `C:\develop\workspace\AI-writer\develop\docs\agents\workbuddy-channel.md`
3. 本任务书全文

开工回复第一段必须**复述三条红线**：
- 只改 `wt-2`，不碰 `develop` / `wt-1` / `wt-3`；
- 只跑白名单命令，禁 `pnpm test` 全量 / `test:browser` / `test:node` / `pnpm dev`；
- 不 commit / push / merge / 切分支 / `git reset` / 不改全局配置与 `docs/agents/doc-placement-baseline.json`。

## 背景（一句话）
主区 `pnpm test:browser` 基线 **30 failed / 808 passed**（`develop/.runtime/night/browser-20261110.log`）。这些红是**测试夹具与断言落后于产品演进**，不是产品缺陷。本次处理其中 3 组、共 13 例；本批**不碰产品代码**。

---

## 任务 T1 · 夹具补齐（10 例，3 个文件）

### T1-a `src/components/dialogs/__tests__/chapter-writing-model-selector.browser.tsx`（8 例）
`installIpc()` 里的 `invoke` 在 `throw new Error(`Unexpected IPC channel: ${channel}`)`（约 `:144`）**之前**补一行：

```ts
if (channel === 'db:draft-list-all') return []
```

依据：产品 `src/services/batch-interrupt-resume.ts:76-85` 的 `readBatchStartChapter` 会 `invokeWithProjectSession(..., 'db:draft-list-all', ...)` 再 `drafts.map(draft => draft.chapterNumber)`；返回 `[]` 表示「没有草稿」。缺该分支时 mock 抛错，起点回落到第 1 章、启动按钮恒 disabled。

**绝对不要改这 8 例的期望值**（不要把「第 10 章」改成「第 1 章」、不要把 `toHaveLength(2)` 改成 1、不要接受禁用状态）。那是把夹具缺 channel 造成的错误状态写成产品真值。

### T1-b `src/components/editor/__tests__/ReviewReport.confirmation.browser.tsx`（2 例）
产品 `4c8df58d` 起把 `severity='pass'` 的项收进「检查通过」区并**默认折叠**（`src/components/editor/ReviewReport.tsx:561-570` 分组、`:1324-1331` 是 toggle 按钮，文案 `检查通过（N）`）。断言 pass 相关内容前必须先点开。

- 用例 `shows cycle and finding states separately and persists only an explicit author waiver as v2`（`:319` 起）：
  1. 在 `expect(container?.textContent).toContain('已解决')`（约 `:338`）**之前**插入一次点击；
  2. 第二次 `await renderReport(RAW_AI_REPORT, { ...generated, revisionStatus: 'merge-committed', ... })`（约 `:341`）之后、`querySelector('[data-review-finding-status="resolved"]')`（约 `:344`）**之前**再插入一次点击——重渲染会丢展开态。
- 用例 `逐项目标展示完成证据，待核实不计通过且仅明确选择后纳入不可变确认`（`:383` 起）：在 `expect(container!.textContent).toContain('约定周三出发 — 已完成')`（约 `:402`）**之前**插入同一次点击。

点击写法照抄同文件既有风格：
```ts
await act(async () => page.getByRole('button', { name: /检查通过/ }).click())
```
**期望值一字不改。**

### T1-c `src/components/layout/v2/__tests__/f05-writer-immersion.browser.tsx`（1 例）
该夹具 `:40` 传的是占位 `statusBar={<p>状态</p>}`，而 `ShellV2.tsx:71` 把 `statusBar` 原样透传 ⇒ 夹具**从没挂过真实 `StatusBar`**，底部三入口按钮不存在；且产品标题已从「任务」改为 `打开任务/收起任务`（`src/components/layout/StatusBar.tsx:90-93`）。

1. 顶部 import 增加：`import StatusBar from '../../StatusBar'`（该文件在 `src/components/layout/v2/__tests__/`，`StatusBar.tsx` 在 `src/components/layout/`）。
2. `:40` 改 `statusBar={<StatusBar />}`（对照同目录 `f05-writer-navigation.browser.tsx:42`）。
3. `:127` 的标题映射 `{ tasks: '任务', log: '日志', models: '模型' }` 改成 `{ tasks: '打开任务', log: '打开日志', models: '打开模型' }`（未激活态的 title 是「打开X」；循环里每次先 `setSidebarView('home')` 再点，点过的前一个才会变「收起X」，被点的那个仍是未激活）。
4. 不要改其他断言。

---

## 任务 T2 · 补 `knowledge_candidates` 夹具（3 例，1 个文件）

文件：`src/components/dialogs/__tests__/batch-chapter-completion-mode.browser.tsx`

产品 P20-3 新增章末「知情候选」步骤（提交 `03031dfe`，实现在 `src/services/workflows/commands/finalize-chapter.command.ts:581-608`，effect 类型在 `src/shared/finalization-generation.ts:109-118`）。

1. `:448` `expect(['chapter_notes', 'character_cards']).toContain(slot.stepKey)` → `expect(['chapter_notes', 'knowledge_candidates', 'character_cards']).toContain(slot.stepKey)`
2. `:452-454` 的 `effect` 三元表达式改成按 `slot.stepKey` 三分支：
   - `chapter_notes`：保持现值不变；
   - `knowledge_candidates`：**新增**
     ```ts
     { success: true, stepKey: 'knowledge_candidates', candidateCount: 0, dropped: [], factCount: 1 }
     ```
     （`factCount: 1` 与同文件 `chapter_notes` 分支的 `factCount: 1` 对齐——没有事实时产品会抛前置缺失）
   - `character_cards`：保持现值不变。
3. `:931-933` 的 `.toEqual(['chapter_notes', 'character_cards'])` → `.toEqual(['chapter_notes', 'knowledge_candidates', 'character_cards'])`（步骤顺序见 `finalize-chapter.command.ts:590/611`）。

只改期望值不补 effect 的话，产品会在 `finalize-chapter.command.ts:597` 抛 `FINALIZATION_GENERATION_EFFECT_MISMATCH`，测试仍红。

---

## 任务 T3 · 重写断言（3 例，1 个文件）

文件：`src/components/layout/v2/__tests__/f05-writer-feedback.browser.tsx`

产品 `9142eac4` 起运行态**不再渲染流式正文**（`AIOutputPanel.tsx:923-930`：只显示「正在工作 · 已用 N 秒」+「查看当前输出（低频）」开关，输出以 1500ms 低频刷新，见 `:957-1002`）；`<think>` 拆分只在已结束步骤渲染（`:932-943`）。

### T3-a `U13.A01 Writer 输出区随工作流增量呈现正文`（`:83-89`）
- `import` 里补 `vi`（当前是 `afterEach, beforeEach, expect, it`）。
- 第一个 `await result('雨落在窗沿。')` 之后：
  ```ts
  await act(async () => page.getByRole('button', { name: '查看当前输出（低频）' }).click())
  await vi.waitFor(() => expect(host.querySelector('[aria-label="写作助手"]')?.textContent).toContain('雨落在窗沿。'), { timeout: 4000 })
  ```
- 第二个 `await result('雨落在窗沿。门外有人敲门。')` 之后同样 `await vi.waitFor(...)`（不用再点，已展开）。

### T3-b `U13.A02 仅收到提供商推理时显示可折叠推理区，正文开始后仍可展开`（`:91-101`）——按新行为重写
目标：证明「运行态不渲染流式文本；已结束步骤里思考过程与正文分区、思考默认折叠可展开」。
1. `await render(); await result('<think>先核对前章时间线')` 后断言 `expect(host.textContent).not.toContain('先核对前章时间线')`（运行态不显示）。
2. 把该 step 置为已完成：
   ```ts
   await act(async () => {
     const current = useWorkflowStore.getState().activeRuns[0]
     useWorkflowStore.setState({ activeRuns: [{ ...current, steps: [{ ...current.steps[0], status: 'completed', result: '<think>先核对前章时间线</think>门外有人敲门。' }] }] })
   })
   ```
3. `await vi.waitFor(() => expect(host.textContent).toContain('门外有人敲门。'))`；再断言 `expect(host.textContent).not.toContain('先核对前章时间线')`（折叠态）。
4. `await act(async () => page.getByRole('button', { name: '思考过程' }).click())` 后断言 `expect(host.textContent).toContain('先核对前章时间线')`。

### T3-c `U13.A02 临时推理展示与正文结果隔离，清理后消失`（`:103-112`）——**整条删除**
作者裁定：该用例前提已消失（reasoning store 改为只服务诊断，不再投到面板）。删除后若 `useWorkflowReasoningStore` import 与 `originalReasoning` 变量变成未使用，一并删掉，避免 lint/类型红。

---

## 允许命令白名单
- `Get-Content` / `Select-String` / `Test-Path`（读）
- `git -C C:\develop\workspace\AI-writer\wt-2 status --short` / `diff` / `log`（只读）
- `pnpm typecheck`（**全部改完后跑一次**；贴末 20 行 + exit code）

## 交付
报告写到 `C:\develop\workspace\AI-writer\wt-2\.batch\night\R2-fixtures-and-rewrite.md`，四段：
1. **改动清单**：每个文件 → 行号 → 改前/改后片段
2. **执行记录**：按 T1/T2/T3 顺序，做了什么、遇到什么
3. **原始输出**：`pnpm typecheck` 末 20 行 + exit code
4. **未做项 / 不确定项**

每个任务末尾写 `## [T1] DONE` / `## [T1] BLOCKED`（依此类推）；全部完成写 `## [QUEUE] EMPTY`。
