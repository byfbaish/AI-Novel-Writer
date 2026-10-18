# 弧光 v7 / 弹性配给 · 工间交接（2026-10-19）

> 用途：**换会话 / 换人接手前读这一份**。只回答四件事：做到哪了、下一步是什么、哪些结论已验证、哪些坑必须绕开。
> 设计细节在 [`unit-budget-elastic-allocation-design.md`](../design/architecture/unit-budget-elastic-allocation-design.md) 与 [`unit-budget-prompt-ab-test.md`](../design/architecture/unit-budget-prompt-ab-test.md)，本文不重复。

---

## 0. 一句话现状

弧光层（卷/单元）已全线落地并在真实项目上跑通；**情节大纲的"逐单元生成 + 弹性配给"只完成了提示词验证（E2），代码一行未动**。

---

## 1. 分支与状态

| 项 | 值 |
|---|---|
| 分支 | `exp/arc-tree-v2` |
| HEAD | `43476e5e` |
| 工作区 | 干净（无未提交改动） |
| 基线 | 从 `dev_byf` fork，未切换 |

---

## 2. 今天完成了什么

### 2.1 弧光 v7 落地（P1–P4，已实施并可运行）

| commit | 内容 |
|---|---|
| `63ce5c30` | 解析器兼容「卷/单元」：别名 `(?:大弧\|卷)`、`(?:中弧\|单元)`、补中文序号、两级模式 `isTwoLevelArcStructure`、`isTurnField` 认「逼法」 |
| `4211ba3e` | 画像注入：**M09**（v9→v10）`rhythm_profile` 列 + 模板换 v7（中英）+ 空值中性 |
| `a04e0944` | 两级体检两条：`ARC_SAME_HAND_TYPE` / `ARC_TIER_STUCK`（只报不拦） |
| `34bc27e2` | 设置项「平台节奏」+ 文案改「卷 / 单元结构」 |
| `1129baaf` | **事故修复**：规范库升级白名单漏 v9 → 老项目打不开（`CANONICAL_SCHEMA_UPGRADE_UNSUPPORTED`），加回归测试 |
| `0357f08c` | 补齐 UI/日志文案 + synopsis 模板改引用两级字段 |
| `1ca2bd3f` | `UNIT_TOO_LONG` 体检（>9 章/单元提示切换少了）+ 修 volume 下「结束状态」字段错位 |

### 2.2 章纲 ↔ 蓝图分工

`5425d6c3`：章纲每章新增一行 `选择：<躲|拖|换|认> —— <他选了什么>`；正文从"事件流水"改为"因果与代价"，并**明确把"怎么试、分几段"让给蓝图 keyEvents**；蓝图 `purpose` 必须继承该选择。

### 2.3 短细纲改为预算执行者

`7e1a6d35`：新增 `shortOutlineSegmentBudget()`，**代码**把 `estimatedUnits` 折算成每段字数（floor 分配 + 末段吃余数，合计严格等于章目标）；短细纲只按段数/顺序/字数落成执行表。

> 动机：`estimatedUnits` 此前**全仓无消费者**，`keyEventsText` 投影时还把它丢掉了。

### 2.4 弹性配给（设计 + 提示词验证）

| commit | 内容 |
|---|---|
| `c3ba6164` | 设计稿：Z = 实际消耗 − 计划进度，±10% 三档，偏差只在卷内结清 |
| `b83e4973` | A/B/C 微型测试件（虚构数据，不跑真项目） |
| `d4ff4db0` … `43476e5e` | 两轮实测、读数更正、撤回一次错误方向 |

---

## 3. 进度与下一步

| 阶段 | 内容 | 状态 |
|---|---|---|
| **E1** | `planProgress(parsed, total, unitRef)` 纯函数 + 单测 | ❌ **未开始** |
| **E2** | 提示词验证（状态块能否改变章数） | ✅ **已完成**（见 §4） |
| **E3** | 批次改「逐单元生成」+ 检查点改造 | ❌ 未开始，**风险最高** |
| **E4** | 卷级额度设置 + 卷末报警 | ❌ 未开始 |

**起手建议**：做 E1，只写纯函数与单测，不碰链路。设计稿 §2 有公式，§7 有验收。

---

## 4. 已验证的结论（不要再重测）

**E2 通过，两轮数据：**

| 轮次 | 不足 | 均衡 | 充足 | 参考 |
|---|---|---|---|---|
| 第一轮 | 5 章 | 8 章 | 9 章 | 6.7 |
| 第二轮（固定起点） | **4** | **7** | **9** | 5 / 6.7 / 10 |

判定标准（**只看这三条**）：

