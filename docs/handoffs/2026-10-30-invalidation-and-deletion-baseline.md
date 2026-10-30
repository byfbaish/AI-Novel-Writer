# 交接：删除与失效机制的地基（2026-10-30 凌晨）

> **一句话状态**：昨晚修了四处实机故障、救回一章正文；**「上游重建 / 回滚之后下游快照怎么办」这件事整体不存在**。删除收据的语义列**已落地（M23，2026-10-30 上午，见 §2.4）**；下一步是开《上游重建与下游失效》设计稿。
> **为什么现在要记**：作者原话——「以后还要做**部交接**呢，更别说好几套回滚机制，没有完善的地基，到时候也会处处碰壁」。

---

## 一、今晚已落地（都已跑过测试，可直接继续）

| # | 事 | 落点 | 验收 |
|---|---|---|---|
| 1 | 审稿 `stateDelta` 被 v2/v4 两处守卫拒收（连跑两次均失败的真因） | `src/shared/review-generation-report.ts`（`versionCarriesStateDelta` + 版本常量移入 shared）、`review-chapter.command.ts`（闸门 4 处读同一版本，重建合同补 `stateDelta`） | 真机两份失败产物在 v4 下均通过；`test review` 424 passed |
| 2 | P11-1「意图词命中就报缺 attacks」整条撤下 | 删 `SLOT_ATTACK_INTENT` + `findBlueprintSlotAttackRisks`，调用点留注释指向 P11 设计稿 | 连带修绿了 `chapter-writing-model-selector.browser` 的既有红 |
| 3 | 卷末探测日志说谎（写「未判断」实则按旧卷界判了） | `finalize-chapter.command.ts` 文案与注释 | `finalize-volume-handoff-step.test.ts` 14 passed |
| 4 | **「删除正文」确认框从未说过草稿会一起删** | `finalized-chapter-deletion.ts` manuscript 分支 | tsc 0；`deletion-affordances.test.ts` 7 passed |
| 5 | 救回第 1 章正文（`drafts` 已空、`contents` 还剩两条） | 新建 `scripts/restore-draft-from-orphan-content.mjs`（默认 dry-run） | 已写回 draft 10 = v1 / draft 11 = v2，均 `status='draft'`；改库前备份 `project.db{,-wal,-shm}.bak-20261030-022053` |

**基线**：`src/services src/shared` 全量 `3775 passed / 7 failed / 3 套件`（失败集 = 历史既有，与改动无关）。

---

## 二、删除收据加 `keep_draft`（✅ 已落地 2026-10-30 · 方案 1）

> 原计划条目保留在下方（§2.1 病灶 / §2.2 落点清单 / §2.3 验收），实施记录见 §2.4。

### 2.1 病灶

`chapter_deletion_operations` **按 `draft_id` 唯一**，`begin` 命中旧收据就直接复用，且**表里没有「这次是删还是退」的列**：

```ts
// electron/repositories/chapter-deletion-repository.ts:249-270
const existing = db.prepare('SELECT * FROM chapter_deletion_operations WHERE draft_id = ?').get(input.draftId)
if (existing) {
  if (existing.chapter_number !== input.chapterNumber) throw new Error('章节删除请求与已冻结操作不匹配')
  return existing.operation_id          // ← 不看这次是删除还是退回
}
```

`resumeExistingOperation`（`electron/services/chapter-deletion-service.ts:129-155`）同样不校验语义。

**三种现实后果**：

1. 先删后退 → 落进那条删除收据，返回「已退回草稿」但 `revertChapterFacts` 一次都没跑（**静默 no-op**，草稿仍是 `finalized`）
2. 先退后删 → 被退回收据接住，删除实际没发生
3. 最坏：接住一次**中断的删除**（`status` 停在 `pending`/`failed`）→ `resume` 替它跑完投影清理，把**实体稿与知识库文档删掉**

已有的一半修复：`resumeExistingOperation` 会先复核 `factsStillActionable()` 再决定是否 `discard`（2026-10-23 加的），但那是「收据是否还有效」，不是「语义是否一致」。

