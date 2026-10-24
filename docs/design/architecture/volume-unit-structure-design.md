# 卷 / 单元的结构持久化（volume & unit index）

> **状态**：✅ **已落地**（2026-10-24，M19，schema 19 → 20）。施工规格 = [`p1-2-volume-structure-plan.md`](../../plans/p1-2-volume-structure-plan.md)。
> **背景**：P1-2 期 1 建了 `volume_handoffs`（作者手填章号区间）后，作者指出「卷信息还是需要结构持久化的，单元也做的话，很多东西就不需要只凭推断或者现算了，后面还有部」。
> **schema**：19 → 20（M19）

---

## 0. 四问（本项目加机制前的硬规矩）

**1. 这件事在行业里叫什么？**
story bible 的 **structure 分区**：`book → part → volume → chapter` 的层级。商业工具都结构化存它（Scrivener 的 Binder 层级、Plottr 的结构轴、系列 bible 的 book/part 分节）。中文网文的「卷 / 单元」是平台章节分组约定（起点「卷」、番茄「单元」），**不是我们发明的词**。

**2. 谁消费它的产出？**（若只有一块展示面板 ⇒ 停）

| 消费方 | 现在怎么拿「本章属于哪卷/单元」 | 有结构表之后 |
|---|---|---|
| **正文链**（该注入哪份交接单） | `volume_handoffs.last_chapter < 本章`（作者手填的区间） | 选卷 + `volumeEffectiveRanges` 的有效末章 |
| **交接单面板** | 作者手填卷号 + 两个章号 | **选卷 → 区间只读展示** |
| **P1-2 期 2**（卷末自动生成交接单） | 只有 `architecture.command.ts:3374` 的游标翻转，**不知道"这一卷从第几章到第几章"** | ✅ **已消费（2026-10-24）**：触发点改在定稿链（`volumeRangeEndingAt` 判卷末章），生成时按 `volumeEffectiveRanges` 取区间与要点 |
| **W8 跨部**（部 → 卷 → 单元） | 无（部这一层完全靠文本） | `part` 挂在卷上，外键骨架已就位 |
| 卷切片（W7b，未做） | 无 | 按 `volume_id` 取本卷章号区间 |
| 大纲树（后期切换） | 每次渲染时现算 + 等分推断 | 直接读表 |

**不是只有面板** ⇒ 立项成立。

**3. 失败形态在行业分类里属哪一类？**
ConStory-Bench「时间线与情节逻辑」下的结构归属错误。具体后果不是「数字不对」，而是**上下文注入错卷**（把第 2 卷的交接单喂给第 3 卷的章）。与 P1-2 期 1 加的「区间重叠双层拒」是**同一个失败形态**，只是从手填错误升级成系统性错误。

**4. 已有产品/论文做过什么？我们与它的差异？**
它们只有**一处**结构真相；我们是**双源**（Markdown 大纲 + 数据库）。所以差异不在功能，而在**必须先定义谁是权威**——已由作者裁定：**大纲是计划权威，表是物化副本**。

---

## 1. 现状（含一处对早期判断的更正）

### 1.1 结构在哪

| 位置 | 形态 | 角色 |
|---|---|---|
| `project_core.plot_structure_plan` | Markdown（`## 卷…` / `### 单元…`，卷可能带「（约 N 章）」） | **计划权威**（作者在这里写） |
| `project_core.synopsis` | Markdown；新格式章标题是 `## 第V卷第U单元第Z章（全书第N章）：…` | 章级计划 + **精确归属源** |
| 检查点 JSON `synopsis_volume_deviations`（`architecture.command.ts:161-168`） | 每卷 `{ volumeIndex, planned, actual }` | **按卷的章数账**（元，不是章号） |
| 检查点 JSON `synopsis_unit_cursor` | `{ volumeIndex, unitIndex, writtenInVolume }` | E3 游标（章数，无章号） |
| M18 `volume_handoffs` | 作者手填 `first_chapter / last_chapter` | 已写完卷的区间（**本期改为外键**） |

