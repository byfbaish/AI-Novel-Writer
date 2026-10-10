# P2 设计稿 · 角色卡管理界面的 AI 生成增强

> 状态：**设计待审**（未动代码）。日期：2026-10-10。分支：`dev_byf`。
> 关联：`docs/plans/prompt-assembly-backlog.md`（P2 条目）、`p1-blueprint-roster-sync.md`（**共用同一 UI 入口，务必一起看**）。

---

## 0. ⭐ 核心意图（作者 2026-10-10 追加澄清 · 决定整个 P2 的形态）

作者原话：

> 「首先我要追加一个意见。**固定来源生成角色卡，多次结果都一样，这个我是认可的。
> 在这个前提下，多历史版本是没有意义。** 但是 P2 实际上想实现的效果是，
> **在某份蓝图里提到了一个从未出现的新角色。然后我想用大模型以及现有的大纲蓝图
> 来为这个角色描绘一个可能的人物背景**，这种可能性**不是现有的来源能够固定的了的**。」

### 这段澄清改变了什么

作者的诉求**不是**「对同一份固定输入反复生成、比对多个版本」，
而是「**给一个已在蓝图里点名、但尚无设定的人物，用 AI 补一段背景**」——
这种生成**本质上每次都会产出不同内容**，因此**天然就是多个版本**，
不存在「固定来源导致版本无法区分」的问题。

**结论：作者真正要的就是「历史版本」，且它在现有实现下天然成立。**

### ✅ 实测结论：多版本**不需要任何改动**，现状已支持

我一开始担心「批次 ID 由来源哈希决定 → 同来源会去重」（`character-proposal-service.ts:164`），
但**读透 `source` 的构成后，这个担心不成立**：

```ts
// generation-character-proposal-proof.ts:169
const sourceHash = textHash(JSON.stringify([source, items]))
```

而 `source`（`kind:'generation'`）**不是纯输入**，它包含**这一次 AI 运行的产物指纹**：

```ts
{ kind:'generation', inputKind, handle, artifacts: [{ artifactId, revision, textHash }] }
```

- `handle` 来自 `onRunOpened` —— **每次执行生成都会新开一个 run**
  （`planning-material.command.ts:52`）。
- `artifacts` 里每个都带**该次运行产出文本的 `textHash`**
  （`planning-material.command.ts:131`）。

因此：**每点一次「生成」→ 新 run → 新 `artifactId`/`textHash` → 新 source → 新 `proposalBatchId` → 新的历史条目。**

> **即：「重新生成 3 次」= 3 个不同批次 = 3 条历史**，现状**天然可用**。
> （`:164-170` 的去重只在「**对同一次运行重复 stage**」时生效，那是幂等保护，不是版本阻断。）

### 对设计的影响（比原稿大幅简化）

| 原稿担心 | 实际情况 | 设计动作 |
|---|---|---|
| 「同来源会去重，产生不了多版本」 | ❌ **不成立** —— 新 run 即新 source | **无需**改 `proposalBatchId` 哈希 |
| 需要「把旧批次重新 stage 成新批次」来支持多版本 | 不需要 | **删除**该复杂方案 |
| 「回退采用」需要绕开 `cancelled` 限制 | **仍成立**（见 §8.1） | 保留，但降优先级 |

**P2 因此收敛为两件事**（都不改 identity 语义）：
1. **让生成入口支持「指定角色 + 用蓝图/大纲补背景」这种输入**（新来源类型 D，见 §4.2）；
2. **加一个只读的历史列表**，让作者能回看并挑最好的一版。

---

## 1. 缘起（作者原话与评估倾向）

作者提问：

> 「在蓝图里可以通过 AI 创建角色图谱……**可以利用已有的 AI 创建角色图谱功能来增强
> 角色卡管理界面的角色卡创建功能吗？**……如果你评估这是**比较容易做到**的话，那就加入到后续的任务列表里。」

**作者已给的决策条件**：*「如果容易做，就做」*。
因此本设计稿的**首要产出是「复用度评估」**，而不是实现方案 —— 若评估结论是「不容易」，
应回报作者再定，不得强行实现。

---

## 2. 复用度评估（先回答「容不容易」）

### 2.1 结论：**容易**。而且**几乎照抄一个现成组件**即可。

理由：项目里**已经存在一个功能形态 100% 对齐的先例** ——
`src/components/characters/CharacterCardImportButton.tsx`（190 行）：

