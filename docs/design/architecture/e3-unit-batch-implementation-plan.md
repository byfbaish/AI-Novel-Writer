# E3 实施拆解：批次改为「一个单元」（逐单元生成）

> 状态：🟡 **T1 已实施**（纯函数 + 单测，零行为变化）· 其余待评审 ｜ 日期：2026-10-20
> 上级稿：[`volume-quota-context-budget-design.md`](volume-quota-context-budget-design.md) §6–§7（现行口径）｜[`unit-budget-elastic-allocation-design.md`](unit-budget-elastic-allocation-design.md) §9（E3 定位与硬前置）
> 实测依据：[`unit-budget-prompt-ab-test.md`](unit-budget-prompt-ab-test.md) §13（含 DeepSeek 思考模式交叉验证）
> 分支：`exp/arc-tree-v2` · 基准：`540c701c`（E4j-4 之后）

---

## 0. 一句话

把情节大纲的批次从「第 from–to 章」改成「一个单元」：请求期只给 `{ from, unitIndex, maxChapters }`，**请求时没有 `to`**；生成后解析出实际章数，回填 `to` 并**把显式游标落库**。

**E3 是全项目 Top 优先**——它关系大纲 → 蓝图 → 正文三段生成，是打通全流程的最后一环（2026-10-20 作者裁定）。

---

## 1. 已定口径（2026-10-20 作者裁定，A/B/C + 三条）

| 项 | 口径 |
|---|---|
| **A 检查点** | `synopsis_range: { from, to }`（`to` = 实际完成章）+ **新增并落库** `synopsis_unit_cursor: { volumeIndex, unitIndex, writtenInVolume }`。**resume 只用游标定位，不得用 `covered_to + 1` 反推**（`arcSpanForChapters` 是计划等分映射，实际章数一偏离就整体错位） |
| **B 状态块** | 按 volume-quota §6.2：**余量行常驻**（已写 / 上界 / 剩余单元数）+ 余量比 `r` 阈值指令；**不用** unit-budget §4.4 的 Z / plannedUsed / ±10% 三档 |
| **C 章数** | `maxChapters` = 结构派生的**名义**上界（卷内剩余章数 ÷ 剩余单元），**不是配额**；单元数与单元内章数都由模型按剧情弹性决定；**±10% 是信号带，不是产出接受带** |
| **预算冻结** | 按**本卷剩余章数**冻结，不按 `nominal × 1.1`（实测弱模型可写 +100%、强模型可写 −40%） |
| **越界处理** | 单元级偏差**只记录、不阻断**，卷末汇总；**取消**逐单元「本单元超长，请回弧光拆分」报错 |
| **模型前提** | 生产**只用思考模式**（写小说要一致性）；非思考数据只作参考（测试件 §13.5） |

---

## 2. 代码触点（符号定位，不写行号——行号已漂移过一次）

| 层 | 位置 | 现状 | E3 改动 |
|---|---|---|---|
| 契约 | `src/shared/generation-owner-contract.ts` · `synopsisRange` | `{ from, to }` | **新增**并列字段 `synopsisUnit?: { from, unitIndex, maxChapters, volumeRemaining }`；`synopsisRange` 保留 |
| 契约 | `src/shared/plot-outline-contract.ts` · 校验 | 强制 `to` 与 `to−from+1 ≤ maxPhysicalRequests` | 带 `synopsisUnit` 时走新校验；旧值路径不变 |
| 主进程 | `electron/services/main-generation-plan.ts` · architecture 预算 | `2 × (to − from + 1)` | 带 `synopsisUnit` 时 `2 × volumeRemaining` |
| 主进程 | `electron/services/main-generation-owner.ts` · 续批 deep-equal | 比 `synopsisRange` | 比 `{ from, cursor }`（cursor 缺失时回退旧比较） |
| 主进程 | `electron/services/agent-generation.ts` · 子 run 授权 | 比 `{ from, to }` | 同步改，否则子 run 会 `GENERATION_AGENT_CHILD_NOT_AUTHORIZED` |
| 命令 | `architecture.command.ts` · 检查点类型 | `synopsis_range?: { from, to }` | 加 `synopsis_unit_cursor?` |
| 命令 | `architecture.command.ts` · 检查点校验 | `Number.isSafeInteger(range.to)` + `coveredTo === range.to` | 保留；新增游标校验（卷序号/单元序号/已写 ≥ 0） |
| 命令 | `architecture.command.ts` · 指纹 | `range.from:range.to` | 回填后按实际 `to` 计算（本来就是实际值） |
| 命令 | `architecture.command.ts` · resume | 读 `synopsis_range` | **优先读游标**；旧检查点无游标时一次性推导并落库（仅迁移） |
| 命令 | `architecture.command.ts` · `synopsisBatchInstruction` | 硬写「必须覆盖第 from–to 章」+「to+1 起只写概览」 | 新分支：只给单元 + 起点 + 离开状态；**不给 to** |
| 共享 | `src/shared/arc-position.ts` | `planVolumeStats`（卷级） | 新增 `planUnitStats`（单元级：名义上界 / 本卷上界 / 剩余单元数 / 余量比 `r` / 余量行文本） |

