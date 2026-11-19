执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-1118-D 报告 · 版本件收编（82 件清单 ＋ 乙类 47 件移入 archive）

- 卡面：`.batch/night/cards/CARD-1118-D-version-files.md`（含 §七 负责人 12:25 裁定、§八 12:3x 裁定）
- 清单：`.batch/night/org/version-files-inventory-1119.md`（9,766B / 118 行 / `7f29d50f2b3d4d65ca85c08cc361d37e`）
- README：`.batch/night/archive/README.md`（16,326B / 114 行 / `4a447ba39859b717c98fb848f17f6e1f`）
- 工作区：`C:/develop/workspace/AI-writer/develop`（分支 `work/reboot-1118`，HEAD `2923090a`，**本卡 0 提交**）；`wt-1118d` 停在 `f8728c8d`、`status` 空、`node_modules` 为 junction（只跑机检，未在其中改文件）
- 结论：**判据 1／2／3／4／5／6／8 绿；判据 7 部分红**——`check-batch-hygiene --all` 与 `pnpm check:fast` 均因 `.batch/night/org/BACKLOG.md` 末行为空行而 exit 1，该红**早于本卡首次移动**（mtime 12:24:19 vs 移动 12:35），来源是他人未提交改动，非本卡造成，详见 §三.1。
- 另有两处**口径偏差**需你裁：实际移入 47 件（卡面写 48）、判据 1 的「起点」在 develop 上不是 `f8728c8d`，详见 §三.2、§三.3。

## 一、做了什么

1. **按 82 收**：79 件四目录顶层 `*.vN`／`*.vN.md` ＋ `staging/identity-copies/bot-session-identity.v2/v3/v4.md` 3 件（丙类）。
2. **乙类 47 件移入 `.batch/night/archive/`**：保原名、保相对子目录（`archive/cards/…`、`archive/org/…`、`archive/review-requests/…`、`archive/staging/…`），只移不删；每件移后回读字节与 md5，82 件中**0 件不匹配**。
3. **丙类 34 件原地保留**（§八 裁定一：A1），README 标「唯一现存副本」，一条未移。
4. **已入库件 1 件原地保留**：`cards/p50-fix4-ch03.v1-REBUILT.md`（见 §三.2）。
5. **README 重写**：六段齐（谁建／何时／用途／保留期／过期给谁／清单），§一 记 B 卡 2 条，§二 记本卡 82 条（47「已移入」＋35「原地保留·未移」），§三 记裁定与改读口径，§四 注意。

## 二、判据逐条

### 判据 1 · 未产生提交、未离开起点

```
$ git branch --show-current
work/reboot-1118
$ git log --format='%h %s' -1
2923090a chore(batch): 收编 12 件协作件入索引（CARD-1118-C）
$ git rev-list --count 2923090a..HEAD
0
$ git -C ../wt-1118d log --format=%h -1 ; git -C ../wt-1118d status --porcelain | wc -l
f8728c8d
0
```

本卡在 develop 只做文件移动与 README 写入，**未提交、未 checkout、未 rebase**。口径问题见 §三.3。

### 判据 2 · 清单行数 ＝ 82

```
$ sed -n '/## 二、CARD-1118-D/,$p' .batch/night/archive/README.md | grep -c '^| [0-9]'
82
```

### 判据 3 · 分类不重不漏

```
甲 0 ＋ 乙 48 ＋ 丙 34 ＝ 82     （脚本实测 d-final.json）
实际移入（乙类中未入库件）47 ；原地保留 35（丙 34 ＋ 入库件 1）
丁类（被已入库件引用）58 件：清单「被引用件数」列 > 0 的行
```

丁类比清单表 56 件多 2（`bot-session-identity.v2.md` 引用 2 件、`.v3.md` 引用 1 件，随 3 件并入而来），已写进 README §三。

### 判据 4 · 未删件（改读文件系统实存）

