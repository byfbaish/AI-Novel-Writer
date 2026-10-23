# P1-2 期 1 · 卷末交接单（数据 + 登记 + 注入正文）

> **执行者**：腾讯 HY4，无人值守。
> **复查者**：DeepSeek V4.1 Flash（明日独立复核）。
> **基线**：分支 `exp/resource-ledger` · HEAD **cf10b44f**（P14「章节叙事定位」已由作者单独提交，不在本批）· schema **18** → 19。
> **2026-10-24 leader 复核**：P14 使生成链行号整体 **+15**（见 §3 S4 的锚点，已全部更新）；
> P14 同时修掉了既有基线 8 个失败文件 ⇒ **允许红清单已重测**，见 §1 P2。
> **作者已裁定**：本期 = 建表 + 独立登记页 + 写前查阅第七节注入**正文 prompt**；**不调模型**；「上一卷」用**表里的章号区间**表达，正文链零卷号推断。

---

## 0. 这一期到底做什么（一句话）

让作者在一卷写完后，把「下一卷必须承接的几件事」填进一张表；系统保证这份交接单出现在**后续每一章的每一次正文请求**里（含续写轮、压缩轮），直到下一份交接单取代它。

**为什么要它**：写到第 4 卷时，第 1–3 卷正文早已退出上下文，只剩几百字大纲。工具没有「跨卷记忆」，这是评审认定的三处硬伤之一。

**本期不做**（写在这里，防止执行者扩边界）：
- ❌ 不调模型自动生成交接单（期 2）
- ❌ 不注入大纲 prompt、不做前缀投影（期 3）
- ❌ 不做「卷被重写后交接单自动失效」（等 P2-1 findings）
- ❌ 不解析 `plot_structure_plan` 推断卷边界（运行时不推断，只在面板给建议值）
- ❌ 不建第二张表、不改 `summary_snapshots`、不碰 `finalization-generation`

---

## 1. 开工前置（四条，缺一条就停）

| # | 检查 | 命令 | 不满足怎么办 |
|---|---|---|---|
| **P0** | **本计划已在仓库里** | `ls docs/plans/p1-2-volume-handoff-plan.md` | 执行者若读不到这份计划，说明它只在作者的私人目录里。**先由 leader 复制进 `docs/plans/p1-2-volume-handoff-plan.md` 并提交**，再从仓库版本施工 |
| P1 | 工作树干净 | `git status --porcelain`（应为空） | ✅ **已满足**：P14 已由作者单独提交为 `cf10b44f`，本批开工时工作树为空。若开工那一刻又不干净 ⇒ **停**，并且不要 stash 别人的改动 |
| P2 | 基线绿 | 见下方命令 | 记下失败清单，后面每步只与这份清单比 |
| P3 | 行号锚点核对 | `grep -n "private async readAbilities" src/services/workflows/commands/generate-draft.command.ts` | **`cf10b44f` 上实测 = 2527**（计划初稿写 2512，因 P14 +15 行已作废）。同轴上：`readActiveNarrativeThreads` = **2544**、`const abilities = await this.readAbilities(...)` = **968**、`chapterMaterials = await assembleChapterMaterials({` = **1023**、写前日志 = **1073-1074**。若任一偏差 > 20 行 ⇒ 基线不对，**停**并报实际 HEAD |

**基线命令（跑完存证）**：
```bash
mkdir -p .runtime/p12
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node ./node_modules/vitest/vitest.mjs run src 2>&1 | tee .runtime/p12/S0-baseline-src.log | tail -5
```
**实测（`cf10b44f`，leader 已跑）**：`19 failed / 3797 passed / 1 skipped`（287 文件）。
**允许红清单只有这 3 个文件**（把它抄进报告，本期唯一的允许红）：

```
src/services/__tests__/export-service-integration.test.ts
src/services/workflows/commands/__tests__/finalize-postprocess-character.integration.test.ts
src/services/workflows/commands/__tests__/planning-material-binding.test.ts
```

> P14 的提交修掉了原本失败集里的 8 个文件，所以**不再是计划初稿写的「10 文件 / 29 例」**。多出任何一个 ⇒ 回归。

---

## 2. 形状（照抄，不要自由发挥）

### 2.1 表 `volume_handoffs`（13 列，M18，schema 18→19）

```sql
CREATE TABLE volume_handoffs (
  handoff_id    TEXT PRIMARY KEY,
  volume_index  INTEGER NOT NULL UNIQUE CHECK(volume_index > 0),
  first_chapter INTEGER NOT NULL CHECK(first_chapter > 0),
  last_chapter  INTEGER NOT NULL CHECK(last_chapter >= first_chapter),
  world_state   TEXT,
  hero_state    TEXT,
  events_json   TEXT NOT NULL DEFAULT '[]',
  items_json    TEXT NOT NULL DEFAULT '[]',
  debts_json    TEXT NOT NULL DEFAULT '[]',
  open_thread   TEXT,
  source        TEXT NOT NULL,
  created_at    TEXT,
  updated_at    TEXT
);
```

