# P34 · 定稿编辑动作计数：可行性取证（只读）

> 派：AI writer总负责人 · 2026-11-14 · 估时 20 分钟 · 类：只读取证（不产生提交、不改码）
> 起点：`9070999c`（主线 `exp/resource-ledger`）
> 来源：`market-quality-acceptance.md` G-A 的 A2/A3 无采集点（大肥鱼核出 `editCount|edit_count|manualEdit|改动字数|reviewEdit` 全库 0 命中）

## 一、要回答的问题（四条，逐条给结论 + 行号）

1. **定稿编辑到底发生在哪**：从草稿生成到「定稿」之间，作者在界面上改字，落盘路径是哪一条？（编辑器组件 → store → IPC → 主进程写章节文件）把这条链的每一跳点名，带 `file:line`。
2. **现有最近邻事件是什么**：仓库里已经有「保存章节」「草稿台账」这类记录（如 `chapter-card-draft-ledger`），它们记了什么字段？能不能在不改契约的前提下兼作编辑计数？
3. **能否零侵入计数**：若在编辑器侧记账（每次编辑动作或每次保存的 diff 字数），需要新增什么？最小改动面是哪个文件？会不会动到 `review_findings`、v2 契约、既有 ADR？
4. **三种口径各要什么**：
   - 口径甲：动作数（改段/改句/删段/重写次数）
   - 口径乙：改动千字率（人工改动字数 / 章字数）
   - 口径丙：保存次数（最粗）
   分别给出「现在能不能直接算」「要接线才有」「算不了」三种判定，并说明为什么。

## 二、硬约束

- **只读**：不新建文件到仓库（本报告除外，落 `.batch/night/reports/`）、不改 `src/`、不跑 `pnpm dev`。
- 禁动区照旧：`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目。
- 不设计产品方案，只给事实与代价；不要替我决定用哪个口径。
- 不许把「刷新后状态」当结论；查行号必须来自当前 HEAD 的实际文件。

## 三、交付

- 报告：`.batch/night/reports/p34-edit-count-feasibility.md`，末行 `<!-- DONE -->`。
- 报告落盘同一分钟内写信号 `.batch/night/signals/workbuddy/p34-edit-count-feasibility.done`（94B 以内，一行路径 + 一行结论）。
- 报告中必须有一节「结论一句话」：A2/A3 现在能不能验？不能的话，最小接线是什么、落在哪。

<!-- 卡面完 -->
