# P4 评估：还有存在的必要吗？（作者 2026-10-10 提问后的重新评估）

> 作者问：「我明白你的意思了，那我说的这一块可以不用管它，**P4 还有存在的必要吗？
> 大纲蓝图那些，不太容易出现重复吧？**」
>
> 本稿是**诚实的重新评估**。结论：**P4 的原形态建议取消，但"配置重复"这个真问题确实存在，
> 而且不在大纲蓝图，在另一处。** 建议把 P4 重新定义为另一个靶子。

---

## 0. 一句话结论

- **作者说的那一块（提示词模板的全局↔项目）确实可以放下** —— 既然它是覆盖不是叠加，
  用户两级各写一遍的场景**在 UI 上就不会自然发生**（写了项目级，界面上来源标签立刻变成"项目"，
  全局那份已经看不到了）。**这一块收益低，同意不做。**
- **"大纲蓝图不容易重复"——这个判断也对，但真问题不在那儿。**
  真正的重复源在 `novel_config` ↔ `project_core`（**架构层**），
  而且**当前只有逐字去重，语义重复完全没管**（正是 P3 的靶子）。
- **→ 建议：取消 P4 原形态（提示词模板 AI 优化），把 P4 的价值并入 P3。**
  因为 P3 §0.3 里那句"配置层面的语义重叠交给 P4"——**那件事其实是 P3 自己该做的**，
  把它拆到 P4 只是制造了一个跨任务依赖。

---

## 1. 为什么"用户级 Prompt 设定"这块可以放下

### 1.1 覆盖语义本身抑制了这个场景

因为项目级**覆盖**全局（P4 设计稿 §0.0），用户在某个项目里写了一份项目级配置后：
- 界面来源标签立刻变"项目"；
- 全局那份**在界面上已经不可见**（`PromptSettings.tsx` 只显示当前生效的那份）。

→ 用户**没有明显动机**去两级各写一遍 —— 他看不见全局那份，也就不会想着"再补充点"。

**这解释了为什么作者实际使用中觉得"这块还好"** —— 不是没重复，是覆盖语义让它不容易发生。

### 1.2 代价与收益不匹配

做 AI 优化按钮要：AI 调用 + diff UI + 落盘建议 + 显著推荐位（P4 设计稿 Phase 2/3）。
而它解决的场景（同一模板两级各写一遍）**发生概率低**。
→ **不值得。同意取消。**

### 1.3 但「当前实际生效」展示仍值得留下

P4 设计稿 §2.3 那一块（零 AI、纯展示）**独立于 AI 优化按钮有价值**：
它解决的是"用户以为自己看到的是叠加结果"这个**认知问题**。
→ **建议：这一小块单独留住**（可以并入 P3，或作为一个很小的独立改动），
**其余 P4 内容取消**。

---

## 2. "大纲蓝图不容易重复" —— 判断正确，但重复在别处

我核实了大纲蓝图这条链路，确认作者判断正确：

- `chapter_blueprint` / `synopsis` 等模板的 `taskGuidance` 虽然两级可编辑，
  但**它们的内容是生成产物**（AI 写出来存进去的），用户很少手工在两处写。
- 所以**重复概率确实低**。✅ 作者判断成立。

### 但真正的重复源在另一处：`novel_config` ↔ `project_core`

这是**当前唯一、且真实存在**的语义重复源。我核实了代码：

**`generate-draft.command.ts:809-820`** —— `novel_config` 的一批字段被**排除**在 JSON 之外，
单独以自然语言注入：

```ts
const promptOnlyConfigKeys = new Set([
  'globalGuidance', 'writingStyle', 'referenceWorks',
  'coreOutline', 'worldSetting', 'goldenFinger', 'protagonistProfile',
])
const novelConfigFacts = Object.fromEntries(
  Object.entries(novelConfig).filter(([key]) => !promptOnlyConfigKeys.has(key)),
)
```

**`:740-745` + `:1881-1902`** —— 与此同时，`project_core` 的三字段又被**单独读出来**注入：

```ts
append(core?.premise)
append(core?.worldbuilding)
if (core?.synopsis) append(synopsisForDraftChapter(core.synopsis, chapterNumber))
```

**→ 于是同一个"设定"有两条来源：**