**四条必须写进文件头注释的语义**：
1. 一条记录 = **一卷的交接单**，不是编年史。只记「下一卷要用的」。
2. `first_chapter` / `last_chapter` 是**写入那一刻的真实章号**，不是计划章数。超写是常态。
3. **正文链靠 `last_chapter < 本章` 找「上一卷」**，所以区间必须连续、不重叠。重叠 = 静默注入错卷。
4. 三个 `_json` 列是**字符串数组**（`["…","…"]`），不是对象。

**单列唯一写在列上**（`volume_index ... UNIQUE`），**不要**另建 `CREATE UNIQUE INDEX` —— 与 M14/M15/M17 一致，少一条 apply 分支和一条 verify。

### 2.2 常量复用（不要新建字面量 1500）

`src/shared/outline-prefix-budget.ts:33` 已有 `export const VOLUME_HANDOFF_CHARS = 1500`，且被 `architecture.command.ts` 的预算预估消费。**复用**：

```ts
import { VOLUME_HANDOFF_CHARS } from './outline-prefix-budget'
/** 别名：语义同 VOLUME_HANDOFF_CHARS，不重复字面量。 */
export const VOLUME_HANDOFF_MAX_CHARS = VOLUME_HANDOFF_CHARS
```

> 理由：写两个 `1500` 以后必然漂移，架构侧的大纲预算就和实际注入量对不上。

### 2.3 渲染函数签名（**注意有 `chapterNumber`**）

```ts
export function renderVolumeHandoffSection(
  handoff: VolumeHandoffDefinition | null,
  writingLanguage: WritingLanguage,
  chapterNumber: number,
  maxChars: number = VOLUME_HANDOFF_CHARS,
): string
```

中文渲染形态（**逐字对齐，标点不要改**）：

```
【上一卷交接（第2卷 · 全书第21–40章）】
以下是从第2卷交接下来的事实，本章为第45章；只写下一卷要用的，不是编年史。与已定稿原文冲突时以定稿原文为准。
- 卷末世界：……
- 卷末主角：……
- 待承接的事件：
  - ……
  - ……
- 关键物品：
  - ……
- 未结清的债：
  - ……
- 卷末未决：……
（本条已按篇幅省略，未列出的内容以定稿原文为准）      ← 仅在有丢弃时出现
```

英文对称实现。**六项全空 ⇒ 返回 `''`**（不是只有标题的空节）。

### 2.4 字数口径（**五条写死，不许自己定**）

| # | 规则 | 依据 |
|---|---|---|
| 1 | `maxChars` 只算**正文行**，**不含**节标题与说明句 | 与 `prewrite-consultation.ts:61-62` 同口径 |
| 2 | 用 `String.length`（UTF-16），不用 `Array.from().length` | 与既有各节一致 |
| 3 | 「省略行」本身**不计入** 1500 | 它是提示，不是内容 |
| 4 | 超限用 **`break`**（后续项全丢），不是跳过该项继续 | 顺序即重要性 |
| 5 | **一项都没装进去 ⇒ 整节返回 `''`，`handoffCount = 0`** | 否则会出现「注入了 1 条，内容却是省略说明」 |

装入顺序：`worldState → heroState → events[] → items[] → debts[] → openThread`。每项内部：`events/items/debts` 逐条装入，**单条超预算就 `break`**（不截半句）。

### 2.5 计数与空值

- `handoffCount` **不能**用现有的 `count(section)`（那个按 `- ` 行数数，交接单多行会算出 3、5）。**写死**：`handoffCount: handoffSection ? 1 : 0`。
- 文本列（`world_state` / `hero_state` / `open_thread`）空 ⇒ **存 NULL**。
- JSON 列空 ⇒ **存 `'[]'`，永不 NULL**（列是 `NOT NULL DEFAULT '[]'`，写 NULL 会约束失败）。
- JSON 解析失败、或解析出非字符串数组 ⇒ **当 `[]` 处理，不抛**。

### 2.6 注入位置

`src/shared/prewrite-consultation.ts` 的 `buildPrewriteConsultationBlock`：

- 节序变为 **`handoff → facts → items → cadences → knowledge → abilities → rules`**（交接单放最前，因为它是背景，细节在后）。
- 入参加 `handoff?: VolumeHandoffDefinition | null`。
- 返回对象加 `handoffCount: number`；空返回时也要有 `handoffCount: 0`。

---

## 3. 施工步骤（六步，每步自带自检；**一步全绿再进下一步**）

> 每步结束把自检输出存进 `.runtime/p12/S<n>-*.log`。**不要一口气改完再跑测试。**

### S1 · 迁移 M18 + 注册 + 便携（不动业务代码）

**新建** `electron/migrations/m18-volume-handoffs.ts`，照 `electron/migrations/m17-power-abilities.ts` 逐行同构：
- 导出 `M18_VOLUME_HANDOFFS_SQL`（建表语句）
- `hasSchemaObject(db, 'table', 'volume_handoffs')` 幂等判断
- `applyM18VolumeHandoffs(db)`：**只有表**（无独立索引），`hasSchemaObject` 为真就跳过
- `verifyM18VolumeHandoffs(db)`：13 列集 / 可空性（`world_state`/`hero_state`/`open_thread`/`created_at`/`updated_at` 可空，其余 NOT NULL）/ `volume_index` 唯一 / 4 处 CHECK 读 DDL 断言 / **主键用 `pk=1` 判，不要用 `notnull=1`**（SQLite 的 `TEXT PRIMARY KEY` 记成 `pk=1`）
- `createM18Migration({ from: 18, to: 19, owner: 'P1-1' })`

