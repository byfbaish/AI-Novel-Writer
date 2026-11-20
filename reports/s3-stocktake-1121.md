# S3 存量实取清单（`reports/s3-stocktake-1121.md`）

- 执行方：developer · AI writer项目组（群分身）
- 取数时刻：2026-11-21 01:44–01:50（Asia/Shanghai）
- 取数基线：仓库 `C:/develop/workspace/AI-writer/develop`，分支 `exp/mainline-1119`，HEAD `0d2671db`，工作区 6 处变动（2 M／4 待入库），未提交未推送
- 口径：**只列不动**——本件不含任何删除、打包、压缩动作；体积两列并列（`字节和`＝文件 size 求和，`du`＝块对齐后占用，两者差 20–30% 属正常）
- 远端基线：`origin/exp/resource-ledger` = `376ce148361af0719f9c7ff8134bef8c5b7e916f`；本地 `exp/mainline-1119` = `0d2671db`（领先 2，未推）

## 一、路径体积与 mtime

| 项 | 状态 | 文件数 | 字节和 | du | 最新 mtime | 判读 |
|---|---|---|---|---|---|---|
| `AI-writer/_scratch-d18` | **不存在** | — | — | — | — | B-1b 对象已不在盘 |
| `AI-writer/_backup-2026-11-01` | **不存在** | — | — | — | — | B-1c 对象已不在盘 |
| `AI-writer/.backups` | 存在 | 3 | 19,311B | 24K | 2026-11-17 11:37 | B-1a 三个 proj-pre 不在其中；仅 3 个 11-08 散件 |
| `AI-writer/.backups-archive` | 存在 | 1 | 76,597B | 76K | 2026-11-17 08:09 | `backups-archive-20261117-160935.zip`（与 proj-pre 无关，BACKLOG 已注） |
| `AI-writer/develop/.backups` | 存在 | 2 | 180,192B | 180K | 2026-11-19 23:36 | `b1-diff-backup.patch`＋`generate-draft.command.ts.b1-tail-20261108` |
| `AI-writer/_trash` | 存在 | 4 | 21,192B | 1M | 2026-11-01 11:24 | 子目录 `system-notify-agent-20261101` |
| `AI-writer/.tmp-ui` | 存在（空） | 0 | 0 | 0 | 2026-11-09 17:30 | 审计时 429 件/38.8 MB，现已空 |
| `AI-writer/wt-2` | 存在（空） | 0 | 0 | 0 | 2026-11-20 00:05 | 空目录，非 worktree |
| `AI-writer/tmp-dev` | 存在 | **61** | **534,352B** | **656K** | 2026-11-20 16:43 | 见 §五，B-19 未消失 |
| `C:/tmp/aiwriter-snapshots-1120.tar.gz` | 存在 | 1 | 20,301,711B | 19.4M | 2026-11-20 07:34 | 见 §四 |
| `C:/tmp/aiwriter-archive-bundle-1120.tar.gz` | 存在 | 1 | 167,832B | 164K | 2026-11-20 05:42 | stage 4 归档包，另一性质 |

**可清理合计实取**：tar 20,301,711 ＋ tmp-dev 534,352 ＋ 三处 `.backups` 276,100 ＝ **21,112,163B（约 20.1 MiB；du 合计约 21 MB）**。
原「135 MB」口径**作废**，依据：`.tmp-ui` 已空、`_scratch-d18`／`_backup-2026-11-01` 不在盘，`develop/.backups` 仅 2 件。

## 二、与项目总负责人 01:44 口径的三处对账

| 项 | 他记 | 我实测 | 差因 |
|---|---|---|---|
| `tmp-dev/` | 61 文件／656K | 61 文件／534,352B（du 656K） | **同一事实**，656K 是 du 块对齐值；字节和 522 KiB |
| 三处 `.backups` | 280K | 24K＋76K＋180K＝280K（du）；字节和 276,100B | 一致 |
| `.backups`「180K，3 件」 | 3 件 | 根 `.backups` 3 件 19,311B；`develop/.backups` 2 件 180,192B | **两个不同目录被并成一句**；180K 是 `develop/.backups` |

## 三、B-1a 的实质修正：`.batch-a/` 里有 proj-pre 快照，不是「无对象」

`AI-writer/.batch-a/`（**860 文件／103,613,677B 字节和（98.8 MiB）／du 101 MB**，2026-11-08 最后一次写）四个子目录：

| 子目录 | 文件数 | du | 含 `project.db` | db md5 |
|---|---|---|---|---|
| `d12proj/` | 391 | 44,406,832B | 14,405,632B（11-07 22:02） | **`734804176281b0bd979133950522a181`** |
| `proj/` | 431 | 58,747,458B | 19,574,784B（11-15 00:14） | `e1cb3b49cbe438aa68cef3eb5e15543e` |
| `d12-manual-test/` | 28 | 406,373B | — | —（有 `README.md`） |
| `_removed-txt/` | 10 | 53,014B | — | —（10 个章节 txt） |

