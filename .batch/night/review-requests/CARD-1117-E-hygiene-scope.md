From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# 派验单：CARD-1117-E（集成验收：机检生效面与历史件豁免）

执行方：developer
受验对象：卡面 `.batch/night/cards/CARD-1117-E-hygiene-scope.md`
受验版本：developer 报告所指提交（以 `git log` 实读的 sha 前 8 位为准，不采信报告自报）

## 一、必验（缺一条即不通过）

1. 开工三项校验在报告里可见（HEAD＝`7182062d`、`check-batch-hygiene.mjs` 存在、diff 双空）。
2. `node scripts/ops/check-batch-hygiene.mjs --all` 在提交后 `exit 0`，并贴尾部输出；同时核 `--all` 的扫描面确实是 `git ls-files`（读源码或加一条反证：新建未跟踪的 `.v2` 文件后 `--all` 仍 exit 0）。
3. `--disk` 仍报 236 项、`exit 1`，首行含「仅作统计，不作门禁」：证明历史件没被掩盖、只是不进主门禁。
4. baseline：`--baseline` 命中且未改动的路径被跳过；同一路径进入变更集后照常报红；baseline 文件缺失时不豁免。三条都要有可复现命令与输出。
5. A 卡判据重跑（范围收窄到五件产出脚本）零命中；全目录 grep 的现有点逐条标「注释／传递文本」，只判该命中是否为 pass 判定分支。
6. 单测全绿（贴 exit code），且新增 baseline 三例 + 扫描面差异用例确实存在（读测试文件核，不只看通过数）。
7. `pnpm check:fast` `exit 0`，贴尾部输出——本卡目的就是这行变绿。
8. 提交单亲 `7182062d`、信息含 `CARD-1117-E`、无 `.batch/` 路径、无 push／tag／合并。

## 二、红线（任一触发即不通过）

1. 改名／删／移 `.batch/night/` 下历史件。
2. 在 `develop` 主工作区改码或提交。
3. `git add -A`／`git add -f`／`--no-verify`／`--force`。
4. 改 `.batch/night/` 协作件内容。
5. 门禁被放宽成「全部豁免」：baseline 未命中路径必须照常报红。

## 三、判词要求

- 另存 `.batch/night/reports/CARD-1117-E-qa-firstcheck.md`：首行 `执行方：QA`，逐条「命令 → 输出摘要 → 成立/不成立」，末行 `<!-- DONE -->`。
- 只判不修；判据歧义写进判词交我终裁。

## 四、终裁备忘（避免重复上一轮的歧义）

- 判据 2 与 3 是成对的反证关系：`--all` 绿、`--disk` 红，两者必须同时成立，只绿不红说明门禁被放水。
- 判据 5 的「范围收窄」是 16:14 我的裁定：A 卡判据约束的是它自己的五件产出脚本，不是整个 `scripts/ops/` 目录。
- 16:5x 补裁（developer 交件时问的两件）：
  1. 第 4 个改动文件 `scripts/ops/__tests__/ops-scripts.test.mjs` **算在卡内**，不记超卡——它就是 16:14 裁定（守卫范围收窄）的落地，卡面「只动检查器与其测试」应读作含 A 卡那条源码守卫的测试。
  2. baseline 里唯一一条已跟踪不合规件（`.batch/night/org/ruling-git-workflow-1117.md`，末行空行）**本卡不改**，基线保持 195 条。已定稿裁定件不动字节；待 B 卡收编时对 `org/` 已入库协作件统一做一次尾行规范化提交，再把该条从基线减去（基线只减不增，正合卡面 §八 ②）。QA 判据 4 不得以「基线里含已跟踪件」判不成立。

## 五、终审（2026-11-17 17:1x，项目总负责人）

首验 PASS，8 条必验全成立、5 条红线零触发（判词 `.batch/night/reports/CARD-1117-E-qa-firstcheck.md`）。

- 判据 2 的写法歧义按 QA 口径结案：取证面＝「E 提交 `9575abaa` 在位」，合并在位前复跑看到 1 项红属预期，不算不成立。
- 写法改进采纳：此后集成卡判据统一写成「在 `<待合并分支> + 本卡提交` 上」，不再写「合并后分支」。
- forge 反证（`--disk --write-baseline` 产物与提交版逐字节相同）是本卡最有价值的一条证据，记入台账口径：baseline 可复现即可信。

本卡终审：**通过**，提交 `9575abaa` 为准。下一步：合进 `card/git-track-ops-1117` 后在该分支头复跑 `check:fast`，绿即视为集成红已解，再向主人请示落主线。
