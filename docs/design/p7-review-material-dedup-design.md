# P7 · 审稿链材料去重（世界观 / 角色状态重复注入）

> 版本：**v2**（2026-10-16）。**已实施**。裁定见 §9；实施记录见 §10。
> 登记来源：`docs/plans/prompt-assembly-backlog.md` P7；同批取证见 `docs/design/c1-review-architecture-declaration-design.md` §8.1.3。
> 触发：作者实测「审稿的负荷比写正文还大」+ 某供应商模型上下文有限、**第一次审稿失败**（`finishReason: 'length'`、输出为空，两次调用均失败）。
>
> ## 裁定（2026-10-16，作者）
>
> - **D1**：走**方案 E**（材料块按链参数化省略）。
> - **D2**：排除范围 = **`worldbuilding` + `characterStates` 两个**。
> - **D3**：**后续蓝图不动**（作者：「你的理由很充分，不动」）—— 它不重复，是否边界化属独立议题（§7）。

---

## 1. 现状取证（作者项目 ch2 审稿 trace，2026-10-16）

**口径**：全部读 `ioCalls[].messages[].content`（红线 15），不读 `snapshots[].built`。

| 项 | 读数 |
|---|---|
| 审稿 user | **32,442 字** |
| 正文 user（同章） | **16,388 字** |
| 比例 | 审稿 = 正文的 **1.98 倍** |
| `【世界观设定】` 块 | **出现两次** |
| 　· 模板侧（@8150 → 【审查原则】） | **6,220 字** |
| 　· 材料侧（@18800 → 【作者角色状态】） | **6,221 字** |
| 世界观合计 | **12,441 字 = user 的 38.3%** |
| `【角色状态】` / `【作者角色状态｜以标注时点为准】` | 两侧均「（暂无）」⇒ **本次未显形，但同源**（见 §2.2） |
| `【全局摘要】`（模板侧，定稿历史） | 4,346 字 —— **不重复**（见 §2.3） |
| 首次审稿 | 两个 ioCall 均 `finishReason: 'length'`、`output` 为空 ⇒ **预算不够** |

---

## 2. 根因

### 2.1 两条正交机制，各注入一次

`review-chapter.command.ts` 的 `ordinaryReviewPrompt` 由两段拼成：

```ts
const builder = new ReviewPromptBuilder(template, language)
  .withChapterContent(frozen.source.content)
  .withCharacterStates(frozen.characterStates)          // ← 机制①：模板变量
  .withGlobalSummary(...finalized-history...)
  .withWorldBuilding(frozen.worldbuilding)              // ← 机制①：模板变量（世界观第一份）
  .withReviewFocus(...)
const ordinaryReviewPrompt = [
  builder.build(),
  ...admission.admitted.filter(m => m.category !== 'finalized-history').map(m => m.text),  // ← 机制②：材料块（世界观第二份）
  ...合同块...
].join('\n\n')
```

机制② 的 author 材料 = `reviewRevisionAuthorMaterial(frozen)`（`review-revision-generation.ts:96`），其中 `:121` 就写着：

```ts
text('【世界观设定】', '[Worldbuilding]'), authorText('worldbuilding', context.worldbuilding),
```

⇒ **同一份 `worldbuilding` 既经模板变量、又经材料块进请求**。两条机制各自正确，**叠加后重复**。

### 2.2 重复的不止世界观：角色状态**同源**

| 模板侧 | 材料侧 | 是否同源 |
|---|---|---|
| `.withCharacterStates(frozen.characterStates)` → `{{character_states}}` | `context.characterStates` → `【作者角色状态｜以标注时点为准】` | ✅ **同一字段** |

本次两侧都是「（暂无）」（作者未填）⇒ 没显形；**一旦作者填了角色状态，就会重复**。⇒ 本项必须**同时**处理两个字段，不能只治世界观。

### 2.3 定稿历史**不重复**（既有设计正确，勿动）

- 模板侧 `withGlobalSummary(admission.admitted.filter(m => m.category === 'finalized-history'))`
- 材料侧 `...admission.admitted.filter(m => m.category !== 'finalized-history')`

⇒ **按 `category` 互斥分流**，各取一半，**无重叠**。这是对的，本项**不得**改动这条分界。

