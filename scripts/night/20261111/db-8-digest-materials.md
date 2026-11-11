# 夜跑 11-11 · DB-8 收口材料汇总（零代码，只写一份文档）

## 身份与落点
- 你是**豆包**，工作目录 `C:\develop\workspace\AI-writer\wt-1`。
- 卡 ID：`44f5be66-3cff-4f66-bc10-06d51ee89bcc`（先 `claim` 再开工，做完 `tag` 交 review）。
- 看板 CLI（绝对路径）：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 产物：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\44f5be66-3cff-4f66-bc10-06d51ee89bcc.md`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准单测入口 `node node_modules/vitest/vitest.mjs run <单文件>`（本卡不需要跑测试）。
2. 禁一切 git 写操作。3. 只改/写点名路径。4. 禁 done；禁自建自证文件；只写这一份报告。

## 任务：按四组汇总今晚已交回的 12 份报告，供 Lead 写晨间 digest
只读这些报告（全在 `C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\` 与 `C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\`）：

**A 组（代码改动，需判断可合性）**
- DB-1 `9af76744-cbc8-467f-a3bc-c50b7fa4322a.md`（wt-1）
- WB-1 `1ada5cbf-8d4e-4fb3-93e8-c8f81a3b5e6d.md`（wt-2）

**B 组（判定类，无代码）**
- WB-2 `f41947b6-1596-47ee-a3a1-a59ad1eaab78.md`、WB-3 `b20c9393-5a5a-4055-a2fa-ae26bfe50202.md`、WB-4 `926a5b30-2dca-4fb7-adeb-677b412b0f67.md`（wt-2）

**C 组（材料/回填）**
- DB-2 `40e86fcc-df8b-404d-ae70-6657e23e0925.md`、DB-3 `b80a3fe8-3eb5-4cde-adf4-03f1526472c7.md`、DB-4 `981977bf-76e7-4fcf-9435-95e9c96ba7cd.md`、DB-5 `105067bc-0dc2-449e-87f1-77b76f4d9267.md`（wt-1）

**D 组（交叉复核与手册）**
- DB-6 `3a9ca460-9792-4d89-8601-d5a71ee3faf1.md`（wt-1，读第二版）、DB-7 `ee381832-7f61-46b3-92a1-b2d9fb2b700d.md`（wt-1）
- WB-8 `d438ab0c-4272-414d-8f51-8d6c520f3dc7.md`、WB-9 `cf8d1c75-ff01-4ce4-837f-3ce95378008c.md`（wt-2）

## 输出要求（严格按此结构）
1. **一页结论表**：`卡 | 判定(DONE/BLOCKED) | 有无代码改动 | 一句话结论 | 证据强度(强/中/弱 + 理由一句话)`，12 行全列。
2. **需要作者拍板的清单**：把各报告里「待裁决 / 待拍板 / 二选一 / 建议撤销」的条目全部摘出来，每条写：来源卡 + 原句 + 两个选项 + 你建议哪个（只建议，不裁定）。至少覆盖 D17 台账 `:114` 是否改字、DB-3 的 A/C 二选一、WB-2 的 A/B/C 三方案、WB-3 是否撤销。
3. **交叉矛盾清单**：不同报告之间互相矛盾或强度不一致的地方（例如 DB-6 说 WB-2「待实机确认」而 WB-2 自己说「成立」），逐条列出并判「谁更可信 + 依据」。
4. **未做的实机项**：把「因为没有实机产物而无法判定」的项列全（WB-4、WB-5、B11、B16 等），并写明对应产物目录（`wt-2\.runtime\judge\M1\`、`M2\`）与手册路径 `wt-2\.batch\night\M1-M2-runbook.md`。
5. **今晚不可信/未复跑的读数**：所有「报告自述但无人复跑」的测试读数（如 WB-1 的 43/43、DB-6 未独立复核测试等）逐条列。

## 交付四段（写在卡报告里）
改动清单（应写「零改动」）/ 执行记录（读了哪 12 份）/ 原始输出（那张表）/ 未做项 + 不确定。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
交回：`node … tag 44f5be66-3cff-4f66-bc10-06d51ee89bcc --add review --remove external --release --agent doubao`

