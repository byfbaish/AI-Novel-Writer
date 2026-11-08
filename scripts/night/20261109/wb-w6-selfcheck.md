# W6 · 夜间收口自检（复核 W1–W5 的证据自洽性）

## 你是谁、在哪
你是 WorkBuddy，工作目录 = worktree wt-2：C:\develop\workspace\AI-writer\wt-2（分支 agent/wt-2，基线 cd78aaa8）。
项目章程：C:\develop\workspace\AI-writer\develop\AGENTS.md（要守 T0 不变量；本次只跑单测）。

## 这是夜间无人值守任务（03:50–07:00 之间派给你）
- 不要问我问题、不要等我确认。信息不足就选「最保守、不改变现有外部行为」的做法，把假设写进报告。
- 时间盒 ≤20 分钟。做完就写报告收工；做不完写 BLOCKED 收工，不要硬撑，不要把没跑过的测试写成通过。

## 红线（违反即作废）
1. 只改 wt-2 里的文件；不碰 develop、不碰 wt-1/wt-3。
2. 只跑单元测试：pnpm test <具体测试文件路径>（可多个）；**禁止** pnpm test 全量、test:browser、test:node、pnpm dev。
3. 不 commit、不 push、不 merge、不切分支、不 git reset。
4. 不新建 SUMMARY / VERIFICATION / FINAL / DONE 之类的自证文件；本任务只产出下面这一份报告。
5. 改完必须自己跑 pnpm typecheck + 相关单测，贴真实输出（不许编，不许省略失败）。

## 交付
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\w6-selfcheck.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 要做什么
1. 读 C:\develop\workspace\AI-writer\wt-2\.batch\night\ 下 w1 到 w5 的报告（缺哪份就注明缺失）。
2. 在 wt-2 里跑：git status --short、git diff --stat、git diff（只看摘要，不要贴全文）。
3. 逐份核对：
   - 报告声称的改动是否真的出现在 diff 里（点名对不上的）；
   - 报告声称跑的测试是否有可复现命令（命令 + 文件是否真实存在）；
   - 有没有人新建了 SUMMARY / VERIFICATION / FINAL / DONE 之类越界文件（有就列出来）。
4. 把 w1–w5 触及的测试文件跑一遍（命令逐条列出），再跑 pnpm typecheck（**不要**跑全量 pnpm test）。
5. 写汇总表：任务 / 声明状态 / 改动文件数 / 测试结果 / 证据是否自洽 / 可合并性（可直接合并 / 需人看 / 不可信）。
   发现虚报就明确写「不可信」，不要和稀泥。

## 验收线
- 报告里每条结论都有命令或 diff 行号支撑。
- 最后一节 ## [T1] DONE 写明「本夜 w1–w5 里哪几份可信、哪几份需要明早人看」。
