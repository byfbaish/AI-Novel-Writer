状态：待判
持有者：QA · AI writer项目组
可写：否
最后变更：2026-11-18 10:38（项目总负责人 · AI writer项目组）
卡号：CARD-1118-B
依据件：`cards/CARD-1118-B-fork-close.md`

# CARD-1118-B 派验单 v2 · 分叉收口（A 方案）＋未跟踪件归位

> v2 只改一处：判据 4 的「前值」口径。v1（3,864B / `ec346c3c…` / 53 行）留档不动、不再采用。
> 起因：QA 10:36 实测 `??`＝100、`wc -l`＝101，与卡面写的 96 不符；差异是本轮新增件（B 卡面、B 派验单、首卡卡面、首验判词）。卡面数字是我写的估计值，不是判据。

派单方：项目总负责人 · AI writer项目组｜派单时刻 2026-11-18 10:32，v2 修订 10:38
执行方：developer · AI writer项目组｜受验对象：developer 本卡交件（提交 + 报告）

## 一、验收前置（缺一不开判）

1. 交件报告路径与提交 sha 在群里给出，报告首行 `执行方：developer`、末行 `<!-- DONE -->`。
2. 报告写明开工时 `git rev-parse --abbrev-ref HEAD` 的值与 `git rev-parse --short` 的 HEAD 提交。
3. 交件内容不含 `ledger-1117-hy4flash-auth*` 与 `ledger-append-1117-hy4flash-auth*` 两族的改动（本卡边界）。

## 二、判据（逐条命令 + 实输出 + exit，缺 exit 即打回）

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 留档分支存在且指向 `1dd9e948` | `git branch --list 'archive/local-rebuilt-1118'`；`git rev-parse --short archive/local-rebuilt-1118` | 恰一条；输出 `1dd9e948` |
| 2 | 基线已换成远端 | `git rev-parse --abbrev-ref HEAD`；`git merge-base HEAD origin/exp/resource-ledger` | `work/reboot-1118`；输出等于 `git rev-parse origin/exp/resource-ledger` |
| 3 | 本卡提交数 | `git rev-list --count origin/exp/resource-ledger..HEAD` | 给出具体数字（可为 0），且与 `git log --oneline` 一致 |
| 4 | 未跟踪件没丢 | 开工前与交件前各跑一次 `git status --porcelain \| grep -c '^??'` 与 `git status --porcelain \| wc -l` | **前值以执行方开工时实测为准**（我 10:37 实测 100／101，卡面原写 96 系估计值，作废）；后值 ≥ 前值，且前值之后新增的件逐条点名（谁在哪一轮加的），不得有「前值之后减少」 |
| 5 | 没把占位符版本带回来 | `git diff --stat HEAD origin/exp/resource-ledger \| tail -1` | `0 files changed` |
| 6 | 占位符清零抽查 | `grep -rn '<用户名>' scripts/ops/ \| wc -l` | `0` |
| 7 | 三类归位清单齐 | 报告内三节：`.batch/night/**`、`.c/`＋`reports/hy4-*`、其余 | 每条路径带处置（入库／留盘／进 BACKLOG）；`.batch/night` 入库件逐条贴 `git add` 原文；`.vN` 同字节重复件单列一节 |
| 8 | 未 push | `git status -sb \| head -1`；`git branch -vv \| grep reboot` | 有 ahead 数、无 `[behind]`；无 `[origin/…]` 上游 |
| 9 | 报告格式 | 首行 `执行方：developer`；第二行 `model= \| 倍率= \| provider=`；末行 `<!-- DONE -->` | 三处逐字一致 |

## 三、红线（触发任一即不通过，不看总分）

1. `git push`／`git push --force`／`git rebase`／`git merge` 无关历史，任一出现即不通过。
2. 用 `git add -A`／`git add .`／`-f` 入库。
3. 删除任何文件或目录（本卡一件都不许删，只许列清单）。
4. 改写远端基线之外的既有提交历史。
5. 修改 `.gitignore`、notice、源码语义，或动两族 `ledger-*` 文件。
6. 把与主件字节相同的 `.vN` 重复件入库。

## 四、判词落点

- 首验判词：`.batch/night/reports/CARD-1118-B-qa-firstcheck.md`，末尾 `<!-- DONE -->`。
- 每条判据写「命令 + 实输出 + exit」三样，不得只写「符合」；打回给最小修法，不替执行方设计改法。

## 五、派单方备忘（不作判据）

- 判据 3 允许为 0（只要基线已换、未跟踪件归位），但必须写数字。
- 判据 5 允许非 0 的唯一情形：占位符已被远端真名取代而产生内容差异——须逐条列出并说明，否则按不通过。
- QA 首验只判本文件 §二/§三，不判本节。
