# S1 事实卡 · AC1／AC2／AC3 现状与卡点

- 供：项目总负责人主笔 `.batch/night/org/arch-unblock-1123.md`（我只给事实，不给方案）
- 判定面：`develop` HEAD `5d301150`（`5d3011503a1d09e3532f0d9e5ffcb7bd2c0d3827`），`git status --porcelain -uall | wc -l` = `0`
- 所有行号均为上述 HEAD 的当前值；标「已证实」＝我在本树读到原文或跑过命令，标「待验证」＝只有文档/注释指向、未见运行时证据

---

## AC1 / S1 层内一致性（看板 `a7589d74`，backlog，设计稿 §5 S1）

设计稿要求三件：**S1.1** `characters_arch`（散文）与 `characters` 表（角色卡）双向对齐；**S1.2** 大纲覆盖完整性（是否覆盖 `total_chapters`）纳入现有一致性报告；**S1.3** 复用引擎②的豁免／证据／严重级框架。

### S1.1 双向对齐 —— 一半已由「投影 + 哈希闸门」实现，另一半没有实现

**「表 → 散文」方向：已实现（已证实）**
- `characters_arch` 不是作者手写的真相源，而是**从角色 ID 事实派生的兼容散文**：`electron/repositories/character-roster-repository.ts:864-869` `refreshCharacterIdentityProjection()` —— `:867` `renderCharacterRosterMarkdown(entries, writingLanguage)` → `:868` `UPDATE project_core SET characters_arch=?`；函数注释 `:863` 原文「Compatibility prose is derived from ID facts and never acts as an identity write source」。
- 无表外写入点（已证实）：①`electron/repositories/character-roster-repository.ts:868`（`refreshCharacterIdentityProjection`）与 `:1096`（名单提交路径 `UPDATE project_core SET characters_arch = ?`，其后 `:1099` 校验 `changes !== 1` 即抛「项目主台账未初始化」）——同一 seam；②`src/services/workflows/commands/architecture.command.ts:1933` 的通用写入器 `writeArchToDb()` 签名里**虽然**含 `'charactersArch'`，但它的**三个调用点没有一个写它**：`:2222` `'premise'`、`:2841` `'worldbuilding'`、`:3240` `'plotStructurePlan'`。即「人物群像」已不由模型直写，`characters_arch` 只能是投影。
- 一致性闸门已存在：`deriveRosterStatus()` `:817-846`，`:839-843` 三条件同时成立才算 `ready` —— `meta.projection_hash !== hashText(renderedMarkdown)`／`meta.fact_hash !== fullFactHash(entries)`／`currentProjection !== renderedMarkdown`，任一不等即返回 `'inconsistent'`。即「散文与表不一致」这件事**已经有机读状态**，只是不叫 finding、不进一致性报告。
- 读侧已按状态分叉：`src/services/architecture-service.ts:73`（`roster.status === 'ready' || hasArchContent(core.charactersArch)`）与 `:113`（`roster.status === 'ready' ? roster.renderedMarkdown : core.charactersArch`）；同样分叉见 `src/components/editor/WorldBuildingEditor.tsx:105`、`:268`、`:280`。
- 名册的 join 键：`src/shared/character-roster.ts:17` `characterRosterIdentityKey(name)`；表侧主键 `characters.name TEXT PRIMARY KEY`（`electron/migrations/baseline-schema.ts:76`），另有 `character_id`（`:851` 起 `retired=0` 过滤用）。

**「散文 → 表」方向：未实现（已证实）**
- 全仓没有「从散文里抽人名、比对是否建卡」的代码。最接近的一件是 `src/services/architecture-character-nudge.ts`（233 行），但它**只决定提不提示**：`:139-155` `shouldNudgeOutlineCharacterSupplement()` 判据是「大纲有内容（`hasOutlineContent`，`:90-102`，阈值 `:32` 50 字）+ 该卷未处理 + 全局开关」；`:134-136` 去重键是 `v<卷号>:<wip|final>`。文件头 `:15` 原文「本模块只负责“该不该提示”与“提醒是否已被处理”，不做任何写入、不碰项目数据」——**不含任何名字抽取或比对**。
- 所以看板卡面写的「散文写了没建卡 / 建了卡散文没写」里，前者的判定能力与 AC2 是**同一件事**（都需要从散文抽具名实体），不存在一个「S1 自己做得了的便宜版本」。

