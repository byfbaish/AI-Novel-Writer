# PLANUI 收口件（S5 · 2026-11-25）

> 派单方：大肥鱼（群 admin）。主笔：项目总负责人。清单正本 `.batch/night/staging/s5/s5-checklist.md`（63 行／5,388B／sha256 `6443ba45…`）。
> 判定面：wt-2 `card/s4-o1-event-progress`，HEAD `85c927aef374dd92475a3b145fb3d52aa1f53c32`。本轮**未动 `src/` 任何文件**。

## 0. 一句话结论

C1／P6／O1 三题八笔提交全部落盘、QA 判词全 PASS、三卡在看板已 `done`；本笔把 ROADMAP 四条 L2 转「达标」并删掉旧阻塞证据行、把三题记入 BACKLOG、把八笔提交与三份判词记入台账，同时按实现订正两处设计稿（C1 `source_revision` 语义、O1 §3.2／§3.4 口径）。**S5 尚未 done**：⑥ 要求 HEAD ＝ `ls-remote`，需主身推送。

## 1. 改了什么（逐处行号）

### 1.1 `docs/roadmap/ROADMAP.md`（18/15）

| 位置 | 改动 |
|---|---|
| `:1`–`:2` | 版本 v0.6 → **v0.7**，日期 2026-11-24 → 2026-11-25 |
| `:3` | 变更要点换成 PLANUI 收口（含判定面 sha、判词、测试数、删阻塞证据行、父级达标签字待主人）；原 v0.6 要点降为「变更要点（上一版 v0.6）：」，后续各版顺次 |
| `:41`／`:42` | `L0-PLANUI`、`L1-PLANUI-01` 阻塞 → **进行中** |
| `:43`–`:46` | 四条 L2 阻塞／未开始 → **达标**（`L2-PLANUI-01-01` O1、`-02` C1 相关性筛选、`-03` C1 重生成前提示、`-04` P6） |
| `:168`／`:176` | §2 的 L0／L1 状态行：原「阻塞」证据句（O1 等契约裁定、P6 等作者定档位）删除，改「四条 L2 已于 2026-11-25 全部达标」＋父级达标签字待主人（`roadmap-doc-spec.md` §5 第七项） |
| `:184`／`:192`／`:200`／`:208` | §2 四条 L2 状态行：原「阻塞／未开始」证据句删除，改判定面 sha＋判词路径与 sha256＋测试数与变异口径＋写回落点＋「合并 sha：未合并·待主身」 |
| 变更表末尾 | 追加 v0.7 行 |

条目正文（目标、完成判据、§6）一字未改。

### 1.2 `docs/plans/prompt-assembly-backlog.md`（23/3）

- `:9`–`:31` 新增 `## ★ 2026-11-25 PLANUI 收口（C1 / O1 / P6 三题已完成；两条建议只登记不排期）`：内有「### 已完成（2026-11-25）」四行表（C1①、C1②、P6 档1+档3、O1，各带落地内容／判定面／判词／下一步）与「### 建议（只登记，不排期，等作者定档位）」两条（P6 超限静默无提示、C1 `picked` 不随筛选剪枝）。
- `:888`（#14 C1）、`:890`（#16 O1）、`:895`（#22 P6）三行行末各加一句落地指针（指向本节），**条目正文未改**。
- 位置说明：该文件没有全局「已完成／建议」段，顶部是按日期倒序的 `## ★ <日期>` 段（`:33` 即已有的 2026-11-04 A-1 段），故按同一体例在最前面加一节，而不是另造一种段型。

### 1.3 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md`（1/1）

- `:130` `source_revision` 语义按实现订正：原写「覆盖前的 roster `revision`」，实现是「这次覆盖**产出**的版本号」——代码注释原文「若记成覆盖**前**的版本号，正常回退永远判 stale，逐字段回退一个都用不了」（`src/shared/character-regeneration-diff.ts:49-54`）。

### 1.4 `docs/design/architecture/o1-unit-event-progress-design.md`（28/14）

- §3.2 标题与正文重写：分母由「该章落盘时已写章数 `N`」改为**本批章数 `b`**，并引入批次起点偏移 `s0`；区间 `[floor(s0 + j·(M-1-s0)/b), ceil(...)]`；附三例实算表（`s0=0,M=4,b=10` → 末章 `[3,3]`；`s0=3,M=4,b=10` → 全程 `[3,3]`；`M=6,b=3` → `[1,2]/[3,4]/[5,5]`）与「冻结 `from`／`b`／`M`／`s0`／声明值」说明。
- §3.4 四条不变量改写成 `lo(j)`／`hi(j)` 形式，判定范围改「分母与偏移用该章落盘时冻结的 `b`／`s0`」；EV-1 补「本批走到终态的前提是 `b ≥ M-1-s0`」。
- 旧稿 `N` 口径为什么错，写在 §3.2 开头：单章一批时 `k` 与 `N` 同步增长，`floor(k·M/N)` 恒等于 `M`，而合法编号只到 `E(M-1)`。

### 1.5 `.batch/night/reports/task-ledger.md`（13/0）

- 末尾追加 `### 22. PLANUI 落地（S2–S4 收口登记，2026-11-25）`：三卡结论表（判定面／判词／测试／合并 sha 未合并）＋八笔提交链＋十二条记账的指针。历史条目未改。

## 2. 三张卡 → 证据对照（清单 §A）

