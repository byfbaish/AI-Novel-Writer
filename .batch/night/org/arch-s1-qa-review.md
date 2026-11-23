# ARCH 解阻塞 · S1 材料 QA 复核意见

> 作者：QA · AI writer项目组｜2026-11-23｜用途：供大肥鱼在呈主人裁定前修订
> 对象：`.batch/night/org/arch-unblock-1123.md`（232 行／22,897 B／sha256 `ea5ccc7d…`）
> 　　　`.batch/night/org/arch-s1-facts-developer.md`（80 行／11,769 B／sha256 `94fe7282…`）
> 判定面：HEAD `5d301150`，`git status --porcelain -uall` 只有这两行 `??`
> 口径：**只出复核意见，不改材料**。每条给「材料原文位置 → 我实跑的命令与原文 → 影响 → 建议」。
> 范围：只核「事实是否可核、候选是否互斥、代价是否漏项」，不评方案优劣、不给裁定。

---

## 0. 结论先行

| 级别 | 条数 | 是否阻塞呈裁 |
|---|---|---|
| **B-1 阻塞** | 1 | **是**——不补，Goal 的「六条同步解除」拿不到 |
| **B-2～B-5 须改** | 4 | 建议呈主人前同批改；不改则主人读到的是错数字/不完整影响面 |
| **C-1～C-5 记账** | 5 | 否，不阻塞裁定 |

一句话：**材料结构完整、主结论（三件都缺「一句裁定」）站得住，A 案推荐的事实基础我逐条抽核过、成立**；问题集中在 ①少覆盖一张卡（`L1-ARCH-02`）②三处数字/行号与原文对不上 ③`§1-A` 与 `§2-A` 实为同一决定却声明互不依赖 ④影响面只覆盖推荐案。

---

## 1. B-1（阻塞）：`L1-ARCH-02` 与第 4 张卡没被覆盖，Goal acceptance 对不上

**材料**：§4「不在本材料范围：…`L1-ARCH-02` 候选复审批次（`6be33a2b`，另一条机制）」。

**事实**：
- Goal acceptance 原文要求「**L1-ARCH-01／L1-ARCH-02** 及其三张 L2 子卡在 ROADMAP 与看板上同步解除阻塞」；大肥鱼派单也写「看板四张卡」。
- 看板实查四张：`a7589d74`（AC1，backlog）、`4027dbef`（AC2，todo）、`ed210a27`（AC3，backlog）、`6be33a2b-161c-446e-9dbd-95382e570c8b`（§8 候选复审批次，todo，标签 `C-架构一致性`）。
- `ROADMAP.md:37` `| L1-ARCH-02 | L1 | 候选复审批次（§8·判据⑰） | 阻塞 | 无 |`；`:156` 阻塞证据原文「看板卡标注「动批次身份与证明体系，必须独立设计，不能顺手改」」。
- 该阻塞理由**不是**三条前置之一（架构定型／最小锚点／弧层形状）⇒ 三件裁完它也解不了。

**影响**：Goal 的 stage 3 验收（六条 ROADMAP 行解除阻塞）必然对不上，届时只能改口径，等于返工。

**建议**（二选一，请主身裁）：
1. §4 补一节「`L1-ARCH-02` 的解除条件」，把「批次身份与证明体系是否纳入本次架构定型」作为**第 4 句待裁**（材料 §5 现只有三句）；
2. 若确定本期不覆盖，请主身同步改 Goal acceptance 为「三张 L2 子卡 ＋ L1-ARCH-01」，并在 ROADMAP `:156` 写明「本 Goal 不解除 L1-ARCH-02」，避免 stage 3 验收自相矛盾。

---

## 2. B-2～B-5（须改）

### B-2 §1.1 第 1 条数字自相矛盾
**材料**：「五层在数据上就是 `project_core` 的**五个列**：`premise`／`worldbuilding`／`characters_arch`／`synopsis`」（只列 4 个），紧接着第 2 条写「第五层「弧」是**第六个列** `plot_structure_plan`」。
**实核**：`electron/migrations/baseline-schema.ts:42` 注释 `-- [架构四大件]`，`:43-46` 恰四列；`electron/migrations/m07-plot-structure-plan.ts:7-10` 把 `plot_structure_plan` 加为**第五个架构列**（`project_core` 全表另有基础定位/写作技法等 20+ 列，不能按字面数"第 N 个列"）。
**建议**：改为「四个散文列（`:43-46`）＋ 第五个弧列 `plot_structure_plan`（M07 加，`:7-10`）」。主人读的第一句就是数字，错在这里最贵。

