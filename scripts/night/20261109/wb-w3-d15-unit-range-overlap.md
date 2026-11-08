# W3 · D15：大纲批量单元区间重叠「只报不拦」

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
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\w3-d15-unit-range-overlap-report-only.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 背景
缺陷稿：docs/design/product/live-pipeline-acceptance-defects-assessment.md（grep -n "D15" 定位）；台账现值索引在 docs/plans/prompt-assembly-backlog.md。
作者 2026-11-09 裁定：单元区间重叠 **只报不拦**（不要阻断批量执行，只给提示）。

## 要做什么
1. 定位大纲批量「旧章区间模式」的单元区间：grep synopsisRange / synopsisUnit / range.from / range.to / chapterRange。
2. 写一个纯函数检测重叠（输入区间列表，输出重叠对 + 重叠章号），放 src/shared/ 或就近模块，**必须有单测**（覆盖：无重叠 / 相邻不算重叠 / 完全包含 / 部分重叠）。
3. 接在规划完成之后：只记一条 warning（复用现有 warning / console.warn 通道；不新增错误码、不弹阻断框、不 throw）。若现有代码里已有「重叠就拦」，按裁定改成放行 + 提示，并在报告里明确这是行为变更。
4. 不新增 IPC、不改 schema。

## 验收线（自己先过）
- 纯函数单测绿；pnpm typecheck 绿。
- 报告写清：检测函数在哪、接在哪个调用点、命中时输出到哪、会不会阻断（必须写「不阻断」）。