```
$ git status --porcelain -- .batch/night | grep -E '^ ?D'
（空）
$ node -e '…逐件 82 行：新路径/原路径存在 && stat.size===清单字节 && md5===清单md5…'
badCheck = []      # 82 件全部一致
```

`archive/` 未被 `.gitignore` 放行（`.gitignore:93`），git 对其中文件返回空，故按 §八 裁定二以实存为准。

### 判据 5 · 丙类 34 件原路径仍在且字节一致

```
$ 逐件校验（脚本）: 丙类 34 原路径在且字节一致 34 ；异常 0
```

### 判据 6 · README 六段 ＋ 清单条数

```
$ 六段标题命中数
6
$ 表行数（§二）
82        # ＝本卡收编件数；其中 47 条「已移入」、35 条「原地保留·未移」
$ sed -n '/## 二、CARD-1118-D/,$p' … | grep -c '| `\.batch/night/archive/'
47
```

按 §八 裁定一，清单记 82 条（48 移入＋34 未移）→ 因 §三.2 的入库件，实际为 47 ＋ 35。

### 判据 7 · 机检（**红**，外来）

```
$ node scripts/ops/check-batch-hygiene.mjs --all
.batch/night/org/BACKLOG.md · trailing-newline · 以连续空行结尾（末行是空行）
1 项不合规
[exit 1]

$ pnpm check:fast | tail
[check:fast] typecheck ✓ 18.3s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
.batch/night/org/BACKLOG.md · trailing-newline · 以连续空行结尾（末行是空行）
[check:fast] batch-hygiene 失败（0.2s）。修完再提交。
[exit 1]
```

`--disk` 参考面 48 项（exit 0）：`archive/` 对 `versioned-filename` **未豁免**（实测其中 9 项被点到），与你在 §七 的前瞻一致；因本卡只要求 `--all`，且 `--disk` 上升不算不通过，此处仅备查。

### 判据 8 · 报告格式

首行 `执行方：developer`、次行 model 行、末行 `<!-- DONE -->`（本文件）。

## 三、三处需要你裁

### 三.1 判据 7 的红是外来 —— 不是我改的，我也没有动它

`.batch/night/org/BACKLOG.md` 在本卡开工前就是 ` M` 状态（卡面 §一.3 你写明「旧线上那 2 件 ` M`（B 卡状态行、BACKLOG）由我自己搬」）：

```
$ git status --porcelain | grep -v '^??'
 M .batch/night/cards/CARD-1118-B-fork-close.md
 M .batch/night/org/BACKLOG.md
