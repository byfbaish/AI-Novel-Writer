# S1 收口首验判词（QA）

- **判定面 HEAD**：`f29891622c2461e4cdffe51341ae036ca9d57c7c`（链：`ba288fce` → `fce98a99` → `355fe804` → `f2989162`）
- **入库合并 sha**：未合并·待主身（远端 `exp/resource-ledger`＝`355fe804`，本地领先 1 笔；push 归主身，本判词不构成 push 许可）
- **对象文件**：`docs/roadmap/ROADMAP.md` 357 行／21,175B／sha256 `d892cb0ecc268b090e95a81298c2b5834d002c5c0eee7934858276205b8d0342`
- **改动量**：`f2989162` ＝ `2 2`（`git show --stat` → `1 file changed, 2 insertions(+), 2 deletions(-)`）；`fce98a99` ＝ `6 5`；`355fe804` ＝ `2 2`；累计对 `ba288fce` ＝ `10 9`
- **派单**：群 Goal stage 1「S1 收口：ROADMAP v0.4 修正落地＋看板去 Roadmap 镜像 Tag」
- 判定面一律以 `f2989162` 复读；`fce98a99`／`355fe804` 只作过程留痕，不作判定面。

## 1 四条 acceptance 逐条

### ① ROADMAP v0.4 四处修正 [static] PASS

| 项 | 原文（`f2989162` 工作树） | 我方复核 |
|---|---|---|
| `:91` 合并 sha | `合并 sha：D18 `89868921`（卡分支 `7b48f074`）、D15 `64793246`（卡分支 `f95ed1da`）` | `git rev-list --parents -n1 89868921` → `89868921… 64793246… 7b48f074…`；`64793246… c067c3dd… f95ed1da…`；两提交 `git merge-base --is-ancestor <sha> HEAD` 均 **yes** |
| §0 ② 当次读数（`:14`） | `② 看板未结卡（backlog 3／todo 12 = 15 张，取到 2026-11-23 revision 923，`task_board_list` 当次读数）` | 我直读 `task_board_list` → `revision 931`、`backlog 3 / todo 12 / done 139 / running 2 / failed 1 / archived 1`；计数逐项相同（rev 前进来自其后看板操作，不改计数） |
| `:73` 判据收窄 | `（D1–D18 范围内 `🟡` = 0；D20 属「结项不验」，不计入）` | 变更表 `:357` 记了原文理由（D20 为作者 2026-11-06 裁的「🟡 结项（不验）」）＋「判据强度不变、只把范围写明」，与 `:73` 一致 |
| `:14` 刷新 | 同上 | 同上 |

### ② `task_board_list tag=Roadmap` 返回 `total: 0` 并贴前后原文 [live] PASS

- **删前**（我 18:04 自取，`revision 923`）：默认 `"total": 5`，id ＝ `23433174`／`76273d1a`／`2a8b0b0d`／`4ee6b83e`／`19bd077a`；`includeArchived:true` → `"total": 6`（第六张 `3aabf83a`，S6·P54 发版，已归档）。
- **删后**（我 18:0x 自取，`revision 928` 与 `931` 两次）：默认 `"total": 0`；`includeArchived:true` → **`"total": 0`**（归档卡 Tag 已由主身走 `restore → 去 Tag → archive` 清掉，`AI writer项目组` 保留，卡面其余字段未动）。
- 结论：两种口径均 0，**PASS**；v0.4 `:3`／`:357` 对「6 处已清、`total 0`（含 `includeArchived`）、revision 931、18:10 由主身执行」的登记与实况逐字相符。

### ③ `pnpm check:fast` EXIT=0 [static] PASS

我方在 `f2989162` 自跑 `node scripts/check-fast.mjs`，原文：

```
[check:fast] typecheck ✓ 16.6s
doc links: checked 1467, broken 0
[check:fast] doc-links ✓ 0.1s
doc placement: 扫描 439 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
EXIT=0
```

### ④ porcelain 0 行 ＋ HEAD／ls-remote 原文 [static] PASS（含一条本判词自身的未跟踪件）

```
git status --porcelain -uall
?? .batch/night/reports/s1-collect-verdict.md      ← 本判词，交件物，待 admin 入库
git rev-parse HEAD                                  → f29891622c2461e4cdffe51341ae036ca9d57c7c
git ls-remote origin refs/heads/exp/resource-ledger → 355fe804a1f174bfb568cbdb3f0e3b17684b2c5f
```

- 除本判词一行外，工作树无任何未提交改动（`git diff --numstat` 空、`git diff --cached --numstat` 空）；交件方在 `f2989162` 落盘后工作树干净，**PASS**。
- 本地领先远端 1 笔（`f2989162`），**push 归主身**——符合「群分身只到 commit」，非缺陷。

## 2 过程留痕（两轮自查的瑕疵，均已闭合）

| # | 位置 | 瑕疵 | 闭合 |
|---|---|---|---|
| 1 | `fce98a99` `:3`／`:357` | 写「清掉 6 张卡（含归档卡）」，实为 5 张（归档卡只读未删） | `355fe804` 改「5 张 done 卡（五个 id 全列）＋归档卡登记为残留」 |
| 2 | `fce98a99` 变更表 | v0.4 行插在 v0.3 之前，版本序乱 | `355fe804` 排回 `354 v0.1 / 355 v0.2 / 356 v0.3 / 357 v0.4` |
| 3 | `355fe804` `:3`／`:357` | 事实已变（主身 18:10 把归档卡 Tag 也清了，`includeArchived` 0），doc 仍写「本组不动、登记为残留」 | `f2989162` 改为「共 6 处已清、`total 0`（含 `includeArchived`）、由主身 18:10 执行」 |

## 3 结论

**S1 首验 PASS**——四条 acceptance 全部满足，无遗留待改项。

- 判 PASS 前的三核自查：①新增内容能对上编号（`:91`／`:14`／`:73`／`:357` 均可指到原文行）②每条判据能指到命令或原文（本件 §1）③无「待改／已核」这类未定档字样（`grep` 全表无）。
- 本判词不含：push 授权、S2 派卡与 S2 判据、archive 字节与 MANIFEST 97 件（本阶段未触碰，`git show --stat` 仅 `docs/roadmap/ROADMAP.md` 一文件）。
