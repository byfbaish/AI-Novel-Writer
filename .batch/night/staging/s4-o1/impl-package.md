# O1 实施包：单元内逐章事件进度水位（卡 58188c1c · 起点 `cbbe82c3`）

> 依据：`docs/design/architecture/o1-unit-event-progress-design.md`（190 行，改判版）＋项目总负责人 2026-11-24 两条技术裁（N 不用 `maxChapters`；「进度：」行不是加一句文案）＋项目总负责人 2026-11-24 23:5x 三条裁定（分母带 `s0`、上界钳 `M-1`、EV-1 双布尔量）＋admin 2026-11-24 23:29 派单五条。
> 本包只覆盖**提示词组装 ＋ 纯函数**（卡面 done-when 原文：「只动提示词组装与纯函数，不改请求数与 cursor」）。
> 取证树：`C:/develop/workspace/AI-writer/wt-2`，`git rev-parse --short HEAD` = `cbbe82c3`，`git status --porcelain -uall` = 0 行。

---

## §0 前置：四处按原文更正（派单与设计稿的口径，需 admin 一句确认后再派）

派单/设计稿里有四处与本仓原文对不上，**我按原文改成本包口径**，逐条给证据；若 admin 不认，改回只需改本包、不动代码。

### 0.1 路径：`synopsis-two-level-suffix.ts` 在 `prompts/` 下

派单写 `src/services/synopsis-two-level-suffix.ts:29-30`，该路径**不存在**。

```
$ ls src/services/*two-level* src/services/prompts/*two-level*
ls: cannot access 'src/services/*two-level*': No such file or directory
src/services/prompts/synopsis-two-level-suffix.ts
```

正确路径：`src/services/prompts/synopsis-two-level-suffix.ts`（240 行）。`ZH_TWO_LEVEL_SUFFIX` 在 `:29`，`EN_TWO_LEVEL_SUFFIX` 在 `:135`，出口 `getSynopsisTwoLevelSuffix` 在 `:238-240`。

### 0.2 「四处同笔」的第四处不是 `prompt-language-contract.test.ts`

`src/services/__tests__/prompt-language-contract.test.ts` 里**没有任何一处**断言这份 suffix：它 `:441` 起的 `describe('弧光 v7 契约（卷 / 单元 · 两级 · 画像驱动）')` 断言的是**内置** `plot_structure` 模板 `content`，与本卡要改的渲染期 suffix 无关。

```
$ grep -c "除这些行以外不要加任何说明行" src/services/__tests__/prompt-language-contract.test.ts
0
$ grep -c "进度：E\|TwoLevel\|two-level" src/services/__tests__/prompt-language-contract.test.ts
0
```

全仓只有两处引用这句合同原文，且都在同一个源文件里：

```
$ grep -rn "除这些行以外不要加任何说明行\|no extra labels, headings or commentary" src electron --include=*.ts
src/services/prompts/synopsis-two-level-suffix.ts:30:每章按以下顺序输出，除这些行以外不要加任何说明行、标签行或注释：
src/services/prompts/synopsis-two-level-suffix.ts:136:Output each chapter in exactly this order, with no extra labels, headings or commentary lines:
```

唯一断言这份 suffix 的测试文件是 `src/services/__tests__/synopsis-two-level-suffix.test.ts`（16 条，`:17-18` 取 zh/en）。

```
$ grep -rn "getSynopsisTwoLevelSuffix" src electron --include=*.ts --include=*.tsx
（调用方）src/services/workflows/commands/architecture.command.ts:70、:3682、:4266
（测试）  src/services/__tests__/synopsis-two-level-suffix.test.ts:2、:17、:18、:173、:174
```

故「同笔四处」改为：①`ZH_TWO_LEVEL_SUFFIX`（`:29-35`）②`EN_TWO_LEVEL_SUFFIX`（`:135-141`）＝同一文件两段；③`src/services/__tests__/synopsis-two-level-suffix.test.ts`（追加断言）；④`src/shared/__tests__/unit-arc-position.test.ts`（`renderUnitArcPositionBlock` 的**宿主测试**——本卡在块尾追加了一行，落点变了，故它的断言必须同笔跟上；理由不是「它断言 suffix」，见 §2 第 6 项）。`prompt-language-contract.test.ts` **本卡一个字都不动**（动它反而会碰内置模板断言）。

### 0.3 算术：分母必须带起点偏移，上界必须钳到 `M-1`

设计稿 §3.2 原文：「`N` ＝**该章落盘时单元内已写章数**」、「写到第 6 章时 N=6」，区间 `[floor(k·M/N), ceil(k·M/N)]`。它有两个独立的问题，**都不是口径选择**：

1. **算出不存在的步号**：同一章既是第 `k` 章、又让 `N = k` ⇒ `floor(k·M/N) = M`，而合法编号只到 `E(M-1)`（§3.2 口径）。
2. **多批单元恒误报**：`k` 从 1 起、`N` 只数本批，于是「第 1 章应落在 E1」与已走到的水位无关，第二批起必报「水位回退」。

