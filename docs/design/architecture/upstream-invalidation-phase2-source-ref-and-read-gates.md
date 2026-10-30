# 上游失效 · 期 2 实施设计：来源登记与读取侧拒绝

> 状态：已落地 · 2026-10-30 · 期 2 全部读取侧 + 三道闸（`fae95890` 写入侧 / `e704a697` 读取侧）；两处实施偏差见 §5.2 与 §5.3
> v2 变更：三路子 Agent 交叉审阅后重写（语义反例 / 影响面 / 迁移事务），修掉 6 个缺口、改判 3 处原裁定、否掉 1 条审阅意见并附证据。修订清单见 §一。
> 上级稿：[`upstream-version-and-derived-invalidation-design.md`](upstream-version-and-derived-invalidation-design.md)（§四 分版 · §五 来源 · §六 三档处置 · §九 落地顺序 · §八 强提醒）
> 审阅记录：`out/review-phase2/{semantic,blast-radius,migration}.md`（不入库，属本轮工作产物）
> 前置事实：期 1 已落地（`955efbf1`，M24 + 判定纯函数 + 两个写入点，零消费者改动）

---

## 一、v2 修订清单（按危害排序）

| # | v1 的说法 | 核出来的问题 | v2 怎么改 |
|---|---|---|---|
| R1 | 章集「取 `(have,need]` 并集」，空集自然等于「没改」 | **空集有两种相反语义**：`refCoversChapter:268` 约定「空 = 覆盖全部」，`mergeChangedChapters:243` 约定「空 = 什么都没改」。若按后者实现，**整本重生成后所有派生全判 valid** —— 全稿最危险的漏判 | §二 N1：**空集一律当「覆盖全部章」** |
| R2 | 判定只看 `have !== need` + 章集交集 | `derivedStatus` 的另一半契约是 `have > need` 也算脏（`upstream-revisions.ts:132-142`：备份恢复、上游清除后重建）。而 `(have,need]` 在 `have > need` 时是**空区间** ⇒ 交集空 ⇒ 判 valid，正好把那条契约废掉 | §二 N2：`have > need` **一律 drift，不看章集** |
| R3 | §4.3 写 `bump({..., mode:'merge'})` | `parseChangedChapters:69-76` 只认数组，读到对象返回 `[]` ⇒ 列格式改成 map 后**第一次 bump 就把历史抹平**；而 `mode:'merge'` 更是明确的反向指令 | §二 G2：写入只允许 `newRevOnly` / `replace`；`parse` 两代都认 |
| R4 | 交接单章集 = 「该卷区间展开」 | `VolumeRange.first/last` 都可以是 `null`（`volume-structure.ts:307`），`basis` 还可能是 `declared`/`even` 估算档 ⇒ 章集空 ⇒ 判 valid ⇒ **整卷重建悄无声息通过** | §四.1：只有 `basis==='actual'` 且两数是正整数才收窄，其余按「全书」 |
| R5 | §5.2「只加字段不改形状，调用点不用改」 | 物理上做不到：`db:blueprint-get-all` 返回**裸数组**（`db-controller.ts:602`）、`db:blueprint-get` 返回 `null` 或对象（`:607`）、`db:volume-handoffs-list` 返回 N 行（`:1689`）。且 validity 是**逐行**的，不是一个标量 | §五.2：显式承认改形状，逐条挂 `validity`，列出必须同步改的调用点 |
| R6 | 审查范围只到 §五.3 那 5 处 | 实际 **20+ 处**读蓝图，其中三处会把 stale 数据喂进生成：`chapter-workflow.ts:567`、`batch-chapter-workflow.ts:223`、`review-revision-context.ts:92`；另有 `finalize-chapter.command.ts:465` 拿上一卷交接单当承接 | §五.3 全表 + 分级（必须拦 / 提示 / 不动） |
| R7 | 手改蓝图 = 改上游，`upsert` 自己 bump | `commitRange:647` 内部在循环里调 `upsert:704`、`upsertMany:597` 循环调 `upsert:602` ⇒ 照字面实现**一次保存 bump N 次**；`db:blueprint-upsert` 还没事务 | §四.3：bump 提到循环外、一次；每行写同一 `newRev`；`upsert` 加内部 `bump:false`；外层包事务 |
| R8 | 三处写入点 | `character-roster-repository.ts:726`、`character-repository.ts:297` 用**裸 `UPDATE blueprints SET characters`**（角色改名 / 合并）改了进正文的内容，既不 bump 也不刷 `source_ref` ⇒ 内容变了版本不变，判 valid | §四.4 新增：这两处必须同事务 bump（章集 = 命中的章） |
| R9 | 剧情树「在 JSON 里加 `sourceRef`」 | `graph-generation-source.ts:34/44` 把快照串整体 sha256 当 `targetBaselineHash`、`graph-generation.ts:114` 逐字节比旧串 ⇒ JSON 一变，**正在跑的生成会被判来源变更** | §九：改为 `project_core` 新列 `plot_tree_source_ref`，**不动 JSON** |
| R10 | 剧情树「两判取严」 | 三种真实操作会让 hash 变而 rev 不变：改 `characters`/`suspense_hook`、**作者新增一条伏笔**、定稿后 `notes` 提取。取严 ⇒ 剧情树长期报过期，而「作者输入不该被上游废掉」正是 §八 的论断 | §九：rev 出徽标，hash 只做生成拦截，**不两判取严**，也不共用文案 |
| R11 | 未提「清除全部」 | `project-clear-repository` 里**一条 `upstream_revisions` 都没有**（grep 全库只有 bump 与仓储本身）。清空后 rev 继续从旧值涨、`changed_chapters` 历史残留旧章号；导入更早备份会让 rev 回退 ⇒ 按 R2 判 stale ⇒ **该包所有派生永久脏且不自愈** | §十一：清除创作字段时同事务 `DELETE FROM upstream_revisions` |
| R12 | §九 只说「补 `m25Fields` 与 `tables`」 | 审阅意见说「必须 bump `schemaVersion` 7→8，否则历史包导不回」——**核历史后否掉**：M06–M24 期间该常量一直是 7（`git log -S'PORTABLE_SOURCE_SCHEMA_VERSION = '` 只有建文件那一次），且 `portable-project-format.ts:284` 是**严格相等**，bump 反而会把所有现存包拒掉；真正 gate 历史包的是 `verifyProjectSqlite`（`project-restore-service.ts:549`，严格等于 CURRENT），与策略版本无关 | §十：**不 bump**；但把 `m25` 加进 `origin` 断言（M22 漏登记就是静默的） |
| R13 | 未提并发 | `bump` 是「读 rev → +1 → 写回」两步、无 CAS。同进程内 better-sqlite3 同步执行 ⇒ 天然无竞态（即便两个 BrowserWindow 也是同一主进程）；但**跨进程**（CLI 工坊脚本 / 迁移任务 / 第三方直接开库）无任何保险，而 `fenceProjectSession` 是**身份栅栏不是文件锁** | §四.5：`bump` 走 CAS（`WHERE rev = ?`）+ 重试一次，照 `commitSynopsis:254-285` 先例 |
| R14 | 未提读取侧成本 | 每个 handler 只取一次快照（一条 `SELECT *`，O(5) 行）；但若在「每行派生的循环里」各自调 `snapshot()`/`read()`/`readRev()`，每次都再探一次 `sqlite_master`、多一轮 IPC ⇒ `get-all` 的 N 倍放大；列探针亦然 | §五.6：三条钉子（一次快照 / 一条 SQL 批量 / 探针提到循环外） |

