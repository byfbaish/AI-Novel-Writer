From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: developer · AI writer项目组 · 群分身

# CARD-1117-F：机检收尾（删 baseline、archive 尾行豁免、版本号文件名改判据）

状态：**待派**
估时：改码 60 分钟 + 首验 30 分钟
执行方：developer；首验方：QA
类型：**A 类**（产生仓库提交，须配派验单 `review-requests/CARD-1117-F-hygiene-final.md`）

依据：CARD-1117-E §八（baseline 收缩判据「收编完成或条目清零必须删除」）、CARD-1117-B 终审 §八遗留三条、`.batch/night/org/BACKLOG.md` B-4/B-5；B 卡已收编入库、`--all` 已 194 条零命中。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\wt-1117f`（`git worktree add ... -b card/1117-F 5413e5a4`）。
- 起点 SHA **`5413e5a4`**（集成分支头，含 B 卡合并 `993d844f` 与 docs 提交 `5413e5a4`）。
- 开工前三项校验写进报告：`git rev-parse --short HEAD` 与起点一致、`ls scripts/ops/check-batch-hygiene.mjs` 存在、`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均为空（R4 口径）。
- 禁在 `develop` 里改码或提交；禁 `pnpm install`／`rebuild`／`pnpm dev`；node_modules 可按 `wt-1117d` 先例挂 junction（不 install、不 rebuild、不改 ABI，报告注明临时件可删）。
- **禁改区**：`.batch/night/` 下任何文件（本卡不该动协作介质，只改检查器与其测试）；`scripts/ops/` 下 A 卡五件脚本（`make-ledger-v7.mjs`、`fix-ledger-v7.mjs`、`patch-reboot.mjs`、`no-at-count.mjs`、`pointer-metrics.mjs`）。

## 1. 起因

B 卡完成收编后：`--all` 已不再打印「豁免 N 项」，说明 `scripts/ops/hygiene-baseline.txt` 194 条零命中；E 卡 §八 的收缩判据要求「收编完成或条目清零必须删除」，两个条件现已同时成立，baseline 是死数据。同时两处规则与流转件纪律正面相撞（developer 实测 + 我核）：

1. `archive/` 内 42 件历史件尾行缺换行，修它即改历史件字节，与本项目「原样留档、事后哈希对账」冲突；
2. 报告类流转件按群 notice 必须改订另存 `.vN`（如 `CARD-1117-B-report.v2.md`），一落到 `reports/` 就被 `versioned-filename` 规则罚一条，且不允许改名回避。

## 2. 要改成什么（唯一口径）

1. **删除 baseline 机制**：删 `scripts/ops/hygiene-baseline.txt`；从 `scripts/ops/check-batch-hygiene.mjs` 移除 `--baseline`、`--write-baseline`、`DEFAULT_BASELINE`、`BASELINE_COMMAND`、`parseBaseline`／`renderBaseline`／`applyBaseline` 及其调用点；`--all`／`--disk`／`--staged` 均不再打印「豁免 N 项」；用法串与文件头注释同步更新（含 baseline 段整段删除）。
2. **尾行换行规则（`final-newline`）对 `archive/` 整目录豁免**：`archive/` 内历史件原样留档、不参与该规则；`staging/` 仍按现有豁免（版本号规则整目录豁免），尾行规则在 `staging/` 照常检查。
3. **`versioned-filename` 规则改判据**：不再按目录整目录豁免 `reports/`，改为「**同目录主件判据**」——路径含 `.{vN}.` 或结尾 `-vN` 的文件，当且仅当同目录存在去掉该版本段的同名主件时判合规；无主件即报不合规。生效面仍是 `--all`（已跟踪路径）与 `--staged`，`archive/`／`staging/` 整目录豁免保持不变。
4. **测试同步**：删掉 baseline 相关用例（缺头三行、条目数不符、缺失不豁免三类）；新增用例至少四条——①`archive/` 内缺末行换行不报；②`staging/` 内缺末行换行照报；③`reports/X-report.v2.md` 在 `X-report.md` 存在时不报、不存在时报；④无 baseline 参数时 `--all` 正常退出且输出不含「豁免」字样。
5. **`check:fast` 调用点不变**：仍是 `--all`；删 baseline 后 `check:fast` 必须全绿。

## 3. 判定线（判据，逐条可跑）

1. `git rev-parse --short 5413e5a4` 与报告起点一致，`git rev-list --count 5413e5a4..HEAD` ＝ 1（一卡一提交，单亲）。
2. `git show --name-status <sha>` 只含 `scripts/ops/check-batch-hygiene.mjs`、其测试文件、`scripts/check-fast.mjs`（若调用点需同步）与被删的 `scripts/ops/hygiene-baseline.txt`；**不含任何 `.batch/` 路径**（`git show --name-only --pretty=format: <sha> | grep -c '^\.batch/'` ＝ 0）。
3. `grep -c "baseline" scripts/ops/check-batch-hygiene.mjs` ＝ 0（含注释、用法串）；`ls scripts/ops/hygiene-baseline.txt` 报不存在。
4. `node scripts/ops/check-batch-hygiene.mjs --all` `exit 0` 且输出为 `0 项不合规`，**不含「豁免」字样**。
5. `node scripts/ops/check-batch-hygiene.mjs --disk` 的 `archive/` 尾行项为 **0**（此前 42 项），且输出仍写「仅作统计，不作门禁」。
6. 主件判据反证两条都要贴：①在 `wt-1117f` 的 `.batch/night/reports/` 放一份 `CARD-1117-F-report.v2.md`（无对应主件时）`--staged` 报不合规；②同目录补上 `CARD-1117-F-report.md` 后再跑，报合规。两次输出原文入报告；**反证件用完即删，不得入库**。
7. `node scripts/run-tests-electron.mjs scripts/ops/__tests__` 全绿（`pnpm test` 在 junctioned 工作树会触发 pnpm purge，按 A 卡判据 6 的裁定用同一底层入口），贴尾部输出与用例数。
8. `node scripts/check-fast.mjs` `exit 0`，贴「全部通过」行。
9. 报告 `wt-1117f/.batch/night/reports/CARD-1117-F-report.md`：首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`；含开工三项校验、改动逐文件说明、四条新增用例的用例名。

## 4. 红线（任一触发即不通过）

1. 改、删、移 `.batch/night/` 下任何文件（本卡不该碰协作介质）。
2. 改 `scripts/ops/` 下 A 卡五件脚本或 D／E 已定稿的其它脚本（除 `check-batch-hygiene.mjs` 与其测试、`scripts/check-fast.mjs` 的调用点同步）。
3. `git add -A`／`-f`／`--no-verify`／`--force`；在 `develop` 主工作区改码或提交。
4. 为了让判据通过而去改历史件字节、或把 `.vN` 文件改名/移到 `archive/` 回避规则。
5. 新增 baseline 或其它豁免清单文件（本卡方向是删，不是换一种冻结）。

## 5. 交件方式

交件时在群里报：提交 sha 前 8 位、分支、单亲与 `count`＝1、`--all`／`--disk`／测试／`check:fast` 四项的结论行、以及判据 6 两次反证的输出摘要。报告路径一并给出。不 push、不打 tag、不合并。