```
$ node -e 'const M=4;for(const N of [3,4])for(let k=1;k<=N;k++)console.log(`M=${M} N=${N} k=${k} band=[${Math.floor(k*M/N)},${Math.ceil(k*M/N)}]`)'
M=4 N=3 k=1 band=[1,2]
M=4 N=3 k=2 band=[2,3]
M=4 N=3 k=3 band=[4,4]
M=4 N=4 k=1 band=[1,1]
M=4 N=4 k=2 band=[2,2]
M=4 N=4 k=3 band=[3,3]
M=4 N=4 k=4 band=[4,4]
$ node -e 'const M=4;for(let k=1;k<=4;k++)console.log(`设计稿字面 N=k=${k} band=[${Math.floor(k*M/k)},${Math.ceil(k*M/k)}]`)'
设计稿字面 N=k=1 band=[4,4]
设计稿字面 N=k=2 band=[4,4]
设计稿字面 N=k=3 band=[4,4]
设计稿字面 N=k=4 band=[4,4]
```

**本包口径（项目总负责人 2026-11-24 23:5x 裁定，admin 复核通过；原「`frozenN`」名已废）**：

```
b  = to - from + 1     # 本批章数；to 见 architecture.command.ts:3514（请求期即定死）
j  = 1..b              # 章在本批内的序号
M  = stepCount         # 事件步数，编号 E0…E(M-1)
s0 = 本批首章之前最后一章的声明值；无则 0；钳到 [0, M-1]

raw(j)   = s0 + j * (M - 1 - s0) / b
lower(j) = max(s0, min(M-1, floor(raw(j))))
upper(j) = max(s0, min(M-1, ceil (raw(j))))
```

三组实算（我跑的原文，与负责人裁定逐条对齐）：

```
$ node -e 'const f=(s0,M,b)=>Array.from({length:b},(_,i)=>{const j=i+1;const v=s0+j*(M-1-s0)/b;return `j=${j} [${Math.min(M-1,Math.floor(v))},${Math.min(M-1,Math.ceil(v))}]`}).join("  ");console.log("s0=0 M=4 b=10:",f(0,4,10));console.log("s0=3 M=4 b=10:",f(3,4,10));console.log("s0=0 M=6 b=3:",f(0,6,3));console.log("s0=1 M=4 b=2:",f(1,4,2));'
s0=0 M=4 b=10: j=1 [0,1]  j=2 [0,1]  j=3 [0,1]  j=4 [1,2]  j=5 [1,2]  j=6 [1,2]  j=7 [2,3]  j=8 [2,3]  j=9 [2,3]  j=10 [3,3]
s0=3 M=4 b=10: j=1 [3,3]  j=2 [3,3]  j=3 [3,3]  j=4 [3,3]  j=5 [3,3]  j=6 [3,3]  j=7 [3,3]  j=8 [3,3]  j=9 [3,3]  j=10 [3,3]
s0=0 M=6 b=3:  j=1 [1,2]  j=2 [3,4]  j=3 [5,5]
s0=1 M=4 b=2:  j=1 [2,2]  j=2 [3,3]
```

性质（写进实现注释，测试按此断）：

- **区间宽度恒 ≤ 1**（同一有理数的 floor/ceil 之差 ≤ 1），与 `b`、`M`、`s0` 无关；全枚举不会有反例。
- **「每章最多推进 1 步」只在 `b ≥ M-1-s0` 时成立**——`M=6, b=3` 每章推进 2 步、区间宽度仍 ≤1。它**不是**不变量，实现与测试都不得把它写成断言（项目总负责人 2026-11-24 原话）。
- `upper(b) = M-1`（终态），这就是 EV-1 的算术来源；`upper` 已钳到 `M-1`，故 `EM` 这个不存在的步号不可能出现。
- `s0 = M-1` 时整批恒 `[M-1, M-1]`：重新线性折算不会把已写到的水位往回拉（`s0=3,M=4,b=10` 那组）。
- 超写（实际章数 > `b`，`arc-position.ts:313` 注释的 ±10% 带）：`j > b` 不在本批定义域内 ⇒ 调用方只对已写章取值，不构造 `j > b` 的区间。


### 0.4 快照表：本卡不建表（与设计稿 §3.2「落快照表」冲突，按卡面 done-when 从窄）

设计稿 §3.2 要求每章把当时的 N「冻进快照表」；卡面 done-when 写的是「**只动提示词组装与纯函数**，不改请求数与 cursor」。两者不能同时成立：建表要新 migration ＋ `desktop-registry` ＋ `project-storage` 登记 ＋ portable 字段策略（M30 那次漏登记，便携导出静默坏了两个测试，见 `.batch/night/staging/s2-c1/addendum-m31-registration.md`），那是另一张卡的量级。

**本卡口径**：冻结语义只做在纯函数入参（`batchSize`／`startStep` 由调用方给，本卡调用方给「本批章数」与「落库大纲末条声明」）；落库、跨批复核、编辑器提示条 UI 归 S5 新卡（建议名：O1-b 水位落库与提示）。本卡**不新增表、不动 migration、不动 portable**。

---

## §1 现状（全部逐条核过，`file:line`）

