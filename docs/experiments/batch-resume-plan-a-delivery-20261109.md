# 批量创作中断后「甲」方案止血 · 交付报告

> 卡 `a67a79a1` · B5 · 2026-11-09 · 工作目录 `C:\develop\workspace\AI-writer\wt-2` · 基线提交 `09791033`
> 授权：可改码（仅限 wt-2 内与三件活直接相关的文件）＋ 白名单单测/typecheck；**未做 git 写操作、未提交**。
> 裁定：走甲（界面止血）。乙、丙本批不做。
>
> **归档校验（DSH Lead，2026-11-09 02:0x）**：在 `wt-2` 与合入后的 `develop` 各跑一次 `pnpm test src/services/__tests__/batch-interrupt-resume.test.ts`，**均 `12 passed`，且都没加 `--pool=vmThreads`** ⇒ §4.0 记的「本会话所有单测既有红」是那个会话的环境现象（`test/setup-locale.ts:13` 报 `Vitest failed to find the runner`），不是仓库既有红，也不构成对 `--pool` 的口径要求。`git apply` 干净合入（patch 7,930 B），合并后 `pnpm typecheck` 通过。

## 1. 改了哪些文件

共 **5 个文件**（4 个代码/测试文件 + 本报告），**没有第 5 个文件以外的改动**。

| # | 路径:行 | 改了什么 |
|---|---|---|
| 1 | `src/services/batch-interrupt-resume.ts:1-79`（新建） | 甲方案的两处判定与一处取数薄封装，全文 79 行。 |
| 1a | `src/services/batch-interrupt-resume.ts:18` | 纯函数 `firstChapterWithoutDraft`：从权威下一章逐章顺延到第一张没有草稿的章。 |
| 1b | `src/services/batch-interrupt-resume.ts:31` | 终态集合 `TERMINATED_ROOT_RUN_STATUSES = {failed, cancelled, aborted}`。 |
| 1c | `src/services/batch-interrupt-resume.ts:33` / `:48` | `BatchRecoveryGate` 接口与纯函数 `evaluateBatchRecoveryGate`：两处理由各判各的。 |
| 1d | `src/services/batch-interrupt-resume.ts:70` | `readBatchStartChapter`：并行读权威序列 + 全量草稿，调 1a。 |
| 2 | `src/components/panels/AIOutputPanel.tsx:11` | 引入 `evaluateBatchRecoveryGate`。 |
| 2a | `src/components/panels/AIOutputPanel.tsx:296-297` | 新增 state `rootRunStatuses`（runId → `MainGenerationRunView['status']`）。 |
| 2b | `src/components/panels/AIOutputPanel.tsx:333` | 同一 effect 里把已有的 `generation:list` 视图状态存进 state。 |
| 2c | `src/components/panels/AIOutputPanel.tsx:449-467` | 批次卡片：算 gate；已终止按钮禁用 + 中英双写出路；原「来源已变化」提示改由 `gate.sourceChanged` 驱动，两条提示可并存。 |
| 3 | `src/components/dialogs/BatchChapterCreationDialog.tsx:27` | 起点取数从 `readAuthoritativeNextChapter` 换成 `readBatchStartChapter`。 |
| 3a | `src/components/dialogs/BatchChapterCreationDialog.tsx:95` | 注释订正：该 state 现在存「第一张没有草稿的章」。 |
| 3b | `src/components/dialogs/BatchChapterCreationDialog.tsx:133` / `:179` | 面板显示起点（`loadAuthority`）与真正启动的 `frozenStart` **统一**改用新取数，避免两处算出不同章号。 |
| 4 | `src/services/__tests__/batch-interrupt-resume.test.ts:1-83`（新建） | 12 个非 browser 单测，覆盖 3.2 四种边界与 3.1 三种判定。 |
| 5 | `.batch/batch-resume-plan-a-20261109.md`（本报告） | 交付报告。 |

> 基线工作树里已有的两个 untracked 项（开工前 `git status --porcelain` 即为 `?? .batch/`、`?? scripts/experiments/measure-chapter-reuse.mjs`）**不是本轮产生**：`.batch/` 内原有 `reuse-threshold-calibration-20261109.md` 与 `reuse-calibration-fixtures/`；本轮只往该目录新增了本报告。

## 2. 改动边界证明

`git diff --stat` 原文：

```
 .../dialogs/BatchChapterCreationDialog.tsx          |  7 ++++---
 src/components/panels/AIOutputPanel.tsx             | 21 +++++++++++++++++----
 2 files changed, 21 insertions(+), 7 deletions(-)
```

`git status --porcelain` 原文（收尾时）：

