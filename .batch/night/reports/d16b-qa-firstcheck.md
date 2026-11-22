# 判词 · CARD-S3-D16B 首验（第一轮：判据 1／2／3／4／6）

From: QA · AI writer项目组
To: 大肥鱼 · AI writer项目组（admin）；项目总负责人 · AI writer项目组（终审）
日期：2026-11-22 12:56
判定面：分支 `card/d16b-statusbar-default-first` 头 `961eaa05`（父 `fb2c5d6f`）；评审范围 `fb2c5d6f..961eaa05`
分母：卡面 `.batch/night/cards/d16b-statusbar-default-first.md` 47 行 / 4,140B / sha256 `252d6e19e03f849845dfc0b1b87fa760c03657d0b7a5a4153fb598a81921a524`（取自主线提交 `9f31562f`，见记录项 2）

## 0. 结论

- 判据 1 `[static]` **PASS**
- 判据 2 `[static]` **PASS**
- 判据 3 `[mock]` **PASS**（用例数以实测 6 条为准，见记录项 1）
- 判据 4 `[static]` **PASS**（改写数以实测 3 条为准，见记录项 1）
- 判据 6 `[static]` **PASS**
- 判据 5 `[live]` **未到证据**——`.runtime/` 无 d16b evidence、交件报告 `.batch/night/staging/d16b-statusbar-report.md` 不存在

**本轮不出总判、不写 PASS**（admin 12:52 口径：判据 5 live 未回来前不许提前写 PASS）。判据 5 证据到位后在本判词追加 §10 复判，不另起文件。

## 1. 判定面与改动面

```
$ git rev-parse 961eaa05
961eaa053a9c46f611ae1758b7c980dd4481bca3
$ git rev-parse 961eaa05^
fb2c5d6fdabf4fe646941278f059dd682b7dc01a
$ git rev-parse exp/mainline-1119
9f31562ff2b3c8db21e40b623e9029c2b60b81a1
$ git merge-base --is-ancestor 961eaa05 exp/mainline-1119 ; echo $?
1            # ⇒ 代码未合主线；主线 9f31562f 只多了卡面文档（`git log --oneline -3 9f31562f` 首行 = docs(s3): 新建 D16b 卡）
$ git diff --numstat fb2c5d6f..961eaa05
8	7	src/components/layout/StatusBar.tsx
26	12	src/components/layout/__tests__/StatusBar.test.tsx
59	1	src/shared/__tests__/statusbar-model.test.ts
74	0	src/shared/statusbar-model.ts
$ git diff --name-only fb2c5d6f..961eaa05 | grep -c -E "^(electron/|src/services/generation/actual-model)"
0            # ⇒ 白名单外零改动（含禁改的 electron/ 与 actual-model-*）
$ git status --porcelain -- src electron scripts
（空）        # ⇒ 源码工作区干净
```

四文件 +167/−20 与卡面 §1 逐项一致。

## 2. 判据 1 `[static]` 模型段单测 —— PASS

`src/shared/statusbar-model.ts` 新增 `statusbarModelDisplay()`（`:87`）与 `statusbarModelTitle()`（`:116`），类型 `StatusbarModelDisplaySource`（`:71`）、`StatusbarModelDisplay`（`:73`）。六种情形逐条落到用例：

- both 不同 ⇒ `配置模型A（实际 实际模型B）`、`source:'both'`、`same:false` —— 用例「配置 A / 实际 B ⇒ 并列「A（实际 B）」，来源 both」
- 同名 ⇒ `label==='模型A'`、`same:true` —— 用例「配置与实际同名 ⇒ 只显示一次，same=true」
- 只有配置 ⇒ `source:'configured'`、`actualName:null`；只有实际 ⇒ `source:'actual'`、`configuredName:null` —— 用例「只有配置 ⇒ configured 档；只有实际 ⇒ actual 档」
- 空白串按缺失、两侧皆空 ⇒ `null` —— 用例「空白串按缺失处理，两侧都空 ⇒ null」

源码口径与断言一致（`:90-95` `configuredModelName?.trim() || null`、`:96-98` 判等后拼 `${configured}（实际 ${executed}）`）。

## 3. 判据 2 `[static]` 渲染单测 zh/en —— PASS

`StatusBar.test.tsx` 7 条全绿（含新增 2 条）。zh 侧 `toContain('配置模型A（实际 实际模型B）')` 与 tooltip `当前模型（配置）：配置模型A ｜ 实际调用：实际模型B`；en 侧 `toContain('Current model (configured): 配置模型A | actual: 实际模型B')` 且断言 `not.toContain('当前模型')`（不串）；空态「未配置模型」用例仍在。

