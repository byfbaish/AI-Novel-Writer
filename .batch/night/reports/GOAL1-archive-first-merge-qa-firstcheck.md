# Goal stage 1 首验判词 · archive 首次合入主线＋机检豁免＋对账基准

首验方：QA · AI writer项目组
判词对象：**最终 HEAD `68fa03813c09c6582c97aaa805f0f28acc86afb3`**（分支 `exp/mainline-1119`，工作区 `develop`，取数时刻 2026-11-19T23:33+0800，工作区已跟踪改动 0）
　· docs 提交前头原值：`ce74268f0012c6217b27d2a6f676b0ecddef4774`（merge(stage1)），被 `68fa0381` 顶替，仅留档
　· `68fa0381` 父＝`ce74268f`，1 提交，`git show --stat` 末行 `5 files changed, 223 insertions(+)`，`git show --name-only | grep -cE '^(scripts/|\.batch/night/archive/)'` = **0**（未碰禁改面）
　· 合并拓扑：`ce74268f` 父１＝`beeedc26…`（=`origin/exp/resource-ledger`）、父２＝`b91f3796…`；链 `beeedc26`→`78d56ea0`→`18dc52ea`→`b91f3796`→`--no-ff` 合并
依据件：Goal「AI writer 脱敏基线收口（四阶段）」stage 1 done-when 三条门槛 ＋ 负责人 2026-11-19 23:0x/23:1x 裁定（`HEAD`=origin 与 `rev-list 0 0` 跳过归 stage 3；`--disk` 按 develop 侧取数，合并树 0 项不算证明）＋大肥鱼 23:2x 口径（判词落最终 HEAD，记一次 HEAD 原值）
受验报告：`.batch/night/reports/GOAL1-archive-first-merge-report.md`｜8,012B｜`e69c1e519039c1ee9320a5ce285627d9`｜153 行｜末行 `<!-- DONE -->`｜crlf=0｜真名命中 0（均我自算，与执行方自报一致）
结论：**PASS**（三条门槛在最终 HEAD 上逐条成立；附 §五 观察三项，均不改判）

---

## 一、门槛 1 · 件数与清单

```
$ git ls-tree -r --name-only HEAD -- .batch/night/archive | grep -v '^\.batch/night/archive/MANIFEST\.sha256$' | wc -l
97
$ git show HEAD:.batch/night/archive/MANIFEST.sha256 | wc -l
97
```

成立（97 / 97）。三项独立加核，比为字面更严：

```
$ 清单路径集 与 ls-tree 路径集 双向差集  → only_ls=0  only_mf=0  dup=0
$ 逐条 git show HEAD:<path> | sha256sum 与清单第 1 列比对（mapfile 读表，git show </dev/null）
n=97 mismatch=0
$ git cat-file -s HEAD:.batch/night/archive/MANIFEST.sha256 → 12033 ；末字节 tail -c 1|xxd -p → 0a
$ git diff --stat ce74268f 68fa0381 -- .batch/night/archive → （空，docs 提交未动归档面）
$ git diff --stat 78d56ea0 HEAD -- .batch/night/archive → 1 file changed, 97 insertions(+) 即只有 MANIFEST
```

即「97 件字节＝清洗版 `78d56ea0` 原样，清单 97 条逐件对得上，自身不入表」。

## 二、门槛 2 · 空值守卫＋真名

```
$ : "${USERPROFILE:?空值守卫}"; echo $?      → 0
$ : "${USERNAME:?空值守卫}"; echo $?         → 0
$ git grep -l -F "$USERPROFILE" HEAD -- .batch/night/archive | wc -l   → 0
$ git grep -l -F "$USERNAME"    HEAD -- .batch/night/archive | wc -l   → 0
```

成立。两变量均有实值（守卫真通过，非脚本吞错）。

## 三、门槛 3 · 基线与机检

**3a 基线核对：按裁定跳过，归 stage 3。** 实测 `HEAD=68fa0381`、`origin/exp/resource-ledger=beeedc26`，两者不同——与「stage 1 不 push」自洽；`rev-list --left-right --count beeedc26...HEAD` = `0	5`（纯领先，无分叉）；`git merge-base --is-ancestor 2923090a HEAD` → `old-line-absent`，符合 Goal「`work/reboot-1118` 及后代一律不并入」。

