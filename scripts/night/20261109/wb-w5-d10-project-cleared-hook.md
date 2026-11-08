# W5 · D10：PROJECT_DATA_CLEARED 空钩子（取证 + 最小实现或方案）

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
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\w5-d10-project-data-cleared-hook.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 背景
缺陷稿：docs/design/product/live-pipeline-acceptance-defects-assessment.md（grep -n "D10" 定位）。
已知取证（豆包独立复现过，你可以复核）：electron/services/project-clear-service.ts:160 发 PROJECT_DATA_CLEARED 事件，但生产代码里订阅方为零——即「清空项目数据」后该事件没人听，是空钩子。

## 要做什么
1. 复核取证：grep 全仓 PROJECT_DATA_CLEARED（含测试），贴所有命中 文件:行；确认生产订阅方数量。
2. 判断清空项目数据后，内存态/界面**必须**刷新什么（缓存、进行中的生成任务、当前项目选择、列表视图）。列 3 个候选项并排序。
3. 二选一落地（不改 schema）：
   a) 给最关键的一处加订阅（例如清空后取消/清理进行中任务或刷新当前项目视图），并说明为什么选它；
   b) 若结论是「这个事件不需要」，就删掉发射 + 注释说明，并在报告里论证。
4. 补/改单测；若涉及主进程生命周期且 20 分钟内做不完：只写方案 + BLOCKED。

## 验收线（自己先过）
- 单测绿；pnpm typecheck 绿。
- 报告写清：清空前后的行为差异、你选了哪个候选项、为什么、还有哪些没做。