### 1.2 「六份解析」是我早期说重了 —— 更正保留

实查结果：**基础解析只有一份**。

- `arc-position.parseArcStructure(plan)` 解析出 `majors`（卷）/ `mids`（单元），章号区间由 `scaledBoundaries()` **按权重等比折算到 `totalChapters`**。
- `outline-tree.buildOutlineTree()` **复用** `parseArcStructure`（`outline-tree.ts:135`），只是再叠章分组；标题缺卷归属时它退到 `span.majorIndex` 推断（`:183`）。
- `synopsis-unit-heading` / `chapter-position` 只是**渲染**，不解析。
- `arcSpanForUnit` 也被注释明确限定「**只用于文本投影，不参与任何状态判定**」（`arc-position.ts:446-448`）。

⇒ **不缺解析器**，缺的是 ① **可查询的骨架**（现在每次都要重新解析 + 折算）② **精确来源的优先级**（synopsis 的归属标题比折算准得多，但只有新格式项目有）。

### 1.3 三本真实项目的形态（实测，决定了三档来源）

| 项目 | schema | `plot_structure_plan` | `synopsis` | 能用的最高档 |
|---|---|---|---|---|
| 师父派我来除魔… | 18 | `## 卷一` + `### 单元一`（**无章数**） | `第1卷第1单元第1章（全书第1章）`（**带归属**） | `headings`（精确） |
| 每天第一句谎话都会成真 | 9 | `## 大弧一：…（约 1–50 章）`（**带章数**） | `## 第1章：…`（旧格式） | `declared`（折算） |
| 如果我的能力是每天第一句谎言… | 10 | `## 卷一` + `### 单元一`（**无章数**） | `## 第1章：…`（旧格式） | `even`（估算） |

**作者裁定**：设计只以第一本（新格式）为依据；后两本是历史遗留，界面标「估算」即可，**不做手改区间入口**。

---

## 2. 形状（M19，schema 19 → 20）

### 2.1 `volumes`（12 列）

```sql
CREATE TABLE volumes (
  volume_id      TEXT PRIMARY KEY,
  volume_index   INTEGER NOT NULL UNIQUE CHECK(volume_index > 0),
  name           TEXT,
  planned_first  INTEGER CHECK(planned_first IS NULL OR planned_first > 0),
  planned_last   INTEGER,
  planned_source TEXT NOT NULL CHECK(planned_source IN ('headings','declared','even')),
  actual_last    INTEGER CHECK(actual_last IS NULL OR actual_last > 0),
  actual_source  TEXT CHECK(actual_source IN ('finalized','author')),
  outline_hash   TEXT NOT NULL,
  source         TEXT NOT NULL,
  created_at     TEXT,
  updated_at     TEXT,
  CHECK(planned_last IS NULL OR planned_last >= planned_first),
  CHECK((planned_first IS NULL) = (planned_last IS NULL)),
  CHECK((actual_last IS NULL) = (actual_source IS NULL))
);
```

### 2.2 `volume_units`（9 列）

```sql
CREATE TABLE volume_units (
  unit_id        TEXT PRIMARY KEY,
  volume_id      TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
  unit_index     INTEGER NOT NULL CHECK(unit_index > 0),
  name           TEXT,
  planned_first  INTEGER CHECK(planned_first IS NULL OR planned_first > 0),
  planned_last   INTEGER,
  planned_source TEXT NOT NULL CHECK(planned_source IN ('headings','declared','even')),
  created_at     TEXT,
  updated_at     TEXT,
  UNIQUE(volume_id, unit_index),
  CHECK(planned_last IS NULL OR planned_last >= planned_first),
  CHECK((planned_first IS NULL) = (planned_last IS NULL))
);
```

> **表名不叫 `units`**：`src/shared/draft-units.ts` 与 `planning:target-units` 已用 unit 表示「正文段落单位」，同名会撞。

