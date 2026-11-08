# 任务：批量创作中断后「甲」方案止血（卡 a67a79a1 · B5）

工作目录固定 `C:\develop\workspace\AI-writer\wt-2`（基线提交 09791033）。**禁止**读写改 `develop` 主区 / `wt-1` / `wt-3`。

## 0 开工前（不照做即拒收）

1. 先读：仓库根 `AGENTS.md` · `docs/agents/workbuddy-channel.md` §4.1 / §5 · 设计稿 `docs/design/features/batch-interrupt-resume-design.md`（全文，含 §6 三条候选修法与「建议走甲」的理由）· `src/components/panels/AIOutputPanel.tsx:445-454` · `src/services/workflows/draft-recovery-workflow.ts:82-90` · `src/services/workflows/batch-chapter-workflow.ts:190-275` · `src/components/dialogs/BatchChapterCreationDialog.tsx:100-190` · `src/services/authoritative-chapter-sequence.ts` · `src/shared/generation-owner-contract.ts:296-325`。
2. **在回复第一段复述三条红线**（没复述 = 直接拒收）：
   1) 只在 `wt-2` 里改文件，不碰 `develop` / `wt-1` / `wt-3`；
   2) 只跑**相关的单个**测试文件，**禁** `pnpm test`（全量）、`vitest run` 不带路径、`test:browser`、`pnpm test:node`、`pnpm dev`、打包、任何 `better-sqlite3` 重建；
   3) 不提交 git（禁 `git add/commit/push/merge/reset/checkout`）。
3. **不许建自证文件**（`FINAL_SUMMARY.md` / `TASK_SUMMARY.md` / `DELIVERY_VERIFICATION.md` / `run-test.ps1` 等）。交付只在「报告文件 + 回复正文」两处。

## 1 允许的命令白名单

- `node scripts/run-tests-electron.mjs <单个测试文件路径>`（可带 `-t` 用例名；**一次只跑一个文件**）
- `node scripts/check-fast.mjs`（可选：typecheck，改 .ts/.tsx 后建议跑一次）
- `git status --porcelain` / `git diff --stat` / `git diff -- <path>`（**只读**）
- 列目录 / 读文件（`Get-ChildItem` / `Get-Content` / `type`）

禁：`pnpm test` / `vitest` 不带路径 / `test:browser` / `pnpm test:node` / `pnpm dev` / `pnpm install`。

## 2 背景（作者已裁定：走「甲」）

设计稿 §6 三条候选修法里，作者裁定**走甲**（界面止血，不动 run 机制、不动 aborted 终态语义、不动 `generation_batches` 语义）。乙、丙**本批不做**。

要坐实的机制事实（设计稿 §4，代码只作证据）：
- 点「继续此批次」→ `createBatchRecoveryWorkflow`（`draft-recovery-workflow.ts:82-90`）→ 用 `startChapterNumber: progress.range.startChapter` 重跑 → `batch-chapter-workflow.ts:272` 把 `progress.currentChapterRunHandle`（仍指向第 13 章那条已 terminated 的 run）当 `resumeHandle` → `generation-run-repository.ts:789-791` 拒：`GENERATION_RESUME_REFUSED`。
- 重新开批：起始章默认仍是第 12 章 → `batch-chapter-workflow.ts:245-251` 抛「第 N 章已有草稿，批量创作不会覆盖既有内容」。

目标：**让两条路都不再指错方向**，作者不用点了才看到报错。

## 3 三件活（缺一不可）

### 3.1 终止批次禁用「继续此批次」并写明出路

位置：`src/components/panels/AIOutputPanel.tsx:445-454`。现状只判 `disabled={busy || !batch.sourceCurrent}`。

要做的：
- 批次已终止时：按钮**禁用**，并在卡片里写一句出路（中文 + 英文双写），例如「本批次已终止，请从第 N 章重新开一批」（N 用真实下一页/下一章号，不要写死）。
- **先取证「批次已终止」在渲染层怎么判定**：已知 `GenerationBatchHistory`（`src/shared/generation-owner-contract.ts:322-324`）= `GenerationBatchProgress` + `sourceCurrent`，**没有 status / terminated 字段**；`visibleBatches` 来自 `ipc … 'generation:list-batches'`（`AIOutputPanel.tsx:318`）。请读主进程侧该 channel 的返回结构与 `generation:list-runs` / `get-run-status` 之类是否已有 run 状态，**用已有信息组合判定**（例如 root run 状态为 failed/cancelled）。
- **红线**：不许改数据库 schema、不许改 `generation_batches` 语义、不许改 run 状态机、不许改 `aborted` 终态语义。如果「已终止」在现有契约里**确实取不到**、必须新增 IPC 字段或主进程改动，**停下来写 `## [T1] BLOCKED`**，附上「读了哪个 channel、返回结构是什么、缺哪个字段、最小改动方案」，不要硬做。
- 若顺手能改 `draft-recovery-workflow.ts` 让已终止批次抛**可区分的新错误码**（不是 `GENERATION_RESUME_REFUSED` 原样抛），可以做——但**只在纯渲染层可达的前提下**，且不得改 `batch-chapter-workflow.ts` 的章循环语义。

