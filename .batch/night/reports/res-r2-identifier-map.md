# CARD-1125-R2 §2.2 · `arc` 类标识符 → 语义对照（只读清单）

- 出件：developer ｜ 2026-11-25 ｜ 只读、未改 `src/` 一个字、未 `git add`／未 commit／未 stash
- 归属：**本件属 CARD-1125-R2 供料，提交归属不在 developer**（R1 交付头可引本路径作归属行，与 R1 判据无关）
- 用途：供产品经理在 R2 落表；也回答「术语只在文档统一、代码仍叫 arc」到底还剩多少处
- 取数时刻：**2026-11-25 20:54–20:59**（`src/` 只读 grep ＋逐处回读原文，同一窗口内完成）；本件与 `scripts/` 三件脚本线无关，脚本 sha 再变也不影响本件
- 基线：`git rev-parse --short HEAD` → `435fa002`；`git status --porcelain -uall` 5 行（4 M ＋ 1 ??，均非本件；本件是第 5 行之后的 `??` 新增）

## 0. 命令原文（全部只读）

```
# ① 标识符清单（`arc` 子串、排除 `arch` 开头、排除 __tests__、只取声明行）
grep -rnE "^\s*(export )?(async )?(function|const|let|type|interface|class) [A-Za-z_$][A-Za-z0-9_$]*" src --include=*.ts
# ② 词频与首现（用于确认没有漏掉的、只在参数/局部变量里出现的标识符）
node -e '…遍历 grep -rnoE "[A-Za-z_$][A-Za-z0-9_$]*"，过滤 /arc/i 且非 /arch/i…'
# ③ 两个点名标识符的全部调用点
grep -rn --include=*.ts "arcSpanForUnit\|findArcCoverRisks" src
```

词频首现（②的输出，前 8）：`parseArcStructure` 95／15 文件、`arcSpanForChapters` 37／6、`parseChapterArcCovers` 31／7、`arcPlan` 29／6、`findArcCoverRisks` 27／3、`arcWeight` 25／4、`renderArcPositionBlock` 23／2、`listArcNodes` 21／5。

## 1. 术语对照（先给尺子，表里不再重复）

| 代码里的词 | 文档／v7 的词 | 真实层级 |
|---|---|---|
| `major` / 大弧 | 卷 / volume | 第一层 |
| `mid` / 中弧 | 单元 / unit | 第二层（v7 的最细层） |
| `minor` / 小弧 | （v7 没有） | 三级结构独有的第三层 |
| `field`「转折」 | v7 的等价物是「逼法」 | 单元内的一次性节点 |
| `ArcNode` 的 ID | 结构位 ID | `M1`／`M1-2`／`M1-2/转折`／`M1-1/小弧:纸门牌` |

`naming: 'volume'` 只影响渲染措辞，**不影响解析、折算、定位**（`arc-position.ts:143-151`）。

## 2. 解析与折算层 `src/shared/arc-position.ts`