### 2.3 `volume_handoffs` 改外键（重建，11 列）

```sql
CREATE TABLE volume_handoffs (
  handoff_id  TEXT PRIMARY KEY,
  volume_id   TEXT NOT NULL UNIQUE REFERENCES volumes(volume_id) ON DELETE RESTRICT,
  world_state TEXT,
  hero_state  TEXT,
  events_json TEXT NOT NULL DEFAULT '[]',
  items_json  TEXT NOT NULL DEFAULT '[]',
  debts_json  TEXT NOT NULL DEFAULT '[]',
  open_thread TEXT,
  source      TEXT NOT NULL,
  created_at  TEXT,
  updated_at  TEXT
);
```

**迁移时机已核实**：三本真实库 schema = 18 / 10 / 9，`volume_handoffs` **在任何真实库都不存在**。M19 里 `DROP` 前仍带「非空就抛 `M19_VOLUME_HANDOFF_NOT_EMPTY`」的守卫，**不许改成无条件 DROP**。

### 2.4 三处「没有的列」与理由

| 没有 | 理由 |
|---|---|
| `actual_first` | 它是「上一卷有效末章 + 1」的派生值。存下来要两行同写，半途失败就自相矛盾；还会把估算写进 `actual_*`（判据 DN 同型）。起点只在 `volumeEffectiveRanges()` 一处算 |
| `status` / `planned_words` | 「这一卷写完了」由 `actual_last IS NOT NULL` 回答，不造第二个真相；章数/字数属派生数值（ADR-0022） |
| `part_index` | 部随 W8 加列（SQLite 加列一条迁移，成本极低；为空想加列 = 自造标准） |

### 2.5 FK 与唯一约束的选择

| 约束 | 选择 | 理由 |
|---|---|---|
| `volume_units.volume_id` | `ON DELETE CASCADE` | 纯物化投影，删卷即删单元 |
| `volume_handoffs.volume_id` | `ON DELETE RESTRICT` | 有交接单的卷不能删，否则跨卷记忆静默消失 |
| `UNIQUE` | **写在列上**，不建独立 `CREATE INDEX` | 与 M18 注释 `m18-volume-handoffs.ts:28-32`、M14/M15/M17 一致 |
| `source` | **不加 CHECK** | 沿用 M18「source 不校验取值」，避免以后加值还要重建表 |

---

## 3. 计划 vs 实际：三档来源与写入规则（本设计最要紧的一条）

### 3.1 三档来源的判定顺序

| 档 | 条件 | 精度 |
|---|---|---|
| `headings` | `synopsis` 里有 `第V卷第U单元第Z章（全书第N章）` 形态的标题 | **精确**：第 V 卷末章 = 第 V+1 卷首个归属章的 `chapter - 1`；单元区间 = 该单元所有归属章的 min/max |
| `declared` | `plot_structure_plan` 里**每一卷都**带「（约 N 章）」 | 折算（`scaledBoundaries`）；`declared` 总和 == `totalChapters` 时精确 |
| `even` | 以上都不成立 | 按卷数均分，**估算** |

**两条铁律**：

1. **部分归属不能钉卷末**。只有第 1 卷的章标题、第 2 卷没有 ⇒ 第 1 卷末章**不取**该卷标题的最大章号（那只是已生成的部分）。标题只能钉住「下一卷从第几章开始」这个边界。
2. **`declared` 只在每一卷都自报章数时启用**。半份章数会把比例带偏。

### 3.2 两组列的写入规则

| 列 | 谁能写 | 能不能重算 | 过期怎么办 |
|---|---|---|---|
| `planned_first/last`、`name`、`planned_source`、`outline_hash` | **重建**从 `plot_structure_plan` + `synopsis` 物化 | ✅ 随时整体重算 | 覆盖即可 |
| `actual_last`、`actual_source` | **只由面板「标记本卷已完成」写入**，值 = 该卷**已定稿章的最大章号** | ❌ 永不推断 | 只提示，不覆盖 |