### S1.2 覆盖完整性 —— 有记账、有 UI 提示，没有「未覆盖」finding

- 覆盖进度是**记账量**：`src/services/workflows/commands/architecture.command.ts:1151-1173`（缺 `synopsis_covered_to` 按未覆盖读＝fail-closed，`:1173` 生成「> 本大纲已覆盖至第 ${coveredTo} 章（全书 ${totalChapters} 章）…」提示行）；本批实际章数 `:348` `actualChapters`；卷数账 `synopsis_volume_deviations`（`:190`、`:1077`、`:1089`）。
- 覆盖到顶只在 UI 文案：`src/components/dialogs/ArchitectureConfirmDialog.tsx:423-428`（`coveredTo`／`continueStart`／`canContinue`）、`:728` 「已覆盖至第 ${coveredTo} 章，全书章节均已覆盖。」。
- **没有**把它做成一致性 finding 的消费者：`src/shared/consistency-preflight.ts` 的规则入口是 `findBlueprintSpaceTimeRisks`（`:146-172`）与 `findBlueprintSlotAttackRisks`（同文件，S2 新增），输入是**章节蓝图**，不含 `synopsis`／`total_chapters`。⇒ 要「纳入一致性报告」必须新增一类输入，属接线（同 L0-ARCH 的 `validateArcCovers` 那条）。

### S1.3 复用引擎②框架 —— 骨架在，接口是蓝图专用（已证实）

- `src/shared/consistency-preflight.ts:173` `mergeConsistencyFindingsIntoReview`、`:197` `ConsistencyPreflightCoverage`、`:210` `describeSpaceTimeCoverage`、豁免精确匹配 `:159` `activeExemptions.has(...)`；服务层 `src/services/consistency-preflight.ts:42` `Promise.all` / `:48` / `:56` / `:57`。
- 但这套接口的 finding 产物形态是「蓝图层 + 章号」(`sourceLayer: 'blueprint'`)，架构层（`premise`/`worldbuilding`/`characters_arch`/`synopsis`）**没有对应 `sourceLayer` 值**，也没有承载「无章号」finding 的字段 —— 复用需要先定义这一格（属契约，不属实现）。

---

## AC2 / S2 层间引用完整性（看板 `4027dbef`，todo，卡面明写「需先定『最小锚点』」）

### 卡点原文（已证实）

- 卡面：「**前置裁定（必须先定）**：「**最小锚点**」是什么」，纪律 = 只查具名、放过指代、高门槛宁漏勿误。
- 设计稿 §5 S2：「**必须先在 `architecture-consistency-design` 里定“锚点”：谁算具名实体、如何抽。**」—— 该文档到本 HEAD 仍未落这一节（`docs/design/architecture/architecture-consistency-design.md` 395 行，§5 在 `:192-231`，S2 段 `:206-215` 只有交付表与「需先定」，无定义）。

### 更关键的一条事实：锚点的**输入**可能已经存在，缺的是解析器（已证实）

- 世界观提示模板已经**强制要求**把具名人物单独登记成行：`src/services/builtin-prompt-templates.ts:668` 原文「★【具名人物登记】…该人物必须在此**另外单独成行登记**，每行固定四段、用竖线分隔」；`:688` 原文「第 4 维度里固定下来的两类名字都是**后续引用的唯一键**：① 空间名；② 在【具名人物登记】里单独成行的具名人物…弧光、情节大纲与章节蓝图会用同一个名字引用他们」；`:689` 限定「只登记有固定身份、会被反复引用的位置锚定型配角；一次性路人不登记」。
- 但**没有任何解析器读这四段**：`src/shared/space-time-consistency.ts:159` 注释原文「散文行、以及【具名人物登记】的 `人名｜定位｜口吻｜关系` 行（**无 `=`**）都不会被误收」——即解析器是**特意排除**它们的；`src/shared/__tests__/space-time-consistency.test.ts:63-66` 断言「具名人物登记行都不收」。全仓 `具名人物登记` 只出现在模板文案（`builtin-prompt-templates.ts:668/688/689`）、上面那处注释、那条测试。
- 空间侧已有可用的锚点范式：`src/shared/space-time-consistency.ts:161-199` `parseSpaceRules()`（认 `名字=规则` 的机读行、200 字上限、后条覆盖前条）；键 `:237-245` `spaceTimeStableFactKey()`（FNV-1a 64，前缀 `space:`）。
- 蓝图侧已有 name 级引用完整性范式：`src/shared/blueprint-semantic-contract.ts:61` 要求 `newCharacterCandidates` 的 `name` **逐字复制 `characters` 中的一个完整姓名**；`src/shared/blueprint-key-events.ts:29`（`attacks` 声明须逐字复制第 4 维登记名，契约 `blueprint-semantic-contract.ts:51/63`）。

