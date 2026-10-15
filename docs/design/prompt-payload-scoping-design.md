# 全链路 Prompt 载荷作用域设计（材料白名单）

> 日期：2026-10-13
> 触发：作者补充报告《你这锅乱炖的感觉是对的，而且原因比"塞太多"更根本》+ 作者诉求「从上到下每一层级 prompt 都得梳理，不然像这次错误蓝图指导了错误结果」
> 前置：`docs/design/chapter-prompt-pileup-triage.md`（逐条判定外部报告的产物级诊断）
> 本文定位：**从"逐条判定"升级为"全链路架构设计"**——给出每一层级的材料边界、落地机制、以及必须诚实标注的"框架做不到的部分"
> 状态：**设计稿，未改任何代码，待作者审核后再定实施范围**

---

## 0. 一句话结论

**报告的方向是对的；但它说的"白名单"在本框架里已经存在了一半，而缺的那一半不是一个开关，是一次"交付契约"的改造。**

- 已有的一半：模板**变量出口**（`{{architecture}}` 等）+ 空段裁剪 → "要不要这个变量"能控。
- 缺的一半：变量的**值**是单一字符串，**没有作用域投影**；而且框架用 `requiredContextVariables` 主动声明"这四个大变量无论如何都要进"。→ "这个变量该给多少、该给哪部分"控不住。
- 更根本的：**层与层之间现在传递的是"上层全文"，而不是"下层需要的契约"。** 这才是"错误蓝图指导错误结果"的机制。

---

## 1. 现状取证：全链路每步"实际注入了什么"

证据口径：`builtin-prompt-templates.ts` 的模板 `content`/`systemSuffix` 变量出口 + `generate-draft.command.ts` 的 `ChapterPromptBuilder` 填值 + 实机 trace。

### 1.1 章节三步（正文链）

| 步骤 | 注入变量（实际） | 空置（被裁剪） |
|---|---|---|
| **短细纲** `chapter-draft-short-outline` | ⚠️ **整份初始生成 prompt**（含模板正文、systemSuffix、篇幅合同、全部九个区块） | — |
| **初始生成** `first_chapter_draft` / `next_chapter_draft` | `architecture`、`novel_config`、`chapter_info`、`future_blueprints`、`global_guidance`、`word_number`、`writing_style`、`reference_works`、`user_guidance` | `character_states`、`global_summary`、`short_summary`、`previous_ending`、`filtered_context`（初始生成显式传空串） |
| **续写** `draftAuthorMaterialBlock` | 本章蓝图 JSON、`global_guidance`、`writing_style`、`novel_config` 事实、**后续计划边界（第2–5章蓝图全文）**、定稿对账块、已写正文全文 | 单独的短细纲块被并入 `chapterMaterials` |

实机 `builtLength = 11279` 字 / 13 区块（详见 triage 稿 §2.3）。

### 1.2 上游三层（架构 / 目录 / 蓝图）

| 步骤 | 注入变量 | 备注（2026-10-13 第 2 轮实测数字） |
|---|---|---|
| 架构五步（前提/角色图谱/世界观/弧光/大纲） | 逐步累加上游产物 + `global_guidance` | 除角色图谱外全 `omitWritingSkill`（见 MEMORY）。实测 `synopsis`：`premise` 506 + `character_dynamics` 3,085 + `world_building` 4,526 + **`plot_structure_guide` 12,513**（含全书 185 章弧光）→ 单次 user message ≈ **35KB**，逐章一次调用 |
| 目录章纲 `directory` | `novel_architecture`（**全书架构整块**）、`global_guidance`、`genre`、`number_of_chapters`、`pacing_guidance` | ← 下游正文格式规则从这里污染章纲（实测 `global_guidance` = 304 字，含"弹幕【】格式/一句一段/短句口令"） |
| 单章蓝图 `chapter_blueprint` / batch | `novel_architecture`、`global_guidance`、`chapter_list`、`pacing_guidance`、`n`/`m`、`genre` | ← 同上；实测 `novel_architecture` = **15,917 字（全量，含 `## 第1章`…`## 第33章`）**，而本次生成的是 **ch6–7**；`chapter_list` = 2,216 字（前序 5 章梗概）；`pacing_guidance` = **0** |

**关键事实**：`globalGuidance` 是**全链路贯通注入**的（内置 11 个模板都带 `{{global_guidance}}` 出口）。作者把"弹幕格式 / 对话占比 / 黄金三章 / 段落纪律"写进它时，**架构五步、章纲、蓝图、正文全部收到**。这正是「错误蓝图」的第一号来源（与 `MEMORY.md` 已登记条目一致）。

> ✅ **2026-10-13 第 2 轮复验结论**：本节原判断**成立**。上游 trace 实测确认——蓝图/大纲模板**不含** `writingStyle`（1,490 字/12 块只进正文链），**但都含 `global_guidance` 的 304 字**，其中 4 条属正文形态纪律。故 P0-2 的落点是本节所述的 `globalGuidance`，**不是** `writingStyle`（详见 §7.0.5-C1/C2）。

---

## 2. 乱炖的三个制度化来源（报告没定位到的机制）

### 2.1 ★★★ `requiredContextVariables` = 无条件注入清单

```ts
// builtin-prompt-templates.ts:965 / :1037（两处一致）
requiredContextVariables: ['architecture', 'novel_config', 'global_guidance', 'writing_style'],
```

`appendRequiredPromptContext`（`shared/render-prompt.ts:5-29`）语义：

> 若**自定义模板正文 / taskGuidance / systemSuffix 三处都没引用**某个 required 变量，则把它作为「【自定义模板未引用但仍必须遵循的权威项目设定】」**兜底追加**。

→ 这三个大块（全书设定池 / 小说配置 / 全局要求 / 文风）**在框架层被声明为"无论如何都要进请求"**。作者就算把模板改瘦、把 `{{architecture}}` 删掉，框架仍会补回来。

**这是"分了模块等于没分"的制度性根因**：模板层看似能选择，实际被 required 清单兜底成"全都要"。

### 2.2 模板 `content` 是"平铺清单"，不是"分层结构"

`first_chapter_draft`（`builtin-prompt-templates.ts:966-990`）的区块顺序：

```
【全书设定池】{{architecture}}        ← 最大块，排在第一位
【本章信息】{{chapter_info}}          ← 真正的主料，排第二
【后续章节大纲预告】{{future_blueprints}}  ← 远期计划
【全局写作要求】{{global_guidance}}     ← 24 组规则（含正文格式类）
【网文"黄金第一章"创作法则】             ← 指令
【文风要求】{{writing_style}}          ← 30+ 条
【参考作品】{{reference_works}}        ← 4 本参考书全量
```

九个区块**同权重平铺**，唯一的层级提示是 `【】` 标题。模型看到的是"一坨同样重量的字符串"——报告这个观察准确。**没有任何字段告诉模型"哪个是主料"**。

### 2.3 变量的"值"无作用域投影

| 变量 | 值的实际来源 | 是否有投影 |
|---|---|---|
| `architecture` | `readArchitecture()` = 总纲 + 世界观 + 角色图谱 + 情节大纲 | ⚠️ 只有**章级投影**（`synopsisSettingSectionsForDraft` 剥离 `## 第N章`），**无"长线设定 / 本章相关设定"投影** |
| `global_guidance` | `novelConfig.globalGuidance` + 项目 prompt 文件（`generate-draft.command.ts:761-764`） | ❌ 整坨，无分区 |
| `writing_style` | `novelConfig.writingStyle` | ❌ 整坨 |
| `reference_works` | `novelConfig.referenceWorks` | ❌ 整坨，4 本全量 |
| `chapter_info` | 本章蓝图投影 `toBlueprintProjection` | ✅ 已有投影（`dropUserGuidance` 等） |

**"数据来源分层做了，注入内容没做"** —— 报告这句判断成立。

---

## 3. 补充报告逐条判定

| 报告主张 | 判定 | 说明 |
|---|---|---|
| "所有材料平铺进同一个请求，模型不知道谁是主料" | ✅ **成立** | 见 §2.2。这是模型侧的真实现象。 |
| "短细纲不需要全书设定池/参考作品/后续蓝图/文风/人物卡" | ✅ **成立且最该先修** | 短细纲当前喂的是**整份初始生成 prompt**（`generate-draft.command.ts:1012`），这是全链路最明确的"白给"点。 |
| "初始生成不需要参考作品全量 / 后续蓝图 / 全书世界观" | 🟧 **部分成立，但"全删"会破合同** | 参考作品：框架判断不了"参考调性 vs 避免撞车"。后续蓝图：**删除需谨慎**——它是"防提前"的唯一物理依据（模板变量名 `future_blueprints: '后续章节蓝图（防止剧情提前）'`）。**正解是"降级为边界声明"而非删除**。世界观：**不能整块剥**，因为正文的 `【不可偏离的作者事实】` 需要事实源可比对（否则模型会写出相反内容）→ 只能**投影**，不能**裁剪**。 |
| "续写不需要短细纲 / 本章信息 / 全书设定池" | 🟧 部分成立 | 短细纲确实已执行完，但它当前**并入 `chapterMaterials`**——剥离需改 `draftAuthorMaterialBlock`。本章信息（蓝图）**必须留**，因为续写要知道停止点与本章任务。 |
| "文风要求 30 多条应精简到 5–7 条" | ⚠️ **这是作者侧动作，不是框架能力** | 框架无法从自由文本里判断"哪 5 条属于本步"。**框架能做的是"把硬指标从文风槽位移出"**（triage 稿 §2.1）。 |
| "判据：删掉这段材料，模型会不会写错？" | 🟧 **需要加两个限定才可用** | ① 判据只适用于**内容型材料**（设定/计划/参考），不适用于**指令型合同**（格式/红线/停止点——这些删了就真错）。② 判据必须由**步骤职责**定义，**不能由"本章是否涉及"定义**——后者需要语义理解，框架做不到（这正是报告最理想化、最不可落地的一点）。 |
| "长线设定放独立知识库，需要时才注入" | ✅ **方向对，机制要换** | "按需注入"需机器可读标记。落点应是**架构产出时的结构**（每个设定标注 `展开期: G2-G10` / `适用章: 20+`），不是正文侧的事后过滤。⚠️ **与 P1-2 不是互斥选项、是同一目标的两级颗粒度**：本行 = **P1-2b**（单条设定颗粒度，有存量重生成成本，另立小项）；**P1-2a** = 正文侧**按节**投影（本阶段，`p1-2-architecture-projection-design.md`）。 |
| "让初始生成在输出末尾自报『已完成/待完成事件』"（源自上一份报告） | ⬛ **不可做** | 碰本项目已两踩的红线（要求"交代"的内容会被当输出字段）。**必须由代码算**（见 §5 步骤 9→10 的契约）。 |

---

## 4. 核心洞察：层与层之间应该是"契约传递"，不是"文本传递"

这是本文与补充报告最大的分歧点，也是"错误蓝图指导错误结果"的真正机制。

### 4.1 现状：每层收到"上层全文"

```
前提 ──全文──▶ 弧光 ──全文──▶ 大纲 ──全文──▶ 章纲 ──全文──▶ 蓝图 ──全文──▶ 正文
                                                              ↑
                                              「铃铛实物写死在蓝图 keyEvents，正文只能照办」
```

因为**传递的是文本**，上游的任何错误（蓝图把 ch10 才出现的铃铛写进 ch1）会**逐字下沉**，且下游**无法质疑**——模板明确宣告"本章蓝图中的必需事件必须落实、不得删除改写"（`generate-draft.command.ts:508`）。

### 4.2 应有形态：每层只交付"下层需要的契约"

