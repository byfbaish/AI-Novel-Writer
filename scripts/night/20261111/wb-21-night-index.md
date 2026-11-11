# 夜跑 11-11 · WB-21 把今晚的卡 ID 映射整理成台账索引（纯新增文档）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`e7de142f-1629-465a-a937-c50f48205c4b`，报告写到 `wt-2\.dsh-task-board\reports\e7de142f-1629-465a-a937-c50f48205c4b.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」）
1. 只新建**一个**文档（见交付），不改任何既有文件、不删任何东西。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自建证据文件。

## 为什么做这个
今晚一共建了 30 多张外部卡。到早上，「某张卡对应哪份报告、判了什么、要不要作者拍板」散落在看板、两个工作区的 `reports/` 目录和一堆派单书里。**索引不建，明天就得重新翻一遍。**

## 任务（T1）
1. 用看板 CLI 把**今晚（11-11，01:00 以后创建）**的全部卡拉出来：
   `node …\dsh-task-board.mjs list --query "夜跑 11-11" --json`
2. 对每张卡输出一行：`卡 ID（全 uuid）| 标题 | 最终状态（done / todo / running / failed）| 判定（从报告末行 `## [T1] DONE|BLOCKED|REWORK` 读）| 报告绝对路径 | 报告字节数 | 是否需作者拍板（报告里出现「待作者裁定 / 需 Lead 裁决 / 待拍板」字样 ⇒ 是）`。
3. 「需作者拍板」的，再单列一页：`卡 | 问题（≤40 字）| 选项 | 报告里的推荐`。
4. 统计：总卡数 / done / 非 done / 有报告 / 缺报告。
5. **缺报告**的卡必须显式列出（这是最要紧的一列——它意味着「卡跑了但没留证据」）。

## 交付（只新建这一个文档）
`C:\develop\workspace\AI-writer\wt-2\.batch\night\NIGHT-INDEX-20261111.md`
结构：
```
# 夜跑 11-11 卡索引
## 0. 统计
## 1. 全卡表（卡ID / 标题 / 状态 / 判定 / 报告路径 / 字节 / 需拍板）
## 2. 缺报告清单
## 3. 需作者拍板清单
```

## 验收
- 卡数必须与 `list --query "夜跑 11-11" --json` 返回的条数一致（把该数字写进报告，作为对账基准）。
- 每条「判定」必须来自报告末行原文，不许推断。
- 贴 `list --query` 的原样输出行数（`$r.tasks.Count`）作为对账证据。

## 卡报告（另写）
四段：结论 / 改动清单（新建 1 个文件 + 行数）/ 原始输出 / 未做项。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag `e7de142f-1629-465a-a937-c50f48205c4b` --add review --remove external --release --agent workbuddy:worker`
