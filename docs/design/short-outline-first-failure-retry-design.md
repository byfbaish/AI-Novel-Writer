# 短细纲「首次失败」自动重试 · 小设计稿

> 来源：吸收上游 `b5781975` 的**部分 Ⅱ**（`fix(draft): retry the first eligible short-outline failure`）。
> 部分 Ⅰ（新项目 baseline 单事务）已于 `55122230` 落地，见 `docs/handoffs/upstream-sync/2026-10-14-diff.md` §2.1.2。
> 状态：**待作者过目，未动代码。**

---

## 1. 要解决的问题

短细纲（`chapter-draft-short-outline`）**首次**生成失败时（输出被截断 `length`、或返回空文本 `stop`），
整章生成**直接失败**，作者只能整章重跑；而系统其实**已经具备**「重发同一条短细纲请求一次」的完整授权机制，
只是命令侧没给它机会。

**性质定级**：**失败体验问题**，非数据损坏。这也是上一轮把它排在部分 Ⅰ 之后、单独开轮的原因。

---

## 2. 现状机制（三处，缺一不可）

### 2.1 命令侧：执行顺序是「先重试、后首次」

`src/services/workflows/commands/generate-draft.command.ts:1110-1138`

```
1110  let shortOutline = recovery?.draftShortOutline?.completedOutput ?? ''
1111  if (recovery?.draftShortOutline?.retry?.kind === 'available') {   ← 重试分支
1114    ... generation:retry-draft-short-outline ...
1127  }
1128  if (!recovery) {                                                    ← 首次生成分支
1130    const outlined = await draftingSession.complete({ purpose: DRAFT_SHORT_OUTLINE_PURPOSE, ... })
1133    if (outlined.status !== 'completed' || ... ) throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
1135    shortOutline = outlined.content
1137  }
```

**`recovery` 的来源**（`:1043-1045`）：
```ts
let recovery = mainOwned && this.resumeHandle
  ? await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', {...})
  : null
```
⇒ **全新运行**（无 `resumeHandle`）时 `recovery === null` ⇒ `:1111` 的重试分支**必然被跳过**。

### 2.2 主进程侧：重试授权机制**已完备**（无需改动）

`electron/services/main-generation-owner.ts`

- `shortOutlineRetry(run)`（`:196`）→ `assertShortOutlineRetryAvailable(run, failedAttemptId)`（`:184`）
- `readFailedShortOutlineTask(run, failedAttemptId)`（`:161`）判定「这次 attempt 是否值得重试」：

```ts
// :163-170
const first = runAttempts(run.runId)[0]
if (... !first || first.attemptId !== failedAttemptId || first.purpose !== DRAFT_SHORT_OUTLINE_PURPOSE)
  throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_RETRY_UNAVAILABLE')
if (receipt.attempt.status !== 'settled' || receipt.failureCode || receipt.unsavedTail || !receipt.artifact
  || !(receipt.result?.finishReason === 'length' || receipt.result?.finishReason === 'stop' && !receipt.artifact.text.trim()))
  throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_RETRY_UNAVAILABLE')
```

⇒ **「可重试」的精确含义**：
1. 该 attempt 必须是 run 的**第 1 次**（`runAttempts[0]`，且 `:187` 要求 `length === 1`）；
2. 必须是短细纲 purpose；
3. 必须 `settled`、无 `failureCode`、无 `unsavedTail`；
4. `finishReason === 'length'`（截断）**或** `stop` + **空文本**。

✅ **好消息**：初次失败的那一次 attempt **恰好全部满足**上述条件 ⇒ 此时「重试已经 available」。
⇒ **主进程零改动**，只需命令侧在失败后**重读 context** 拿到这个授权。

### 2.3 中间件：run 在短细纲执行**之前**就已建立

`createRuntime`（`:1017`）内部走 `generation:begin`（`src/services/generation/main-generation-transport.ts:76-79`）建立 run，
runHandle 写入 `context.mainGenerationRunHandle`。
⇒ 首次短细纲执行时 run 已存在 ⇒ 失败后 `read-context` 能读到它。