### 2.4 只发生在审稿链

| 链 | builder 是否注入 worldbuilding / characterStates |
|---|---|
| 正文 `generate-draft` | 注入 `architecture`（**已投影**，P1-2a） |
| **审稿 `review-chapter`** | **注入 worldbuilding + characterStates** ⇒ **与材料块重复** |
| 精修 `refine-from-review` | **不注入** ⇒ 只有材料侧一份 ✅ |
| 改写 `refine-draft` | **不注入** ⇒ 只有材料侧一份 ✅ |

⇒ **修法只应落在审稿链**，不动共用材料的通用行为（否则会把精修/改写的**唯一**世界观来源也砍掉）。

---

## 3. 关键前置核实（决定可行性）

| # | 问题 | 核实结果 |
|---|---|---|
| 1 | 内置 `consistency_check` 有 `requiredContextVariables` 吗？ | ❌ **没有**（`:1200` 定义块无该字段）⇒ 模板侧变量留空**不会触发兜底注入**（红线 16 不适用） |
| 2 | **作者覆盖版** `consistency_check` 有吗？ | ❌ **也没有**；且 `{{world_building}}` 在覆盖版 content 里**只引用一次**（`【世界观设定】\n{{world_building}}`）⇒ 排除材料侧后**不丢信息** |
| 3 | 材料块是几链共用？ | ⚠️ **三链共用**（审稿 / 精修 / 改写）⇒ **不能在 `reviewRevisionAuthorMaterial` 里无条件删字段**（会毁掉另两链的来源） |

⇒ 结论：**可行，但必须「按链参数化」，不能全局改**。

---

## 4. 方案

### 方案 A：审稿链不调 `withWorldBuilding` / `withCharacterStates`（模板侧留空）

- **改动**：审稿链删两行 builder 调用。
- **缺点**：模板 prompt 出现**两个空节**（`【世界观设定】` 与 `【角色状态】` 只有标题没有内容），与材料侧同名标题并存 ⇒ 模型可能困惑。
- **优点**：改动最小（两行）。

### 方案 E（**推荐**）：材料块按链**参数化省略**已由模板侧注入的字段

- `reviewRevisionAuthorMaterial(context, options?: { omit?: ReadonlyArray<'worldbuilding' | 'characterStates'> })`
  ⇒ `omit` 命中时跳过对应两行（标题 + 内容一起跳过，不留空节）。
- `selectFrozenReviewRevisionMaterials(frozen, current, options?)` 透传。
- **审稿链**传 `omit: ['worldbuilding', 'characterStates']`；**精修/改写不传**（行为不变）。
- **优点**：模板侧结构**完整**（世界观仍在模板的 `【世界观设定】` 节下）；材料块**不留空节**；另两链**零影响**；未来要排除别的字段只是往数组里加一项。
- **缺点**：动共用函数（但通过**可选参数**，默认行为不变 ⇒ 属零破坏扩展）。

### 方案 C：不动

保留现状（-19.2% 不省）。

---

## 5. 实施形态（按方案 E）

| 文件 | 改动 |
|---|---|
| `src/shared/review-revision-generation.ts` | `reviewRevisionAuthorMaterial` 加可选 `options.omit`；命中时跳过 `【世界观设定】`/`【作者角色状态｜以标注时点为准】` 两行。**默认（不传）行为逐字不变** |
| `src/services/workflows/commands/review-revision-materials.ts` | `selectFrozenReviewRevisionMaterials` 加可选第三参并透传 |
| `src/services/workflows/commands/review-chapter.command.ts` | `:54` 调用处传 `{ omit: ['worldbuilding', 'characterStates'] }`；**不动** `:72` / `:70`（模板侧保留） |

**预期读数**：审稿 user **32,442 → ~26,200**（省 ~6,221 = -19.2%）。角色状态当前为空，将来填充后另省。

---

## 6. 风险与边界

