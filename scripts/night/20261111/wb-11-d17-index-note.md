# 夜跑 11-11 · WB-11 D17 台账索引行订正（只改文档，不碰历史格）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`）。
- 卡 ID：`a2a68e9e-6872-461c-abca-ecd8a7a20c18`（先 `claim` 再开工，做完 `tag` 交 review）。
- 看板 CLI（绝对路径）：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告路径：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\a2a68e9e-6872-461c-abca-ecd8a7a20c18.md`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准单测入口 `pnpm test <单个测试文件>`；本卡**不跑任何测试**。
2. 禁一切 git 写操作。
3. **只改一个文件**：`docs/plans/prompt-assembly-backlog.md`，**只改 D17 那一行的状态格子**。
4. 禁 `done`；禁自建自证文件。

## 背景
WB-3 判定 D17 卡面前提失效、DB-7 复核确认：`docs/plans/prompt-assembly-backlog.md:114` 是 **2026-11-02 快照格**，`:140` 是**现值**「已结项」，两者是「过期索引 vs 现值」冲突，不是数据打架。
DB-7 的建议：**:102 的快照约定要求历史格不动 ⇒ 应当「加括注」而不是「改字」**。

## 任务（T1）
1. 读 `docs/plans/prompt-assembly-backlog.md` 的 `:100`–`:145`，确认三件事并用原文证明：
   - `:102` 列头/说明是否明确「快照格勿据此判断现状」；
   - `:114` 当前 D17 状态格原文；
   - `:140` 现值行原文 + 设计稿 `docs/design/features/*d17*` 或对应设计稿里的「已结项」出处（grep 关键词 `D17`、`已结项`）。
2. **只加括注、不改字**：在 `:114` 的 D17 单元格**末尾**追加一条括注（建议形态：`（2026-11-11 补注：本格为 2026-11-02 快照；D17 现值已结项，见 :140 与设计稿 §10）`），
   - **不许**改动该格中既有的任何原始文字/日期/状态词；
   - **不许**改动其它行（包括 `:113`、`:140`）；
   - 若该行是表格行，保持列数与 `|` 结构不变；文件是 CRLF，**不要**把整文件 EOL 改掉（用按行替换、不要整文件重写）。
3. 给 `git diff` 原样输出，证明只多了那一处括注（预期 diff = 1 行改 1 行）。
4. 报告里写清：为什么选择「加括注」而不是「改字」（引用 DB-7 与 `:102` 原文）；以及「这条括注是否需要作者追认」的判断。

## 允许命令（白名单）
- `Get-Content` / `Select-String`
- `git -C C:\develop\workspace\AI-writer\wt-2 status --short`
- `git -C C:\develop\workspace\AI-writer\wt-2 diff -- docs/plans/prompt-assembly-backlog.md`
- `node <看板 CLI> claim/tag`
- 对那一个文件的定点编辑（Edit 工具）

不许：跑测试、跑 dev、改其它文件、git 写操作。

## 交付四段（写在卡报告里）
1. 改动清单（1 文件 1 处，给行号 + 改前改后原文）；
2. 执行记录（读了哪些行、grep 了哪些关键词）；
3. 原始输出（`git diff` 原样）；
4. 未做项 + 需要作者追认的事项。

报告末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
交回：`node … tag a2a68e9e-6872-461c-abca-ecd8a7a20c18 --add review --remove external --release --agent workbuddy:worker`

