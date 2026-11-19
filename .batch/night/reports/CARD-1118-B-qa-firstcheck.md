执行方：QA
model=deepseek-v4.1 | 倍率=1 | provider=deepseek

# CARD-1118-B 首验判词（分叉收口 A 方案 ＋ 未跟踪件归位）

派验单：`.batch/night/review-requests/CARD-1118-B-fork-close.v4.md`｜6,553B｜`7e5ac3223c3f06334c12111fd1c0674c`｜76 行（v1/v2/v3 留档不采用）
受验卡面：`.batch/night/cards/CARD-1118-B-fork-close.md`｜4,440B｜`7cbeff53ade7292c13f676434575c340`｜52 行
交件报告：`.batch/night/reports/CARD-1118-B-report.md`｜24,866B｜`b7554a48253d43fe204a613b8d5ea9f6`｜307 行｜mtime 2026-11-18 10:58:53｜末行 `<!-- DONE -->`
验场：`C:/develop/workspace/AI-writer/develop`，HEAD `27971070c76938028fe5a4fbb5d26a45269a5ddc`（＝`origin/exp/resource-ledger`）
判据复跑时刻：2026-11-18 11:04–11:15（Asia/Shanghai）

## 结论：**PASS**——v4 §二 九条判据全成立，§三 六条红线零触发

勘误 5 项（数字/路径口径，均不改变结论）与 1 项待裁列在 §四，由派单方决定是否要求另存 v2 勘误件；本判词不自行改执行方报告。

| # | 判据（v4 §二） | 结果 |
|---|---|---|
| 1 | 留档分支存在且指向 `1dd9e948` | 成立 |
| 2 | 基线已换成远端 | 成立 |
| 3 | 本卡不落提交（必须为 0） | 成立（0） |
| 4 | 未跟踪件没丢（总数不减、前值 100 件逐件在） | 成立（104 项全对上，见 §二.4） |
| 5 | 没把占位符版本带回来（`--quiet` exit 0） | 成立（exit 0） |
| 6 | 占位符清零抽查 ＝ 0 | 成立（0） |
| 7 | 三类归位清单齐、每条带处置、`git add` 原文逐条、`.vN` 两类单列 | 成立（覆盖 91/91 条未跟踪件） |
| 8 | 未 push（无 behind、无上游） | 成立 |
| 9 | 报告格式三处逐字一致 | 成立 |

## 一、冻结数字（本判词落盘时一次性报出，之后不再改）

- 判据复跑现值：`git status --porcelain` 共 **103** 行 ＝ `??` **90** ＋ `A ` **12** ＋ ` M` **1**（`BACKLOG.md`）
- 开工前值（我 10:36 实测，与执行方 10:34 报值同）：`??` **100**／`wc -l` **101**
- `.vN` 盘面全量：`.batch/night` 下 83 件（含 `archive/` 内 4 件）→ `archive/` 外 **79** ＝「有主件且不同字节」**45** ＋「无主件」**34**；另 2 件同字节重复件已移入 `archive/`（合计 81，即执行方 10:44 报的 81 件）
- 判词件本身未计入上述 90（本文件落盘后 `??` 变 91，收编卡按 91 复核）

## 二、判据逐条（命令原文 ＋ 实输出 ＋ exit）

### 判据 1 —— 留档分支

```
$ git branch --list 'archive/local-rebuilt-1118'; git rev-parse --short archive/local-rebuilt-1118
  archive/local-rebuilt-1118
1dd9e948
exit=0
```

恰一条，指向 `1dd9e948` → **成立**。

### 判据 2 —— 基线换成远端

```
$ git rev-parse --abbrev-ref HEAD
work/reboot-1118
exit=0
$ git merge-base HEAD origin/exp/resource-ledger
27971070c76938028fe5a4fbb5d26a45269a5ddc
exit=0
$ git rev-parse origin/exp/resource-ledger
27971070c76938028fe5a4fbb5d26a45269a5ddc
exit=0
```

merge-base 与远端 ref 同一 SHA → **成立**。

### 判据 3 —— 本卡 0 提交

```
$ git rev-list --count origin/exp/resource-ledger..HEAD
0
exit=0
```

**成立**，红线 4 不触发。

### 判据 4 —— 未跟踪件没丢（本判词的主体核对）

```
$ git status --porcelain | grep -c '^??'   → 90   exit=0
$ git status --porcelain | wc -l           → 103  exit=0
$ git status --porcelain | grep -c '^A '   → 12   exit=0
```

逐件对账（不采信自述，按我 10:36 的 100 条前值清单一条条点）：

- 前值 100 件中，**98 件**以 `??`（86）或 `A `（12）形式在列 → 逐条命中，无缺
- 剩余 **2 件**按 v4 §六.1(a) 物理移入 `archive/`，字节自证见下条；**不是在盘上消失**
- 期间**新增 4 件**：`.batch/night/reports/CARD-1118-B-report.md`、`.batch/night/review-requests/CARD-1118-B-fork-close.v2/v3/v4.md`
- 校验闭合：86 ＋ 12 ＝ 98；98 ＋ 2（archive）＝ 100 ✓；90 ＋ 12 ＋ 1（` M`）＝ 103 ✓