**铁律**：重建任务**只 upsert 计划列**，`actual_last` 与 `actual_source` 一列都不碰。反过来，「标记完成」也绝不写 `planned_*`。

### 3.3 `outline_hash` 用「物化投影签名」

```ts
signature = JSON.stringify({
  v: 1,
  volumes: volumes.map(v => [v.index, v.name, v.plannedFirst, v.plannedLast, v.plannedSource,
    v.units.map(u => [u.index, u.name, u.plannedFirst, u.plannedLast, u.plannedSource])]),
})
// 主进程：outline_hash = sha256(signature)
```

**为什么不是原文 hash**：直接 hash `plan + synopsis` 会在**每写一章（synopsis 追加一条标题）**时把整张表标成 stale。签名只含边界与来源，只有真正改变边界的编辑才会变。

### 3.4 重建触发（只有一处自动 + 一处手动）

| 时机 | 动作 |
|---|---|
| 面板挂载且 `state === 'empty'`（表里一行都没有） | **自动重建一次**。表空时没有东西可删，风险为零 |
| 面板「重建卷结构」按钮 | 全量重算，事务内只写计划列 |
| 保存大纲时 / 打开项目时 / AI 生成大纲后 | **不自动重建**。作者可能正在编辑，删卷比过期危险（判据 DL 姿态：提示不阻断） |

**不重建会怎样**：`state` 显示 `empty` / `stale`，面板提示；正文链按旧区间取「上一卷」，可能错卷 —— 这是已知的降级，不是静默失败（面板有黄条）。

### 3.5 与 `synopsis_volume_deviations` 的划界（必须写死，否则两套账）

检查点里的 `{ volumeIndex, planned, actual }` 是**章数**，`volumes` 里的是**章号区间**。两者是同一件事的两种粒度。

- 章数账**保留在检查点**（生成期状态，随批恢复，属 E3 的内部不变量）；
- `volumes` **不存章数**，可由 `actual_last - 有效 first + 1` 推出；
- **「章数账只在检查点，卷表不存章数」** 这句写进迁移文件头，防下一轮又加一列。

---

## 4. 纯函数：`src/shared/volume-structure.ts`（只两个导出）

```ts
export type VolumePlannedSource = 'headings' | 'declared' | 'even'
export type VolumeActualSource = 'finalized' | 'author'
export type VolumeBoundaryBasis = 'actual' | VolumePlannedSource

/** 从大纲物化「卷 / 单元」骨架（唯一实现，复用 parseArcStructure 与 parseOutlineChapterHeading）。 */
export function materializeVolumeStructure(input: {
  plan: string | null | undefined
  synopsis: string | null | undefined
  totalChapters: number
}): VolumePlanProjection | null

/** 卷的有效区间（起点 = 上一卷有效末章 + 1；末章 = actual_last ?? planned_last）。唯一实现。 */
export function volumeEffectiveRanges(volumes: readonly VolumeDefinition[]): VolumeRange[]
```

**不写 `resolveVolumeOfChapter`**：本期没有任何消费方（正文链走 `findPreviousHandoff`，面板只需区间）。按「谁消费」的纪律，没有消费方的函数不写。

**复用不许复写**：`parseArcStructure`（`arc-position.ts:325`）、`scaledBoundaries`（`:423`）、`arcWeight`（`:54`）、`parseOutlineChapterHeading`（`chapter-heading.ts:169`）。`arc-position.ts:419-422` 明令「不要在别处复写这套折算」。

`basis` 四态**必须分开**：`actual`（事实）／`headings`（精确观测）／`declared`·`even`（估算）。**不许把 `even` 报成 `headings`。**

---

## 5. 消费方切换（本期只切一处）

