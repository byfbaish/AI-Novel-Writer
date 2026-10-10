# 「阶段结构层」显现设计（作者判定：不是二选一，是把隐藏层显性化）

> 缘起：作者对 §6 的"二选一"提出否定：
> 「按照你现在的描述的话，那就**不是二选一**的问题，因为现在的架构**其实就是五层架构**，
> 只不过**有一层被隐藏起来了**，而且是**固定编码**，现在要做的就是**把这一层显现出来变成可被管理的状态**，
> 在故事架构生成阶段，**动态的生成并可调整**，接下来就是**复用现在的管线**。」
> 日期：2026-10-11 · 分支 `dev_byf` · 前置文档：`story-arc-proposal.md`（v3）

---

## 0. 结论先行：作者判定成立，我上一轮的"二选一"是个假选择

我上一轮问"新增第 5 步 vs 扩展 `plot_structure_guide`"——**这个提问本身是错的**。
因为它把 `plot_structure_guide` 当成了一个"可选的实现手段"，
而没有看出**它本身就是那个被隐藏起来的层**。

**作者的模型更准确：现在的故事架构其实是五层，只是第五层被硬编码了。**

| 层 | 现有形态 | 可见性 |
|---|---|---|
| L0 故事内核 | `premise` | ✅ 可见（架构四大件之一） |
| L1 世界框架 | `worldbuilding` | ✅ 可见 |
| L2 人物体系 | `charactersArch` | ✅ 可见 |
| **★ 阶段结构** | **`plot_structure_guide`** | ⚠️ **隐藏**：无 UI 入口、无数据落点、由 `plotStructure` 枚举**现算**出来 |
| L3 情节大纲 | `synopsis` | ✅ 可见 |

**→ 所以工作不是"新增一层"，而是"把已经存在但被隐藏的那一层翻出来，
给它数据落点、给它编辑界面、让它能在架构生成阶段被动态生成并调整"。**

---

## 1. 这一层现在的完整形态（代码级取证）

### 1.1 它是什么

`architecture-workflow.ts:279-355` 的 **`getPlotStructureGuide(structure, totalChapters, language)`**。

它是一个**纯函数**：输入一个枚举 + 总章数，输出一段**硬编码文本**。

```ts
// architecture-workflow.ts:326-331（节选）
case 'three_act':
default:
  return promptLanguageText(language,
    `【三幕结构】（严格按以下结构组织大纲）
建议章节分配：全书共 ${totalChapters} 章
第一幕：建置（约第1章~第${ch20}章，占总篇幅约20%）
第二幕：对抗与发展（约第${ch20+1}章~第${ch75}章，占总篇幅约55%）
第三幕：高潮与结局（约第${ch75+1}章~第${totalChapters}章，占总篇幅约25%）`, ...)
```

**五种结构模式，全部是固定百分比切片**：

| 模式 | 切法 |
|---|---|
| `three_act` | 20% / 55% / 25% |
| `kishotenketsu` | 各 25% |
| `heros_journey` | 十二阶段（按百分比切） |
| `save_the_cat` | 十五拍 |
| `multi_thread` | 交汇点 25% / 50% / 75% |
| `freeform` | 无结构（自由编排） |

### 1.2 它去哪了（唯一消费点）

```ts
// architecture.command.ts:2281
.withPlotStructureGuide(getPlotStructureGuide(config.plotStructure || 'three_act', sourceExpected.totalChapters, language))
```

**→ 唯一消费者是 `synopsis`（情节大纲）步骤的 promptBuilder。**
**→ 它渲染进模板的 `{{plot_structure_guide}}` 占位符**（`builtin-prompt-templates.ts:578`）。

### 1.3 它现在怎么"管理"

**只有 `plotStructure` 这 6 个枚举值可以被管理**：

```ts
// architecture.command.ts:607-614
const PLOT_STRUCTURES = new Set<NovelConfig['plotStructure']>([
  'three_act','heros_journey','save_the_cat','kishotenketsu','multi_thread','freeform',
])
```