### 2.2 落点清单

| 步 | 文件 | 改什么 |
|---|---|---|
| 1 | `electron/migrations/registry.ts` | 新增 M23 登记（当前 `LATEST_SCHEMA_VERSION = 23` → 24） |
| 2 | `electron/migrations/desktop-registry.ts` | `CURRENT_DESKTOP_SCHEMA_VERSION` **同步双写**（漏了就是 `UNRECOGNIZED_SCHEMA`） |
| 3 | 新建 `electron/migrations/m23-*.ts` | 照 `m13-continuity-change-log.ts` 模板：`ALTER TABLE ADD COLUMN keep_draft INTEGER NOT NULL DEFAULT 0` + `hasSchemaObject` 幂等 + verify 断言 |
| 4 | `electron/repositories/chapter-deletion-repository.ts` | `begin` 插入时写 `keep_draft`；命中旧收据时**比对语义**，不一致就抛（不要静默复用） |
| 5 | 同上 | `rowToOperation` / `ChapterDeletionOperation` 类型补字段 |
| 6 | `electron/services/chapter-deletion-service.ts` | `resumeExistingOperation` 增加 `revert`/`delete` 语义一致校验 |
| 7 | `electron/services/portable-project-field-policy.json` | 若该表按迁移分组登记了列白名单，**必须同步登记**，否则便携导出 fail closed |
| 8 | 存量数据 | 迁移里把既有行按「有没有删过 drafts」回填无法判定 ⇒ 一律填 `0`（删除语义为默认），并在迁移注释写明「历史行语义未知，遇到歧义宁可拒绝，不猜」 |

### 2.3 验收

- `FINALIZED_CHAIN_TAIL_REQUIRED` 仍只对删除生效（`begin` 的 `if (!input.keepDraft)`）
- 新增测试：同一 `draft_id` 先 `delete` 再 `revert` ⇒ 第二次必须**显式报错**，不得返回成功
- 新增测试：中断的退回收据不得被删除请求复用
- 迁移幂等：连续跑两次不报错；`LATEST_SCHEMA_VERSION` 与 desktop 侧一致
- 全量失败集不变（3775 / 7 / 3 套件）

### 2.4 实施记录（2026-10-30 上午）

**落点**（对齐 §2.2 八步，逐项已落）

| 步 | 文件 | 实际改动 |
|---|---|---|
| 1 | `electron/migrations/registry.ts` | `MIGRATION_LANE` 加 `M23 (23→24, owner P0-1)`；`LATEST_SCHEMA_VERSION = 24` |
| 2 | `electron/migrations/desktop-registry.ts` | `CURRENT_DESKTOP_SCHEMA_VERSION = 24`；import + `applyM23DeletionKeepDraft` + `schemas(24)` 指纹 + `createM23Migration` + 注册表数组 + `recognizedSchemas`（四处缺一即 `UNRECOGNIZED_SCHEMA`） |
| 3 | `electron/migrations/m23-deletion-keep-draft.ts`（新建） | `ALTER TABLE ... ADD COLUMN keep_draft INTEGER NOT NULL DEFAULT 0`；`PRAGMA table_info` 幂等；verify 断言「列在 + 非空 + 默认 `0`」 |
| 4 | `electron/repositories/chapter-deletion-repository.ts` | `begin` 命中旧收据时**比对语义**，不一致抛错；INSERT 写 `keep_draft` |
| 5 | 同上 + `src/shared/chapter-deletion.ts` | `ChapterDeletionRow` / `ChapterDeletionOperation` 补 `keepDraft: boolean`；`rowToOperation` 读 `=== 1` |
| 6 | `electron/services/chapter-deletion-service.ts` | `resumeExistingOperation` 增 `keepDraft` 参数，语义不一致返回显式错误（不 `resume`） |
| 7 | `electron/services/portable-project-field-policy.json` | `chapter_deletion_operations.keep_draft` 登记 `"H"`（走 `signedDefaults.H` ⇒ `historical-read-only-projection`，**不需要** `signedOverrides`） |
| 8 | 迁移注释 | 存量行一律 0，并写明「历史语义不可考，遇歧义宁可拒绝」 |