**改 5 个文件**：

| 文件 | 改什么 |
|---|---|
| `electron/migrations/registry.ts` | ① `MIGRATION_LANE` 末尾追加 `Object.freeze({ id: 'M18', from: 18, to: 19, owner: 'P1-1' })`；② `LATEST_SCHEMA_VERSION = 19` |
| `src/shared/project-storage.ts` | `MIGRATION_IDS` 末尾追加 `'M18'` |
| `electron/migrations/desktop-registry.ts` | **7 处**：import / `CURRENT_DESKTOP_SCHEMA_VERSION = 19`（**整行格式逐字不变**，`scripts/project-migration-acceptance.mjs:41` 用正则解析）/ `createM18Migration` 装配到 apply 循环 / `schemas(19)` / 指纹集展开 / `createMigrationRegistry([...m17, m18])` / `recognizedSchemas` 展开 |
| `electron/services/portable-project-field-policy.json` | ① 顶层加 `"m18Tables": ["volume_handoffs"]`；② `tables.volume_handoffs` 写 **13 个字段、全部 `"D"`** |
| `electron/services/portable-project-format.ts` | **5 处**：origin 联合加 `'m18-delta'` / `const m18Tables = new Set<string>(fieldPolicyDocument.m18Tables)` / delta 判定加 `m18Tables.has(table)` / origin 三元链末位加 `m18Tables.has(table) ? 'm18-delta' : …` / 同文件里 `mNNTables` 的其余引用 |

**新建测试** `electron/migrations/__tests__/m18-installed-lane.test.ts`（6 条，照 `m17-installed-lane.test.ts`）：升到 19 · 13 列形状 · `volume_index` 唯一 · JSON 列默认 `'[]'` 而非 NULL · 幂等（连跑两次）· CHECK 生效（`last_chapter < first_chapter` 被拒）。

**自检**：
```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
  ./node_modules/vitest/vitest.mjs run electron/migrations/__tests__ 2>&1 | tee .runtime/p12/S1.log | tail -5
node ./node_modules/typescript/bin/tsc --noEmit
```
**完成标志**：迁移目录 **19 文件、0 失败**（`m18` 自己 6 条全绿）；`tsc` 无输出。

---

### S2 · 纯函数 `src/shared/volume-handoff.ts`

**新建**，导出：
```ts
export interface VolumeHandoffDefinition {
  handoffId: string
  volumeIndex: number
  firstChapter: number
  lastChapter: number
  worldState: string
  heroState: string
  events: string[]        // 仓储负责 JSON 编解码
  items: string[]
  debts: string[]
  openThread: string
  source: string
  createdAt: string
  updatedAt: string
}
export const VOLUME_HANDOFF_MAX_CHARS = VOLUME_HANDOFF_CHARS
export const VOLUME_HANDOFF_MAX_EVENTS = 5
export const VOLUME_HANDOFF_MAX_ITEMS = 5
export const VOLUME_HANDOFF_MAX_DEBTS = 3

export function renderVolumeHandoffSection(handoff, writingLanguage, chapterNumber, maxChars?): string
/** 面板用：六项是否全空。 */
export function isVolumeHandoffEmpty(handoff): boolean
```

**新建测试** `src/shared/__tests__/volume-handoff.test.ts`（≥10 条）：
1. `null` ⇒ `''`
2. 六项全空 ⇒ `''`（`handoffCount` 由上层算 0）
3. 只有 `worldState` ⇒ 只有那一行
4. **`worldState` 就超 1500 字 ⇒ 整节 `''`**（规则 5）
5. 事件 7 条 ⇒ 只装 5 条（`HANDOFF_MAX_EVENTS`）
6. 债 5 条 ⇒ 只装 3 条
7. 超字预算 ⇒ 后续项丢弃 + **末尾出现省略行**
8. 节首逐字包含 `本章为第45章`（传 45 时），**不是「第 1 章」**
9. 标点 / 括号 / 破折号逐字比对一条完整快照
10. 英文对称
11. `isVolumeHandoffEmpty` 对「只有空白字符」也返回 true

**自检**：
```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node ./node_modules/vitest/vitest.mjs run src/shared/__tests__/volume-handoff.test.ts 2>&1 | tee .runtime/p12/S2.log | tail -5
```
**完成标志**：全绿；`tsc` 无输出。

---

### S3 · 仓储 + IPC + 控制器

**新建** `electron/repositories/volume-handoff-repository.ts`，照 `power-ability-repository.ts` 同构：
```ts
export function hasVolumeHandoffSchema(db): boolean
export function listVolumeHandoffs(db): VolumeHandoffDefinition[]
export function findPreviousHandoff(db, beforeChapter: number): VolumeHandoffDefinition | null
export function upsertVolumeHandoff(db, input): VolumeHandoffDefinition
export function deleteVolumeHandoff(db, handoffId: string): boolean
```
**五条纪律**：
1. `hasVolumeHandoffSchema` 为假 ⇒ `list` 返回 `[]`、`findPreviousHandoff` 返回 `null`，**不抛**。
2. `findPreviousHandoff` 的 SQL 写死：
   ```sql
   SELECT * FROM volume_handoffs WHERE last_chapter < ? ORDER BY last_chapter DESC LIMIT 1
   ```
   **只能返回一条**。返回数组交给调用方筛，等于把「只注入上一卷」这条铁律交给运气。
