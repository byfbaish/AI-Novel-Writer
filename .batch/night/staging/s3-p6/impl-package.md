# P6 档1 实施包 · 叙事线索候选章区间化（≤10）＋每章 token 预算闸＋档3 进度建议

- 卡：`342b428f`（S3 / stage 3）
- 判定面：`8a42a566`（`wt-2`，分支 `card/s2-c1-relevance-and-diff`，`git status --porcelain -uall` 0 行）
- 交付分支：`card/s3-p6-range`，起点 `8a42a566`
- 设计稿：`docs/design/architecture/p6-narrative-thread-range-design.md`（161 行，2026-11-24）
- 性质：**只动叙事线索候选这一条线**；蓝图 10 章链路、C1 的 16 件、图形生成契约一律不动
- 本包三处**按项目总负责人 2026-11-24 裁定覆盖设计稿**（见 §3.1、§3.2、§6.2），其余以设计稿为准

> **槽位表口径**：`docs/agents/worktree-parallel.md` 的槽位表仍写「wt-2 给 WorkBuddy、wt-1 给豆包」，与派单点名冲突。**以派单为准**（本卡在 `wt-2`）；该文档本卡不改，槽位表更新另记，派单里不得再报「冲突」。

---

## §1 现状（判定面 `8a42a566`，逐条实测）

| 事实 | 位置 |
|---|---|
| UI 只有「蓝图章节」**单选**，选中章号存一个标量 | `src/components/editor/NarrativeThreadEditor.tsx:1049-1053`（`NativeSelect`）、`:226`（`aiBlueprintChapter`）、`:579`、`:365` 初始化 |
| 生成入口先按章号找蓝图，再走图生成 | `src/components/editor/NarrativeThreadEditor.tsx:586-614`；`:600` `startGraph({ kind:'plan', chapterNumber: blueprint.chapterNumber }, frozenModelId)` |
| 生成器输入是**单章** | `src/services/narrative-thread-candidate-generator.ts:30`、`:62` |
| 单次请求预算固定 4096 | `src/shared/narrative-thread-generation-pure.ts:38-43`（`NARRATIVE_THREAD_CANDIDATE_BUDGET.maxRequestedOutputTokensPerAttempt = 4096`） |
| 图生成输入契约**只认单章** | `src/shared/graph-generation.ts:9`（`{ kind:'plan'; chapterNumber:number }`）、`:16-17`（context 绑同一形状）；绑定测试 `electron/services/__tests__/generation-source-binding.test.ts:34`；`electron/services/graph-generation-source.ts:49` |
| 落库的计划行**本来就是区间** | `electron/repositories/narrative-thread-repository.ts:19`（`validatePlan` 校验起止章）、`:51-53`（`INSERT` 写 `target_start_chapter`/`target_end_chapter`）、`:41-44`（`rowToPlan` 回读） |
| 章号事实源＝已定稿草稿 | `electron/repositories/narrative-thread-repository.ts:137-139`（`SELECT COALESCE(MAX(chapter_number),0) FROM drafts WHERE status='finalized'`） |
| 区间闸与上限**已存在** | `src/shared/plot-outline-contract.ts:9`（`PLANNING_ACTION_CHAPTER_LIMIT = 10`）、`:20-23`（`assertPlanningActionRange` 抛 `GENERATION_PLANNING_RANGE_INVALID`） |
| 每章结构化预算的唯一现值来源 | `src/services/generation/task-budget-planner.ts:4`（`S07_TASK_BUDGET_POLICY`；`:17` `structuredItems.baseTokens = 512`、`:22` `zh-CN.planning = 3_072`、`:23` `en-US.planning = 2_048`） |
| **算式已经存在，只是私有** | `src/services/generation/task-budget-planner.ts:174-183`（`outputTokensFor`：`base + quantity × tokensPerItem[lang][stage]`，N=0 返回 0）；本卡**只加 `export`**，函数体与数值零改动 |
| 单次请求硬顶 | `src/services/generation/generation-harness.ts:103-109`（`GENERATION_ABSOLUTE_BUDGET_LIMITS`，`:108` `maxRequestedOutputTokensPerAttempt = 32_768`） |
| 提供商输出上限（同一数字的第二处证据） | `src/shared/provider-presets.ts:106`、`:118`（`maxOutputTokens: 32_768`） |
| 单元边界与单元内名义上界 | `src/shared/generation-owner-contract.ts:64-73`（`ArchitectureUnitRange {from, unitIndex, maxChapters, volumeRemaining}`）；`src/services/workflows/synopsis-unit-launch.ts:431-462`（`probeSynopsisUnitLaunchForProject`，**永不抛错**） |
| `maxChapters` 是**名义上界**，不是产出接受带 | `src/shared/plot-outline-contract.ts:135-137` 注释、`generation-owner-contract.ts:69` |
| 已定稿章列表已进面板 | `src/components/editor/NarrativeThreadEditor.tsx` 的 `finalizedDrafts`（来源 `db:draft-list-all`，`src/shared/ipc-channels.ts:1154`）；该状态在 `:360` 已 `filter(draft => draft.status === 'finalized')`，**不是全量草稿** |
| 失败判定已有现成口径 | `src/services/narrative-thread-candidate-generator.ts:40-41`（`outcome.status !== 'completed' \|\| outcome.finishReason !== 'stop'` ⇒ 失败） |

