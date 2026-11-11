# 下一批立项 · D9 / D16 结构设计（2026-11-07 作者裁「丙」拆出）

> 状态：已裁定（2026-11-07 · 立项，代码未开工；**先讨论结构、再落地**）
> 日期：2026-11-07
> 用途：下一批「先讨论什么、验收什么、红线是什么」。**不是任务书**，不含可直接派单的改点清单；§2 的挂点 / 事实源全是候选，不是已定方案。
> 上级：[`2026-11-07-batch-acceptance-plan.md`](../design/product/2026-11-07-batch-acceptance-plan.md) §1.4 / §3.3 / §4.5 · [`live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md) §2 后的「2026-11-07 B 组」节 · [`2026-11-07-batch-a-bc-handoff.md`](./2026-11-07-batch-a-bc-handoff.md) §4.1

---

## 0 为什么单独开一批（产品语言）

作者点了「生成」，某次模型调用卡住 12 分钟没反应 ⇒ 期望 10 分钟后界面明确说「这次调用死了」、留下失败记录、能重发（**D9**）。作者把模型切到 A、实际某次回退用了 B ⇒ 期望状态栏显示真正跑过的 B，重启 APP 后仍是 B（**D16**）。

本批 B 组把超时判断、三态文案、失败终态、状态栏模型文案都写成了模块，68 例单测全绿、`tsc` 0 error；但换身份独立复核发现：**D9 的两个入口生产零调用点，D16 的正文生成主链路根本不写实际模型快照** —— 产品行为一点没变。执行方标「5 条全交付」不成立，复核判 D9/D16「验收没兑现」、无「打坏原来能用的」。

作者 2026-11-07 19:19 裁「**那就丙**」＝拆批：本批只收 D4/D10/D11，D9/D16 结转本文，**先定结构再动代码**。

## 1 硬性前提（不改判据、不虚报）

1. **判据沿用缺陷稿原文**，不因本批取证重写：D9 = 单次调用可配置上限 + 三态 + 中止复用 D2 失败终态、`generation_runs` 不留 `running`/`paused`；D16 = 状态栏读实际调用事实源、不读配置当前选中值。
2. **现有 `wt-2` 模块不得据此销账**：它们是孤立实现，下一批可以复用、也可以推翻；在真实链路接通前，缺陷稿 D9/D16 保持 **⬜ 不销账**。
3. **证据保留**：`wt-2/.batch/b-report.md`（371 行）、`wt-2/.batch/b-review.md`（332 行）、`git -C wt-2 diff` 原始改动，保留至本批第三方复核签核后；本批不合并、不清理（计划稿 §5.3 覆盖交接稿 §8）。
4. **不代持排序权**：本文只写「下一批要讨论什么」，不替作者定长期轻重。

## 2 必须先裁定的结构问题（不裁定不动代码）

### 2.1 D9：超时挂在哪一层

| 待裁 | 为什么必须先定 |
|---|---|
| 挂点：单次模型调用边界 / 生成命令层 / 主进程 owner 层 | 判据要求「中止复用 D2 失败终态落库」，而失败终态由 owner 层 `seal(rootId,'failed')` 统一收口；挂错层会出现两套失败路径（多源真相） |
| 与 D2 租约 / 启动 fence / 用户主动中止的关系 | 三者都可能让同一次调用中途结束；不先定谁优先，会出现「超时把已中止的 run 再封一次」或「主动中止后超时仍计时」 |
| 计时对象是一次模型调用还是一个生成单元 | 缺陷现象是「第 10 章大纲调用 12 分钟未返回」；若按单元计时，正常的长批次会被误杀 |
| 超时后的 UI 出口 | 三态文案在模块里已有，但没有生产消费点；要定「谁把『超时已中止』送到界面」以及重发走哪条既有路径 |

**取证起点（只读，不是改点）**：`generation-runtime.ts` 的 `beginModelExecution` / `createWorkflowMainGenerationRuntime`、`main-generation-owner.ts:257` 的启动 fence、`finalization-generation.ts` 的失败收口、[`d2-run-lease-abort-design.md`](../design/features/d2-run-lease-abort-design.md) §9.1。

### 2.2 D16：实际模型的事实源与写入时机

| 待裁 | 为什么必须先定 |
|---|---|
| 事实源取持久化 `modelReceipt` 还是渲染期 lease 投影 | 现有实现取后者且明写不落库 ⇒ 重启后回退配置值，缺陷现象复现。判据「不读配置当前选中值」要求重启后仍成立 |
| 快照写入时机：`createDefaultEnvironment()` 之外的 main-owned 链路在哪写 | 正文生成 `generate-draft.command.ts:1233-1236` 传 `mainRequest` 走 `createWorkflowMainGenerationRuntime`，**不经过** `createDefaultEnvironment()` ⇒ 现有 `recordActualModel` 完全不触发 |
| 「无实际调用记录」时显示什么 | 现有代码仍读 `useLLMStore` 算兜底；若保留，等于承认「可以读配置选中值」，与判据冲突 |
| 字段名口径 | `generation_runs` / `generation_attempts` 无独立 `model` 列；实际在 `binding_json.sourceManifest.modelReceipt.{modelId,modelName}`（主进程 `modelProjection()`）与渲染期 `lease.{modelId,modelName}`。任务书括号里的「`model` 字段」是提示性口径，**按取证写死但不改判据** |

## 3 下一批验收（写死，不许「先取证再定」）

| # | 判据 | 复核方法 |
|---|---|---|
| **N1** | 结构方案先出稿并经作者裁定，才动代码 | 设计稿 + 裁定留痕；`git log` 顺序 |
| **N2** | D9 真实链路可达：造一次真挂起（或假时钟驱动真实入口）⇒ 界面出现「超时已中止」、run 落 `failed`、不留 `running`/`paused` | CDP 真点 APP 或真实链路单测 + 实机；**不接受只在孤立模块里跑三态** |
| **N3** | D16 重启后仍显示实际调用模型；构造「配置 A / 实际 B」⇒ 显示 B，且删掉快照写入行单测会红 | 真实链路单测 + 实机 |
| **N4** | 不新增 throw / 拦截；新规则只告警不阻断；不把卷数 / 章数做成硬约束；prompt 模板零改动 | `git diff` |
| **N5** | 改代码同提交同步缺陷稿状态行 / §2 表格 / 现值行 / 计划稿；`check:fast` 全绿 | `node scripts/check-doc-placement.mjs --status-of` 列全部位置后逐处 grep |
| **N6** | 实机验证由执行 Agent 自己做，不写「作者实机 / 待复验」；完成换身份复核，不自行 `done` | 报告 + 看板 `review` 记录 |

## 4 顺带处理（本批第三方签核后、合并 D4/D10/D11 时）

- **3 处 browser 旧文案断言同步**：`CodeMirrorEditor-generation.browser.tsx:331`、`AIOutputPanel.main-recovery.browser.tsx:144/:374`；不同步则跑 `test:browser` 会红。**不是验收没兑现，是合并前置。**
- **澄清 D4 判据列「6 处」**：`VersionHistory.tsx:281` 是 `dependencies_stale`、`ArchFileViewer.tsx:1071` 是 `writeState.kind==='blocked'`，都不是 `sourceStatus` 驱动；严格按「6 处都要两条文案」卡需先澄清判据。
- **D10 现象未闭环**（回执事件零订阅方、残留宿主未定位）与 **D11 定稿态取法**（`chain.status` 投影 vs 直读 `synopsis_incomplete`）：按作者裁定决定补做 / 结转，**不在下一批默认夹带**。
- 看板 5 张卡保持 `todo` 直到代码合并主区（台账不领先于代码）。

## 5 红线

1. **结构设计先讨论、再落地**：本文列出的挂点 / 事实源都是候选，不是已定方案；一次成型必偏。
2. **不自己创造概念、不自己制造判据**：先查行业定义与既有实现，见 [`industry-alignment-and-stage-goals.md`](../design/architecture/industry-alignment-and-stage-goals.md) §2 术语对照 / §5 四问清单。
3. **技术服务于产品**：判「兑现」只看产品行为是否真的变了，不看单测绿不绿 —— 本批 68 例全绿却两条没兑现，就是这个教训。
4. 实机验证由 Agent 自己做；派出去的 agent 只准单元测试；worktree 里禁 `pnpm test:node` / browser / 全量测试。
5. 状态行 / §2 表格 / 顶部分布段逐处核对（`check-doc-placement.mjs --status-of`）；完成定义见 [`documentation-charter.md`](../agents/documentation-charter.md) §6。
6. 真实项目零改动；真生成在项目副本上跑；副本与证据目录保留至第三方签核后。

## 6 与其他文档的关系

- **本批裁决与验收矩阵** → [`2026-11-07-batch-acceptance-plan.md`](../design/product/2026-11-07-batch-acceptance-plan.md)
- **缺陷现值与原始判据** → [`live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md)
- **本批执行过程、环境踩坑** → [`2026-11-07-batch-a-bc-handoff.md`](./2026-11-07-batch-a-bc-handoff.md)
- **D2 租约与失败终态** → [`d2-run-lease-abort-design.md`](../design/features/d2-run-lease-abort-design.md)

