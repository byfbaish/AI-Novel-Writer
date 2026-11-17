# P37 · 报表读取面只读取证（A2/A3 最后一公里）

- 卡号：P37（只读，无提交）
- 起点：HEAD `66b188f8cb953edfd9401857b7b76d5f4657212a`
- **行号取自 HEAD `66b188f8`**
- 取证时间：2026-11-14 16:05–16:30

## 结论摘要

1. 用户看到的「审稿报告」= AI 输出的 JSON 合同文本，由工作流生成后按 **review-report 标签页**直接渲染；确认/合并时才写入 `reviews` 表。报告内容**不是从库里聚合出来的**，是 AI 一次性产出的文本。
2. A1 的 `prose-shape.ts` 读数**只进工作流执行日志**，代码里明写不落库、不进报告 —— 与 A2/A3 无共用通道。
3. `draft_edit_stats` **零生产读方**：写方 P35 已接线，读方法 `listForDraft` 只有测试在调。
4. 最小接线面在主进程「新增一个只读通道」+ 报告组件加一块小节（3–5 个文件），**不要动 AI 报告合同**。

---

## 一、审稿报告在哪组装、数据从哪来

**结论**：报告文本由 `review-chapter.command.ts` 调 AI 产出并按合同校验，落成一次性 artifact；渲染层把这段 JSON 文本原样装进 `review-report` 标签页，由 `ReviewReport.tsx` 解析成条目列表。库只在「确认」时才参与（`reviews` 表）。

证据：

- 合同与校验：`src/services/workflows/commands/review-chapter.command.ts:19` `import { CURRENT_REVIEW_REPORT_VERSION, parseReviewGenerationResult } from '../../../shared/review-generation-report'`
- 合同硬句（字段白名单、无多余字段）：`review-chapter.command.ts:206` `'[Hard requirement] Output one complete review JSON with root fields summary, items, goalReviews and stateDelta … No fields outside these contracts, Markdown, explanation, or reasoning.'`
- 两次不合格即不存报告：`review-chapter.command.ts:212-213` `'替代输出仍不符合审稿报告合同'` → `throw new Error(… AI 返回的审稿结果两次均无效 … 未保存报告。)`
- 打开报告（取库记录 + 取文本）：`src/components/editor/DraftEditor.tsx:609-638` `openLatestReview` → `:616` `getLatestReview(chapterDir, meta.version, projectKey)` → `:621` `readDraftBody(formatResourceUri({ kind: 'review', id: latest.id }), …)` → `:625-637` `openFile({ id: 'review-report-…', type: 'review-report', content: reportContent, reviewReport: reportContent, draftId: meta.id, reviewId: latest.id })`
- 读取通道：`src/services/draft-index.ts:272` `ipc.invoke('db:review-get-latest', …)`、`:290` `db:review-list`；文本走 `src/services/resource-protocol.ts:38` `ipc.invokeWithProjectSession(session, 'db:review-get-full', resource.id, session.projectPath)`
- 渲染：`src/components/panels/EditorArea.tsx:791-801` `{activeTab?.type === 'review-report' && … <ReviewReport scrollMemoryKey=… reportText={activeTab.content} draftPath chapterNumber chapterDir reviewId projectKey />}`
- JSON 结构：`src/components/editor/ReviewReport.tsx:65-80` `interface ReviewJSON { goalReview?: unknown; items: Array<{category, severity, goalId?, description, quote?, …}>; summary: string }`
- 落库（确认/合并时）：`src/components/editor/ReviewReport.tsx:726` `ipc.invokeWithProjectSession(projectSession, 'db:review-create', {…})`；通道签名 `src/shared/ipc-channels.ts:1311`

## 二、A1 形态读数现在写在哪

**结论**：只写工作流执行日志，**不落库、不进审稿报告**，代码注释是明确的设计决定。

证据：

- 调用点：`src/services/workflows/commands/generate-draft.command.ts:6` `import { describeProseShapeViolation, measureProseShape } from '../../../shared/prose-shape'`
- 测量：`generate-draft.command.ts:1633` `const proseShape = measureProseShape(cleanDraftText, architectureSource.rhythmProfile)`
- 输出：`generate-draft.command.ts:1636-1646` 拼一行 `段数=… 对白段=… 段长P50=… 最长段=… 句长均值=… 对话占比=…% 命中=…` → `callbacks.log(uiText(…))`；`:1648-1653` 逐条 violation 再各打一行
- 设计定则（原文）：`generate-draft.command.ts:1626-1627` `// **只写日志，不抛错、不落库、不进审稿报告**——平台是可换的属性，一旦落成 findings，作者把番茄改成起点后旧结论全部失效（评估稿 §7.2 定则三）。`
- 位置同一性：`:1623-1625` 说明它与两处退化闸同址（`cleanDraftText` 才是最终落库那版）

推论（对 A2/A3 的意义）：A1 是「文本形态」读数、A2/A3 是「作者动作」计量，两者没有共用落库路径；把 A2/A3 接进报告不能顺带把 A1 带进去，反之亦然。

## 三、`draft_edit_stats` 现在有没有读方

**结论**：**零生产读方**。写方已接（P35），读方法写好了但只有测试在调。

证据（全库 `draft_edit_stats` 命中逐条看过）：

