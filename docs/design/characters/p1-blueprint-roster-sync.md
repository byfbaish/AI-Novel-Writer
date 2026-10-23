# P1 设计稿 · 蓝图角色 ↔ 角色卡 roster 同步

> 状态：**✅ 已实施**（本文件写于 2026-10-10「设计待审」，**该状态行已过期**——机制早已落地并在实机中持续迭代）。
> 实施落点：`blueprint-character-sync.ts`（同步操作）· `character-proposal-service.ts`（候选/暂存/批准/关系校验/锚点人物）
> · `CharacterProposalSelectionPanel.tsx` / `CharacterProposalInbox.tsx`（UI 入口）· `character-card-generation.command.ts`（列表/确认步）。
> 实战迭代（2026-10-15 台账，见 `docs/handoffs/archive/2026-10-15-keyevents-bprime-pause-handoff.md` §1.1）：
> `1a7b230d` 写前证明收紧 / `6e737bb0` 面板滚动 / `f8ac0571` 暂存≠完成 + 取消≠终态 / `159aac8f` 列出步断链
> / `01f891b3` 目录批次二次卡死 / `57173786`+`abf0a933` 关系端点 / `503943b8` 补背景 stage 从未成功
> / `bcec0367` 未转义引号 / `76e65473` 0 项批次 + 撤销半闭环。
> **剩余（见 AC 计划 §8）**：「候选复审批次」（撤销/`keep-unresolved` 的名字能回榜但不能再决策，判据 ⑰）。
> 日期：2026-10-10 立稿 · 2026-10-15 补实施状态。分支：`dev_byf`。
> 关联：`docs/plans/prompt-assembly-backlog.md`（P1 条目）、`p1-literal-dedup.md`（同族工作）。

---

## 1. 缘起（作者原话与困惑）

作者提问：

> 「你说蓝图提到但 roster 里没有的角色不会进，但是面板看到蓝图设置有角色的啊，是 bug 么？」

实测确认：**不是 bug，但确实是产品缺口**。

- 蓝图（chapter blueprint）的 `characters` 字段可以自由写入本章登场角色名。
- 生成时只有**已在角色卡 roster 里**的角色才会被注入档案；
  `generate-draft.command.ts:763-773` 只打一条**软提示**就继续生成：
  > `提示：本章出场角色「X、Y」在角色名册里没有卡片，将不注入其档案。如需其设定参与生成，请先为该角色创建角色卡。`
- 结果：作者**在蓝图面板明明写了角色**，生成时却被**静默忽略**（只留在日志里），
  且**没有任何顺手的路径**去把蓝图里的角色补成角色卡。

作者要的是：**蓝图里设了的新角色，能顺理成章地落成角色卡，从此参与生成。**

---

## 2. 现状测绘（⚠️ 关键：机制已部分存在）

> **设计前的重大发现**：这不是「从零造一条链路」。蓝图→角色的同步**在数据层已经建好了骨架**，
> 缺的是「触发时机」与「UI 入口」。下面的测绘决定了本设计的成本远低于最初的估计。

### 2.1 蓝图语义契约里已有「新角色候选」

`src/shared/blueprint-semantic-contract.ts`：

```ts
export interface BlueprintNewCharacterCandidate { name: string; role: CharacterRole }   // :12-15
```

- 它是蓝图的可选字段：**「只声明由本章首次引入且预计后续复用的重要具名角色」**（`:57` 中文说明）。
- `name` 必须**逐字复制** `characters` 里的一个完整姓名；`role` 只能是
  `protagonist | antagonist | supporting | minor`。一次性路人**不得**声明为候选。
- 即：**章纲生成时，模型已经在标注「哪些角色值得建卡」** —— 这就是最精准的候选来源，
  不需要再让 AI 猜一遍。

### 2.2 蓝图提交时**已经**创建持久同步操作

`electron/repositories/blueprint-repository.ts:642-675`（在蓝图提交事务内）：

```ts
const characterSyncInput = request.blueprints.map(b => ({ ...b }))
// 写 blueprint_commit_operations（含 character_sync_input）
// 写 blueprint_character_sync_operations（operation_id = `blueprint-sync-${commitOpId}`，含 start/endChapter）
const snapshot = snapshotWithCharacterSyncFacts(persisted, characterSyncInput)
```

