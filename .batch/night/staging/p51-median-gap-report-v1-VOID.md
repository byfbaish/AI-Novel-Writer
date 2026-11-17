# P51 · 动作数中位数改「连续 10 章」口径 · 改码回执

`取窗已改成锚点向下连续 10 个章号 / 空章记 0 且进样本 / 新增 5 条用例（原有 6 条 0 删 0 改）/ 点名两套绿 / check:fast 绿 / 未提交（红线 2）`

- 执行方：豆包
- 卡：`.batch/night/cards/p51-median-gap.md`
- 时间：2026-11-15 07:31（+08）
- 类型：A 类（改码卡）

## 0. 投前核对与起点

| 项 | 事实 | 结论 |
| --- | --- | --- |
| 落在哪棵树 | `C:\develop\workspace\AI-writer\wt-1` 是 `agent/wt-1@8c0bd657`，**不含** `draft-edit-median.ts`（P48 只在 `agent/wt-2`）；卡面点名的起点在 `C:\develop\workspace\AI-writer\develop` | 本卡落在 `develop` 工作树（卡面 26627655 的所在树） |
| 起点 HEAD | `26627655c61fd84410412f109edc161537eac950` = 卡面 26627655，P48 已在 develop 上，无需 ff | 与卡面一致 |
| R4 干净判据（开工前） | `git diff --ignore-cr-at-eol --stat` 空、`git diff --numstat` 空 | 干净 |
| 未跟踪 | 只有仓库根 `开篇试样 02/`（卡面点名不许提交） | 未动 |
| 窗口活动任务 | `electron` 进程计数 0（无 `pnpm dev`、无应用进程）；`node` 2 个（06:17 / 06:20 起的常驻进程，非本卡） | 允许投 |

## 1. 改了什么

三个文件，`+93 −20`：

| 文件 | numstat | 改的是什么 |
| --- | --- | --- |
| `src/components/editor/draft-edit-median.ts` | `+35 −18` | 取窗从「按计量行取」改成「锚点向下连续 10 个章号」；`sampleChapters` 改为按章号可达数算 |
| `src/components/editor/__tests__/draft-edit-median.test.ts` | `+52 −0` | 只追加 5 条用例，原有 6 条断言**一个字未动** |
| `src/components/editor/ReviewReport.tsx` | `+6 −2` | 传给纯函数「本章章号」；依赖表加 `chapterNumber`；两段说明性注释 |

新口径的实现（`draft-edit-median.ts` 核心）：

```ts
const anchor = Number.isSafeInteger(currentChapter) && currentChapter >= 1
  ? currentChapter
  : highestChapter            // 不传锚点时退化为「载荷里最大章号」，只为兼容 P48 那批用例
if (anchor < 1) return { median: null, sampleChapters: 0 }

const start = Math.max(1, anchor - size + 1)          // 左端夹到第 1 章
const sampleChapters = anchor - start + 1
if (sampleChapters < size) return { median: null, sampleChapters }   // 「样本不足（N/10 章）」

for (let n = start; n <= anchor; n += 1) {
  counts.push(humanActionsByChapter.get(n) ?? 0)      // 无行 / 断档 / 全 ai —— 三种都记 0 且都进样本
}
```

没动的部分（逐条核对卡面「不动」清单）：中位数定义（`medianOfAscending`）、`Math.round` 取整、聚合位置（仍在渲染层纯函数）、`review-generation-report.ts` 的 `medianActionsLast10` 判定口径、两个 SQL 投影列（仍三列）、`db:draft-edit-stats` / `db:draft-edit-stats-recent-chapters` 两个通道签名、`docs/` 禁动区 —— 全部原样。

## 2. 验收判据逐条指认

