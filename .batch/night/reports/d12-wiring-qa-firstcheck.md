# 卡 B 首验（QA）· D12 三处接线点

> 状态：已实施（2026-11-14 00:00 · WorkBuddy 夜班卡 B 首验；结论 **PASS · 5/5**）
> 派验单：`.batch/night/review-requests/workbuddy-night-1113.md` B 段 · 交付：`.batch/night/reports/d12-wiring-sites.md`（14,249B，165 行，MD5 `B1CC54856C7E220A987D4F47D8D5EFDA`）· 首验人：QA

## 结论

**PASS · 5/5**。§0 对设计稿「时点不变」的推翻**成立**；三处接线点入参**均真实可用**；A 必须、B 必须、C1 必须、C2/C3 非必须——与报告一致。

## 判据逐条

1. **三处要素齐全**：表 1-A/1-B/1-C 均给「文件:行号 + 函数名 + 入参变量名 + 返回值用法 + 触发时机 + 是否必须」；C 段按 C1/C2/C3 拆三段并各自标「必须/可选/不需要」。
2. **行号可命中**：报告未贴 `grep -n` 原始输出（此项**形式扣分**，我替它补核）；我用编辑器逐行定位，`:1194` = `promptBuilder.build(), reconciliationBlock, authorItemsFallback, chapterMaterials.predecessorBlock,`、`:1576` = `return lengthCheckedDraft`、`:1616` = `if (!alreadySaved && hasSubstantialPreviousChapterReuse(...))`，三处**均命中** HEAD `27a557dd`，行号可信。
3. **签名原文**：`src/shared/chapter-reuse-coverage.ts:66-70` 与报告 §2.1 逐字一致（`prose` / `previousChapter` / `options?`），缺省语言 `'zh-CN'` 属实。
4. **推荐一处 + 理由**：推荐表 1-A（`:1616`），四条理由（唯一可独立成立 / 零新增模型调用、绕开 `toEqual` 断言 / 直接命中漏网形态 / 改动最小可回退）逐条成立；并给了 advisory-only 的退档方案。
5. **末行 `<!-- DONE -->`**：`:165` 有。

## 两问的独立复核

### ①「时点不变（:1616）」的推翻是否成立 —— 成立

骨架实测（`src/services/workflows/commands/generate-draft.command.ts`）：

- `:1297` `cleanDraftText = await runtime.execute(async ({ session }) => {` …… `:1576` `return lengthCheckedDraft` → `:1579` `} catch` → `:1582` `} finally` → `:1592` `this.assertNotCancelled(context)` → `:1616` 判据门 → `:1663` 落库注释 / `:1681` `generation:commit-draft`。
- ⇒ `:1616` 在 `runtime.execute` **返回之后**，`session` 已随回调作用域销毁；就地重跑必须重建 runtime（会重跑 short-outline、重走 material 决策与恢复指纹校验），不是「补一次调用」。
- ⇒ 重跑可行位置只有 `:1576` 之前：此处 `lengthCheckedDraft`（`:1554` 返回值）与 `draftingSession`（`:1363`）**都还在作用域内**，`composeInitialPrompt`（`:1193`）是 execute 作用域内的闭包，可再调一次。
- ⇒ 判据留 `:1616` 是对的（它是唯一可信的「最终落库版本」出口，且早于 `:1681`）。

### ② A/B/C 是否各有真实入参 —— 都有

| 站点 | 入参可取证 |
|---|---|
| A（`:1616`） | `cleanDraftText`（`:1257` 声明、`:1276` / `:1297` 赋值）、`previousEnding`（`:1199`）、`writingLanguage`、`alreadySaved`、`uiText`、`callbacks.log`；全章原文 `requiredFinalizedSource?.content`（`:1071`）/ `selectedCandidateDrafts`（`:1061`） |
| B（`:1193-1197` / `:1441-1444` / 调用 `:1469`，重跑落 `:1576` 前） | `composeInitialPrompt` 闭包、`chapterMaterials.predecessorBlock`（`:1194`，材料减法真落点）、`reconciliationBlock`（`:1434`）、`authorItemsFallback`（`:1188`）、`writingLanguage`、`targetChars`、`draftingSession`（`:1363`） |
| C1（`:1617-1620`） | `report`（两次读数）、`uiText`；`CHAPTER_FAILURE_CODES.DRAFT_PREVIOUS_ENDING_REPLAY` 已在用 |
| C2（`chapter-failure.ts:115-120`） | 静态表，无需入参 |
| C3（`:1768-1808`） | 不需要改（D13 已让生产落候选，`failureCode` 自动带出） |

## 记三条（不拦）

1. **判据 2 形式扣分**：报告只说「行号按 HEAD 实测」，未贴抽样 `grep -n` 输出；我已代补（见上），结论不受影响，但下次派只读卡应把「回贴一行 grep 原文」写成硬要求。
2. **B 的隐性成本**：报告已自曝——B 一落地 `src/services/workflows/commands/__tests__/generate-draft.command.test.ts:979-998` 的 `toEqual([...三次调用])` 必红，需作者先裁。开修复卡时应把「改断言」列入交付范围，否则执行方会停在红测试。
3. **材料减法落点纠错价值高**：设计稿 §2(b) 的 `.withPreviousEnding('')` 在当前代码里是空操作（`:1042` 常态置空、`prompt-builder.ts:166-169` 只有 setter），真落点是 `:1194` 的 `predecessorBlock`。这条是报告最有价值的产出，建议直接进 D12 设计稿勘误。
