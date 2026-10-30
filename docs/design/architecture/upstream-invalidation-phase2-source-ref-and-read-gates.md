# 上游失效 · 期 2 实施设计：来源登记与读取侧拒绝

> 状态：**设计稿，只写文档未改代码**（2026-10-30）
> 上级稿：[`upstream-version-and-derived-invalidation-design.md`](upstream-version-and-derived-invalidation-design.md)（§四 分版 · §五 来源 · §六 三档处置 · §九 落地顺序 · §八 强提醒）
> 前置事实：期 1 已落地（`955efbf1`，M24 + 判定纯函数 + 两个写入点，零消费者改动）
> 本稿回答：期 2（主稿 §九 步 2、步 3）在现有代码上**具体改哪几处**，以及**先得补哪四个零件**。

---

## 一、范围

| | 内容 |
|---|---|
| **做** | `volume_handoffs` / `blueprints` 记 `source_ref`；`plot_tree_snapshot` 加 `sourceRef`；读取侧在主进程 IPC 边界判定并拒绝 |
| **不做** | plan 阶段与强提醒 UI（期 3）、处置面板（期 4）、`outline:<unitId>` 单元级作用域（等 E3 落盘）、角色卡域、回滚原语 |
| **不改** | 「上游重建不触碰任何下游表」这个事实；`continuity_projection_meta` 世代机制一字不动（主稿 §七 路 A） |

---

## 二、四个前置缺口（核代码得出，必须先补）

期 1 交付的是「能记」，「能判」这一半在代码里还缺零件。不先补就接线，会做出**假判定** —— 比不判更糟，因为它给作者一个错误的确信。

### G1 按章收窄在判定侧没有入口

`refCoversChapter()`（`src/shared/upstream-revisions.ts:260`）**零调用**（全库只有它自己的测试引用），而 `derivedStatus()` 只比 `have !== need`，完全不看 `changed_chapters`。

⇒ 直接接上会退化成「改一章，整批 10 章蓝图全判脏」，正是主稿 §4.1 要避免的那种噪声（也是今天卷 `stale` 黄条没人看的原因）。

⇒ 期 2 需要一个按章收窄的判定入口：

```
derivedStatusForChapters(sourceRef, current, changes, chapters) → DerivedValidity
  chapters : 该派生覆盖的章号（蓝图 = [N]；交接单 = 整卷区间展开；剧情树 = 全书）
  changes  : 键 → 「哪些 rev 改了哪些章」（见 G2/G3）
  逐键：have !== need 且 该键在 (have, need] 里改到的章 ∩ chapters ≠ ∅ ⇒ 记一处 drift
```

`refCoversChapter` 保留为单章特化（内部调 `refOverlapsChapters`），避免两套区间语义。

### G2 `bump` 的并集语义会吃掉「整本重生成」

`mergeChangedChapters()`（`:239`）取并集且**永不清空**。整本重新生成时若传 `changedChapters: []`，结果是「rev 涨了、章集还是历史那几个章」⇒ 只有那几章判脏，其余「看似没变」⇒ **漏判**，方向错在危险的一侧（blast radius 那条：低估是危险的）。

⇒ `BumpUpstreamRevisionInput` 增 `changedChaptersMode?: 'merge' | 'replace'`。整本 `synopsis` 重生成、恢复稿整段替换走 `replace`（写空 = 全覆盖）。

### G3 累积并集会把「刚手改完的行」判脏（会硬拦新内容）

这个序列是日常操作，不是边界情况：

```
生成全批            rev1，章集 []
手改第 31 章        rev2，[31]，行31.source = 2
手改第 33 章        rev3，[31,33]，行33.source = 3
```

判行 31：`have=2 ≠ need=3`，且 31 ∈ 累积章集 ⇒ `stale` ⇒ `blocksConsumption` **拒绝这一行参与写作**。而它正是作者刚改完的那一版 —— 拦新不拦旧，方向反了。

根治要能回答「**在 (have, need] 之间**改了哪些章」。两种落法：

| 方案 | 形态 | 代价 |
|---|---|---|
| A | 新表 `upstream_revision_changes(domain, scope, rev, chapters)` | 与 M13 `continuity_change_log` 同构（正文域的 `requiredGeneration` 就是这么扫前缀算出来的），但多一张表、多一处写入点 |
| **B（推荐）** | **改 `changed_chapters` 存储格式**为 `{"2":[31],"3":[33]}`（rev → 章集），判定取 `(have, need]` 的并集 | 期 1 该列**零消费者**（建表与改列同一天），改格式没有迁移包袱 |