| 事实 | 位置 |
|---|---|
| 两级合同 ZH 常量开头 5 行输出清单 ＋「除这些行以外不要加任何说明行」 | `src/services/prompts/synopsis-two-level-suffix.ts:29-35`（禁句 `:30`） |
| 同一常量内的硬禁令：「严禁输出「覆盖：」行」「不得自造任何形如 V1-U1-Start、M1-1 的编号」 | `:37` |
| EN 版同位置 | `:135-141`（禁句 `:136`、禁覆盖 `:143`） |
| 该文件注定只能改**渲染文本**：`synopsisInputsFingerprint` 对模板对象整体 stringify | 文件头注释 `:22-27`；指纹实现 `src/services/workflows/commands/architecture.command.ts:1236-1245`（11 个源事实字段 `:1303-1317`） |
| 模板段只认「真正进模型输入的那几段」，含**内置** `systemSuffix`（渲染期覆盖版被丢弃） | `architecture.command.ts:1247-1276`（`promptRenderSignature`） |
| 事件串切分已存在：按 `→`/`->` 切，段数 < 2 返回 `[]` | `src/shared/arc-position.ts:95-102` `splitMinorSteps` |
| 既有唯一调用点（小弧 text → 步数，用于体检） | `arc-position.ts:1806` |
| 单元弧位块：已有「卷 / 单元 / 离开状态 ＋ 单元内小弧清单 ＋ 四条硬约束」，返回单一字符串 | `arc-position.ts:1349-1408` `renderUnitArcPositionBlock(parsed, totalChapters, volumeIndex, unitIndex, writingLanguage)` |
| 该块的包装函数（裁结构 ＋ 追加块） | `arc-position.ts:1412-1426` `withProjectedUnitArcGuide(guide, plan, totalChapters, volumeIndex, unitIndex, writingLanguage)` |
| 单元内小弧清单在这里渲染（`span.midMinors`，各带 `name` / `text`） | `arc-position.ts:1372-1375`（`midMinors` 定义 `:185`、赋值 `:535`） |
| 组装侧唯一调用点（单元模式） | `architecture.command.ts:3660-3668`（`unitContext ? withProjectedUnitArcGuide(...)`） |
| 本批章数在此定死（`batchSize` 的来源；`to` 请求期即定，生成后按实际章数回填，`batchSize` 不随回填变） | `architecture.command.ts:3505-3514`、回填 `:4004` |
| `s0` 的唯一来源：落库大纲全量正文里的最后一条「进度：」 | `architecture.command.ts:3491`／`:3606`（`sourceExpected.synopsis` 整段喂给 `confirmedPrefixFromDbOutline`） |
| 「本批即单元收口」的结构证据（不存在单元内多批） | `architecture.command.ts:4011` `advanceUnitCursor(...)`、`:4017-4031` 日志 |
| 两级 suffix 的接入点（zh: `:3682`、en 同、另一处 `:4266`） | `architecture.command.ts:3682`、`:4266` |
| 既有测试基线：三文件 `Tests 97 passed (97)`、`EXIT=0` | `node scripts/run-tests-electron.mjs src/services/__tests__/synopsis-two-level-suffix.test.ts src/shared/__tests__/arc-position.test.ts src/shared/__tests__/unit-arc-position.test.ts` |
| 单元弧位块既有断言只 `toContain`（无整块逐字快照） | `src/shared/__tests__/unit-arc-position.test.ts:51-78` |
| 全仓无 `src/shared/o1-*`（本卡两件确为新增） | `ls src/shared/o1-*` ⇒ `No such file or directory` |

**结论**：本卡 = ①给 suffix 加「进度：」这一个第 6 行（并改那句禁句）②新增一个纯函数模块（步数 / 区间 / 声明解析 / EV 判定 / 注入行文本）③在既有单元弧位块**末尾**追加一行（不传参则逐字不变）④组装侧传一个数字。

---

## §2 白名单（7 项：2 新增 / 5 修改）

> 除下列 7 项外，任何文件改动都算越界；**不许自建第 8 个文件，包括测试**。

### 新增（2）

