# S2 首次验收判词：B-23「不成立」结案 ＋ B-20 验证记录卡

执行方：QA · AI writer项目组（群分身）
判定对象：HEAD `0d2671db`（分支 `exp/mainline-1119`，origin `376ce148`，ahead 2）下的 1 处改动 ＋ 4 件新件
判定时间：2026-11-21 00:47–00:57（+0800）
结论：**PASS**（附勘误 3 项，不改结论、不返工）

## 一、受判文件（取数即冻结）

| 文件 | 字节 | 行 | md5 |
|---|---|---|---|
| `.batch/night/org/BACKLOG.md`（M） | 15,949 | 111 | `1ec65813585444e159d5ca72c87af38e` |
| `.batch/night/cards/CARD-1121-B23-versioned-archive-verify.md` | 2,459 | 37 | `8a9d7702b1bebeb250240b221e1ebc57` |
| `.batch/night/cards/CARD-1121-B20-merge-head-verify.md` | 2,998 | 36 | `fc37d3910a36f61580b913831dca9102` |
| `.batch/night/reports/s2-b23-versioned-archive-not-a-defect.md` | 3,282 | 64 | `b2d340de5088d9241b0d7a59ab4dc426` |
| `.batch/night/reports/s2-b20-merge-head-verify.md` | 4,487 | 71 | `8e4f165d297f8ae5bfed16b2126e3ea8` |

`git status --porcelain -uall`：` M .batch/night/org/BACKLOG.md` ＋ 5 个 `??`（含本文前期草稿 `S2-premise-qa-recheck.md`，同一路径，本文件即其定稿）。未提交、未推送。

## 二、B-23 三条证据（逐条复跑）

| # | 判据 | 我的取证 | 判定 |
|---|---|---|---|
| 1 | BACKLOG 有结案行，写明「不成立」并列三条证据 | `BACKLOG.md:90` 标题 `### B-23 结案（2026-11-21 00:35）：**不成立：自 \`d1a6e75c\` 起 \`archive/\` 已豁免**`；`:92-95` 三条证据；`:96` 定性「不是本 Goal 修好的，是从未缺过」 | 过 |
| 2 | 自 `d1a6e75c`（11-17）起含 archive | `git show d1a6e75c:scripts/ops/check-batch-hygiene.mjs \| grep -n EXEMPT_VERSIONED_DIRS` → `26:…archive/…`、`55:…return null`；**父提交 `d1a6e75c^` 中 `archive/` 命中 0**；`git show -s --date=short` → `2026-11-17 d1a6e75c` | 过 |
| 3 | `:38` 常量含 archive、`:85` 直接 return null | `sed -n '38p;85p' scripts/ops/check-batch-hygiene.mjs` → `export const EXEMPT_VERSIONED_DIRS = [\`${WATCH_ROOT}/archive/\`, \`${WATCH_ROOT}/staging/\`]` / `if (EXEMPT_VERSIONED_DIRS.some((dir) => repoRelPath.startsWith(dir))) return null` | 过 |
| 4 | 代码无「同目录须有主件」规则 | `grep -rn '主件' scripts/ops/` → 无输出、**GREP_EXIT=1**（dev 称扫 `scripts/` 整层同为 0，我只复跑了 `scripts/ops/`） | 过 |
| 5 | archive 内 `.vN` 71 件、`--disk` 命中 archive 0 行、14 项分布 | `find .batch/night/archive -type f -name '*.v[0-9]*' \| wc -l` → `71`（后缀统计 `69 md`＋`2 mjs`）；`--disk` → `14 项不合规`、`grep -c '^\.batch/night/archive/'` → `0`；分布 `signals/lead` 4／`tmp` 7／`tools` 5 | 过 |

## 三、B-20 验证记录卡（逐条复跑）