```
前提 ──契约(主题/基调/视角)──▶ 弧光
弧光 ──契约(本章位次 + 弧光终点)──▶ 大纲
大纲 ──契约(本章目标 + 伏笔窗口)──▶ 章纲
章纲 ──契约(keyEvents 编号清单 + 铺垫/回收)──▶ 蓝图
蓝图 ──契约(编号要点)──▶ 短细纲
短细纲 ──契约(本段写第 1–3 点)──▶ 正文
正文 ──契约(已写/未写账目，代码算)──▶ 续写
```

**差别**：契约是**结构化的、可校验的、有边界的**；全文是**不可质疑的、逐字下沉的**。

### 4.3 由此得到的五层作用域（Material Scope）

| 层 | 代号 | 内容 | 生命周期 |
|---|---|---|---|
| **全局层** | `G` | 一句话前提、题材、主题、视角、红线、术语表 | 全书 |
| **弧光层** | `A` | 当前大弧/中弧的位次与终点、本阶段节奏策略 | 数十章 |
| **副本·卷层** | `D` | 当前副本的规则/机制/身份、当前卷的地图与势力 | 数章～数十章 |
| **章节层** | `C` | 本章蓝图、本章字数、本章钩子、伏笔窗口 | 一章 |
| **步骤层** | `S` | 停止点、不可写事件、本步格式合同、已写正文 | 一次调用 |

**"乱炖" = 把一个只有 `C`+`S` 需求的步骤，喂给了 `G`+`A`+`D`+`C`+`S` 的全集。**

---

## 5. 全链路材料白名单矩阵（★ 本文核心交付）

行 = 生成步骤；列 = 五个作用域层。✅ = 应注入；❌ = 应剥离；🔶 = 应**投影后**注入（保留部分，非全删）。

| # | 步骤 | G 全局 | A 弧光 | D 副本/卷 | C 章节 | S 步骤 | 备注 |
|---|---|---|---|---|---|---|---|
| 1 | `premise` 前提 | ✅输入 | ❌ | ❌ | ❌ | ✅ | 只吃题材/主题/一句话种子 |
| 2 | `character_dynamics` 角色图谱 | ✅ | ❌ | ❌ | ❌ | ✅ | 吃前提 |
| 3 | `world_building` 世界观 | 🔶基调 | ❌ | ❌ | ❌ | ✅ | 吃前提 + 角色图谱 |
| 4 | `plot_structure` 弧光 | 🔶主题 | ✅输入 | 🔶 | ❌ | ✅ | 需要弧光结构范式（`plot_structure_guide`） |
| 5 | `synopsis` 情节大纲 | 🔶 | ✅ | ✅ | ❌ | ✅ | 需要全书结构，但**不需要正文格式规则** |
| 6 | `directory` 章纲 | 🔶 | ✅ | ✅ | 🔶章列表 | ✅ | **必须剥离"正文格式类" globalGuidance** |
| 7 | `chapter_blueprint` 单章蓝图 | 🔶 | ✅本章位次 | ✅本章副本 | ✅本章目标 | ✅ | ★ 同一份 `chapter_list` 不重复给 |
| 8 | `chapter-draft-short-outline` 短细纲 | ❌ | ❌ | ❌ | ✅本章 | ✅ | **只吃本章 keyEvents + 前驱状态**（当前喂整份 prompt → 最大浪费） |
| 9 | `chapter-draft` 初始正文 | 🔶事实源 | 🔶本章位次 | ✅本章副本 | ✅本章 | ✅ | `architecture` 投影为"事实源+禁则"，**剥章节剧情与远期设定** |
| 10 | `chapter-draft-continuation` 续写 | ❌ | ❌ | 🔶 | ✅ | ✅ | 只吃**已写正文 + 停止点 + 不可写事件 + 3 条文风纪律**；`future_blueprints` **降级为边界声明** |
| 11a | `refine_chapter` 精修 | ❌ | ❌ | ❌ | 🔶 | ✅ | 实测注入 `draft_content`+`chapter_info`+`global_guidance`+`writing_style`+`word_number`+`global_summary`；**无 `architecture`、无 `future_blueprints`**；⚠️ `:73-74` 把**同一个 `historySummary` 双写**进 `global_summary` 与 `short_summary` → 同段进 prompt 两遍 |
| 11b | `consistency_check` 审稿 | ❌ | ❌ | 🔶 | ✅ | ✅ | 实测注入 `chapter_content`+`character_states`+`global_summary`+`world_building`；**无 `writing_style`** |
| 11c | `refine_from_review` 审稿驱动修稿 | ❌ | ❌ | ❌ | ✅ | ✅ | 实测注入 `review_report`+`draft_content`+`global_guidance`；**无 `writing_style`/`architecture`** → 修稿后风格易漂移 |
| 11d | `generate_chapter_notes` / `update_character_cards` 定稿后处理 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ **已是正确的白名单样本**（只吃正文 + 章号/标题 + 已有卡片）——其它步骤应向它看齐 |

**矩阵读法**：第 8 行（短细纲）与第 10 行（续写）是收益最大的两处——它们的需求列最少，当前注入最多。第 11d 行是**正面样本**：定稿后处理两步已经是"只吃该步材料"，说明这套设计在本项目里**已被无意中做对过**，不是全新发明。

---

## 5.5 层间交付契约清单（输入侧 × 交付侧，两轴对齐）

> 来源：外部评审《全链路 Prompt 架构重构评估》的净增量（复核见 `contract-first-reassessment.md`）。
> §5 矩阵回答的是**输入侧**——"这一步**允许哪些材料进来**"（白名单 / 不要什么）。
> 本节回答的是**交付侧**——"层与层之间**交付什么字段**"（契约 / 要什么）。
> **两条轴正交，不冲突，合起来才完整。**

| 层间边 | 交付契约 | 最小字段 | 现状 | 落点 |
|---|---|---|---|---|
| 大纲 → 章纲 | `ChapterPlan` | 章号、本章位次（弧光内）、本章目标、**`role`（**枚举取值域**：建置/铺垫/发展/冲突/高潮/转折/收尾）**、伏笔窗口（plant/payoff）、字数预算 | ❌ 现为"章列表 + 被注入的正文格式规则"混合；**`role` 无取值域约束**（实测存进长文本，见 §7.0.5-R5） | `directory` 产出契约 |
| 章纲 → 蓝图 | `BlueprintContract` | **`keyEvents: Array<{id, event, estimatedUnits}>`** + 必写/可选/禁写三级 + 停止点 + 容量 | ❌ `keyEvents` 是 **`string`** | 蓝图 schema（**必须走 lane 六步**） |
| 蓝图 → 短细纲 | `OutlineContract` | 本段分配表（写第 N–M 点） | ❌ 现喂"整份初始生成 prompt"→ 输出散文 | `draft-short-outline.ts` + `generate-draft.command.ts:1012` |
| 短细纲 → 正文 | 同 `OutlineContract` | 本段编号清单 + 停止点 | ❌ 无编号 | 同上 |
| 正文 → 续写 | `DraftState` | 已写正文、**已覆盖编号 / 剩余编号（代码算）**、当前字数 | ❌ 纯字数驱动、无事件边界 | `generate-draft.command.ts:1535-1548` |
| 设定 → 正文 | `SettingContract`（**投影**） | 总纲/术语表/禁则/基调 + 本副本规则；**剥 `## 第N章` 剧情与远期设定** | 🔶 章级投影已有（`synopsisSettingSectionsForDraft`）；远期节投影 = **P1-2a 已落地** | `projectArchitectureForDraft`（§6 L2）——**按节**粒度（单条设定期次见 §3-`:106` 的 P1-2b）；实现名 `withArchitectureDraftProjection` |

**读法**：§5 矩阵决定"**要不要给**"，本表决定"**给的必须是这个形状**"。

> ⚠️ **共同前提**：表中 2、3、5 行**全部依赖同一个改造**——蓝图 `keyEvents` 从 `string` 变成结构化数组。**这条必须先做，否则整张表无法落地**（与附录 C/F 结论一致：它是"跨步骤对账"与"事件驱动停止点"的共同前提）。

> 📌 **YAGNI 约束**（见 §8-7）：本表字段**只收录"下游确有读取点"的项**；无消费者的字段一律不立项。

---

## 6. 落地机制设计

### L1 变量出口语义化（框架可独立完成）

给 `PromptTemplate` 增加**可选**字段（不改现有模板即可向后兼容）：

```ts
interface PromptTemplate {
  // ...现有字段
  /** 本步骤接受的作用域层；缺省 = 全接受（旧模板行为不变） */
  acceptsScopes?: MaterialScope[]         // ('G'|'A'|'D'|'C'|'S')[]
  /** 是否把 requiredContextVariables 视为无条件注入（缺省 true，旧行为） */
  enforceRequiredContext?: boolean
}
```

配套改动：`appendRequiredPromptContext` 增加"当步骤声明不接受某层时，required 兜底也不追加"。

> ⚠️ 必须先核对 `prompt-language-contract.test.ts` / `prompt-local-qwen-contract.test.ts` 的基线（它们锁定模板变量出口）。

### L2 结构化变量投影（框架可独立完成）

对**已结构化**的变量做按步骤投影，而非传整坨：

| 变量 | 投影函数 | 正文步骤得到 |
|---|---|---|
| `architecture` | `projectArchitectureForDraft(arch, scope)` | 总纲（主题/基调/视角）+ 术语表 + 禁则 + **本副本规则**；剥离 `## 第N章` 剧情段 + 远期设定段（**按节**：远期节由模板固定标题识别，见 §3-`:106`；单条设定期次 = P1-2b） |
| `chapter_info` | 已有 `toBlueprintProjection` | 保持 |
| `future_blueprints` | `toBoundaryNotice(blueprints)` | 由"第2–5章全文"降级为"**本章不可写事件**清单"（每条 ≤1 行） |
| `character_states` | 已有 | 保持 |

**红线**：投影**不得删除"事实源"语义**。正文的 `【不可偏离的作者事实】` 要求设定可查——所以 `architecture` 在正文里必须保留"术语/禁则/基调"，只剥离"剧情事件"。**这是投影与裁剪的分界**。

### L3 自由文本分区（需作者配合，框架提供工具）

`global_guidance` / `writing_style` / `reference_works` 是作者自由文本，**框架无法语义切分**。三个选项（可组合）：

| 选项 | 成本 | 说明 |
|---|---|---|
| (a) **可选结构标签** | 低（框架）+ 低（作者） | 作者可用 `## 适用：架构` / `## 适用：正文` 分区；框架按步骤过滤，**无标签时全量注入（完全向后兼容）** |
| (b) **拆独立槽位** | 中 | 把"正文格式类规则"从 `writingStyle` 移到一个新槽位（如 `draftingRules`），只喂正文链。**这才是"硬指标被放进文风槽位"的正解**（triage 稿 §2.1 方向 2） |
| (c) **可观测性兜底** | 低 | 至少在 prompt-trace 里标注"这段材料属于哪层、本步是否需要"——**让作者自己看见**，不自动改 |

**本篇建议**：(b) 为主，(a) 为辅，(c) 必须做。

---

## 7. 建议实施顺序

### 7.0 前置动作：反向验证（Phase 0，不做代码改动）

**用第 1 章真实蓝图 + 现有 trace 回填 §5.5 契约表**，看哪些字段填不上——**填不上的是真缺口，能填上的是过度设计**。

产出应是"**一张能填满/填不满的表**"，不是三篇契约散文。（外部评审的有效增量；与 §5 矩阵读法中"第 11d 行已是正面样本"精神一致。填表所用材料：第 1 章蓝图 `keyEvents` + `debug/prompt-trace/` 的 `built` 快照。）

### 7.0.1 已执行：第 1 章真实回填结果（2026-10-13）

**证据源**：`国运怪谈直播-新版副本/debug/prompt-trace/20261013-005934-398-…json`（含 3 次 `ioCalls`：短细纲／初始生成／续写）+ `.ai-novel/project.db`（`blueprints` 5 行、`narrative_thread_plans` 14 行）。

