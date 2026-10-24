# 卷 / 单元的结构持久化（volume & unit index）

> **状态**：📝 **设计稿待作者裁定**（2026-10-24）。三项已裁定：**大纲是计划权威、表存计划+实际** · **趁空表把 `volume_handoffs` 区间外置成外键** · **单元与卷表同批做**。
> **背景**：P1-2 期 1 建了 `volume_handoffs`（作者手填章号区间）后，作者指出「卷信息还是需要结构持久化的，单元也做的话，很多东西就不需要只凭推断或者现算了，后面还有部」。
> **schema**：19 → 20（M19）

---

## 0. 四问（本项目加机制前的硬规矩）

**1. 这件事在行业里叫什么？**
story bible 的 **structure 分区**：`book → part → volume → chapter` 的层级。商业工具都结构化存它（Scrivener 的 Binder 层级、Plottr 的结构轴、系列 bible 的 book/part 分节）。中文网文的「卷 / 单元」是平台章节分组约定（起点「卷」、番茄「单元」），**不是我们发明的词**。

**2. 谁消费它的产出？**（若只有一块展示面板 ⇒ 停）

| 消费方 | 现在怎么拿「本章属于哪卷/单元」 | 有结构表之后 |
|---|---|---|
| 正文链（该注入哪份交接单） | `volume_handoffs.last_chapter < 本章`（只有已写完的卷） | 一次 join 拿到 `volume_index` + 实际边界 |
| **P1-2 期 2**（卷末自动生成交接单） | 只有 `architecture.command.ts:3374` 的游标翻转，**不知道"这一卷从第几章到第几章"** | 触发时直接读 `actual_first/last` |
| **W8 跨部**（部 → 卷 → 单元） | 无（部这一层完全靠文本） | `part` 挂在卷上，外键骨架已就位 |
| 卷切片（W7b，未做） | 无 | 按 `volume_id` 取本卷章号区间 |
| 大纲树 / 世界状态页 | 每次渲染时现算 | 直接读 |

**不是只有面板** ⇒ 立项成立。

**3. 失败形态在行业分类里属哪一类？**
ConStory-Bench「时间线与情节逻辑」下的结构归属错误。具体后果不是「数字不对」，而是**上下文注入错卷**（把第 2 卷的交接单喂给第 3 卷的章）。这与昨天给 `volume_handoffs` 加的「区间重叠双层拒」是**同一个失败形态**，只是从手填错误升级成系统性错误。

**4. 已有产品/论文做过什么？我们与它的差异？**
它们只有**一处**结构真相；我们是**双源**（Markdown 大纲 + 数据库）。所以差异不在功能，而在**必须先定义谁是权威**——这一点已由作者裁定：**大纲是计划权威，表存计划 + 实际**。

---

## 1. 现状（含一处对上一轮判断的更正）

### 1.1 结构在哪

| 位置 | 形态 | 角色 |
|---|---|---|
| `project_core.plot_structure_plan` | Markdown（`## 卷…` / `### 单元…`） | **计划权威**（作者在这里写） |
| `project_core.synopsis` | Markdown（三层标题 `第X卷 第Y单元 第Z章`） | 章级计划 |
| 检查点 JSON `synopsis_volume_deviations`（`architecture.command.ts:166-172`） | 每卷 `{ volumeIndex, planned, actual }` | **按卷的章数账**（元，不是章号） |
| M18 `volume_handoffs` | 作者手填 `first_chapter / last_chapter` | 已写完卷的**实际边界**（单卷一份） |

### 1.2 「六份解析」是我上一轮说重了 —— 更正

实查结果：**基础解析只有一份**。

- `arc-position.parseArcStructure(plan)` 解析出 `majors`（卷）/ `mids`（单元），章号区间由 `scaledBoundaries()` **按权重等比折算到 `totalChapters`**。
- `outline-tree.buildOutlineTree()` **复用** `parseArcStructure`（`outline-tree.ts:135`），只是再叠章分组；标题缺卷归属时它退到 `span.majorIndex` 推断（`:183`，即那条会漂的路径）。
- `synopsis-unit-heading` / `chapter-position` 只是**渲染**，不解析。
- `arcSpanForUnit` 也被注释明确限定「**只用于文本投影，不参与任何状态判定**」（`arc-position.ts:445`）。

⇒ **不缺解析器**。缺的是两样：

1. **实际边界**：`scaledBoundaries` 算出来的是「计划」，实测弧光自报 880 章 vs 全书 845 章（`arc-position.ts:419` 注释），一漂就整体错位。实际边界**算不出来，只能记**。
2. **一处能被 SQL 关联的骨架**：现在要答「第 57 章属第几卷第几单元」，每次都得把 Markdown 重新解析 + 等比折算，且 W8 的部层无处可挂。

---

## 2. 形状（M19，schema 19→20）

### 2.1 `volumes`（12 列）

