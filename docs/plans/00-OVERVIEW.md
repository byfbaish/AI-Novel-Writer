# 📋 docs/plans 总览索引（唯一入口）

> **本文件是 `docs/plans/` 的导航 + 状态看板。任何 agent 接手先读这里。**
> 更新：2026-10-11 · 分支 `dev_byf`（**未推送**）
> ⚠️ 另有上游独立计划在 `docs/research/`，入口是 [`NOVEL-QUALITY-CURRENT.md`](./NOVEL-QUALITY-CURRENT.md)，**与本目录不是同一批**。

---

## 0. ⭐ 一句话状态：**当前主攻"故事弧（第五层）"，方案已基本敲定，尚未动业务代码**

| 问题 | 状态 |
|---|---|
| **方案敲定了吗？** | ⚠️ **方向已敲定，细节还有 2 处待确认**（见 §3） |
| **写代码了吗？** | ❌ **没有**。本轮全是设计文档；业务代码零改动（唯一例外：`835b297` 三处提示词补约束） |
| **下一步干什么？** | ★ **见 §2「接下来做什么」** —— 建议先做「阶段结构层」的步骤 1–3（<20 行验证价值） |
| **最大风险？** | 方案虽小，但**依赖作者对"弧"的最终定性**——若作者再改方向，前面的 Prompt 设计要重做 |

---

## 1. 🗂 文档分类目录

### A. 【主攻】故事弧 / 第五层（本会话系列的目标）

| 文档 | 角色 | 状态 |
|---|---|---|
| [`story-arc-proposal.md`](./story-arc-proposal.md) | 弧设计的**首份提案**（v1→v4） | ✅ 已被后续文档吸收，保留作演进记录 |
| [`stage-structure-layer.md`](./stage-structure-layer.md) | ★ **第五层显现设计**（"不是二选一，是把隐藏层显性化"）+ **6 步落地+<20 行改动链** | ★ **主文档：施工图** |
| [`arc-nesting-design.md`](./arc-nesting-design.md) | ★ **弧的层级/因果/篇幅设计**（同级推进=核心、弧分型 A/B/C、篇幅经验表、无字段） | ★ **主文档：语义规范** |
| [`l3-arc-gap-verification.md`](./l3-arc-gap-verification.md) | L3 缺失的**二次核实**（剧情树/线索/弧光都不构成 L3） | ✅ 已定论（撤回"半个 L3"高估） |

### B. 【外部材料评估】三份报告 + 一份修订版（正交：广度/手段/判据/施工图）

| 文档 | 对应报告 | 一句话裁决 |
|---|---|---|
| [`state-tracking-assessment.md`](./state-tracking-assessment.md) | ①《状态管理的收益/可落地性分析》 | **= 广度**：13 类状态里，只有"角色知识"是纯空白 P0 |
| [`arc-prompt-assessment.md`](./arc-prompt-assessment.md) | ②《弧生成 Prompt 设计》 | **= 手段**：哲学吸收（弧分型）、手段拒绝（YAML/三步/逐弧审） |
| [`causal-vs-state-digestion.md`](./causal-vs-state-digestion.md) | ③《因果 vs 状态》 | **= 判据**："能推理→prompt；不能推理→代码"，纠其"因果一律 prompt"失真 |
| [`arc-space-causal-state-feasibility.md`](./arc-space-causal-state-feasibility.md) | ④《弧/空间/因果/状态》修订版 | **= 施工图**：方向一致，3 处"零代码"被低估（已还原真实成本） |

### C. 【架构校验】AC 系列

| 文档 | 角色 | 状态 |
|---|---|---|
| [`architecture-consistency-design.md`](./architecture-consistency-design.md) | 五层一致性校验评估 → **AC1/AC2/AC3 分三段** | ✅ 已进 backlog 优先级表 |

### D. 【坐标系/骨架】

| 文档 | 角色 | 状态 |
|---|---|---|
| [`seven-layer-skeleton-assessment.md`](./seven-layer-skeleton-assessment.md) | 七层骨架模型（L0–L6）+ 已有 P1–P5 归位 | ✅ 已定论（⚠️ 与"五层架构"编号不同，见该文档换算） |
| [`prompt-assembly-backlog.md`](./prompt-assembly-backlog.md) | ★★ **跨会话待办台账**（P1–P5 + S1–S3 + AC1–AC3 全在里面） | ★ **主台账：所有 TODO 的唯一清单** |

### E. 【P 系列：Prompt 组装 / 角色卡】（前序会话主线，多已关闭）

| 文档 | 角色 | 状态 |
|---|---|---|
| [`p1-literal-dedup.md`](./p1-literal-dedup.md) | P1 逐字去重 | ✅ **已完成**（Phase 0/1/2） |
| [`p1-blueprint-roster-sync.md`](./p1-blueprint-roster-sync.md) | P1 蓝图角色↔roster 同步 | ✅ 已实施（`9504097`/`5933a50`） |
| [`p2-character-card-ai-generation.md`](./p2-character-card-ai-generation.md) | P2 角色卡 AI 生成增强 | ✅ 已实施 |
| [`p3-semantic-dedup.md`](./p3-semantic-dedup.md) | P3 语义去重 | 🏁 **已关闭**（收益仅 2.8–4.7%，替代方案 A 已落地 `835b297`） |
| [`p4-prompt-config-merge.md`](./p4-prompt-config-merge.md) | P4 提示词配置整合 | ⚠️ **待做**（P3 关闭后它的地位上升，见 `p4-reassessment.md`） |
| [`p4-reassessment.md`](./p4-reassessment.md) | P4 重新评估 | ✅ 结论：原形态取消，实质并入 P3 思路 |

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
> [`arc-space-causal-state-feasibility.md §5`](./arc-space-causal-state-feasibility.md) 的修正次序。

