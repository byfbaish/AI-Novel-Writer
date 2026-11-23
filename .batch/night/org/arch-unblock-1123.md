# ARCH 解阻塞 · S1 材料：三件前置的事实卡、候选与推荐

> 作者：项目总负责人 · AI writer项目组｜2026-11-23｜用途：供主身呈主人裁定
> 口径：本文**只出候选与推荐，不替主人下结论**。每个数字带出处（`文件:行`／命令原文）。
> 素材：本人自取证 ＋ developer 事实卡 `.batch/night/org/arch-s1-facts-developer.md`（我只并入并抽核过关键行，标注见 §6）。
> 三份互不重叠：§1 只谈「哪些层有键、校验对象是谁」（AC1 前置），§2 只谈「名单是谁」（AC2 前置），§3 只谈「弧的可引用实体」（AC3 前置）。
> 标注：`[已证实]` ＝ 本次亲手读到原文或命令输出；`[developer]` ＝ 取自已核事实卡且我抽核过；`[待验]` ＝ 转述未核。

---

## 0. 一页摘要

| # | 前置 | 现状一句话 | 推荐 | 主要代价 | 要主人裁的一句话 |
|---|---|---|---|---|---|
| 1 | 架构定型 | 五层在数据上就是 5 个列，能 join 的只有 3 类键；「定型」从未被判过；且 L2 散文其实是投影、不是真相源 | A：以「载体＋键＋校验对象」定型，散文层只做层内 | 需认可「散文层不做层间校验」升级为结论 | 接受「三类键 + 散文层只做层内」作定型结论吗？ |
| 2 | 最小锚点 | 世界观模板**已经宣称**第 4 维两类名字是「后续引用的唯一键」，但从来没有解析器读它 | A：锚点＝第 4 维两类登记，`characters` 表只作交叉核对 | 要新写四段行解析器；名单空时必须显式未判 | 锚点就是第 4 维的两类登记吗？ |
| 3 | 弧层形状 | 结构位 ID 纯函数派生已实现并实测（20 个结构位），但锚定稿仍「待裁定」，ID 是解析顺序产物 | A：结构位 ID 即弧层实体，不建表 | 弧重排整体错位，靠 `UNKNOWN_NODE` 提示复核 | 接受「结构位 ID 即实体、不建表」吗？ |
| 4 | 批次身份与证明体系（`L1-ARCH-02`） | 不在三件前置内：阻塞理由是「动批次身份与证明体系，必须独立设计」，属另一条机制 | **不推荐在本 Goal 内做**（会把「解三件前置」扩成「再加一个架构设计域」） | 若答「一并做」需追加第四件前置事实卡（现无） | 是否本轮一并定型？（建议答「不做」） |

---

## 1. 前置一：架构定型

### 1.1 现状事实

