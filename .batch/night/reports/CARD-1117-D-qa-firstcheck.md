执行方：QA

# CARD-1117-D 首验单（机检与 pre-commit）

受验卡面：`.batch/night/cards/CARD-1117-D-hooks.md`（5,888B）
派验单：`.batch/night/review-requests/CARD-1117-D-hooks.md`（1,978B，8 条必验＋5 条红线）
执行方报告：`wt-1117d/.batch/night/reports/CARD-1117-D-report.md`（8,177B，153 行，末行 `<!-- DONE -->`）
受验版本：`c25fb57bff4291a9e1faf66c7fb5d055f07ce66b`（父 `1224ee2b`，单亲非合并，作者 baiyunfei 2026-11-17 14:19:44）
验场：`C:/develop/workspace/AI-writer/wt-1117d`，分支 `card/1117-D`，全部命令由我在该树内只读复跑。

## 一、必验八条

### 判据 1 · 脚本存在，`--all`/`--staged` 在干净树 exit 0

```
$ ls -l scripts/ops/check-batch-hygiene.mjs → 7,107B（14:09）
$ node scripts/ops/check-batch-hygiene.mjs --all     → 0 项不合规 / exit=0
$ node scripts/ops/check-batch-hygiene.mjs --staged  → 0 项不合规 / exit=0
```
成立。会话开始时该树 porcelain 仅 `?? .batch/night/reports/CARD-1117-D-report.md`（报告本身，未入库），无代码残留。

### 判据 2 · 三夹具实测 1/1/0，且夹具已清理

```
$ printf '末行没有换行' > .batch/night/reports/QA-FIXTURE-a.md
$ node ... --all → QA-FIXTURE-a.md · trailing-newline · 末字节不是换行 / 1 项不合规 / exit=1
$ printf 'ok\n' > .batch/night/reports/QA-FIXTURE-b.v3.md
$ node ... --all → 同时列出 trailing-newline 与 versioned-filename / 2 项不合规 / exit=1
$ mkdir -p .batch/night/archive/qa && printf 'ok\n' > .batch/night/archive/qa/QA-FIXTURE-c.v3.md
$ node ... --all → 0 项不合规 / exit=0        ← 仅含 c 时单跑，archive 目录豁免成立
```
夹具清理后复跑 `--all` 为 0，`status --porcelain` 无残留。
成立（c 首次与 a/b 并存时 exit=1 是 a/b 触发，非 archive 失效；我单跑复验确认豁免）。

### 判据 3 · 输出不含「行数」；一项一行；末行汇总

```
$ node ... --all | grep -c '行数' → 0
$ grep -n '行数' scripts/ops/check-batch-hygiene.mjs → 仅 :13 注释一行
```
「不含行数」「项一行」成立。**「末行汇总」字面不成立**：脚本 `scripts/ops/check-batch-hygiene.mjs:161` 在汇总行之后（`:88` 产出 `N 项不合规`）再打印一行 `修法：…`，故有不合规时末行是修法行，汇总行是倒数第二行；干净树时汇总行才是末行。
判：实质成立、字面偏差（详见三·偏差①）。交负责人一句话定：改脚本把修法行移到汇总之前，或把判据 3 文字改成「含一行 `N 项不合规`」。

### 判据 4 · 两处接线命中，hook 仍保留 `check-fast.mjs`

```
$ grep -n 'check-batch-hygiene' scripts/check-fast.mjs → :29 batch-hygiene 步骤（--all）
$ grep -n 'check-batch-hygiene\|check-fast.mjs' scripts/install-git-hooks.mjs → :36 node scripts/check-fast.mjs || { / :44 node scripts/ops/check-batch-hygiene.mjs --staged || {
```
hook 模板内 `check-fast.mjs` 调用在前、新检查在后（`git show c25fb57b:scripts/install-git-hooks.mjs` 实读）。成立。

### 判据 5 · 单测全绿

```
$ node ./node_modules/vitest/vitest.mjs run scripts/ops/__tests__/check-batch-hygiene.test.mjs
 ✓ (13 tests) / Test Files 1 passed / Tests 13 passed / EXIT=0
```
成立。执行方报告用的是 `./node_modules/.bin/vitest`，等价入口。

### 判据 6 · `check:fast` 在本树 exit 0

```
$ node scripts/check-fast.mjs
typecheck ✓ 16.2s / doc links: checked 1468, broken 0 / doc placement 新增 0 / 0 项不合规 / batch-hygiene ✓ / 全部通过 / EXIT=0
```
成立（报告写 typecheck 22.0s，机器快慢差异，不影响）。