另有两条不改变方向、但必须写进代码的细节：

**其一（G6）**：`bump` 在表不存在时静默 `return 0`（`upstream-revision-repository.ts:117-123`，期 1 刻意如此：旁路账本不该阻断业务写入）。这个 0 **不能**和「新行 rev=0」混为一谈 —— 后者是合法值（`ensure` 刚建行、还没改过），写进 `source_ref` 后 `have === need === 0` 判 valid，正确；而前者代表「这张库还没有版本账」，写进去会把"库未升级"伪装成"上游变过"。两者在返回值上无法区分，必须拆开（§三 G6）。

**其二**：`db:volume-handoffs-before` 在表缺失时返回 `{success:true, entry:null}`（`:1709`），「表都没有」必须能与「这卷没有前置」区分（§五.2）。

---

## 二、四条判定不变量（先定，否则实现怎么选都是错的）

这四条不是风格问题，每条都对应一个会静默出错的形态。

**N1 · 空章集 = 覆盖全部章。** 章集求不出来时（`replace` 之后的空、`null` 区间、格式坏掉），交集为空 ⇒ 若不特判就判 valid。`refCoversChapter:268` 已经是这个语义，新判定必须沿用：**空集不是「什么都没改」，而是「什么都没说清，按全改算」**。

**N2 · `have > need` 一律 drift。** 区间 `(have, need]` 在 `have > need` 时为空，不能据空集判有效。两种情况真实存在：备份恢复到更早版本（`upstream_revisions` 是 D 类，整行覆盖）、上游「清除后重建」（见 R11）。`derivedStatus:132-142` 已经把这条写死为「`!==` 而不是 `<`」，新函数不得退化。

**N3 · 缺键 = 覆盖全部章。** `changes` 里没有该键（从未 bump / 行被删），或 `current` 里没有该键（`need = 0`）⇒ 按「全改」判，与 `derivedStatus:161` 的 `need=0 ⇒ stale` 同向。**不得**按「没记录 ⇒ 没改动 ⇒ valid」。

**N4 · 非 `outline` 域恒视为覆盖全部章。** `worldbuilding` / `arc` 是全书一份，改了就是全改（`refCoversChapter:267` 已是此语义）。新函数里这条要显式保留，不能因为 `changes` 里记的是空数组就放过。

签名（v1 只给了伪代码，这里是唯一版本）：

```ts
type UpstreamChangeLog = ReadonlyMap<UpstreamRefKey, ReadonlyMap<number /* rev */, readonly number[]>>

derivedStatusForChapters(
  sourceRef: DerivedSourceRef,
  current: UpstreamRevisionSnapshot,
  changes: UpstreamChangeLog,
  chapters: readonly number[] | null,   // null = 全书；[] = 求不出 ⇒ 按全书
): DerivedValidity
```

逐键：`need = current.get(key) ?? 0`；

- `have === need` ⇒ 该键通过；
- `have > need` ⇒ 记 drift（N2）；
- `have < need` ⇒ 取 `(have, need]` 各 rev 章集的并集 `changed`；`changed` 为空 ⇒ 视为全部章（N1）；非 `outline` 域 ⇒ 视为全部章（N4）；最后 `changed ∩ chapters ≠ ∅` 才记 drift（`chapters` 为 `null` 或 `[]` ⇒ 视为全部章）。

---

## 三、六个前置缺口

期 1 交付的是「能记」，「能判」这一半在代码里还缺零件。不先补就接线，会做出**假判定** —— 比不判更糟，因为它给作者一个错误的确信。

### G1 按章收窄在判定侧没有入口

`refCoversChapter()`（`src/shared/upstream-revisions.ts:260`）**零调用**（全库只有自己的测试），`derivedStatus()` 只比 `have !== need`，完全不看 `changed_chapters`。直接接上会退化成「改一章、整批 10 章全判脏」，正是主稿 §4.1 要避免的噪声。

