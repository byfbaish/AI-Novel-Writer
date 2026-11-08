# W2 · D11：补角色卡提示按批重复堆积

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
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\w2-d11-character-nudge-dedup.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 背景
缺陷稿：C:\develop\workspace\AI-writer\wt-2\docs\design\product\live-pipeline-acceptance-defects-assessment.md（用 grep -n "D11" 定位该段）。
台账现值索引：docs/plans/prompt-assembly-backlog.md 的「现值索引」D11 行。
缺陷：批量创作时「缺失角色卡 / 补角色」提示按批重复堆积——每批都把缺失集合再追加一遍，提示越堆越多，正文 prompt 被挤占。

## 要做什么
1. 定位提示注入点：grep 关键词 角色卡 / 补角色 / characterCard / missingCharacter / 角色档案 / 档案缺失。
2. 判断现状是「每批重算并追加」还是「每批替换」；找出堆积的具体机理（贴文件:行号 + 关键原文）。
3. 改成「每批只注入当前缺失集合、同一角色只出现一次」（或去重），不改这段 prompt 的其他语义。
4. 补单测：优先在已有测试文件里加例；没有就为抽出的纯函数新建一个测试文件（src/**/__tests__/ 下）。
5. 若定位不到明确注入点（提示是模型自己生成的、不在本地拼装）：BLOCKED，贴 grep 证据 + 候选文件清单 + 你判断最可能的路径。

## 验收线（自己先过）
- 新增/修改的单测绿，pnpm typecheck 绿。
- 报告写明：注入点在 文件:行、堆积机理一句话、改动前后 prompt 片段对比（各 3–5 行）。
