【只读审计 · 不许改产品代码 · 不许 git 写】

工作区：C:\develop\workspace\AI-writer\wt-1（豆包固定项目 AI-writer-wt-1）。仓库文档与代码都在这个目录里。

开工前先做两件事，用 3 行复述你必须遵守的红线，复述完再动手：
1. 读 wt-1/AGENTS.md 的 §2（T0 不变量）
2. 读 wt-1/docs/agents/documentation-charter.md 的 §4 与 §6
3. 读 wt-1/docs/agents/worktree-parallel.md 的 §7

你的红线（任务书作者再写一遍，以文件为准）：
- 只读审计：不许改任何产品代码、不许改任何既有文档（包括 backlog 本身，只许在产物里给 diff 文本）。
- 不许一切 git 写操作（add / commit / reset / checkout / stash / push）。
- 不许跑全量测试 / test:browser / test:node / pnpm test / pnpm dev。
- 除 wt-1/.batch/ 以外的路径一律不写。
- 没读到的内容只能写「本次读取的文件内未找到」，不许写「全仓没有」；不确定的判定必须标「不确定」。

## 背景
2026-11-09 已交 D 系列对账表 wt-1/.batch/d-series-status-audit-20261109.md（21 行）。结论：A 类（代码与声称不符）0 条；不一致 11 条（D2/D3/D4/D5/D6/D10/D11/D12/D13/D15/D17）；D9/D16 在 wt-1 分支「一致」是因为该分支根本没有这两个模块（代码在 agent/wt-2 的两个未合并提交里，已于 2026-11-09 备份到 keep/d9-d16 并还原 wt-2）。
根因：docs/plans/prompt-assembly-backlog.md 的「2026-11-02 实机链路验收缺陷」一节，状态列是 2026-11-02 的冻结快照；逐条真源是 docs/design/product/live-pipeline-acceptance-defects-assessment.md（各条目的处置/补记）。

## 目标
产出「D 段台账重写提案」，提案文本，不直接改主区文件。

## 交付（写入 wt-1/.batch/d-segment-rewrite-proposal-20261109.md）
1. 现状诊断：backlog D 段里哪几行与缺陷稿冲突，冲突类型分三类（状态过期 / 口径不同 / 事实错误），每条给 backlog 行号 + 缺陷稿证据位置（节号或行号）。
2. 重写方案：把 D 段的「状态列」降级为「2026-11-02 快照（勿据此判断现状）」+ 一条指针指向缺陷稿；给出可直接粘贴的表格 diff 文本（只给 diff，不许改文件）。
3. 逐条清单：21 行里需要改的具体行 + 建议新状态 + 依据（引用缺陷稿哪一节）。
4. 需作者裁定的项：哪些状态在缺陷稿里也没有定论。

## 补充要求（Lead 追加，优先级高于以上措辞）
A. 逐条对照：先 git log --oneline -1 确认 wt-1 HEAD，然后**逐条**打开 backlog D 段（docs/plans/prompt-assembly-backlog.md 里「2026-11-02 实机链路验收缺陷」一节）与缺陷稿 docs/design/product/live-pipeline-acceptance-defects-assessment.md 的对应条目，一行一行对，不要抽样、不要凭印象。先报告 D 段表格的**实际起止行号**（用 grep -n 或 read 确认）。
B. 证据口径：**每一条冲突/结论都必须给「文件:行」**（例：docs/plans/prompt-assembly-backlog.md:62、docs/design/product/live-pipeline-acceptance-defects-assessment.md:66），并附该行原文的短引用（≤40 字）。给不出文件:行的判断，标「不确定」。
C. diff 规格：第 2 部分的 diff 必须是**可直接粘贴**的统一 diff / 完整替换块——包含足够上下文行、能让人一眼看出删哪行加哪行；不要写「将某处改为……」这种描述式改法。同时明确标注「本提案不落盘到主区，需作者裁定后由 Lead 在 develop 主区执行」。
D. 21 行全覆盖：第 3 部分必须覆盖 D1–D21 全部 21 条（缺一条就在报告里显式写「Dxx：未在本次读取的文件内找到对应条目」），表格列为：编号 | backlog 现状（行号+状态原文摘要）| 缺陷稿真源（节/行）| 冲突类型 | 建议新状态 | 依据。
E. 不要采信对账表里已有的结论当证据：对账表可以作为线索，但每条都要回原文复核；凡引用对账表的地方要注明「据 wt-1/.batch/d-series-status-audit-20261109.md，已回原文复核/未复核」。
F. 产物只写 wt-1/.batch/d-segment-rewrite-proposal-20261109.md 一个文件。报告结构：① 现状诊断 ② 重写方案+diff ③ 21 行逐条清单 ④ 需作者裁定项 ⑤ 复述的红线 3 行 ⑥ 执行记录（跑了哪些只读命令）。
G. 结束时另起一行输出完成标记（格式按下面这句，但**不要**把标记原文抄进报告正文的其他地方）：状态标记为方括号 T1 + 空格 + DONE，或方括号 T1 + 空格 + BLOCKED 加一句原因。输出标记后立即停止，不要自主扩展范围。