**回填结果**（✅ 填得上 / 🔶 部分 / ❌ 填不上）：

| 层间边 | 实测可得 | 缺口 |
|---|---|---|
| 大纲→章纲 | 🔶 `blueprints` 有 `chapter_number`／`title`／`role`(建置/发展/转折)／`purpose`(本章目标)／`suspense_hook` | ❌ **无伏笔窗口字段**（窗口只在 `narrative_thread_plans.target_start/end_chapter`，未随该边传递）；❌ **无字数预算字段** |
| 章纲→蓝图 | ❌ `key_events` 是 **TEXT 455 字散文**（无编号／无单位／无三级）；✅ `characters` 已是 JSON Array——**同表内已存在"散文→结构化"先例**，改造面可控 | ❌❌ id／estimatedUnits／必写-可选-禁写／停止点／容量 **5 项全缺** |
| 蓝图→短细纲 | ❌ 短细纲输入 **16,736 字 ≈ 初始生成 18,380 字**（含【全书设定池】【文风要求】【参考作品】**且含第 2 章信息**）；输出 **1,747 字散文** | ❌ 无分配表、无编号 |
| 短细纲→正文 | ❌ 短细纲以散文并入材料；正文 msg 无编号、无停止点 | ❌ 同上 |
| 正文→续写 | 🔶 `drafts.word_count` 有当前字数；已写正文有 | ❌ **无已覆盖/剩余编号**（无编号体系）；停止点纯字数驱动（实测目标 3000 → 1906+1339，靠模型自觉收敛） |
| 设定→正文 | 🔶 `architecture` 5,039 字，**`## 第N章` 章标题数 = 0**（章级投影已生效） | ❌ **无期次投影**：`# 世界观` 下"空间结构（地图与区域）""核心规则与体系漏洞"等**长线设定仍全量进入正文** |

### 7.0.2 回填推翻/修正的四条设计稿假设

> 回填的价值不在"确认"，而在**修正**。以下四条均为实测与设计稿原文**不一致**处，实施前必须采纳。

**R1（最重要）· `future_blueprints` 变量实测为 0 字——后续计划走的是另一条通道。**
- 实测：`first_chapter_draft` 的 `future_blueprints` 变量值 **空**；但初始生成与续写的 prompt 里**都有**第 2–5 章内容，载体是代码手工拼装的 **【后续计划边界（只约束当前章，不是当前章任务）】** 块（`generate-draft.command.ts:784-802`），块头已自带"防止本章提前执行"语义。
- 影响：**P1-1 的落点必须从"改 `future_blueprints`"改为"改造既有【后续计划边界】块"**——否则改的是一个空变量（白干）。该块当前带的是 ch2–ch5 的 `key_events` **全文散文**（第 2 章 400+ 字逐字下沉），正是 §4.1"逐字下沉"最清晰的实例。

**R2 · "正文格式类规则"实测位于 `writingStyle`，不在 `globalGuidance`。**
- 实测：`writingStyle` = **1,490 字 / 12 个区块**（红线·命中即作废／设定禁忌／精确度／真人叙事·最高优先级／爽点／钩子／黄金三章／段落与对话／弹幕／情感线／世界关系／修稿精修适用）；`globalGuidance` 仅 **304 字**，内容是"pulp 爽文基调／少比喻／叙述贴"等**基调**，**不含格式规则**。
- 影响：**P0-2 的剥离对象须由 `globalGuidance` 修正为 `writingStyle` 的分区**（§6 L3-(b) 的 `draftingRules` 槽位方向正确，但"从哪拆出"要改）。
- ⚠️ **反向待验证**：若章纲/蓝图模板**不**注入 `writing_style`，则"格式规则污染蓝图"这一 P0-2 立论前提**不成立**——P0-2 需先补一次蓝图侧 trace 取证再动手。**本次 trace 只含正文三步，不含章纲/蓝图。**

**R3 · 短细纲的实际输入比设计稿描述更严重。**
- 实测 16,736 字，不仅含【全书设定池】【文风要求】【参考作品】，**还含第 2 章信息**；输出 1,747 字散文。→ **P0-1 由推断升级为实测确认，且收益更大**。

**R4 · 续写仍全量携带 12 个格式区块。**
- 实测续写 msg 12,165 字，**含全部 `writingStyle` 12 块**（弹幕／段落与对话／黄金三章…），与 P1-1"只带 3 条文风纪律"的设想存在量差。→ 印证 R2"按槽位分区"的必要性。

**另记两条现场观察（不属 §5.5，供作者核对）**
- **命名疑点已查明（2026-10-13）**：不是脏数据 bug，而是**两套角色共存**——`characters` 表里 `沈晚` 属 **legacy 集**（`retired=1`、`valid_through=8`），`沈悦` 属 **adoption 集**（`retired=0`、`valid_through=None`）。**结构化层有版本/退役机制，且消费侧用对了**（正文 trace 里出现的是 `沈悦`）；**但伏笔台账 `narrative_thread_plans` 无 `valid_from/through`、也不以 `character_id` 关联 → 停留在旧名 `沈晚`**。
  → 根因：**"散文层无唯一标识与版本，结构化层有"**——与 §5.5"层间交付契约缺字段"同源。作者观察到的另一例「弹幕提"铃图标"、正文出"铃"」同理：**同一实体两种表述，无 ID 可判等**。
  > 结论：**空项目重跑能消除"新旧共存"噪声，但不能修复"散文层无 ID/版本"这一根因**（后者属设计要修）。故空项目是更好的**取证环境**，但不是**解决方案**。
- **模板生效来源**：本次三块 override（content／taskGuidance／systemRole）`resolvedFrom` **全为 `global`** → 全局自定义模板遮蔽内置（§8-5 红线）实测确认。**后续实施与取证一律以"作者覆盖版模板"为基准，不得假设内置 `content`。**

### 7.0.3 对实施顺序的影响

**不变**：P0-1（短细纲只喂该步材料）证据升级、优先级不变；`keyEvents` 结构化（附录 C/F）仍是 §5.5 表中三行的**共同前提**，仍应先做（走 lane 六步）。

**修正**：P0-2 落点 `globalGuidance → writingStyle`（且须先补蓝图侧 trace 取证）；P1-1 落点 `future_blueprints → 【后续计划边界】块`。

### 7.0.4 干净项目复验清单（待执行）

**为什么用空项目**：现项目 `characters` 里 legacy（`retired=1`）与 adoption（`retired=0`）**两套共存**（沈晚/沈悦），旧蓝图 5 行仍在 → 数据层含历史噪声。空项目可消除。
⚠️ 但注意：**旧项目重跑不会清掉 retired 角色**（历史保留），要干净必须**新项目**。

**该跑什么**（trace 落在 `<项目根>/debug/prompt-trace/{ts}-{operation}-{uuid}.json`；`install-prompt-trace.ts` 明确覆盖 architecture 等**渲染层本地执行**步骤，故章纲/蓝图都会落 trace）：

| 跑 | operation | 本步要验什么 |
|---|---|---|
| 章纲 `directory` | `directory` | 章纲侧 prompt 是否出现 **`writingStyle` 那 1,490 字 / 12 块**（弹幕·段落·黄金三章…）→ **决定 P0-2 前提是否成立** |
| 单章蓝图 `chapter_blueprint` | `chapter-blueprint` | 同上；另看 `novel_architecture` 变量是否**全量**（含 `## 第N章`）→ 影响 P1-2 |
| （可选）正文 | `chapter-draft` | 复验 R1（`future_blueprints` 是否仍为空）与 R3/R4 |

**取证口径**（与本次一致）：`snapshots[0].fragments[].variables[]` 的 `key` + `len(value)`；`ioCalls[].purpose` 与各 `messages[].content` 长度；`fragments[].resolvedFrom`（确认是否又被 `global` 覆盖遮蔽）。

**判定**：
1. 若蓝图侧**含** `writingStyle` → P0-2 前提成立，落点按 R2 改为 `writingStyle` 分区；
2. 若**不含** → **P0-2 前提不成立**，应撤回并重新定位"错误蓝图"的真实污染源（届时先看 `novel_architecture` 全量注入是否是主因）。

### 7.0.5 已执行：上游侧复验结果（2026-10-13 第 2 轮）

**证据源**（3 份 trace，仍在原项目，**非空项目**）：
- `20261013-033738-646-text-….json` → `promptKey=synopsis`，3 次调用 `plot-outline:chapter:31|32|33`
- `20261013-033907-554-structured-….json` → `promptKey=chapter_blueprint_chunk`，1 次调用 `chapter-blueprint-directory`（`n=6, m=7`）
- `20261013-005934-398-chapter-draft-….json`（正文，第 1 轮已用）

**★ 结论 1：§7.0.4 判定 2 命中——蓝图/大纲侧均【不含】`writingStyle`（1,490 字 / 12 块）。**
- `chapter_blueprint_chunk` 变量仅：`n`·`m`·`genre`·`number_of_chapters`·`global_guidance`(304)·`novel_architecture`(**15,917**)·`chapter_list`(2,216)·`pacing_guidance`(**0**)
- `synopsis` 变量：`genre`·`narrative_pov`·`premise`(506)·`character_dynamics`(3,085)·`world_building`(4,526)·`global_guidance`(304)·`number_of_chapters`·`word_number`·`plot_structure_guide`(**12,513**)
- → 据此，**R2 的"落点改 `writingStyle`"被实测否证**。`writingStyle` 只进正文链，**不是上游污染源**。

**★ 结论 2：真正的上游污染源是 `global_guidance`（304 字），且内容含正文格式类规则。**
- 该 304 字在**大纲 / 蓝图 / 正文三处完全同文**出现，含：
  - "叙述贴着主角主观感官走，把冷硬客观叙述换成人物体感视角。"
  - "气质：死面理工脑——**短句切分 + 计数口令**，一句一击。"
  - "**弹幕独立于主角视角**，只做反应…**弹幕语言用【】括起来**。"
  - "氛围细节允许留白，刻意不解释。**规则清单的原文呈现：一句一段。**"
- → **P0-2 应做，但落点由 `writingStyle` 再次修正为 `global_guidance` 的分区**（把"正文呈现形态"类条目移出，走新槽位 `draftingRules`；`global_guidance` 只留"基调/气质"）。
- 说明：第 1 轮把该 304 字读作"只含基调、不含格式规则"是**读数偏粗**；逐句核对后确认含 4 条正文格式纪律。

**★ 结论 3：`novel_architecture` 在上游为【全量】——正文侧已投影，上游反而没有。**
- 蓝图侧 `novel_architecture` = **15,917 字**，含 `# 情节大纲` 的**全部 33 章**（`## 第1章`…`## 第33章`）；而生成的是**第 6–7 章**蓝图。
- 对照：正文侧 `architecture` = **5,039 字**，`## 第N章` 计数 = **0**（章级投影已生效）。
- → **同一份档案，正文链已做章级投影，架构链（大纲/蓝图）完全没做**。这把 P1-2 从"正文缺期次投影"扩写为"**上游缺章级投影（更严重）**"。

**★ 结论 4（新，量级最大）：`plot_structure_guide` = 12,513 字，含全书 185 章弧光。**
- 生成**第 31 章**大纲时，喂入 `plot_structure_guide`（大弧一 1–94 章 + **大弧二 95–185 章**）+ `world_building` 4,526 + `character_dynamics` 3,085 + `premise` 506。
- 每次调用 user message ≈ **34,851 / 35,062 / 35,291 字**（逐章生成，一章一次调用）。
- → 比 P1-2 更应优先：**每生成一章大纲，都携带全书 185 章的弧光结构**。

