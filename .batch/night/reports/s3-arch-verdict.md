# QA 首次验收判词 · ARCH S3（状态同步与收口）

- 判词作者：QA · AI writer项目组
- 判词时间：2026-11-23 21:2x（Asia/Shanghai）
- **判定面**：`40c010062adb566413097a152496e0684954ab86`（`git rev-parse HEAD` ＝ `git ls-remote origin refs/heads/exp/resource-ledger`，`git status --porcelain` 0 行，`git rev-list --left-right --count` `0 0`）
- 父链：`40c01006` ← `7426d29a`（S2 判词入库）← `21c43e62` ← `22894f78` ← `5d301150`
- 本笔改动面：`git show --numstat --format='' 40c01006` → `105  0  .batch/night/org/arch-closeout-1123.md`／`16 15  docs/roadmap/ROADMAP.md`（只此两文件）
- 结论：**PASS**（五条判据逐条重核全过）；三条处置表态见 §6，记账三条见 §7。

## 1. 判据① 设计稿三节结论含专有字样、裁定日期与裁定人 —— PASS [static]

判定面文件 `docs/design/architecture/architecture-consistency-design.md`（404 行／27,511B／sha256 `1979aade417bd13c426626f45d7848ef237fa241b08fdcfb48701f8779b2e17a`，`git show HEAD:` 与工作树同值）。

```
$ sed -n '199p;219p;232p' docs/design/architecture/architecture-consistency-design.md
```

- `:199` →「**裁定结论（2026-11-23，主人裁定 1，出处 `.batch/night/org/ruling-arch-1123.md`）：**「散文层（L0／L1 除登记名／L3）不做层间校验…`characters_arch` 按投影校验（校验对象 `deriveRosterStatus()`）」」
- `:219` →「**裁定结论（2026-11-23，主人裁定 2，出处 …）：** 最小锚点**是**「世界观第 4 维的两类登记（空间名 ＋【具名人物登记】行）」；**匹配只做逐字包含、名单空即显式未判**…」
- `:232` →「**裁定结论（2026-11-23，主人裁定 3，出处 …）：** 弧层的可引用实体**是**「结构位 ID 即弧层可引用实体，不建表，**重排报 `UNKNOWN_NODE`**」…」

```
$ grep -c "deriveRosterStatus()" docs/design/architecture/architecture-consistency-design.md   → 2
$ grep -c "匹配只做逐字包含、名单空即显式未判" …                                                → 1
$ grep -c "UNKNOWN_NODE" …                                                                      → 2
$ grep -c "2026-11-23" …                                                                        → 8
```

裁定日期与裁定人：三节行内均写「2026-11-23，主人裁定 1/2/3」＋出处路径 ⇒ **满足**。
边界（不判为缺陷，只记账）：**分钟级时间 20:45 不在设计稿行内**，只见于裁定件 `.batch/night/org/arch-closeout-1123.md:12` 引用与 `.batch/night/org/ruling-arch-1123.md` 抬头。判据原文只要求「裁定日期与裁定人」，故判过；若要求设计稿行内也带 20:45，需另改设计稿（本轮不作要求）。
另：`:219`／`:232` 引号内嵌了 `**…**` 强调，文字未增删改，判为 Markdown 格式（同 S2 判词 §1 边界）。

## 2. 判据② ROADMAP 六条状态与证据句 —— PASS [static]

文件 `docs/roadmap/ROADMAP.md`（sha256 `6bc4eceada4733b329f5c1d45da440888865cb75229756adb001ba8d56e9a7db`，`git show HEAD:` 同值），`git diff --numstat 7426d29a 40c01006` → `16 15 docs/roadmap/ROADMAP.md`。

§1 表 `:32-37` 原文：

```
| L0-ARCH      | L0 | 架构一致性（AC 系）        | 未开始 | 无 |
| L1-ARCH-01   | L1 | 层间一致性校验             | 未开始 | 无 |
| L2-ARCH-01-01| L2 | AC1/S1 层内一致性          | 未开始 | 无 |
| L2-ARCH-01-02| L2 | AC2/S2 层间引用完整性      | 未开始 | 无 |
| L2-ARCH-01-03| L2 | AC3/S3 弧加入后校验        | 未开始 | 无 |
| L1-ARCH-02   | L1 | 候选复审批次（§8·判据⑰）    | 阻塞   | 第四件前置（未定） |
```