UI 入口：`NovelConfigEditor.tsx:273` 的一个 `<NativeSelect>` 下拉框。

**→ 也就是说：作者现在能"管理"的，只是"选哪一种固定模板"。**
**这正是"固定编码"的含义 —— 层本身存在，但它的内容是死的，只有开关是活的。**

### 1.4 ★ 一个重要的既有保障：它**已经**进了大纲指纹

```ts
// architecture.command.ts:410-430  synopsisInputsFingerprint
const sourceInputs = {
  premise, charactersArch, worldbuilding, genre, totalChapters, wordsPerChapter,
  writingLanguage,
  plotStructure,        // ← 已在指纹里
  narrativePov, globalGuidance,
}
```

**→ 含义（很关键）**：一旦作者改了 `plotStructure`，**大纲的指纹就会变**，
旧的续写检查点自动失效（`GENERATION_PLOT_OUTLINE_SOURCE_INVALID`）。

**→ 这条意味着：把这层从"枚举"改成"自定义内容"后，
只要把新内容也纳入指纹，整套"改了就失效"的安全机制**自动沿用、零额外工作。

---

## 2. 显现方案：数据落点、生成、编辑、复用

### 2.1 数据落点

**新增 `project_core` 的一个字段**（与四大件并列）：

```sql
-- 建议命名（待定）
plot_structure_plan TEXT DEFAULT '',   -- 作者/架构阶段生成的「阶段结构」全文
```

**为什么放 `project_core` 而不是新表？**
- 它是**一段文本**（不是需要外键引用的结构化数据 —— 架构 v3 已确认弧不绑章号、不管角色，无引用需求）；
- 它与 `premise`/`worldbuilding`/`synopsis` 是**同类物**（架构阶段的产物），放一起最自然；
- **零新表 ⇒ 零迁移成本、零仓储代码。**

**★ 这一条把 v2 的"新表 + 新仓储 + 新 IPC"全部删掉了。**

### 2.2 它怎么生成（"在故事架构生成阶段，动态的生成并可调整"）

**作者的要求是"动态生成"** —— 即：不要固定模板，而是**根据这本书的实际情况生成**。

**→ 这正是现有 `premise` / `worldbuilding` / `charactersArch` 的做法**：
输入上游信息 → AI 生成 → 作者可改。

**建议形态（与现有四步完全同构）：**

```
现有：premise → characters → worldbuilding → synopsis
改后：premise → characters → worldbuilding → ★ 阶段结构 → synopsis
                                            （新增一步，插在 synopsis 之前）
```

- **输入**：`premise` + `charactersArch` + `worldbuilding` + `genre` + `totalChapters`
  （**注意：不输入角色名单、不要求输出章号** —— 遵守 v3 的"不跨级"）
- **输出**：一段"阶段结构"文本（含若干阶段，每段有 目标/冲突/转折事件）
- **可调整**：生成后作者可编辑（与 `worldbuilding` 的编辑链路一致）
- **兜底**：若作者不想用，仍可选一个传统枚举模式（`getPlotStructureGuide` 保留为默认值）

### 2.3 它怎么被消费（"复用现在的管线"）

**这是整个方案最轻的部分 —— 因为管线已经就位：**

```ts
// architecture.command.ts:2281 改成：
const guide = core.plot_structure_plan?.trim()
  || getPlotStructureGuide(config.plotStructure || 'three_act', sourceExpected.totalChapters, language)
...
.withPlotStructureGuide(guide)
```

**→ 一行三元判断。其余全部复用：**
- ✅ 注入点不变（`{{plot_structure_guide}}`）
- ✅ 下游不变（`synopsis` 步骤照常消费）
- ✅ 蓝图/草稿完全不受影响（它们本来就不消费这一层）
- ✅ 指纹机制复用（把 `plot_structure_plan` 加进 `synopsisInputsFingerprint` 的 `sourceInputs`）

