# D13 方案 · 一章三种死法，而三种死法都不告诉作者「为什么没写出来」

> 状态：已裁定（2026-11-05 · **作者按建议裁定：1=B / 2=A（与 D8 裁定 2 合并答）/ 3=A**；§5.4 跨 IPC 取码已由主 agent 只读验通，见 §5.4 与 §10；**实施已合并 `959a3647`，T5 于 2026-11-06 按裁定 A 补齐**）· 首版已于当日经**独立复核打回五处**并修订，见 §11
> 上级登记：[`../product/live-pipeline-acceptance-defects-assessment.md`](../product/live-pipeline-acceptance-defects-assessment.md) §D13
> 触发：2026-11-01 第 2 章同一蓝图、同一模型 `qwen3.5:9b-128k`，三次尝试三种死法
> 本稿**只出方案，不动代码**；所有行号为 2026-11-05 在 `develop @ 20caeab3` 实读。

---

## 0. 一句话结论

**不是三个 bug，是一条链上没有失败契约 —— 而且"码"和"身份"两样东西都是断的：**

1. **码不当码用**：渲染层与主进程层**两层**都在 `throw new Error('CODE')` 或 `new Error(文案)` 里打转。
   主进程的 `fail(code)` 就是 `throw new Error(code)`（`generation-run-repository.ts:92`）—— **码在 message 里，不在 `code` 字段上**。
   于是 `recoveryFailureCode`（`generate-draft.command.ts:461-467`）取不到，一律兜底 `GENERATION_FAILED`。
2. **出口不汇聚**：三条路分别落在「面板挂住」/「编辑器一句话」/「工作流未完成」，没有一处能回答"这一章到底为什么没写出来"。

一句话：**作者拿到的不是一份诊断，是三句互不相干的话。**

---

## 1. 三个出口，按下标尺重述

| # | 出口（层） | 实际位置 | 有没有错误码 | 上层怎么记 | 作者看到什么 |
|---|---|---|---|---|---|
| 1 | 调用层（无输出） | 无抛点。`run 3c8aa501` 停在 `running` 15 分钟，模型 22:31 已空闲 | **没有失败可记** | run 无终态 | 面板「第 2 章 · 自动定稿与后处理 10%」挂着不动 |
| 2 | 正文层（内容判据） | `generate-draft.command.ts` **10 处抛点 / 8 类语义**（§2） | 只有 2 个 `finishReason` 分支会 `Object.assign({code})` | 恢复候选 `failureCode = GENERATION_FAILED`（原分支生产不可达，2026-11-06 已放开，§7.1） | 编辑器一句话，面板显示**正常结束** |
| 3 | 组装层（compose） | `generation-run-repository.ts:520/526/529/531` | 码只是 message | 有"码"，但取不到 `code` | 「工作流未完成」 |

**读法**：三条路里，一条**不产生失败**，另外两条**产出了失败的字符串、但没有产出一个能被程序读的失败**。

> 出口 1 的「永久 running」需要限定：主进程有 `maxActiveElapsedMs` 截止定时器（`generation-run-service.ts:200-208,284`），
> 且 `DRAFT_GENERATION_BUDGET.deadlineMs = 20 * 60_000`（`generate-draft.command.ts:265`）。
> 所以「15 分钟仍 running」**不构成"永不失败"**；这个 run 当时为什么没被截止住，**归 D9 核实**，本稿不碰。

---

## 2. 正文层：10 处抛点，两种形态，都取不到码

「太短」「退化」「照搬」「重演」四类是原有描述；复核后补出另外六处同样会抛、同样没身份的地方。

