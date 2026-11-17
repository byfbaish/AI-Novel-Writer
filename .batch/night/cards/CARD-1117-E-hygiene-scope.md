# 卡面：CARD-1117-E 集成验收——机检生效面与历史件豁免

- 卡号：CARD-1117-E
- 派单方：项目总负责人 · AI writer项目组
- 执行方：developer
- 分支：`card/1117-E-hygiene-scope`（起点 `7182062d`，即当前 `card/git-track-ops-1117` 头）
- 工作目录：新建 worktree；不得在 `develop` 主工作区改码

## 一、背景（大肥鱼 16:0x ALERT）

A、D 单独验收通过，合进 `card/git-track-ops-1117`（`0609a4a8`、`4a530d73`）后 `check:fast` 红两处：

1. `check-batch-hygiene --all` 报 236 项不合规，全部落在 `.batch/` 内未跟踪的历史件（带 `.vN` 文件名、缺末行换行）。`--all` 是遍历磁盘（`walkWorkTree`），历史件本身就是要保留原名的归档物，不是违规新件。
2. A 卡判据「`grep -rn "wc -l\|awk NR" scripts/ops/*.mjs` 不进 pass 判定分支」在重验时命中 D 新增的 `scripts/ops/check-batch-hygiene.mjs:6`——那是一行**注释**，解释为什么末行换行会让 `wc -l` 与 `awk NR` 恒差 1，不是判定分支。

## 二、本卡裁定（不采「返工」口径）

- **红 2 不修代码**：判据是对被验对象（A 卡五件产出脚本）的约束，不是对 `scripts/ops/` 整个目录的永久不变量。重验时把 A 判据 2/3 的 grep 范围限定为那五件脚本，即可结案。
- **红 1 修检查器**：机检生效面改为「git 已跟踪的路径 + 本次变更」，磁盘遍历降为显式模式；并为「收编历史件」（B 卡）预置一次性基线豁免，避免收编把 236 项历史件一次性变成红。

## 三、要做的改动（只动检查器与其测试）

1. `scripts/ops/check-batch-hygiene.mjs`：
   - `--all`：扫描面改为 `git ls-files -z -- .batch/night`（已跟踪路径），不再遍历磁盘；
   - 新增 `--disk`：显式遍历工作树全量（统计用），输出首行写明「磁盘模式：含未跟踪历史件，仅作统计，不作门禁」；
   - 新增 `--baseline <path>`：默认 `scripts/ops/hygiene-baseline.txt`（文件不存在＝无豁免）；文件每行一个仓库相对路径，`#` 起注释、空行忽略；**豁免只对「该路径在本次提交的变更集里不出现」时生效**——历史件不动不罚，一旦被改动（含改名）照常按新规则检查；
   - 新增 `--write-baseline`：配合 `--disk` 输出当前不合规路径清单到 baseline 文件（内容含生成时的提交 sha 头注释），供 B 卡收编时一次性冻结；
   - 退出码语义不变：有不合规且未被豁免 ⇒ `exit 1`；缺卡号仍只提醒 `exit 0`。
2. `scripts/ops/__tests__/check-batch-hygiene.test.mjs`：补 baseline 三例（豁免生效 / 改动后在变更集中不豁免 / baseline 文件缺失不豁免）与 `--disk`/`--all` 扫描面差异各一例。
3. `scripts/check-fast.mjs` 的调用保持不变（仍 `--all`），不新增门禁强度。

## 四、开工前三项校验（缺一项不许开工）

1. `git -C <worktree> rev-parse --short HEAD` ＝ `7182062d`；
2. `ls scripts/ops/check-batch-hygiene.mjs` 存在；
3. `git -C <worktree> diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均为空（R4 口径）。

## 五、必验判据（缺一条即不通过）

1. 上述三项校验的输出在报告里可见。
2. `node scripts/ops/check-batch-hygiene.mjs --all` 在合并后分支上 `exit 0`（贴完整尾部输出）。
3. `node scripts/ops/check-batch-hygiene.mjs --disk` 仍报 236 项、`exit 1`，且首行有「仅作统计，不作门禁」字样（证明历史件未被掩盖，只是不进主扫描面）。
4. baseline 机制：`--baseline` 指向的清单内路径在未改动时被跳过；同一路径出现在变更集时照常报红。三条命令与输出可复现。
5. A 卡判据重跑（范围收窄）：`grep -rn "wc -l\|awk NR" scripts/ops/{make-ledger-v7,fix-ledger-v7,patch-reboot,no-at-count,pointer-metrics}.mjs` 零命中；`grep -rn "wc -l\|awk NR" scripts/ops/*.mjs` 现有命中逐条标「注释/传递文本」并说明不影响判定。
6. 单测全绿（`node scripts/run-tests-electron.mjs scripts/ops/__tests__`，贴 exit code）。
7. `pnpm check:fast` `exit 0`（贴尾部输出）——这是本卡的核心目的。
8. 提交信息含 `CARD-1117-E`；单亲 `7182062d`；无 push、无 tag、无合并。

## 六、红线（任一触发即不通过）

1. 改名、删除、移动 `.batch/night/` 下任何历史件（收编是 B 卡的活）。
2. 在 `develop` 主工作区改码或提交。
3. 用 `git add -A`、`git add -f`、`--no-verify`、`--force`。
4. 直接修改 `.batch/night/org/BACKLOG.md` 或其它协作件内容（只读引用）。
5. 把门禁放宽成「全部豁免」：baseline 未命中路径必须照常报红。

## 七、报告

`.batch/night/reports/CARD-1117-E-report.md`（不提交）：首行 `执行方：developer`，第二行 `model= | 倍率= | provider=`，逐条判据给命令与输出摘要，末行 `<!-- DONE -->`。

## 八、baseline 的失效与治理（16:2x 增补，大肥鱼提三条，我采纳并落定）

baseline 不是「豁免声明」，是**冻结的历史条目清单**，因此必须自带失效条件，否则它会变成没人敢删的长期豁免：

1. **内容形态**：文件头三行必写 `# 条目数：<N>`、`# 生成 SHA：<commit>`、`# 生成命令：node scripts/ops/check-batch-hygiene.mjs --disk --write-baseline`，其后每行一条仓库相对路径；无这三行视为 baseline 无效（检查器应报错退出，不静默降级为「无豁免」）。
2. **收缩判据**：出现下列任一情形，baseline 必须删除，且删除前**不得再增长**（只能减、不能增）：① `.batch/night/` 历史件收编完成（B 卡交付并验收）；② baseline 内条目全部消失（路径被改名或删除后条目清零）。本条只约束内容增减，不适用「流转件另存 .vN」纪律——baseline 是工具数据，不是流转件，原地修改即为正确形态（改动须单独提交并贴 diff）。
3. **写入权限**：增改 baseline 只由项目总负责人一人定夺。developer 本卡仅允许 `--write-baseline` **生成一次**，并在报告里贴出该文件的完整 diff（条目数 ＋ 逐行路径），此后任何增删须先报我。
4. **红线补充**（并入 §六）：`forge` 式改 baseline——在报告里声称生成、实际手工增删路径、或绕过 `--write-baseline` 直接写文件——同属不通过。
