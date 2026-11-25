# C1-② 并排口径改写 ＋ 代码标识符语义对照（R2 定稿）

状态：待首验（CARD-1125-R2）
From: 产品经理 · AI writer项目组 ｜ 2026-11-25
射程：只写口径与对照表，**不改代码、不给实现、不动契约**。`git diff --name-only -- src` 为空是硬条件。

依据：
- 原稿：`docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md:73-130`（C1-② 字段级并排＋三选一＋快照回退）
- 四家结论：`.batch/night/reports/ext-review-1125-four-way-synthesis.md` §一·1、§一·2（4/4 认为长自由文本并排不成立；4/4 认为代码里 `arc` 仍是活标识符、补对照表即可）
- 代码清单：`.batch/night/reports/res-r2-identifier-map.md`（developer 只读供料，129 行／13,017 B／`cd97b66ed4494e97b44d9bdaa39d1a3eb3141e7ff0e8e08ab4df46fbf2c0c263`）
- 实测取数：`.runtime/db-copy/project.db`（47 张角色卡，文件 mtime 2026-11-05 18:33）与 `.runtime/inspect-1018e/project.db`（12 张，mtime 2026-10-18 04:48）只读 SQL，取数时刻 2026-11-25 21:05／21:21 两次同值。**本文所有长度读数以 47 张那份为准**（§2.1.1 中位与上界均出自它，除 `cs_physical_state`（n=3，仅作示意、其区间不作阈值依据）外，各字段 n 为 43–47）；12 张那份只作交叉核对，其 `background` max 111 不进上表、不参与阈值判定。

## 0. 结论先行（三句）

1. **短字段保留并排，判法是「角色优先 + 20 字兜底」**：`name`／`role`／`gender`／`age` 恒并排（实测最长 14 字）；其余自由文本字段去空白后 ≤20 字并排、>20 字走切片（实测自由文本中位 34–77 字，20 落在两族的空档里）。
2. **长字段走句级切片 diff，输出「第 k 句：旧 → 新」**，k 是**现有卡（旧卡）**的句序；切片粒度取**标点**（`。！？；…`），对齐取**相似度**（句级 LCS ＋ Dice≥0.6 判「改写」）——不用同序号，因为重生成最常见的变化就是多一句或少一句。
3. **代码里的 `arc` 一律读作「卷/单元结构」**：`major`→卷、`mid`→单元、`minor`/小弧**仅三级旧结构**；`ARC_CHOICE_*`（处置引用体检码）只是码名带前缀、与弧层无关，单独成族。对照表 63 行见 §2.2，**只出表不动码**。

## 2.1 并排口径改写

### 2.1.1 分档：两条判法（角色优先，字数兜底）

> 本表所有中位与上界均出自 47 张库；12 张库只作交叉核对，其 `background` max 111 与 107 差 4，**不改变任何字段落在 20 字阈值哪一侧的判定**，其余同列字段不逐一列两库值。

| 档 | 判法 | 实测依据 | 例子 |
|---|---|---|---|
| **短字段·结构类** | 字段属于 `name`／`role`／`gender`／`age` ⇒ 恒并排，不看字数 | 47 张卡实测：`name` 2–6 字（中位 3）、`role` 5–11 字（中位 10）、`gender` 1 字、`age` 2–14 字 | 「程实 ／ 主角」「男 ／ 男」「三十四 ／ 三十五」 |
| **自由文本·短** | 去空白后 ≤ **20 字** ⇒ 并排 | 自由文本最短实测 13 字（`personality` 最短一条），与结构类上界 14 之间只有 1 字重叠 | notes 34 字中位之下的小条目：直接两列并排、灰行 |
| **自由文本·长** | 去空白后 > **20 字** ⇒ 切片 diff | `background` 中位 55／max 107、`personality` 中位 77／max 169、`appearance` 中位 45、`abilities` 中位 45、`arc` 中位 45、`notes` 中位 34、`cs_physical_state` 33–63（n=3，仅示意） | 「清平里租客…」整段（背景组）→ 走 §2.1.2 |