**★ 结论 5（新）：`role` 字段无取值域契约，长文本会进正文 prompt。**
- 实测 `blueprints.role`：ch1–ch5 为纯枚举（建置/发展/转折）；**ch6/ch7 被写成 `"发展——承接第5章门牌篡改的物证…为第7章的主动逼近蓄压"` / `"小高潮/转折——把前六章积累的走廊异常收束成…"`**（"小高潮"**不在 7 个合法枚举内**）。
- 该字段**确实进 prompt**：正文模板 `{{chapter_info}}` 渲染为 `【本章信息】` JSON，`role` 是其字段之一（第 1 章 trace 实测 `"role": "建置"`；模板说明见 `builtin-prompt-templates.ts:850/926`，措辞为"例如建置、发展、转折或高潮"——**"例如"是软约束**）。
- 三重负面效应：① 与 `purpose`/`keyEvents` **语义重叠**（同一信息在 prompt 里出现两遍）；② **跨章指涉**（ch6 的 role 提到"为第7章…蓄压"）；③ **枚举失效**（`getChapterRoleLabels` 返回 `null`，UI 按自定义标签原样显示——见 `src/shared/chapter-role.ts:42`，其注释即写明"Stored roles are free text"）。
- 修复落点：**上游**——模板把 `role` 由"例如…"改为**硬枚举**（"只能填以下 7 词之一，不得附加说明"）；**不改 UI 自动截断**（守"提示类功能三纪律：绝不自动执行副作用"）。

**★ 结论 6（取证方法论）：`snapshots[].built` ≠ 最终 user message。**
- 正文侧：`built` = 11,287 字，实际 `ioCalls[].messages` user = 18,380 字，**差 7,093 字为代码渲染后追加**（如 `【后续计划边界】` 块，在 `built` 中搜索为 `-1`）。
- → **取证必须比对 `ioCalls[].messages[].content`；只读 `built` 会漏掉代码追加块**（R1 的【后续计划边界】正因此第一次未被收录在 `built` 里找到）。

**★ 结论 7：`resolvedFrom` 全为 `global`**（三份 trace 的 content / taskGuidance / systemRole 三块），再次确认全局覆盖遮蔽内置（§8-5）。

### 7.0.6 第 2 批 trace（配套 ch6–7）与两项就地实施（2026-10-13）

**证据源**：作者按"大纲与蓝图要配套"重跑，新增 `20261013-035828-804-text-….json`（`synopsis`，2 次 `plot-outline:chapter:6|7`）与 `20261013-035913-498-structured-….json`（`chapter_blueprint_chunk`，1 次，**`n=6, m=7`**）。

**复验结果**：
1. **`n`/`m` 确认为章节范围**（不是分块序号）——蓝图 prompt 首句即"为接下来的 第6章到第7章 生成…"。
2. `novel_architecture` 由 **15,917 降至 9,752 字**，`# 情节大纲` 只剩 **7 章**（`## 第1章`…`## 第7章`）——因为作者只生成到第 7 章大纲。**P0-0 的量级随数据规模变化，但结构问题不变**：生成 ch6–7 仍需整份架构 + 前序梗概。
3. **新发现（同 prompt 内的两份表述）**：`chapter_list`（2,216 字 / 5 章）与 `novel_architecture` 的 `# 情节大纲` 段（1,614 字 / 7 章）覆盖**同一批章节**，**文本不同但语义高度重叠**（前者更详、后者更简）。二者**同时**进蓝图 prompt。→ 归入 §5 矩阵的"给多了"一类；是否合并/降级待与作者确认（`chapter_list` 定位是"已生成章节的实际进度"，与"计划大纲"语义确有差别，**不可简单删**）。
4. `global_guidance` = 304（不变）、`pacing_guidance` = 0（不变）、`writing_style` 仍**不存在**于上游（C1 复现）。
5. **`role` 长文本稳定复现**：本批产出 ch6 = `"发展（承接门牌缺失线索，建立首个可验证物证装置）"`、ch7 = `"转折（小高潮：完成首次物证闭环，主动暴露在观察者视野中）"`——与第 1 批的 `"发展——…"` **措辞形式不同**，恰证明模型无硬约束。

**★ 就地实施 A：trace 文件名加业务标签 + 章节段**（作者指出"分不清大纲/蓝图/正文，同类看不出先后"）
- 根因：文件名用了 `scope.operation`，而它是**执行器类型**（`text`/`structured`/`chapter-draft`）——`synopsis` 与 `chapter_blueprint_chunk` **都**落成 `text`/`structured`。
- 改法（`prompt-trace-writer.ts`）：改用**模板 key 映射的业务标签**（`大纲`/`蓝图`/`正文`/`章纲`/…），并加**章节段**（四级取证：⓪ 命令显式声明 `chapterRange` → ① `chapterNumber` → ② `ioCalls[].purpose` 的 `chapter:N` → ③ 模板变量 `n`/`m`），runId 截前 8 位。
- 新命名：`<时间戳>-<业务标签>-<章节段>-<runId8>`，例：`20261013-035913-498-蓝图-ch6-7-6f969673.json`。
- 测试：新增 2 例（业务标签替代 `operation`；逐章调用收成 `ch6-7` 区间），**trace 相关 38/38 通过**。旧文件名不追溯改名。
- **★ 同日二次修复（该命名的回归，作者实机发现）**：章节段是**从"当前已收到的 `ioCalls`"现算**的，而水位判重只看**内容**、不看**文件名** → 一次作用域随 `ioCalls` 递增写出 **3–4 份**各不完整的文件（旧的不清）。实机取证：`…/prompt-trace/` 内 `20261013-182416-646-大纲-{7923a61e,ch8,ch8-9,ch8-10}.{md,json}` 共 4 份、`20261013-191720-497-大纲-{8650c580,ch11,ch11-12}.{md,json}` 共 3 份（同 `runId8`）；蓝图侧恒为 1 份（`n`/`m` 在**首次**落盘时已在快照里）。
  - **修法（方案 A，已落地）**：`TraceScope` 加 `traceFileName?: string`，`flushTraceFile` 改为 `scope.traceFileName ?? […]` 并回写 → **首次落盘钉住名字**，后续只覆盖写同一份。
  - **验证手法**：`git stash push` 只撤 `prompt-trace-writer.ts` → 新回归用例立即红（`expected 3 to be 1`），恢复后绿。**回归用例必须能在未修复时红。**
  - **当时的代价（同日已补，见「三次修复」）**：`synopsis` 模板变量里**没有 `n`/`m`**，其章节段只能来自 `ioCalls[].purpose`（首次落盘时还没到）→ 大纲文件名一度不再带章节段；蓝图（`n`/`m`）与正文/定稿（`chapterNumber`，两条链**自建作用域** `generate-draft.command.ts:974` / `finalize-chapter.command.ts:401`）不受影响。
- **★ 同日三次修复：把大纲的章节段找回来（作者裁定"章节段还是要的，不然违背易读的初衷"）**
  - **为什么不能靠"晚点再补"**：`traceFileName` 已钉住 → 首次落盘时没有的段就永久没有；若改回"后来补就改名"则会重新写出第二份文件（回到二修前的病）。所以**必须在首次落盘之前就有值**。
  - **修法**：`TraceScope` 加 `chapterRange?: { from, to }` + 新纯函数 `declareTraceScopeChapterRange(from, to)`（`trace-scope.ts`，两条守卫：无作用域静默返回；`traceFileName` 已钉住则拒绝再改）。
  - **调用点**（`architecture.command.ts`，都必须在**装配前**，即 `build()` 之前）：批量/正常路径在 `from`/`to` 定稿后（原 `:2120` 前）、逐章路径 `executeChapterOutline` 在 `promptBuilder` 构造前（用 `initial.range`）。
  - **为什么不是"`pushTraceScope` 时传入"**：大纲的 `from`/`to` 是**命令体内部**才算出来的（依赖断点检查点、已覆盖水位、总章数），push 时还不知道 → 改为命令体主动声明。
  - **落到人眼**：`.md` 头部新增 `- 章节范围：第 11–12 章`（此前只能翻 `.json`）。
  - **测试**：新增 5 例（`prompt-trace-scope.test.ts` 4 例：写入/无作用域/钉住后拒改/非法范围；`prompt-trace-writer.test.ts` 改 1 例 + 增 1 例）→ 断言 `-大纲-ch11-12-8650c580.md`，并锁"钉住优先、声明晚到不改名"。`prompt*` 全组 **11 文件 149/149**。

**★ 就地实施 B：`role` 由软约束改硬枚举，节奏意图改走 `purpose`**（作者裁定："跨章指涉不该显式，但意思是对的，换成本章视角表述"）
- 落地三处：内置 `chapter_blueprint` + `chapter_blueprint_chunk`（`builtin-prompt-templates.ts`），**以及作者的全局覆盖版** `chapter_blueprint_chunk.zh-CN.json`（**不改覆盖版则不生效**——实测 `resolvedFrom=global`）。
- 措辞：JSON 示例的 `role` 说明改为"只能填一个词：建置、铺垫、发展、冲突、高潮、转折、收尾"；"要求"清单新增一条——
  > `role` 只填一个功能词，不附加括号、破折号或任何说明；"为后文铺垫"一类的节奏意图写进 `purpose`，且只用本章自身要达到的状态来描述（例如"本章收尾要把某条线索推到临界"），不得提及后续章节号或后续情节。
- **不自动改写已存数据**（守"绝不自动执行副作用"）；ch6/ch7 的旧值需作者手动改或重跑章纲。
- 契约测试基线：`prompt-local-qwen-contract.test.ts` 改动前后同为 `2 failed | 19 passed`（**既有失败**，见下），`prompt-language-contract.test.ts` 通过。

**★ 就地实施 C：修正两条长期为红的契约测试期望表**（作者裁定"一并修了"）
- 结论：两项均为**测试期望表过时**，非代码缺陷。
  - ① `expectedPromptVariables` 漏登记 `character_background_synthesis`（内置 25 个模板 vs 期望表 24 个；该模板在数组中列**第 2 位**）→ 补齐，含 4 个变量 `character_name`/`mainline`/`mentions`/`existing_roster`。
  - ② `expectedJsonFields.character_dynamics` 仍要求 `schemaVersion`，但该字段**已被第五层架构改造移出输出合同**——`prompt-language.ts` 的 `detailSystem`/`detailContract` 现明确写"不得输出 schemaVersion、relationships" → 期望表改为 `['entries']`，并加注释说明**勿回填已废弃字段**，防下次又被"补"回去。
  - ③ **同日二次发现（第 3 条，同一根因）**：`prompt-project-session.test.ts > provides audited English descriptions for every variable shown by editable prompts` 报 `character_background_synthesis.character_name` 缺属性。`git stash` 全撤后**同样红** → 既有。根因：该模板由 `5933a50`（2026-10-10）引入时，`PROMPT_VARIABLE_DESCRIPTIONS_EN` 未同步，**红到今天** → 补 4 条（`character_name`/`mainline`/`mentions`/`existing_roster`）。
- 结果：`prompt-local-qwen-contract` **21/21 通过**（原 `2 failed | 19 passed`）；`prompt-project-session` **9/9**；`prompt*` 全组 **11 文件 144/144 通过**。
- **可复用规律（三条同一根因）**：本项目的红测试多为「**模板已演进、支撑表/审计表没跟上**」，而非代码缺陷。故遇到契约类红测试，**先 diff 模板与期望表，再怀疑实现**。

**未排除项**：所有取证**仍在原项目**执行（非空项目），遗留 legacy 角色（`retired=1`）与旧蓝图行噪声未隔离；若需纯净基线，仍建议空项目重跑。