---

## 3. 施工步骤（每步可独立验证，按顺序）

| # | 步骤 | 改哪里 | 验证 | 风险 |
|---|---|---|---|---|
| **T1** | `planUnitStats` 纯函数 + `renderUnitBudgetLine` | `src/shared/arc-position.ts` | ✅ 已实施（2026-10-20）：13 条单测 + 67 条回归全绿；`tsc --noEmit` exit 0 | 低 |
| **T2** | 契约字段 `synopsisUnit`（并列，不动旧字段）+ 校验分支 | `generation-owner-contract.ts`、`plot-outline-contract.ts` | ✅ 已实施（2026-10-20）：13 条单测；`plotOutlinePolicy` 对单元模式返回 null，`plotOutlineUnitPolicy` 校验四元组与互斥 | 中 |
| **T3** | 主进程预算：`synopsisUnit` ⇒ `2 × volumeRemaining` | `main-generation-plan.ts` | ✅ 已实施（2026-10-20）：7 条单测 + 94 条既有回归；`readMainGenerationPolicy` JSON 往返 | **高** |
| **T4** | 请求构造：`computeUnitRequest`（游标 → 请求体，不算 `to`） | `architecture.command.ts` | 单测：游标推进、跨卷重置、无结构回退旧路径 | **高** |
| **T5** | prompt unit 模式 | `synopsisUnitInstruction`（新函数，不动旧 `synopsisBatchInstruction`） | ✅ 已实施（2026-10-20）：3 条单测；无 from–to 区间、点名单元/起点/离开状态/不得进入下一单元 | 中 |
| **T6** | 余量行常驻 + `r` 阈值指令 | `renderUnitBudgetBlock`（arc-position） | ✅ 渲染器已实施（2026-10-20）：5 条单测（带内/收紧/展开/英文/null）；**注入点在 T4** | 低 |
| **T7** | 检查点写入游标 + 兼容旧值 | `architecture.command.ts`、partial 类型 | ✅ 已实施（2026-10-20）：`synopsis_unit_cursor` 入字段白名单；旧检查点一次性推导并落库；损坏游标报错；5 条推导单测 + 47 条命令回归 | **高** |
| **T8** | 续批 / agent 子 run 的 deep-equal 改比 `{from, cursor}` | `main-generation-owner.ts`、`agent-generation.ts` | 集成：续批成功、子 run 授权成功、篡改游标被拒 | **高** |
| **T9** | 回填与记账：解析 `actual`、`to = from+actual−1`、`writtenInVolume += actual`、`covered_to = to`；超卷末只记录 | `architecture.command.ts` | 单测 + 集成：连写两个单元、章号偏离后仍正确 | **高** |
| **T10** | 端到端实机 | 真项目 | 单元 1 → 单元 2 连续；日志出现余量行与 `r`；无中途 `ROOT_BUDGET_EXHAUSTED`；弱模型 / 强模型各一次 | 中 |
| **T11** | 收口：开关、文档回填、施工记录 | — | 旧路径保留一个版本；回退只需关开关 | 低 |

> **T1–T3 可以先做**（纯函数 + 契约 + 预算，不接链路）。**T4 之后每一步都必须能单独回退**。

> ⚠️ **依赖修正（2026-10-20 施工中发现）**：T4（请求构造）需要**游标已存在**，否则只能按章号反推——那正是硬前置禁止的做法。⇒ **实际顺序为 T7（游标落库 + 旧检查点迁移）→ T4（请求构造）**，T5/T6 可与之并行。

---

## 4. 回归测试清单（检查点是最高风险区）

1. **旧检查点 resume**：无游标 ⇒ 推导一次并落库，续写正常。
2. **续批**：`isDeepStrictEqual` 比较对象变更后，合法续批仍通过。
3. **agent 子 run**：授权 deep-equal 同步，不得出现 `GENERATION_AGENT_CHILD_NOT_AUTHORIZED`。
4. **指纹失效**：改结构 / 改设定 ⇒ 旧检查点被正确拒绝，文案不变。
5. **损坏检查点**：越界 / 非整数 / `coveredTo` 不一致 ⇒ 原报错文案不变。
6. **无结构回退**：`parseArcStructure` 失败 ⇒ 回旧「章号区间」路径，不得崩。
7. **批量模式隔离**：若仍保留多章批，必须与新路径互不影响。