### 3.2 重新开批的起始章默认取「第一张没有草稿的章」

位置：`src/components/dialogs/BatchChapterCreationDialog.tsx`。
现状：`:106` `const start = authoritativeStart ?? startChapterNumber ?? 1`；`authoritativeStart` 来自 `readAuthoritativeNextChapter`（`src/services/authoritative-chapter-sequence.ts:36`，取「最后一章已定稿 + 1」）。所以第 12 章有 draft 未定稿时，起点仍是 12 ⇒ 必撞「已有草稿」。

要做的：
- 起点改为「第一张**没有草稿**的章」：从权威下一章起，若该章已有草稿（含草稿待审的 draft），顺延到没有草稿的章（连续顺延，不是只跳一章）。
- **纯函数优先**：把「给定权威下一章 + 已有草稿的章号集合 → 起始章」抽成可单测的纯函数（放哪自己判断，倾向 `src/services/` 下与 `authoritative-chapter-sequence.ts` 相邻）；界面只负责取数据 + 调函数。
- 读草稿列表用**已有** IPC（自己找 `db:draft-*` 里合适的只读 channel），不要新造 channel。
- 判据边界：不能因为某章有草稿就把起点推到很后面导致「跳过还没写的章」；也不能在完全没有草稿时改变现有行为（仍等于权威下一章）。

### 3.3 单测覆盖两处判定（纯函数优先，避免 UI 测试）

- 3.2 的起始章纯函数：至少覆盖 ① 无草稿→权威下一章；② 下一章有草稿→顺延；③ 连续多章有草稿→顺延到第一个空章；④ 有草稿但中间某章无草稿时停在该章。
- 3.1 的「批次是否已终止」判定：同样抽纯函数，覆盖 ① 进行中批次→可继续；② 已终止批次→阻断且给出路文案键/章号；③ `sourceCurrent=false` 仍走原提示（两条理由不互相覆盖）。
- **不要**新增 `.browser.tsx` 测试，**不要**跑 `AIOutputPanel.main-recovery.browser.tsx`。参考既有非 browser 测试写法：`src/services/workflows/__tests__/batch-chapter-workflow.test.ts`（`vi.mock` 风格）、`src/services/__tests__/authoritative-chapter-sequence.test.ts`。
- 测试文件放 `__tests__` 邻目录，命名 `*.test.ts`。

## 4 报告：`wt-2/.batch/batch-resume-plan-a-20261109.md`

必须含：

1. **改了哪些文件**：`路径:行` 逐条，每条一句话说明改了什么；并明确「没有第 N 个文件以外的改动」。
2. **改动边界证明**：`git diff --stat` 原文 + 一句话确认「没碰 run 状态机 / 没碰数据库 schema / 没碰 `generation_batches` 语义」。
3. **两处判定的落点**：3.1 的「已终止」信号来自哪个 IPC/字段（贴返回结构关键行）；3.2 的纯函数签名 + 调用点。
4. **单测命令与真实输出**：每条命令 + 原样 stdout（`Test Files 1 passed` / `Tests N passed` 那几行），**不要只写「通过」**。
5. **未做的事 / 不确定项**：至少回答——① 批次编号会变（甲方案已知缺点），界面有没有说清楚；② 第 13 章这种「模型弱点导致失败」的章，重开一批会不会再撞同一章、有没有提示；③ 有没有你判断该做但本批没做的（例如乙方案）。
6. 中间产物（探针脚本、临时文件）若留下了，列出来；否则写「无」。

## 5 收尾

回复正文按此顺序写，缺段视为未完成：

1. **红线复述**（三条，见 §0）。
2. **改动清单**（`路径:行` + 一句话）。
3. **执行记录**（每条命令 + 真实输出）。
4. **判定落点摘要**（两处判定各一段）。
5. **未做的事**。
6. 最后一行：`## [T1] DONE <一句话>` 或 `## [T1] BLOCKED <卡在哪>`。
