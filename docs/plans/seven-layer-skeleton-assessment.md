# 七层骨架结构分析 · 结合本项目（AI-Novel-Writer）的评估

> 评估对象：外部提供的《现代网络小说的骨架结构：从顶层设计往下》七层模型（L0–L6）。
> 评估方法：**逐条对照真实代码库核实**，不凭印象表态。
> 日期：2026-10-11 · 分支 `dev_byf`

---

## 0. 一句话结论

**这份分析的方向是对的、诊断价值很高，但它对"工具缺 L3/L4"的判断需要修正三处：**

| 分析的说法 | 代码实际 | 影响 |
|---|---|---|
| "L3 叙事弧 **完全缺失**" | ⚠️ **部分存在**：`narrative_thread_plans` 已实现"起止章节 + 埋/推进/收"的线索台账，且有 UI（`NarrativeThreadEditor`） | 分析低估了现状，高估了工作量 |
| "L4 事件单元 **完全缺失**" | ⚠️ **有隐式替代**：① 蓝图按 5 章批次生成；② 生成前有 `draftShortOutlinePrompt` 让 AI 现推短纲 | 缺的是"显式实体"，不是"能力" |
| "地图/副本作为 L3 的 space 字段可视化" | ✅ **正确**，且更该强调：**角色的 `cs_location` 是动态位置，不是 `space_scope` 静态归属**，两者不能混 | 这条是分析最有价值的洞察之一 |

**核心判断：分析的诊断（"从 L2 直接跳到 L5、中间没抓手"）成立，且我在代码里找到了它的精确症状。**

---

## 1. 先给分析"记功"：它诊断对了什么

### 1.1 "缺中间层"的判断是对的，且症状可精确定位

分析说"从全书直接跳到章，中间没有抓手"。**代码里能直接看到这个症状**：

`src/services/workflows/commands/generate-draft.command.ts:779-786`：

```ts
const { loadDirectoryBlueprints } = await import('../directory-workflow')
const allBlueprints = await loadDirectoryBlueprints(expectedProjectPath, projectSession)
const futureBlueprintsArr = allBlueprints.filter(
  b => b.chapterNumber > this.chapterInfo.chapterNumber
    && b.chapterNumber <= this.chapterInfo.chapterNumber + 5      // ← 只看未来 5 章
)
```

**→ 写第 30 章时，AI 只知道第 31–35 章要发生什么。它完全不知道：**
- 第 30 章处于哪个叙事弧的什么位置（是铺垫？还是高潮？）；
- 本弧还剩几章、高潮在第几章；
- 本弧的目标是什么（所以不知道该"推进"还是该"收束"）。

**这就是"没有抓手"的代码级证据。** 分析虽然没有引用代码，但指向的病灶是真实的。

### 1.2 "角色的生命周期 = space_scope + active_in"这个洞察很准

分析提出：不需要单独的"生命周期系统"，角色绑定弧、弧绑定章节范围，生命周期自动导出。

**这个设计判断是对的**，而且与本项目已有的数据结构**天然契合**：
- `narrative_thread_plans` 已有 `target_start_chapter` / `target_end_chapter`；
- `characters` 已有 `cs_location`（虽然语义不同，见 §2.3）。

→ 说明"弧 = 章节范围"这个抽象，在本项目的存储模型里**已经有先例**，不是要新造一套。

### 1.3 "每 10 章小高潮 / 每 30 章大高潮"是番茄的真实节奏

这条是**产品级知识**，代码里当然没有，但它**恰好对应本项目的一个空缺**：
`blueprints` 表的字段是 `role` / `purpose` / `key_events` / `suspense_hook`（见 `baseline-schema.ts:51-64`），
**没有任何"这是高潮章 / 这是过渡章"的结构标记**。`role` 是自由文本（"简短结构标签"），
不是枚举，无法用于节奏校验。

→ 分析说的"climax 字段"，在本项目里**连雏形都没有**。

---

## 2. 但必须修正的三处：本项目**不是"完全空白"**

