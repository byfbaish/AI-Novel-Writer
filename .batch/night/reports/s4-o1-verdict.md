# S4 · O1 单元内逐章事件进度水位 · QA 首验判词（卡 58188c1c）

- 判定面：`85c927ae`（`O1-b`，父 `641ffc0c`=`O1-a`，再父 `cbbe82c3`=`P6-c`），分支 `card/s4-o1-event-progress`，工作树 `C:/develop/workspace/AI-writer/wt-2`，`status --porcelain -uall` **0 行**。
- 判据来源：派单 `.batch/night/staging/s4-o1/dispatch-doubao-s4-o1.md`（184 行／19,459B／`4dfdc240…30f81d`）§4 J1、J1b、J2–J9 ＋ §5 变异 M1/M2/M3/M3b；实施包 `.batch/night/staging/s4-o1/impl-package.md`（333 行／35,465B／`f51ac012…a90beb`）§3 口径、§4 判据。
- 判据分层：本卡**没有 `[live]`**（派单 §4 明写），全部 `[static]`，仅 J5 为 `[mock]`（纯字符串渲染）。本判词未起 Electron、未调真实模型、未切 ABI。
- **结论：PASS（J1、J1b、J2–J9 全过；M1/M2/M3/M3b 四个变异均真红）。** 五项记账与两条建议见 §5／§6，均不构成打回。

---

## §1 判定面与白名单

| 提交 | numstat |
|---|---|
| `641ffc0c` O1-a | 369/0 `src/shared/__tests__/o1-event-progress.test.ts`、261/0 `src/shared/o1-event-progress.ts` |
| `85c927ae` O1-b | 42/0 `src/services/__tests__/synopsis-two-level-suffix.test.ts`、4/2 `src/services/prompts/synopsis-two-level-suffix.ts`、2/0 `src/services/workflows/commands/architecture.command.ts`、69/0 `src/shared/__tests__/unit-arc-position.test.ts`、15/3 `src/shared/arc-position.ts` |

`git diff --numstat cbbe82c3 85c927ae` ⇒ **6 行、7 个不重复路径**，全部落在派单 §2 白名单（2 新增／5 修改）内，无第 8 个文件；三个测试文件删除列全为 0（只追加）。各文件硬上限：suffix `4/2 ≤ 8/4`、`arc-position` `15/3 ≤ 20/4`、`architecture.command` `2/0 ≤ 16/2` —— 全满足。

新增件 sha256（实测）：`o1-event-progress.ts` `bef01e07838dd94347a3eb1202b91bc86ae9f83700b0f603d27bb880a4a9daa7`、`o1-event-progress.test.ts` `0eff40e20515fd89f51d0dca38af32440c33881f91929a3283d088dd3f4ba59b`（与联络人投前读数逐字相同）。

---

## §2 判据逐条

### J1 [static] `unitEventSteps` 四条边界 —— PASS
`src/shared/o1-event-progress.ts:71-81`：空列表 ⇒ `[]`；多小弧逐个小弧展平（`A→B` ＋ `C->D` ⇒ 4 步）；无箭头 ⇒ 该小弧用 `name` 计 1 步；`text` 缺省 ⇒ 1 步；混合 ⇒ 3 步。切分**复用** `splitMinorSteps`（`:39` 从 `./arc-position` 导入），模块内除 `outlineText.split('\n')`（`:140` 纯文本分行）外**无第二份 `→|->` 切分**。用例 `o1-event-progress.test.ts:23-50`（5 条）。

### J1b [static] `lastDeclaredStep` 解析口径 —— PASS
`lastDeclaredStep:137-150` 只经过 `parseProgressLine:119-129` 一个入口（模块内无第二份正则）。实测用例 `o1-event-progress.test.ts:52-92`：
- 无声明 ⇒ `null`；多行取**最后一条**（`:59-60`：`E1…E3` ⇒ 3、`E3…E1` ⇒ 1）；
- `进度：E2`／`进度:E2`／`Progress: E2`／`Progress:E2`／前后空白 ⇒ 2/2/2/2/4；
- 负例 `进度:E`、`进度：EX`、`进度：E`、`进度：-1`、`进度：E 2` ⇒ 全 `null`；
- 夹在正文中间仍命中；前导零 `进度：E03` ⇒ 3；`parseProgressLine` 只认整行（`本章进度：E2`、行尾多话 ⇒ `null`），en/zh 互不串味（`进度：E5` 在 en 下 `null`）。