### 现状缺口（已证实）

- 预检链目前只吃蓝图：`findBlueprintSpaceTimeRisks`（`src/shared/consistency-preflight.ts:146-172`）入参是蓝图集合；`synopsis`（纯散文 + `## 第N章：` 标题，标题格式约束见 `src/shared/chapter-heading.ts:84`）与 `worldbuilding` 的具名实体**从未进入任何机检**。
- 节点卡片裁决（`a7589d74`）已把 S1.1 的「散文→表」方向与 AC2 绑在同一能力上；S2 落地即可回填 S1.1 的缺口。

---

## AC3 / S3 弧加入后校验（看板 `ed210a27`，backlog，卡面写「⛔ 被第五层阻塞」）

### 卡点原文（已证实，代码级）

- 弧层**没有表、没有稳定键**，只有一段 Markdown：`electron/migrations/baseline-schema.ts` 内 `CREATE TABLE ... arc*` **零命中**（只匹配到 `characters` `:75`、`narrative_thread_plans` `:341`、`narrative_thread_confirmations` `:352`）；弧存 `project_core.plot_structure_plan` 文本，结构靠解析。
- 节点 ID 是**解析顺序的产物**，不是存储键：`src/shared/arc-node.ts:69-70` 注释「稳定 ID：`M1` | `M1-2` | `M1-2/转折` | `M1-1/小弧:纸门牌`」，而 `:112-120` 是 `parsed.majors.forEach(...)` 里 `id: 'M' + majorIndex` —— 原文重排即全部漂移。同文件 `:60-61` 注释自认：「检测办法是给每个节点附文本指纹，指纹不匹配即提示复核。**一期不做**」。
- 树视图同样只读 + 解析：`src/shared/arc-tree.ts:69-101` `buildArcTree(plan)`，`:12-16` 注释「树一旦可编辑就出现『文本一份、树一份』…所以本模块只**读**」；标题匹配靠正则 `:58`／`:60`，对不上就整棵树返回 `null`（`:76`）。
- 已有但未接线：`src/shared/arc-node.ts:238-297` `validateArcCovers()`（纯函数，`ArcCoverViolation` 六个码 `:89`），目前只在 `src/services/workflows/commands/architecture.command.ts:812` 的 `auditArcCovers` 里用（`:802-804` 明写「两级结构不做覆盖对账」），**未接进 **`consistency-preflight`（S2 已作为偏差记录，未修）。

### 设计稿与「定型」的关系（已证实）

- 卡面所述三份设计稿在盘上：`docs/design/architecture/p12-arc-node-anchoring-design.md`、`p13-arc-layer-expansion-design.md`（`arc-node.ts:63` 的 `@see` 指向 p12）、`arc-budget-engine-design.md`；另有 `arc-granularity-and-enum.md`、`arc-nesting-design.md`。
- 但「弧定型」这件事**没有判过**：本 HEAD 的 ROADMAP `:143-149`（L2-ARCH-01-03）仍写「阻塞」，`:34-36` 三条 L2 全「阻塞」，`:114` 的 L0 完成判据要求 §5 三节带验收结论 —— 现在一节都没有。

---

## 三件的前置关系（事实层，不含建议）

1. AC2 的「最小锚点」若落在【具名人物登记】四段上，则**输入在文本里已存在**，卡点从「怎么抽」变成「要不要认这四段为契约」——这是契约裁定，不是实现难度。
2. AC1/S1.1 的「散文→表」方向与 AC2 共用同一抽取能力；S1.2 的覆盖完整性若要进一致性报告，需要给预检**新增一类非蓝图输入**（同 `validateArcCovers` 的接线债）。
3. AC3 的阻塞不是「设计没写」，是**弧没有存储形状**：ID 由解析顺序生成、无指纹（`arc-node.ts:60-61` 自述一期不做）。这条与「弧定型」是同一件事的两种说法。