选 B 的理由：收益相同、不新增表；代价只是单行 JSON 随 rev 增长，用「只留最近 20 条、更早的合并成『全部章』」兜住，方向保守（多判脏，不漏判）。

**兼容规则**：读到裸数组（旧格式）⇒ 当作「所有 rev 都改过这些章」；这正好是保守方向。

### G4 `snapshot()` 不接受 `database` 参数

`read` / `readRev` / `list` / `snapshot` / `snapshotWithOverride` 全部走 `getProjectDb()`，而 `bump` 接受 `database`。写入侧（`ProjectCoreRepository.update(data, db)`、`BlueprintRepository.upsert(data, db)`、`upsertVolumeHandoff(db)`）都传库，读取侧却拿默认库 ⇒ 测试夹具 / 临时库 / 迁移库场景下「内容写 A 库、版本读 B 库」，比不记来源更糟（该文件 `requireDb` 注释已写同样的顾虑）。

⇒ 这几个读方法补可选 `database` 参数，与 `bump` 对齐。

---

## 三、迁移 M25（v25 → v26）

两张表各加一列：

```sql
ALTER TABLE volume_handoffs ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''
ALTER TABLE blueprints      ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''
```

- **默认空串，不用 `NULL`**：空串 = legacy（从来没过来源），`NULL` 会让「没记过」和「记成空」变成两态，而判定侧只要一态。
- **不回填**：存量行留空、判 legacy，等下一次自然重写时补上（这正是主稿 §十.4 待裁的那条；期 2 落地前必须有答案，见 §十二）。
- 幂等 + 校验三条：列在、`notnull=1`、`dflt_value` 为 `''`（照 M23 `keep_draft` 的写法）。
- **`plot_tree_snapshot` 不加列**：它是 `project_core` 的 TEXT 列，来源记在这个 JSON 里面（§七）。

---

## 四、写入侧

### 4.1 `source_ref` 的键与章集

键一律由 `upstreamRefKey()` 拼（全库唯一来源，避免两边格式不一致导致"永远全落后"）。

| 派生 | `source_ref` | 收窄用的章集 |
|---|---|---|
| `volume_handoffs` | `{worldbuilding:book, arc:book, outline:book}` | 该卷区间 `firstChapter..lastChapter` |
| `blueprints(N)` | 同上 | `[N]` |
| `plot_tree_snapshot`（JSON 内） | 同上 | 全书 |

### 4.2 三处写入

| # | 位置 | 时机 |
|---|---|---|
| 1 | `electron/repositories/volume-handoff-repository.ts:149` `upsertVolumeHandoff` | 落库时取当前快照填入；**必须用同一个 `db`**（G4） |
| 2 | `electron/repositories/blueprint-repository.ts:565` `upsert` / `:597` `upsertMany` | 同上 |
| 3 | `electron/repositories/plot-tree-repository.ts`（快照保存处） | 在快照 JSON 里落 `sourceRef`，与 `sourceRevision` 并存 |

### 4.3 手改蓝图 = 改上游（这条是本稿的核心动作）

主稿 §4.1 已定：**批是 rev 的身份，章集合是这批的内容描述**。所以写一张章节卡，既是「写一个派生」，也是「改一次上游」：

```
upsert(data):
  ① bump({domain:'outline', changedChapters:[N], mode:'merge'}) → newRev
  ② 写 blueprints 行，source_ref = {…, outline: newRev}      ← 本行现在是最新作者版
  ③ ①②同一事务
```

不这么做的后果：改完卡，这一行自己判 `stale` ⇒ 拒绝使用刚改的卡（同 G3 的荒唐方向）。

三条边界：

| 通道 | 处理 |
|---|---|
| `db:blueprint-upsert-many`（整段保存，`ChapterCardEditor.saveAllBlueprints`） | 整段章集**一次** bump（不是 N 次），否则一次保存把 rev 推高 N，且中间态会被别的读取点看见 |
| `db:blueprint-update-notes`（只改备注） | **不 bump** —— M24 注释已定：备注不是情节 |
| `db:blueprint-commit-range`（模型生成落盘整批） | bump 该批章集，`merge` |