---

## 5. 旧数据兼容

- 旧检查点没有 `synopsis_unit_cursor`：resume 时**一次性**由 `covered_to + 1` 推导所属单元并落库。**这是唯一允许按章号反推的场合**（旧数据本来就是等分映射），迁移后一律走游标。
- 不改指纹算法；`to` 本来就是实际值，指纹输入随之变化属预期。
- 回退开关：新路径默认关，作者确认后打开；关闭时行为与今天逐字节一致。

---

## 6. 明确不做（不在本稿）

- T11 卷末快照（E4e）、T9 按卷冻结（E4h）、T10 全量清除确认（E4i）——按 E4 内部排序另行施工。
- E4d 前缀投影启用（需先拿到 E4c 实测对比）。
- 回滚 / 定稿撤销（单独立项，优先级往后）。
- 卷末报警阈值是否从 ±15% 统一到 ±10%——单独裁定（数据表明 ±15% 会常态触发）。

---

## 7. 风险与回退

| 风险 | 应对 |
|---|---|
| 检查点/续批语义改错 ⇒ 无法续写 | T7/T8 单独一轮 + 回归清单 1–5；旧路径保留 |
| 主进程预算算错 ⇒ 请求数无上界或提前耗尽 | T3 单测覆盖上下界；预算只减不增 |
| 子 run 授权漏改 | T8 与 owner 同改，集成测试覆盖 |
| 强模型不需要状态块、弱模型需要 | 余量行常驻（成本极低），指令按 `r` 阈值 |
| 模型把单元写穿 | 游标 + 卷末记账兜底；单元级不阻断（作者裁定） |

---

## 8. 验收（端到端）

1. 连续两个单元：单元 1 生成 → 游标 `{v1,u1,w=n}` → 单元 2 从 `covered_to+1` 起、**用游标定位** → 游标 `{v1,u2,w=n+m}`。
2. 人为让单元 1 多写 / 少写（改游标的 `writtenInVolume`），单元 2 的定位仍正确。
3. 日志每单元出现余量行（已写 / 上界 / 剩余单元）+ `r` 值。
4. 全程不出现中途 `ROOT_BUDGET_EXHAUSTED`（除非真写穿整卷）。
5. 旧检查点项目可正常续写一次。

---

## 9. 实施记录

### 2026-10-20 · T1 `planUnitStats`（完成）

- 新增（`src/shared/arc-position.ts`）：`UnitStatsRef` / `UnitStats` / `unitRemainingStateOf` / `planUnitStats` / `renderUnitBudgetLine`。
- 口径：`maxChapters = 本卷剩余章数 ÷ 剩余单元数（含本单元）`；`ratio = maxChapters ÷ 本卷均分每单元`；`state` 复用 `UNIT_BUDGET_TOLERANCE`（边界归中）。
- `maxChaptersCeil = remaining > 0 ? max(1, ceil(maxChapters)) : 0`，供请求与预算冻结使用。
- fail-open：结构不可解析 / 序号越界 / 卷长非正 ⇒ `null`（调用方不注入余量行）。
- 单测：`src/shared/__tests__/unit-stats.test.ts` 13 条（单元 1/2、卷末单元、收紧/展开、非整数取整、截断、非法值、折算、越界、判档边界、中英渲染）。
- 回归：`unit-stats` 13 + `volume-stats` 9 + `arc-position` 58 = **80 passed**；`tsc --noEmit` exit 0。
- **零行为变化**：未接任何调用点。

> 环境笔记：本机 `vitest` 直接用 `node node_modules/vitest/vitest.mjs run <file>` 可以跑（`.tmp-run-tests.mjs` 在 vitest 4 下报 `Cannot read properties of undefined (reading 'config')`，已不可用）。

### 2026-10-20 · T2 契约字段与校验（完成）

- `generation-owner-contract.ts`：新增 `ArchitectureUnitRange { from, unitIndex, maxChapters, volumeRemaining }`；`ArchitecturePlanningIntent` 加可选 `synopsisUnit?: ArchitectureUnitRange | null`（旧构造点无需改动）。
- `plot-outline-contract.ts`：
  - 抽出 `assertOutlineContent`（区间/单元两个校验器共用同一把尺）；
  - 新增 `plotOutlineUnitPolicy`：单元模式放行无 `to`；字段非法、与 `synopsisRange` 并存、`maxChapters > volumeRemaining` 或超单请求上限 ⇒ 拒绝；
  - `plotOutlinePolicy` 遇到单元模式**返回 `null` 而不是抛错**（T4 接入前必须先路由；两种形态并存时抛错）。
