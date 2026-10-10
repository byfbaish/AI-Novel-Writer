# P1 设计稿（v2）· Prompt 组装中的**逐字重复**消除

> 目标读者：作者（审阅者）。本稿只做**设计与证据**，不含实现。
> 依据：`generate-draft.command.ts`、`chapter-materials.ts`、`generation-harness.ts`、`builtin-prompt-templates.ts`（dev_byf 当前状态）。
> v1 稿（`p1-user-guidance-split.md`）的前提已被推翻，本稿取代之。

## 0.0 一句话结论（含对作者提问的回答）

- **本方案解决的是「同一轮请求内部」的逐字重复**，能把每轮从「同一份资料装 2 遍」压到「1 遍」。
- **它解决不了「多轮之间」的重复**——因为每次请求都是**无状态的全量发送**，
  续写不是 conversation turn，而是独立 HTTP 请求，必须自包含。这是架构决定的，收敛组装层无能为力。
  → 多轮成本已拆为独立议题 **P1-B（§3.4）**，先埋点收数据，不猜。
- 收益仍然是**乘数级**的：轮数越多，每一轮省下的那「1 遍」被省下的次数就越多。

---

## 0. 先对齐定义：什么算「真正的重复」

按你的界定，本方案**只处理逐字/近乎逐字的重复**，即：同一段作者原文或同一段规则文本，在**单次请求**里被装进多个位置。
**不处理**语义重复（`coreOutline` ↔ `premise` 那种「意思重叠但措辞不同」）——那属于第 7/8 项。

判定口径（可写成断言）：
- **计入**：同一字符串（或仅空白/标点/序列化格式不同）在同一请求的消息里出现 ≥2 次。
- **不计入**：语义相同但经过改写、缩写、结构化的内容。

---

## 1. 我实测到的重复清单（按收益排序）

我按上面口径把单次请求的消息逐段量了一遍。结果**比 `user_guidance` 那三条严重得多**：

| # | 重复内容 | 出现在哪几处 | 严重度 |
|---|---|---|---|
| **D1** | **`chapterMaterials.text` 整体** | ①初始请求 `composeInitialPrompt`；②**每一次续写** `draftAuthorMaterialBlock` 里（`:1533`）；③**压缩修订**（`:1721`） | ★★★★★ |
| **D2** | **`architecture` + `【作者资料】`** | ①`template.content` 的 `【全书设定池】{{architecture}}`；②`chapterMaterials.text` 的 `【作者资料…】` 段（`chapter-materials.ts:517-524`） | ★★★★☆ |
| **D3** | **`globalGuidance`** | ①`template.content` 的 `【全局写作要求】`；②`draftAuthorMaterialBlock` 的 `【全局写作要求】`（:527/:546） | ★★★★☆ |
| **D4** | **`writingStyle` + 文风适用边界** | ①`template.content` 的 `【文风要求（如有）】` + `systemSuffix` 的 `【文风适用边界】`；②`draftAuthorMaterialBlock` 的同样两段 | ★★★☆☆ |
| **D5** | **`novelConfigFacts`（novel_config JSON）** | ①`template.content` 的 `【小说配置事实】`（`draftAuthorMaterialBlock`）；②`systemSuffix` 的 `【不可偏离的作者事实】- 小说配置：{{novel_config}}` | ★★★☆☆ |
| **D6** | **`user_guidance`** | ①`system` 尾部 ★额外指导★；②`【本章信息】` JSON；③`【本章执行合同】` 的 `- 作者本章指导:` 行 | ★★☆☆☆ |
| **D7** | **`chapterLengthContract`** | 续写/压缩 prompt 内嵌一份，`composeInitialPrompt` 末尾又追加一份 | ★★☆☆☆ |

> **D1 是真正的大头，也是我在 v1 稿里完全没看到的。**

### 1.0 Phase 0 实测结果（2026-10-10，已固化为断言）

