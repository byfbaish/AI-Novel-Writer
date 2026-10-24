# P1-2 期 1 · 卷末交接单（volume handoff）设计稿

> **状态**：✅ 期 1 已落地（2026-10-24，M18，schema 18 → 19）；期 2 / 期 3 未开工。
> **施工规格**：[`p1-2-volume-handoff-plan.md`](../../plans/p1-2-volume-handoff-plan.md)
> **判据位置**：`long-form-readiness-review.md` §0（跨卷会失真）与 §3（卷级上下文一行）。

---

## 1. 四问（加机制之前先答）

| # | 问题 | 答案 |
|---|---|---|
| 1 | **行业叫什么** | 写作工具里叫 *series bible* / *volume handoff*；叙事学与 LLM 长文研究里叫 **rolling / hierarchical summary**（分段摘要 + 上一段快照）。网文作者自己的说法是「卷末总结、卷首回顾」。 |
| 2 | **谁消费** | **正文链的每一次请求**（首稿 / 续写轮 / 压缩轮）。唯一入口是 `buildPrewriteConsultationBlock`，它把这一节拼进**必需材料块**（不是可选材料、不是模板变量）。作者在登记页手填。 |
| 3 | **失败形态属哪类** | **「上下文里根本没有」**（判据 DN 同型：缺数据，而不是数据写歪）。表现为跨卷失真：第 4 卷里模型不知道第 1–3 卷用掉了什么底牌、谁还欠谁一条命。它不是审稿能查出来的错误 —— 审稿看的是本章正文，看不到「本该承接却没承接」。 |
| 4 | **已有产品做过什么** | Sudowrite 的 Story Bible、Novelcrafter 的 Codex、Campfire 的 Timeline 都提供「跨章/跨卷摘要」并常驻上下文；LLM 侧的标准做法是自动摘要（`RecurrentGPT` 一类）。**本期的差异是刻意的**：不调模型、作者手填、确定性注入 —— 期 1 要先把「通道」与「数据形状」钉死，自动生成（期 2）才有验收基线（作者手填的几份）。 |

**一句话**：这不是「再做一份摘要」，而是补上**唯一没有通道的那一半** —— 写到第 4 卷时前 3 卷正文早已退出上下文。

---

## 2. 形状（13 列）

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

| 列 | 为什么是它 |
|---|---|
| `volume_index` | 卷号，**单列 UNIQUE**（写在列上，不另建 `CREATE UNIQUE INDEX`，与 M14/M15/M17 一致）。第一卷也要有一份 —— 「第 2 卷要承接第 1 卷」不是特例 |
| `first_chapter` / `last_chapter` | **写入那一刻的真实章号**，不是计划章数。超写是常态（计划 40 章写到 43 章）；用计划值会让第 41–43 章读不到上一卷 |
| `world_state` / `hero_state` | 卷末世界与主角的状态。两行散文，不拆字段：这两件事在正文里本来就是叙述 |
| `events_json` / `items_json` / `debts_json` | **字符串数组**（`["…"]`），不是对象。三个上限分别 5 / 5 / 3 条 —— 顺序即重要性 |
| `open_thread` | 卷末未决。一条就够：多条未决会变成一份 TO-DO，模型会去「解决」它 |
| `source` | 本期只有 `author`；留 `generated` 给期 2，**不设 CHECK**（只是标记） |
| `created_at` / `updated_at` | 面板排序与「这份是不是旧的」判断用 |

**刻意没有表外索引**：正文链只有一条 `WHERE last_chapter < ? ORDER BY last_chapter DESC LIMIT 1`，
表规模是「卷数」（个位数到几十），单列 UNIQUE 自带的索引就够。

---

## 3. 五条字数口径（写死，不许自己定）

`VOLUME_HANDOFF_CHARS = 1500` 定义在 `shared/outline-prefix-budget.ts`，`volume-handoff.ts` 只做别名
（`VOLUME_HANDOFF_MAX_CHARS`）—— 两个 `1500` 以后必然漂移，架构侧的大纲预算就和实际注入量对不上。

| # | 规则 | 依据 |
|---|---|---|
| 1 | `maxChars` 只算**正文行**，**不含**节标题与说明句 | 与 `prewrite-consultation.ts` 各节同口径 |
| 2 | 用 `String.length`（UTF-16），不用 `Array.from().length` | 与既有各节一致 |
| 3 | 「省略行」本身**不计入** 1500 | 它是提示，不是内容 |
| 4 | 超限用 **`break`**（后续项全丢），不是跳过该项继续 | 顺序即重要性：先丢的必须是最不重要的那些 |
| 5 | **一项都没装进去 ⇒ 整节返回 `''`** | 否则会出现「注入了 1 条，内容却是省略说明」 |

装入顺序：`worldState → heroState → events[] → items[] → debts[] → openThread`。
组（事件 / 物品 / 债）里**单条超预算就 `break`**，不截半句；只有标签装得下、一条子项都装不进时，
整组按超预算处理（悬空标签没有信息量）。