1. `src/shared/o1-event-progress.ts` —— 纯函数，**不 import 任何 electron / react / ipc**，只可 import `./arc-position` 的 `splitMinorSteps`。导出面（形状照此写，不给自由度）：
   - `export type O1StepBand = { readonly lower: number; readonly upper: number }`
   - `export type O1Declaration = { readonly chapterIndex: number; readonly reached: number }`
   - `export type O1Finding = { readonly code: 'EV-1' | 'EV-2' | 'EV-3' | 'EV-4'; readonly chapterIndex: number; readonly message: string }`
   - `export function unitEventSteps(minors: readonly { readonly name: string; readonly text?: string }[]): string[]` —— 对每个小弧调 `splitMinorSteps(minor.text)`；切出为空则该小弧计 **1 步**（用 `minor.name`）；返回拼接后的步数组（`M = length`）。
   - `export function eventBandOf(input: { readonly chapterIndex: number; readonly batchSize: number; readonly startStep: number; readonly stepCount: number }): O1StepBand | null` —— 任一非安全整数、`chapterIndex < 1`、`batchSize < 1`、`stepCount < 2`、`startStep < 0` 或 `startStep > stepCount - 1` ⇒ `null`；否则按 §0.3：`raw = startStep + chapterIndex * (stepCount - 1 - startStep) / batchSize`，`lower = Math.max(startStep, Math.min(stepCount - 1, Math.floor(raw)))`、`upper = Math.max(startStep, Math.min(stepCount - 1, Math.ceil(raw)))`。**参数名里不许出现 `frozenN`**（旧名已废，`grep` 判据见 J6）。
   - `export function lastDeclaredStep(outlineText: string): number | null` —— 在整段大纲正文里取**最后一条**声明（同时认 zh `进度：E<n>` 与 en `Progress: E<n>`，全角/半角冒号、行首尾空白均容），返回 `<n>`；一条都没有 ⇒ `null`（调用方按 §0.3 取 0）。**`s0` 的唯一解析点**，别处不许再写一遍正则。
   - `export function parseProgressLine(line: string, language: WritingLanguage): number | null` —— 只认整行 `^进度：E(\d+)$`（en：`^Progress: E(\d+)$`，`E` 大写、全角冒号、行首尾允许空白）；不匹配返回 `null`（**不推断、不顺延**）。
   - `export function enforceEventProgress(input: { readonly stepCount: number; readonly batchSize: number; readonly startStep: number; readonly declarations: readonly O1Declaration[]; readonly language: WritingLanguage; readonly unitComplete: boolean }): O1Finding[]` —— 实现 EV-1..4（§3.4）；`stepCount < 2`、`batchSize < 1` 或 `declarations` 为空 ⇒ 返回 `[]`（fail-open）；`unitComplete === false` 时**不出 EV-1**。
   - `export function renderEventProgressHint(input: { readonly stepCount: number; readonly batchSize: number; readonly startStep: number }, language: WritingLanguage): string` —— 注入行**一行**纯文本（§3.5），`stepCount < 2`、`batchSize < 1` 或 `startStep` 越界时返回 `''`。
2. `src/shared/__tests__/o1-event-progress.test.ts` —— 只测上列**七个**函数＋三个类型（J1、J1b、J2–J4d、J6）；`lastDeclaredStep` 是 `s0` 唯一解析点，必须单列 J1b。

### 修改（5）

3. `src/services/prompts/synopsis-two-level-suffix.ts` —— ZH `:29-35` 与 EN `:135-141` 各加**一条**第 6 行清单项 ＋ 改禁句（§3.1）。硬判据：`git diff --numstat` 本文件 **≤ `8/4`**；`:37`／`:143` 两条禁覆盖行原文**一字不改**；文件内除这两段外零改动。
4. `src/shared/arc-position.ts` —— ①`renderUnitArcPositionBlock` 加**第 6 个可选参** `progress?: { readonly batchSize: number; readonly startStep: number }`，仅在其存在且返回值非空时，于返回串**末尾**追加 `\n` ＋ `renderEventProgressHint(...)`（`stepCount` 由函数内部的 `span.midMinors` 算，调用方不传步数）；②`withProjectedUnitArcGuide` 加**第 7 个可选参** `progress?: { readonly batchSize: number; readonly startStep: number }` 原样透传。硬判据：numstat **≤ `20/4`**；不传 `progress` 时两个函数的返回值与 `cbbe82c3` **逐字相同**。
5. `src/services/__tests__/synopsis-two-level-suffix.test.ts` —— **只追加**（既有 16 条一字不改）：ZH 含 `进度：E<n>` 且仍是「唯一允许的附加行」；EN 同步含 `Progress: E<n>`；ZH/EN 仍各含原禁覆盖行原文。
6. `src/shared/__tests__/unit-arc-position.test.ts` —— **只追加**一个新 `describe`（与既有 4 个 `describe` 并列，`:30`／`:51`／`:82`／`:134` 不动）。**只加一条 `toContain` 不算完成**，三条断言缺一即打回：
   - (a) 不传第 6 参 ⇒ 块内 `not.toContain('事件进度')`，且既有那 4 条 `toContain` 一字不改地通过；
   - (b) 传 `{ batchSize: 3, startStep: 0 }` 且单元有 ≥2 步小弧 ⇒ **位置**：`block.split('\n').at(-1)` 逐字等于 `renderEventProgressHint({stepCount, batchSize:3, startStep:0}, 'zh-CN')`，且 `block.endsWith(hint)` 为真（证明它在**末尾**而不是块中间）；
   - (c) 同一次返回里既有四行原文仍在：对返回串逐条断言「卷 / 单元 / 离开状态」「小弧清单的既有行」「四条硬约束」的原文片段仍出现（片段取自 `:51` 那个既有 `describe` 的既有断言原文，逐字复制），且 `block.match(/本单元事件进度/g).length === 1`（只注入一次）。
7. `src/services/workflows/commands/architecture.command.ts` —— 只改两处，别动别行：
   - ① import：`:13` 那条 `import { …, withProjectedUnitArcGuide, … } from '../../../shared/arc-position'` 源不同，**加不进** o1 符号；在 `:13` **之后新增一行**：`import { lastDeclaredStep } from '../../../shared/o1-event-progress';`（相对深度照 `:13` 的 `../../../shared/`）。
   - ② 调用点 `:3660`：原文 `? withProjectedUnitArcGuide(`，现 6 实参（`:3661` `guide,`、`:3662` `core?.plotStructurePlan,`、`:3663` `totalChapters,`、`:3664` `unitContext.cursor.volumeIndex,`、`:3665` `unitContext.cursor.unitIndex,`、`:3666` `writingLanguage,`，`:3667` 收 `)`）。在第 6 实参 `writingLanguage,`（`:3666`）**之后新增一行**第 7 实参，缩进对齐 `:3666`：`            { batchSize: to - from + 1, startStep: lastDeclaredStep(sourceExpected.synopsis) ?? 0 },`。
   - **不许写 `:36xx` 区间**（豆包会照字面改错位置）；`:3668` 的 `: withProjectedArcGuide(guide, core?.plotStructurePlan, totalChapters, from, to, writingLanguage))` 分支**零改动**。硬判据：本文件 numstat **≤ `16/2`**（import 1 行 ＋ 实参 1 行）；`:3514` 的 `to` 算式、`:3682`／`:4266` 的 suffix 接入、任何 cursor／purpose／请求数相关行**零改动**。