| # | 事实 | 出处 | 状态 |
|---|---|---|---|
| 1 | 四层散文在数据上是 `project_core` 的**四个列**：`premise`／`worldbuilding`／`characters_arch`／`synopsis` | `electron/migrations/baseline-schema.ts:43-46` | [已证实] |
| 2 | 第五层「弧」是同一张表的**第五个列** `plot_structure_plan`，且**M00 基线已冻结**，加列只能走 M07 子迁移（不在 `baseline-schema.ts` 的 CREATE TABLE 里），否则旧项目指纹全失配 | `electron/migrations/m07-plot-structure-plan.ts:4-10` | [已证实] |
| 3 | 全书能当 join 键的只有三类：角色名（`characters.name` PRIMARY KEY）、章节号（`blueprints.chapter_number` PRIMARY KEY）、世界观第 4 维登记名（空间名／具名人物，**取值口径见 §2，未裁前不预设**） | `baseline-schema.ts:58`、`:76`；`src/services/builtin-prompt-templates.ts:688` | [已证实] |
| 4 | 评估稿已盘完五层可校验性，结论是「L0/L1/L3 是散文、无 ID、无 join 键」 | `docs/design/architecture/architecture-consistency-design.md:88-95`、`:29` | [已证实] |
| 5 | 该稿性质是**评估**：§7 只答「有必要吗／难吗／怎么排」，没有「定型」结论；§6 明确**不建议**为四层建结构化表 | 同稿 `:247-260`、`:235-245` | [已证实] |
| 6 | 全仓搜「架构定型」只命中转述，无裁定件；排除本材料自身 6 行后实为 **9 处** | `grep -rn "架构定型" docs .batch --include=*.md` → `ROADMAP.md:116`／`:124`／`:132`、`00-OVERVIEW.md:108`、`prompt-assembly-backlog.md:817`、`handoffs/archive/2026-10-15-keyevents-bprime-pause-handoff.md:206`、`arc-granularity-and-enum.md:259`／`:276`、`p11-plan-validity-and-fact-registry-design.md:321` | [已证实] |
| 7 | AC1 顺延的真实理由：架构不完整期做层内校验＝校验对象反复变＝回归测试爆炸 | `docs/plans/00-OVERVIEW.md:109` | [已证实] |
| 8 | **`characters_arch` 不是作者手写真相源**：它由角色 ID 事实投影生成（`refreshCharacterIdentityProjection()` → `renderCharacterRosterMarkdown` → `UPDATE project_core SET characters_arch=?`），注释原文「Compatibility prose is derived from ID facts and never acts as an identity write source」 | `electron/repositories/character-roster-repository.ts:862-869` | [已证实] |
| 9 | 「散文与表不一致」**已经有机读状态**：`deriveRosterStatus()` 三条件任一不等即 `'inconsistent'`（投影哈希／事实哈希／当前投影） | 同文件 `:836-846` | [developer＋已抽核] |
| 10 | 但该状态**不叫 finding、不进一致性报告**；finding 的 `sourceLayer` 现已**两个值**：`'world-building' \| 'blueprint'`，**没有架构层的值**；每条 finding 真正**必填**的是 `sourceChapter`（章号），架构层 finding 没有章号可填 | `src/shared/space-time-consistency.ts:105`、`src/shared/consistency-preflight.ts:17` | [已证实] |
| 10b | 且面板对 `sourceLayer` 是**二元硬编码**：非 `world-building` 一律显示「本章蓝图 / 空间规则」——若只加枚举值不改面板，架构层 finding 会**静默显示成本章蓝图** | `src/components/**/ConsistencyPreflightPanel.tsx:42-43`（原文 `finding.sourceLayer === 'world-building' ? '世界观设定（改本章无效）' : '本章蓝图 / 空间规则'`） | [已证实] |
| 11 | 架构列的写入点唯一（`writeArchToDb()` 的三个调用点分别写 `premise`／`worldbuilding`／`plotStructurePlan`，**没有一个写 `charactersArch`**） | `src/services/workflows/commands/architecture.command.ts:1933`、`:2222`、`:2841`、`:3240` | [developer] |
| 12 | AC1 的 S1.2（大纲覆盖完整性）目前只有记账与 UI 提示（`synopsis_covered_to`／`canContinue`），预检入口不吃 `synopsis`／`total_chapters` | `architecture.command.ts:1151-1173`、`ArchitectureConfirmDialog.tsx:423-428`、`:728` | [developer] |

**一句话**：定型缺的不是设计，是**一句裁定**——哪几层承认有键、每层的校验对象是谁、finding 的 `sourceLayer` 允许哪些值。

### 1.2 候选方案

**候选 A（「载体＋键＋校验对象」定型，落 ADR）**
一张表写死每层：①载体（哪列／哪表）②键（有无 join 键、键名）③允许的校验类型（层内／层间）④**校验对象**（对散文原文还是对派生投影）。要点：
- L0 `premise`：散文·无键·只做层内；
- L1 `worldbuilding`：散文·键＝第 4 维登记名（**具体取哪两类名称由 §2 裁定，本表先写「登记名」不预支结论**）·层间仅查「名是否登记」；
- L2 `characters_arch`：**投影派生、非真相源**·键＝`characters.name`·层内校验对象是 `deriveRosterStatus()` 而非「散文 vs 表」；
- L3 `synopsis`：文本·键＝章节号·层间只查「章节号覆盖到 `total_chapters`」；
- L4 `blueprints`：表·键＝`chapter_number`；
- 弧 `plot_structure_plan`：键＝结构位 ID（见 §3）；
- 新增一变：finding 的 `sourceLayer` 允许值扩到架构层，**并同步改面板映射**（否则 1.1 #10b 的静默误显示）；或明确「架构层 finding 不走预检、另走一致性报告」——二选一需在 ADR 里写死，不许两处并存。