整本 `synopsis` 重生成（`commitSynopsis` 的整段替换路径）走 `replace`（G2）。

---

## 五、读取侧：判定在主进程，渲染侧只决定反应

### 5.1 为什么判定必须放主进程

- `upstream_revisions` 只有主进程能读（渲染进程没有 DB 句柄）。若让渲染侧再拉一次版本表自己算，就有了**第二份判定语义**；
- IPC 边界是唯一「所有消费者必经」的地方：正文链、面板、agent 工具全走它，漏不掉。

### 5.2 四个 handler 附加 `validity`

| 通道 | 位置 |
|---|---|
| `db:volume-handoffs-list` | `electron/controllers/db-controller.ts:1689` |
| `db:volume-handoffs-before` | `:1701` |
| `db:blueprint-get` | `:607` |
| `db:blueprint-get-all` | `:602` |

返回值加可选字段 `validity: DerivedValidity`（共享层类型，两个进程都能 import）。**只加字段不改形状**，所有既有调用点不用改。

### 5.3 五处消费点与各自的反应

| # | 位置 | 现在 | 期 2 |
|---|---|---|---|
| 1 | `src/services/workflows/commands/generate-draft.command.ts:2663` `readVolumeHandoff` | `catch → null`，静默当成「这卷本来就没有前置」 | `stale` ⇒ **抛可读错误**并指路处置；`legacy` ⇒ 照旧注入 + 一条提示 |
| 2 | `src/services/outline-prefix-context.ts:53` | 读失败静默空 | `stale` ⇒ 不注入，`warning` 写明「上一卷交接单已过期（大纲重建过）」 |
| 3 | `src/services/volume-handoff-gate.ts:36`（开写闸门） | 只看「有没有单」 | `stale` ⇒ 闸门判为**需处置**，而不是「已人工复查」可通过 |
| 4 | 章节卡读蓝图（`ChapterCardEditor` / `DraftEditor`） | 无判 | `stale` ⇒ 徽标 + 保存时提示；**不阻断编辑**（编辑它就是在更新它） |
| 5 | 剧情树视图（`src/components/editor/PlotTreeView.tsx:81`） | 自己比 hash | hash 与 `sourceRef` 两判，任一不过 ⇒ stale（保守） |

**第 1 处必须写清一条纪律**，否则实施时一定会退回 fail-open：

> 读失败（IO、缺表、异常）**仍然 fail-open** —— 这是项目既有纪律，闸门不该因为读不到而拦住写作。
> 但「成功读到一条已知过期的交接单」不是读失败，它是**成功判定了它过期**，必须拒绝。
> 两者的区别是 `warning` 与 `validity` 两个字段：前者是"没读到"，后者是"读到了但旧了"。

---

## 六、`outline` 作用域：期 2 维持 book，不切单元级

主稿 §4.1 写的是 `outline:<unitId>`，但核代码后：

- 期 1 实际写的键是 `outline:book`（`commitSynopsis` 只拿得到 `authorRecovery.committedRange`，没有 unitId）；
- 唯一能拿到 unitId 的地方是 E3 的 `ArchitectureUnitRange`（**生成请求参数，不落库**）；
- `volume_units` 的 unitId 来自大纲标题解析，与 E3 的 unit id **不是同一套**（不存在映射表）。

⇒ 期 2 不切单元级。分区对齐的收益（改第 3 批不动第 1 批）靠 **G3 的 rev→章集 + 按章收窄** 拿到，效果等价、改动小一个数量级。

**将来切的条件**（写下来免得后人重走一遍）：E3 落盘时 `ensure('outline', unitId)`；但那时 `outline:book` 与 `outline:u07` 会并存，派生侧 `source_ref` 若同时记两者会**双重判脏**。所以切换必须一次性重写所有派生行的 `source_ref`，是一个专门的迁移窗口，**不能顺手做**。

---

## 七、剧情树：hash 与 rev 并存，各管一段

`plot_tree_snapshot.sourceRevision`（`electron/repositories/plot-tree-repository.ts:20`）是对**来源输入的 sha256**（synopsis + blueprints + 已定稿摘要），不是域版本。两条性质要分清：

| | `sourceRevision`（hash） | `sourceRef`（rev） |
|---|---|---|
| 能判 | 输入字节变了没有（确定性可复算，属 §3.1 里 early cutoff 有效的少数派） | 哪一域变了、落后几版 |
| 不能判 | 哪一域变了；跨库（备份恢复后 hash 可能仍相等而 rev 已不同） | 输入字节层面的一致（rev 相同而内容被手改） |