即：**每次蓝图提交（`db:blueprint-*-commit`）都会落一条 `blueprint_character_sync_operations` 待办**，
冻结输入存在 SQLite（`character_sync_input`），**重启不丢、不可被 renderer 篡改**。

### 2.3 完成回执**已经**把「提议已暂存」作为成功条件

`blueprint-repository.ts:358-372`：`authoritativeCharacterSyncCompletionReceipt()`
在新的 character-identity schema 下，通过 `findCharacterProposalEvidence({kind:'directory', operationId})`
证明**已经 stage 过 character-proposal**，才发给 `proposal-staged` 回执。

### 2.4 stage 通道**已经**接通，但当前实现要求 `operationId`

`src/services/workflows/blueprint-character-sync.ts`：

```ts
export async function syncBlueprintCharacterCandidates(
  _blueprints, _expectedProjectPath, projectSession, operationId?,
): Promise<CharacterProposalBatch> {
  if (!operationId?.trim()) throw new Error('CHARACTER_PROPOSAL_DIRECTORY_OPERATION_REQUIRED')
  return ipc.invokeWithProjectSession(projectSession, 'character-proposal:stage', {
    source: { kind: 'directory', operationId },
  })
}
```

注意：**前两个参数当前是下划线未使用** —— 真正依据是 `operationId`，
主进程用 `db` 里冻结的 `character_sync_input` 去算候选（renderer 传什么都不授权写入）。
这是**有意的安全设计**（注释原文：*"Renderer names never authorize roster writes."*）。

### 2.5 恢复路径**已经**存在

`src/services/workflows/directory-character-sync-recovery.ts`：

- `listPendingDirectoryCharacterSyncs()` → `db:blueprint-character-sync-list-pending`
- `retryDirectoryCharacterSync(operationId)` → 调 `syncBlueprintCharacterCandidates` + `db:blueprint-character-sync-complete`
- `retryAllPendingDirectoryCharacterSyncs()`

**消费点**：`src/components/dialogs/DirectoryConfigDialog.tsx:145/231/233` —— 即「目录配置」对话框里
的「重试待完成的角色同步」。

### 2.6 缺口定位（这才是 P1 真正要做的）

| # | 缺口 | 现状 | 影响 |
|---|---|---|---|
| **G1** | **触发时机**：同步只在「目录配置对话框」的手动重试里发生 | 提交章纲后不会自动/顺手指引同步 | 作者看不到、也想不到去点 |
| **G2** | **候选集语义**：stage 时用整份 `character_sync_input` 还是只用 `newCharacterCandidates`？ | `blueprintCharacterSyncFactError` 只校验 `newCharacterCandidates` 与关系事实 | 若把路人角色也建卡，会污染 roster |
| **G3** | **UI 入口**：角色卡管理界面没有「从蓝图补卡」入口（P2 要的同一个入口） | 只有「粘贴/导入」与「新建」 | 作者无从下手 |
| **G4** | **归属语义**：副本/主线的归属靠 notes/arc 承载 | 无结构字段（符合作者要求） | 生成候选时要保证 notes/arc 文本被保留 |

---

## 3. 设计目标与非目标

### 目标

1. 蓝图提交后（或在角色卡界面），作者能**一条路径**把蓝图声明的 `newCharacterCandidates`
   变成**待确认角色卡**，确认后落成正式角色卡。
2. 落卡后，该角色在**后续章节生成**中确实进入 Prompt（可验证）。
3. **不新增结构字段**表达「副本/主线」归属 —— 用 notes / arc 文本承载（作者明确要求）。
4. **不静默自动写 roster**：必须走 `character-proposal` 的「暂存 → 预览 → 明确采用」三段式
   （这是既有安全契约，`character-proposal.ts:5` 注释：*"Suggestions become effects only after the explicit approval step."*）。

### 非目标（明确排除）

- 不做「自动把蓝图所有 `characters` 建卡」（路人角色不该建卡 —— 契约已明确排除）。
- 不改 `toWriterChapterInfo` / `writerChapterInfo`（P1-literal-dedup 的恢复指纹红线）。
- 不把归属做成结构字段。
- 不在蓝图提交事务内**同步调用** AI（提交是本地 DB 事务，AI 是长耗时网络操作，必须分离）。

---

## 4. 方案

### 4.1 总体思路：**复用已建好的 durability 骨架，补齐触发与 UI**

