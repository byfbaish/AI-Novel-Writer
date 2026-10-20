# E3 逐单元生成 · 工间交接（2026-10-20 收工）

> **用途**：上下文过长时的接力点。**先读这一页，再读拆解稿**，防止目标漂移。
> 分支：`exp/arc-tree-v2` · 代码 HEAD：`6e934150`（+ 本文档提交）· 工作区：干净
> 进度：**T1–T9 全部完成**（含 T4a 修订 / T4b 接线 / T4c 弧位按游标 / T8 授权口径）+ 章数双轨 + 界面冻结；
> **剩 T10（实机）→ T11（开关）**。
> 主设计稿：[`docs/design/architecture/e3-unit-batch-implementation-plan.md`](../design/architecture/e3-unit-batch-implementation-plan.md)（T1–T11 + §9 决策 + §10 实施记录）
> 口径稿：[`volume-quota-context-budget-design.md`](../design/architecture/volume-quota-context-budget-design.md) §6.2 / §7.1 · 实测：[`unit-budget-prompt-ab-test.md`](../design/architecture/unit-budget-prompt-ab-test.md) §13

---

## 1. 目标（不要漂移）

**E3 = 情节大纲的批次从「第 from–to 章」改成「一个单元」。** 请求期只给 `{ from, unitIndex, maxChapters }`（**没有 `to`**），生成后解析实际章数、回填 `to`、推进**显式游标**。

作者 2026-10-20 裁定：**E3 是全项目 Top 优先**——它关系大纲 → 蓝图 → 正文三段生成，是与原系统接驳的最后一环；**先把整个流程打通，再做改善与升级**。

**为什么是单元而不是章节批次**：单元内剧情连续，**需要模型一次性考量怎么分章**；把规划权让给模型，就得接受「批次边界 = 单元」这个让步。
**下游不跟着改**：蓝图**一章一章生成没问题**，不要改成按单元切。

**不在本线**（别顺手做）：T11 卷末快照（E4 内部第一）、T9 按卷冻结（后放）、T10 全量清除补弧光（作者确认搁置）、回滚/定稿撤销（单独立项）、**单元内续写**（目标虽明确，但会复杂化并大概率冲击反馈收敛 ⇒ 明确不做）。

---

## 2. 已完成（全部单测 + tsc 绿）

| 步 | Commit | 内容 |
|---|---|---|
| T1 | `c6c487dd` | `planUnitStats` / `unitRemainingStateOf` / `renderUnitBudgetBlock` |
| T2 | `69a2c208` | `ArchitectureUnitRange` + intent `synopsisUnit`；`plotOutlineUnitPolicy`（无 `to` 放行、互斥） |
| T3 | `378a05f4` | 主进程：intent 归一化 + 根预算 = `priorSteps + 2 × volumeRemaining` |
| T7 | `6f903c95` | 检查点 `synopsis_unit_cursor` + 旧检查点一次性迁移 |
| T5/T6 | `641afd27` | `synopsisUnitInstruction` + 余量块（余量行常驻 + `r` 阈值） |
| T4a | `549dee9c` → **修订** | `computeSynopsisUnitRange`；**修订**：删掉 `arcSpanForChapters` 反查（探针实测会把「少写」判成卡死）+ 卷预算写满兜底 |
| T9 | `83c49ca5` | `backfillUnitBatch` + `advanceUnitCursor` |
| 决策 | `88020fa9` | 指纹口径（方案 D，**已确认并修订**） |
| T4b | `89d0bfcc` | 状态机接线：单元定位 / 提示词 / 回填 / 游标 / 指纹闭环 |
| T4c | `ed4a3a25` | **弧位按游标**（`arcSpanForUnit` / `withProjectedUnitArcGuide`）+ 写完判据改骨架 + 修 `projectArcStructureText` 投影 no-op |
| 双轨 | `d0f2a24d` | 计划章数不动，另存偏离；实际预期 = 计划 ± 各卷偏离 |
| 记账 | `cecbe479` | 偏离账改**按卷**（卷回滚可扣账），累计/预期现算 |
| 界面 | `5f0f0742` | 蓝图范围**冻结在大纲已覆盖的章数内**（fail-open） |
| T8 | `6e934150` | 上界校验 + 子 run 授权改比 `architecturePlanningRange`（`from + maxChapters − 1`） |