```sql
CREATE TABLE volumes (
  volume_id     TEXT PRIMARY KEY,
  volume_index  INTEGER NOT NULL UNIQUE CHECK(volume_index > 0),
  name          TEXT,
  planned_first INTEGER CHECK(planned_first IS NULL OR planned_first > 0),
  planned_last  INTEGER CHECK(planned_last IS NULL OR planned_last >= planned_first),
  actual_first  INTEGER CHECK(actual_first IS NULL OR actual_first > 0),
  actual_last   INTEGER CHECK(actual_last IS NULL OR actual_last >= actual_first),
  planned_words INTEGER CHECK(planned_words IS NULL OR planned_words >= 0),
  status        TEXT NOT NULL DEFAULT 'planned'
                  CHECK(status IN ('planned','writing','done')),
  outline_hash  TEXT,
  source        TEXT NOT NULL,
  created_at    TEXT,
  updated_at    TEXT
);
CREATE INDEX idx_volumes_status ON volumes(status);
```

> 注：`volume_index` 是第几卷（1 起）；**不存 `part_index`** —— 见 §6「不做」。

### 2.2 `units`（10 列）

```sql
CREATE TABLE units (
  unit_id       TEXT PRIMARY KEY,
  volume_id     TEXT NOT NULL REFERENCES volumes(volume_id),
  unit_index    INTEGER NOT NULL CHECK(unit_index > 0),
  name          TEXT,
  planned_first INTEGER CHECK(planned_first IS NULL OR planned_first > 0),
  planned_last  INTEGER CHECK(planned_last IS NULL OR planned_last >= planned_first),
  actual_first  INTEGER CHECK(actual_first IS NULL OR actual_first > 0),
  actual_last   INTEGER CHECK(actual_last IS NULL OR actual_last >= actual_first),
  outline_hash  TEXT,
  source        TEXT NOT NULL,
  created_at    TEXT,
  updated_at    TEXT,
  UNIQUE(volume_id, unit_index)
);
```

### 2.3 `volume_handoffs` 改外键（重建表）

```sql
-- 去掉 first_chapter / last_chapter，改指卷
CREATE TABLE volume_handoffs (
  handoff_id   TEXT PRIMARY KEY,
  volume_id    TEXT NOT NULL REFERENCES volumes(volume_id),   -- 原 volume_index 改为外键
  world_state  TEXT,
  hero_state   TEXT,
  events_json  TEXT NOT NULL DEFAULT '[]',
  items_json   TEXT NOT NULL DEFAULT '[]',
  debts_json   TEXT NOT NULL DEFAULT '[]',
  open_thread  TEXT,
  source       TEXT NOT NULL,
  created_at   TEXT,
  updated_at   TEXT,
  UNIQUE(volume_id)
);
```

**迁移时机**：真实库抽样仍是 v9，**M18 尚未在任何库落地**；即便已落地，`volume_handoffs` 里也不会有数据（今天才建）。空表重建零风险。**晚做就要迁数据。**

---

## 3. 计划 vs 实际：两组列的写入规则（本设计最要紧的一条）

| 列 | 谁能写 | 能不能重算 | 过期怎么办 |
|---|---|---|---|
| `planned_first/last`、`name`、`planned_words` | **重建任务**从 `plot_structure_plan` 物化 | ✅ 随时整体重算 | 覆盖即可（带 `outline_hash`） |
| `actual_first/last`、`status` | **定稿链 / 作者手填**（P1-2 期 2 的卷末按钮） | ❌ **永不推断** | 只提示，不覆盖 |

**铁律**：重建任务**只 upsert 计划列**，`actual_*` 与 `status` 一列都不碰。反过来，任何"卷末自动填实际边界"的逻辑必须显式判断 `status === 'writing'`，不许把 `planned_last` 直接抄成 `actual_last`（超写是常态，抄了就错）。

### 3.1 重建触发

| 时机 | 动作 |
|---|---|
| 保存 `plot_structure_plan` 时 | 解析 → upsert 计划列 → 写 `outline_hash` |
| 打开项目时（惰性） | 若 `outline_hash` 与当前大纲不符 ⇒ **标 `stale`（不删行、不阻断）**，界面提示「卷结构已过期，点此重建」 |
| 手动按钮 | 强制重建 |

**为什么是 stale 而不是自动重建**：自动重建会在作者正编辑大纲的中途把卷数量改掉（写到一半的卷被删），比过期更危险。参照判据 DL 的姿态：**Low severity，提示不阻断**。

### 3.2 与 `synopsis_volume_deviations` 的归并（必须做，否则两套账）

检查点里的 `{ volumeIndex, planned, actual }` 是**章数**，`volumes` 里的是**章号区间**。两者是同一件事的两种粒度。归并方案：

- 章数账**保留在检查点**（它是生成期状态，随批恢复，属 E3 的内部不变量）；
- `volumes` **不再存章数**，改为可由 `actual_last - actual_first + 1` 推出；
- 在建表文档里写死一句：**「章数账只在检查点，卷表不存章数」**，防止下一轮又加一列。

---

## 4. 接线清单（照 M18 的 20 处模板，逐条列）

