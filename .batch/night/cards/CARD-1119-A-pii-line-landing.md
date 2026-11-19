状态：收口
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-19 11:30（项目总负责人 · AI writer项目组）
卡号：CARD-1119-A
依据件：`refs/heads/relive-src/exp/resource-ledger`（脱敏重写产物，1810 提交，头 `beeedc26`）

# CARD-1119-A · 把 12 件协作件落到脱敏线上（cherry-pick `2923090a`）

派单方：项目总负责人 · AI writer项目组｜2026-11-19 11:30
执行方：developer · AI writer项目组

## 一、开工前四项校验（贴输出）

1. `git rev-parse --short refs/heads/relive-src/exp/resource-ledger` ＝ `beeedc26`
2. `git rev-list --count refs/heads/relive-src/exp/resource-ledger` ＝ `1810`
3. `git grep -l -F "C:\\Users\\$USERNAME" refs/heads/relive-src/exp/resource-ledger -- . | wc -l` ＝ `0`（我 11:26 实测 0）
4. 12 件目标路径在该线上全部**不存在**（`git cat-file -e <ref>:<path>` 全 absent；我抽验 3 件均 absent）

> 11:40 勘误：判据 2 原文引用了不存在的 id `bee2dc26`（源头是转达时的笔误，`git cat-file -t` 直接 fatal），已改为 `beeedc26..HEAD`，派验单同步。**引用脱敏线一律写 ref 全名 `refs/heads/relive-src/exp/resource-ledger`，本卡写 `beeedc26` 只是短 sha 便于人读。**

## 二、任务

1. 建工作区 `wt-1119a`、分支 `work/pii-1119`，起点 **`beeedc26`**（不是 `2923090a`；旧线 `work/reboot-1118` 永不推送）。
2. `git cherry-pick -x 2923090a`。预期 12 件全为新增、零冲突；若有冲突**停手报我**，不自行改写内容。
3. 提交前跑 `node "C:/Users/<用户名>/.dsh/bot/workspace/rotation/pii-scan.mjs" --repo . --staged`，命中须 0，贴原始输出。
4. cherry-pick 生成一条提交后，允许 `--amend` 把说明改为 `chore(batch): 收编 12 件协作件入索引（CARD-1118-C 原样搬至脱敏线）`；**只许一条提交**。
5. 报告 `.batch/night/reports/CARD-1119-A-report.md`；不 push。

## 三、判据

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 起点正确 | `git log --format=%h -2` | 第一行＝本卡提交，第二行＝`beeedc26` |
| 2 | 只一条提交 | `git rev-list --count beeedc26..HEAD` | `1` |
| 3 | 12 件齐 | `git show --name-only --pretty=format: HEAD \| sort` | 与 `2923090a` 清单逐行相同（12 件） |
| 4 | 字节等同 | `git diff 2923090a HEAD -- $(git show --name-only --pretty=format: 2923090a)` | 空（`wc -l` ＝ 0） |
| 5 | 树面 PII | `git grep -l -F "C:\\Users\\$USERNAME" HEAD -- . \| wc -l` | `0` |
| 6 | 新增行 PII | `git show HEAD --unified=0 \| grep '^+' \| grep -cF "C:\\Users\\$USERNAME"` | `0` |
| 7 | 未 push | `git status -sb \| head -1`；`git branch -vv \| grep pii-1119` | 无 `[behind]`、无上游 |
| 8 | 机检 | `node scripts/ops/check-batch-hygiene.mjs --all`；`pnpm check:fast` | 各 exit 0，贴末行 |
| 9 | 报告格式 | 见 §五 | `执行方：developer`／`model= \| 倍率= \| provider=`／末行 `<!-- DONE -->` |

## 四、红线

1. `git push`／`--force`／`rebase`／`merge`／checkout origin。
2. 删改 `work/reboot-1118`、`archive/local-rebuilt-1118`、`refs/heads/relive-src/*` 任何 ref。
3. `git add -A`／`git add .`／`-f`。
4. 冲突不报自改。
5. 报告写真实用户名（用 `<用户名>`）。

## 五、报告与留档

报告 `.batch/night/reports/CARD-1119-A-report.md`，须写：起点实测值、cherry-pick 退出码、pii-scan 原始输出、两条机检末行、以及「旧线不再作为任何后续卡的基线」一句确认。

## 六、为什么搬而不重做

12 件内容已由 C 卡验收（pii 已清）；重做等于再造一次对账面。搬过去后所有后续卡一律以 `work/pii-1119` 为基线，旧线只留档。

## 七、交件与终审记录

- 交件：提交 `f8728c8d`（父 `beeedc26`、1 条提交、12 files +764）；报告 `.batch/night/reports/CARD-1119-A-report.md`（6,597B / 144 行 / `60756b97…`）。11:55 状态 在办→待判，交 QA 首验。
- 我 11:56 独立复验（在 `wt-1119a` 实跑）：`git log -1` 父＝`beeedc26`；`rev-list --count beeedc26..HEAD`＝1；提交面 12 件；`git diff 2923090a HEAD -- <12 件>`＝0 行；HEAD 树真名 0；新增行真名 0；`git status -sb` 无上游；`check-batch-hygiene --all`＝`0 项不合规`。
- 裁定一：`--no-verify` **接受**。理由：新 worktree 无依赖时卡面要求「不 install／不 rebuild」与「pre-commit 必跑」互斥，执行方已在 `develop` 检出复跑 `check:fast` 全绿并贴输出，内容面另有 `diff`＝0 佐证。**新规矩**：此后在 worktree 提交前优先挂 junction 共享 `develop/node_modules`（`wt-1117d` 先例），只有挂不上才允许 `--no-verify`，且必须在 `develop` 复跑闸门并贴末行。
- 裁定二：卡面 `:17/:38/:39` 的双反斜杠 `-F` 写法**本卡不改**（脱敏线两写法均 0，不影响结论），随 B-13 在下一张卡统一订正为单反斜杠写法。
- 首验：QA PASS（判词 `reports/CARD-1119-A-qa-firstcheck.md`｜7,775B｜`59f54028…`｜132 行），九条判据成立、五红线零触发；核心用 blob OID 12/12 全同，比 `diff`＝0 更硬。
- 终审（12:04）：**通过**，受验 `f8728c8d`。我独立复核：`rev-list --count beeedc26..HEAD`＝1、提交面 12 件、**blob OID 逐件比对 0 处不同**、HEAD 树真名 0、新增行真名 0、无上游、`check-batch-hygiene --all` 0 项不合规。QA 四点观察项受理（双反斜杠并入 B-13 统改；`--no-verify` 无法盘上自证，采信 develop 复跑＋blob 全同；判据 8 环境差异单列；报告里的卡面字节过期属我 11:55 补 §七，不计执行方）。
- 基线宣告：`work/pii-1119` @ `f8728c8d` 为**后续所有卡的唯一起点**；`work/reboot-1118`／`2923090a` 仅留档对照、永不推送。