| 文件:行 | 标识符 | 它现在真实表达的东西 |
|---|---|---|
| `src/shared/arc-position.ts:41` | `ArcMinor` | 小弧（三级结构第三层，`chapters` 自 P18 起可选） |
| `src/shared/arc-position.ts:62` | `arcWeight` | 一条弧参与区间折算的权重：有章数用章数，没有等权 1（P18：篇幅只算个数、不定内容） |
| `src/shared/arc-position.ts:73` | `minorRanges` | 小弧清单 → **中弧内**章号闭区间；与 `listArcNodes` 共用，防两处折算漂移 |
| `src/shared/arc-position.ts:96` | `splitMinorSteps` | 小弧内容按 `→` 切事件步；P18 已撤回「逐章进度上限」用途，现只喂体检 |
| `src/shared/arc-position.ts:105` | `ArcMid` | 中弧＝v7 的「单元」，含 `fields` 与 `minors` |
| `src/shared/arc-position.ts:119` | `ArcMajor` | 大弧＝v7 的「卷」，含 `endState`（卷末验收标准）与 `mids` |
| `src/shared/arc-position.ts:132` | `ParsedArcStructure` | 解析结果的容器：`majors[]`／`declaredTotal`／`declaredChapters`／`naming` |
| `src/shared/arc-position.ts:154` | `ArcSpan` | 「某段章号落在哪个卷/单元」+ 本批之后还剩哪些单元（`remainingMids`） |
| `src/shared/arc-position.ts:281` | `parseMinorArcs` | 从「小弧」字段值里切出多条小弧声明 |
| `src/shared/arc-position.ts:333` | `parseArcStructure` | 把 `plot_structure_plan` 的 markdown 解析成结构；无可用结构恒 `null`（fail-open，不报错） |
| `src/shared/arc-position.ts:419` | `isTwoLevelArcStructure` | 是否「卷/单元」两级（每卷都有单元、且单元无小弧） |
| `src/shared/arc-position.ts:431` | `scaledBoundaries` | 章数→累积边界的**唯一**折算实现（含等比折算与严格递增），`arc-node.ts` 复用 |
| `src/shared/arc-position.ts:460` | **`arcSpanForUnit`** | 按「第几卷·第几个单元」推算该单元的章号区间；**只用于文本投影**，不参与任何状态判定；越界/不可解析返回 `null` |
| `src/shared/arc-position.ts:488` | `arcSpanForChapters` | 按章号范围 `[from,to]` 定位卷/单元（含跨单元、剩余单元、下一单元边界） |
| `src/shared/arc-position.ts:1002` | `arcStructureNeedsRescale` | 结构自报总章数 ≠ 全书章数时，注入文本要不要声明「已等比折算」 |
| `src/shared/arc-position.ts:1053` | `projectArcStructureText` | 弧光文本**分级裁剪**（本批单元全字段／本卷其他单元一句话／其他卷只留接续理由），只删不改 |
| `src/shared/arc-position.ts:1122` | `withArcPositionGuide` | 旧注入口：不裁剪，直接拼弧位块（已被下面的投影版取代） |
| `src/shared/arc-position.ts:1140` | `withProjectedArcGuide` | 大纲步骤的**章号制**唯一注入入口：先裁剪再拼块 |
| `src/shared/arc-position.ts:1164` | `isTurnField` | 「转折」（v7 为「逼法」）判定，是唯一能按章认领的字段——渲染清单与审计共用 |
| `src/shared/arc-position.ts:1174` | `renderArcPositionBlock` | 【本批所处弧位】硬约束块（**按章号**：第 X–Y 章） |
| `src/shared/arc-position.ts:1350` | `renderUnitArcPositionBlock` | 逐单元块（**按游标**：不写章号区间、不列「覆盖：」清单、不写小弧章数） |
| `src/shared/arc-position.ts:1423` | `withProjectedUnitArcGuide` | 单元模式的唯一注入入口（裁剪＋单元块） |

## 3. 结构位与覆盖对账 `src/shared/arc-node.ts`

