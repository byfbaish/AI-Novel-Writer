# CARD-S2-D13 · 失败契约：三失败点统一错误码 + NO_PROGRESS 前保草稿

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点 `0f0ca3ee`（`exp/mainline-1119`）
顺序：**S2 第一张**（D13 → D9 → D1）；D9/D1 在本卡交件后开，避免同工作区争用。

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：仓库根 `README.md`、仓库根 `AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 各自当前版本或日期：`README.md` 末次提交 `c87cd4ab`（2026-11-14）；`AGENTS.md` 末次提交 `a276fffb`（2026-11-07，`charter-version: 2026-11-07`）；`ruling-dispatch` 现行 **v6 · 2026-11-20**（v5 及更早仅留档）。
③ 据此守的三条口径：**授权边界最窄执行**（本卡 §4 白名单外不动）；**改码走分支＋单测**，实机复验只在本机 `develop` 由 developer 执行、不外派；**证据只认命令与输出原文**（结论不算），push 只由主身。

## 1. 现状（读于 `0f0ca3ee`，均为起点基线行号）

- 错误码表已存在：`src/shared/chapter-failure.ts:45` 起 `CHAPTER_FAILURE_CODES`，映射表 `:85-175`（`DRAFT_TOO_SHORT`、`DRAFT_PREVIOUS_ENDING_REPLAY`、`DRAFT_NO_PROGRESS`、`DRAFT_INCOMPLETE_*`、`GENERATION_COMPOSITION_EMPTY`、`GENERATION_COMPOSITION_CONDENSE_UNEXPECTED` 等）。
- 候选落库分支已按 D13 裁定 2=A 放开：`src/services/workflows/commands/generate-draft.command.ts:1863-1910`（注释在 `:1864-1867`：「候选落库不再以 `!mainOwned` 为前提」），落库通道 `db:recovery-candidate-record`（`src/shared/ipc-channels.ts:1289`）。
- 缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md:64` 现标 **🟡 已实施、未实机**；`:826` 同。
- 缺陷稿 D13 段 `:824-853` 载三次失败实测：短细纲层、重演层、`generation:compose-visible` → `GENERATION_COMPOSITION_NO_PROGRESS`；`[第 2 条已失效 2026-11-05]`/`[2026-11-06 注]` 是历史读数，读前先看注释。

## 2. 本卡要证的两件事（只这两件）

1. **三失败点各自有明确错误码出口**，且在渲染层能读到 `code`（不是只藏在 message 文本里、跨 IPC 不再丢）。
2. **`GENERATION_COMPOSITION_NO_PROGRESS` 丢弃前先把已收到的可见正文留成草稿**（恢复候选），作者能在界面看到并取用。

### 2.3 本卡选定触发路径（项目总负责人 2026-11-22 03:1x 定，执行方不得另择）

- **选「合成响应底座 + 三档脚本化响应」，不用真模型诱导。** 理由：三档要可重复、可离线、可单实例串跑；真模型诱导无法稳定复现且不可控成本。
- 底座沿用 `scripts/d12-replay-acceptance.mjs` 已验证的 synthetic fetch 拦截（拦 `https://api.openai.com/v1/chat/completions`，请求记在 `globalThis.__draftAcceptance.requests`）。新建 `scripts/s2-d13-failure-acceptance.mjs`，**一次启动、单实例串跑三档**，每档独立 run：
  1) `short-outline-fail`：短细纲调用返回不合规响应 → 短细纲层失败码；
  2) `replay`：正文首稿复述上一章结尾 → `DRAFT_PREVIOUS_ENDING_REPLAY`；
  3) `no-progress`：`compose-visible` 阶段无可见进展 → `GENERATION_COMPOSITION_NO_PROGRESS`，且此时已收到可见正文 ⇒ 候选落库。
- 三档共用一次启动，但 evidence **分档记**：每档各自给失败码、渲染层对象原文（含 `code`）、DB 行原文；实例纪律三项（§8）记整次运行一次。
- **停手条件**：任一档无法由合成响应稳定触发（走不到该层、异常被上游吞掉、需改生产代码才能进该分支）⇒ 停手报原文与本档已排除路径，不许改判据、不许改判据分母、不许自行改用真模型诱导重试。
- 不许做的事：不许改 `DEFAULT_SINGLE_CALL_TIMEOUT_MS` 与预算键集；不许为触发失败而在生产代码里加测试开关或调试入口（需要注入点时只能落在测试/验收脚本侧）。

## 3. 不动的东西（禁改区）

- D12 注入与重跑：`generate-draft.command.ts:1205-1224`、`:1593-1621`、`:1390-1399`；`chapter-materials.ts:608-624`、`:249`；`src/shared/draft-short-outline.ts:58`。
- 既有错误码**值**（只许增映射/补字段，不许改已有字符串，否则历史台账与判据全漂）。
- `archive/` 任何字节、仓外 `.backups`、`.runtime/` 历史 run 目录。
- `RootBudget` 键集与 `readMainGenerationPolicy` 版本分支（D9 的可配置缺口不在本卡，见 D9 卡）。