| # | 判据 | 指认 | 结论 |
| --- | --- | --- | --- |
| 1 | 空章用例必须存在且在判据里 | 用例 `counts chapters without any metric row as zero actions instead of dropping them`：章 3..12 连续、**5 与 8 无任何行**，其余章动作数取「章号 −3」且章 3 只落过 1 条 ai 行 → 序列 0,0,0,1,3,4,6,7,8,9，第 5、6 个是 3 与 4 → 手算 3.5 → **4**，`{median: 4, sampleChapters: 10}`。反证：老口径剔掉无行章只剩 8 章 → `{5, 8}`，用例注释写明这条就是拦那次退化 | 通过 |
| 2 | 章号断档 / 不足 10 个章号 | 断档：`fills chapter-number gaps with zero and still takes a full 10 chapter numbers`（只有 3、4、7..12，锚点 12 → 3..12 补齐、缺号记 0 → `{6, 10}`，样本是 **10 章不是 8 章**）。不足：`reports insufficient samples when the anchor is below 10 consecutive chapter numbers`（全书 12 章、审第 5 章 → 连续章号 1..5 → `{median: null, sampleChapters: 5}`）；UI 文案由 `ReviewReport.tsx:1389` 用 `sampleChapters` 拼「样本不足（5/10 章）」，该行未改 | 通过 |
| 3 | 全 ai 行章仍算 0 动作 | 原用例 `treats all-AI rows as zero author actions but keeps the chapters as samples` 保留且绿；新增 `keeps a chapter with only AI rows as a zero-action sample`（章 9 只有 2 条 ai 行 → 记 0 仍进样本 → `{2, 10}`；若把全 ai 章排除只剩 9 章 → null） | 通过 |
| 4 | 原有 5 个手算例结果一个都不许变 | 测试文件 numstat 是 `52 0` —— **0 行删除、0 行修改**，原有 6 条断言原样；两套跑完 11/11 绿（6 旧 + 5 新） | 通过 |
| 5 | 点名套件全绿 | 见 §3 两段原文，均 `Test Files 1 passed` | 通过（跑法见 §5 红线冲突） |
| 6 | `pnpm check:fast` 全绿 | 见 §3 第 3 段原文：typecheck ✓ / doc-links 1470 检查 0 broken / doc-placement 新增 0 条 | 通过 |
| 7 | 报告落盘 + `<!-- DONE -->` + 起点/终点 HEAD + numstat + 套件原文 | 本文件即交付；终点 HEAD = 起点 HEAD（未提交，见 §5）；numstat 见 §1、§4 | 通过（`git add` 未做，见 §5） |

## 3. 套件输出原文

（1）纯函数用例 —— `node node_modules/vitest/vitest.mjs run src/components/editor/__tests__/draft-edit-median.test.ts`：

```
 RUN  v4.1.11 C:/develop/workspace/AI-writer/develop

 ✓ src/components/editor/__tests__/draft-edit-median.test.ts (11 tests) 5ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  1.11s (transform 79ms, setup 200ms, import 29ms, tests 5ms, environment 0ms)
```

（2）仓储用例 —— `ELECTRON_RUN_AS_NODE=1 <electron.exe> node_modules/vitest/vitest.mjs run electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts`：

```
 RUN  v4.1.11 C:/develop/workspace/AI-writer/develop

 ✓ electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts (1 test) 169ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  1.37s (transform 320ms, setup 110ms, import 763ms, tests 169ms, environment 0ms)
```

（该条在 `node vitest` 下无法加载：`better-sqlite3 ... NODE_MODULE_VERSION 145. This version of Node.js requires 127`，故按仓库既有一份 ABI 的口径走 Electron-as-node，见 §5。）

（3）闸门 —— `pnpm check:fast`：

```
[check:fast] typecheck ✓ 21.7s
doc links: checked 1470, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
```

## 4. 干净判据与 numstat

- 起点 HEAD：`26627655c61fd84410412f109edc161537eac950`
- 终点 HEAD：`26627655c61fd84410412f109edc161537eac950`（**未提交**：红线 2 禁一切 git 写操作，改动留在工作树）
- `git diff --numstat`：

```
6	2	src/components/editor/ReviewReport.tsx
52	0	src/components/editor/__tests__/draft-edit-median.test.ts
35	18	src/components/editor/draft-edit-median.ts
```

- `git diff --ignore-cr-at-eol --stat`：3 files changed, 93 insertions(+), 20 deletions(-)
- 工作树里除本卡 3 个 M 之外，只有仓库根未跟踪的 `开篇试样 02/`（未动，未提交）

## 5. 红线冲突与实操选择（需裁）