**不得动的既有边界（重复三遍也不多）**：`PLANNING_ACTION_CHAPTER_LIMIT` 值、蓝图 10 章链路（`src/services/workflows/commands/architecture.command.ts:319`/`:341`、`src/shared/agent-generation.ts:8-11`）、`GraphGenerationInput` 形状、`NARRATIVE_THREAD_CANDIDATE_BUDGET` 的 4096。

---

## §2 白名单（8 项：4 新增 / 4 修改）

> 新增文件必须一次性列全；除下列 8 项外，任何文件改动都算越界。

### 新增

1. `src/shared/narrative-thread-range-pure.ts` —— 区间与预算的**纯函数**（无 import 自 `services/`，见 §3.3 分层说明）
   - `NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT`（值仍从 `PLANNING_ACTION_CHAPTER_LIMIT` 取，不复制字面量）
   - `narrativeThreadPlanRange(startChapter, chapterCount)` ⇒ `{from, to}`，内部直接调 `assertPlanningActionRange`
   - `NARRATIVE_THREAD_CHAPTER_BUDGET_POLICY`（见 §3.1，数字全部引用 `S07_TASK_BUDGET_POLICY`）
   - `assertNarrativeThreadChapterBudget(...)` / `assertNarrativeThreadBatchBudget(...)`（见 §3.2）
2. `src/shared/narrative-thread-progress-pure.ts` —— 档 3 的**纯函数**
   - `chapterUnionCount(ranges)`、`coveredChapterUnion(plans, unit)`、`narrativeThreadProgress(plans, unit, writtenChapters)` ⇒ `{scanned, written, remaining, suggestion}`
   - 不引用 `maxChapters`（见 §6.2）
3. `src/services/narrative-thread-batch-runner.ts` —— **串行执行器**（注入 `runChapter`，不直接依赖 IPC，可单测）
4. 三个测试文件（与 1–3 同名放各自 `__tests__/`，但**只准建这三件 + 下面一个共 4 个测试文件**）：
   - `src/shared/__tests__/narrative-thread-range-pure.test.ts`
   - `src/shared/__tests__/narrative-thread-progress-pure.test.ts`
   - `src/services/__tests__/narrative-thread-batch-runner.test.ts`

### 修改

5. `src/components/editor/NarrativeThreadEditor.tsx` —— 起点章＋章数两个输入、按章分组候选、失败即停与续跑、档 3 提示条、按 handle 确认
6. `src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx` —— 只**追加**用例（区间派发、失败即停、档 3 条不显示）；既有断言（`:944` `{input:{kind:'plan',chapterNumber:2}}`）**一字不改**
7. `docs/design/architecture/p6-narrative-thread-range-design.md` —— 只在文件头补一行「§3.1/§3.2/§6.2 已由实施包覆盖，现值以本包为准（2026-11-24）」，正文不改
8. `src/services/generation/task-budget-planner.ts` —— **只给 `outputTokensFor` 加 `export` 关键字（`:174`）**；函数体、`S07_TASK_BUDGET_POLICY` 任何数值、其他函数一律零改动

---

## §3 预算：具名常量与三道闸（项目总负责人 2026-11-24 裁定）

