# W4 · D20：检查点失配报错区分「模板变了」和「源事实变了」

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
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\w4-d20-checkpoint-mismatch-reason.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 背景
缺陷稿：docs/design/product/live-pipeline-acceptance-defects-assessment.md（grep -n "D20" 定位）。
缺陷：检查点（checkpoint）失配时报同一条错误，作者分不清是「模板/提示词结构变了」还是「源事实（项目数据）变了」，不知道该改哪边。

## 要做什么
1. grep 检查点相关实现与错误：checkpoint / 检查点 / CHECKPOINT / 源事实 / templateHash / sourceHash / promptVersion。
2. 找到失配判定的位置，看现有输入里是否同时有「模板侧指纹」和「源事实侧指纹」。
3. 最小改动：让错误可区分——优先在错误消息里带原因（变了的是模板 / 变了的是源事实 / 两者都变），或复用现有错误码注册方式拆成两条；**不要大规模改契约**。
4. 补单测，覆盖两条分支（模板变 / 源事实变），断言消息或 code 能区分。
5. 若两侧指纹根本拿不到：BLOCKED，说明要补什么数据、影响面多大。

## 验收线（自己先过）
- 单测绿；pnpm typecheck 绿。
- 报告贴改动前后的错误文案对比 + 判定代码 文件:行。