用 `generate-draft.command.test.ts` 的 `P1 Phase 0 · literal duplication counts` 逐字计数，**实测值**：

| 断言 | 场景 | 实测 | 说明 |
|---|---|---|---|
| **D1** | 同一作者字段（`keyEvents`）在**初始请求**内出现次数 | **2** | 比设计预期更严重：初始请求也重复 |
| **D1** | 同一作者字段在**续写请求**内出现次数 | **2** | 与设计稿一致 |
| **D3** | `globalGuidance` 在**续写请求**内出现次数 | **1** | 实际没有重复（续写 system 不含它） |
| **D7** | `【本章篇幅合同】` 在**续写请求**内出现次数 | **1** | 实际没有重复（system rules 里没有） |

**结论修正**：D3 与 D7 经实测**并不重复**，可以从「待修清单」里移除（降为护栏断言）。
真正的重复只有 **D1（两处请求各 2 次）**，以及初始请求内 `chapterMaterials.text` 与 `template` 的重叠（D2/D4/D5，由既有 `readArchitecture` 去重覆盖了一部分）。

### 1.1 D1 的**真实身份**（经代码定位，与设计稿措辞不同）

设计稿把 D1 描述为「`chapterMaterials.text` 整体被装两遍」。代码定位后，更精确的表述是：

> **同一份作者字段，同时出现在「本章蓝图/本章信息 JSON」和「本章执行合同 authorItems」两个块里。**

证据（`generate-draft.command.ts`）：
- 初始请求：`composeInitialPrompt` = `[chapterMaterials.text, promptBuilder.build(), …, chapterExecutionContract.authorItems, …]`；
  而 `promptBuilder.build()` 已含 `【本章信息】{{chapter_info}}`（= `JSON.stringify(writerChapterInfo)`，内含 `keyEvents`），
  末尾**又追加** `authorItems`（`- 必需事件: ${keyEvents}`）→ 同一字段 2 次。
- 续写请求：`draftAuthorMaterialBlock` 开头 `【本章蓝图】${JSON.stringify(chapterInfo)}`，
  结尾**又拼** `chapterExecutionContractText(...).authorItems` → 同一字段 2 次。
- 压缩请求：同续写（共用 `draftAuthorMaterialBlock`）。

**这才是 Phase 1 要对准的靶子**：不是「删掉 chapterMaterials」，而是
**让「蓝图 JSON」与「执行合同 authorItems」二选一承担作者字段的呈现**（或让 authorItems 只保留 JSON 里没有的语义包装）。


### 1.2 D1 的机制（最关键的发现）

初始请求的组装（`:927-930`）：

```ts
composeInitialPrompt = [
  chapterMaterials.text,        // ← 【作者资料】+【后续计划边界】+【有来源的历史与候选】
  promptBuilder.build(),        // ← template.content 渲染结果（含【全书设定池】等）
  reconciliationBlock,
  chapterExecutionContract.authorItems,
  chapterLengthContract,
].join('\n\n')
```

续写请求的组装（`:1533-1568`）：

```ts
authorMaterial = draftAuthorMaterialBlock(params)   // ← params.chapterMaterials = chapterMaterials.text
continuationPrompt = `${hardRequirements}\n\n${lengthContract}\n\n${authorMaterial}\n\n【本章已写正文全文】${draft}`
```

**`params.chapterMaterials` 一路透传**（`:1190`、`:1213` → `extendDraftIfNeeded` / `condenseDraftIfNeeded`），
所以 `chapterMaterials.text`（内含**全书作者资料原文 + 定稿原文片段**）在**初始请求装一遍、每次续写再各装一遍**。

**最坏情况**：一章被截断 → 续写 7 轮（`shouldAutoContinue` 上限）+ 1 次压缩 = **同一份作者资料块被重复发送 8 次**。
每次都是几 KB 到几十 KB。这不是「省一点」，这是**成倍的输入费用**。

