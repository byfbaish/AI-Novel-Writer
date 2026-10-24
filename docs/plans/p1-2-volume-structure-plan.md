# P1-2 期 1b · 卷/单元结构持久化 + 交接单改选卷

> **状态**：📋 待批准（2026-10-24）。作者四项裁定已落进 §1。
> **基线**：分支 `exp/resource-ledger` · HEAD `2f460496` · schema **19 → 20**（M19）
> **性质**：结构改动 + 改一张刚建的表 + 改一个面板的交互方式。**不调模型，不动生成链。**
> **这份文档是施工规格**：执行者逐条照做，不要自行发挥；复核者按 §10 逐条打勾。

---

## 0. 为什么做（一句话）

作者指出：卷信息现在全靠「一次一次重新解析 Markdown + 等比折算」；`volume_handoffs` 还要作者手填两个章号。本期把卷/单元变成可查询的表，并让**交接单只需选卷**——区间由系统算、由系统展示，作者不用数章号。

---

## 1. 作者已裁定（不得再讨论）

| # | 裁定 | 落点 |
|---|---|---|
| 1 | 表里存「物化区间」+「实际末章」；实际末章由面板**一个按钮**写入，值取该卷**已定稿章的最大章号**（事实，不是推算）；正文链优先用实际、缺失退物化 | §3.1 / §3.3 |
| 2 | **改造现有「卷末交接」面板**，不新建 tab。一行 = 一份交接单，卷用下拉选，区间只读展示；「重建卷结构」按钮也放这里 | §6 |
| 3 | 旧格式大纲**不作为设计依据**（判断依据只有 `师父派我来除魔…`，synopsis 带完整归属）。旧格式只需在界面上标「估算」，**不做手改区间入口** | §3.2 / §6.2 |
| 4 | 本期**只切「交接单」这一处消费方**；`outline-tree` / `arcSpanForUnit` 的推断退役留后期 | §10 |

---

## 2. 开工前置（三条，缺一条就停）

| # | 检查 | 命令 | 不满足怎么办 |
|---|---|---|---|
| P1 | 工作树干净 | `git status --porcelain`（应为空） | **停**。若为空但 HEAD 不是 `2f460496`，先记下实际 HEAD 再继续（偏差 ≤ 3 条提交可接受） |
| P2 | 基线失败集 | 见下 | 记下失败文件清单，后面每步只与它比 |
| P3 | 锚点核对 | `grep -n "export const CURRENT_DESKTOP_SCHEMA_VERSION" electron/migrations/desktop-registry.ts` | 应为 **28 行**、值 `19`。同轴：`LATEST_SCHEMA_VERSION` 在 `registry.ts:26`；`MIGRATION_IDS` 在 `project-storage.ts:5` 且末项 `'M18'`。偏差 > 20 行 ⇒ 基线不对，**停** |

**P2 基线命令**（前置 `unset CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR CODEBUDDY_TOOL_CALL_ID`）：

```bash
node ./node_modules/vitest/vitest.mjs run src 2>&1 | tee .runtime/p12/S0-baseline-src.log | grep -aE "Tests |Test Files" | tail -3
```

**已知基线（`2f460496`，leader 实测）**：`19 failed / 3812 passed / 1 skipped`，失败文件**恰好这 3 个**：

```
src/services/__tests__/export-service-integration.test.ts
src/services/workflows/commands/__tests__/finalize-postprocess-character.integration.test.ts
src/services/workflows/commands/__tests__/planning-material-binding.test.ts
```

**多出任何一个 ⇒ 回归。** 这 3 个是 better-sqlite3 ABI（`NODE_MODULE_VERSION 127`）问题，与本期无关。

---

## 3. 形状（M19，schema 19 → 20）

### 3.1 `volumes`（12 列）

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

**三处必须写进文件头注释的理由**：

1. **没有 `actual_first`**：它是「上一卷有效末章 + 1」的派生值。存下来要两行同写（标记第 2 卷还得改第 1 卷），半途失败就自相矛盾；而且会把估算写进 `actual_*`（判据 DN 同型）。起点只在 `volumeEffectiveRanges()` 一处算。
2. **没有 `status` / `planned_words`**：「这一卷写完了」由 `actual_last IS NOT NULL` 回答，不再造第二个真相；章数/字数属派生数值（ADR-0022）。
3. **`volume_units` 不叫 `units`**：`src/shared/draft-units.ts` 与 `planning:target-units` 已用 unit 表示「正文段落单位」，同名会撞。

**FK 与唯一约束**：`volume_units.volume_id` 用 `ON DELETE CASCADE`（纯物化投影，删卷即删单元）；`volume_handoffs.volume_id` 用 `ON DELETE RESTRICT`（有交接单的卷不能删，否则跨卷记忆静默消失）。`UNIQUE` **写在列上**，不建独立 `CREATE INDEX` —— 与 M18 注释 `m18-volume-handoffs.ts:28-32` 一致。

### 3.2 三档物化来源（界面按此标注，见 §6.2）

| 档 | 条件 | 判定 |
|---|---|---|
| `headings` | `synopsis` 里有 `## 第V卷第U单元第Z章（全书第N章）` 形态的标题 | **精确**：第 V 卷末章 = 第 V+1 卷首个归属章的 `chapter - 1`；单元区间 = 该单元所有归属章的 min/max |
| `declared` | `plot_structure_plan` 里**每一卷都**带「（约 N 章）」 | 用 `scaledBoundaries` 折算（**不许另写折算**，`arc-position.ts:419-422` 明令） |
| `even` | 以上都不成立 | 按卷数均分，**估算** |

