From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: developer · AI writer项目组 · 群分身

# CARD-1117-B：基线收编（首次入库、归档区建立、baseline 收缩）

状态：**待前置**——前置＝CARD-1117-E 合并进 `card/git-track-ops-1117`（E 提供 `--all` 只扫已跟踪路径与 `scripts/ops/hygiene-baseline.txt`）。解除判据：该分支头上 `node scripts/ops/check-batch-hygiene.mjs --all` `exit 0`。
估时：改码 90 分钟 + 首验 40 分钟
执行方：developer；首验方：QA
类型：**A 类**（产生仓库提交，须配派验单 `review-requests/CARD-1117-B-baseline-intake.md`）

依据：`.batch/night/org/ruling-git-workflow-1117.md` §二·1/2/7、§三·B、§四（提交 `1224ee2b`）；`.gitignore` 白名单 `35ff9aa7`；E 卡 §八（baseline 治理）。

## 17:1x 改订（三条，务必按改订后执行）

1. **`git mv` 口径作废**：`.batch/night/` 下这批件此刻**从未入库**（当前 `git ls-files .batch` 只有 6 件），没有可搬的历史，`git mv` 会报路径不存在。收编改为「磁盘移动到目标路径 + `git add` 首次入库」。
2. 因此判据里「`R` 条数＝搬入总数」「`git log --follow` 可追搬前路径」两条**删除**——首次入库的件没有前史，硬造前史就是造假。
3. 新增 **baseline 收缩**一条：收编中把 `org/ruling-git-workflow-1117.md` 的尾行空行补上（E 卡 §八 消费），随后把该条从 `scripts/ops/hygiene-baseline.txt` 减去，条目数 195 → 194，且**只减不增**。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\wt-1117b`（`git worktree add ... -b card/1117-B <E 合并后的 card/git-track-ops-1117 头>`）。
- 起点 SHA 写进报告；开工前三项校验：`git rev-parse --short HEAD` 与起点一致、`ls scripts/ops/hygiene-baseline.txt` 存在、`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均为空（R4 口径）。
- 禁在 `develop` 里改码或提交；禁 `pnpm install`／`rebuild`／`pnpm dev`。
- 本卡是 **R4 的收编例外**（同旧口径）：`.batch/night/` 下未跟踪件允许存在，但要求 ①首列无 `M/A/D/R/U`；②开工前把 `git -c core.quotepath=false status --porcelain=v1` 中 `^?? ` 全文抄进报告作收编基线清单，收编后复核「清单外新增 `??` ＝ 0」。

## 1. 起因与背景

协作介质住在 git 之外，同一事实存多份副本：`.batch/night` 内 8 组 md 字节完全相同（升版零改动）。裁定要求版本只由 git 承担、一份事实一处存放；本卡做一次性收编。E 卡落地后，`--all` 只扫已跟踪路径，收编会让 234 件历史件进入机检视野，故必须先有 baseline 冻结、收编后再逐条收缩。

## 2. 要改成什么（唯一口径）

1. **建立归档区**：`.batch/night/archive/{cards,org,reports,review-requests,roster,staging}/`，只在有件时才建；收集编时被取代的历史版本件（磁盘移动，非 `git mv`）。
2. **现行件去 vN**：每类件只留一份不带版本号的文件名。判「现行」按内容（最新且未被取代），不按文件名字典序。
   - 名册：`roster/identity-roster.md` 为现行，`identity-roster.v*.md` 全部进 archive。
   - 台账：`reports/task-ledger.md` 为现行（若尚无此文件，用内容最全的 `task-ledger.vN` 落一份无版本名副本），`task-ledger.v*.md` 进 archive。
   - 记账件：`org/ledger-append-*.v*.md` 只留内容最全的一支为 `org/ledger-append-hy4flash-auth.md`，其余进 archive。
   - 卡面：`cards/*.v*.md` 进 archive，只留在办/待办当前件（A–E 五张及其派验单不搬）。
   - `staging/*.v*.md` 与已被取代的中间稿进 archive，`staging/` 只留仍在用的方案件。