### 2.1 ⚠️ 修正一：`narrative_thread_plans` **已经是半个 L3**

分析说"L3 完全缺失"、"L4 完全缺失"。**但代码里已经有一套"起止章节 + 生命周期事件"的实体：**

`electron/migrations/baseline-schema.ts:335-357`：

```sql
CREATE TABLE IF NOT EXISTS narrative_thread_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  target_start_chapter INTEGER NOT NULL CHECK(target_start_chapter > 0),   -- ← 起始章
  target_end_chapter   INTEGER NOT NULL CHECK(target_end_chapter >= target_start_chapter),  -- ← 结束章
  author_intent TEXT NOT NULL DEFAULT '',
  ...
);

CREATE TABLE IF NOT EXISTS narrative_thread_confirmations (
  plan_id INTEGER NOT NULL,
  draft_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('planted', 'progressing', 'resolved', 'abandoned')),
  evidence TEXT NOT NULL,
  ...
);
```

**对照分析里的 L3 定义**：

| 分析的 L3 字段 | 本项目已有 | 缺 |
|---|---|---|
| `id` / `name` | `id` / `title` | — |
| `chapters: 1-12` | ✅ `target_start_chapter` / `target_end_chapter` | — |
| `space: 副本世界/无声公寓` | ❌ | **缺** |
| `goal` | ⚠️ `author_intent`（作者意图，近似） | 语义不同 |
| `conflict` | ❌ | 缺 |
| `climax: ch10-12` | ❌ | **缺** |
| `ending` | ❌ | 缺 |
| `active_characters` / `exit_characters` | ❌ | **缺** |
| `rules` | ❌ | 缺 |
| `foreshadowing_planted` / `foreshadowing_paid` | ✅ **`planted` / `resolved` 事件** | 已实现！ |

**→ 结论：L3 大约实现了 30%。** 已有的部分（起止章、埋/推进/收/弃）恰好是**"伏笔台账"**，
缺的部分恰好是**"结构骨架"**（空间、高潮、角色进出）。

**而且它有完整的 UI**：`src/components/editor/NarrativeThreadEditor.tsx`（「剧情树与叙事线索」面板，
支持增删改查 + 沉寂提醒 `narrativeThreadDormantChapterThreshold`）。

**→ 分析若知道这一点，结论会从"要新建 L3"变成"要把线索台账升级成叙事弧"。**
这两者的工作量差别很大——前者是 0→1，后者是 1→1.5。

### 2.2 ⚠️ 修正二：L4 "事件单元"有**两个隐式替代**

分析说 L4 完全缺失。实际有两条替代路径：

**替代 A：蓝图按 5 章批次生成**（`blueprint-batch-policy.ts:2`）：

```ts
export const MAX_BLUEPRINT_ITEMS_PER_BATCH = 5
```

⚠️ **但这是纯工程约束**（控制 token 与调用次数），`planning-material.command.ts` 里的
`chapterCount` / `semanticBatchCount` / `runtimeBudget` 全是**成本计算**，
**与叙事结构无关**。→ **不能算 L4**，只能算"分批"。

**替代 B：生成前现推短纲**（`generate-draft.command.ts:1002`）：

```ts
const outlinePrompt = draftShortOutlinePrompt(writingLanguage, prompt)
```

→ **每章生成前，AI 基于当前 prompt 自己推一个"本章短大纲"**，然后据此写正文（`:1168`）。

**★ 但它的指令明确界定了自己的能力边界**（`src/shared/draft-short-outline.ts:8`）：

> 「只写短细纲，不写正文。**仅组织原本章目标与已有材料**，最多六条短要点……
> **不得增加作者事实或禁令、改变目标**，或把计划说成已经发生的事实。」

**→ 这句话正是 L3 缺失后果的直接证据**：
短纲**只做"整理"**（组织已有信息），**不做"承接"**（从上层意图推导）。
它拿不到"当前弧的目标/高潮位置"，所以**即使它想承接也无从承接** ——
只能把"本章蓝图 + 未来 5 章"重新排列一遍。