---

## §3 口径（六条，写死，不留自由度）

### 3.1 「进度：」行是**唯一允许的第 6 行**（§0.2 四处同笔）

ZH `:29-35` 现状（节选）：

```
每章按以下顺序输出，除这些行以外不要加任何说明行、标签行或注释：
- 第一行：章标题「## 第N章：章名」；
- 第二行：「定性：…」；
- 第三行：「选择：…」；
- 其后：正文，连贯段落；
- 最后一行：「钩子：…」。
```

改成（顺序照此，一字不多）：

```
每章按以下顺序输出，除这些行以外不要加任何说明行、标签行或注释：
- 第一行：章标题「## 第N章：章名」；
- 第二行：「定性：…」；
- 第三行：「选择：…」；
- 其后：正文，连贯段落；
- 倒数第二行：「钩子：…」；
- 最后一行：「进度：E<n>」——本单元事件走到第几步（累计，含本章），只写这一个词加编号，其后不许再写任何内容。
```

要点（缺一条即打回）：
1. `钩子：` 从「最后一行」降为「倒数第二行」，`进度：` 占「最后一行」，**两句必须同时改**（否则模型拿到两个「最后一行」）。
2. 只加**一条**清单项，不许加解释段、不许加示例、不许加「只核声明」之类的元话语。
3. 新行文本里**不得**出现 `{{`（不新增模板变量，判据 ⑪）；`{{step_guidance}}`（`:133`／EN `:235`）是既有唯一占位符，原样保留。
4. EN 同段同步：`Last line: "Hook: <one sentence>"` 改 `Second-to-last line: …`，末行 `"Progress: E<n>" — how far this unit's events have gone by the end of this chapter (cumulative), the word plus the number only.`
5. `:37`「严禁输出「覆盖：」行…」与 `:143` 对应行**一字不改**——本卡的「进度：」不是覆盖行。

### 3.2 事件编号与步数 M（沿用，不新造）

- `M` 的取法**唯一**：`unitEventSteps(span.midMinors)`（§2 第 1 项）——单元内每个小弧的 `text` 调既有 `splitMinorSteps`；`text` 切不出 ≥2 段时该小弧计 1 步（用 `name`）。**不新写切分逻辑，不许在实现里再 `split(/→|->/)` 一次**。
- 步序号 `E0…E(M-1)`；`M < 2` ⇒ 本单元不声明水位：注入行返回 `''`、`enforceEventProgress` 返回 `[]`、不产生任何提示。
- `E0` 是起点（第一个小弧的起点），**不是**「第 1 步」；`进度：E3` ＝ 已到第 3 步（累计，含），与 `M-1` 为终态。

### 3.3 每章区间（§0.3 口径）

- `b` ＝ 本批章数 ＝ `to - from + 1`：`from` 与 `to` 在请求期就定死（`architecture.command.ts:3505-3514`）；生成后 `to` 会按实际章数回填（`:4004`），但**本批的 `b` 不随后者变**——它就是开工时冻结的那个数。
- `j` ＝ 章在本批内的序号 1..`b`；`M` ＝ `unitEventSteps(span.midMinors)` 的长度；`s0` ＝ `lastDeclaredStep(sourceExpected.synopsis) ?? 0`，再钳到 `[0, M-1]`。
- 区间 ＝ `[floor(s0 + j·(M-1-s0)/b), ceil(s0 + j·(M-1-s0)/b)]`，两端再钳到 `[s0, M-1]`；`j = b` 时上界恒 `M-1`。
- `s0` **只从落库大纲的最后一条声明读**（`sourceExpected.synopsis`，全量正文：`:3491`／`:3606` 把它整段喂给 `confirmedPrefixFromDbOutline`），不建表、不缓存、不落第二份真相。
- 实现里**不许**出现 `maxChapters` 这个标识符（判据 J4c 的分支），也不许从 `plot-outline-contract.ts:150-154` 读任何值。


### 3.4 四条不变量（EV-1..4，全部 fail-open，只出提示）

入参 `unitComplete` 的两个布尔量**各自给算法**（不许只写名字就过）：

