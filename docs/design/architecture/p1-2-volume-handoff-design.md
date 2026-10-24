# P1-2 期 1 · 卷末交接单（volume handoff）设计稿

> **状态**：✅ 期 1 已落地（2026-10-24，M18，schema 18 → 19）；✅ **期 1b 已改选卷**（M19，schema 19 → 20：区间外置到 `volumes`，作者只选卷、不再填章号）；✅ **期 2 已落地（2026-10-24，零迁移，schema 仍 20）**：定稿链卷末章触发 + 模型初稿 + 面板三态（见 §8）；✅ **期 2b 已落地**：开写闸门（没单 / 只有初稿时强提示确认，见 §9）。期 3（大纲前缀投影）未开工。
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

> ⚠️ **M19 已改形状**：现在是 **11 列 + `volume_id` 外键**，区间外置到 `volumes`，由
> `volumeEffectiveRanges()` 派生。下表是期 1 的历史形状，保留作变更痕迹；**现行 DDL 见
> [`volume-unit-structure-design.md`](volume-unit-structure-design.md)** 与 `electron/migrations/m19-volume-structure.ts`。

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

- ~~❌ **自动生成交接单**（期 2）~~ → ✅ **期 2 已落地（2026-10-24）**，见 §8；期 2 自己的不做清单也在 §8。
- ❌ **交接单失效判定**：删章、改章号都不自动更新区间（等 P2-1 findings）。
- ❌ **在正文链推断卷边界**：不从 `plot_structure_plan` 算、不按章数等分。
- ❌ **面板的「建议区间」**：作者 2026-10-24 明确砍掉。
- ❌ **第二张表 / 改 `summary_snapshots` / 碰 `finalization-generation`**。
- ❌ **把交接单放进模板变量或可选材料**。
- ❌ **新增 `sourceId` 进材料决策**（`MATERIAL_DECISION_SOURCE_ID` 是闭集正则）。

---

## 7. 已知限制

1. **期 1 要作者手填**（期 2 起可先由模型出初稿，作者再改；不填不生成 = 跨卷仍是老样子）。
2. **章号要作者自己数**。旧格式大纲的章标题根本没有卷号（`parseOutlineChapterHeading` 对
   `## 第45章：名` 返回 `volumeIndex: null`），按章数等分推断又会随超写整体漂移。手填两个章号
   是这一期**故意接受的麻烦**。
3. **缺卷时会静默注入更早的卷**：若第 2 卷没填、第 3 卷写了，第 3 卷会读到第 1 卷的交接单。
   本期唯一的缓解是节首的「与已定稿原文冲突时以定稿原文为准」；真正的修复要等 findings（P2-1）。
   > 计划 §7 原写「节首明写：若两者之间还有其他卷…」，与 §2.3 逐字渲染模板冲突；
   > 本期按 §2.3 的**逐字模板**落地（测试逐字比对快照），未追加第二句说明。
4. **卷被重写后交接单不失效**：删章、改章号都不自动更新区间。
5. **不校验 `source` 取值**：`author` / `generated` 只是标记，无 CHECK（期 2 起两种都会出现；
   判断「谁拥有这份记录」用代码里的 `isAuthorOwnedHandoff`，不靠库约束）。
6. **分区交换要保存两次**：面板「先删后写」能让「删 A 建 B」通过，但两卷区间**互换**会因中间态
   重叠被拒 —— 这是刻意的（不做跨行事务），页面上有固定提示。
7. **未验证真实效果**：本期没有跑真模型、没有 A/B。是否降低跨卷失真，要等实机观察。

---

## 8. 期 2 · 卷末自动生成（2026-10-24）

### 8.1 触发点：定稿链的**卷末章**，不是大纲的卷翻转点

计划稿原写「挂在 `architecture.command.ts:3374` 的卷翻转点」，**已推翻**。那条链跑的是**剧情大纲批次**（E3 单元游标），
那一刻生成的是章节标题，`grep handoff` 在该文件零命中 —— 正文与要点都还不存在。用它生成交接单，
产出的正是它本该防住的「跨卷只剩大纲文本」。

改到定稿链后时机天然正确，且能直接复用 `runPostProcessPipeline` 的 `retryCount` / `onlyFailed` /
`critical:false` 兜底，不碰架构命令的续跑与预算。

- **判定**：`volumeRangeEndingAt(volumes, chapterNumber)`（`src/shared/volume-structure.ts`）——
  有效末章 = `actual_last ?? planned_last`，与面板显示的区间是**同一个函数**。
