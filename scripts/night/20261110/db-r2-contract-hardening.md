# R2 · 角色面板契约硬化 + 三个夹具补契约返回（豆包）

**身份**：豆包
**工作目录**：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，开工 HEAD 应为 `74ad3236`）
**本轮授权**：可改码（**仅限本任务书列出的 4 个文件**）；**不提交、不推送**。
**作者口径（2026-11-10 20:10）**：「先改不测」——本轮**不要运行任何测试**（禁 `pnpm test` / `test:browser` / `test:node` / `pnpm dev`）；全部改完后允许跑**一次** `pnpm typecheck` 自检。
**时间盒**：≤40 分钟。一个任务做完就先写 DONE 再继续下一个；卡住写 `BLOCKED` 并说明卡在哪，不要猜。

## 必读（开工前）
1. `C:\develop\workspace\AI-writer\develop\AGENTS.md`
2. `C:\develop\workspace\AI-writer\develop\docs\agents\doubao-channel.md`
3. 本任务书全文

开工第一条消息必须**复述三条红线**（3 行）：
- 只改 `wt-1`，不碰 `develop` / `wt-2` / `wt-3`；
- 只跑白名单命令，禁全量测试 / `test:browser` / `test:node` / `pnpm dev` / 任何 git 写操作；
- 不改既有实现与既有断言（除本任务书明确列出的行）；没读到的内容只能写「本次读取的文件内未找到」。

## 背景（一句话）
主区 browser 基线 **30 failed**，其中 7 例（A14、B1–B5、B14）都崩在同一行 `FinalizedCharacterStateCandidatePanel.tsx:124` 的 `board.pending.length`（`Cannot read properties of undefined`）。根因：**夹具给这两个 channel 返回了错形状**（例如 `{ success, avatars }` 或 `[]`），而面板 :42 的注释承诺「两个 channel 都可能返回 null，必须兜住」，代码却只兜 `null`/`undefined`。作者拍板：产品侧做 2 行**契约硬化**，同时夹具必须按契约补返回。

---

## 任务 T1 · 产品契约硬化（1 个文件，2 行）

文件：`src/components/characters/FinalizedCharacterStateCandidatePanel.tsx`

`:43` 现在是：

```ts
      setSummaries(pending ?? []); setBoard(deltas ?? EMPTY_BOARD); setError(failure)
```

改成（保持同缩进风格，可写成三行）：

```ts
      setSummaries(Array.isArray(pending) ? pending : [])
      setBoard(deltas && Array.isArray(deltas.pending) && Array.isArray(deltas.hits) ? deltas : EMPTY_BOARD)
      setError(failure)
```

- 只改这一处。**不要动 `:124`**（`setBoard` 保证数组后 `:124` 自然安全）。
- 结论表述：这是**契约硬化**（兑现 `:42` 注释的承诺），不是「修复线上白屏缺陷」——线上 handler 恒返回正确形状（见 `electron/services/finalized-character-generation.ts:52-58`）。

## 任务 T2 · 三个夹具按契约补返回（3 个文件）

契约（`src/shared/finalized-character-generation.ts`）：
- `finalized-character:list-state-candidates` → **数组**（无待处理项时 `[]`）
- `finalized-character:list-card-deltas` → `FinalizedCharacterCardDeltaBoard`，即 `{ pending: [], hits: [] }`

三处都在夹具的 `aiNovelAPI.invoke` 里加**同样两行**（位置：放在既不吞掉 avatar 分支、又能命中的地方；建议紧跟 avatar 判断之后）：

```ts
    if (channel === 'finalized-character:list-state-candidates') return []
    if (channel === 'finalized-character:list-card-deltas') return { pending: [], hits: [] }
```

1. `src/components/layout/v2/__tests__/f05-writer-graph.browser.tsx`（约 `:86-91`，`invoke = vi.fn(async (channel: string, ids: string[]) => ({ ... }))`）
2. `src/components/layout/v2/__tests__/v3-characters.browser.tsx`（约 `:50-55`，`invoke` 里 `return []` 之前）
3. `src/components/panels/sidebar/__tests__/CharactersView.search.browser.tsx`（约 `:89-94`，`avatars` 对象里，需要在 `vi.fn(async (channel: string, ids: string[]) => ({...}))` 之前加两个 if）

说明：三个夹具目前对未知 channel 返回统一对象 `{ success, avatars }` 或 `[]`，面板拿到非数组形状就崩。补上返回值后夹具才真正按契约喂数据，面板既有逻辑才会被执行到。

---

## 允许命令白名单
- `Get-Content` / `Select-String` / `Test-Path`（读）
- `pnpm typecheck`（**全部改完后跑一次**；贴末 20 行 + exit code）

## 交付
报告写到 `C:\develop\workspace\AI-writer\wt-1\.batch\night\R2-contract-hardening.md`，四段：
1. **改动清单**：每个文件 → 行号 → 改前/改后片段
2. **执行记录**：T1 / T2 各做了什么
3. **原始输出**：`pnpm typecheck` 末 20 行 + exit code
4. **未做项 / 不确定项**

每个任务末尾写 `## [T1] DONE` / `## [T1] BLOCKED`（T2 同理）；全部完成写 `## [QUEUE] EMPTY`。
