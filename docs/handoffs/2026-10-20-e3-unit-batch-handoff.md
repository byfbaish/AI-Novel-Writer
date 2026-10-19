# E3 逐单元生成 · 工间交接（2026-10-20）

> **用途**：上下文过长时的接力点。**先读这一页，再读拆解稿**，防止目标漂移。
> 分支：`exp/arc-tree-v2` · 代码 HEAD：`88020fa9`（本文档提交之前）· 工作区：干净（2026-10-20 03:18）
> 进度：**8/11 步完成**；T4b 卡在一个待确认决策（§4）。
> 主设计稿：[`docs/design/architecture/e3-unit-batch-implementation-plan.md`](../design/architecture/e3-unit-batch-implementation-plan.md)（T1–T11 + §9 决策 + §10 实施记录）
> 口径稿：[`volume-quota-context-budget-design.md`](../design/architecture/volume-quota-context-budget-design.md) §6.2 / §7.1 · 实测：[`unit-budget-prompt-ab-test.md`](../design/architecture/unit-budget-prompt-ab-test.md) §13

---

## 1. 目标（不要漂移）

**E3 = 情节大纲的批次从「第 from–to 章」改成「一个单元」。** 请求期只给 `{ from, unitIndex, maxChapters }`（**没有 `to`**），生成后解析实际章数、回填 `to`、推进**显式游标**。

作者 2026-10-20 裁定：**E3 是全项目 Top 优先**——它关系大纲 → 蓝图 → 正文三段生成，是与原系统接驳的最后一环；**先把整个流程打通，再做改善与升级**。

**不在本线**（别顺手做）：T11 卷末快照（E4 内部第一）、T9 按卷冻结（后放）、T10 全量清除补弧光（作者确认搁置）、回滚/定稿撤销（单独立项）。

---

## 2. 已完成的 8 步（都有 commit，全部单测 + tsc 绿）

| 步 | Commit | 内容 | 单测 |
|---|---|---|---|
| T1 | `c6c487dd` | `planUnitStats` / `unitRemainingStateOf` / `renderUnitBudgetBlock`（arc-position） | 18 条 |
| T2 | `69a2c208` | `ArchitectureUnitRange` + intent `synopsisUnit`；`plotOutlineUnitPolicy`（无 `to` 放行、互斥） | 13 条 |
| T3 | `378a05f4` | 主进程：intent 归一化 + 根预算 = `priorSteps + 2 × volumeRemaining` | 7 条 + 94 回归 |
| T7 | `6f903c95` | 检查点 `synopsis_unit_cursor` + 旧检查点一次性迁移 + 三处落盘点同步 | 5 条 + 47 回归 |
| T5/T6 | `641afd27` | `synopsisUnitInstruction`（无 from–to 区间）+ `renderUnitBudgetBlock`（余量行常驻 + `r` 阈值） | 3 + 5 条 |
| T4a | `549dee9c` | `computeSynopsisUnitRange`（游标定单元）+ command/workflow 选项管道 | 5 条 |
| T9 | `83c49ca5` | `backfillUnitBatch`（数实际章数、越界 clamp）+ `advanceUnitCursor`（跨卷推进） | 8 条 |
| 决策 | `88020fa9` | T4b 前置决策稿（指纹口径，方案 D 待确认） | — |

**关键**：以上全部**未接线**（没有任何调用方传 `synopsisUnit`），生产行为与提交前逐字节一致。

---

## 3. 已定口径（一字不改）

| 项 | 口径 |
|---|---|
| **A 检查点** | `synopsis_range: { from, to }`（`to` = **实际**完成章）+ **游标三元组** `synopsis_unit_cursor: { volumeIndex, unitIndex, writtenInVolume }`。**resume 只用游标，不得按章号反推**（`arcSpanForChapters` 是计划等分映射，实际章数一偏离就整体错位） |
| **B 状态块** | **余量行常驻**（已写 / 上界 / 剩余单元数）+ 余量比 `r` 阈值：`r < 0.9` 收紧、`r > 1.1` 展开、带内只给余量行。**不用** Z / plannedUsed / ±10% 三档 |
| **C 章数** | `maxChapters` = 结构派生的**名义**上界（剩余卷章 ÷ 剩余单元），**不是配额**；**±10% 是信号带，不是产出接受带**；预算按 **`volumeRemaining`** 冻结（不按 `nominal × 1.1`）；单元级偏差只记录、卷末汇总 |
| **模型前提** | 生产**只用思考模式**（写小说要一致性）；非思考数据只作参考 |
| **限章** | 单元批次**不套** ≤10 章的 `assertPlanningActionRange`（旧 range 模式不变） |