### B-3 §1.1 第 10 条事实不准，连带代价漏两处
**材料**：「预检的 finding 形态只有 `sourceLayer: 'blueprint'`＋章号，架构四层没有对应 `sourceLayer` 值，也没有承载「无章号 finding」的字段」（引 `consistency-preflight.ts:146-172`、`:173`、`:197`、`:210`）。
**实核**：
- `src/shared/space-time-consistency.ts:105` `export type ConsistencySourceLayer = 'world-building' | 'blueprint'`；同文件 `:319` 就产出 `'world-building'`。⇒ 不是「只有 blueprint」，是**两个值**。
- 真正的硬空白是 `ConsistencyFinding.sourceChapter: number` **必填**（`consistency-preflight.ts:17`）；`sourceLayer?` 反而是可选（`:28`）。
- 面板文案是**二元硬编码**：`src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43`「`=== 'world-building' ? '世界观设定…' : '本章蓝图 / 空间规则'`」⇒ 扩值后架构层会**静默显示成「本章蓝图」**。
**影响**：不影响"要补一格契约"的结论，但 §1.3 代价少两项必改点，主人会低估 A 案改动面。
**建议**：①#10 改成「现有两类值 `world-building`／`blueprint`，`sourceChapter` 必填，无"无章号 finding"形态」；②§1.3 代价补：扩联合需同批改 `ConsistencyPreflightPanel.tsx:42-43` 文案与既有 `sourceLayer` 赋值点（现 12 处）；无章号 finding 需改 `sourceChapter` 必填形态。

### B-4 §4「§2／§3 都不依赖 §1 的裁定结果」偏乐观
**材料**：§4 同句；但 §1.2 候选 A 的定型表第 2 行已写「L1 `worldbuilding`：散文·**键＝第 4 维登记名**」，而「锚点是不是第 4 维两类登记」正是 §2 的唯一待裁点。
**影响**：主人在裁 §1 时其实已经顺带裁了 §2-A；若 §2 选 B/C，§1-A 的 L1 那格立刻要回改。三件「各自独立裁」的说法对不上，容易裁出互相矛盾的组合。
**建议**：§1 A 表 L1 键那格标「待 §2 定」，或 §4 明写「§1-A 与 §2-A 是同一决定的两面，任一处不选 A 需回改另一处」。

### B-5 影响面只覆盖推荐案（A）
**材料**：§1.4／§2.4／§3.4 全部按 A 案写「哪张卡转可开工、哪处文档跟着改」。
**影响**：stage done-when ④要求「影响面（哪几张卡/哪几处文档要跟着改）」；三件都交主人裁，若主人选 B/C，材料里没有答案。§1.3 只给了 B/C 的"代价"一句，没给"要改哪些文件/卡"。
**建议**：每件补一行「若选 B／C：…」。可直接用的骨架：
- §1 B 案：AC1 继续 backlog，`ROADMAP.md:32`／`:132` 不动，仅需在 ADR 记「定型未裁」；C 案：与 `baseline-schema.ts` 冻结冲突（`m07-plot-structure-plan.ts:4-6`），ROADMAP 须新增迁移卡。
- §2 B/C：卡 `4027dbef` 判据要重写（`characters.name` 全量或只 `structuredRefs`），影响面从「新解析器」降为「零解析器」；`src/services/consistency-preflight.ts:160` 入口不变。
- §3 B/C：p12 保持「待裁定」，`ed210a27` 继续挂；C 案须启 M08 迁移并回填指纹（`m07` 同款风险）。

---

## 3. C 级记账（不阻塞裁定）

