# 架构五层的形状：三类键、第 4 维登记名作锚点、弧用结构位 ID

`architecture-consistency-design.md` 从 2026-10-11 起就写着「S2 需先定最小锚点」「S3 依赖第五层落地」，`plans/00-OVERVIEW.md:109` 也一直写着「顺延到架构定型后」。三张 L2 卡（`L2-ARCH-01-01/02/03`）因此在 ROADMAP 上全部「阻塞」，而「架构定型」这件事**从来没有被裁过一次**：全仓 9 处提到它的地方都是转述（`ROADMAP.md:116/124/132`、`00-OVERVIEW.md:108`、`prompt-assembly-backlog.md:817`、`handoffs/archive/2026-10-15-keyevents-bprime-pause-handoff.md:206`、`arc-granularity-and-enum.md:259/276`、`p11-plan-validity-and-fact-registry-design.md:321`）。

一个从没被裁的问题会被无限期地当作借口：它不是「还差一个决定」，而是「没人知道该决定什么」。这份 ADR 就是补那一刀。

## 事实基础

- 五层在数据上不是五个可 join 的结构，而是**四个散文列**（`electron/migrations/baseline-schema.ts:43-46`）加两张已结构化表（`characters`、`blueprints`）。第五层弧走 `plot_structure_plan`（`electron/migrations/m07-plot-structure-plan.ts:4-10`），M00 基线已冻结。
- 能当键的只有三类：`characters.name`（`:76` PK）、`blueprints.chapter_number`（`:58` PK）、以及世界观模板第 4 维里被声明为「后续引用的唯一键」的两类登记名（`src/services/builtin-prompt-templates.ts:688`）——后者**没有任何解析器在读**。
- `characters_arch` 是投影：`electron/repositories/character-roster-repository.ts:863-870`（`refreshCharacterIdentityProjection`）的注释写明它「never acts as an identity write source」，`deriveRosterStatus()`（`:817`）用三哈希不等报 `inconsistent`。
- 弧已经有纯函数派生的结构位 ID（`src/shared/arc-node.ts:112-120`，`'M'+majorIndex` 解析顺序生成），实测 150 章弧光 3,931 字符 → 20 个结构位（`p12-arc-node-anchoring-design.md:183`），`validateArcCovers`（`arc-node.ts:238`）已有六码但未接线（`architecture.command.ts:802-804`「两级结构不做覆盖对账」）。

## 主人的四句裁定（2026-11-23 20:45，逐字原样）

> 落盘件：`.batch/night/org/ruling-arch-1123.md`（24 行／2,556B／sha256 `8579a5b0763f0ed00377bc4702268210583997dc850a3a1519f2cef6c6341aff`）。以下四句为用户原话，**逐字对齐，不得改写意思**。

1. 架构定型：**接受**「散文层（L0／L1 除登记名／L3）不做层间校验，全书只有角色名／登记名／章节号三类键，`characters_arch` 按投影校验（校验对象 `deriveRosterStatus()`）」。
2. 最小锚点：**是**「世界观第 4 维的两类登记（空间名 ＋【具名人物登记】行）」；匹配只做逐字包含、名单空即显式未判、`characters` 表只作交叉核对，冲突以登记行为准。
3. 弧层形状：**接受**「结构位 ID 即弧层可引用实体，不建表，重排报 `UNKNOWN_NODE`」。
4. 批次身份与证明体系（`L1-ARCH-02`／看板 `6be33a2b`）：**本轮不做**。收口按「五条解除＋`L1-ARCH-02` 留阻塞并注明依赖第四件前置」记，与 S4「17 ✅／3 不结案」同口径，不算欠账；`ROADMAP.md:37` 与 `:156` 两行互相矛盾这件事，收口时按裁定统一（表行前置写「第四件前置（未定）」，证据行保留「必须独立设计」原文）。

下面 D1–D4 是把四句翻成可执行口径的写法（不新增约束，只把边界写死）；两者冲突时以本节的四句原样为准。

## 决定

**D1 散文层不做层间校验。** 全书只承认三类键（角色名／第 4 维登记名／章节号）；L0 前提、L1 世界观（除登记名）、L3 大纲不做层间比对，只做层内检查。`characters_arch` 按投影校验，校验对象是 `deriveRosterStatus()` 的投影状态，不是「散文 vs 表」的双向对齐。

D1 的两个落地边界（2026-11-23 源码核对后补，均属「怎么写」而非「做什么」）：

- **取用方式未定，实施时二选一**：`deriveRosterStatus()` 是 electron 侧内部函数（`electron/repositories/character-roster-repository.ts:817`，未导出，`src/` 里搜不到），而架构预检跑在 `src/shared`。实现时要么**经既有 IPC 取投影状态**，要么**把三哈希判据下沉到 `src/shared`**——本 ADR 不预设，但必须选定其一并写进卡面，不允许两处各判一遍。
- **投影源不止 `characters` 一张表**：投影由角色行 JOIN `character_relationships` 生成（`character-roster-repository.ts:848-857`），所以「校验投影状态」实际校验的是**角色＋关系**两表的事实，改关系也会改投影哈希；把它读成「只校验角色卡那一条」会漏掉关系变动。