| 维度 | `CharacterCardImportButton`（已有） | P2 要做的 |
|---|---|---|
| 位置 | 角色卡管理 UI（`CharactersView.tsx:84`、`ArchFileViewer.tsx:586`） | **同一处** |
| 输入 | 粘贴文本 / 选资料文件 | 由「故事前提+配置」或「蓝图候选」自动带出（**无需作者手填**） |
| AI | `createPlanningMaterialCharacterExtractionWorkflow` | 复用同一 workflow **或** 复用 `character_dynamics` 生成器 |
| 产物 | `character-proposal` 批次（pending-approval） | **完全一致** |
| 确认 | 预览面板 + `character-proposal:approve` | **完全一致** |
| 安全 | 先确认再写 roster | **完全一致** |

→ **交互链路、安全语义、预览/确认 UI 全部可复用**，P2 只差「一个不同的输入来源 + 一个按钮」。

### 2.2 两个可复用的生成器（按适配成本排序）

**选项 A（最低成本 · 推荐）**：复用 `planning-material` 提取链路
- 工厂：`createPlanningMaterialCharacterExtractionWorkflow`（`planning-material-workflow.ts:73`）
- 两步流水线**已经是 P2 想要的形态**（`:101-119`）：
  1. `ExtractPlanningMaterialCharactersCommand` —— 生成待确认角色卡
  2. `CommitPlanningMaterialCharactersCommand` —— **带 `requiresConfirmation: true`** 的确认步
- 只要把「输入材料」换成「当前故事前提 + 小说配置」（或蓝图候选），**其余零改动**。

**选项 B（次低成本）**：复用 `character_dynamics` 生成器
- 命令：`GenerateCharactersCommand`（`architecture.command.ts`，workflow 里 key = `characters`，`architecture-workflow.ts:158-166`）
- 模板：`character_dynamics`（`architecture.command.ts:1139`）
- 更「重」：它会生成**整套角色图谱**（主角+盟友+对手+灰色角色），
  与 P2 想要的「**在角色卡界面补一张卡**」粒度不完全一致。
- 结论：**只在「从零建角色图谱」时用 B；日常补卡用 A。**

### 2.3 复用度总评

> **容易**（低成本）。P2 ≈ 「把一个已有组件换个输入源」+「接一个已有 workflow」。
> **风险点是「输入源」而非「链路」** —— 链路是现成的。

---

## 3. 设计目标与非目标

### 目标

1. 在**角色卡管理界面**提供「AI 生成角色卡」，让作者**不必手填字段**。
2. 复用既有 `character-proposal`（暂存 → 预览 → 明确采用）链路，**不新写落卡逻辑**。
3. 与 P1 **共用同一个 UI 入口组件**，避免两套入口（P1 缺口的第 3 条）。

### 非目标

- 不做「AI 直接写 roster」（必须走确认）。
- 不做「覆盖已有角色卡」（只新增候选；既有角色靠 `map` 决策，不覆盖）。
- 不新增角色卡结构字段（归属仍用 notes/arc 文本，见 P1 §4.4）。

---

## 4. 方案

### 4.1 复用同一条三步链路

```
① UI 入口（新增按钮，与 P1 共用）
      └─ 角色卡界面 [AI 生成角色卡]
② 工作流（复用 planning-material 两步形态）
      ├─ Step A: 生成待确认角色卡   （Extract 命令，换输入源）
      └─ Step B: 确认并导入        （Commit 命令，requiresConfirmation）
③ 落卡（零改动）
      └─ character-proposal:stage → 预览 → approve
```

### 4.2 输入源设计（唯一的实质决策点）

P2 要「不用作者手填」，那 AI 生成角色卡的**输入上下文**从哪来？
三个候选来源，建议**支持多选**（对话框内可勾）：

| 来源 | 数据获取 | 适用 |
|---|---|---|
| **A. 故事前提 + 小说配置** | `db:project-core-get`（premise）+ `novelConfig`（genre/goldenFinger/worldSetting/protagonistProfile/referenceWorks）<br>—— 与 `GenerateCharactersCommand` 取的字段完全一致（`architecture.command.ts:1148-1171`） | 从零建卡、补主要角色 |
| **B. 蓝图 `newCharacterCandidates`** | 复用 P1 的 `listPendingDirectoryCharacterSyncs()`（**与 P1 同一份数据**） | 给蓝图里点名的角色补卡 |
| **C. 作者自述** | 对话框内自由文本框 | 临时补一个路人转重要角色 |
| **D. ⭐ 指定角色 + 大纲/蓝图补背景**（作者核心诉求，见 §0） | 作者**点名**一个已在蓝图出现但无设定的角色，AI 结合**大纲 + 蓝图 + 配置**为该角色**推断**一段可能的人物背景 | 作者原话场景：「某份蓝图里提到了一个从未出现的新角色，用大模型及现有大纲蓝图为其描绘可能的人物背景」 |

