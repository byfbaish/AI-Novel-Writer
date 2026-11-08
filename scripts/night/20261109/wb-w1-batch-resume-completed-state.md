# W1 · 批量续跑甲方案补强：起始章判据从「有草稿」改为「完成态」

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
报告写到：C:\develop\workspace\AI-writer\wt-2\.batch\night\w1-batch-resume-completed-state.md（目录不存在就创建）。
正文顺序：一段话结论 → 证据（文件:行号 + 关键原文） → 改动清单（路径:行） → 验证（命令 + 输出原样）。
最后一节必须是下面之一：
- ## [T1] DONE ：改了哪些文件（路径:行）、跑了什么命令、关键输出原样贴 2–5 行、剩余风险。
- ## [T1] BLOCKED ：卡在哪一步、已排除的可能、建议下一步。

## 背景
上一批已落地「甲方案」：批量中断后，终止批次禁用「继续此批次」；重新开批时起始章取「第一张没草稿的章」。
实现文件：src/services/batch-interrupt-resume.ts（约 79 行，含 firstChapterWithoutDraft / TERMINATED_ROOT_RUN_STATUSES / evaluateBatchRecoveryGate / readBatchStartChapter），调用点在 src/components/ 里（grep readBatchStartChapter 能找到），单测 src/services/__tests__/batch-interrupt-resume.test.ts（现有 15 例）。
作者 03:10 校正：判据应从「有草稿」改成「完成态」——被中断的那一章是半成品草稿，不能当成已完成而跳过。设计稿 docs/design/features/batch-interrupt-resume-design.md §11 有原文。

## 要做什么
1. 读 src/services/batch-interrupt-resume.ts 全文 + 单测，读懂 firstChapterWithoutDraft 现在的入参来源（db:draft-list-all 的章号集合）。
2. 找「完成态」的权威来源：grep 现有 IPC/仓库层，看有没有「该章 run 已完成」或「已落稿」的字段（候选：generation:list 的 run.status、db:draft-* 的字段、章节完成标记）。把候选按「可用性 / 侵入性」排序写报告里。
3. 若能用现有 IPC 数据判断完成态：改判据（例如「有草稿且该章最近一次 run 不是终止态」才算已完成），补单测至少 2 例：
   a) 有草稿但 run 失败/中断 → 该章必须被选为起点（现在会跳过它，这是 bug）；
   b) 已完成章 → 仍然跳过。
   同步改调用点（保持函数签名兼容或一起改），跑绿。
4. 若必须新增 IPC / 改 schema / 动主进程：**不要动**，代码保持原样，报告里给三个候选方案（各需改什么、风险、工期量级），标 BLOCKED。

## 验收线（自己先过）
- src/services/__tests__/batch-interrupt-resume.test.ts 全绿（含新增例）。
- pnpm typecheck 绿。
- git -C . diff --stat 只碰 batch-interrupt-resume.ts / 其单测 / 必要时那两个 UI 调用点。
