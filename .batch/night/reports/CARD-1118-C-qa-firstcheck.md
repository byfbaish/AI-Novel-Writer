执行方：QA · AI writer项目组（首验）
依据：派验单 `review-requests/CARD-1118-C-placeholder-close.v2.md`（4,801B / 59 行，状态 待判）｜**按 v2 判**（判据 4、6 用 v2 新口径）
受验：提交 `2923090a` ＋ 报告 `.batch/night/reports/CARD-1118-C-report.md`（15,629B / 317 行 / `462f3c9a555e7de339972d79b5034a95`）
取证时刻：2026-11-19 11:04–11:12｜工作目录 `C:/develop/workspace/AI-writer/develop`｜被审件只读，未改动任何受验文件

## 一、结论

**PASS。** v2 九条判据全部成立，六条红线零触发；两处数字勘误（派验单「115」、裁定件「107」）由出卡方改正，不影响执行方结论。

## 二、起点核验（复跑用）

```
$ git rev-parse --abbrev-ref HEAD
work/reboot-1118
$ git rev-parse HEAD
2923090acc32ceb4bc9b9069fb56a0a410415bf9
$ git rev-list --parents -n1 HEAD
2923090acc32ceb4bc9b9069fb56a0a410415bf9 27971070c76938028fe5a4fbb5d26a45269a5ddc
$ git show --stat --pretty=format:'%H%n%an%n%ad%n%s' HEAD | head -4
2923090acc32ceb4bc9b9069fb56a0a410415bf9
大管家
Thu Nov 19 10:41:21 2026 +0800
chore(batch): 收编 12 件协作件入索引（CARD-1118-C）
12 files changed, 764 insertions(+)
$ git show --diff-filter=A --name-only --pretty=format: HEAD | grep -c .
12
$ git show --diff-filter=MD --name-only --pretty=format: HEAD | wc -l
0
```
父提交即开工前头 `27971070`（卡面记 `27971070` 短哈希的同一提交），12 件全为新增（`A`），无 `M`/`D`。

## 三、判据逐条（v2 §三）

### 判据 1 · 分支未换 → 成立
```
$ git rev-parse --abbrev-ref HEAD   → work/reboot-1118
$ git rev-parse --short HEAD        → 2923090a        （通过线要求 2923090a）
```

### 判据 2 · 拓扑未动 → 成立
```
$ git rev-parse --short origin/exp/resource-ledger
ab0ff804                                   exit 0
$ git merge-base HEAD origin/exp/resource-ledger
fc576e089939789c18261560ea5838b4487e7440   exit 0   （通过线 fc576e08）
```

### 判据 3 · 索引面 PII 清零 → 成立（含采信限度，见 §五.3）
```
$ node "C:/Users/$(whoami)/.dsh/bot/workspace/rotation/pii-scan.mjs" --repo . --staged
隐私机检：通过（扫描 0 个文件，0 处命中）
EXIT=0
```
提交后索引面已空，故 0 文件是必然结果；对「12 件当时是否真的 0 命中」我另取替代证据（同一事实的不同量法）：
```
$ git grep -c -F "C:\\Users\\$USERNAME" 2923090a -- <12 件全清单>
（无输出）exit 1                ← 12 件在提交树内一处真名都没有
$ git cat-file -s HEAD:reports/evidence-receipt-side-1116.md
3181
$ git show HEAD:reports/evidence-receipt-side-1116.md | sed -n '7p'
- 源件：`C:\Users\<用户名>\.dsh\sessions\…`      ← 报告称的改写点已落成占位符
```
报告 §二 称该件 3,179B → 3,181B、BOM=false、crlf=0，与我量的 blob 3,181B 一致。

### 判据 4 · 本卡新增行真名＝0 → 成立
```
$ git show 2923090a --unified=0 --pretty=format: | grep '^+' | grep -c -F "C:\\Users\\$USERNAME"
0
$ git show --unified=0 --pretty=format: HEAD | grep '^+' | grep -c -F "$USERNAME"
0
```
另复核存量口径（v2 已不要求，仅记事实）：`git grep -l -F "C:\\Users\\$USERNAME" HEAD` ＝ **93**，开工前树 `27971070` 同法 ＝ **93** → 本卡未新增一处真名，93 件是本地旧历史存量（B-14）。

### 判据 5 · 工作区真名可留 → 成立
```
$ git grep -n -F "C:\\Users\\$USERNAME" -- . | wc -l
204
$ git grep -l -F "C:\\Users\\$USERNAME" -- . | wc -l
93
```
与执行方报的 204 行 / 93 文件逐字一致，**未下降**（下降才说明误改了运行所需件）。

### 判据 6 · 本卡自身提交＝1 → 成立
```
$ git log --oneline --no-merges 27971070..HEAD | wc -l
1
$ git show --name-only --pretty=format: 2923090a | grep -c '^\.batch/'
9
$ git show --name-only --pretty=format: HEAD | grep -c .
12
```
9 与报告 §三 清单的 `.batch/` 条目数一致（12 件 = 9 件 `.batch/` ＋ 3 件 `reports/`）。