---

## 2. 为什么会产生这些重复

根因是**两套组装路径并存**：

| 路径 | 位置 | 用途 |
|---|---|---|
| **A · 模板路径** | `promptBuilder.build()`（`template.content` + `systemSuffix`） | 只用于**初始请求** |
| **B · 手工拼接路径** | `draftAuthorMaterialBlock()` | 用于**续写**和**压缩修订** |

路径 B 是为了让续写/压缩「自包含」而独立拼了一套作者资料块（`【本章蓝图】【全局写作要求】【文风要求】【小说配置事实】…`），
**但它拼的内容与路径 A 的 `template.content` 高度重叠**——而且 B 还把 `chapterMaterials.text` 整个又装了一遍。

同时初始请求自己也有内部重复：`composeInitialPrompt` 把 `chapterMaterials.text` 和 `promptBuilder.build()`
**并排拼接**，而这两者内容重叠（D2–D5）。

**一句话**：`【全书设定池】`、`【作者资料】`、`chapterMaterials` 三者的边界从来没有被定义过，于是各自装各自的，谁都不知道别人已经装了什么。

---

## 3. 方案设计

### 3.1 总原则：确立「单次请求内每份内容只装一次」的不变量

> **不变量 I1**：任一作者原文 / 任一规则文本，在**单次请求**（system + user 两条消息合计）里逐字出现 **恰好 1 次**。
>
> **不变量 I2**：续写 / 压缩等后续请求**复用初始请求已确立的内容，只增补本轮真正新增的部分**（新增正文、本轮篇幅指令）。

### 3.2 实施分阶段（Phase 0 已完成；1/2 待做）

> ⚠️ 下方「步骤 1/2/3」是 v2 稿的原表述，**已被 Phase 0 实测修正**（见 §1.0/§1.1）。
> 实际要做的是 **Phase 1**（下面 3.2.1）与 **Phase 2**（3.2.3），原文保留作历史对照。

#### 3.2.1 ★ Phase 1（✅ 已完成 2026-10-10）· 消除「蓝图 JSON ↔ 执行合同 authorItems」的作者字段重复

**问题（Phase 0 实测，D1）**：同一份作者字段在同一轮请求里出现 **2** 次。

**两处来源（代码定位）**：
| 位置 | 初始请求 | 续写/压缩请求 |
|---|---|---|
| 蓝图 JSON | `template.content` 的 `【本章信息】{{chapter_info}}`（=`JSON.stringify(writerChapterInfo)`） | `draftAuthorMaterialBlock` 的 `【本章蓝图】${JSON.stringify(chapterInfo)}` |
| 执行合同 | `composeInitialPrompt` 末尾追加 `chapterExecutionContract.authorItems`（`- 必需事件/章节钩子/作者本章指导`） | `draftAuthorMaterialBlock` 末尾拼同一份 `authorItems` |

**为什么 `authorItems` 不能直接删**（护栏测试 `retains all three author fields … when a custom draft template omits chapter_info`）：
它是**自定义模板把 `{{chapter_info}}` 去掉时的兜底**——那时作者三个字段就只剩这一处呈现。

**实现（条件化，非删除）**：新增 `templateRendersChapterInfo(template)` 判断生效模板的
`content / systemSuffix / taskGuidance` 是否含 `{{chapter_info}}` 占位符；
含则**不注入** `authorItems`（消掉 D1 的第二次），不含则照旧注入（兜底不变）。
初始、续写、压缩三处统一走同一判定。

- ✅ 生效模板 = 内置 `first/next_chapter_draft` → 不注入兜底；
- ✅ 生效模板 = 删掉 `{{chapter_info}}` 的自定义模板 → 仍注入兜底（两条护栏测试继续通过）。

**实测收益（同 fixture，作者字段按真实体量放大）**：