| 卡 | 提交 | 判词 | 测试 |
|---|---|---|---|
| `744f13a8`（C1） | `34aa0000`＋`41daa79c`＋`8a42a566` | `s2-c1a-qa-verdict.md`（167 行／10,390B／`30dc2d57…`）；`s2-c1b-verdict.md` **v2**（143 行／15,110B／`855bd843…`） | `Tests 22 passed (22)`＋browser `5 passed`；变异 M2／M4／M5 真红 |
| `342b428f`（P6） | `e219977b`＋`a1bcabee`＋`cbbe82c3` | `s3-p6-verdict.md`（160 行／14,217B／`3665ffd0…`） | browser `38 passed` |
| `58188c1c`（O1） | `641ffc0c`＋`85c927ae` | `s4-o1-verdict.md`（113 行／14,691B／`4e9b88c7…`） | `Tests 42 passed (42)`／三文件 `106 passed (106)`＝基线 97＋9 |

## 3. 记账十二条（清单 §C，一条不漏）

1. **两次外派越线**：豆包自行 `git commit` 两次 —— `41daa79c`（2026-11-24 17:17:08）、`8a42a566`（17:38:07，发生在 17:33 转达「只写盘、提交由联络人做」之后）。只登记，不改历史、不 amend。
2. **C1-b 判词用 v2**（`855bd843…`，143 行／15,110B）；v1 `1abdf4bf…`（138 行／14,660B）作废，不引用。
3. **J8 缺实机半**：无窗口实机证据，由同进程 SELECT 原文＋`live-evidence.json` 替代；本卡按 [mock]＋[live] 复合判，另开卡补实机。
4. **P6 超限静默无提示**：区间超 10 章只禁用提交按钮、无文案；进 BACKLOG 建议段第 1 条。
5. **豆包 S4 回执未落盘**（`C:\tmp\c1-s2\doubao\s4-o1\` 目录未建），由联络人抄录 `receipt-to-owner.md`（172 行／12,329B／`d96dea1e…`，首行标 `[抄录]`）；不追认为执行方回执。
6. **循环 import 技术债**：`src/shared/arc-position.ts:2` ⇄ `src/shared/o1-event-progress.ts:39`（`splitMinorSteps`）；两处都只在函数体内调用、无顶层执行，本卡接受；断环需改 `unitEventSteps` 入参形状。
7. **`startStep` 未钳 fail-open**：`architecture.command.ts:3668` 传 `lastDeclaredStep(...) ?? 0` 没钳，`o1-event-progress.ts:104` 在 `startStep > stepCount-1` 时 `return null` ⇒ 越界时整批进度行静默消失（无错值、无提示）。建议在 `arc-position.ts:1362` 附近钳到 `[0, stepCount-1]`。
8. **`t84789` 来源**：本卡实测自证，缺独立出处；未在本笔补出处，判据措辞亦未改。
9. **pre-commit 钩子缺 `CARD-xxxx` 只提醒不拦**：记工具链待办，不追改历史提交。
10. **C1 `picked` 不随筛选剪枝**：先勾选、再切换筛选，勾选仍在，可能对「不相关」角色提交重生成；属既有语义、非本卡引入，进 BACKLOG 建议段第 2 条。
11. **P6 派单与实施包措辞不一致**（「除这些行以外」那句）：实施包要求原样，不记红，只记瑕疵。
12. **J4c 括号算例勘误**：`.batch/night/staging/s4-o1/erratum-01.md`（27 行／1,824B／`91251e53…`）——`s0=0,M=4,b=2,j=1` 实算 `raw=1.5` ⇒ `[1,2]`，判据不变；实现侧测试断言的是 `{2,2}`，说明实现算对、是包写错。

## 4. 三行闸原文（清单 §D）

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 37.6s
doc links: checked 1472, broken 0
[check:fast] doc-links ✓ 3.3s
doc placement: 扫描 443 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 5.7s
[check:fast] 全部通过。
CF_EXIT=0
```

```
git status --porcelain -uall   → 25 行（5 个 M ＋ 20 个 ??，全部在 docs/ 与 .batch/night/ 内）
git rev-parse HEAD             → 95a30ae6c406fa898636f88456eafb8c73bb6891
git ls-remote origin refs/heads/exp/resource-ledger
                               → f2fd6d047830ccadfeb2082f05a642cbe79bc8cf	refs/heads/exp/resource-ledger
```

提交后读数（本笔落盘）：`git status --porcelain -uall` → **0 行**；本笔为 S5 收口笔（旧头 `95a30ae6`），文件与行数以 `git show --numstat --format= HEAD` 为准（本文件自身在该笔内，故不在此自引 sha 与合计行数）。

⑥ 现在**不成立**：HEAD（`95a30ae6`）≠ 远端（`f2fd6d04`）。卡分支八笔提交尚未并入 develop，本笔文档提交也尚未推送；两者都由主身做。待主身推送后由产品经理回填合并 sha 与本行读数。

## 5. 边界与未做

- 未动 `src/`；未动缺陷稿、ADR、看板卡面（三卡 `done` 由 admin 置）；未改 `BACKLOG.md`（`.batch/night/org/BACKLOG.md` 属另一份台账，本 Goal 未授权）。
- 合并与推送归主身：合并 sha 一律写「未合并·待主身」，推送后由产品经理回填。
- 溯源：`L0-PLANUI`／`L1-PLANUI-01` 不代签「达标」——父级达标须主人签字（`roadmap-doc-spec.md` §5 第七项），本版只把阻塞转「进行中」。
