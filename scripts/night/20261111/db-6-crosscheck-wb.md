# 夜跑 11-11 · DB-6 交叉复核 WB-1..WB-3（换身份第二意见）

你是豆包。本卡由 Lead 通过外部看板派发。**只读复核，不改任何东西。**

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 复核材料目录：`C:\develop\workspace\AI-writer\wt-1\.runtime\crosscheck\`（Lead 已放：`WB-1\`、`WB-2\`、`WB-3\` 三个子目录，各含该卡的 `report.md` 与 `diff.patch`）
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：50 分钟；材料缺失 → `BLOCKED`。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读；零改动（不改源码、不改材料、不改他人报告）。
2. 不跑测试/构建；只读文件与 patch。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 任务（对 WB-1 / WB-2 / WB-3 各判一次）
1. **声称 vs 证据**：报告说改了什么、跑了什么、结果如何；`diff.patch` 是否真的包含这些改动；有没有「报告里写了但 patch 里没有」或反之。
2. **测试声明可信度**：报告贴的通过数/退出码，能否从 patch 内容与既有测试结构推断为合理；有没有明显不可能的数字（例如没新增用例却通过数 +N）。
3. **红线合规**：patch 是否只碰该卡点名文件；有没有改断言/迁移/生产契约这种越界。
4. **可合并性**：这个 patch 能不能直接 `git apply` 到主线并保持行为不变？列出风险点（schema / 主进程 / IPC / prompt / 测试隔离）。
5. 每卡给一行判定：`PASS` / `REWORK（原因一行）` / `BLOCKED（缺什么）`。

## 验收
- 三卡各一节，每节含：判定行 + 三条证据（引用 patch 行或报告原文）+ 可合并性结论。
- 最后一张表：`卡 | 判定 | 关键证据 | 建议动作`。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