| # | 判据 | 抛出点 | 抛的是什么 | 带 `code` 字段？ |
|---|---|---|---|---|
| 1 | 正文明显不足目标 | `:1544` `draftTooShortError`（定义 `:471-483`） | `new Error(文案)` | ❌ |
| 2 | 正文不足（续写收尾第二处） | `:2101` 同一个 `draftTooShortError` | 同上 | ❌ |
| 3 | 模型退化（复读 / 占位语 / 工序词） | `:1549` → `visible-text-integrity.ts:293-302` → `:146-152` | `new Error(文案)` | ❌（`blocking.kind` 已拿到，**只差一个入参**，见 §5.2） |
| 4 | 照搬本章必需事件 | `:1551-1556` | `new Error(文案)` | ❌ |
| 5 | 开头重演上一章结尾 | `:1564-1569` | `new Error(文案)` | ❌ |
| 6 | 作者配置在生成途中被改 | `:1624` | `new Error('GENERATION_DRAFT_AUTHOR_CONFIG_CHANGED')` —— **码名在 message 里** | ❌ |
| 7 | 唯一一次无进展恢复仍无进展 | `:2054-2057`（条件是 `noProgress \|\| degenerate`，不只"无进展"） | `new Error(文案)` | ❌ |
| 8 | `finishReason` 非 stop（正文收尾） | `:2081-2096` | `createIncompleteCompletionError` | ⚠️ 仅 `PROVIDER_FAILED` / `NETWORK_ERROR` 两种会被 assign |
| 9 | `finishReason` 非 stop（压缩轮） | `:2131` | 同函数，**裸抛** | ❌ |
| 10 | 压缩轮取消 | `:2208` | 同函数，`'cancelled'` | ❌ |

`recoveryFailureCode`（`:461-467`）的实际判定：

```ts
if (cancelled) return 'CANCELLED'          // ← 靠布尔，不靠错误对象
if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code.slice(0, 160)
return 'GENERATION_FAILED'                  // ← 上面 10 处里的 8 处落这里
```

**这是 D13 的真正伤口**：恢复候选表里躺一条 `failureCode=GENERATION_FAILED` 或 `GENERATION_DRAFT_INCOMPLETE`，
作者也好开发者也好，都看不出是重演、太短还是复读 —— 而这几种**下一步该做的完全相反**
（重演要改上一章材料，太短要调目标字数，退化要换模型）。

### 2.1 主进程侧也在压码（原稿漏了这一段）

| 判据 | 位置 | 压成什么 |
|---|---|---|
| 合成快照与请求不符 | `electron/services/generation-draft-effects.ts:139-140` | `GENERATION_DRAFT_COMPOSITION_REQUIRED` |
| `finishReason` 非 stop | 同文件 `:141` | **`GENERATION_DRAFT_INCOMPLETE`** |
| `target` 非法 | 同文件 `:143` | 同上（同一个码） |
| 正文不足下限 | 同文件 `:145` | 同上（同一个码） |
| 组装层四种成因 | `generation-run-repository.ts:520/526/529/531` | **`GENERATION_COMPOSITION_NO_PROGRESS`** |

⇒ 原稿说「只有组装层压码」是错的：**正文层 10 处 + 主进程 4 处 + 组装层 4 处，共 18 个出口、约 8 个码**。

---

## 3. 组装层：4 个抛点，1 个码，`fail()` 不带 `code`

| 抛点 | 触发条件（原文，逐字） | 真实语义 |
|---|---|---|
| `:520` | `if (!next.trim())` | 合成结果为空 |
| `:526` | `if (receipt.result?.finishReason !== 'stop' \|\| countDraftUnits(text) <= draftTargetUnitRange(target).maximum)` | **注意：`text` 要到 `:533` 才更新**，所以这里比的是**压缩前**的累计正文 ⇒ 语义是「**这次压缩请求本来就不该发生**（正文还没超上限）」或「压缩响应被截断」。**不是**"压缩后仍超上限" |
| `:529` | `if (draftAlgorithm && sources.length && finishReason === 'length' && countDraftUnits(next) - countDraftUnits(text) < 300)` | 截断且增量不足 300 |
| `:531` | `if (sources.length && 字母数字数(next) <= 字母数字数(text))`（**只在非 condense 分支**，`:527` 的 else 内） | 根本没变长 |

复核给的旁证：`main-generation-owner.test.ts:2406` 的用例名是
`refuses a condense revision that replaces a draft already within the frozen target maximum` —— 正是 `:526` 那一支。

**`fail` 的定义**：`generation-run-repository.ts:92` → `function fail(code: string): never { throw new Error(code); }`
⇒ 码只是 message，**没有 `code` 字段**。所以就算把 4 个码拆开，渲染层也取不到。