**关键**：单元模式**仍没有生产调用方**（没人传 `synopsisUnit`），旧路径逐字节不变；开关在 T11。

---

## 3. 已定口径（一字不改）

| 项 | 口径 |
|---|---|
| **A 检查点** | `synopsis_range: {from, to}`（`to` = **实际**完成章）+ 游标三元组 `synopsis_unit_cursor`。**resume 只用游标，不得按章号反推** |
| **B 状态块** | 余量行常驻 + 余量比 `r` 阈值（`<0.9` 收紧 / `>1.1` 展开 / 带内只给余量行）；**不用** Z / plannedUsed / ±10% 三档；**余量为 0 时不注入**（否则渲染成「名义上界 0 章」） |
| **C 章数** | `maxChapters` = 名义上界（卷内剩余 ÷ 剩余单元），**不是配额**；`maxChapters` 不写进提示词；±10% 是信号带不是验收带 |
| **预算冻结** | 按本卷剩余章数冻结；**卷预算互不影响**，写满时按卷超写带（10%）给余量、**不跨卷摊剩余** |
| **游标语义** | `synopsis_unit_cursor` = **下一个要写的单元**。`advanceUnitCursor` 产出它；`deriveSynopsisUnitCursor` 产出「含 coveredTo 的单元」，**只用于旧检查点迁移** |
| **指纹** | 请求期用 `boundTo` 算；**中断落盘存 boundTo 指纹**、**完成落盘按 actual 重算**（混一次第二批必报「源事实已变化」）；resume 直接读检查点 `to`，不重算 |
| **写完判据** | 单元模式 = **单元骨架走完**（`unitNextCursor === null`）；旧路径 = `to >= totalChapters`。`totalChapters` 是**计划基线，不是完成约束** |
| **章数双轨** | 计划章数（`novelConfig.totalChapters`）**一直是基线**（大书卷纲滚动续写要用它分卷，拿实际预期当基线会让规模单调漂移）；**实际预期章数 = 计划 ± 各卷偏离**，只作展示与对账；作废重写（`from=1` 且原有已写）**清零偏离账** |
| **界面上界** | 蓝图范围按**大纲实际覆盖章数**（`plotOutlineCoveredTo`）冻结；读不到或为 0 ⇒ **不限制**（fail-open） |
| **模型前提** | 生产**只用思考模式**；`qwen3.5:9b-128k` 需 `think:false` 或 `num_predict ≥ 14000` |

---

## 4. T8 已完成（含一处口径更正）

**先说更正**：交接稿原先断言「单元模式下续批必报 `GENERATION_PLANNING_CONTINUATION_RANGE_CHANGED`」——**不成立**。
`planningContinuation(run)` 会先 `readPlotOutline(runId)`，而单元模式下 `plotOutlinePolicy` 返回 `null` ⇒
`outline` 为空、`directoryRange` 也没有 ⇒ **直接 `return undefined`**，根本走不到那段 `remainingRange` 比较。
语义上也没有对应物：「继续生成缺少的章节」在单元模式下等于"继续写下一个单元"，那是新的一次生成，不是同一次运行的续批。
UI 的继续按钮已因 `!remainingRange` 处于禁用态。**所以续批不改**。

**实际改了两处**（`6e934150`）：

| 位置 | 原来 | 现在 |
|---|---|---|
| `main-generation-owner.ts` · 上界 `rangeEnd` | `intent.synopsisRange?.to` ⇒ 单元模式 `undefined`，**越界校验被静默跳过** | `architecturePlanningRange(intent)?.to` |
| `agent-generation.ts` · 子 run 授权 | 拿 `synopsisRange` 与注册的 `{from,to}` 比 ⇒ 单元模式 `null`，**必报 `CHILD_NOT_AUTHORIZED`** | 比 `architecturePlanningRange(intent)` |

