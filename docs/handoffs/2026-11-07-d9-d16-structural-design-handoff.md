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