```
① 章纲生成/编辑（已有）
        └─ 蓝图含 characters + newCharacterCandidates(name, role)   ← 契约已有
② 蓝图提交（已有）db:blueprint-*-commit
        └─ 事务内落 blueprint_character_sync_operations（冻结输入）   ← 已有
③ 【P1 新增 A】提交成功后，UI 感知「有 N 个待同步的新角色候选」
        └─ 提供「为这些角色生成角色卡」入口（复用 ④）
④ 生成候选：character-proposal:stage { kind:'directory', operationId }   ← 通道已有
        └─ 主进程按冻结输入算出候选 → CharacterProposalBatch（pending-approval）
⑤ 预览 + 明确采用：character-proposal:approve                            ← 通道已有
        └─ 写入 roster（create / map / keep-unresolved 三选一）
⑥ 【P1 新增 B】角色卡管理界面提供同一入口（与 P2 共用）
```

**关键判断**：③⑥ 是本设计**唯一要新增的实现**；④⑤ 是**接线**（已有）；①② 是**零改动**。

### 4.2 缺口 G1/G3 的具体设计（UI 侧）

新增一个**共享组件**（P1、P2 共用，见 P2 设计稿）：

```
src/components/characters/BlueprintCharacterSyncButton.tsx
```

职责边界（与既有 `CharacterCardImportButton` 对齐，保持交互一致）：

- **输入**：不接收名字列表（安全边界：renderer 名字不授权写入）。
  只接收 `projectKey`，内部调 `listPendingDirectoryCharacterSyncs()` 拿到 **operationId**。
- **展示**：若存在 pending 操作，显示角标/文案「有 N 个蓝图新角色待建卡」。
- **动作**：点击 → 调 `retryDirectoryCharacterSync(operationId)`（**注意语义**：它只 stage 提议，
  不写 roster，见 `directory-character-sync-recovery.ts:49-50` 注释）→ 拿到 `CharacterProposalBatch`
  → 打开既有的**预览/选择面板**（`CharacterProposalSelectionPanel`）。
- **可编辑**（作者确认要自由度，但**投入程度「酌情」**，见 §8 决策 4）：预览面板里作者**可逐字段编辑**候选，
  编辑走既有的 `ApproveCharacterProposalRequest.edits`（`character-proposal.ts:54-55`），**不新造编辑通道**，
  也**不额外扩展**编辑能力（不做富文本/字段级高级编辑）。
- **确认**：面板确认后走**既有的** `character-proposal:approve`（与 `AdoptGeneratedCharactersCommand` 同源）。

> ⚠️ **命名澄清**：`retryDirectoryCharacterSync` 这个名字有歧义（"retry" 听起来像 recovery）。
> 建议在 P1 里**新增一个语义清晰的包装** `stageBlueprintCharacterProposals(operationId)`，
> 内部复用同一条通道，避免把「正常路径」写成「重试路径」。**这只是命名/入口层，不改主进程逻辑。**

### 4.3 缺口 G2 的设计（候选集语义）

**问题**：`character_sync_input` 是**整份蓝图**（含所有 `characters`），
但只有 `newCharacterCandidates` 是「值得建卡」的。若 stage 时把路人角色也建成候选，会污染 roster。

**设计**：候选集**只取 `newCharacterCandidates`**，依据是既有契约：

- `blueprintCharacterSyncFactError`（`blueprint-character-sync-evidence.ts:69`）**只对 `newCharacterCandidates` 强制要求落卡**，
  对普通 `characters` 不作要求（注释 `:59-61`：*"Ordinary blueprint-only names remain chapter-scoped planning references."*）。
- 因此 P1 的 stage 应产出**与该校验同源**的候选集 —— 二者必须一致，否则会出现
  「校验要求有卡、但生成候选时没生成」或反之的不一致。

> **待确认（需在实施前用代码核实）**：主进程 `characterProposals.stage({kind:'directory'})`
> 当前是否已经**只**筛 `newCharacterCandidates`。若是 → 本缺口无需改动（只补测试固化）；
> 若否 → 需在主进程侧收敛（**优先在主进程改，而非 renderer**，以守住「renderer 不授权写入」边界）。

### 4.4 缺口 G4 的设计（归属语义 + 溯源 notes）