**铁律两条**：
- **部分归属不能钉卷末**：只有第 1 卷的章标题、第 2 卷没有 ⇒ 第 1 卷末章**不取**该卷标题的最大章号（那只是已生成的部分），退回 `declared` / `even`。标题只能钉住「下一卷从第几章开始」这个边界。
- **`declared` 只在每一卷都自报章数时启用**，半份章数会把比例带偏。

### 3.3 `outline_hash` 用「物化投影签名」，不是原文 hash

```ts
signature = JSON.stringify({
  v: 1,
  volumes: volumes.map(v => [v.index, v.name, v.plannedFirst, v.plannedLast, v.plannedSource,
    v.units.map(u => [u.index, u.name, u.plannedFirst, u.plannedLast, u.plannedSource])]),
})
// 主进程：outline_hash = sha256(signature)
```

**为什么**：直接 hash `plan + synopsis` 原文，会在**每写一章（synopsis 追加一条标题）**时把整张表标成 stale。签名只含边界与来源，只有真正改变边界的编辑才会变。

### 3.4 M19 执行顺序（`electron/migrations/m19-volume-structure.ts`）

```ts
export function applyM19VolumeStructure(db: SqliteLike): void {
  // 旧表存在且没有 volume_id 列 ⇒ 是 M18 形状
  if (hasTable(db, 'volume_handoffs') && !hasColumn(db, 'volume_handoffs', 'volume_id')) {
    const rows = db.prepare('SELECT COUNT(*) AS c FROM volume_handoffs').get() as { c: number }
    if (rows.c > 0) throw new Error('M19_VOLUME_HANDOFF_NOT_EMPTY')
    db.exec('DROP TABLE volume_handoffs')
  }
  if (!hasTable(db, 'volumes'))         db.exec(VOLUMES_SQL)
  if (!hasTable(db, 'volume_units'))    db.exec(VOLUME_UNITS_SQL)
  if (!hasTable(db, 'volume_handoffs')) db.exec(VOLUME_HANDOFFS_SQL)
}
```

**⚠️ 绝对不许就地改 `m18-volume-handoffs.ts`**：`desktop-registry.ts:149` 的 `schemas(19)` 是**在内存里跑 `applyM18VolumeHandoffs` 现算指纹**得到的。改 M18 的 DDL 等于改掉「已知 v19 形状」，任何已升到 19 的库会从 known 变 unknown schema，`probeSchema` 直接失败。

**数据风险已核实为 0**：三本真实库 schema = 18 / 10 / 9，`volume_handoffs` **在任何真实库都不存在**。`M19_VOLUME_HANDOFF_NOT_EMPTY` 是给「万一有人手动建过」的守卫，**不许为了让它不报错而改成无条件 DROP**。

### 3.5 迁移注册（六处，逐字）

| 文件:行 | 改什么 |
|---|---|
| `electron/migrations/registry.ts:23` | lane 在 M18 后追加 `Object.freeze({ id: 'M19', from: 19, to: 20, owner: 'P1-2' })` |
| `electron/migrations/registry.ts:26` | `export const LATEST_SCHEMA_VERSION = 20` |
| `electron/migrations/desktop-registry.ts:28` | `export const CURRENT_DESKTOP_SCHEMA_VERSION = 20`（**整行格式逐字不变**，`scripts/project-migration-acceptance.mjs:41` 用正则解析这一行） |
| `electron/migrations/desktop-registry.ts:21` 后 | `import { applyM19VolumeStructure, createM19Migration, verifyM19VolumeStructure } from './m19-volume-structure'` |
| `electron/migrations/desktop-registry.ts:149-153` | 在 m18 后追加 `const volumeStructureSchemas = schemas(20), volumeStructureFingerprints = new Set(...)` / `const m19 = createM19Migration({ database: native, verifyKnownSchema: db => volumeStructureFingerprints.has(sqliteSchemaFingerprint(native(db))) \&\& verifyM19VolumeStructure(native(db)) })` / `implementations` 数组追加 `m19` / `recognizedSchemas` 展开 `...volumeStructureSchemas` |
| `src/shared/project-storage.ts:5` | `MIGRATION_IDS` 末尾追加 `'M19'` |

---

## 4. 纯函数（新建 `src/shared/volume-structure.ts`）

**不 import 任何 Electron / node 模块**（渲染进程与主进程共用）。共享层严禁 `import 'node:crypto'`（渲染层会炸）；需要哈希时由调用方传入或用 `crypto.subtle`。

### 4.1 类型

```ts
export type VolumePlannedSource = 'headings' | 'declared' | 'even'
export type VolumeActualSource = 'finalized' | 'author'
/** 一条区间的权威来源：actual 是事实，headings 是精确观测，declared/even 是估算。 */
export type VolumeBoundaryBasis = 'actual' | VolumePlannedSource

export interface VolumeDefinition {
  volumeId: string; volumeIndex: number; name: string
  plannedFirst: number | null; plannedLast: number | null
  plannedSource: VolumePlannedSource
  actualLast: number | null; actualSource: VolumeActualSource | null
  outlineHash: string; source: string          // 'outline' | 'retained'
  createdAt: string; updatedAt: string
}

export interface VolumeUnitDefinition {
  unitId: string; volumeId: string; unitIndex: number; name: string
  plannedFirst: number | null; plannedLast: number | null
  plannedSource: VolumePlannedSource
  createdAt: string; updatedAt: string
}

export interface VolumePlanProjection {
  volumes: Array<{ index: number; name: string
    plannedFirst: number | null; plannedLast: number | null
    plannedSource: VolumePlannedSource
    units: Array<{ index: number; name: string
      plannedFirst: number | null; plannedLast: number | null
      plannedSource: VolumePlannedSource }> }>
  /** 规范化 JSON；主进程再 sha256 成 outline_hash。 */
  signature: string
  /** 机器可读告警，如 `VOLUME_OBSERVED_OUT_OF_RANGE:1`。 */
  warnings: string[]
}
```