| 优先级 | 动作 | 收益 | 风险 |
|---|---|---|---|
| **P0-0** | **上游章级/期次投影**：`novel_architecture`（蓝图侧 15,917 字含全书 33 章）、`plot_structure_guide`（大纲侧 12,513 字含全书 185 章）按本章范围投影 | **量级最大**：每生成一章大纲都要携带全书 185 章弧光（§7.0.5-C3/C4） | 中（须守住"设定事实源"语义，不可误裁禁则/术语） |
| **P0-1** | 短细纲只喂**该步材料**（本章 keyEvents + 前驱状态），不再喂整份初始生成 prompt | 消除全链路最明确的浪费；直接改善"短细纲输出散文" | 低（改 `generate-draft.command.ts:1012` 一处） |
| ~~**P0-2**~~ ✅ **已完成**（2026-10-13） | 剥离**正文格式类规则**（落点 = **`global_guidance` 的 304 字分区**——含"弹幕【】格式/一句一段/短句口令"4 条；**已实测否证** `writingStyle` 为上游污染源） | 直接消除"上游被正文形态纪律污染"的首要来源 | **改用段级标签机制**（作者裁定 ③，不建 `draftingRules` 槽位）：零 schema、零迁移、旧数据逐字不变；同机制覆盖 `referenceWorks` / `writingStyle`。设计稿 `docs/design/free-text-scoping-design.md` §11 |
| **P0-2b** ✅ **已完成**（2026-10-13） | `referenceWorks` 落点错位：该看它的看不到（世界观/弧光零注入）、不该每章吃的每章吃（正文每章 2,301 字） | 体系/机制终于能进设定层；正文可只保留禁则与调性 | 作者裁定 ②「需要」→ `world_building` / `plot_structure` 新增 `reference_works`（zh+en 对称）；⚠️ 这是**唯一碰模板契约基线**的动作，已同步期望表 |
| ~~**P0-3**~~ ✅ **已完成**（2026-10-13） | `role` 字段加**枚举取值域契约**（模板由"例如…"改硬枚举；节奏意图改走 `purpose`） | 消除 `role` 长文本进 prompt 的"同信息两遍 + 跨章指涉"（§7.0.5-C5） | 已落地：内置 `chapter_blueprint`/`chapter_blueprint_chunk` + **作者全局覆盖版** + trace 测试；**ch6/ch7 旧值未自动改写**（守"不自动执行副作用"） |
| ~~P0-3~~ → **移至 §10-F** | 蓝图容量合同带上本章 `wordsTarget` | **性质不同**：它修的是"字数链路不一致"，不是"乱炖"。混在 P0 里会让两个问题域的验收标准互相干扰 | 低 |
| ~~**P1-1**~~ ✅ **已完成**（2026-10-15） | 正文/续写把后续计划降级为**本章不可写事件**清单（⚠️ 落点按 §7.0.2-R1 由 `future_blueprints` 修正为既有 **【后续计划边界】块**） | 直接消除"续写越界第2章"；ch2 实机整块 1,656 → 729 字（省 56%） | 已落地：`src/shared/chapter-boundary.ts`（`toBoundaryNotice`）+ 内置说明句改写 |
| **P1-2a** ✅ **已完成**（2026-10-16） | L2 投影（**按节**）：`architecture` 对正文剥离**整节远期**段（`### 3.【隐喻与深层危机】` → 标题 + 一行声明），并在运行时合同补【远期设定边界】；另给产出侧 `world_building` §3 加生成约束（防未来再犯） | 消除"长线设定进当前章节"的错觉；ch2 实测 6,854 → 5,958（省 896 = user 5.2% / total 4.9%） | 已落地：`src/shared/architecture-projection.ts`（fail-open）。设计稿 `p1-2-architecture-projection-design.md` |
| **P1-2b** | 产出侧**期次结构**（单条设定标注 `展开期` / `适用章`，见 §3-`:106`）：做到"只给事实源"（判 ~20–50%） | 须改模板 + **存量项目重生成世界观** ⇒ **另立小项** | 高（作者级人工成本） |
| **P1-3** | L1 变量出口语义化 + `enforceRequiredContext` | ✅ **作者裁定（2026-10-16）：D1/D2 均不立项 · D3 重定义为「可观测性」 · D4【C1】另立小项**。依据：三条独立取证显示兜底**0 触发**（内置 25 / 覆盖版 20 / 实机 18 snapshot）；`acceptsScopes` = **抽象层级错误**（真实需求是"按变量自身结构切"，四个消费者已由 P0-1/P0-2/P1-1/P1-2a 逐一取代）；`enforceRequiredContext` = **语义被混淆**（它作用于兜底通道，附 systemSuffix 适用边界）。**可观测性已落地**：`projection` 元数据（`shared/prompt-projection.ts` + 两个投影函数 detailed 变体 + trace 吸附 + markdown 呈现）。稿：`p1-3-variable-export-scoping-design.md` | 低（零行为变更 ⇒ 不碰契约测试基线） |
| **P2** | L3-(b) 拆 `draftingRules` 槽位 | 根治"硬指标被降权" | 高（UI + schema + 迁移） |
| **P2** | 蓝图阶段加**设定时点预检**（"铃铛 from_ch:10"这类约束机器可读化） | 从源头挡住"物品提前出现" | 中（落点 `consistency-preflight.ts`） |
| **P3** | L3-(c) trace 标注材料作用域 | 让作者看见"这步为什么带/不带这段" | 低 |

### 7.1 进度与接手入口（★ 新会话/新助手从这里开始读）

**（2026-10-16 01:4x 最新补记）★ 主线 A（全链路载荷重构）已到收口点。**

- **P1-1** ✅ 已完成 + 实机复验（`chapter-boundary.ts`；ch2 边界块 1,656 → 729 字，省 56%）。
- **P1-2a** ✅ 已完成 + 作者行动项闭合（`architecture-projection.ts`；ch2 `architecture` 6,854 → 5,958，省 896）。**作者已把「代述禁忌」迁入 §1**、并裁定「现实变薄」**随 §3 移除**（原话「当期不该知道，这个变化由弧光和大纲来安排」）⇒ 见 `p1-2-architecture-projection-design.md` §8/§8.1/§12。**仅剩实机复验**（与 B′ 段二同批待决）。
- **P1-3** ✅ **已结项（2026-10-16 裁定：D1/D2 不立项 · D3 重定义为「可观测性」并**已落地** · D4【C1】另立小项）** ⇒ `p1-3-variable-export-scoping-design.md`。三条独立取证（内置 25 模板 / 覆盖版 20 份 / 实机 18 snapshot）显示 `enforceRequiredContext` 的兜底**一次都没触发**；`acceptsScopes` 的四个潜在消费者已被 P0-1 / P0-2 / P1-1 / P1-2a 逐一取代，且对 `architecture` 这类 `G+A+D` 混合变量**按主层过滤只有 0/100 两档、无中间态**。**可观测性已实施**：`projection` 元数据（零行为变更，不碰契约测试基线）。**唯一真候选落点 C1**（审稿链 `review-chapter.command.ts:71` 吃全量 `worldbuilding`、无投影）已单列为另立小项。
- **P1-2b**（产出侧期次结构）与 **P2/P3** 未动。

---

**一句话现状**：设计已定稿、取证已完成四轮（正文侧 + 上游侧 + **P0-0 实机验证** + **P0-1 实机验证**）、**P0 主线已全部落地（P0-0 / P0-1 / P0-2 + P0-2b + P0-3）**。**P0-2 由"新槽位 `draftingRules`"改为"段级标签机制"并已实施**（作者裁定四项；改前需先出小设计稿——已出并经作者过目）。**P0-0 / P0-1 均已实施并实机取证**：P0-0 蓝图侧 + 大纲侧**两条链全生效**（叠加弧标题解析缺陷修复，见 `p0-0-upstream-projection-design.md` §10–§12）；P0-1 短细纲载荷**省 92%**、输出回到 5 条清单（见 `p0-1-short-outline-scoping-design.md` §8.1）。**全部改动已 commit 且工作区干净**：`14fc64c`（P0-1）+ `20fca6a`（P0-2）+ docs。**作者全局覆盖版已按裁定 ② 同步**（`world_building` 补槽位、4 处表头统一；见 `free-text-scoping-design.md` §11.7），故**当前项目与空项目的机制层已一致**。

**作者计划：新建空项目跑全流程**（尚未执行；跑前须重启 `pnpm dev`）。

**（2026-10-14 收口补记）** P0 主线（P0-0 / P0-1 / P0-2 / P0-2b / P0-3）**已全部完成并提交**，最近的正文层实机验证（ch1 + ch2）机制层全绿。同轮两件事：① AGL 设计稿（`docs/design/global-guidance-scope-lint-design.md`）经作者裁定**搁置** —— 「黄金三章拆分属使用层问题，框架不做兜底」，不进框架、保留备查（作者处置路径 = 手动拆进「节奏/风格指导」+`userGuidance`）；② 修复**大纲生成弹框进度记录无上限堆叠**（`DirectoryConfigDialog.tsx`，commit `1c3d436`）。③ **三项待裁定口径已裁定并落地**（原 §7.1-D）：加优先级声明（模板三处：内置 zh/en + 作者覆盖版）、修弧光跨界缺口（`arc-position.ts`，本批跨中弧时后半批缺规格）、空项目暂不跑先推代码 —— 见 `p0-0-upstream-projection-design.md` §13 与新版 §7.1-D。**下一步起点 = 下方 B-4（`keyEvents` 结构化），它是 P1 系的共同前提。**

**（2026-10-14 18:25 再补记）** B-4「`keyEvents` 结构化」**阶段 1 已实施并修复完成（未提交）**。
作者告知首轮实施**中途失败**；经复核，首轮**实际引入 53 条回归**（含 1 条**用户可见的生产崩溃**），
两条真实缺陷已修、fixture 已同步、新增 3 条回归测试并负向验证。**同口径读数：10 文件 HEAD 403/403、
修复后 403/403；src touched 面 21 文件 670/670；electron 侧 251/251。**
**下一步 = 阶段 2（产出侧）**，入口见 `blueprint-key-events-structuring-design.md` §11.5；
**该稿 §11.6 是本轮最有复用价值的复盘**（"零回归"必须同口径基线 / `tsc` 归零 ≠ 语义正确 /
契约改类型必须单走恢复链路 / 回归测试必须负向验证）。

**A. 已完成的代码改动（4 项，均已过 tsc + 测试）**

| 项 | 落点 | 状态 |
|---|---|---|
| trace 文件名加业务标签 + 章节段 | `src/services/prompts/prompt-trace-writer.ts`（映射表 + `<时间戳>-<业务标签>-<章节段>-<runId8>`）+ `trace-scope.ts`（`traceFileName` 钉住） | ✅ 测试 3 例；**含同日二次修复**：名字改为**首次落盘钉住**，消除 3–4 份半成品（详见 §7.0.6 实施 A） |
| `role` 硬枚举契约（节奏意图改走 `purpose`） | `src/services/builtin-prompt-templates.ts`（两处）+ **作者全局覆盖版** `<VELA_HOME>/prompts/chapter_blueprint_chunk.zh-CN.json` | ✅ 措辞已改；**ch6/ch7 旧值未改** |
| 契约测试期望表修正 | `src/services/__tests__/prompt-local-qwen-contract.test.ts`（补 `character_background_synthesis`；`character_dynamics` 去 `schemaVersion`） | ✅ 21/21 |
| 英文变量说明表补登记（第 3 条既有失败） | `src/services/builtin-prompt-templates.ts` 的 `PROMPT_VARIABLE_DESCRIPTIONS_EN` 补 `character_name`/`mainline`/`mentions`/`existing_roster` | ✅ `prompt-project-session.test.ts` 9/9；`prompt*` 全组 **144/144** |
| **P0-0 上游章级/弧光投影** | 新建 `src/shared/synopsis-projection.ts`；改 `directory-workflow.ts` / `directory.command.ts` / `arc-position.ts` / `architecture.command.ts` / `generate-draft.command.ts` | ✅ 28 例单测全绿；**蓝图侧 + 大纲侧实机均确认生效**（含弧标题解析缺陷修复）；**已 commit**（`e01ed5b`/`48451b7`/`283f6de`/`a2199fe`/`09351e9`/`4df194d`） |
| **P0-1 短细纲只喂该步材料** | `src/shared/draft-short-outline.ts`（`DraftShortOutlineMaterial` 契约 + 指令拆「纪律/范围」两段）、`generate-draft.command.ts:939`（不再由 `prompt` 派生） | ✅ 新 9 例 + 命令 211/211；**蓝图/前驱/执行合同三块**；**实机取证通过**（载荷 16,736 → 1,336 字、输出 553 字 5 条，见设计稿 §8.1）；**已 commit** `14fc64c`。设计稿 `docs/design/p0-1-short-outline-scoping-design.md` |

