执行方：QA · AI writer项目组（群分身）
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-1118-D 首次验收判词（版本件收编 · 82 件清单 ＋ 乙类 47 件移入）

- 判定对象：`CARD-1118-D-version-files.md`｜9,903B｜`3584b0efdec0c0cf97c87c5299cc46f1`｜87 行｜mtime 2026-11-19 12:58:41（含 §七/§八/§九 三组裁定后的现行版）
- 受验 HEAD：`work/reboot-1118` @ `2923090acc32ceb4bc9b9069fb56a0a410415bf9`（= C 卡头，本卡 0 提交）
- 交件：`.batch/night/reports/CARD-1118-D-report.md`｜8,810B｜`37b4335572ca1cae1d8f1f41d7efcb20`｜156 行｜mtime 12:54:37｜末行 `<!-- DONE -->`
- 清单：`.batch/night/org/version-files-inventory-1119.md`｜9,766B｜`7f29d50f2b3d4d65ca85c08cc361d37e`｜118 行
- README：`.batch/night/archive/README.md`｜16,326B｜`4a447ba39859b717c98fb848f17f6e1f`｜114 行｜mtime 12:51:29
- 取数时刻：2026-11-19 13:00–13:20（以下数字落盘后冻结，我自算，不采信任何一方自述）

## 结论：PASS

八条判据全部成立、六条红线零触发。判据 7 在交件报告里贴的是**修前红**（外来红，负责人 §九 裁定七 已修），我按交付状态独立复跑为绿，故按「交付状态的机检结果」判过；建议执行方收口时补贴一行复跑末行（不返工、不构成退回理由）。

## 一、判据逐条（命令原文＋关键输出＋exit）

### 判据 1 · 未离开起点 / 0 提交 —— 成立

```
$ git -C develop log --format='%h %s' -1
2923090a chore(batch): 收编 12 件协作件入索引（CARD-1118-C）
$ git -C develop rev-parse --abbrev-ref HEAD
work/reboot-1118
$ git -C develop rev-list --count 2923090a..HEAD
0
$ git -C wt-1118d log --format=%h -1
f8728c8d
$ git -C wt-1118d status --porcelain | wc -l
0
```

按 §九 裁定五读作「develop HEAD 与开工前一致（`2923090a`）＋ 本卡 0 提交」，成立。

### 判据 2 · 清单覆盖 ＝ 82 —— 成立

README §二 表行数实测 **82**；与清单 79 行 ＋ `staging/identity-copies/` 3 件对齐（清单 §「范围外」已点名 3 件，§七 裁定一 并入）。

### 判据 3 · 分类不重不漏 —— 成立

我按清单表独立解析（不复用执行方脚本）：

```
甲 0 ｜ 乙 48 ｜ 丙 31（顶层）＋3（identity-copies）＝ 丙 34
82 ＝ 甲 0 ＋ 乙 48 ＋ 丙 34
实际移入 47 ＝ 乙 48 − 1（已入库件 p50-fix4-ch03.v1-REBUILT.md）
丁类（引用数 > 0）58 件 —— 我按 README「被引用件数」列复算，58，与报告一致
```

集合差集双向为空：乙类清单 48 条中，被移入的 47 条与 archive 实存**完全一致**，唯一未移项是 `cards/p50-fix4-ch03.v1-REBUILT.md`（`git ls-files --error-unmatch` exit 0，确认 tracked）；「非乙类却被移」0 条。

### 判据 4 · 未删件（改读文件系统实存）—— 成立

```
$ git status --porcelain -- .batch/night | grep -c '^ D'
0
$ 逐件核 82 行（我自写：新路径/原路径是否存在 + stat 字节 === 清单字节）
不符 0 项
```

82 条逐件定位：**47 条只在 archive 镜像路径**、**35 条只在原路径**（丙 34 ＋ 入库件 1），**没有任何一条两处都在或两处都无**。archive 侧保原名保相对结构（`archive/cards|org|review-requests|staging/…`）。

### 判据 5 · 丙类 34 件原地未移 —— 成立

丙 31 顶层逐件 `stat` 字节与清单一致（0 不符）；identity-copies 3 件 `4,252／4,252／4,528B` 实存、与 README 记值一致。

### 判据 6 · README 六段 ＋ 清单条数 —— 成立

六段齐：谁建／何时／用途／保留期限／过期归属（件头五行）＋ 清单（§二）；`grep -cE '^\| [0-9]+ \|'` §二 = **82**，其中「新路径含 `.batch/night/archive/`」**47** 行、「原地保留」**35** 行；B 卡 2 条另在 §一。

### 判据 7 · 机检 —— 我复跑为绿（报告贴的是修前红）

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
EXIT=0