**归属**：作者明确 —— **副本 / 主线的归属通过 notes / arc 文本承载，不加结构字段**。

- 生成候选时，`CharacterStaticFields` 的 `arc` / `notes` 字段**照常承载**这类文本
  （`character-proposal.ts:5-17` 已有这两个字段，无需扩展）。
- **不做**任何「副本 ID / 区域 ID」结构字段。
- 预览面板（`formatCharacterProposalPreview`）**已会展示** `arc`/`notes`（`character-proposal-preview.ts:28` 的 labels 含两者），
  作者在确认时可见可改。

**溯源（作者确认要预填）**：候选生成时，`notes` **预填**「来源：第 N 章蓝图」。

- 第 N 章来自 `newCharacterCandidates` 所属蓝图的 `chapterNumber`（数据已在冻结输入里）。
- 若候选来自多个章节，按「来源：第 3、7 章蓝图」聚合。
- **可编辑**：作者可在预览面板改掉该文本（符合「要自由度」的决策）。

---

## 5. 4 个缺口的落实清单（作者原话逐条对应）

| 作者原话缺口 | 本设计对应 | 改动性质 |
|---|---|---|
| 1. **生成命令** | 复用 `character-proposal:stage`（已有）；P1 只补一个语义清晰的 renderer 包装 | 接线 |
| 2. **审核列表** | 复用 `CharacterProposalSelectionPanel` + `character-proposal:approve`（已有） | 零改动 |
| 3. **UI 入口** | 新增 `BlueprintCharacterSyncButton`，挂在**角色卡管理界面**（`CharactersView`）+ 蓝图提交后提示 | **新增** |
| 4. **归属语义** | 用 `arc` / `notes` 文本承载，不加结构字段 | 零改动（受约束） |

---

## 6. 验收标准

1. **功能**：蓝图含 `newCharacterCandidates` 时，角色卡界面能显示待建卡数量，
   点开能走完「预览 → 明确采用 → 落卡」。
2. **不误伤**：普通 `characters`（路人）**不会**因此被建卡。
3. **生效验证**：落卡后，对该角色所在章节重新生成草稿，
   用**逐字计数断言**证明该角色档案**确实进入**了请求（沿用 `p1-literal-dedup` 的测试手法）。
4. **安全边界**：renderer 传的名字**不能**直接授权 roster 写入；
   候选集只能由主进程按 SQLite 冻结输入推导（沿用 `blueprint-character-sync.ts` 注释契约）。
5. **不破坏既有**：`CHARACTER_AUTHOR_ROSTER_NOT_READY`、`CHARACTER_PROPOSAL_*` 既有错误语义保持；
   `blueprintCharacterSyncFactError` 的校验结论不变。
6. **回归**：`tsc --noEmit` EXIT=0；定向测试全绿；
   全量扫描失败集与基线一致（判读方法见 backlog 附录）。

---

## 7. 风险与边界

| 风险 | 说明 | 缓解 |
|---|---|---|
| **R1 污染 roster** | 把路人角色建卡 | 候选集**只取 `newCharacterCandidates`**；预览面板默认 `keep-unresolved`（已有默认逻辑，`character-proposal-preview.ts:9-11`） |
| **R2 安全边界回退** | 为图方便让 renderer 传名字 | **禁止**。坚持「renderer names never authorize roster writes」 |
| **R3 事务内调 AI** | 蓝图提交是本地事务 | AI 只在 ④ 独立调用；提交事务零 AI |
| **R4 与 P2 重复造入口** | P1、P2 各写一套 UI | **共用** `BlueprintCharacterSyncButton`（P2 设计稿同步约束） |
| **R5 破坏 ADR 0020** | 误删作者资料 | 只做「新增候选/落卡」，不删改既有角色；落卡走既有 approve 链路 |
| **R6 命名歧义** | 复用 `retryDirectoryCharacterSync` 会让「正常路径」看起来像 recovery | 新增语义化包装（§4.2 注） |

---

## 8. ✅ 作者已确认的决策（2026-10-10）

