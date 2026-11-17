# B-d12-wiring-sites · D12 三处接线点清单（只读）

> 基线：HEAD `27a557dd`（工作区有未提交改动，均为文档与 `.batch/` 产物，未触及本卡涉及源码）。
> 性质：**只读**。未改任何源码、未 `git add`、未跑测试。本报告与信号文件是唯一写入。
> 口径：设计意图取自 `docs/design/product/d12-retry-design-20261109.md` §二；**行号一律按 HEAD 实测**，不照抄文档。

## 0. 先纠正一个前提：文档里的「时点不变（:1616，同一处）」在代码结构上不成立

这是本次核查最重要的一条，先说，因为它决定站点 B 落在哪。

`generate-draft.command.ts` 的骨架是：

```
731   async execute(...) {
1243    try {
1257      let cleanDraftText: string
1268      try {
1297        cleanDraftText = await runtime.execute(async ({ session }) => {
1469          ... draftingSession.complete({ purpose: 'chapter-draft', ... })   ← 首稿
1524          ... this.extendDraftIfNeeded({ session, ... })                    ← 续写
1554          ... this.condenseDraftIfNeeded({ session, ... })                  ← 压缩
1576          return lengthCheckedDraft
1297        })
1579      } catch (error) { ... throw error
1582      } finally {
1589          try { await runtime.close() } ...
1591      }
1592      this.assertNotCancelled(context)
1616      if (!alreadySaved && hasSubstantialPreviousChapterReuse(...)) { throw ... }   ← 现判据门
1663      // 落于数据库
1681        ... 'generation:commit-draft' ...
1763    } catch (error) { ... db:recovery-candidate-record ... }
```

`:1616` 在 `runtime.execute` **返回之后**、`runtime.close()` 之后执行。此时 `session` 已经随作用域销毁，**在这里就地发第二次 `chapter-draft` 请求是不可能的**——要么重建 runtime（那会重跑 short-outline、重走 material 决策与恢复指纹校验，不是「补一次调用」），要么承认重跑必须发生在 `:1576` 之前。

结论：**判据可以留在 `:1616`（它是最终落库版本唯一可信的位置，这个判断没错），但重跑必须挪进 `runtime.execute` 回调内**。文档「时点不变」只对判据成立，对重跑不成立。

---

## 1. 三处接线点

### 表 1-A · 判据（触发条件）

| 项 | 内容 |
|---|---|
| 文件:行号 | `src/services/workflows/commands/generate-draft.command.ts:1616` |
| 所在函数 | `GenerateDraftCommand.execute`（类定义 `:714`，方法 `:731`–`:1814`） |
| 现在是什么 | `if (!alreadySaved && hasSubstantialPreviousChapterReuse(previousEnding, cleanDraftText, writingLanguage))` —— 旧判据：上一章**结尾 1,000 字** × 本章**开头 1,200 字**，8-gram、连续 ≥80 字（`hasSubstantialPreviousChapterReuse` 定义 `:361`） |
| 入参（本作用域已可拿到） | `cleanDraftText`（声明 `:1257`，赋值 `:1276` / `:1297`）· `previousEnding`（`:1199 = chapterMaterials.previousEnding`，仅结尾 1,000 字）· `writingLanguage` · `alreadySaved`（`:1232`）· `uiText` · `callbacks.log` |
| 全章判据要的「上一章全文」在哪 | **本作用域已可得，不必新增装配层入参**（修正设计稿「遗留问题 1」）：<br>① 定稿前驱全文：`requiredFinalizedSource?.content`（`:1071` 定义；`FinalizedMaterialSource.content` 是整章原文，见 `chapter-materials.ts:42`）<br>② 未定稿前驱全文：`selectedCandidateDrafts.find(c => c.chapterNumber === previousChapterNumber)?.content`（`:1061`）<br>③ **不要**用 `chapterMaterials.predecessorBlock`：它是**渲染过的块**（块头 + 正文，`chapter-materials.ts:866`），逐字比会把块头算进重合 |
| 返回值怎么用 | `report.severity === 'blocking'`（`ratio > 0.45`）才触发重跑；`report.ratio` / `longestRun` / `runs` 进 `callbacks.log`（形状照抄 `:1609`–`:1614` 的 `blueprintCopy.severity === 'advisory'` 日志块）与终态文案 |
| 触发时机 | **生成后、落库前**（`generation:commit-draft` 在 `:1681`；`:1623`–`:1625` 注释已说明只有这里的 `cleanDraftText` 是最终版本） |
| 必须改？ | **必须**。这是全章判据唯一可信的生产出口；不改，`analyzeChapterReuse` 仍是 0 个生产调用点。 |