## 4. 判据 3 `[mock]` 旧 API 无回归 —— PASS

```
$ git diff 961eaa05~1 961eaa05 -- src/shared/__tests__/statusbar-model.test.ts | grep -c "^-[^-]"
1            # 唯一删除行＝import 语句（旧的 6 条用例零改动）
$ git show 961eaa05~1:src/shared/__tests__/statusbar-model.test.ts | grep -c "^  it(\|^    it("
6
```

`statusbar-model.ts` 旧 API 原样保留：`resolveStatusbarModel`（`:20`）、`statusbarModelCopy`（`:43`），本卡 diff 对源文件只有追加（`74 0`）；`StatusBar.tsx:9` 改 import 后不再调用旧 API，符合卡面 §1「原样保留、不再被 StatusBar 调用」。旧 6 条用例随整文件 13 条一并绿。

## 5. 判据 4 `[static]` 断言修改有据 —— PASS

```
$ git diff 961eaa05~1 961eaa05 -- src/components/layout/__tests__/StatusBar.test.tsx
@@ -19,37 +19,51 @@ describe('StatusBar bottom tool-window entries', () => {
- * D16：状态栏模型指示器读「实际调用事实源」，不读配置当前选中值。
+ * 2026-11-22 作者裁定 C（取代 D16 的「只显示实际」）：
+ * 常态显示配置（默认）模型；实际调用与默认不同时并列成「默认A（实际 B）」。
...
-describe('StatusBar model indicator (D16)', () => {
+describe('StatusBar model indicator (2026-11-22 C)', () => {
-  it('配置 A / 实际调用 B ⇒ 界面显示 B，不显示 A（zh）', () => {
+  it('配置 A / 实际调用 B ⇒ 并列显示「A（实际 B）」（zh）', () => {
-    expect(html).toContain('实际模型B')
-    expect(html).toContain('当前模型：实际模型B')
-    expect(html).not.toContain('配置模型A')
+    expect(html).toContain('配置模型A（实际 实际模型B）')
+    expect(html).toContain('当前模型（配置）：配置模型A ｜ 实际调用：实际模型B')
...
-  it('尚无实际调用记录时退回配置选中值（不打坏原有显示）', () => {
+  it('尚无实际调用记录时显示配置值（配置档）', () => {
-    expect(html).toContain('当前模型：配置模型A')
+    expect(html).toContain('当前模型（配置）：配置模型A')
```

逐条判：被改写的 3 条全部是「D16 的显示 B / D16 来源档」→「按 C 并列／按 C 配置档」，都是裁定 C 的必然结果；其余断言（`describe('StatusBar bottom tool-window entries')` 段、空态「未配置模型」用例）一字未动；新增 2 条（同名只显示一次、只有实际档）属补覆盖，不是改写。`StatusBar.test.tsx` 用例数 5 → 7。

## 6. 判据 6 `[static]` 门禁 —— PASS

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/statusbar-model.test.ts src/components/layout/__tests__/StatusBar.test.tsx
 ✓ src/shared/__tests__/statusbar-model.test.ts (13 tests) 4ms
 ✓ src/components/layout/__tests__/StatusBar.test.tsx (7 tests) 13ms
 Test Files  2 passed (2)
      Tests  20 passed (20)
TEST_EXIT=0