| # | 材料位置 | 材料写的 | 我实跑的原文 | 建议 |
|---|---|---|---|---|
| C-1 | §3.1 #2 | 「弧层（阶段一）已落地并提交 `796528f`」引 `00-OVERVIEW.md:97` | `:96` 才是「├─ 阶段一：弧层落地…✅ 已提交 `796528f`」；`:97` 是「① 阶段结构层 步骤 1–3」 | 改 `:96` |
| C-2 | §1.1 #7 | 「AC1 顺延理由…」引 `00-OVERVIEW.md:118` | `:109` 是「⑤ AC1 层内一致性（作者：等架构不完整期过去，否则回归测试爆炸）」；`:118` 是「⑨ 物品/场景/时间线」；`:128`／`:145` 另有两处同义表述 | 改 `:109` |
| C-3 | §1.4 影响面 | 「`:108`／`:118` 的「架构定型后」改为指向 ADR」 | `:108` ✓；`:118` 无此内容 | 删 `:118` 或改 `:128`／`:145` |
| C-4 | §1.1 #6 与 §6 | `grep -rn "架构定型" docs .batch` → **7 处** | 排除本材料自身 6 行后实为 **9 处**：`ROADMAP.md:116/124/132`、`00-OVERVIEW.md:108`、`prompt-assembly-backlog.md:817`、`handoffs/archive/2026-10-15-…:206`、`arc-granularity-and-enum.md:259` **与 `:276`**、`p11-…:321` | 补两处、数字改 9。「无裁定件」结论仍成立 |
| C-5 | §2.1 #11 | 「卡面把『先产出最小锚点定义』列为**第一步**…（prompt §2／§3）」 | 卡 `4027dbef` prompt：定义在**第 2 步**，≥10 边界例子在**第 3 步**，无 §2／§3 分节 | 改「第 2 步／第 3 步」 |

另两处小偏差（同上性质，可一并改）：
- §3.1 #8「指纹一期不做」引 `p12:45`：实核 p12 `:45` 是表格「| 层 | ID | 例 |」，讲指纹的只有 `:244`（P12-4 行）。源头在 `arc-node.ts:58-64`（已核 ✓）。
- §2.1 #7「`spaceTimeStableFactKey()`（FNV-1a 64，前缀 `space:`）」引 `:237-245`：声明在 `space-time-consistency.ts:249`，`:237-245` 是 `fnvStableFactKey` 的签名与循环体。

---

## 4. 互斥性检查（三件候选）

| 件 | 候选 | 判定 | 说明 |
|---|---|---|---|
| §1 | A／B／C | **互斥 ✓** | A＝落定型表；B＝只认两表不变、散文层待后；C＝先结构化。三者结果互斥，无"两案同时成立" |
| §2 | A／B／C | **互斥 ✓**，但 C 的描述要改 | C＝只认 `structuredRefs`，材料写「C 等于不做」是评价不是事实（`space-anchor.ts:17` 只说明蓝图侧已被 `findSpaceTimeConflicts` 判过，C 仍是"只查一处"而非零） |
| §3 | A／B／C | **互斥 ✓** | A＝ID 即实体；B＝退化为章数对账；C＝建 `arc_nodes` 表 |
| 跨件 | §1-A 与 §2-A | **不是互斥问题，是伪独立** | 见 B-4 |

## 5. 代价漏项清单（按件）

- **§1 A**：漏 ①`ConsistencySourceLayer` 扩值牵动面板文案（`ConsistencyPreflightPanel.tsx:42-43`）与既有 12 处赋值；②`sourceChapter` 必填形态要改；③「散文层不做层间校验」一旦写进 ADR，`architecture-consistency-design.md:235-245`（§6 不建议）与 `:247-260`（§7 结论表）两处要同步标注"已被 ADR 取代"，否则后续按旧稿实现。
- **§2 A**：漏 ①新解析器与 `parseSpaceRules()`（`space-time-consistency.ts:161-199`）共存时的**双报口径**（同一名在登记行与空间条目散文各出现一次，算几次、报几条）；②卡 `4027dbef` 的判据要重写（现 prompt 第 3 步只有"≥10 例子"，未提"双报去重"）。
- **§3 A**：漏 ①p12 从「待裁定」改「已定型」后，`arc-budget-engine-design.md` 等旧稿哪些条款**不再引用**要写成清单（卡面已警告前提被推翻，但材料未把它列成"跟着改的文档"）；②`validateArcCovers` 接线后与 `auditArcCovers`（`architecture.command.ts:812`，`:802-804` 明确两级结构不对账）的**互斥关系**要写一句，否则下一期会出现两套覆盖判据。

---

## 6. 我已核过、判「无误」的事实（抽样，逐条给命令原文）