**为什么阈值是 20 字，不是「按长度分档」一句话**：
- 20 字 ≈ 卡片并排区单列宽度内可一次读完，超出后两列都得换行、对齐失效，肉眼比对退化成「整体看哪边长」——这正是四家说「并排对长文本不成立」的机制。
- 实测两族分布几乎不重叠（结构类上界 14，自由文本下界 13、中位 ≥34），所以 20 是个空档值，不是拍脑袋的中点；13 字那种短自由文本落到并排也无害（一屏内仍能逐字读完）。

### 2.1.2 长字段：切片粒度取「标点」，不取段落、不取固定窗口

- **粒度定义**：句。句界＝句末标点 `。`／`！`／`？`／`；`／`…`（英文 `.`／`!`／`?`／`;`），换行另算一个软句界。切片前先归一：全角/半角标点统一、连续空白压成一个、去掉首尾空白。
- **为什么不取段落**：实测 `background`／`appearance`／`notes`／`arc` 的**单段占比 100%**（`personality` 98%），段落粒度等于「整字段并排」，原问题一个没解决。
- **为什么不取固定窗口**（如每 40 字一刀）：中文没有词间空格，40 字窗口会从半句中间切下去，于是「第 3 句」变成「第 3 个窗口」，人读不出边界；同一处改动还可能被切成两半，报成两处。
- **为什么标点粒度可行**：实测 `background` 句数中位 2／max 5、`appearance` 中位 2／max 3、`personality` 中位 4／max 8、`notes` 中位 2／max 4——最长 8 句，仍在「一眼能核完」的范围；且句号边界与作者改稿时的心理单位一致。

### 2.1.3 对齐方式取「相似度」，不取同序号

- **做法**：旧卡句序列 `A`、候选句序列 `B` 做句级 LCS（「相等」＝归一后完全相同）。LCS 命中的句子标「未变」不展开；LCS 之外的旧句/新句做二次配对——字符二元组 Dice 系数 ≥ **0.6** 判「改写」（配成一对），< 0.6 判「删除」（仅旧侧）或「新增」（仅新侧）。删除/新增按句序插回原位。
- **为什么不用同序号对齐**：重生成最常见的改动是**多一句或少一句**。同序号一旦遇到插入，插入点之后的每句都会错位、被标成「改写」——5 句里插 1 句，同序号会报 3 处改写，LCS 只报 1 处新增；作者看到一片红就不再信任高亮。
- **为什么是 Dice 0.6**：句级改写通常是「换几个词、加半句」，二元组重合度天然高；0.6 让「同义改写」进改写、让「换了主角的整句」进删除＋新增，避免把两句不相干的话硬配成一处改写。

### 2.1.4 输出形态（本卡唯一定性门槛）

每个长字段先给一行字段级结论，再逐句列改动：

```
背景：3 处改动（第 2 句改写；第 4 句后新增；第 5 句删除）
  第 2 句：旧 → 清平里租客，欠周德胜三个月房租，靠替人抄书糊口。
           新 → 清平里租客，欠周德胜三个月房租，靠替人抄书和代写书信糊口。
  第 4 句后新增 → 母亲留下的纸门牌一直挂在门框上，谁也没敢摘。
  第 5 句：旧 → 他从不肯提那三年去了哪里。 →（删除）
```

- `k` 恒指**旧卡**句序（作者手上那版），新增句用「第 k 句后新增」定位，删除句保留旧句原文并标「（删除）」。这样无论增删，作者都能在自己的旧稿上原位对上。
- 未变的句子不列出（默认收拢）；顶部数字「N 处改动」＝改写＋新增＋删除三者之和，与弹窗顶部的「M 张有实质差异」口径一致。

### 2.1.5 三组特例（沿用 C1-② 原稿 §4.2，这里只补切片口径）