**候选 B（最小承诺）**
只裁「L2.5 角色卡与 L4 蓝图两张已结构化表不再变」；散文层留待以后，AC1 先按现有设计稿做。

**候选 C（先结构化再定型）**
给 L0／L1／L3 建表或抽字段，全部有键后再定。

### 1.3 推荐与代价

**推荐 A。** 三条理由：
1. A 只把设计稿已有的盘点（1.1 #4）升格为结论＋补两格（校验对象、sourceLayer），成本≈一份 ADR，不新增存储；
2. A 解掉一个**今天就会踩的坑**：1.1 #8／#9 说明 `characters_arch` 是投影，若不定型就照卡面「散文↔表双向对齐」去做，会做出「自己比自己」的假校验；A 把校验对象写成 `deriveRosterStatus()`；
3. 评估稿 §6 的「不建议」是 A 的前提而非冲突：A 正是把「散文层不建表」写成结论。

**代价**：
- A 需主人认可硬边界「L0／L1（除登记名）／L3 永远不做层间校验」；认可后 AC2 射程永久限定在登记名一类，扩就得改 ADR。
- A 把「finding 能不能带架构层」变成明写条款，等于顺手裁掉 1.1 #10 那条契约空白；若不裁，AC1 的产出无处可落。
- B 代价最小但「架构稳定」信号永不出现，AC1 长期挂 backlog（现即 backlog）。
- C 与 1.1 #5 三条「不建议」直接冲突，且是唯一要迁移与回归的一案。

### 1.4 影响面

**A 案：**
- **ROADMAP**：`:32`（L0-ARCH 表行）、`:34`（L2-ARCH-01-01）、`:116`、`:124`、`:132`（状态与证据行）；§6 第 4 条「L1-ARCH-01 验收记录路径」（`:346`）可与定型同批定。
- **文档**：`architecture-consistency-design.md` 新增「§5.0 定型结论」；新建 ADR 1 份；`00-OVERVIEW.md:96` 起的阶段三改写为指向 ADR（原「架构定型后」措辞见 `:109`）。
- **契约（B-3 必修）**：finding 的 `sourceLayer` 现两值（`src/shared/space-time-consistency.ts:105`）、必填字段是 `sourceChapter`（`src/shared/consistency-preflight.ts:17`），面板二元硬编码在 `src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43` —— 扩架构层必须**同批改枚举＋面板映射＋无章号 finding 的字段形态**，只加枚举会让架构层 finding 静默显示成「本章蓝图」。
- **回归面**：`ConsistencyPreflightPanel` 相关断言、`consistency-preflight` 单测、`space-time-consistency` 的 `sourceLayer` 类型引用；ADR 落地后 `docs/plans/prompt-assembly-backlog.md:817`（AC1 排期行）需同步。
- **看板**：卡 `a7589d74-121a-4a93-b5e5-befd5e260c11`（AC1/S1，`backlog`）由「顺延」转可开工。

**B 案（只冻结构化两表）：**
- ROADMAP 只改 `:34`／`:132`（AC1 转可开工），`:32`／`:33`／`:116`／`:124` 仍「阻塞」（L0-ARCH 与 L1-ARCH-01 的完成判据要求三张子卡全达标，AC2／AC3 未解 → 仍不能转）；
- 文档：ADR 缩为「结构化两表冻结」，`architecture-consistency-design.md` 不必新增 §5.0，但 `00-OVERVIEW.md:109` 的「等架构不完整期过去」变成永久措辞，需改写为「仅结构化层稳定」；
- 回归面：几乎为零（不动契约）；代价是 `consistency-preflight` 的架构层 `sourceLayer` 空白继续悬着，AC1 的 S1.2／S1.3 无处落 finding。

**C 案（先结构化再定型）：**
- 需**新迁移**（M 系列）给 L0／L1／L3 加表或加列，而 M00 基线已冻结（`:1.1 #2`）→ 影响全部旧项目指纹；
- ROADMAP 六条**全部**要重写判据（三张 L2 的完成判据从「task_board_get → done」改成「新表落地＋校验通过」），`architecture-consistency-design.md` §2／§5 与 §6「不建议」三条要一并推翻重写，ADR 两份（定型＋迁移）；
- 回归面：schema 指纹测试全量、`baseline-schema.ts` 冻结前提、伴生 `UNRECOGNIZED_SCHEMA` 风险（`00-OVERVIEW.md:96` 起的阶段一曾因改 M00 基线踩过）；
- 代价最高，且与 §1.1 #5 三条「不建议」直接冲突。