---

## 7 落地记录：代码已入库 agent/wt-2，但未接主链路（2026-11-07 21:3x）

作者 2026-11-07 指示「wt-2 属于 WorkBuddy，必须在这边收尾（成果确认 + 提交）」。收尾时逐文件核对，结论如下，**缺陷状态不变**（仍 ⬜ 未销账）：

| 项 | 提交 | 实际情况（核对所得） |
|---|---|---|
| **D16** | `19163d7c` | 只接在 `createDefaultEnvironment().beginModelExecution` 一条路径（`generation-runtime.ts:409` 的 `recordActualModel`）。**正文生成不走这里** —— `generate-draft.command.ts:285` 走 `createWorkflowMainGenerationRuntime(mainRequest)` ⇒ **主路径不触发**，且快照不落库（重启回退配置值）。§2.2 的第四条待裁全部仍然成立 |
| **D9** | `2b621593` | `createSingleCallWatchdog` / `finalizeFailedGeneration` **生产调用点为零**（只被自己的单测引用）⇒ 缺陷症状（长调用无超时、UI 分不清「在算」与「已死」）**未消除**。§2.1 的挂点问题未裁，代码停在「机制就绪」 |

**为什么仍提交**：作者要求把 wt-2 收尾，这 10 个文件是上一窗口已产出的工作成果，留在工作区会丢；提交写在 `agent/wt-2` 分支、**未合并主区**，与丙裁定「本批不合并」一致。