| 组 | 比较方式 | 与切片的关系 |
|---|---|---|
| 关系组 | 按「关系对象名 + 关系词」**配对**比较（不是字符串比较），新增／消失／关系词变化分别标色 | 不走句级切片：每条关系是一行 |
| 当前状态组（`cs_*`） | **只读展示**，候选不提供状态时保留现值 | 不走切片：子字段各占一行，短文本并排 |
| 候选为空字段 | 标「候选为空·保留现值」，**不计入差异数** | 不退化成「整段删除」 |

### 2.1.6 不做（防越界）

- **不做逐字 diff**：我们核到的三家（Novelcraft／Notion AI／Sudowrite）都没做；第四家 Novelcrafter 的页面只能证有结构化设定库、旧条目可被覆盖，不能证 diff 行为。
- 不做段落级 diff（实测单段占比 98–100%，等于没做）。
- 不做自定义字段／不做字段可选（沿用原稿「固定 5 组，按此顺序」）。
- 不在本卡给实现方案（组件、状态、存储都不写）。

## 2.2 代码标识符 → 现值语义对照表

读法：**`arc` 一律读作「卷/单元结构」**；`minor`/小弧只在三级旧结构存在，v7 两级结构下 `ArcMinor` 恒空、`isTwoLevelArcStructure` 为真、`summarizeArcCoverFindings` 直接不跑。行数 63 ≥ developer 清单 54 行（多出的 6 行是 `ARC_CHOICE_*` 一族，列出来是为了别再被误并进弧层）。

