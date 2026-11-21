# 派单件 · S2-D9（超时中止＋三态生产接线）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）
抄送：QA · AI writer项目组（首验方）
派单时点：2026-11-22 04:4x（D13 PASS 5/5 之后）
回执：`.batch/night/bridge/to-owner`

## 1. 派什么

- 卡面：`.batch/night/cards/s2-d9-call-timeout.md` —— 83 行 / 8,477B / sha256 前 16 位 `fea4b4fcdcd24137`。
- 派验单：`.batch/night/review-requests/s2-d9-call-timeout.md` —— 41 行 / 2,562B / `da8e7755f1dae436`。
- 顺序：D9 第二张；D1 仍候，不许提前起分支。

## 2. 起点与分支

- 一卡一分支 `card/s2-d9-call-timeout`，**起点钉 `0f0ca3ee`**（不为 D13 的 `a4503f10` 让路：D13 未合并，合并由主身做）。
- 不合并、不 push（push 只由主身）。

## 3. 本卡新增的定死口径

1. **§3.1 三态缺口**：超时链路生产已接（`generation-run-service.ts:206-207` → `resolveCallDeadline`／`runDeadlineTimeout`，超时 `block(root, code)` 后由 D2 `finalizeFailedGeneration` 收尾）；但 `createSingleCallWatchdog`（`generating`/`timed-out`/`failed`）**无生产调用方**，渲染层只认 `GENERATION_CALL_TIMEOUT` 码。判据 3 要求把 watchdog 接进生产，报告写明接点（文件:行）与 IPC 字段名；只改文案不算。
2. **判据 5 只认整文件汇总行**：`Tests … passed (…)` + `EXIT=`；`-t` 过滤视为无效证据。
3. **交件前自跑**：执行方交件前先自己跑整文件测试并贴汇总行，把红留给 QA 发现按不合格交件处理。
4. 实机触发仍走 A（测试注入点，默认 600000 不变 + 单测断言）/ B（真等 10 分钟贴起止时间戳）；「可配置」延后项不入本卡。

## 4. 白名单与禁改

见卡面 §3/§4：可改 `generation-call-timeout.ts`（仅必要导出）、`generation-run-service.ts:206` 一带、`generation-run-timeout.ts`（仅判据需要时）、`ai-output-failure-presentation.ts` 文案、对应测试、报告。禁改 D12 注入与重跑区、`chapter-materials.ts:608-624`、`archive/` 字节、仓外 `.backups`、`DEFAULT_SINGLE_CALL_TIMEOUT_MS` 常量语义。

## 5. 开工三步

1. 贴 §0 必读确认三行；
2. 贴 `git rev-parse HEAD`（应在 `0f0ca3ee` 起分支）、目标文件存在、R4 双空；
3. 动手。

## 6. 交件与首验

- 交件：报告路径 + 提交 sha + 父 sha + 整文件汇总行 + `EXIT=` + R4 双空，群里 @ 项目总负责人 与 QA。
- QA 按卡面 §5 五条逐条要原文；判词落 `.batch/night/reports/s2-d9-qa-firstcheck.md` 并直投 `.batch/night/bridge/to-owner`；D9 转 ✅ 由产品经理做。
- 实例纪律三项（`instancesThisRun`=1、`exitCode`、`leftoverElectronProcesses`=0）与判据 1 同屏给出。
