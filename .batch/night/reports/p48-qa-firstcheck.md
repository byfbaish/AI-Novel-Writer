# P48 首验报告（QA）

- 卡号：P48（A 类 · 改码）
- 派验单：`.batch/night/review-requests/P48.md`（2,900B / `EC53C0D84A38B03BFB96BE19D2014A7E`，以负责人 02:05 补记为准）
- 卡面：`.batch/night/cards/p48-median-actions.md`（4,276B）
- 派验人：AI writer总负责人｜首验时限：30 分钟（约 02:35）
- 工作区：`C:\develop\workspace\AI-writer\wt-2`，分支 `agent/wt-2`
- 判定范围：验收口径 1–7 条（我独立复跑 + 独立手算）。**browser 套件本轮不跑**（worktree 并行隔离规则），界面那行留后续真机轮。不并回 develop。

## 1. 提交与基线（我自己读的）

| 项 | 实测 | 结论 |
|---|---|---|
| HEAD | `26627655c61fd84410412f109edc161537eac950` | 与派验单一致 |
| 分支 | `agent/wt-2` | 一致 |
| 父提交 | `0e76f498688c28618e4c597b6d6c4731e599472b` | 与改判起点一致（卡面原写 `8c0bd657` 已作废） |
| 提交数 `0e76f498..HEAD` | **1** | 一次点名提交，未夹带 |
| `diff --numstat 0e76f498 HEAD` | 7 文件，+10/+53/+30/+92/+51/+73/+24 = **+333 −0** | 与派验单逐项一致 |
| push | `@{u}` = `fatal: no upstream configured for branch 'agent/wt-2'` | **未 push** |
| porcelain | 0 行；R4：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均为空 | 工作区干净 |

7 个文件：`electron/controllers/db-controller.ts`(M)、`electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts`(A)、`electron/repositories/draft-edit-stats-repository.ts`(M)、`src/components/editor/ReviewReport.tsx`(M)、`src/components/editor/__tests__/draft-edit-median.test.ts`(A)、`src/components/editor/draft-edit-median.ts`(A)、`src/shared/ipc-channels.ts`(M)。

## 2. 口径五条逐条核（卡面 §2）

| # | 口径 | 落点（文件:行） | 结论 |
|---|---|---|---|
| 1 | 动作数 = `origin='human'` 且 `changed_chars>0` 的行数 | `src/components/editor/draft-edit-median.ts:46-49` | 符合，未改 P38 定义 |
| 2 | 按 `chapter_number` 降序取最近 10 章（含当前章） | `draft-edit-median.ts:54-60`（`sort((l,r)=>r-l).slice(0, windowSize)`） | 符合 |
| 3 | 标准中位数 + 显示 `Math.round` | `draft-edit-median.ts:29-35`（偶数取中间两个平均）、`:71`（`Math.round(...)`） | 符合 |
| 4 | 不足 10 章不硬算，显示「样本不足（N/10 章）」 | `draft-edit-median.ts:61-63`（`window.length < windowSize` ⇒ `median: null`）；`ReviewReport.tsx` 渲染分支 `median === null` | 符合；i18n 兜底也有（`not enough samples (N/10 chapters)`） |
| 5 | 主进程只回原始行，口径在渲染层 | `electron/repositories/draft-edit-stats-repository.ts:78-90`（SQL 只投影三列、取窗，不筛 origin、不计数）；聚合全部在 `draft-edit-median.ts` | 符合 P37 判例 |

## 3. 我独立跑的点名套件（不是抄报告）

```
pnpm test src/components/editor/__tests__/draft-edit-median.test.ts \
  src/components/editor/__tests__/review-edit-metrics.test.ts \
  src/components/editor/__tests__/review-report-i18n.test.tsx \
  electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts \
  electron/controllers/__tests__/db-controller-project-context.test.ts
 Test Files  5 passed (5)
      Tests  52 passed (52)
   Start at  02:13:57
 Duration  3.09s
```

- 与报告自述「5 文件 52 用例全绿」一致；新增纯函数套件 6 用例（卡面要求 ≥5）。
- stderr 里的 `项目上下文已切换，已拒绝跨项目读写` 是 `db-controller-project-context` 的**负向用例**日志，不是失败。
- 未跑 `test:browser`（规则禁），未跑全量。

## 4. 独立手算对照（我自己构造数据，不经执行方测试）

脚本：`wt-2\.batch\night\tmp\qa-p48-median-check.mjs`（`node --experimental-strip-types` 直接 import 被测函数），5 例全中：

