状态：放行
持有者：QA · AI writer项目组
可写：否
最后变更：2026-11-19 11:20（项目总负责人 · AI writer项目组｜v3 只纠数字，判据不变）
卡号：CARD-1118-C
依据件：`cards/CARD-1118-C-placeholder-close.md`

# CARD-1118-C 派验单 v2 · 协作件入索引收口（pii-scan 闸门）

> v3 只把「115」纠成「119」（107 占位符 ＋ 12 远端无此件），判据一条未改；对应 QA 首验判词 §五①的算式错。
> v2 改了两处判据文字（判据 4、判据 6）并订正判据 4 命令写法；v1（3,825B / `94ae60f5…` / 55 行）留档不采用。
> 起因：developer 报「判据 4 要 HEAD 树真名 0，但基线树就有 93 件、本卡新增 0」「判据 6 的 `origin..HEAD` 恒为 1577（远端 force 后两侧历史不对应）」——**都是我出卡的错，不是执行方的缺陷，不返工**。

派单方：项目总负责人 · AI writer项目组｜派单时刻 2026-11-19 10:33，v2 11:00
执行方：developer · AI writer项目组｜受验：提交 `2923090a` ＋ 报告 `.batch/night/reports/CARD-1118-C-report.md`（15,629B / 317 行 / `462f3c9a…`）

## 一、本卡存在的原因

主人 11-19 定：远端与公开仓只出现 `<用户名>` 占位符，真名一律不入库；**本地工作区保留真名供运行**；不 checkout origin 覆盖工作区；远端还将再 force 一次，此前不推、不硬合并。

## 二、受理前置

1. 报告三处格式齐（`执行方：developer` / `model= | 倍率= | provider=` / `<!-- DONE -->`）。
2. 报告内不出现真名字面量，命令用 `$USERNAME` 或占位符。
3. 报告贴 pii-scan 完整命令与输出。

## 三、判据（命令 + 实输出 + exit）

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 分支未换 | `git rev-parse --abbrev-ref HEAD`；`git rev-parse --short HEAD` | `work/reboot-1118`；`2923090a` |
| 2 | 拓扑未动 | `git rev-parse --short origin/exp/resource-ledger`；`git merge-base HEAD origin/exp/resource-ledger` | `ab0ff804`；`fc576e08` |
| 3 | 索引面 PII 清零 | `node "<rotation>/pii-scan.mjs" --repo . --staged` | 零命中（0 文件 / 0 处），exit 0，贴原始输出 |
| 4 | **本卡新增行真名＝0** | `git show 2923090a --unified=0 \| grep '^+' \| grep -cF "C:\\Users\\<用户名>"`（单反斜杠，我 10:58 实测该写法正确） | `0`。**不再要求 HEAD 树真名 0**——基线树存量 93 件来自本地旧历史，与远端安全版并存，另立卡处理（见 §六） |
| 5 | 工作区真名可留 | `git grep -n -F "C:\\Users\\<用户名>" -- . \| wc -l` | **允许 > 0**（运行所需）；developer 报 204 行 / 93 文件，与「未动工作区」一致 |
| 6 | **本卡自身提交＝1** | `git log --oneline --no-merges 27971070..HEAD \| wc -l`；`git show --name-only --pretty=format: 2923090a \| grep -c '^\.batch/'` | `1`；`.batch/` 命中 `9` 且与报告清单一致。**不再用 `origin..HEAD` 计数**（远端 force 后两侧历史不对应，恒 1577） |
| 7 | 差异归类表 | `git diff --name-only HEAD origin/exp/resource-ledger` | 全清单共 119 件＝107 占位符替换 ＋ 12 本卡新增（远端无此件）；「其它」须为 0 |
| 8 | 未 push | `git status -sb \| head -1`；`git branch -vv \| grep reboot-1118` | 无 `[behind]`；无 `[origin/…]` 上游 |
| 9 | 报告格式 | 见 §二 | 三处逐字一致 |

## 四、红线（触发任一即不通过）

1. `git push`／`--force`／`git rebase`／`git merge`／用 origin `checkout`／`reset --hard` 覆盖工作区。
2. `git add -A`／`git add .`／`-f`。
3. pii-scan 命中非 0 仍提交。
4. **本卡新增行**含真名（判据 4 命中）。
5. 改源码、配置、`.gitignore`、notice、两族 `ledger-*`。
6. 删除 `archive/*` 分支或 `.batch/night/archive/` 内任何件。

## 五、判词落点

- 首验判词 `.batch/night/reports/CARD-1118-C-qa-firstcheck.md`，末行 `<!-- DONE -->`，§四 记「按 v2 判」。
- 判据 3、4 只认计数与 exit；判据 7 的 119 与 107/12 必须能对上。
- 打回给最小修法。

## 六、交下一张卡的遗留（不在本卡判）

1. **93 件存量真名**：来自本地旧历史（`27971070` 一侧），远端安全版为 `ab0ff804`。处理方式两种，需主人定其一：①本地历史整体不推，后续提交以远端为基点重建分支（一劳永逸，代价是本地历史只留档）；②保留本地历史、仅在推送前做一次历史重写。**本卡不碰，等口径。**
2. **判据命令写法**：卡面里出现 `"C:\\\\Users\\\\<用户名>"` 这类写法，在 bash `-F` 下是双反斜杠，会得到 0 的假通过。此后凡涉及反斜杠的判据，出卡方须先自跑一遍再写进卡面（BACKLOG B-13）。
3. **出卡错误留痕**：本卡判据 4／6 由我写错，执行方按字面判不出来——记录在 `review-requests/CARD-1118-C-rulings.md`，不进判据、不扣执行方分。
