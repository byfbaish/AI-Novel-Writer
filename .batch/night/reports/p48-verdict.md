# P48 终审（负责人）

- 卡号：P48（A 类，改码）
- 审的是 `wt-2` 上 `agent/wt-2` 分支提交 `26627655c61fd84410412f109edc161537eac950`，父 `0e76f498`，**不是 develop**
- 首验：`.batch/night/reports/p48-qa-firstcheck.md` 7,759B / 106 行 / `600B4E670FCC151C52BEC5714BBC0FC6` / 末行 `<!-- DONE -->`（我核过字节与 MD5，与 QA 自报一致）
- 终审读数：同报告；我另核 `wt-2` HEAD = `26627655`、porcelain 0；`develop` HEAD 仍 `0e76f498`

## 结论：**PASS**

依据（采信 QA 首验 + 我的提交面复核，不重跑 QA 已跑的套件）：
1. 交付面：1 个提交、7 文件 +333 −0、父为 `0e76f498`、未 push、`wt-2` porcelain 干净。
2. 口径五条 5/5：动作数定义不变；按 `chapter_number` 降序取 10 章；标准中位数 + `Math.round`；不足 10 章 `median: null` 且出「样本不足（N/10 章）」；主进程只回三列原始行、聚合在 `src/components/editor/draft-edit-median.ts`（沿用 P37 判例）。
3. 禁改区未动（`src/shared/review-generation-report.ts`、`review-chapter.command.ts`、`generate-draft.command.ts`、docs 禁动区）；`review-edit-metrics.ts` 与 `db:draft-edit-stats` 签名原样。
4. 点名套件 5 文件 52 用例全绿、`check:fast` 全绿（QA 实跑），手算 5 例全中。

## 对 QA 两个待复判点的裁定

### ① 章号断档时「最近 10 章」按有计量行的章取 —— **本卡认可，但口径要改，记 backlog B10**

本卡不改：`draft_edit_stats` 只有发生过编辑的章才有行，「按有行的章取窗」和不取窗只差在断档样本，本轮样例（3..12 连续）不受影响。

但正式口径应改为：**从当前章向前数连续 10 个章号（含当前章），某章没有计量行则该章动作数记 0，样本数取 `min(已有章数, 10)`**。理由：动作数中位数的用途是看「作者改动量有没有上升」，把零动作章跳掉等于把最容易发生的变化藏起来，指标会系统性偏高、且不同书的断档情况不可比。零动作章是真实数据，不是缺失。

⇒ 记为 AI-writer 侧 backlog **B10**（由 大肥鱼 落台账，不进 `plugin-backlog.md`——那份只收插件仓库的事）。

**B10 的性质是行为变更，不是文档口径**（QA 02:30 提醒，我采纳）：`src/components/editor/draft-edit-median.ts:54–60` 现在从「有计量行的章」里取窗口，改连续章号后空章要按 0 进样本（会拉低中位数），**必须改码 + 补一个「中间有断档空章」的用例**。故 B10 单独立改码卡，不并入其他卡凑数；在本卡不返工（现提交按现口径 PASS 有效），但下一轮真机读数前必须落码，否则读数与口径对不上。

### ② 3②（P47）—— 与本题无关，见 `p47-verdict.md`

## 未结项（不拦卡，随下次真机轮）

- 界面那一行只有单测 + i18n 测试，**真机未验**：须在真机轮里看「审稿报告页 P38 三数下面多出一行中位数」且文案/i18n 正常。
- 合并：我让 developer 做 `git merge --ff-only 26627655` 到 `develop`，不 push；合并后回读 develop HEAD 应为 `26627655`、porcelain 空、`@{u}` 未变。

<!-- DONE -->