移档两件的字节证明（前后同 MD5、与主件同 MD5）：

```
$ md5sum .batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md .batch/night/org/ledger-append-1117-hy4flash-auth.md
91bdbf8ee88cc04d91ef500c3139df27  .batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md
91bdbf8ee88cc04d91ef500c3139df27  .batch/night/org/ledger-append-1117-hy4flash-auth.md
$ md5sum .batch/night/archive/staging/rules-review-docs-1116.v2.md .batch/night/staging/rules-review-docs-1116.md
353ca52c653d4db109bd65ff83f5d72b  .batch/night/archive/staging/rules-review-docs-1116.v2.md
353ca52c653d4db109bd65ff83f5d72b  .batch/night/staging/rules-review-docs-1116.md
exit=0
$ git check-ignore -v .batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md
.gitignore:93:/.batch/night/*	.batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md
exit=0
```

`archive/README.md` 六段齐（谁建／何时／用途／当前内容／保留期限／过期归属），1,385B，mtime 10:48:54 → **成立**（口径张力见 §四.4）。

### 判据 5 —— 占位符版本没被带回来

```
$ git diff --quiet HEAD origin/exp/resource-ledger
(无输出)
exit=0
```

→ **成立**（零差异；`--stat` 空输出，v4 已明确非失败）。

### 判据 6 —— 占位符清零抽查

```
$ grep -rn '<用户名>' scripts/ops/ | wc -l
0
exit=0
```

→ **成立**。

### 判据 7 —— 三类归位清单齐

覆盖性不靠目视：把当前 `??`（目录按 `find` 展开成实文件 92 条）与报告全文出现的路径做集合差：

```
$ comm -23 <展开后的未跟踪件 92 条> <报告中提取的路径 114 条>
.batch/night/reports/CARD-1118-B-report.md        ← 报告自身，不需自列
```

除报告自身外 **91/91 条全部以全路径出现在报告里**，每条带处置 → **成立**。

`.vN` 两类分列与盘面逐件核对（按「与同目录主件是否同字节」二分）：

```
有主件且字节不同 45 件  vs 报告 §4.1(3) 提取 45 条  → 集合完全一致（差集为空）
无主件 34 件          vs 报告 §4.1(4) 提取 34 条  → 集合完全一致（差集为空）
同字节 2 件           vs 报告 §4.1(2) 两件        → 一致
```

`git add` 原文 12 条与索引 12 件逐条一致，全部为 `git add -- <显式路径>`（无 `-A`／`.`／`-f`）：

```
$ git diff --cached --name-status
A .batch/night/cards/CARD-1118-B-fork-close.md
A .batch/night/cards/CARD-1118-reboot-first.md
A .batch/night/reports/CARD-1117-F-qa-firstcheck.md
A .batch/night/reports/CARD-1118-reboot-first-qa-firstcheck.md
A .batch/night/reports/merge-B-into-integration-1117.md
A .batch/night/review-requests/CARD-1118-B-fork-close.md
A .batch/night/review-requests/CARD-1118-reboot-first-rulings.md
A .batch/night/staging/add-state-header-f.sh
A .batch/night/staging/f-final-verdict.sh
A reports/evidence-receipt-side-1116.md
A reports/hy4-modelname-probe-20261117.md
A reports/wo-hy4-modelname-20261117.md
```

暂存件 MD5 抽查 3 件，与报告 §4.1(1) 完全一致：

```
5708d89a903e29d582dd391a508abd6a  .batch/night/reports/merge-B-into-integration-1117.md
2e3ea26817fe2f218bb8644a6ae6fcf3  .batch/night/staging/add-state-header-f.sh
be7266b53b411ac79c38ac3f704caf5c  .batch/night/review-requests/CARD-1118-reboot-first-rulings.md
```

→ **成立**。

### 判据 8 —— 未 push

```
$ git status -sb | head -1
## work/reboot-1118
exit=0
$ git branch -vv | grep -c '\[origin/'
0
exit=1
```

无 `[behind]`、无 `[origin/…]` 上游（无上游时首行只打 `## work/reboot-1118`，v4 已按此口径）→ **成立**。

### 判据 9 —— 报告格式

```
$ head -3 .batch/night/reports/CARD-1118-B-report.md
执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot
$ tail -1 .batch/night/reports/CARD-1118-B-report.md
<!-- DONE -->
```

三处逐字一致 → **成立**。

## 三、红线逐条（六条，零触发）