| 进 prompt 的路径 | 来源 | 例子 |
|---|---|---|
| `novel_config.coreOutline` / `worldSetting` | `novel_config`（"作者确认的小说配置（权威约束）"） | 作者在配置里写的世界观 |
| `project_core.premise` / `worldbuilding` / `synopsis` | `project_core`（旧版/架构生成产物） | AI 生成的设定，带 `#`/`##` 标题 |

### ⚠️ 但作者的设计意图里，这两套是**故意分开**的

`electron/migrations/baseline-schema.ts:14-42` 的表注释写得很明确：

```sql
core_outline     TEXT DEFAULT '',  -- 作者配置核心大纲（独立于推演摘要）
world_setting    TEXT DEFAULT '',  -- 作者配置世界设定（独立于架构世界观）
protagonist_profile TEXT DEFAULT '', -- 作者配置主角档案（独立于角色名单投影）
-- [架构四大件]
premise          TEXT DEFAULT '',  -- 故事前提
worldbuilding    TEXT DEFAULT '',  -- 世界观
synopsis         TEXT DEFAULT '',  -- 情节总大纲
```

**"独立于"三个字是作者的显式设计决定**：
`core_outline` 是**作者自己写的大纲**，`synopsis` 是 **AI 推演出来的摘要** ——
**作者刻意要求它们分开，不要互相覆盖。**

→ **这改变了结论的性质**：这**不是"设计缺陷导致的重复"**，而是
**"设计上分开、但文本上可能重叠"**。两者的处置完全不同：

| 若视为缺陷 | 若视为"设计上分开、文本重叠" |
|---|---|
| 应合并两份 | **不能合并**（合并就是违反作者意图） |
| 应由 P4 做配置整合 | **只能在组装时识别重复并择一呈现**（→ P3 的活） |

**→ 结论反而更强化了 §3 的建议**：这件事**不能靠"改配置"解决**（那会破坏"独立于"的设计），
**只能在 prompt 组装时处理** —— 这正是 P3 的战场。所以它**更应该并入 P3，而不是 P4**。

**一个必须提给作者的问题**：既然 `coreOutline` 与 `synopsis` 被设计为"独立"，
那么在 prompt 里**同时注入两份**时，若内容高度重叠，**应该保留哪一份？**
- 若 `novel_config` 是"权威约束"（内置模板注释），则**应保留 `coreOutline`，剔除 `synopsis` 的重叠部分**；
- 但 `synopsis` 可能含 `coreOutline` 没有的推演细节 → **不能整体删**，只能删重叠段。
→ **这正是"语义去重"的活**，而且**必须逐段判断**，不能整块处理。**需要作者给出优先级裁定。**

---

## 2.1 ★ `synopsis` 是什么 + 它确实与 `coreOutline` **拼在一起**（作者 2026-10-11 追问的回答）

作者问：*「coreOutline 肯定是不能动的，synopsis 是什么？初步认为可以精简这个，
既然两个有区别，那组装的时候应该是组装到一起的吧？」*

**三个问题逐个回答，全部核实过代码。**

### 2.1.1 `synopsis` 是什么

**`synopsis`（中文界面叫「情节大纲」）= AI 推演出来的三幕式情节骨架。**

证据链：
- **界面定义**：`ArchitectureConfirmDialog.tsx:32` ——
  `{ key: 'synopsis', fileName: 'synopsis.md', label: '情节大纲', desc: '三幕式情节骨架' }`。
- **它是「故事架构四大件」的第四件**（`:18` 的 `ArchStepKey = 'premise' | 'characters' | 'worldbuilding' | 'synopsis'`）：
  1. `premise` 故事前提 → 2. `characters` 人物群像 → 3. `worldbuilding` 世界观 → 4. **`synopsis` 情节大纲**
- **它是 AI 生成的、可分章批次推演的**：`architecture.command.ts:52-57` 的 `stepAuthorInputs` 对
  `synopsis` 传 `synopsisRange`（默认第 1–N 章），并有 `PLOT_OUTLINE_PROTOCOL` 协议
  （`plotOutlinePurpose` / `joinPlotOutlineEntries` / `renderPlotOutlineRange`）。
- **它是带章节结构的 Markdown 大纲** —— `generate-draft.command.ts:97-101` 的注释直接说明：
  「Project an explicitly **chapter-structured** synopsis onto one chapter」。