- 五行「阻塞 → 未开始」✓（`:32-36`）；`L1-ARCH-02` 保留「阻塞」✓（`:37`），前置格＝「第四件前置（未定）」✓。
- §2 五条证据句改引 ADR-0027 与设计稿行号：`grep -n "未开始" docs/roadmap/ROADMAP.md` → `:116`（L0-ARCH，引 D1/D2/D3＋`:199`／`:219`／`:232`）／`:124`（L1-ARCH-01，引 ADR-0027＋同上三行）／`:132`（L2-01，引 D1＋`:199`）／`:140`（L2-02，引 D2＋`:219`）／`:148`（L2-03，引 D3＋`:232`）✓
- `:156`（L1-ARCH-02）原文保留：

```
- 状态：阻塞｜证据：看板卡标注「动批次身份与证明体系，必须独立设计，不能顺手改」；**依赖第四件前置：批次身份与证明体系（主人 2026-11-23 裁定本轮不做，ADR-0027 D4）**
```

「必须独立设计」逐字未删、只追加 D4 依赖句 ✓。
- 版本与变更表：`:1` `版本：v0.5`、`:3` 变更要点同口径、`:358` 新增 v0.5 行（`354 v0.1`／`355 v0.2`／`356 v0.3`／`357 v0.4` 顺序未乱）✓；§6 未动（`:337`「6 条已决 3 条…剩 2 条：4、5」、正文四条结论格与 v0.3 一致）✓。

## 3. 判据③ 看板四张卡 `updatedAt` 与板 `revision` —— PASS [live]

我用 `task_board_list` 直读（非采信报数）：

```
board.revision = 936
counts = { backlog: 3, todo: 11, running: 2, done: 140, failed: 1, archived: 1 }
```

| 卡 | 直读 `updatedAt` | 报数 | 卡面要点（原文摘） |
|---|---|---|---|
| `a7589d74-121a-4a93-b5e5-befd5e260c11` | `1795439295249` | 同 | 「**前置已解除**（2026-11-23 主人裁定 1…`architecture-consistency-design.md:199`）…本卡可开工」＋末尾「标注：⏸ 时机后移（非阻塞）」**原样保留** |
| `4027dbef-b5b2-4725-bc51-7b47e558ccd2` | `1795439302927` | 同 | 前置句在纪律段前，三条纪律（「只查具名／放过指代／宁可漏报」）原句未动；标注行「前置已解除（2026-11-23 主人裁定 2），可开工」 |
| `ed210a27-4a31-4b72-b46d-4f572aaa914c` | `1795439311452` | 同 | 原「⚠️ 前置：第五层（弧）要有稳定形状」段已换为裁定 3＋`UNKNOWN_NODE`；「现状核对（2026-11-03）」段**保留**；标注行「按『接线』估工，不再是『被第五层阻塞』」 |
| `6be33a2b-161c-446e-9dbd-95382e570c8b` | `1795439320677` | 同 | 「⚠️ 风险…必须**独立设计**，不能顺手改」＋「标注：需独立设计」原样保留，追加「主人 2026-11-23 裁定本轮不做（ADR-0027 D4）…」 |

四张 `executionCount` 均为 `0` ⇒ 改写未触发执行记录，无副作用。卡面替换原文与收口件 §2 逐字对得上（含 `UNKNOWN_NODE`、`arc-node.ts:251` ← `:238` ← `:449` ← `architecture.command.ts:812` 链条）。

## 4. 判据④ 我自跑 `check:fast`＋porcelain 0＋HEAD == ls-remote —— PASS [static]

```
$ node scripts/check-fast.mjs; echo "CF_EXIT=$?"          # 判定面 40c01006
[check:fast] typecheck ✓ 18.2s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.4s
doc placement: 扫描 440 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.6s
[check:fast] 全部通过。
CF_EXIT=0

$ git rev-parse HEAD
40c010062adb566413097a152496e0684954ab86
$ git ls-remote origin refs/heads/exp/resource-ledger
40c010062adb566413097a152496e0684954ab86	refs/heads/exp/resource-ledger
$ git status --porcelain -uall | wc -l
0
$ git rev-list --left-right --count HEAD...origin/exp/resource-ledger
0	0
```

四项全满足，两行 sha **逐字相等**。`check:fast` 为我在判定面上现跑（`18.2s`），不是引收口件的 `21.7s` 旧读数。