| 文件:行 | 标识符 | 它现在真实表达的东西 |
|---|---|---|
| `src/shared/arc-node.ts:66` | `ArcNodeKind` | 结构位粒度：`major`／`mid`／`field`（整段规格）／`minor` |
| `src/shared/arc-node.ts:68` | `ArcNode` | 一个结构位：稳定 ID ＋折算后章号区间 ＋所属卷/单元 ＋原文 |
| `src/shared/arc-node.ts:88` | `ArcCoverViolation` | 覆盖违规：`INV-1-OUT_OF_RANGE`／`INV-2-DUPLICATE`／`INV-3-UNCOVERED`／`UNKNOWN_NODE`／`COARSE_NODE`／`NOT_CLAIMABLE` |
| `src/shared/arc-node.ts:104` | `listArcNodes` | 把结构摊平成结构位清单（卷→单元→字段/小弧），ID 形如 `M1-2/转折` |
| `src/shared/arc-node.ts:180` | `findArcNode` | 按 ID 取结构位 |
| `src/shared/arc-node.ts:196` | `isClaimableArcNode` | 能否出现在「覆盖：」里：只有「转折」与小弧（因果/时序等整段规格不算） |
| `src/shared/arc-node.ts:207` | `isOneShotArcNode` | 是否一次性额度（只有「转折」）：INV-2 只对它生效，小弧可多章认领 |
| `src/shared/arc-node.ts:217` | `arcNodesForChapter` | 本章所属单元及其下全部结构位（可列举「这一章能兑现什么」） |
| `src/shared/arc-node.ts:238` | `validateArcCovers` | 单章声明校验（越界/未知/粒度太粗/不可认领）；跨章重复不在此函数 |
| `src/shared/arc-node.ts:325` | `ChapterArcCover` | 大纲里一章的「覆盖：」声明（章号、章名、ID 列表、行号） |
| `src/shared/arc-node.ts:359` | `parseChapterArcCovers` | 从大纲正文解析每章声明；只认章标题正下方第一行 |
| `src/shared/arc-node.ts:391` | `ArcCoverAudit` | 一批（`from..to`）的对账结果（违规＋漏覆盖） |
| `src/shared/arc-node.ts:430` | `isUncoveredCandidate` | 「什么算漏」：转折过了本批末尾才算漏，小弧只要与本批有交集就算 |
| `src/shared/arc-node.ts:439` | `auditArcCovers` | 跨章对账（INV-2/INV-3），生产调用点只有 `architecture.command.ts:813` |

## 4. 一致性预检接入 `src/shared/arc-cover-consistency.ts`

| 文件:行 | 标识符 | 它现在真实表达的东西 |
|---|---|---|
| `src/shared/arc-cover-consistency.ts:13` | `ARC_COVER_KEY_PREFIX` | 豁免键前缀 `arc:cover:` |
| `src/shared/arc-cover-consistency.ts:16` | `arcCoverStableFactKey` | 豁免键（**不含章号**：同一格的问题一次豁免全书生效） |
| `src/shared/arc-cover-consistency.ts:20` | `ArcCoverScope` | 判据输入：章号＋`plot_structure_plan`＋`synopsis`＋`total_chapters` |
| `src/shared/arc-cover-consistency.ts:95` | **`findArcCoverRisks`** | 单章弧层引用是否闭合：四条守卫全 fail-open（章号/总章数非法、无结构位、本章无 `covers`）→ 译成 `ConsistencyFinding` |

**`findArcCoverRisks` 生产调用点只有一处**：`src/services/consistency-preflight.ts:90`（`arcLayer` 由 `:14` 导入）。测试在 `src/shared/__tests__/arc-cover-consistency.test.ts`。

**`arcSpanForUnit` 生产调用点三处**，全在同一文件：`src/shared/arc-position.ts:1358`（`renderUnitArcPositionBlock`）、`:1433`（`withProjectedUnitArcGuide`）、`:1661`（`auditTwoLevelDensity` 的拍子跨度检查）。测试在 `src/shared/__tests__/unit-arc-position.test.ts`。
其上游入口：`src/services/workflows/commands/architecture.command.ts:3661`（`withProjectedUnitArcGuide`）／`:3670`（`withProjectedArcGuide` 的章号制分支）／`:4260`（另一处 `withProjectedArcGuide`）。

## 5. 树视图 `src/shared/arc-tree.ts`

| 文件:行 | 标识符 | 它现在真实表达的东西 |
|---|---|---|
| `src/shared/arc-tree.ts:20` | `ArcTreeUnit` | 树上的一个**单元**节点（序号、名字、原文行号、交手类型、档位变化） |
| `src/shared/arc-tree.ts:32` | `ArcTreeVolume` | 树上的一个**卷**节点（含其单元） |
| `src/shared/arc-tree.ts:41` | `ArcTree` | 只读树（`volumes` ＋ `twoLevel`） |
| `src/shared/arc-tree.ts:69` | `buildArcTree` | 由弧光文本构建只读树；标题扫描与解析结果对不上就返回 `null`（不出半棵树） |
| `src/shared/arc-tree.ts:104` | `arcTreeUnitCount` | 折叠时显示「N 单元」的计数 |