| 例 | 数据 | 我手算的期望 | 实测 |
|---|---|---|---|
| 1 · 10 章整 | 10 章各章动作数 1..10（第 10 章另含 1 条 ai、1 条 `changed_chars=0` 应被排除） | 升序 1..10 ⇒ (5+6)/2=5.5 ⇒ round=6，sampleChapters=10 | `{"median":6,"sampleChapters":10}` ✓ |
| 2 · 9 章不足 | 9 章各 2 次 | median=null，sampleChapters=9（不许按 9 章硬算） | `{"median":null,"sampleChapters":9}` ✓ |
| 3 · 12 章取窗 | 每章 n 次，取章号最大的 10 章（3..12） | 3..12 中位=(7+8)/2=7.5 ⇒ round=8 | `{"median":8,"sampleChapters":10}` ✓ |
| 4 · 全 ai 章 | 9 章各 1 次 + 第 10 章只有 ai 行 | ai 章仍是样本、动作数 0 ⇒ 9 个 1 + 1 个 0 ⇒ 中位=1 | `{"median":1,"sampleChapters":10}` ✓ |
| 5 · 脏章号 | 含 `chapter_number=1.5` 的行 | 非安全整数被跳过 ⇒ 只剩 1 章 ⇒ null | `{"median":null,"sampleChapters":1}` ✓ |

## 5. 独立核 SQL 取窗语义（内存库，12 章 × 2 版本）

脚本：`wt-2\.batch\night\tmp\qa-p48-sql-check.cjs`（`node:sqlite`，绕开 better-sqlite3 的 Electron ABI），把被测 SQL 原样喂进 12 章数据：

- 行数 21（10 章 × 2 条 human + 第 12 章 1 条 ai）⇒ **主进程未做任何聚合或筛选**；
- 章集合 `3,4,5,6,7,8,9,10,11,12` ⇒ 窗口取的是章号最大的 10 章，第 1、2 章未进；
- 返回列恰为 `chapter_number,origin,changed_chars` ⇒ 三角色投影，无 `draft_id`/`at`/`save_count` 夹带；
- 第 12 章的 `ai` 行原样返回 ⇒ 未在主进程筛 `origin`（符合口径 1 在渲染层做）；
- `LIMIT 0` 时章数 0（参数守卫 `chapterLimit > 0` 生效）。

## 6. 禁改区与既有口径

- `src/shared/review-generation-report.ts`、`review-chapter.command.ts`、`generate-draft.command.ts`、docs 禁动区：**均不在本提交 diff 内**（7 文件清单见 §1）。
- P38 三数算法与文案：`src/components/editor/review-edit-metrics.ts` **未改**（不在 diff），`db:draft-edit-stats` 通道签名未动（`ipc-channels.ts` 只新增 `DraftEditChapterStatRow` 与新通道，P38 条目 `:977` 原样保留）。
- 新增通道 `db:draft-edit-stats-recent-chapters`：`ipc-channels.ts` 新增契约（入参 `[chapterLimit, expectedProjectPath]`），`db-controller.ts:1276-1285` 挂 `assertRequiredExpectedProjectPath` 项目上下文护栏，与 P38 同一条守卫。

## 7. `pnpm check:fast`

```
[check:fast] typecheck ✓ 34.2s
doc links: checked 1470, broken 0
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
```

## 8. 判定

**PASS（限派验单口径 1–7 条）。**

- 口径五条：5/5 符合；新增通道只回原始行、聚合在渲染层纯函数（P37 判例成立）。
- 点名套件 5 文件 52 用例全绿（我自己跑）；`check:fast` 全绿。
- 手算 5 例（含 10 章整、9 章不足两例必检项）全中；SQL 取窗与「不聚合」独立核过。
- 提交侧：单提交、7 文件 +333 −0、未 push、R4 干净。
- 禁改区未动，P38 三数算法与文案未动。

遗留（不拦本卡，记 backlog）：
1. 界面读数（`近 10 章动作数中位数：…` 与「样本不足（N/10 章）」）只有单测与 i18n 测试，**真机未验**——按派验单，留合并后真机轮；browser 套件本轮规则禁跑。
2. 章号断档时「最近 10 章」按「有计量行的章」取（章的存在性由计量行界定），与「按章号连续取 10 章」不同；卡面未禁止，仅备案待负责人确认口径。
3. 同一章多版本草稿的行会在渲染层按章累加（差分属真实保存动作，非重复计数），已在代码注释写明。

复核证据：`wt-2` 上 `26627655`；`wt-2\.batch\night\tmp\qa-p48-median-check.mjs`、`qa-p48-sql-check.cjs`；点名套件与 `check:fast` 实跑输出见 §3、§7。

<!-- DONE -->