---

## 2. 前置二：最小锚点

### 2.1 现状事实

| # | 事实 | 出处 | 状态 |
|---|---|---|---|
| 1 | 设计稿写明类型 B 的核心矛盾：「角色名最容易抽，自然语言指代是杀手」，结论是必须接受「只查具名、放过指代」 | `architecture-consistency-design.md:130-140` | [已证实] |
| 2 | §5 S2 已有高门槛策略（≥2 字且出现 ≥2 次）与「报告里声明局限」 | 同稿 `:206-215` | [已证实] |
| 3 | 但设计稿对锚点只有一句「必须先在 … 里定『锚点』：谁算具名实体、如何抽」，**没有定义** | 同稿 `:215` | [已证实] |
| 4 | **★ 锚点的输入其实已经存在，而且是模板里的正式契约**：世界观模板第 4 维固定收尾块【具名人物登记】，要求具名人物「另外单独成行登记」，格式 `人名｜一句话定位｜固定口吻｜与主角关系`；并明文「只写在空间条目散文里、没有在此单独成行的人名，视为**未登记**，后续层级无法引用他」 | `src/services/builtin-prompt-templates.ts:668-672` | [已证实] |
| 5 | 同一模板的【要求】第 6／7 条把它升为「唯一键」条款：「第 4 维度里固定下来的两类名字都是**后续引用的唯一键**：① 空间名；② 在【具名人物登记】里单独成行的具名人物」；且限定「只登记位置锚定型配角，一次性路人不登记」 | 同文件 `:688`、`:689` | [已证实] |
| 6 | **但没有任何解析器读这四段行**，而且是**特意排除**：空间规则解析器注释明写「【具名人物登记】的 `人名｜定位｜口吻｜关系` 行（无 `=`）不会被误收」，测试还断言「登记行都不收」 | `src/shared/space-time-consistency.ts:159`；`src/shared/__tests__/space-time-consistency.test.ts:63-66` | [developer＋已抽核] |
| 7 | 空间侧已有可用范式：`parseSpaceRules()` 认 `名字=规则` 机读行（200 字上限、后条覆盖前条）；键 `spaceTimeStableFactKey()`（FNV-1a 64，前缀 `space:`） | `space-time-consistency.ts:161-199`、`:249` | [developer] |
| 8 | 已有同形态「白名单＋缺数据显式未判」先例：`space-anchor.ts` 的 `knownSpaces`（逐字包含、不猜地点）＋三契约；预检则规定「已登记 N=0 或本章无结构化引用 ⇒ 显式未判」 | `src/shared/space-anchor.ts:1-42`；`src/shared/consistency-preflight.ts:262`、`:277-296` | [已证实] |
| 9 | 角色名是硬键：`characters.name TEXT PRIMARY KEY`；名册侧另有 `characterRosterIdentityKey(name)` | `baseline-schema.ts:76`；`src/shared/character-roster.ts:17` | [developer] |
| 10 | 预检链目前**只吃蓝图**：`synopsis` 与 `worldbuilding` 的具名实体从未进入任何机检 | `consistency-preflight.ts:146-172` | [developer] |
| 11 | 卡面把「先产出最小锚点定义」列为第 2 步（第 1 步是读事实卡），要求 ≥10 个边界例子（含应放过的假阳性） | `task_board_get 4027dbef-…` prompt §2／§3 | [已证实] |

**一句话**：锚点不是要新发明的概念——模板已经把它写成「唯一键」，缺的是①认不认这四段行为契约 ②一支读它的解析器。

### 2.2 候选方案

**候选 A（认第 4 维两类登记为锚点，`characters` 表只作交叉核对）**
锚点名单 = ①世界观第 4 维登记的空间名（`parseSpaceRules` 已能取）②【具名人物登记】四段行的人名（需新写解析器）。判定只做逐字包含，只报「名长 ≥2 字且本章出现 ≥2 次」；`characters.name` 不进入锚点名单，而是用于**双向核对**（登记了没建卡／建了卡没登记 → 各自一条提示）。「不算锚点」写死：代词、描述性指称（白衣人／摊主）、未登记新地名、一次性路人。

**候选 B（只取 `characters.name`）**
锚点 = 角色表全量；第 4 维登记行不解析。