### G2 写入侧：`merge` 必须废掉，格式迁移必须重写 parse

`parseChangedChapters:69-76` 只认 `number[]`，读到对象 `return []`；`bump:129-146` 再 `mergeChangedChapters([], incoming)` 写回**裸数组**。所以：

- 只改列格式不改 `parse`/`bump` ⇒ **第一次 bump 就把历史抹平**，列退化回数组；判定按「裸数组 = 所有 rev」处理 ⇒ 全面 stale，**包括刚手改那一行**（G3 要根治的方向反过来）。
- v1 §4.3 写的 `mode:'merge'` 是反向指令。方案 B 下唯一正确的落法是「**新 rev 那个键 = 本次章集**，不与任何旧键取并集」。

```
changedChaptersMode = 'newRevOnly'（默认）：changed_chapters[newRev] = 本次章集
                    | 'replace'（整本重生成 / 恢复稿整段替换）：整列写成 {}
```

`mergeChangedChapters()` 从此**只服务旧格式读兼容**，不再参与写入。

### G3 累积并集会把「刚手改完的行」判脏

```
生成            rev1  {}
手改 31         rev2  {"2":[31]}    行31.source=2
手改 33         rev3  {"2":[31],"3":[33]}  行33.source=3
判行31：have=2,need=3, (2,3]={33} ∩ {31} = ∅ ⇒ valid ✔
（若章集是累积并集 [31,33] ⇒ stale ⇒ 拒绝作者刚改完的卡 ✘）
```

这正是 v1 选方案 B（rev→章集）的理由；但**只有 G2 也改了才成立**，两者是一组。

### G4 `snapshot()` 不接受 `database` 参数

`read`/`readRev`/`list`/`snapshot`/`snapshotWithOverride` 全走 `getProjectDb()`，而 `bump` 接受 `database`。写入侧都传库（`ProjectCoreRepository.update(data, db)`、`BlueprintRepository.upsert(data, db)`、`upsertVolumeHandoff(db)`），读取侧却拿默认库 ⇒ 测试夹具 / 多库场景「内容写 A 库、版本读 B 库」，比不记更糟（该文件 `requireDb` 注释已写同样顾虑）。补可选 `database` 参数。

### G5 清除全部不清版本表 ⇒ 永久脏且不自愈

见 R11。清除创作字段的同一事务里要 `DELETE FROM upstream_revisions`（表存在时），并把 `plot_tree_source_ref` 置空。语义：**版本账随被描述的世界一起归零**，不跨清除保留。

### G6 `bump` 的返回值必须能区分「表没有」与「第 0 版」

期 1 的 `bump` 遇表不存在静默 `return 0`（`:117-123`），`ensure` 新建行时也 `return 0`（`:163`）。期 2 之后调用方要拿返回值写 `source_ref`，**两者混在一起就出事**：

| 情形 | 返回 | 写进 `source_ref` 的后果 |
|---|---|---|
| 新行 rev=0（刚 `ensure`、还没改过） | `0` | `have === need === 0` ⇒ valid ✔ 正确 |
| 表不存在（库未升到 v26） | `0` | 派生带着 `{outline:0}`，版本表里没有该行 ⇒ 按 N3 判 stale，或按 `have===need` 判 valid —— **两个方向都是假的** |

⇒ 约定：表不存在时返回 **`null`**（不是 0），调用方拿 `null` 就**不写** `source_ref`（留空 = legacy，与老库行为一致）；`0` 只在「行确实存在且是第 0 版」时出现。

配套：照 `hasStructuredRefsColumn`（`blueprint-repository.ts:526`）加 `hasSourceRefColumn` 探针 —— 列不在时**不写列、不报错**。理由不是"容忍漏迁移"，而是：① 既有测试大量直接用 baseline-only 库，写未迁移的列会 `no such column`，一波红掩盖真信号；② 未迁移的老库此时也没有版本行，本来就走 legacy。**「漏迁移」这个真风险由 M25 的 `verify` + 一条「迁移后列存在」的用例兜住**，不靠运行时静默降级兜。

---

## 四、写入侧

### 4.1 `source_ref` 的键与章集

键一律由 `upstreamRefKey()` 拼（全库唯一来源）。

| 派生 | `source_ref` | 收窄用的章集 |
|---|---|---|
| `volume_handoffs` | `{worldbuilding:book, arc:book, outline:book}` | 卷区间展开，**且仅当 `basis==='actual'` 且 `first`/`last` 都是正整数**；否则 `[]`（= 全书，R4） |
| `blueprints(N)` | 同上 | `[N]` |
| `project_core.plot_tree_source_ref` | 同上 | `null`（全书） |

### 4.2 三处列写入

| # | 位置 | 时机 |
|---|---|---|
| 1 | `electron/repositories/volume-handoff-repository.ts:149` `upsertVolumeHandoff` | 落库时取当前快照填入；**用同一个 `db`**（G4）；该函数目前是裸 SQL、**无事务**，需要自己包一层（G7 见 4.3） |
| 2 | `electron/repositories/blueprint-repository.ts` 的 `upsert` | 见 4.3（bump 由调用方或自身按开关决定） |
| 3 | `electron/repositories/plot-tree-repository.ts` 的快照保存处 | 写 `plot_tree_source_ref` 列，**不动 JSON**（R9） |

### 4.3 手改蓝图 = 改上游：三条通道，一次 bump

`sourceRef` **不放进 `BlueprintData`**。理由是三个字节基准：`commitPayloadHash:255` 对 `request.blueprints` 做 sha256、`samePersistedBlueprint:484` 逐字段回读比对、`character_sync_input:719` 冻结整批蓝图（`:516` 注释明写稀疏字段就是为了不改这些基准）。把来源塞进数据对象会同时改掉三个基准 —— 幂等重放与冻结事实都会漂。

