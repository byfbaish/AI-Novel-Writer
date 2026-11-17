From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# 派验单：CARD-1117-A（产出脚本去三元组、机检去行数）

执行方：developer
受验对象：卡面 `.batch/night/cards/CARD-1117-A-de-triplet.md`（**14:1x 已改订**：迁移改新增件入库、判据 4/5 换写，判件以本单下列条目为准）
受验版本：developer 报告 `.batch/night/reports/CARD-1117-A-report.md` 所指提交（以 `git log` 实读的 sha 前 8 位为准，不采信报告自报）

## 一、必验（缺一条即不通过）

1. `git ls-files 'scripts/ops/*'` 非空，含 `make-ledger-v7.mjs`、`fix-ledger-v7.mjs`、`patch-reboot.mjs`、`pointer-metrics.mjs`、`no-at-count.mjs`（`no-at-count` 三版只留一支；staging 下 v2/v3 原件未搬属正常，归 B 卡）。
2. `grep -rn "md5\|MD5\|sha256\|行数" scripts/ops/*.mjs`：逐条判定「写入产物正文」还是「引用/注释」，前者不许。
3. `grep -rn "wc -l\|awk NR" scripts/ops/*.mjs` 不出现在 pass 判定分支（附行号）。
4. 本卡提交不含任何 `.batch/` 路径：`git show --name-only --pretty=format: <sha> | grep -c '^\.batch/'` ＝ `0`（staging 原件不动是本卡要求，不是遗漏）。
5. 报告写明「七件原为未跟踪件、无迁移历史」，并附当场 `git ls-files .batch/night/staging` 为空的输出；不要求 `git log --follow`。
6. `pnpm test scripts/ops/__tests__` 全绿（贴 exit code）。**14:4x 终裁**：junctioned 工作树里 `pnpm test` 会触发 pnpm 依赖检查要求 purge 共享 `node_modules`（`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`），卡面又禁 install；`package.json:26` 的 `test` 本体就是 `node scripts/run-tests-electron.mjs`，故 `node scripts/run-tests-electron.mjs scripts/ops/__tests__` 视为等价，判据成立条件为：贴该命令 exit code ＋ 贴 `package.json:26` 原文作等价证据。不得据命令字面不同打回。
7. `pnpm check:fast` 全绿（贴 exit code）。
8. 提交信息含 `CARD-1117-A`；`git log origin/exp/resource-ledger..HEAD` 无 push 痕迹；无 tag。

## 二、红线（任一触发即不通过，且整卡退回）

1. 改动 `scripts/workbuddy/model-policy.mjs` 或其测试。
2. 动 `.batch/night/{org,reports,roster}/` 下的内容文件（B 卡范围）。
3. 用 `git add -A` 或 `git add -f`；用 `--no-verify`；`--force`。
4. 报告里报字节／md5／行数当交付凭证（裁定 §二·3 已废止）。
5. 在 `develop` 主工作区改码或提交。
6. 改、删、移 `.batch/night/staging/` 下任何文件（整目录归 B 卡，本卡只读）。

## 三、判词要求

- 另存 `.batch/night/reports/CARD-1117-A-qa-firstcheck.md`：首行 `执行方：QA`，逐条给「命令 → 输出摘要 → 成立/不成立」，末行 `<!-- DONE -->`。
- 只判不修。发现判据本身有歧义，写进判词「判据歧义」段交我终裁，不自行改卡面。

## 四、终审（2026-11-17 14:5x，项目总负责人）

首验 PASS，8 条全部成立、6 条红线无触发（判词 `.batch/night/reports/CARD-1117-A-qa-firstcheck.md`）。判据 6 按 14:4x 终裁（等价底层入口）判成立，不返工；三处偏差（`package.json:26` 内联引、小节编号错位、`:6` 措辞）记瑕疵不返工。

本卡终审：**通过**，提交 `7de913f6` 为准。合并进主线须先报主人（已投 to-owner 请示），未得令不合并、不 push。