**★ 枚举的最终定位（作者问 2 拍板）：不是"被替换"，而是"降级为起手模板"。**
- 运行时**主来源 = 弧文本**（上面那行三元）；
- `plotStructure` 枚举 + `<NativeSelect>`（`NovelConfigEditor.tsx:273`）**保留**，
  变成 UI 里的"一键填充模板"按钮（点一下把三幕/起承转合文本填进可编辑弧框，作者再改）；
- **★ 不删枚举**（短篇/新手/旧项目的兜底，删除收益为零）。
- 详见 [`arc-granularity-and-enum.md §2`](./arc-granularity-and-enum.md)。

### 2.4 三层可见性（"可被管理的状态"）

| 管理动作 | 现状 | 改后 |
|---|---|---|
| **看得见** | ❌ 只在下拉框里显示模式名 | ✅ 架构界面显示"阶段结构"全文（第 5 个可查看项） |
| **改得了** | ⚠️ 只能换枚举 | ✅ 可编辑全文 |
| **重新生成** | ❌ 无 | ✅ 可单步重新生成（同 `worldbuilding` 的 resume 机制） |

**→ UI 侧需要改的，就是那**三处硬编码的四大件列表**（`ArchitectureConfirmDialog.tsx:29-32`、
`ArchFileViewer.tsx:64-67`、`WorldBuildingEditor.tsx:57-60`）**各加一项，变成五项。**

---

## 3. 与 v3 提案的关系（弧 = 这一层的"内容"，不是另一个东西）

**这份文档修订了 `story-arc-proposal.md` 的定位结论：**

| v3 的说法 | 本文修正 |
|---|---|
| 「弧 ≈ `plot_structure_guide` 的内容化」 | ✅ **方向对，但"≈"应改成"就是"** |
| 「弧是新增的第 5 个架构步骤」 | ✅ **对，但要说清：新步骤产出的是"阶段结构"，它是**显现**，不是**制造** |
| 「弧不绑章号、不管角色」 | ✅ 保持（本文 §2.2 的输入输出即按此设计） |

**→ 用作者的话说：这一层**本来就在**，现在只是**把它从硬编码变成可管理的**。**
**它不是"新增一层"，是"取消隐藏"。**

---

## 4. 落地步骤（按依赖排序，均为"复用优先"）

| # | 步骤 | 改动面 | 风险 |
|---|---|---|---|
| **1** | `project_core` 加一段文本字段（**命名不重要**，作者：「不需要什么字段不字段的」） | 1 处 schema（`baseline-schema.ts:14-42`）+ 1 处 `ProjectCoreData`/`rowToData`（`project-core-repository.ts`） | 低（可空字段，向后兼容） |
| **2** | 把它接入大纲"期望事实"与指纹 | `ProjectCoreSynopsisExpected` 的 `Pick<>`（`project-core-repository.ts:73-85`）加一项 + `synopsisInputsFingerprint` 的 `sourceInputs`（`architecture.command.ts:410-430`）加一行 | 低（与 `plotStructure` 完全同类） |
| **3** | 消费点改成"自定义优先，枚举兜底" | `architecture.command.ts:2281` 一行三元 | 低 |
| **4** | 新增"阶段结构"架构步骤（生成 + 可编辑） | 1 个新步骤（同构于 worldbuilding）；**★ Prompt 需含"篇幅经验表"+ 嵌套要求**（`arc-nesting-design.md §2`） | 中（新 AI 步骤，需定输出契约） |
| **5** | 三处硬编码列表加第 5 项 | 3 个 tsx 文件 | 低 |
| **6** | （可选）UI 标注"本层由 AI 生成，可自由调整" | 文案 | 低 |

**★ 步骤 1–3 的完整改动链（已逐处核实，全部是"加一项"）：**

```
baseline-schema.ts  →  CREATE TABLE project_core 加一列（可空，默认 ''）
project-core-repository.ts
    →  ProjectCoreData 接口加 plotStructurePlan: string
    →  rowToData() 加一行映射
    →  ProjectCoreSynopsisExpected 的 Pick<> 加 'plotStructurePlan'
architecture.command.ts
    →  :1806 sourceExpected 构造处加一行
    →  :410 synopsisInputsFingerprint 的 sourceInputs 加一行
    →  :2281 消费点改成三元
```