| # | 问题 | 作者决定 |
|---|---|---|
| 1 | 触发时机 | **两者都要**：①蓝图提交后**自动提示**；②角色卡界面**永久显示角标**。<br>⚠️ 自动提示**必须在设置里可关闭**（作者原话：「否则批量生成的时候提示会干扰体验」）。<br>**角标不受该开关影响，始终存在。** |
| 2 | 候选 notes 溯源 | **要预填**「来源：第 N 章蓝图」。 |
| 3 | 是否先做只读检测 | **不需要**。作者原话：「只读检测就没必要了吧，**甚至可能还需要可以编辑**，以提供自由度。」<br>→ 候选**可编辑**（`CharacterProposalSelectionPanel` 已支持 `edits`，见 `character-proposal.ts:54-55`）。 |
| 4 | 可编辑的投入程度（第三轮补充） | **「酌情做就好」**。作者原话：「你要**明确目标是生成一个角色的模板，当然越精确越好，越具有张力越好**。但实际上角色卡在现有功能后续都是可以由作者自行查阅修改的。所以说，在可修改这一块，其实也不是那么重要，酌情做就好。」<br>→ **沿用既有 `edits` 通道即可，不额外扩展编辑能力**；重心放在**生成质量**（来源 D 提示词）。 |

### 8.1 设置开关的具体设计（响应决策 1）

新增一个设置项，控制「蓝图提交后的自动提示」：

- **开关语义**：`autoPromptBlueprintCharacterSync`（暂名）——
  **开**：蓝图提交后，若有待建卡候选，弹提示/toast；
  **关**：不弹任何提示，但**角色卡界面的角标照常显示**。
- **默认值**：建议**开**（首次使用者更容易发现该功能）。若作者倾向「默认安静」，可改默认关 —— **待确认**。
- **放置位置**：`src/components/settings/` 下的设置面板（可放 `PromptSettings` 或新建一个「角色卡」分组）。
- **持久化**：沿用本仓库既有设置持久化方式（实施期确认具体机制，本仓库偏好 store + 持久化，不新造一套）。

### 8.2 角标的具体设计（响应决策 1）

- **数据源**：`listPendingDirectoryCharacterSyncs()`（已有），返回数量即角标数字。
- **生命周期**：**始终存在**（不随提示开关关闭）；`0` 时不显示。
- **刷新时机**：进入角色卡界面 / 蓝图提交后 / 落卡完成后。

---

## 9. 实施顺序建议（获批后）

1. **Step 0（零风险）**：加**只读检测测试**固化不变量 ——
   「主进程 stage 的候选集 == `newCharacterCandidates`」。
   ⚠️ 注意：**这是测试，不是产品功能**；作者已明确产品侧**不需要**只读检测环节。
   若发现候选集与契约不一致，即触发 §4.3 的主进程收敛。
2. **Step 1**：补 renderer 语义化包装 + 共享入口组件（含角标/空态）+ `notes` 预填溯源。
3. **Step 2**：接入 `CharactersView` 角标；接入「蓝图提交后自动提示」+ 设置开关。
4. **Step 3**：补「落卡后角色进入 Prompt」的逐字断言验收测试。

---

## 10. 仍需确认的小问题

> ✅ **三个问题均已在作者第二轮答复中闭合**，本节转为「已闭合」记录（含我采纳的默认值）。

1. **自动提示的默认值** —— ✅ **默认：开**。
   作者第二轮明确要求「**提交后自动提示**」是需要的功能，只是要能关掉；且关掉的理由是
   「批量生成的时候提示会干扰体验」这一**特定场景**，而非默认不提示。
   → 默认开，设置项 `autoPromptBlueprintCharacterSync` 可关（见 §8.1）。

2. **提示形态** —— ✅ **toast**。
   依据同上：作者担心的是「干扰」与「阻塞」，toast（轻量、自动消失、不阻塞）正好对症。
   对话框只用于**用户主动点击**进入的落卡流程（§4.2 的 `BlueprintCharacterSyncButton`）。
   ⚠️ 唯一例外：若候选数为 0，则**不弹**任何提示（无意义提示也是干扰）。

3. **设置项归属** —— ✅ **放「提示/创作」设置组**，**不新建**设置组。
   理由：单独为 1 个开关建一个分组，收益远小于用户找设置的成本；且该开关语义上属于
   「何时提示我」，与提示类设置同组最自然。

> **⭐ 补充（作者第二轮的硬约束）**：无论设置开关如何，**角色卡界面的角标必须一直存在**（见 §8.2），
> 二者互不依赖 —— 开关只管「是否自动弹 toast」，角标是**常驻的可见性**。

---

## 11. 设计闭合声明

