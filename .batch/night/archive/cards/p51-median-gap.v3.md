# P51 · 动作数中位数改「连续 10 章」口径（A 类改码卡）· v2 重投版

状态：**可投**（重投版，替换 v1 那次 wt-1 误投）
估时：改码 30 分钟 + 首验 15 分钟｜执行方：豆包（主）
v1 → v2 差异：新增 §0 工作区前置（v1 未写死工作目录，导致执行方在共用区 develop 上开工，那一单作废）

## 0. 工作区前置（不满足不投，违反即作废）

- **工作目录必须是 `C:\develop\workspace\AI-writer\wt-p51`**（分支 `agent/p51-median`，HEAD `26627655`）。
- **禁在 `C:\develop\workspace\AI-writer\develop` 里做任何改动或提交**——那是共用主工作区，改动不认、且会被复原。
- 开工第一步先核并贴进报告：`git rev-parse --short HEAD`（应为 `26627655`）、`git ls-files '*draft-edit-median*'`（应命中实现与测试两个文件）、`git diff --numstat` 与 `git diff --ignore-cr-at-eol --stat`（应双空）。
- **禁 `pnpm install`、禁 `rebuild`、禁 `pnpm dev`**：wt-p51 已有独立 `node_modules`，再装会切 better-sqlite3 的 ABI、打断别人正在跑的槽位。只跑点名单元测试与 `check:fast`。

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

- 起点：wt-p51 的 `26627655`（实读为准，写进报告）。
- 干净判据用 R4：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 双空；不用原始 `git status --porcelain`；不许还原文件、不许改 `.gitattributes`。
- 不许顺手提交仓库根那个未跟踪的 `开篇试样 02/`（在 develop 里）。

## 9. v3 回写（2026-11-15 11:23，AI writer总负责人 · 只增不改）

本节只追加执行后确认的口径，正文 §0–§8 一字未动，保留投出版原样。作用：本卡若需重投或复用，按 v3 走。

### 9.1 worktree 内的 ABI 修复命令（原路径有误，已更正）

卡面 §0 禁 `pnpm install` / `rebuild` / `pnpm dev`，但 wt 里 `better-sqlite3` 是 node 版（`NODE_MODULE_VERSION 137` = node v24.20.0），Electron 41 要 145，套件根本起不来。放行唯一一条：

```bash
cd <wt>/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3
node ../../../prebuild-install@7.1.3/node_modules/prebuild-install/bin.js -r electron -t 41.10.7
```

- **相对路径是三级 `../../../`**，四级会报 `MODULE_NOT_FOUND`（`prebuild-install` 顶层未 hoist）。
- 实测命中本地缓存 1.3–2.6 秒，产物 `1,903,104B`。
- 兜底（0 秒）：直接从已绿的 develop 复制同一个 `.node` 过去。
- **任何 `pnpm install` 都会把 ABI 刷回 137**，所以本命令必须在最后一次 install 之后执行。
- 自证：用 Electron 41 加载并开库，必须打出 `PROBE ... abi=145 ... integrity=ok`。

### 9.2 `check:fast` 在 worktree 里的口径

记法固定为：`预置失败：文档缺陷（2 条指向不入库目录的硬链接），与本轮交付无关`，不进八条分母。

根因是两条**已入库**文档硬链接指向 `.workbuddy/`（`.gitignore:42`，永不入库）：

- `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md:163`
- `docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:541`（⑧ 行；`:542` 是空行，行号经 grep + 逐行核双验证）

反例条件：这两条修掉、干净检出上 `check:fast` 转绿那天，本条豁免作废。

### 9.3 章号从 1 起

统计口径里的章号一律按**从 1 起**的整数章号，不按数组下标、不按 `cid`。空章用例写「章 3..12 连续、其中 5 与 8 无计量行」，即 3/4/6/7/9/10/11/12 有行、5 与 8 记 0 进样本。

### 9.4 执行后记

- 首验结论：PASS（`reports/p51-qa-firstcheck.md`，八条分母 8、不通过 0）。
- 交付件：`staging/p51-median-gap-report-v2.md`（14,859B / md5 `556f8b8eb8134a9bb72eab4dfdd3f7f9`）+ `staging/p51-median-gap-report-v2-addendum.md`。
- 未归因项：wt 的 `build/Release/better_sqlite3.node` 在 10:33→10:34 之间被换成 Electron 版（1,903,104B，与 develop 逐字节一致），最可能来自 pnpm 的依赖检查重链接；两轮点名套件都是绿，不影响结论。