$ ls -l --time-style=+%F_%T .batch/night/org/BACKLOG.md
mtime=2026-11-19_12:24:19 bytes=13187
$ git diff --numstat -- .batch/night/org/BACKLOG.md
47	0	.batch/night/org/BACKLOG.md
$ tail -c 120 … | od -c | tail -3
… 346 224 271 343 200 202  \n  \n
```

12:24:19 早于我首次移动（12:35 起），+47 行不是我写的，末尾 `\n\n` 也不是我加的。**请你补一个换行**（或明确授权我改这 1 字节，我只删末尾空行、不动正文），我再复跑一次 7 并补贴末行；在此之前我不碰这个文件——它是你的在编件，我改会把你的未提交改动混进来。

### 三.2 实际移入 47 件，不是 48：第 48 件是**已入库件**

`cards/p50-fix4-ch03.v1-REBUILT.md`（2,199B / `41a5579e5a1e508bdd9e33cbe84e413c`，主件 `p50-fix4-ch03.md` 2,346B / `be30d11955af1a0878fc82a36aa4704b`，字节不同 → 乙类）**是 tracked**：

```
$ git ls-files -- .batch/night/cards/p50-fix4-ch03.v1-REBUILT.md
.batch/night/cards/p50-fix4-ch03.v1-REBUILT.md
```

我第一次执行时把它一起移了，`git status` 立刻出现 ` D .batch/night/cards/p50-fix4-ch03.v1-REBUILT.md`——这既撞判据 4「无 ` D`」，也撞红线「本卡只移不删」。我已用 `git checkout -- <路径>` 把它还原到原处，并删掉 archive 里那份我造成的副本（同字节，无信息损失）；现在 `D` 计数 0。

保留它的理由：移一件已入库件＝对仓库做删除，必须有提交与授权，超出本卡「只移不删」范围。**若要按 48 收**，请二选一：①授权我做「移入 ＋ `git rm --cached` ＋ 单独提交（message 由你定）」；②改判据 3 通过线为 47（README 已按 47 记，无需返工）。

### 三.3 判据 1「起点」在 develop 上对不上 `f8728c8d`

develop 现处 `work/reboot-1118` @ `2923090a`（C 卡提交）；`f8728c8d` 是 A 卡线头 / `wt-1118d` 的起点。卡面 §一.3 要求「从 `f8728c8d` 新建 `wt-1118d`」，§七 裁定二又要求「在 develop 原地移」——两棵树不同头。我按裁定二在 develop 移件，`wt-1118d` 只用于机检（未在其中落任何改动，`status` 空）。**请确认判据 1 读作「develop HEAD 与本卡开工前一致（`2923090a`）＋ 本卡 0 提交」**，而不是「HEAD ＝ `f8728c8d`」。

## 四、archive 现状与遗留

- `archive/` 现有 `.vN` 类文件 **71 件** ＝ 本卡移入 47 ＋ B 卡 2 ＋ **历史遗留 24 件**（`roster/` 22 件 `identity-roster.v2/v3.x`、`org/` 1、`staging/` 1）。
- 其中 **`roster/` 22 件从未在 README 登记**（早于 B 卡就在目录里）。本卡范围只到 82 件，我没有扩表；建议另记 BACKLOG（或下一张卡把 archive 全量补登记），需要我出卡就说。
- 未改 `.gitignore`、未碰 `notice`、未碰 `cards/` 之外的两族 `ledger-*`；未 `git add` 任何件（本次全部文件均在 git ignore 区或未跟踪面，无提交动作）。

## 五、脚本

`tmp-dev/d-move.cjs`（首轮枚举＋46 件移入）、`tmp-dev/d-state.cjs`（状态重建、2 件 `.mjs` 补移）、`tmp-dev/d-readme.cjs`（引用数重算与 README 生成）。`tmp-dev/` 在仓库外，不入库。


## 附录 A · 判据 7 修后复跑（负责人 13:00 修 BACKLOG 之后，13:2x 复跑）

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规                       EXIT=0
$ node scripts/check-fast.mjs | tail -6
[check:fast] doc-links ✓ 0.1s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。          EXIT=0
```

判据 7 由「红·外来」转为**绿**；红因由负责人本人修掉（`.batch/night/org/BACKLOG.md` 末尾空行，12:24 追加时留、13:00 改为单换行收尾），本卡未改该文件。

## 附录 B · 勘误（不改变结论）

§四「历史遗留 24 件（`roster/` 22 件、`org/` 1、`staging/` 1）」口径错，采纳 QA 首验勘误：`org/ledger-append-1117-hy4flash-auth.v7.md` 与 `staging/rules-review-docs-1116.v2.md` 就是 README §一 已登记的 B 卡 2 件，不属「未登记」。正确表述：**archive 未登记件 47 ＝ `.vN` 类 22（全在 `roster/`）＋ 非 `.vN` 老档 25**（`1107/` 15、`resume-1114/` 6、`p9-prefix-restart-1113/` 1、`pre-restart-1113/` 1、`P9.json`、`wake-later.json`）；B-17 建议扩为「archive 全量补登记 47 件」。

## 附录 C · 版本身份

本报告在 QA 首验后仅追加本附录（A／B 两节），正文与全部数字未改；追加后字节数见群内交件行。判据 8 的格式要求（首行执行方、次行 model 行、末行 `<!-- DONE -->`）保持不变——末行仍为 `<!-- DONE -->`（见文件末尾）。

<!-- DONE -->
