# 夜跑 11-11 · DB-7 备用：D17 交叉自检（只在被释放时做）

你是豆包。本卡是**备用卡**，只有 Lead 显式 `tag <卡ID> --add external` 释放后才可认领。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 材料目录：`C:\develop\workspace\AI-writer\wt-1\.runtime\crosscheck\WB-3\`（Lead 放 `report.md` + `diff.patch`）
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：40 分钟；材料缺失 → `BLOCKED`。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读；零改动。
2. 不跑测试/构建。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 任务（D17 的「不知道 vs 全改」是否真的分开了）
1. 读 WB-3 的 patch，找出它如何表示「本次覆盖章集未知」与「全部章节都改了」两种状态。
2. 判断：两者是否在**数据层可区分**（不同值/不同字段/不同枚举），而不只是 UI 文案不同；若只是文案不同 → 判 `REWORK`。
3. 检查空集语义：`changedChapters` 为空集现在代表什么？是否还存在「空集 = 不知道」的旧读法（grep 所有消费点）。
4. 给一行判定：`PASS` / `REWORK（一句原因）`。

## 验收
- 结论行 + 两种状态的数据表示原文（引用 patch/源码行）+ 消费点清单（文件:行号）。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