| 请求 | Phase 1 前 | Phase 1 后 | 降幅 |
|---|---|---|---|
| 初始请求 | 7711 字符 | 5401 字符 | **−30.0%** |
| 续写请求 | 6396 字符 | 4088 字符 | **−36.1%** |
| 作者字段出现次数（每轮） | 2 | **1** | — |

> ⚠️ 降幅**随作者字段体量放大而增大**（作者字段越长，省下的越多）。
> 上面是「三字段各重复 30 遍」的构造；真实章节的降幅取决于作者在该章的 keyEvents/钩子/指导篇幅。
> 原文里「目标 >50%」的验收线是 v2 稿基于**错误前提**（以为 chapterMaterials 整体装两遍）估的，**此处按实测修正**。

**风险**：低——改动面是「是否追加一个字符串」，未触碰 `chapter-materials.ts` 构成与 hash。
**验收**：Phase 0 D1 断言已从 `{2,2}` 改为 `{1,1}` 并通过；新增 `does not duplicate author fields when the builtin template already renders chapter_info` 直接锁定不变量。

#### 3.2.2 步骤 1 原文（保留作对照）· 消除初始请求内部的并排重复（D2–D5）

**问题**：`chapterMaterials.text` 与 `promptBuilder.build()` 并排拼接，内容重叠。

**做法**：明确分工——**`template.content` 负责「写作指令与设定池」，`chapterMaterials.text` 只负责「它独有的部分」**。
具体地：
- `chapterMaterials.text` 目前含 3 段：`【作者资料…】`（D2）、`【后续计划边界】`、`【有来源的历史与候选】`。
- 其中 `【作者资料…】` 的 `authorFacts` 部分与 `【全书设定池】`（architecture）和 `【小说配置事实】`（novelConfigFacts）重叠 → **移除或改写为引用**。
- 保留其独有部分：`characterProfiles`（角色档案）、`futurePlans`（后续计划边界）、`【有来源的历史与候选】`（定稿原文片段）。

**预期收益**：初始请求减少一整份作者资料。**这是最大的一块。**
**风险**：中。`chapter-materials.ts` 的 `decision` / `omissions` / 容量准入（S07）都依赖这段文本的存在与 hash，
移除会触碰 `materialDecision.promptHash` 与覆盖缺口日志。**必须保 hash 稳定或同步更新。**

#### 3.2.3 步骤 2 原文（保留作对照）· 统一续写/压缩的作者资料来源

**问题**：续写/压缩用路径 B 重新拼一套（`draftAuthorMaterialBlock`）。

**做法**：改为**复用**，不再重拼。方向上已由 §3.2.1 收敛为「条件化 authorItems」——
注意：`draftAuthorMaterialBlock` 里的 `【本章蓝图】/【全局写作要求】/【文风要求】/【小说配置事实】` 各一份，
**它们在续写轮内并未与别的块重复**（Phase 0 实测 D3/D7 均为 1），所以**不需要**在这一轮删它们。
唯一重复的是 `authorItems`。

**风险**：低。**不需要**为了「少装一份资料」而让续写失去自包含性。

#### 3.2.4 步骤 3 · 收尾（D6；D7 经实测无需处理）

- **D6**：`user_guidance` 目前出现 3 处（`system` 尾部 ★额外指导★ / `【本章信息】` JSON / `authorItems` 的 `- 作者本章指导:`）。
  Phase 1 消掉 `authorItems` 那份后会降到 2 处，是否继续收敛到 1 处（去掉 `【本章信息】` JSON 里的）**待 Phase 1 后再评估**。
- **D7**：Phase 0 实测续写轮内 `【本章篇幅合同】` 仅 1 次 → **无需处理**，已降为护栏断言。


### 3.2.5 ★ 对「收敛组装层能否解决多轮成倍增长」的回答（作者提问，结论有更正）

作者问：*「可能会有多轮请求，Prompt 会成倍增加。那收敛组装层能否很好地解决这个问题呢？
还是说只能解决单次请求内的组装重复问题？」*