**与清单的三处偏差（都是查证后改的，不是自由发挥）**

1. **实际是「三处」语义校验，不是两处。** 清单写 `begin` + `resumeExistingOperation`。但 `begin` 里还有一处：INSERT 必须落 `keep_draft`（否则新收据永远是 0，退回被记成删除）。
2. **校验顺序有讲究：先作废陈旧收据，再比语义。** `resumeExistingOperation` 里 `completed && factsStillActionable` 的 `discard` 分支必须排在语义比对**之前**——否则「数据被备份恢复过、历史收据语义还是删除」的草稿会永远退不回去（那条收据本来就不描述现实）。
3. **`schemaVersion: 7` 不升。** `PORTABLE_SOURCE_SCHEMA_VERSION` 是**策略文档版本**（`portable-project-format.ts:8`），硬校验等于 7；它跟 DB schema 版本是两件事。加一列只登记列，不动它。

**M23 的一处关键裁定：存量行填 0 不会让中断的退回把草稿删掉。**
`deleteChapterFacts`（真删草稿）只在 `begin` 里发生，`resume` 对两种语义做的事完全一致（只清实体稿 + 知识库文档）。所以填 0 的后果只有一个：某条历史收据其实是退回时，作者再来一次删除会被显式拒绝 —— 这正是「遇歧义宁可拒绝」。

**⚠️ 顺带修掉一条既有缺陷：M22 漏登记便携字段策略**

`summary_snapshots.knowledge_candidates`（M22 / `03031dfe`，10-26）从未登记进 `portable-project-field-policy.json`。后果：`assertPortableSourceSchema` 要求「库里每个真实列都在策略里」，缺一行就 `PORTABLE_SCHEMA_UNSUPPORTED` —— **任何 v23 项目做便携导出/导入都会 fail closed**。

- 证据链：`portable-project-format.test.ts` 在 HEAD 上就是红的（`fields: 615 ≠ 614`，`src/` 基线不含 `electron/` 所以一直没暴露）
- 修法：新增 `m22Fields` / `m23Fields` 两个**字段级**名单（照 `m20Fields` 先例，不改整表的 `origin`），`PortableFieldPolicy['origin']` 加 `'m22-delta' | 'm23-delta'` 并补两段判定链
- 量化收益：`legacy-project-copy-import` + `project-format-migration` 两个文件，**基线 11 例失败 → 4 例**

**验证读数（2026-10-30）**

- `npx tsc --noEmit` = 0
- `electron/migrations` 全量（含 m23 lane 5 例）= 通过；`src/shared` 95 文件全通过
- `electron/services/__tests__/portable-project-format.test.ts` = **29/29**（此前 2 failed）
- `electron/controllers/__tests__/chapter-lifecycle-deletion.test.ts` = **17/17**（新增 2 例：先删后退必须报错 / 中断的退回不得被删除请求复用）
- 新增 `electron/migrations/__tests__/m23-installed-lane.test.ts` = 5/5（只加列不动既有行 / 存量读到 `0` / 列尾追加 / 幂等 / verify 失败回滚）
- **既有红（与本改动无关，均已 `git stash` 对照确认）**：`llm-controller-connection` 2 例（HEAD 上同样红）、`m02-project-upgrade` 3 例（HEAD 上同样 3 例同名）
- **环境噪声必须先排除再判基线**：`%TEMP%` 累积了 232 个 `b01-*` 残留目录 + `.runtime/.cache/novel-quality-modernization` 里上一轮留下的 v24 库，会让同一份代码跑出 45/31/11/4 四种结果。**跑这批归档/导入用例前先清缓存**，否则读数是假的