命名注意：文件仍叫 `arc-tree`，而它产出的正是**卷/单元**树；生产调用点 `src/shared/outline-tree.ts:137`。

## 6. 体检、摘要与预算

| 文件:行 | 标识符 | 它现在真实表达的东西 |
|---|---|---|
| `src/shared/arc-position.ts:1463` | `ArcDensityFinding` | 弧光分层体检发现（三级七条 / 两级三条，见下行码） |
| `src/shared/arc-position.ts:1476`／`:1478` | `ARC_SAME_HAND_TYPE`／`ARC_TIER_STUCK` | 两级专用：同卷相邻单元交手类型重样／档位原地踏步 |
| `src/shared/arc-position.ts:1482`／`:1484`／`:1486`／`:1488` | `ARC_SAME_BEAT`／`ARC_BEAT_REPEAT`／`ARC_BEAT_OVERSPAN`／`ARC_BEAT_UNKNOWN` | 两级专用：拍子未知/同卷重复/原生跨度装不下 |
| `src/shared/arc-position.ts:1741` | `auditArcDensity` | 分层体检入口；`naming === 'volume'` 时转 `auditTwoLevelDensity`（`:1680`），三级七条在两级上会逐条误报 |
| `src/shared/outline-prefix-budget.ts:75` | `arcPlan`（字段） | 弧光结构原文，仅用于定位「本批在第几卷、本卷已写多少章」 |
| `src/shared/synopsis-projection.ts:401` | `renderArcMajorSummary` | 一个**卷**的计划摘要（卷名/五格/卷末状态），L3 退化源 |
| `src/services/workflows/commands/architecture.command.ts:582` | `summarizeArcDensity` | 体检结果转提示文案（只提示不拦），生产调用点 `:3258` |
| `src/services/workflows/commands/architecture.command.ts:795` | `summarizeArcCoverFindings` | 大纲写完后的一批覆盖对账文案；两级结构直接 `return null`（不报噪声），生产调用点 `:4058` |

## 7. 借用 `arc` 之名、与弧层无关的两族（列出是为了别再被误并）

| 文件:行 | 标识符 | 它现在真实表达的东西 |
|---|---|---|
| `src/shared/disposition-citation.ts:26`–`:31` | `ARC_CHOICE_NO_BASIS`／`UNKNOWN_X`／`UNKNOWN_CHIP`／`SAME_X`／`MISMATCH`／`REPEAT_BREAK` | **处置引用**体检码（禁区编号/筹码名字是否编造、是否一条线推所有局面），与卷/单元结构无关，只是码名带 `ARC_` 前缀 |

子串误命中、**不属于**弧层、不要入库表：`charCount`（`outline-prefix-budget.ts:84`）、`CharacterAvatarCommitResponse`（`character-avatar.ts:34`）、`ProjectClearCounts`（`ipc-channels.ts:924`）、`emptyClearCounts`（`project-clear-receipt.ts:22`）、`scarce`／`scarcityNote`（`worldbuilding-completeness.ts:62`／`resource-ledger.ts:27`）、`ARC4`（测试夹具）。

## 8. 一句话结论（给 R2 作者用，不是结论性判断）

代码里的 `arc` 现在一律读作「**卷/单元结构**」；`minor`／`小弧` 只在三级旧结构里存在，v7 两级结构下 `ArcMinor` 恒为空、`isTwoLevelArcStructure` 为真、`summarizeArcCoverFindings` 直接不跑。所以 R2 表里凡是 `major` 一律注「卷」、`mid` 一律注「单元」，`minor` 必须标注「仅三级结构」；`ARC_CHOICE_*` 单独成族、不进弧层对照表。