### 3.1 常量形状（不复制数字，只引用策略对象）

```ts
// 第 1 步：task-budget-planner.ts:174 加 export（唯一改动）
export function outputTokensFor(
  stage: GenerationReasoningStage,
  demand: TaskBudgetDemand,
  quantity: number,
): number

// 第 2 步：src/shared/narrative-thread-range-pure.ts
import { outputTokensFor, S07_TASK_BUDGET_POLICY } from '../services/generation/task-budget-planner'
import { PLANNING_ACTION_CHAPTER_LIMIT, assertPlanningActionRange } from './plot-outline-contract'
import type { WritingLanguage } from './writing-language'

export const NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT = PLANNING_ACTION_CHAPTER_LIMIT   // 10，不复制字面量

const items = (writingLanguage: WritingLanguage, requestedItems: number) =>
  ({ kind: 'structured-items' as const, writingLanguage, requestedItems })

/** 第 1..N 章的声明需求 = base + N × 每章 planning 预算（复用 S07 唯一算式，不复制数字）。 */
export function narrativeThreadPlanBudget(writingLanguage: WritingLanguage, chapters: number): number {
  return outputTokensFor('planning', items(writingLanguage, chapters), chapters)
}

export const NARRATIVE_THREAD_CHAPTER_BUDGET_POLICY = Object.freeze({
  version: 'narrative-thread-chapter-budget-v1',
  s07PolicyVersion: S07_TASK_BUDGET_POLICY.version,   // 's07-task-budget-v1'
  chapterLimit: NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT,  // 10
})
// 派生值（测试里用 policy 复算，不许在实现里硬写）：
//   zh-CN 单章 = narrativeThreadPlanBudget('zh-CN', 1) = 3,584
//   zh-CN 10 章 = narrativeThreadPlanBudget('zh-CN', 10) = 31,232
//   en-US 单章 = 2,560；en-US 10 章 = 20,992

export function assertNarrativeThreadChapterBudget(writingLanguage: WritingLanguage, perAttemptTokens: number): void {
  const required = narrativeThreadPlanBudget(writingLanguage, 1)
  if (required > perAttemptTokens) {
    throw new Error(`NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED: required ${required} > perAttempt ${perAttemptTokens}`)
  }
}

/** hardCapTokens 由调用方传（UI 传 GENERATION_ABSOLUTE_BUDGET_LIMITS.maxRequestedOutputTokensPerAttempt = 32,768），
 *  不在此模块 import harness，避免 shared → services 的第二处倒置。 */
export function assertNarrativeThreadBatchBudget(
  writingLanguage: WritingLanguage,
  chapters: number,
  hardCapTokens: number,
): void {
  const required = narrativeThreadPlanBudget(writingLanguage, chapters)
  if (required > hardCapTokens) {
    throw new Error(`NARRATIVE_THREAD_BATCH_BUDGET_EXCEEDED: required ${required} (base+perChapter×${chapters}) > cap ${hardCapTokens}`)
  }
}
```

> **分层说明（必须写进代码注释）**：`src/shared/` 反向 import `src/services/generation/task-budget-planner.ts` 是本卡唯一一处分层倒置，理由是「每章 token 预算只能有 S07 策略一个来源」，复制数字就是制造第二份真相。`NarrativeThreadEditor.tsx` 现状已在 import `../services/...`，故也可把本模块整体放 `src/services/narrative-thread-range-budget.ts` 再被 `src/shared/narrative-thread-range-pure.ts` 转发——**二选一，不许两处各写一份数字**。

数值对照（实施包必须的原样，QA 按此复核）：

| 语言 | 每章声明需求 = base + 每章 | 单章请求预算（不动） | 余量 |
|---|---|---|---|
| zh-CN | 512 + 3,072 = **3,584** | 4,096 | 512 |
| en-US | 512 + 2,048 = **2,560** | 4,096 | 1,536 |

| 区间章数 N | 批声明需求 = 512 + 3,072×N | 单次请求硬顶 | 判定 |
|---|---|---|---|
| 1 | 3,584 | 32,768 | 通过 |
| 3 | 9,728 | 32,768 | 通过 |
| 10 | **31,232** | 32,768 | 通过（余 **1,536**） |
| 11 | 34,304 | 32,768 | 超，但**先**被区间闸拒（见 §3.2 顺序） |

