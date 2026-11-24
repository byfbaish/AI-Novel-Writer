# 外派派单（豆包）· PLANUI S3 · P6 档1 叙事线索候选章区间化＋每章 token 预算闸＋档3 进度建议（卡 342b428f）

## 0 必读与确认（先回四行，再开工）

开工前必读五件：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④通道件 `docs/agents/doubao-channel.md`；⑤本卡设计稿 `docs/design/architecture/p6-narrative-thread-range-design.md`（161 行）与实施包 `.batch/night/staging/s3-p6/impl-package.md`（**306 行／24,193B／`sha256 4060618e7774c798be069e20dfd354f5ffc4d323a81c53fcc1602b21e8fd1c2a`**；只读 §1、§2 白名单、§3 预算三道闸、§4 串行执行器、§6 档3 口径、§8 判据、§9 禁改清单、§10 交付）。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：必须「工作模式·本地电脑」（不是「对话模式」）；模型一行写「未自证，见渠道读数」——模型由联络人贴 `node scripts/doubao/doubao.mjs markers` 原文取证，你不必自证，但也**不许**自己写一个模型名充数

缺前三行我不认这件已开工；模式不对**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node scripts/run-tests-electron.mjs <单文件…>` 与 `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <单文件>`。
- **本卡明文例外（admin 11-24 明写，仅此一项）**：J8 属 `[live]`，需真实 Electron ＋ 真实 SQLite。允许且仅允许：单实例启动、一次启动跑完、跑完 `app.quit()` 且残留 `electron` 进程 0；构建只准 `node node_modules/typescript/bin/tsc --noEmit`（`pnpm build`／`pnpm dev` 无 TTY 会 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，禁）。除此之外的实机行为仍按红线禁。
- 只改 §2 白名单那 8 项，不新增白名单外文件（含任何新测试文件），不动 `.batch/*` 任何件，不 `git add -f`，不 `--no-verify`，不 tag。
- **必须新开会话**：不得复用任何既有会话（含 C1-a／C1-b 及任何 WorkBuddy 旧会话）；复用旧会话的产出不采信。
- **模式闸**：开局必须是「新工作任务 ＋ 本地电脑」。落在「对话模式」或档位被降，立即停手、回报实际模式，不许用该会话的产出交付。
- 一卡一会话，做完即停，不在同一会话里接下一张。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行身份头，第四行模式与模型，缺任一行按可疑件退回：

```
From: S3P6-Doubao
To: 大肥鱼@主身
卡号：342b428f｜会话标识：<新会话首次时间或会话 id>｜起点：8a42a566
模式：<工作模式·本地电脑>｜模型：未自证，见渠道读数
```

回执正文另起一行固定写：**「只写盘，未提交」**（本卡禁止任何 git 写操作，见 §0.4 第 4 条）。

## 0.3 步骤 0 · 起点闸门（开工第一件事是核它）

前提：分支已由**豆包联络人在投前创建并检出**（`git -C C:/develop/workspace/AI-writer/wt-2 switch -c card/s3-p6-range 8a42a566`）。**创建分支也是 git 写操作，不归你做**——你到场上时分支应已存在。

开工第一条命令（三项原文必须贴回执）：

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall
```

判据：分支名逐字 `card/s3-p6-range`、HEAD 逐字 `8a42a566`、porcelain **0 行**（把原文贴回来，行数自己数或写「0 行」）。**任一项不符 → 立即停手**：不写文件、不 `git switch -c`、不 `checkout`、不 commit，回执只写三项原文与停手原因。

> 本机有两套检出：`AI-writer-wt-1`（HEAD `89ec7014`）与 `AI-writer-wt-2`（本卡所在）。豆包项目 chip 常显示 `AI-writer-wt-1`。**本卡所有 git／文件操作一律带绝对路径 `C:/develop/workspace/AI-writer/wt-2`**；若 `rev-parse` 回 `89ec7014`，就是走错树，立即停手回报。

## 0.4 豆包通道准入（逐条必守，缺一条即停手回报）

1. **模式必须是「新工作任务 + 本地电脑」。** 对话模式没有本地文件权限，只会回「我无法读取你本地磁盘文件」（`doubao-channel.md:149`／`:331`）——那不是模型变笨，是模式错。开局先 `node scripts/doubao/bootstrap.mjs` 新建线程。
2. **顺序不能反：新建线程 → 切「本地电脑」→ 最后切档位。** 新建线程会把档位重置回「中」（`:148`／`:337`）；对话模式下档位 chip 只显示「快速」（`:167`），看到「快速」先怀疑模式而不是模型。
3. **项目定位用绝对路径，不靠「项目」chip 猜**（同 §0.3 的 `wt-1`／`wt-2` 提示）。
4. **禁一切 git 写操作（本卡硬性，含 `add` 与 `commit`）。** 本卡**所有** git 写操作由豆包联络人代做：你只把文件写到盘上，提交由联络人 `git add <点名路径>`（不用 `-A`）＋ `git commit -m "P6-a: …"`／`"P6-b: …"`。因此：禁止 `add`、`commit`、`switch`、`checkout`、`restore`、`reset`、`stash`、`clean`、`push`、`merge`、`rebase`、`tag`——**一条都不许**。违反的后果：C1-b 已有两笔越线提交（`41daa79c` 17:17:08、`8a42a566` 17:38:07）记在外派纪律里，本卡重犯按整卡退回。读操作（`rev-parse`／`status`／`diff`／`log`／`show`）不受限。
5. **豆包没有工具层硬拦截。** 红线全靠你自己守、事后验收核对，故：①每条 `git`／`node` 命令的原文输出贴进回执；②收工 `status --porcelain -uall` 会列出你改过的 8 项文件——**这是预期**（本卡就是只写盘），不要为此去 commit、也不要手工清理或回退；判据是「列出的路径全部落在 §2 白名单内」且 `rev-parse --short HEAD` 仍是 `8a42a566`（HEAD 未动即证明你没提交）。
6. **串行。** 一个实例一个窗口，同一时刻只跑一个任务（`:377`）；本卡执行期间不得并派第二个任务。
7. **命令语法按 PowerShell 写。** 若终端是 PowerShell，`| wc -l` 不可用，等价写法：`(git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | Measure-Object -Line).Lines`；两者择一把**原文**贴回执。
8. **证据措辞纪律。** 没读到的只能写「本次读取的文件内未找到」，**不许写「全仓没有」**（`:308`）；测试条数与 tsc 结果原样粘贴，不许总结成「全部通过」（`:315`）；`[live]` 跑不成写「未跑成 + 报错原文」，不许用 mock 顶。

---

## §1 任务一句话

把叙事线索候选生成从「一次一章」改成「一次一段章区间（≤10 章，串行逐章）」并加每章 token 预算闸，生成后给「已扫 N 章／剩余 M 章」的下一步建议。**分两笔写盘**（提交由联络人分两笔代做）：

- 第 1 笔 `P6-a:` 纯模块 ＋ 3 个单测：`src/shared/narrative-thread-range-pure.ts`、`src/shared/narrative-thread-progress-pure.ts`、`src/services/narrative-thread-batch-runner.ts` 及对应 `__tests__`；外加 `task-budget-planner.ts` 的**一个 `export`**（§2 第 8 项）。
- 第 2 笔 `P6-b:` UI 接线：`NarrativeThreadEditor.tsx`、`NarrativeThreadEditor.browser.tsx`（只追加）、设计稿文件头一行。

第 1 笔全部单测绿、`tsc --noEmit` 绿之后，再做第 2 笔。两笔之间不得插入其它改动。

## §2 白名单（8 项：4 新增 / 4 修改）

> 新增文件必须一次性列全；除下列 8 项外，任何文件改动都算越界。**不许自建第 9 个文件，包括测试。**

### 新增（4）

1. `src/shared/narrative-thread-range-pure.ts` —— 区间与预算纯函数：`NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT`（值从 `PLANNING_ACTION_CHAPTER_LIMIT` 取，不写字面量 10）、`narrativeThreadPlanRange(startChapter, chapterCount)`（内部直接调 `assertPlanningActionRange`）、`narrativeThreadPlanBudget(lang, chapters)`（直接调 `outputTokensFor`）、`NARRATIVE_THREAD_CHAPTER_BUDGET_POLICY`、`assertNarrativeThreadChapterBudget` / `assertNarrativeThreadBatchBudget`。形状以实施包 §3.1 为准。
2. `src/shared/narrative-thread-progress-pure.ts` —— 档3 纯函数：`chapterUnionCount(ranges)`、`coveredChapterUnion(plans, unit)`、`narrativeThreadProgress(plans, unit, writtenChapters)` ⇒ `{scanned, written, remaining, suggestion}`；**不引用 `maxChapters`**。
3. `src/services/narrative-thread-batch-runner.ts` —— 串行执行器，注入 `runChapter`，不直接依赖 IPC。
4. 测试三件（只此三件）：
   - `src/shared/__tests__/narrative-thread-range-pure.test.ts`
   - `src/shared/__tests__/narrative-thread-progress-pure.test.ts`
   - `src/services/__tests__/narrative-thread-batch-runner.test.ts`

### 修改（4）

5. `src/components/editor/NarrativeThreadEditor.tsx` —— 起点章＋章数两个输入（`aiRangeStart`／`aiRangeCount`，初值 `aiRangeCount = 1`）、按章分组候选、失败即停与续跑、档3 提示条、按 handle 确认。
6. `src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx` —— **只追加**用例（区间派发、失败即停、档3 条不显示／显示）；既有断言 `:944`（`{input:{kind:'plan',chapterNumber:2}}`）**一字不改**。
7. `docs/design/architecture/p6-narrative-thread-range-design.md` —— 只在文件头补一行「§3.1/§3.2/§6.2 已由实施包覆盖，现值以本包为准（2026-11-24）」，正文不改。
8. `src/services/generation/task-budget-planner.ts` —— **只给 `outputTokensFor` 加 `export` 关键字（`:174`）**；函数体、`S07_TASK_BUDGET_POLICY` 任何数值、其它函数一律零改动。
   - 硬判据：本文件 `git diff --numstat` 必须 **≤ `2/2`**；出现任何数字变更（512／3_072／2_048 等）即打回。

## §3 口径（六条，逐条照做）

1. **预算只有一个来源**：`S07_TASK_BUDGET_POLICY`（`task-budget-planner.ts:4`；`:17` `baseTokens = 512`；`:22` `zh-CN.planning = 3_072`；`:23` `en-US.planning = 2_048`）＋已存在算式 `outputTokensFor`（`:174-183`，`base + quantity × tokensPerItem[lang][stage]`，N=0 返回 0）。**实现里不许出现任何字面量 3,072／512／32,768，也不许出现 `32_768 / 10` 这类反推**。派生值（测试里可由 policy 复算，不许写死进实现）：zh 单章 `3,584`、zh 10 章 `31,232`、对硬顶 32,768 余 `1,536`；en 单章 `2,560`、10 章 `20,992`。
2. **三道闸，顺序本身就是判据**：①区间闸 `assertPlanningActionRange`（`plot-outline-contract.ts:22`，抛 `GENERATION_PLANNING_RANGE_INVALID`）→ ②单章预算闸 `NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED` → ③批声明闸 `NARRATIVE_THREAD_BATCH_BUDGET_EXCEEDED`。不许新写 `> 10` 分支，不许跳闸。
3. **每章预算原样 4,096**：`NARRATIVE_THREAD_CANDIDATE_BUDGET`（`narrative-thread-generation-pure.ts:38-43`）不动；批预算只做**声明**（开跑前算一次），不改每章实际请求。
4. **串行执行器语义**：`runNarrativeThreadChapters({range, runChapter, signal, onProgress})` 顺序调用第 1..N 章；第 k 章失败即停（k+1 不发起）、1..k-1 候选保留、`failedChapter` 记会话内可续跑；**禁跳过章、禁减 N、禁缩文本**。
5. **图生成仍是单章请求**：每章 `open` → `execute` → `read` → `detach()`（`src/services/graph-generation.ts:78`），不保留 N 个 client；确认时 `open({handle})`（`:41-52`）→ `confirm(index, handle)`（`:67-77`）→ `detach()`。`src/shared/graph-generation.ts` 契约不动。
6. **档3 计数诚实**：`scanned A = |⋃ plan 区间 ∩ 单元区间|`、`written W = 单元内已定稿去重章数`、`remaining B = max(0, W − A)`；建议起点＝并集右端+1，章数 `min(3, W−右端)`；单元来自 `probeSynopsisUnitLaunchForProject`（`src/services/workflows/synopsis-unit-launch.ts:433`，**永不抛错**）；**禁读 `maxChapters`**、禁建扫描表、`reject` 也算已扫。
   - ⚠️ **W 只准数 `finalized`**：`finalizedDrafts` 已在 `NarrativeThreadEditor.tsx:360` 过滤 `status === 'finalized'`。**禁止**直接数 `db:draft-list-all`（`ipc-channels.ts:1154`）的原始返回：`DraftStatus` 有五档 `draft|revised|reviewed|finalized|archived`（`src/shared/draft-status.ts:7`），`reviewed` 不是定稿，从原表数会把 W 撑大、「剩余 M 章」算小。
   - ⚠️ **`unit === null` ⇒ 建议条整条不渲染，且 ≠ 剩余 0 章**：探针取不到单元时返回 `{ unit: null, reason: 'probe-error' }`（`synopsis-unit-launch.ts:457-469`）。禁止把 `remaining` 写成 `0`、禁止渲染「剩余 0 章」或任何数字占位，也禁止拿 `totalChapters` 顶替单元右端。

## §4 判据（每条给命令；跑不成就照实写「未跑成 + 报错原文」）

| # | 层 | 判据 | 证据 |
|---|---|---|---|
| J1 | [static] | `narrativeThreadPlanRange` 对 `count=0`、`count=11`、`start+count-1 > totalChapters`、`start<1` 四种情形均抛 `GENERATION_PLANNING_RANGE_INVALID`；`grep` 证明全卡只有一处调 `assertPlanningActionRange`、无自写 `> 10` 分支 | range-pure 单测汇总行 |
| J2 | [static] | `assertNarrativeThreadChapterBudget('zh-CN', 3_072)` 抛 `NARRATIVE_THREAD_CHAPTER_BUDGET_EXCEEDED`，原文含 `required 3584` 与 `perAttempt 3072`；`('zh-CN', 4_096)` 不抛；`narrativeThreadPlanBudget('zh-CN',1) === 3_584`、`('en-US',1) === 2_560` | 同上 |
| J3 | [static] | `assertNarrativeThreadBatchBudget('zh-CN', 10, 32_768)` 不抛、required `31,232`；`('zh-CN', 6, 16_384)` 抛、required `18,944`；**顺序用例**：`N=11` 抛的是 `GENERATION_PLANNING_RANGE_INVALID`（区间闸在前） | 同上 |
| J4 | [mock] | 串行与失败即停（注入假 `runChapter`）：N=3 第 2 章抛错 ⇒ 调用序列 `[1,2]`（第 3 章未调用）、`failedChapter === 2`、第 1 章候选仍在、`results` 长度 2 | runner 单测汇总行 |
| J5 | [mock] | 每章预算原文：3 次调用捕获的 `maxRequestedOutputTokensPerAttempt === 4096` 且与 N 无关（N=1 与 N=10 同值） | 同上 |
| J6 | [mock] | 档3 计数：计划并集 `[11,20]`、单元 `from=1`、已写 `1..32` ⇒ `scanned 10`／`written 32`／`remaining 22`／`suggestion {start:21,count:3}`；空计划 ⇒ `suggestion === null`；`unit === null` ⇒ `suggestion === null` 且**不得**输出 `remaining 0`；**只数 `finalized`**（`draft-status.ts:7` 五档、`reviewed` 不计）；**同文件带变异用例**：`unit.maxChapters = 8` 时 `remaining` 仍为 22 | progress-pure 单测汇总行 |
| J6b | [mock] | browser 单文件：无计划行 ⇒ 不渲染建议条；并集 `[11,20]` ⇒ 渲染 `已扫 10 章 / 剩余 22 章` | browser 汇总行 |
| J7 | [mock] | N=1 等价：`narrativeThreadPlanRange(2,1)` ⇒ `{from:2,to:2}`；UI 仍派发 `{ kind:'plan', chapterNumber: 2 }`（既有断言不改且绿） | browser 汇总行 |
| J8 | [live] | 真实 Electron ＋ 真实 SQLite：N=3 跑完 `narrative_thread_plans` 出现 3 条、`target_start_chapter`／`target_end_chapter` 与输入一致；中途 kill 后已落库行不丢 | 一卡一脚本＋库读原文＋`tasklist` 原文 |
| J9 | [static] | `node scripts/check-fast.mjs` 输出 `CF_EXIT=0`；`node node_modules/typescript/bin/tsc --noEmit` 输出 `TSC_EXIT=0` | 两行原文 |

J8 要求：单实例、一次启动取完证据、`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses=0`＋`tasklist` 原文；**跑不成写「未跑成 + 报错原文」并标 `[live] 未跑成`，不许用 mock 顶**。触发失败章的实机取证本轮不做（模型侧截断不可稳定复现），失败即停以 J4 的 `[mock]` 为准。

## §5 变异（M1／M2／M3 必发，M4 可选；每发转红并写红掉的用例号）

| 号 | 靶 | 改法 | 期望转红 |
|---|---|---|---|
| M1 | 档3 `remaining` | 把 `max(0, W−A)` 改成 `unit.maxChapters − A` | J6（含 `maxChapters=8` 那条） |
| M2 | 预算算式 | 把 `narrativeThreadPlanBudget` 改成 `quantity × 3_072`（丢 base） | J2、J3 |
| M3 | 串行执行器 | 第 k 章失败后继续调用 k+1 | J4 |
| M4（可选） | N=1 派发 | 把区间派发改回 `chapterNumber` 单章 | J7 |

每发变异**手工把改动逐字改回原文**（**禁用** `git checkout`／`restore`／`stash`／`reset`，与 §0.4 第 4 条同一条红线），改回后复跑同一条命令。回执贴「变异后红行 → 改回后绿行」两段原文，并贴 `git -C … status --porcelain -uall`（改回后应只剩你白名单内的新增／修改，不应出现变异残留的额外文件）。只红 0 条按「断言空」退回。

## §6 命令（自测原文贴回执）

第 1 笔：

```
node scripts/run-tests-electron.mjs src/shared/__tests__/narrative-thread-range-pure.test.ts src/shared/__tests__/narrative-thread-progress-pure.test.ts src/services/__tests__/narrative-thread-batch-runner.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

第 2 笔：

```
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/editor/__tests__/NarrativeThreadEditor.browser.tsx
node scripts/check-fast.mjs
```

汇总行必须出现 `Tests N passed (N)`（不接受 `-t` 过滤）与 `CF_EXIT=0`／`TSC_EXIT=0`。

## §7 交付形态与回执

- **只写盘，不提交**（§0.4 第 4 条）。写完后**不要**清理工作树：两笔的改动会同时留在盘上，由联络人分两笔代提交——所以最终 `git status --porcelain -uall` 会列出 §2 的 8 项，**这是预期**，不是「没收干净」。
- 两笔的划分请写进回执（一笔列 §2 的 1–4 与 8，另一笔列 5–7），联络人照此 `git add <点名路径>`。
- 产物目录 `C:\tmp\c1-s2\doubao\s3-p6\`：`receipt-to-owner.md`、J8 实机脚本与截图、库读原文；**禁写 `.batch/*`**。
- 回执至少含：四行头＋「只写盘，未提交」一行、`rev-parse --abbrev-ref HEAD`／`rev-parse --short HEAD`／`status --porcelain -uall` 三段原文（收工时）、J1–J9 逐条对号（含 J9 两行、J8 的 `tasklist`／`EXIT=`／库读原文）、变异红/绿原文、§6 各命令汇总行、未做项与原因。
- **不要自己报「已完成」**，也不要写「已修好」这类措辞；台账与判词不由你写。自报「已落盘」不算交件，我会自己核路径、字节、sha256 与白名单。

## §8 本卡不做

- 不做档2（按单元批量）；不改蓝图 10 章链路（`src/services/workflows/commands/architecture.command.ts:319`／`:341`、`src/shared/agent-generation.ts:8-11`）。
- 不动 `PLANNING_ACTION_CHAPTER_LIMIT` 的值、`DEFAULT_PLANNING_ACTION_CHAPTERS`、`NARRATIVE_THREAD_CANDIDATE_BUDGET` 的 4,096。
- 不动 `src/shared/graph-generation.ts`、`electron/services/graph-generation*.ts`、任何 `electron/migrations/*`、`src/shared/project-storage.ts`、`portable-project-*`。
- 不碰 C1 的 16 件（`character-regeneration-diff.ts`、`CharacterRegenerationDiffPanel.tsx`、`character-proposal-service.ts`、`m31-character-regeneration-snapshots.ts` 等）。
- 不做逐字文本 diff、不删旧章区间模式、不改既有测试断言（只准追加）。
- 不需要真实模型调用；若确实需要，只准 Magpie `group/ai-novel`（`http://127.0.0.1:3425/v1`），禁 `group/deepseek`。

## §9 本件已处理的冲突（照做即可，不必再来问）

1. **分支谁建**：`card/s3-p6-range` 由联络人投前创建并检出（`switch -c` 是 git 写操作）；你发现分支不存在或 HEAD 不是 `8a42a566` 就停手，**不许自己建**。
2. **`docs/agents/worktree-parallel.md` 槽位表已过期**（写「wt-2 给 WorkBuddy、wt-1 给豆包」）：**以本派单为准**，本卡在 `wt-2`；该文档本卡不改，别再把它当冲突上报。
3. **机器注入前言与「自己提交」的冲突**：本卡已按「只写盘、提交由联络人代做」重写，注入前言第 2、3 条与本件一致，按本件执行。
