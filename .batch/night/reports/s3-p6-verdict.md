# S3 · P6 档1 首次验收判词（卡 342b428f）

- 判定面：`a1bcabee`（`card/s3-p6-range`，父 `8a42a566`，wt-2）
- 派验单：`.batch/night/staging/s3-p6/dispatch-doubao-s3-p6.md`（177 行／20,571B）
- 判者：QA · AI writer项目组（独立复跑，不采信回执数字）
- 取证时间：2026-11-24 23:06–23:20（Asia/Shanghai）

## §1 结论

**打回：1 项必改（单点、3 行内），其余全部复跑绿。**

必改项 F1 不影响功能正确性，但直接违背 J1 末句「无自写 `> 10` 分支」与阶段 done-when「`NarrativeThreadEditor` … 复用 ≤10 契约」，
且与回执 §4 J1 行「无自写 `>10` 分支」的自述相矛盾。改完只需最小复核（§6），不必整卡重验。

## §2 盘上对象与白名单核对

```
$ cd C:/develop/workspace/AI-writer/wt-2 && git rev-parse HEAD
a1bcabeee4da9198cf29ce8cdee9a7fac806a747
$ git status --porcelain -uall | wc -l
0
$ git diff --numstat 8a42a566 a1bcabee
1	0	docs/design/architecture/p6-narrative-thread-range-design.md
222	37	src/components/editor/NarrativeThreadEditor.tsx
145	0	src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx
80	0	src/services/__tests__/narrative-thread-batch-runner.test.ts
1	1	src/services/generation/task-budget-planner.ts
56	0	src/services/narrative-thread-batch-runner.ts
79	0	src/shared/__tests__/narrative-thread-progress-pure.test.ts
90	0	src/shared/__tests__/narrative-thread-range-pure.test.ts
104	0	src/shared/narrative-thread-progress-pure.ts
85	0	src/shared/narrative-thread-range-pure.ts
```

- 10 个路径对派单 §2 的「8 项」（测试三件算一项），无第 11 个文件、无白名单外改动。
- `task-budget-planner.ts` 1/1：`git diff` 只有 `function outputTokensFor(` → `export function outputTokensFor(` 一行，512／3_072／2_048 与函数体零改动（满足 §2 第 8 项 ≤2/2 硬判据）。
- 设计稿 1/0：只加 `> 备注：§3.1/§3.2/§6.2 已由实施包覆盖，现值以本包为准（2026-11-24）` 一行，正文未动。
- browser 测试 145/0 纯追加：`:944` 既有断言与 `8a42a566` 同文同位（两版 grep 结果均 `944:    expect(request).toEqual({ input: { kind: 'plan', chapterNumber: 2 }, modelId: 'glm', uiActionNonce: expect.any(String) })`）。

## §3 必改项 F1（唯一打回理由）

**对象**：`src/components/editor/NarrativeThreadEditor.tsx`

| 行 | 盘上原文 | 问题 |
|---|---|---|
| `:1217` | `<Input id="narrative-thread-ai-range-count" type="number" min={1} max={10} …` | 字面量 10 |
| `:1266` | `disabled={… (aiMode === 'plan' && (aiRangeStart < 1 \|\| aiRangeCount < 1 \|\| aiRangeCount > 10))}` | 自写 `> 10` 分支，字面量 10 |

- **对照判据**：派单 §4 J1「`grep` 证明全卡只有一处调 `assertPlanningActionRange`、无自写 `> 10` 分支」。前半成立
  （`grep -rn assertPlanningActionRange src/` 在本卡文件里只命中 `narrative-thread-range-pure.ts:51`，其余命中均为既有文件）；
  **后半不成立**——`narrative-thread-range-pure.ts:18` 已正确写 `NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT = PLANNING_ACTION_CHAPTER_LIMIT`，UI 却又写了两份 10。
