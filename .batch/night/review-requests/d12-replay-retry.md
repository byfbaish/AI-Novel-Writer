From: 项目总负责人 · AI writer项目组 | 5dfa8c4d
To: QA · AI writer项目组 · 群分身

# 派验单 · D12 短细纲注入形态 + 正文带原因重跑（S1）

- 卡号：`d12-replay-retry`
- 执行方：developer
- 首验方：QA
- 类型：A 类（有仓库提交）
- 卡片：`.batch/night/cards/d12-replay-retry.md`（判据全文以卡面 §4 为准；本单只做索引，`§4` 口径 v3＝2026-11-21 裁定）
- 分支：`card/d12-replay-retry`，起点 `89ec7014`
- 交件：`.batch/night/staging/d12-replay-retry-report.md`（末行 `<!-- DONE -->`）
- 首验单：`.batch/night/reports/d12-replay-retry-qa-firstcheck.md`
- 外派位：**不可外派：实机复验须在 develop 由 developer 执行**（主人 2026-11-21 19:07 裁定；AGENTS 第 8 条）。原外派件 `.batch/night/staging/d12-live-verify-workbuddy-dispatch.md` 已撤回，其产物不作本卡证据。改码、单测、实机、交件归 developer，判定归 QA 与项目总负责人

## 判据索引（逐条对卡面 §4）

1. **§4.1 注入形态（口径 v3，要点不设上限）**：结尾块 ≤300；要点块只报 `notesBlockUnits` 不设阈值；六栏结构完整（常见 394 / 丰富 576 两档完整带入，表行数与伏笔条目数不变）；上一章中段任一整句不在场（中段连续重合 ≤80）；要点为空只出结尾块；第 1 章无前驱块；反向回归——正文请求仍含上一章全文。
2. **§4.2 重跑单测 5 条**：首稿重演+重写干净（`chapter-draft` 请求 2 次、第 2 次＝第 1 次＋`\n\n`＋【修正说明】、无首稿 8 码元片段泄漏、`compose-visible` 1 次且只含最终稿、commit 1 次、候选 0）；两次都重演（候选 1、码 `DRAFT_PREVIOUS_ENDING_REPLAY`、文案含「已自动重写一次」）；首稿干净（请求 1 次、无修正说明）；重写请求本身失败（回退首稿、日志含回退行）；续写/压缩轮不触发。
3. **§4.3 实机**：`node scripts/d12-replay-acceptance.mjs`，贴末行 JSON 与 `evidence.json` 路径。必报字段：`endingBlockUnits≤300`、`notesBlockUnits`（仅记录）、`notesSixColumnsPresent=true`、`notesTableRowsUnchanged=true`、`notesHooksCountUnchanged=true`、`outlineMidMaxOverlapUnits≤80`、`proseContainsFullPrevious=true`、`proseDispatches=2`、`retryHasCorrection=true`、`retryLeaksDraftFragment=false`、`composeCalls=1`、`drafts=1`、`candidates=0`（口径＝`recovery_candidates` 表内**本章**（`chapter_number = 2`）无失败候选行，须实读、报告实测计数）、`endingBlockNonEmpty=true`（段缺失或空串直接不通过，不许把 `endingBlockUnits` 算成 0 过半）。（作废字段：`outlineMaxOverlapUnits`、`notesBlockUnits≤300`、`candidates` 旧措辞「无 `status != finalized` 的第 2 章草稿残留」。）
4. **§4.4 回归门禁**：`pnpm test src/shared/__tests__/draft-short-outline.test.ts src/services/workflows/commands/__tests__/generate-draft.command.test.ts` + `pnpm check:fast` 全绿；既有断言只加不减（`still rejects previous-chapter replay…` 的调用序列扩「多一次正文请求」需在报告点名）。
5. **§4.5 提交纪律**：点名 `git add`、不加两个未跟踪包、不 push/tag/publish/merge。

## 判定纪律

- 只给结论不给命令/输出原文 ⇒ 打回。
- 判词须含「未覆盖项」一栏；未覆盖项不得算通过。
- PASS 后由产品经理把缺陷稿 `:62` 转 ✅（附 evidence 与本判词路径）；执行方不得自行转。
- 发现判据本身矛盾 ⇒ 报项目总负责人，不改判据。