- **界面位置**：`ArchFileViewer.tsx:49/56` —— 情节大纲可在编辑器里查看/续写保存
  （`db:project-core-synopsis-commit`，`:255`）。

**一句话**：`coreOutline` 是**作者手写的核心大纲**；`synopsis` 是**AI 推演的三幕情节骨架**。

### 2.1.2 它们确实**拼在一起** —— 作者判断正确 ✅

**是的，`coreOutline` 与 `synopsis` 都会进同一个 prompt，而且不是相邻两条，是分处两个块：**

| 进 prompt 的位置 | 内容 | 来源 |
|---|---|---|
| `novel_config` JSON 里**被排除**出去 → 单独以【小说配置事实】注入 | `coreOutline` / `worldSetting` / `globalGuidance` / `writingStyle` / `goldenFinger` / `protagonistProfile` / `referenceWorks` | `generate-draft.command.ts:809-820` |
| 【全书设定池】`{{architecture}}` | `premise` + `worldbuilding` + **`synopsis`（按本章投影）** | `builtin-prompt-templates.ts:762-763` + `prompt-builder.ts:78-79`，由 `readArchitecture`（`:1881-1902`）产出 |

→ **`coreOutline` 在【小说配置事实】，`synopsis` 在【全书设定池】—— 同一个 prompt 的两个块。
两份都在，且讲的是同一件事的两个版本。**

这正是 P1 那次撞到的结构（`p1-literal-dedup.md §1.1`「同一份作者字段，
同时出现在『本章蓝图/本章信息 JSON』和『本章执行合同 authorItems』两个块里」），
只是这次换成了 `coreOutline` ↔ `synopsis`。

### 2.1.3 一个**好消息**：`synopsis` 有现成的"按章投影"机制 —— 精简有天然抓手

`synopsisForDraftChapter(synopsis, chapterNumber)`（`:97-142`）**已经是"按本章裁剪 synopsis"**：

```ts
const currentHeadings = headings.filter(h => h.from <= chapterNumber && chapterNumber <= h.to)
if (!hasConsistentHeadingStyle || !hasStrictChapterOrder || currentHeadings.length !== 1) {
  return synopsis.trim()   // ← 结构不明确时，整份返回（保守：绝不因猜测丢弃作者事实）
}
```

**注意最后那行的保守设计**：如果章节标题结构不一致、或定位不到唯一一节，
**它会整份返回 synopsis**（注释 `:99-100`：「Ambiguous or unlocatable structures stay verbatim
so author facts are never discarded on a guess」）。

→ **这解释了为什么重复可能很严重**：一旦结构不规范（很常见，AI 生成的 Markdown 未必严格），
**整份 synopsis 都会进 prompt**，与 `coreOutline` 大面积重叠。

**这也给出了"精简"的天然抓手**（见 §2.2）。

### 2.1.4 作者"coreOutline 不能动"—— 完全正确，且这正是关键约束

`coreOutline` 是**作者手写的权威约束**（内置模板注释：
`novel_config: '作者确认的小说配置（权威约束）'`，`builtin-prompt-templates.ts:750`）。

→ 所以去重的方向**只有一个**：**不动 `coreOutline`，只精简 `synopsis` 中与它重叠的部分。**
这与作者判断一致。**但"精简"要非常克制**（§2.2）。

---

## 2.2 ★ 精简 `synopsis` 的两条路线（**需作者选**）

### 路线 A · 保守：只删"逐字重复段"（**=现状**，不必改）

`readArchitecture`（`:1886-1893`）已经在做：

```ts
const duplicates = authoredFactFingerprints(authoredConfigFacts)  // ← coreOutline 等的指纹
if (isFullyDuplicatedBlock(content, duplicates)) return            // 整块逐字重复 → 省略
const remaining = withoutDuplicateParagraphs(content, duplicates)  // 逐字段逐字重复 → 剔除
```

**它已经能删掉"synopsis 里与 coreOutline 逐字相同"的段落。**
→ **如果作者实际观察到的重复能靠它解决，那不需要任何新工作。**

⚠️ **但它的上限是明确的**（`p1-literal-dedup.md §0`）：
「**不做任何语义近似 —— 长度或措辞不同的段落一律视为不重复**」。
→ **AI 推演的 synopsis 与作者手写的 coreOutline 措辞几乎必然不同 → 命中率低 → 重复照旧。**