### 3.2 三道闸与顺序（顺序本身是判据，不许调换）

1. **区间闸（复用，不新写判断）**：`assertPlanningActionRange({from, to})`
   - `N = 0` / `N = 11` / `to > totalChapters` / `from < 1` ⇒ 抛 `GENERATION_PLANNING_RANGE_INVALID`
   - 文案含上限值 **10**；UI 原样显示，不做「自动缩到 10」
2. **单章预算闸**：`512 + tokensPerChapter[lang] > budget.maxRequestedOutputTokensPerAttempt`（默认 4,096）
   - 超 ⇒ 抛 `NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED`，原文必须含两个数字：`3584`、`4096`
   - 该闸在**开跑前**判，不许在流式响应里截断；截断仍走现有的 `prompt_budget_exhausted`（`src/services/safe-call-diagnostic.ts:35`）
3. **批声明闸**：`base + tokensPerChapter[lang] × N > hardCapTokens`（默认 `GENERATION_ABSOLUTE_BUDGET_LIMITS.maxRequestedOutputTokensPerAttempt = 32,768`）
   - 超 ⇒ 抛 `NARRATIVE_THREAD_BATCH_BUDGET_EXCEEDED`，原文含 `base`、`perChapter`、`N`、`required`、`cap` 五项
   - `hardCapTokens` 必须**可注入**（默认取上面常量），否则 §8 J3 的第二条用例无法构造

**明确禁止**：`32_768 / 10 = 3,276.8` 这类反推值；每章预算随 N 变化；把 base 丢掉只算 `N × perChapter`。

### 3.3 执行形态（设计稿 §3.2 变体 B，已被裁定采纳）

- 区间**展开成 N 次串行单章请求**，并发固定 1；每章请求仍用 `NARRATIVE_THREAD_CANDIDATE_BUDGET`（4,096），**不改该常量**。
- 不新增模型 purpose、不改 `GraphGenerationInput`（仍是 `{kind:'plan', chapterNumber}`，**逐章各一次**）。这样：
  - 无 schema / checkpoint / 绑定迁移；`generation-source-binding.test.ts:34` 不受影响
  - 回退面 = 只回退 UI 循环与两个纯模块

---

## §4 串行执行器语义（失败即停、不丢已产出、不跳过）

`src/services/narrative-thread-batch-runner.ts` 只做调度，产物由注入的 `runChapter` 决定：

```ts
export interface NarrativeThreadBatchChapters<C, H> {
  order: readonly number[]                 // [from..to]
  results: { chapterNumber: number; status: 'ok' | 'failed'; candidates: C[]; handle?: H }[]
  failedChapter: number | null
}
export async function runNarrativeThreadChapters<C, H>(input: {
  range: { from: number; to: number }
  runChapter: (chapterNumber: number, signal: AbortSignal) => Promise<{ candidates: C[]; handle?: H }>
  signal: AbortSignal
  onProgress?: (done: number, total: number, chapterNumber: number) => void
}): Promise<NarrativeThreadBatchChapters<C, H>>
```

写死的语义：

1. 按 `from..to` **顺序**逐章调用；任何两章不重叠执行（不做并发，不做 `Promise.all`）。
2. 第 k 章抛错 ⇒ 记 `failedChapter = k`，**k+1..to 一律不发起**（判据要断言调用次数，不是只看结果）。
3. 已成功章（1..k-1）的 `candidates` **整批保留**，UI 仍可逐章确认；不做「整段作废」。
4. **禁止**：自动跳过失败章、自动减 N、自动缩短文本、自动换模型重试。
5. 外部 `signal` 中止 ⇒ 与失败同等处理（后续章不发起），已落库/已产出保留。
6. 续跑：调用方保留 `{from, to, failedChapter}` 于**会话内 state**（`useState` / `useRef`），不落库；点「从第 k 章续跑」以 `from = failedChapter, to = 原 to` 重新调用。
7. 失败判定文本沿用既有口径（`narrative-thread-candidate-generator.ts:40-41`），不新造错误分类。