### 4.1 迁移与注册（8 处）

1. `electron/migrations/m19-volume-unit-index.ts`：`volumes` + `units` 建表 + **`volume_handoffs` 重建（M18 表 → 新形状）**；`verifyM19` 断言三张表的列集 / CHECK / 外键 / `UNIQUE(volume_id, unit_index)`
2. `electron/migrations/registry.ts`：lane 追加 `M19 from:19 to:20` + `LATEST_SCHEMA_VERSION = 20`
3. `electron/migrations/desktop-registry.ts`：import / apply / `schemas(20)` / 工厂 / implementations / 指纹展开 / `CURRENT_DESKTOP_SCHEMA_VERSION = 20`（整行格式不变）
4. `src/shared/project-storage.ts`：`MIGRATION_IDS` 追加 `'M19'`
5. `electron/services/portable-project-field-policy.json`：`m19Tables` + `volumes`(13) / `units`(12) 逐字段 `"D"`，**`volume_handoffs` 改列**
6. `electron/services/portable-project-format.ts`：`'m19-delta'` origin / Set / delta 判定 / 三元链末位
7. `electron/repositories/project-clear-repository.ts`：清空项目要包含两张新表（漏了 = 清空后残留）
8. `electron/services/project-archive-service.ts`：若按表清单导出，需含新表

### 4.2 纯函数（新建 `src/shared/volume-structure.ts`）

```ts
export interface VolumeStructureNode { index: number; name: string; units: { index: number; name: string }[] }
/** 从大纲物化出「卷/单元」骨架（唯一实现，复用 parseArcStructure，不新写解析）。 */
export function materializeVolumeStructure(plan, totalChapters): VolumeStructureNode[]
/** 给定章号 → 命中哪一卷/单元；优先用 actual_*，缺失退 planned_* 并标 basis。 */
export function resolveVolumeOfChapter(volumes, chapter): { volumeIndex: number; unitIndex?: number; basis: 'actual' | 'planned' | 'none' }
```

`basis` 三态**必须分开**（同判据 DN）：`actual`（真实边界）／`planned`（计划边界，可能会漂）／`none`（都对不上）。**不许把 `planned` 当成 `actual` 返回。**

### 4.3 仓储与 IPC（新建 `volume-structure-repository.ts`）

- `listVolumes` / `listUnits` / `upsertPlannedFromOutline`（只写计划列）/ `markVolumeDone`（写 `actual_*` + `status='done'`）/ `deleteVolume`
- IPC：`db:volumes-list` / `db:volumes-upsert` / `db:volume-handoff-by-volume`；写通道进 `MUTATING_DATABASE_CHANNELS`

### 4.4 消费方切换（期 2，不在本期）

`arcSpanForUnit` 的等比折算退役、`outline-tree.ts:183` 的推断回退退役 —— 但**都在期 2**，本期只建骨架，不动正文链。

---

## 5. 验收门

| 门 | 判据 |
|---|---|
| G1 | 迁移：`volumes` / `units` / 重建后的 `volume_handoffs` 三表形状（列集、CHECK、FK、UNIQUE） |
| G2 | **重建只写计划列**：先手填 `actual_*`，再跑重建，`actual_*` 必须一字未变（这条是反例测试，必须有牙齿） |
| G3 | `resolveVolumeOfChapter` 三态：`actual` 命中 / `planned` 兜底 / `none`，且**不许把 planned 报成 actual** |
| G4 | `volume_handoffs` 旧数据迁移（空表场景 + 构造一行场景各一条） |
| G5 | 便携计数 + 归档计数同步；`targetSchemaVersion` 可解析为 20 |

---

## 6. 不做（防下一轮发明）

- ❌ **不预埋 `part_index`**：部这一层随 W8 加列（SQLite 加列一条迁移，成本极低；为空想加列 = 自造标准）
- ❌ **不把 `actual_*` 交给推断**（等比折算、`planned_last` 直接抄、按章数等分都不行）
- ❌ **不允许在表里编辑"计划边界"**（计划只从大纲物化；表里能编辑的只有 `actual_*` 与 `status`）
- ❌ 不在本期改正文链（期 2 才切消费方），不动 `plot_structure_plan` 的 Markdown 格式
- ❌ 不存章数（章数账留在检查点，见 §3.2）

---

## 7. 已知限制

1. **计划边界仍会漂**：`scaledBoundaries` 是等比折算，大纲与正文不齐时它就是"计划值"而非事实。所以 `resolveVolumeOfChapter` 必须返回 `basis`，让调用方能区分"这是真边界"还是"这是计划"。
2. **`actual_*` 初期大面积为空**：只有写完的卷才有。前几卷写完后才有稳定答案。
3. **作者仍在大纲里改卷**：表是物化副本，`outline_hash` 不匹配就 `stale`，不自动重建。
4. **单元 `actual_*` 更晚**：E3 单元游标知道"写到第几个单元"，但不知道"实际章号区间"，需要定稿链按单元记账才有（期 2 之后）。