**已立 ADR（2026-10-30 作者裁定）**：[`adr/0026-deletion-receipt-records-its-intent.md`](../adr/0026-deletion-receipt-records-its-intent.md)。ADR-0021/0023 只裁定过「退回保留正文」「退回不限链尾」，没有裁过「收据语义必须落库」—— 现在补上，并把判据写成通用的：**任何「撤销一个已生效决定」的收据，都必须记录它撤销的是哪个决定**，否则撤销 A 的收据会被用来撤销 B。删除与退回只是第一处需要它的地方。

---

## 三、盘点：删除与失效机制现在长什么样

> 这一节是**事实清单**，不含主张。核心结论只有一句：
> **这套代码里不存在「上游结构版本」这个概念。** 三条失效通道（世代水位、哈希、状态）全部只作用于**章节 / 正文来源**；`worldbuilding` / `plot_structure_plan` / `synopsis` / `total_chapters` 的任何改写都不触碰任何下游表。

### 3.1 上游的写入入口（全都无级联）

- `project_core.update` 的字段白名单在 `electron/repositories/project-core-repository.ts:173-198`（24 个字段，含 `worldbuilding` / `plotStructurePlan` / `synopsis` / `totalChapters`）
- 三个 IPC 入口都走它：`db:project-core-update`、`db:project-core-commit-generated`、`db:project-core-synopsis-commit`（`electron/controllers/db-controller.ts:245-297`）
- 架构生成四步分别写前提 / 世界观 / 卷结构 / 情节大纲（`architecture.command.ts:1759`、`:2378`、`:2767`、`:3647`）；**全文件没有一条 `DELETE`/`UPDATE` 指向 volumes、blueprints、summary_snapshots、volume_handoffs**
- 手工编辑架构文件（`ArchFileViewer.tsx:488-496`）同样直写单字段，无失效
- `resetCreativeFields` 存在但全仓无调用（`project-core-repository.ts:262-277`）

**唯一存在的「重建前守卫」**：角色卡重生成前若蓝图非空就禁止（`src/services/workflow-guards.ts:261-297`）。前提/世界观/弧光/大纲**没有任何守卫**。

### 3.2 下游派生体 → 现状

| 产物 | 上游 | 上游重建时现状 | 读取侧校验 |
|---|---|---|---|
| `volumes` / `volume_units` | 卷结构 + 大纲 + 总章数 | 只有手工点「重建」才更新；架构生成**不调用** | 只有面板黄条；`outline-prefix-context` / 两个闸门**忽略 `state`** |
| `volume_handoffs` | 卷结构 + 各章定稿要点 | **不删不改不标记**；卷重排会把旧单静默挂到新卷 | **无**（表里没有来源 hash 列） |
| 章纲（`synopsis` 内章条目） | 生成 / 作者编辑 | 重新生成直接覆盖文本 | 无版本校验 |
| `blueprints`（含 `key_events`） | 大纲 + 角色图谱 + 世界观 + 角色卡 | 原样留着 | **无**（表里没有任何上游版本列）；只保证「本次运行内不变」 |
| `summary_snapshots`（要点 / 事实 / 状态候选） | 定稿正文 | 上游重建不动；章节退回才按 draft 删 | 有 `sourceStatus`，但**多数消费方不筛** |
| `continuity_projection_meta` / `change_log` | 章节定稿/退回事件 | 上游重建**不推进**；项目「清除正文」也不重置 | 见 3.3 |
| `plot_tree_snapshot` | 大纲 + 蓝图 + 定稿摘要 + 伏笔 | 只有「清空」才置空 | 有 `sourceRevision`，但**只在 UI 比**，出黄条 |
| `characters_arch` 投影 | `characters` 表 + 关系 | 角色重建才重算 | `projection_hash`/`fact_hash` 三比对 ⇒ `inconsistent` |
| `knowledge_states`（知情） | 定稿事实（章号 + 逐字引文） | 不动 | **有**：读时算 `valid/stale/unverifiable`，注入只收 `valid` |
| `narrative_thread_plans` / `confirmations`（伏笔） | 蓝图/正文 | 不动，退回也不删事件行 | 只看 `drafts.status='finalized'`，**不验正文 hash** |
| `reviews` / `review_findings` | 某版草稿 | 退回保留 | 只在「确认」按钮处比对来源 |
| 知识库（LanceDB doc/chunk） | 定稿正文 | 上游重建不动；「清除正文」也不清 | **无上游版本**；只看文档副本与索引是否一致 |
| `world-state-read` 视图 | 上述各项 + 角色卡 | 现算，无表 | **完全不筛 `sourceStatus`** |
| 弧光 | —— | **无表**，只是 `plot_structure_plan` 文本前端解析 | 不适用 |