**这就是"没有抓手"在本项目里的精确形态：AI 每章都在整理局部信息，却始终不知道全局意图。**

**→ 结论：L4 缺的是"显式、可复用、受上层约束的实体"，不是"生成能力"。**

### 2.3 ⚠️ 修正三：`cs_location` ≠ `space_scope`（这个区别很重要）

分析提出角色卡要加 `space_scope`（静态归属）。本项目角色表已有：

```sql
cs_location TEXT DEFAULT '',   -- 当前位置（baseline-schema.ts:82）
```

**这是动态位置，不是静态归属**：它记录"角色此刻在哪"（由 `currentState` 机制随剧情更新），
而分析要的 `space_scope` 是"角色属于哪个空间范围"（静态、由设计决定）。

**两者必须共存，不能替代**：

| 概念 | 语义 | 变化频率 | 已有？ |
|---|---|---|---|
| `cs_location` | 角色**此刻**在哪 | 每章可能变 | ✅ 有 |
| `space_scope` | 角色**归属**哪个空间 | 全书固定 | ❌ 无 |

**→ 分析的这条建议是"新增"，不是"补充既有字段"。** 这点分析没意识到，需要澄清。

---

## 3. 分析里**最有价值**的一条（被它的作者低估了）

### 3.1 "地图不是独立的层，是 L3 的 space 字段可视化"

分析原文：

> **P5 不是独立的层，是 L3 弧的 space 字段的可视化。先做弧，地图作为弧的子视图。**

**这条判断非常重要，而且与本项目已有的 backlog 冲突需要澄清。**

本项目 `prompt-assembly-backlog.md` 里 P5（地图/区域架构）是**独立立项**的：
> 「P5（评估）· 地图/区域架构 · 独立评估；4 种粒度；需重估与 P2、组装层的关系」

**分析指出：先做弧、地图作为子视图，比独立做地图更合理。** 理由：
- 独立的"地图"只是一张**静态图**，作者看了也不知道"现在故事在哪"；
- 绑定到弧的 `space` 后，地图立刻有了**叙事意义**（"当前弧在这个空间"）。

**→ 这条直接影响 P5 的排期顺序。** 我的判断：**分析是对的**，P5 应在 L3 弧之后做。

---

## 4. 分析**没有**覆盖、但本项目必须面对的问题

分析是"从创作角度"写的，没考虑工程约束。以下四条是本项目必须补的：

### 4.1 弧的引入会动**生成管线的收据契约**

⚠️ 一旦把"当前弧"注入 prompt（分析第 2 步建议），就触碰了：
- `main-generation-owner.ts:543/561` 的 `GENERATION_MATERIAL_PROMPT_MISMATCH`（字节级校验）；
- `chapter-materials.ts` 的 `ChapterMaterialBundle` 构成；
- 110 个 `generate-draft.command.test.ts` 用例中依赖 prompt 结构的断言。

**→ 这与 P3 的教训完全一致**：任何"改 prompt 组成"的动作，都要先问"收据契约要不要动"。
**分析完全没有考虑这一层。**

### 4.2 弧的**边界会变**，而蓝图是**已提交的实体**

`blueprints` 表的 `chapter_number` 是主键，蓝图一旦生成就是**确定的章节**。
但弧的 `chapters: 1-12` 是**计划**——作者写着写着发现"这个副本得 18 章"，
弧的边界就变了，**已提交的蓝图却不会自动重排**。

**→ 需要回答：弧边界变更时，已生成的蓝图怎么办？** 这是分析没提的工程难题。

### 4.3 800 章的弧要有**层级**，不是平铺的列表

本项目 `total_chapters = 800`（作者真实项目）。800 章若按 10–30 章一弧，
是 **27–80 个弧** —— 平铺的列表会**爆炸**（`NarrativeThreadEditor` 现在的 UI 就是平铺列表）。

**→ 需要 弧 → 卷 → 书 的层级**，或至少分组折叠。分析里没有涉及规模问题。

### 4.4 L4 与蓝图的**关系未定义**