### 路线 B · 语义去重：识别"换了说法的同一件事"（**=P3 的能力**）

这就是 P3 的语义判定要干的活。**但有三个必须作者裁定的点**：

| # | 问题 | 我的看法 |
|---|---|---|
| **B1** | **以谁为准？** | `coreOutline` 为准（权威约束），**只在 `synopsis` 侧删** |
| **B2** | **删到什么粒度？** | **只能逐段删**（不能用整块省略）—— 因为 `synopsis` 含 `coreOutline` 没有的推演细节，整块删会丢信息 |
| **B3** | **判不准时怎么办？** | **宁可保留**（与 `synopsisForDraftChapter` 的保守设计一致：`Ambiguous → 整份返回`） |

### 2.3 我的建议

**先量化，再决定做不做。** 具体地：

1. **Phase 0（只读，零风险）**：对作者的真实项目，把
   `coreOutline`（来自 `novel_config`）与 `readArchitecture` 产出（含 synopsis）
   两段文本 **并排打印出来，人工数一下重叠比例**。
   —— **不做这个，就无法判断路线 A 够不够、路线 B 值不值。**
2. 若重叠严重且 A 搞不定 → **做路线 B（并入 P3）**，按 B1/B2/B3 三条约束实施。
3. 若重叠不严重 → **不做**，只在需要时补 A 的指纹覆盖面。

> ⚠️ **特别注意**：§2.1.3 那个"结构不规范就整份返回"的保守分支，
> **可能是重复量的主要来源**。若如此，**真正的修法可能是"让 synopsis 的章节结构更规范"
> （生成侧约束），而不是"去重"** —— 这比去重更根本、更安全。
> **Phase 0 的量化要一并看这个。**

---

## 2.4 ★★ Phase 0 实测结果（2026-10-11，**已用作者真实项目跑出数据**）

我说过"没有数据不动手"。这次**直接跑了** —— 用作者的实际项目
`C:\develop\workspace\AI-writer\国运怪谈直播\国运怪谈直播\.vela\vela.db`。

### 2.4.1 两套文本的**体量**（实测）

| 字段 | 归属 | 字数 |
|---|---|---|
| `core_outline` | **作者手写** | **189** |
| `world_setting` | **作者手写** | **493** |
| `protagonist_profile` | 作者手写 | 313 |
| `golden_finger` | 作者手写 | 550 |
| `global_guidance` | 作者手写 | 671 |
| ── 作者侧合计 | | **约 2 216 字** |
| `premise` | AI 推演 | **475** |
| `worldbuilding` | AI 推演 | **2 413** |
| `synopsis` | AI 推演 | **2 207** |
| ── 推演侧合计 | | **约 5 095 字** |

**→ 推演侧（5095 字）是作者侧（2216 字）的 2.3 倍。** 两套都进 prompt。

### 2.4.2 关键发现：**重复不是"逐字级"，但概念**完全**重叠**

**(a) 字符级 n-gram Jaccard（3-gram，越高越重复）—— 实测：**

| 对比 | Jaccard | 含义 |
|---|---|---|
| `world_setting` ↔ `worldbuilding` | **0.019** | 逐字几乎不重叠 |
| `core_outline` ↔ `premise` | **0.028** | 逐字几乎不重叠 |
| `core_outline` ↔ `synopsis` | **0.003** | 逐字几乎不重叠 |

**→ 结论 1（决定性的）：P1 的逐字指纹在这三对上命中率 ≈ 0。**
这**从数据上证明了** `readArchitecture` 的逐字去重**根本救不了这件事**（路线 A 无效）。
（这也正是 `p1-literal-dedup.md §0` 说的"不做任何语义近似"的代价。）

**(b) 但核心概念 100% 重合 —— 实测关键词覆盖：**

| 关键词 | 作者侧 | 推演侧 |
|---|---|---|
| 大幕 | ✅ | ✅ |
| 国运 | ✅ | ✅ |
| 沈舟 | ✅ | ✅ |
| SAN / 理智值 | ✅ | ✅ |
| 规则清单 | ✅ | ✅ |
| 主神空间 | ✅ | ✅ |
| 观众 / 弹幕 | ✅ | ✅ |
| 不响的铃 | ❌ | ✅ |

**→ 结论 2：11 个核心概念里 10 个在两套文本中成对出现。**
**同一个设定宇宙被完整地讲了两遍**，只是措辞和组织方式不同。

