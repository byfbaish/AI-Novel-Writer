# CARD-1119-E 首验判词 · 尾行规则对 `.batch/night/archive/` 豁免

首验方：QA · AI writer项目组
判词对象：提交 `44ff679f1aa714c7d099e336ee3fa548942fa970`（分支 `card/1119-E`／工作区 `wt-1119e`，父 `f8728c8d`，1 提交，2 files changed +64/−1，作者 大管家，2026-11-19 20:28:25 +0800）
依据件：`cards/CARD-1119-E-hygiene-archive-exempt.md`（6,251B／`de1061184528727f5eaa1dd29e44d435`／61 行）＋ `review-requests/CARD-1119-E-hygiene-archive-exempt.md`（3,736B／`bc774f0142aba5c7deb5322efed77944`／53 行，含 §五 20:2x 口径订正）
受验报告：`.batch/night/reports/CARD-1119-E-report.md`｜8,118B｜`134937f5d3cc61a4319ae3baf49057bd`｜158 行（与执行方自报三值一致）
判词结论：**PASS**（八条判据全成立、六条红线零触发）；附「放行前必补说明项」一条（报告补一行，不改码、不重跑）。
冻结声明：本判词所引数字均为落盘后自算并已冻结；旧判词不适用于本 HEAD。

## 一、判据逐条取证

### 判据 1 · 豁免面正确（运行时解析值口径）
```
$ cd wt-1119e && grep -n 'EXEMPT_TRAILING_DIRS' scripts/ops/check-batch-hygiene.mjs
44:export const EXEMPT_TRAILING_DIRS = [`${WATCH_ROOT}/archive/`]
$ node -e "import('./scripts/ops/check-batch-hygiene.mjs').then(m=>console.log(JSON.stringify(m.EXEMPT_TRAILING_DIRS)))"
[".batch/night/archive/"]
EXIT=0
```
成立。源码为模板字面量（与 `:37-38` 既有写法一致，按卡面 §四.1 与派验单 §五 的订正口径读运行时值）。旁证：`grep -c 'export const EXEMPT_TRAILING_DIRS'` ＝ **1**（无两处并存）；判定函数 `:76-78` `isTrailingExempt`，调用点 `:104`。

### 判据 2 · `EXEMPT_VERSIONED_DIRS` 未被牵连
```
$ node -e "import('./scripts/ops/check-batch-hygiene.mjs').then(m=>console.log(JSON.stringify(m.EXEMPT_VERSIONED_DIRS)))"
[".batch/night/archive/",".batch/night/staging/"]
$ git show 44ff679f:scripts/ops/check-batch-hygiene.mjs | grep -c 'EXEMPT_VERSIONED_DIRS'
2
$ ... grep -n 'EXEMPT_VERSIONED_DIRS'
38:export const EXEMPT_VERSIONED_DIRS = [`${WATCH_ROOT}/archive/`, `${WATCH_ROOT}/staging/`]
85:  if (EXEMPT_VERSIONED_DIRS.some((dir) => repoRelPath.startsWith(dir))) return null
```
成立；`:38` 一字未动（diff 中该行不在 ± 面）。

### 判据 3 · 两向反证跑真单测
```
$ cd wt-1119e && node scripts/run-tests-electron.mjs scripts/ops/__tests__/
 ✓ scripts/ops/__tests__/ops-scripts.test.mjs (11 tests)
 ✓ scripts/ops/__tests__/check-batch-hygiene.test.mjs (33 tests) 2658ms
 Test Files  2 passed (2) | Tests  44 passed (44)
EXIT=0
```
成立。新增 `describe('尾行豁免面：archive 不报、其它照报（CARD-1119-E）')` 六例，两向齐：`archive 下缺尾行的 .md ⇒ 不报`、`archive 以连续空行结尾 ⇒ 也不报`、`staging 下缺尾行的 .md ⇒ 照报`、`cards / reports 下缺尾行的 .md ⇒ 照报`、`豁免面只含 archive/，staging/cards/reports 不在其中`、`archive 的版本文件名仍由 EXEMPT_VERSIONED_DIRS 豁免`。工作区已挂 junction（`node_modules -> develop/node_modules`），未 install／未 rebuild。