新增 `architecturePlanningRange(intent)`（`generation-owner-contract.ts`）：range 模式原样；单元模式折算
`boundTo = from + maxChapters − 1`；都没有/字段非法 ⇒ `null`（调用方跳过校验）。**只服务授权与上界，不写检查点、不进提示词。**

## 5. T10 实机清单

> **执行用清单（可勾选 + 已知风险 + 取证明细）**：[`2026-10-20-t10-unit-batch-acceptance.md`](2026-10-20-t10-unit-batch-acceptance.md)。
> **阶段 A 已补发射侧**：开关 `localStorage['aiNovel:e3-unit-batch'] = '1'`（dev 生效），`synopsis-unit-launch.ts` 由落库游标构造单元，命令侧判定逻辑未动。

1. 连续两个单元：单元 1 → 游标 `{v1,u1,w=n}` → 单元 2 从 `covered_to+1` 起、**用游标定位** → 游标推进。
2. **人为让单元 1 少写/多写**（改游标的 `writtenInVolume`），单元 2 定位仍正确（这是 T4a 修订要保住的性质）。
3. 日志每单元出现：`正在写【单元 k：名】`、余量块（余量 > 0 时）、`本单元实际写 N 章`。
4. 卷写完出现：`卷 N 写完：计划 X 章，实际 Y 章（偏离 ±D）；全书计划 P，累计 ±S，实际预期 P±S 章`。
5. 全程无中途 `ROOT_BUDGET_EXHAUSTED`（除非真写穿）。
6. 旧检查点项目可正常续写一次（迁移路径）。
7. 蓝图弹框：大纲只写到第 N 章时，选项冻结在 N 且有提示。

---

## 6. T11 开关清单

1. 调用方开始传 `synopsisUnit`（`creative-workflow-launcher.ts` / `ArchFileViewer.tsx` 目前只传 `synopsisRange`）。
2. ⚠️ **顺带决定「从第 1 章重写」在单元模式下怎么表达**：`from` 由 `coveredTo+1` 决定，`approveUnitContext` 会拒绝与游标不符的请求 ⇒ 现有「显式覆盖重写」入口在单元模式下不可用（清检查点/游标，或另给 reset 语义）。
3. 旧路径保留一个版本，回退只需关开关。

---

## 7. 代码触点（按符号找，别按行号）

| 文件 | 符号 |
|---|---|
| `src/shared/arc-position.ts` | `planUnitStats` / `renderUnitBudgetBlock` / `UNIT_BUDGET_TOLERANCE` / `arcSpanForUnit` / `renderUnitArcPositionBlock` / `withProjectedUnitArcGuide` / `planVolumeChapters` / `volumeDeviationRecordOf` / `upsertVolumeDeviation` / `dropVolumeDeviation` / `accumulatedVolumeDeviation` / `expectedTotalChapters` |
| `src/shared/generation-owner-contract.ts` | `ArchitectureUnitRange` / `ArchitecturePlanningIntent.synopsisUnit` |
| `src/shared/plot-outline-contract.ts` | `plotOutlinePolicy`（unit ⇒ null）/ `plotOutlineUnitPolicy` / `plotOutlineCoveredTo` |
| `electron/services/main-generation-plan.ts` | `architectureIntent` / `architectureUnitRange` / 根预算 |
| `electron/services/main-generation-owner.ts` | 上界校验 / `planningContinuation`（T8） |
| `electron/services/agent-generation.ts` | 子 run 授权（T8） |
| `src/services/workflows/commands/architecture.command.ts` | `SynopsisUnitCursor` / `deriveSynopsisUnitCursor` / `syncSynopsisUnitCursor` / `computeSynopsisUnitRange` / `backfillUnitBatch` / `advanceUnitCursor` / `INITIAL_SYNOPSIS_UNIT_CURSOR` / `synopsisUnitInstruction` / `executeWithinGeneration` / `persistInterruptedSynopsis` |
| `src/components/dialogs/DirectoryConfigDialog.tsx` | `chapterLimit`（按大纲覆盖冻结） |

---

## 8. 验证方式（照抄）

```bash
node node_modules/vitest/vitest.mjs run <test-file>      # .tmp-run-tests.mjs 已失效（vitest 4）
node node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/dialogs/__tests__/workflow-launch-dialogs.browser.tsx
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-doc-links.mjs
```

