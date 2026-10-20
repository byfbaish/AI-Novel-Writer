# T10 实机验收清单 · E3 逐单元批次

> **两个项目各走一张表，别混着做**。混着做的后果：在旧项目上验「连续两单元」时，你会以为单元 1 是从第 1 章起，其实它从 `covered_to + 1` 起，判据全对不上。
> 分支 `exp/arc-tree-v2` · 阶段 A 提交 `6c067dda`
> 设计稿 [`e3-unit-batch-implementation-plan.md`](../design/architecture/e3-unit-batch-implementation-plan.md) · 交接 [`2026-10-20-e3-unit-batch-handoff.md`](2026-10-20-e3-unit-batch-handoff.md)

---

## 0. 两个项目分别验什么（先看这张表，别急着操作）

| | **项目 A · 新项目** | **项目 B · 旧检查点项目** |
|---|---|---|
| 起点 | 全书未开始（`synopsis_covered_to` 不存在或为 0） | 已写过至少 1 章大纲（`synopsis_covered_to ≥ 1`） |
| **只验** | 首单元、连续两单元、余量块、卷末对账、预算、人为偏离后定位 | **旧检查点迁移**、迁移后能跑完 |
| **不验** | 迁移（没有旧检查点，验不了） | 首单元、卷末对账（已有进度，起点不是卷首） |
| 观测点编号 | **A1 – A6** | **B1 – B3** |
| 谁受影响 | 下游蓝图冻结也在 A 上验（A 跑完才有大纲） | — |

**两项目共同的**：§1 开关、§2 环境、§4 收尾。

---

## 1. 开关（探针，只在 dev 生效）

渲染进程 DevTools Console，设完**不用重启**，下一次点确认即生效：

```js
localStorage.setItem('aiNovel:e3-unit-batch', '1')   // 开
localStorage.removeItem('aiNovel:e3-unit-batch')     // 关（恢复逐字节旧行为）
```

- [ ] 开启后点「生成情节大纲」，DevTools 先出现 `[E3] 单元批次：第 k 个单元，从第 N 章起（名义上界 X 章 / 本卷剩余 Y 章）`
  - **没有这一行 = 单元批次没被发射**，后面的观测点全部无意义（先查开关值 / 是否勾了情节大纲 / 是否 dev 构建）
- [ ] 关掉后同一操作仍走按章区间（`architecture:planning-intent` 里是 `synopsisRange`，不是 `synopsisUnit`）

---

## 2. 环境（两个项目都要）

- [ ] `pnpm run rebuild:electron` —— `better-sqlite3` 常被 node 侧测试翻成 Node ABI，不重建 `pnpm dev` 直接崩
- [ ] `pnpm dev`，等日志出现 `[AI Novel IPC] 所有 Controller 已注册完成` 再动手

---

## 3. 项目 A · 新项目（按 A1→A6 顺序，改一个变量看一个结果）

### A0 准备

- [ ] 新建项目，`pnpm dev` 里走完「故事前提 / 角色 / 世界观 / **弧光结构**」四个步骤
  - ⚠️ 弧光结构必须有 `### 单元一：` 或 `【小弧名】` 划界，否则单元模式**一步都跑不了**
- [ ] 记下 `novelConfig.totalChapters` = ______（后面所有判据都拿它当分母）
- [ ] 记下弧光结构里有几卷、每卷几个单元 = ______
- [ ] 确认 `.ai-novel/partial_arch.json` 里**没有** `synopsis_covered_to`（或为 0）

### A1 首单元

- [ ] 勾「情节大纲」→ 确认 → 日志 `正在写【单元 1：名】，从第 1 章起（全书 M 章）`
- [ ] 完成 → 日志 `本单元实际写 N 章（第 1–N 章）`
- [ ] `.ai-novel/partial_arch.json`：`synopsis_range.to` = **实际** N（不是名义上界）
- [ ] 同文件 `synopsis_unit_cursor` 是「下一个单元」
  - 单元 1 写完且卷内还有单元 2 ⇒ `unitIndex` = 2、`writtenInVolume` = N
  - 单元 1 是全卷唯一单元 ⇒ `volumeIndex` 已是下一卷、`unitIndex` = 1、`writtenInVolume` = 0

### A2 连续第二单元（**A 的核心**）

- [ ] 再点一次 → 日志 `正在写【单元 2：名】，从第 N+1 章起`
  - 判据：`from = covered_to + 1`，单元号来自游标。**若从第 1 章重来，说明走成了覆盖重写，不是单元模式**
- [ ] 完成 → `synopsis_range.to` 追上新的实际章数
- [ ] 两次生成**都没有**报「源事实已变化」（指纹：中断用 boundTo、完成用 actual，混一次就必报）

### A3 余量块

- [ ] 卷内还有余量时，请求里带余量块（`r < 0.9` 收紧 / `r > 1.1` 展开 / 带内只给余量行）
- [ ] **本卷剩余写到 0 时，余量块消失**（注入了会渲染成「名义上界 0 章」，等于给章数目标）

### A4 卷末对账

- [ ] 某卷写完 → 日志 `卷 N 写完：计划 X 章，实际 Y 章（偏离 ±D）；全书计划 P，累计 ±S，实际预期 P±S 章`
- [ ] `partial_arch.json` 的 `synopsis_volume_deviations` 有 `{volumeIndex, planned, actual}` 一条
- [ ] `novelConfig.totalChapters` **没变**（计划是基线，实际预期只作展示）