| 标识符 | 文件:行 | 现值语义 |
|---|---|---|
| `ArcMinor` | `src/shared/arc-position.ts:41` | 小弧＝三级结构第三层（`chapters` 自 P18 起可选）；两级结构下恒为空 |
| `arcWeight` | `src/shared/arc-position.ts:62` | 一条弧参与区间折算的权重：有章数按章数、没有等权 1（P18：篇幅只算个数、不定内容） |
| `minorRanges` | `src/shared/arc-position.ts:73` | 小弧清单折算成「中弧内的章号闭区间」，与 `listArcNodes` 共用防两处折算漂移 |
| `splitMinorSteps` | `src/shared/arc-position.ts:96` | 小弧内容按 `→` 切事件步；P18 已撤回「逐章进度上限」用途，现只喂体检 |
| `ArcMid` | `src/shared/arc-position.ts:105` | 中弧＝v7 的「单元」，含 `fields` 与 `minors` |
| `ArcMajor` | `src/shared/arc-position.ts:119` | 大弧＝v7 的「卷」，含 `endState`（卷末验收）与 `mids` |
| `ParsedArcStructure` | `src/shared/arc-position.ts:132` | 解析结果容器：`majors[]`／`declaredTotal`／`declaredChapters`／`naming` |
| `ArcSpan` | `src/shared/arc-position.ts:154` | 「某段章号落在哪个卷/单元」＋本批之后还剩哪些单元（`remainingMids`） |
| `parseMinorArcs` | `src/shared/arc-position.ts:281` | 从「小弧」字段值切出多条小弧声明 |
| `parseArcStructure` | `src/shared/arc-position.ts:333` | 把 `plot_structure_plan` 的 markdown 解析成结构；无可用结构恒 `null`（fail-open 不报错） |
| `isTwoLevelArcStructure` | `src/shared/arc-position.ts:419` | 是否「卷/单元」两级（每卷都有单元、且单元无小弧）——决定体检跑哪套 |
| `scaledBoundaries` | `src/shared/arc-position.ts:431` | 章数→累积边界的**唯一**折算实现（等比折算＋严格递增），`arc-node.ts` 复用 |
| `arcSpanForUnit` | `src/shared/arc-position.ts:460` | 按「第几卷·第几个单元」推算该单元章号区间；**只用于文本投影**，不参与状态判定；越界/不可解析返回 `null` |
| `arcSpanForChapters` | `src/shared/arc-position.ts:488` | 按章号范围 `[from,to]` 定位卷/单元（含跨单元、剩余单元、下一单元边界） |
| `arcStructureNeedsRescale` | `src/shared/arc-position.ts:1002` | 结构自报总章数与全书章数不等时，注入文本要不要声明「已等比折算」 |
| `projectArcStructureText` | `src/shared/arc-position.ts:1053` | 弧光文本分级裁剪（本批单元全字段／本卷其他单元一句话／其他卷只留接续理由），只删不改 |
| `withArcPositionGuide` | `src/shared/arc-position.ts:1122` | 旧注入口：不裁剪直接拼弧位块（已被投影版取代） |
| `withProjectedArcGuide` | `src/shared/arc-position.ts:1140` | 大纲步骤的**章号制**唯一注入入口：先裁剪再拼块 |
| `isTurnField` | `src/shared/arc-position.ts:1164` | 「转折」（v7 读作「逼法」）判定，唯一能按章认领的字段——渲染清单与审计共用 |
| `renderArcPositionBlock` | `src/shared/arc-position.ts:1174` | 【本批所处弧位】硬约束块，**按章号**写「第 X–Y 章」 |
| `renderUnitArcPositionBlock` | `src/shared/arc-position.ts:1350` | 逐单元块：**按游标**，不写章号区间、不列「覆盖：」清单、不写小弧章数 |
| `withProjectedUnitArcGuide` | `src/shared/arc-position.ts:1423` | 单元模式的唯一注入入口（裁剪＋单元块） |
| `ArcNodeKind` | `src/shared/arc-node.ts:66` | 结构位粒度：`major`／`mid`／`field`（整段规格）／`minor` |
| `ArcNode` | `src/shared/arc-node.ts:68` | 一个结构位：稳定 ID＋折算后章号区间＋所属卷/单元＋原文 |
| `ArcCoverViolation` | `src/shared/arc-node.ts:88` | 覆盖违规码：`INV-1-OUT_OF_RANGE`／`INV-2-DUPLICATE`／`INV-3-UNCOVERED`／`UNKNOWN_NODE`／`COARSE_NODE`／`NOT_CLAIMABLE` |
| `listArcNodes` | `src/shared/arc-node.ts:104` | 把结构摊平成结构位清单（卷→单元→字段/小弧），ID 形如 `M1-2/转折` |
| `findArcNode` | `src/shared/arc-node.ts:180` | 按 ID 取结构位 |
| `isClaimableArcNode` | `src/shared/arc-node.ts:196` | 能否出现在「覆盖：」里：只有「转折」与小弧（因果/时序等整段规格不算） |
| `isOneShotArcNode` | `src/shared/arc-node.ts:207` | 是否一次性额度（只有「转折」）：INV-2 只对它生效，小弧可多章认领 |
| `arcNodesForChapter` | `src/shared/arc-node.ts:217` | 本章所属单元及其下全部结构位（「这一章能兑现什么」） |
| `validateArcCovers` | `src/shared/arc-node.ts:238` | 单章声明校验（越界/未知/粒度太粗/不可认领）；跨章重复不在此函数 |
| `ChapterArcCover` | `src/shared/arc-node.ts:325` | 大纲一章的「覆盖：」声明（章号、章名、ID 列表、行号） |
| `parseChapterArcCovers` | `src/shared/arc-node.ts:359` | 从大纲正文解析每章声明；只认章标题正下方第一行 |
| `ArcCoverAudit` | `src/shared/arc-node.ts:391` | 一批（`from..to`）的对账结果（违规＋漏覆盖） |
| `isUncoveredCandidate` | `src/shared/arc-node.ts:430` | 「什么算漏」：转折过了本批末尾才算漏，小弧只要与本批有交集就算 |
| `auditArcCovers` | `src/shared/arc-node.ts:439` | 跨章对账（INV-2/INV-3），生产调用点只有 `architecture.command.ts:813` |
| `ARC_COVER_KEY_PREFIX` | `src/shared/arc-cover-consistency.ts:13` | 豁免键前缀 `arc:cover:` |
| `arcCoverStableFactKey` | `src/shared/arc-cover-consistency.ts:16` | 豁免键：**不含章号**，同一格问题一次豁免全书生效 |
| `ArcCoverScope` | `src/shared/arc-cover-consistency.ts:20` | 判据输入：章号＋`plot_structure_plan`＋`synopsis`＋`total_chapters` |
| `findArcCoverRisks` | `src/shared/arc-cover-consistency.ts:95` | 单章弧层引用是否闭合：四条守卫全 fail-open（章号/总章数非法、无结构位、本章无 `covers`）→ 译成 `ConsistencyFinding` |
| `ArcTreeUnit` | `src/shared/arc-tree.ts:20` | 树上的一个**单元**节点（序号、名字、原文行号、交手类型、档位变化） |
| `ArcTreeVolume` | `src/shared/arc-tree.ts:32` | 树上的一个**卷**节点（含其单元） |
| `ArcTree` | `src/shared/arc-tree.ts:41` | 只读树（`volumes`＋`twoLevel`） |
| `buildArcTree` | `src/shared/arc-tree.ts:69` | 由弧光文本构建只读树；标题扫描与解析结果对不上返回 `null`（不出半棵树） |
| `arcTreeUnitCount` | `src/shared/arc-tree.ts:104` | 折叠时显示「N 单元」的计数 |
| `ArcDensityFinding` | `src/shared/arc-position.ts:1463` | 弧光分层体检发现（三级七条／两级三条，见下行码） |
| `ARC_SAME_HAND_TYPE` | `src/shared/arc-position.ts:1476` | 两级专用：同卷相邻单元交手类型重样 |
| `ARC_TIER_STUCK` | `src/shared/arc-position.ts:1478` | 两级专用：同卷相邻单元档位原地踏步 |
| `ARC_SAME_BEAT` | `src/shared/arc-position.ts:1482` | 两级专用：拍子未知 |
| `ARC_BEAT_REPEAT` | `src/shared/arc-position.ts:1484` | 两级专用：拍子同卷重复 |
| `ARC_BEAT_OVERSPAN` | `src/shared/arc-position.ts:1486` | 两级专用：拍子原生跨度装不下 |
| `ARC_BEAT_UNKNOWN` | `src/shared/arc-position.ts:1488` | 两级专用：拍子标识不在已知集合 |
| `auditArcDensity` | `src/shared/arc-position.ts:1741` | 分层体检入口；`naming === 'volume'` 时转 `auditTwoLevelDensity`（`:1680`），三级七条在两级上会逐条误报 |
| `arcPlan` | `src/shared/outline-prefix-budget.ts:75` | 弧光结构原文，仅用于定位「本批在第几卷、本卷已写多少章」 |
| `renderArcMajorSummary` | `src/shared/synopsis-projection.ts:401` | 一个**卷**的计划摘要（卷名/五格/卷末状态），L3 退化源 |
| `summarizeArcDensity` | `src/services/workflows/commands/architecture.command.ts:582` | 体检结果转提示文案（只提示不拦），生产调用点 `:3258` |
| `summarizeArcCoverFindings` | `src/services/workflows/commands/architecture.command.ts:795` | 大纲写完后一批覆盖对账文案；两级结构直接 `return null`（不报噪声），生产调用点 `:4058` |
| `ARC_CHOICE_NO_BASIS` | `src/shared/disposition-citation.ts:26` | 处置引用体检码：禁区编号无依据（**非弧层**，只是码名带 `ARC_`） |
| `ARC_CHOICE_UNKNOWN_X` | `src/shared/disposition-citation.ts:27` | 处置引用体检码：引用了不存在的筹码 X（**非弧层**） |
| `ARC_CHOICE_UNKNOWN_CHIP` | `src/shared/disposition-citation.ts:28` | 处置引用体检码：筹码名不在设定里（**非弧层**） |
| `ARC_CHOICE_SAME_X` | `src/shared/disposition-citation.ts:29` | 处置引用体检码：多个局面引用同一筹码（**非弧层**） |
| `ARC_CHOICE_MISMATCH` | `src/shared/disposition-citation.ts:30` | 处置引用体检码：引用筹码与局面不符（**非弧层**） |
| `ARC_CHOICE_REPEAT_BREAK` | `src/shared/disposition-citation.ts:31` | 处置引用体检码：同一条线推所有局面（**非弧层**） |

