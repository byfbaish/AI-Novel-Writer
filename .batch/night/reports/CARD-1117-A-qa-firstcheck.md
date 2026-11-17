执行方：QA

# CARD-1117-A 首验单（产出脚本去三元组、机检去行数）

受验卡面：`.batch/night/cards/CARD-1117-A-de-triplet.md`（14:1x 改订版）
派验单：`.batch/night/review-requests/CARD-1117-A-de-triplet.md`（2,964B，8 条必验＋6 条红线，含 14:4x 判据 6 终裁）
执行方报告：`wt-1117a/.batch/night/reports/CARD-1117-A-report.md`（5,980B，116 行，末行 `<!-- DONE -->`）
受验版本：`7de913f62f1e994d9386020f0f1da1ea7ddb998e`（父 `1224ee2b`，单亲，作者 baiyunfei 2026-11-17 14:40:59）
验场：`C:/develop/workspace/AI-writer/wt-1117a`，分支 `card/1117-A`；下列命令由我在该树实跑，未采信报告自述。

## 一、必验八条

### 判据 1 · 五件脚本入库且都在 `scripts/ops/`

```
$ git ls-files 'scripts/ops/*'
scripts/ops/__tests__/ops-scripts.test.mjs
scripts/ops/fix-ledger-v7.mjs
scripts/ops/make-ledger-v7.mjs
scripts/ops/no-at-count.mjs
scripts/ops/patch-reboot.mjs
scripts/ops/pointer-metrics.mjs
```
帕名齐全，`no-at-count` 只有一支（无 v2/v3 分支残留），文件名不带 `.vN`。成立。

### 判据 2 · 三元组字符串六处命中，逐条判「注释/引用」而非「写入产物正文」

```
$ grep -rn "md5\|MD5\|sha256\|行数" scripts/ops/*.mjs
fix-ledger-v7.mjs:3    // stdout 只回一行 OK（原版会打 bytes/lines/md5，已按裁定 1224ee2b §二·3 移除）
make-ledger-v7.mjs:4   // 字节／md5／行数 打到 stdout…裁定 1224ee2b §二·3（记述待移除行为）
make-ledger-v7.mjs:46  // 纯变换：…不做任何行数/字节/哈希计算
no-at-count.mjs:9      // 不把「行数／字节／哈希」当 pass 判据，也不向 stdout 自报三元组
pointer-metrics.mjs:7  // S＝含字节/行数量值（被统计对象的特征，非本件自报）
pointer-metrics.mjs:8  // 不含「行数相等即通过」这类判据
$ grep -rn "createHash\|digest(" scripts/ops/*.mjs → 无命中（exit 1）
$ grep -rn "console.log" scripts/ops/*.mjs
fix-ledger-v7.mjs:38  console.log('写入 ' + file + '（OK）')
make-ledger-v7.mjs:91 console.log('写入 ' + dst + '（OK）')
no-at-count.mjs:94    console.log(JSON.stringify(summarize(...)))
patch-reboot.mjs:148  console.log('applied ' + patch.rel)
pointer-metrics.mjs:42 console.log(JSON.stringify(computeMetrics(...)))
```
六处全是注释；stdout 实际只有「写入/applied」与 JSON 指标，无 bytes/md5/lines 字段；源码内无任何哈希计算。成立。

### 判据 3 · `wc -l`／`awk NR` 不出现在 pass 判定分支

```
$ grep -rn "wc -l\|awk NR" scripts/ops/*.mjs → 无输出（0 命中，exit 1）
```
不只是「不在 pass 分支」——源码里根本不存在这两个惯用法；另有用例②做源码级守卫（连 `split('\n').length` 一并禁）。成立。

### 判据 4 · 提交不含 `.batch/` 路径

```
$ git show --name-only --pretty=format: 7de913f6 | grep -c '^\.batch/' → 0
$ git show --stat → 6 files changed, 572 insertions(+)，全在 scripts/ops/
```
成立。

### 判据 5 · 报告写明「七件原为未跟踪件、无迁移历史」＋附 `git ls-files .batch/night/staging` 空输出

```
$ git -C ../develop ls-files .batch/night/staging | wc -l → 0
```
报告 `:17` 引同一命令标「空输出（0 行）」，`:69` 明写「七件原为未跟踪件，在 `1224ee2b` 上无任何 git 历史…不伪造重命名或历史」。我复跑同值为 0。成立。

### 判据 6 · 单测全绿（终裁：`node scripts/run-tests-electron.mjs` 视同 `pnpm test`）

