# P34 · 定稿编辑动作计数：可行性取证（只读）

> 派：AI writer总负责人 · 2026-11-14 · 卡面 `.batch/night/cards/p34-edit-count-feasibility.md`
> 起点 HEAD：`9070999c`（主线 `exp/resource-ledger`）· 只读，未改 `src/`、未跑 dev、未产生提交
> 取证方法：读当前 HEAD 实际文件；行号均为取证时点行号

## 0. 一句话结论（先给）

**A2/A3 现在验不了。** 全库没有任何「人工编辑」落盘事件，唯一被写入的是「最新正文」本身（旧正文被覆盖丢弃）。最小接线是**一处**：在 `db:draft-update-content` 的 handler 里、覆盖前读旧正文算 diff，累加进一张新表（或两列），渲染层、IPC 契约、`review_findings`、既有 ADR 都不用动。

## 1. Q1 · 定稿编辑到底发生在哪（两条互不相干的落盘链）

先纠一个前提：**定稿后草稿草稿是只读的**，作者改字实际发生在「草稿态」，或直接改 `manuscript/` 里的物理终稿文件。两条链分开。

### 1a. 草稿链（作者改字的主战场）

| 跳 | 落点 | 说明 |
|---|---|---|
| 1 编辑器输入 | `src/components/editor/CodeMirrorEditor.tsx:70`（`onSave` prop）、`:589`（`mode === 'prose'` 的 `Prec.highest(keymap.of([...`，⌘S/Ctrl+S 绑定）、`:802`（`void Promise.resolve(onSave?.(lastEmittedContentRef.current))` 把**编辑器当前全文**交回调用方） | CodeMirror 只往外吐全文，不吐 diff |
| 2 组件内 state → store | `src/components/editor/DraftEditor.tsx:873-877`（`onChange` → `useEditorStore.getState().updateTabContent(tabId, text)`）；`:878`（`onSave={(text) => doSave(text)}`） | 每次改动都会 `updateTabContent`，所以 **store 侧已经有一次「动作级」自增** |
| 3 store 计数器 | `src/stores/editor-store.ts:418`（`updateTabContent`）：`:424` `contentRevision: (t.contentRevision ?? 0) + 1`；`:438-440` 内容相同则不增 | **这是全库唯一已存在的编辑动作计数，但只在内存标签对象上**（`:12` `contentRevision: number`），不落盘、重开清零 |
| 4 保存函数 | `src/components/editor/DraftEditor.tsx:187` `doSave` → `:211-218` `ipc.invokeWithProjectSession(..., 'db:draft-update-content', draftId, saveSnapshot.content, countDraftUnits(...), projectPath)` | 保存是显式的：保存按钮 `:689`、Ctrl+S `:878`、切标签/关标签的 exit-save `:241-252`、AI 动作前 `:275`。**无自动保存/去抖自动写** |
| 5 IPC 契约 | `src/shared/ipc-channels.ts:1243` `'db:draft-update-content': { args: [id, content, wordCount, expectedProjectPath]; return: { success, error? } }` | 契约里没有、也不需要「旧正文」或「来源」 |
| 6 主进程 handler | `electron/controllers/db-controller.ts:1207` handler；`:1212-1214` finalized 只读拒绝（抛「已定稿正文为只读内容，不能再修改」）；`:1215` `DraftRepository.updateContent(id, content, wordCount)` | 校验项目会话 `:1209` |
| 7 仓储写盘 | `electron/repositories/draft-repository.ts:480` `updateContent`：`:481-485` finalized 再拦一次（抛「已定稿正文为不可变事实」）；`:487` `ContentRepository.updateBody(meta.contentId, content)`；`:492-495` `UPDATE drafts SET word_count = ?, updated_at = datetime('now')` | **旧正文在此刻被覆盖** |
| 8 正文表 | `electron/repositories/content-repository.ts:33` `UPDATE contents SET body = ? WHERE id = ?` | `contents` 表结构只有 `id/body/created_at`（`electron/migrations/baseline-schema.ts` contents 段）——**没有 updated_at，没有历史版本** |

### 1b. 定稿链（草稿 → 不可变事实 → 物理实体稿）