- 建表：`electron/migrations/m30-draft-edit-stats.ts:26-38`（`CREATE TABLE IF NOT EXISTS draft_edit_stats (…)`、`idx_draft_edit_stats_draft ON draft_edit_stats (draft_id, id)`）
- 写入：`electron/controllers/db-controller.ts:1253` `DraftEditStatsRepository.record({ … })`（在 `db:draft-update-content` 收尾处）
- repository：`electron/repositories/draft-edit-stats-repository.ts:30` `export class DraftEditStatsRepository`；`:36` `SELECT COALESCE(MAX(save_count), 0) + 1 AS next FROM draft_edit_stats WHERE draft_id = ?`（写入时取号）；`:40` `INSERT INTO draft_edit_stats …`；`:59` `FROM draft_edit_stats WHERE draft_id = ? ORDER BY id ASC`（`listForDraft`）
- 读取调用点：`listForDraft` 唯一调用 = `electron/migrations/__tests__/m30-draft-edit-stats.test.ts:90` `expect(DraftEditStatsRepository.listForDraft(9, db)).toMatchObject([…])`
- 其他命中都是清理/测试：`electron/repositories/project-clear-repository.ts:46`（`generatedText` 归类）、`:178` `DELETE FROM draft_edit_stats`
- 渲染层：`src/` 下 `draft_edit_stats` **0 命中** ⇒ 界面完全没读过这张表

## 四、最小接线面（候选落点）

**结论**：走「主进程只读通道 + 报告组件加一块」；**别碰 AI 报告 JSON 合同**。

### 候选 1（推荐）：只读通道 + 聚合在主进程

- `electron/repositories/draft-edit-stats-repository.ts`：复用 `listForDraft`，另加一个按 `draft_id` 的聚合方法（返回 `saves` 次数、`changed_chars` 合计、`changed/new` 千字率、按 `origin` 分组）
- `electron/controllers/db-controller.ts`：新增 `ipcMain.handle('db:draft-edit-stats', …)`（只读，套既有 project-session 守卫）
- `src/shared/ipc-channels.ts`：加 1 行通道契约（args = `[draftId, expectedProjectPath]`）
- `src/components/panels/EditorArea.tsx:792`：给 `<ReviewReport>` 多传一个 `draftId={activeTab.draftId}`（`activeTab.draftId` 已在 `DraftEditor.tsx:634` 写入标签页）
- `src/components/editor/ReviewReport.tsx`：报告页顶部/底部加「本章编辑计量」小节，三个数：保存次数、动作数、改动千字率（口径 `changed_chars > 0`、`changed_chars / new_chars * 1000`）

改动面：5 个文件左右，零 schema、零 AI 合同、零迁移。

### 候选 2（口径放渲染层）：IPC 只返回原始行

- 同候选 1，但主进程只返回 `listForDraft` 的行，中位数/千字率在 `ReviewReport.tsx` 里算
- 优点：口径变更不用改主进程、纯函数单测好写；缺点：行数多时传输偏大（单章通常几行到几十行，可接受）

### 候选 3（判不可行）：塞进报告 JSON

- 被合同挡住：`review-chapter.command.ts:206` 明写 `No fields outside these contracts`，`parseReviewGenerationResult` 会因多余字段判无效，`:212-213` 两次无效即「未保存报告」
- 要做得先升 `CURRENT_REVIEW_REPORT_VERSION`（`src/shared/review-generation-report.ts`），会牵动历史报告解析兼容 ⇒ 与本卡「最小改动」相悖，判不可行

### 口径陷阱（接线时必须先定，否则数会脏）

`electron/controllers/db-controller.ts:1255-1256`：`// 缺省必须按 ai 计：update-content 会被 AI 修稿复用，宁可少记人工。` / `origin: origin === 'human' ? 'human' : 'ai',`

⇒ 甲（动作数）若直接 `COUNT(*)`，会把 AI 修稿也算成作者动作；要纯人工必须 `WHERE origin='human'`。乙（千字率）同理：AI 修稿那一笔的 `changed_chars` 是 AI 改的，`origin='ai'` 行应排除或单列。

### 顺带提一句可行但不够的落点

`callbacks.log` 那条链能显示任意文本（`generate-draft.command.ts:1637` 已证明），但审稿是「写完之后」的另一次运行，日志一过就没了，不满足「报告里显示」。

## 五、（可选）跨章聚合有没有现成位置

**结论**：没有现成的「读数聚合位」。`summary_snapshots` 与 `volume_handoffs` 存的都是**文本/JSON**，不带计量列。

证据：`electron/migrations/baseline-schema.ts` 里 `CREATE TABLE IF NOT EXISTS summary_snapshots (… character_states TEXT DEFAULT '', chapter_notes TEXT NOT NULL DEFAULT '', continuity_facts TEXT NOT NULL DEFAULT '[]', character_state_candidates TEXT NOT NULL DEFAULT '[]', source_finalization_id TEXT, source_content_hash TEXT, projection_generation INTEGER, created_at TEXT …)` —— 唯一的 INTEGER 是 `chapter_number`/`projection_generation`，无计数、无字数。

10 章中位数（A2/A3 的验收口径）需要新增一个按 `chapter_number` 区间聚合的查询：可以挂在候选 1 的同一个通道上（多一个参数 `range=last10`），或单开 `db:draft-edit-stats-range`。

## 六、未确认项（需下一步取证）

1. 审稿报告的「生成记录」（`AIOutputPanel.tsx:479` `第${recovery.chapterNumber}章生成记录`）是 recovery/旧正文的展示分支，与本卡四问的报告页不是同一处；是否也要显示计量未定。
2. `callbacks.log` 的落点是否有任何持久化（本次只确认它不进 DB 的报告/统计表），未逐层追到 workflow store 的持久化层。
3. 候选 1 的聚合 SQL 在 `draft_id` 之外是否要按「本次定稿以来」截断，属口径问题，未确认。

<!-- DONE -->