**D2 最小锚点＝世界观第 4 维的两类登记。** 空间名 ＋【具名人物登记】行（`builtin-prompt-templates.ts:668-672`）就是「谁算具名实体」的定义。匹配只做**逐字包含**；名单为空即**显式未判**（`consistency-preflight.ts:277-296` 已有该范式）；`characters` 表只作**交叉核对**，冲突以登记行为准。放过指代（"他/那位"），且这一局限必须写进报告。

D2 的两条落地边界（同上，2026-11-23 补）：

- **「逐字包含」与现有的「trim 后全等」是两套口径，不得混用**：现存的空间—钟点核对是 `byName.get(ref.space)` 全等查表（`src/shared/space-time-consistency.ts:285`，判定顺序注释 `:271` 原文「空间名逐字命中（trim 后全等）」）。按裁定做包含匹配意味着 `藏书阁` 会命中 `藏书阁东厢`——这是新实现、新测试，**不改写既有全等语义**（改它会动 D1–D21 已验收的既有行为）。
- **人物名单要「显式未判」，须新增字段**：`ConsistencyPreflightCoverage`（`src/shared/consistency-preflight.ts:260-265`）现在只有 `registeredSpaces`／`blueprintSpaceRefs`，说明文案由 `:273-306` 按空间的三支出；人物名单复用该范式**不是零改动**，要加字段并补文案分支。

**D3 弧层的可引用实体＝结构位 ID。** 不建表；弧重排导致 ID 变化时诚实报 `UNKNOWN_NODE`（发射点在 `src/shared/arc-node.ts:251`，经 `validateArcCovers` `:238` ← `auditArcCovers` `:449` ← `architecture.command.ts:812`），不静默重映射。节点文本指纹（`arc-node.ts:59-61` 明写一期不做）一期不做，成本转成作者一次手动复核。

D3 的一条落地边界：`UNKNOWN_NODE` 今天**已有能力、尚未接入预检**——它只在架构命令链里可达，不进 `consistency-preflight`（`:146-172`）；「重排报 `UNKNOWN_NODE`」是**承诺接线后的行为**，接线属 AC3 实施，不在本 ADR 范围。

**D4 批次身份与证明体系（`L1-ARCH-02`）不在本轮。** 它的阻塞理由是「动批次身份与证明体系，必须独立设计」（`ROADMAP.md:156`），与上述三件无关；塞进同一轮会把「解三件前置」扩成「再开一个架构设计域」。按「五条解除＋一条留阻塞并注明依赖第四件前置」收口，与 S4「17 ✅／3 不结案」同口径，**不算欠账**。

## 为什么不是另外两条路

- **只冻结已结构化的两张表（B）**：成本最低，但 `worldbuilding` 侧跨层仍零机检，模板第 6 条「两类唯一键」（`builtin-prompt-templates.ts:688`）继续是**已承诺、未兑现**——作者看到的承诺与实际能力差一整层。
- **先给散文层建表（C）**：要动 M00 冻结基线（`baseline-schema.ts` 四散文列），全部旧项目指纹受影响，且与 `architecture-consistency-design.md` §6「不建议为架构四层建结构化表」直接冲突，回归面覆盖 schema 指纹全量测试。代价最高，收益在「层间一致性」这一目标上并不比 D1 更多。

## 边界

- **D1 是公开承诺：散文层永久不做层间校验，扩就要改 ADR。** 将来若要扩，**必须改这份 ADR**，不能靠「顺手加个校验」绕过——这是本条唯一的外部约束力。
- D2 的「逐字包含」不覆盖别名、简称、错别字；不按模板登记的人名会漏报，这是接受的代价。
- D3 的 `UNKNOWN_NODE` 是**提示**而非禁令（继承 `consistency-preflight.ts:100`「Findings are evidence, never a writing prohibition」）。
- D4 只说明本轮不做；`ROADMAP.md:37` 表行的前置栏改「第四件前置（未定）」，`:156` 证据行保留「必须独立设计」原文。

## Consequences

- 三张 L2 卡（`L2-ARCH-01-01/02/03`）的阻塞理由销掉，`L0-ARCH`／`L1-ARCH-01` 在 ROADMAP 与看板同步解除；`L1-ARCH-02` 及其卡 `6be33a2b` 保持阻塞并注明依赖第四件前置。
- S1 现在就能做（层内对齐 + 章节覆盖），S2 需新写四段行解析器，S3 需把 `validateArcCovers` 接进章节校验路径——三者都不在本 ADR 范围内，本 ADR 只解阻塞。
- 架构层 finding 若要进一致性报告，**三处**必须同批扩：`sourceLayer`（现两值：`src/shared/space-time-consistency.ts:105`）、面板二元映射（`src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43`）、以及**章号**——`ConsistencyFinding.sourceChapter` 是必填（`src/shared/consistency-preflight.ts:17`）且面板直接渲染「来源：第N章」（`ConsistencyPreflightPanel.tsx:39`），而架构层 finding 没有章号可填，须先定它的形态（0／可选／另字段）才能进报告。否则架构层 finding 会静默显示成「本章蓝图」或「第 0 章」。本 ADR 不预设它进不进，留给 S1/S2 的实施决定。