### 判据 7 · 差异归类表 → 成立（「其它＝0」我自己归一化复算过，见 §五.1）
```
$ git diff --name-only HEAD origin/exp/resource-ledger | wc -l
119
分类（我自写脚本：两侧同时把真名替换为 <用户名> 后逐字节比对）：
  远端无此件（absent）= 12
  归一后全等（＝纯占位符差异）= 107
  其它（other）= 0
```
与报告 §一.2「119 ＝ 107 占位符 ＋ 12 本卡新入、其它 0」完全一致。
清单对账：报告 §四 `- \`` 列表项 107 条，与我算出的 107 件集合做双向差集 → **两个方向都是 0 差**（无漏项、无多项、无重复项）。

### 判据 8 · 未 push → 成立（正面证据有限度，见 §五.3）
```
$ git status -sb | head -1
## work/reboot-1118
$ git branch -vv | grep reboot-1118
* work/reboot-1118 2923090a chore(batch): 收编 12 件协作件入索引（CARD-1118-C）
```
无 `[behind]`、无 `[origin/…]` 上游。

### 判据 9 · 报告格式 → 成立
```
$ head -2 .batch/night/reports/CARD-1118-C-report.md
执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot
$ tail -1 …
<!-- DONE -->
$ grep -c -F "$USERNAME" .batch/night/reports/CARD-1118-C-report.md
0                                ← 报告内无真名字面量
```
报告内出现的 `C:\\Users\\` 字样只在转义说明与 `$(whoami)` 命令里（:53/:61/:64/:72/:77），非真名。

## 四、红线核查（六条）

| 红线 | 我的核法 | 结果 |
|---|---|---|
| push／force／rebase／merge／checkout origin 覆盖工作区 | 判据 8；`.git/logs/refs/remotes/origin/exp/resource-ledger` 末条为 `27971070→ab0ff804`、时间 2026-11-19 07:28:50；本卡提交 10:41:21 晚于该次 ref 更新；工作区未被覆盖（判据 5 的 204 未降） | 未触发 |
| `git add -A`／`.`／`-f` | 提交内 12 件全为 `A`；报告 §二 记 `git add -- <单文件>` | 未触发 |
| pii-scan 命中非 0 仍提交 | 12 件提交面真名 0（§三 判据 3 替代证据） | 未触发 |
| 提交面含真名 | 新增行 0、12 件 blob 0 | 未触发 |
| 改源码／配置／`.gitignore`／notice／两族 `ledger-*` | 12 件清单逐条看，无源码、无配置、无 `.gitignore`、无 notice、无 `ledger-*` | 未触发 |
| 删 `archive/*` 或 `.batch/night/archive/` 内件 | `find .batch/night/archive -type f | wc -l` ＝ 50 件，含 `org/ledger-append-1117-hy4flash-auth.v7.md`、`staging/rules-review-docs-1116.v2.md` | 未触发 |

盘面旁证（不属本卡产物）：`git diff --numstat` 仅两处 ` M`——`.batch/night/cards/CARD-1118-B-fork-close.md` 4/4（B 卡终审的六行状态行）与 `.batch/night/org/BACKLOG.md` 35/0（新增 B-10…B-14），均晚于本卡提交、由负责人改动。

## 五、勘误与观察（不改结论）

1. **派验单 v2 判据 7 的「115」是算式错，实测 119。** v2 `:36` 写「全清单 ＋ 115 件＝107 占位符替换 ＋ 12 本卡新增」、`:52` 又要求「115 与 107/12 必须能对上」；107＋12＝119，我实测 `git diff --name-only HEAD origin/exp/resource-ledger | wc -l` ＝ 119。执行方报 119 是对的。
2. **裁定件 `CARD-1118-C-rulings.md:`34 的「我实测 … 为 107 件」是提交前（`27971070`）的值。** 那时 12 件尚未提交，所以只列出 107 条；提交后同一命令为 119。两数不矛盾，但件里没写时点，收编时建议补「提交前」三字。
3. **采信限度（不影响判 PASS，但如实记）**：①pii-scan 的「12 文件 / 0 命中」是提交前那一刻的状态，不可复现，我以「提交树 12 件零真名 ＋ 新增行 0」替代取证；②「未 push」只有间接证据（无上游、远端 ref 末条早于提交时间），本地无法正面证明未 push。
4. **判据 6 的命令在 v2 里已改用 `27971070..HEAD`**，正确；卡面原文 `origin..HEAD` 恒 1577 属出卡错误，已在裁定件 §二 处理，不扣执行方分。
5. **盘面数字追平**：报告 §七 记 `git status --porcelain` 100 行（98 `??` ＋ 2 ` M`，写作时报告自身尚未落盘）；我实测 **103 行 ＝ 101 `??` ＋ 2 ` M`**，差额 3 件即报告本身（10:55）、v2 派验单（10:58）、rulings（11:02）。数对得上，不是漏件。
6. **反斜杠坑已复现**：卡面原写法（四反斜杠）在 `bash -F` 下只命中 6，按文件实际单反斜杠字面命中 93 —— 执行方主动报出假通过风险属正当处置，BACKLOG B-13 已收。

## 六、环境失败

无。九条判据全部在本机可复现，无 ABI、目录、权限类失败。

## 七、数字冻结

本文件：**已冻结，不再改。** 落盘后由我一次算出字节数／行数／MD5／`tail -1`，报在群内并写进同日群消息；此后任何人要改本件，须重新报全套数字并说明动了什么。

## 八、版本记录

- v1（2026-11-19）：首验判词，按派验单 v2 判；结论 PASS。

<!-- DONE -->
