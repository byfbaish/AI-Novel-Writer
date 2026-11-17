From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# 派验单：CARD-1117-D（机检与 pre-commit）

执行方：developer
受验对象：卡面 `.batch/night/cards/CARD-1117-D-hooks.md`（判件基准，字节冻结）
受验版本：报告 `.batch/night/reports/CARD-1117-D-report.md` 所指提交（以 `git log` 实读 sha 为准）

## 一、必验（缺一条即不通过）

1. `scripts/ops/check-batch-hygiene.mjs` 存在，`--all` 与 `--staged` 两种模式在干净树上 `exit 0`。
2. 三夹具实测（自造）：无末行换行 → `exit 1`；`.v3.md` 文件名 → `exit 1`；`.batch/night/archive/` 下 `.v3.md` → `exit 0`。三条命令与输出在报告里可复现，夹具已清理（`git status` 无残留）。
3. 输出不含「行数」字样；不合规项一行一条，末行汇总。
4. `grep -n "check-batch-hygiene" scripts/install-git-hooks.mjs scripts/check-fast.mjs` 两处均命中；hook 仍保留 `check-fast.mjs` 调用。
5. `pnpm test scripts/ops/__tests__/check-batch-hygiene.test.mjs` 全绿（贴 exit code）。
6. `pnpm check:fast` 在本工作树 `exit 0`（贴尾部输出）。
7. 缺卡号提醒：造 `COMMIT_EDITMSG` 无 `CARD-` 时打印提醒且 `exit 0`（即不阻断）。
8. 提交信息含 `CARD-1117-D`；无 push、无 tag、无合并。

## 二、红线（任一触发即不通过）

1. 在 `develop` 的 `.git` 上跑 `pnpm hooks:install`（会波及他人工作树）。
2. 改动 `.batch/night/` 下任何协作件内容（本卡只加检查）。
3. 使用 `--no-verify`、`git add -A`、`--force`。
4. 机检把「行数相等」重新当判据用。
5. 在 `develop` 主工作区改码或提交。

## 三、判词要求

- 另存 `.batch/night/reports/CARD-1117-D-qa-firstcheck.md`：首行 `执行方：QA`，逐条「命令 → 输出摘要 → 成立/不成立」，末行 `<!-- DONE -->`。
- 只判不修；判据歧义写进判词交我终裁。

## 四、终审（2026-11-17 14:3x，项目总负责人）

首验 PASS（判词 `.batch/night/reports/CARD-1117-D-qa-firstcheck.md`），8 条 7 条完全成立、判据 3 有字面瑕疵。裁定：**改判据文字，不返工、不动脚本**。判据 3 读作「每个不合规项一行；必须有一行 `N 项不合规` 汇总；修法提示行可置于其后」——`check-batch-hygiene.mjs:161` 的修法行印在汇总之后属设计意图（先给结论再给修法），实质满足。

本卡终审：**通过**，提交 `c25fb57b` 为准。合并进主人指定分支须先报主人，未得令不合并不 push。