**图生成路径（真实 App，`candidateGenerator === undefined`）**：每章 `open` → `execute` → `read` 取 `result.candidates` + `view.handle`，随后 `client.detach()`（`src/services/graph-generation.ts:78`，detach 只置本地标志，不取消主进程 run）。**不保留 N 个 client**；确认时用 handle 重新开一个客户端：`open({handle})`（`:41-52`）→ `confirm(index, handle)`（`:67-77`）→ `detach()`。候选按 `generationHandle` 绑定，`BoundPlanCandidate.generationIndex/generationHandle`（`NarrativeThreadEditor.tsx:181`）已有字段，直接复用。

---

## §5 UI 改动（`NarrativeThreadEditor.tsx`）

1. `aiBlueprintChapter: number`（`:226`）→ `aiRangeStart: number` + `aiRangeCount: number`（默认 `1`）。
   - **默认 1 章**：N=1 时派发的图输入与现状逐字相同（`{kind:'plan', chapterNumber:start}`），既有 `browser.tsx:944` 断言不改即绿；`档3 建议条「采用」`才填 3 章。
   - 起点默认＝当前蓝图章（沿用 `:579`/`:365` 的 `blueprints[0]?.chapterNumber`）；章数输入 `min=1 max=10`。
2. 开跑前依次调 §3.2 三道闸；抛错原样进 `setAiError`（**不加**兜底文案覆盖）。
3. 候选列表按章分组：组标题「第 N 章」；每章独立「确认/拒绝」，沿用 `:673` / 现成的 confirm 逻辑，只把「当前 client」改成「按 handle 开临时 client」。
4. 失败章：在该章位显示「第 k 章生成失败，第 k+1 章未发起」＋「从第 k 章续跑」按钮；已成功章的候选卡片不动。
5. 档 3 提示条（只在 `aiMode === 'plan'` 且非 `aiBusy` 时渲染，不弹窗、不抢焦点）：
   - 文案：`建议继续：第 X–Y 章（N 章）· 已扫 A 章 / 剩余 B 章`
   - 「采用」把 `X`、`N` 填进两个输入，**不自动开跑**
   - 并集中间有缺章时改成 `第 15–16 章尚未规划`
6. 禁用条件补 `aiRangeCount < 1 || aiRangeCount > 10 || start < 1`。

---

## §6 档 3：已扫 / 剩余的**诚实口径**

### 6.1 事实源

- 计划行区间：`threads`（`NarrativeThreadView`，`targetStartChapter/targetEndChapter`，`src/shared/narrative-thread.ts:23-24`）
- 单元边界：`probeSynopsisUnitLaunchForProject({ projectSession, totalChapters })`（`src/services/workflows/synopsis-unit-launch.ts:433`；catch 在 `:457-469`）；`unit === null` 或 `reason === 'probe-error'` ⇒ **不显示建议条**（不猜、不回落 `maxChapters`）
  - ⚠️ **「不显示」≠「剩余 0 章」**：探针永不抛错，取不到单元时会返回 `{ unit: null, reason: 'probe-error' }`（`synopsis-unit-launch.ts:457-469`）。此时**禁止**把 `remaining` 写成 `0`、禁止渲染「剩余 0 章」或任何数字占位，也禁止拿 `totalChapters` 顶替单元右端——空值只允许表现为**整条建议条不渲染**。
- 单元内已写章：`finalizedDrafts`（`db:draft-list-all`，`ipc-channels.ts:1154`）里章号 ≥ `unit.from` 的**去重章号数**；取其中最大章号为单元右端（无则**不显示**建议条）
  - ⚠️ `finalizedDrafts` **已经是过滤后的集合**：`NarrativeThreadEditor.tsx:360` 有 `const finalized = drafts.filter(draft => draft.status === 'finalized')`。**禁止**直接对 `db:draft-list-all` 的原始返回数章：`DraftStatus` 有五档 `draft | revised | reviewed | finalized | archived`（`src/shared/draft-status.ts:7`），其中 `reviewed`（已审稿）**不是定稿**；从原表直接数会把 `W` 撑大、把「剩余 M 章」算小，正是本卡要挡的假进度。

### 6.2 计数规则（项目总负责人 2026-11-24 裁：M 只准取单元内已写章数）