**B. 下一步（建议顺序，含"第一步动作"）**

1. ~~**P0-0 上游章级投影**~~ ✅ **已完成 + 实机复验通过（两条链全部生效）** —— 三项裁定、实施记录、取证结论、缺陷修复、修复后复验见 `docs/design/p0-0-upstream-projection-design.md` §7 / §9 / §10 / §11 / **§12**。
   - 关键认知（仍适用于后续）：**不能照抄正文侧全剔章级**——大纲的章级条目对蓝图步骤是**本步输入**（不是冗余），故须**三段切分**（前序→剔（由 `chapter_list` 承载）/ 本批→保留 / 后续→降级为边界声明）；
   - 实施落点与设计稿的偏差：投影**下移到 `directory.command.ts`**（`n`/`m` 与 `chapter_list` 同处一室），workflow 侧只负责输出 `context.data.architectureParts`；B 档**未动 `SKIP_FIELDS`**（改为按行识别接续理由）；
   - **实机结果（第一轮 ch6–10）**：蓝图侧 ✅ 生效（`novel_architecture` 10,392 → 9,313 字，与期望值精确相等）；大纲侧 ❌ 未生效（`plot_structure_guide` 仍 12,513 字）。
   - **根因已定位并已修（既有缺陷）**：`arc-position.ts` 的弧标题正则只认「（约 N 章）」单值，而内置模板 `builtin-prompt-templates.ts:680/704` 示范写区间「（约 X–Y 章）」→ `parseArcStructure` 恒返回 `null` → **弧位块与 B 档裁剪从未生效**（静默失败）。
   - **★ 修复后复验（第二轮 ch11–12）**：大纲侧 `plot_structure_guide` **12,513 → 2,983 字（省 76%）**，变量**逐字等于**「B 档裁剪 2,279 + `\n\n` + 弧位块 702」，两次调用 user 消息**都含【本批所处弧位】与防提前硬约束**（user 20,472 / 20,712）；蓝图侧 `novel_architecture` **8,629 字**与期望值精确相等（只剩 ch11–12 章标题，前序 1–10 已剔）。**两条链均已确认生效。**
   - **其余待办**：① 若章末 `suspenseHook` 质量下降，把后续段降级起点由 `m+1` 回退为 `m+2`；② `charactersArch` 投影单独立项。
2. ~~**P0-2 `global_guidance` 分区**~~ ✅ **已实施 + 实机验证（2026-10-13）** —— 设计稿 `docs/design/free-text-scoping-design.md`（与「参考作品落点错位」合并为一稿，同一根因：作者自由文本按步骤落点未分区）。**实施记录 §11 / 实机结果 §11.4 / 补漏 §11.5 / 覆盖版分歧 §11.6。**
   - **★ 实机结果（作者跑「ch13 大纲 + ch1 正文」）**：正文链投影**精确生效** —— `【参考作品…】` 块 **2,267 → 148 字**（逐字等于 `【适用：架构,正文】` 那 3 行）、user 17,524 → **15,270**、`builtLength` 11,287 → **9,053**、**标签零泄漏**；章节段 `ch13` 正确（单章形态本就是 `ch13`，`chN-M` 只在多章批次）。
   - **★ 补漏：`【其余冻结作者配置】` 是第 7 个注入点（已修）** —— 逐章大纲路径把**整份 config `JSON.stringify`** 直灌 prompt，不经模板变量 → 未投影时带 `【适用：架构】` 的原始 `referenceWorks` 原样进入大纲请求（与裁定 ① 冲突）。修法与校验见 §11.5；**判据：「模型输出会写回配置」的块不适用投影**（premise 的 `【作者已有配置】` 即此类，刻意保留原文）。
   - **✅ 裁定 ② 的覆盖版遮蔽已解除（2026-10-13 作者同意后执行，见 `free-text-scoping-design.md` §11.6/§11.7）**：`plot_structure` 无全局覆盖 → builtin 直接生效；**`world_building` 的参考作品原本由「末端兜底块」供应**（`appendRequiredPromptContext` 拿内置 required 清单比对覆盖版，未引用即追加在正文末尾）——**并非零注入，而是位置不对**；本次已把 `{{reference_works}}` 与统一表头写进覆盖版 → **就地按 `【参考作品…】` 渲染**。同轮把 4 处旧表头一并同步。⇒ **当前项目与空项目机制层已一致**。
   - **★ 推论（改内置前必读）**：覆盖版的 `requiredContextVariables` / `variables` **不参与渲染决策**，渲染只读内置 required 清单 + 覆盖版 `content`/`taskGuidance` ⇒ **改内置 required 列表会穿透作者覆盖版生效**（本轮兜底正是靠它），属"静默改变所有覆盖版项目载荷"的风险点。
   - **落地方案（作者裁定）**：给自由文本加**段级标签** `【适用：架构】` / `【适用：大纲】` / `【适用：正文】` / `【适用：全部】`（整行独立、段继承、**无标签 = 全量 = 旧数据逐字不变**、未知值按全量+告警），由纯函数 `projectScopedText()` 在**写入 builder 之前**过滤。一套机制同时覆盖 `globalGuidance` / `referenceWorks` / `writingStyle`（6 处注入点）。
   - **作者裁定四项**：① 标签至少分出**「大纲」**档（"架构标签的内容仅供主架构使用，大纲蓝图是根据架构生成的，不应该重复吃上层材料"）→ 语义是**显式归属、无继承**，组合值走逗号；② 架构层**需要**补上世界观/弧光的参考作品；③ **改用标签、不建 `draftingRules` 槽位**（附录 E 原"依赖新槽位"的结论已按此标注失效）；④ 段统计提示**要做**（"测试期间很多时候过了一天都迷茫"）。
   - ⚠️ **原定落点"新槽位 `draftingRules`"作废**（零 schema / 零迁移 vs 中-高成本；且"对存量项目零收益"这条批评对新槽位同样成立）。*不是改回 `writingStyle`，是改用段级标签。*
   - **实测数据**：ch1 `global_guidance` = **315 字**，9 句里约 5 句是**正文形态纪律**（"一句一段""弹幕用【】""短句切分+计数口令"）却被注入架构/大纲/章纲/蓝图；该变量在 **12 处**模板中声明，是覆盖面最广的自由文本。
   - **同稿附带的"参考作品"取证（已一并修掉）**：含 `{{reference_works}}` 的模板改前**只有 4 个**（premise / 角色图谱 / 首章 / 后续章），注入点 2 处；**世界观·弧光·大纲·章纲·蓝图全看不到**；正文每章吃 **2,301 字**；UI `placeholder` 写"AI 架构生成时会参考"与行为不符；作者那栏里含「13‑20 章要写的内容」→ **第 1 章正文可见后续规划**（与 P1-1 同类、另一条通道）。

3. ~~**P0-1 短细纲只喂该步材料**~~ ✅ **已实施 + 实机取证通过（2026-10-13 21:23）** —— 作者裁定三项（**后续计划边界不给** / 前驱给**上一章定稿全文** / 执行合同给），实施记录与校验见 `docs/design/p0-1-short-outline-scoping-design.md` §6.1 / §7，**实机数字见其 §8.1**。
   - **实机结果**：短细纲请求 user **16,736 → 1,336 字（省 92%）**、零越界材料；输出 **553 字 5 条清单**（原为 ~1,747 字散文）；注入正文的短细纲块 ~1.8K → **588 字**；正文请求块序完整、`【后续计划边界】` 仍在、`prompt`/`systemRole` 逐字未动；文件名 `…-正文-ch1-a495f9c6`（一次运行一份）。
   - 落地契约 = **本章蓝图 JSON + 上一章定稿原文 + 本章执行合同**；此前输入 = 整份初始正文 prompt（实测 16,736 字）。
   - ⚠️ **本文原写的行号 `generate-draft.command.ts:1012` 已漂移**，实际落点 = **`:939`**；短细纲唯一一次 LLM 调用在 `:1108-1112`，**只有 user 消息、无 system**（"材料形态即正文形态"→ 输出散文的机制性原因）。
   - ⚠️ **两条尚未实机验证**：① **前驱给全文**（本次样本是第 1 章，无前驱 → 块被正确省略），需跑第 2 章及以后；② **大纲章节段** `declareTraceScopeChapterRange`（本次无大纲 trace），需另跑一次大纲生成看 `-大纲-chN-M-`。
   - **本步不依赖 `keyEvents` 结构化**（不消费 `estimatedUnits`，按 §8-7 YAGNI 不立项）。
   - 主进程**不必改**（重试回放 `usage_replayTask`；哈希两侧同源）。
   - **踩坑提醒（新）**：P0-1 会让"以前最大的那个请求"变小 —— 凡按**序号**取"第一个/最大请求"做断言的测试都会假红（本轮 `does not locally reject a 30K prompt…` 即此，已改为**按 `purpose` 取**）。
4. ★ **共同前提 `keyEvents` 结构化**（`string` → `Array<{id, event, estimatedUnits}>`）—— 原写「落点在蓝图 schema，**必须走 lane 六步**」，**该前提已被调研否证**：复用 `blueprints.key_events TEXT` 存 `JSON.stringify(array)`（与同表 `characters` 同一惯用法）⇒ **零 schema 迁移、不动 DDL 一字节、基线指纹不受影响**（红线 1 天然满足）。§5.5 表里有三行都依赖它。设计稿 `docs/design/blueprint-key-events-structuring-design.md`（作者已裁定 D1–D6 全部同意）。
   **★ 阶段 1 已实施并修复完成（2026-10-14，未提交）**：首轮实施**中途失败**、实际引入 **53 条回归**（含 1 条**用户可见的生产崩溃**），两条真实缺陷已修 + fixture 已同步；真实读数与复盘见该稿 **§11.4 / §11.6**。**下一步 = 阶段 2（产出侧）**，入口见其 §11.5。
5. **P1-1 / P1-2 / P1-3**（见上表；P1-1 落点已修正为【后续计划边界】块）。

**C. 接手必做（否则会踩已知坑）**

- **先确认模板生效来源**：`getPromptSource(key)` + `ls <VELA_HOME>/prompts/`。作者环境有 20 个全局覆盖模板长期遮蔽内置——**改内置不改覆盖版 = 白改**（本轮 `role` 就是两处都改才生效）。
- **取证必须比对 `ioCalls[].messages[].content`**，不能只读 `snapshots[].built`（代码渲染后会追加块，正文侧实测差 7,093 字）。
- **改 `requiredContextVariables` / 模板变量前**跑 `prompt-language-contract.test.ts` + `prompt-local-qwen-contract.test.ts`。
- trace 取证路径：`<项目根>/debug/prompt-trace/`；只读排查项目库需**连 WAL 一起复制**。

**D. 三项口径已裁定（2026-10-14，原「待作者裁定」）**