**给下一批的三句话**：① 不许把这两条按「已实施」计读；② D16 的事实源与写入时机见 §2.2，正文链路才是主路径；③ D9 的挂点必须先在 §2.1 裁完再接线，接错层会产生两套失败路径。

**验证证据**：`pnpm test` 4 文件 18 例全过（D16 侧 statusbar 3 例 + StatusBar 5 例；D9 侧 watchdog 2 例 + 内存库终态 2 例 + 其余既有断言）；`tsc --noEmit` 干净；`check:fast` 全绿。**单测绿不等于缺陷兑现** —— 见本稿末尾红线第 3 条。

---

## 8 挂起状态：等 §2 裁完再回来推（2026-11-07 21:4x 作者定）

作者决定：**wt-2 在相当一段时间内不再派给外部 agent**，但「**不能忘了这一批产物**；§2.1 / §2.2 的四个结构问题裁完后还得继续把这个推完」。

- 两条**不结项、不销账、不合并**：代码停在 `agent/wt-2` 分支（`19163d7c` → `2b621593`），主区未动。
- 回归条件：§2.1（D9 挂点）与 §2.2（D16 事实源 + 写入时机）四个问题裁完 ⇒ 回来接线 ⇒ **实机复验**。接线与单测都不算兑现。
- 台账位置：`.workbuddy/memory/notes/current-status.md`「★★ wt-2 这批产物：挂起，不许遗忘」，开工读进行中会看到，不依赖本稿被翻到。
- **风险提示**：wt-2 槽位转给外部 agent 时，`agent/wt-2` 分支若被 reset / 重建，这批产物就没了 ⇒ 转交前先确认分支仍在（`git -C ../wt-2 log --oneline -1` 应见 `2b621593`）。

---

## 9 实施记录：D16 展示层接上事实源（2026-11-11）

> 状态：**已实施**（2026-11-11）。D9 本轮**不动代码**，只补登记（见 §9.4）。

### 9.1 动因：§2.2 裁完、代码合了，但现象还在

2026-11-09 的 `155efe4d` 只覆盖渲染层路径。2026-11-11 首轮实机（`.runtime/night/20261111/a2-d16-recheck.md`）确认：DB 回执已经是实际模型（`deepseek-flash` / `88cd3187…`、`status: completed`、默认模型 A 未改），**状态栏恒显示配置值 A**，`useActualModelStore.actual === null`。

真因两条：