### 判据 4 · `78d56ea0` 上真红转绿 ＋ 反证 8 项
我自建临时工作树复核（非采信执行方输出）：
```
$ git worktree add --detach ../wt-qa-e78 78d56ea0
HEAD is now at 78d56ea0 chore(night): .batch/night/archive 入库（B-6 收口）
$ cp ../wt-1119e/scripts/ops/check-batch-hygiene.mjs scripts/ops/check-batch-hygiene.mjs
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
EXIT=0
--- 反证：常量置空（:44 → EXEMPT_TRAILING_DIRS = []）后重跑 ---
.batch/night/archive/roster/identity-roster.v2.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.1.md · trailing-newline · 以连续空行结尾（末行是空行）
.batch/night/archive/roster/identity-roster.v3.10.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.11.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.12.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.13.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.8.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.9.md · trailing-newline · 末字节不是换行（末行缺换行）
8 项不合规
EXIT=1
```
成立：**8 ＝ 7 件缺末行 ＋ 1 件以连续空行结尾**，与卡面 §四.4 写死的构成逐件一致；两种子形态同被豁免（正向 0 项），置空后一并复现，说明豁免只覆盖尾行规则、没有整体关掉检查。反证线未被 baseline 稀释——输出无「baseline 冻结清单豁免 N 项」行，与我此前实测「`hygiene-baseline.txt` 只冻结 `.batch/night/roster/…`、不含 `archive/…`」互证。临时树用完即删（`git worktree remove --force` ＋ `prune`，`worktree list` 中已无）。

### 判据 5 · 本线不回归
```
$ cd wt-1119e && node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
EXIT=0
```
成立。

### 判据 6 · gate 过（我独立复跑）
```
$ cd wt-1119e && node scripts/check-fast.mjs
[check:fast] typecheck ✓ 15.7s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
EXIT=0
```
成立。`437` 与 `develop` 树的 `438` 差 1，因 `wt-1119e` 树不含 `develop` 上未跟踪的那一份 md，属预期。

### 判据 7 · 提交面干净
```
$ git show --name-only --pretty=format: 44ff679f | grep -c '^\.batch/'
0
$ git rev-list --count f8728c8d..44ff679f
1
$ git show --name-status --pretty=format: 44ff679f
M  scripts/ops/__tests__/check-batch-hygiene.test.mjs
M  scripts/ops/check-batch-hygiene.mjs
```
成立：`+49/−0` 与 `+15/−1`，合计 `+64/−1`。

### 判据 8 · 报告三处格式
```
执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot
末行：<!-- DONE -->
```
三处逐字一致，成立（附加说明项另见 §二）。

## 二、放行前必补说明项（1 条，不改码、不重跑）

**卡面 §四.8 与派验单 §四 都要求报告写明「F 卡判据 8 曾是空集通过（当时树里没有 `archive/`）这条背景已被本卡补成真」，报告全文零命中**：
```
$ grep -n '空集\|F 卡\|F卡\|补成真' .batch/night/reports/CARD-1119-E-report.md
EXIT=1
```
报告 §二.判据 8 只写了三处格式与「全文不含真名」。派验单 §四 把这条定为「只作报告须写明的说明项」（不作为本卡判据），故不影响八条判据结论，但属交付件缺项。最小修法：在报告 §五 备注补一句（一句话即可，须保留末行 `<!-- DONE -->`），补后不必重跑任何判据，我按行号核一次即可。

## 三、红线逐条

1. 改 `archive/` 内文件字节或删件：**未触发**——提交面 `archive/` 命中 0；diff 只动 2 个 `scripts/` 文件；`78d56ea0` 树上临时树仅改了 `scripts/ops/check-batch-hygiene.mjs` 一个文件（`status --porcelain` 一行）。
2. 豁免面溢出 `archive/`：**未触发**——运行时值恰为 `[".batch/night/archive/"]`；单测断言 staging／cards／reports 皆 `false` 且照报。
3. 顺手动 `EXEMPT_VERSIONED_DIRS`／`--disk`／退出码／修法行文案：**未触发**——diff 只有三处新增（常量、函数、一处条件），`--disk` 分支与两组 `修法：` 文案行均不在 ± 面。
4. `git add -A`／`.`／`-f`／push／rebase／merge：**未触发**——单提交、无 force；`git status -sb` 仅 `## card/1119-E`（无上游），`git branch -r --contains 44ff679f` 空。
5. 工作区遗留临时克隆／反证件：**未触发**——`wt-1119e` `status --porcelain` 0 行；`worktree list` 无 78d56ea0 残留（执行方临时树已删，我自己的复核树也已删）。
6. 未跑判据 4 反证就报完成：**未触发**——报告 §三 两侧输出齐，与我的独立复跑逐件一致。

