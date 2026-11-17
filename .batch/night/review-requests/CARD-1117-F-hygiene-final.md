状态：放行
持有者：QA · AI writer项目组
可写：否
最后变更：2026-11-17 19:49（项目总负责人 · AI writer项目组）
卡号：CARD-1117-F
依据件：review-requests/CARD-1117-F-hygiene-final.md

From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# 派验单：CARD-1117-F（机检收尾：删 baseline、archive 尾行豁免、版本号文件名改判据）

执行方：developer
受验对象：卡面 `.batch/night/cards/CARD-1117-F-hygiene-final.md`
起点：`5413e5a4`（集成分支头）
受验版本：developer 报告的提交 sha（以 `git log` 实读前 8 位为准，不采信报告自报）

## 一、必验（缺一条即不通过）

1. 开工三项校验在报告可见：HEAD＝起点、`scripts/ops/check-batch-hygiene.mjs` 存在、diff 双空（R4 口径）。
2. 提交单亲、`git rev-list --count 5413e5a4..<sha>` ＝ 1、信息含 `CARD-1117-F`、无 push／tag／合并。
3. `git show --name-status <sha>` 逐件列出；本卡允许改的只有 `scripts/ops/check-batch-hygiene.mjs`、其测试（`scripts/ops/__tests__/` 下）、`scripts/check-fast.mjs`（调用点需要时），加上被删的 `scripts/ops/hygiene-baseline.txt`。多一件要 developer 解释、你判是否超卡。
4. `git show --name-only --pretty=format: <sha> | grep -c '^\.batch/'` ＝ **0**（本卡不碰协作介质）。
5. `grep -c "baseline" scripts/ops/check-batch-hygiene.mjs` ＝ **0**（含注释与用法串）；`ls scripts/ops/hygiene-baseline.txt` 不存在。
6. `node scripts/ops/check-batch-hygiene.mjs --all` `exit 0`、输出 `0 项不合规`、**不含「豁免」字样**（删 baseline 的直接反证）。
7. `node scripts/ops/check-batch-hygiene.mjs --disk`：`archive/` 尾行项 **0**（此前 42 项）；输出仍含「仅作统计，不作门禁」。
8. 主件判据两条反证都在报告里（你自己复跑一次更好）：无主件时 `.vN` 报不合规、有主件时报合规；**反证件不得留在提交里**（查 `<sha>` 的 name-status 里没有 `*.v2.md` 之类的测试残留）。
9. `node scripts/run-tests-electron.mjs scripts/ops/__tests__` 全绿，贴尾部与用例数；baseline 三个旧用例已删、四个新用例在列（archive 尾行豁免／staging 尾行照报／主件存在与否／无 baseline 参数）。
10. `node scripts/check-fast.mjs` `exit 0`，贴「全部通过」行。
11. 报告首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`。

## 二、红线（任一触发即不通过）

1. 改、删、移 `.batch/night/` 下任何文件。
2. 改 `scripts/ops/` 下 A 卡五件脚本或 D／E 已定稿脚本（本卡白名单外的）。
3. `git add -A`／`-f`／`--no-verify`／`--force`；在 `develop` 主工作区改码或提交。
4. 为过判据去改历史件字节，或把 `.vN` 件改名／搬进 `archive/` 回避规则。
5. 新增任何 baseline／豁免清单文件（方向是删，不是换一种冻结）。

## 三、判词要求

- 另存 `.batch/night/reports/CARD-1117-F-qa-firstcheck.md`：首行 `执行方：QA`，逐条「命令 → 输出摘要 → 成立/不成立」，末行 `<!-- DONE -->`。
- 只判不修；判据歧义写进判词交我终裁。

## 四、终裁备忘（我先给口径，减少来回）

- **判据 5 的 `grep -c` 是零容忍**：本卡方向是删机制，留注释说明「已删」也算残留——要说明靠提交信息与卡面，不靠源码注释。
- **判据 7 的 archive 尾行豁免**只针对 `final-newline`；`versioned-filename` 在 `archive/` 与 `staging/` 的整目录豁免是既有行为，不许借此放宽别的规则。
- **主件判据的边界**：`reports/X.v2.md` 与 `reports/X.md` 配对成立；`reports/X-a.v2.md` 与 `reports/X-b.md` 不成立（版本段前的名字必须逐字相同）。缺主件即不合规，不做模糊匹配。
- 本卡不改流转件版本纪律（群 notice 硬规则），只让机检认它——若 developer 认为某条实现不了，写进报告交我终裁，不许自行改纪律。