当前通过数（2026-10-20 收工）：

- `src/shared/__tests__` —— 810（**1 条既有失败**：`novel-contracts.test.ts` 的 M09 lane 断言）
- `src/services/workflows/__tests__` —— 448
- `src/services/workflows/commands/__tests__` —— 725（整目录跑有 **18 条 `better-sqlite3` ABI 噪声**：`planning-material-binding` / `finalize-postprocess-character`；
  用 `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe node_modules/vitest/vitest.mjs run <paths>` 即全绿）
- `electron/services/__tests__/main-generation-{plan,unit-budget}` —— 94 + 7
- `workflow-launch-dialogs.browser` —— 26
- `src/shared/__tests__/architecture-planning-range.test.ts` —— 3

**⚠️ 两个大文件要分批跑**（跑整文件会被环境噪声淹没，别误判成回归）：

- `electron/services/__tests__/main-generation-owner.test.ts`（185 条）：整文件跑会在约 45 例后撞**沙箱 safe-delete 批量阈值**，
  出现 ~139 条失败（错误栈落在 `fs.rmSync` cleanup，不是断言）。用 `-t "<describe 或用例名>"` 分批跑即绿；
  另有 **2 条既有失败**（`frozen planning roots` 里两条 directory budget 用例，已 `git stash` 在基线上复现）。
- `electron/services/__tests__/agent-generation.test.ts`（31 条）：整文件跑约 60s，正常全绿（需 Electron ABI）。

---

## 9. 坑与禁忌（今天踩的）

1. **不要按章号反推单元**——`arcSpanForChapters` 是计划等分映射，实际章数一偏离就整体错位。T4a 原实现就犯了这个错（探针：单元写 12 章 vs 计划 15 ⇒ 返回 null，单元模式永久卡死）。
2. **不要把「单元」往下游推**——蓝图按章；单元内续写不做（会复杂化 + 冲击反馈收敛）。
3. **指纹必须与落盘的那个 range 同源**：中断用 boundTo 存、完成用 actual 存。
4. **回填必须在覆盖校验之前**：先按 `boundTo` 校验会把「写短」判成缺章、「写长」判成越界。
5. **余量为 0 时不要注入余量块**：渲染出来是「名义上界 0 章」，等于给章数目标。
6. **Edit 的空白差异也算成功**：改完必须回看上下文。
7. **提交信息用 `git commit -F - <<'MSGEOF'`**，正文别用反引号。
8. 冻结子树（`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`）不得移动/改写。
9. **`projectArcStructureText` 曾用 `match[2]` 判匹配**（捕获组 2 是可选章数）⇒ P18 之后整段投影是 no-op，已修。以后动投影先确认「匹配判据」用的是组 1。

---

## 10. 待定（不阻塞 T8）

1. **卷末报警阈值**：`unit-budget` §5 是 ±15%，数据显示 ±15% 会常态触发（强模型可 −40%、弱模型可 +100%）——是否统一 ±10%，或只作纯信息报告？
2. **单元级偏差的展示位置**：现在「只记录、卷末汇总」，UI 落点未定（T10 之后再说）。
3. **卷冻结 / 卷续写 / 卷回滚**：本轮只把账做成可按卷扣（`dropVolumeDeviation`），功能本身未做。
4. **单元收敛机制能否用于卷层**：未讨论。若采用，则回到「落地即规划好卷数、之后不再用计划章数」的旧结论。

---

## 11. 接手动作

1. 读拆解稿 §9（决策）+ §10（实施记录），确认 HEAD 与工作区。
2. **T10 实机**：按 [`2026-10-20-t10-unit-batch-acceptance.md`](2026-10-20-t10-unit-batch-acceptance.md) 打钩（先备一个**旧检查点项目**和一个**新项目**；开关见该文 §1）。
3. **T11 开关**：接 `synopsisUnit` 调用方 + 收口，顺带定 §6.2 的「从第 1 章重写」。
4. 每步一 commit，提交信息写清「做了什么 / 验证了什么 / 没做什么」。
