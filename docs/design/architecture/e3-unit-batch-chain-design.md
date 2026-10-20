# E3 T12 · 连续单元（链式新 run）

> 一句话：**一次确认，连写 N 个单元，只到本卷末**；每批都是一个独立 run，中途停下不丢任何已完成内容。
> 状态：🟡 已实施，待 T10 实机复验（本文档与验收清单 C 组配套）。

## 1. 作者裁定（2026-10-20）

| 问题 | 决定 |
|---|---|
| 入口形态 | **弹窗里直接选「连写 N 个单元」**（不用复选框、不用「自动继续」开关） |
| 停止条件 | **只连续到本卷末**。卷是一道天然对账边界（卷末要算按卷偏离），自动跨卷会把对账时机藏起来 |
| 暂不做的两种 | 「一直写到全书骨架走完」「按指定个数跨卷连跑」——都需要**卷冻结**机制配合后再评估 |

补充约束（沿用既有裁定，不得推翻）：

- 蓝图**仍按章生成**，不改成按单元切；
- 模板里**不许出现章数/字数**当目标，篇幅只用来算个数；
- 请求期**没有 `to`**：一批写到哪由剧情决定，落库时按实际章数回填。

## 2. 为什么是「链式新 run」而不是 run 内循环

三条证据，任何一条都足以否掉 run 内循环：

1. **现有续批已经是这个形状**。按章模式差几章时，「继续生成缺少的章节」发的是**新 run**
   （`planningContinuation` 记录 `nextHandle`）。单元模式没有理由换一套。
2. **owner / lease / binding / 指纹全是按「一次 run 只做一批」建的**。在 run 内循环要重写
   占位、子 run 授权、binding 冻结的语义 —— 风险远大于收益。
3. **每批本来就是原子的**。写完就落检查点、推进游标；停下来只是「不再发下一批」，
   已完成的单元一个都不会丢。

## 3. 状态机

链状态（`stores/synopsis-unit-chain-store.ts`，只活在内存）：

```
{ projectPath, total, launched, volumeIndex, runId, targetUnits, stepGuidance, status, stopReason, stopDetail }
```

判定是纯函数（`services/workflows/synopsis-unit-chain.ts` → `decideUnitChainStep`），
**顺序即优先级**：

| # | 条件 | 结论 | 为什么这个顺序 |
|---|---|---|---|
| 1 | `status !== 'running'` | 停（保留原 stopReason） | 幂等：停掉的链不会被后续完成事件复活 |
| 2 | 探针算不出下一个单元 | `no-unit` | 探针失败时**绝不能**拿旧范围重发（那是覆盖重写） |
| 3 | 下一批换了卷 | `volume-end` | 先判卷界再判配额：「本卷写完了」比「凑够 N 个了」更能解释作者看到的现象 |
| 4 | `launched >= total` | `quota` | |
| 5 | 其余 | 继续 | |

⚠️ **卷信息缺失时不判卷界**（`volumeIndex` 为 `null`）：宁可继续，也不用猜出来的卷号把链掐断。

## 4. 每一批必须重做的事（少一条就会出错）

1. **重读检查点**：游标会动，缓存 = 写到同一个单元上；
2. **重新探针**：`computeSynopsisUnitRange` 只有单点真相，链不许自己推单元；
3. **重放作者参数**：`targetUnits`（每章大纲目标字数）与 `stepGuidance`（补充指导）是作者对**整段大纲**的要求，
   第二批就丢 = 前后两批口径不一致。链状态里存着它们，每批原样带出去；
4. **等上一批退出活跃列表**：`WORKFLOW_COMPLETE` 是在清理 `activeRuns` **之前**同步广播的，
   而资源冲突判定不看 run 状态 —— 抢跑必撞自己刚写完的那批（`waitForRunReleased`）；
5. **只认自己这一批的 runId**：别的架构 run 完成不许推进这条链。

## 5. 中断语义

| 情况 | 行为 | 已完成的单元 |
|---|---|---|
| 作者点「停止连写」 | 停发下一批，**当前这批会写完**（半路砍掉等于白烧一次生成） | 保留 |
| 某批失败 / 取消 | 停链，toast 报原因 | 保留 |
| 探针算不出下一单元 | 停链，带上探针原因 | 保留 |
| 到本卷末 | 正常结束 | 保留 |
| 项目切换 | 停链 | 保留 |
| **应用重启** | 链不恢复（内存态），检查点还在，重开弹窗即可继续 | 保留 |

「重启不自动续」是刻意的：应用自己悄悄接着写，比停下来更吓人。

## 6. 代码落点

| 文件 | 改动 |
|---|---|
| `services/workflows/synopsis-unit-launch.ts` | 探针结果新增 `volume {index,name,unitCount,remainingUnits}`（复用 `planUnitStats`，不另开口径） |
| `services/workflows/synopsis-unit-chain.ts` | **新增**：`decideUnitChainStep`（纯函数）/ `describeUnitChain` / `UNIT_CHAIN_STOP_COPY` |
| `stores/synopsis-unit-chain-store.ts` | **新增**：链状态 + `start/advance/stop/clear` |
| `components/dialogs/ArchitectureConfirmDialog.tsx` | 单元块下加「连写 N 个单元（本卷还剩 X 个）」，上限 = 本卷剩余单元数 |
| `components/editor/ArchFileViewer.tsx` | 首批启动后起链 + 大纲页进度横幅（含「停止连写」） |
| `components/editor/WorldBuildingEditor.tsx` | 第二个入口同样接线（避免「从哪个入口点」决定行为） |
| `App.tsx` | 链的**调度器**：`WORKFLOW_COMPLETE` 推进 + `workflow-store` 订阅失败即停 |

调度放 App 而不是大纲页：那个组件会被切走、会被卸载，链不能跟着断。

## 7. 不做的事（明确划界）

- **不跨卷**（v1）；
- **不写「全书跑完」**：需要卷冻结配合（跨卷自动跑要先把冻结与快照定下来）；
- **不持久化链**：重启不续；
- **不改请求协议**：仍然没有 `to`，仍然只有一个 `{from, unitIndex, maxChapters, volumeRemaining}`。

## 8. 验收要点

见 `docs/handoffs/2026-10-20-t10-unit-batch-acceptance.md` C 组：

1. 弹窗能看到「连写」选择，上限 = 本卷剩余单元数（第 1 卷 4 个单元 ⇒ 最多选 4）；
2. 选 2 → 跑完第 1 个单元**自动**开始第 2 个，日志能看到 `from = covered_to + 1`；
3. 第 2 批的 prompt 里仍有作者的补充指导与目标字数（不是只剩默认值）；
4. 中途点「停止连写」→ 当前批写完后再无下一批；
5. 卷末停下时报 `volume-end`，不是 `quota`；
6. 任何一批失败 → 链停，`partial_arch.json` 里已完成部分完好。