**另一条已验证的前提**：对账（`chapter-draft-reconcile`）在当前命令链路里
**只读不生成**（`grep DRAFT_RECONCILE_PURPOSE` 只有 import + 3 处读 `recovery`，无 `session.complete` 调用），
⇒ 全新运行中，**短细纲确实是 run 的第 1 次 attempt**，`runAttempts.length === 1` 成立。

---

## 3. 根因

**纯顺序问题**：重试分支在首次生成**之前**求值，而全新运行时 `recovery` 还是 `null`；
等到首次生成失败、`recovery` 本可被读出来时，代码已经 `:1133` 直接 `throw` 走了。

⇒ 修法 = **把首次生成提到重试分支之前**，失败后**重读 context**，让紧随其后的重试分支立即生效。

---

## 4. 为什么不直接 cherry-pick

`b5781975` 同段还含部分 Ⅰ（`electron/database.ts`，已单独吸收），且这段代码被 **P0-1** 改过
（`outlinePrompt` 的构造 = 只喂本章材料，`:946-964`）。上游 diff 的上下文行号与文本与我方**已不一致**，
逐行手工对齐才安全。

---

## 5. 修改方案（单文件，`generate-draft.command.ts:1110-1138`）

```ts
const recordedReconciliation = recovery?.draftReconciliation?.completedOutput
let shortOutline = recovery?.draftShortOutline?.completedOutput ?? ''
// 首次生成提前到重试分支之前：首次失败会落成 run 里唯一的 attempt，
// 重试授权随即可用；紧随其后的分支据此自动重试一次。
// 见 docs/design/short-outline-first-failure-retry-design.md
let outlined: GenerationOutcome | undefined
if (!recovery) {
  callbacks.log(uiText('生成短细纲...', 'Generating a short chapter outline...'))
  outlined = await draftingSession.complete({ purpose: DRAFT_SHORT_OUTLINE_PURPOSE, output: 'visible-text',
    reasoningStage: 'planning', budgetDemand: { kind: 'draft-units', writingLanguage, requestedUnits: 500, segmentable: false },
    messages: [{ role: 'user', content: outlinePrompt }] }, { signal: cancellation.signal })
  logDraftAttempt(callbacks, context, { zhCN: '短细纲', enUS: 'Short outline' }, outlined.receipt)
  if (outlined.status === 'completed' && outlined.finishReason === 'stop' && outlined.content.trim()) {
    shortOutline = outlined.content
  } else if (mainOwned) {
    // 首次失败已落库 ⇒ 重试授权此时可用，重读上下文取得它。
    recovery = await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: context.mainGenerationRunHandle! })
    if (recovery.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
  }
}
if (recovery?.draftShortOutline?.retry?.kind === 'available') {
  this.assertNotCancelled(context)
  callbacks.log(uiText('重新生成短细纲...', 'Retrying the short chapter outline...'))
  const retried = await ipc.invokeWithProjectSession(projectSession, 'generation:retry-draft-short-outline', {
    handle: context.mainGenerationRunHandle!, failedAttemptId: recovery.draftShortOutline.retry.failedAttemptId,
  })
  outlined = retried.outcome
  logDraftAttempt(callbacks, context, { zhCN: '短细纲', enUS: 'Short outline' }, outlined.receipt)
  if (outlined.status === 'completed' && outlined.finishReason === 'stop' && outlined.content.trim()) {
    recovery = await ipc.invokeWithProjectSession(projectSession, 'generation:read-context', { handle: context.mainGenerationRunHandle! })
    if (recovery.draftSave.kind === 'changed') throw new Error('GENERATION_DRAFT_RECEIPT_INVALID')
    shortOutline = recovery.draftShortOutline?.completedOutput ?? ''
    if (shortOutline !== outlined.content || !outlined.receipt.visibleArtifact
      || !recovery.draftShortOutline?.artifactIds.includes(outlined.receipt.visibleArtifact.artifactId))
      throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
    reconciliationArtifactIds = new Set([...(recovery.draftReconciliation?.artifactIds ?? []), ...recovery.draftShortOutline.artifactIds])
  }
}
if (outlined && (outlined.status !== 'completed' || outlined.finishReason !== 'stop' || !outlined.content.trim())) {
  const reason = outlined.finishReason === 'length'
    ? uiText('模型输出被截断', 'the model output was truncated')
    : !outlined.content.trim() ? uiText('模型未返回可见内容', 'the model returned no visible content')
      : uiText('模型未正常完成输出', 'the model did not complete the output normally')
  throw new Error(uiText(`短细纲生成失败：${reason}。正文尚未开始。`,
    `The short chapter outline failed: ${reason}. Drafting has not started.`)
    + ` (GENERATION_DRAFT_SHORT_OUTLINE_FAILED; status=${outlined.status}; finishReason=${outlined.finishReason})`)
}
if (recovery?.draftShortOutline && !shortOutline) throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')
```