refs 未被本卡改动：`work/pii-1119`=`f8728c8d`、`work/reboot-1118`=`2923090a`、`refs/heads/archive/local-rebuilt-1118`=`1dd9e948`。

## 四、采信限度（不影响结论）

1. 「pre-commit 实名跑 check-fast」无系统留痕（hook 执行不写日志，`git log` 无痕）：以「我独立复跑 `check-fast` 全绿」作替代证据；`--no-verify` 未使用仅凭执行方自述＋我复跑一致。
2. 执行方判据 4 的两侧输出文字与我的复跑逐件一致，但那次点位（临时树路径、置空手法）不可复现；结论以本次复跑为准。
3. `78d56ea0` 的合并与推送不在本卡范围（等负责人／主人裁），本判词不作评价。

## 五、观察项（不扣分，建议记账）

1. `C:\develop\workspace\AI-writer\tmp-dev\`：13 个 scratch 脚本／json（`classify-1118b.mjs`、`d-move.cjs`、`d-final.json`、`untracked-baseline-develop.txt` 等，最新 `fix-done.cjs` 13:27），属 B／C／D 卡遗留、不在任何 worktree 内、非本卡产物；建议入 BACKLOG 统一清理，不在本卡返工。
2. 报告 §一 记「改动三处，全在 `check-batch-hygiene.mjs`」，而实际提交含单测文件——§一 上文已列单测新增六例，措辞可作「改动两件」更准；属表述，不影响判据。

## 六、说明项补正核实（2026-11-19 21:0x 追加；结论不变，仍 PASS）

执行方补正后我复核报告新版本：`.batch/night/reports/CARD-1119-E-report.md`｜**8,749B**｜**`ddb7c5577bd245c3475ca5fcaae682fa`**｜**162 行**（原版 8,118B／`134937f5…`／158 行，本判词 §一 判据 8 引的三值指原文，已作废于本条）。补正内容核实：
```
$ grep -n '空集' .batch/night/reports/CARD-1119-E-report.md
154:1. **F 卡判据 8 曾是「空集上通过」这条背景，本卡已把它补成真的。** …本卡的判据 4 反向取证（`78d56ea0` 上常量置空仍报 8 项）正是把这条从「空集通过」变成「有实测红项、豁免后才转绿」的证明。
$ sed -n '152p;154p' … ; tail -1 …
152:## 五、备注
154:（上述条目）
<!-- DONE -->
```
成立：条目落在 §五 首条（`:154`），原文要点与卡面 §四.8／派验单 §四 要求一致（改动前无目录豁免 → F 卡那条是空集通过 → 本卡反证 8 项补成真）。三处格式仍齐（首行 `执行方：developer`、次行 model 行、末行 `<!-- DONE -->`）；真名命中 0（`C:\\Users\\[^<]` 与账号名各 0）；`grep -c '^## '` 仍 5 段、原四段行号（12/42/109/141）未移位。代码与工作区未动：`wt-1119e` HEAD 仍 `44ff679f`、`status --porcelain` 0 行、`--all` 仍 `0 项不合规`。

采信限度：报告未被 git 跟踪，「原 §五 三条顺延、一字未改」我无法与旧版本逐字节对账（旧版仅存 md5 `134937f5…`），该句按执行方自述采信；不影响任何判据。

**补正后结论：PASS 维持，八条判据与六条红线结论不变，本卡可进终审。**

<!-- QA 判词已冻结 · 对象 HEAD 44ff679f · 含 21:0x 补正核实 -->
