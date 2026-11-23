# AC1/S1（卡 a7589d74）两处裁定 — 群 admin（AI writer项目组）

- 裁定时间：2026-11-23 22:00（Asia/Shanghai）
- 裁定人：群 admin（AI writer项目组分身）
- 背景件：AC1 实施包 `.batch/night/staging/ac1-s1/impl-package.md`（171 行／sha256 `51f76ffafaa7cf83193a3d8dcf6e60ff7a298e993258abc4746a7d8861d6e455`）
- 依据：主人 2026-11-23 裁定 1（`.batch/night/org/ruling-arch-1123.md`）＋ AC 系 Goal rules 第 5 条（外派）

## 裁定 1：设计稿 §5 S1 交付表 `:204` 表行按裁定 1 修，结论段一字不动

**问题**：`docs/design/architecture/architecture-consistency-design.md:204` 的表格行仍写

> `| **S1.1** | `characters_arch`（散文）与 `characters` 表（角色卡）**双向对齐检查** —— 散文写了没建卡 / 建了卡散文没写 |`

与紧邻的裁定段 `:199`–`:200`（「只校验投影状态」「不与之互相比对」「禁止两处各判一遍」）冲突。表没跟着裁定改。

**裁定**：改表一行，改为

> `| **S1.1** | 角色投影状态校验（`deriveRosterStatus()`，经 IPC 取投影状态）—— 只校验派生投影，不与散文双向比对；详见上文裁定段 |`

- 允许范围：仅这一行；`:196`–`:201` 裁定段、`:202`–`:203` 实施要点、S1.2／S1.3 行一字不动。
- 提交纪律：可与 AC1 实现同一笔，也可单独小笔；commit message 写明「表行按主人 2026-11-23 裁定 1 更正，结论句未动」。
- 责任人：项目总负责人（它起草、它改）。

## 裁定 2：AC1 代码实施外派 WorkBuddy（否决「developer 自己落码」）

群规 11-22 10:36 主身定：**代码实施一律外派并行；developer 是 Architecture／IT Advisor，只出实施包不写生产码**。故 developer 提的 a) 不采纳。

- **developer**：留实施包与验收判据；负责派单件（逐字带 `.batch/night/staging/ext-dispatch-header.md` 标准头：§0 必读五件＋四行确认、§0.1 跨 agent 红线、§0.2 回执头），不落生产码、不 commit、不 push。
- **workbuddy联络人**：转派 WorkBuddy；确认工作模式＋模型 `DeepSeek V4.1 Flash`（报「快速」等低档即按可疑件退回）；产物落 `C:\tmp\ac1-s1\workbuddy\`（一卡一会话一目录，禁与他方共写）。
- **起点与分支**：起点 `90c49657`；分支 `card/arch-ac1-s1`；WorkBuddy 可在自己 worktree 内 commit 并提分支，**不 push、不动 develop**。
- **验收判据（沿用已在包内定死的三条口径）**：①`src/shared` 零哈希重算，只吃 IPC 快照 `status`（`src/shared/ipc-channels.ts:1105` `db:character-roster-read`）②接入点是 `src/services/consistency-preflight.ts:43-62` 数组拼接，新增一行在 `:61` 之后，IPC 调用插 `:42`/`:43` 之间并包 try/catch fail-open，**不改调用链**③新纯函数只 `import type`，无 IO、缺字段 fail-open。
- **必带交付**：正向＋负向用例各至少 1；变异测试靶与「删断言／改守卫后必转红」的命令原文；测试走 Electron 运行时 `pnpm test <paths>`（禁全量、禁 `test:browser`、禁切 ABI）；回执四行含实际模式与模型。
- **QA**：判 AC1 时机在 WorkBuddy 交件后；判位边界（未导出 `deriveRosterStatus()`、`src/` grep 零命中 ⇒ 必须走 IPC）已在群里打过招呼，成立。

## 未决（留待后续，不在本卡）

- AC2 的「锚点解析器」口径：ADR-0027 明写「逐字包含」与现存 `byName.get`（trim 后全等，`src/shared/space-time-consistency.ts:286`）不得混用，实施 AC2 前须择一。
