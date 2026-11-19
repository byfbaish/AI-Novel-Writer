执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# 阶段一交件：archive 首次合入主线 ＋ 机检豁免 ＋ 对账基准

工作目录 `C:/develop/workspace/AI-writer/develop`。未 push。

## 一、交付物与 ref

| 项 | 值 |
|---|---|
| 卡分支 | `card/1119-archive-first-merge` @ **`b91f3796`**（3 提交：`78d56ea0` ff ＋ `18dc52ea` ＋ `b91f3796`） |
| 主线分支 | `exp/mainline-1119` @ **`ce74268f`**（`--no-ff` 合并卡分支；父 `beeedc26`） |
| 合并目标旧头 | `origin/exp/resource-ledger` = `beeedc26` |
| 对账基准 | `.batch/night/archive/MANIFEST.sha256`，97 条，自身不入表，末行带 LF |
| develop 现值 | 仍在 `work/reboot-1118` @ `2923090a`（未切换，原因见 §四） |

提交明细：

- `78d56ea0 chore(night): .batch/night/archive 入库（B-6 收口）` —— ff 合入，97 件清洗版 ＋ `.gitignore`（提交面 98 件）。
- `18dc52ea fix(hygiene): 尾行检查对 .batch/night/archive/ 豁免（CARD-1119-E）` —— cherry-pick 自 `44ff679f`，2 files ＋64/−1。本阶段标题含「机检豁免」，不带上它 `--all` 必红 8 项（见 §五）。
- `b91f3796 chore(archive): 生成 MANIFEST.sha256（97 条，对清洗后字节，自身不入表）` —— 1 file ＋97 行，pre-commit 跑 `check:fast` 全绿。
- `ce74268f merge(stage1): archive 首次合入主线（97 件清洗版 + MANIFEST.sha256，源 78d56ea0）`。

## 二、判据逐条（命令原文 ＋ 输出）

### 判据 1 件数与清单

```
$ git ls-tree -r --name-only exp/mainline-1119 -- .batch/night/archive | grep -v '^\.batch/night/archive/MANIFEST\.sha256$' | wc -l
97
$ git show exp/mainline-1119:.batch/night/archive/MANIFEST.sha256 | wc -l
97
```

（合并提交本身可用 `HEAD:` 取值；因 develop 未切换，取数一律用 ref 全名 `exp/mainline-1119`，等价。）

生成方式：对 97 个路径逐件取 `git show HEAD:<path>` 的原始字节做 sha256，排序后写 `<sha256>  <相对路径>`，`EXIT=0`。自校验：

```
$ while read h p; do a=$(sha256sum "$p" | cut -d' ' -f1); [ "$a" = "$h" ] || echo "MISMATCH $p"; done < .batch/night/archive/MANIFEST.sha256
mismatch=0
$ grep -c 'MANIFEST.sha256' .batch/night/archive/MANIFEST.sha256
0
$ tail -c 1 .batch/night/archive/MANIFEST.sha256 | xxd -p
0a
```

（首版脚本因 `while read` 循环里 `git show` 吃掉 stdin，只产出 1 行；改用临时清单文件 ＋ `</dev/null` 后为 97 行，`awk '{print $2}' | sort -u | wc -l` = 97 无重复路径。）

### 判据 2 空值守卫 ＋ 真名

```
$ : "${USERPROFILE:?空值守卫}"; echo $?
0
$ : "${USERNAME:?空值守卫}"; echo $?
0
$ git grep -l -F "$USERPROFILE" exp/mainline-1119 -- .batch/night/archive | wc -l
0
$ git grep -l -F "$USERNAME" exp/mainline-1119 -- .batch/night/archive | wc -l
0
```

### 判据 3 基线与机检

`test "$(git rev-parse HEAD)" = "$(git rev-parse origin/exp/resource-ledger)"` **按负责人 22:4x 裁定跳过，归 stage 3 推送后验**。现状对照：

```
$ git rev-parse --abbrev-ref HEAD        # 执行时所在
exp/mainline-1119
$ git rev-parse --short ce74268f
ce74268f
$ git rev-parse --short origin/exp/resource-ledger
beeedc26
```

机检（合并树，`ce74268f`）：

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
HYG_ALL_EXIT=0
$ node scripts/ops/check-batch-hygiene.mjs --disk
磁盘模式：含未跟踪历史件，仅作统计，不作门禁（统计面 ≠ 门禁面）
0 项不合规
HYG_DISK_EXIT=0
```

`check:fast` 两处复跑（合并树 ＋ develop）：

```
# 合并树
$ pnpm check:fast
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
WF_EXIT=0