1. `MainGenerationSnapshot` 里**没有任何模型字段**；
2. `recordActualModel` 的唯一调用点（`generation-runtime.ts:409`）在**渲染层路径**上，而正文写稿走 `base-command.ts:154` → `createMainOwnedGenerationRuntime`，主进程持租约这条路不经过它。

### 9.2 方案选择：不动 snapshot，改从 binding 投影

§2.2 当时倾向「快照补 `modelId`」。本轮**不采用**，理由是 `MainGenerationSnapshot` 被 5 类 owner run（正文 / 审阅 / 编辑器内联 / 导入 / 定稿）共用，加字段要扩散到全部 fixture，收益却为零——真正需要的「重启后仍显示」本来就不靠快照：

- `generation_runs.binding_json` 是**持久化**的，`viewOf()` 就是**从它投影**的 ⇒ 把模型挂在运行视图上，重启后读到的还是同一份数据，**N3「重启后仍显示」自动成立**；
- `list()` 与单个 `read()` 走同一个 `viewOf`，不需要第二条通路。

### 9.3 落地清单

| 位置 | 改动 |
|---|---|
| `src/services/generation/generation-runtime.ts` | `MainGenerationRunView` 增**可选** `model?: { modelId; modelName }`（可选 ⇒ 不打破既有 fixture 与 mock） |
| `electron/services/main-generation-owner.ts` | 新增 `viewModel(binding)` **宽容读**；`viewOf` 投影进去；新增 `lastModel()`（按 `created_at_ms` 倒序扫最近 50 条，取本项目第一条带回执的） |
| `electron/controllers/generation-controller.ts` | 注册 `generation:list` 同级的 `generation:last-model` |
| `src/shared/generation-owner-contract.ts` | 补通道类型声明 |
| `src/services/generation/actual-model-hydration.ts` | **新增**：开项目 / 切项目时回填；无会话则 `clearActualModel()` |
| `src/App.tsx` | `useEffect` 依赖 `currentProject` 调 `hydrateActualModel` |
| `src/services/workflows/workflow-main-generation.ts` | `open()` 后 `if (view.model) recordActualModel(view.model)` |
| `src/shared/statusbar-model.ts` | `statusbarModelCopy` 增 `source: 'actual' | 'configured'`，tooltip 分档 |
| `src/components/layout/StatusBar.tsx` | 显示名按 `modelId` 反查 `useLLMStore.models` 昵称 → 兜底回执 `modelName` → 兜底 `modelId` |

### 9.4 与原计划的两处偏差（都已实测确认）

1. **hydration 不走 `transport.list()`。** 计划 §2.2 原写「`main-generation-transport.ts:49` 的 `list()` 返回后取首个带 model 的 view」。实测 `list()` 返回**每个 run 的全部产物全文**，启动期拉不可接受，且生产代码对 `list()` 是**零调用**（走它等于把一条没用过的路径变成启动关键路径）。改为新增轻量通道 `generation:last-model`，只回 `{modelId, modelName}`。
2. **切项目清理不走 `useProjectStore.subscribe`。** 改为 `App.tsx` 里依赖 `currentProject` 的 `useEffect`，与既有 `recoverFromImageFailure` 同一挂法，少一个订阅生命周期要管。

### 9.5 验收状态

| N3 判据 | 单测 | 实机（2026-11-11 晚） |
|---|---|---|
| 重启后仍显示实际调用模型 | ✅ `main-generation-owner.test.ts` 两条（含 `reopen()` 后读回同一 model） | ⚠️ **只验到「持久化回执可重读」，未验整机重启**：`location.reload()` 只重建渲染进程，主进程 / 项目库 / owner 全是热的。`reload()` 后 `actual` 重新非空且值不变，能证明值来自持久化回执（渲染层 store 是纯内存、无语义记忆），但不覆盖主进程重建、`epoch` / `leaseId` 重建、以及冷启动时 `hydrateActualModel(null)` 先行清空这几段 |
| 「配置 A / 实际 B」⇒ 显示 B | ✅ `workflow-main-reasoning.test.ts` 新增用例（删写入行必红） | ⚠️ **未直接观察到**：该项目最近一条 run 是 A，显示 A 与配置值相同，区分不出「读实际」与「读配置」。构造副本被「项目未获授权」闸门拦住，未绕过。**注意这条是推断不是观测**：当时依据是「12:50 / 12:51 两条 A 的 cancelled run 比 12:41 的 B 更晚」，但 `cancelled` 不等于发生过调用——代码本身有 `cancelled-before-dispatch → not-dispatched` 映射（`main-generation-owner.ts:288`），查那两条的 attempt 状态才能定案，而证据里没有这一列 |
| 整机重启（退出 Electron → 重启 → 重开同一项目） | — | ⬜ **未做**（需起应用）。补验时应同时记录「启动到重开项目之间」状态栏是哪一档——按实现应为「配置」，这不算错，但与判据字面不同 |
| 删掉快照写入行单测会红 | ✅ 同上 | — |
| 启动期回填通路 | — | ✅ 无生成、纯内存 store 却从 `null` 变为非空 ⇒ 只能来自 `generation:last-model` |
| tooltip 分档 | ✅ `statusbar-model.test.ts` | ✅ 「（配置）」↔「（实际调用）」两态实测切换，可见文本不变 |
| 显示名昵称反查 | — | ✅ DB 内 `qwen3.5:9b-128k`，状态栏显示 `Ollama/qwen3.5:9b-128k` |

