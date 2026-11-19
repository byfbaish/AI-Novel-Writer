状态：放行
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-18 11:23（项目总负责人 · AI writer项目组）
卡号：CARD-1118-B
依据件：`cards/CARD-1118-B-fork-close.md`

# CARD-1118-B 派验单 v4 · 分叉收口（A 方案）＋未跟踪件归位

> v4 相对 v3 改三处、加一节：判据 3（明确本卡 0 提交）、判据 4（计数口径改成「总数不减 + 逐件在 `??`/`A ` 中」）、新增 §六 裁定（81 件 `.vN` 与其余 3 件的处置）。
> v1（3,864B／`ec346c3c…`／53 行）、v2（4,141B／`e4b62d7d…`／54 行）、v3（4,446B／`348076af…`／55 行）留档不采用。
> 起因：developer 10:44 报「判据 3 与判据 5 互斥」「81 件 `.vN` 处置两条路」；已裁，见 §六。

派单方：项目总负责人 · AI writer项目组｜派单时刻 2026-11-18 10:32，v4 10:47
执行方：developer · AI writer项目组｜受验对象：developer 本卡交件（分支拓扑 + 索引 + 报告）

## 一、验收前置（缺一不开判）

1. 交件报告路径在群里给出，报告首行 `执行方：developer`、末行 `<!-- DONE -->`。
2. 报告写明切分支是谁做的、开工时 HEAD 与 `??` 计数（developer 10:44 已给出，可引用）。
3. 交件内容不含 `ledger-1117-hy4flash-auth*` 与 `ledger-append-1117-hy4flash-auth*` 两族的改动（本卡边界）。

## 二、判据（逐条命令 + 实输出 + exit，缺 exit 即打回）

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 留档分支存在且指向 `1dd9e948` | `git branch --list 'archive/local-rebuilt-1118'`；`git rev-parse --short archive/local-rebuilt-1118` | 恰一条；输出 `1dd9e948` |
| 2 | 基线已换成远端 | `git rev-parse --abbrev-ref HEAD`；`git merge-base HEAD origin/exp/resource-ledger` | `work/reboot-1118`；输出等于 `git rev-parse origin/exp/resource-ledger` |
| 3 | **本卡不落提交** | `git rev-list --count origin/exp/resource-ledger..HEAD` | **必须为 `0`**（本卡只做拓扑切换与索引暂存；提交与收编留给后续收编卡） |
| 4 | 未跟踪件没丢 | 开工前与交件前各跑 `git status --porcelain \| wc -l` 与 `git status --porcelain \| grep -c '^??'` | 前值＝developer 10:34 实测 101／100（卡面原写 96 系估计值，作废）；**后值总数 ≥ 101**，且前值那 100 件在后值里要么是 `??` 要么是 `A `（暂存），**一件不许消失**；点名暂存但原为 `??` 的件即可，不计扣分 |
| 5 | 没把占位符版本带回来 | `git diff --quiet HEAD origin/exp/resource-ledger; echo "exit=$?"` | `exit=0`（零差异时 `--stat` 输出为空，无 `0 files changed` 行，此非失败）；非 0 时才要求逐条解释 |
| 6 | 占位符清零抽查 | `grep -rn '<用户名>' scripts/ops/ \| wc -l` | `0` |
| 7 | 三类归位清单齐 | 报告内三节：`.batch/night/**`、`.c/`＋`reports/hy4-*`、其余 | 每条路径带处置（入库／留盘／进 BACKLOG／进 archive）；`.batch/night` 入库件逐条贴 `git add` 原文；`.vN` 按 §六.1 分两类单列 |
| 8 | 未 push | `git status -sb \| head -1`；`git branch -vv \| grep reboot` | 无 `[behind]`、无 `[origin/…]` 上游即成立（无上游时首行只打 `## work/reboot-1118`，不要求出现 ahead） |
| 9 | 报告格式 | 首行 `执行方：developer`；第二行 `model= \| 倍率= \| provider=`；末行 `<!-- DONE -->` | 三处逐字一致 |

## 三、红线（触发任一即不通过，不看总分）

1. `git push`／`git push --force`／`git rebase`／`git merge` 无关历史。
2. 用 `git add -A`／`git add .`／`-f` 入库。
3. 删除任何文件或目录（本卡一件都不许删，只许列清单）。
4. **产生提交**（`git commit`／`--amend` 任一；本卡 0 提交）。
5. 修改 `.gitignore`、notice、源码语义，或动两族 `ledger-*` 文件。
6. 把与主件字节相同的 `.vN` 重复件入库。

## 四、判词落点

- 首验判词：`.batch/night/reports/CARD-1118-B-qa-firstcheck.md`，末尾 `<!-- DONE -->`。
- 每条判据写「命令 + 实输出 + exit」三样，不得只写「符合」；打回给最小修法。
- 判词 §四 记一句「按 v4 判」。

## 五、派单方备忘（不作判据）

- 判据 5 允许非 0 的唯一情形：占位符已被远端真名取代而产生内容差异——须逐条列出并说明，否则按不通过。
- QA 首验只判本文件 §二/§三，不判本节。

## 六、裁定（2026-11-18 10:47，项目总负责人）

### 6.1 81 件 `*.vN` 的处置（developer 10:44 报，两条路我裁为一条二分）

按「与主件是否同字节」二分，**不看目录**：

- **（a）与同目录主件字节相同** ⇒ **不入库、不删、留盘**，进 `archive/` 待去重清单（`archive/` 在 `.gitignore:93` 下，等于不入库但保留字节）；须逐件贴 `md5sum` 两行证明字节相同。已确认 2 件：`org/ledger-append-1117-hy4flash-auth.v7.md`、`staging/rules-review-docs-1116.v2.md`。
- **（b）内容与主件不同（真历史版本）** ⇒ **不入库、留盘原地**，路径写进报告清单 + BACKLOG 一条（卡号引用本卡），不动字节、不改名。理由：远端基线 `cards/`／`reports/`／`review-requests/` 里一条版本件都没有，本地把 81 件塞进入库会立刻让 `batch-hygiene` 的版本件规则与「同目录有主件才合规」打架，且这批件的用处是**对账**不是**分发**——对账要的是字节在原地，不是进树。

**唯一例外**：某 `.vN` 是某主件的**唯一现存副本**（主件缺失）⇒ 先报我，我逐个裁，不许自己改名顶替主件。

### 6.2 其余 3 件

- `.gitignore.bak-20261117-gitwhitelist`（1,871B）⇒ 留盘不入库，按 B-1e 补首行说明（谁建/何时/用途/保留期/过期给谁）；无说明则进 BACKLOG 待认领。
- `.c/develop/…/message-admission.v1.md`（路径转义误建的影子件）⇒ **留盘不动、不入库、不删**，列清单报我，由我决定归 archive 还是进待认领。
- `scripts/workbuddy/space-readonly-check.mjs` ⇒ 已登记 BACKLOG B-8；本卡：若有用途注释则补保留期与过期归属后**入库**，补不出则留盘待认领。

### 6.3 已暂存 12 件的效力

developer 10:44 报的 12 件（cards 2、reports 3、review-requests 2、staging 2 个 `.sh`、reports 3 件说明件）**暂存有效、按 §六.1 复核一遍**：其中若含（a）类同字节件，须 `git restore --staged` 退回 `??`；其余保留暂存。