| 材料位置 | 核验 |
|---|---|
| §1.1 #1 | `baseline-schema.ts:43-46` 四列 ✓ |
| §1.1 #3 | `:58` `chapter_number INTEGER PRIMARY KEY` ✓、`:76` `name TEXT PRIMARY KEY` ✓、`builtin-prompt-templates.ts:688` 唯一键条款逐字 ✓ |
| §1.1 #2 | `m07-plot-structure-plan.ts:4-10` 基线冻结＋加列 ✓ |
| §1.1 #4／#5 | `architecture-consistency-design.md:29`（四层纯文本无 join 键）、`:88-95`（层表）、`:235-245`（§6 不建议建表）、`:247-260`（§7 结论表）✓ |
| §1.1 #8 | `character-roster-repository.ts:862-869`，`:863` 注释「never acts as an identity write source」逐字 ✓ |
| §1.1 #9 | 同文件 `:836-846`：三条件任一不等 `'inconsistent'` ✓ |
| §1.1 #11 | `architecture.command.ts:1933`（定义）＋`:2222`／`:2841`／`:3240`（三个调用点）✓，均不写 `charactersArch` ✓ |
| §1.1 #12 | `:1151-1173`（覆盖记账）、`ArchitectureConfirmDialog.tsx:423-428`（`canContinue`）、`:728`（已覆盖文案）✓ |
| §2.1 #4／#5 | `builtin-prompt-templates.ts:668-672`（四段行＋未登记不可引用）、`:688`／`:689` ✓ |
| §2.1 #6 | `space-time-consistency.ts:159` 注释「…登记行（无 `=`）都不会被误收」✓；测试 `:63-66` 断言不收 ✓ |
| §2.1 #8 | `space-anchor.ts:1-42` 三契约／白名单注释、`:87`／`:100` `knownSpaces` ✓ |
| §3.1 #1 | `m07:9`；`grep -n "CREATE TABLE.*arc" baseline-schema.ts` → rc=1 零命中 ✓ |
| §3.1 #3／#4 | `arc-node.ts:66-101` 格式；`:112-120` `id: 'M' + majorIndex` 在 `forEach` 内生成 ✓ |
| §3.1 #5／#6／#7 | p12 `:103-125` 三不变量；`:183` 实测「20 个结构位」；`:3` 状态「待裁定（2026-10-18）」✓ |
| §3.1 #8 | `arc-node.ts:58-64`「一期不做」✓（p12 行号见 C 级） |
| §3.1 #9 | `grep -rn validateArcCovers` 排除测试后只命中 `arc-node.ts:215`（注释）／`:238`（定义）／`:449`（模块内调用）✓；`architecture.command.ts:812` 生产只调 `auditArcCovers` ✓、`:802-804` 两级结构不对账 ✓ |
| §3.1 #11 | `arc-tree.ts:12-16`「树只读」✓ |
| §3.1 #12 | 卡 `ed210a27` prompt 末条「`arc-budget-engine-design.md` 的『代码算卷章数』前提已被 2026-10-19 裁定推翻」逐字 ✓ |
| §1.4／§2.4／§3.4 | `ROADMAP.md` `:32`/`:37` 表行、`:116`/`:122`/`:124`/`:132`/`:135`/`:140`/`:143`/`:148`/`:156` 各状态行、`:346` 验收记录路径 ✓ |

---

## 7. 复核结论

1. **可核性**：20+ 条事实逐条抽核，主体成立；错的是行号与计数（C 级 5 条 ＋ 2 条小偏差），不改不影响裁定，但违反「每个数字带出处」的自定口径。
2. **互斥性**：单件内三案互斥 ✓；跨件存在**伪独立**（B-4），须在材料里写明耦合。
3. **代价**：三件各有一到三处漏项（§5），其中 §1 漏的是**必改代码点**（面板文案、`sourceChapter` 形态），会直接影响主人对成本的判断。
4. **阻塞项**：B-1（`L1-ARCH-02`／第 4 张卡）不补，Goal stage 3 无法收口。

**我的意见：材料可呈裁，但请先处理 B-1（并请主身同步决定 Goal acceptance 口径）；B-2～B-5 建议同批改，C 级记账即可。** 材料未被我改动一行；本文件为新增件。