### 表 1-B · 重跑请求构造（含材料减法）

| 项 | 内容 |
|---|---|
| 文件:行号 | 请求正文组装：`generate-draft.command.ts:1193`–`:1197`（`composeInitialPrompt`）与 `:1441`–`:1444`（`initialPrompt`）<br>调用点：`:1469`–`:1477`（`draftingSession.complete({ purpose: 'chapter-draft', ... })`），session 取自 `:1363`（`injectWritingSkillIntoSession`）<br>**可执行重跑的唯一位置**：`:1576` 之前（`condenseDraftIfNeeded` 返回后、`return lengthCheckedDraft` 前），仍在 `runtime.execute` 回调内 |
| 所在函数 | `execute` 内的 `runtime.execute(async ({ session }) => { ... })` 闭包 |
| 入参 | `promptBuilder.build()` · `reconciliationBlock`（`:1434`）· `authorItemsFallback`（`:1188`）· `chapterLengthContract`（`:2003` 同款，本处 `:1195`）· `chapterTaskAnchor` · `shortOutline` · `chapterMaterials.textWithoutPredecessor` · **`chapterMaterials.predecessorBlock`（材料减法要拿掉的就是这一项）** · `systemRole`（`:1184`）· `writingLanguage` · `targetChars` |
| 材料减法的**真实**落点 | 删 `composeInitialPrompt` 数组里的 `chapterMaterials.predecessorBlock`（`:1194`）。<br>**纠错**：设计稿 §2(b) 写的 `.withPreviousEnding('')` 在当前代码里**已经是常态**——`:1042` 在 `!isFirstChapter` 分支里就把它置空，`prompt-builder.ts` 里该变量只有 setter（`:166`–`:169`）、无默认值，全仓除测试外只有 `:1042` 一处调用。上一章正文是靠 B1 的 `predecessorBlock`（`:1194`）进 prompt 的，不是在模板变量里。照文档改 `withPreviousEnding` 等于空操作。 |
| 纠正指令 | 形状照抄 `:1969`–`:1977`：`promptLanguageText(writingLanguage, '<中文>', '<英文>')`，拼到 `initialPrompt` 的 user 消息最前面。数字取 `report.ratio`（百分比）与 `report.longestRun` |
| 返回值怎么用 | 重跑返回的 `outcome` → `sanitizeDraftText` → 覆盖 `initialVisibleDraft` / `lengthCheckedDraft`，**只让第二版走站点 A 的门与落库**；第一版丢弃不落库（现状 `:1620` 的 throw 才落候选，这一版仍在同一条 catch 链上） |
| 触发时机 | 站点 A 判 blocking 之后（设计上是「生成后、保存前」，实现上必须在 `:1576` 前） |
| 必须改？ | **必须**。这就是「重跑一次」本身；不做，A 只是把旧病灶从「静默通过」换成「直接作废」。 |

### 表 1-C · 失败降级（三段，只有前两段要动）