| # | 判据 | 我的取证 | 判定 |
|---|---|---|---|
| 6 | 卡面三样证据齐（缺一不判） | `CARD-1121-B20-merge-head-verify.md:21` `## 3. 三样证据（缺一不判）`；`:22` 探测四值、`:23` 完整运行、`:24` 不可满足说明 | 过 |
| 7 | `wt-p56` 探测四值，且确走 `--git-path` 分支 | 我独立在 `wt-p56` 跑：`dotgit_is_file=True`／`dotgit_mergehead_test=False`／`gitpath_raw=C:/develop/workspace/AI-writer/develop/.git/worktrees/wt-p56/MERGE_HEAD`／`gitpath_test=False` → 不进等待循环、不置 `$inProgress` | 过 |
| 8 | 一次完整运行到末行 `POSTMERGE OK` | 采信执行方 §二 `:43` 的 `POSTMERGE OK  exp/mainline-1119 @ 0d2671db`（主检出干净树，`已跟踪改动 0 项`）；我另在主检出复跑 `check-fast` 以佐证该段机检无假 | 过（见 §四 采信限度 1） |
| 9 | `wt-p56` 侧以「MERGE_HEAD 行消失＋不置 inProgress」为通过线 | 报告 `:54-59` 贴出 `已跟踪改动 14 项` → `POSTMERGE RED  已跟踪改动 14 项`，**无「MERGE_HEAD 仍在」行、无 10 分钟复核提示**；该树 14 项改动非本卡产物（不认领、不动） | 过（口径按 admin 00:5x 裁定：不要求该树跑出 OK） |
| 10 | 脚本在仓外、无分支无单测的证据 | `ls -l rotation/post-merge-check.ps1` → 5,678B、mtime `Nov 19 23:07`；`git ls-files --error-unmatch rotation/post-merge-check.ps1` → `error: pathspec … did not match any file(s) known to git` | 过 |
| 11 | `:59` 兜底行在 | `grep -n '' …post-merge-check.ps1 \| sed -n '56,66p'` → `59:  if (-not (Test-Path $mergeHeadPath)) { $mergeHeadPath = (git -C $Repo rev-parse --git-path MERGE_HEAD 2>$null) }` | 过 |
| 12 | 两卡各有「本卡不改码，故无分支、无单测」 | `grep -n '本卡不改码'` → 两卡均命中，**位置 `:7`**（dev 自述「第 4 行」） | 过（位置见 §五 勘误 2） |
| 13 | B-24 只登记一行议题、不写方案不估工时 | `BACKLOG.md:98` 标题即「下期议题」；`:101` 「**本条只登记议题**——本 Goal 不写方案、不估工时、不动脚本」 | 过 |

## 四、阶段门禁（我自己跑的）

| 项 | 命令 | 输出 | 判定 |
|---|---|---|---|
| 全量机检 | `node scripts/ops/check-batch-hygiene.mjs --all` | `0 项不合规`，`ALL_EXIT=0` | 过 |
| 磁盘面 | `node scripts/ops/check-batch-hygiene.mjs --disk` | `14 项不合规`，archive 命中 `0` | 过 |
| check-fast | `node scripts/check-fast.mjs` | typecheck ✓ 21.3s／doc links 1468-0／doc placement 438（新增 0）／batch-hygiene `0 项不合规`／`全部通过。`，`CHECKFAST_EXIT=0` | 过 |
| 归档件零改动 | `git diff --name-only 376ce148 HEAD -- .batch/night/archive \| wc -l` | `0` | 过 |
| MANIFEST 未变 | `git show HEAD:.batch/night/archive/MANIFEST.sha256 \| sha256sum` | `ab1119a28ff94b38825da188feb228eea456a151efdd134fa5567f51d98426b0` | 过 |
| 未提交未推送 | `git log -1 --format=%h` / `status` | HEAD 仍 `0d2671db`；未跟踪件 5、`M` 1 | 过 |

## 五、勘误（不改结论，按 batch-hygiene 纪律不另出件，以本判词为准）

1. `reports/s2-b20-merge-head-verify.md:33` 写「不进等待循环（`:62`）」——实际 `while` 在**`:61`**，`:62` 是 `$mergeHead = Test-Path $mergeHeadPath`；同句「不置 `$inProgress`（`:65`）」正确。
2. 两卡「本卡不改码，故无分支、无单测」在**第 7 行**，不是 developer 自述的第 4 行（第 4 行是 `来源：`）；内容要求满足，位置不符。
3. `reports/s2-b20-merge-head-verify.md:22` 写 `gitpath_raw = [C:/…]`（PowerShell 数组格式带方括号），我实测为裸字符串；属格式差异，不影响「确走 `--git-path` 分支」的结论。

## 六、采信限度

1. 「完整运行到 `POSTMERGE OK`」是执行方在主检出跑的那一次，我未复跑整支脚本（会连带跑 `check:fast`，且 `wt-p56` 有他人 14 项改动不可动）；我以「主检出 `check-fast` EXIT=0 ＋ `wt-p56` 探测四值」作替代证据。admin 已裁定本轮不建临时树。
2. 11-19 22:55 那次假 RED 的原始输出无存证，「改前不可满足」按执行方说明采信（脚本 23:07 自修、字节不可复原）。
3. 本判词数字为 00:47–00:57 取数，已冻结；若后续有提交改动 `scripts/ops/` 或归档面，须重新取值。

## 七、观察（不进判据）

- `wt-p56`（`7478b44a`）、`wt-1117f`（`1ee92e87`）、`night-probe`（`dd2990c7`，detached）、`test-master`（`dbad51d7`，detached）四棵树仍在本机；stage 4 统一处置，其中 `wt-p56` 的 14 项已跟踪改动需先有人认领。
- 本判词文件由谁 `git add` 随本批入库：建议 developer 在下一笔实改动里一并带上（前例 stage 2 判词即如此）。

## 八、结论

**PASS。** B-23 不成立结案与 B-20 验证记录卡均达标，三条证据我逐条复跑、B-20 探测由我独立重做，check-fast `EXIT=0`、归档件字节零改动、MANIFEST `ab1119a2…` 未变。三处勘误为文字层，不构成返工理由。

<!-- DONE -->