```
┌─ 阶段一：弧层落地（Prompt，零~低代码）  ← ★ 当前焦点
│   ① 阶段结构层 步骤 1–3（<20 行）：project_core 加列 → 接指纹 → 消费点三元
│      → 作者可先在 DB 手写一段弧文本验证效果（stage-structure-layer.md §4）
│   ② 弧生成 Prompt 定稿：篇幅经验表 + 弧分型(A/B/C) + 弧间因果推进（arc-nesting-design.md §2）
│
├─ 阶段二：架构层校验（低代码）
│   ③ AC1 层内一致性（角色卡↔人物群像对齐）← ★低垂果实：1 个纯函数即见效
│
├─ 阶段三：状态追踪（中代码）
│   ④ 角色知识 known_by（挂事实链，不建矩阵）← 唯一纯空白 P0
│
├─ 阶段四：引用完整性（中代码）
│   ⑤ AC2 层间引用（具名实体）→ ⑥ AC3 弧加入后校验（依赖弧层落地）
│
└─ 阶段五：合并决策（零代码，只是不零散立项）
    ⑦ 物品/场景/空间/时间线 → 合并为一个议题，与"空间结构"一起决策
```

**★ 为什么这样排（关键理由）：**

| 决定 | 理由 |
|---|---|
| **① 先于一切** | <20 行、零风险、能立刻验证"第五层"是否有价值 |
| **AC1 早于角色知识** | AC1 是低垂果实（1 个函数），角色知识跨三层且判定不可靠 |
| **状态类全部靠后** | `causal-vs-state-digestion.md` 判据：状态推不出来必须写代码，成本最高 |
| **⑤⑥ 依赖弧层** | 弧不落地，"弧引用完整性"无对象可查 |

---

## 3. ⚠️ 仍需作者确认的（阻塞项）

> 来源：[`stage-structure-layer.md §5`](./stage-structure-layer.md) + backlog。

| # | 待确认 | 影响 | 我的建议 |
|---|---|---|---|
| **1** | 弧生成**步骤粒度**（`stage-structure-layer.md §5-3`） | 决定 ④ 的 Prompt 是"一步出整段"还是"分节" | 一步出整段 + Prompt 内分节（见 `arc-prompt-assessment.md §3.2`） |
| **2** | 弧与 `plotStructure` **枚举的关系**（§5-5） | 决定枚举是否保留作兜底 | 保留作兜底（自定义优先、枚举兜底，同 `:2281` 三元） |
| **3** | **空间结构**是否进世界观（`arc-space-causal-state-feasibility.md §2.1`） | 决定"1 模板 + 6 处 UI"改动是否做 | 建议做，但**定位为"索引节"而非"冲突维度"** |
| **4** | **P4 是否现在做**（`p4-reassessment.md`） | P4 改配置头，会影响 P3（P3 已关闭，优先级下降） | P4 独立于弧线，可并行/延后 |
| **5** | **AC1 是否批准开工** | 它是"阶段二"的起点 | 建议批准（低风险高收益） |

### ❓ 作者原话里**没有直接回答**的两个点

1. **"弧"的最终落点**：作者说"第五层被硬编码、要显性化" ——
   但**是否接受"弧 = `plot_structure_guide` 的内容化"**（即不新建实体，只把那段硬编码文本变成可编辑）？
   目前设计**全部基于这个假设**。**这是最大的单点假设。**
2. **弧是否要"参与生成"还是"仅作约束"**：作者明确"弧约束大纲走向" ——
   但**弧本身是否也需要 AI 生成**（而非作者手写）？决定了"新增一个 AI 步骤"的必要性。

---

## 4. 🧭 四份外部材料的关系（防重复立项）

```
①《状态管理分层》  = 广度（13 类：有哪些状态）
②《弧生成 Prompt》 = 手段（弧怎么把因果写进 Prompt）
③《因果 vs 状态》  = 判据（能推理→prompt；不能→代码）
④《修订版总结》    = 施工图（把①②③落到具体改动点）
```

**四者正交，合起来才是完整方法论。** 评估结论：
- ① 低估本项目已有机制 → 真正缺的只有"角色知识"
- ② 手段与作者定性冲突 → 吸收其"弧分型"，拒绝 YAML
- ③ 把"因果"简化为一类 → 纠正：**弧间因果仍空白**
- ④ 方向对 → 3 处"零代码"被低估，已还原成本

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

---

## 6. 🔗 相关代码锚点（设计文档反复引用的）

| 位置 | 是什么 |
|---|---|
| `architecture-workflow.ts:279-355` | ★ `getPlotStructureGuide` = **被隐藏的第五层**（6 分支，纯函数） |
| `architecture.command.ts:2281` | ★ **消费点**（`.withPlotStructureGuide(...)`，改一处三元即可） |
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