- `isUnitLastBatch` ≡ 本次是单元模式批次（`unitContext !== null`，`architecture.command.ts:3509-3514`）。结构上「一批写一个单元、写完即推进」：`:4011` `advanceUnitCursor(...)` 恒推进，`:4017-4031` 的日志直接落「下一个单元：卷 X 单元 Y」或「弧光单元已全部写完」——**本仓不存在「单元内分多批」**，故 `unitContext !== null` 与「本批是单元末批」等价。若将来引入单元内多批，改为比对 `:4011` 的 `unitNextCursor` 与 `unitContext.cursor` 是否同单元。
- `lastChapterWritten` ≡ 实际覆盖到名义末章：`backfill.to >= to`，`backfill` 来自 `backfillUnitBatch(merged, from, totalChapters)`（`:360-371`），回填点 `:4004` `to = backfill.to`。少写的批（`backfill.to < to`）该布尔量为 false。
- `unitComplete = isUnitLastBatch && lastChapterWritten`。**非末批、或名义末章没写，一律不报 EV-1**：少写的单元是「没走到终态」，不是违约。

| 编号 | 判据（用 `enforceEventProgress` 实现） | 提示文案（zh，en 同义） |
|---|---|---|
| EV-1 | `unitComplete === true` 且最后一个已声明章的 `reached !== stepCount - 1` | `本单元事件未走完：末章停在 E<x>，共 E<M-1>` |
| EV-2 | 某章 `reached > upper`（`upper` 已钳到 `M-1`，故不存在越界触发值） | `第<k>章提前推进到 E<x>（上限 E<y>）` |
| EV-3 | 某章 `reached < lower` | `第<k>章水位落后（下限 E<y>）` |
| EV-4 | 相邻两章 `reached(k) < reached(k-1)` | `第<k>章水位回退（E<x> → E<y>）` |

- 四条**只核声明、不核正文内容**；不拒绝产出、不重跑、不改请求（与设计稿 §3.4 一致）。
- `declarations` 必须是**同单元、按 chapterIndex 升序**；实现内部排序一次即可，不许改入参。
- 缺行 ＝ 未声明：某章没解析出「进度：」行就**跳过该章**，不参与 EV-1/2/3/4，也不按上一章顺延。
- **本卡只交纯函数＋单测，不接线**：`unitComplete` 要靠 `backfill`（生成之后）才算得出，接线与编辑器提示条属 O1-b。此处写清算法只是为了 O1-b 不另写一套。
- 注（项目总负责人 2026-11-24 原话，别当断言）：「每章最多推进 1 步」只在 `b ≥ M-1-s0` 时成立；`M=6, b=3` 每章推进 2 步，区间仍合法。


### 3.5 注入行（字符串拼接，零新变量）

`renderEventProgressHint({ stepCount, batchSize, startStep }, 'zh-CN')` 返回**一行**，形状逐字：

```
本单元事件进度：本单元共 <M> 步（E0–E<M-1>）；本批 <b> 章，起点 E<s0>；第 1 章末应落在 E<l(1)>–E<u(1)>，第 <b> 章末应落在 E<l(b)>–E<u(b)>，即终态 E<M-1>。只核声明，不阻断生成。
```

- 只给 `j=1` 与 `j=b` 两端做示例，**不许把整张表铺进提示词**（那是 `b` 行）。
- en-US 同义一行：`Event progress for this unit: <M> steps (E0–E<M-1>); <b> chapters in this batch starting from E<s0>; chapter 1 should end at E<l(1)>–E<u(1)>, chapter <b> at E<l(b)>–E<u(b)> (final state E<M-1>). Declaration only; generation is not blocked.`
- 只出现在**单元弧位块末尾**（`renderUnitArcPositionBlock` 返回串最后一行），**不许**插到块中间、不许进 system message、不许改 suffix 以外任何模板段；
- 一条请求只注入**一次**（不逐章重复），`batchSize < 1` 或 `M < 2` 返回 `''`（整行不出现、不留空行）；
- 数字全部由入参算：实现里**不许**出现 `10`、`4096`、`32768`、`3072` 之类字面量，`M-1` 由 `stepCount - 1` 算。


### 3.6 请求数与 cursor 不变（硬约束）

本卡不改请求条数、不改 `purpose`、不改 `synopsis_unit_cursor`／`covered_to`／指纹字段、不改任何 batch 大小。证据：`git diff --numstat` 的 7 项全部落在白名单；`grep -n "purpose\|cursor" ` 输出里没有本卡新增行。

---

## §4 判据（每条给命令；跑不成就照实写「未跑成 + 报错原文」）