两条「寄生列」：`blueprints.notes`（定稿后处理写入，退回/删除不清）、`resource_movements`（退回按章删，**删除章节不删**，且无 draft 外键 ⇒ 留孤儿行）。

### 3.3 三种失效形态与它们的真实作用域

| 形态 | 实现 | 生产调用点 | 谁真的据此行动 |
|---|---|---|---|
| **世代水位** | `invalidateContinuityProjectionFrom`（`summary-repository.ts:536-560`）：`generation+1`、`stale_from_chapter` 取最小、写 `continuity_change_log` | **只有 3 处**：删章节、退回草稿、重定稿替换已定稿章 | 下一章生成**阻断**（`generate-draft.command.ts:1025-1043`）；角色投影过滤（`current-character-projection.ts:77-79`）；知情筛 `valid`；其余多处只是徽标 |
| **哈希** | `outline_hash`、`projection_hash`/`fact_hash`、`contentHash`、`sourceRevision` | 各处自带 | 只有 `projection_hash` 会**阻断写卡/提交**；`outline_hash` 只喂面板黄条；`sourceRevision` 只在 UI 比 |
| **状态** | `readVolumeStructure.state='stale'`、`deriveRosterStatus='inconsistent'`、`KnowledgeRefState` | 读时算 | 卷 `stale` **只记日志、照旧使用**；名册 `inconsistent` 生成侧**静默降级**、架构侧**回退到已判不一致的旧文本** |

### 3.4 回退路径逐个体检

| 入口 | 失效了什么 | 漏了什么 |
|---|---|---|
| 草稿退回定稿（`chapter:revert-finalized`） | 世代 + 后处理跑批 + `summary_snapshots` + `resource_movements` + `finalization_outbox` + 实体稿 + 知识库文档 | `reviews` / `revisions` / `blueprints.notes` / `volume_handoffs` / `volumes.actual_last` / `narrative_thread_*` 行 / `knowledge_states` 全留 |
| 删除正文（`chapter:delete-finalized`） | 同上，外加删 `drafts` + `contents` | `resource_movements` 不删（无 FK）；`volumes.actual_last` 不重算；`blueprints.notes` 不清 |
| 大纲整单元回退（`synopsis-unit-rewind.ts`） | 只改 `synopsis` + 检查点文件 | **什么都不失效**：volumes / volume_units / volume_handoffs / blueprints / summary_snapshots / plot_tree 全部照旧 |
| 架构恢复稿保存 | 只写 `synopsis` | 同上 |
| 「清除全部 / 故事架构」 | 唯一成体系的级联（`project-clear-repository.ts:110-181`） | 知识库 LanceDB 不清（要单独 `kb:clear`）；`continuity_*` / 豁免 / 伏笔计划 / `blueprints.notes` 不清 |
| 版本历史「回到此版本」（`VersionHistory.tsx:149-188`） | 只 `db:draft-create` 造一条新草稿 | 不推进世代、不清派生；`version-service.revertToVersion` **全仓无调用方**（死代码，UI 自己复制了一遍） |
| 项目恢复 / 导入 | 整库替换 | 不是分层回退 |

### 3.5 已被消费但没有校验上游的 16 处（清单见附注）

其中对**卷末交接**最要命的三处：

