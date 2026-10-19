# E3 逐单元生成 · 工间交接（2026-10-20）

> **用途**：上下文过长时的接力点。**先读这一页，再读拆解稿**，防止目标漂移。
> 分支：`exp/arc-tree-v2` · 代码 HEAD：见 `git log`（T4b 之后）· 工作区：干净
> 进度：**9/11 步完成** + 插入步 **T4c**（弧位按游标 / 写完判据）；剩 T8 / T10 / T11，另有 4 个待定项（§8）。
> 主设计稿：[`docs/design/architecture/e3-unit-batch-implementation-plan.md`](../design/architecture/e3-unit-batch-implementation-plan.md)（T1–T11 + §9 决策 + §10 实施记录）
> 口径稿：[`volume-quota-context-budget-design.md`](../design/architecture/volume-quota-context-budget-design.md) §6.2 / §7.1 · 实测：[`unit-budget-prompt-ab-test.md`](../design/architecture/unit-budget-prompt-ab-test.md) §13

---

## 1. 目标（不要漂移）

**E3 = 情节大纲的批次从「第 from–to 章」改成「一个单元」。** 请求期只给 `{ from, unitIndex, maxChapters }`（**没有 `to`**），生成后解析实际章数、回填 `to`、推进**显式游标**。

作者 2026-10-20 裁定：**E3 是全项目 Top 优先**——它关系大纲 → 蓝图 → 正文三段生成，是与原系统接驳的最后一环；**先把整个流程打通，再做改善与升级**。

**不在本线**（别顺手做）：T11 卷末快照（E4 内部第一）、T9 按卷冻结（后放）、T10 全量清除补弧光（作者确认搁置）、回滚/定稿撤销（单独立项）。

---

## 2. 已完成（含插入步 T4c，都有 commit，全部单测 + tsc 绿）

| 步 | Commit | 内容 | 单测 |
|---|---|---|---|
| T1 | `c6c487dd` | `planUnitStats` / `unitRemainingStateOf` / `renderUnitBudgetBlock`（arc-position） | 18 条 |
| T2 | `69a2c208` | `ArchitectureUnitRange` + intent `synopsisUnit`；`plotOutlineUnitPolicy`（无 `to` 放行、互斥） | 13 条 |
| T3 | `378a05f4` | 主进程：intent 归一化 + 根预算 = `priorSteps + 2 × volumeRemaining` | 7 条 + 94 回归 |
| T7 | `6f903c95` | 检查点 `synopsis_unit_cursor` + 旧检查点一次性迁移 + 三处落盘点同步 | 5 条 + 47 回归 |
| T5/T6 | `641afd27` | `synopsisUnitInstruction`（无 from–to 区间）+ `renderUnitBudgetBlock`（余量行常驻 + `r` 阈值） | 3 + 5 条 |
| T4a | `549dee9c` | `computeSynopsisUnitRange` + command/workflow 选项管道 | 5 → **8 条**（修订后） |
| T9 | `83c49ca5` | `backfillUnitBatch`（数实际章数、越界 clamp）+ `advanceUnitCursor`（跨卷推进） | 8 条 |
| 决策 | `88020fa9` | T4b 前置决策稿（指纹口径，方案 D **已确认并修订**） | — |
| T4b | `89d0bfcc` | 状态机接线：单元定位 / 提示词 / 回填 / 游标 / 指纹闭环 | 5 条集成 |
| T4c | 见 `git log` | 弧位**按游标**定位（`arcSpanForUnit` / `withProjectedUnitArcGuide`）+ 写完判据改骨架 + 修投影 no-op | 9 + 5 条 |

**关键**：单元模式仍**没有生产调用方**（没人传 `synopsisUnit`），旧路径逐字节不变；开关在 T11。

> **T4a 修订（2026-10-20，探针驱动）**：原 `computeSynopsisUnitRange` 用 `arcSpanForChapters` 反查弧位并要求与游标一致。
> 探针实测：单元实际写 12 章（计划 15）⇒ 返回 `null`，即「实际章数一偏离就卡死」，恰是文档禁止的按章号反推。
> 现改为**游标唯一真相**；卷预算写满时按卷超写带（10%）给余量、不跨卷摊剩余。

---

## 3. 已定口径（一字不改）

| 项 | 口径 |
|---|---|
| **A 检查点** | `synopsis_range: { from, to }`（`to` = **实际**完成章）+ **游标三元组** `synopsis_unit_cursor: { volumeIndex, unitIndex, writtenInVolume }`。**resume 只用游标，不得按章号反推**（`arcSpanForChapters` 是计划等分映射，实际章数一偏离就整体错位） |
| **B 状态块** | **余量行常驻**（已写 / 上界 / 剩余单元数）+ 余量比 `r` 阈值：`r < 0.9` 收紧、`r > 1.1` 展开、带内只给余量行。**不用** Z / plannedUsed / ±10% 三档 |
| **C 章数** | `maxChapters` = 结构派生的**名义**上界（剩余卷章 ÷ 剩余单元），**不是配额**；**±10% 是信号带，不是产出接受带**；预算按 **`volumeRemaining`** 冻结（不按 `nominal × 1.1`）；单元级偏差只记录、卷末汇总 |
| **模型前提** | 生产**只用思考模式**（写小说要一致性）；非思考数据只作参考 |
| **游标语义** | `synopsis_unit_cursor` = **下一个要写的单元**（含 `writtenInVolume` = 本卷已写章数）。`advanceUnitCursor` 完成后产出它；`deriveSynopsisUnitCursor` 产出的是「含 `coveredTo` 的单元」，**只用于旧检查点迁移**，两者在单元边界上不同，别混用 |
| **限章** | 单元批次**不套** ≤10 章的 `assertPlanningActionRange`（旧 range 模式不变） |

