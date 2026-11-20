状态：待判
持有者：QA · AI writer项目组
可写：否
最后变更：2026-11-21 01:58（项目总负责人 · AI writer项目组；B-1a 改写、体积口径按实字节）
卡号：S3 存量处置（B-1a/b/c/d、B-19、B-2）
依据件：`.batch/night/org/BACKLOG.md`；`reports/s3-stocktake-1121.md`（developer 实取，11,210B／159 行）

# S3 存量处置清单（每项一行结论：结案／转主人裁）

取数时刻 2026-11-21 01:44–01:57，工作区 `C:/develop/workspace/AI-writer/develop`，HEAD `0d2671db` @ `exp/mainline-1119`。**本件只列不动**：不删、不打/解包、不压缩。

## 〇、三处口径订正（同事实、不同写法，两个数都留）

| 项 | 原口径 | 实测 | 判 |
|---|---|---|---|
| `tmp-dev/` | 0 件 | **61 文件**／实字节 **534,352B**（`du` 656K 是块对齐） | 以实测为准；B-19 未消失 |
| `.backups` | 「180K／3 件」并成一句 | **两处不同路径**：`AI-writer/.backups` **3 件／19,311B**；`develop/.backups` **2 件／180,192B** | 分行记，不再合并 |
| 可清理合计 | 约 135 MB | **21,112,163B（约 20.1 MiB）**＝tar 20,301,711B ＋ tmp-dev 534,352B ＋ 根 `.backups` 19,311B ＋ `develop/.backups` 180,192B ＋ `.backups-archive` 76,597B | 135 MB 作废 |
| B-1a | 「无可处置对象」（我 01:50 首版） | **`proj-pre-d12` 未删除，是被改名搬进 `.batch-a/d12proj`**：391 文件、`project.db` 14,405,632B、md5 `734804176281b0bd979133950522a181`，与 BACKLOG 记的三个数**逐项相符** | 首版结论作废，按 §一 改写 |

## 一、逐项结论

| 编号 | 对象 | 实测 | 结论 |
|---|---|---|---|
| B-1a | `proj-pre-a1`／`proj-pre-d12`／`proj-pre-b1replay` | ①`proj-pre-d12` **在** `.batch-a/d12proj`（391 件／db 14,405,632B／md5 `73480417…`）②`a1`（db md5 `c338bad5…`）与 `b1replay`（db 16,969,728B）**仍未找到**，`.batch-a` 下两个 `project.db` 只有 `d12proj` 与 `proj`（19,574,784B／md5 `e1cb3b49…`，11-15 新快照）③原 `.backups` 现仅 3 件 19,311B | **改判：转主人裁**——`d12` 系改名归档（改名人与时间无留痕，`.batch-a` 无 README、在 git 之外，按 B-1e 属待认领孤儿）；`a1`／`b1replay` 去向仍不明；**不写「已删」「无可处置」** |
| B-1b | `_scratch-d18` | 路径不存在（45.6 MB 原记） | **结案（对象已不存在）**；记「非本组删除」，不认领删除动作 |
| B-1c | `_backup-2026-11-01` | 路径不存在（23.2 MB 原记） | **结案（对象已不存在）**；同上 |
| B-1d | `AI-writer` 根在 git 之外的四类目录 | 现存：`develop/.backups` 180,192B／2 件、根 `.backups` 19,311B／3 件、`.backups-archive` 76,597B／1 件、`tmp-dev/` 61 件／534,352B；另新发现 **`.batch-a/` 860 件／103,613,677B（du 101 MB）** | **转主人裁**：①写「仓库外仓·不纳管」结案，还是纳入某仓；②`.batch-a/` 是否按 B-1e 补 README 或进待认领清单。删除与否另等一句话 |
| B-19 | `tmp-dev/` 61 件 | 534,352B；内含 `pii-scan.mjs.bak-1119H`＝`rotation/pii-scan.mjs` 的**唯一回滚件** | **转主人裁（删／留）**；若删，须先单独保留 `pii-scan.mjs.bak-1119H`，并把清单＋体积对比＋回滚路径写进同一笔 |
| B-2 | 本地 39 条／远端 5 条 heads | 已并入 `origin/exp/resource-ledger`（`376ce148`）**7 条**（QA 复核：逐条 `git merge-base --is-ancestor` exit 0，无独有提交）；未并入 **32 条** | **三档见 §三**：7 条可删（**只列不动**，等一句话；回滚＝`git branch <名> <tip>`，tip 见 stocktake §6.1）、32 条保留、远端 5 条不动 |