### 4.2 两个导出函数（**只两个**）

```ts
/** 从大纲物化「卷 / 单元」骨架（唯一实现，复用 parseArcStructure 与 parseOutlineChapterHeading）。 */
export function materializeVolumeStructure(input: {
  plan: string | null | undefined
  synopsis: string | null | undefined
  totalChapters: number
}): VolumePlanProjection | null

/** 卷的有效区间（起点 = 上一卷有效末章 + 1；末章 = actual_last ?? planned_last）。唯一实现。 */
export function volumeEffectiveRanges(volumes: readonly VolumeDefinition[]): Array<{
  volumeId: string; volumeIndex: number; name: string
  first: number | null; last: number | null
  basis: VolumeBoundaryBasis
}>
```

**不要写 `resolveVolumeOfChapter`**：本期没有任何消费方（正文链走 `findPreviousHandoff`，面板只需区间）。按「谁消费」的纪律，没有消费方的函数不写 —— W6 的死法就是「只存不读」。

**入参必须同时吃 `plan` 与 `synopsis`**：`headings` 档的边界来自 synopsis，只吃 plan 会把唯一精确源丢掉。

**`totalChapters` 的真实来源**：主进程 `project_core.total_chapters`（`project-core-repository.ts:23` → `:109` 映射为 `totalChapters`）；渲染进程 `ArchFileViewer.tsx:151` 的 `outlineTotalChapters`（`:170-172` 从 `db:project-core-get` 取 `core.totalChapters`）。

**复用，不许复写**：`parseArcStructure`（`arc-position.ts:325`）、`scaledBoundaries`（`:423`）、`arcWeight`（`:54`）、`parseOutlineChapterHeading`（`chapter-heading.ts:169`）。

### 4.3 `volumeEffectiveRanges` 的规则

```ts
const sorted = [...volumes].sort((a, b) => a.volumeIndex - b.volumeIndex)
let previousLast: number | null = null
for (const v of sorted) {
  const first = previousLast !== null ? previousLast + 1 : v.plannedFirst
  const last = v.actualLast ?? v.plannedLast
  push({ ..., first, last, basis: v.actualLast !== null ? 'actual' : v.plannedSource })
  previousLast = last
}
```

`basis` 三态**必须分开**：`actual`（事实）／`headings`（精确观测）／`declared`·`even`（估算）。**不许把 `even` 报成 `headings`。**

---

## 5. 仓储

### 5.1 新建 `electron/repositories/volume-structure-repository.ts`

```ts
export function hasVolumeStructureSchema(db): boolean               // 三张表都在
export function listVolumes(db): VolumeDefinition[]                 // ORDER BY volume_index
export function listVolumeUnits(db, volumeId?: string): VolumeUnitDefinition[]
export function rebuildVolumes(db, input: {
  plan: string | null; synopsis: string | null; totalChapters: number
}): { volumes: VolumeDefinition[]; warnings: string[]; removed: number; retained: number[] }
export function markVolumeDone(db, volumeId: string): { volume: VolumeDefinition; actualLast: number }
```

**`rebuildVolumes`（事务内，先算后写）**

1. `materializeVolumeStructure(input)`；`null` ⇒ 抛 `VOLUME_STRUCTURE_UNPARSED`。**绝不在解析失败时动表。**
2. `hash = sha256(projection.signature)`。
3. 读现有 `volumes` + `SELECT volume_id FROM volume_handoffs`。
4. 每个投影卷：`volume_id = 'volume:' + index`（确定性 ID，重建不改主键）；upsert `name / planned_* / planned_source / outline_hash / source='outline' / updated_at`；**`actual_last` 与 `actual_source` 一列都不碰**（G2 反例测试钉这条）；`DELETE FROM volume_units WHERE volume_id=?` 后插本卷单元（`unit:${volumeIndex}:${unitIndex}`）。
5. 现有但投影里没有的卷：**被交接单引用 ⇒ 保留**（`source='retained'`，`planned_*` 与 `outline_hash` 不动，进 `retained[]`）；没被引用 ⇒ 删除（单元级联）。
6. 名称变化且该卷有交接单 ⇒ `warnings.push('VOLUME_NAME_CHANGED:' + index)`（只提示，不阻断）。
7. 重新 `listVolumes` 返回。

**`markVolumeDone`**

```ts
const row = db.prepare('SELECT * FROM volumes WHERE volume_id = ?').get(volumeId)
if (!row) throw new Error('VOLUME_MARK_DONE_NOT_FOUND')
if (row.planned_first === null) throw new Error('VOLUME_MARK_DONE_NO_PLANNED_START')

// 上界 = 下一卷的计划起点（排他）；最后一卷没有上界。
const next = db.prepare(`SELECT planned_first AS plannedFirst FROM volumes
  WHERE volume_index > ? ORDER BY volume_index LIMIT 1`).get(row.volume_index)
const upper = next?.plannedFirst ?? null

const max = db.prepare(`SELECT MAX(chapter_number) AS chapterNumber FROM drafts
  WHERE status = 'finalized' AND chapter_number >= ?
    AND (? IS NULL OR chapter_number < ?)`).get(row.planned_first, upper, upper)
if (max.chapterNumber === null) throw new Error('VOLUME_MARK_DONE_NO_FINALIZED')

db.prepare(`UPDATE volumes SET actual_last = ?, actual_source = 'finalized', updated_at = ?
  WHERE volume_id = ?`).run(max.chapterNumber, nowIso(), volumeId)
```