> **建议**：先做 **A/C**（链路最近、风险最低），再做 **D**（最贴合诉求），B 随 P1 一起接。
> 全部**共用**同一个入口与落卡链路，只是「来源」不同，互不阻塞。

### 4.2.1 ⭐ 来源 D 的专门设计（作者核心诉求）

**输入**：

- **角色名**（必填）：作者指定，或从蓝图 `characters` 里选。
- **结合哪些上下文**（可勾选）：
  - 故事前提（`db:project-core-get`）
  - 小说配置（`novelConfig`）
  - **大纲/蓝图**（重点）：该角色出现的章节蓝图 + 前后若干章蓝图
  - 已有角色卡（用于避免与既有设定冲突）
- **作者补充描述**（可选）：例如「她是反派阵营的，但要写得让人同情」。

**输出**：一个 `CharacterProposalBatch`（pending-approval），候选是该角色的完整 `CharacterStaticFields`
（`appearance / personality / background / abilities / motivation / arc / notes`）。

**三个关键点（严格对应作者澄清）**：

1. **「描绘一个可能的人物背景」= 推断，不是复述** ——
   提示词必须明确「**基于蓝图事实推断，不得新增与之矛盾的事实**」，
   并受 ADR 0020 约束（不得改写作者已明确的事实）。
2. **每次生成天然不同** → 新 run / 新 artifact / **新批次 / 新历史条目**（见 §0 实测）——
   这正是作者要的「挑一个最好的版本」。
3. **`notes` 预填溯源**：写「来源：第 N 章蓝图 + AI 推断」，
   让作者一眼分清「哪些来自蓝图、哪些是推断」（**可编辑**）。

**实现选择（实施期定）**：
- **优先复用** `GenerateCharactersCommand` 的 **manifest（身份清单）→ details（详情批处理）** 两段式
  （`architecture.command.ts:1234-1338`）：来源 D 可视为「**清单只含 1 个槽位**」的特例 ——
  清单就是作者点名的那一个角色，详情阶段生成完整字段。
- 若复用成本高，**再**新增一个聚焦模板（例如 `character_background_inference`）：
  变量 = 角色名 + 蓝图上下文 + 配置，输出单张角色卡 JSON。**属实施期决策，不在设计中提前造模板。**


### 4.3 是否要新写一个「角色卡版」命令？

**建议：不新写，先尝试复用。**
- 复用 `planning_material_character_extraction` 模板时，把 `sources` 段填成
  「故事前提 + 配置」的整理文本即可（模板要的是 `requested_ids` + `sources`，
  见 `planning-material.command.ts:83-89`）。
- **若**实测发现「资料提取」的措辞不适合「从前提生成角色」，**再**考虑新增一个
  `character_card_generation` 模板（与 `character_dynamics` 并列，遵循既有模板注册方式）。
  这属于**实施期决策**，不必在设计中提前造模板。

### 4.4 UI 入口（与 P1 共用 · ✅ 已确认合并）

```
src/components/characters/AiCharacterCardButton.tsx   ← 与 P1 的入口合并为一个组件
```

- 位置：`CharactersView.tsx` 顶部操作栏（`:83-91` 那一排，紧邻现有「粘贴/导入」与「新建」）。
- 形态：**一个按钮 + 一个对话框**，对话框内含：
  1. **来源多选**（✅ 已确认按此区分，来源见 §4.2 的 A/B/C）；
  2. **模型确认 + 发送披露**（**完全对齐** `CharacterCardImportButton:118-121` 的既有交互）；
  3. **历史生成入口**（✅ 新增需求，见 §8.1）。
- 发送前**必须**披露模型与端点（沿用 `:119-121` 的 confirm 文案模式）。
- **不做批量生成**（✅ 已确认）：对话框只产出一次生成；不满意就再点一次，历史自动累积。

---

## 5. 验收标准

1. **功能**：角色卡界面可通过 AI 生成角色卡候选，预览后明确采用，落成正式角色卡。
2. **一致的安全语义**：未确认前不写 roster；确认前可取消且不丢输入（沿用 `:143-151` 的保留输入行为）。
3. **可回滚/幂等**：复用 `character-proposal` 的 `proposalBatchId` + `expectedRevision`，
   重复提交不会重复建卡（沿用 `CHARACTER_PROPOSAL_CHOICES_STALE` 保护）。