**四处要点**：

| # | 要点 | 说明 |
|---|---|---|
| 1 | `outlined` 提到外层 `let` | 两条分支的 outcome 汇聚到统一失败判定；原首次分支里是块级 `const` |
| 2 | 失败后 `else if (mainOwned)` 重读 context | **legacy（非 main）运行不重试** ⇒ 不改变旧行为（见 §7） |
| 3 | 重试分支的 `logDraftAttempt` 与校验**解耦** | 日志上移为无条件，校验保持条件式 ⇒ 重试失败也留痕 |
| 4 | 失败判定改为可读文案 + 代码后缀 | 保留 `GENERATION_DRAFT_SHORT_OUTLINE_FAILED` 作为**子串** ⇒ 既有断言不断 |

---

## 6. 需你拍板的三个取舍

### 取舍 ① 失败文案：采纳上游的「可读文案 + 代码后缀」吗？

我们**没有**错误码→文案的映射表（已 grep 确认：`GENERATION_DRAFT_SHORT_OUTLINE_FAILED` 只出现在抛出点与测试里），
即**错误文本就是作者看到的内容**。而本文件 `:617` 已有 `throw new Error(uiText(...))` 的既有写法 ⇒ **与上游做法一致**。

- **采纳收益**：失败时作者能看到「是截断还是空输出」，而不是一个光秃秃的代码。
- **兼容性**：代码以 `(...)` 后缀保留 ⇒ `rejects.toThrow('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')` 仍是子串匹配，**既有断言全绿**。

→ **建议采纳**。若你偏好纯错误码，我改为 `throw new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED')` 并去掉 reason。

### 取舍 ② `logDraftAttempt` 是否无条件化？

上游把首次分支的日志从「成功才记」改为「一律记」。
- **收益**：失败的首次尝试也出现在工作流日志里（现在失败时日志里什么都看不到）。
- **风险**：`logDraftAttempt` 解构 `receipt.budget`（`:380`）。**测试夹具的收据必带 `budget`**（已核实 `attemptReceipt:241`）；
  生产侧 `budget` 也是必填字段 ⇒ 判定**安全**。落地时仍会实测一次截断场景确认不抛二次异常。

→ **建议采纳**。

### 取舍 ③ 是否顺带补齐「首次成功后 outline artifact 未入 `reconciliationArtifactIds`」？

现有**不对称**：重试路径会把 outline artifact 加入 `reconciliationArtifactIds`（用于 `acknowledge` 的
`GENERATION_COMPOSITION_SOURCE_INVALID` 校验），**首次成功路径不加**（`:1135`）。此为**既有**行为，
上游也没动。

- 本次改动会让「首次路径」更常被走到，理论上该补齐。
- 但它**超出上游范围**，且可能影响 `describe('new runs draft from author ...')` 一组测试。

→ **建议不动**，登记为观察项。你若要一并修，我另开一轮。

---

## 7. 必须守住的既有行为（不变量）

| # | 不变量 | 依据 |
|---|---|---|
| 1 | **legacy（`mainOwned === false`）运行：首次失败仍然直接失败、不重试** | `else if (mainOwned)` 门槛；既有测试 `:3183`「fails the outline explicitly without drafting or saving its text as prose」用的是 legacy 路径（无 `mainDefault`），**必须继续通过** |
| 2 | **恢复运行（resume）路径行为不变** | `recovery` 非空 ⇒ 首次分支跳过；重试分支与今天完全一致 |
| 3 | **已成功完成的短细纲不会被误重试** | `readFailedShortOutlineTask` 已排除 `stop` + 非空文本 |
| 4 | **失败时不落任何 draft / 不把 outline 当正文** | `:3188-3189` 断言无 `db:draft-create` / `recovery-candidate-record`；本改动不触碰该路径 |
| 5 | **错误的 `invocationNonce` / 任务不匹配仍被拒** | 主进程 `:587` 校验，未改动 |
| 6 | **最多只重试一次** | `assertShortOutlineRetryAvailable` 要求 `runAttempts.length === 1`，重试后即有 2 次 ⇒ 不可能二次重试 |