| # | 层 | 判据 | 证据 |
|---|---|---|---|
| J1 | [static] | `splitMinorSteps` 边界（既有用例仍在）＋ `unitEventSteps`：空小弧列表 ⇒ `[]`；两个小弧各 `A→B`、`C→D` ⇒ 4 步；小弧 `text` 无箭头 ⇒ 该小弧计 1 步；`text` 为 `undefined` ⇒ 1 步 | o1 单测汇总行 |
| J1b | [static] | `lastDeclaredStep` 解析（`s0` 唯一解析点，正则写错会静默给错水位、不报错）：① 无声明（空串／纯正文无声明行）⇒ `null`；② 多行只取**最后一条**（`进度：E1` 后跟 `进度：E3` ⇒ `3`；顺序颠倒 ⇒ `1`）；③ 形态全认：`进度：E2`、半角冒号 `进度:E2`、en `Progress: E2`、`Progress:E2`、行首尾空白 `\n  进度：E4  \n` ⇒ 分别 `2/2/2/2/4`；④ 负例全 `null`：`进度:E`（缺数字）、`进度：EX`、`进度：E`、`进度：-1`、`进度：E 2`；⑤ 声明行夹在正文中间（前后有说明文字）仍命中；⑥ 前导零 `进度：E03` ⇒ `3` | o1 单测汇总行 |
| J2 | [static] | 折算表（§0.3 新式，逐组照抄）：`s0=0,M=4,b=10` ⇒ `j=1 [0,1]`、`j=4 [1,2]`、`j=10 [3,3]`；`s0=3,M=4,b=10` ⇒ 10 组全 `[3,3]`（`s0=M-1` 不被往回拉）；`s0=0,M=6,b=3` ⇒ `[1,2] [3,4] [5,5]`；`s0=1,M=4,b=2` ⇒ `[2,2] [3,3]`；全枚举 `0≤s0<M≤12`、`1≤b≤10`、`1≤j≤b` 断言 `0 ≤ s0 ≤ lower ≤ upper ≤ M-1` 且 `upper-lower ≤ 1`；`j=b` ⇒ `upper === M-1`；`startStep > M-1`／`batchSize < 1`／`M < 2` ⇒ `null` | 同上 |
| J3 | [static] | EV-1..4 各 2 条边界（进／不进）：EV-1 仅 `unitComplete===true` 且末章 `<M-1` 触发；`unitComplete===false` 的两条各测一次（末批但末章没写 ⇒ 不报；非末批 ⇒ 不报）；EV-2 `reached === upper` 不触发、`upper+1` 触发；`upper === M-1` 时不存在触发值（`reached` 最大 `M-1`，断言不产生 EV-2）；EV-3 `=== lower` 不触发；EV-4 相等不触发；`M<2` ⇒ `[]`；缺行章不参与；`declarations` 乱序先排序仍正确 | 同上 |
| J4 | [static] | **指纹不变**：`promptRenderSignature` 与 `synopsisInputFingerprintParts(...).combined` 在固定夹具上与本卡改动前**逐字相等**（测试里写死改动前算出的两个哈希常量）；另 `getBuiltinPromptTemplate('synopsis','zh-CN').systemSuffix` 与改前逐字相等。**负用例**（同文件）：把一份 suffix 文本塞进临时模板对象 ⇒ `promptRenderSignature` 必变（证明这条断言不是恒真） | 同上 |
| J4b | [static] | 共享常量同笔：`getSynopsisTwoLevelSuffix('zh-CN')` 含 `进度：E<n>` 且出现次数 **1**；`en-US` 含 `Progress: E<n>` 且次数 1；两者仍含各自禁覆盖行原文；`getSynopsisTwoLevelSuffix('zh-CN')` 中 `{{` 出现次数与 `cbbe82c3` 相同（仅 `{{step_guidance}}`） | suffix 测试汇总行 |
| J4c | [static] | 冻结语义（两个入参各一条）：同一 `{batchSize,startStep}` 重复调用 `eventBandOf`／`enforceEventProgress` 结果逐字相同；`batchSize` 10→8 只影响传入新值的调用（`j=2` 区间必然不同）；`startStep` 0→1 只影响传入新值的调用（`s0=1,M=4,b=2` 的 `j=1` 由 `[0,1]` 变 `[2,2]`）；实现文件 `grep -c "maxChapters"` = 0、`grep -c "frozenN"` = 0 | o1 单测汇总行 |
| J4d | [static] | 未写章不预判：`declarations` 只到 `j=6`、`batchSize=6` ⇒ 无第 7 章告警；`unitComplete=false` 时 EV-1 不触发（`declarations` 末章 `reached < M-1` 也不报） | 同上 |
| J5 | [mock] | 注入行渲染与**落点**：对既有 `PLAN` 夹具调 `renderUnitArcPositionBlock(parsed,60,1,1,'zh-CN',{batchSize:3,startStep:0})` ⇒ `block.endsWith(hint)` 为真、`block.split('\n').at(-1)` 逐字等于 `renderEventProgressHint({stepCount,batchSize:3,startStep:0},'zh-CN')`、末行匹配 `^本单元事件进度：本单元共 \d+ 步（E0–E\d+）；本批 3 章，起点 E\d+；第 1 章末应落在 .*终态 E\d+。只核声明，不阻断生成。$`、提示行只出现 1 次；同串里既有四行原文仍逐条出现；不传第 6 参 ⇒ `not.toContain('事件进度')` 且既有 4 条 `toContain` 原样通过；`en-US` 同测 | unit-arc-position 汇总行 |
| J6 | [static] | 不新增模板变量：`grep -c '{{' src/services/prompts/synopsis-two-level-suffix.ts` 与 `cbbe82c3` 相同；`grep -n "{{" src/shared/o1-event-progress.ts` 0 命中；`o1-event-progress.ts` 内无 `maxChapters`／`frozenN`／`4096`／`3072`／`32768`／`10` 字面量（`10` 允许出现在测试与 `E\d` 正则里除外，实现文件内用 `grep -nE "[^0-9]10[^0-9]"` 0 命中） | 两行 grep 原文 |
| J7 | [static] | 白名单与零越界：`git status --porcelain -uall` 列出的路径**全部**落在 §2 的 7 项内；`git diff --numstat` 各文件满足 §2 的硬上限；`grep -rn "purpose\|synopsis_unit_cursor\|covered_to" ` 的 diff 里无新增行 | 三条原文 |
| J8 | [static] | `node scripts/check-fast.mjs` ⇒ `CF_EXIT=0`；`node node_modules/typescript/bin/tsc --noEmit` ⇒ `TSC_EXIT=0` | 两行原文 |
| J9 | [static] | 既有三文件基线保留：`node scripts/run-tests-electron.mjs src/services/__tests__/synopsis-two-level-suffix.test.ts src/shared/__tests__/arc-position.test.ts src/shared/__tests__/unit-arc-position.test.ts` 改动前 `Tests 97 passed (97)`（已实测），改动后 **≥ 97 ＋ 本卡新增条数** 且 `EXIT=0`；`synopsis-two-level-suffix.test.ts` 的 16 条**条条仍在** | 改动前后两行汇总行 |

