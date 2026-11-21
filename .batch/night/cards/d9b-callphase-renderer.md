# CARD-S2-D9b · 单次调用阶段态（callPhase）透传到渲染层

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（主身派单时转达）
状态：待派（S2 内不派，排 D1 之后）
来源：D9 拆出（负责人 2026-11-22 04:48 裁定 (b) 收口，见 `.batch/night/cards/s2-d9-call-timeout.md:62` 行末修订注）

## 0. 必读确认（开工时先写三行，缺三行不 start）

① 读了哪几份（路径）② 各自当前版本或日期 ③ 据此要遵守的三条口径。
必读：仓根 `README.md`、仓根 `AGENTS.md`、`.batch/night/org/ruling-dispatch-*.md` 最新一版。

## 1. 问题（本卡对象）

D9 已让超时链路在生产接上并按 `block(root, code)` → `finalizeFailedGeneration` 收尾（提交 `8ae59d0a`）。但「单次调用处于哪一态」没能出主进程：

| 环节 | 现状 | 出处 |
|---|---|---|
| 生产取值 | `deps.onCallPhase?.(...)` 只在主进程内回调 | `electron/services/generation-run-service.ts:212` |
| watchdog 定义 | `generating`／`timed-out`／`failed` 三态已定义 | `src/shared/generation-call-timeout.ts:64` |
| 生产调用方 | **无**（仅单测用到） | 同上 |
| 快照字段 | `MainGenerationSnapshot` 无 phase 字段 | `src/services/generation/generation-runtime.ts:82-93` |
| 合并点 | 只合并 `event.diagnostics` | `electron/services/main-generation-owner.ts:265-268` |
| 渲染层 | 只认 `GENERATION_CALL_TIMEOUT` 码 | `src/components/panels/ai-output-failure-presentation.ts:182` |

结论：现有实现下达不到「渲染层能区分生成中／超时中止／调用失败」。本卡补这一段，不动 D9 已验收的中止与收尾路径。

## 2. 范围

做：`callPhase` 从主进程生产取值 → 快照/IPC → 渲染层可读，界面对三态给不同文案或状态。
另加一项（群管理分身 2026-11-22 04:5x 定）：**超时文案按实际上限渲染**——现文案写死「超过 10 分钟」，注入较小 cap（D9 实机用 `AI_NOVEL_CALL_TIMEOUT_CAP_MS=2500`）时文字与事实不符；须由上限值生成文案（默认 10 分钟时文字不变）。
不做：不改 `DEFAULT_SINGLE_CALL_TIMEOUT_MS`；不改 `block(root, code)` → `finalizeFailedGeneration` 收尾；不改 `generation-runs`／`generation_attempts` 表结构；不改 D9 卡判据。

## 3. 禁改区

- D9 已验收的 `electron/services/generation-run-service.ts:206-207` 与 `generation-run-timeout` 收尾调用链。
- D12/D13 已验收的 `generate-draft.command.ts` 重演重写段与 `chapter-failure.ts` 受控码表。
- 既有断言：不得以删改既有测试让新逻辑变绿（只加不减）。

## 4. 允许改码区（白名单）

`src/shared/generation-call-timeout.ts`（如需导出阶段态类型）、`electron/services/generation-run-service.ts`（挂 watchdog 调用）、`electron/services/main-generation-owner.ts:265-268`（合并 phase 进快照）、`src/services/generation/generation-runtime.ts:82-93`（快照类型）与 `:242`（`identicalContent` 比较需容纳新字段，**不得因新字段让比较恒 false**）、`src/components/panels/ai-output-failure-presentation.ts`（三态文案）、对应 `__tests__`。

**注意**：`generation-runtime.ts:242` 的 `identicalContent` 若把 phase 算进比较内容，会让本可命中的去重失效——须显式把 phase 排除在比较之外，并在报告里贴该判断的代码行。

## 5. 判据

| # | 判据 | 证据形态 |
|---|---|---|
| 1 | 渲染层能读到 `callPhase`，取值覆盖三态各至少一次 | 贴界面/快照原文 + 字段名与取值 |
| 2 | 三态在界面各不相同（文案或状态可辨） | 贴三档界面原文（中/英）与触发条件 |
| 3 | `identicalContent` 不受 phase 影响（去重仍命中） | 贴相关单测名与整文件汇总行 |
| 4 | 相关测试文件**整文件**全绿；`pnpm check:fast` → `EXIT=0` | 贴 `Tests N passed (N)` 与 `EXIT=`（`-t` 过滤无效） |
| 5 | 实例纪律：`instancesThisRun=1`、`exitCode`、`leftoverElectronProcesses=0` | 与判据 1 同屏 |

## 6. 外派位

本卡不宜外派：判据 1/2/5 都是实机（起应用＋playwright 走流程），按主人 11-21 19:07 裁定须在 `develop` 由 developer 执行（AGENTS 第 8 条）。静态活（快照字段链、比较逻辑读码）可外派，产物只作登记、不进判据。

## 7. 可复制范围与预算

追平：在 `src/services/generation/generation-runtime.ts` 与 `electron/services/generation-run-service.ts` 之间以一次提交为限，不追全部调用族；预算不足即停手报现值，不放宽。