### J2 [static] 区间折算 —— PASS
`eventBandOf:89-111`，`raw = startStep + j·(M-1-startStep)/b`（`:107`）、两端 `max(s0, min(M-1, …))`（`:108-109`）。实测：`s0=0,M=4,b=10` ⇒ `[0,1]/[1,2]/[3,3]`（`test:98-102`）；`s0=3,M=4,b=10` 全 `[3,3]`（`:104-108`）；`s0=0,M=6,b=3` ⇒ `[1,2]/[3,4]/[5,5]`（`:110-114`）；`s0=1,M=4,b=2` ⇒ `[2,2]/[3,3]`（`:116-119`）；全枚举 `0≤s0<M≤12`、`1≤b≤10`、`1≤j≤b` 断言 `s0 ≤ lower ≤ upper ≤ M-1` 且宽度 `≤1`（`:121-137`）；`j=b` 上界恒 `M-1`（`:139-147`）；非法入参 ⇒ `null`（`:149-156`）。`upper` 已钳到 `M-1`，实现内**不存在 `EM`**。

### J3 [static] EV-1..4 边界（fail-open）—— PASS
`enforceEventProgress:162-232`。EV-2 `:184` `reached > upper`；EV-3 `:195` `< lower`；EV-4 `:207` 相邻回退；EV-1 `:220` `unitComplete && 末条声明.reached !== M-1`，且是**最后追加**（顺序稳定）。用例 `test:159-248`：EV-1 真/假两向、**`unitComplete=false` 两种来源各一条**（`:182-187`）、EV-2 边界「`reached===upper` 不报／`upper+1` 报」＋「`upper` 已钳到 `M-1`，上限处不存在可触发值」（`:196-199`）、EV-3 同构、EV-4 相等不报／回退报、`M<2 ⇒ []`、缺行不顺延（`:219-223`）、乱序传入内部排序且**不改入参**（`:225-230`）、en 文案同义。四条只产提示，无 throw、无重跑、无请求改动。

### J4 [static] 指纹不变 —— PASS
`test:250-293`：`synopsisInputFingerprintParts(...).combined === '2mj55g'` —— **与既有外部基准逐字相同**（`src/services/workflows/commands/__tests__/architecture.command.test.ts:3038` 同一常量，不是本卡反算）；`promptRenderSignature(...) === 't84789'`；内置 `systemSuffix` 不含「进度：E」。负用例 `:289-292`：往临时模板塞一段 suffix ⇒ `combined` 必变，证明上一条不是恒真。结构旁证：7 项白名单里没有任何 `prompt-templates*` 文件，内置模板一个字节没动。

### J4b [static] suffix 两语言各只有一处进度行 —— PASS
`src/services/prompts/synopsis-two-level-suffix.ts:35-36`（ZH）、`:142-143`（EN）：`钩子：` 降为倒数第二行、`进度：E<n>` 占最后一行，**同笔改**；`o1-event-progress.test.ts` 之外由 `synopsis-two-level-suffix.test.ts`（新增 4 条，`:188-229`）断言 ZH/EN 各 1 处、不再出现两个「最后一行」、禁覆盖行原文（`:37`／`:143`）一字未改、`{{` 计数不变。

### J4c [static] 冻结语义 —— PASS
`test:295-317`：同参重复调用逐字相同（含 `enforceEventProgress` 的 `JSON.stringify` 比对）；`batchSize` 10→8 时 `j=2` 由 `[1,2]`→`[2,3]`；`startStep` 0→1（`M=4,b=2`）时 `j=1` 由 `[1,2]`→`[2,2]`。`grep -c maxChapters` / `frozenN` 在**新增行与 o1 模块内**均 0 命中（`git diff … | grep -nE '^\+.*(maxChapters|frozenN)'` ⇒ 0 行，exit 1）；`arc-position.ts` 里既有的 `maxChapters` 是别的函数（`:880/936`），未被本卡触碰。

### J4d [static] 未写章不预判 —— PASS
`test:319-351`：`b=6` 只声明到第 6 章 ⇒ 无第 7 章告警、findings 为空；`unitComplete=false` ⇒ 末章 `reached<M-1` 也不报 EV-1。

### J5 [mock] 注入行渲染与落点 —— PASS
`renderEventProgressHint:240-261` 返回**一行**、只给 `j=1` 与 `j=b` 两端、`M<2`／`b<1`／`s0` 越界 ⇒ `''`（`test:353-369`，zh/en 文案逐字固定：`本单元事件进度：本单元共 6 步（E0–E5）；本批 3 章，起点 E0；第 1 章末应落在 E1–E2，第 3 章末应落在 E5–E5，即终态 E5。只核声明，不阻断生成。`）。落点：`arc-position.ts:1362-1368` 算出 `progressHint`／`progressTail`，只在块尾 `+ progressTail`（EN `:1402`、ZH `:1416`）——不插中间、不进 system message；`withProjectedUnitArcGuide:1430` 透传第 7 参。三条必断言的用例齐：`unit-arc-position.test.ts:174-185`（不传参无「事件进度」＋既有四行原文）、`:187-195`（`endsWith(hint)` ＋末行逐字等于 `renderEventProgressHint` 返回 ＋ 正则匹配）、`:197-206`（既有五处原文仍在、`本单元事件进度` 只出现 1 次），另加 en 与 `withProjectedUnitArcGuide` 透传两条。