**候选 C（不扫散文）**
锚点只认蓝图 `structuredRefs.spaceRefs` 已声明的实体。

### 2.3 推荐与代价

**推荐 A。** 理由：
1. 模板第 6 条已经把两类登记名宣称为「后续引用的唯一键」（2.1 #5）——A 是**承认既有契约**，不是新立概念，成本只在解析器；
2. 只有 A 能真正压住 AC2 的目标场景（大纲里出现的空间名／配角名是否登记），B 丢掉空间与配角两侧（而「空间名」是模板里第一号唯一键），C 等于不做（蓝图侧已被 `findSpaceTimeConflicts` 判过，见 `space-anchor.ts:17`）；
3. A 的每个失败模式都有先例答案（2.1 #8）：名单为空 → 显式未判，不降级为「全过」。

**代价**：
- 要新写一支四段行解析器（现解析器特意排除它，2.1 #6），并给它配负向测试（「散文行不被误收」「代词不判」）；这属实现，不属新流程。
- 依赖作者真按模板登记：登记行缺失＝该名不可引用，会漏报（模板已定义「未登记即不可引用」，属已知边界而非缺陷）。
- 锚点一旦定为「第 4 维登记名」，`characters` 表就不再是唯一真相——两侧冲突时的口径要一并写死（推荐：以登记行为准，表侧缺卡单独提示）。
- B 代价：AC2 目标要改小（丢空间与配角），且与模板条款脱节；C 代价：白花一张卡。

### 2.4 影响面

**A 案（认第 4 维两类登记）：**
- **设计稿**：§5 S2 补「最小锚点」定义节＋「会判／不会判对照表 ≥10 例」（卡面要求）。
- **代码（解阻塞后下一期）**：新四段行解析器＋纯函数接 `src/services/consistency-preflight.ts`（`spaceRefs` 入口 `:160`），复用 `stableFactKey` 前缀纪律；负向测试覆盖「指代不判」「散文行不误收」。
- **ROADMAP**：`:135`（L2-ARCH-01-02 节）、`:140`（状态行）；`L1-ARCH-01` 完成判据「三条判据在 `pnpm check:fast` 下不新增红」（`:122`）不变。
- **回归面**：`space-time-consistency` 的「登记行不误收」断言（`__tests__/space-time-consistency.test.ts:63-66`）会被新解析器触碰——需明确「解析器各读各的、不改原排除规则」；`character-roster` 交叉核对新增一条提示时需同步 `deriveRosterStatus` 的语义说明。
- **看板**：卡 `4027dbef-b5b2-4725-bc51-7b47e558ccd2`（`todo`）转可开工；AC1 的「散文→表」方向（`a7589d74`）依赖同一能力，可随本件一起解。

**B 案（只取 `characters.name`）：**
- ROADMAP `:135`／`:140` 可解，但 AC2 的卡面判据要**改写**：去掉「空间名／具名人物」两类，只留角色名 → 与设计稿 §5 S2.1「人名/地名」原文冲突，设计稿 §5 S2 必须同批删「地名」；
- 回归面更小（不新增解析器）；代价是模板第 6 条「两类唯一键」只兑现一类，`worldbuilding` 侧跨层仍零机检，AC2 的价值密度掉一半；
- 看板：`4027dbef` 转可开工，`a7589d74` 仍依赖「散文→表」抽取能力（无解析器 → 仍不可开工）。

**C 案（只认蓝图 `structuredRefs`）：**
- ROADMAP `:135`／`:140` 按「等同一性已有能力」结案 → 但该能力已由 `findSpaceTimeConflicts`（`src/shared/space-time-consistency.ts:278`）覆盖，等于**卡片目标改为「无新增」**，需把 `4027dbef` 关成「已被既有实现覆盖」并留痕，同时在 ROADMAP §6 记一条；
- 文档：设计稿 §5 S2 整节改写成「不做」＋理由；`00-OVERVIEW.md:109` 起的阶段五排期删除；
- 回归面：零；代价是 AC 系只剩 AC1／AC3，`L0-ARCH` 的「层间一致性可机检」目标不再成立，需主人一并认。

---

## 3. 前置三：弧层形状

### 3.1 现状事实

