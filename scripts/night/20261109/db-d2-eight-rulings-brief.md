# D2 · 八项台账裁定决策简报

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
报告路径：C:\develop\workspace\AI-writer\wt-1\.batch\night\d2-eight-rulings-brief.md
正文顺序：一段话结论 → 证据（文件:行 + 原文摘录）→ 正文内容 → 遗留问题。
最后一节必须是 ## [T1] DONE 或 ## [T1] BLOCKED。

## 背景
上批把 backlog D 段降级为「2026-11-02 快照 + 现值索引」，遗留 8 项待作者裁定。作者需要一页能直接拍的简报，不要长篇。

## 必读
1. docs/plans/2026-11-09-d-segment-ledger-rewrite-proposal.md 的 §④ 八项裁定
2. docs/design/product/live-pipeline-acceptance-defects-assessment.md 对应段
3. docs/plans/prompt-assembly-backlog.md 的「现值索引」与「本节遗留 8 项裁定」

## 要产出
每项一块（不超过 6 行）：争点一句话 / 证据（文件:行 + 原文一句）/ 建议选项（含推荐，一句理由）/ 选错会怎样 / 需要作者回答的最小问题（一句话，可回答「是/否」或二选一）。
开头给一张 8 行速览表：编号 / 争点 / 推荐 / 一句话影响。