### J6 [static] 不新增模板变量 —— PASS
`grep -o '{{'`：suffix 现 2 ＝ `cbbe82c3` 基线 2；`o1-event-progress.ts` 0 命中。o1 模块内无 `10`／`4096`／`3072`／`32768` 字面量（`grep -nE '\b(10|4096|3072|32768)\b'` exit 1）。新行文本不出现 `{{`，`{{step_guidance}}` 原样保留（`synopsis-two-level-suffix.test.ts:222-228` 逐个断言）。

### J7 [static] 白名单与零越界 —— PASS
`porcelain` 0 行（提交后）；`git diff --numstat cbbe82c3 85c927ae` 6 行 7 路径全在白名单；三处硬上限均未超（§1）。`git diff … | grep -nE '^\+.*(purpose|synopsis_unit_cursor|covered_to)'` ⇒ **0 行，exit 1**（未改请求数与 cursor）；`architecture.command.ts` 只有 `:14` 一行 import 与 `:3668` 一个第 7 实参，无其他改动。

### J8 [static] 闸门 —— PASS
`node node_modules/typescript/bin/tsc --noEmit` ⇒ `TSC_EXIT=0`；`node scripts/check-fast.mjs` ⇒ `[check:fast] typecheck ✓ 19.5s`、`doc links: checked 1472, broken 0`、`doc placement … 新增 0 条`、`batch-hygiene ✓`、`[check:fast] 全部通过。` `CF_EXIT=0`。

### J9 [static] 既有基线 —— PASS
自跑三条 §6 命令：`o1-event-progress.test.ts` ⇒ `Tests 42 passed (42)`、`EXIT=0`；三文件合并（`synopsis-two-level-suffix` ＋ `arc-position` ＋ `unit-arc-position`）⇒ `Test Files 3 passed (3)`／`Tests 106 passed (106)`、`EXIT=0` ＝ 改动前基线 97 ＋ 新增 9（suffix ＋4、unit-arc ＋5），符合「≥ 97 ＋ 新增条数且绿」。suffix 既有 16 条一条未删（numstat `42/0`，diff 只有 `+` 行），`unit-arc-position.test.ts` 既有 `:30`／`:51`／`:82`／`:134` 四处未动（diff 只追加 import 与末尾 describe）。

---

## §3 变异（我自己发，手工改、手工复原）

脚本 `C:\tmp\c1-s2\qa\o1-mut.mjs`：命中靶点必须恰好 1 次，跑完从内存原文回写并比对 sha256。基线 `o1-event-progress.ts` sha256 ＝ `bef01e07…a4a9daa7`。

| 号 | 改法 | 结果 | 红掉的用例（节选） | 复原 |
|---|---|---|---|---|
| M1 | `:109` `Math.ceil(raw)` → `Math.floor(raw)` | `Tests 8 failed \| 53 passed (61)`、`exit=1` | J2「s0=0、M=4、b=10：j=1[0,1]…」、J2「M=6,b=3：[1,2][3,4][5,5]」、J3「EV-2 reached===upper 不触发」、J4c batchSize 10→8、J4c startStep 0→1、J4d 第 7 章不预判、zh 一行、en 一行 | sha 逐字回 `bef01e07…` |
| M2 | `:184` `reached > band.upper` → `>=` | `Tests 4 failed \| 57 passed (61)`、`exit=1` | J3「EV-2 reached===upper 不触发」、J3「upper 已钳到 M-1」、J3 乱序排序、J4d | 同上 |
| M3 | `:107` raw 丢掉 `startStep` | `Tests 2 failed \| 59 passed (61)`、`exit=1` | J2「s0=1、M=4、b=2：[2,2][3,3]」、J4c startStep 0→1 | 同上 |
| M3b | 注入行分母 `batchSize` → `stepCount` | `Tests 2 failed \| 59 passed (61)`、`exit=1` | J5「(b) 提示行在末尾…」、zh 一行 | 同上 |

四个必发变异全部真红，且每个都命中 J2／J3／J5 中的预期靶（M1 连带 J4c/J4d、M3b 连带 J5 正则），说明用例不是空断言。复原后 `porcelain` 0 行、HEAD 仍 `85c927ae`。

