> ⚠️ **本页已冻结（2026-10-11 的状态看板，仅作存档）。现行唯一入口是 [`../README.md`](../README.md)。**
> 自 2026-10-17 起 `docs/plans/` 只保留「唯一 TODO 台账 + Program v3 冻结合同」；
> 原先散落在本目录的设计稿已迁至 [`../design/`](../design/)，索引见 [`../README.md` §4](../README.md#4-现行设计索引)。

# 📋 docs/plans 总览索引（唯一入口）

> **本文件是 `docs/plans/` 的导航 + 状态看板。任何 agent 接手先读这里。**
> 更新：2026-10-11 · 分支 `dev_byf`（**未推送**）
> ⚠️ 另有上游独立计划在 `docs/research/`，入口是 [`NOVEL-QUALITY-CURRENT.md`](./NOVEL-QUALITY-CURRENT.md)，**与本目录不是同一批**。

---

## 0. ⭐ 一句话状态：**"故事弧（第五层）"阶段一/二已提交，等作者实机验证**

| 问题 | 状态 |
|---|---|
| **方案敲定了吗？** | ✅ **本轮 5 个待确认项已全部由作者拍板**（见 §3）—— **设计面已闭环** |
| **写代码了吗？** | ✅ **已提交** `796528f`（阶段一 ①列/指纹/消费 ②Prompt ③UI 5 卡片 + 枚举降级 + 纯 UI 旧模板"可看可改 + 显著提示"；阶段二④ 世界观空间结构）；`98b73ac`+`3897dcd` 修掉其引入的旧项目兼容回归 |
| **下一步干什么？** | ★ **作者实机验证「自由弧」生成效果**（新建项目跑一次架构第四步）；见 §2「接下来做什么」 |
| **最大风险？** | ① **落地时序**（AC1 已后移）② ★ **M00 基线 DDL 不可再改**（见 §5 纪律 #10，`98b73ac` 踩过） |
| **已知欠债** | 两处 pre-existing 测试失败（`character_background_synthesis` 的英文变量描述缺失，`prompt-local-qwen-contract` / `prompt-project-session` 各 1）——**与弧无关，未登记他处，勿误判为本次回归** |

---

## 1. 🗂 文档分类目录

### A. 【主攻】故事弧 / 第五层（本会话系列的目标）

| 文档 | 角色 | 状态 |
|---|---|---|
| [`story-arc-proposal.md`](../design/architecture/story-arc-proposal.md) | 弧设计的**首份提案**（v1→v4） | ✅ 已被后续文档吸收，保留作演进记录 |
| [`stage-structure-layer.md`](../design/architecture/stage-structure-layer.md) | ★ **第五层显现设计**（"不是二选一，是把隐藏层显性化"）+ **6 步落地+<20 行改动链** | ★ **主文档：施工图** |
| [`arc-nesting-design.md`](../design/architecture/arc-nesting-design.md) | ★ **弧的层级/因果/篇幅设计**（同级推进=核心、弧分型 A/B/C、篇幅经验表、无字段） | ★ **主文档：语义规范** |
| [`arc-granularity-and-enum.md`](../design/architecture/arc-granularity-and-enum.md) | ★ **作者五问答复**（步骤粒度=一步+Prompt内分节；枚举=降级不删除；空间/P4/AC1 三条拍板） | ★ **本文件：问答闭环记录** |
| [`l3-arc-gap-verification.md`](../design/architecture/l3-arc-gap-verification.md) | L3 缺失的**二次核实**（剧情树/线索/弧光都不构成 L3） | ✅ 已定论（撤回"半个 L3"高估） |

### B. 【外部材料评估】四份报告 + 一份修订版 + 一份数量诊断（正交：广度/手段/判据/施工图/数量）

| 文档 | 对应报告 | 一句话裁决 |
|---|---|---|
| [`state-tracking-assessment.md`](../design/architecture/state-tracking-assessment.md) | ①《状态管理的收益/可落地性分析》 | **= 广度**：13 类状态里，只有"角色知识"是纯空白 P0 |
| [`arc-prompt-assessment.md`](../design/architecture/arc-prompt-assessment.md) | ②《弧生成 Prompt 设计》 | **= 手段**：哲学吸收（弧分型）、手段拒绝（YAML/三步/逐弧审） |
| [`causal-vs-state-digestion.md`](../design/architecture/causal-vs-state-digestion.md) | ③《因果 vs 状态》 | **= 判据**："能推理→prompt；不能推理→代码"，纠其"因果一律 prompt"失真 |
| [`arc-space-causal-state-feasibility.md`](../design/architecture/arc-space-causal-state-feasibility.md) | ④《弧/空间/因果/状态》修订版 | **= 施工图**：方向一致，3 处"零代码"被低估（已还原真实成本） |
| [`layered-generation-assessment.md`](../design/architecture/layered-generation-assessment.md) | ⑤《分层生成 + 增量生成》 | **= 数量诊断**：仅建议 4（篇幅约束）可采纳；其 `scope` 字段与三层拆步**撞已定边界**。★ 实测根因带行号 |

### C. 【架构校验】AC 系列

| 文档 | 角色 | 状态 |
|---|---|---|
| [`architecture-consistency-design.md`](../design/architecture/architecture-consistency-design.md) | 五层一致性校验评估 → **AC1/AC2/AC3 分三段** | ✅ 已进 backlog 优先级表；**§6 已补实机核对**（前 30 章 vs 弧光：Σ大弧 880≠845、中弧 2 的动作被提前到第 9–10 章执行、副本未命名等） |
| [`outline-structure-marker-assessment.md`](../design/prompt/outline-structure-marker-assessment.md) | 对外部《大纲加标记行》报告的评估 | **诊断对、处方错层**：本项目大纲与正文之间**已有章节蓝图 JSON**；5 个缺口里 4 个已覆盖/已立项。替代方案（`【第N章必现】` 接入大纲）**已实施** |

### D. 【坐标系/骨架】

| 文档 | 角色 | 状态 |
|---|---|---|
| [`seven-layer-skeleton-assessment.md`](../design/architecture/seven-layer-skeleton-assessment.md) | 七层骨架模型（L0–L6）+ 已有 P1–P5 归位 | ✅ 已定论（⚠️ 与"五层架构"编号不同，见该文档换算） |
| [`prompt-assembly-backlog.md`](./prompt-assembly-backlog.md) | ★★ **跨会话待办台账**（P1–P5 + S1–S3 + AC1–AC3 全在里面） | ★ **主台账：所有 TODO 的唯一清单** |

### E. 【P 系列：Prompt 组装 / 角色卡】（前序会话主线，多已关闭）

| 文档 | 角色 | 状态 |
|---|---|---|
| [`p1-literal-dedup.md`](../design/prompt/p1-literal-dedup.md) | P1 逐字去重 | ✅ **已完成**（Phase 0/1/2） |
| [`p1-blueprint-roster-sync.md`](../design/characters/p1-blueprint-roster-sync.md) | P1 蓝图角色↔roster 同步 | ✅ 已实施（`9504097`/`5933a50`） |
| [`p2-character-card-ai-generation.md`](../design/characters/p2-character-card-ai-generation.md) | P2 角色卡 AI 生成增强 | ✅ 已实施 |
| [`p3-semantic-dedup.md`](../design/prompt/p3-semantic-dedup.md) | P3 语义去重 | 🏁 **已关闭**（收益仅 2.8–4.7%，替代方案 A 已落地 `835b297`） |
| [`p4-prompt-config-merge.md`](../design/prompt/p4-prompt-config-merge.md) | P4 提示词配置整合 | ⚠️ **待做**（P3 关闭后它的地位上升，见 `p4-reassessment.md`） |
| [`p4-reassessment.md`](../design/prompt/p4-reassessment.md) | P4 重新评估 | ✅ 结论：原形态取消，实质并入 P3 思路 |

### F. 【历史/冻结】novel-quality program（**不要动**）

| 目录/文件 | 说明 |
|---|---|
| `novel-quality-program-v3-2026-09-13/` | 冻结原合同（历史归档，**不继续执行**） |
| `novel-quality-program-2026-09-13/` | v2 历史 |
| `novel-quality-modernization/` | 24 片规格（仅在 v3 合同覆盖下执行） |
| [`chapter-goal-review-production.md`](./chapter-goal-review-production.md) | 本章目标审稿（小项） |
| `prompt-assembly-optimization.html` | 配套可视化 |

---

## 2. ★★ 接下来做什么（按此顺序）

> 综合 [`prompt-assembly-backlog.md`](./prompt-assembly-backlog.md) 优先级表 +
> [`arc-space-causal-state-feasibility.md §5`](../design/architecture/arc-space-causal-state-feasibility.md) 的修正次序。

```
┌─ 阶段〇：★ 实机验证 + 数量修正（当前焦点）
│   ⓪ 作者实机跑架构第四步「弧光结构」，确认自由弧生成效果可用
│      （验收点：plotStructurePlan 落库 → 大纲消费点走自由弧而非枚举模板）
│   ⓪-2 ★ **G1 生成数量按篇幅推算**（实机验证暴露的问题，纯 Prompt）
│      —— 800 章项目只出 6 角色 / 少量阶段；见 `layered-generation-assessment.md §5`
│
├─ 阶段一：弧层落地（Prompt，零~低代码）  ✅ 已提交 `796528f`
│   ① 阶段结构层 步骤 1–3：project_core 加列 → 接指纹 → 消费点三元   ✅
│   ② 弧生成 Prompt 定稿：篇幅经验表 + 弧分型(A/B/C) + 弧间因果推进    ✅
│      （形态 = **一步出整段 + Prompt 内分节**；★ 不拆步，见 arc-granularity-and-enum.md §1）
│   ③ ★ UI：阶段结构卡片 + **枚举降级为"起手模板按钮"**（不删枚举，见 §2 问 2） ✅
│   ⚠️ 副作用修复：加列曾误改 M00 基线 DDL → 旧项目 `UNRECOGNIZED_SCHEMA`，
│      已由 `98b73ac` 改为 M07 子迁移（v7→v8）并恢复基线冻结
│
├─ 阶段二：世界观补全（★ 作者要求"必须"）  ✅ 已提交 `796528f`
│   ④ S1-空间结构：世界观模板加第 4 维 + 6 处文案（4 文件）改"四个维度"   ✅
│      （弧的"空间：X" ↔ 世界观第 4 节，弱引用；见 arc-granularity-and-enum.md §3.1）
│
├─ 阶段三：架构定型后的校验（★ 时机后移，成本不变）  ← ★ 阶段一/二验证通过后的下一站
│   ⑤ AC1 层内一致性（作者：等架构不完整期过去，否则回归测试爆炸）
│
├─ 阶段四：状态追踪（中代码）
│   ⑥ 角色知识 known_by（挂事实链，不建矩阵）← 唯一纯空白 P0
│
├─ 阶段五：引用完整性（中代码）
│   ⑦ AC2 层间引用（具名实体）→ ⑧ AC3 弧加入后校验（依赖弧层落地）
│
└─ 阶段六：合并决策 / 挂起
    ⑨ 物品/场景/时间线 → 合并为一个议题，与"空间结构"一起决策
    ⑩ P4 提示词配置整合 → ★ 作者拍板**延后**（可用户自维护，收益低）
```

**★ 为什么这样排（关键理由）：**

| 决定 | 理由 |
|---|---|
| **① 先于一切** | <20 行、零风险、能立刻验证"第五层"是否有价值 |
| **空间结构升到阶段二** | ★ 作者拍板"必须做"（"没有地图的世界背景算什么世界"），不再是待确认项 |
| **AC1 降到阶段三** | ★ 作者拍板后移：架构不完整期做层内校验 = 校验对象反复变 = **回归测试爆炸**（成本不变、时机后移） |
| **状态类全部靠后** | `causal-vs-state-digestion.md` 判据：状态推不出来必须写代码，成本最高 |
| **⑦⑧ 依赖弧层** | 弧不落地，"弧引用完整性"无对象可查 |
| **P4 挂起（不删）** | 作者：可用户自维护；P3 关闭后它曾上升，故保留条目但不排前 |

---

## 3. ✅ 作者已拍板（原 5 个待确认项 —— **本轮全部闭环**）

> 来源：`stage-structure-layer.md §5` + backlog。**原话与推演详见 [`arc-granularity-and-enum.md`](../design/architecture/arc-granularity-and-enum.md)。**

| # | 原待确认 | ✅ 作者决策 | 落点 |
|---|---|---|---|
| **1** | 弧生成**步骤粒度** | **一步出整段 + Prompt 内分节**；拒绝"拆成多个 DB 步骤" | `arc-granularity-and-enum.md §1` |
| **2** | 弧与 `plotStructure` **枚举关系** | **不替换、不删除，只降级**：弧文本为主来源（`:2281` 三元），枚举变 UI"起手模板按钮" | `arc-granularity-and-enum.md §2` |
| **3** | **空间结构**是否进世界观 | ✅ **必须做**（"没有地图的世界背景算什么世界"）→ 升为阶段二 | `arc-granularity-and-enum.md §3.1` |
| **4** | **P4 是否现在做** | ✅ **延后**（可用户自维护，收益低于弧线） | 阶段六（挂起，不删条目） |
| **5** | **AC1 是否批准开工** | ✅ **放在弧设计之后**（架构不完整期做会致回归测试爆炸） | 阶段三（成本不变、时机后移） |

### ❓ 上一轮我标注的"两个未直接回答的点" —— 现状

1. **"弧"的最终落点**（弧 = `plot_structure_guide` 的内容化？）→
   ✅ **作者在问 2 中已实质回答**："plotStructure 不就是静态的弧么" + "写一个替换原有枚举效果的新表现形式"
   → **= 确认"弧就是那一层，且枚举降级"**。**单点假设已消除。**
2. **弧是否要"参与生成"**（AI 生成 vs 作者手写）→
   ✅ **已明确**：架构阶段**新增一步**（同构于 worldbuilding），AI 生成 + 作者可编辑
   （`stage-structure-layer.md §2.2`、`arc-nesting-design.md §3.2`）。

**→ §3 已无阻塞项。设计面可视为闭环，可进入施工。**

---

## 4. 🧭 四份外部材料的关系（防重复立项）

```
①《状态管理分层》  = 广度（13 类：有哪些状态）
②《弧生成 Prompt》 = 手段（弧怎么把因果写进 Prompt）
③《因果 vs 状态》  = 判据（能推理→prompt；不能→代码）
④《修订版总结》    = 施工图（把①②③落到具体改动点）
⑤《分层生成+增量》 = 数量（为什么只有 6 角色 / 少量阶段）
```

**五者正交，合起来才是完整方法论。** 评估结论：
- ① 低估本项目已有机制 → 真正缺的只有"角色知识"
- ② 手段与作者定性冲突 → 吸收其"弧分型"，拒绝 YAML
- ③ 把"因果"简化为一类 → 纠正：**弧间因果仍空白**
- ④ 方向对 → 3 处"零代码"被低估，已还原成本
- ⑤ 诊断方向对但机制说错 → **仅建议 4（篇幅约束）可采纳**，其余撞边界；
  实测根因：角色模板写死「中长篇 4-6 人」、弧光模板无数量推算 → 已登记为 **G1**

---

## 5. 📌 边界纪律（所有后续改动必须遵守）

| # | 纪律 | 出处 |
|---|---|---|
| 1 | **弧/空间结构保持纯文本**，不建表、不加字段、不做结构化 | 作者定性 + `arc-nesting-design.md §0.1.1` |
| 2 | **弱引用靠命名一致**（弧写"空间：X"，名字对上即引用），不用外键 | `arc-space-causal-state-feasibility.md §6` |
| 3 | **弱引用不做硬校验**（弧里章号是预估，非契约） | `arc-nesting-design.md §5.1` |
| 4 | **校验结果 = 证据而非禁令** | `consistency-preflight.ts:82` 原注释 |
| 5 | **只查具名实体、放过指代**，防假阳性 | `architecture-consistency-design.md §3` |
| 6 | **状态类只做"角色知识"**，其余合并决策、不零散立项 | `causal-vs-state-digestion.md §5` |
| 7 | **弧间因果必须写出来**（不是章号契约，是语义要求，缺了就是废层） | `arc-nesting-design.md §5.2` |
| 8 | ★ **不删 `plotStructure` 枚举**——只降级为"起手模板"（短篇/新手/旧项目的兜底，删除收益为零） | `arc-granularity-and-enum.md §2.5` |
| 9 | ★ **弧生成不拆 DB 步骤**——一步出整段 + Prompt 内分节（拆步 = 管线 ×3、回归面大） | `arc-granularity-and-enum.md §1.3` |
| 10 | ★★ **M00 基线 DDL 一个字节都不能改**（注释/空白也算）。新增列一律新建 lane 步骤（Mxx），并同步 `MIGRATION_IDS` / `LATEST_SCHEMA_VERSION` / `CURRENT_DESKTOP_SCHEMA_VERSION` / `CANONICAL_SCHEMA_UPGRADE_UNSUPPORTED` 白名单 | `98b73ac`（2026-10-11 旧项目打不开的根因） |

---

## 6. 🔗 相关代码锚点（设计文档反复引用的）

| 位置 | 是什么 |
|---|---|
| `architecture-workflow.ts:279-355` | ★ `getPlotStructureGuide` = **被隐藏的第五层**（6 分支，纯函数） |
| `architecture.command.ts:2281` | ★ **消费点**（`.withPlotStructureGuide(...)`，改一处三元即可） |
| `architecture.command.ts:607-614` | `PLOT_STRUCTURES` 枚举白名单（**保留，不删**） |
| `NovelConfigEditor.tsx:273` | 枚举的 UI 入口（**降级为"起手模板按钮"**） |
| `novel-config-localization.ts:33-63` | `PLOT_STRUCTURE_LABELS`（含 `三幕式`/`three_act` 双键，保留） |
| `architecture.command.ts:410-430` | `synopsisInputsFingerprint`（改动失效机制，加一项即继承） |
| `architecture.command.ts:2261` | `executeChapterOutline`（分批可续写的展开器） |
| `project-core-repository.ts:73-85` | `ProjectCoreSynopsisExpected` 的 `Pick<>` |
| `builtin-prompt-templates.ts:508-520` | 世界观三维度（**空间结构要加的第 4 节**） |
| `builtin-prompt-templates.ts:672/709/853` | 章级因果链（**已有**，弧间因果才是空白） |
| `consistency-preflight.ts:97` | 唯一 1 条规则（`character-state`） |
| `blueprint-semantic-contract.ts` | 引用完整性范式（13 种诊断码） |
| `finalized-continuity-facts.ts:22` | `evidenceExcerpt`（强制原文溯源） |
| `consistency-preflight.ts:82` | "Findings are evidence, never a writing prohibition" |

---

## 7. 维护约定

- **本文件只做导航 + 状态，不写设计细节**（细节留在各文档）。
- 每完成一项，更新 §0 状态表与 §2 次序。
- 新增文档后，在 §1 归入对应分类。
- **`prompt-assembly-backlog.md` 是 TODO 的唯一清单**；本文件是它的"目录 + 进度视图"。