分析说 L4（事件单元）"占几章"、约束 L5。但本项目**已经有了 L5**（`blueprints` 逐章）。
**新增 L4 后，`blueprints` 是保留还是被取代？**

- 若保留 → L4 与 L5 是**两层表**，需要外键关联；
- 若取代 → 要迁移全部既有项目数据（**破坏性**）。

**→ 这是落地前必须先定的架构决策，分析没涉及。**

---

## 5. 与本项目既有计划的**关系**

| 既有项 | 与七层模型的关系 |
|---|---|
| **P1**（蓝图角色 ↔ roster 同步） | 属 **L2↔L5 跨层一致性**，分析未提及 |
| **P2**（角色卡 AI 生成） | 属 **L2**，与分析的"L2 角色体系"对应 |
| **P3**（语义去重） | 🏁 已关闭；与骨架结构无关 |
| **P4**（配置整合） | 属 **L0/L1** 的配置层 |
| **P5**（地图） | ★ **分析指出它应是 L3 的子视图，不该独立** |

**→ 七层模型给了一个统一的坐标系**，能把散落的 P1–P5 归位。
这是这份分析**最大的附加价值**：它不只提了新层，还给已有工作**提供了定位框架**。

---

## 6. 我的结论与建议

### 6.1 对分析的总评

| 维度 | 评价 |
|---|---|
| **方向正确性** | ★★★★★ "缺中间层"的诊断经代码核实成立 |
| **字段设计完备性** | ★★★★☆ L3 的字段设计比本项目现有实现完整得多 |
| **对本项目现状的准确性** | ★★☆☆☆ **低估了已有实现**（`narrative_thread_plans` + UI 未被识别） |
| **工程可行性** | ★★☆☆☆ **完全未考虑**收据契约、数据迁移、规模爆炸 |

**→ 结论：应采纳它的"诊断"与"L3 字段设计"，修正它对现状的判断，补齐它缺失的工程分析。**

### 6.2 建议的落地顺序（修正版）

```
第 0 步（先做，零风险）：把现有 narrative_thread_plans 的 UI 作为"起点"，
                        而非从零新建。盘点它的字段与 L3 的差集。

第 1 步（核心）：在 narrative_thread_plans 上扩展 L3 字段
                  （space / goal / conflict / climax / active_characters / exit_characters）
                  —— 因为起止章 + 埋收台账已存在，这是"升级"不是"新建"。

第 2 步：定 L4 与 blueprints 的关系（保留双层 or 取代）—— 这是架构决策，需先拍板。

第 3 步：让"当前弧"进入生成上下文（在 generate-draft 注入弧的目标/高潮位置）
          ⚠️ 必须先处理收据契约（§4.1），并评估 110 个用例的影响面。

第 4 步：P5 地图 → 作为弧的 space 字段可视化（而非独立模块）。

第 5 步：角色卡加 space_scope（与 cs_location 共存，不可替代）。
```

### 6.3 需要作者拍板的三个问题

1. **L4 与 blueprints 的关系**：新增 L4 事件单元表，还是把 `blueprints` 升级为 L4+L5 双层？
   （涉及数据迁移，见 §4.4）
2. **弧的边界变更策略**：作者改弧的起止章后，已生成的蓝图如何处置？（见 §4.2）
3. **是否接受这会影响收据契约**：把弧注入生成上下文，需要动 `main-generation-owner.ts` 的
   校验边界，工作量与风险类似 P3 曾评估的那次改造（见 §4.1）。

---

## 7. 一句话总结

**这份分析的"缺 L3/L4"诊断是对的，我在代码里找到了它的确切症状（
`generate-draft.command.ts:781-783` 只看未来 5 章）；但本项目并非空白——
`narrative_thread_plans` 已是半个 L3，`draftShortOutlinePrompt` 是 L4 的隐式替代，
所以落地是"升级已有"而非"从零新建"，工作量与分析设想的差距很大。
最大的遗留问题是工程层：弧一旦进入生成 prompt 就会触碰收据契约与 110 个用例，
而这正是本项目在 P3 上学到教训的地方。**