| 跳 | 落点 |
|---|---|
| 1 定稿按钮 | `src/components/editor/DraftEditor.tsx:359` `doFinalize`（确认文案 `:364`「定稿后章节将标记为完成，不再支持修改和重新后处理」） |
| 2 冻结快照 | `:383-394` `captureFinalizationSnapshot({ tab: {...targetTab, content: targetTab.content ?? currentBodyRef.current}, ...})`（正文取编辑器可见值，注释 `:387`「不再回读 SQLite」） |
| 3 起工作流 | `:409` `createFinalizeWorkflow({..., draftContent: snapshot.content, snapshot}, ...)` → `src/services/workflows/chapter-workflow.ts` |
| 4 主进程提交 | `electron/controllers/finalization-controller.ts:24/63`（校验并透传 `contentRevision`）→ `electron/repositories/finalization-repository.ts:280` `static commit` |
| 5 定稿 outbox | `electron/migrations/baseline-schema.ts:164-180` `finalization_outbox`：`content_hash` `:169`、`content_revision` `:170`、`content_snapshot` `:171`、`publication_status` `:174`、`published_at` `:176`。注释 `:161-162`：正文与定稿状态同事务提交，实体稿由 outbox 异步发布 |
| 6 写实体稿 | `electron/services/manuscript-publisher.ts:102` `publishManuscript` → `:116` `fs.writeFileSync(temporary.absolutePath, serialized, {encoding:'utf8', flag:'wx'})`（`:90` `serializeManuscript`） |

### 1c. 终稿物理文件被再次编辑（第三条散链）

`src/components/panels/EditorArea.tsx:703-720`：`ai-novel://manuscript/` 之外的 chapter 走 `ProseEditorWrapper`，`onSave` → `:713` `savePhysicalChapterForSession({...})` → `src/components/panels/editor-area-physical-save.ts:33-39` `ipc.invokeWithProjectSession(..., 'fs:write-file', filePath, content, projectPath)` → `:43` `settleTabSave`。另外 `ai-novel://recovery/` 分支 `EditorArea.tsx:667-688` 写 `db:recovery-candidate-update`。这三条都**不经过 drafts 表**，也没有任何计数。

## 2. Q2 · 现有最近邻事件，能不能兼作计数

| 事件 | 落点 | 记了什么 | 能否兼作人工编辑计数 |
|---|---|---|---|
| 草稿保存 | `db:draft-update-content`（上表 5-8 跳） | 每次保存覆盖 `contents.body` + `drafts.word_count` + `drafts.updated_at` | **这是唯一正确的挂点**；但目前只留最后一次时间戳，不累计次数、不留旧正文 |
| 草稿台账 `chapter-card-draft-ledger` | `src/components/editor/chapter-card-draft-ledger.ts:11-14`（`{version:1, projects:[{projectKey, blueprints, dirtyChapterNumbers}]}`）；只在 `editor-store.draftLedgers` 内存里 | **章卡蓝图**的未保存草稿，不是正文 | 不能。与正文编辑无关 |
| `editor-store.contentRevision` | `src/stores/editor-store.ts:12/424/438-440` | 每次正文变化的序号（内容不变不增） | **语义最接近「动作数」**，但是内存态：重开标签、重启即清零，不进 DB |
| 定稿提交 | `finalization_outbox`（`baseline-schema.ts:164-180`），`FinalizationRepository.commit`（`finalization-repository.ts:280`） | 一章一行的**定稿瞬间**快照：`content_hash`/`content_revision`/`content_snapshot`/`published_at` | 不能。只有终态，无轨迹；且 `draft_id UNIQUE` `:166`，一章一条 |
| drafts 行本身 | `baseline-schema.ts` drafts 段：`chapter_number/version/status/source/content_id/word_count/source_dependencies/created_at/updated_at` | 无任何编辑计数字段 | 不能。字段里没有位置放 |
| AI 侧产物 | `revisions`/`review_findings`/`db:draft-create`（AI 修稿、生成都是**新建版本行**） | AI 改动，非人工 | 不能。反过来说明：**`update-content` 这条链是人工保存专属通道**（`src` 里只有 `DraftEditor.tsx:213` 调用；`refine-draft.command.ts`/`review-revision-command.ts` 均无 `db:` 写正文调用，AI 侧走 `db:draft-create`/`generation:commit-draft`） |

