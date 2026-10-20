# T10 实机验收清单 · E3 逐单元批次

> **用途**：T10「实机」的验收记录。逐项打钩；异常项在旁边写现象 + 日志片段 + 截图路径，不要事后凭记忆补。
> 分支 `exp/arc-tree-v2` · 收工基准 `c0e66fbc` + 阶段 A 接线（见 §1）
> 设计稿：[`e3-unit-batch-implementation-plan.md`](../design/architecture/e3-unit-batch-implementation-plan.md) · 交接：[`2026-10-20-e3-unit-batch-handoff.md`](2026-10-20-e3-unit-batch-handoff.md)

---

## 0. 为什么之前跑不了（阶段 A 解决了什么）

单元模式在 T11 之前**没有任何生产调用方**：`ArchFileViewer.handleConfirm` → `launchCreativeWorkflow` 的 `generate_architecture` intent 从不带 `synopsisUnit`，点「生成情节大纲」必走按章区间。阶段 A 补的是**发射侧**，判定逻辑一行没动：

| 改动 | 文件 | 说明 |
|---|---|---|
| intent 增加 `synopsisUnit` 并透传 | `src/services/workflows/creative-workflow-launcher.ts` | 原来该字段被静默丢掉 |
| 从落库检查点算出本次单元 | `src/services/workflows/synopsis-unit-launch.ts`（新增） | 开关 + 读 `.ai-novel/partial_arch.json` + `computeSynopsisUnitRange`（与命令侧同一份实现） |
| 确认时走单元分支 | `src/components/editor/ArchFileViewer.tsx` | 仅 `import.meta.env.DEV` 且开关打开且勾了情节大纲 |

**命令侧仍会复核**：`approveUnitContext` 按游标比对 `{unitIndex, from}`，过期请求照旧 fail-closed。

---

## 1. 开关（探针，只在 dev 生效）

在 **渲染进程 DevTools Console** 里执行，设完**不用重启**，下一次点确认即生效：

```js
localStorage.setItem('aiNovel:e3-unit-batch', '1')   // 开
localStorage.removeItem('aiNovel:e3-unit-batch')     // 关（恢复逐字节旧行为）
```

- [ ] 开启后点「生成情节大纲」，DevTools 出现 `[E3] 单元批次：第 k 个单元，从第 N 章起（名义上界 X 章 / 本卷剩余 Y 章）`
  - 没有这一行 = 发射侧没生效（检查开关值 / 是否勾了情节大纲 / 是否 dev 构建）
- [ ] 关掉后同一操作仍走按章区间（`architecture:planning-intent` 里是 `synopsisRange`，不是 `synopsisUnit`）

---

## 2. 环境（照抄，别跳）

- [ ] `pnpm run rebuild:electron` —— `better-sqlite3` 常被 node 侧测试翻成 Node ABI，不重建 `pnpm dev` 直接崩
- [ ] `pnpm dev`，日志出现 `[AI Novel IPC] 所有 Controller 已注册完成` 再动手
- [ ] 准备两个项目：
  - [ ] **新项目**（全书未开始）：验首单元 + 连续两单元
  - [ ] **旧检查点项目**：`.ai-novel/partial_arch.json` 里已有 `synopsis_range` + `synopsis_covered_to ≥ 1`，**且 `plotStructurePlan` 有「【小弧名】」或「### 单元一：名」划界**（见 §5 风险 1）

---

## 3. 观测点（7 项，全部来自交接 §5）

### 3.1 连续两个单元

- [ ] 单元 1 跑完，日志出现 `正在写【单元 1：名】，从第 1 章起（全书 M 章）`
- [ ] 单元 1 完成，日志出现 `本单元实际写 N 章（第 1–N 章）`
- [ ] `.ai-novel/partial_arch.json` 里 `synopsis_range.to` = **实际**章数 N（不是名义上界）
- [ ] `synopsis_unit_cursor` 已推进为「下一个单元」（单元 1 写完且单元 2 存在时 `unitIndex` = 2）
- [ ] 再点一次：日志是 `正在写【单元 2：名】，从第 N+1 章起`
  - **判据**：`from = covered_to + 1`，且单元号来自游标（不是按章号反查）

### 3.2 状态块