⇒ 期 2 **加** `sourceRef`，用 `derivedStatus` 出徽标；`sourceRevision` 原样保留作第二道更严的检查。两者冲突取 stale。

`assertPlotTreeSnapshot()`（`src/shared/plot-tree.ts:376`）现有的「来源版本不匹配」仍拦生成产物，不动。

---

## 八、`narrative_thread_plans` 不进本机制（修正主稿 §五）

主稿 §五 把它列进「加 `source_ref`」的三张表之一。核数据后**不建议**：

- 该表四列全是**作者意图**（`title` / `type` / 目标章区间 / `author_intent`），没有一列是模型从大纲派生的；
- 给它记 `source_ref` ⇒ 大纲一改，作者亲手写的伏笔计划被判「过期、拒绝使用」。这与 B 档定义（「含模型产出**或作者输入**」）恰恰相反 —— 作者输入不该被上游变更废掉，**它本身就是上游**。

⇒ 它只进 **plan 清单**（「这 3 条伏笔的回收点落在被改的批次里」，提醒看一眼），不进版本表、不判 valid/stale。

连带修正主稿 §8.2 第 4 组的措辞：从「将判 stale」改成「回收点可能落进改动范围」。

---

## 九、便携与字段策略

- 两列均 **D**（与 `upstream_revisions` 同类）。**不能是 X**：导出的项目 `source_ref` 被清空 ⇒ 全部派生变 legacy，等于把导入项目退回"什么都不知道"。
- `m25Fields: ["volume_handoffs.source_ref", "blueprints.source_ref"]`；`tables` 里各补一个 `"source_ref": "D"`。
- 表数不变 **65**；字段 622 → **624**。
- `upstream_revisions.changed_chapters` 从数组变 map（G3）：D 类原样搬运，无需新策略，但**读侧必须两代都懂**。

---

## 十、验收

| 项 | 判据 |
|---|---|
| 类型 | `tsc --noEmit` 0 |
| 迁移 | `migrations` 套件新增 M25 例：幂等 / 三条校验 / 旧库升级后两列默认 `''` |
| 判定 | `derivedStatusForChapters` 单测覆盖 G2、G3 两个序列 —— **尤其「刚手改那行必须 valid」** |
| 读取 | 正文链遇 `stale` **抛错不静默**；新增一条回归，防将来有人把 `catch → null` 加回来 |
| 既有 | `src/services src/shared` 基线 3795 / 7 failed / 3 套件，只增用例不改既有断言；全量跑测带 `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID` |
| 文档 | `node scripts/check-doc-links.mjs` 0 断 |

---

## 十一、期 3 接口草案（只钉接口，不实施）

```
computeInvalidationPlan(domain, scope, 假想 rev) → {
  groups : Array<{ kind: 'finalized'|'handoff'|'blueprint'|'thread'|'plot-tree', count, detail }>
  unseen : number        // legacy 项，必须单独一行「无法判断」，且参与分档
  tier   : 'silent' | 'once' | 'strong'    // 含不可逆 ⇒ strong（主稿 §8.3）
}
```

- 纯读：`snapshotWithOverride` 已在期 1 备好（`upstream-revision-repository.ts:213`），**① 阶段绝不许 bump**（主稿 §8.1）；
- IPC：`db:invalidation-plan`；
- UI 挂点：`src/components/editor/ArchFileViewer.tsx:812`（`createArchitectureWorkflow` 之前）；
- **依赖期 2**：没有 `source_ref` 时 plan 只能算出 0 项，而「显示 0 项但其实有影响」正是 blast radius 里最危险的低估（主稿 §9.2）。

---

## 十二、待裁

| # | 问题 | 建议 |
|---|---|---|
| 1 | G3 选 A（新表）还是 B（改列格式） | **B**：零迁移包袱、少一张表；兼容规则保守 |
| 2 | 存量 `legacy`（`source_ref=''`）怎么处置 | 只提示一次、不阻断，下次自然重算时补来源（主稿 §十.4 仍未裁，**期 2 落地前必须有答案**） |
| 3 | 手改章节卡算「改上游」是否需要 UI 留痕 | 建议要：保存时一句「这次改动会让 N 章的派生过期」，与期 3 的强提醒同一套文案 |