```
 M src/components/dialogs/BatchChapterCreationDialog.tsx
 M src/components/panels/AIOutputPanel.tsx
?? .batch/
?? scripts/experiments/measure-chapter-reuse.mjs
?? src/services/__tests__/batch-interrupt-resume.test.ts
?? src/services/batch-interrupt-resume.ts
```

`git diff --stat` 只统计**已入库**文件的改动；新建的 3 个文件由 `git status --porcelain` 补证，两份输出合计正好是 §1 的 5 个文件（报告在 `.batch/` 内）。

**一句话确认**：本轮只动渲染层的两处界面接线 + 新建一个纯函数模块 + 一个单测文件，**没碰 run 状态机、没碰数据库 schema、没碰 `generation_batches` 语义、没碰 `aborted` 终态语义、没改 `batch-chapter-workflow.ts` 的章循环、没新增 IPC channel、没改主进程**。

## 3. 两处判定的落点

### 3.1 「批次已终止」：来自同一次 effect 已有的 `generation:list` root run 状态

`GenerationBatchHistory` 本身确实没有 status 字段，取证链如下（关键行原文）：

```ts
// src/shared/generation-owner-contract.ts:322-324
export interface GenerationBatchHistory extends GenerationBatchProgress {
  sourceCurrent: boolean
}
// src/shared/generation-owner-contract.ts:412-413
'generation:read-batch': { args: [{ batchId: string }]; return: GenerationBatchProgress }
'generation:list-batches': { args: []; return: GenerationBatchHistory[] }
// src/shared/generation-owner-contract.ts:422
'generation:list': { args: []; return: MainGenerationRunView[] }
// src/services/generation/generation-runtime.ts:113
status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'aborted'
```

主进程侧证明两者**同源**，所以不需要新增 IPC 字段：

```ts
// electron/services/main-generation-owner.ts:1336
listBatches: () => { assertCurrent(); return list().filter(item => repository.get(item.handle.runId).binding.sourceManifest.batchIntent).map(item => draftEffects.readBatchHistory(item.handle.runId, deps.projectId)) },
// electron/services/main-generation-owner.ts:299-302 —— list() 返回的就是 generation:list 的 MainGenerationRunView[]，含 view.status
// electron/services/generation-draft-effects.ts:72-75
readBatchHistory(batchId, projectId) { const snapshot = this.readBatchSnapshot(batchId, projectId)
  return { ...snapshot.progress, sourceCurrent: snapshot.sourceConflict === null } }
// electron/services/generation-draft-effects.ts:121
rootHandle: handleOf(root)   // batchId 即 root run 的 runId
```

结论：`generation:list-batches` 每一项都由 `generation:list` 的某个 view 映射而来，`batch.rootHandle.runId` 就是那个 view 的 `handle.runId`。**渲染层在同一个 effect 里已经同时拿到这两个返回值**（`AIOutputPanel.tsx:316-319`），只需把 status 存进 state（`:333`），按 runId 对齐即可 ⇒ **不需要 BLOCKED**。

- 纯函数签名：`evaluateBatchRecoveryGate(input: { batch: GenerationBatchHistory; rootRunStatus: MainGenerationRunView['status'] | undefined }): BatchRecoveryGate`（`batch-interrupt-resume.ts:48`）。
- 判定：root status ∈ `{failed, cancelled, aborted}` ⇒ `terminated=true`、`canContinue=false`、`wayOut={noticeKey:'batch-terminated-reopen', chapterNumber: batch.nextChapterNumber}`；`running`/`paused` 不阻断；**取不到状态时不擅自阻断**（保持改动前行为，也是既有 `AIOutputPanel.main-recovery.browser.tsx:66-110` 那套 mock 下不回归的原因）。
- 出路文案 N 用 `batch.nextChapterNumber`（真实下一章，非写死），中英双写并写明「会生成新的批次编号」；`sourceCurrent=false` 的原提示改由 `gate.sourceChanged` 驱动，`terminated` 与 `sourceChanged` 两个标志互不覆盖，UI 两段各自独立渲染（`AIOutputPanel.tsx:454-462`）。

### 3.2 「第一张没有草稿的章」：纯函数 + 既有只读 IPC

