# W5 · 「断章直接舍弃」小设计草案（只写草案，不改码）

你是 WorkBuddy（外部实现 agent），**夜间无人值守批次**。
- 工作目录固定：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线主线 HEAD `74ad3236`）。
- 章程：`C:\develop\workspace\AI-writer\develop\AGENTS.md`。
- 时间盒 ≤ 18 分钟；不要提问；**不改任何产品代码/文档**，只产出草案报告。

## 0. 开工先复述三条红线（三行；不写视为没读）
1. 只读/只改 `wt-2`，不碰 develop / wt-1 / wt-3；
2. 只跑单测与 `pnpm typecheck`；禁全量 `pnpm test`、`test:browser`、`test:node`、`pnpm dev`；
3. 不 commit / push / merge / 切分支 / git reset / 不改全局配置与基线文件。

## 1. 背景（已定的产品裁定）
作者 2026-11-09 21:1x 裁定：W1 的起点判据「保留」，但**先做「断章直接舍弃」再合并 W1**。
原因：W1 改法让断点章即使有半成品草稿也被选为起点，而 `src/services/workflows/batch-chapter-workflow.ts:248-251` 有硬守卫——
`if (existingDraft && (!saved || existingDraft.id !== saved.draftId)) throw "第N章已有草稿，批量创作不会覆盖既有内容"`。
⇒ 断章留有草稿时续跑会当场被拒。W1 候选 patch 在 `C:\develop\workspace\AI-writer\develop\.runtime\patches\w1-candidate.patch`。

## 2. 取证（必读）
1. `C:\develop\workspace\AI-writer\develop\docs\design\features\batch-interrupt-resume-design.md`（重点 §10 落地回填表、§11 作者校正）；
2. `src/services/batch-interrupt-resume.ts`（现状：`firstChapterWithoutDraft` / `readBatchStartChapter`）；
3. `src/services/workflows/batch-chapter-workflow.ts`（守卫段 230–270 行附近，以及生成前如何决定目标章）；
4. `src/components/dialogs/BatchChapterCreationDialog.tsx`（起始章来源与展示）；
5. W1 patch 文件本身（看它到底改了什么，不要假定）。

## 3. 草案内容（报告里逐节写）
A. **「断章」的可执行定义**：从哪些数据能判定一章是断章（run 状态、`completedChapters`、draft 是否存在、`nextChapterNumber`…），给出判定伪代码；
B. **处置点候选**（≥2 个）：开批前对话框 / 续跑起点计算 / 生成目标章选择；各自优缺点与改动位置（文件:行号）；
C. **丢弃方式选项**（至少三选）：直接删除草稿 / 软删除或标记（`status`/`discarded` 字段）/ 归档到可恢复位置。逐个给：数据丢失风险、回滚成本、需要的 DB 迁移（有/无）、UI 是否要提示；
D. **推荐最小方案**：选一个组合，写清改动文件清单（文件:行号级）、新增/修改的函数签名、幂等性（重复进入批量的行为）、以及**单测清单**（测试文件 + 用例名）；
E. **与 W1 patch 的合并顺序**：先落哪个、怎么验证不再撞守卫、回滚方案；
F. **待作者拍板的点**（明确标注「待裁定，不落库」）。

纪律：不要猜测 DB schema；拿不准就写「本次读取的文件内未找到，需查 data-and-schema 主题卷」。不要给「顺手改」建议。

## 4. 交付
报告：`C:\develop\workspace\AI-writer\wt-2\.batch\night\W5-incomplete-chapter-discard-draft.md`
结构 = 上面 A–F + 一段结论（推荐方案一句话）+ 证据附录（文件:行号 + 原文片段）。
末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