### 判据 7 · 缺卡号只提醒且 exit 0

```
$ P=$(git rev-parse --git-path COMMIT_EDITMSG) → …/.git/worktrees/wt-1117d/COMMIT_EDITMSG
$ printf 'no card msg\n' > "$P"; node ... --staged → 0 项不合规 / 提交信息缺卡号 CARD-xxxx（只提醒，不拦提交） / exit=0
$ printf 'CARD-1117-D test\n' > "$P" → 无提醒 / exit=0
$ printf 'Merge branch x\n'    > "$P" → 无提醒 / exit=0（Merge 前缀豁免确实生效）
```
成立。复跑用的 COMMIT_EDITMSG 是 git 每次提交自写的临时件，用完即删，未触碰任何提交内容。

### 判据 8 · 提交信息含卡号；无 push、无 tag、无合并

```
$ git log -1 --format=%s → CARD-1117-D pre-commit 机检：尾行换行/禁 vN 文件名/缺卡号提醒
$ git branch -r --contains c25fb57b → 空
$ git tag --points-at c25fb57b → 空
$ git rev-list --parents -n1 → c25fb57b 1224ee2b（单亲）
$ git show --stat → 4 文件：check-fast.mjs 3+ / install-git-hooks.mjs 15± / __tests__ 85+ / check-batch-hygiene.mjs 172+，无 `.batch/` 路径
```
成立。

## 二、红线五条

1. 在 `develop` 的 `.git` 上跑 `hooks:install` —— **未触发**：`develop/.git/hooks/pre-commit` 仍是 2026-10-31 03:15 的 748B 旧件，`grep -c check-batch-hygiene` 为 0，`core.hooksPath` 未设。
2. 改动 `.batch/night/` 协作件 —— **未触发**：提交 4 文件均不在 `.batch/` 下；本树该目录只有未跟踪的报告。
3. `--no-verify` / `git add -A` / `--force` —— 提交面与提交历史无可查痕迹，按「4 文件点名、无额外路径」判**无证据触发**（无法回溯证明，记证据上限）。
4. 把「行数相等」重新当判据 —— **未触发**：源码仅 `:13` 注释提到行数，无任何行数比较逻辑。
5. 在 `develop` 主工作区改码或提交 —— **未触发**：`c25fb57b` 只存在于 `wt-1117d`；`develop` HEAD 为其自身分支 `04ae3642`，与本案无关。

## 三、偏差（判成立、不构成不通过，交负责人裁定）

① **判据 3「末行汇总」字面偏差**：修法行在汇总行之后（`scripts/ops/check-batch-hygiene.mjs:161`）。修法二选一：脚本把修法行前移，或判据文字改「含一行汇总」。改动量≈挪一行。
② **报告 `:37` 的自我描述与实测不符**：报告称输出「末行 `N 项不合规`」，与 ① 同源，属同一处措辞；建议随 ① 一并订正，不单独出件。
③ **报告内部判据编号与派验单不对应**：报告自带「判据 1–8」把派验单的 1+2 合并、3 拆进「2」与「3」，逐条对照会错位。本判词一律按**派验单八条**判。属可读性瑕疵，建议下张卡要求报告直接用派验单编号。
④ **报告 `:6` 称「本报告不含三元组」**，而第 2 行就是 `model= | 倍率= | provider=` 行——按 notice 该行是**规定格式**，此处是文字表述错了，一行记瑕疵，不扣分。
⑤ **环境备案**（非偏差）：`wt-1117d/node_modules` 是指向 `develop/node_modules` 的 junction（14:08 建立、未跟踪），用于在禁 `pnpm install` 前提下跑判据 4/5。跑完可删，不影响仓库状态；本判词所有命令都跑在同一 junction 上，与执行方同一条环境路径。

## 四、结论

**PASS，建议放行。** 8 条必验：7 条完全成立，判据 3 实质成立、字面偏差（一处挪行即可）；5 条红线无触发；证据链见上（命令与输出为我本人在 `wt-1117d` 实跑，非采信报告自述）。
放行前请负责人对三·① 给一句裁定（改脚本 or 改判据文字），②③④ 不必返工、随下次自然订正。
边界说明（照卡执行、不作缺判据）：真 hook 未安装，故「新 hook 拦下一次真实提交」这一级证据不存在；卡面判据 4 只要求生成的 hook 文本含该调用，已满足。

<!-- DONE -->
