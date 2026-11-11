# 夜跑 11-11 · DB-12 生产代码里的「静默失败/静默吞错」普查（只读 + 只写报告）

你是豆包。本卡由 Lead 直接释放为 external，可以立刻认领。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\acb9ce53-0d23-47f4-8524-2f253cd59ce8.md`
- 时间盒：45 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读 + 只写报告；零代码/文档改动。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 为什么做这个
D21（取消被当成失败）、D10（清空数据不通知界面）、今日的 `chips.workspace === null` 守卫静默失效 —— 这三个独立事故的**同一个形态**是：**代码在失败路径上什么都没说**。人工一个个撞太慢，做一次系统普查，把「下一批定时炸弹」提前列出来。

## 任务（T1）：普查三类静默
扫描范围（只读）：`electron/**/*.ts`、`src/services/**/*.ts`、`src/stores/**/*.ts`（**排除** `**/__tests__/**`、`**/*.test.ts`、`**/*.browser.tsx`）。

三类都要扫，逐类给「文件:行号 + 原文一行 + 为什么算静默 + 潜在后果」：

- **S1 空 catch**：`catch {}`、`catch (e) {}`、`catch { /* 忽略 */ }` 等**吞掉异常且无任何记录/上报**的位置。
- **S2 兜底默认值掩盖异常**：`?? []` / `?? null` / `?? {}` / `|| []` 出现在**从 IPC / 数据库 / 外部服务返回值**上的位置，且该默认值会让调用方**误判为"没有数据"而非"取数失败"**（今日 7 例 browser 红就是这一类）。
- **S3 守卫条件永远为假**：形如 `if (x && check(x)) throw …` / `const y = obj?.field ?? null; if (y …)` 的**前置校验**，其中被读取的字段/返回值**在本仓库里从来不为真**（判定方法：对每个候选，用 `Select-String` 在 `src`/`electron` 全树搜该字段的**赋值处**，若全树无赋值或赋值恒为 null/undefined ⇒ 判定"恒假"）。

## 验收（硬要求）
- S1 / S2 / S3 各给一张表，每行必须有真实 `文件:行号`，**行号必须来自 `Select-String` 输出，不许凭印象**。
- 每类末尾给：命中总数、其中**建议本轮就修**的（最多 3 条，说明理由）、**纯噪音可忽略**的（举例 2 条并说明为何可忽略）。
- 报告末尾贴 **至少 4 条** `Select-String` 命令的原样输出作为行号依据。
- 只在 `wt-1` 工作区内读；**不要**去读 `wt-2` / `develop` 的源码（版本不同）。

## 提示（不要照抄结论，要自己核）
- S3 的一个已知样本：`scripts/workbuddy/workbuddy-attach.mjs` 里读 `chips.workspace` 做归属校验，而该字段实测恒为 `null` ⇒ 校验静默跳过。这个文件**不在扫描范围**（不是产品代码），只作形态参照。
- 扫 S2 时优先看「renderer 侧读主进程返回值的 store / 面板」，那里最容易把"取数失败"伪装成"没有数据"。

## 交付
四段报告（改动清单写「无」）+ 三张表 + 汇总（S1 n1 / S2 n2 / S3 n3，建议本轮修 m 条）+ `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag acb9ce53-0d23-47f4-8524-2f253cd59ce8 --add review --remove external --release --agent doubao
```