| # | 红线 | 我的取证 | 结果 |
|---|---|---|---|
| 1 | push／`--force`／rebase／merge 无关历史 | `rev-list --count`＝0，无上游，无 behind；`status --porcelain` 无 `M .git/*` | 未触发 |
| 2 | `git add -A`／`.`／`-f` | 报告 §七 12 条全为 `git add -- <路径>`，索引 12 件与之一一对上 | 未触发 |
| 3 | 删除任何文件或目录 | 前值 100 件逐件在盘（98 在 `??`/`A `，2 在 `archive/`，MD5 与主件相同）；`status` 无 `D` 行 | 未触发 |
| 4 | 产生提交 | `rev-list --count origin/exp/resource-ledger..HEAD`＝0 | 未触发 |
| 5 | 改 `.gitignore`／notice／源码语义／动两族 `ledger-*` | `status` 中唯一 ` M` 是 `.batch/night/org/BACKLOG.md`（+26/−0）；两族 `ledger-append-1117-hy4flash-auth*` 全为 `??`，无一进索引；主件 MD5 仍 `91bdbf8ee88cc04d91ef500c3139df27` | 未触发 |
| 6 | 同字节 `.vN` 重复件入库 | 两件在 `archive/`（被 ignore），`git diff --cached` 中无此二路径 | 未触发 |

## 四、勘误与待裁（不改变 PASS，供派单方裁决）

**本判词按 v4 判**；v4 相对 v2 的两处口径变更（判据 3 明确 0 提交、判据 4 计数口径改「总数不减＋逐件在 `??`/`A `」）已在此适用。

1. **判据 4 的「交件前」数字要与口径一起看**：报告 §二 写 `92 / 103`，我 11:04–11:15 实测 `??`＝**90**、`wc -l`＝**103**。说明：「92」若指**文件级展开**（`??` 90 条目里有 3 个目录，展开成 92 个实文件）则成立，我复算为 92；但 §四 口径段写「103 行 ＝ `??` 92 ＋ `A ` 12」把两个口径混在一行，等于 104≠103，仍须改成「103 ＝ `??` 90 ＋ `A ` 12 ＋ ` M` 1」并注明 92 是展开后文件数。真值：90＋12＋1（` M`）＝103。
2. **§四 口径段细分数字过期**：写「真历史 47、无主件 36、db 5、voided 1、其余 3」。盘面真值：真历史 **45**、无主件 **34**（两数合计 79 件 `.batch/night` 下 `.vN` 实文件，逐件比对无差集）＋同字节 2 件（已入 `archive/`，合计 81，与执行方 10:44 报的 81 一致）；非 `.vN` 件为 db 5、voided 1、`p31-v2.md`、`p51-v2.md`、`process-efficiency-draft-v1.md`、本卡报告 1、`.gitignore.bak`、`space-readonly-check.mjs`、`.c/` 影子件 1。
3. **两个小节标题的件数与清单条数不符**：`§4.1(3)` 标「47 件」实列 **45** 条；`§4.1(4)` 标「35 件」实列 **34** 条。清单本身完整无漏（已逐件集合比对），只是标题数字错。
4. **判据 4 与 §六.1(a) 的措辞张力**：移入 `archive/` 的 2 件此后不再出现在 `??`/`A `，判据 4 字面「前值 100 件要么 `??` 要么 `A `」对它们不成立。我按「**不丢件**」实质判成立（字节在盘、MD5 与主件相同、README 有保留期与归属）。建议收编卡口径补一句「移入 `archive/` 的件视同为在盘」。
5. **§六.2 第三条分支未按裁走**：`scripts/workbuddy/space-readonly-check.mjs` 有完整用途注释（头 12 行含运行时与 WAL 纪律），按 §六.2 应是「补保留期与过期归属后**入库**」；执行方选了「留盘待认领（B-8）」，未写「补不出」的依据。判据 7 只要求「每条路径带处置」，故不扣分；是否要求补说明或入库请派单方裁。
6. **路径简称**（已在群内跟执行方确认，他将随勘误件处理）：`§4.1(2)` 两处写作 `archive/`，实为 `.batch/night/archive/`；仓库根无 `archive/`（`ls -d archive` exit 2）。收编卡按简称找会落空。

以上 1–3 影响的是台账数字，不影响本卡分叉收口与归位的实际结果；建议执行方把 1–3、6 一并写进他承诺的「路径勘误件」，另存 `.v2` 或独立勘误行，不原地改已交件。

## 五、环境失败项

无。九条判据全部可判，无一因环境不可达而跳过；分母恒为 9。

## 六、独立复算声明

本判词所有尺寸、行数、MD5、计数均由我在 `C:/develop/workspace/AI-writer/develop` 上就地复算，未引用任何一方自述；判据 7 的覆盖性用「未跟踪件集合 vs 报告路径集合」的 `comm` 差集核，不用目视。**以上数字已冻结，不再改**；若后续再动盘（收编卡落库、勘误件落盘），须重新报全套数字并说明动了什么。

## 七、版本变更

本件为首版，无 `.vN` 前身。派验单版本：按 v4（v1/v2/v3 留档不采用）。

<!-- DONE -->