1. **交接单 → 下一卷大纲**：`outline-prefix-context.ts:43-77` 只按 `volumeIndex === previousIndex` 硬匹配，**不看 `volumes-list.state`**，也不看交接单是哪版大纲生成的
2. **交接单生成 ← 章节要点**：三处调用同构（`finalize-chapter.command.ts:478-495`、`VolumeHandoffGatePanel.tsx:65-74`、`VolumeHandoffRegistryPanel.tsx:353-363`），**都不过滤 `sourceStatus`** ⇒ `stale`/`legacy` 投影会被当成这一卷的事实写进交接单
3. **交接单 → 正文写作**：`generate-draft.command.ts:989-991` / `:2663-2674` 读，异常一律 `return null`（静默当作「没有上一卷」）

（完整 16 条留在本会话的调查结果里；需要时让接手的 agent 重新跑一遍同一份检索即可复现，检索口径见 §六。）

---

## 四、为什么这是「部交接」的地基

**卷交接**传的是「下一卷必须承接的六件事」；**部交接**要传的更多——跨部意味着世界观切片、伏笔池、角色状态、资源口径都要跨过一道边界。而现在：

- 交接单**没有任何来源版本**（表里没有 hash 列）⇒ 无法回答「这份交接单是基于哪一版大纲写的」
- 卷结构过期时**照旧使用**（今晚只改了文案，行为没动）⇒ 交接单可能基于旧卷界生成
- 章节要点被交接单消费时**不筛 `sourceStatus`** ⇒ 过期要点会变成下一卷的既定事实

**结论**：部交接不是「再加一张交接单」，而是**先有「上游版本 + 下游派生来源」这条链**，交接单只是链上的一个消费者。没有这条链，部交接会把今天的错误放大到「整部」的尺度。

---

## 五、建议的分层模型（**待讨论，今晚未实施**）

> ⚠️ 术语待核：这套东西在构建系统里叫**脏传播（dirty propagation）**、在数据库里叫**物化视图失效**。按项目红线，**定名前先查行业定义并带出处**，本节只是借用类比，不是结论。

三个待裁定的点：

1. **上游版本是一整版，还是按章区间分版？**
   大纲是**分批生成**的（E3 逐单元），所以「大纲版本」很可能必须是 `[章区间, 版本]` 的列表，而不是一个全局计数器。这与 E3 的检查点/游标三元组是同源的——不能各做一套。

2. **下游派生分三类处置，而不是「一刀切删」**

   | 处置 | 适用 | 判据 |
   |---|---|---|
   | **重算** | 纯函数派生、便宜、无作者输入（卷结构、投影） | 重算结果确定 |
   | **标失效 + 阻断读取** | 派生里含模型产出或作者确认（交接单、要点、蓝图） | 消费错了会污染下一环 |
   | **归档保留、不再被消费** | 历史资产（旧审稿、旧版本） | 作者可能还要看，但机器不许用 |

3. **回滚要分「可局部回滚」和「整段作废」**
   现在七条回退入口各干各的。要么统一成一个「回滚操作」原语（记 `from/to` + 失效范围），要么明确写下「哪些回退不保证一致」——**不能保持现状：有的失效、有的不失效、有的只写文件**。

---

## 六、下一步顺序（建议）

1. **~~明天先做 §二~~（✅ 2026-10-30 已落地，见 §2.4）** —— 删除收据 `keep_draft` 独立、有明确验收、不牵扯设计，已收口
2. 再出一份**《上游重建与下游失效》设计稿**，只回答三件事：上游版本怎么表示、派生怎么登记来源、每种处置由谁执行
3. 设计稿定稿后，按「交接单链」优先落地（因为它已经咬过人，且是部交接的前置）
4. 部交接（W8 线）在 3 之后开

**复现调查口径**：检索 `invalidateContinuityProjectionFrom|outline_hash|projection_hash|reportVersion|sourceStatus|keepDraft` 的生产调用点，再看 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md`（P11 的事前校验与本稿是同一族：P11 管「计划 vs 事实」，本稿管「派生 vs 上游」）。
