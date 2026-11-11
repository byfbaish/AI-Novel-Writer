# 夜跑 11-11 · RV 07:00 独立复核（干净会话）

你是 WorkBuddy，本卡是**独立复核卡**：不参与生产，只读、只判、只写一份报告。你被派发时是全新会话，不要复用其他会话的上下文。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 材料清单：`C:\develop\workspace\AI-writer\wt-2\.runtime\night11\manifest.json`（Lead 放）
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：45 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读；不改任何源码/测试/文档（唯一写入是本卡报告）。
2. 不跑全量测试；只允许 `pnpm typecheck` 与单个测试文件。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 本夜卡片与报告
- P-WB（WorkBuddy 探针）卡 ID: c87c888f-40b6-4ffe-8079-094f3bc315fd  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\c87c888f-40b6-4ffe-8079-094f3bc315fd.md
- WB-1（夹具补 M29）卡 ID: 1ada5cbf-8d4e-4fb3-93e8-c8f81a3b5e6d  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\1ada5cbf-8d4e-4fb3-93e8-c8f81a3b5e6d.md
- WB-2（B11 静态判）卡 ID: f41947b6-1596-47ee-a3a1-a59ad1eaab78  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\f41947b6-1596-47ee-a3a1-a59ad1eaab78.md
- WB-3（D17 覆盖区间）卡 ID: b20c9393-5a5a-4055-a2fa-ae26bfe50202  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\b20c9393-5a5a-4055-a2fa-ae26bfe50202.md
- P-DB（豆包探针）卡 ID: ee4a088e-0b7a-422d-9b13-2c8b72389159  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\ee4a088e-0b7a-422d-9b13-2c8b72389159.md
- DB-1（D9 阶段2 读数）卡 ID: 9af76744-cbc8-467f-a3bc-c50b7fa4322a  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\9af76744-cbc8-467f-a3bc-c50b7fa4322a.md
- DB-2（B16 文案）卡 ID: 40e86fcc-df8b-404d-ae70-6657e23e0925  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\40e86fcc-df8b-404d-ae70-6657e23e0925.md
- DB-3（超时续写方案）卡 ID: b80a3fe8-3eb5-4cde-adf4-03f1526472c7  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\b80a3fe8-3eb5-4cde-adf4-03f1526472c7.md
- DB-4（D9 台账回填）卡 ID: 981977bf-76e7-4fcf-9435-95e9c96ba7cd  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\981977bf-76e7-4fcf-9435-95e9c96ba7cd.md
- DB-6（交叉复核 WB）卡 ID: 3a9ca460-9792-4d89-8601-d5a71ee3faf1  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\3a9ca460-9792-4d89-8601-d5a71ee3faf1.md
- WB-4（D9 慢吐判读）卡 ID: 926a5b30-2dca-4fb7-adeb-677b412b0f67  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\926a5b30-2dca-4fb7-adeb-677b412b0f67.md
- WB-5（B16 判读）卡 ID: b33ca4e0-3879-424f-940c-91b90a0f3ad5  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\b33ca4e0-3879-424f-940c-91b90a0f3ad5.md
- WB-6（pnpm test 判读）卡 ID: 2fff7426-a5fe-4677-bb25-07dd72eb6191  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\2fff7426-a5fe-4677-bb25-07dd72eb6191.md
- WB-7（browser 全量）卡 ID: 016862ed-d543-4ca6-88d6-f04fca445d98  报告: C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\016862ed-d543-4ca6-88d6-f04fca445d98.md
- DB-5（文档一致性(备用)）卡 ID: 105067bc-0dc2-449e-87f1-77b76f4d9267  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\105067bc-0dc2-449e-87f1-77b76f4d9267.md
- DB-7（D17 自检(备用)）卡 ID: ee381832-7f61-46b3-92a1-b2d9fb2b700d  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\ee381832-7f61-46b3-92a1-b2d9fb2b700d.md
- DG（晨间 digest）卡 ID: db186e6c-b06e-491e-9f31-4f7f0b3d4d88  报告: C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\db186e6c-b06e-491e-9f31-4f7f0b3d4d88.md

## 任务（六件判定，逐卡）
1. **改动是否真在 diff**：`git -C wt-1 status/diff`、`git -C wt-2 status/diff` 自跑；核对每张声称改了代码的卡（WB-1 / WB-2 / WB-3 / DB-1 / DB-4），报告里的改动是否真的存在于对应 worktree。
2. **测试声明可信度**：报告贴的通过数/退出码，与 `git diff --stat`、测试文件内容是否自洽；独立复跑至少 2 个被声明的单文件（贴真实输出）。
3. **判定**：每卡 `PASS` / `REWORK（一句原因）` / `BLOCKED（缺什么）`。
4. **可合并性**：patch 能否 `git apply` 到主线；schema / 主进程 / IPC / prompt 风险逐项点名。
5. **证据可信度**：有没有「没读却说读了」「行号对不上」「把推测写成事实」；行号抽查至少 6 处。
6. **越界检查**：有无越界文件、自证文件、git 写操作痕迹、未清理的临时文件。

## 验收
- 报告头行写：模型（界面/日志读到的）、会话是否新建、复核时间。
- 正文：一段话总判定 → 逐卡证据（文件:行号 + 原文）→ 独立复跑记录（命令 + 原样输出）→ 越界检查结论。
- 最后一张表：`卡 | 判定 | 关键证据 | 合并建议`。
- 末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```