---

## 4. 三条旧结论要更正（本节是本稿最重要的部分）

评估稿 §D13 的「建议方向」三条，实读之后**三条都不成立**。若照旧执行，会做出重复工与错方向的工。

### 4.1 「续写结果必须参与 compose 的进展判定」—— 已参与，但**因果链不是原稿写的那样**

续写产出**确实**逐字进合并并参与判定：
`mergedDelta = countDraftUnits(candidateDraft) - beforeChars`（`:2034`），
`noProgress = addition.finishReason === 'length' && mergedDelta < 300`（`:2041`），
`accepted = !degenerate && (addition.finishReason === 'stop' || mergedDelta >= 300)`（`:2042`）。

**但原稿那句"⇒ 判无进展 ⇒ `:2054` 抛出"是错的**，两个判据都过不去：

- `noProgress` 还要求 `finishReason === 'length'`。实测第 3 次续写是 `stop`（评估稿 §D13 表：三次调用"都成功"）⇒ 不成立。
- `degenerate` 走 `findVisibleTextDegeneracies(visibleAddition, {source: draft})`（`:2037`），而 `REPEAT_MIN_COUNT = 3`
  （`visible-text-integrity.ts:118`）—— **整章只重复一遍时，addition 里每句只出现 1 次，判不出退化**。

⇒ 两者都不触发 ⇒ `accepted = true` ⇒ `:2068 await params.acknowledge(...)` ⇒ `:1303 generation:compose-visible`
⇒ 主进程 `:531` 抛 `GENERATION_COMPOSITION_NO_PROGRESS`。
**这条路径与实测"失败在 compose"完全一致**；若真走到 `:2054`，compose 根本不会执行。

**后果：`mergedDelta` 到底是不是 0、重复率到底是不是 100%，现有日志证明不了。**
`:529`（截断增量不足）与 `:531`（根本没变长）共用同一个码，事后无法回溯是哪一支。
所以 §5.4 的例子只能写成"待日志确认"，不能当既定事实。**这条纪律与 D20 那次「报错误诊」同源。**

### 4.2 「丢弃前把已有正文留成草稿」—— 代码在，**但生产路径走不到**

`:1710-1756` 的 catch 里确实有 `db:recovery-candidate-record`：把 `recoverableDraftCandidate` 连同
`failureCode` / `failureReason` 存成项目恢复候选；IPC 通道齐（`db-controller.ts:1240-1280`），
UI 有 `RecoveryCandidateSection`（`AIOutputPanel.tsx:225-233`），browser 测试 4 份。

**但条件是 `if (!mainOwned && !draftPersisted && recoverableDraftCandidate)`，而生产里 `mainOwned` 恒为真**：

- `DEFAULT_DEPENDENCIES.createRuntime`（`generate-draft.command.ts:281-284`）恒返回 `createWorkflowMainGenerationRuntime`
- 它 `mainOwned: true`（`src/services/workflows/workflow-main-generation.ts:208`）
- 三个生产调用点**都不注入 `dependencies`**：`chapter-workflow.ts:267`、`batch-chapter-workflow.ts:270`、`draft-recovery-workflow.ts:63`

⇒ **`db:recovery-candidate-record` 在生产中从不发生**，这条分支只有测试注入运行时才成立。

> **2026-11-06 落地（作者裁定 A）**：`generate-draft.command.ts` catch 的条件已由 `!mainOwned && !draftPersisted && recoverableDraftCandidate` 放开为 `!draftPersisted && recoverableDraftCandidate`。生产（`mainOwned: true`）失败现在同样落 `db:recovery-candidate-record`；落库形态不变、汇编码不变、不加超时/心跳/run 终态兜底。上面「生产中从不发生」是 2026-11-05 的实读结论，保留作历史。

**这改变了 D8 裁定 2 的问法**：不是"`mainOwned` 下要不要留候选"，而是"**唯一留候选的那条分支，生产不走**"。
生产里作者能用的是另一个东西 —— `MainDraftRecoverySection`（`AIOutputPanel.tsx:224`，`:318-320` 从 run 的 artifacts 反推），
它和候选表**不是同一回事**。原稿把两者当成一回事，是错的。