**答：只靠「收敛组装层」解决不了跨请求的成倍增长。但成倍增长本身另有原因，且那个原因可以单独解决。**

我读了 harness 的请求路径（`generation-harness.ts:598-620`、`:613`），确认三个事实：

**事实 1 · 每次请求都是无状态的全量发送。**
`GenerationTask.messages`（`:17-33`）每次都是完整数组，harness 直接 `messages: task.messages`（`:613`）
发给 provider。**不存在「把上一轮对话追加进去」的机制** —— 续写不是 conversation turn，是**独立的一次 HTTP 请求**，
自己带全 system + 全 user。

**事实 2 · 所以「成倍」的机制是：每一轮都重发它在本地重建的全部内容。**
不是 prompt 被 server 侧累积，而是**客户端每轮重新组装一遍**。轮数越多，重复装载的次数越多。
这确实**不是**「单次请求内」的问题，收敛组装层无法消除它。

**事实 3 · 真正能把多轮成本压下来的是「按轮数只发增量」，不是「收敛组装层」。**
但当前架构**做不到纯增量**，因为无状态 —— 每轮必须自包含。要真正变成增量，只有两条路：

| 路线 | 能否解决多轮成倍 | 代价 |
|---|---|---|
| 收敛组装层（本方案） | **不能**。只让「每一轮自身」不重复 | 低 |
| provider 上下文缓存（prompt caching） | **能**，但**依赖 provider** | 中；且需验证各家行为 |
| 真正的多轮 conversation（把历史拼进 messages） | **能**，但**上下文会越滚越大**，反而更贵 | 高 |
| **减少轮数**（每轮多产出，降低触发续写的概率） | **能**，且**最直接** | 低 |

**结论与策略调整**：
1. **不变量 I1（单次请求内不重复）仍是必需的**——它把「每一轮」从「8 份资料」压到「1 份资料」，
   多轮场景下收益是**乘数级**放在每一轮上。这是本方案的确定收益，**照做**。
2. **不变量 I2 需要重新定义**：它不是「续写只发增量」（架构不支持，做不到），
   而是「**续写/压缩的每一轮自身，都满足 I1**」——即不再出现 `chapterMaterials.text` 在同一轮里装两遍。
3. **多轮成倍的根因要单独立项**：见下方 §3.4「P1-B · 降低轮数」。

### 3.4 P1-B · 多轮成本（从 I1 拆出的独立议题）

**这是 P1 的第二个子问题，与 I1 正交。**

现状：`shouldAutoContinue`（`:1498`）的续写上限是 **7 轮**（另有 1 次 no-progress recovery 与 1 次压缩）。
每轮都全量重发。所以一次「不顺的」章节生成 = **最多约 9 次全量请求**。

**可攻的方向**（按性价比）：
1. **降低续写触发概率**（收益最高、风险最低）：续写之所以发生，是模型输出被 `length` 截断。
   若首轮就能给出足够额度，或把目标字数与模型输出上限对齐，可显著减少轮数。
   —— 这是**配置/预算策略**问题，不是 prompt 组装问题。
2. **量化现状**：先统计真实项目里「平均续写轮数」，才知道值不值得动。**没有数据不动手。**
3. 上下文缓存：正交议题，若 provider 支持可再评估。

**建议**：P1 只做 I1（本轮），P1-B 先**加统计埋点**（记录每次生成的轮数与各轮 input 体积），
积累数据后再决定是否立项。**不要在没有数据前猜。**

### 3.5 关于「依赖 provider 缓存」的明确立场

我在 v2 稿里推荐「保守」，但理由需要更正：
- **不是因为激进方案有风险**，而是因为**激进方案在当前架构下根本不成立**——
  无状态 + 每轮全量，压根没有「只发增量而不依赖 provider 缓存」的实现空间。