$ pnpm check:fast | tail
[check:fast] typecheck ✓ 17.5s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
EXIT=0
```

红因核实：`.batch/night/org/BACKLOG.md` 交件时为 ` M`（`+47/−0`，mtime 12:24:19，早于本卡首次移动 12:35），末尾 `\n\n` 触发 `trailing-newline`；现 mtime **12:59:56**、13,607B、尾字节单 `\n` —— 确系 §九 裁定七 由负责人修掉，非执行方造成。判据 7 的实质（交付状态机检绿）成立。

### 判据 8 · 报告格式 —— 成立

首行 `执行方：developer`、次行 `model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot`、末行 `<!-- DONE -->`，逐字核过。

## 二、红线（6 条）

| # | 红线 | 实测 |
|---|---|---|
| 1 | push/force/rebase/merge/checkout origin | 未 push：`git status -sb` 仅 `## work/reboot-1118`，`@{u}` = `no upstream configured`；reflog 无新动作 |
| 2 | `git add -A` / `add .` / `-f` | `git diff --cached --stat` 空（0 行），索引零改动 |
| 3 | 删除任何 `.vN` 件 | 全盘 `D` 计数 0；`find .batch/night/archive -type f` = 97（只增不减） |
| 4 | 改已入库件正文 | 唯二 ` M` 是 `cards/CARD-1118-B-fork-close.md`（负责人 4 行状态行）与 `org/BACKLOG.md`（负责人 +47），均非执行方面 |
| 5 | 动 `.gitignore`／两族 `ledger-*`／notice | `git diff -- .gitignore` 空；`ledger-*` 只出现在清单与 README 文本里，无文件改动 |
| 6 | 真名字面量入库 | 报告/清单/README 三件 `C:\Users\`、`C:/Users/` 命中 **0/0/0** |

## 三、勘误与观察（不改结论）

1. **报告 §四 的「历史遗留 24 件（roster 22、org 1、staging 1）」统计口径错**：`org/` 那 1 件就是 B 卡登记的 `ledger-append-1117-hy4flash-auth.v7.md`、`staging/` 那 1 件就是 B 卡的 `rules-review-docs-1116.v2.md`，两件都已登记，不属遗留。实测 archive 全目录 **97 件** ＝ 已登记 50（README 本身 1 ＋ B 卡 2 ＋ 本卡移入 47）＋ **未登记 47 件**：`.vN` 遗留 **22 件（全在 `roster/`）** ＋ **非 `.vN` 老档 25 件**（`1107/` 15、`resume-1114/` 6、`p9-prefix-restart-1113/` 1、`pre-restart-1113/` 1、`P9.json`、`wake-later.json`）。
   → 建议把 B-17 从「roster 22 件补登记」扩为「archive 全量补登记 47 件」，否则非 `.vN` 那 25 件仍无账。
2. **判据 7 交件报告与卡面 §九 不一致**：§九 要求「执行方按修后状态复跑贴末行」，报告 mtime 12:54:37 早于修好时刻 12:59:56，故仍贴红。实质已绿（见上），建议收口时补贴一行。
3. **`??` 现 64 件**（63 文件 ＋ 1 目录 `staging/identity-copies/`），比 §八 记的 50 多 14：差额均为本卡交件后新增的在盘件（本卡卡面与报告、`CARD-1118-D-ruling-request-1119.md`、`CARD-1119-A-*` 卡/派验单/报告/判词、C 卡卡面与判词、`version-files-inventory-1119.md`、`ruling-dispatch-v4-1119.md`、`doubao-cli-investigation-20261119.md` 等），无一件属 82 件清单内的件被「移丢后再出现」。
4. `tmp-dev/d-*.cjs` 三支脚本文件在仓库外，不构成提交面，符合卡面 §五 要求。

## 四、采信限度（写明哪些我没能独立复现）

1. **移动前 md5 无法独立复现**：清单只记字节、archive 是唯一现存副本（丙）/镜像是唯一副本（乙），我只能核「archive 实存字节 === 清单字节」（82/82 一致），md5 前后同只能采信执行方脚本输出。
2. **判据 7 的绿由我复跑取得**，非执行方贴出的末行；报告内那段是修前红的真实记录（我按 mtime/尾字节核过，不是伪造）。
3. README「被引用件数」我用 `git grep -l -F <basename> HEAD -- .` 复算 **82/82 全对**，故 58 这个丁类数可达；但「引用」语义（字符串命中）沿用清单方法，未做语义层核实。
4. 未验证 `archive/` 是否应入库（B-6 待主人裁），本卡按卡面只判 `--all`；`--disk` 参考面上升 48 项属预期，不构成不通过。

## 五、附：我另跑的旁证

```
$ git status --porcelain | awk '{print $1}' | sort | uniq -c
     64 ??
      2  M
$ find .batch/night/archive -type f | wc -l
97
$ find .batch/night/archive -type f | sed 's|.*/||' | grep -c '\.v[0-9]'
71          # 47 本卡移入 ＋ B 卡 2 ＋ roster 22
```

<!-- DONE -->