3. **不入库白名单（新增，硬）**：`staging/project.db-wal`、`staging/project.db-shm`、任何 `*.db`／`*.db-wal`／`*.db-shm`／`*.voided` 一律**不提交**，留在磁盘（不需删）；报告里逐条列出被排除的路径与理由。
4. **不删任何东西**：归档靠磁盘移动，收编后 `git status --porcelain` 首列 `D` 条数＝0。
5. **指针同步**：被搬走的件若在别处被引用（台账、名册、collab 文档、脚本常量），引用改成 `archive/` 新路径或 `git show <sha>:<path>` 形式，不留断链。
6. **baseline 收缩**：补 `org/ruling-git-workflow-1117.md` 尾行空行；`scripts/ops/hygiene-baseline.txt` 头行条目数 195 → 194，删去该条；除这一条外文件不得增删。
7. **一次提交**：提交信息写清「收编 N 件、archive 结构、现行件去 vN、baseline 195→194」。

## 3. 落点与禁改区【硬】

- 改：`.batch/night/{cards,org,reports,review-requests,roster,staging}/`、`scripts/ops/hygiene-baseline.txt`（仅减一条）
- 新建：`.batch/night/archive/`（含子目录）
- **禁改**：`src/`、`scripts/ops/*.mjs`（A/D/E 已定稿）、`docs/` 禁动区、`.gitignore`、`package.json`、其它协作件内容（只许移动与改指针行）
- **禁**：`rm`／`git rm` 任何协作件；`git add -A`／`git add -f`；`--force`；`--no-verify`

## 4. 验收判据【硬】

每条须能指认（命令输出／路径清单），缺一条即不通过：

1. `.batch/night/archive/` 六类子目录与搬入件清单可读；搬入总数与报告「移动清单（源 → 目标两列）」逐条对得上。
2. `ls .batch/night/roster/*.v*.md`、`ls .batch/night/reports/task-ledger.v*.md`、`ls .batch/night/org/*.v*.md` 三条均为空（`No such file` 也算通过，须附输出）。
3. `git status --porcelain` 首列 `D` 条数 ＝ 0；本提交无 `git rm` 痕迹（`git log --diff-filter=D -1 --name-only` 对本提交为空）。
4. 现行件就位：`.batch/night/roster/identity-roster.md`、`.batch/night/reports/task-ledger.md`、`.batch/night/org/ledger-append-hy4flash-auth.md` 三条 `git ls-files` 均命中。
5. 入库件数：`git ls-files .batch/night | wc -l` 贴出总数（收编前 6 件；staging 现有 234 件，扣掉 §2.3 白名单后入库），要求总数 ≥ 230 且与报告「移动清单」行数一致；`git ls-files .batch/night | grep -cE '\.db(-wal|-shm)?$|\.voided$'` ＝ 0。
6. 引用不断链：`grep -rn "\.v[0-9]\+\.md" .batch/night/{cards,org,reports,review-requests,roster,staging}` 每行要么指向 archive 内实际存在的件，要么已改 `git show` 形式；附逐条说明。
7. baseline：`node scripts/ops/check-batch-hygiene.mjs --all` `exit 0`；`head -3 scripts/ops/hygiene-baseline.txt` 首行条目数＝194；`node scripts/ops/check-batch-hygiene.mjs --disk` 报 `0 项不合规`（因尾行已修、且 234 件已入库却都合规——若仍有红，逐条说明为何属历史件并说明与卡面 §2.3 的关系）。
8. 报告含开工前 `??` 基线清单与收编后复核（清单外新增 `??` ＝ 0）、被排除文件清单。
9. `pnpm check:fast` `exit 0`，附 exit code。
10. 提交单亲起点 SHA、信息含 `CARD-1117-B`；不 push、不打 tag、不合并。

## 5. 交付物

- 提交（一卡一提交）
- 报告：`.batch/night/reports/CARD-1117-B-report.md`（首行 `执行方：developer`，第二行 `model= | 倍率= | provider=`，末行 `<!-- DONE -->`）
- 移动清单两列列出，不写字节／md5／行数。

## 17:20 派单解除前置

前置已满足：E 卡已 `--no-ff` 合入 `card/git-track-ops-1117`，合并后分支头 **`72989e16`**（父 `7182062d`＋`9575abaa`），`check:fast` EXIT=0，`node scripts/ops/check-batch-hygiene.mjs --all` `exit 0`、`--disk` 仍 exit 1 报 236 项（历史件未被掩盖）。

起点 SHA 即 `72989e16`，工作区 `C:\develop\workspace\AI-writer\wt-1117b`，分支 `card/1117-B`。状态改为 **在办**。