```
unitRange   = [unit.from, 最后一条该单元已写章]
scanned A   = |⋃ plan[targetStart..targetEnd] ∩ unitRange|      // 区间并集章数
written W   = |distinct 已定稿章号 ∩ unitRange|
remaining B = max(0, W − A)
suggestion  = A === 0 ? { start: unit.from, count: min(3, W) }
                       : { start: max(unionRight)+1, count: min(3, max(0, W − max(unionRight))) }
```

- **禁止**用 `unit.maxChapters` 推导 B（`generation-owner-contract.ts:69` 与 `plot-outline-contract.ts:135-137` 都说它是名义上界；用它会让历史章在上界一改时集体告警，S1 已裁过）。
- **禁止**新建「扫描记录表」：没有台账，新区间确认即代表这几章扫过。
- 口径注释必须写进代码：`A` 是「声明覆盖章数」，候选被作者 reject 也算已扫（与该条 O1「只核声明不核内容」同口径）。
- 空计划（`A === 0` 且无任何计划行）⇒ 按 §4.1 第 1 条**不显示**建议条；仅当单元内已有至少一条计划行才显示。

---

## §7 向后兼容与回退

| 项 | 结论 |
|---|---|
| 默认 N=1 | 与现状逐字等价：同一 `startGraph({kind:'plan', chapterNumber})`；既有 browser 断言不改 |
| 数据 | 无新表、无迁移、无字段；M31 与 C1 的库结构零改动 |
| 契约 | `GraphGenerationInput` / `GraphGenerationContext` / 绑定测试零改动 |
| 常量 | 每章 4,096 与 S07 策略**都不改**，只新增引用两者的一层 |
| 回退 | 两笔提交各自独立可回退：P0（纯模块＋单测）无 UI 依赖，回退后产品行为完全等于 `8a42a566`；P1 回退后回到单章选择 |
| 会话状态 | 续跑信息只在内存；重开面板即丢，此时按「未扫」显示，**不伪造进度** |

---

## §8 判据（分层；每条给命令）

### [static]

- **J1** 区间闸复用：`narrativeThreadPlanRange(start, count)` 在 `count = 0`、`count = 11`、`start + count - 1 > totalChapters`、`start < 1` 四种情形均抛 `GENERATION_PLANNING_RANGE_INVALID`；文案含 `10`。断言 `expect(() => ...).toThrow('GENERATION_PLANNING_RANGE_INVALID')`，不新写 `> 10` 分支（grep 证明只有一处调用 `assertPlanningActionRange`）。
- **J2** 单章预算闸含 base：`assertNarrativeThreadChapterBudget('zh-CN', 3_072)` ⇒ 抛 `NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED`，原文含 `required 3584` 与 `perAttempt 3072`；`('zh-CN', 4_096)` 不抛；并断言 `narrativeThreadPlanBudget('zh-CN', 1) === 3_584`、`narrativeThreadPlanBudget('en-US', 1) === 2_560`。
- **J3** 批声明闸两条：`('zh-CN', 10)` ⇒ required `31,232` 不抛；`('zh-CN', 6, 16_384)` ⇒ required `18,944` 抛。**且**顺序用例：`N = 11` 抛的是 `GENERATION_PLANNING_RANGE_INVALID`（区间闸在前）。
- **J7** N=1 等价性：`narrativeThreadPlanRange(2, 1)` ⇒ `{from:2,to:2}`；派单断言 UI 传给图生成的 input 仍是 `{ kind:'plan', chapterNumber: 2 }`。
- **J9** 闸门：`pnpm check:fast` 输出 `EXIT=0`；`node node_modules/typescript/bin/tsc --noEmit` 输出 `TSC_EXIT=0`。
- 命令（工作树内、单文件）：
  - `node scripts/run-tests-electron.mjs src/shared/__tests__/narrative-thread-range-pure.test.ts`
  - 汇总行只认 `Tests N passed (N)`

### [mock]

