# D4 · D12 修法设计：拦截后自动重跑一次

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
报告路径：C:\develop\workspace\AI-writer\wt-1\.batch\night\d4-d12-retry-design.md
正文顺序：一段话结论 → 证据（文件:行 + 原文摘录）→ 正文内容 → 遗留问题。
最后一节必须是 ## [T1] DONE 或 ## [T1] BLOCKED。

## 背景
D12 = 整章复用上一章正文（换开头应付）。缺陷稿 grep -n "D12"。现状：生产守卫只看「上一章结尾 1000 字 / 开头 1200 字」，窗口外零命中；整章复用判定器已入库但零接线（src/shared/chapter-reuse-coverage.ts，阈值 advisory 0.15 / blocking 0.45）。
作者要的修法方向：短细纲写错对象 + 拦截后**自动重跑一次**。

## 必读
1. docs/design/product/live-pipeline-acceptance-defects-assessment.md 的 D12 段（含 2026-11-09 补记）
2. docs/experiments/reuse-coverage-threshold-calibration-20261109.md
3. src/shared/chapter-reuse-coverage.ts、grep generate-draft.command.ts 里 DRAFT_PREVIOUS_ENDING_REPLAY（约 :1620）

## 要产出（设计文档，不写代码）
1. 触发条件：哪个判据、哪个阈值、在哪一步（生成前 / 生成后）。
2. 重跑一次要改什么：重跑时 prompt 要给模型什么纠正指令（写出建议原文），要不要换模型/换温度。
3. 重跑失败后的降级：报错？给作者看 diff？只记录？
4. 误伤风险：真实改写（组 D 实测 ratio=0）会不会被误拦；短章（1647–1972 字）窗口比例问题。
5. 验收线：要哪些单测、要不要实机复现、如何证明「不误伤」。