- 若将来要利用缓存，那是**独立议题**（需要 provider 支持 + 验证命中率），不属于 P1。


#### 步骤 3 · 收尾（D6 + D7）

- **D6**：按 v1 稿方案，`user_guidance` 收敛到 `system` 尾部唯一一处（`toWriterChapterInfo` 去掉该字段；
  `chapterExecutionContractText` 的 `executionItems` 去掉 `作者本章指导`；用「收紧 rules 措辞」保住约束链）。
- **D7**：`chapterLengthContract` 在续写/压缩 prompt 内已有一份，检查 `composeInitialPrompt` 末尾那份是否需要（初始请求需要，续写不需要）。

### 3.3 架构选择（已由作者确认，理由已更正）

| | 保守 | 激进 |
|---|---|---|
| 做法 | 收敛组装层，续写仍自包含但去重 | 依赖上下文缓存，续写只发增量 |
| 收益 | 确定、可验证 | 更高（若缓存命中） |
| **可行性** | **可行** | **当前架构下不成立**（无状态 + 每轮全量，没有「只发增量」的空间） |
| 适配 | 任何 provider | 需 provider 支持 prompt caching |

**作者已确认走保守**。但理由更正为：不是「激进有风险」，而是**激进在当前架构下根本做不到**（见 §3.2.5）。

---

## 4. 验收标准

1. **逐字计数断言**（核心）：构造一个含作者资料、架构、文风的用例，跑完初始 + 1 次续写 + 1 次压缩，
   对每份作者原文做 `match(/片段/g)`，**每一次请求内均为 1**。
   ✅ **Phase 0 落地、Phase 1 达标**：`generate-draft.command.test.ts` 的 `P1 Phase 0 · literal duplication counts`
   四条断言，D1 已从 `{2,2}` 收敛为 `{1,1}`；D3/D7 实测本就为 1（降为护栏）。
   ⚠️ 注意口径是「**每次请求内**为 1」，**不是「整次生成内为 1」** —— 多轮之间重复发送是架构决定的，
   I1 不承诺消除它（见 §3.2.5）。
2. `chapterMaterials.text` 在同一轮请求内不再重复出现（初始请求内不再与 `promptBuilder.build()` 并排重复）。
   ✅ Phase 1 已消掉重复的作者字段重列；`chapterMaterials` 与 `template` 的**语义级**重叠属 Phase 2/后续。
3. 续写请求的 system 仍含 `novel_config` 与执行合同 rules（约束链不丢）。 ✅ 未触碰。
4. 全部既有测试通过；失败集与基线逐条 diff 一致。 ✅ 18/18 与基线一致，0 真回归。
5. `tsc --noEmit` EXIT=0。 ✅
6. **量化对比**：单轮体积下降 —— 实测 **初始 −30.0% / 续写 −36.1%**（作者字段按真实体量放大）。
   ⚠️ v2 稿的「>50%」是基于**错误前提**（以为 chapterMaterials 整体装两遍）估的，按实测修正；
   降幅随作者字段长度放大，越长的章节收益越大。

---

## 5. 工作量与风险

- **主改**：`generate-draft.command.ts`（`composeInitialPrompt`、`draftAuthorMaterialBlock`、`extendDraftIfNeeded`、`condenseDraftIfNeeded` 的传参）；
  `chapter-materials.ts`（若走步骤 1 需改 `required` 段构成）。
- **测试影响**：`generate-draft.command.test.ts` 中与 `【作者资料】`、`【全局写作要求】`、
  `(no additional author material)`、`[Sourced history and candidates]` 相关的断言会集中受影响，**预计 15–25 条**。
  需要逐个判断是「断言过期」还是「真回归」。
- **不必碰**：`recoveryChapterSource`（恢复对账字段）、`materialDecision` 的 hash 语义（除非步骤 1 改了构成）。

---

## 6. 决策状态

