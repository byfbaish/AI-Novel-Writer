# P1 设计稿（v2）· Prompt 组装中的**逐字重复**消除

> 目标读者：作者（审阅者）。本稿只做**设计与证据**，不含实现。
> 依据：`generate-draft.command.ts`、`chapter-materials.ts`、`builtin-prompt-templates.ts`（dev_byf 当前状态）。
> v1 稿（`p1-user-guidance-split.md`）的前提已被推翻，本稿取代之。

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

### 1.1 D1 的机制（最关键的发现）

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

### 3.2 分三步（可独立验收，逐级放量）

#### 步骤 1 · 消除初始请求内部的并排重复（D2–D5）

**问题**：`chapterMaterials.text` 与 `promptBuilder.build()` 并排拼接，内容重叠。

**做法**：明确分工——**`template.content` 负责「写作指令与设定池」，`chapterMaterials.text` 只负责「它独有的部分」**。
具体地：
- `chapterMaterials.text` 目前含 3 段：`【作者资料…】`（D2）、`【后续计划边界】`、`【有来源的历史与候选】`。
- 其中 `【作者资料…】` 的 `authorFacts` 部分与 `【全书设定池】`（architecture）和 `【小说配置事实】`（novelConfigFacts）重叠 → **移除或改写为引用**。
- 保留其独有部分：`characterProfiles`（角色档案）、`futurePlans`（后续计划边界）、`【有来源的历史与候选】`（定稿原文片段）。

**预期收益**：初始请求减少一整份作者资料。**这是最大的一块。**
**风险**：中。`chapter-materials.ts` 的 `decision` / `omissions` / 容量准入（S07）都依赖这段文本的存在与 hash，
移除会触碰 `materialDecision.promptHash` 与覆盖缺口日志。**必须保 hash 稳定或同步更新。**

#### 步骤 2 · 统一续写/压缩的作者资料来源（D1 的核心）

**问题**：续写/压缩用路径 B 重新拼一套，且把 `chapterMaterials.text` 整个再装一遍。

**做法**：改为**复用**，不再重拼。两种实现选一：

- **① 复用初始请求的 system**：续写沿用同一 `params.systemRole`（现在已经这么做，`:1586` 用 `params.systemRole`），
  只需把 `draftAuthorMaterialBlock` 里与 system / template 重叠的段落删掉，只保留**本章蓝图 + 已写正文**。
- **② 显式「增量」语义**：续写 prompt 只写「以下是你上一轮已收到的同一本作品，本章已写正文如下」，
  把 `chapterMaterials.text` 彻底移出续写请求（依赖服务端/模型侧的上下文缓存，但这不保证，需评估）。

**推荐 ①**：不依赖任何外部缓存行为，纯本地组装层收敛，**收益确定**。
**风险**：中。续写必须仍能「自包含」——如果 provider 不缓存上下文，续写请求少了作者资料可能导致偏离。
但注意：**当前续写的 system 已经带了 `params.systemRole`（= `promptBuilder.getSystemRole()` + 执行合同 rules），
其中已含 `novel_config` 与文风边界**，所以删掉路径 B 的重复段并不会让续写「失去」这些约束。

#### 步骤 3 · 收尾（D6 + D7）

- **D6**：按 v1 稿方案，`user_guidance` 收敛到 `system` 尾部唯一一处（`toWriterChapterInfo` 去掉该字段；
  `chapterExecutionContractText` 的 `executionItems` 去掉 `作者本章指导`；用「收紧 rules 措辞」保住约束链）。
- **D7**：`chapterLengthContract` 在续写/压缩 prompt 内已有一份，检查 `composeInitialPrompt` 末尾那份是否需要（初始请求需要，续写不需要）。

### 3.3 需要你拍板的一个架构选择

步骤 2 有两种哲学，影响长远：

| | 保守（推荐） | 激进 |
|---|---|---|
| 做法 | 收敛组装层，续写仍自包含但去重 | 依赖上下文缓存，续写只发增量 |
| 收益 | 确定、可验证 | 更高（若缓存命中） |
| 风险 | 低 | 依赖 provider 行为，不保证 |
| 适配 | 任何 provider | 需 provider 支持 prompt caching |

我建议**保守**：先把「本地组装层不重复」这件事做干净（这是纯收益），
是否利用缓存是另一个正交议题，不该混在一起。

---

## 4. 验收标准

1. **逐字计数断言**（核心）：构造一个含作者资料、架构、文风的用例，跑完初始 + 1 次续写 + 1 次压缩，
   对每份作者原文做 `match(/片段/g)`，**每次请求内均为 1**。
2. `chapterMaterials.text` 不再出现在续写 / 压缩请求里（或只出现其独有部分）。
3. 续写请求的 system 仍含 `novel_config` 与执行合同 rules（约束链不丢）。
4. 全部既有测试通过；失败集与基线逐条 diff 一致。
5. `tsc --noEmit` EXIT=0。
6. **量化对比**：给一个真实章节的 prompt 体积前后对比（目标：续写请求体积下降 > 50%）。

---

## 5. 工作量与风险

- **主改**：`generate-draft.command.ts`（`composeInitialPrompt`、`draftAuthorMaterialBlock`、`extendDraftIfNeeded`、`condenseDraftIfNeeded` 的传参）；
  `chapter-materials.ts`（若走步骤 1 需改 `required` 段构成）。
- **测试影响**：`generate-draft.command.test.ts` 中与 `【作者资料】`、`【全局写作要求】`、
  `(no additional author material)`、`[Sourced history and candidates]` 相关的断言会集中受影响，**预计 15–25 条**。
  需要逐个判断是「断言过期」还是「真回归」。
- **不必碰**：`recoveryChapterSource`（恢复对账字段）、`materialDecision` 的 hash 语义（除非步骤 1 改了构成）。

---

## 6. 请你决定

1. **是否同意以「逐字重复消除」为 P1 的唯一目标**（语义级去重完全排除，留给 P3/P4）？
2. **步骤顺序**：先做步骤 1（初始请求内部去重，收益最大）还是步骤 3（`user_guidance`，最简单）？
   我建议 **步骤 1 → 步骤 2 → 步骤 3**，因为步骤 1 收益最大且能立刻用体积对比验证。
3. **步骤 2 选保守还是激进**？（我推荐保守）
4. 步骤 1 会触碰 `chapter-materials.ts` 的「必需材料（决定 1B）」语义，
   这一步要不要**先只做「不改构成、只去重呈现」的最小版**，验证安全后再动结构？