```
$ sed -n '26p' package.json →    "test": "node scripts/run-tests-electron.mjs",
$ node scripts/run-tests-electron.mjs scripts/ops/__tests__
 ✓ scripts/ops/__tests__/ops-scripts.test.mjs (10 tests) / Test Files 1 passed / Tests 10 passed / EXIT=0
```
等价证据成立：`package.json:26` 的 `test` 本体即该命令，范围同为 `scripts/ops/__tests__`。用例非空壳——① 用真实夹具跑 `buildLedgerV7`/`applyLedgerV7Fixes` 后断言输出不匹配 `SELF_REPORT_RE`（`bytes=|md5=|sha256=|行数=` 形式的「字段＝值」），② 源码守卫逐文件检查三条惯用法，另有锚点命中 0/2 次必抛错。成立。

### 判据 7 · `check:fast` 全绿

```
$ node scripts/check-fast.mjs
typecheck ✓ 15.5s / doc links: checked 1468, broken 0 / doc placement 新增 0 / 全部通过 / EXIT=0
```
成立（报告 18.8s，机器快慢差异，不影响）。

### 判据 8 · 提交信息含卡号；无 push、无 tag

```
$ git log -1 --format=%s 7de913f6 → docs(ops): 产出脚本去三元组、机检去行数（CARD-1117-A）
$ git branch -r --contains 7de913f6 → 空
$ git tag --points-at 7de913f6 → 空
$ git rev-list --parents -n1 → 7de913f6 1224ee2b（单亲，非合并）
```
成立。

## 二、红线六条

1. 改动 `scripts/workbuddy/model-policy.mjs` 或其测试 —— **未触发**：提交 6 文件无一处命中 `model-policy`。
2. 动 `.batch/night/{org,reports,roster}/` 内容 —— **未触发**：提交面 0 个 `.batch/` 路径；本树 porcelain 仅 `?? .batch/night/reports/CARD-1117-A-report.md`（报告本体，未提交）。
3. `git add -A`／`-f`／`--no-verify`／`--force` —— 提交面为 6 个具名路径、无额外文件、无删除项，判**无证据触发**（历史动作不可回溯，记证据上限）。
4. 报告拿字节／md5／行数当交付凭证 —— **未触发**：报告 `:6` 明写不含三元组自报字段，全文无 `md5=`／`bytes=`／`行数=` 交付凭证；对账一律给命令与输出摘要。
5. 在 `develop` 主工作区改码或提交 —— **未触发**：`develop` HEAD 仍 `04ae3642`（13:49:05，早于本卡 14:12 开工），reflog 顶部无本卡时段的 commit 记录。
6. 改、删、移 `.batch/night/staging/` 任何文件 —— **未触发**：`develop/.batch/night/staging/qa-noat-721vs722-1117.mjs` 仍为 `01f6e28a04787ac17bf3350e12bef8ec`（与 12:1x 我落盘时同值），目录内文件数未变。

## 三、偏差（判成立、不构成不通过，交负责人知悉）

① **`package.json:26` 未逐字贴**：派验单要求「贴原文作等价证据」，报告 `:88` 是在行文里内联引了 `"test": "node scripts/run-tests-electron.mjs"`，末位逗号被略去、也未给出章 code block 形式的原行。等价性我独立复核成立（见判据 6），建议下张卡把「贴原文」写成「fenced 代码块内含该行逐字＋行号」。
② **报告 `:6` 的「本报告不含三元组自报字段」字面与 `:2` 的 `model= | 倍率= | provider=` 行并存**：那是 notice 规定的**格式行**，不是本卡要禁的「产物正文三元组」，属措辞含混，不扣分。
③ **报告小节编号与派验单不一一对应**：报告 §1–§7 把派验单的判据 6、7 合成一节，逐条对照会错位（与 D 卡同一类问题）。本判词一律按**派验单八条**判；建议后续卡面直接要求报告用派验单编号。
④ **环境备案**：`wt-1117a/node_modules` 是指向 `develop/node_modules` 的 junction（未跟踪、不在提交内），与 D 卡同一做法；我全部实测命令都跑在这条 junction 上，与执行方同一条环境路径。

## 四、结论

**PASS，建议放行。** 8 条必验全部成立（判据 6 按 14:4x 终裁的等价命令判成立，我已独立验证 `package.json:26` 与该命令一致）；6 条红线无触发；证据均为我在 `wt-1117a` 实跑所得。三处偏差属措辞与小节编号，不必返工。

边界说明：本卡只做「脚本入库＋去三元组＋去行数判据」，`.batch/night/staging` 整目录搬 archive 归 B 卡，未装 hook 归 D 卡范围，据本卡不得声称「协作件已收编」。

<!-- DONE -->