| 消费方 | 本期 | 后期 |
|---|---|---|
| **交接单面板** | ✅ 改成选卷 + 区间只读 | — |
| **`findPreviousHandoff`** | ✅ 走 `volumeEffectiveRanges`（`actual_last ?? planned_last`） | — |
| `outline-tree` 的卷/单元归属 | ❌ 不动 | 切表（要改 6 组既有测试） |
| `arcSpanForUnit` 等比折算 | ❌ 不动 | 退役 |
| 世界状态页 / 审稿链 | ❌ 零引用，不涉及 | — |

**为什么后期再切 `outline-tree`**：它涉及 `arc-position` / `unit-stats` / `outline-tree` 六组测试（合计 >100 例），且与「今天要的选卷」无关。一次做两件事，验收入口会变模糊。

---

## 6. 不做（防下一轮发明）

- ❌ **不写 `resolveVolumeOfChapter`**（本期无消费方 —— W6 的死法就是「只存不读」）
- ❌ **不做 `db:volume-units-list`**（本期无消费方）
- ❌ **不预埋 `part_index`**：部这一层随 W8 加列
- ❌ **不把 `actual_last` 交给推断**（等比折算、`planned_last` 直接抄、按章数等分都不行）
- ❌ **不允许在表里编辑计划边界**（计划只从大纲物化；可编辑的只有 `actual_*`，且只通过「标记完成」）
- ❌ **不存章数 / 字数**（ADR-0022）
- ❌ **不做原文 hash**（会在每写一章时误标 stale）
- ❌ **不给旧格式项目做手改区间入口**（作者裁定）
- ❌ **不在保存大纲时自动重建**（删卷比过期危险）
- ❌ **不自动生成交接单**（P1-2 期 2）
- ❌ 不改 `m18-volume-handoffs.ts`（`schemas(19)` 指纹现算，改它会让已升 19 的库变 unknown schema）

---

## 7. 已知限制

1. **`headings` 档只在「下一卷已有归属标题」时才精确**：全书最后一卷的末章永远来自 `declared` / `even`（没有「下一卷」可钉）。
2. **`declared` / `even` 会随 `totalChapters` 变化而变**：作者改全书章数后，这些卷的区间会跟着变，`state` 变 `stale`。
3. **`actual_last` 初期大面积为空**：只有作者点过「标记本卷已完成」的卷才有。在那之前正文链用计划区间（节首会写「计划」/「估算」）。
4. **超写跨过下一卷计划起点时，超出部分按计划归下一卷**：`markVolumeDone` 的上界是下一卷 `planned_first`。要精确归卷需要期 2 的逐章记账。
5. **单元区间本期无消费方**：表里有，但面板不显示、正文链不用。它的价值在后期切换 `outline-tree` 时兑现。
6. **`synopsis` 的旧格式（`## 第1章：…`）拿不到卷归属**：这类项目只能落到 `declared` / `even`。

---

## 8. 验收（详见施工规格 §10）

| 门 | 判据 |
|---|---|
| G1 迁移形状 | 三表列集 / CHECK / FK / UNIQUE 与 §2 逐字一致；`PRAGMA foreign_key_check` 为空 |
| G2 **重建只写计划列** | 先写 `actual_last=42`，再重建，两列一字未变（**反例测试**） |
| G3 **实际末章只取事实** | planned 1–20、定稿到 18 ⇒ `actual_last=18`；区间内无定稿 ⇒ 抛错且仍 NULL（**反例**） |
| G4 **缺表降级** | 只有 `volume_handoffs` 没有 `volumes` ⇒ `hasVolumeHandoffSchema=false`（**反例，守住「跨卷记忆静默消失」**） |
| G5 **不伪造章号** | `even` 档节首是「估算第 a–b 章」；`actual` / `headings` 与旧文案逐字一致（**反例**） |
| G6 便携 / 归档 / 清库 | 表 63 / 字段 603 / added 248（实测为准）；三张卷表被清空 |

**必须不变**：第 8 条哈希 `fc03729848c1c177f2cd08dd0c82389716034bf8f73ba304a3410c51cfaa1670` 与前 7 条；`m18-volume-handoffs.ts` 一行未改。