- `drafts.status = 'finalized'` 是项目既有定稿判据（`draft-repository.ts:422`、`:4` 注释）。
- 现成的 `DraftRepository.getMaxFinalizedChapter()`（`draft-repository.ts:442-451`）是**全局最大值、不收区间**，不能直接用；在本仓储里写这条带上下界的 SQL，**不新建「第二套定稿账」**。
- 重复点击是「刷新」：定稿章变多时上调；不会下调（`MAX` 由数据决定）。

### 5.2 改 `electron/repositories/volume-handoff-repository.ts`

**★ 最容易漏的一处（必须先改这条）**

```ts
export function hasVolumeHandoffSchema(db): boolean {
  return hasTable(db, 'volumes') && hasTable(db, 'volume_handoffs')   // 原来只探 volume_handoffs
}
```

原因：读路径要 JOIN `volumes`。若只探旧表，`volumes` 缺失时 `prepare()` 抛 `no such table`，被 `generate-draft.command.ts:2561` 的 `catch { return null }` **吞成「没有上一卷」** —— 跨卷记忆静默消失，**没有任何测试会红**。现有 9 条仓储测试只构造了「没有 `volume_handoffs` 的库」，没有这一形状，所以必须新增反例测试（§9 B2）。

**`SELECT_HANDOFF` 改为 11 列**，`volumeIndex / firstChapter / lastChapter / boundaryBasis` **不在 SQL 里算**，由 `attachRanges()` 用 `volumeEffectiveRanges()` 填 —— 起点规则只保留一份，避免 SQL 里再写一遍 `LAG/COALESCE` 与 JS 漂移。

```ts
export function findPreviousHandoff(db, beforeChapter: number): VolumeHandoffDefinition | null {
  if (!hasVolumeHandoffSchema(db)) return null
  if (!Number.isSafeInteger(beforeChapter) || beforeChapter < 1) return null
  return listVolumeHandoffs(db)
    .filter(e => e.lastChapter !== null && e.lastChapter < beforeChapter)
    .sort((a, b) => (b.lastChapter! - a.lastChapter!) || (b.volumeIndex! - a.volumeIndex!))[0] ?? null
}
```

语义不变：只返回一条；第 1 章必然 `null`；`lastChapter === 本章` **不算**上一卷（严格小于）。

**`upsertVolumeHandoff` 入参改成 `{ handoffId?, volumeId: string, ...六项 }`**，校验顺序：

1. schema 缺失 ⇒ `VOLUME_HANDOFF_SCHEMA_MISSING`
2. `volumeId` 空 ⇒ `VOLUME_HANDOFF_INVALID:volumeId`
3. `SELECT 1 FROM volumes WHERE volume_id = ?` 无 ⇒ `VOLUME_HANDOFF_VOLUME_NOT_FOUND`
4. 同卷已有别的行 ⇒ `VOLUME_HANDOFF_VOLUME_TAKEN`
5. `INSERT … ON CONFLICT(handoff_id) DO UPDATE SET volume_id = …`

**删掉**：`firstChapter` / `lastChapter` 入参、`requireChapter` 的两处调用、区间重叠校验（`VOLUME_HANDOFF_RANGE_CONFLICT` 不再存在 —— 区间不再由作者输入，作者无法制造重叠）。

**交接单指向不存在的卷**（FK 关掉时才会发生）：`list` **保留该行**且 `volumeIndex / firstChapter / lastChapter / boundaryBasis = null`，让面板显示并删除；`findPreviousHandoff` 跳过它（`lastChapter === null`）。不许让它静默消失。

---

## 6. 面板改造 `src/components/editor/VolumeHandoffRegistryPanel.tsx`

### 6.1 `DraftRow`（10 字段 + 4 UI 态）

```ts
interface DraftRow {
  key: string
  handoffId?: string
  volumeId: string            // '' = 未选。原 volumeIndex / firstChapter / lastChapter 全删
  worldState: string; heroState: string
  events: string; items: string; debts: string      // 多行文本域
  openThread: string
  expanded: boolean; removing: boolean; confirmingRemove: boolean; error: string
}
```

### 6.2 卷下拉的文案（逐字）

```
第2卷 · 卷二名 · 第41–60章（精确）
第2卷 · 卷二名 · 第41–60章（折算）
第2卷 · 卷二名 · 第41–60章（估算）
第2卷 · 卷二名 · 第41–62章（实际）
第2卷 · 卷二名 · 第41章起（末章未定）
第2卷 · 卷二名 · 第41–60章（大纲已无此卷，保留）
```

来源映射：`headings → 精确`、`declared → 折算`、`even → 估算`、`actual → 实际`；`source === 'retained'` 追加「大纲已无此卷，保留」。交接单指向已删卷时，额外给一个 `value` 等于原 id 的失效选项，文案「（这一卷已不在卷结构里）」。

