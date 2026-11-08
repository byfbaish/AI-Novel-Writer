# D6 · 晨间 digest（一页，给作者 07:00 后看）

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
报告路径：C:\develop\workspace\AI-writer\wt-1\.batch\night\d6-morning-digest.md
正文顺序：一段话结论 → 证据（文件:行 + 原文摘录）→ 正文内容 → 遗留问题。
最后一节必须是 ## [T1] DONE 或 ## [T1] BLOCKED。

## 要产出
1. 读 C:\develop\workspace\AI-writer\wt-2\.batch\night\ 下 W1–W6 与 REVIEW-0700.md（哪份缺就注明），读自己 D1–D5 报告。
2. 一页 digest：
   - 状态表：任务 / 声明状态 / 是否有 diff / 测试结果 / 一句话结论。
   - 夜里发现的坑与意外（最多 5 条）。
   - 作者明早需要拍板的事（3–5 条，每条一句话 + 推荐）。
   - 需要人工复查的可疑点（虚报、证据不足、越界文件）。
3. 不许美化：BLOCKED 就是 BLOCKED，缺报告就是缺。