补充事实（口径乙的硬约束）：**旧正文不可回溯**——`content-repository.ts:33` 直接覆盖，`contents` 无历史表；`draft-repository.ts` 的 `source_dependencies` 存的是「有序 draft id + 冻结正文哈希」，不是正文。所以「改动千字率」**不可能事后补算**，只能在保存那一刻算。

## 3. Q3 · 最小接线（零渲染层改动）

- **唯一改动点**：`electron/controllers/db-controller.ts:1207` 的 `db:draft-update-content` handler，在 `:1215` 调 `updateContent` 之前，用 `DraftRepository.getMeta(id).contentId` 读旧 body（`ContentRepository` 已有读取方法）、与入参 `content` 做字符级 diff，把结果写进新表。
- **需要新增**：①一个迁移文件（`electron/migrations/` 下新 m 号；`baseline-schema.ts` 只是基线，不能改既有编号）建表 `draft_edit_events(draft_id, chapter_number, saved_at, chars_added, chars_removed, word_count_before, word_count_after)`，或最省则在 `drafts` 加两列 `manual_edit_saves`/`manual_edit_chars`；②`DraftRepository` 一个记账方法（~10 行）。
- **不用动**：IPC 契约 `ipc-channels.ts:1243`（签名不变）、渲染层任何组件、`review_findings`、v2 契约、既有 ADR（没有任何 ADR 约束 drafts 表结构）。
- **成本**：一次正文级 diff 在主进程同步做，章字数几千字，毫秒级；不增加 IPC 往返。
- **不确定项（须产品经理定口径，我不选）**：
  1. `按确认意见修稿` 若在渲染层改当前草稿再保存，会走同一条 `update-content`，与人工保存混在一起 —— 我核到的 src 侧只有 `DraftEditor` 调用它，但 AI 侧「应用到草稿」的具体落点未逐一排空，接线前须把这条路径钉死，否则口径甲会混入 AI 改动。
  2. 1b/1c 两条链（定稿后改 manuscript 物理文件、recovery 候选）不在这个挂点上；若「定稿编辑」指的就是定稿**之后**的修改，那这些路径要另设埋点，而按当前产品语义（定稿后只读）它们不该发生 —— 须先确认口径指向哪一段。
  3. 退出保存/切标签保存与点保存键在 `update-content` 层不可区分；若要区分，得在 IPC 入参加一个 saveReason（会动契约）。

## 4. Q4 · 三口径逐条判定

| 口径 | 判定 | 理由 |
|---|---|---|
| 甲 动作数（改段/改句/删段/重写次数） | **要接线才有**（当前算不了） | 唯一现成的 `contentRevision` 只在内存、重开即清零；DB 里没有事件表。按「每次保存 = 一次动作」可以最省地近似，但那其实是口径丙 |
| 乙 改动千字率（人工改动字数 / 章字数） | **要接线才有**，且必须**在保存时刻算** | 旧正文在 `content-repository.ts:33` 被就地覆盖、无历史表 ⇒ 事后无法重算。接线后可精确到每次保存的增删字符数，再按章汇总除以 `drafts.word_count` |
| 丙 保存次数（最粗） | **要接线才有**，但最便宜（一行计数列即可） | `drafts.updated_at` 只留最后一次；加 `manual_edit_saves` 一列，handler 里 `+1` 即可。注意它会同时统计「打开就关」的空保存吗？不会——exit-save 只在 dirty 时触发（`DraftEditor.tsx:275` 先判 `targetTab.dirty`） |

## 5. 结论一句话

**A2/A3 现在验不了；最小接线落在 `electron/controllers/db-controller.ts:1207`（`db:draft-update-content`）——覆盖前读旧正文算 diff，写进 `drafts` 两列或新表，一次迁移 + 一个仓储方法；渲染层、IPC 契约、`review_findings`、ADR 全不动。丙最便宜顺带就有，乙同一处顺手算得，甲要动作级就得前端埋点（`editor-store.ts:424` 已有现成计数，只需落盘）。**

## 6. 未做/未核（只读时间限制）

- 未逐条排空 AI 侧「应用到草稿/按意见修稿」的全部写路径（只核到 `refine-draft.command.ts`、`review-revision-command.ts` 无 `db:` 写正文调用）。
- 未核 `fs:write-file`（终稿物理文件）是否有其他调用方会写 manuscript。
- 未跑任何测试、未起 dev。

<!-- DONE -->