> 分层说明（按群规 §8）：本卡**没有 [live]** —— 不碰主进程、不碰 DB、不改请求数，真实 Electron 跑不出本卡的判据；`[mock]` 只有 J5（纯字符串渲染，不起实例）。原设计稿 §5 判据 6（真实生成一章、看正文末行）依赖真实模型调用，**不在本卡**，若要，另开一卡并按「真实模型只准 Magpie `group/ai-novel`」执行。

## §5 变异（M1／M2／M3／M3b 必发，M4 可选；每发转红并写红掉的用例号）

| 号 | 靶 | 改法 | 期望转红 |
|---|---|---|---|
| M1 | `eventBandOf` 上界 | 把 `Math.ceil(...)` 改成 `Math.floor(...)` | J2（`s0=0,M=6,b=3` 中 `j=1` 期望 `[1,2]`，变 `[1,1]`）、J3（EV-2 边界） |
| M2 | EV-2 比较符 | `reached > upper` 改成 `reached >= upper` | J3（`reached === upper` 那条） |
| M3 | 起点偏移 | 把 `eventBandOf` 里的 `startStep` 当 0（丢掉 `s0`） | J2（`s0=3,M=4,b=10` 那组由全 `[3,3]` 变 `[0,1]`…）＋J4c（`startStep` 那条） |
| M3b | 注入行分母 | 把 `renderEventProgressHint` 的 `batchSize` 换成 `stepCount`（拿上界当分母） | J5（末行文案与正则不符）＋J2 |
| M4（可选） | 禁覆盖行 | 把 suffix 新行 `进度：E<n>` 改成 `覆盖：进度 E<n>` | J4b（禁覆盖行原文仍在，但新行含「覆盖：」⇒ 断言冲突）＋J4b 的计数 |

## §6 命令（逐条原文贴回执，PowerShell 计行见 §0.4 第 7 条口径）

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall
node scripts/run-tests-electron.mjs src/shared/__tests__/o1-event-progress.test.ts
node scripts/run-tests-electron.mjs src/services/__tests__/synopsis-two-level-suffix.test.ts src/shared/__tests__/arc-position.test.ts src/shared/__tests__/unit-arc-position.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-fast.mjs
git -C C:/develop/workspace/AI-writer/wt-2 diff --numstat
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall
```

## §7 交付与回执

- 一笔写盘（提交由豆包联络人代做）：`O1-a:` 主题。两段内聚不拆笔（纯函数＋注入无法分开验证：注入行调纯函数）。
- 回执四行身份头（From／To／卡号＋会话标识＋起点／模式＋模型「未自证，见渠道读数」）＋固定一行「只写盘，未提交」＋§4 每条判据的**命令原文与末行结果**。
- 回执必须含 `git rev-parse --short HEAD` 原文 = `cbbe82c3`（证明未提交）与 `porcelain` 的 7 行清单。

## §8 不做（越界即打回）

1. 不建表、不动 `electron/migrations/*`、不动 `desktop-registry`／`project-storage`／portable 三件、不动 `CURRENT_DESKTOP_SCHEMA_VERSION`。
2. 不碰编辑器 UI（`NarrativeThreadEditor.tsx` 及 browser 测试）、不做提示条、不做「已到 E2 / 共 E4」的 UI 展示。
3. 不改内置模板（`src/services/prompt-templates*`）、不改 `synopsisInputsFingerprint`／`promptRenderSignature`、不改 `{{step_guidance}}`。
4. 不改请求数／purpose／cursor／batch 大小；不调真实模型。
5. 不写「小弧已废」这类口径：`naming: 'volume'` **只影响措辞**，不改解析与折算（`src/shared/arc-position.ts:142-151`）；旧项目的小弧仍在（`text` 缺省为 `undefined`，`:49`），且单元弧位块照旧渲染 `span.midMinors`（`:1372-1375`）。不新造术语。
6. 不改 `docs/*`（设计稿文件头一行也不加——本卡不是设计变更，§0.3 的口径若被采纳，由 admin 另开一笔改设计稿）。

## §9 开放问题（本卡已给默认，不等答复）

1. 「进度：」这个词 vs 「事件：」／「水位：」——本卡取「进度：」（与 `钩子：` 语义不混），要改只改 1 处常量 + 2 处断言。
2. 旧项目无「进度：」行的补水位入口——本卡不做（缺行＝未声明）。
3. 上界被调到已写章数以下的 UI 提示——归后续 O1-b 卡。