**表头保持 8 列**，但第一列改「卷」（显示 `第2卷 · 卷二名`）、第二列改「区间」（显示 `第41–60章 · 折算`；`actual` 时另起一行 `实际到第62章`）。

### 6.3 挂载时的读取与「首次自动建结构」

挂载并行两条只读（**不需要先重建**）：

```ts
const [volumeRes, handoffRes] = await Promise.all([
  ipc.invokeWithProjectSession(session, 'db:volumes-list', projectPath),
  ipc.invokeWithProjectSession(session, 'db:volume-handoffs-list', projectPath),
])
```

**唯一的自动写操作**：若 `volumeRes.state === 'empty'`（表里一行都没有）⇒ 自动调一次 `db:volumes-rebuild`，然后用返回的卷覆盖 state。
理由：表空时**没有东西可删**，风险为零；这样作者第一次打开就能直接选卷，不用先找按钮。
`state === 'stale'` **不自动重建**（作者可能正在改大纲），只显示黄条提示。

### 6.4 三个状态提示（`data-testid="volume-structure-state"`）

| state | 文案 | 附加 |
|---|---|---|
| `empty` | 「尚未建立卷结构，正在从大纲生成…」（自动重建中） | 失败则「大纲里没有可识别的卷 / 单元结构，无法建立」 |
| `unparsed` | 红字「大纲里没有可识别的卷 / 单元结构，无法建立」 | 禁用「新增一卷」 |
| `stale` | 黄条「卷结构已过期（大纲比表新）。重建只更新计划区间，**不会清空实际末章**」 | 显示「重建卷结构」按钮 |
| `ready` | 不显示 | — |

### 6.5 「标记本卷已完成」按钮

位置：**每行展开后的详情区**，卷下拉下方一行 `区间：第41–60章（折算）` + `<Button data-action="mark-volume-done">标记本卷已完成</Button>`。

点击：调 `db:volumes-mark-done` → 成功则**只 patch 本地的 `volumes` state**（不重载 handoffs，作者未保存的正文不丢）→ 状态行报「第N卷：实际到第M章」。
失败（`VOLUME_MARK_DONE_NO_FINALIZED`）⇒ 行内红字「这一卷还没有已定稿的章」，**不清空任何已填内容**。

### 6.6 `validateSnapshot` 只保留两条

```ts
for (const row of active) {
  if (!row.volumeId) problems.set(row.key, '请选择卷')
  else if (!volumeById.has(row.volumeId)) problems.set(row.key, '这一卷已不在卷结构里，请重新选择')
}
// 同一卷两份（原「卷号重复」）
for (const [volumeId, keys] of byVolume) if (keys.length > 1)
  for (const key of keys) problems.set(key, `第${volumeById.get(volumeId)?.volumeIndex}卷登记了不止一份`)
```

**删掉五条**：卷号正整数、起始章正整数、结束章正整数、`last >= first`、区间重叠。理由：这些值不再可编辑，重叠不可能由作者输入产生；留着会让校验和真相两套。

**「先删后写」保留**（`save()` 现有逻辑），但删掉「区间互换」那条注释 —— 它已不适用。

### 6.7 `bodyChars` 改用占位区间

```ts
function bodyChars(row: DraftRow): number {
  // 区间只影响被 slice(2) 掉的两行头；传占位值，不依赖卷是否已选。
  const preview = { ...toPreview(row), volumeIndex: 1, firstChapter: 1, lastChapter: 1, boundaryBasis: 'actual' as const }
  const section = renderVolumeHandoffSection(preview, 'zh-CN', 1, Number.MAX_SAFE_INTEGER)
  return section ? section.split('\n').slice(2).join('\n').length : 0
}
```

这样修掉「没选卷 ⇒ 字数恒 0」的静默错，同时不复制计数逻辑。

### 6.8 文案与错误映射

- 删掉固定提示「章号请对照大纲里该卷的最后几章填写（本书不做任何区间推算）」——**这句已被新交互取代**。
- 底部说明改为：「正文链只注入「上一卷」（有效末章在本章之前的那一份）；没有实际末章的卷按物化区间判断，界面会标「估算」。」
- `writeErrorLabel` 增加：`VOLUME_HANDOFF_VOLUME_NOT_FOUND` / `VOLUME_STRUCTURE_UNPARSED` / `VOLUME_STRUCTURE_SCHEMA_MISSING` / `VOLUME_MARK_DONE_NO_FINALIZED` / `VOLUME_MARK_DONE_NO_PLANNED_START`
- `VolumeHandoffRegistryEditor.tsx` 标题说明补一句：「卷结构从大纲物化；区间只读，实际末章由「标记本卷已完成」写入。」

---

## 7. IPC 与控制器

| 通道 | args | 进 `MUTATING_DATABASE_CHANNELS` |
|---|---|---|
| `db:volumes-list` | `[expectedProjectPath]` | 否 |
| `db:volumes-rebuild` | `[expectedProjectPath]` | **是** |
| `db:volumes-mark-done` | `[volumeId, expectedProjectPath]` | **是** |
| `db:volume-handoffs-list` / `-before` / `-upsert` / `-delete` | 签名不变（`-upsert` 入参类型随 `volume-handoff.ts` 变） | 保持现状（只有 upsert / delete 进） |

**不加 `db:volume-units-list`**：本期没有任何消费方（面板不显示单元，正文链不用）。仓储的 `listVolumeUnits` 先给测试与将来留口。

**`db:volumes-list` 返回 `state`（四态）**：

