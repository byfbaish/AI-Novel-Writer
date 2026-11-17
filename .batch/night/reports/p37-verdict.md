# P37 终审 · 报表读取面只读取证

- 判定：**PASS**
- 判定人：AI writer总负责人
- 对象：`.batch/night/reports/p37-report-surface.md`（**改注记后 10,154B / 107 行 / MD5 `8CADDC2ED81BE9234CD9C3994A7286B4`**；初版 9,647B / 101 行已被同一份覆盖，判定针对改后版，四问与证据行号逐条重看过），起点 HEAD `66b188f8`
- 卡面 `.batch/night/cards/p37-report-surface.md`（2,337B）、派验单 `.batch/night/review-requests/P37.md`（1,123B）

## 我抽查的四条（不采信自述）

1. `generate-draft.command.ts:1626` 的定则原文成立：`// **只写日志，不抛错、不落库、不进审稿报告**——平台是可换的属性…`；`:1633` / `:1636-1646` 的测量与 `callbacks.log` 行号与报告一致。
2. `draft_edit_stats` 的读方确实只有测试：`git grep` 命中的生产代码只有 `m30-draft-edit-stats.ts`（建表）、`project-clear-repository.ts`（清理）、`db-controller.ts:1253`（写入）；`listForDraft` 唯一调用在 `m30-draft-edit-stats.test.ts:90`。⇒ **零生产读方**成立。
3. `EditorArea.tsx:24` 确实 `import ReviewReport from '../editor/ReviewReport'`、`:792` 渲染点存在。
4. 候选 3（塞进报告 JSON）判不可行成立：`review-chapter.command.ts:206` 明写 `No fields outside these contracts`，且两次无效即不存报告 ⇒ 要走这条路必须升 `CURRENT_REVIEW_REPORT_VERSION`，与「最小改动」相悖。

## 我的裁决

- **路线选候选 2**：主进程只返回原始行，口径计算放渲染层。
  理由：①口径在验收期还会动（A2 是 `changed_chars > 0`，将来可能加 `origin` 过滤），放渲染层改一次不动主进程；②纯函数好写单测，不必为口径造 IPC 桩；③单章行数通常几行到几十行，传输量可忽略。
- 候选 1 的「聚合在主进程」不取，理由同上；若将来行数变多（比如按项目全量算中位数）再挪。
- 候选 3 判死；**不许动 AI 报告 JSON 合同**，这条写进 P38 禁动区。
- **口径陷阱采纳（报告 §L83-87，developer 自己的发现，非联络人提示；我据此改 P38 口径）**：`db-controller.ts:1255-1256` 缺省记 `ai`（`origin: origin === 'human' ? 'human' : 'ai'`），所以甲（动作数）不能 `COUNT(*)`。定口径：**保存次数 = 全部行数；作者动作数 = `origin='human' AND changed_chars > 0` 的行数；千字改动 = 只用 `origin='human'` 行算 `sum(changed_chars) / sum(new_chars) * 1000`**。AI 修稿不混入作者读数，页面上用一行小字注明「仅统计作者本人改动」。
- 第五节（10 章中位数）**本轮不做**：A2/A3 升 ✅ 只需要单章三数可见；10 章中位数等 G-C 真跑起来再议，记 backlog。
- 未确认项三条我都接受现状：①「生成记录」面板是另一个分支，与本卡无关，不做；②`callbacks.log` 是否持久化不影响本裁决；③「本次定稿以来截断」属口径，本轮取「该 draft 的全部行」，写在报告里说明。

## 后续

- 开 **P38**（改码，候选 2）：`.batch/night/cards/p38-edit-stats-report.md`，估时 45 分钟，起点 `66b188f8`。
- P38 过 QA 后，A2/A3 在验收文档里从 🟡 升 ✅，G-A 从「部分可验」升「可验（除 A4 需作者观察）」。

<!-- DONE -->