| # | 问题 | 状态 |
|---|---|---|
| 1 | 以「逐字重复消除」为 P1 唯一目标（语义级排除）？ | ✅ **作者已确认：是** |
| 2 | 步骤顺序 | ✅ **按 1 → 2 → 3** |
| 3 | 步骤 2 保守还是激进？ | ✅ **保守**；理由更正为「激进在无状态架构下不成立」，见 §3.2.5 |
| 4 | 步骤 1 是否先做最小版？ | ✅ **改为 Phase 0（只加断言，不改业务）→ Phase 1（改 D1 构成）**，见 §6.1 |

### 6.1 关于第 4 问的重新评估（按作者要求）

作者要求先回答第 3 问的「多轮成倍」问题，再重新评估第 4 问。结论：

**「最小版」的价值下降了，但方向该反过来。**

- 原先建议「先做不改构成、只去重呈现的最小版」——出发点是**担心动 `chapter-materials.ts` 的构成会破坏语义**。
- 但结合 §3.2.5 的发现：**收益的大头在 D1（同一轮内 `chapterMaterials.text` 装两遍）**，
  而 D1 的修复**必然要动 `draftAuthorMaterialBlock` 的构成**（删掉与 system/template 重叠的段）。
  「不改构成的最小版」**恰好绕开了收益最大处**。
- 所以正确的路径不是「先做最小版」，而是：
  1. **先加量化断言**（不加业务改动）：写测试证明 D1 存在（同一轮内同一份资料出现 2 次）。
     —— 这是「零风险的第一步」，且它本身就是验收工具；
  2. **再动 D1 的构成**，用第 1 步的断言当护栏；
  3. 步骤 1（初始请求内部去重）与步骤 2（D1）实际是**同一件事的两面**，应合并为一轮做，
     因为它们都指向「`chapterMaterials.text` 与 `promptBuilder.build()` 的职责边界」。

**修订后的实施顺序**：
- ✅ **Phase 0（已完成，2026-10-10）**：加「逐字计数」断言（证明 D1 存在 + 作为护栏）。零业务改动。
  实测把 D1 从「设计稿的推测」变成「初始 2 / 续写 2」的确定事实，并**排除了 D3/D7**（实测均为 1）。
- ✅ **Phase 1（已完成，2026-10-10）**：条件化 `authorItems` 兜底 → D1 收敛为 1/1。
  实测单轮体积下降 **初始 −30.0% / 续写 −36.1%**（随作者字段体量放大）。
  **未触碰** `chapter-materials.ts`（比原计划风险更低——原计划以为要改它）。
- ⏭️ **Phase 2（待办）**：仅剩 D6 `user_guidance`（当前 3 处：`system` ★额外指导★ / `【本章信息】` JSON / 已消掉的 authorItems 那份）。
  消掉 authorItems 后降为 2 处；是否继续收敛到 1 处待评估（D7 经实测无需处理）。
- **P1-B（并行，不阻塞）**：加轮数/体积埋点，为「多轮成本」积累数据。

### 6.2 Phase 1 落地记录

- **改动文件**：`src/services/workflows/commands/generate-draft.command.ts`
  （新增 `templateRendersChapterInfo()`；`draftAuthorMaterialBlock` 增加 `includeAuthorItemsFallback`；初始/续写/压缩三处按判定传参）。
- **测试**：`generate-draft.command.test.ts` 205/205 通过；
  受影响断言逐个判定为「断言过期」（作者字段从独立重列行改为只留在蓝图 JSON），已同步更新并**补强**为「恰好出现 1 次」的不变量断言。
- **回归验证**：`tsc --noEmit` EXIT=0；工作流目录失败集与基线**逐条 diff 完全一致**（18/18 均为 better-sqlite3 ABI 145 vs 127 环境问题），新增 0 条真回归。
- **两条兜底护栏继续通过**：`retains all three author fields … when a custom draft template omits chapter_info`、
  `omits the execution card when all three author fields are empty`。