```ts
const volumes = listVolumes(db)
const core = ProjectCoreRepository.get(db)            // 复用唯一 project_core 读路径
const projection = core ? materializeVolumeStructure({
  plan: core.plotStructurePlan, synopsis: core.synopsis, totalChapters: core.totalChapters }) : null
if (!projection) return { success: true, volumes, state: 'unparsed', warnings: [] }
if (volumes.length === 0) return { success: true, volumes, state: 'empty', warnings: projection.warnings }
const hash = sha256(projection.signature)
const state = volumes.some(v => v.source === 'outline' && v.outlineHash !== hash) ? 'stale' : 'ready'
```

`retained` 行不参与 stale 判定（它们本来就不在大纲里）。

**控制器**：`electron/controllers/db-controller.ts` 新增 3 个 handler；`:190-191` 追加两条写通道；四个旧 handler 改为调新仓储。

**正文链一行不改**：`generate-draft.command.ts:972` / `:1047` / `:2551-2562` 保持原样（`VolumeHandoffDefinition` 多两个字段，编译自动通过）。

---

## 8. 便携 / 清库 / 渲染

### 8.1 渲染（`src/shared/volume-handoff.ts`）

- `VolumeHandoffDefinition` 加 `volumeId: string`、`boundaryBasis: VolumeBoundaryBasis | null`；`firstChapter` / `lastChapter` 改成 `number | null`。
- `VolumeHandoffInput` 改成 `{ handoffId?, volumeId: string, worldState?, heroState?, events?, items?, debts?, openThread?, source? }`。
- **`renderVolumeHandoffSection` 签名一字不改**：`(handoff, writingLanguage, chapterNumber, maxChars?)`。
- 节首文案**按 `boundaryBasis` 分档，`actual` / `headings` 分支逐字保持原样**（这是第 8 条哈希不变的前提）：

| basis | 中文节首 |
|---|---|
| `actual` / `headings` | `【上一卷交接（第${volumeIndex}卷 · 全书第${first}–${last}章）】`（**逐字不变**） |
| `declared` | `【上一卷交接（第${volumeIndex}卷 · 计划第${first}–${last}章）】` |
| `even` | `【上一卷交接（第${volumeIndex}卷 · 估算第${first}–${last}章）】` |
| `null`（卷已删） | `【上一卷交接（第${volumeIndex}卷）】` |

`firstChapter` / `lastChapter` 为 `null` 时写「起止未定」，不写「全书第 null 章」。

### 8.2 便携

- `portable-project-field-policy.json`：加 `"m19Tables": ["volumes", "volume_units"]`；`tables.volumes` **12 列**逐字段 `"D"`；`tables.volume_units` **9 列**逐字段 `"D"`；`tables.volume_handoffs` **改成 11 列**（删 `volume_index` / `first_chapter` / `last_chapter`，加 `volume_id`）。
- `portable-project-format.ts` 四处：`origin` 联合加 `'m19-delta'`、`const m19Tables = new Set(...)`、delta 判定链末尾追加、三元链末位。
- **计数预期**：`61 + 2 = 63` 表；`584 + 12 + 9 - 2 = 603` 字段；`added = 229 + 19 = 248`。
  **这三个数是算出来的，不是实测值** —— 执行者必须先用旧断言跑一次拿到真实值，若与预期不符，**先查是不是多/少了一列**，不许直接改断言凑绿。
- 归档 `sourceEvidence`：`{ schemaVersion: 20, tableCount: 63, fieldCount: 603 }`，donor 变体 `+1`。

### 8.3 清库（顺手补现状缺口）

`electron/repositories/project-clear-repository.ts`：`volume_handoffs` **现在没被清**（既有缺口）。本期三张表一起加，顺序必须是 `volume_handoffs` → `volume_units` → `volumes`（FK 依赖）。`volumes` 的 `actual_last` 也随删行一起没了，不需要单独重置。

---

## 9. 施工六步（一步全绿再进下一步）

每步把自检输出存 `.runtime/p12b/S<n>-*.log`。用 `mkdir -p .runtime/p12b` 建目录（`.runtime/` 已被 git 忽略，确认 `git check-ignore` 通过）。

**开工前的第一条命令必须是 P1-P3 三项前置（§2）** —— 尤其 P3 的锚点核对，基线不对就停。

### S1 迁移（`m19-volume-structure.ts` + 六处注册）

自检：`ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run electron/migrations/__tests__/m19-installed-lane.test.ts`（8 条）+ 迁移目录全绿 + `tsc --noEmit`。

### S2 纯函数（`src/shared/volume-structure.ts`）

自检：`... run src/shared/__tests__/volume-structure.test.ts`（17 条）+ `tsc` + eslint。

### S3 卷结构仓储（`volume-structure-repository.ts`）

自检：`... run electron/repositories/__tests__/volume-structure-repository.test.ts`（12 条，**含 G2 反例**）。

### S4 改交接单仓储与渲染（`volume-handoff.ts` + `volume-handoff-repository.ts`）

自检：`... run electron/repositories/__tests__/volume-handoff-repository.test.ts`（12 条）+ `src/shared/__tests__/volume-handoff.test.ts`（12 条）。
**必须同时验证第 8 条哈希未变**：`grep -n "fc037298" src/services/workflows/__tests__/context-entry-parity.test.ts` 且 `node ... run src/services/workflows/__tests__/context-entry-parity.test.ts` 全绿。

### S5 IPC + 控制器 + 面板

自检：`node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/editor/__tests__/VolumeHandoffRegistryPanel.browser.tsx`（11 条）+ `tsc` + eslint。
**必须确认输出里有 `chromium`** —— 没有就是跑了空配置（`no test files found` 不算通过）。

