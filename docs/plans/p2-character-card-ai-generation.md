# P2 设计稿 · 角色卡管理界面的 AI 生成增强

> 状态：**设计待审**（未动代码）。日期：2026-10-10。分支：`dev_byf`。
> 关联：`docs/plans/prompt-assembly-backlog.md`（P2 条目）、`p1-blueprint-roster-sync.md`（**共用同一 UI 入口，务必一起看**）。

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

> **建议**：先做 **A + C**（改动最小、与 P1 解耦），B 由 P1 的入口承担。
> 这样 P2 与 P1 **各管一个入口、共用落卡链路**，互不阻塞。

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
| **R6 历史回退的状态机** | 旧批次可能已 cancelled/被后续 approved | §8.1 待核实；若不可直接复用则「重新 stage 旧内容」为更干净的方案 |
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

作者的心智模型很明确：**不做批量，靠「重新生成 + 翻历史」来挑最好的那一版**。
所以设计重点从「批量」转到「**生成历史可回溯、可回退**」。

#### ⚠️ 实施前必须解决的冲突（已读代码核实，非推测）

读了 `electron/services/character-proposal-service.ts`，发现**两个硬约束与「重新生成 = 新历史」直接冲突**：

**冲突 1 · 批次 ID 由「来源」哈希决定 → 同来源必去重**
```ts
const proposalBatchId = `cpb:${textHash(JSON.stringify([this.projectId, source]))}`   // :164
if (existing) { ...; return this.read(proposalBatchId) }                            // :166-170
```
→ **同样的来源重复生成，只会读回旧批次，不会产生新条目。**
作者的「重新生成 3 次、对比 3 版」**在当前实现下拿不到 3 个批次** —— 拿到的是同一个。

**冲突 2 · `cancelled` 批次不可再 approve**
```ts
if (batch.status !== 'pending-approval') throw new Error('CHARACTER_PROPOSAL_CANCELLED')  // :225
```
→ 一旦取消，该批次**永久不可采用**；无法「回退到第一版」（若第一版已被取消）。

#### 结论：三档方案（**建议方案 B**）

| 方案 | 做法 | 代价 | 评价 |
|---|---|---|---|
| **A. 改批次 ID 引入生成序号** | 让每次生成产生新批次（ID 加 nonce/序号） | 动主进程 identity 语义，**风险高**；且破坏既有幂等（重复 stage 会重复建 proposals） | ❌ 不建议 |
| **B. 「新旧并存」用**「重新 stage 旧内容」**实现回退** ✅ | ①**历史列表**新增通道，列出持久化的批次；②**回退**时不复用旧批次，而是把旧批次的 `items` **重新 stage 成一个新批次**再 approve | 纯新增只读通道 + 一次「再 stage」；**不改** identity 状态机 | ✅ **建议** |
| **C. 不做回退，只做「只读回看」（可能是作者真正想要的）** | 只展示历史，作者照旧「对当前批次决定」 | 最小 | ⚠️ 见下方「重新理解需求」 |

> **重要澄清（避免过度设计）**：作者原话「也许我重新生成 3 次以后，觉得还是第一版最好」——
> 由于**冲突 1**，若来源不变，这 3 次其实**共享同一个批次**（且批次内容不变，因为来源哈希没变）。
> **要真正产生「不同的 3 版」，来源必须不同**（例如作者改了自己的自述、或改了勾选的配置来源），
> 此时会得到 3 个不同 `proposalBatchId`，**历史列表天然可用**。
> 因此本设计**优先满足「回看」**（低成本、直接命中作者的表述），
> 「回退采用」按方案 B 提供（若作者确认需要）。

#### 必须新增的通道（只读）

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
> ① **不加列**：按 `source` 的语义分组展示（如「来自蓝图」「来自前提+配置」），组内不承诺时间序 ——
>    **零迁移风险，先满足「回看」**；
> ② 加一个**只读派生**的时间列（需要 migration，且只能对**此后**生成的批次记录时间，历史批次为空）；
> ③ 从 `raw_value` 的 envelope 里派生时间 —— **已核实不可行**：`Envelope`（`character-proposal-service.ts:19-29`）
>    字段为 `version / projectId / proof / batch / decision / created / approvalProof / authorEditProof`，**无时间字段**。
>
> 作者「重新生成 3 次、对比 3 版」主要关心**内容差异**而非时间戳，故方案 ① 足够；如需时间序再升级到 ②。

#### UI

- 在 AI 生成对话框里提供「历史生成」入口（列表：时间/来源/角色数/状态）。
- 点击某批次 → **只读回看**（复用 `formatCharacterProposalPreview` 或 `CharacterProposalSelectionPanel` 展示）。
- **不做**：批量生成；自动挑最优；版本 diff。

#### 不做（明确排除）

- 不为了让「同来源重新生成」产生新批次而改 `proposalBatchId` 的哈希规则（高风险，见方案 A）。

---

## 9. 仍需确认的小问题

1. **历史是否要「可回退采用」**（§8.1 的冲突 2）：
   作者要的是「**只读回看**」还是「**能让旧版生效**」？
   —— 若是后者，需「把旧批次内容重新 stage 成新批次再采用」（方案 B）；前者则只需只读列表。
   **这个决定直接影响工作量，建议先确认。**
2. **历史排序**（§8.1 已核实无时间列）：接受「按来源分组、组内不承诺时间序」（方案 ①）吗？
3. **「重新生成」是否要能产生不同版本**（§8.1 冲突 1）：
   同来源重复生成会被去重成同一批次。需要「每次都能产生新版本」吗？
   —— 若需要，得让**来源可变**（例如把「本次生成时间/序号」纳入来源），
   这属于**改动 identity 语义**，风险较高，需单独评估。
4. **来源 A 的粒度**：默认全选（前提+配置），还是让作者勾选具体字段？
   （建议：默认全选，提供折叠的高级勾选。）
