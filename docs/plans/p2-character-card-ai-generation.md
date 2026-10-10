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

### 4.4 UI 入口（与 P1 共用）

```
src/components/characters/AiCharacterCardButton.tsx   ← 建议与 P1 的按钮合并为一个组件
```

- 位置：`CharactersView.tsx` 顶部操作栏（`:83-91` 那一排，紧邻现有「粘贴/导入」与「新建」）。
- 形态：一个按钮 + 一个对话框（Dialog），内含「来源多选 + 模型确认 + 发送披露」，
  **完全对齐** `CharacterCardImportButton` 的既有交互（`:118-121` 的发送前披露文案范例）。
- 发送前**必须**披露模型与端点（沿用 `:119-121` 的 confirm 文案模式）。

---

## 5. 验收标准

1. **功能**：角色卡界面可通过 AI 生成角色卡候选，预览后明确采用，落成正式角色卡。
2. **一致的安全语义**：未确认前不写 roster；确认前可取消且不丢输入（沿用 `:143-151` 的保留输入行为）。
3. **可回滚/幂等**：复用 `character-proposal` 的 `proposalBatchId` + `expectedRevision`，
   重复提交不会重复建卡（沿用 `CHARACTER_PROPOSAL_CHOICES_STALE` 保护）。
4. **模型变更保护**：发送前再次校验模型未变（沿用 `:125-129` 的做法）。
5. **回归**：`tsc --noEmit` EXIT=0；定向测试全绿；全量失败集与基线一致。

---

## 6. 风险与边界

| 风险 | 说明 | 缓解 |
|---|---|---|
| **R1 与 P1 造两套入口** | 作者明确要「角色卡界面」的入口 | **共用组件**；P1 的蓝图入口与 P2 的生成入口在**同一按钮/对话框**内以「来源」区分 |
| **R2 生成质量** | 无上下文时 AI 会编造 | 来源至少选一项才允许发送；预览阶段默认 `keep-unresolved` 需作者确认 |
| **R3 与「角色图谱」混淆** | 选项 B 生成整套图谱，P2 只想补一张 | **日常补卡走选项 A**；整图谱走既有架构流程 |
| **R4 ADR 0020** | 不得删改既有角色 | 只 `create` 新卡；对已有角色只允许 `map`，不覆盖字段 |
| **R5 成本** | AI 调用产生费用 | 发送前披露模型/端点（已有先例）；不做自动重试 |

---

## 7. 与 P1 的联合实施建议

**强烈建议 P1、P2 合并为一个「角色卡生成」特性批次**，共享：

1. **一个 UI 组件**（按钮 + 对话框，来源多选）；
2. **一条落卡链路**（`character-proposal`）；
3. **一份输入数据源**（P1 的待同步候选 = P2 的来源 B）。

分阶段：

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **Step 0** | 只读：显示「N 个蓝图新角色待建卡」（P1 Step 0） | 无 |
| **Step 1** | 复用 `planning-material` 链路做**来源 A/C**（P2 主体，低风险） | Step 0 可选 |
| **Step 2** | 接入**来源 B**（P1 主路径） | P1 Step 1 |
| **Step 3** | 「落卡后进入 Prompt」的逐字验收测试 | Step 1/2 |

---

## 8. 待作者拍板的开放问题

1. **来源范围**：先做 **A（前提+配置）+ C（自述）**，把 **B（蓝图候选）**留给 P1 入口 —— 是否同意？
2. **入口形态**：P1/P2 **合成一个按钮**（内部按「来源」分叉），还是**两个独立按钮**？
   （建议：合成一个，避免操作栏拥挤。）
3. **是否需要「批量」**：来源 B 可能一次有多个候选，是否要「一键生成全部候选」，
   还是**逐个**生成由作者挑？（建议：一次生成全部候选、在预览面板逐条决定 —— 复用既有面板。）