完整读数与未验项理由见 [`2026-11-11-night-evidence/d16-impl-verify.md`](2026-11-11-night-evidence/d16-impl-verify.md)。

### 9.6 D9 本轮登记（不改代码）

原始现象（12 分钟无响应无提示）**已由固定 10 分钟上限解决**（`generation-run-service.ts:205-207`，`5e031021`）。判据里还剩「上限可配置」未兑现：现行上限写在 `RootBudget` 之外，要扩成 per-call 可配，得动冻结的 budget 键集（`main-generation-plan.ts:188-190` 要求键集与冻结常量**完全相等**）并新增 `readMainGenerationPolicy` 的 version 分支——属结构性改动，需另裁，本轮只登记不实施。

### 9.7 附带发现：便携字段策略漏登记 3 列（既有问题，已修）

跑测试时撞到 2 个红，`git stash` 对照确认**与本轮 D16/B16 改动无关**（基线同样红），根因已定位：

- **现象**：`portable-project-format.test.ts` 期望 `{tables: 66, fields: 635}`，实际 **638**；`generation-controller.test.ts:716` 的 `exportPortableProject` 直接抛 `PORTABLE_SCHEMA_UNSUPPORTED`。
- **根因**：`a5bdd184 feat(d2): generation_runs 执行租约` 给 `generation_runs` 加了 3 列 —— `execution_owner` / `execution_epoch` / `lease_expires_at` —— **没登记进 `electron/services/portable-project-field-policy.json`**。`assertPortableSourceSchema` 是 fail-closed 校验（DB 实际列必须全部出现在白名单里），因此整张表被拒。
- **影响面**：不只是测试红 —— `exportPortableProject` 是**项目导出 / 便携备份**的入口，运行时走同一断言 ⇒ 当前分支的**项目导出功能实际不可用**。
- **修法（2026-11-11 作者点头后已实施）**：3 列按 `import_runs` 同义字段的先例登记为 `X`（`exclude-machine-authority`，租约是机器权威、跨机无意义），并把 `portable-project-format.test.ts` 三处计数期望同步（`66/635 → 66/638`、`added 280 → 283`、`m01-m05-delta 123 → 126`）。
- **口径更正（2026-11-11 豆包复核）**：先前写「导入时重建（`target-machine-rebind`）」**没有实现支撑**——导出只做 **neutral 化**（`project-archive-service.ts:913-949` 的 `updates` + `neutralValue()`：`INT NOT NULL → 0`、`TEXT NOT NULL → ''`），导入侧靠列默认值兜底。两个副作用未在此前记录：① 导出时正被持有的 `running` run，导出后 `execution_owner=''`，若该 root 进了 `portable-runtime-freeze.json` 则 fence 跳过（`generation-run-repository.ts:817`）⇒ 永久停在 running 且无人持有；未冻结则落 `aborted` 终态（`:840-841`，而 `aborted` 不可 resume）。② `execution_epoch` 归零，当前无读取方，将来若拿它当接管次数判据会失真。
- **这是第二次同类疏漏**（M22 漏登记 `summary_snapshots.knowledge_candidates` 出现过一次）。加列时「改 schema、改迁移、忘了改字段策略」是复发点，闸门在 `portable-project-format.test.ts` 的首条用例——**加列后跑它就够**。

### 9.8 独立复核（豆包，2026-11-11 夜）与据其修正