- **探测 fail-open**：`resolveVolumeHandoffRange()` 任何异常都返回 `undefined`（不注册该步），
  **绝不因为卷结构读不到而让定稿失败**。只有 `state === 'stale'` 时打一行「卷结构已过期…」。
- **步骤位置**：`kb_import → chapter_notes → volume_handoff → character_cards`。
  放在角色卡之前，是因为 `stopOnFailure` 会中止后续步骤 —— 否则「角色卡失败」会把跨卷记忆一起带走。

### 8.2 生成输入：各章定稿要点，不读正文

`db:continuity-list-before(last + 1)` 一次取回区间内的投影，前端按 `>= first` 过滤，
只取 `chapterNotes`（`summary_snapshots`）。

- 输入预算 **20,000 字**；超了**整章丢最旧的**，但**末章必留**（卷末状态只能从末章读出）。
- 返回数组天然缺章 ⇒ 日志只报「要点 N/M 章」并列出缺哪几章，**不拿 `last - first + 1` 当分子谎报**。
- 本卷一条要点都没有 ⇒ **不生成、不算失败**（数据未就绪），日志指向「定稿章节剧情要点」。

### 8.3 三条不变量

1. **作者版永不自动覆盖**（硬）：定稿步骤与面板按钮调同一个 `isAuthorOwnedHandoff`；
   面板上作者版的「重新生成」直接禁用。
2. **零迁移 / 零新增 IPC**：读 `db:volumes-list` / `db:continuity-list-before` / `db:volume-handoffs-list`，
   写 `db:volume-handoffs-upsert`，四条都已存在且在写通道白名单里；schema 保持 20。
3. **单一字数口径**：`volumeHandoffBodyChars()` 直接复用 `renderVolumeHandoffSection(..., MAX_SAFE_INTEGER)`
   去掉前两行；生成侧不许另写计数器（单测断言两者逐字相等）。

### 8.4 裁剪与失败语义

| 情形 | 行为 |
|---|---|
| 数组超 5/5/3 | 按条数上限截断，记 `droppedByLimit`（不是失败） |
| 正文超 1500 字 | 按**注入顺序的反序**逐条整条丢（`openThread → debts → items → events → heroState → worldState`），记 `droppedByBudget`；**绝不截半句** |
| 丢到一件不剩 | `VOLUME_HANDOFF_GENERATION_OVER_BUDGET` ⇒ 失败，不写库 |
| 六项全空 | `VOLUME_HANDOFF_GENERATION_EMPTY` ⇒ 失败，**不写空壳**（空记录会占掉 `volume_id` UNIQUE 槽，并让注入侧渲染成空串） |
| 输出不可解析 | `..._UNREADABLE` ⇒ 失败，不写库（不用垃圾覆盖上一次的好数据） |
| 已有 `generated` | 覆盖重生成，带原 `handoffId`（保住 `created_at`） |
| `onlyFailed` 修复 | 该步已 `ok` ⇒ 跳过（已有初稿视为完成）；想重生成走面板 |

### 8.5 面板三态

「来源」列：**作者版**（实心徽标）/ **初稿**（描边徽标）/ 空行 `—`。
「重新生成」只在初稿与空行可用；作者版禁用并给出原因（需先删除该行）。
生成中按钮转圈 + 「生成中…」，同时禁用保存/新增/删除；**无百分比**（一次性调用）。
保存时 `source = 动过该行 || 新行 ? 'author' : 原值` —— 只把**动过的行**升格，
避免整页一存就把没碰过的初稿全冻死。

### 8.6 与计划稿的偏离

| 计划稿 | 实际 | 理由 |
|---|---|---|
| 触发点 = `architecture.command.ts:3374` | 定稿链卷末章 | 那里正文还没写（见 8.1） |
| 计划另写一份「体积/裁剪」规格 | 复用 `renderVolumeHandoffSection` 的既有五条口径 | 两套计数器是这类功能最常见的腐坏方式 |
| 计划写「幂等重建」 | 幂等 = 同一卷重复触发只会覆盖 `generated`，`author` 永不动 | 没有跨快照重建的需求，硬做要加列（M20） |
| 计划列一个 880 行级整合夹具 | 探测函数导出后单测 + 步骤单测 | 命令里只剩一行调用；风险点（判不出卷末章、作者版被覆盖、坏输出写库）已被 14 例覆盖 |

