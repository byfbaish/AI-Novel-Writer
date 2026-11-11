# 夜跑 11-11 · DB-5 备用：文档一致性扫描（只在被释放时做）

你是豆包。本卡是**备用卡**，只有 Lead 在窗口里显式释放（`tag <卡ID> --add external`）后才可认领；未被释放时不要认领。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：40 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读 + 只写报告；零代码/文档改动。
2. 不跑测试/构建。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 任务
本夜产出多份报告与状态回填，容易互相矛盾。扫描并列出**文档不一致**：
1. `docs/plans/prompt-assembly-backlog.md` 里 D9 / D17 行的状态与「本夜产物」是否一致。
2. `docs/design/product/live-pipeline-acceptance-defects-assessment.md` 里 D9 / D17 条目与台账是否一致。
3. `docs/handoffs/` 最近 3 份交接稿里对 D9 / B11 / B16 / 存量 browser 红的数字是否互相矛盾。
4. 每处不一致给：文件:行号、两处原文、哪个更可信（依据）。

## 验收
- 不一致清单（可为空，但必须给扫描范围与结论「已扫 N 处，无不一致」）。
- 每条附证据行号。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