---

## §4 请求数与 cursor 不变（硬约束复核）

本卡只改「渲染期 suffix 文本」与「单元弧位块尾部拼接」＋「一个调用点多传一个参」，`git diff` 的加法里没有任何 `purpose`／`synopsis_unit_cursor`／`covered_to`；请求条数、purpose、batch 大小、cursor 推进逻辑一字未动。`unitContext !== null` 分支本身是既有代码（`:3660` 一带），第 7 实参只在该分支内传。

---

## §5 记账（不影响结论）

1. **回执未落盘**：执行方只把回执发在会话里，`C:\tmp\c1-s2\doubao\s4-o1\` 目录未建；实体件是联络人抄录的 `receipt-to-owner.md`（172 行／12,329B／`d96dea1e21335fbb850c8a7e6cebe341f02cf0b189be41d8f24e41c7588a90e9`，首行带 `[抄录]` 标注）。按 admin 口径**不追认为执行方回执**，随 S5 收口件记账。
2. **派单 §2 第 3 项的措辞与实施包不一致**：派单写「＋ 同时改『除这些行以外…』那句」，实施包 §3.1 的目标文本里该句**保持原样**。该句不列举行数（「除这些行以外不要加任何说明行」），加一项后语义仍真，故按实施包执行，不记红；建议 S5 把派单这句改掉，避免下轮照它改出「除这七行以外」。
3. **`t84789` 是执行方本卡实测后写死的**，不像 `2mj55g` 有 `architecture.command.test.ts:3038` 的外部基准可比。两条旁证：白名单内无 `prompt-templates*`（内置模板零改动）、负用例成立；但「改前值」无法从仓内独立复算。建议 S5 收口时给该常量补一行来源（哪次实测、哪条命令）。
4. **循环 import 成立但已接受**：`arc-position.ts:2` import `o1-event-progress.ts`，后者 `:39` 又 import `arc-position.ts` 的 `splitMinorSteps`。两处都只在函数体内调用、无顶层执行，`tsc` 与全部用例绿；admin 已在 `erratum-01.md` 接受，断环随 O1-b（`unitEventSteps` 入参）。
5. **`startStep` 未在调用点钳到 `[0, M-1]`**：`architecture.command.ts:3668` 直接把 `lastDeclaredStep(...) ?? 0` 透传，越界时 `eventBandOf:105` 返回 `null` ⇒ 整批注入行变 `''`（fail-open、无错值、无报错）。派单 §3 第 3 条要求「钳到 `[0, M-1]`」，J2 又要求越界入参 ⇒ `null`（`test:150` 断言正是 `null`），两条口径在纯函数层冲突，且调用点拿不到 `M`。建议在 `arc-position.ts:1362`（能拿到 `steps.length`）先钳；本卡不记红。**触发条件**：作者在本批开工后改小单元弧光（声明 `E9`、`M=4`），该批提示行静默消失。

---

## §6 建议（给 O1-b／S5，不进本卡）

1. `startStep` 钳制（同上 §5.5）——一行 `Math.min(startStep, Math.max(0, steps.length - 1))`，放在 `renderUnitArcPositionBlock` 里算 `progressHint` 的地方。
2. `eventBandOf` 对 `startStep` 越界返回 `null` 与「钳制」两种语义并存，下一轮要么在入参层唯一化，要么在文档里写明「越界＝本批不声明水位」。
3. 本卡未接线的 EV-1 两个布尔量（`isUnitLastBatch`／`lastChapterWritten`）只有文档算法与用例参数，O1-b 接线时须按 `impl-package.md` §3.4 的 `:360-371`／`:4004`／`:4011` 逐条落到代码，别在调用点另算一套。

---

## §7 判词冻结与复核锚点

- 判定面：`85c927ae`；`porcelain -uall` 0 行；本判词不引用任何更早交件结论。
- 本轮自跑命令与结果（原文末行）：`run-tests-electron.mjs o1-event-progress.test.ts` ⇒ `Tests 42 passed (42)`；`run-tests-electron.mjs suffix arc-position unit-arc-position` ⇒ `Tests 106 passed (106)`；`tsc --noEmit` ⇒ `TSC_EXIT=0`；`check-fast.mjs` ⇒ `CF_EXIT=0`；`grep '{{'` ⇒ suffix 2／o1 0；`git diff | grep -E '^\+(purpose|synopsis_unit_cursor|covered_to)'` ⇒ 0 行。
- 变异脚本与复原 sha 见 §3；未跑 `[live]`（本卡无 `[live]` 判据，派单 §4 明写）。
