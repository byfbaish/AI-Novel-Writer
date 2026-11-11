# 夜跑 11-11 · DG 晨间 digest（07:00 前后出）

你是豆包。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 材料：`C:\develop\workspace\AI-writer\wt-1\.runtime\night11\manifest.json`（Lead 放：卡 ID → 标题 → 报告绝对路径 → 状态）；各卡报告在 `wt-1/.dsh-task-board/reports/` 与 `wt-2/.dsh-task-board/reports/`（绝对路径以 manifest 为准）。
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：40 分钟；manifest 缺失 → `BLOCKED`。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读材料 + 只写报告；零改动。
2. 不跑测试/构建。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 任务
产出**一页**晨间 digest（作者 07:00 起一眼能看完）：
1. 结论表：`卡 | 判定（DONE/BLOCKED/REWORK）| 一句话产出 | 是否需作者拍板`。只写有实质结论的卡，缺报告的直接标「缺」。
2. 三个关键发现：本夜最值钱的三条事实（要有数字或文件:行号），不要复述报告标题。
3. 交叉验证：哪些卡的结论互相印证（例：WB-3 的改动被 DB-7 复核为 PASS），哪些互相矛盾（单列）。
4. 待作者拍板清单：每项一行「问题 + 二选一选项 + 推荐」。
5. 收口建议：明早第一件事该干什么（一句）、哪些卡可以直接合、哪些必须重做。

## 验收
- 全文 ≤ 90 行；表格化；没有空话。
- 每条结论必须可追到某份报告或某个文件:行号。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
