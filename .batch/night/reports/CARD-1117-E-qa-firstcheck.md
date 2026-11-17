执行方：QA

# CARD-1117-E 首验单（集成验收：机检生效面与历史件 baseline 冻结）

受验卡面：`.batch/night/cards/CARD-1117-E-hygiene-scope.md`｜6,512B｜`0792019cc7bee251fd2b5b6c142898eb`｜68 行（含 §八 16:2x 增补）
派验单：`.batch/night/review-requests/CARD-1117-E-hygiene-scope.md`｜3,328B｜`ce471ea63ddc5864a46d9ca1dd78559a`｜40 行（含 §四 16:5x 两处补裁）
执行方报告：`wt-1117e/.batch/night/reports/CARD-1117-E-report.md`｜18,400B｜`828ac3a6247a42cebdd57c399eb868fc`｜392 行｜末行 `<!-- DONE -->`
受验版本：`9575abaa4e78fadb5f6a7fde50018af83c6ac3b8`（单亲 `7182062d`，作者 baiyunfei 2026-11-17 16:41:07）
验场：`C:/develop/workspace/AI-writer/wt-1117e`（分支 `card/1117-E-hygiene-scope`）＋ `C:/develop/workspace/AI-writer/develop`（合并后分支 `card/git-track-ops-1117`，HEAD `7182062d`）。下列命令全部由我实跑。

## 一、起点与提交面

```
$ git rev-parse --short HEAD         → 9575abaa
$ git rev-parse --short HEAD^        → 7182062d        （＝卡面起点）
$ git rev-list --parents -n1         → 9575abaa 7182062d（单亲，非合并）
$ git show --numstat --pretty=format: 9575abaa
204  0  scripts/ops/__tests__/check-batch-hygiene.test.mjs
 18  6  scripts/ops/__tests__/ops-scripts.test.mjs
235 12  scripts/ops/check-batch-hygiene.mjs
198  0  scripts/ops/hygiene-baseline.txt
（合计 655 insertions / 18 deletions，4 文件）
$ git show --name-only 9575abaa | grep -c '^\.batch/'  → 0
$ git branch -r --contains 9575abaa → 空；git tag --points-at → 空
$ git status --porcelain → ?? .batch/night/reports/CARD-1117-E-report.md（仅报告本体，未提交）
```

## 二、逐条判据

### 判据 1 · 开工三项校验在报告里可见 —— 成立

报告 §0（`:14-22`）给出 `rev-parse --show-toplevel`→`C:/develop/workspace/AI-writer/wt-1117e`、`--short HEAD`→`7182062d`、`branch`→`card/1117-E-hygiene-scope`、`ls scripts/ops/check-batch-hygiene.mjs`→存在、`diff --ignore-cr-at-eol --stat` 与 `diff --numstat` 均空、`porcelain` 空。我复核父链为 `7182062d`（见上），与卡面起点一致。

### 判据 2 · `--all` exit 0，且扫描面确为已跟踪路径 —— 成立（附范围说明）

