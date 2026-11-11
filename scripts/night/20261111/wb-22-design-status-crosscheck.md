# 夜跑 11-11 · WB-22 三份设计稿裁定状态与台账交叉核对（只读 + 只写报告）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`0e442deb-7cdc-4ab7-ba3b-2bcbbcc3f8c7`，报告写到 `wt-2\.dsh-task-board\reports\0e442deb-7cdc-4ab7-ba3b-2bcbbcc3f8c7.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」）
1. **纯只读 + 只写报告**：不改任何文件。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件。

## 为什么做这个
今晚 DB-14 复核出：台账 `:140` 的 D17 现值格写着「已结项」，但它**自身的裁决理由写反了**（它引的正文标题是「已实施」，按它自引的规则该取「已实施」）。这说明**状态行之间会互相撒谎**，而每条状态行都会成为明天的工作依据。

本卡把三份**已经有裁定历史**的设计稿与台账、缺陷稿三方对照，找出这类「说得对但理由错 / 说得对但过期 / 说得错」的格子。

## 材料（只读）
- `docs/design/architecture/d17-outline-change-range-design.md`
- `docs/design/architecture/d20-checkpoint-template-fingerprint-design.md`（文件名以实际为准，先 `ls docs/design` 找）
- D9 相关设计稿（文件名含 `d9` 或 `generation-call-timeout`，先搜）
- `docs/plans/prompt-assembly-backlog.md`（快照区 `:102` 起、现值区 `:122` 起）
- `docs/design/product/live-pipeline-acceptance-defects-assessment.md`

## 任务（T1）
对 **D17 / D20 / D9** 三条缺陷，逐条做三方对照：
1. **设计稿自述状态**（`:3` 状态行、§裁定/结案节）—— 逐字摘录。
2. **台账现值格**（`:122` 起对应行）—— 逐字摘录。
3. **缺陷稿条目**（搜 `D17` / `D20` / `D9` 的正文段）—— 逐字摘录。
4. 判：三者是否一致；不一致的，指出**哪一格错、错在哪**（措辞？日期？理由？指向？）。
5. 特别核「裁决理由」类错误：某格引用了某条规则却得出与规则相反的结论（DB-14 在 D17 `:140` 发现的那一类）。
6. 给「明天要改的格子」清单：`文件:行号 | 现状 | 建议改为 | 依据`。**只列建议，不改。**

## 验收
- 三条缺陷 × 三处来源 = 9 处摘录，每处带 `文件:行号`。
- 「裁决理由写反」这一类必须单独成表。
- 「明天要改的格子」里不许出现没有依据的改动。
- 贴至少 5 条 `Select-String` 原样输出。

## 交付
四段报告：结论（几条不一致、几条理由写反）/ 改动清单（写「无」）/ 原始输出 / 未做项。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag `0e442deb-7cdc-4ab7-ba3b-2bcbbcc3f8c7` --add review --remove external --release --agent workbuddy:worker`