**判定依据**：BACKLOG B-1 记 `proj-pre-d12` 为「391 文件／44M／`project.db` 14,405,632B／md5 `73480417…`」，与 `.batch-a/d12proj` 三个数全对（391／14,405,632B／`73480417…`）。即 `proj-pre-d12` **未被删除**，是**被改名搬进 `.batch-a/d12proj`**。

未对上的两项：
- `proj-pre-a1`（391 文件／db 14,405,632B／md5 `c338bad5…`）：全盘未找到同 md5 的 `project.db`；
- `proj-pre-b1replay`（194 文件／db 16,969,728B）：未找到。

`.batch-a/` 目录内**无 README**（只有 `d12-manual-test/README.md`），违反 B-1e「留档目录须有说明」；`AI-writer` 根不是 git 仓库（`git rev-parse --show-toplevel` → `fatal: not a git repository`），故 `.batch-a/` 在一切版本控制之外。

**结论口径建议**：B-1a 不宜写「非本组删除／来源未知」。至少 `d12proj` 是「被改名归档、未删除」，改名人与时间无留痕（目录 mtime 11-07 22:02 / 11-08 02:28）。这条建议转主人裁：`.batch-a`（101 MB）是 21 MB 之外的最大一块存量，是否认领、是否补 README、是否删，都等一句话。

## 四、tar 与回滚路径

```
$ ls -l C:\\tmp\\aiwriter-snapshots-1120.tar.gz
20301711  Nov 20 07:34
$ sha256sum C:\\tmp\\aiwriter-snapshots-1120.tar.gz
5a392af4aa2831e1dbb3c553b5c23589a07764b5c0f5bfb24379fbb686159ff5
```

- 回滚路径：**该 tar 不带 `tmp-dev/` 内容**（项目总负责人 01:44 亦同此判断）。若将来删 `tmp-dev` 61 件，删前须另打小包；
- 该 tar 在 `C:\tmp`，不在任何 git 仓库内，删除后不可由版本控制恢复 ⇒ **删除动作需主人一句话**；
- 三处 `.backups` 均为未跟踪/仓外散件，删除不可由 git 恢复；回滚只能靠事先 tar。

## 五、`tmp-dev/` 61 件构成（只列不动）

按用途（`ls` 实测，全为本次/前几卡执行脚本与中间产物）：

- 卡执行脚本：`classify-1118b.mjs`、`classify-1118c.mjs`、`d-move.cjs`、`d-state.cjs`、`d-readme.cjs`、`fix-done.cjs`、`inv-1118d-write.mjs`、`s2-dab.cjs`、`s2-find.cjs`、`s2-attr.cjs`、`s2-fill.cjs`、`s2-backlog.cjs`、`s2-check.cjs`、`h-t1.mjs`、`h-t3-allow.mjs`、`s-bundle.mjs`、`s-move.cjs`、`s-probe.cjs`、`s-readme.cjs`、`s-eof.cjs`、`s-two-line.mjs` 等；
- 中间产物：`s2-hits.txt`、`s2-attr.txt`、`s-rows.json`、`s-rows.cjs`、`d-final.json`、`pii-allow-table.md`、`untracked.txt`、`untracked-after.txt`、`untracked-baseline-develop.txt` 等；
- 备份：`pii-scan.mjs.bak-1119H`（**这是 `rotation/pii-scan.mjs` 的补丁前唯一备份，md5 `63e9328f548f66174e53a3e9937ddda8`，删前必须单独留**）。

**回滚路径**：其中 `pii-scan.mjs.bak-1119H` 是运维脚本唯一回滚件，其余为一次性脚本，可由本卡报告与 BACKLOG 记载重建。删除动作待主人一句话（B-19 转裁）。

## 六、分支（本地 39 条／远端 5 条 heads）

```
$ git branch | wc -l                       → 39
$ git branch --merged origin/exp/resource-ledger    | grep -v '^\*' | wc -l → 7
$ git branch --no-merged origin/exp/resource-ledger | grep -v '^\*' | wc -l → 32
$ git ls-remote --heads origin | wc -l     → 5
```

远端 5 条 heads（不动）：
```
6cc146cd31197f9b41723c62528a6991092b31a5  refs/heads/card/git-track-ops-1117
c87cd4abfedf3e293137abea2dc2932aa0b8b603  refs/heads/dev_byf
376ce148361af0719f9c7ff8134bef8c5b7e916f  refs/heads/exp/resource-ledger
89267678e43b6bfb535617d2bb8b4869c56ed898  refs/heads/master
5ee50c2adc63bb9016dbd4c0569e45bce89c834d  refs/heads/upstream-baseline
```

### 6.1 可删候选（tip 已是 `exp/mainline-1119` 的祖先，独有提交为零）

