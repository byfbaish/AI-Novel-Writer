# 夜跑 11-11 · WB-3 D17 大纲提交记覆盖章区间

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：60 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只改本卡点名的文件 + 其单测；不碰 `develop` / `wt-1` / `wt-3`。
2. 只跑单测：`node node_modules/vitest/vitest.mjs run <单文件>`；禁全量 / `test:browser` / `test:node` / `pnpm dev`；允许 `pnpm typecheck`。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
台账 `docs/plans/prompt-assembly-backlog.md:114`（D17）：
> 生成路径提交大纲不记覆盖章区间（`changedChapters` 恒空集）⇒ 失效判定退化为「整本大纲都改了」；每追加一批大纲，此前所有已定稿章/蓝图/交接单全进处置清单。预演与实测一致，机制成功，缺的是输入章集。
> 修法：① `commitSynopsis` 生成落盘时把本次覆盖区间（`synopsisRange` / 单元 `{from,to}`）写进 `changedChapters`；② 判定侧把「不知道」与「全改」分开呈现。

关键位置：生产调用点 `electron/controllers/db-controller.ts:313` → `ProjectCoreRepository.commitSynopsis(request)`；实现与测试在 `electron/repositories/project-core-repository.ts` 与 `electron/repositories/__tests__/project-core-repository.test.ts:85/97/119/131`、`electron/controllers/__tests__/generation-controller.test.ts:529/662/732/756`；版本流水 `upstream_revision_log`（S6c 期 1，`electron/repositories/upstream-revision-repository.ts`）。

## 任务
1. 先读代码把数据流讲清：`generation-controller` 提交大纲时拿到的「本次覆盖区间」是什么形状（`synopsisRange`？单元 `{from,to}`？两者都有？），以及它现在丢在哪一步（是请求里就没有，还是 repository 落盘时没写）。
2. 实现 ①：让 `commitSynopsis` 落盘时的 `changedChapters` 带上本次覆盖章集（区间→章号集合的展开函数要单测；边界：单章、跨卷、空区间）。
3. 实现 ②：在判定侧（读 `changedChapters` / 版本流水的地方）把「不知道改了什么」与「全部章节都改了」拆成两种呈现，不得再用空集表示「不知道」。
4. 新增/补充单测覆盖：区间写入正确、展开边界、`unknown` vs `coversAll` 两态可区分。
5. 跑点名测试（`project-core-repository.test.ts`、`generation-controller.test.ts`、`upstream-revision-repository.test.ts`）+ `pnpm typecheck`。
6. **禁改 schema / 迁移**：如果实现必须新增列 → 停手 `BLOCKED`，给出为什么现有列不够。

## 验收
- 单测全绿并明确列出新增用例名；typecheck 0。
- 报告里给「改动前/后」的 `changedChapters` 实际内容示例（可来自单测断言）。
- 说明对既有调用方的影响面：列出所有读 `changedChapters` 的位置并逐个说明是否受影响。

## 交付
四段报告 + `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