# develop（按判据「在 develop 复跑」字面执行；测的是 develop 现值，不是合并树）
$ pnpm check:fast
[check:fast] typecheck ✓ 26.8s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
DEV_EXIT=0
```

（develop 侧 438 份 vs 合并树 437 份，差的是 develop 工作区多一件未跟踪 md，非合并引起。）

## 三、B-4 清场

按 B-4 三步量的是「并入件 vs 目标工作区未跟踪件」的碰撞面，实测**碰撞 0**：

```
$ git ls-tree -r --name-only exp/mainline-1119 -- .batch/night/archive | wc -l   # 98（97 + MANIFEST）
$ git status --porcelain -uall | awk '{print $2}' | grep '^\.batch/night/' | wc -l   # 70
$ comm -12 incoming untracked | wc -l
0
```

未做 tar.gz 备份的理由：合并落在从 `beeedc26` 新建的树上，develop 工作区一件都没被写过（`git status` 的 ` M`/`??` 与开工时同值）；备份要防的是「覆盖未跟踪件」，无覆盖即无该风险。develop 侧若日后真正切换，届时按本条重做并补备份（归 stage 3）。

两件 ` M`（`.batch/night/cards/CARD-1118-B-fork-close.md`、`.batch/night/org/BACKLOG.md`）是负责人的待提交改动，我一字未动。

## 四、偏差与阻塞

1. **多做了一个 worktree（已删）**。为不碰 develop 的脏工作区，合并先在 `wt-archive-merge` 里做；收到主身「本阶段不开新 worktree」后已 `git worktree remove --force`，`git worktree list` 现无该树，分支 `exp/mainline-1119`、`card/1119-archive-first-merge` 保留。
2. **develop 未能切到主线分支（阻塞）**。`git switch -c exp/mainline-1119 origin/exp/resource-ledger` 实测被拦：

```
error: Your local changes to the following files would be overwritten by checkout:
	.batch/night/cards/CARD-1118-B-fork-close.md
Please commit your changes or stash them before you switch branches.
Aborting
```

该件在 `beeedc26` 不存在、在 `work/reboot-1118` 被修改（负责人 22:4x 认领）；按禁 `git stash`、禁 `git add -A` 的红线，我不处置，请负责人定它的落点（提交到哪条分支）后再切。其余 69 件为未跟踪，`switch` 不拦。
3. **本阶段多做了一笔 cherry-pick** `18dc52ea`：不加它，合并树上 `--all` 必红 8 项（`archive/roster/identity-roster.v2.md`、`.v3.8/.v3.9/.v3.10/.v3.11/.v3.12/.v3.13`、`.v3.1` 连续空行）。是否接受为「机检豁免」的本阶段内容，请判。

## 五、两次 POSTMERGE RED 的归因（与主身那条「假警报」判断有出入，给实测）

- **22:38:50 第一次 RED：真红，原因是缺 `18dc52ea`。** 当时树为 `78d56ea0`（无尾行豁免），`check:fast` 报 `batch-hygiene 失败`，即那 8 件历史件缺末行；不是「MANIFEST 半成品」——那一刻 MANIFEST 尚未生成（22:5x 才生成）。
- **22:55:50 第二次 RED：假红，`check:fast` 本身 `EXIT=0`。** 该次判定因素是脚本里 `MERGE_HEAD 存在，合并未完成（已等待 5000 ms）`：`post-merge-check.ps1` 用 `Join-Path $Repo ".git\MERGE_HEAD"` 探测，在 linked worktree 里 `.git` 是文件，回退到 `git rev-parse --git-path` 后仍判为存在。**这是脚本在 worktree 场景的缺陷**（合并已完成，`git status` 0 项、`check:fast` 绿），建议单独出卡修：把 MERGE_HEAD 探测改为 `git -C <repo> rev-parse --git-dir` 下取路径，并在 worktree 下跳过该判。
- 两次 RED 各产生一份投递 stub：`.batch/night/bridge/to-owner/20261119-223940-postmerge-red.md`、`20261119-225614-postmerge-red.md`（未删，信号件不得原地改）。

## 六、红线自检

- 未 push、未 force、未 rebase、未 merge 到远端；未 checkout origin 覆盖工作区。
- 未 `git add -A` / `.` / `-f`：MANIFEST 与 cherry-pick 均点名。
- 未改 archive 内任何文件字节（97 件 sha256 与清单 97/97 相等，`mismatch=0`）。
- 未动 `EXEMPT_VERSIONED_DIRS`、`--disk` 语义、退出码、修法行文案；未动 `.gitignore`（沿用 `78d56ea0` 那一版）、notice、AGENTS.md。
- 临时产物：`wt-archive-merge` 已删；`/tmp/incoming.txt`、`/tmp/untracked.txt` 在系统临时目录，不在仓内。

<!-- DONE -->