### A5 预算

- [ ] 全程无 `ROOT_BUDGET_EXHAUSTED`（真写穿除外）

### A6 人为偏离（T4a 修订要保住的性质，只能在 A 上做）

- [ ] **先复制备份** `.ai-novel/partial_arch.json`
- [ ] **关掉应用**（运行中改会被内存态覆盖）
- [ ] 把 `synopsis_unit_cursor.writtenInVolume` 改成 `+3` 或 `−3`
- [ ] 重开 → 再点一次：`from` 仍 = `covered_to + 1`，单元号仍来自游标
  - 期望：**不会**因为少写/多写被判成卡死、也不会跳到别的单元

---

## 4. 项目 B · 旧检查点项目（A 做完再做，别并行）

### B0 准备与自检

- [ ] 打开 `.ai-novel/partial_arch.json`，三项**同时**成立才算合格的「旧检查点」：
  - [ ] `synopsis_range` 存在
  - [ ] `synopsis_covered_to ≥ 1`
  - [ ] **`synopsis_unit_cursor` 不存在**（有它就不是旧检查点，迁移分支不会进）
- [ ] `plotStructurePlan` 有 `### 单元一：` 或 `【小弧名】` 划界（没有 ⇒ 先重跑弧光结构，见 §6 风险 1）

> 手上没有旧项目？**拿 A 跑完一个单元后手造**：关掉应用 → 从 `partial_arch.json` 删掉 `synopsis_unit_cursor` 这一项（保留 `synopsis_covered_to` 和 `synopsis_range`）→ 下次点生成就走迁移分支。比找老项目更可控。

### B1 迁移

- [ ] 点「生成情节大纲」→ 日志出现 `迁移情节大纲单元游标`（**只出现一次**）
- [ ] `partial_arch.json` 里出现 `synopsis_unit_cursor`
- [ ] 该游标定位到的单元与「含 `covered_to` 的单元」一致（`unitIndex` 对得上你记忆里正在写的那一个）

### B2 迁移后跑完

- [ ] 本次生成正常跑完，**不报**「无法由单元游标定位本次单元」
- [ ] 不报「本次请求的单元…与大纲进度…不一致，拒绝按过期请求生成」
- [ ] 完成后 `synopsis_range.to` 按实际章数回填，游标继续推进

### B3 边界情况（命中就记，不要现场改）

- [ ] 若 `synopsis_covered_to` 正好停在某单元**最后一章**：记录实际 `unitIndex` 与 `from`
  - 预期现象：`from` 指向下一单元开头，但 `unitIndex` 仍是被写完的那个（滞后一位）。**这是 T7 迁移口径的已知缺口**，记为「待定」，不要在这里改代码

---

## 5. 收尾（两个项目跑完）

- [ ] 在 **A** 上验蓝图冻结：大纲写到第 N 章时，蓝图范围选项冻结在 N，提示「第 N+1 章及以后还没有大纲…」
- [ ] 大纲覆盖数为 0 / 读不到时**不限制**（fail-open）
- [ ] 关掉开关，确认回到按章区间（regression：旧路径逐字节不变）

---

## 6. 取证明细（按项目分开放，别混在一个文件里）

```
t10-evidence/
├─ A-new/
│  ├─ partial_arch.after-unit1.json
│  ├─ partial_arch.after-unit2.json
│  ├─ partial_arch.after-offset.json     # A6 改过 writtenInVolume 之后
│  └─ workflow.log
└─ B-legacy/
   ├─ partial_arch.before.json           # 跑之前（要能证明 cursor 不存在）
   ├─ partial_arch.after.json            # 迁移之后
   └─ workflow.log
```

- [ ] 两个项目各一份日志（含时间戳）+ 上述 JSON
- [ ] 异常项：截图 + 报错原文（中文串优先，便于定位 `text()` 分支）
- [ ] `git rev-parse HEAD` 与 `git status --short`（确认跑的是哪个版本）

> 只读排查作者库时**连 `-wal` 一起复制**，否则会误判「没落库」。

---

## 7. 已知风险（跑之前先知道，别当成新 bug）

1. **旧项目没有结构化骨架就定位不到单元。** `computeSynopsisUnitRange` 第一步是 `parseArcStructure(plotStructurePlan)`，为空直接返回 `null` ⇒ 「无法由单元游标定位本次单元」。先把弧光结构重跑成带「### 单元一：」的形态再验 B。
2. **旧检查点停在单元边界时 `unitIndex` 会滞后一位**（见 B3）。发射侧与命令侧同源，所以不会被拒绝，但语义错位。属 T7 迁移口径缺口，T10 只记录。
3. **中断态会退回按章区间。** `synopsis_incomplete = true` 时单元模式显式让位给旧的 `resumeSynopsis`，因为「中断续写是接着写同一单元还是算下一个」尚未定。日志里走 range 是预期。

---

## 8. 收口动作

- [ ] 全绿 ⇒ 进 T11：开关改正式入口，并定「从第 1 章重写」在单元模式下的表达（清检查点 + 游标，或另给 reset 语义）
- [ ] 有阻塞 ⇒ 先修阻塞再开关，**不要带着红项接 T11**
- [ ] 结论回写到 [`2026-10-20-e3-unit-batch-handoff.md`](2026-10-20-e3-unit-batch-handoff.md) §5 与当日日志