在含 E 提交的树上：

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
（baseline 冻结清单豁免 1 项：清单内且本次未改动）
EXIT=0
```

扫描面源码：`check-batch-hygiene.mjs:218-223` `trackedFiles()` → `git ls-files -z -- .batch/night`；`:351-353` `--all` 只调 `trackedFiles`，`walkWorkTree` 只在 `--disk` 分支（`:227`、`:353`）。反证（未额外写盘）：该树内确有未跟踪的 `.batch/night/reports/CARD-1117-E-report.md`，`--all` 仍为 0，说明门禁不看未跟踪件。

**范围说明（交终裁，不据此打回）**：判据 2 原文「在合并后分支上 exit 0」。当前合并后分支头 `7182062d` 上**还没有** baseline 文件，用 E 的脚本在该树跑 `--all` 得 `1 项不合规`、`EXIT=1`（就是 `org/ruling-git-workflow-1117.md` 那一条）。也就是说「绿」的成立条件是「E 合并进来、baseline 同时在位」，我以 `wt-1117e`（＝`7182062d`＋E）取证判成立；合并前任何人去 develop 树复跑这一条都会看到红 1 项，属预期，不是缺陷。

### 判据 3 · `--disk` 仍报 236 项、exit 1、首行有「仅作统计，不作门禁」 —— 成立

在合并后分支树（`develop`，其未跟踪历史件才在盘上；新建 worktree 不含未跟踪件，故 236 只能在这里量）：

```
$ cd develop && node .../wt-1117e/scripts/ops/check-batch-hygiene.mjs --disk
磁盘模式：含未跟踪历史件，仅作统计，不作门禁（统计面 ≠ 门禁面）
.batch/night/cards/....v1.md · versioned-filename · ...
...
236 项不合规
EXIT=1
```
首行字样逐字命中。补一条量纲：236 处不合规落在 **195 条唯一路径**上（同路径可命中多条规则），与 baseline 条目数 195 一致；`--disk` 全程不读 baseline（源码 `:360-370`），所以「历史件没被掩盖」可单独自证。

### 判据 4 · baseline 三态（豁免／改动后不豁免／缺失不豁免） —— 成立

我在 `/tmp/qae` 建临时 git 仓库独立复跑（不改工作树）：

```
$ git init；建 .batch/night/cards/a.v2.md 并提交
A 无 baseline          node $S --all → .batch/night/cards/a.v2.md · versioned-filename / 1 项不合规 / EXIT=1
B 清单内且未改动        node $S --all --baseline bl.txt → 0 项不合规（豁免 1 项）/ EXIT=0
C 同路径改动后          echo x >> a.v2.md；重跑 → 1 项不合规 / EXIT=1（不再豁免）
D baseline 缺头三行     → stderr「baseline 头三行缺 …（无头行不得当「无豁免」处理）」/ EXIT=2
E 条目数与实际不符      → stderr「baseline 条目数与实际不符：头行 5、实际 1」/ EXIT=2
```

D、E 两条是我按卡面 §八① 追加验证的（「缺行视为无效、报错退出、不静默降级」），实测 exit 2、不降级。

### 判据 5 · A 卡判据收窄重跑 —— 成立

```
$ grep -rn "wc -l\|awk NR" scripts/ops/{make-ledger-v7,fix-ledger-v7,patch-reboot,no-at-count,pointer-metrics}.mjs
（无输出，EXIT=1）
$ grep -rn "wc -l\|awk NR" scripts/ops/*.mjs
scripts/ops/check-batch-hygiene.mjs:6://  （末行无换行会让 `wc -l` 与 `awk NR` 恒差 1，指标本身不确定）。
```
全目录唯一现有点为 `:6` 的**注释**（解释末行换行导致计数差 1），不在任何 pass 判定分支——`collectViolations`/`renderReport` 全程不调用 `wc`/`awk`（源码 `:100-200` 区间无 `execFile('wc'`/`'awk'`）。范围收窄落地在 `ops-scripts.test.mjs:57-82`（新增「五件都在」防文件名写错空转的用例，`OWN_FILES` 常量列出五个文件名），与 16:14 裁定一致。

### 判据 6 · 单测全绿，且新增用例确实存在 —— 成立

```
$ node scripts/run-tests-electron.mjs scripts/ops/__tests__
Test Files 2 passed (2) / Tests 38 passed (38) / EXIT=0
```
读测试文件核对用例（`check-batch-hygiene.test.mjs`）：`baseline 文本形态` `:155-186`（头三行缺失 `:166`、条目数不符 `:171`）、`baseline 豁免语义` `:187-207`（未改跳过 `:190`、改动报红 `:196`、缺失/未命中报红 `:202`）、`扫描面：--all 只看已跟踪，--disk 看磁盘全量` `:208-234`（两例）、`baseline 端到端（临时仓库）` `:235-282`（含 `--write-baseline` 头三行可复现 `:274`）。卡面要的三例＋扫描面两例齐备，且不是同名空壳。

### 判据 7 · `check:fast` exit 0 —— 成立（本卡核心目的达成）

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 18.4s
doc links: checked 1468, broken 0
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
（baseline 冻结清单豁免 1 项：清单内且本次未改动）
[check:fast] batch-hygiene ✓ 0.1s
[check:fast] 全部通过。
EXIT=0
```

### 判据 8 · 提交信息含卡号、单亲、无 push／tag／合并 —— 成立

见第一节：`fix(ops): 机检生效面改为已跟踪路径，历史件走 baseline 冻结（CARD-1117-E）`、单亲 `7182062d`、无 `.batch/` 路径、远端分支与 tag 均空。

## 三、红线

1. 改名／删／移 `.batch/night/` 历史件 —— **未触发**：提交面 0 个 `.batch/` 路径；baseline 195 条路径全为原名（带 `.vN`），且我重生成后与提交版逐字节相同（见下），说明磁盘上这些件仍在原位。
2. 在 `develop` 主工作区改码或提交 —— **未触发**：`develop` HEAD 仍 `7182062d`；`git status --porcelain -- scripts/` 只有早前卡遗留的 `?? scripts/workbuddy/space-readonly-check.mjs`，无 ` M`；`develop/scripts/ops/hygiene-baseline.txt` **不存在**（baseline 只落在 `wt-1117e`），说明生成时用绝对 `--baseline` 指向工作树，没往主工作区写文件。
3. `git add -A`／`-f`／`--no-verify`／`--force` —— 提交面为 4 个具名文件、无删除项、无意外文件，判**无证据触发**（历史命令不可回溯，记证据上限）。
4. 改 `.batch/night/` 协作件内容 —— **未触发**：`org/ruling-git-workflow-1117.md`（md5 `82caafcedef745a161e8b3a2549a4efc`）在 `--disk` 下**仍报** `trailing-newline`，即那个尾行空行原样保留，没被顺手「修」掉。
5. 门禁放宽成「全部豁免」 —— **未触发**：`--disk` 完全不读 baseline（`:360-370`）；门禁面上被判据 4 的 C 态证明「清单内路径一旦改动照常报红」，未命中路径照常报红；`applyBaseline` 只对 `entries` 内且不在 `changeSet` 的条目生效。

**额外正向证据（§八④ forge 检查）**：我从 `develop` 树重新执行一次 `--disk --write-baseline --baseline /tmp/regen-baseline.txt`，产物与提交版 **逐字节相同**（`diff` 无输出，8619B，头三行 `条目数：195` / `生成 SHA：7182062d` / `生成命令：node scripts/ops/check-batch-hygiene.mjs --disk --write-baseline`）。手工增删路径不可能复现同一字节流，forge 风险排除。

## 四、偏差（判成立，不构成不通过）

① 报告 `:6` 写「本报告不含三元组自报字段」，而 `:2` 就是 notice 规定的 `model= | 倍率= | provider=` 格式行——同一措辞含混，前两卡已出现两次，建议卡面模板统一写「不含产物正文三元组」，别再各卡重述。
② 判据 2 的字面主体（「合并后分支」）与可复现位置（含 E 的树）不一致，属判定位置写法问题，不是执行方问题；建议后续集成卡把此类判据写成「在 `<待合并分支>`＋本卡提交上」。

## 五、结论

**PASS，建议放行合并。** 8 条必验全部成立（判据 2 按「E 提交在位」的口径成立，已注明合并前 develop 树仍红 1 项属预期）；5 条红线无触发；判据 7 `check:fast` 我已在本树复跑为绿，这是本卡要的结果。baseline 未发现 forge、未发现放水，195 条与盘上 236 处不合规逐条对齐。

边界说明：本卡只解决「机检生效面」与「历史件不罚」，`.batch/night/` 历史件的收编仍是 B 卡的活；baseline 的收缩（B 卡验收后删除或减条）不在本卡范围，按卡面 §八② 执行。

<!-- DONE -->