⇒ 来源列由**仓储内部**写：`upsert(data, db, options?: { sourceRev?: number })`，`sourceRev === undefined` 时保持旧值（不覆盖已有来源）。

三条通道的 bump 位置：

| 通道 | 谁 bump | 章集 | 备注 |
|---|---|---|---|
| `db:blueprint-upsert`（单章卡保存，`db-controller.ts:612`） | handler 内 | `[N]` | handler 目前**无事务**，要 `db.transaction(...)` 包住「bump + 写行」 |
| `db:blueprint-upsert-many`（`ChapterCardEditor.saveAllBlueprints` → `upsertMany:597`） | `upsertMany` 开头一次 | 整段章号 | 循环内调 `upsert` 必须 `bump:false`，否则一次保存 bump N 次 |
| `db:blueprint-commit-range` → `commitRange:647` | `commitRange` 事务内一次 | 本批章号 | **两条语义共用这根管道**：模型整批（`:644`）与作者恢复 `authorRecovery`（`:639` → `main-generation-owner.ts:816/821`）。幂等重放分支（`:663-693`）已存在操作时直接返回、不写行 ⇒ **那次不 bump**（对） |

每行都要把 `source_ref.outline` 写成**这次的新 rev**，不是只有第一行：只写第一行会让其余 9 行判 `(旧,新]` ∩ 本行 ≠ ∅ ⇒ stale ⇒ 刚保存的卡立刻被拒绝（G3 同型）。

### 4.4 两条绕过 `upsert` 的裸 UPDATE（v1 完全没提）

`character-roster-repository.ts:726`（角色改名批量重写）与 `character-repository.ts:297`（角色合并 / 删除）直接 `UPDATE blueprints SET characters`。这些列**进正文**，内容变了但既不 bump 也不刷 `source_ref` ⇒ 派生仍判 valid（漏判，危险侧）。

⇒ 两处都要在同一事务里 `bump({domain:'outline', changedChapters: 命中章号})`，并把被改行的 `source_ref` 提到新 rev。这是「改上游」的第三条手改通道，v1 漏了。

### 4.5 并发：同进程无竞态，跨进程要 CAS

`bump` 是「读 rev → +1 → 写回」两步（`:125-146`），没有 CAS。要不要补，取决于有没有并发写：

| 场景 | 会不会撞 | 依据 |
|---|---|---|
| 两个 BrowserWindow 同时改 | **不会** | 同一个主进程、better-sqlite3 同步 API、JS 单线程 ⇒ 整个 bump 在同一 tick 内完成，中间插不进另一次调用 |
| 生成任务与手改同时进行 | **不会** | 同上，读路径也不在别的线程 |
| CLI 工坊脚本 / 迁移任务 / 第三方直接开库 | **会** | 跨进程。`fenceProjectSession` 是**身份栅栏**（防切项目后复用旧句柄），不是文件锁；WAL 只保证页级一致，不保证「读-改-写」原子 |

⇒ `bump` 改 CAS：`UPDATE upstream_revisions SET rev = rev + 1, … WHERE domain = ? AND scope = ? AND rev = ?`；`changes === 0` 且行存在 ⇒ 重读一次重试（**上限 1 次**）；仍失败就返回 `null`（放弃记版本，**不阻断业务写入** —— 与期 1「旁路账本不该成为失败点」同一纪律）。形状照 `commitSynopsis:254-285` 的 CAS 先例。

不加文件锁：本仓没有锁的先例，加锁要处理死锁与陈旧锁，而收益只是第三方并发写同一库这种边缘场景。

---

## 五、读取侧：判定在主进程，逐行挂结果

### 5.1 为什么在主进程

`upstream_revisions` 只有主进程能读。让渲染侧再拉一次版本表自己算，就有了第二份判定语义；IPC 边界是所有消费者必经之处（正文链、面板、agent 工具都走它）。

### 5.2 三个 handler 的**形状变更**（v1 说"不用改"，是错的）

| 通道 | 现在 | v2 |
|---|---|---|
| `db:blueprint-get-all`（`:602`） | 返回裸数组 `BlueprintData[]` | `{ entries: Array<BlueprintData & { validity: DerivedValidity }> }` |
| `db:blueprint-get`（`:607`） | `BlueprintData \| null` | `{ entry: (BlueprintData & { validity }) \| null, missing: boolean }`（`missing` 区分「表没有」与「这一章没有」） |
| `db:volume-handoffs-list`（`:1689`） | `{ success, entries: N 行 }` | 每条 entry 挂 `validity`（**逐行**，不是响应级标量） |
| `db:volume-handoffs-before`（`:1701`） | `{ success, entry }`，表缺失时也是 `{success:true, entry:null}`（`:1709`） | `{ success, entry, missing, validity }` |

必须同步改的调用点（因为形状变了）：`DraftEditor.tsx:108`、`VersionHistory.tsx:43`、`NarrativeThreadEditor.tsx:355`、`DirectoryConfigDialog.tsx:70`、`ConfigImpactPreview.tsx:163`、`architecture-service.ts:128`、`workflow-guards.ts:193/275`、`list-chapters.tool.ts:24`、`read-blueprint.tool.ts:34/47`、`read-project-state.tool.ts:83`、`version-service.ts:34`、`DraftBoxGroup.tsx:129`、`ManuscriptGroup.tsx:65`、`DomainProposalDiff.tsx:82`、`propose-chapter-blueprint.tool.ts:109`。