---

## 4. T4b 已接线（做法与踩到的坑）

**指纹口径（方案 D 修订版，已确认）**：请求期 `boundTo = from + maxChapters − 1` 只参与指纹；**中断落盘** `{from, boundTo}` + `covered_to = from−1` + boundTo 指纹；**完成落盘** `{from, actual}` + **按 actual 重算指纹**（原方案漏了这条：续批校验拿 `synopsis_range` 复算指纹，用 boundTo 存的指纹会让第二批必报「源事实已变化」）；resume 直接读检查点 `to`，不重算。

**接线点（全部落在 `architecture.command.ts`）**：

1. `executeWithinGeneration` 的 `else` 分支：`unitOption` 存在即单元模式；`approveUnitContext` 用游标算出 `from/unitIndex` 并**比对请求值**（不一致 ⇒ fail-closed），`to = boundTo`。
2. `taskPrompt`：`synopsisUnitInstruction` + `renderUnitBudgetBlock`（余量为 0 时不注入），不出现章号区间。
3. 生成后 `backfillUnitBatch` → `to = actual`，**之后**才做 `assertPlotOutlineTitleCoverage`（顺序反了会把"写短"判成缺章、"写长"判成越界）；跳过 `assertPlotOutlineBatchComplete`。
4. `persistInterruptedSynopsis` 新增 `unitCursor` 参数，写显式游标；中断范围统一走 `interruptionRange`。
5. `syncSynopsisUnitCursor`：`undefined` = 章号推导（旧模式）、`null` = 明确无下一单元、对象 = 显式游标。
6. 完成落盘 `partial.synopsis_range = {from, actual}` + `advanceUnitCursor` 的返回值 + `completedFingerprint`。
7. `assertCheckpointDbMirrorCurrent` 的游标校验放宽为 `writtenInVolume ≥ 0`（跨卷会重置为 0）。

**下一步顺序**：T8（续批 / agent 子 run 的 deep-equal 改比 `{from, cursor}`）→ **§8 的两个裁定项** → T10（实机：两个单元连续、章号偏离后定位正确）→ T11（收口开关）。

---

## 5. 已探明的代码触点（按符号找，别按行号——行号已漂移过一次）

| 文件 | 符号 / 位置 |
|---|---|
| `src/shared/arc-position.ts` | `scaledBoundaries` / `arcSpanForChapters` / `planUnitStats` / `renderUnitBudgetBlock` / `UNIT_BUDGET_TOLERANCE` |
| `src/shared/generation-owner-contract.ts` | `ArchitectureUnitRange` / `ArchitecturePlanningIntent.synopsisUnit` |
| `src/shared/plot-outline-contract.ts` | `plotOutlinePolicy`（unit 模式返回 null）/ `plotOutlineUnitPolicy` / `plotOutlineCoveredTo` |
| `electron/services/main-generation-plan.ts` | `architectureIntent`（归一化 `synopsisUnit`）/ `architectureUnitRange` / `newMainGenerationPolicy` 根预算 |
| `src/services/workflows/commands/architecture.command.ts` | `PartialArchData.synopsis_unit_cursor` / `deriveSynopsisUnitCursor` / `syncSynopsisUnitCursor` / `computeSynopsisUnitRange` / `backfillUnitBatch` / `advanceUnitCursor` / `synopsisUnitInstruction` / `assertCheckpointDbMirrorCurrent` / `executeWithinGeneration` / `synopsisBatchInstruction`（旧） |
| `src/services/workflows/architecture-workflow.ts` | `ArchitectureWorkflowParams.synopsisUnit` / `planningIntent` 构造 / 命令 options |

---

## 6. 验证方式（照抄）

```bash
node node_modules/vitest/vitest.mjs run <test-file>      # 注意：.tmp-run-tests.mjs 已失效（vitest 4 报 config 错误）
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-doc-links.mjs
```

相关测试与当前通过数：