### 4.3 补充事实：候选就算写进去，作者也看不到 `failureCode`

`AIOutputPanel.tsx:75-101` 的候选列表只在 `currentProject` 变化时拉一次，失败后没有刷新路径；
`RecoveryCandidateSection`（`:496-518`）只渲染 `visibleText` / `sourceCurrent`，
**不渲染 `failureCode` / `failureReason`**（字段在 `src/shared/recovery-candidate.ts:48-49` 存在，但无消费者）。

⇒ 即使 §4.2 那条分支通了，"存了码却没人显示"仍然是个独立缺口。**这属于本稿范围**，见 §5.5。

---

## 5. 方案

### 5.1 加一份失败契约（新文件 `src/shared/chapter-failure.ts`）

```ts
export type ChapterFailureLayer = 'call' | 'content' | 'compose'

export interface ChapterFailure {
  layer: ChapterFailureLayer
  /** 机器可判的稳定码，取值受控（§5.2 / §5.3 词表） */
  code: string
  /** 一句话说明，进 UI；只写现象，不写归因，不含行号与内部术语 */
  detail: string
  /** 作者能做的下一步；空数组表示"没有可做的" */
  suggestions: string[]
}
```

四条使用规则（写进文件顶部注释，防止下一轮又长出第四种形态）：

1. **`code` 必须来自词表**，不许临场拼字符串 —— 与「设计稿状态行取值受控」同一条纪律，用测试钉住。
2. **`detail` 只写现象，不写归因** —— 归因在 `code` 里，改文案不会改机器判定。
3. **抛出的对象必须带 `code` 字段**（自定义 Error 子类或 `Object.assign`），因为 `recoveryFailureCode` 只认 `error.code`。
4. **跨进程必须保住码** —— 见 §5.4，这一条是新的、也是最容易漏的。

### 5.2 正文层：给 10 处抛点发码

| 判据 | 建议码 | 备注 |
|---|---|---|
| 太短（两处） | `DRAFT_TOO_SHORT` | 同一类，共用一码 |
| 退化 · 复读 | `DRAFT_DEGENERATE_VERBATIM_REPEAT` | 由 `blocking.kind` 映射，**一行级改动** |
| 退化 · 占位/拒绝语 | `DRAFT_DEGENERATE_PLACEHOLDER` | 同上 |
| 退化 · 工序词泄漏 | `DRAFT_DEGENERATE_META_LEAK` | 同上 |
| 照搬细纲事件 | `DRAFT_BLUEPRINT_COPY` | |
| 开头重演上一章 | `DRAFT_PREVIOUS_ENDING_REPLAY` | |
| 作者配置途中被改 | `DRAFT_AUTHOR_CONFIG_CHANGED` | 现有码名直接挪进 `code` 字段 |
| 续写恢复后仍无进展 | `DRAFT_NO_PROGRESS` | |
| `finishReason` 非 stop | **不要新增兜底码**（原稿错）：`BoundedCompletionFailure.failureCode` 已有 `length`/`content_filter`/`cancelled`/`unknown`（`bounded-completion.ts:32-45`），映射成 `DRAFT_INCOMPLETE_LENGTH` 等 4 个即可 | 3 个抛点共用 |
| 压缩轮取消 | `DRAFT_CANCELLED` | 与 `CANCELLED` 合并亦可，二选一，别两个都留 |

> 原稿提的「新增 `DRAFT_INCOMPLETE_OUTPUT` 兜底」**撤销**：`:2084-2095` 已经按三种原因分别给文案，
> 加统一兜底码等于把已有可区分信息压掉，与"失败要有身份"自相矛盾。

**退化的三种码是全稿最便宜的改动**：`assertNotDegenerateVisibleText:298-301` 已经拿到 `blocking.kind`，
只差 `degenerationError` 多收一个参数。

### 5.3 组装层：把 1 个码拆成 4 个（其中 `:526` 的语义要改）