### 8.7 验收

- 单测 15 例（解析 / 裁剪 / 字数口径 / 输入预算 / 失败原因）+ 卷结构 4 例（末章判定）+ 步骤与探测 14 例
  + 面板 browser 6 例 + electron 仓储 2 例（`generated` 往返、`created_at` 不动）。
- 手工：卷 1 = 1–3、卷 2 = 4–6；定稿 1–2 章不触发；定稿第 3 章出现初稿；作者改后保存变作者版；
  重新定稿日志「不覆盖」且六项不变；删行重生成出新记录；定稿第 4 章正文链注入第 1 卷那份。
- **未验证**：真模型产出质量、30 章长卷的实际输入体积。

---

## 9. 期 2b · 开写闸门（2026-10-24）

### 9.1 为什么还需要这一层

期 2 解决了「有没有初稿」，没解决「有没有人看过它」。交接单是**派生品**：作者可能既没手填、
也没看自动生成的初稿，而模型从第 2 卷起只能靠它知道「谁还欠谁一条命」。所以要在**开写时**
停一次：进入新一卷第一章，如果上一卷的交接单**缺失**或**只有没人确认过的初稿**，就要求点头。

**频次**是这个设计成立的前提：一卷二十章以上，进卷头才问一次。一次打扰换一整个卷的跨卷一致性。

### 9.2 判定：三个状态，一个函数

`volumeHandoffGateOf`（`src/shared/volume-handoff-gate.ts`）：
「上一卷」= `volumeRangeEndingAt(volumes, chapterNumber - 1)` —— 与定稿链的卷末章触发、面板区间
展示**同一个函数**，三处不会各说各话。

| 状态 | 条件 | 动作 |
|---|---|---|
| `missing` | 上一卷没有交接单 | 拦 |
| `unreviewed-draft` | 只有 `source='generated'` 的初稿 | 拦 |
| `clear` | 作者版，或作者已显式确认过 | 放行 |
| `null`（不适用） | 这一章不是任何一卷的第一章 / 卷末章未定 | 完全不打扰 |

### 9.3 确认记在哪：复用 `consistency_exemptions`

零迁移：`stable_fact_key = volume-handoff:<volumeId>`，`reason` 写清是「已人工复查」还是
「采用本次生成的初稿」。撤销入口在**卷末交接面板**（「已确认的跨卷衔接」折叠区）——
撤销 = 下次进入该卷第一章重新提醒。

**为什么不新建表**：这是「我记得我看过了」的一次性判断，不是业务事实；`consistency_exemptions`
本来就是「稳定键 + 理由 + 可撤销」的三件套。代价是语义上借位——所以读取时**只认
`volume-handoff:` 前缀**，不碰别的豁免。

### 9.4 三个出口，没有「静默跳过」

| 出口 | 行为 |
|---|---|
| **生成初稿给我看** | 跑一次共享生成函数（与定稿链、面板同一个）→ 写 `source='generated'` → **展示摘要**（正文 N 字 / 要点几章）→ 由作者决定 |
| **已人工复查，继续** | 写确认 → 重新走一次开写流程（确认已落库，第二次自然放行） |
| **取消，我先去处理** | 什么都不写；下次进来还会问 |

**生成完不自动放行**：初稿没人看过就不算交接完成。所以生成成功后按钮变成
「就用这份，继续写」（= 确认）/「先去改一改」（= 取消）。

### 9.5 落点

- **单章开写**（`ChapterCreationDialog`）：在一致性预检**之前**判 —— 跨卷记忆比本章冲突更前置。
- **批量创作**（`BatchChapterCreationDialog`）：按批次第一章判。一次跑十章，出问题最难收。
- **fail-open**：读失败 / 老项目没有这几张表 ⇒ 不拦，并打一行「卷末交接检查本次未完成（…）」。
  这是提醒，不是数据校验，绝不能让作者写不了下一章。

### 9.6 已知限制

1. **确认按卷记**：`volume-handoff:<volumeId>`，同卷改大纲导致区间变化时确认仍然有效（不重新问）。
2. **不校验确认内容的时效**：作者确认后把交接单改成别的内容，也不会重新问。
3. **只在「开写」这一入口拦**：直接从别处（如批量任务恢复）进入的路径不经过这道闸。
4. **未验证**：作者对「每次进新卷都要点一次」的实际容忍度 —— 若嫌烦，可在确认里加「本卷不再提醒」的批量入口（目前一次一卷）。