4. **模型变更保护**：发送前再次校验模型未变（沿用 `:125-129` 的做法）。
5. **历史可回溯**（✅ 新增）：能列出历次生成批次，并能回看；作者能对「觉得最好的一版」重新采用。
6. **回归**：`tsc --noEmit` EXIT=0；定向测试全绿；全量失败集与基线一致。

---

## 6. 风险与边界

| 风险 | 说明 | 缓解 |
|---|---|---|
| **R1 与 P1 造两套入口** | 作者明确要「角色卡界面」的入口 | ✅ **已确认合并**：同一按钮/对话框内以「来源」区分 |
| **R2 生成质量** | 无上下文时 AI 会编造 | 来源至少选一项才允许发送；预览阶段默认 `keep-unresolved` 需作者确认 |
| **R3 与「角色图谱」混淆** | 选项 B 生成整套图谱，P2 只想补一张 | **日常补卡走选项 A**；整图谱走既有架构流程 |
| **R4 ADR 0020** | 不得删改既有角色 | 只 `create` 新卡；对已有角色只允许 `map`，不覆盖字段 |
| **R5 成本** | AI 调用产生费用 | 发送前披露模型/端点（已有先例）；不做自动重试 |
| **R6 历史回退的状态机** | ✅ 已核实：多版本天然成立（新 run ⇒ 新批次）；唯一约束是 `cancelled` 批次不可再 approve | 回退走「旧批次内容 → 重新 stage 成新批次 → 采用」，不动 identity 状态机 |
| **R7 DB 增长** | 每次生成都落一条持久批次 | §9 待确认是否设上限；不设时 UI 默认折叠 |

---

## 7. 与 P1 的联合实施建议

**强烈建议 P1、P2 合并为一个「角色卡生成」特性批次**，共享：

1. **一个 UI 组件**（按钮 + 对话框，来源多选）；
2. **一条落卡链路**（`character-proposal`）；
3. **一份输入数据源**（P1 的待同步候选 = P2 的来源 B）。

分阶段：

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **Step 0** | 只读**测试**固化候选集不变量（P1 Step 0；⚠️ 是测试，不是产品只读环节） | 无 |
| **Step 1** | 合并入口组件（按钮 + 对话框）：来源多选（A/C）+ 模型披露 + **历史列表**（P2 主体） | 无 |
| **Step 2** | 接入**来源 B**（P1 主路径）+ 角标 + 提交后提示（含设置开关） | P1 Step 1 |
| **Step 3** | 「落卡后进入 Prompt」的逐字验收测试 | Step 1/2 |

---

## 8. ✅ 作者已确认的决策（2026-10-10）

| # | 问题 | 作者决定 |
|---|---|---|
| 1 | 入口形态 | **合并为一个入口**，以「**来源多选**」区分。（原话：「按你的建议入口合并吧，以『来源多选』区分。」） |
| 2 | 是否需要批量 | **不需要**。作者原话：「批量生成就不需要了，**不满意的话，重新生成就是**。」 |
| 3 | 历史版本查看 | **需要**（新增需求）。作者原话：「但是可能需要一个**历史生成的查看**，也许我重新生成 3 次以后，觉得还是第一版最好。」 |

### 8.1 「重新生成 + 历史查看」的设计（响应决策 2、3）

作者的心智模型：**不做批量，靠「重新生成 + 翻历史」来挑最好的那一版**。
所以设计重点从「批量」转到「**生成历史可回溯**」。

#### ✅ 已核实：多版本无需任何改动（推翻我先前的判断）

我先前担心「同来源生成会被 `proposalBatchId` 去重成同一批次」。**读代码后确认这个担心不成立。**
关键在于 `sourceHash` 把**每次运行的产出**也纳入了哈希：

```ts
// electron/services/generation-character-proposal-proof.ts:169
sourceHash = textHash(JSON.stringify([source, items]))
```

而 `kind:'generation'` 的 `source` 里包含（`planning-material.command.ts:52 / :131`）：

- `handle` —— 由 `onRunOpened` 在**每次运行开始时**生成，**每次都是新的**；
- `artifacts: [{ artifactId, revision, textHash }]` —— 每项携带**本次 AI 输出的 textHash**。

→ **每点一次「生成」= 新 run = 新 handle/artifactId/textHash ⇒ 新 source ⇒ 新 `proposalBatchId` ⇒ 新历史条目。**

核对 UI 侧也成立：`CharacterCardImportButton` 每次点击都调 `startWorkflow`（`:130`、`:138`），
即**每次点击都是一次全新运行**，不会复用旧批次。

**`proposalBatchId` 的去重只在「把同一次运行重复 stage」时生效**（`character-proposal-service.ts:164-170`
读到已存在就回读），这是**幂等保护**，不是版本封锁。