1. **卡 §4.7 要求一次点名 `git add`**，注入红线 2 禁一切 git 写操作（add/commit 均禁）⇒ **未 add、未 commit**。终点 HEAD 与起点同值；改动是 3 个 M 文件，提交权留给收口方。
2. **卡 §4.5 要求 `pnpm test ...`**，注入红线 1 禁 `pnpm test` ⇒ 换成单文件 `node node_modules/vitest/vitest.mjs run <单文件>`。纯函数用例在 Node 运行时直接通过；仓储用例撞 `better-sqlite3` ABI（Electron 145 / Node 127），改成同一条通道的 `ELECTRON_RUN_AS_NODE=1 electron vitest.mjs run <单文件>`（即 `scripts/run-tests-electron.mjs` 所做的同一件事：不起 Chromium、不起应用、不切 ABI）。若收口方要求严格只认 `pnpm test`，请用该命令复核这两条，结论应一致。
3. **未跑 `*.browser.tsx`**（红线 1 禁）。因此 `ReviewReport.tsx` 的传参改动只有 typecheck 覆盖，没有浏览器断言覆盖 —— 已确认 `src/` 下没有任何 browser 用例断言 `data-review-median-sample` 或中位数文案，不存在被本卡改动打红的既有浏览器断言。

## 6. 发现（红线 3：只写报告，不改）

### 6.1 取数口径没跟着改，审「非最新章」时窗口会被大面积记 0 —— 本次最值得下一张卡处理的问题

`DraftEditStatsRepository.listRecentChaptersForProject`（SQL 原样，属本卡禁改区）返回的是**项目内章号降序最近 10 个「有计量行」的章**，而新窗口是「当前章向前连续 10 个章号」。两者不再同源：

- 接算例：书里第 1..20 章都有计量行，审第 12 章 → 载荷 = 第 20..11 章，窗口 = 第 3..12 章 ⇒ 第 3..10 章（8 个章号）根本不在载荷里，被记 0；样本仍报 `10/10`，于是「样本不足」都不会提示，读数直接往 0 掉。
- 影响面：只在「审的章不是全书最后一章」时出现；审最新章（常见路径）两口径重合，读数正确。方向与 P48 的老毛病相反（老：偏高；新：可能偏低到 0），比偏高更隐蔽。
- 两条可选修法（都超出本卡授权，未实施）：
  - A（正解）：把锚点带进 `db:draft-edit-stats-recent-chapters`，SQL 改按 `chapter_number between anchor-9 and anchor` 取行 —— 要改通道签名，卡面明令禁改。
  - B（绕行）：渲染层把 `chapterLimit` 放大到覆盖窗口（至少 `anchor` + 未来章数）。卡面允许改「传参」，代价是每本书多拉行、3s 超时未实测，故未擅自改。

### 6.2 `chapterNumber` 缺失时的退化

`ReviewReport.tsx` 的老标签可能还没填 `chapterNumber`（`DraftEditor` 的 `captureFinalizationSnapshot` 注释自陈），此时传 `undefined`，纯函数退化为「载荷里最大章号」取窗 —— 与 P48 行为等价，不会算出负章号，也不会比改前更差；但若恰是「旧章报告 + 标签缺章号」，会按新章窗口算（§6.1 的另一张面孔）。

### 6.3 章号 < 1 的计量行不再进样本

P48 只校验 `Number.isSafeInteger`；本卡为「窗口左端夹到第 1 章」加了 `chapterNumber < 1 continue`。后果：章号 0 / 负数的计量行既不进样本也不进计数。`drafts.chapter_number` 为 1 起，本次读取的文件内未找到会产生 0 号章号的写入路径；若库内存在历史脏行，读数会与 P48 不同（**不确定**，未取库验证）。

## 7. 未做 / 不确定

- 未跑全量、未跑 `test:node`、未跑任何 `*.browser.tsx`、未跑 `pnpm dev`（红线 1）。
- 未做 git add / commit / push / tag（红线 2）。
- §6.1 的实机读数（真实库里审非最新章会掉多少）**不确定**：本卡只跑了纯函数与仓储单测，没有对任何真实项目库取过量。
- `docs/` 未改（禁动区）；本卡不含任何规则/文档层改动，故无 ADR 或台账同步项。

<!-- DONE -->