$ pnpm run check:fast
[check:fast] typecheck ✓ 18.2s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
CHECKFAST_EXIT=0
```

整文件汇总行＋末行 EXIT 均如上，未用 `-t` 过滤。

## 7. 判据 5 `[live]` 未到（本卡唯一缺口）

```
$ ls -d .runtime/.cache/d16b* 2>/dev/null                → 无
$ ls .runtime/*d16b*                                     → .runtime/d16b-build.log（构建日志，非 live evidence）
$ ls .batch/night/staging/d16b-statusbar-report.md       → No such file or directory
```

待 developer 交：单实例实机、`instancesThisRun`／`exitCode`／`leftoverElectronProcesses=0`／`tasklist | grep -c electron` 原文，三件界面事实（改默认后刷新、实际≠默认并列、tooltip 两段同屏）＋交件报告路径。

## 8. 记录项

1. **卡面数字与实测不符，按 admin 12:55 裁定记记录项放行**：判据 3 写「旧单测 13 条仍绿」，实测旧用例 **6** 条（13 是整文件现总数：6 旧 + 7 新）；判据 4 写「被改写的 2 条」，实测改写 **3** 条。判据语义不变，随本卡收口一次性更正卡面（新提交，不得 `git checkout --` 抹）。
2. 卡面文件只存在于主线提交 `9f31562f` 的树内，卡分支 `961eaa05` 树内没有它（`git cat-file -e 961eaa05:.batch/night/cards/d16b-statusbar-default-first.md` → does not exist）。本判词分母按主线提交面取，`sha256 = 252d6e19e03f849845dfc0b1b87fa760c03657d0b7a5a4153fb598a81921a524`，与 admin 报值一致。
3. 判据 1 用例的模型名取「实际模型B」，导致并列模板渲染成「（实际 实际模型B）」双「实际」观感；属测试数据命名，不是产品缺陷，不判。
4. 判据 3 的证据等级仍是 `[mock]`（单测层），本卡未据此升 `[live]`。
5. 主线 `exp/mainline-1119` 头 `9f31562f` 只含卡面文档、不含 `961eaa05`；合并与 push 归主身，本判词不对主线状态作判定。

## 9. 复跑清单（任何一方可独立复现）

```
git rev-parse 961eaa05 961eaa05^ exp/mainline-1119
git merge-base --is-ancestor 961eaa05 exp/mainline-1119; echo $?
git diff --name-only fb2c5d6f..961eaa05
git diff --numstat fb2c5d6f..961eaa05
git diff 961eaa05~1 961eaa05 -- src/components/layout/__tests__/StatusBar.test.tsx
git diff 961eaa05~1 961eaa05 -- src/shared/__tests__/statusbar-model.test.ts | grep -c "^-[^-]"
node scripts/run-tests-electron.mjs src/shared/__tests__/statusbar-model.test.ts src/components/layout/__tests__/StatusBar.test.tsx
pnpm run check:fast
```

## 10. 复判（判据 1–6 全量，2026-11-22 13:1x，分母换新卡）

复判对象：判据 5 的 live 证据到位后按新卡对全六条重判一次。判定面仍是参考实现 `961eaa05`（父 `fb2c5d6f`，4 文件 +167/−20），工作区判读面 `2185b365`，`git status --porcelain -uall` 输出 0 行。

分母（本次现算，旧值全部作废）：

| 件 | 读数 | sha256 |
|---|---|---|
| 卡面 `.batch/night/cards/d16b-statusbar-default-first.md` | 49 行 / 4,681B | `594d7691941d472776dcdf0ad191c90198bd9f5cabb2167727384a7ca7059c23` |
| 派验单 `.batch/night/review-requests/d16b-statusbar-default-first.md` | 41 行 / 5,552B | `828aea01914aac3094f5c81393b2591c3c1a3eb2c11b5aee019cf6eddcd0933a` |
| 交件报告 `.batch/night/staging/d16b-statusbar-report.md` | 85 行 / 5,776B | `a21753d2963c536171b403784d2239beea3483766b0406d32d229551b39e8779` |
| 本判词（自指，本轮写入前） | 147 行 / 9,312B | `164bffdd5188ec485a5e13a188dbda810f1ce2bd101d271e8aae7899bdd5be19` |

新卡 §2 的 1–6 条与旧卡 `252d6e19` 判据文句一致（我已逐条回读原文比对），故判据 1／2／3／6 的既有结论按原证据沿用，判据 4 按 admin 要求重取 diff 原文，判据 5 用本次交件报告的 live 证据。

### 10.1 判据 5 `[live]` —— PASS

证据文件 `.runtime/.cache/s3-d16/af51f396-e79/evidence.json`（run `af51f396-e79`），我逐项独立读取，非采信报告转述：

```
$ python -c "import json;d=json.load(open('.runtime/.cache/s3-d16/af51f396-e79/evidence.json'));print(d['instancesThisRun'],d['exitCode'],d['leftoverElectronProcesses'],d['pids'])"
1 0 0 [{'index': 1, 'pid': 63628, 'startedAt': '2026-11-22T05:04:23.786Z'}]
```

- ① 改默认模型后跟着配置刷新（不 reload，走设置页点击）：`checks.uiPath="settings-click"`、`checks.refreshOnDefaultChange=true`；`stepLog[3]` `statusbar:config-a` 取到 `"任务 日志 模型 D16 配置模型 A"`、`title="当前模型（配置）：D16 配置模型 A"`；`stepLog[5]` `statusbar:config-b` 取到 `"任务 日志 模型 D16 实际模型 B"`，两次之间只有 `settings:click-b`，无 reload 步骤。
- ② 实际 ≠ 默认时并列：`checks.mixedLabel="D16 配置模型 A（实际 D16 实际模型 B）"`，同一次 `stepLog[11]` 的 `statusbarText` 原文一致；实际值来源 `checks.actualModelFromBinding={"modelId":"d16-actual","modelName":"gpt-4.1"}`，对应 run `f5be81b6-ec4b-4d3b-a0fd-cf94956236fd` 的 `binding_json.modelReceipt`。
- ③ tooltip 两段同屏：`checks.mixedTooltip="当前模型（配置）：D16 配置模型 A ｜ 实际调用：D16 实际模型 B"`，与 ②的可见文本在同一条 `statusbar:mixed` 里一起取到（`allTitles` 第 4 项同值）。
- ④ 实例纪律：`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses=0`、`pids` 单条；合成调用 `mainState={"chatCalls":2,"embeddings":1,"intercepted":[]}`、`checks.physicalModelRequests=0`。

`tasklist` 读数补测（报告 §4 表列了 0，但原始输出未入 evidence，故我自己再跑一次）：

```
$ tasklist //FI "IMAGENAME eq electron.exe" | grep -c electron.exe
0
$ echo $?
1
```

命中 0 行时 `grep -c` 自身返回 1，属正常，不是失败。

### 10.2 判据 4 `[static]` —— PASS（记录项放行）

```
$ git diff --numstat 961eaa05~1 961eaa05 -- src/components/layout/__tests__/StatusBar.test.tsx
26	12	src/components/layout/__tests__/StatusBar.test.tsx
```

改写实测 **3 条**，不是卡面写的 2 条：① `zh` 用例「显示 B、不显示 A」→「并列 A（实际 B）」；② `en` 用例同口径；③ 配置档用例「当前模型：配置模型A」→「当前模型（配置）：配置模型A」。第③条是 C 口径下 `configured` 档文案必变所致，且 admin 11-22 13:0x 已预裁「按记录项放行，不判 FAIL」，此处照裁执行。

其余断言逐字未动：`describe('StatusBar bottom tool-window entries')` 整段、空态「未配置模型」用例、`not.toContain('当前模型')`（en 侧）均保留；新增 2 条（配置与实际同名只显示一次、只有实际档）属补覆盖不是改写；用例数 5 → 7。改写方向与裁定 C 一致，无借机改动。

### 10.3 判据 1／2／3／6 —— PASS（沿用，证据不重取）

- 判据 1：`statusbar-model.ts` 六情形（不同／同名 `same:true`／只有配置／只有实际／空白串／皆空 `null`）用例齐，`statusbarModelDisplay()` `:87`、`statusbarModelTitle()` `:116`。
- 判据 2：渲染 7 条绿，en 侧 `not.toContain('当前模型')`。
- 判据 3 `[mock]`：旧 API `resolveStatusbarModel`（`:20`）、`statusbarModelCopy`（`:43`）原样保留，旧用例实测 6 条全绿；卡面写「13 条」是整文件现总数，数字偏差已由 admin 按记录项放行。
- 判据 6：`Test Files 2 passed (2)`／`Tests 20 passed (20)`／`TEST_EXIT=0`；`[check:fast] 全部通过。`／`CHECKFAST_EXIT=0`。

### 10.4 记录项（不改变结论）

1. `tasklist | grep -c electron` 的原始输出未写进 `evidence.json`（报告 §4 只在表里给了 0）；我用现行机器补测 0 行贴在本节，事实成立，但**后续卡的取证脚本要把这条读数直接落到 evidence**，别只写进报告表。
2. 判据 4 的改写条数：卡面写 2 条、实测 3 条，按 admin 预裁记记录项放行，收口时卡面数字应改成 3（新提交，禁 `checkout --`）。
3. 本次 run 终态 `failed`（合成流式不做完稿收尾），`modelReceipt` 仍落 `d16-actual`／`gpt-4.1`；判据 5 读数取自该 run 内，run 失败原因不在本卡判据内。
4. 本件未出截图，按卡面 §5 允许的「DOM 原文」交付；`dist/` 与 `961eaa05` 的等价性用包内标记（`w180`／`actual`）判定，属标记级而非 bundle sha 级等价，报告已自述该残余风险。
5. 合并 push 归主身；本判词只判代码与证据，不构成合并授权。

### 10.5 结论

判据 1–6 全部 PASS。建议放行：把参考实现 `961eaa05` 并入主线（由主身执行，需 push），之后 D16B 转 ✅；本判词入库须由主身提交（`.batch` 下卡分支不收文档）。