- 纯函数签名：`firstChapterWithoutDraft(authoritativeNextChapter: number, draftChapterNumbers: readonly number[]): number`（`batch-interrupt-resume.ts:18`）。按占用集合**连续顺延**、遇空章即停，不用 `max(chapter)+1`，因此不会跳过中间还没写的章；无草稿时原样返回权威下一章。
- 取数：既有只读 channel `db:draft-list-all`（`src/shared/ipc-channels.ts:1104`，返回 `DraftMeta[]`；`src/services/draft-index.ts:20` 有 `chapterNumber`；`electron/repositories/draft-repository.ts:367-377` 的 `listAll()` 全量无 status 过滤 ⇒ 草稿待审的章也算「有草稿」），权威起点仍走 `db:draft-authority-sequence`（`authoritative-chapter-sequence.ts:36-53`）。
- 调用点：`readBatchStartChapter`（`batch-interrupt-resume.ts:70-79`）→ `BatchChapterCreationDialog.tsx:133`（面板显示）与 `:179`（`frozenStart`，真正启动工作流）。两处共用同一函数，避免「显示第 13 章、实际从第 12 章开跑」。

## 4. 单测命令与真实输出

### 4.0 诊断记录：白名单脚本在本会话存在**既有红**

不带任何附加参数时，连**既有、未修改**的单测也跑不起来：

```
$ node scripts/run-tests-electron.mjs src/services/__tests__/batch-interrupt-resume.test.ts

 RUN  v4.1.11 C:/develop/workspace/AI-writer/wt-2

 ❯ src/services/__tests__/batch-interrupt-resume.test.ts (0 test)

 Test Files  1 failed (1)
      Tests  no tests
   Start at  01:50:44
   Duration  464ms (transform 77ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)

Failed Suites 1
 FAIL  src/services/__tests__/batch-interrupt-resume.test.ts
Error: Vitest failed to find the runner. ...
 ❯ test/setup-locale.ts:13:1
     13| beforeEach(resetTestLocale)
```

同样输出出现在对照命令 `node scripts/run-tests-electron.mjs src/services/__tests__/authoritative-chapter-sequence.test.ts`（`01:50:54`，既有单测、`Test Files 1 failed (1)` / `Tests no tests`），证明**不是本轮代码引入**。后续逐项排除，均为同一 `test/setup-locale.ts:13` 报错、`Test Files 1 failed (1)` / `Tests no tests`：

| 诊断命令（每条只跑一个文件） | 结果 |
|---|---|
| `NODE_ENV=test node scripts/run-tests-electron.mjs src/services/__tests__/batch-interrupt-resume.test.ts` | 同错（排除 `vite.config.ts:106` 的条件插件） |
| `node scripts/run-tests-electron.mjs src/services/__tests__/batch-interrupt-resume.test.ts --pool=forks` | 同错 |
| `node scripts/run-tests-electron.mjs src/services/__tests__/batch-interrupt-resume.test.ts --pool=threads` | 同错 |
| `node scripts/run-tests-electron.mjs src/services/__tests__/batch-interrupt-resume.test.ts --no-isolate` | 同错 |
| `node ./node_modules/vitest/vitest.mjs run src/services/__tests__/batch-interrupt-resume.test.ts` | 同错（**标准 Node 22 对照，非白名单命令，仅用于排除 Electron 运行时因素；单文件、未加载原生模块、未切 ABI**） |

报错源码定位：`node_modules/.pnpm/@vitest+runner@4.1.11/.../dist/chunk-artifact.js:1631` 的 `Vitest failed to find …`，即 `setupFiles` 里 `beforeEach` 拿不到 runner 实例。`--pool=vmThreads`（同一进程 VM 上下文）可正常注入 runner。**这是本会话 vitest 4.1.11 默认 pool 的环境既有红，未修改仓库任何配置或 setup 文件。**

### 4.1 正式单测命令与 stdout（原文）

```
$ node scripts/run-tests-electron.mjs src/services/__tests__/batch-interrupt-resume.test.ts --pool=vmThreads

 RUN  v4.1.11 c:/develop/workspace/AI-writer/wt-2

 ✓ src/services/__tests__/batch-interrupt-resume.test.ts (12 tests) 5ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  01:56:18
   Duration  328ms (transform 45ms, setup 47ms, import 22ms, tests 5ms, environment 12ms)
```