1. 顺序：不足 < 均衡 < 充足；
2. 区间：各自落在允许范围内（均衡是参考值 ±10%，**不是某个点**）；
3. 不越界：不丢单元规格、不提前写下一单元。

> ⚠️ **不要把"落在区间上沿"当缺陷。** 均衡的含义是"落在区间内任何位置都对"，与卷纲「每卷 3–5 个单元都可能产生」同构。曾有人（本交接的作者）为此提出"锚点 = 期望 ÷ 1.15"的校正，是**错误方向**，已在测试件 §8.0 记录作废。

---

## 5. 待作者裁定

| # | 事项 | 现状 |
|---|---|---|
| 1 | 两级模式下「覆盖：」是否取消 | 实测前 4 章里 3 章只能写「无」（每单元只有 1 个可声明位）；对账几乎无信息量 |
| 2 | 卷末报警阈值 | 设计稿写 15%，未确认 |
| 3 | 卷级额度的 UI 形态 | 已定"画像默认 + 作者可覆盖"，交互未设计 |

---

## 6. 接手必看的代码锚点

| 位置 | 说明 |
|---|---|
| `src/shared/arc-position.ts` | `MAJOR_HEADING`/`MID_HEADING` 别名、`isTwoLevelArcStructure`、`renderArcPositionBlock` 的 volume 换词、`auditTwoLevelDensity`、`UNIT_CHAPTER_SOFT_CAP` |
| `src/services/workflows/commands/architecture.command.ts` | synopsis 分批状态机（`synopsisRange`、`synopsis_covered_to`）、`summarizeArcDensity`、`synopsisBatchInstruction` |
| `src/shared/draft-short-outline.ts` | 短细纲材料与指令；`shortOutlineSegmentBudget` |
| `electron/migrations/m09-rhythm-profile.ts` | 新增列；同目录 `registry.ts` 的 `LATEST_SCHEMA_VERSION = 10` |
| `electron/services/sqlite-project-migration.ts` | **升级白名单 `[1..9]`** —— 加新迁移时必须同步 |

---

## 7. 必须绕开的坑

1. **lane 六步第 5 步（白名单）最容易漏**：漏了不报 typecheck，只在打开老项目时炸。加 M10 必须同步。
2. **`keyEventsText` 会丢掉 `estimatedUnits`**：任何要读预算的地方必须用**原始** `chapterInfo.keyEvents`，不能用 `writerChapterInfo`。
3. **两级结构下「覆盖」几乎全"无"**：这是结构性的（每单元只有「逼法」一个可声明位），不是模型偷懒。
4. **`commands/__tests__` 里 15 条失败是环境噪声**：`finalize-postprocess-character.integration.test.ts` 的 `fs.rmSync` 被宿主 safe-delete 接管，genie-trash 报 "operations were aborted"。与代码无关，单跑同目录其余用例正常。
5. **改模板/主进程模块必须重启 `pnpm dev`**，热更新不覆盖。

---

## 8. 上一轮作者（我）的错误模式（供接手者警惕）

不是自责清单，是**这类数据不要再被误读**：

1. **同一份实测数据连续误读三次**：先当章数、再当每章行数、最后才确认是**章号区间**。→ 凡"区间"数字，先问清单位与列名。
2. **目标偏移**：为了让 B 落在 5–6，提出下调锚点。**调输入去凑期望值，验证的就不是机制了**。
3. **把"落在区间上沿"当缺陷**，进而否定一个本来正确的设计。
4. **未经证实的守恒推断**：v6 时把 28 vs 29 说成"总量守恒"，下一轮 23 vs 28 直接推翻。→ 单次巧合不能当规律。

---

## 9. 未验证事项（不要当成结论）

- `1.15` 膨胀率：**已作废**，只作历史记录。
- 单元章数"由内容决定"在真实链路下的效果：E2 只验证了提示词，真实链路里起点每次都在变，**尚未验证**。
- 「一个单元 = 一件任务 + 一次逼法换代」的容量假设：来自 5.36 章/单元的实测观察，未系统验证。

---

## 10. 相关文档

- 设计稿：[`unit-budget-elastic-allocation-design.md`](../design/architecture/unit-budget-elastic-allocation-design.md)
- 测试件（含两轮实测与作废章节）：[`unit-budget-prompt-ab-test.md`](../design/architecture/unit-budget-prompt-ab-test.md)
- 弧光层定位：[`arc-layer-handoff.md`](../design/architecture/arc-layer-handoff.md)
- v7 落地：[`arc-v7-implementation-design.md`](../design/architecture/arc-v7-implementation-design.md)