1. **`chapter_list` vs `# 情节大纲` 的残留重叠** → **加优先级声明**。⚠️ 现状先厘清：`chapter_list` = `previous.slice(-100)` 的"已生成蓝图事件要点"（模板定位语：【前置剧情进度与连贯性检查】），`# 情节大纲` = 规划；**P0-0a 已剔除被 `chapter_list` 覆盖的前序章**，残留重叠只发生在本批章已有旧蓝图的场景。裁定 = 在蓝图续写模板里显式声明"已定稿的既有蓝图是事实、情节大纲是规划背景，冲突时以本节为准"。落点 = 内置 zh + 内置 en + **作者全局覆盖版**（覆盖版遮蔽内置）；见 `p0-0-upstream-projection-design.md` §7-4 / §13.2。
2. **空项目纯净基线** → **暂不跑，先推代码**。"取证纯净"动机撤销（P0-0/0-1/0-2 的读数已在原项目逐字精确验证）；仍保留"新书冷启动体验"这一独立目标，等 P1 系改动成批后一次跑。
3. **上游投影的边界** → **修：跨边界弧全字段**。取证发现真缺口：本批跨中弧边界时，后半批所属的新中弧只拿到 gist、无规格字段（而弧位块的跨界提示要求"按新中弧的规格写"，自相矛盾），且 `remainingMids` 仍把已进入的中弧列为"后续"。`ArcSpan` 新增 `endMidIndex` / `afterBatchMidBoundary`；见 `p0-0-upstream-projection-design.md` §7-5 / §13.1。

---

## 8. 红线与风险

1. **投影 ≠ 裁剪**。正文的 `【不可偏离的作者事实】` 依赖设定可查；剥"剧情"可以，剥"术语/禁则/基调"会让模型无对照而写出相反内容。
2. **`future_blueprints` 不能直接删**。"防提前"是它的存在理由；删了会引发另一种越界（模型不知道后面有什么就自由发挥）。**正解是降级为边界声明**。⚠️ 但实测该变量当前**值为空**，防提前实际由手工拼装的【后续计划边界】块承担（见 §7.0.2-R1）——**落点以此为准**。
3. **不许让模型"自报账目"**。已完成/待完成事件必须由代码算（`arc-position.ts` 的"解析上位→累积求和→注入位次"是现成范式）。
4. **`requiredContextVariables` 改动碰模板契约测试**。`prompt-language-contract.test.ts` / `prompt-local-qwen-contract.test.ts` 锁定变量出口，改前先跑基线。
5. **globalGuidance 全线贯通是既有设计**（11 模板出口）。改它等于改全链路语义，必须先在 trace 里核对生效来源（`getPromptSource`），且注意 `VELA_HOME/prompts/` 下的**全局自定义模板会静默遮蔽内置**（见 `MEMORY.md` 红线）。
6. **本文所有判定基于单次 trace**。实施前建议再取 2–3 个不同章节的 trace 交叉验证矩阵。

7. **契约字段过度设计（YAGNI）**。本项目的病理是"注入过量"；契约字段一旦膨胀（如给每个事件标"伏笔权重""情绪曲线"），会**以"结构化"的形态复现同一病理**。**红线：契约第一版只定义"下游必须消费的字段"，无读取点者不立项**（用 §5.5 表的"落点"列反向校验：没有下游读取点 = 不立项）。
8. **Phase 1 ↔ Phase 2 之间的"过渡期逆反"**。上游结构已改、正文链未改时，若作者正在写新章节，会产生"新上游 × 旧下游"的不兼容。本项目**正在被作者实际使用**（旧项目升级 + 新章节创作），故风险真实存在。**缓解：新旧双产出 + 下游择一消费**（与附录 E.1"新槽位只喂正文链、旧槽位保持全量"是同一手法）。
9. **事实澄清（防实施时误采信）**。① 本项目**不存在 `qa_all.py`**（全库检索为空；附录 D/G 已两次纠正）；投影回归应对照 `debug/prompt-trace/` 的 `built` 快照。② 本项目**有** `prompt-trace` 与 `generation_runs`/`generation_attempts` 记录，但**没有"回滚到上一步"的能力**；"可回溯到哪一步出错"部分成立（trace 可按 call 归属），但"可回滚"属**尚未具备**，不得当作既有前提写进设计。

10. **`role` 是"自由文本"而非枚举——不要假设它是枚举值**。`src/shared/chapter-role.ts:2` 注释即写明 "Stored roles are free text. Select options preserve them without rewriting."；模型会写进"枚举词 + 破折号 + 情节说明"的长文本（§7.0.5-C5 实测 ch6/ch7）。**该字段经 `{{chapter_info}}` 进正文 prompt**，故任何"读 `role` 做逻辑判断"的代码都须容忍长文本；修复只能从**产出侧契约**（模板硬枚举）入手，**不得**在渲染/UI 侧自动截断（守"绝不自动执行副作用"）。

11. **取证红线：`snapshots[].built` ≠ 最终发送的 user message**。代码会在渲染后追加内容（如 `【后续计划边界】` 块，在 `built` 中搜索为 `-1`），实测正文侧差值达 **7,093 字**。**凡涉及"某材料是否进入请求"，一律比对 `ioCalls[].messages[].content`**，只读 `built` 会得出错误结论（R1 的【后续计划边界】即为此类）。

---

## 9. 附：证据锚点

| 事实 | 位置 |
|---|---|
| `requiredContextVariables` 无条件注入清单 | `builtin-prompt-templates.ts:965`（first）、`:1037`（next） |
| 兜底追加语义 | `shared/render-prompt.ts:5-29` |
| 模板区块平铺（九块同权重） | `builtin-prompt-templates.ts:966-990`、`:1038-1067` |
| `architecture` 排第一位 | `builtin-prompt-templates.ts:968-969` |
| 短细纲吃整份初始 prompt | `generate-draft.command.ts:1012` + `shared/draft-short-outline.ts:6-11` |
| `mergedGuidance` = globalGuidance + 项目 prompt | `generate-draft.command.ts:761-764` |
| Builder 填值点 | `generate-draft.command.ts:870-890`（ChapterPromptBuilder 链） |
| 续写材料块 | `generate-draft.command.ts:572-637`（`draftAuthorMaterialBlock`） |
| 后续计划边界（第2–5章全文） | `generate-draft.command.ts:784-802` |
| 蓝图 keyEvents 被宣告"必须落实" | `generate-draft.command.ts:508` |
| 章纲/蓝图用全书架构整块 | `builtin-prompt-templates.ts:826-942`（`{{novel_architecture}}`） |
| 变量出口实现 | `services/prompts/prompt-builder.ts:87-188` |
| 章级投影（已做的那一半） | `generate-draft.command.ts:140-153`（`synopsisSettingSectionsForDraft` 同族） |
| `refine_chapter` 双写同一 summary | `refine-draft.command.ts:73-74` |
| `refine_from_review` 无文风 | `refine-from-review.command.ts:95-99` + `builtin-prompt-templates.ts:1268-1283` |
| 续写停止点 = 纯字数驱动 | `generate-draft.command.ts:1613-1638` + `:1535-1548`（`shouldAutoContinue`） |
| 定稿后处理（正确样本） | `finalize-chapter.command.ts:191-200` / `:284-288` |

---

## 10. 附录（响应同行评审的三处架构级缺口 + 五处工程级缺口）

> 评审结论：方向正确、洞察准确、矩阵可落地；补完以下附录即可进入实施。
> 本节同时**修正评审的两处事实偏差**（见 附录 G）。

### 附录 A：变量 → 作用域层映射表（补缺口 1，P0）

没有这张表，`acceptsScopes` 无法实现。口径：**主层** = 该变量默认完整归属哪一层（决定"不给"时的行为）；**附加层** = 其中一部分内容属于这些层（决定"投影"时的切分依据）。

| 变量 | 主层 | 附加层 | 投影默认行为 |
|---|---|---|---|
| `architecture` | `G` | `A`、`D` | 主层保留总纲/术语/禁则/基调；`A` 段留当前弧光位次；`D` 段留当前副本规则；**剥 `## 第N章` 与远期设定**（已有章级投影 + 需新增期次投影） |
| `novel_config` | `G` | — | 事实源，不投影。`globalGuidance`/`writingStyle`/`referenceWorks` 已由 `promptOnlyConfigKeys`（`:819-827`）分出 |
| `global_guidance` | `G` | `C`、`S` | 自由文本，**无标签时不可切**（见附录 E） |
| `writing_style` | `G` | `S` | 同上 |
| `reference_works` | `G` | `A` | 同上 |
| `chapter_info` | `C` | `S` | 已有 `toBlueprintProjection` |
| `future_blueprints` | — | `C`（边界） | 降级为 `toBoundaryNotice`（见附录 B） |
| `user_guidance` | `S` | — | 已有（作者本章微操） |
| `word_number` | `S` | — | 数值，不投影 |
| `draft_content` | `S` | — | 成品正文 |
| `previous_ending` | `S` | — | 上章末尾（仅作边界） |
| `character_states` | `D` | `C` | 按本章出场角色投影 |
| `global_summary` / `short_summary` | `A` | `C` | 时间线摘要 |
| `filtered_context`（知识库） | `D` | `C` | 已有检索 |
| `review_report` | `S` | — | 本步产物 |

**用法**：`acceptsScopes` 判"要不要"（按主层）；`projectXxx` 判"给多少"（按附加层切分）。

### 附录 B：`toBoundaryNotice` 派生机制（补缺口 2，P0）

评审问："不可写事件清单从哪来？"——**不是让模型生成**（违红线），也不是手写 845 章。

**落点**：新增零依赖模块 `src/shared/chapter-boundary.ts`。

**输入**：后续蓝图数组（已有 `loadDirectoryBlueprints`）+ **伏笔台账**（`narrative_thread_plans`）。

**输出**：分两栏的边界清单——这是关键，因为"本章不得出现"与"本章可埋点但不得兑现"是**两回事**：

```
【本章不得出现（属后续章节）】
- 第2章：夜间敲门第二次、门缝下出现纸条
- 第3章：…
【本章可埋点但不得兑现（伏笔窗口在本章）】
- 铃的「探针」功能：本章可暗示其对规则空位有反应，不得明确解锁
```

**提取器不做 NER**（规则式不可靠、模型式违红线），只做三件机械事：
1. **章节归属**：按 `chapterNumber > 当前章` 过滤（已有）；
2. **首句截断**：每条 `keyEvents` 取首个句读前的短语做标签；
3. **术语表命中**：若 `keyEvents` 里的词命中 `architecture` 的术语表/已登记道具，标注出来（仅标注，不推断语义）。

⚠️ **不做的**：不做"这个物件属不属于第2章"的语义判断——那是投影函数做不到的。归属由**蓝图自身的章节编号**保证。

### 附录 C：跨步骤一致性检查（补缺口 3 + 缺口 4，P0）

评审的两个问题（"停止点从哪来"、"三步对本章理解不一致"）**是同一个根**。

**现状实测**：`shouldAutoContinue`（`:1535-1548`）的判据**完全是字数**——`rounds < MAX` ∧ `currentChars ≤ 1.3t` ∧ (`finishReason==='stop'` → `currentChars < 0.7t`；否则 `==='length'`)。**没有任何事件边界判据**。停止点提示（`:1631`）只说"接近时按本章结束状态收束"——**依赖模型自己判断什么是"结束状态"**，这就是越界第 2 章的机制。

**根治的前提（重要）**：`keyEvents` 现在是**一段字符串**，无法编号、无法对账、无法定停止点。所以：

> **附录 C 与附录 F 指向同一个根因修复：蓝图 `keyEvents` 需要从 `string` 变成 `Array<{ id, event, estimatedUnits }>`。**

这条落点在**蓝图的 schema**（`directory` 步骤的产出契约），不在正文侧。与 `MEMORY.md` 既有约定"要机器可读结构 → 加在蓝图（有 schema），别加散文层"一致。

