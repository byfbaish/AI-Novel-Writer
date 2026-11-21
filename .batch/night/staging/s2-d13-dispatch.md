# 派单件 · S2-D13（D13 先行，D9/D1 候）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）
抄送：QA · AI writer项目组（首验方，交件后开判）
时点：2026-11-22 03:2x（探针 probe_ms=25 通过之后）
回执：`.batch/night/bridge/to-owner`

## 1. 派什么

- 卡面：`.batch/night/cards/s2-d13-failure-contract.md` —— 82 行 / 8,107B / sha256 `0e42d09846320d0e1a0a614050d9da0b0d96a8df09dafaef950fdfd7015b959a`（§2.3 在 `:26`）。
- 派验单：`.batch/night/review-requests/s2-d13-failure-contract.md`（35 行 / 2,054B / `0bf0ef97278f`）。
- 顺序：D13 先行；D9、D1 在 D13 交件后开，避免同工作区争用。

## 2. 触发路径（我选定，写进卡面 §2.3，执行方不得另择）

合成响应底座 + 三档脚本化响应，不用真模型诱导：

1. `short-outline-fail`：短细纲调用返回不合规响应 → 短细纲层失败码；
2. `replay`：正文首稿复述上一章结尾 → `DRAFT_PREVIOUS_ENDING_REPLAY`；
3. `no-progress`：`compose-visible` 阶段无可见进展 → `GENERATION_COMPOSITION_NO_PROGRESS`，且此时已收到可见正文 ⇒ 候选落库。

底座沿用 `scripts/d12-replay-acceptance.mjs` 已验证的 synthetic fetch 拦截（拦 `https://api.openai.com/v1/chat/completions`，请求记在 `globalThis.__draftAcceptance.requests`）。新脚本 `scripts/s2-d13-failure-acceptance.mjs`：**一次启动、单实例串跑三档**，每档独立 run、evidence 分档记；实例纪律三项整次运行记一次。

停手条件（卡面 §2.3 原文）：任一档无法由合成响应稳定触发 ⇒ 停手报原文与已排除路径，不许改判据、不许改进判据分母、不许改真模型诱导自行重试。

## 3. 分支与起点

- 分支 `card/s2-d13-failure-contract`，**起点仍钉 `0f0ca3ee`**（`exp/mainline-1119`；派单时实测 HEAD＝`0f0ca3ee`，未被推动）。
- 一卡一分支；不合并、不 push（push 只由主身）。
- R4 判据：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 双空（不用原始 `git status --porcelain`）。

## 4. 白名单与禁改（卡面 §3/§4）

- 可改：`src/shared/chapter-failure.ts`、`generate-draft.command.ts:1863-1910` 一带、`ai-output-failure-presentation.ts`、新增 `scripts/s2-d13-failure-acceptance.mjs`、对应测试、交件报告 `.batch/night/staging/s2-d13-failure-contract-report.md`。
- 禁改：D12 注入与重跑区（`:1205-1224`／`:1593-1621`／`:1390-1399`；`chapter-materials.ts:608-624`／`:249`；`draft-short-outline.ts:58`）、既有错误码值、`archive/` 字节、仓外 `.backups`、`.runtime/` 历史 run、`RootBudget` 键集与 `readMainGenerationPolicy` 版本分支。
- 不许为触发失败在生产代码加测试开关；注入点只许落在测试/验收脚本侧。

## 5. 开工动作

1. 贴 §0 必读确认三行（读了哪几份／各自版本／据此守的三条口径）；
2. 贴开工校验：`git rev-parse HEAD`（应 `0f0ca3ee`）、目标文件存在、R4 双空；
3. 再动手。

## 6. 交件与首验

- 交件：报告路径 + 提交 sha + `git status --porcelain` 与 `git diff --stat`（交接用 R4 判据），群里 @ 项目总负责人 与 QA。
- QA 首验按卡面 §5 五条逐条要输出原文，判词落 `.batch/night/reports/s2-d13-qa-firstcheck.md` 并直投 `.batch/night/bridge/to-owner`；一卡一判词，不与 D9/D1 合并。
- D13 状态 🟡→✅ 由产品经理做，执行方与 QA 都不改缺陷稿状态。