- **影响**（为什么不是吹毛求疵）：① 这是典型第二份真相：`PLANNING_ACTION_CHAPTER_LIMIT` 若上调到 12，UI 会把 11–12 章**静默禁用**（按钮 `disabled`，`setAiError` 不触发，用户看不到任何提示），而纯函数闸其实放行；② 输入框 `max=10` 只是 HTML 软约束，键盘/程序赋值可绕过，真正的边界校验仍靠 `narrativeThreadPlanRange`（`:727`），UI 这两处纯属重复实现契约；③ 阶段 done-when 原文要求「`NarrativeThreadEditor` … 复用 ≤10 契约」。
- **修法**（不改架构、不搬闸）：从 `../../shared/narrative-thread-range-pure` 引入 `NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT`（该模块已导出，值同源），把 `:1217` 的 `max={10}` 与 `:1266` 的 `> 10` 换成该常量；闸顺序、报错文案不变。提交 `P6-c:`（不 amend `e219977b`／`a1bcabee`）。
- **修复后最小复核**：`tsc --noEmit`＋browser 单文件＋`grep -n "10" NarrativeThreadEditor.tsx` 证明无残留字面量分支（§6）。

## §4 自跑证据（我自己执行的命令与原文）

### 4.1 三个单测（J1–J6、J7 纯函数半）

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/narrative-thread-range-pure.test.ts \
    src/shared/__tests__/narrative-thread-progress-pure.test.ts \
    src/services/__tests__/narrative-thread-batch-runner.test.ts
 ✓ src/shared/__tests__/narrative-thread-progress-pure.test.ts (9 tests) 4ms
 ✓ src/services/__tests__/narrative-thread-batch-runner.test.ts (4 tests) 5ms
 ✓ src/shared/__tests__/narrative-thread-range-pure.test.ts (13 tests) 4ms
 Test Files  3 passed (3)
      Tests  26 passed (26)
```

### 4.2 browser 单文件（J6b、J7 UI 半）

```
$ node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts \
    src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx
 ✓ |chromium| src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx (38 tests) 598ms
 Test Files  1 passed (1)
      Tests  38 passed (38)