留痕：以上 porcelain `0` 读数取自写本判词之前；本判词落盘后 `git status --porcelain -uall` 为 1 行 `?? .batch/night/reports/s3-arch-verdict.md`（本件自身未跟踪，待入库），与判据无关。

## 5. 判据⑤ 收口件 §0 对账与 §1–§4 —— PASS，记账两条

文件 `.batch/night/org/arch-closeout-1123.md`（105 行／8,241B／sha256 `3575a170d4c35446572a476ea9c48acc06806a9dcf52f1f6e82634128c2328db`，`git show 40c01006:` 同值，入库本笔）。

§0 对账表五行与 Goal 原文顺序一致（①设计稿②ROADMAP③看板④check:fast／porcelain／HEAD⑤本件原文），逐条落点可核：

| # | 判据 | 收口件落点 | 我核 |
|---|---|---|---|
| ① | 设计稿三节含裁定日期与裁定人 | `:12` | ✓（本件 §1；分钟级 20:45 只见裁定件，见 §1 边界） |
| ② | ROADMAP 六条更新 | `:13` | ✓（`16 15` 与我复算一致） |
| ③ | 看板四卡替换 | `:14` | ✓（四 `updatedAt`＋revision 936 与我直读一致） |
| ④ | `check:fast`／porcelain／HEAD == ls-remote | `:15`、`:71-98` | ✓ 值已由本判词 §4 闭合；文件内仍是「推送点快照（待推）」写法 |
| ⑤ | 本件给出上述原文 | `:16` | ✓ |

§1（六条逐条改前/改后）、§2（四卡替换原文＋`updatedAt` 表＋差异说明）、§3（设计稿／ADR 行号／裁定件／S2 判词入库 `7426d29a`）、§4（命令原文）均与实际对得上。§5 边界段（「未动」／「未做」）与 `git show --numstat` 一致：除 ROADMAP 与本件外无第三文件被改。

记账两条（不阻塞）：
1. **§4 是写就时快照**：`:87` `HEAD 7426d29a`、`:95` `5d301150`、`:76` `typecheck 21.7s`。判据「HEAD == ls-remote」以本判词 §4 的两行相等读数为准；按 admin 处置③（不改文件以免自指）**不作退回**，只在本判词留痕。
2. **§2 `:58` 板计数少列一项**：写「`revision` 936（backlog 3／todo 11／done 140／failed 1／archived 1）」，我直读另有 `running: 2`（板合计 158）。建议下次改动时补「running 2」，本轮不改。

## 6. 对三条处置的表态（admin 要判词逐条答）

1. **§0 编号按 Goal 原文顺序重排**（原稿 ROADMAP 记 ①、设计稿记 ④）——**同意**。Goal done-when 的列举顺序就是 ①设计稿②ROADMAP③看板④check:fast／porcelain／HEAD⑤收口件原文；现表逐行内容未丢（五行判据文字与落点一一对应，我在 §5 表里逐条对过），按原文顺序排更利于对号。**不构成退回理由**。
2. **§2 两处措辞差异**（`4027dbef` 前置句与三条纪律并排、`ed210a27` 只换前置段保留 2026-11-03 核对段）——**接受**。判据要求是「阻塞说明替换」，不是「整段重写」；我直读确认三条例律原句仍在（`4027dbef`：「只查具名」「放过指代」「宁可漏报」）、`ed210a27` 的 2026-11-03 现状段仍在 ⇒ 既有信息零丢失，替换文案与收口件 §2 一致。**不构成退回理由**。
3. **§4「推送点快照，待推」不再改文件**——**同意**。推送后若回写文件，会产生新 commit 使「HEAD == ls-remote」再次失效（自指）；以判词 §4 的两行相等读数闭合是正确做法，且文件自身 `:98` 已写「推送完成后…本行即闭合」。**不构成退回理由**。

## 7. 未判与边界

- **不判** AC1／AC2／AC3 的实现与接线（Goal 规则：本 Goal 只解阻塞）。
- **不判** 卡面 `status` 是否应从 `backlog` 改 `todo`（Goal done-when 只要求替换阻塞说明；ROADMAP 状态「未开始」与卡 `backlog` 不矛盾）。
- **不判** `L1-ARCH-02` 第四件前置的取舍（主人已裁本轮不做，属 D4 范围）。
- 终审归项目总负责人；本判词只覆盖判据 ①–⑤，对象 `40c01006`，旧判定面（`7426d29a` 及更早）的结论不承继到本 sha。