> **⚠️ 实施偏差（2026-10-30，落地时改判）**：上表「包一层 `{ entries }` / `{ entry, missing }`」**没有做**，实际做法是**保持原形状、往每条 entry 上挂 `validity` 字段**：
>
> | 通道 | 实际返回 |
> |---|---|
> | `db:blueprint-get-all`（`db-controller.ts:613`） | `Array<BlueprintData & { validity }>`（仍是裸数组） |
> | `db:blueprint-get`（`:624`） | `(BlueprintData & { validity }) \| null`（**没有 `missing`**） |
> | `db:volume-handoffs-list`（`:1725`） | `{ success, entries: 每条挂 validity }` —— 与 v2 一致 |
> | `db:volume-handoffs-before`（`:1719` 附近） | `{ success, entry, missing, validity }` —— 与 v2 一致 |
>
> **为什么改判**：包一层会让上表 15 个调用点全部要改，其中 12 个是「只取章号/标题/统计」的 C 类，改成 `res.entries.map(...)` 纯属噪声；而 `missing` 对 blueprint 是多余的 —— `BlueprintRepository.getByChapter` 走的是仓储层已建好的表，表缺失由 `getProjectDb()` 返回 `null` 那一步就分开了，不存在「表没有 vs 这一章没有」的二义。**交接单那条保住了 `missing`，因为表本身可能没建（M18 之前），那是真的二义。**
>
> ⇒ 结论：**「形状必须变」这条 v1→v2 的判断只对交接单成立**；蓝图两个通道用「加字段」既达成目的（消费者能判 stale）又不制造 12 处无意义改动。`read-blueprint.tool.ts` 那一处也照样能拦（`:42/:63` 读的就是 `validity`，与包不包一层无关）。

> **一处口径要写清**：A 类里 `read-blueprint.tool.ts` 落地成**「必看提醒」而非硬拒**（`bp.validity?.state === 'stale'` ⇒ 在返回正文前插一段 ⚠️ + `describeDrift(behind)`）。理由是 agent 工具若直接抛错，模型连"哪张卡过期了、上游改了什么"都拿不到，只能空转重试；而把提醒拼进它读到的正文里，模型**想忽略也忽略不掉**。其余五处（`generate-draft` / `chapter-workflow` / `batch-chapter-workflow` / `review-revision-context` / `finalize-chapter`）都是硬拒。

### 5.3 消费点全表（分三级）

**A · 必须拦（stale ⇒ 拒绝并指路）**

| 位置 | 为什么 |
|---|---|
| `generate-draft.command.ts:2663` `readVolumeHandoff` | 交接单进每一次正文请求 |
| `chapter-workflow.ts:567` / `batch-chapter-workflow.ts:223` | 蓝图是写正文的**主干道**（批量通道是旁路，漏了等于没拦） |
| `review-revision-context.ts:92` | 前 5 章蓝图喂给审稿，结论会建立在过期蓝图上 |
| `finalize-chapter.command.ts:465` | 卷末用上一卷交接单做承接（v1 漏了，它比 §5.3 原列的任何一处都靠前） |
| `read-blueprint.tool.ts:34/47`（agent 工具） | §5.1 说「agent 工具全走 IPC 漏不掉」——但只在 handler 挂字段、工具不读字段，等于没拦 |

**B · 提示不阻断**

`outline-prefix-context.ts:53`（stale ⇒ 不注入 + warning）、`volume-handoff-gate.ts:36`（stale ⇒ 判"需处置"，不是"已复查"）、~~`workflow-guards.ts:193/275`（开写前置已有位置）~~（**已裁定不做，见下**）、`NarrativeThreadEditor.tsx:355`（伏笔回收点依赖蓝图区间）、`VolumeHandoffRegistryPanel.tsx:238`、`ChapterCardEditor` / `DraftEditor`（编辑它就是在更新它）。

> **⚠️ `workflow-guards.ts:193/275` 撤回（2026-10-30 裁定，本表的写法过宽）**：
> 这两处**只读 `blueprints.length`**，不读任何一张卡的内容 —— `:194` 是「`length === 0` ⇒ 还没生成过蓝图，拦开写」，`:278` 是「`length > 0` ⇒ 已有蓝图，不许重生成角色卡」。**它们问的是"有没有"，不是"新不新"**。
> 在这里挂 stale 会产生一个错语义：手里有一张过期卡时，「能不能开始写」的答案依然是**能**（作者可能就是要先在旧卡上写、再回头修上游）；反过来 `length > 0` 那条要是被 stale 影响，会出现「卡都过期了所以允许重生成角色卡」——那是把闸门开反了方向。
> 而且这两处一旦要求 stale 提示，就得把上千条 `validity` 在 guard 里再判一遍，而它们连一条都不展示。
> ⇒ **本表删掉这两项**。真正该有提示的是**展示卡内容**的地方（`NarrativeThreadEditor` 回收点、面板徽标、`ChapterCardEditor`），那些都已落地。

**C · 不动**

只取章号/标题/统计的：`DraftBoxGroup.tsx:129`、`ManuscriptGroup.tsx:65`、`list-chapters.tool.ts:24`、`version-service.ts:34`、`VersionHistory.tsx:43`、`BatchChapterCreationDialog.tsx:195`（展示）、`architecture-service.ts:128`。

### 5.4 早退分支必须排在判定之后

三处 `success === false` 的早退发生在判定**之前**，`stale` 永远走不到：

- `outline-prefix-context.ts:58`：`handoffResult?.success ? entries : []` —— 失败静默成空表；`:74-76` 整块 catch 只返回 `warning` 字符串，不参与"要不要注入"。
- `volume-handoff-gate.ts:39-41`：任一失败 ⇒ `{gate:null}`，而 `gate:null` 的语义是**不适用**，不是"需处置"（`shared/volume-handoff-gate.ts:48`）。
- `generate-draft.command.ts:2672`：`result?.success ? result.entry ?? null : null` —— **`success:false` 被折成 `null`**，与"这卷没有前置"不可区分。