3. `upsert` 前做两道校验：
   - `volume_index` 已被**其他行**占用 ⇒ 抛 `VOLUME_HANDOFF_VOLUME_TAKEN`
   - 区间与**其他行**重叠 ⇒ 抛 `VOLUME_HANDOFF_RANGE_CONFLICT`
     ```ts
     const conflict = others.find(row =>
       input.firstChapter <= row.lastChapter && row.firstChapter <= input.lastChapter)
     ```
4. 读用 `COALESCE(world_state, '')`；写时文本列空 ⇒ `null`，JSON 列 `JSON.stringify(list)`（空数组就存 `'[]'`）。
5. JSON 解析：`JSON.parse` 包 try/catch，结果不是字符串数组就退 `[]`。

**改 3 个文件**：

| 文件 | 改什么 |
|---|---|
| `src/shared/ipc-channels.ts` | import 类型 + `DatabaseChannels` 加 **4 条**，**签名全部带 `expectedProjectPath`**（所有 `db:` 通道都靠它过项目门禁）：<br>`'db:volume-handoffs-list': { args: [expectedProjectPath: string]; return: { success: boolean; entries?: VolumeHandoffDefinition[]; error?: string } }`<br>`'db:volume-handoffs-before': { args: [beforeChapter: number, expectedProjectPath: string]; return: { success: boolean; entry?: VolumeHandoffDefinition \| null; error?: string } }`<br>`'db:volume-handoffs-upsert'` / `'db:volume-handoffs-delete'` |
| `electron/controllers/db-controller.ts` | import 仓储 + 4 个 handler（照 `db:abilities-*` 的写法）+ `MUTATING_DATABASE_CHANNELS` **只加 upsert / delete 两行**，并照抄一句同格式注释（读通道不进：失败时不该被包成 `{success:false}`） |
| — | 无第三处 |

**新建测试** `electron/repositories/__tests__/volume-handoff-repository.test.ts`（≥8 条）：缺表降级 `[]` / 缺表降级 `null` / 重名拒 / 区间重叠拒 / 相邻区间（20 与 21）允许 / JSON 往返 / 空文本存 NULL 读回 `''` / `findPreviousHandoff` 在「有第 1、2 卷」时只返回第 2 卷 / 第 1 章返回 `null`。

**自检**：
```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
  ./node_modules/vitest/vitest.mjs run electron/repositories/__tests__/volume-handoff-repository.test.ts 2>&1 | tee .runtime/p12/S3.log | tail -5
node ./node_modules/typescript/bin/tsc --noEmit
```

---

### S4 · 注入接线（**最易翻车的一步，逐条照做**）

**改 3 个生产文件**：

**① `src/shared/prewrite-consultation.ts`**
- import `renderVolumeHandoffSection` 与 `VolumeHandoffDefinition`
- 入参对象加 `handoff?: VolumeHandoffDefinition | null`
- 渲染：`const handoffSection = renderVolumeHandoffSection(handoff, writingLanguage, chapterNumber, VOLUME_HANDOFF_CHARS)`
- 节序数组改成 `[handoffSection, factsSection, itemsSection, cadencesSection, knowledgeSection, abilitiesSection, rulesSection]`
- 返回类型与两处 return 都加 `handoffCount`
- **`handoffCount: handoffSection ? 1 : 0`**（不要用 `count()`）
- 文件头注释的第 X 节列表加一条（现在写的是 1–6）

**② `src/services/workflows/chapter-materials.ts`**
- `prewrite` 入参类型加 `handoff?: VolumeHandoffDefinition | null`
- `ChapterMaterialAssembly['prewrite']` 与 `ChapterMaterialBundle['prewrite']` 类型加 `handoffCount: number`
- 透传处 `prewrite: { factCount, itemCount, cadenceCount, knowledgeCount, abilityCount, ruleCount }` 加 `handoffCount`

**③ `src/services/workflows/commands/generate-draft.command.ts`**
- **新方法**，插在 `private async readActiveNarrativeThreads(`（**2544**）**之前**、紧接 `private async readAbilities(`（**2527**）之后：
  ```ts
  /** P1-2：上一卷交接单。本章不属于任何已登记区间之后时返回 null（第 1 章必然如此）。 */
  private async readVolumeHandoff(
    projectPath: string,
    projectSession: ProjectSessionContext,
  ): Promise<VolumeHandoffDefinition | null> {
    try {
      const result = await ipc.invokeWithProjectSession(
        projectSession, 'db:volume-handoffs-before',
        this.chapterInfo.chapterNumber, projectPath,
      ) as { success?: boolean; entry?: VolumeHandoffDefinition | null }
      return result?.success ? result.entry ?? null : null
    } catch { return null }
  }
  ```
  > **`this.chapterNumber` 不存在**（全类零命中），章号一律 `this.chapterInfo.chapterNumber`。