### 2.2.1 两处点名标识符的生产调用点（供核，不改）

- `findArcCoverRisks`：生产只有一处 `src/services/consistency-preflight.ts:90`（`arcLayer` 由 `:14` 导入）；背后是单章预检，**不是**覆盖率统计。
- `arcSpanForUnit`：三处全在 `src/shared/arc-position.ts`——`:1358`（`renderUnitArcPositionBlock`）、`:1433`（`withProjectedUnitArcGuide`）、`:1661`（`auditTwoLevelDensity` 的拍子跨度检查）；上游入口 `src/services/workflows/commands/architecture.command.ts:3661`／`:3670`／`:4260`。
- 两个标识符都只做文本投影/预检，**不参与状态判定**——这是「只补表、不重命名」的底气。

## 3. 判据自检（对卡面 §3 六条）

| # | 判据 | 落点 |
|---|---|---|
| 1 | 短/长字段各有明确阈值与例子 | §2.1.1（20 字 + 三档表 + 两个例子）|
| 2 | 长字段能指出「第 k 句：旧 → 新」 | §2.1.4 输出样例（改写／新增／删除三种形态各一）|
| 3 | 切片粒度与对齐方式各一种并给理由 | §2.1.2（标点，3 条反例实测）、§2.1.3（相似度，含同序号的反例）|
| 4 | 对照表行数 ≥ 清单行数且每行带 `文件:行` | §2.2 共 63 行，每行第二列即 `文件:行` |
| 5 | `git diff --name-only -- src` 为空；`grep -rn 'arcSpanForUnit\|findArcCoverRisks' --include=*.ts src \| wc -l` 与开工前一致 | 开工前 43 行，收工 43 行（§4 命令原文）|
| 6 | `check-fast` EXIT=0；提交后 porcelain 0 行 | 提交时贴 |