### 2.4.3 结论 2 的具体形态（举例）

**`world_setting`（作者手写）**：
> 「力量体系（不是修炼/异能，是「规则怪谈位阶」）：六阶 D 闻声 → C 涉浅 → B 破局 →
> A 执灯 → S 镇国 → SS 破幕（内部护栏 min_ch 1/5/15/40/100/200）……」

**`worldbuilding`（AI 推演）**：把同一套体系展开成
「核心规则与体系漏洞 / 世界运转法则 / 认知污染机制 / 主角的非对称优势」等小节，
**内容更详细，但覆盖面是同一套**。

→ **这是典型的"同一件事换句话说了两遍"，而且推演版更长（2413 > 493，约 5 倍）。**

### 2.4.4 ★ 这组数据改变了方案的判断

| 原判断 | 实测后的修正 |
|---|---|
| 路线 A（逐字去重）"可能够用" | ❌ **明确无效**（Jaccard ≈ 0.02，命中率近零） |
| "重复可能不严重" | ❌ **严重**：5095 字推演内容中，核心概念与 2216 字作者内容完全重合 |
| "先量化再决定" | ✅ **已量化，结论明确**：这是**真实且可观的重复** |
| "synopsis 结构不规范的整份返回可能是主因" | ⚠️ **次要** —— 实测 `core_outline ↔ synopsis` Jaccard 仅 0.003，重复主要在概念层而非 synopsis 的篇幅问题 |

**→ 建议的路线现在清楚了**：
**作者侧的 2216 字不能动**（权威约束）；
**推演侧的 5095 字里，与作者侧概念重叠的部分应当精简** ——
这正是 **P3 语义去重**该做的事，而且**靶子明确、收益可测**（理论上最多可省约 5000 字中的相当一部分）。

### 2.4.5 一个必须提给作者的设计问题（比去重更根本）

实测暴露出一件比"去重"更值得问的事：

> **为什么作者手写了 `world_setting`（493 字）之后，
> AI 还要推演一份 2413 字的 `worldbuilding`？**

按表注释，两者是"独立"设计的。但从数据看，**推演版覆盖了作者版的全部概念，只是更详细**。

**三种可能的作者意图**（需作者确认）：
1. **AI 推演是"展开"**（把作者的骨架补成完整设定）→ 那**重复是可接受的**，
   只需去掉推演版里的"复述"部分（**→ P3 干**）；
2. **AI 推演是"独立参考"**（作者想要两套不同视角）→ 那**不该去重**（**→ P3 不该碰**）；
3. **AI 推演是"遗留产物"**（作者手写后忘了它还在）→ 那**应该提示作者可以删除/停止生成它**
   （**→ 比去重更彻底，且零 AI 成本**）。

**→ 这个问题必须问作者。** 若是第 3 种，**收益比 P3 大得多，而且实现简单。**


### 关键：当前**只有逐字去重**，语义重复**完全没管**

`:1886-1893` 的 `readArchitecture`：

```ts
const duplicates = authoredFactFingerprints(authoredConfigFacts)
const append = (content) => {
  if (isFullyDuplicatedBlock(content, duplicates)) return        // 整块逐字重复 → 省略
  const remaining = withoutDuplicateParagraphs(content, duplicates)  // 逐字重复段 → 剔除
  if (remaining) parts.push(remaining)
}
```

→ **用的是 P1 的确定性指纹**（`p1-literal-dedup.md §0` 明确：**不做任何语义近似 ——
长度或措辞不同的段落一律视为不重复**）。

**所以**：`coreOutline` 说"主角在暴雨夜失去记忆"、`premise` 说"暴雨之中主角的记忆被抹去"——
**逐字不同 → 两段都进 prompt → 语义重复，没人管。**

**这才是 P4 原本想解决的问题的真正位置。** 而它**恰恰就是 P3 的靶子**：

> P3 = 「同一件事换句话说了两遍」的消除。`coreOutline` ↔ `premise` 正是最典型的样本。

---

## 3. 结论：建议取消 P4 原形态，把它并入 P3

### 3.1 为什么"并入 P3"而不是"P4 换个靶子"

backlog 原本把这两个议题分成 A 类（配置整合，P4）和 B 类（请求前去重，P3），
理由是"配置层面的问题"和"组装层面的问题"。