**3b `--all`（最终 HEAD，develop）：**

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
ALL_EXIT=0
```

**3c `--disk`（统计面，不作门禁；三次取数都留）：**

| 时刻 | 分支/工作区 | 取数 | 说明 |
|---|---|---|---|
| 23:0x | `work/reboot-1118` @ `2923090a`（旧线） | **48 项不合规**、exit 0 | 切换前 |
| 23:20 | `exp/mainline-1119` @ `ce74268f` | **40 项不合规**、exit 0 | 切换后，旧线已跟踪件被替换掉 8 件 |
| 23:33 | `exp/mainline-1119` @ `68fa0381` | **39 项不合规**、exit 0 | docs 提交后 |

三次均打「磁盘模式：含未跟踪历史件，仅作统计，不作门禁（统计面 ≠ 门禁面）」，条目形如 `.batch/night/tools/*.cjs · versioned-filename`。「仍报历史账」成立；三数不统一是事实，均属统计面。

**3d `check:fast`（develop，最终 HEAD）：**

```
$ pnpm check:fast
[check:fast] typecheck ✓
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
EXITCODE=0
```

## 四、红线与边界

- 未 push：`origin/exp/resource-ledger` 仍 `beeedc26`，未动。
- 旧线未并入：见 3a。
- 夹带：`cherry-pick 18dc52ea` 按裁定量属本阶段「机检豁免」必要前置（不带它 `--all` 必红 8 项），provenance 已写进报告；我核 `git show HEAD:scripts/ops/check-batch-hygiene.mjs | grep -n EXEMPT_TRAILING_DIRS` → `:44` 常量在位、`:73/:77` 使用点一致。
- 未动 notice、未改 `AGENTS.md`；`68fa0381` 提交面 = BACKLOG、B 卡、E 卡、E 派验单、E 裁定件 5 件。

## 五、观察项（不改判，需处置）

**V-1 `--disk` 作为「豁免没把检查整体关掉」的守卫是空转的。** 干净合并树上 `--disk` 恒 0（该树无未跟踪件、历史违规件全在已豁免的 `archive/`）。我为此补了非空性证据：在 `78d56ea0`（豁免前树，`wt-archive-1119`）跑 `--disk` → **8 项不合规**，正是 `archive/roster/identity-roster.v2.md`、`.v3.1`、`.v3.8`–`.v3.13`；在 `develop` 脏树 → 48/40/39 项。建议 stage 2 起把守卫改成「对豁免前树必须报那 8 项」，比「--disk 仍报历史账」可核。

**V-2 判据 3 内部互相冲突。** 同一条里既有「`test HEAD = origin/…` 退出 0」又有「stage 1 不 push」，在不 push 下前者必红。本阶段靠口头裁定绕过；建议 stage 2 起拆成「机检两绿」（本阶段）与「推送后基线核对」（stage 3/4）。

**V-3 复跑方式与副作用（自披露）。** 执行方交件时已删 `wt-archive-merge`，我为只读复跑建过一棵临时检出 `../qa-stage1`（`git worktree add --detach ce74268f`），跑完 `git worktree remove --force` 删除，`git worktree list` 已无该树。副作用一条：`pnpm check:fast` 的 `prepare` 触发一次依赖安装（12.3s），把那棵临时树的 `node_modules` 由 junction 实体化；该树整体删除，`develop/node_modules` 未受影响。复跑数据因此分两段：`ce74268f` 干净树（`--all` 0 项、`check:fast` 全绿 EXIT=0）与最终 HEAD `68fa0381`（本判词 §一–§三，全部重取）。

**采信限度**：①执行方 pre-commit 留痕不可独立复现，以我复跑替代；②`--disk` 三数属统计口径，不作门禁；③`--all` 读工作区现值，别人正在改的文件会影响结果，故我在干净树与 develop 两端各取一次。

<!-- DONE -->