**改造后的链路**：
1. 蓝图产出**编号 keyEvents 数组**（含每条 `estimatedUnits` 预估）；
2. 短细纲把编号原样带下来（不再是散文）；
3. 初始生成写前 K 条（K = 预算累加 ≤ `0.85t` 的最大前缀）；
4. **续写从第 K+1 条接，停止点 = 写完最后一条 keyEvent**（**事件驱动**）；字数降级为护栏（`0.7t` 退回 / `1.3t` 上限）。

**账目由代码算**：K 是代码算的，不是模型报的。中间若模型少写了某条，代码无法精确知道——**故采用保守策略**：未被检测到的编号一律列入"待完成"，宁重不漏。**弱判据只作提示，绝不作门禁**（红线：不许让模型自报）。

### 附录 D：投影的可检测性（补缺口 5，P1，**修正评审**）

评审建议"用 `qa_all.py` 回溯"——**本项目不存在 `qa_all.py`**（已全库检索确认）。正确落点应复用**既有的 trace 基础设施**：

- `PromptTraceSnapshot.built` 已存**投影后**的完整拼装文本；
- 只要同时记录**投影前**的长度/指纹，就能在 trace 里直接显示"本变量投影掉了 N 字 / 剥离了哪些小节"。

**落点**：`prompt-trace.ts` 的 snapshot 增加 `projection?: { variable, beforeChars, afterChars, droppedSections }`；`projectArchitectureForDraft` 返回值带这份元数据。

**开发期对照**：加开关 `VELA_PROMPT_SCOPE=off`（全量注入、不投影），与投影态跑同一章做 A/B——这比"verbose 模式"更贴近现有调试手段（trace 已能离线渲染，见 `prompt-trace-markdown.ts`）。

### 附录 E：标签语法与解析器（补缺口 6，P1，**含评审提出的最严重落地漏洞**）

评审指出关键问题：**"旧项目不标签化 → P0-2 在旧项目上不生效。"** 这条完全成立，是本设计稿最大的落地漏洞。处理如下：

**1. 默认行为翻过来（修正原稿）**
- 新槽位 `draftingRules`：默认**只喂正文链**（新内容天然正确）；
- 旧 `globalGuidance`：**保持全量注入**（不破坏旧项目）。

→ **结论：P0-2 应改为依赖「新槽位」而非「标签」**，否则它对存量项目等于零收益。标签法只作为**渐进迁移**的辅助手段。

> ⚠️ **[已被取代 2026-10-13，原文保留] 作者裁定 ③：改用段级标签，不建 `draftingRules` 槽位。**
> 取代理由（三条）：
> ① **"对存量项目零收益"这条批评对新槽位同样成立**——正文里那 304 字本来就写在 `globalGuidance` 中，新槽位默认只喂正文链，作者同样得**手动把文字搬过去**才生效；不存在"新内容天然正确"的免费午餐。
> ② 标签机制**一套覆盖三个变量**（`globalGuidance` / `referenceWorks` / `writingStyle`），零 schema、零迁移、旧数据逐字不变（无标签 = 全量）。
> ③ "作者会忘/看不见"这条风险，**由作者裁定 ④ 的段统计 + chip + 未知标签告警对冲**（`ScopeTagBar`）。
> 详细取舍与实施记录见 `docs/design/free-text-scoping-design.md` §5、§9、§11。

**2. 语法**：行内标记 `[[scope:C,S]]`（比 `## 适用：架构` 更不易与 Markdown 标题冲突），或段落级前缀 `【正文】`。**解析器**放 `src/shared/prompt-scope-label.ts`（零依赖，与 `prompt-trace-markdown.ts` 同族），由 `prompt-builder.ts` 调用。

**3. 未标签内容**：**默认全量注入**（向后兼容优先）。

**4. 迁移助手**：设置面板提供"扫描 `globalGuidance` 中的正文格式类条目"按钮，用**关键词表**（弹幕/对话占比/每条≤/每段≤/段落/字数/钩子/爽点）做**建议标注**，作者确认后落标签。**只建议，绝不自动改**（符合项目"提示类功能三纪律"）。

### 附录 F：字数链路设计（补悬置 2 + 缺口 7，P1，独立问题域）

**现状实测（三处）**：短细纲**无字数**；初始生成按 `targetChars`（`0.85t`–`t`）；续写按 `allowance` 补。实机 `3000` 目标产出 `1400 + 800 = 2200`。

**根因**：字数目标是从**配置**推导的，不是从**事件容量**推导的。`keyEvents` 只有 8 条，撑不到 3000 字——无论指令怎么写都写不到。

**设计（唯一分配点 = 蓝图）**：
- 蓝图产出 `keyEvents` 时**同步给出每条 `estimatedUnits`**，合计 ≈ `targetChars`；
- 短细纲**继承**该分配（每点带预算）；
- 初始生成写预算累加 ≤ `0.85t` 的前缀；
- 续写写剩余编号，**停止点 = 最后一条 keyEvent**；
- 护栏保留：`0.7t 退回 / 1.3t 上限 / 0.85t 目标`。

**与 triage 稿 §2.2 的关系**：triage 稿的"蓝图用 `wordsPerChapter`、正文用 `chapterInfo.wordsTarget`"是**基准不一致**；本附录是**分配机制缺失**。两者需一起改：蓝图容量合同**带上本章 `wordsTarget`**（修基准），且**产出 `estimatedUnits`**（修分配）。

### 附录 G：评审修正记录（两处事实偏差 + 一处新发现）

| 项 | 评审说法 | 实测 |
|---|---|---|
| 投影失败回溯 | "当 `qa_all.py` 检测到设定偏离时回溯" | ❌ **本项目无 `qa_all.py`**（全库检索为空）。机制应改用 trace 的 `built` 快照（附录 D） |
| `refine` 需要 `future_blueprints` | "refine 注入 `future_blueprints`（防改后续伏笔）" | ⚠️ 实测 `refine_chapter` 与 `refine_from_review` **都没有** `future_blueprints`。**这是真缺口，但不是"是否需要保留"，而是"是否应该新增"**（当前精修确实可能在不知后续伏笔的情况下改坏它的埋点） |
| （评审未提）`refine_chapter` 双写 | — | 🟥 **新发现**：`:73-74` 把同一个 `historySummary` 同时赋给 `global_summary` 与 `short_summary`，而模板 content 两个出口都有（`:1116-1117`）→ **同一段摘要进 prompt 两遍**。与 `MEMORY.md` 已登记的"重复渲染"是同类问题的**新实例**（这次是赋值重复，不是变量清单重复） |

### 附录 H：外部评审《全链路 Prompt 架构重构评估》的吸收与驳回（2026-10-13）

> 评审全文复核见 `docs/design/contract-first-reassessment.md`（**存档，不作实施依据**；结论已折进本稿）。
> 该文**不是平行方案，而是读过本稿后写的评审**（判据 1 直接用本稿 `G/A/D/C/S` 代号、风险 2 点名 `acceptsScopes` 与 `prompt-language-contract.test.ts`）。故只做增量审计。

**H.1 已吸收（4 条，已折进正文）**

| 增量 | 落点 |
|---|---|
| Phase 0「反向验证法」（用真实蓝图回填契约表，填不上的才是缺口） | §7.0 |
| 风险：契约设计过度（YAGNI） | §8-7 |
| 风险：Phase 1↔2 过渡期双格式并存 | §8-8 |
| 其最大贡献「交付侧那条轴」→ 层间交付契约清单 | §5.5 |

**H.2 驳回（4 条，照做会走偏）**

| # | 外部主张 | 驳回理由 |
|---|---|---|
| H.2-1 | 拆分第 6 步（章纲）/ 第 7 步（蓝图），剥离"格式规则"与"文风" | ❌ **误诊**：章纲/蓝图并不"生成"文风——是被 `globalGuidance` **注入**的（11 模板出口 + `requiredContextVariables` 无条件兜底）。**拆步骤解决不了，污染源在注入机制**；且二者是既有 workflow，拆分是大改。正解 = §7 的 P0-2。**这是唯一可能造成实质损失的一条。** |
| H.2-2 | "初始生成隐含自评完成度，需去掉" | ❌ **幻觉**：`shouldAutoContinue` 判据**完全是字数**（`:1535-1548`），无任何自评/事件判据 → 无此职责可去。真问题是停止点**缺**事件边界，要**加**（附录 C/F），不是**减**。 |
| H.2-3 | 把字数链路重新塞回主收益表 | ❌ 本稿**刻意**将其移出 P0（§7：~~P0-3~~ → §10-F），理由已写明"性质不同，混在一起会让两个问题域的验收标准互相干扰"。 |
| H.2-4 | 用 `qa_all.py` 回溯 / `trace_id` 可回滚到上一步 | ❌ 事实错误，见 §8-9。该文掌握的是**本稿加附录 D/G 之前的版本**，凡涉及"具体怎么改"的段落均须以仓库现状为准。 |

**H.3 对其"Phase 0 产出三份契约文档"的修正**

**不新开** `SettingContract.md` / `PlanContract.md` / `ExecutionContract.md` 三份文档——**以"一张能填满/填不满的表"（§7.0 + §5.5）代替**。无真实数据回填的文档型产出无法证伪，正是本项目已踩过的坑。

---

## 11. 补完后的一致性检查清单（实施前自检）

- [x] ~~附录 A 的映射表与 §5 矩阵不矛盾（每步 ✅ 的变量，其主层必须在 `acceptsScopes` 内）~~ → **已作废（2026-10-16 裁定：`acceptsScopes` 不立项）**：附录 A 保留为**参考映射表**（"某变量属哪层"的查证依据），不再是实施前置。
- [ ] 附录 B 的边界清单**只由蓝图章节编号保证归属**，不含任何语义推断
- [ ] 附录 C/F 的蓝图结构化改造**先于**其它 P0 落地（它是共同前提）
- [x] 附录 E 的 P0-2 落点**已按作者裁定 ③ 改为「段级标签」**（原"依赖新槽位"的结论已就地标注失效；见附录 E 的取代说明）
- [x] 段级标签机制**已实施**：`src/shared/text-scope-tags.ts` + 6 处注入点 + `ScopeTagBar`；纯函数 17/17、分区回归 2 例（架构侧 / 正文侧各一）
- [ ] 附录 D 的投影元数据接进 trace，且 `VELA_PROMPT_SCOPE=off` 可关闭
- [ ] 所有"账目"由代码计算，无一处要求模型自报（红线）
- [x] ~~改动前后跑 `prompt-language-contract.test.ts` / `prompt-local-qwen-contract.test.ts` 基线对照~~ → **无须对照（2026-10-16 裁定：P1-3 不立项 + 可观测性零行为变更，未动任何变量出口）**。
- [x] 已用第 1 章真实蓝图 + trace **反向回填 §5.5 表**（§7.0.1，2026-10-13 完成），并产出"填不上"的缺口清单 + 4 条修正（§7.0.2）
- [x] 已补 **上游侧（大纲/蓝图）trace 复验**（§7.0.5，2026-10-13 完成）：否证 R2 落点、定位 `global_guidance` 为真实污染源、实测上游缺章级投影、发现 `role` 无取值域契约
- [ ] §5.5 契约字段**只含下游有读取点的项**（§8-7 YAGNI），无凑数字段
- [ ] 未误入「拆分第 6/7 步」路径（附录 H.2-1，会白干 + 高风险）
- [ ] 未把字数链路混进 P0 主线（附录 H.2-3；走附录 F 独立推进）
- [ ] 未按 §7.0.2-R2 的旧落点去改 `writingStyle`（**已否证**，落点为 `global_guidance`，见 §7.0.5-C2）
- [ ] 取证结论均来自 `ioCalls[].messages`，未误用 `snapshots[].built`（§8-11）
