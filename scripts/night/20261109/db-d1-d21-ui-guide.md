# D1 · D21 修法 C 的 UI 操作指南 + 中英文案

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
报告路径：C:\develop\workspace\AI-writer\wt-1\.batch\night\d1-d21-ui-guide.md
正文顺序：一段话结论 → 证据（文件:行 + 原文摘录）→ 正文内容 → 遗留问题。
最后一节必须是 ## [T1] DONE 或 ## [T1] BLOCKED。

## 背景
D21 = 大纲进度闸门被「卷结构过期」短路：src/services/outline-progress-gate.ts:92-95 在卷结构非 ready 时直接 return { gate: null, warning }；调用方 ArchitectureConfirmDialog.tsx:509-512 只 console.warn 后静默放行。作者已裁定接受修法 C，代码改动排下一批；**本任务只要 UI 操作指南和文案，不写代码**。

## 必读
1. docs/design/product/d21-gate-shortcircuit-evidence-20261109.md（全文，尤其 §⑦ 作者质疑与修法 C）
2. docs/design/product/live-pipeline-acceptance-defects-assessment.md 的 D21 段（grep -n "D21"）
3. src/services/outline-progress-gate.ts、src/components/（grep ArchitectureConfirmDialog）、electron/repositories/volume-structure-repository.ts:133-160

## 要产出
1. 产品口径一句话：这闸门在防什么（不许用代码术语）。
2. 修法 C 的行为定义：stale 不短路、用当前大纲现算、提示写明「边界来自旧快照」、确认顺序对齐「过期优先」。
3. **具体操作指南**：作者看到警告时，界面上按什么顺序点什么（逐步，写清按钮名和界面位置），以及「强行越过」的后果与恢复办法。
4. 中英文案各一套：标题 / 正文 / 主按钮 / 次按钮 / 帮助链接文字。文案必须回答：为什么现在弹、不重建会怎样、怎么重建。
5. 与现行设计的差异清单（现状代码行为 vs 修法 C）。