- **调用点**：紧接 `const abilities = await this.readAbilities(...)`（**968**）后一行：
  `const volumeHandoff = await this.readVolumeHandoff(expectedProjectPath, projectSession)`
- **`prewrite` 入参**（`chapterMaterials = await assembleChapterMaterials({` 在 **1023**；`prewrite: {` 块在 **1042**，现有 8 个键 `facts/items/cadences/knowledge/abilities/chapterNumber/chapterCharacters/rules`）加 `handoff: volumeHandoff`
- **写前日志**（中英两行在 **1073 / 1074**）：`if (...)` 条件加 `|| chapterMaterials.prewrite.handoffCount > 0`；中文行追加 `/ 上一卷交接 ${handoffCount} 份`，英文行追加 `/ ${handoffCount} volume handoff(s)`

**修 11 处既有断言**（`prewrite` 全对象 `toEqual`）—— 这是 S4 最容易漏的：
```bash
grep -rn "prewrite).toEqual" src/**/__tests__/*.ts src/**/*.test.ts
```
找到一处补一处 `handoffCount: 0`。涉及 `context-entry-parity.test.ts`、`chapter-materials.test.ts`、`prewrite-consultation.test.ts`。

> **7 条 sha256 哈希一个字都不要动**（`dcca9697…` / `a006dfb7…` / `9db07fa7…` / `7183dafb…` / `44ce3a3e…` / `4e636164…` / `bddf8727…`）。它们不传 handoff ⇒ 零字节 ⇒ 不该变。**若有一条变了，说明你在别处改出了字节，必须回退查原因，不许改哈希值凑绿**。

**新增哈希**：`context-entry-parity.test.ts` 另起一条用例，输入 = `baseline()` + `prewrite: { handoff: <一份完整交接单> }`，先跑出真值再写死，注释写「**新增，不是改旧值**」。

**新增集成用例**（`generate-draft.command.test.ts`）：
- IPC 桩加 `if (channel === 'db:volume-handoffs-before') return { success: true, entry: fixture }`（不加会全线 `unexpected IPC`）
- 断言：首轮请求含 `【上一卷交接（`；**续写轮第二个请求也含**；日志出现「上一卷交接 1 份」
- 另一条：`entry: null` ⇒ prompt 里没有 `【上一卷交接`

**自检**：
```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node ./node_modules/vitest/vitest.mjs run \
  src/shared/__tests__/prewrite-consultation.test.ts \
  src/services/workflows/__tests__/chapter-materials.test.ts \
  src/services/workflows/__tests__/context-entry-parity.test.ts \
  src/services/workflows/commands/__tests__/generate-draft.command.test.ts \
  2>&1 | tee .runtime/p12/S4.log | tail -6
```
**完成标志**：4 文件全绿；`grep -c "toBe('dcca"` 等 7 条与开工前一致。

---

### S5 · 登记页 + tab 接线

**新建** `src/components/editor/VolumeHandoffRegistryPanel.tsx`（照 `AbilityRegistryPanel.tsx` 的结构）与 `VolumeHandoffRegistryEditor.tsx`（30 行，照 `AbilityRegistryEditor.tsx`）。

**面板行为（七条写死）**：
1. 表格列：卷号 / 章号区间 / 卷末世界（截断 20 字）/ 主角（截断）/ 事件数 / 物品数 / 债数 / 操作
2. 编辑用弹窗或展开行（照能力页，不要新发明交互）
3. 三个数组字段（事件/物品/债）用**多行文本域**，一行一条；保存时 `split('\n').filter(trim)`，空行丢弃
4. 字数提示：显示「正文 N / 1500 字」，超了**红字但不阻断保存**（注入侧会按规则丢弃）
5. **卷号与两个章号全部手填**，每行输入框下方固定提示「章号请对照大纲里该卷的最后几章填写」。**不要**去读 `project_core.synopsis`、不要 import `parseOutlineChapterHeading`、不要做任何区间推算 —— 作者明确砍掉了「建议区间」功能，`arc-position.ts` 里也写死了「按章数等分推断会漂移，不参与状态判定」
6. 保存前**本地校验按「保存后的快照」判**：排除被删除的行、把同批次其他行的新值算进去，再判区间重叠与卷号重复；任一冲突 ⇒ **整批不提交**并逐行标红
7. 保存循环里**先删后写**（避免读到还没删的旧行）；区间互换（A 1–10↔B 11–20）会因中间态被拒 —— 给固定提示「**两卷区间互换请分两次保存**」，不要试图实现事务

**改 5 个文件**：

| 文件 | 改什么 |
|---|---|
| `src/stores/editor-store.ts` | **两处**：`EditorTab['type']` 联合加 `'volume-handoff-registry'`；`PROJECT_SCOPED_BUILTIN_TYPES` 数组加同一字符串（漏后者 ⇒ 两个项目共用同一个 tab） |
| `src/components/panels/EditorArea.tsx` | **两处**：`TabIcon` 的 if 分支加图标（建议 `BookMarked`，从 lucide-react import）；渲染分支加 `<VolumeHandoffRegistryEditor key={activeTab.id} projectKey={activeTab.projectKey} />` |
| `src/components/panels/sidebar/ProjectTree.tsx` | 在「能力登记」同一组里加一行，照抄相邻条目，标签 `text('卷末交接', 'Volume handoffs')` |
| `src/components/panels/sidebar/sidebar-file-openers.ts` | 联合类型加 `'volume-handoff-registry'` |
| — | 无第五处 |

