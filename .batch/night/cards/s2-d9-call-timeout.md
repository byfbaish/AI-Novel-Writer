# CARD-S2-D9 · 单次调用超时：三态可辨 + 实机中止

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：**本卡开工时的 `exp/mainline-1119` HEAD**（D13 交件后再定，不早于 `0f0ca3ee`）
顺序：**S2 第二张**（D13 → D9 → D1）。D13 未交件前不开本卡。

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` 现行 v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行（只动 §4 白名单）；改码走分支＋单测，**实机复验不外派**；证据只认命令与输出原文，push 只由主身。

## 1. 现状（读于 `0f0ca3ee`）

- 超时模块：`src/shared/generation-call-timeout.ts`——`DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000`（`:12`）、`GENERATION_CALL_TIMEOUT`（`:15`）、`resolveCallDeadlineMs(budgetRemainingMs, capMs)`（`:23`）、`resolveCallDeadline`（`:31`，预算 > 上限 ⇒ 单次超时码，否则 `ROOT_BUDGET_EXHAUSTED`）、`runDeadlineTimeout`（`:45`，顺序＝mark → block → abort）、`SingleCallPhase = 'generating' | 'timed-out' | 'failed'`（`:64`）。
- 生产调用点唯一：`electron/services/generation-run-service.ts:206` `resolveCallDeadline(budgetRemainingMs)`——**只传预算、不传 cap**，故实际生效上限恒为 10 分钟常量。
- 落库复用 D2 失败终态：`electron/services/generation-run-timeout.ts`（`finalizeFailedGeneration`）；单测 `electron/services/__tests__/generation-run-service.call-timeout.test.ts:72` 已断言 `block`/`settle` 都落 `GENERATION_CALL_TIMEOUT`。
- 界面两档文案：`src/components/panels/ai-output-failure-presentation.ts:182-183` 认 `GENERATION_CALL_TIMEOUT`。
- 缺陷稿 `:75`／`:671`：🟡 阶段 1 已接线（`5e031021`），**仅单测级、未实机**；「可配置」判据 2026-11-11 已登记延后（改 per-call 可配要动冻结的 budget 键集与 `readMainGenerationPolicy` 版本分支，属结构性改动，另裁）。

## 2. 本卡要证的事

**实机**让单次调用真的超时被中止，并且界面/库里能分辨三态：正在生成 / 超时已中止 / 调用失败。**不解决**「可配置」那条延后项（见 §3）。

## 3. 明确不做

- 不动 `RootBudget` 键集、不动 `readMainGenerationPolicy` 版本分支（「可配置」留给另裁）。
- 不改 10 分钟默认值本身（`DEFAULT_SINGLE_CALL_TIMEOUT_MS` 保持 600000）。
- 不碰 D12 注入与重跑区（`generate-draft.command.ts:1205-1224`、`:1593-1621`）、`chapter-materials.ts:608-624`、`archive/`、仓外 `.backups`。

### 3.1 三态缺口（developer 只读期实测 2026-11-22，本卡必须处理）

- 超时链路**已接通生产**：`electron/services/generation-run-service.ts:206-207` 调 `resolveCallDeadline(budgetRemainingMs)` 与 `runDeadlineTimeout`，按「root 剩余预算 vs 10 分钟上限取早」留一条 deadline，超时 `block(root, code)` 后由 D2 的 `finalizeFailedGeneration` 收尾。⇒ 本卡不需要重建超时机制。
- 但三态观测没有生产接线：`createSingleCallWatchdog`（`generating` / `timed-out` / `failed`，`src/shared/generation-call-timeout.ts:64` 起）**没有任何生产调用方**，只有 `src/shared/__tests__/generation-call-timeout.test.ts` 用到；渲染层只认失败码 `GENERATION_CALL_TIMEOUT`（`src/components/panels/ai-output-failure-presentation.ts:182`）。
- ⇒ 判据 3 的落地口径（本卡定死）：**必须把 watchdog 接进生产**（主进程 `generation-run-service.ts` 一侧产出阶段态，经既有 IPC 到渲染层展示），由卡面指定接点、接到哪一层、以及「生成中」与「已中止」如何区分；不接受「只改文案、不接线」。若实现在既有 IPC 上新增字段，须在报告里写明通道名与字段名，并给单测断言该字段在三态下取值不同。

**硬约束（群管理分身 2026-11-22 04:2x 定，原文照抄）**：只加接线，不许动 `DEFAULT_SINGLE_CALL_TIMEOUT_MS` 语义，不许改既有 `block(root, code)` → `finalizeFailedGeneration` 收尾路径——否则牵连 D2 已验收链路。

**裁定（负责人 2026-11-22 04:5x，改为 (b) 收口）**：本卡判据 3 只要求界面三档可辨，用既有文案与状态达成即可；`callPhase` 过 IPC 到渲染层（`main-generation-owner.ts:265-268`、`generation-runtime.ts:82-93`、`:242` 的 identicalContent 比较）**不在本卡**，另立 D9b 卡走正常派单与首验。理由：D9 的对象是「超时真的中止」，把渲染层透传并进来会让本卡拉长、牵连快照比较逻辑；拆分后两张卡各自可判。

**记录项（不计判据）**：超时档界面没有「错误码：」行，超时码走 `activityDiagnostics.failureCode`；这是既有设计，本卡不要求补 `error.code`，也不因缺该行判红。

## 4. 允许改码区（白名单）

- `src/shared/generation-call-timeout.ts`（只在必要时补导出，不改常量与纯函数语义）
- `electron/services/generation-run-service.ts`（`:206` 一带：把 cap 变成可注入参数）
- `electron/services/generation-run-timeout.ts`（只在不满足判据时动）
- `src/components/panels/ai-output-failure-presentation.ts`（文案两档）
- 对应 `__tests__`；交件报告 `.batch/night/staging/s2-d9-call-timeout-report.md`

**实机触发手段（二选一，先 A）**：
- **A（推荐）测试注入点**：给 `generation-run-service.ts:206` 的 cap 增加一个**仅测试用**的取值来源（如主进程读 `AIWRITER_D9_CALL_TIMEOUT_MS`，未设或非法则 600000），并在报告里写明「默认行为不变」的单测断言。此项只服务实机验收，不改变生产默认时长；若你认为它越界，走 B。
- **B（保底）真等**：不改任何取值来源，用不响应的模型端点真等满 10 分钟。允许，但必须在报告里贴完整起止时间戳（证明真的等满）。

## 5. 验收判据（QA 首验逐条，逐条要输出原文）

| # | 判据 | 证据形态 |
|---|---|---|
| 1 | 实机跑出一次真实超时中止：单次调用到上限即中止，run 不是永久 `running` | 贴命令原文、起止时间戳、末行 JSON |
| 2 | 两条合看：①`generation_roots.blocked_code = GENERATION_CALL_TIMEOUT`（该列在 roots，`generation_runs` 无此列，写入点 `generation-run-repository.ts:757-759`）②对应 `generation_runs.status = failed`（非 running、非无码 paused） | 贴 SQL 与两表行原文 |
| 3 | 三态可辨：生成中 / 超时已中止 / 调用失败 在**界面**上各不相同（用既有文案与状态即可，不要求 phase 过 IPC） | 贴三档界面原文（中/英）与触发条件（11-22 04:48 由负责人修订：原要求 callPhase 过 IPC，因牵连 generation-runtime.ts:242 的 identicalContent 比较，改为界面三态可辨；渲染层透传另立 D9b） |
| 4 | 预算小于上限时归 `ROOT_BUDGET_EXHAUSTED`（不得混成超时） | 贴一条对应输出或单测断言原文 |
| 5 | 单测覆盖「cap 注入默认不变」与「三态切换（含 watchdog 生产接线后的阶段态取值）」；相关测试文件**整文件**全绿；`pnpm check:fast` → `EXIT=0` | 贴 `pnpm test <测试文件>` 的**整文件汇总行原文**（`Tests N passed (N)`）与 `EXIT=`，再贴 `check:fast` 末行与 `EXIT=` |

**判据 5 取证口径（负责人 11-22 裁定，与 D13 同一口径）**：只认整文件汇总行——`pnpm test <测试文件>` 的 `Tests … passed (…)` 与 `EXIT=`；`-t` 过滤结果（`1 passed | N skipped` 一类）一律视为无效证据。理由：过滤跑只执行被点名的用例，同文件既有不变量不进判定，D13 首验即因此放过了 `:5964` 的红。

**交件前自跑**：执行方在交件前必须自己先跑一次上述整文件测试并贴汇总行与 `EXIT=`；把红留给 QA 发现按不合格交件处理。

任一条给不出输出原文 ⇒ 不通过。D9 转 ✅ 由产品经理做，执行方不自行改缺陷稿。

## 6. 外派位

- **可外派（静态活）**：核对超时链路的全部调用点与「三态」出口清单、起草最小复现步骤（把不响应的客户端做法写成脚本说明）。产物只交证据件到 `.batch/night/bridge/to-owner`，在 `wt-2` 干活、不进主区。
- **不可外派**：实机复验（起应用＋playwright）——`develop` 由 developer 执行（主人 11-21 19:07；AGENTS 第 8 条）。
- 外派件四样齐全；产物回流方式＝证据件，不许直推。

## 7. 回执与交付

- 一卡一分支（`card/s2-d9-call-timeout`），不合并、不 push。
- 交件：报告路径 + 提交 sha + `git diff --ignore-cr-at-eol --stat`。
- 回执：`.batch/night/bridge/to-owner`；群里交件 @ 项目总负责人 与 QA。
- 停手：若实机证明「不注入就只能在 10 分钟真等」且你认为 A 越界 ⇒ 停手报，由我裁 A/B。

## 8. 实例纪律（群管理分身 2026-11-22 00:2x 硬纪律，验收必查）

- 实机验收脚本一律**单实例复用、跑完必关**：`try/finally` 包住流程，finally 里 `app.quit()`；父进程异常先死时，连 electron 子进程树一起收。禁止并发起第二个实例。
- evidence 必须增三项：`instancesThisRun`（应为 1）、`exitCode`、`leftoverElectronProcesses`（须为 0）。
- D9 这条尤其要紧：本卡要真等 10 分钟，等待期内不得再起实例；判据 1 的起止时间戳须与实例数、残留数同屏给出。