**→ 这 6 处加起来不到 20 行，就能让"作者手填的自定义阶段结构"真正生效并驱动大纲。**
**→ 建议先做 1–3 验证价值（作者可先在 DB 里手写一段试效果），再决定 4–6 的 UI 投入。**

---

## 5. 作者五问（★ 已全部由作者回答，2026-10-11 更新）

> **★ 详细推演见 [`arc-granularity-and-enum.md`](./arc-granularity-and-enum.md)**（含步骤粒度的实例对照、枚举降级方案）。

| # | 问题 | 作者回答 / 状态 |
|---|---|---|
| **1** | 字段名与界面名 | ✅ **作者：「不需要什么字段不字段的」** —— 弧与大纲相似度极高，**本质是 Prompt 约束**。命名不重要 |
| **2** | 新步骤能否跳过？ | 保持建议：可跳过（枚举兜底）→ ✅ **作者问 2 实质确认**（枚举降级为"起手模板按钮"） |
| **3** | **生成的粒度** | ✅ **作者拍板：一步出整段 + Prompt 内分节**（不拆 DB 步骤）。见 `arc-granularity-and-enum.md §1` |
| ~~**4**~~ | ~~"调整"的形态~~ | ✅ **作者：「编辑整段文本（同 worldbuilding）→ yes」** —— **不结构化** |
| **5** | 与 `plotStructure` 枚举的关系 | ✅ **作者：「plotStructure 不就是静态的弧么…写一个替换原有枚举类效果的新表现形式」** → **不替换、不删除，只降级**（弧文本主来源 + 枚举作"起手模板按钮"）。见 `arc-granularity-and-enum.md §2` |

### ★★ 作者追加的**新概念：弧的嵌套**（详见 [`arc-nesting-design.md`](./arc-nesting-design.md)）

> 「一个副本跨越了 30 章。但是在这 30 章内，可能还有**小的情节弧**（只有五六章），
> 比如说**小支线、小番外**之类的」

**梳理出的三层结构：**

```
【L-a 总弧】三幕 / 起承转合 / 英雄之旅   ← 现有 plot_structure_guide（硬编码的那一层）
      ├─【L-b 大弧】副本一「无声公寓」约 30 章
      │      ├─【L-c 小弧】支线：隔壁的人 约 6 章
      │      └─【L-c 小弧】主线：破局     约 16 章
      └─【L-b 大弧】副本二 …
```

**★ 嵌套不增加任何技术成本** —— 它只体现在生成步骤的 **Prompt 内容**里：
- 用 **Markdown 标题层级**表达包含关系（`##` 大弧 / `###` 小弧 / `-` 支线）；
- 把作者的**篇幅参考表**作为"经验语料"写进 Prompt（详见 `arc-nesting-design.md §2`）；
- 存储/消费/UI **全部不变**。

**★ 唯一要守的边界**：弧里的章号是**预估、非契约**（不做校验），
否则它会从"上游引导"退化成"同层冲突源"（= v3 撤回章号字段的原因）。

---

## 6. 一句话总结

**作者判定成立：这不是"新增一层"，而是"取消隐藏"——
`getPlotStructureGuide()`（`architecture-workflow.ts:279-355`）就是那个被硬编码的第五层，
它现在只有一个枚举开关（`NovelConfigEditor.tsx:273`）和一个消费点（`architecture.command.ts:2281`）。**

**显现路径：给它一个数据落点（`project_core` 一个可空文本字段）→ 让它能在架构阶段被 AI 生成与编辑
→ 消费点一行改成"自定义优先、枚举兜底" → 其余管线（注入点、指纹、下游）全部复用。**

**★ 最小可验证版本不到 20 行代码；且因为 `plotStructure` 早已在大纲指纹里，
"改了就失效"的安全机制自动继承，零额外工作。**