| 分支 | tip | 日期 | 相对 origin |
|---|---|---|---|
| `card/1119-H` | `adb17d44` | 2026-11-20 | 0 ahead / 19 behind |
| `card/1119-archive-first-merge` | `b91f3796` | 2026-11-19 | 0 ahead / 27 behind |
| `work/archive-in-git-1119` | `78d56ea0` | 2026-11-19 | 0 ahead / 29 behind |
| `relive-src/card/git-track-ops-1117` | `6cc146cd` | 2026-11-17 | 0 ahead / 31 behind |
| `relive-src/dev_byf` | `c87cd4ab` | 2026-11-14 | 0 ahead / 56 behind |
| `relive-src/exp/resource-ledger` | `beeedc26` | 2026-11-17 | 0 ahead / 30 behind |
| `relive-src/master` | `89267678` | 2026-10-09 | 0 ahead / 859 behind |

- 四条 `relive-src/*` 删前须先确认远端三支头仍在：`card/git-track-ops-1117`＝`6cc146cd`、`dev_byf`＝`c87cd4ab`、`master`＝`89267678`（后一条本地 `relive-src/master` 为 `89267678`，与远端 master **相同**，可删）。
- 回滚路径：分支删除只是移引用，`git branch <名> <tip>` 即可复原；tip 已知（上表），且均在 `exp/mainline-1119` 历史内可再找到。

### 6.2 保留（32 条，独有提交不为零 / 本轮不出「已被别处携带」证明）

含 25 条旧线分支（tip 领先 origin 976–1578、落后 1840，属历史重写前的老线，只作对照），以及本期仍在用的 `exp/mainline-1119`（当前分支）、`card/1118-D`、`card/1119-E`、`work/pii-1119`、`chore/pii-mainline-1119`、`redact/live-1119`、`redact/tail-1119`、`archive/local-rebuilt-1118`。

### 6.3 远端有差（本地与同名远端 sha 不同）

| 分支 | 本地 tip | 远端 sha | 说明 |
|---|---|---|---|
| `exp/resource-ledger` | `1dd9e948`（11-17） | `376ce148` | 本地是重写前老线，**已过期**；基线以远端为准 |
| `card/git-track-ops-1117` | `0988f274` | `6cc146cd` | 本地是老线版 |
| `dev_byf` | `b9342be9` | `c87cd4ab` | 同上 |
| `master` | `dbad51d7` | `89267678` | 本地是旧仓线（另有 213 独有提交），不删 |
| `upstream-baseline` | `8afec2a1` | `5ee50c2a` | 同上 |

这 5 条均**不可删**（各有独有提交），处置＝「保留，标注已过期」。

## 七、worktree（5 棵）

```
C:/develop/workspace/AI-writer/develop      → branch refs/heads/exp/mainline-1119   （主检出）
C:/develop/workspace/AI-writer/night-probe  → detached
C:/develop/workspace/AI-writer/test-master  → detached（此树属别的仓：HEAD dbad51d7 是 EthanYoQ PR #331）
C:/develop/workspace/AI-writer/wt-1117f     → branch refs/heads/card/1117-F
C:/develop/workspace/AI-writer/wt-p56       → branch refs/heads/agent/p56-wb-docs
```

- 回滚路径：`git worktree remove <path>` 可通过 `git worktree add <path> <branch>` 复原；`night-probe`／`test-master` 为 detached，删前须记其 HEAD（`git -C <path> rev-parse HEAD`）。
- 本件**不动**任何树。

## 八、删除候选汇总（全部只列不动）

| # | 对象 | 体积 | 回滚路径 | 需谁一句话 |
|---|---|---|---|---|
| 1 | `C:/tmp/aiwriter-snapshots-1120.tar.gz` | 20,301,711B | 无（仓外，删即不可恢复）；sha256 已留 | 主人 |
| 2 | `AI-writer/tmp-dev/` 61 件 | 534,352B | 除 `pii-scan.mjs.bak-1119H` 外为一次性脚本 | 主人（B-19 转裁） |
| 3 | 三处 `.backups`（根 3 件／archive 1 件／develop 2 件） | 276,100B | 无（仓外） | 主人（B-1d 转裁） |
| 4 | 7 条已并入分支 | 0（仅引用） | `git branch <名> <tip>` | 主人（B-2 转裁） |
| 5 | `AI-writer/.batch-a/`（新发现） | 103,613,677B | 无（仓外、无 README） | 主人（本件新增建议） |

## 九、本次未做的事

- 未删除、未打包、未压缩任何文件；
- 未 `git branch -d`／`worktree remove`／`fetch --prune`；
- 未提交、未推送；
- `tmp-dev/` 内文件我一个没动（本件自身写在本目录之外，`C:\tmp\s3-stocktake.mjs` 为一次性取数脚本）。

<!-- DONE -->