**新建测试** `src/components/editor/__tests__/VolumeHandoffRegistryPanel.browser.tsx`（≥7 条）：空态提示 / 列表渲染 / 新增一行 / 区间重叠本地拒且整批不提交 / 卷号重复拒 / 多行文本域转数组（空行丢弃）/ 章号非法（`last < first` 或 ≤0）本地拒。

**自检**：
```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts \
  src/components/editor/__tests__/VolumeHandoffRegistryPanel.browser.tsx 2>&1 | tee .runtime/p12/S5.log | tail -5
```
> ⚠️ **`*.browser.tsx` 不加 `--config vitest.browser.config.ts` 就是根本没跑**（默认配置只收 `*.test.*`）。显示「no test files found」不是通过。

---

### S6 · 文档 + 全量回归

**改 3 份文档**：
1. **新建** `docs/design/architecture/p1-2-volume-handoff-design.md`：四问（行业叫什么 / 谁消费 / 失败形态属哪类 / 已有产品做过什么）→ 形状 13 列 → 五条字数口径 → 为什么章号区间而不是卷号 → 已知限制（不做自动生成 / 不做失效判定 / 旧格式大纲没有卷号标题）
2. `docs/design/architecture/long-form-readiness-review.md`：「卷级上下文」那一行改为 ✅ 宿体已落地（本期只做数据+注入，自动生成待期 2）
3. `docs/plans/prompt-assembly-backlog.md`：P1-2 行状态改为 🚧 期 1 已落地
   > ⚠️ P14 已提交，这两个文件现在有 **P14 刚改过的内容**。改之前先 `git log -1 cf10b44f -- <文件>` 看它动了哪几段；本批只动 P1-2 相关那一段，**不要重新格式化整份文件**（这类排版噪声会让下一轮 review 分不清哪些是真改动）。

**全量回归**：
```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node ./node_modules/vitest/vitest.mjs run src 2>&1 | tee .runtime/p12/S6-src.log | grep -E "^ FAIL |Tests " | sed 's/ >.*//' | sort -u
```
**完成标志**：失败文件集与上面那份 **3 文件允许红清单完全一致**（多一个就是回归）。注意：**不要用计划初稿的「10 文件 / 29 例」当基线**，那是 P14 之前的老数据。

```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
  ./node_modules/vitest/vitest.mjs run \
  electron/services/__tests__/portable-project-format.test.ts \
  electron/services/__tests__/project-archive-service.test.ts 2>&1 | tee .runtime/p12/S6-portable.log | tail -6
```
**这两份测试的计数断言必然要改**，改这几个数字（同批改 + 注释写原因）：

| 文件 | 原值 | 新值 |
|---|---|---|
| `portable-project-format.test.ts` | `{ tables: 60, fields: 571 }` | `{ tables: 61, fields: 584 }` |
| 同上 | `added` 216 | **229** |
| `project-archive-service.test.ts` | `{ schemaVersion: 18, tableCount: 60, fieldCount: 571 }` | `{ 19, 61, 584 }` |
| 同上（donor 夹具） | `{ 18, 60, 572 }` | `{ 19, 61, 585 }` |

> 这些数字的算法：60+1 表 / 571+13 列 / 216+13。**若实测不是这个数**，先检查便携策略里是不是少登记/多登记了列（13 列必须全在），**不要直接改断言迁就现状**。

---

## 4. 停机条件（**遇到就停，写进报告，不许自己决定**）

| # | 情况 | 动作 |
|---|---|---|
| 1 | 工作区不干净（P14 还没提交） | 停，等作者。**不许 stash 别人的改动** |
| 2 | 实际 HEAD 不是 `97a401c0`，或关键锚点偏差 > 20 行 | 停，报实际 HEAD |
| 3 | 发现需要改 `review_findings` / `world-state-*` / 审稿链 / `characters.abilities` / `resources` 任何一个 | 停。这些都在本期边界外 |
| 4 | 需要加第三个 `stepKey`、或改 `finalization-generation*.ts` | 停。主进程定稿槽只认两个 key，加第三槽要动 5+6 处不变量 |
| 5 | **7 条旧哈希有任何一条变了** | 停。说明别处改出了字节，不许改哈希值凑绿 |
| 6 | 便携计数改完仍红 | 停。说明不只是计数问题，别继续调 |
| 7 | 计划里写的文件/函数不存在 | 停。报「哪一条、实际是什么」，**不要自己找替代实现** |
| 8 | 要新增 `sourceId`（如 `volume:1` 进材料） | 停。`MATERIAL_DECISION_SOURCE_ID` 是闭集正则，会被拒 |

---

## 5. 禁止清单

