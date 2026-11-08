# 07:00 · 夜间产物技术复核（新建干净会话、只读）

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
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\REVIEW-0700.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 特别说明
- 本任务在**新建的干净会话**里执行（后台已经用 --new 开好），你不该看到夜里的派单对话，这是故意的：独立复核。
- **只读**：不 commit、不 push、不 merge、不改产品代码；允许写这一份复核报告。
- 不跑全量测试；只跑你认定的相关单测 + pnpm typecheck。

## 复核范围
1. wt-2 当前未提交改动：git -C C:\develop\workspace\AI-writer\wt-2 status --short、git diff --stat、按文件读 diff。
2. 报告：C:\develop\workspace\AI-writer\wt-2\.batch\night\ 下 w1 到 w6 与 REVIEW 自身的上一版（若有）。
3. 豆包文档产物：C:\develop\workspace\AI-writer\wt-1\.batch\night\ 下 d1 到 d6（只评质量，不改）。

## 每个任务要判的六件事
1. 报告声称的改动是否真在 diff 里（逐文件点名，对不上就是 REWORK 或 不可信）。
2. 独立跑触及的单测（列出命令与原样输出末尾 3 行），pnpm typecheck 结果。
3. 判定：PASS / REWORK（写清改哪一行、为什么）/ BLOCKED（缺什么才能判）。
4. 可合并性：是否只碰声明范围；有无 schema / 主进程 / IPC 契约 / prompt 语义风险。
5. 证据可信度：自洽 / 需复查 / 不可信（虚报）。
6. 有没有越界文件（SUMMARY / VERIFICATION / FINAL / DONE 之类）。

## 输出
报告头行必须写：模型（从界面读到的模型名）、会话是否新建、复核时间。
报告最后一节 ## [T1] DONE，正文含一张表：任务 / 判定 / 关键证据 / 合并建议（明早 Lead 会照这张表逐卡 review）。