### S6 便携 / 清库 / 文档 / 全量

自检：便携 + 归档 + 清库三个文件；`src` 全量对比 §2 的 3 文件基线；`node scripts/check-doc-links.mjs`。

**建议顺序不改**：先把表与纯函数做绿（S1-S2），再改交接单（S4）——反过来会在旧字段还活着时改渲染，两边都红。

---

## 10. 验收清单（复核者逐条打勾）

> **报告只是线索，每条自己跑。** 下面的数字都是 leader 算的预期值，不是实测值。

### A 类 · 自动门（13 条，命令即可判）

| # | 判据 | 通过标准 |
|---|---|---|
| A1 | `git log --oneline -1` | 本批单独成提交，且 `2f460496` 仍在它之前 |
| A2 | `tsc --noEmit` | 无输出 |
| A3 | `eslint`（本批全部改动 `.ts/.tsx`） | 无输出 |
| A4 | `grep -n "^export const CURRENT_DESKTOP_SCHEMA_VERSION" electron/migrations/desktop-registry.ts` | `= 20`，且整行能被 `node -e "..."` 的正则解析 |
| A5 | `grep -n "M19" electron/migrations/registry.ts src/shared/project-storage.ts` | lane 有 `{id:'M19',from:19,to:20}`；`MIGRATION_IDS` 末项 `'M19'` |
| A6 | `node -e` 读便携策略 | `m19Tables` 含两表；`volumes` 12 列全 `"D"`；`volume_units` 9 列全 `"D"`；`volume_handoffs` **11 列** |
| A7 | 迁移全量 | `electron/migrations/__tests__` 20 文件全绿（m19 自己 8 条） |
| A8 | 卷结构仓储 | 12 条全绿 |
| A9 | 交接单仓储 | 12 条全绿 |
| A10 | 渲染 | `volume-handoff.test.ts` 12 条全绿 |
| A11 | 面板 browser | 11 条全绿，**输出含 `chromium`** |
| A12 | 注入窗口 | `prewrite-consultation` + `chapter-materials` + `context-entry-parity` + `generate-draft.command` 四文件全绿 |
| A13 | 全量 `src` | 失败文件**恰好** §2 那 3 个（19 例），多一个 ❌ |

### B 类 · 反例验证（6 条，破坏必须红）

| # | 怎么破坏 | 必须发生 |
|---|---|---|
| B1 | 把第 8 条哈希 `fc037298…` 改一个字符 | `context-entry-parity` 对应的「composes the previous-volume handoff section」红；改回绿 |
| B2 | **只建 `volume_handoffs`、不建 `volumes`**（M18 形状） | `hasVolumeHandoffSchema === false`，`list === []`，`before === null`，`upsert` 抛 `SCHEMA_MISSING`（**这条是本批最重要的一条**，它守住「跨卷记忆静默消失」） |
| B3 | 先 `UPDATE volumes SET actual_last=42, actual_source='finalized'`，再跑 `rebuildVolumes` | `actual_last` 仍 42、`actual_source` 仍 `'finalized'` |
| B4 | 区间内没有已定稿章时点「标记本卷已完成」 | 抛 `VOLUME_MARK_DONE_NO_FINALIZED`，`actual_last` 仍 NULL |
| B5 | 把 `even` 档的节首从「估算第 a–b 章」改成「全书第 a–b 章」 | 对应渲染用例红 |
| B6 | 往 v19 的旧 `volume_handoffs` 插 1 行再跑 M19 | 抛 `M19_VOLUME_HANDOFF_NOT_EMPTY`，`user_version` 停在 19，旧表与那一行都在 |

### C 类 · 人工判读（4 条）

| # | 看什么 | 合格标准 |
|---|---|---|
| C1 | `renderVolumeHandoffSection` 的 `actual` 分支 | 与 HEAD 的文案**逐字一致**（这是哈希不变的原因） |
| C2 | `materializeVolumeStructure` 里「部分归属不钉卷末」 | 有注释说明理由，且第 6 条测试（部分归属 ⇒ 不取 8）能红 |
| C3 | 面板没选卷时的字数 | 不是恒 0（旧实现会恒 0，`bodyChars` 已改占位区间） |
| C4 | 面板挂载 | `state === 'empty'` 时自动重建一次；`stale` 时**不自动重建** |

### D 类 · 必须不变（4 条）

| # | 项 | 值 |
|---|---|---|
| D1 | 第 8 条哈希 | `fc03729848c1c177f2cd08dd0c82389716034bf8f73ba304a3410c51cfaa1670` |
| D2 | 前 7 条哈希 | `dcca9697…` / `a006dfb7…` / `9db07fa7…` / `7183dafb…` / `44ce3a3e…` / `4e636164…` / `bddf8727…` |
| D3 | 中英两条逐字快照（`volume-handoff.test.ts`） | 字节不变 |
| D4 | `m18-volume-handoffs.ts` | **一行都没被改**（`git diff HEAD -- electron/migrations/m18-volume-handoffs.ts` 为空） |

---

## 11. 风险与停机条件