- ❌ `git commit`（作者验收后自己提交）
- ❌ 改 `worldbuilding-rules.ts` 的任何上限常量（会翻期 1 哈希，另立项）
- ❌ 改 `arc-position.ts` 的卷边界算法
- ❌ 把交接单放进**模板变量**（续写/压缩轮不带模板变量，等于这一轮又没设定）
- ❌ 把交接单放进**可选材料**（会被 8k 预算按相关度裁掉）
- ❌ 在正文链做卷号推断（不从 `plot_structure_plan` 算、不按章数等分）
- ❌ 在面板做「自动推算章号区间」（作者已砍掉；也不许 import `parseOutlineChapterHeading` 到面板里）
- ❌ 用 `pnpm` / `npx`（pnpm shim 在 Git Bash 坏）
- ❌ 跑 `node scripts/prepare-native-for-node.mjs`（会把 ABI 切成 127，之后 `pnpm dev` 起不来）
- ❌ 为了让测试变绿而放宽断言（除了 S6 明列的那 4 个计数）

---

## 6. 验收清单（明日由 DeepSeek V4.1 Flash 独立复核）

> **给复查者的规矩**：不要读执行者的报告就下结论。每条自己跑，自己看输出。**报告里的数字一律不采信。**

### A. 自动可跑（每条独立，命令 + 期望）

| # | 命令 | 期望 | 判据 |
|---|---|---|---|
| A1 | `git log --oneline -3` | 能看到 `cf10b44f`（P14）在 **`97a401c0` 之后单独成提交**，本批（计划文档 + 实现）是它之后的**另一条**提交 | 若 P14 与本批混在同一提交 ⇒ ❌ |
| A2 | `node ./node_modules/typescript/bin/tsc --noEmit` | 无输出 | 有任何输出 ⇒ ❌ |
| A3 | `node ./node_modules/eslint/bin/eslint.js <本批全部改动 .ts/.tsx>` | 无输出 | 有 warning ⇒ ⚠️，有 error ⇒ ❌ |
| A4 | `grep -n "^export const CURRENT_DESKTOP_SCHEMA_VERSION" electron/migrations/desktop-registry.ts` | `= 19`，且**整行无多余空格** | 格式变了 ⇒ ❌（验收脚本用正则解析） |
| A5 | `grep -n "LATEST_SCHEMA_VERSION" electron/migrations/registry.ts` | `= 19`；`MIGRATION_LANE` 末条是 `M18 from:18 to:19` | 缺任一 ⇒ ❌ |
| A6 | `node -e "const p=require('./electron/services/portable-project-field-policy.json'); console.log(JSON.stringify(p.m18Tables), Object.keys(p.tables.volume_handoffs).length, Object.values(p.tables.volume_handoffs).every(v=>v==='D'))"` | `["volume_handoffs"] 13 true` | 列数≠13 或非全 D ⇒ ❌ |
| A7 | `env -u … ELECTRON_RUN_AS_NODE=1 electron.exe vitest.mjs run electron/migrations/__tests__` | 19 文件、0 失败 | 有失败 ⇒ ❌ |
| A8 | 同上跑 `electron/repositories/__tests__/volume-handoff-repository.test.ts` | ≥8 例全绿 | ❌ |
| A9 | `node vitest.mjs run --config vitest.browser.config.ts src/components/editor/__tests__/VolumeHandoffRegistryPanel.browser.tsx` | ≥7 例全绿 | 「no test files」⇒ ❌ |
| A10 | 跑 S4 那 4 个文件（prewrite / chapter-materials / parity / generate-draft） | 全绿 | ❌ |
| A11 | `grep -c "toBe('dcca9697\|toBe('a006dfb7\|toBe('9db07fa7\|toBe('7183dafb\|toBe('44ce3a3e\|toBe('4e636164\|toBe('bddf8727" src/services/workflows/__tests__/context-entry-parity.test.ts` | `7`，且**这 7 个哈希值与下文附录逐字相同** | 少一条或值变了 ⇒ ❌ |
| A12 | `grep -c "handoffCount" src/services/workflows/__tests__/*.ts src/shared/__tests__/*.ts` | ≥ 11（每处既有 `toEqual` 都补了） | 少 ⇒ ❌ |
| A13 | 跑 `src` 全量 | 失败文件集恰好是那 **3 个**（`export-service-integration` / `finalize-postprocess-character.integration` / `planning-material-binding`），共 19 例 | 多一个 ⇒ ❌ |
| A14 | 跑 `portable-project-format` + `project-archive-service` | 全绿，且测试里是 `61/584/229` 与 `{19,61,584}`/`{19,61,585}` | ❌ |
| A15 | `git status --porcelain` | **只有**本批文件；无 `.runtime/`、无 `*.log`、无 `node_modules` | 混入 P14 或临时文件 ⇒ ❌ |

### B. 反例验证（**证明护栏有牙齿，不是恒真**）

对每条：**故意改坏 → 必须红 → 改回 → 必须绿**。做不到说明护栏是假的。

| # | 怎么破坏 | 必须发生 |
|---|---|---|
| B1 | 把某条旧哈希改成 `deadbeef…` | A10 立刻红 ⇒ 说明哈希真在跑 |
| B2 | 把 `renderVolumeHandoffSection` 的 `chapterNumber` 硬编码成 `1` | 纯函数测试第 8 条（`本章为第45章`）必须红 |
| B3 | 把 `findPreviousHandoff` 的 `last_chapter < ?` 改成 `<=` | 仓储测试「本章等于 last_chapter 时返回 null」必须红 |
| B4 | 把 `handoffCount` 改用 `count(section)` | 交接单多行时 `handoffCount` 会变 >1，必有测试红 |
| B5 | 把仓储的区间冲突校验删掉 | 仓储测试「区间重叠拒」必须红 |
| B6 | 让 `prewrite.handoff` 传 `null` 之外再传一个空对象 `{...全空}` | 材料块必须**逐字节不变**（parity 的 `dcca9697…` 仍绿） |