| # | 事实 | 出处 | 状态 |
|---|---|---|---|
| 1 | 弧存 `project_core.plot_structure_plan` 一列，走 M07 子迁移；基线里**没有任何 `arc*` 表** | `m07-plot-structure-plan.ts:9`；`grep -n "CREATE TABLE.*arc" baseline-schema.ts` → 零命中 | [已证实＋developer] |
| 2 | 弧层（阶段一）已落地并提交 `796528f` | `docs/plans/00-OVERVIEW.md:96` | [已证实] |
| 3 | 结构位 ID 格式：`M1`／`M1-2`／`M1-2/转折`／`M1-1/小弧:纸门牌`；`ArcNode` 带 `id/kind/range/majorIndex/midIndex/text` | `src/shared/arc-node.ts:66-101` | [已证实] |
| 4 | **ID 是解析顺序的产物**：`id: 'M' + majorIndex` 在 `parsed.majors.forEach` 里生成 → 原文重排即全部漂移 | `arc-node.ts:112-120` | [developer＋已抽核] |
| 5 | 三个不变量已成文：INV-1 越界／INV-2 重复消费（射程只到「转折」）／INV-3 漏覆盖（按节点分型） | `p12-arc-node-anchoring-design.md:103-125` | [已证实] |
| 6 | 已用真实数据跑通：「150 章弧光 3,931 字符 → 3 大弧／6 中弧／20 个结构位」 | 同稿 `:183` | [已证实] |
| 7 | 但该稿状态仍是「**待裁定**（2026-10-18）」 | 同稿 `:3` | [已证实] |
| 8 | 指纹缓解手段（节点文本指纹＋不匹配提示复核）**一期不做** | `arc-node.ts:58-64`；p12 `:244` | [已证实] |
| 9 | 严格校验器 `validateArcCovers`（`arc-node.ts:238`，六个违规码）**无生产调用点**；生产只调 `auditArcCovers`（`architecture.command.ts:812`），且 `:802-804` 明写「两级结构不做覆盖对账」 | `grep -rn "validateArcCovers" src electron` → 只命中自身与测试 | [已证实] |
| 10 | 章侧 `covers` 已能从大纲解析与审计 | `arc-node.ts:359`、`:439` | [已证实] |
| 11 | 树视图同样只读＋解析（`buildArcTree`），对不上就整棵返回 `null` | `src/shared/arc-tree.ts:12-16`、`:69-101` | [developer] |
| 12 | 卡面警告：`arc-budget-engine-design.md` 的「代码算卷章数」前提 2026-10-19 已被推翻，不得当现行口径；本项阻塞性质是「前置功能未落地」不是「设计未定」 | `task_board_get ed210a27-…` prompt 末条／description | [已证实] |

**一句话**：弧的形状已经存在并实测过，缺的是**一句裁定**（p12 从「待裁定」→「已定型」）与**一根线**（`validateArcCovers` 接线，归 S3 实现）。

### 3.2 候选方案

**候选 A（结构位 ID 即弧层可引用实体，不建表）**
弧层定型 = ①p12 状态改「已定型（日期）」②设计稿 §5 S3 写明「弧层可引用实体 = `ArcNode.id`；键 = 结构位 ID，位置派生；重排后报 `UNKNOWN_NODE` 并 fail-open」③「重排即重扫」写成操作纪律 ④`validateArcCovers` 接线归 S3 实现，不在本 Goal。

**候选 B（弧只当一段 Markdown）**
不引入结构位 ID；S3 退化为「弧声明的章数区间是否覆盖 `total_chapters`」。

**候选 C（弧结构入库后再定型）**
新建 `arc_nodes` 表（id／kind／range／指纹）＋迁移，之后才承认定型。

### 3.3 推荐与代价

**推荐 A。** 理由：
1. 零新增数据结构：ID 已能派生、已被真实数据验证（3.1 #3／#6），A 只是把它写成结论；
2. A 的失败模式已被设计承认且有兜底：`UNKNOWN_NODE` 违规码 + fail-open（3.1 #4／#8／#9），重排不会变成误报洪水；
3. B 会把 AC3 降级成章数对账，与卡面目标不符；C 与 §1 的设计稿「不建议为四层建结构化表」冲突，且 M00 基线已冻结（§1.1 #2），是三案里唯一动数据＋要回填指纹的一案。