| 抛点 | 建议码 | 语义 |
|---|---|---|
| `:520` | `GENERATION_COMPOSITION_EMPTY` | 合成结果为空 |
| `:526` | `GENERATION_COMPOSITION_CONDENSE_UNEXPECTED`（压缩响应非 stop 时用 `..._CONDENSE_TRUNCATED`） | **本该不需要压缩**，或压缩响应被截断 |
| `:529` | `GENERATION_COMPOSITION_TRUNCATED_NO_PROGRESS` | 截断且增量不足 |
| `:531` | `GENERATION_COMPOSITION_NO_PROGRESS`（原名保留给这一支） | 根本没变长 |

**要预先声明的一处必破**：唯一断言旧码的测试在 `:526`（`main-generation-owner.test.ts:2418`），不是 `:531`。
改名后它必破，实施卡里要写明"允许改这一条断言并注明原因"，别让它变成"顺手放宽断言"。

### 5.4 跨进程接缝：码怎么活下来（原稿完全漏了）

`fail(code)` 抛的是 `new Error(code)`，到渲染层经 `ipc.invokeWithProjectSession`（`src/services/ipc-client.ts:101-110`）
拿到的是 Electron 包装后的 message：`Error invoking remote method '...': Error: CODE`。
⇒ **拆了四个码也取不到 `code` 字段。**

**✅ 已验通（2026-11-05，主 agent 只读实测；裁定 1 的前置解除）**

| 路 | 结论 | 证据 |
| --- | --- | --- |
| **A**：抛带 `code` 属性的错误，指望 IPC 序列化带过去 | **跨进程不成立** | `structured-batch-executor.ts:94-100` 的生产注释明写「Electron IPC 会把它包成 `Error invoking remote method '<channel>': Error: <协议码>`，**类身份与 `code` 属性都会丢，只剩 message**」，`:165-170` 有 2026-10-11 实机踩坑记录 |
| **B**：渲染层用正则从 message 取码 | **成立** | 用源码里 `PROTOCOL_CODE_MESSAGE`（`:172`）本身实测：`GENERATION_COMPOSITION_NO_PROGRESS` / `DRAFT_TOO_SHORT` / `GENERATION_COMPOSITION_CONDENSE_UNEXPECTED` 及带 Electron 包装前缀的形态 **6/6 取到码**；散文、「码 + 散文」 **2/2 正确不匹配** |

**由此产生两条实施硬约束（原稿没写，写卡时必须原样带上）**：

1. **抛点必须抛纯码**：message 里夹人话文案、行号或含空白的诊断尾，提取器就失配。给人看的话走 §5.1 契约的 `detail` 字段，不要塞回 message。正文层 10 处目前是 `new Error(文案)`，它们与 `recoveryFailureCode` **同在渲染层**，靠挂 `code` 属性即可；**只有跨 IPC 的组装层四码才走正则**。两条路各自成立，不许混成一句。
2. **`safeProtocolCode` 是私有函数，要导出复用**：不许复制正则产生第二份判据。`fail()` 同时挂 `code` 属性可照顾同进程路径，与 B 路叠加不互斥。

**实施卡第一步仍要复现一次并贴原始输出**，否则后面全部白做（与 D20 那次「先证明恒等式再改判定」同一个道理）。

### 5.5 汇聚出口：任务面板一行「这一章为什么没写出来」

三条约束：

- 显示 `code` 的**对人话版本**，不是码本身；码进日志/trace，不进正文区。
- **"已保留"只在真的保留了的时候出现** —— §7 裁定 2 已定为 **A（生产也留候选）**，§4.2 那条死分支要在实施卡里放开；
  但 UI 仍必须按**真实落库结果**显示，不许因为「按设计应该留了」就写「已保留」。**不许写一句永远为假的承诺。**
- **"可以试"来自 `suggestions[]`**，不许在前端按 `code` 写 if-else 拼文案 —— 那等于把语义搬进 UI。

另外补一条独立缺口（§4.3）：`RecoveryCandidateSection` 要把 `failureCode` 的对人话版本渲染出来，
否则"存了码没人看"仍然存在。

### 5.6 出口 1（无输出）本稿不做

「模型没输出、run 长期 `running`」是**没有终态**的问题，归 D9（超时）与 D2 甲（租约/心跳）。
D13 只承诺：**一旦有人判它失败，失败得有身份。** 这条划界必须写进实施卡，否则实施者会顺手加超时，把 D9 的裁定权抢走。