### C. 人工判读（这三件事跑不出来，必须读代码）

| # | 读哪里 | 该看到什么 |
|---|---|---|
| C1 | `src/shared/volume-handoff.ts` 的 `renderVolumeHandoffSection` | ① 有 `chapterNumber` 参数且真的用了；② 一项都没装进去时**返回 `''`**（不是只有省略行的空壳）；③ 统计字数时**不含**标题与说明句 |
| C2 | `electron/repositories/volume-handoff-repository.ts` 的 `findPreviousHandoff` | 返回**单条**（`LIMIT 1`），不是数组。返回数组 = 铁律交给运气 |
| C3 | 面板的区间校验 | 判的是「**保存后快照**」（排除被删行、算入同批新值），不是「逐行对当前库」 |

### D. 哈希附录（A11 逐字核对用）

```
dcca9697eb84a99d24b9939aa19f1c80ce24f19bb1e7d1b969331119dd888a1e
a006dfb730391c7a30b5aef5cc8da1fdebdaed34a70843a46d41245a79551107
9db07fa7929fba10a71c1509967fc68f617a7e3591f79c7171500251bd374455
7183dafbdafe42603ebcc64883098979d297fe9b326576c295941bad04d3192e
44ce3a3e2b93c9e4ee6142dcb72a2fd8d3bd76473f2ecd3caf50b15f5bdfa323
4e63616457e22a09ad13877ab084342255c8689d3993b7927f56adb7ba5feffc
bddf8727fcdf5cf5b3b4bcf10ef10c096ad3e105084db191f66de49445427e29
```

### E. 复查结论模板

```
A1  ✅/❌   A2  ✅/❌  … A15 ✅/❌      （共 15 条）
B1–B6 逐条：破坏后是否红、恢复后是否绿
C1–C3 逐条：读到什么
新增哈希（第 8 条 {handoff}）：________（执行者报告值 = ______，是否一致）
失败文件集与基线对比：多出 __ 个
结论：通过 / 有条件通过（列出条件）/ 退回（列出必须重做的步骤）
```

---

## 7. 已知限制（写进设计稿，不许隐瞒）

1. **交接单要作者手填**。本期零模型调用；不填 = 不注入 = 跨卷仍是老样子。自动生成在期 2。
2. **章号要作者自己数**。本期不给「从章标题建议区间」功能（作者 2026-10-24 裁定砍掉）：一来旧格式大纲的章标题根本没有卷号（`parseOutlineChapterHeading` 对 `## 第45章：名` 返回 `volumeIndex: null`），二来按章数等分推断会随超写整体漂移。手填两个章号是这一期故意接受的麻烦。
3. **缺卷时静默注入旧卷**：若第 2 卷没填、第 3 卷写了，第 3 卷会读到第 1 卷的交接单。缓解手段是节首明写「以下是从第N卷（全书第a–b章）交接…若两者之间还有其他卷，只以已定稿原文为准」。**真正的修复要等 findings（P2-1）**。
4. **卷被重写后交接单不失效**：删章、改章号都不自动更新区间。本期不处理。
5. **不校验 `source` 取值**：`author` / `generated` 只是标记，无 CHECK（本期只有 author 一种）。

---

## 8. 给执行者的报告格式（照它交，缺一项视为未完成）

1. **六步各自的自检日志路径**（`.runtime/p12/S1..S6-*.log`）与最后 5 行输出
2. `tsc` / `eslint` 结果（原样贴输出，不要说「通过」）
3. **新增第 8 条哈希真值**，以及 7 条旧哈希的 grep 原始输出
4. 便携 / 归档的**实测**计数，与计划预估的 `61/584/229`、`{19,61,584}` 是否一致（不一致要解释原因）
5. 全量 `src` 失败文件集 vs 基线失败文件集（两个列表都贴出来）
6. 与计划的偏离（每处：哪一条、为什么、怎么改的）。**没有偏离就写「无」**
7. 停机条件触发过几次、分别是什么
8. 明确声明：**没有 `git commit`**、**没有改停机清单里的禁区文件**（贴 `git status --porcelain` 自证）

---

## 9. 期 2 / 期 3 预告（本期不做，写在计划里防止范围蔓延）

| 期 | 内容 | 为什么分开 |
|---|---|---|
| **期 2** | 卷末自动生成交接单（模型生成初稿 → 作者审定）+ 卷末触发钩子（`architecture.command.ts:3374` 的卷翻转点）+ 幂等重建 | 要写模型调用、幂等、失败兜底，与本期 CRUD 完全不同级；而且必须先在期 1 用**作者手填的几份**当验收基线 |
| **期 3** | 大纲 prompt 前缀投影（L2 本卷全文 + L3 上一卷快照 + L4 最近 K 章） | `projectSynopsisForOutline()` 零实现，要动 `confirmedPrefix`，工程量大且无现成范式 |