- [ ] 卷内有余量时，提示词侧日志/请求里出现余量块（`r < 0.9` 收紧 / `r > 1.1` 展开 / 带内只给余量行）
- [ ] **余量为 0 时不注入余量块**（注入了会渲染成「名义上界 0 章」，等于给章数目标）

### 3.3 卷末对账

- [ ] 卷写完出现 `卷 N 写完：计划 X 章，实际 Y 章（偏离 ±D）；全书计划 P，累计 ±S，实际预期 P±S 章`
- [ ] `partial_arch.json` 的 `synopsis_volume_deviations` 里有对应 `{volumeIndex, planned, actual}` 一条
- [ ] **计划章数没变**：`novelConfig.totalChapters` 仍是原值（双轨：计划是基线，实际预期只作展示）

### 3.4 预算

- [ ] 全程无 `ROOT_BUDGET_EXHAUSTED`（真写穿除外）

### 3.5 人为制造偏离（T4a 修订要保住的性质）

- [ ] 先备份：复制 `.ai-novel/partial_arch.json` 一份
- [ ] **停掉应用**（运行中改会被内存态覆盖），把 `synopsis_unit_cursor.writtenInVolume` 改成 `+3` / `−3`
- [ ] 重开 → 再点一次生成：单元定位仍正确（`from` 仍等于 `covered_to + 1`，单元号仍来自游标）
  - 期望：**不会**因为「少写/多写」被判成卡死或跳到别的单元

### 3.6 旧检查点迁移

- [ ] 旧项上点「生成情节大纲」，日志出现 `迁移情节大纲单元游标` 一次
- [ ] 迁移后 `partial_arch.json` 出现 `synopsis_unit_cursor`，且值与「含 `covered_to` 的单元」一致
- [ ] 这一次生成能正常跑完（不报「无法由单元游标定位本次单元」）

### 3.7 界面冻结（T8 之外的蓝图侧）

- [ ] 大纲只写到第 N 章时，蓝图对话框的范围选项冻结在 N，并提示「第 N+1 章及以后还没有大纲…」
- [ ] 大纲覆盖数为 0 / 读不到时不限制（fail-open，保持旧行为）

---

## 4. 取证明细（跑完一并回传，用来对账）

- [ ] 两个项目的 `.ai-novel/partial_arch.json`（跑完后各一份）
- [ ] 单元 1、单元 2 的完整工作流日志（含时间戳）
- [ ] 异常项：截图 + 报错原文（中文串优先，便于定位 `text()` 分支）
- [ ] `git rev-parse HEAD` 与 `git status --short` 的输出（确认跑的是哪个版本）

> 只读排查作者库时**连 `-wal` 一起复制**，否则会误判「没落库」。

---

## 5. 已知风险（跑之前先知道，别当成新 bug）

1. **旧项目没有结构化骨架就定位不到单元。** `computeSynopsisUnitRange` 第一步是 `parseArcStructure(plotStructurePlan)`，为空直接返回 `null` ⇒ 报「无法由单元游标定位本次单元」。P18 之前的项目若弧光结构是自由文本、没有「【小弧名】/ `### 单元一：`」划界，**先重跑一次弧光结构**再验迁移。
2. **旧检查点恰好停在单元边界时，`unitIndex` 会滞后一个。** 迁移用的是 `deriveSynopsisUnitCursor`（「含 `covered_to` 的单元」），`covered_to` 正好是该单元最后一章时会定位回**刚写完的那个单元**，而 `from` 已指向下一单元开头。发射侧与命令侧同源，所以**不会被拒绝**，但语义错位。这是 T7 迁移口径的已知缺口，T10 若命中请记为「待定」而不要现场改。
3. **中断态（`synopsis_incomplete = true`）现在会退回按章区间。** 单元模式下的中断续写语义未定（接着写同一单元？还是算下一个单元？），探针阶段显式让位给旧的 `resumeSynopsis` 路径。日志里会看到走 range，这是预期。

---

## 6. 收口动作

- [ ] 全绿 ⇒ 进 T11：把开关从探针改成正式入口，并定「从第 1 章重写」在单元模式下的表达（清检查点 + 游标，或另给 reset 语义）
- [ ] 有阻塞 ⇒ 先修阻塞项再开关；不要带着红项接 T11
- [ ] 无论结果，把结论回写到 [`2026-10-20-e3-unit-batch-handoff.md`](2026-10-20-e3-unit-batch-handoff.md) §5 与当日日志