---

## 6. 不做什么（划界）

| 不做 | 归谁 |
|---|---|
| 超时、心跳、run 终态兜底、`deadlineMs` 为什么不生效 | D9（超时）/ D2 甲（租约） |
| 「清空生成内容」残留面板 | D10 |
| 短细纲写错对象（把上一章写成细纲） | D12（已定性，方案在那边） |
| 调 compose 的阈值（300 字、`draftTargetUnitRange`） | 质量策略，不是失败表达，另议 |
| ~~`mainOwned` 下要不要留恢复候选~~ → **已裁定 A，纳入本卡范围** | 与 D13 裁定 2 合并答（§7.1）；不再是「不做」 |
| 把失败文案搬到哪个组件 | UI 归置，随实现定 |

---

## 7. 裁定项（三条）

| # | 问题 | 选项 | 我的建议 |
|---|---|---|---|
| 1 | 失败契约要不要做？ | **A** 只做 §5.2 + §5.3 + §5.4（发码与保码）· **B** A + §5.5 汇聚出口 · **C** 不做 | **B**。只发码不加汇聚出口，作者仍要在三个地方找三句话；汇聚出口是三条路唯一能被"一次看明白"的地方。**但 §5.4 必须先验通**，否则 A 和 B 都是空的 |
| 2 | 恢复候选那条死分支怎么办？ | **A** 让生产也留候选（`mainOwned` 下也留）· **B** 维持现状、承认"生产不留"· **C** 删掉这条分支，只留 `MainDraftRecoverySection` | **A**，但**与 D8 裁定 2 合并答**：两处问的是同一件事。单独答会给出两个互相矛盾的结论 |
| 3 | 组装层那 4 个码要不要拆？ | **A** 拆 4 个 · **B** 只拆「空」与「其它」 | **A**，但 `:526` 必须按 §5.3 改名 —— 原稿把它当成"压缩无效"是读反了 |

### 7.1 作者裁定（2026-11-05，"按照建议来"）

| # | 裁定 | 附带口径 |
| --- | --- | --- |
| 1 | **B**（发码 + 保码 + §5.5 汇聚出口） | §5.4 跨 IPC 取码**已验通走 B 路**，前置解除；只发码不汇聚，作者仍要在三个地方找三句话 |
| 2 | **A**（让生产也留候选） | **与 D8 裁定 2 合并答**，两处问的是同一件事；D8 §8 的「存进检查点 / 只留 handle」子选项**仍未裁定**，实施按最小口径：只放开 `:1711` 的 `!mainOwned` 条件，**不改落库形态** |
| 3 | **A**（拆 4 个码） | `:526` 必须按 §5.3 改名 —— 它判的是**压缩前**正文，语义是「本该不需要压缩 / 压缩响应截断」，不是「压缩无效」 |

**划界照旧**：D13 只承诺「一旦有人判它失败，失败得有身份」，**不许**顺手加超时 / 心跳 / run 终态兜底（D9 与 D2 甲的地盘）。

> ✅ **裁定 2 实施状态（2026-11-06，已收口）**：作者 00:49 选 **A** —— 许可按「裁定 2=A 必要配套」改写 `generate-draft.command.test.ts:839/:893/:969` 三条既有断言，与新契约**同向收紧为「断言落候选」**；裁定 2 本身与本表裁定不变。落地：`generate-draft.command.ts:1719-1724` 只去掉 `!mainOwned`（`else if` 清屏分支照旧）；三条断言从「不落候选」改为「不进草稿库 + 候选落盘且带得住失败码」（`DRAFT_AUTHOR_CONFIG_CHANGED` / `GENERATION_COMPOSITION_RECEIPT_MISMATCH` / `DRAFT_PREVIOUS_ENDING_REPLAY`），成功路径仍断言零候选。**证据**：改前单跑该文件 `3 failed | 242 passed`（失败恰为这三条）；改后 `245 passed`；`main-generation-owner.test.ts` 走 Electron 运行时 `185 passed`；`node scripts/check-fast.mjs` 全绿。§8.5 的「唯一许可断言」由本裁定扩为 `:2418` + 这三条。