> ⚠️ **与作者意见的一致性**：作者说「**固定来源生成角色卡，多次结果都一样，这个我是认可的**」。
> 更精确地说，本实现里「同一次运行重复 stage」确实结果一样（幂等），
> 但「**新一次生成**」由于 run 句柄与产出哈希变化，**天然产生新条目**。
> 两者不冲突 —— 作者认可的「确定性」指前者，而「翻历史挑版本」要的是后者，**均已满足**。

#### 唯一遗留的真实约束（已降级，不阻断设计）

```ts
if (batch.status !== 'pending-approval') throw new Error('CHARACTER_PROPOSAL_CANCELLED')  // :225
```

→ **`cancelled` 的批次不能被 approve。** 影响范围仅限「作者主动取消了某一版，之后又想采用它」这一种情况。
处理建议（**实施期小决策，不阻断**）：回退采用时**不复用旧批次**，而是把旧批次的 `items`
**重新 stage 成一个新批次**再 approve —— 纯新增、`apply` 路径已有先例，**不动 identity 状态机**。

#### 需要新增的通道（只读）

当前只有 `list-pending-finalized`（`character-proposal-service.ts:124`），**没有「列出全部生成历史」**。
建议新增：

```
'character-proposal:list-history': { args: []; return: {
  proposalBatchId: string
  source: CharacterProposalSource
  itemCount: number
  status: 'pending-approval' | 'approved' | 'cancelled'
  label: string              // 例如「来自前提+配置 · 5 个角色」/「来自第 3、7 章蓝图」
}[] }
```

- 实现参考 `listPendingFinalized()`（`:124-127`）的既有 SELECT 写法。
- **只读**，绝不改任何数据。

> ⚠️ **已核实的限制（无 `created_at`）**：`character_identity_proposals` 建表列只有
> `proposal_id, owner_character_id, source_key, source_hash, raw_value, candidate_ids_json`
> （`electron/migrations/m02-character-identity.ts:18-21`）——**没有时间列**。
> 因此历史列表**无法按生成时间排序**。三种应对（**建议 ①**）：
> ① **不加列**：按 `source` 的语义分组展示（如「来自蓝图」「来自前提+配置」「来自指定角色补背景」），
>    组内不承诺时间序 —— **零迁移风险，先满足「回看」**；
> ② 加一个**只读派生**的时间列（需要 migration，且只能对**此后**生成的批次记录时间，历史批次为空）；
> ③ 从 `raw_value` 的 envelope 里派生时间 —— **已核实不可行**：`Envelope`（`character-proposal-service.ts:19-29`）
>    字段为 `version / projectId / proof / batch / decision / created / approvalProof / authorEditProof`，**无时间字段**。
>
> 作者「重新生成 3 次、对比 3 版」主要关心**内容差异**而非时间戳，故方案 ① 足够；如需时间序再升级到 ②。

#### UI

- 在 AI 生成对话框里提供「历史生成」入口（列表：来源 / 角色数 / 状态）。
- 点击某批次 → **只读回看**（复用 `formatCharacterProposalPreview` 或 `CharacterProposalSelectionPanel` 展示）。
- 若作者需要「让旧版生效」：对旧批次走「**clone → 新批次 → 采用**」（见上方遗留约束的处理建议）。
- **不做**：批量生成；自动挑最优；版本 diff。

#### 不做（明确排除）

- **不**改 `proposalBatchId` 的哈希规则 —— ✅ **已无必要**（多版本天然成立），
  且改动会破坏「重复 stage 的幂等保护」。

---

## 9. 仍需确认的小问题

1. **历史是否要「可回退采用」**（§8.1 遗留约束）：
   作者要的是「**只读回看**」还是「**能让旧版生效**」？
   —— 若是后者，回退走「旧批次内容 → 重新 stage 成新批次 → 采用」；
   前者则只需只读列表（不做任何写操作）。**这个决定只影响工作量、不影响可行性。**
2. **历史排序**（§8.1 已核实无时间列）：接受「按来源分组、组内不承诺时间序」（方案 ①）吗？
   若希望有时间序，需要加一列（migration，且只对**此后**的批次有效）。
3. **来源 D（指定角色补背景）的上下文组装**：
   是否复用既有 `manifest → details` 两段式（`architecture.command.ts:1234-1338`）？
   —— 建议**先复用**，并**默认把大纲/蓝图中提到该角色的段落全量喂入**，由作者在预览里判断取舍。
4. **来源 A 的粒度**：默认全选（前提+配置），还是让作者勾选具体字段？
   （建议：默认全选，提供折叠的高级勾选。）