**代价**：
- 接受「弧重排后 ID 整体错位」这一已知弱点（一期不做指纹）；作者大改弧光时历史 `covers` 会集体报 `UNKNOWN_NODE`，需「重排即重扫」纪律。
- A 不解 FACT 收口遗留的「`validateArcCovers` 待接线」，接线归 S3 实现；A 也不改 `auditArcCovers` 现有「两级结构不做对账」的口径。
- B 代价：AC3 目标改小；C 代价：迁移＋基线指纹风险，成本最高。

### 3.4 影响面

**A 案（结构位 ID 即实体、不建表）：**
- **设计稿**：`p12-arc-node-anchoring-design.md:3` 状态行改「已定型」；`architecture-consistency-design.md:217-226`（§5 S3 补「可引用实体＝结构位 ID」）；p12 `:244`（P12-4 指纹那行）加「一期不做」的现状注，避免被读成已实现。
- **ROADMAP**：`:36`、`:143`、`:148`（L2-ARCH-01-03 表行／节／状态行）；`:116` 证据句里「第五层弧定型」一项可销。
- **回归面**：`arc-node` 单测与 `arc-cover-report`（`architecture.command.ts` 侧）不动；`validateArcCovers` 接线属 S3 实现，本 Goal 不建回归面。
- **看板**：卡 `ed210a27-4a31-4b72-b46d-4f572aaa914c`（`backlog`）转可开工。

**B 案（弧只当一段 Markdown）：**
- ROADMAP `:36`／`:143`／`:148` 可解，但 `L2-ARCH-01-03` 的卡面判据要**重写**：从「层间引用完整性」改成「章数区间覆盖」→ 与卡目标原文不符，等于改小一张卡的目标，需主人一并认；
- 文档：设计稿 §5 S3 整节重写；`p12`／`p13` 两份结构位设计稿降级为「未采用方案」，需在各自抬头写明；
- 回归面：零（不新增校验）；代价是 AC3 变成弱校验，`arc-node.ts` 的 `validateArcCovers`／三个不变量继续闲置（接线债仍挂）。

**C 案（弧结构入库）：**
- 需新建 `arc_nodes` 表＋迁移（M 系列），而 M00 基线已冻结（§1.1 #2）→ 旧项目指纹影响面同 §1.4 的 C 案；
- ROADMAP `:36`／`:143`／`:148` 判据改成「新表落地＋指纹回填＋校验通过」；设计稿 §6「不建议为四层建结构化表」需开口子并说明弧是例外；
- 文档另需 ADR（弧存储形状）＋p12 重写（ID 由解析顺序产物改为存储键）；回归面：schema 指纹测试、`arc-node` 解析器与新表的双写一致性测试；
- 代价最高，且与「一期不做指纹」的既有取舍（`arc-node.ts:58-64`）相反。

---

## 4. 三份的边界与依赖

- **不重叠**：§1 说「哪几层承认有键、校验对象是谁」；§2 说「AC2 的名单取哪两处登记」；§3 说「AC3 的实体取哪套 ID」。
- **依赖（不是互不依赖，按裁定后果分两种读法）**：
  - 三件**问题**本身可各裁各的：§2／§3 的候选不预设 §1 的结论，各需主人认可一张名单／一个口径。
  - 但**落地**互相牵动：若 §1 采 A 案（散文层不做层间校验、只认三类键），则 §1 表里 L1 的「键」格与 §2 的「登记名取哪两类」是同一件事的两面——§1 写「登记名」、§2 定「哪两类」，两处须同批裁、同批落 ADR，分两批裁会先落一份自相矛盾的 ADR。§1 采 B／C 案时，§2 的名单认定权收窄（B 案只剩角色名／C 案无名单），三件反而可分开裁。
  - §3 与 §1／§2 无此耦合：弧层的实体口径独立于散文层键的口径。
  - §1 采 A 案时，三案可同落一份 ADR，`00-OVERVIEW.md:96` 起的阶段三→五次序可一次排完。
- **两条跨前置的共用事实**（不重复列）：①AC1 的「散文→表」方向与 AC2 共用同一抽取能力（§2.4）；②AC1 的 S1.2 与 AC3 都属「给预检新增输入／接线」类债，与 `validateArcCovers` 同类。
- **不在本材料范围**：AC1／AC2／AC3 的校验代码（本 Goal 只解阻塞）；`L1-ARCH-02` 候选复审批次（`6be33a2b`）的事实卡——它只在 §5 第 4 句里作为「是否本轮一并定型」的待裁项出现，未出候选。

---

## 5. 要主人裁的四句话（不预设答案）