## 4. 附：取数命令原文（可复跑）

```bash
# 不改码证据
git diff --name-only -- src | wc -l                          # 0
grep -rn 'arcSpanForUnit\|findArcCoverRisks' --include=*.ts src | wc -l   # 开工前 43 / 收工 43
# 阈值实测
python - <<'PY'  # 只读 sqlite
import sqlite3, statistics, re
c = sqlite3.connect("file:.runtime/db-copy/project.db?mode=ro", uri=True)
for f in ["name","role","background","personality","appearance","notes","arc"]:
    vals = [len(str(v)) for (v,) in c.execute("select %s from characters" % f) if v]
    print(f, len(vals), min(vals), statistics.median(vals), max(vals))
PY
```

## 5. 交付读数（2026-11-25 21:1x 实测）

- 落笔时 HEAD：`0b405bdd`；`git status --porcelain -uall` 除本件外 2 行（`?? .batch/night/reports/res-r1-qa.md` 归 QA 首验、`?? .batch/night/reports/res-r2-identifier-map.md` 归 R2 供料）。
- `git diff --name-only -- src | wc -l` → 0；`grep -rn 'arcSpanForUnit\|findArcCoverRisks' --include=*.ts src | wc -l` 开工前 43／收工 43。
- 本件 `wc -lc` 与 sha256 在提交回执里给；`node scripts/check-fast.mjs` → 全部通过。
