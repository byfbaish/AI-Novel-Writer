# P51 · 动作数中位数改「连续 10 章」口径（A 类改码卡）

状态：**可投** · 须等 P50-fix3 收口后（投前确认窗口内无 running）
估时：改码 30 分钟 + 首验 15 分钟｜执行方：豆包（主）/ WorkBuddy（备，需 `--cwd` 落 wt-2 时另议）

## 1. 起因（B10，已入台账）

P48 已落 `medianActionsLast10`，但取窗是「从**有计量行**的章里取最近 10 个」。空章（没有任何 `draft_edit_stats` 行）被跳过，于是零动作章不进样本 ⇒ 中位数系统性偏高、不同书的断档情况不可比。
A2 的用途是看「作者改动量有没有上升」，**零动作章是真实数据，不是缺失**。

## 2. 要改成什么（唯一口径）

当前章向前数**连续 10 个章号**（含当前章）；某章没有计量行 ⇒ 该章动作数记 **0**、进样本；样本数 = `min(已有章数, 10)`；不足 10 章仍 `median: null` + 「样本不足（N/10 章）」（N 为连续章号可达的章数）。
中位数定义、`Math.round` 取整、聚合位置（渲染层纯函数）、主进程只回原始行——**全部沿用 P48，不动**。

## 3. 落点与禁改区

- 改：`src/components/editor/draft-edit-median.ts`（现取窗在 `:54–60`）、必要时 `src/components/editor/ReviewReport.tsx` 的传参。
- 补用例：`src/components/editor/__tests__/draft-edit-median.test.ts`。
- **禁改**：`src/shared/review-generation-report.ts`、`src/services/workflows/commands/review-chapter.command.ts`、`src/services/workflows/commands/generate-draft.command.ts`、`electron/controllers/db-controller.ts` 的 SQL 投影列（仍只三列）、`db:draft-edit-stats` 与 `db:draft-edit-stats-recent-chapters` 两个通道签名、docs 禁动区。

## 4. 验收判据（必须逐条能指认，缺一条即不通过）

1. **空章用例必须存在且在判据里**：构造「章 3..12 连续、其中 5 与 8 无任何行」的样本，断言样本数 = 10、动作数序列里 5 与 8 各记 0、中位数等于把 0 计入后的手算值。**只改算法、不补这个用例 ⇒ 判不通过。**
2. 章号有断档（如只有 3,4,7..12）时：以当前章为起点向前连续编号，缺号章记 0，仍取满 10 个章号；不足 10 个章号 ⇒ `median: null` + 「样本不足（N/10 章）」。
3. 全 ai 行的章仍算 0 动作（P48 行为，不得因本次改动退化）。
4. 10 章整、无空章的原有 5 个手算例结果**一个都不许变**（回归证据：跑原有用例全绿）。
5. 点名套件：`pnpm test src/components/editor/__tests__/draft-edit-median.test.ts electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts` 全绿；禁 `node vitest`、禁全量、禁 `test:browser`。
6. `pnpm check:fast` 全绿。
7. 一次点名 `git add` 只加本卡动过的文件；禁 push/tag/publish；报告落 `.batch/night/staging/p51-median-gap-report.md`，末行 `<!-- DONE -->`，并写起点 HEAD、终点 HEAD、`--numstat`、套件输出原文。

## 5. 起点与自证

- 起点：`develop` 的 `26627655`（若 P48 已 ff 进 develop，以 `git rev-parse HEAD` 实读为准，写进报告）。
- 干净判据用 R4：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 双空；不用原始 `git status --porcelain`；不许还原文件、不许改 `.gitattributes`。
- 不许顺手提交仓库根那个未跟踪的 `开篇试样 02/`。