⇒ 改成显式三态：`{ ok: true, entry, validity }` / `{ ok: false, missing: true }`（没读到）/ `{ ok: false, error }`。

### 5.5 「抛错不静默」的边界（不写清一定退回 fail-open）

> 读失败（IO、缺表、异常）**仍然 fail-open** —— 项目既有纪律，闸门不该因为读不到而拦住写作。
> 但「成功读到一条**已知过期**的交接单/蓝图」不是读失败，它是**成功判定了它过期**，必须拒绝。
> 两者的区别就是 `ok` / `missing`（没读到）与 `validity.state==='stale'`（读到了但旧了），不许再用 `?? null` 把两者压成一个。

### 5.6 成本：一次快照，别在循环里读

`get-all` 可能返回上千行，判定要逐行做，所以三条钉子：

1. **一个 handler 只取一次快照**：`snapshot()` 是一条 `SELECT * FROM upstream_revisions`（行数 = 域数，≤5）。**禁止**在逐行循环里调 `snapshot()` / `read()` / `readRev()` —— 每个都再探一次 `sqlite_master`，N 行就是 N 次系统目录查询。
2. **`changes` 一条 SQL 取完**：`WHERE domain IN (…)`，不是每键一次。
3. **列探针提到循环外**：`hasSourceRefColumn` 在 `upsertMany(10)` / `commitRange(N)` 里只探一次；每次 `upsert` 探一次 `PRAGMA table_info` 是纯浪费（写入侧真正的放大点在这里，不在判定）。

判定本身是纯内存 Map 比较，1000 章 × 4 键 ≈ 4000 次查表，无感。真实成本是 **IPC payload 变大**（每行多一个 `validity` 对象，`get-all` 返回体积约涨 5–10%）—— 可以接受，但不要在 `validity` 里塞明细数组。

---

## 六、`outline` 作用域：期 2 维持 `book`

主稿 §4.1 写 `outline:<unitId>`，但核代码后：

- 期 1 实际写的键是 `outline:book`（`commitSynopsis` 只拿得到 `authorRecovery.committedRange`，没有 unitId）；
- 唯一能拿到 unitId 的是 E3 的 `ArchitectureUnitRange`（**生成请求参数，不落库**）；
- `volume_units.unit_id` 来自大纲标题解析，与 E3 的 unit id **不是同一套**（无映射表）。

⇒ 期 2 不切单元级，分区对齐的收益靠 `rev→章集 + 按章收窄` 拿到。将来切的条件：E3 落盘时 `ensure('outline', unitId)`；届时 `outline:book` 与 `outline:u07` 并存会**双重判脏**，切换必须一次性重写所有派生的 `source_ref`，是一个专门的迁移窗口，不能顺手做。

---

## 七、剧情树：rev 出徽标，hash 只拦生成（改判 R9/R10）

`plot_tree_snapshot.sourceRevision`（`plot-tree-repository.ts:20`）是对**来源输入的 sha256**：`writingLanguage` + `synopsis` + `blueprints` 的 `chapterNumber/title/purpose/keyEvents` + 已定稿章的 `title`/`summary`（summary 兜到 `blueprints.notes`）+ `narrativeThreads`。

三种真实操作会让它变而 rev 不变：

| 操作 | hash | rev | 若「两判取严」会怎样 |
|---|---|---|---|
| 改 `characters` / `suspense_hook` / `user_guidance` | 不变（投影不含） | 变 | 反向：rev 说脏、hash 说没变 |
| **作者新增一条伏笔计划** | 变 | 不变 | 剧情树被判过期 —— 与 §八「作者输入本身就是上游」直接冲突 |
| 定稿后 `notes` 被后处理提取（每章都发生） | 变 | 不变 | 剧情树**长期**报过期，而没有任何上游变动 |

⇒ 分工，不共用文案：

- `rev`（新列 `plot_tree_source_ref`）⇒ **唯一**的徽标来源，走 `derivedStatus`；
- `sourceRevision`（hash）⇒ 只用于 `assertPlotTreeSnapshot`（`src/shared/plot-tree.ts:376`）拦生成产物，以及视图里的"内容级更严检查"，**不进徽标、不参与 stale 判定**。

**不进 JSON**（R9）：`graph-generation-source.ts:34/44` 把快照串整体当 `targetBaselineHash`、`graph-generation.ts:114` 逐字节比旧串 —— 往 JSON 里加字段会让正在跑的生成被判来源变更。改列零影响。

---

## 八、`narrative_thread_plans` 不进本机制（维持 v1 结论）

该表四列全是**作者意图**（title / type / 目标章区间 / author_intent），没有一列由模型从大纲派生。给它记 `source_ref` ⇒ 大纲一改，作者亲手写的伏笔计划被判「过期、拒绝使用」，与 B 档定义（「含模型产出**或作者输入**」）恰好相反 —— 作者输入不该被上游变更废掉，**它本身就是上游**。

⇒ 只进期 3 的 plan 清单（「这 3 条伏笔的回收点落在被改的批次里」），不进版本表。连带修正主稿 §8.2 第 4 组措辞：从「将判 stale」改成「回收点可能落进改动范围」。

---

## 九、迁移 M25（v25 → v26）

### 9.1 三条列

```sql
ALTER TABLE volume_handoffs ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''
ALTER TABLE blueprints      ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''
ALTER TABLE project_core    ADD COLUMN plot_tree_source_ref TEXT NOT NULL DEFAULT ''
```