---

## 4. 下一步 T4b（当前阻塞点）

**问题**：`synopsisInputsFingerprint(...)` 把 `range.to` 算进指纹，而 unit 模式请求期**没有 `to`**。指纹是唯一能证明"源事实没变"的机制，口径不定，续写/中断恢复会直接失效。

**方案 D（待作者确认，已写进拆解稿 §9）**：

- 请求期 `boundTo = from + maxChapters − 1`，**只参与指纹**，不写进检查点的 `to`；
- 完成落盘 `synopsis_range = { from, to: actual }`；中断落盘 `{ from, to: boundTo }` + `covered_to = from − 1`；
- resume 由 `computeSynopsisUnitRange` 用游标重算 `boundTo`（确定性）；结构变了 `plotStructurePlan` 会令指纹不同 ⇒ 正确 fail-closed；
- **unit 模式不输出进度标记** `plotOutlineProgressLine`（它需要一个 `to`）。

**T4b 的接线点**（`architecture.command.ts`）：
1. `executeWithinGeneration` 的 `else` 分支（fresh/batch）：检测 `this.options.synopsisUnit`，走 unit 路径，跳过 `requested` 范围校验；
2. `taskPrompt` 组装：用 `synopsisUnitInstruction` + `renderUnitBudgetBlock`（替换 `synopsisBatchInstruction`）；
3. 生成后：`backfillUnitBatch(merged, from, total)` → `to`；`advanceUnitCursor(...)` → 新游标；写检查点（`synopsis_range` + `synopsis_unit_cursor`）；
4. `persistInterruptedSynopsis`：unit 模式下写 `{ from, to: boundTo }`、`covered_to = from − 1`；
5. `syncSynopsisUnitCursor` 必须传 **explicit** 游标（不许章号推导覆盖）；
6. 跳过 `assertPlotOutlineBatchComplete`（marker 不存在于 unit 模式）。

**之后的顺序**：T8（续批 / agent 子 run 的 deep-equal 改比 `{from, cursor}`）→ T10（实机：两个单元连续、章号偏离后定位正确）→ T11（收口开关）。

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
- `src/services/workflows/commands/__tests__/synopsis-unit-request.test.ts` —— 5
- `src/services/workflows/commands/__tests__/unit-batch-backfill.test.ts` —— 8
- `src/services/workflows/commands/__tests__/architecture.command.test.ts` —— 47

**既有失败（与本线无关）**：`src/shared/__tests__/novel-contracts.test.ts` 的 M09 lane 断言（`project-storage.ts` 已含 M09，测试仍按 9 条）。

---

## 7. 坑与禁忌（踩过的）

1. **Edit 的 `old_string` / `new_string` 只差换行或空白也会"成功"**，会把两行并成一行。改完必须回看上下文（本轮踩了两次）。
2. **不要按章号反推单元**——这是文档点名的硬前置错误。
3. **不要给状态块加章数目标**——`balanced` 只给余量行；加了数字就变成"服从锚点"。
4. **不要动旧路径**：`synopsisBatchInstruction`、旧 range 校验、老检查点格式一律逐字节兼容。
5. **模型自报落点不可信**（测试件 §13：run3 自报四关全齐、正文没有）——规格核验走代码/审稿证据。
6. `qwen3.5:9b-128k` 是**思考型**：`think:false` 或 `num_predict ≥ 14000`，否则 thinking 吃光预算、返回空。
7. 提交信息用 `git commit -F - <<'MSGEOF'`，**别在消息里用反引号**（bash 会当命令替换）。
8. 冻结子树（`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`）不得移动/改写。

---

## 8. 未决问题（按优先级）

1. **方案 D 是否确认**（T4b 的前置）。
2. **卷末报警阈值**：`unit-budget` §5 现在是 ±15%，数据显示 ±15% 会常态触发（强模型可 −40%、弱模型可 +100%）——是否统一为 ±10%，或只作纯信息报告？
3. **单元级偏差的展示位置**：现在设计是"只记录、卷末汇总"，UI 还没定落点（T10 之后再说）。

---

## 9. 接手动作（照这个顺序）

1. 读拆解稿 §9（决策）+ §10（实施记录），确认 HEAD 与工作区。
2. 向作者确认方案 D。
3. 按 §4 的六个接线点做 T4b；写检查点的部分与 T9 纯函数合并验证。
4. T8 → T10（实机）→ T11（开关与收口）。
5. 每步一 commit，提交信息写清「做了什么 / 验证了什么 / 没做什么」。