| 风险 | 说明与对策 |
|---|---|
| 碰准入哈希 | `materialDecisions.promptHash` 记录实际 prompt ⇒ 结构一变必然变。**这是预期的**（prompt 确实变了），同步 `review-revision-runtime.test.ts` 等断言即可（该处 `promptHash` 是**动态**断言 `hash(prompt)`，非硬编码基线） |
| 作者覆盖版引用 | 已核实只引用一次且无 `requiredContextVariables` ⇒ 安全。**但**若作者日后覆盖版**新增**对 `{{world_building}}` 的依赖，本方案的排除仍正确（内容由模板侧提供） |
| 材料块来源身份 | `sourceId: 'author:required'` 不变；只是 `text` 变短 ⇒ `contentHash` 随之变（正常） |
| **不得**顺手改的 | §2.3 的 `finalized-history` 互斥分界；材料准入的 `ChapterMaterialCapacityError` 硬失败语义；精修/改写的材料行为 |
| 回归面 | 审稿链（`review-chapter`）+ 材料层（`review-revision-materials`）；另两链仅需**确认零变化** |

---

## 7. 不做（本项范围外，单列）

- **后续蓝图全量**（`【后续蓝图/计划｜非既定历史】` **3,417 字**，只有一份、不重复）：正文链已由 P1-1 压到 **729 字**边界清单，但审稿链仍吃全量。**是否也边界化需独立裁定** —— 审稿判断「本章是否提前写了后续章内容」可能需要细节，与写作侧不同。**本项只做「去重」这件无争议的事**。
- 正文链的 `architecture`（已由 P1-2a 投影）、`future_blueprints`（已由 P1-1 边界化）。

---

## 8. 裁定项

| # | 事项 | 裁定 | 结果 |
|---|---|---|---|
| **D1** | 走哪个方案 | **E**（参数化省略） | ✅ 已实施 |
| **D2** | 排除范围 | **`worldbuilding` + `characterStates`**（不止世界观） | ✅ 已实施 |
| **D3** | 后续蓝图全量（3,417 字）是否同批处理 | **不同批**（作者：理由充分，不动） | ⏸ 仍登记于 §7 |

---

## 9. 实施记录（2026-10-16）

| 文件 | 改动 |
|---|---|
| `src/shared/review-revision-generation.ts` | 新增 `ReviewAuthorMaterialOmittable` 类型；`reviewRevisionAuthorMaterial(context, options?)` 支持 `omit`。**默认（不传）行为逐字不变** |
| `src/services/workflows/commands/review-revision-materials.ts` | `selectFrozenReviewRevisionMaterials(frozen, current, options?)` 第三参透传 `omitAuthorFields` |
| `src/services/workflows/commands/review-chapter.command.ts` | `:54` 传 `{ omitAuthorFields: ['worldbuilding', 'characterStates'] }`。**`:70`/`:72` 模板侧注入保持不动** |

### ★ 实施时发现的一个**静默丢数据**风险（已在代码中封住）

`reviewRevisionAuthorMaterial` 里有一段**前缀去重**：若某来源原文与另一来源的**完整前缀**相同，就把它替换成「（本来源原文与 X 的完整前缀相同，见该来源原文。）」。

⇒ 若照搬省略 `worldbuilding`、却**留着它当比较基准**：当 `config.worldSetting` 恰是 `worldbuilding` 的完整前缀时，`worldSetting` 会被换成「见 worldbuilding 原文」——**而那份原文并不在 prompt 里** ⇒ **作者设定静默丢失**。

**修法**：省略 `worldbuilding` 时，**同时把它从 `sources` 比较基准数组中移除**（`review-revision-generation.ts` 内已加注释说明）。测试 §`★ 边界` 用「不 omit 会替换 / omit 后必须保留原文」**双向**锁住该行为。

### 测试

- 新增 `src/shared/__tests__/review-revision-author-material.test.ts`（**6 例**）：默认不变（回归锁）/ 单省 / 双省 / 其余材料完整 / ★ 前缀边界双向 / authorInputs 不受影响。
- `review-revision-runtime.test.ts`：新增 `authorMaterialFor(operation, context)` helper —— 测试须按同一契约取值（审稿链含 `recheck` 走 omit 版；修稿链不 omit），否则会拿「完整版」比对「省略版」的 prompt（这正是本次先红 3 例的原因）。
- **验证读数**：目标 2 文件 **52/52** · 其余下游 4 文件 **128/128** · `tsc --noEmit` **0**。

### ⚠️ 实施后修复（同日）：`GENERATION_MATERIAL_DECISION_INVALID`

