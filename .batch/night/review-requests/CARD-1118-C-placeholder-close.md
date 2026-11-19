状态：待判
持有者：QA · AI writer项目组
可写：否
最后变更：2026-11-19 10:33（项目总负责人 · AI writer项目组）
卡号：CARD-1118-C
依据件：`cards/CARD-1118-C-placeholder-close.md`

# CARD-1118-C 派验单 · 协作件入索引收口（pii-scan 闸门）

派单方：项目总负责人 · AI writer项目组｜派单时刻 2026-11-19 10:33
执行方：developer · AI writer项目组｜性质：安全红线卡（真名不得入库），判据从严

## 一、本卡存在的原因（判词 §一 抄这句）

主人 11-19 定：远端与公开仓只出现 `<用户名>` 占位符，真名一律不入库；**本地工作区保留真名供运行**，两侧 107 处差异是预期；不 checkout origin 覆盖工作区；远端还将再 force 一次，此前不推、不硬合并。本卡只做三件：不切分支、待入库文档件过 pii-scan 后提交、107 处差异归类。

## 二、受理前置（缺一不开判）

1. 报告 `.batch/night/reports/CARD-1118-C-report.md`：首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`。
2. 报告内不出现真名字面量（命令用 `$(whoami)` 或占位符）。
3. 报告给出 pii-scan 的**完整命令原文**与输出（不能只写「已通过」）。

## 三、判据（命令 + 实输出 + exit，缺 exit 即打回）

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 分支未换 | `git rev-parse --abbrev-ref HEAD`；`git rev-parse --short HEAD` | `work/reboot-1118`；HEAD 为原头或本卡一次提交后新头（须前后都贴） |
| 2 | 拓扑未动 | `git rev-parse --short origin/exp/resource-ledger`；`git merge-base HEAD origin/exp/resource-ledger` | `beeedc26`；`fc576e08` |
| 3 | 索引面 PII 清零 | `node <rotation>/pii-scan.mjs --repo . --staged` | 零命中（0 文件 / 0 处），exit 0；贴原始输出 |
| 4 | 提交面真名清零 | `git grep -l -F "C:\\Users\\$(whoami)" HEAD -- . \| wc -l` | `0` |
| 5 | 工作区真名可留 | `git grep -n -F "C:\\Users\\$(whoami)" -- . \| wc -l` | **允许 > 0**，须贴数字并注明「工作区保留真名」，数值下降即为异常（说明误改了运行所需件） |
| 6 | 提交规范 | `git rev-list --count origin/exp/resource-ledger..HEAD`；`git show --name-only --pretty=format: HEAD \| grep -c '^\.batch/'` | 提交数为「原 0 ＋ 本卡 1」；`.batch/` 路径数与报告清单一致 |
| 7 | 差异归类表 | `git diff --name-only HEAD origin/exp/resource-ledger` | 全清单 ＋ 目录归类 ＋ 每类性质（占位符替换／其它）；「其它」须逐条解释 |
| 8 | 未 push | `git status -sb \| head -1`；`git branch -vv \| grep reboot-1118` | 无 `[behind]`；无 `[origin/…]` 上游 |
| 9 | 报告格式 | 见 §二 | 三处逐字一致 |

## 四、红线（触发任一即不通过）

1. `git push`／`--force`／`git rebase`／`git merge`／用 origin `checkout`／`reset --hard` 覆盖工作区。
2. `git add -A`／`git add .`／`-f`。
3. pii-scan 命中非 0 仍提交。
4. 提交面含真名（判据 4 命中）。
5. 改源码、配置、`.gitignore`、notice、两族 `ledger-*`。
6. 删除 `archive/*` 分支或 `.batch/night/archive/` 内任何件。

## 五、判词落点

- 首验判词 `.batch/night/reports/CARD-1118-C-qa-firstcheck.md`，末行 `<!-- DONE -->`，§四 记「按本单判」。
- 判据 3、4 只认计数与 exit，不认说明。
- 打回给最小修法。

## 六、派单方备忘（不作判据）

- 我 10:31 跑 `--staged` 得「1 个文件 / 2 处命中」，均在 `reports/evidence-receipt-side-1116.md:7`；developer 修完重扫应归零。
- 若 developer 发现某待入库件是运行所需（源码/脚本/配置）且含真名，**须把它移出本次提交**并报我，不许改它的真名。