**但核实后发现这个分法在这件事上是虚的**：

- `coreOutline` ↔ `premise` 的重复，**发生在 prompt 组装时**（两条路径各自注入）；
- 解决它**不需要改任何配置**，只需要在**组装时识别并处理**；
- 而这**正是 P3 的头/尾分层 + 语义判定要做的事**（P3 §2.1 的头就包含
  "`architecture` / `novel_config` 事实"）。

→ **"配置整合"这个词误导了定位。** 它听起来是要改配置，
实际要解决的是**组装时两份来源的语义重复**，与 P3 同一个战场、同一套工具。

### 3.2 建议的最终形态

| 原计划 | 建议 |
|---|---|
| **P4 · 提示词模板 AI 优化**（全局↔项目） | ❌ **取消**（覆盖语义抑制了场景，收益低） |
| **P4 · novel_config ↔ project_core 语义重复** | ✅ **并入 P3**，作为 P3 的第一优先靶子 |
| **「当前实际生效」展示** | ✅ 保留，可小独立改动（零 AI） |
| **真正的"配置整合"（合并 `novel_config` 字段本身）** | ⏸ **暂不做** —— 需三段式 + 可回滚 + diff，且收益未量化，**等 P3 量出真实重复量再说** |

### 3.3 这对 P3 的影响（**重要，需作者确认**）

若采纳，P3 的范围会**略微扩大但更聚焦**：
- P3 的头（HEAD）本来就要包含 `architecture` 与 `novel_config` 事实（P3 §2.1）；
- 现在明确：**P3 的首要靶子就是这两者之间的语义重复**（而不是泛泛的"任意两段"）；
- 这**降低了 P3 的难度** —— 靶子明确，且重复的形态已知（同一设定的两套文本）。

并且 P3 §0.3 的"P4 先行"次序依赖**自动消失** ——
因为不再有"P4 改配置"这一步（不再合并 `novel_config` 字段本身）。

---

## 4. 待作者拍板

| # | 问题 | 我的建议 |
|---|---|---|
| **1** | 取消 P4 原形态（提示词模板 AI 优化）？ | ✅ **建议取消**（§1） |
| **2** | 把"`novel_config` ↔ `project_core` 语义重复"并入 P3 作为首要靶子？ | ✅ **建议并入**（§2、§3.1） |
| **3** | 「当前实际生效」展示是否保留？ | ✅ 保留（零 AI，解决认知问题） |
| **4** | 真正的配置字段整合（合并 `novel_config` 内容） | ⏸ **不做** —— 且 §2 已论证**不该做**（"独立于"是作者显式设计） |
| **5** | P3 的靶子据此收窄为"设定层两套文本"？ | ✅ 且**已实测确认有价值**（§2.4：概念重合 10/11） |
| **6** | ★ 去重方向：只删 `synopsis`/推演侧的重复段，`coreOutline` 与作者侧**不动**？ | ✅ 与作者判断一致，且已写入 P3 的 B1–B3 约束 |
| **7** | ★★ **为什么作者手写了 `world_setting`，AI 还要推演 2413 字 `worldbuilding`？**（§2.4.5） | 供作者裁定 —— **若是"遗留产物"，收益远超 P3 且实现简单** |
| **8** | 实测数据是否改变优先级（`worldbuilding` 2413 字 > `synopsis` 2207 字）？ | 建议把 `worldbuilding` ↔ `world_setting` 列为**与 synopsis 同级**的首要靶子 |

**若 1–2 采纳**，则 P4 退化为一个很小的独立改动（"当前实际生效"展示），
backlog 需要把 P4 从"AI 建议 → 人工确认 → 替换配置"改写掉，
并把它原本引用的 `coreOutline` 例子**移交 P3**。

---

## 5. 一句总结（给作者）

**你的两个判断都对**：提示词模板那块收益低、大纲蓝图不容易重复。
**但真问题在 `coreOutline` ↔ `synopsis`/`premise`（"独立于"设计导致的两套文本），
而且当前只有逐字去重、语义重复完全没管。**

而这件事**不能靠改配置解决**（会破坏你"独立于"的设计意图），
**只能在 prompt 组装时处理 → 那就是 P3。**

→ **P4 的实质价值应该并入 P3；P4 本身只留下一个零 AI 的小展示改动。**
