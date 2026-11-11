# 夜跑 11-11 · DB-10 把台账「D 系列快照格 vs 现值格」逐行建表（只读 + 只写报告）

你是豆包。本卡由 Lead 直接释放为 external，可以立刻认领。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\d95d7ddf-a08a-403e-b2b8-d99467654e0d.md`
- 时间盒：35 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读 + 只写报告；零代码/文档改动。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景（今晚真实踩到的坑）
`docs/plans/prompt-assembly-backlog.md` 同一份文件里，`D1`–`D21` 每个缺陷有**两类行**：
- **快照行**：2026-11-02 冻结快照（列头附近有明写「快照」的表）；
- **现值索引行**：今晚之前陆续回填的现值。

今晚 WB-3 只读了快照行，把「D17 已结项」判成「未开工」，整张卡 BLOCKED；DB-7 复核才发现这是「过期快照 vs 现值」的索引冲突。**现在要把它一次性摊平。**

## 任务（T1）：逐行建表
1. 通读 `docs/plans/prompt-assembly-backlog.md`，定位**所有**含 `D` + 编号的表格行（`D1`…`D21`，以及出现的新编号）。
2. 对每个编号给出：`编号 | 快照行号 | 快照格首 30 字 | 现值行号 | 现值格首 40 字 | 两者是否矛盾（一致 / 过期索引入口 / 真冲突 / 只有一处）`。
3. 重点判 `过期索引入口`：快照格与现值格讲的是**同一件事的不同时点**（如「未开工」→「已结项」）⇒ 属索引问题，建议**加括注**而非改字。
4. 重点判 `真冲突`：两处给的是**同一时点上的不同事实**（数字、行号、状态互相打架）⇒ 必须列出并给出哪个更可信（依据）。
5. 对 `只有一处` 的编号给出建议：补快照格 / 补现值格 / 无需补。

## 验收（必须做到）
- 表格覆盖 `D1`–`D21` **全部 21 个编号**，一个不许漏；漏一个要在报告里明写「未找到」。
- 每行都必须有真实行号，**不许凭印象填**；行号用 `Select-String -Path docs\plans\prompt-assembly-backlog.md -Pattern '\|\s*D17'` 一类命令核出来，并在报告末尾贴 3 条代表性命令的原样输出。
- `真冲突` 与 `过期索引入口` 两类必须分开统计，给出条数。

## 交付
四段报告（改动清单写「无」）+ 汇总数字（共 N 个编号 / 一致 a / 过期索引 b / 真冲突 c / 只有一处 d）+ `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag d95d7ddf-a08a-403e-b2b8-d99467654e0d --add review --remove external --release --agent doubao
```