## 二、盘面实取（2026-11-21 01:44–01:57）

```
GONE  AI-writer/_scratch-d18
GONE  AI-writer/_backup-2026-11-01
EXIST AI-writer/.backups            3 件 / 19,311B
EXIST AI-writer/develop/.backups    2 件 / 180,192B
EXIST AI-writer/.backups-archive    1 件 / 76,597B
EXIST AI-writer/tmp-dev            61 件 / 534,352B (du 656K)
EXIST AI-writer/.batch-a          860 件 / 103,613,677B (du 101M)
EXIST C:/tmp/aiwriter-snapshots-1120.tar.gz 20,301,711B
sha256(tar) = 5a392af4aa2831e1dbb3c553b5c23589a07764b5c0f5bfb24379fbb686159ff5
```

`.batch-a` 结构（`ls`）：`d12-manual-test/`（28 件／460K）、`_removed-txt/`（10 件／80K）、`d12proj/`（391 件，`proj-pre-d12` 同一快照）、`proj/`（431 件，db 19,574,784B／md5 `e1cb3b49…`，11-15 新快照）。

## 三、B-2 分支三档

**可删（7 条，均已并入 `origin/exp/resource-ledger` `376ce148`）**：`card/1119-H`、`card/1119-archive-first-merge`、`work/archive-in-git-1119`、`relive-src/card/git-track-ops-1117`、`relive-src/dev_byf`、`relive-src/exp/resource-ledger`（`beeedc26` ⊂ `376ce148`）、`relive-src/master`（与远端 `master` 同 sha）。
回滚路径：`git branch <名> <tip>`，tip 全列在 `reports/s3-stocktake-1121.md` §6.1。**删除类动作，只列不动。**

**保留（32 条未并入）**：其中 25 条是脱敏重写前的老线（领先 976–1578／落后 1840，含 `archive/local-rebuilt-1118`、`work/reboot-1118`——永不推送），另有在用分支 `exp/mainline-1119`、`card/1118-D`、`card/1119-E`、`work/pii-1119`、`card/1117-A…F`、`agent/*` 等。
理由：未并入即可能还有独有提交，本轮不出「已被别处携带」的证明就不删。

**远端（5 条 heads，不动）**：`exp/resource-ledger`、`card/git-track-ops-1117`、`dev_byf`、`master`、`upstream-baseline`。本地同名分支多为两条老线，与远端无共同祖先属已知事实，不在本阶段处理。

## 四、worktree（登记备查，不属 B-1/B-2）

```
develop       0d2671db [exp/mainline-1119]
night-probe   dd2990c7 (detached)
test-master   dbad51d7 (detached，另一仓)
wt-1117f      1ee92e87 [card/1117-F]
wt-p56        7478b44a [agent/p56-wb-docs]
```
`wt-p56` 有 14 项他人既存改动、两棵游离头树待认领——本轮不动。

## 五、要让主人／主身拍的（四条）

1. **~20.1 MiB 删不删**：`C:\tmp\aiwriter-snapshots-1120.tar.gz`（20.3 MB）＋`tmp-dev/`（534KB，须先单独留 `pii-scan.mjs.bak-1119H`）＋三处 `.backups`（276KB）。
2. **`.batch-a/` 101 MB 怎么办**：里面有 `proj-pre-d12` 的同一快照；按 B-1e 补 README，还是纳入某仓，还是删。
3. **B-1d 纳不纳管**：仓库外目录写「不纳管」结案，还是纳入。
4. **7 条已并入分支删不删**（回滚路径已备）。

证据：`for p in …; [ -e "$p" ]` → §二；`git branch|wc -l`＝`39`、`--merged`＝`7`、`--no-merged`＝`32`、`ls-remote --heads|wc -l`＝`5`；`git worktree list` → §四；`find tmp-dev -type f|wc -l`＝`61`；`find .batch-a -type f|wc -l`＝`860`、`du -sh .batch-a`＝`101M`；`md5sum .batch-a/d12proj/.ai-novel/project.db`＝`734804176281b0bd979133950522a181`、其 `stat -c %s`＝`14405632`；`md5sum .batch-a/proj/.ai-novel/project.db`＝`e1cb3b49cbe438aa68cef3eb5e15543e`；`sha256sum` tar → §二。