```

### 4.3 类型与闸（J9）

```
$ node node_modules/typescript/bin/tsc --noEmit
TSC_EXIT=0
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 24.2s
doc links: checked 1472, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 442 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.3s
[check:fast] 全部通过。
CF_EXIT=0
```

## §5 J1–J9 逐条对号（按派单原文编号，含文件:行）

| # | 层 | 我的判定 | 证据 |
|---|---|---|---|
| J1 | [static] | **部分不符 → F1** | 四情形单测全绿（`range-pure.test.ts:26,:30,:34,:38`，13 passed）；`assertPlanningActionRange` 本卡唯一调用点 `narrative-thread-range-pure.ts:51`；`count=11`／`count=0`／`start<1` 均由该闸抛 `GENERATION_PLANNING_RANGE_INVALID`；`to > totalChapters` 由 `:52` 抛同码。**但 UI 自写 `> 10` 分支（`NarrativeThreadEditor.tsx:1266`）与 `max={10}`（`:1217`）**，见 §3。 |
| J2 | [static] | PASS | `narrative-thread-range-pure.ts:60-68`：`required = planBudget(lang,1)`＝512+3072＝3584；`:66` 报错串 `NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED: required 3584 > perAttempt 3072`（单测「3072 装不下…」断言 `required 3584`＋`perAttempt 3072` 两个串）；`('zh-CN',1)=3_584`、`('en-US',1)=2_560`、4096 不抛均绿。无字面量 512/3072：`:27-29` 只调 `outputTokensFor`。 |
| J3 | [static] | PASS | `:76-84`：10 章＝512+10×3072＝31,232 ≤32,768 不抛；6 章＝18,944 >16,384 抛，串含 `required 18944 (base+perChapter×6) > cap 16384`；闸序用例 `(1,11,20)` 先抛 `GENERATION_PLANNING_RANGE_INVALID`（`range-pure.test.ts:84-89`）。 |
| J4 | [mock] | PASS | `narrative-thread-batch-runner.ts:39-53`：顺序 `for`、`catch` 内 `failedChapter=…; break`（无 `Promise.all`）；`runner.test.ts` 断言 `calls [1,2]`、`failedChapter 2`、`results` 长 2、`results[0].candidates ['第1章候选']` 保留。 |
| J5 | [mock] | 成立但同义反复（记账，不判红） | `runner.test.ts` J5 把 `NARRATIVE_THREAD_CANDIDATE_BUDGET.maxRequestedOutputTokensPerAttempt` 自己 push 进 captured 再断言它 `=== 4_096`——只能证明常量值 4096 与调用次数 11，证明不了编辑器真的把它传给每章请求（编辑器 `:654` 只用它做单章闸）。真约束靠人工读码：`NARRATIVE_THREAD_CANDIDATE_BUDGET` 未被本卡改动，每章请求经 `open→execute→read→detach`（`:668-699`）不携带批预算。不算打回项，建议后续把 J5 改成捕获真实请求参数。 |
| J6 | [mock] | PASS | `narrative-thread-progress-pure.ts:91-95`：`remaining = max(0, written − scanned)`，**全文不读 `maxChapters`**（`:22-24` 注释明写刻意不读）；`unit===null`／无定稿章 → `remaining: null`（`:86,:89`），不写 0；`reviewed` 不计（`:71-79` 只认 `finalized`）；并集 [11,20]+已写 1..32 ⇒ 10／32／22／`{21,3}`，`maxChapters=8` 那条仍 22 全绿。 |
| J6b | [mock] | PASS | browser 4 条追加用例：无计划行不渲染（`querySelector('[data-testid="narrative-thread-progress"]')===null`）；[11,20] ⇒ 文本含 `第 21–23 章`、`已扫 10 章 / 剩余 22 章`。渲染条件为 `aiMode==='plan' && !aiBusy && aiProgress?.suggestion`（`:1030`），`remaining` 为 null 时不可能同时有 suggestion，故不会渲染「剩余 null 章」。 |
| J7 | [mock] | PASS | `narrative-threadPlanRange(2,1)=== {from:2,to:2}`（含传 totalChapters 版）；UI 单章仍派发 `{kind:'plan',chapterNumber:2}`，既有 `:944` 断言未改且 38 条全绿；N=3 区间用例断言派发序列 `[2,3,4]`。 |
| J8 | [live] | **[live] 未跑成**（按 admin 11-24 裁定走复合判据） | wt-2 无打包产物（回执 §6：`Get-ChildItem -Recurse -Filter "AI小说作家.exe"` 命中 0）；`pnpm build`／`pnpm dev` 被派单 §0.1 明文禁（无 TTY 的 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）；Magpie `http://127.0.0.1:3425/v1/models` 返回 200（模型侧非阻塞点）。**判词不写 live PASS**，本卡 live 半未取证。 |
| J9 | [static] | PASS | §4.3 两行原文：`TSC_EXIT=0`、`CF_EXIT=0`。 |

## §6 变异（M1／M2／M3 均由我自造，改回后 sha 逐字复原）

原文件指纹（改前）：
```
2d0d5e8c…7331a61  src/shared/narrative-thread-progress-pure.ts
ae743ee7…7df8d6f  src/shared/narrative-thread-range-pure.ts
84924ca7…564c6f6ab  src/services/narrative-thread-batch-runner.ts
```

| 号 | 改法（盘上原文） | 红（我的运行原文） | 改回后 |
|---|---|---|---|
| M1 | `narrative-thread-progress-pure.ts:95` `Math.max(0, written - scanned)` → `(unit.maxChapters ?? 0) - scanned` | `Tests 1 failed \| 8 passed (9)`，红在「变异对照：unit.maxChapters = 8 时 remaining 仍为 22」：`AssertionError: expected -2 to be 22` | sha `2d0d5e8c…` 复原 |
| M2 | `narrative-thread-range-pure.ts:28` `outputTokensFor(...)` → `chapters * 3_072` | `Tests 5 failed \| 8 passed (13)`：J2 三条（zh 3584／en 2560／3072 装不下）+ J3 两条（10 章 31232／6 章 18944），例 `expected 18432 to be 18944` | sha `ae743ee7…` 复原 |
| M3 | `narrative-thread-batch-runner.ts:51` catch 内 `break` → `continue` | `Tests 1 failed \| 3 passed (4)`，红在「N=3 第 2 章抛错…」：`AssertionError: expected [ 1, 2, 3 ] to deeply equal [ 1, 2 ]` | sha `84924ca7…` 复原 |