1. 架构定型：是否接受「散文层（L0／L1 除登记名／L3）不做层间校验，全书只有角色名／登记名／章节号三类键，`characters_arch` 按投影校验」作为定型结论，落 ADR？
2. 最小锚点：是否就是「世界观第 4 维的两类登记（空间名 ＋【具名人物登记】行）」，匹配只做逐字包含、名单空即显式未判、`characters` 表只作交叉核对？
3. 弧层形状：是否接受「结构位 ID（`M1-2/转折` 这一套）即弧层可引用实体，不建表、重排报 `UNKNOWN_NODE`」？
4. 批次身份与证明体系（`L1-ARCH-02`／看板 `6be33a2b`）是否本轮一并定型？

第 4 句的事实只有两条，原样引用：
- `docs/roadmap/ROADMAP.md:37` 表行：`| L1-ARCH-02 | L1 | 批次身份与证明体系 | 阻塞 | 无 |`
- `docs/roadmap/ROADMAP.md:156` 证据行：`- 状态：阻塞｜证据：动批次身份与证明体系，必须独立设计（与三件前置无关）`

若答「本轮不做」：本 Goal 收口按「五条解除＋`L1-ARCH-02` 留阻塞并注明依赖第四件前置」记，与 S4「17 ✅／3 不结案」同口径，不算欠账；若答「一并做」，本材料需追加第四件前置的事实卡（现无），故不建议在本 Goal 内处理。

---

## 6. 证据清单（本次原样读到的命令与输出）

```
$ sed -n '/^### L0-ARCH/,/^### L0-PLANUI/p' docs/roadmap/ROADMAP.md
  → `:116`／`:124`／`:132`／`:140`／`:148`／`:156` 六条「状态：阻塞」证据行
$ grep -n "L0-ARCH\|L1-ARCH-01\|L1-ARCH-02\|L2-ARCH-01-0" docs/roadmap/ROADMAP.md
  32:| L0-ARCH | L0 | 架构一致性（AC 系） | 阻塞 | 无 |      33:| L1-ARCH-01 … 阻塞
  34-36:| L2-ARCH-01-01/02/03 … 阻塞 | 无 |                     37:| L1-ARCH-02 … 阻塞
$ grep -n "premise TEXT\|worldbuilding TEXT\|characters_arch TEXT\|synopsis TEXT" electron/migrations/baseline-schema.ts
  43: premise …… 44: worldbuilding …… 45: characters_arch …… 46: synopsis …
$ grep -n "CREATE TABLE IF NOT EXISTS characters" -A 1 electron/migrations/baseline-schema.ts
  76:      name TEXT PRIMARY KEY,
$ grep -rn "validateArcCovers\|auditArcCovers" src electron --include=*.ts | grep -v __tests__ | grep -v "arc-node.ts:"
  src/services/workflows/commands/architecture.command.ts:812:  const audit = auditArcCovers(nodes, chapters, { from, to })
$ grep -rn "架构定型" docs .batch --include=*.md   → 19 行；排除本材料 6 行与 QA 复核件 4 行后为 9 处，全是转述，无裁定件（§1.1 #6）
$ sed -n '862,870p' electron/repositories/character-roster-repository.ts
  863:/** Compatibility prose is derived from ID facts and never acts as an identity write source. */
  864:export function refreshCharacterIdentityProjection(db) { … 868: UPDATE project_core SET characters_arch=? }
$ sed -n '836,845p' electron/repositories/character-roster-repository.ts
  839-843: meta.projection_hash !== hashText(renderedMarkdown) || meta.fact_hash !== fullFactHash([...entries])
           || currentProjection !== renderedMarkdown  ⇒ return 'inconsistent'
$ sed -n '666,690p' src/services/builtin-prompt-templates.ts
  668: ★【具名人物登记】…该人物必须在此另外单独成行登记，每行固定四段、用竖线分隔
  688: 第 4 维度里固定下来的两类名字都是后续引用的唯一键：① 空间名；② 在【具名人物登记】里单独成行的具名人物
  689: 【具名人物登记】只登记"有固定身份、会被反复引用"的位置锚定型配角
$ task_board_get a7589d74-… → status: backlog；4027dbef-… → status: todo；ed210a27-… → status: backlog
```

> 本文由项目总负责人主笔，交大肥鱼呈主人裁定；未 commit、未 push（push 归主身）。