## 4. 允许改码区（白名单）

- `src/shared/chapter-failure.ts`（只增/补映射与 meta 文案）
- `src/services/workflows/commands/generate-draft.command.ts`（仅失败出口与候选落库附近，`:1863-1910` 一带）
- `src/components/panels/ai-output-failure-presentation.ts`（失败文案出口）
- 新增验收脚本 `scripts/s2-d13-failure-acceptance.mjs`（只此一个新文件，按 §2.3 底座）
- 对应 `__tests__` 与 `*.test.ts(x)`
- 交件报告：`.batch/night/staging/s2-d13-failure-contract-report.md`

## 5. 验收判据（QA 首验按此逐条，逐条要输出原文）

| # | 判据 | 证据形态 |
|---|---|---|
| 1 | 三失败点各实机触发一次（短细纲失败 / 重演 / compose 无进展），每次都能取到**唯一失败码**；触发走 §2.3 的三档脚本化响应 | 每次贴：命令原文、末行 JSON 或界面读数、DB 行原文 |
| 2 | 失败码带 `code` 字段且跨 IPC 到渲染层仍存在（不得只剩 message） | 贴渲染层读到的对象原文（含 `code`） |
| 3 | `NO_PROGRESS` 时 `recovery_candidates` 有行：`chapter_number`＝本章、`visible_text` 长度 > 0、`failure_code` 为对应码 | 贴 `SELECT` 输出原文（列名按 schema：`recovery_candidates.visible_text`，`electron/migrations/baseline-schema.ts:145`）与 `visible_text` 字数 |
| 4 | 界面两档文案：失败原因 + 可执行下一步（不是「工作流未完成」一句） | 贴两档文案原文（中/英） |
| 5 | 单测覆盖「码传播」与「候选落库」两条路径；`generate-draft.command.test.ts` **整文件**全绿；`pnpm check:fast` → `EXIT=0` | 贴 `pnpm test src/services/workflows/commands/__tests__/generate-draft.command.test.ts` 的**整文件汇总行原文**（形如 `Tests N passed (N)`）与 `EXIT=`，再贴 `check:fast` 末行与 `EXIT=` |

**判据 5 取证口径（负责人 11-22 裁定，判据 5 只认这条）**：只认整文件汇总行——`pnpm test <测试文件>` 的 `Tests … passed (…)` 与 `EXIT=`，**不接受 `-t` 过滤结果**（`1 passed | 254 skipped` 一类视为无效证据）。理由：过滤跑只执行被点名的用例，同文件的既有不变量不进判定，D13 首验即由 `-t` 过滤证据放过了 `:5964` 的红。

**赋码边界（同裁定，修法 ①）**：只对 `src/shared/chapter-failure.ts` 受控码表内的失败赋 `code`；表外失败保持不带 `code`，不得为「所有失败都有码」去改既有不变量用例（那属扩面，超本卡范围）。

## 6. 外派位

- **可外派（静态活）**：错误码出口清单核对（正文层 10 处 / 主进程 4 处 / 组装层 4 处逐一落行号）、三失败点的最小复现步骤起草。派 WorkBuddy 或豆包，产物只交证据件到 `.batch/night/bridge/to-owner`，入 `wt-2`、不进主区。
- **不可外派**：实机复验（起应用＋playwright 走流程）——须在 `develop` 由 developer 执行（主人 11-21 19:07 裁定；AGENTS 第 8 条）。
- 外派件必须写四样：需求、验收、回执地址、不许做的事；**产物回流方式**＝证据件，不许直推。

## 7. 回执与交付

- 分支 `card/s2-d13-failure-contract`，起点 `0f0ca3ee`；一卡一分支，不合并、不 push（push 只由主身）。
- 交件：报告路径 + 提交 sha + `git status --porcelain` 与 `git diff --stat`（交接判据用 `--ignore-cr-at-eol`）。
- 回执地址：`.batch/night/bridge/to-owner`；群里交件时 @ 项目总负责人 与 QA。
- 停手条件：发现需要改 §3 禁改区、或需改预算/版本分支才能过判据 ⇒ 停手报原文，等裁定，不许自行扩面。

## 8. 实例纪律（群管理分身 2026-11-22 00:2x 硬纪律，验收必查）

- 实机验收脚本一律**单实例复用、跑完必关**：`try/finally` 包住流程，finally 里 `app.quit()`；父进程异常先死时，连 electron 子进程树一起收。禁止并发起第二个实例。
- evidence 必须增三项：`instancesThisRun`（本次实例数，应为 1）、`exitCode`（进程退出码）、`leftoverElectronProcesses`（收尾后残留 electron 进程数，**须为 0**）。
- 判据 1/3 的证据里要能读到这三项；读不到即判该条无输出原文。
