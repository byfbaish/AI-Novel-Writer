# 夜跑 11-11 · WB-17 收工材料：一条命令汇总 wt-2 全部未提交改动（只读）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：**以你 claim 到的那张为准**，报告写到 `wt-2\.dsh-task-board\reports\e55f68df-2a21-4c2e-8e13-0b36788e2763.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」，再动手）
1. **纯只读**：不改任何文件（唯一产物是报告）。
2. 不跑测试/构建/dev。
3. 禁一切 git 写（`git status` / `git diff` / `git log` 只读，允许）。
4. 禁 `done`；禁自证文件。

## 背景
今晚 wt-2 上陆续落了多张卡的改动，Lead 收工时要把它们**按卡切开、逐块审、分提交**。现在这些改动全悬在工作区里、混在一起。本卡把它们整理成可直接照着执行的「收工材料」。

## 任务（T1）
1. 跑 `git -C C:\develop\workspace\AI-writer\wt-2 status --short` 与 `git diff --stat`，把**每个改动文件**列出来。
2. 对每个文件判「属于哪张卡」，依据是今晚各卡报告里的「改动清单」段（报告在 `wt-2\.dsh-task-board\reports\*.md`，按卡 ID 文件名对应）。给：`文件 | 卡 ID | 报告里声明的改动 | 实际 diff 行数（+/-）| 是否与声明一致`。
3. 特别标注：
   - **未跟踪文件**（`??`）是新建还是复制进来的；
   - 有没有**没有任何卡认领**的改动（无主改动）——这类必须单独列出并写明「无主，需 Lead 裁决」；
   - `?? .batch/` 这类**不该提交**的产物目录（明确标注「不入库」）。
4. 给出一条**可直接执行的建议命令序列**（`git add` 哪些、按什么顺序提交、每条提交信息建议）。命令只写在报告里，**不要执行**。
5. 附「提交前必查」清单：哪些文件跨卡共用、哪些改动彼此有依赖顺序。

## 验收
- 每个 `M` / `??` 文件都必须出现在表里，一个不漏（以 `git status --short` 原样输出为基准逐行核对）。
- 「无主改动」与「不入库产物」必须显式标注。
- 贴 `git status --short` 与 `git diff --stat` 的原样输出（**完整，不许截断**）。

## 交付
四段报告：结论（可直接提交 / 需先裁决哪几条）/ 改动清单（本卡无改动）/ 原始输出 / 未做项。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag e55f68df-2a21-4c2e-8e13-0b36788e2763 --add review --remove external --release --agent workbuddy:worker`