- 默认空串不用 `NULL`：空串 = legacy，`NULL` 会让「没记过」与「记成空」变成两态。
- 不回填：存量行留空、判 legacy（§十.4 已于本轮裁定：**只提示一次不阻断**）。
- 幂等 + 校验四条：三列都在、`notnull=1`、`dflt_value=''`、`user_version` 由 runner 管。
- `ALTER` **不加 `IF NOT EXISTS` 式守卫**：列缺失必须是迁移失败，不是静默跳过。

### 9.2 加一版迁移要动的 10 处（缺一处要么开不了项目，要么静默不迁移）

| # | 位置 | 内容 |
|---|---|---|
| 1 | `electron/migrations/registry.ts:29` 附近 | lane 里加 `Object.freeze({ id:'M25', from:25, to:26, owner:'P2-2' })` |
| 2 | `registry.ts:32` | `LATEST_SCHEMA_VERSION` 25 → 26 |
| 3 | 新文件 `electron/migrations/m25-derived-source-ref.ts` | 照 `m23-deletion-keep-draft.ts` 三段式：apply 幂等 / verify 四断言 / createM25Migration |
| 4 | `electron/migrations/desktop-registry.ts:27` | import |
| 5 | `desktop-registry.ts:34` | `CURRENT_DESKTOP_SCHEMA_VERSION` 25 → 26 |
| 6 | `desktop-registry.ts:185-189` | `for (const db of references) db.transaction(() => applyM25…(db))()` + `const sourceRefSchemas = schemas(26)` + `createM25Migration({…})` |
| 7 | `desktop-registry.ts:190` | implementations 数组尾加 `m25` |
| 8 | `desktop-registry.ts:207` | recognizedSchemas 尾加 `...sourceRefSchemas` |
| 9 | `portable-project-field-policy.json` | `m25Fields: [...]` + `tables` 里两表各加 `source_ref: "D"`、`project_core` 加 `plot_tree_source_ref: "D"` |
| 10 | `portable-project-format.ts:57` 附近 | `m25Fields` 集合同步（`origin` 联合类型补 `'m25-delta'`） |

**第 5 处漏了最危险**：`runner.ts:60` 按 `step.to <= target` 过滤，M25 会被滤掉，`verifySchema(…,25)` 落到 M24 的 verify 照样通过 ⇒ **启动正常、列永不创建**，写入侧探针一挡就永久 legacy（无任何报错）。其余漏法都是启动期硬失败（`INVALID_MIGRATION_REGISTRATION` / `TARGET_SCHEMA_NOT_REGISTERED` / `MIGRATION_NOT_INSTALLED`），会响。

---

## 十、便携与字段策略

- 三列均 **D**。**不能 X**：清了等于把导入项目退回"什么都不知道"。
- **不 bump `schemaVersion`**（R12）。三重证据：① `git log -S'PORTABLE_SOURCE_SCHEMA_VERSION = '` 只有建文件那一次，M06–M24 期间一直是 7；② `portable-project-format.ts:284` 是严格相等，bump 7→8 会把所有现存包拒在门外；③ 真正 gate 历史包的是 `verifyProjectSqlite`（`project-restore-service.ts:549`，要求严格等于 CURRENT），与策略文档版本无关。审阅意见「必须 bump，否则历史包导不回」已否掉 —— 历史包导不回的原因是**库版本落后**，那是每次加迁移都会发生的事，不是策略版本的职责。
- 但 `origin` 断言要加：`portable-project-format.test.ts:134` 现在只断言 `added` 总长 267，**不分来源** —— M22 漏登记就是在这里静默的。加一段 `origin === 'm25-delta'` 的精确列表断言（照 `:170-175` M21 的写法）。
- 数字：表 65 不变；字段 622 → **625**；`added` 267 → **270**。断言在 `portable-project-format.test.ts:89/90/134/233` 四处。

---

## 十一、清除全部 / 备份恢复（v1 完全没提，R11）

`project-clear-repository` 里没有任何 `upstream_revisions` 处理（grep 全库只有 `project-core-repository.ts:247/294` 的 bump 与仓储自身）。后果三级：

1. **rev 单调不归零**：清空后重建从旧 rev 继续 +1 无害（派生也被清了），但 `changed_chapters` 历史不会被清 ⇒ 第一次 bump 的 `(have,need]` 里混着清除前的章号（那些章已不存在）⇒ 按章收窄永远认为"这些章变过" ⇒ 噪声永久累积。
2. **期 3 plan 的口径错**：刚清空的项目会报"有 N 版历史、若干章被改过"，与作者认知相反。
3. **导入更早备份 ⇒ 永久脏**：`upstream_revisions` 是 D 类，整行覆盖 ⇒ rev 回退 ⇒ 按 N2 全部判 stale ⇒ 该包内所有派生永久脏，除非整本再生成一次。

⇒ 清除创作字段的分支里（`project-clear-repository.ts:158-179`，与 `plot_tree_snapshot=''` 同事务）：`DELETE FROM upstream_revisions`（表存在时）+ `plot_tree_source_ref=''`。语义：**版本账随被描述的世界一起归零**。

备份恢复路径不动：rev 回退由 N2 兜住（判 stale 而不是 valid），这已经是保守方向。

---

## 十二、验收