**实机报错**：`[第 2 章 · 审稿] generation:bind-material-decision → Error: GENERATION_MATERIAL_DECISION_INVALID`。

**根因**：本项改动**只落了一处消费点**。`reviewRevisionAuthorMaterial` 的生产调用点有**两处**：

| # | 位置 | 作用 |
|---|---|---|
| 1 | `src/services/workflows/commands/review-revision-materials.ts:25` | 渲染层构造 prompt 与 `materialDecision.contentHash` |
| 2 | **`electron/services/generation-source-binding.ts:330`** | **主进程**校验时**重算同一文本**比对哈希 |

⇒ 渲染层按 omit 版算 hash、主进程按**完整版**重算 ⇒ 必然不等 ⇒ 校验失败（`:335 fail`）。

**修法 —— 单点判定，两侧共用同一函数**（杜绝再次漂移）：

```ts
// src/shared/review-revision-generation.ts
export function authorMaterialOmitForOperation(operation: string) {
  return operation === 'review-chapter'   // 白名单式：只有审稿链省略
    ? { omit: ['worldbuilding', 'characterStates'] }
    : undefined                            // 新增 operation 默认不省略（宁可重复，不可丢材料）
}
```

- 渲染层（`review-chapter.command.ts`）与**主进程**（`generation-source-binding.ts:330`）都调它。
- 测试同样调它 ⇒ 契约漂移会被用例直接抓住。

**★ 教训（已入 notes 判据 E）**：**改「某函数在某个调用点的行为」时，必须先枚举该函数的全部生产调用点**——本函数的第二处调用点在**另一个进程**（`electron/`），且其作用恰是"重算以核对"，最容易漏。

### ✅ 实机复验通过（2026-10-16 04:1x，作者项目 ch2）

| 项 | P7 前（`20261016-032228-330`） | P7 后（`20261016-041342-832`） |
|---|---|---|
| 审稿 user | **32,442 字** | **26,349 字** |
| `【世界观设定】` **块标题**数 | **2** | **1** ✅ |
| 降幅 | — | **-18.8%**（省 6,093） |

- ✅ **`GENERATION_MATERIAL_DECISION_INVALID` 已消失**：修复前的失败运行（`20261016-034745-951`）**无 `ioCalls`**（未发请求）；修复后（04:10 起）正常发请求。
- ✅ **审稿质量未见受损**：成功那份报告 3 warning + 3 pass，warning **全部真实可核验**（① 与第 1 章"被裁第三天"冲突的"上周都在家投简历"；② 同一动作内"空文件夹"vs"有表格文件"自相矛盾；③ 冻结目标要求"敲桌"而正文写"敲工位隔板"⇒ 目标证据不完整）。
- ⚠️ **同一 rootAction 的 04:10 那次仍 `finishReason: 'length'` + 输出为空（两次调用）** —— 作者换模型后 04:13 成功。**与 P7 无关**（P7 已省 18.8%）；更像该供应商模型的**输出预算/上下文**限制。
  - ⇒ 若后续仍被此困扰，**下一个可压项 = §7 的后续蓝图全量**（材料块 3,417 字，正文链同类内容已压到 729 字）⇒ 约再省 2,700 字（-10%），但属独立议题（D3）。
- ✅ 附带确认：**修稿链的 C1 声明同样生效**（精修 trace `20261016-042054-108` 的 user 含 `【远期设定使用规则】`），且精修的 `【世界观设定】` 本来就只有一份（**不受 P7 影响**，符合 §2.4）。

### ⏳ 待实机复验

重启 `pnpm dev` 后跑一次审稿，核对：审稿 user 由 **32,442 → ~26,200**（-19.2%）；且请求里 `【世界观设定】` 的**完整内容只出现一次**（模板侧），材料侧不再重复。

---

## 9. 红线自查

- ✅ 不改 DB schema、不改模板 content/taskGuidance、不动 `requiredContextVariables`（两侧都没有）。
- ✅ 改动是**可选的**参数（默认行为逐字不变）⇒ 对精修/改写**零影响**。
- ✅ 不碰 §2.3 的 `finalized-history` 互斥分界。
- ⏳ 改的是**模型可见的 prompt 结构** ⇒ 动手前须按惯例核硬编码基线（含 `context-entry-parity`）。