复原后终态：`HEAD a1bcabee`、`status --porcelain -uall` 0 行、三单测 `Tests 26 passed (26)`。无变异残留。

## §7 记账（不改判）

1. **回执指纹复核一致**：`receipt-to-owner.md` 222 行／14,609B／`8abeedcb892c039146ab24029b28b5b28fe1d1ba345e1c1dd0a9e29e0ccbfc1e`（与联络人报的一致）。
2. **回执自述与盘上原文有一处不符**：回执 §4 J1 行称「无自写 `>10` 分支」，但 `NarrativeThreadEditor.tsx:1266` 存在 `aiRangeCount > 10`、`:1217` 存在 `max={10}`。按「判词只认盘上原文」，记 F1；不追责受派方（其 §7 只报了另一件「文案含 10 未满足」，未提这两处）。
3. **J1「文案含 10」的边界**：`assertPlanningActionRange`（`plot-outline-contract.ts:20-23`）只抛裸码，回执 §7.1 说改它得动白名单外文件——这与 §9 禁改清单冲突，故不要求本卡改；J1 只按「四情形均抛该码」判，已满足。
4. **J5 证据形态**见 §5，属「成立但弱」，不计红；建议在 S5 收口时把「每章请求预算从哪来」写成一行结论，避免下轮再靠读码。
5. **J8 缺的实机半**：需另开一卡（允许打包＋单实例起停的屏位），本卡不补。

## §8 修复后最小复核口径（给下一轮，不必整卡重验）

1. `grep -n "NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT\|max={10}\|> 10" src/components/editor/NarrativeThreadEditor.tsx` ⇒ 只剩常量引用、无字面量分支；
2. `node node_modules/typescript/bin/tsc --noEmit` ⇒ `TSC_EXIT=0`；
3. `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx` ⇒ `38 passed`；
4. `git status --porcelain -uall` 0 行、`git log --oneline -3` 出现 `P6-c`，且未 amend 前两笔。

以上 4 条齐 ⇒ 本卡可直接判 PASS（判词另出一版，本版作废）。

---

## §9 P6-c 最小复核结论（判定面 `cbbe82c3`，2026-11-24 23:2x）

修正件：`cbbe82c3`（父 `a1bcabee`，分支 `card/s3-p6-range`，未 amend 前两笔），`git show --numstat` ⇒ `3 2 src/components/editor/NarrativeThreadEditor.tsx` 单文件，与派单「只动一个文件、不加文案、不改测试」一致。

§8 四条逐条原文：

1. **字面量已消除**：`grep -n "max={10}\|> 10\b\|NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT" src/components/editor/NarrativeThreadEditor.tsx` ⇒ 命中 `:34` import、`:1218` `max={NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT}`、`:1267` `aiRangeCount > NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT`；`max={10}` 与 `> 10` **0 命中**。常量链路 `narrative-thread-range-pure.ts:18` `= PLANNING_ACTION_CHAPTER_LIMIT`，后者 `plot-outline-contract.ts:9` `= 10` ⇒ 值仍为 10，**行为零变化**成立（F1 只要求消除第二份真相，不要求改行为）。
2. **类型**：`node node_modules/typescript/bin/tsc --noEmit` ⇒ `TSC_EXIT=0`。
3. **交互**：`vitest run --config vitest.browser.config.ts src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx` ⇒ `Test Files 1 passed (1)` / `Tests 38 passed (38)`，`BROWSER_EXIT=0`（与打回前同为 38，测试未被改）。
4. **工作树**：`git status --porcelain -uall` ⇒ 0 行；`git rev-parse HEAD` ⇒ `cbbe82c3…`，`HEAD^` ⇒ `a1bcabee…`。

**结论：F1 已消除，卡 342b428f 判 PASS。** 本文件 §1–§7 的打回判词作为历史保留不改；最终结论以本节为准。其余记账（J8 缺实机半需另开卡、超限静默无提示收 S5 BACKLOG、J5 证据偏弱）不变。