| 项 | 状态 |
|---|---|
| P1 设计（本文） | ✅ 已定稿（作者第 1/2 轮决策已全部落表，§10 三问已闭合） |
| P2 设计（`p2-character-card-ai-generation.md`） | ✅ 已定稿（作者第 1–7 轮决策已全部落表，开放项 0） |
| 待作者确认的开放项 | **0** |
| 下一步 | **等待作者放行 → 按 §9 实施顺序 + P2 §7 的 Step 0 → Step 6 执行** |

---

## 12. 实施记录（作者放行后）

| Step | 内容 | 状态 | 落点 |
|---|---|---|---|
| 0 | 候选集不变量只读测试 | ✅ 13/13 通过 | `src/services/workflows/__tests__/blueprint-character-candidate-invariants.test.ts` |
| 1 | 合并入口（来源多选 + 模型披露 + 历史回看） | ✅ | `CharacterCardGenerateButton.tsx`、`character-proposal-history-client.ts`、`character-proposal-service.ts:listHistory` |
| 2 | 来源 B 主路径 + 角标 + 提交后提示（含设置开关） | ✅ | `App.tsx`、`SettingsModal.tsx`、`ipc-channels.ts` |
| 3 | 「卡落地 → 进 Prompt」逐字验收 | ✅ | `generate-draft.command.test.ts`（两条 P1 acceptance） |
| 4 | 来源 D prompt 打磨（三条硬要求 + 关系锚点清单） | ✅ | `src/shared/character-background-prompts.ts` |
| 5 | 关系绑定 UI（三选一，默认暂不采用） | ✅ | `CharacterProposalSelectionPanel.tsx` |
| 6 | 已有角色出边（service 放开 `sourceCharacterId` + 面板底部勾选） | ✅ | `character-proposal-service.ts:296-321`、`character-proposal.ts`、`CharacterProposalSelectionPanel.tsx` |

### 12.1「让旧版生效」的真实语义（Step 1 补完）

初版只做到「读回批次 → 确认 → toast」，**没有真正恢复**。已改为：

1. 用该条记录自己的 `source` 调 `character-proposal:stage` 重新 stage。
   `stage` 对 `proposalBatchId` **幂等**（`proposalBatchId` 由 source 派生），因此拿回的就是同一个批次，
   **不重跑模型**、不原地改写旧 envelope、不新增记录。
2. 确认面板绑定在**等待中的运行**上（`workflow-store.ts:723-741` 只认 `status === 'waiting'` 且有
   `context.data.characterProposalBatch` 的 run），所以新建一个**只有确认步**的运行
   （`createCharacterProposalReviewWorkflow`）承载 `operationId`，而后走既有的采用闸门。

> 为什么不能把批次直接塞进 store：`setCharacterProposalChoices` 要求 `run.status === 'waiting'`
> 且该 run 的 `context.data.characterProposalBatch` 已存在（`workflow-store.ts:436-450`）。
> 孤儿批次没有可提交的 `operationId`，塞进去只会得到一个点不动的面板。

### 12.2 Step 6 为什么「存储层零改动」

`character-roster-repository.ts:1157` 的 `CharacterIdentityCommitRequest.relationships[]` 早已是
`{ sourceCharacterId?, sourceSelectionKey?, targetCharacterId?, targetSelectionKey?, relation }`，
`endpoint()`（同文件 `:1240-1245`）对**两个端点一视同仁**。唯一缺的是 service 构造器只从
`sourceSelectionKey` 解 `from`（`character-proposal-service.ts:296-305`），故本次只放开这一处 +
shared 类型加可选字段。已用测试验证：`sourceCharacterId` 存在的行会原样进入
`identityRequest.relationships`，且**校验该 id 是未退休的真实角色**（否则 `CHARACTER_ID_UNKNOWN`）。

### 12.3 Step 5 的「蓝图待建角色」为什么不进 approve 请求

它是**作者意图**而非关系：目标还没有卡，没有任何 id 可指。若强行塞进 `relationships`，
存储层会在 `endpoint()` 处抛 `CHARACTER_RELATIONSHIP_ID_REQUIRED`。因此单独放在
`choices.blueprintPendingRelations`，只作为标记保留下来，供 P1 候选集复用。已有测试断言
「`陆危楼` 不出现在序列化后的 approve 请求里」。