- `src/shared/__tests__/unit-stats.test.ts` —— 18
- `src/shared/__tests__/plot-outline-unit-policy.test.ts` —— 13
- `electron/services/__tests__/main-generation-unit-budget.test.ts` —— 7
- `electron/services/__tests__/main-generation-plan.test.ts` —— 94
- `src/services/workflows/commands/__tests__/synopsis-unit-cursor.test.ts` —— 5
- `src/services/workflows/commands/__tests__/synopsis-unit-instruction.test.ts` —— 3
- `src/services/workflows/commands/__tests__/synopsis-unit-request.test.ts` —— **8**（修订后）
- `src/services/workflows/commands/__tests__/unit-batch-backfill.test.ts` —— 8
- `src/services/workflows/commands/__tests__/synopsis-unit-batch.command.test.ts` —— **5**（T4b 集成）
- `src/shared/__tests__/unit-arc-position.test.ts` —— **9**（T4c 游标定弧位）
- `src/services/workflows/commands/__tests__/architecture.command.test.ts` —— 47

**既有失败（与本线无关）**：`src/shared/__tests__/novel-contracts.test.ts` 的 M09 lane 断言；
以及 `src/services/workflows/commands/__tests__/` 整目录跑时 `planning-material-binding` / `finalize-postprocess-character`
共 18 条失败——**`better-sqlite3` 当前是 Electron ABI（145），node 是 127**，改用
`ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe node_modules/vitest/vitest.mjs run <paths>` 即 18/18 绿。

---

## 7. 坑与禁忌（踩过的）

1. **Edit 的 `old_string` / `new_string` 只差换行或空白也会"成功"**，会把两行并成一行。改完必须回看上下文（本轮踩了两次）。
2. **不要按章号反推单元**——这是文档点名的硬前置错误。T4a 原实现就在犯（`arcSpanForChapters` 交叉校验），已删。
3. **不要给状态块加章数目标**——`balanced` 只给余量行；加了数字就变成"服从锚点"。余量为 0 时整块不注入（否则渲染成"名义上界 0 章"）。
4. **不要动旧路径**：`synopsisBatchInstruction`、旧 range 校验、老检查点格式一律逐字节兼容。
5. **模型自报落点不可信**（测试件 §13：run3 自报四关全齐、正文没有）——规格核验走代码/审稿证据。
6. `qwen3.5:9b-128k` 是**思考型**：`think:false` 或 `num_predict ≥ 14000`，否则 thinking 吃光预算、返回空。
7. 提交信息用 `git commit -F - <<'MSGEOF'`，**别在消息里用反引号**（bash 会当命令替换）。
8. 冻结子树（`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`）不得移动/改写。
9. **指纹必须与「落盘的那个 range」同源**：中断用 boundTo 存、完成用 actual 存，混一次第二批就废。

---

## 8. 未决问题（按优先级）

1. **T11 开关要顺带决定「从第 1 章重写」在单元模式下怎么表达**：单元模式的 `from` 由 `coveredTo + 1` 决定，
   `approveUnitContext` 会拒绝与游标不符的请求 ⇒ 现有「显式覆盖重写」入口在单元模式下不可用（要么清检查点/游标，要么另给一条 reset 语义）。
2. **卷末报警阈值**：`unit-budget` §5 现在是 ±15%，数据显示 ±15% 会常态触发（强模型可 −40%、弱模型可 +100%）——是否统一为 ±10%，或只作纯信息报告？
3. **单元级偏差的展示位置**：现在设计是"只记录、卷末汇总"，UI 还没定落点（T10 之后再说）。
4. **章数双轨：已按作者口径落地（按卷记账），剩「谁读它」**（2026-10-20 两轮澄清）。
   计划章数留在 `novelConfig.totalChapters`，**它一直是基线**（大书要走滚动续写卷纲，每批都得有基线；
   拿实际预期当基线会让规模单调漂移）。**按卷章数账**存检查点 `synopsis_volume_deviations`
   （`{volumeIndex, planned, actual}[]`），累计偏离与**实际预期章数**都现算、不存、**只作展示与对账**。
   按卷存是为了后续**卷冻结 / 卷续写 / 卷回滚**能按卷扣账（`dropVolumeDeviation`）；**按批回滚**靠字段白名单自动还原。
   作废重规划（`from = 1` 且原有已写）清零。**剩下的**：蓝图/对话框上界仍读计划值
   （`directory.command.ts` 的 `Math.min(totalChapters, …)`、`DirectoryConfigDialog.tsx` 的剩余章数），
   要不要改成「计划 + 累计偏离」、以及这个数怎么给到渲染层，留 T10 前定。

> 已裁定（2026-10-20）：**弧位投影按游标**（T4c 已实现 `arcSpanForUnit` / `withProjectedUnitArcGuide`）；
> **不存在「单元耗尽」这个说法**——骨架走完就是写完，计划章数不参与完成判定（T4c 已把 `bookComplete` 改成这个口径）。

---

## 9. 接手动作（照这个顺序）

1. 读拆解稿 §9（决策）+ §10（实施记录），确认 HEAD 与工作区。
2. 先裁定 §8 的 1、2 两项（都影响 T10 实机看到的东西）。
3. T8（续批 / agent 子 run 的 deep-equal 改比 `{from, cursor}`）。
4. T10（实机）→ T11（开关与收口）。
5. 每步一 commit，提交信息写清「做了什么 / 验证了什么 / 没做什么」。