- 单测：`src/shared/__tests__/plot-outline-unit-policy.test.ts` 13 条（放行/旧模式/互斥/缺 to/七类非法字段/非大纲操作/内容声明不符）。
- 回归：shared 796 条中 795 通过；唯一失败 `novel-contracts.test.ts` 的 M09 lane 断言为**既有问题**（`project-storage.ts` 已含 M09，测试仍按 9 条断言），与本次改动无关。
- `tsc --noEmit` exit 0。仍未接任何调用点（T4 起才接线）。

### 2026-10-20 · T3 主进程预算（完成）

- `architectureIntent` 支持并严格归一化 `synopsisUnit`：四元组合法性（`maxChapters ≤ volumeRemaining`、序号 ≥1、整数）+ **与 `synopsisRange` 互斥** + 旧调用方（无该键）逐字节兼容（显式 `null` 视同缺省）。
- `planningGenerationScope`：synopsis 步骤接受"无 `to` 的单元批次"；校验 `from + maxChapters − 1 ≤ totalChapters`；**不再套用 ≤10 章的 `assertPlanningActionRange`**（单元批次允许超过 10 章，这是 E3 的直接后果）。
- `newMainGenerationPolicy`：单元模式的根预算 = `priorSteps + 2 × volumeRemaining`（按本卷剩余章数冻结，不按名义上界 ×1.1）。
- 单测：`electron/services/__tests__/main-generation-unit-budget.test.ts` 7 条（预算 60 次、旧模式 32 次不变、互斥、越界、非法字段、JSON 往返）。
- 回归：`main-generation-plan.test.ts` **94 passed**；`tsc --noEmit` exit 0。
- ⚠️ **顺序修正**：T4 需要游标，实际按 T7 → T4 施工（见 §3 注）。

### 2026-10-20 · T7 检查点显式单元游标（完成）

- `PartialArchData` 新增 `synopsis_unit_cursor?: { volumeIndex, unitIndex, writtenInVolume }`，并加入 `SYNOPSIS_CHECKPOINT_FIELDS`（比对/回滚/恢复一并生效）。
- `deriveSynopsisUnitCursor(plan, totalChapters, coveredTo)`：**只用于旧检查点迁移**；结构不可解析 / 未写章 / 越界 ⇒ `null`（fail-open）。
- `syncSynopsisUnitCursor(partial, plan, total, explicit?)`：**显式游标优先**，否则按已写章推导；推导失败删除游标（不留过期值）。三处落盘点（完整批次 / 每章导航 / 中断候选）均已接入。
- 迁移：`execute` 读检查点后，若 `synopsis_range` 存在、`covered_to ≥ 1` 且无游标 ⇒ 推导一次并 `savePartialData` 落库；此后一律以游标为准。
- `assertCheckpointDbMirrorCurrent`：游标存在时校验三元组（整数、≥1），损坏则沿用同一套「请从第 1 章重新生成」文案。
- 单测：`synopsis-unit-cursor.test.ts` 5 条（单元内 / 跨单元 / 跨卷重置 / 非法输入 / 结构不可解析）；`architecture.command.test.ts` **47 passed**；`tsc --noEmit` exit 0。
- ⚠️ **T4 接线的硬约束**：单元模式下必须把请求的显式游标传给 `syncSynopsisUnitCursor` 的 `explicit` 参数，**不得让章号推导覆盖**（否则实际章数一偏离，游标就错位）。集成验证留 T10。

### 2026-10-20 · T5/T6 提示词侧（完成，未接线）

- T5：新增 `synopsisUnitInstruction(writingLanguage, from, unitIndex, unitName, totalChapters)`（`architecture.command.ts`）。与旧函数并存，**不改 `synopsisBatchInstruction`**——旧路径逐字节不变。内容：只写【单元 k：名】、从第 from 章起、写到离开状态成立、不得进入下一单元、收尾只许一行「后续概览」、每章独立标题。
- T6：新增 `renderUnitBudgetBlock(stats, language)`（`arc-position.ts`）：**余量行常驻** + `r` 阈值方向；`balanced` 只给余量行、不给任何"多写/少写"指令；块内**不含章数目标**。
- 单测：`synopsis-unit-instruction.test.ts` 3 条；`unit-stats.test.ts` 扩到 18 条（含带内/收紧/展开/英文/null）。
- 回归：`architecture.command.test.ts` 47 passed；`tsc --noEmit` exit 0。
- **未接线**：两个函数都还没有调用点——注入在 T4 的 unit 请求组装处。