---

## 8. 验收标准（实施卡用）

1. **第一步先验 §5.4**：复现跨 IPC 之后 `code` 可取到（哪个方案、原始输出是什么）。**没验通不许往下做。**
2. 正文层 10 处抛点各带 `code`，且 `recoveryFailureCode` 能原样取到（不再是 `GENERATION_FAILED`）。
3. 退化三码能区分 `kind`：同一段复读文本与同一段占位文本得到不同码。
4. 组装层四个抛点得到四个不同码；`:526` 的新码语义是「本该不需要压缩 / 压缩响应截断」，**不是**"压缩无效"。
5. 允许改 `main-generation-owner.test.ts:2418` 那一条断言，并在报告里写明改的原因；**不许**顺手放宽其它断言。
6. 汇聚出口：单章失败时出现「这一章为什么没写出来」一行，含码的对人话版本 + **照实的**保留状态 + 至少一条可试建议。
7. `RecoveryCandidateSection` 渲染 `failureCode` 的对人话版本。
8. `node scripts/check-fast.mjs` 全绿；相关 vitest 全绿。
9. **不许**在本卡内加超时/心跳/run 终态兜底（§5.6 / §6）。

> 第 1 条已于 2026-11-05 由主 agent 只读验通（证据见 §5.4）；实施卡**仍需复现一次并贴原始输出**。
> 第 2 条的「10 处」以 §9 速查表为准；第 5 条是**唯一**被许可改动的既有断言，其余断言一律不许放宽。
> ⚠️ **第 5 条的「唯一」是复核漏检**（豆包实施报告 §5 第 1 / 3 条，主 agent 已抽查）：实际受影响的既有断言共 **5 处** —— `:2418`（组装层码）、`:4760`（`GENERATION_FAILED` 落候选）、`:5341`（不可信失败文本不得变显示码）、`:839/:893/:969`（mainOwned 不落候选，钉死旧裁定 2=B）。其中 T3 靠「改实现细节保旧断言」绕过，T5 要改的正是旧断言钉死的行为本身、无两全中间态 ⇒ 见 §7.1 的实施状态。**同类「放条件」裁定，应先跑一遍相关测试盘点受影响断言再写验收。**
> **2026-11-06 补**：`:839/:893/:969` 三条已按裁定 A 改写（见 §7.1），T5 不再 BLOCKED。上面「5 处」的盘点与「同类裁定先跑测试盘点」的教训保留不改 —— 这次仍是**先单跑测试确认只有 3 条红**才动笔，不是凭报告猜。

---

## 9. 代码位置速查

| 用途 | 位置 |
|---|---|
| 失败码兜底（只认 `error.code`） | `src/services/workflows/commands/generate-draft.command.ts:461-467` |
| 太短（两处） | 同 `:471-483`（定义）· `:1544` · `:2101` |
| 退化（三类 `kind`） | `src/shared/visible-text-integrity.ts:140-144` / `:146-152` / `:293-302`；`REPEAT_MIN_COUNT = 3` 在 `:118`；抛在 `generate-draft.command.ts:1549` |
| 照搬细纲 | `generate-draft.command.ts:1551-1556` |
| 重演上一章 | 同 `:1564-1569` |
| 配置途中被改 | 同 `:1624` |
| 续写合并 / 增量 / 无进展 | 同 `:2027-2042` / `:2051-2067` / 恢复失败 `:2054-2057` |
| `finishReason` 非 stop（3 处） | 同 `:2081-2096` / `:2131` / `:2208` |
| 恢复候选落库（2026-11-06 起生产可达） | 同 `:1710-1756`，条件 `!draftPersisted && recoverableDraftCandidate`（原 `!mainOwned` 已按裁定 2=A 放开）；`mainOwned: true` 在 `src/services/workflows/workflow-main-generation.ts:208` |
| 主进程内容闸（三成因一码） | `electron/services/generation-draft-effects.ts:139-146` |
| 组装层四个抛点 | `electron/repositories/generation-run-repository.ts:520` / `:526` / `:529` / `:531` |
| `fail()` 不带 `code` | 同文件 `:92` |
| 跨进程取码先例 | `src/services/workflows/structured-batch-executor.ts:172`（`PROTOCOL_CODE_MESSAGE`） |
| 续写去重 / 剥离窗口 | `src/shared/visible-continuation.ts:28-33`；`CONTINUATION_VISIBLE_TAIL_CHARS = 1600` 在 `:2`；`draft-visible-text.ts:52-55` |
| 恢复候选 UI | `src/components/panels/AIOutputPanel.tsx`（`RecoveryCandidateSection` `:225` / `MainDraftRecoverySection` `:224`） |