| 子项 | 文件:行号 / 函数 | 入参 / 出参 | 触发时机 | 必须改？ |
|---|---|---|---|---|
| C1 抛错正文 | `generate-draft.command.ts:1617`–`:1620`，`execute` | 入：`report`（两次的 `ratio` / `longestRun` / `runs`）、`uiText`；出：`Object.assign(new Error(文案), { code: CHAPTER_FAILURE_CODES.DRAFT_PREVIOUS_ENDING_REPLAY })` | 失败分支（判 blocking 且重跑仍 blocking） | **必须**。要把两次读数与「已自动重试一次仍未通过」写进 message，否则「生成了、没保存、界面不说」原样复现 |
| C2 码表文案 | `src/shared/chapter-failure.ts:115`–`:120`（`CHAPTER_FAILURE_META` 内该条 `detail` / `suggestions`） | 入：无（静态表）；出：`detail` 字符串 + `suggestions[2]` | UI 渲染失败卡片时 | **可选**（建议改）。现状 `detail` 说的是「开头重演上一章结尾」，换成全章判据后描述不准；但改动面是全局文案，须与 C1 同步 |
| C3 候选落库 | `generate-draft.command.ts:1768`–`:1808`，`execute` 的 catch | 入：`recoverableDraftCandidate`（`:1552` / `:1575` 赋值）、`recoveryFailureCode(error, context.cancelled)`、`workflowStepId`；出：`ipc 'db:recovery-candidate-record'` | 失败分支 | **不需要改**。D13 已让生产也落候选，`failureCode` 走 `error.code` 自动带出 `DRAFT_PREVIOUS_ENDING_REPLAY` |

---

## 2. 额外两问

### 2.1 `analyzeChapterReuse` 签名与返回结构（原文）

`src/shared/chapter-reuse-coverage.ts:66`–`:70`：

```ts
export function analyzeChapterReuse(
  prose: string,
  previousChapter: string,
  options?: ChapterReuseOptions,
): ChapterReuseReport
```

`ChapterReuseOptions`（`:49`–`:51`）：`{ writingLanguage?: WritingLanguage }`，缺省 `'zh-CN'`（`:71`）。

返回结构（`:28`–`:47`）：

```ts
export interface ChapterReuseReport {
  ratio: number            // coveredUnits / proseUnits，0–1，不允许 NaN
  coveredUnits: number     // 被覆盖的正文码元数
  runs: ChapterReuseRun[]  // 按 start 升序、互不重叠
  longestRun: number       // 最长一段，无重合为 0
  severity: ChapterReuseSeverity   // 'ok' | 'advisory' | 'blocking'
}
export interface ChapterReuseRun { start: number; length: number }
```

阈值：`REUSE_RATIO_BLOCKING = 0.45`（`:17`）、`REUSE_RATIO_ADVISORY = 0.15`（`:19`）；n-gram 为中文 16 字 / 英文 40 字母（`:13`–`:14`，复用 `blueprint-verbatim-overlap` 的常量）。

需要的上下文（**只要两份纯文本，不需要窗口参数**）：

1. `prose` —— 当前草稿全文（站点 A 就是 `cleanDraftText`；**不要传 `sanitizeDraftText` 之前的中间态**）；
2. `previousChapter` —— 上一章**全文**（不是结尾 1,000 字）；见 1-A 表「在哪」三行；
3. `options.writingLanguage` —— 站点 A 作用域内已有该变量。

注意它**不带窗口参数**：旧的 `NEXT_CHAPTER_HEAD_MAX_CHARS = 1200` 是旧判据的东西，换过来之后那两个常量与 `hasSubstantialPreviousChapterReuse`（`:361`）只应在「降级为 advisory 日志」时保留。

### 2.2 只接一处（最小可用）→ 推荐**表 1-A（`:1616`）**

理由，按权重：

1. **只有 A 能独立成立**。C 是 A 的下游（A 不判，C 无事可降级）；B 是 A 的下游（没有 A 的 verdict，重跑没有触发条件）。B/C 单独接线都是死代码。
2. **零新增模型调用**。不触碰 `generate-draft.command.test.ts:979`–`:998` 那个 `toEqual([...三次调用])` 断言——这是本修法最大的成本项，A 单独接线绕开了它。B 一落地该断言必红，需作者先裁（设计稿 §5 已标注）。
3. **A 直接命中卡面描述的漏网形态**。整章复用只换开头，旧判据窗口外看不见；全章 `ratio > 0.45` 看得见。
4. **代价最小、可回退**。A 只是把 `hasSubstantialPreviousChapterReuse(...)` 这一行的条件换成（或并列）全章判据，且 `analyzeChapterReuse` 是纯函数、无 IO、无副作用。

