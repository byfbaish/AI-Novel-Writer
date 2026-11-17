From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# 派验单：CARD-1117-B（基线收编：首次入库、归档区、baseline 收缩）

执行方：developer
受验对象：卡面 `.batch/night/cards/CARD-1117-B-baseline-intake.md`（**17:1x 已改订三条**：`git mv` 口径作废改磁盘移动＋首次入库；删「R 条数」与 `--follow` 两条判据；新增 baseline 195→194 收缩）
受验版本：developer 报告所指提交（以 `git log` 实读的 sha 前 8 位为准，不采信报告自报）

## 一、必验（缺一条即不通过）

1. 开工三项校验在报告里可见（起点 HEAD 与卡面所述 E 合并后分支头一致、`scripts/ops/hygiene-baseline.txt` 存在、diff 双空）。
2. `.batch/night/archive/` 六类子目录与搬入件清单可读；搬入总数＝报告「移动清单」行数（逐条可对）。
3. 三条 `ls` 为空：`roster/*.v*.md`、`reports/task-ledger.v*.md`、`org/*.v*.md`（`No such file` 亦通过，须附输出）。
4. 首列 `D` 条数＝0，且本提交 `git log --diff-filter=D -1 --name-only` 为空。
5. 现行件三条 `git ls-files` 命中：`roster/identity-roster.md`、`reports/task-ledger.md`、`org/ledger-append-hy4flash-auth.md`（前缀 `.batch/night/`）。
6. 入库件数：贴 `git ls-files .batch/night | wc -l`，≥230 且与移动清单行数一致；`grep -cE '\.db(-wal|-shm)?$|\.voided$'` ＝ 0（`project.db-wal`、`project.db-shm`、`voided` 必须不在提交里）。
7. 引用不断链：`grep -rn "\.v[0-9]\+\.md" .batch/night/{cards,org,reports,review-requests,roster,staging}` 每行有去处（archive 内实际存在或 `git show` 形式），逐条说明。
8. baseline 收缩：`check-batch-hygiene.mjs --all` `exit 0`；`head -3 scripts/ops/hygiene-baseline.txt` 条目数＝194；`--disk` 报 `0 项不合规`。**只减一条**：diff 里该文件只允许删除 `org/ruling-git-workflow-1117.md` 那一行与改头行数字，多减或新增即不通过。
9. 报告含开工前 `??` 基线清单、收编后复核（清单外新增 `??`＝0）、被排除文件清单与理由。
10. `pnpm check:fast` `exit 0`（贴尾部输出）。
11. 提交单亲、信息含 `CARD-1117-B`、无 push／tag／合并。

## 二、红线（任一触发即不通过）

1. `rm`／`git rm` 任何协作件；或为凑「无 D」把件删掉再新增。
2. 在 `develop` 主工作区改码或提交。
3. `git add -A`／`git add -f`／`--no-verify`／`--force`。
4. 改 `.batch/night/` 下协作件的**内容**（只许移动与改指针行）；改 `scripts/ops/*.mjs`（A/D/E 已定稿）。
5. baseline 增条、或一次减多于一条、或手工改条目数而路径数不符。

## 三、判词要求

- 另存 `.batch/night/reports/CARD-1117-B-qa-firstcheck.md`：首行 `执行方：QA`，逐条「命令 → 输出摘要 → 成立/不成立」，末行 `<!-- DONE -->`。
- 只判不修；判据歧义写进判词交我终裁。

## 四、终裁备忘

- 判据 6 的「≥230」是下限：staging 现有 234 件、扣 §2.3 白名单后入库；实际数少于 230 说明有漏收／误排除，须逐条解释。
- 判据 8 的 baseline 只减一条对应卡面 §2.6：收编时补 `org/ruling-git-workflow-1117.md` 尾行空行，随后减该条。若 developer 认为该尾行不该在本卡修，写进判词交我终裁，不得自行增减别的条目。
- 本卡不要求 `git log --follow` 可追前史——首次入库件没有前史，硬造即造假。