- **J4** 串行与失败即停（注入假 `runChapter`）：N=3，第 2 章抛错 ⇒ 调用序列 `[1,2]`（第 3 章**未调用**）、`failedChapter === 2`、第 1 章 `candidates` 仍在、`results` 长度 2。
- **J5** 每章预算原文：3 次调用捕获的每次 `budget.maxRequestedOutputTokensPerAttempt === 4096`、`maxRequestedOutputTokens === 4096`，且与 N 无关（N=1 与 N=10 同值）。
- **J6** 档 3 计数（纯函数）：计划并集 `[11,20]`、单元 `from=1`、已写章 `1..32` ⇒ `scanned = 10`、`written = 32`、`remaining = 22`、`suggestion = {start:21, count:3}`；空计划 ⇒ `suggestion === null`。**变异用例**：把 `unit.maxChapters` 设为 8 后 `remaining` 仍为 22（证明未读它）。
- **J6b** UI（browser 单文件）：`aiMode='plan'` 且无计划行 ⇒ 不渲染建议条；有并集 `[11,20]` ⇒ 渲染 `已扫 10 章 / 剩余 22 章`。
- 命令：`node scripts/run-tests-electron.mjs <单文件>`；browser 单文件按仓内既有方式 `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx`

### [live]（一卡一脚本、单实例、跑完残留 0）

- **J8** 真实 Electron ＋ 真实 SQLite：N=3 跑完，`narrative_thread_plans` 出现 3 条，`target_start_chapter/target_end_chapter` 与输入一致；中途 kill 后已落库行不丢。evidence 必须含 `tasklist | grep -c electron` 原文（期望 `0`）、`EXIT=`、库读原文。
- 触发失败章的实机取证（构造 4,096 上限下必然截断的输入）**本轮不做**：`[live]` 只保留 J8；超预算拒绝以 J2/J3 的 `[static]` 判据为准（模型侧截断不可稳定复现，不拿假证据充数）。若项目总负责人要求补，另开一屏一卡。

---

## §9 禁改清单（QA 逐项核）

1. `PLANNING_ACTION_CHAPTER_LIMIT` 的**值**（`plot-outline-contract.ts:9`）、`DEFAULT_PLANNING_ACTION_CHAPTERS`
2. 蓝图 10 章链路：`src/services/workflows/commands/architecture.command.ts:319`/`:341`、`src/shared/agent-generation.ts:8-11`
3. `src/shared/graph-generation.ts`（输入/上下文/通道）与 `electron/services/graph-generation-source.ts`、`electron/services/graph-generation.ts`
4. `NARRATIVE_THREAD_CANDIDATE_BUDGET` 的 4,096（`narrative-thread-generation-pure.ts:38-43`）
5. C1 的 16 件（尤其 `character-regeneration-diff.ts`、`CharacterRegenerationDiffPanel.tsx`、`character-proposal-service.ts`、`m31-character-regeneration-snapshots.ts`）
6. 任何 `electron/migrations/*`、`src/shared/project-storage.ts`、`portable-project-*`
7. `docs/agents/worktree-parallel.md`（本卡不改）
8. 既有测试断言：只准**追加**用例，`NarrativeThreadEditor.browser.tsx:944` 等原文不动
9. `src/services/generation/task-budget-planner.ts` 的 `git diff --numstat` 必须 **≤ `2/2`**（本卡只加一个 `export`）；出现任何数字变更（512／3_072／2_048 等）即打回，QA 不必读语义即可核

---

## §10 交付与提交

- **两笔提交**（各自可回退）：
  - 第 1 笔 `P6-a:` 纯模块＋3 个单测（`src/shared/narrative-thread-range-pure.ts`、`narrative-thread-progress-pure.ts`、`src/services/narrative-thread-batch-runner.ts` 及测试）
  - 第 2 笔 `P6-b:` UI 接线（`NarrativeThreadEditor.tsx`、browser 测试追加、设计稿文件头一行）
- **只写盘、不提交**：git 写操作一律由联络人代做（C1-b 两次越线已记账）；回执固定一行「只写盘，未提交」＋ `porcelain` / `rev-parse` 原文。
- 回执头四段按 S5 标准头；第四行拆两半：模式自证、模型写「未自证，见渠道读数」。
- 产物目录：`C:/tmp/s3-p6/doubao/`；mtime 静默 5 分钟报卡点。

---

## §11 开放问题（一条，已给默认值，不需等）

**默认章数**：设计稿 §4.3 建议 3，本包取 **1**（等价现状、回归面最小、不替作者决定成本）。档 3 建议条「采用」才填 3。若项目总负责人要改 3，只需改 `aiRangeCount` 初值一行，其余判据不变。