| # | 风险 | 走哪条路 |
|---|---|---|
| 1 | `synopsis` 只写了前几卷，后面卷没有归属标题 | 物化给 `declared` / `even`，界面标「折算 / 估算」；正文链仍注入，但节首写「计划第…」/「估算第…」。**不许**为了「看起来精确」把 `even` 改成 `headings` |
| 2 | 交接单指向已删的卷 | FK `RESTRICT` 正常路径删不掉；重建遇「有交接单但大纲已无此卷」**保留**（`source='retained'`）。面板标「大纲已无此卷，保留」，作者可改选或删除。若 `PRAGMA foreign_key_check` 非空 ⇒ **停**，先修数据 |
| 3 | 旧格式项目（synopsis 无卷号 + plan 无章数）物化出 `even` | **敢用，但带来源措辞**。不注入的失败形态是「跨卷记忆完全消失」，比「区间是估算」更糟 |
| 4 | M19 遇到旧 `volume_handoffs` 有数据 | 抛 `M19_VOLUME_HANDOFF_NOT_EMPTY` 并回滚。**绝不把 DROP 改成无条件执行**（数据丢失不可逆）。真实库已核实为空，正常路径不会遇到 |
| 5 | 作者在大纲里重排卷 | 改名 ⇒ `warnings: VOLUME_NAME_CHANGED`（只提示）；重排 ⇒ 交接单跟着 index 走，可能指错卷 ⇒ 面板显示 warning，作者改选。**不许静默覆盖名称** |
| 6 | 超写跨过下一卷计划起点 | `markVolumeDone` 上界 = 下一卷 `planned_first`，超出部分按计划归下一卷。写进注释与文档；要精确归卷需期 2 的逐章记账。**不许改 `planned_*` 去迁就** |
| 7 | 重建后 `planned_last < actual_last` | 只提示，**不许改 `actual_last`** |

**八条停机条件**（撞到就停，在报告里写清哪一条 + 代码事实，**不要自己找替代实现**）：

1. `git status --porcelain` 开工时有别人未提交的改动
2. `tsc` 有错且不是参数缺失类的机械错
3. 便携计数实测与 `63 / 603 / 248` 不符且原因不是「多/少一列」
4. `fc037298…` 变了（说明渲染字节被改）
5. `m18-volume-handoffs.ts` 需要改才走得通
6. 某步卡住超过 3 次尝试仍未绿
7. 计划点名的文件/函数不存在（先报，不要造）
8. 发现必须动 `architecture.command.ts` 的生成逻辑、`worldbuilding-rules.ts` 上限、`review_findings`、`world-state-*`

---

## 12. 常用命令（照抄，不要创新）

前置一律 `unset CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR CODEBUDDY_TOOL_CALL_ID`。

```bash
# 纯 TS
node ./node_modules/vitest/vitest.mjs run <paths>
# electron ABI（迁移 / 仓储 / 便携 / 归档）
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run <paths>
# 浏览器（*.browser.tsx 必须带 config，否则根本没跑）
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <file>
# 类型 / lint / 文档
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/eslint/bin/eslint.js <files>
node scripts/check-doc-links.mjs
```

**禁用**：`pnpm` / `npx`（shim 在 Git Bash 坏）；`node scripts/prepare-native-for-node.mjs`（会把 ABI 切成 127，之后 `pnpm dev` 起不来）。

**已知 flake**：`project-archive-service.test.ts` 本机每次随机挂 1 条（HEAD 上同样，已两次基线对照确认）。**报红前先单文件重跑一次再判**；那个文件的判据是 §8.2 的四个计数断言，不是整体绿不绿。

---

## 13. 文档（同批改，别留到下一轮）

| 文件 | 改哪几处 |
|---|---|
| `docs/design/architecture/volume-unit-structure-design.md` | 状态行改「✅ 已裁定（2026-10-24）」；§2 全部换成 §3 的三张表（删 `status` / `planned_words` / `actual_first`，加 `planned_source` / `actual_source`）；§4 换成 §4 / §5 / §6 的实际形状（**删 `resolveVolumeOfChapter`**）；§6「不做」补「不存 `actual_first`、不存章数、不做原文 hash、不做手改区间入口」 |
| `docs/design/architecture/p1-2-volume-handoff-design.md` | 状态行补「2026-10-24 M19：区间外置到 `volumes`，面板改为选卷」；§2「`first_chapter` / `last_chapter` 是写入那一刻的真实章号」改为「由 `volumes` 的有效区间派生；`actual_last` 才是事实」 |
| `docs/plans/prompt-assembly-backlog.md` 12.19 行 | 「📝 设计稿待裁定」→「🚧 施工中」，写死四条裁定 |
| `docs/design/architecture/long-form-readiness-review.md` | §1.1 与 §5 的 P1-2 行：从「M18 + 登记页 + 注入」扩成「M18 + M19 卷结构 + 登记页（选卷）+ 注入」 |
| `docs/plans/p1-2-volume-handoff-plan.md` | 头部补一行「M19 已把 §2.1 的 13 列改写成 11 列 + 外键；本文件 §10.1 的 `{19,61,584}` / `229` 是**历史快照**」——否则下一轮执行者按旧形状施工 |

---

## 14. 不做（防下一轮发明）

- ❌ 不写 `resolveVolumeOfChapter`（本期无消费方）
- ❌ 不做 `db:volume-units-list`（本期无消费方）
- ❌ 不自动生成交接单（期 2）
- ❌ 不动 `architecture.command.ts` 的生成逻辑、`outline-tree`、`arcSpanForUnit`
- ❌ 不预埋 `part_index`（W8 再加列）
- ❌ 不存章数 / 字数（ADR-0022）
- ❌ 不给旧格式项目做「手改区间」入口（作者裁定）
- ❌ 不在保存大纲时自动重建（作者可能正在编辑，删卷比过期危险）