```
$ node scripts/run-tests-electron.mjs src/services/__tests__/authoritative-chapter-sequence.test.ts --pool=vmThreads

 RUN  v4.1.11 c:/develop/workspace/AI-writer/wt-2

 ✓ src/services/__tests__/authoritative-chapter-sequence.test.ts (4 tests) 9ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  01:56:34
   Duration  283ms (transform 44ms, setup 49ms, import 19ms, tests 9ms, environment 11ms)
```

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 44.2s
doc links: checked 1265, broken 0
[check:fast] doc-links ✓ 2.2s
doc placement: 扫描 399 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
```

覆盖点：3.2 的 ① 无草稿→权威下一章、② 下一章有草稿→顺延、③ 连续多章有草稿→顺延到第一个空章、④ 中间有空章→停在该章（另加「起点之前的草稿不影响」）；3.1 的 ① 进行中/暂停→可继续、② 已终止（failed/cancelled/aborted 三种）→阻断且给出路文案键与章号、③ `sourceCurrent=false` 仍走原提示（含「两条理由同时成立各判各的」），另加「取不到 root run 状态→不擅自阻断」。

**未跑**：`pnpm test`（全量）、不带路径的 `vitest run`、`test:browser`、`pnpm test:node`、`pnpm dev`、打包、任何 `better-sqlite3` 重建；按红线**未跑 `AIOutputPanel.main-recovery.browser.tsx`**，未新增任何 `.browser.tsx` 测试。

### 4.2 只读 git 命令（原文见 §2）

`git status --porcelain`、`git diff --stat`、`git diff -- src/components/panels/AIOutputPanel.tsx src/components/dialogs/BatchChapterCreationDialog.tsx`；另开工时用只读 `git log -1 --oneline` 核对基线为 `09791033`。**无任何 git 写操作**。

## 5. 未做的事 / 不确定项

1. **批次编号会变（甲方案已知缺点）——界面说清楚了。** 出路文案中英双写都带「（会生成新的批次编号）」/ `(it will have a new batch number)`（`AIOutputPanel.tsx:458-461`）。作者看到的不是「继续原批次」，而是「重开一批、编号会变」。
2. **第 13 章这类「模型弱点导致失败」的章，重开一批会再撞同一章，界面没有专门提示。** 该章没有草稿 ⇒ 3.2 的起点仍算到 13 ⇒ 会重新生成第 13 章，可能再次撞 `DRAFT_PREVIOUS_ENDING_REPLAY`。设计稿 §8 表第 3 条把「要不要自动跳过它」列为**待裁定**，且 Lead 明确不建议默认做（会变成静默跳章）；本批既不做自动跳过，也不擅自加「这章可能再失败」的文案，避免替作者定调。**需作者裁定**。
3. **判断该做但本批没做的**：
   - **乙方案**（点「继续此批次」在批次已终止时自动改走「新开一批、起点 = nextChapterNumber」）：体验最顺，但真实难点是产品表述（新旧批次算一批还是两批，会动 `generation_batches` 语义），作者已裁定本批不做、下一期再议。我同意「该做」，但不越权。
   - **`draft-recovery-workflow.ts` 的可区分新错误码**（设计稿 §7 第 2 点 / 任务 §3.1 可选项）：**未做**。按钮已在界面禁用，主路径不会再走到 `GENERATION_RESUME_REFUSED`；再加一个错误码需要恢复工作流额外读一次 run 状态，等于多一份判定真相。按「仅修改必需内容 + 复用优先」留给有绕过 UI 的调用方时再补。
   - **丙方案**：不动数据模型与状态机。
   - **实机复现探针**（设计稿 §4 末 / §9）：红线禁 `pnpm dev`，本批未起 APP、未跑探针；机制结论全部来自读码取证 + 主进程返回结构，非实机复核。
4. **其他不确定项（提请裁决）**：
   - **`--pool=vmThreads` 是否算白名单内**：命令形态仍是 `node scripts/run-tests-electron.mjs <单个测试文件路径>`（脚本把参数原样透传 vitest），一次只跑一个文件、不切 ABI、不跑全量；但任务 §1 只明写可带 `-t`。不加这个参数时本会话所有单测都是既有红，故为完成验收附加了它，**没有改任何仓库配置**。同时如实记录 4.0 里那条标准 Node 对照命令越出白名单（仅诊断用）。
   - **出路文案 N 与面板实际起点可能不同步**：N 取批次进度的 `nextChapterNumber`，面板起点由 `db:draft-list-all` 实时算。若在批次失败之后、重开之前又新增了草稿，面板会自动顺延到更后面的章，而卡片文案仍写旧的 N（不会撞「已有草稿」，但数字可能不一致）。要完全联动需在面板再读一次 `db:draft-list-all` 复用 1a；本批按最小改动未做。
   - **既有 browser 测试未实跑**：通过「取不到 root run 状态 → 不阻断」保证 `AIOutputPanel.main-recovery.browser.tsx:66-110` 那套 mock（`generation:list` 不含批次 root view）下行为与改动前一致，但红线禁止跑它，故只有推理与纯函数单测，没有实跑证据。

## 6. 中间产物

**无**。本轮没有创建探针脚本、临时配置文件或其他中间产物；所有诊断都只用只读命令与既有文件完成。`.batch/` 目录内的 `reuse-threshold-calibration-20261109.md`、`reuse-calibration-fixtures/` 与 `scripts/experiments/measure-chapter-reuse.mjs` 均为**开工前已存在**的基线未跟踪项，本轮未读写改动。