---

## 10. 已知未解（本稿不假装知道）

1. 第 3 次失败到底是 `:529`（截断增量不足）还是 `:531`（没变长）—— 两码同一，现有日志分不出。**先在实施卡第一步把这两支的日志分开**，才能确认病因。
2. `mergedDelta` 当次实际值未知。
3. ~~`electron` 的 IPC 是否序列化自定义错误属性 —— **不确定**，§5.4 要求实测。~~ **已解（2026-11-05）**：不带过去，只剩 message；改走 §5.4 的 B 路正则取码，已用生产正则实测 6/6 命中、2/2 正确不匹配。
4. 出口 1 那个 run 为什么没被 `deadlineMs` 截止住 —— 归 D9。

---

## 11. 复核记录（2026-11-05 · 首版被打回，逐条处置）

复核方式：派独立 general-purpose 子 agent 做**对抗性只读复核**，要求逐条核对 `文件:行` 的内容是否真是稿子说的那件事。
结论「需先修 5 处，其中 2 处会直接导致实施修错地方」。**五处全部成立，已全部改正。**

| # | 复核指出 | 处置 |
|---|---|---|
| 1 | `:526` 语义读反：`text` 在 `:533` 才更新，判的是**压缩前**正文，不是"压缩后仍超上限" | ✅ 已改 §3 表格 + §5.3 改名 + 裁定 3 |
| 2 | §4.1 因果链断在"判无进展"：`noProgress` 还要求 `finishReason==='length'`，退化要 `REPEAT_MIN_COUNT=3`；真实路径是 `accepted=true → acknowledge → compose :531` | ✅ 已改 §4.1，并把"重复率 100%"降级为"待日志确认"（§10） |
| 3 | §4.2「已实现」不成立：`!mainOwned` 在生产不可达（三个调用点都不注入 `dependencies`） | ✅ 已重写 §4.2 + 裁定 2 + §5.5 |
| 4 | §5.3 四码到不了 `recoveryFailureCode`：`fail()` 只是 `new Error(code)`，跨 IPC 丢码 | ✅ 新增 §5.4 与验收第 1 条（先验接缝再动别的） |
| 5 | 「6 类判据」漏点：`:2101` / `:2131` / `:2208` / `:1624` / `generation-draft-effects.ts` | ✅ 已补齐至 10 处，并新增 §2.1「主进程侧也在压码」 |

**另采纳 6 条建议修**：finishReason 改用现有 `failureCode` 映射（撤销"新增兜底码"）· `:526` 才是唯一断言旧码的测试 ·
UI 可达性与 `failureCode` 无消费者 · 退化改动是"一行级" · §5.4 引用错节 · `CONTINUATION_VISIBLE_TAIL_CHARS = 1600` 意味着
全量复制只在正文 ≤1600 单位时才会被整段剥掉（更长的重复会整段追加 ⇒ 若按"逐字相同"判 `DRAFT_CONTINUATION_REPEATED` 会漏）。

**这次复核值多少钱**：第 1、2、3 条若没查出来，实施会分别改错一个判据的语义、写错一份病因解释、并去修一条生产根本走不到的分支。
三条的共同形态是「**我读了代码，但读的是我以为的那行**」—— 与 D20 首版被推翻的原因完全一样。

> 原稿未采纳一条：复核建议把 `DRAFT_CONTINUATION_REPEATED` 的判据从"逐字相同"改成"新增字母数字数 < 阈值"。
> **理由成立但本稿不给结论** —— 那个阈值取多少是质量策略，属 §6 划界外，留给实施卡与作者定。
