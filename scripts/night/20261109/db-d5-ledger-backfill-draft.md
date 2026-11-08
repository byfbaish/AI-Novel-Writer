# D5 · 台账回填补记草案（只写现值，不改历史格值）

## 你是谁、在哪
你是豆包，工作目录 = worktree wt-1：C:\develop\workspace\AI-writer\wt-1（分支 agent/wt-1，基线 cd78aaa8）。
只做**只读审计 / 文档 / 设计**，不写产品代码。项目章程：C:\develop\workspace\AI-writer\wt-1\AGENTS.md。

## 这是夜间无人值守任务（03:50–07:00 之间派给你）
- 不要问我问题、不要等确认。信息不足就按最保守口径写，把假设写进报告。
- 时间盒 ≤20 分钟。做完写报告收工；做不完写 BLOCKED 收工。
- 同一时间你可能已有别的任务在跑：**按顺序一件一件做**，做完一件在报告末尾写回执标记。

## 红线
1. 只读代码与文档；**不改**任何产品代码、不 commit / push / merge、不切分支。
2. 不跑测试、不跑 pnpm dev、不跑全量构建。
3. 只在 C:\develop\workspace\AI-writer\wt-1\.batch\night\ 下写报告文件（目录不存在就创建）。
4. 每份报告都可以读 C:\develop\workspace\AI-writer\wt-2\.batch\night\ 下 WorkBuddy 的夜间产物（只读）。
5. 引用一律带 文件:行号；拿不准就写「未核实」，不要猜。

## 交付
报告路径：C:\develop\workspace\AI-writer\wt-1\.batch\night\d5-ledger-backfill-draft.md
正文顺序：一段话结论 → 证据（文件:行 + 原文摘录）→ 正文内容 → 遗留问题。
最后一节必须是 ## [T1] DONE 或 ## [T1] BLOCKED。

## 背景
流程四步：台账抽到看板 → 执行 → 复核 → 状态回填。本夜 WorkBuddy 在做 W1–W6（D10/D11/D12/D15/D20/D21 相关），你在写 D1–D4。回填只写「现值」，历史格值（2026-11-02 快照）一个字都不许改——规矩见 docs/agents/task-board-channel.md §4.6。

## 必读
1. docs/plans/prompt-assembly-backlog.md 的「现值索引」与「本节遗留 8 项裁定」
2. docs/design/product/live-pipeline-acceptance-defects-assessment.md 对应段
3. C:\develop\workspace\AI-writer\wt-2\.batch\night\ 下 W1–W6 报告（没生成就跳过并注明「尚未产出」）

## 要产出
一条一行：D 编号 / 该补什么话（现值一句，含证据 文件:行）/ 落在哪一行或哪个小节 / 是否被裁定卡住（卡住就写明卡在哪项裁定）。
覆盖 D10 / D11 / D12 / D15 / D20 / D21 六条。
最后给一句风险：哪些回填还需要作者点头才能写。