| 项 | 判据 |
|---|---|
| 类型 | `tsc --noEmit` 0 |
| 迁移 | `migrations` 新增 M25 例：幂等 / 四断言 / 旧库升级后三列默认 `''` / **迁移后列存在**（兜 G6） |
| 判定 | `derivedStatusForChapters` 覆盖 N1–N4 各一条反例；G3 两个序列（**刚手改那行必须 valid**） |
| 写入 | `upsertMany(10 行)` 后 `snapshot()` 只涨 **1**，且 10 行全 `valid`；`commitRange` 同理；幂等重放**不涨** |
| 并发 | `bump` 的 CAS 用 `rev` 不匹配的桩注入一次：应当重试一次后成功；连撞两次返回 `null` 且**不抛** |
| 放大 | `upsertMany(10)` 期间 `PRAGMA table_info` 只被探 **1** 次（探针在循环外） |
| 读取 | 正文链遇 stale 抛错；**`success:false` 仍返回 ok:false 而不抛**；三处早退分支各一条用例，防将来把 `?? null` 加回来 |
| 剧情树 | 新增伏笔 / `notes` 提取后，`validity` 仍 `valid`（R10 的回归），hash 变但徽标不变 |
| 清除 | 清除创作字段后 `upstream_revisions` 为空；重建后首次 bump 的 `changed_chapters` 不含清除前的章号 |
| 既有 | `src/services src/shared` 基线 3795 / 7 failed / 3 套件；全量跑测带 `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID` |
| 文档 | `node scripts/check-doc-links.mjs` 0 断 |

### 十二·1 落地记录（2026-10-30）

| 项 | 落在哪 |
|---|---|
| 迁移 M25（4 例） | `electron/migrations/__tests__/m25-installed-lane.test.ts` |
| 写入侧（10 例） | `electron/repositories/__tests__/upstream-source-ref-writes.test.ts` —— 含「10 章只涨 1 版」「探针在循环外」「改角色名 = 改上游」「清除后重建的章集不含旧章号」 |
| 并发 CAS（2 例） | 同上「bump 的 CAS」：代理 db 在 `prepare` 时先跑一次竞争写入 ⇒ 判定条件与真实撞车一致（`changes === 0`），撞一次重试成功、连撞两次返回 `null` 且不抛 |
| 判定（17 例） | `electron/services/__tests__/derived-validity.test.ts` —— 含「交接单区间只在 `basis==='actual'` 时才敢收窄」 |
| 读取三态（9 例） | `electron/controllers/__tests__/db-controller-derived-validity.test.ts` —— **真库集成**，只 mock 进程边界。钉的是「库没开 / 没有前置 / 抛了 / 过期」四态不许折回同一个 `null` |
| 剧情树 R10（2 例） | 同写入侧文件（重新生成后徽标回到 valid，JSON 变了不算过期）+ 控制器文件（判定挂外层，快照串一字节不动） |
| 闸门 / 提示 / 三条 B 类 | `src/shared/__tests__/volume-handoff-gate.test.ts`（11）· `src/services/__tests__/outline-prefix-context.test.ts`（4）· `electron/services/__tests__/review-revision-context.test.ts`（21） |

**两条被 A/B 排除的"假回归"（勿当成本期问题）**：

- `electron/services/__tests__/project-peek-readonly.test.ts` 9 例 —— 既有红（`docs/handoffs/2026-10-25-next-steps-handoff.md:135` 已登记 8 例，第 9 例随 schema 版本涨到 26 也翻红；夹具只迁到 v7）。
- `project-restore-service` / `project-archive-service` 的 `ENOTEMPTY` —— `afterEach` 里 `fs.rmSync` 撞上未释放的 sqlite 句柄，**断言本身全过**（单跑 29/29）。

**剧情树读取契约已改**：`db:plot-tree-read` 返回 `PlotTreeReadBundle`（`PlotTreeSourceBundle` + 外层 `validity`）。**不进 `snapshot`** —— 理由同 R9。全库只有 `NarrativeThreadEditor.tsx` 一个消费者，改造成本为零。

---

## 十三、期 3 接口草案（只钉接口）

```
computeInvalidationPlan(domain, scope, 假想 rev) → {
  groups : Array<{ kind:'finalized'|'handoff'|'blueprint'|'thread'|'plot-tree', count, detail }>
  unseen : number        // legacy 项，单独一行「无法判断」，参与分档
  tier   : 'silent' | 'once' | 'strong'    // 含不可逆 ⇒ strong（主稿 §8.3）
}
```

- 纯读：`snapshotWithOverride` 已在期 1 备好（`upstream-revision-repository.ts:213`），**① 阶段绝不许 bump**（主稿 §8.1）；
- IPC `db:invalidation-plan`；UI 挂点 `src/components/editor/ArchFileViewer.tsx:812`（`createArchitectureWorkflow` 之前）；
- 依赖期 2：没有 `source_ref` 时 plan 只能算出 0 项，而「显示 0 项但其实有影响」正是 blast radius 最危险的低估（主稿 §9.2）。

---

## 十四、本轮裁定（供否决）

| # | 事项 | 结论 | 依据 |
|---|---|---|---|
| 1 | G3 选新表还是改列格式 | **改列格式**（`{rev:[章]}`） | 零消费者、无迁移包袱，见 G2/G3 |
| 2 | 存量 legacy | **只提示一次不阻断** | 主稿 §十.4，作者本轮裁定 |
| 3 | 手改章节卡留痕 | **要**：保存时一句「这次改动会让 N 章的派生过期」 | 与期 3 强提醒共用文案 |
| 4 | 剧情树往 JSON 加字段还是加列 | **加列** | `graph-generation-source.ts:34/44` 的整体 hash 基准（R9） |
| 5 | 剧情树 hash 与 rev 是否两判取严 | **不取严**，各管一段 | 三种 hash≠rev 的真实操作（R10） |
| 6 | 清除全部是否清版本账 | **清** | 否则导入旧备份后永久脏且不自愈（R11） |
| 7 | 便携 `schemaVersion` 是否 bump | **不 bump** | 五次先例 + `:284` 严格相等（R12） |