---

## 4. 为什么是**章号区间**而不是卷号

正文链不知道「这一章属于第几卷」——`plot_structure_plan` 里没有运行时可靠的卷边界（`arc-position.ts`
明确写着「按章数等分推断会漂移，不参与状态判定」）。而**章号是每章都有的**。

所以判据只能是：`last_chapter < 本章` 里章号最大的那一份 = 上一卷。由此得到三条硬约束：

1. **区间必须连续、不重叠** —— 重叠 = 同一章落在两条记录里 = 静默注入错卷。仓储在 `upsert` 前
   直接抛 `VOLUME_HANDOFF_RANGE_CONFLICT`，面板按「保存后的快照」整批拦下。
2. **区间必须由作者按实际写到的章手填** —— 面板不做任何推算，只在输入框下方固定提示
   「章号请对照大纲里该卷的最后几章填写」。
3. **卷号只是给人看的名字**（节首「第2卷 · 全书第21–40章」），不参与判定。

渲染样例（逐字，`chapterNumber = 45`）：

```
【上一卷交接（第2卷 · 全书第21–40章）】
以下是从第2卷交接下来的事实，本章为第45章；只写下一卷要用的，不是编年史。与已定稿原文冲突时以定稿原文为准。
- 卷末世界：……
- 卷末主角：……
- 待承接的事件：
  - ……
- 关键物品：
  - ……
- 未结清的债：
  - ……
- 卷末未决：……
```

节首必须写「本章为第 N 章」：否则模型会把「上一卷」读成「上一章」，把 40 章前的事当成刚发生。

---

## 5. 注入位置与计数

- 节序：**`交接 → 事实 → 物品 → 制度 → 知情 → 能力 → 规则`**。交接单放最前，因为它是**背景**，
  后面的节是细节；而「背景」必须最先建立，否则细节无处挂靠。
- 进的是**必需材料块**（`assembleChapterMaterials` 的 `author:required` 候选），两点理由：
  1. 续写轮 / 压缩轮**不带模板变量**，只带材料块 —— 放模板里等于这一轮又没设定；
  2. 放可选材料会被 8k 预算按相关度整块裁掉。
- `handoffCount` **不能**用 `count(section)`：那一节多行（标签 + 子项），会被数成 3、5。
  写死 `handoffCount: handoffSection ? 1 : 0`（有反例验证：改成 `count()` 时该断言立刻读到 6）。
- 零字节护栏：`handoff` 缺省 / `null` / 六项全空时不产生任何字节 —— `context-entry-parity` 的
  7 条旧哈希（`dcca9697…` … `bddf8727…`）一字未改；新增一条 `{handoff}` 哈希钉「传了是这样」。

---

## 6. 不做（防下一轮发明）

- ❌ **自动生成交接单**（期 2）：要写模型调用、幂等重建、失败兜底，与本期 CRUD 完全不同级。
- ❌ **交接单失效判定**：删章、改章号都不自动更新区间（等 P2-1 findings）。
- ❌ **在正文链推断卷边界**：不从 `plot_structure_plan` 算、不按章数等分。
- ❌ **面板的「建议区间」**：作者 2026-10-24 明确砍掉。
- ❌ **第二张表 / 改 `summary_snapshots` / 碰 `finalization-generation`**。
- ❌ **把交接单放进模板变量或可选材料**。
- ❌ **新增 `sourceId` 进材料决策**（`MATERIAL_DECISION_SOURCE_ID` 是闭集正则）。

---

## 7. 已知限制

1. **要作者手填**。本期零模型调用；不填 = 不注入 = 跨卷仍是老样子。自动生成在期 2。
2. **章号要作者自己数**。旧格式大纲的章标题根本没有卷号（`parseOutlineChapterHeading` 对
   `## 第45章：名` 返回 `volumeIndex: null`），按章数等分推断又会随超写整体漂移。手填两个章号
   是这一期**故意接受的麻烦**。
3. **缺卷时会静默注入更早的卷**：若第 2 卷没填、第 3 卷写了，第 3 卷会读到第 1 卷的交接单。
   本期唯一的缓解是节首的「与已定稿原文冲突时以定稿原文为准」；真正的修复要等 findings（P2-1）。
   > 计划 §7 原写「节首明写：若两者之间还有其他卷…」，与 §2.3 逐字渲染模板冲突；
   > 本期按 §2.3 的**逐字模板**落地（测试逐字比对快照），未追加第二句说明。
4. **卷被重写后交接单不失效**：删章、改章号都不自动更新区间。
5. **不校验 `source` 取值**：`author` / `generated` 只是标记，无 CHECK（本期只有 `author` 一种）。
6. **分区交换要保存两次**：面板「先删后写」能让「删 A 建 B」通过，但两卷区间**互换**会因中间态
   重叠被拒 —— 这是刻意的（不做跨行事务），页面上有固定提示。
7. **未验证真实效果**：本期没有跑真模型、没有 A/B。是否降低跨卷失真，要等实机观察。