---

## 8. 验证矩阵

**主进程侧不改**，故测试集中在命令侧 `generate-draft.command.test.ts` 的 `describe('automatic short outline')`。

### 8.1 新增/改造用例（对齐上游 `it.each` 参数化）

上游把该 describe 的参数从 7 个单值改为 `[start, finish]` 二元组（13 组）。我们要引入的关键组：

| `start`（首次） | `finish`（重试） | 期望 |
|---|---|---|
| `length` | `stop` | **自动重试后成功**，正文用重试后的 outline（断言正文 prompt 含 retry outline、**不含**首次的「未完成的计划」） |
| `empty`（`stop`+空） | `stop` | 同上 |
| `length` | `length` | 重试仍截断 ⇒ 抛 `GENERATION_DRAFT_SHORT_OUTLINE_FAILED`，且**未发起正文请求** |
| `length` | `empty` | 同上 |
| `length` | `unavailable` | 重试授权不可用 ⇒ 抛同码 |
| `length` | `cancelled` | 取消 ⇒ 抛「工作流已取消」 |
| `resume` + 原 7 种 | | **回归**：现有 7 组必须行为不变 |

同时需在 mock 里补 `generation:begin` 返回 view（首次路径会先 begin）；
以及断言 `calls.slice(retryIndex + 1, calls.indexOf('generation:execute', retryIndex + 1))` 含 `read-context`
（注意上游把 `indexOf('generation:execute')` 加了 `fromIndex`，否则会落到首次的执行上）。

### 8.2 回归门槛

- `npx vitest run src/services/workflows/commands/__tests__/generate-draft.command.test.ts` **全绿**；
- `npx tsc --noEmit` **0 错**；`eslint` 干净；
- 相关 `main-generation-owner.test.ts`（含 `automatic short outline binding` 组）**全绿**。

### 8.3 实机验证（可选，但推荐）

用当前覆盖版模板跑一次「人为造截断」（把 `requestedUnits` 临时调到极小）观察日志出现
「重新生成短细纲...」且最终成章。**也可不跑**——机制层与模型无关，命令侧单测已覆盖。

---

## 9. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 首次失败后多一次请求 ⇒ 消耗一次预算 | 这正是设计意图；`assertShortOutlineRetryAvailable` 已含预算上限校验（`:186-192`），超限自然落到 `unavailable` 分支 |
| 误重试已成功的 outline | §7-3 的不变量挡住 |
| legacy 路径被意外改动 | §7-1 + `:3183` 既有测试守住 |
| 日志无条件化引发二次异常 | §6-② 的实测确认 |

**回滚**：单文件、单块改动，`git revert` 即可，无 schema / 数据迁移。

---

## 10. 落地清单（待你点头后执行）

1. 改 `src/services/workflows/commands/generate-draft.command.ts:1110-1138`（§5）。
2. 改 `generate-draft.command.test.ts` 的 `describe('automatic short outline')`：参数化 + 新增组（§8.1）。
3. 跑 §8.2 三项门槛。
4. 回写 `docs/handoffs/upstream-sync/2026-10-14-diff.md` §2.1.2、`docs/upstream-sync-ledger.md` §4.2
   （部分 Ⅱ 由 ⚪ 待评估 → ✅ 已吸收）。
5. **推进基线** `git branch -f upstream-baseline upstream/master`（遗留项清空后即可推进；届时实际区间比台账标题长，见台账补记）。

---

## 11. 待你确认

- **取舍 ①** 错误文案：采纳「可读文案 + 代码后缀」？（建议：采纳）
- **取舍 ②** `logDraftAttempt` 无条件化？（建议：采纳）
- **取舍 ③** 「首次成功后 outline artifact 未入 `reconciliationArtifactIds`」是否本轮顺带修？（建议：不动，另开一轮）
- **是否要跑实机**（§8.3），还是只做单测就收。