**方式**：走豆包电脑版通道（`scripts/doubao/`），新开线程，只读审计，禁跑任何测试。豆包选的项目是 `wt-1`（分支 `agent/wt-1`），与本轮提交不同分支 —— 靠任务书写死「一切阅读带 `git show <hash>:<path>` 前缀、禁读工作区同名文件」，因为 commit 对象共享，不需要切项目。
**产物**：`wt-1/.runtime/doubao-review-20261111.md`（30KB，七问逐条判定 + 原样命令输出 + 指名最弱一环）。

**七个必答题的判定**（均经我方逐条复验，无一条是复核方读错）：

| # | 判定 | 要点 |
|---|---|---|
| Q1 投影的是实际还是请求 | 部分成立 | `main-generation-owner.ts:445` 是 `leases.begin(selection.modelId)` —— 租约按**请求值**建，binding 里的 `modelReceipt` 是「请求回显」不是「执行后观测」。单 run 内两者必然相同（`:657 leases.resolve` 取同一快照），但「主进程可能改写模型」这个动机描述**编的** |
| Q2「重启后仍显示」 | 部分成立 | `location.reload()` 只重建渲染进程，主进程全热；只能证明「持久化回执可重读」，不证明「重启后」。原表打 ✅ 属写过头 |
| Q3 `lastModel()` 边界 | 成立 | ① 不看 `status`/attempt，会把「开了没跑 / 已取消」的 run 当成最近一次实际调用（系统自己有 `cancelled-before-dispatch → not-dispatched` 映射却没用）；② `LIMIT 50` 在跨项目过滤**之前**生效；③ `repository.get` 抛错时 `catch` 静默且**不清空 store** ⇒ 串项目显示 |
| Q4 三列登记为 `X` | 部分成立 | 方向对（租约跨机无意义），但「导入时重建」无实现支撑；导出时正持有的 `running` run 会落 `aborted` 或永久无人持有 |
| Q5 五处计数 | 成立 | 638 / 283 / 126 / 639 全对。口径：policy **639 键** = DB **638 列** + `characters.avatar`（在 `optionalFields` 内、库里无此列） |
| Q6 修实现还是改断言 | 以 (a) 为主，夹一处 (b) | 守卫是真修（`target=null` 时「替换」按钮可用却静默无操作，是独立于测试的用户可见缺陷）；文案改动有硬证据（气泡 `select-none` 且无复制控件）。但**用例名与判据脱钩**：「只复制不替换」的语义在内联层已不存在 |
| Q7 死函数残留 | 代码侧干净，文档侧有 | 代码/测试/导出的 `sourceConflictNoticeText` 只剩墓碑注释；历史证据稿仍按旧行号引用 —— **按「历史不改写」保留，改在墓碑注释里加迁移导航** |

**据其修正（2026-11-11 作者「一次改完」授权）**：

1. `actual-model-hydration.ts` 的 `catch` 补 `clearActualModel()` —— 原注释写「退回配置值」但没写 clear，实现与注释不符。
2. `workflow-main-generation.ts` 的 D16 注释重写：删掉「主进程可能改写模型」的错误动机，改为「binding 是落库的、重启后仍可读的那一份」+ 明确标注它是**请求回显**。
3. 本稿 §9.5 两行实机证据由 ✅ 降为 ⚠️，并补「整机重启」一行 ⬜ 未做。
4. `CodeMirrorEditor-generation.browser.tsx` 用例名改为「…提示重新选中且不替换」，与断言对齐。
5. `scripts/f05-u16-recovery-boundaries-journey.mjs:282` 补显式列名（上一轮只修了 2 个 test + 1 fixture，漏了这条 journey 脚本）。
6. 本稿 §9.7「导入时重建」口径更正 + 补两个未记录的副作用。

**未修（如实登记）**：

- **`hydrateActualModel` 的切项目竞态**：无请求序号保护，连续切换时先发的旧响应可覆盖新值。修法要定「谁算 stale」（按 `session.epoch` 还是单调 token），属设计取舍，另裁。
- **文档 5 处历史引用**（`2026-11-10-r2-fixtures-...:100`、`b16-conflict-copy.md:57,63`、`night-1111-review.md:26,29`、`scripts/night/20261111/*`）：按「历史不改写」保留，导航写在 `source-conflict-copy.ts:44` 的墓碑注释里。
- **`lastModel()` 不看 `status`**：属实现选择（「最近一次请求过的模型」vs「最近一次真派发过的模型」）。若作者要的是后者，得改查询口径并补 attempt 判定，另裁。