必须一并说明的代价（不是零成本）：A 单独接线会**新增**一类原本不存在的拦截（整章复用的稿子过去能过），所以验收线里必须有「组 D 真实改写 ratio=0 不误伤」（设计稿 §5 单测第 4 条）。

**如果连「新增拦截」都不想承担**，退一档的最小接线是 A 的 **advisory-only** 版本：只在 `:1616` 前算一次 `analyzeChapterReuse` 并 `callbacks.log` 读数（形状同 `:1609`–`:1614`），不改任何判定结果。它不修缺陷，但能让下一轮标定时拿到真实生产读数，且零风险。

---

## 3. 旁注核对：`scripts/experiments/measure-chapter-reuse.mjs:103`

卡面旁注属实，且行号准确：

- `scripts/experiments/measure-chapter-reuse.mjs:103` —— `const r = analyzeChapterReuse(prose, previousChapter, { writingLanguage: 'zh-CN' })`，包在 `primaryReading()` 里，是**实验读数用**（该文件 `:58` 动态 `import` 判定器，`:7` 注释写明用途）。
- 同文件 `:58` 是 import 点，`:103` 是唯一调用点。

全仓 `analyzeChapterReuse` 引用清点（`grep -rn` 实测）：

| 位置 | 性质 |
|---|---|
| `src/shared/chapter-reuse-coverage.ts:66` | 定义 |
| `src/shared/__tests__/chapter-reuse-coverage.test.ts`（13 处） | 单测 |
| `scripts/experiments/measure-chapter-reuse.mjs:58 / :103` | **实验**（import / 调用） |
| `scripts/dsh/task-reuse-coverage-20261109.md:57`、`scripts/workbuddy/task-reuse-threshold-calibration-20261109.md:43 / :65` | 任务书文本内的代码引用，非可执行调用 |

⇒ **`src/` 内生产调用点仍为 0**，卡面「零接线」结论不变；那两处实验/任务书引用不构成接线。

---

## 4. 附带发现（不在卡面要求内，只报不改）

1. **设计稿 §2(b) 的 `.withPreviousEnding('')` 是空操作**（详见表 1-B「纠错」行）。若后续照文档施工，材料减法必须落在 `:1194` 的 `chapterMaterials.predecessorBlock` 上。这是文档与代码的口径差，不是文档笔误——`withPreviousEnding` 属于 prompt 模板变量层，B1 之后上一章正文已改走 `predecessorBlock`。
2. **设计稿「遗留问题 1（缺上一章全文入参）」已可结**：全文在 `execute` 作用域内已可得（`requiredFinalizedSource.content` / `selectedCandidateDrafts[].content`），不需要在 `chapter-materials.ts` 新增导出。此条会改变 B 的前置条件评估，建议开工前更新该稿。
3. `previousEnding` 的 1,000 字上限只服务旧判据（`:1214` 注释），A 换判据后它只剩「短细纲 300 字前驱」一个消费者（`:1216`），不要顺手改默认值。

## 5. 本轮做了什么 / 证据

- 读：`docs/design/product/d12-retry-design-20261109.md` 全文 · `src/shared/chapter-reuse-coverage.ts` 全文 · `src/shared/chapter-failure.ts:80`–`:160` · `src/services/workflows/chapter-materials.ts:38`–`:90` / `:400`–`:470` / `:800`–`:885` · `generate-draft.command.ts:985`–`:1060` / `:1075`–`:1160` / `:1150`–`:1620` / `:1740`–`:1815` / `:1900`–`:2160` · `scripts/experiments/measure-chapter-reuse.mjs:90`–`:120` · `src/services/prompts/prompt-builder.ts:160`–`:175`。
- 命令（只读）：`grep -n` / `sed -n` 若干、`git rev-parse --short HEAD`、`git status --porcelain`。
- 未执行：任何测试、任何构建、任何 `git add` / `commit`。

<!-- DONE -->
