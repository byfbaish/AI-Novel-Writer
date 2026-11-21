# 派验单 · CARD-S2-D9（单次调用超时：三态可辨 + 实机中止）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验）
卡面：`.batch/night/cards/s2-d9-call-timeout.md`（判据 §5，白名单 §4，禁改区 §3，实机触发手段 §4 的 A/B）
执行方：developer · AI writer项目组
顺序：S2 第二张，D13 交件后开。

## 判据索引（逐条要输出原文）

| # | 判据 | 必报字段 |
|---|---|---|
| 1 | 实机真实超时中止 | 命令、起止时间戳、末行 JSON、`EXIT=` |
| 2 | `generation_roots.blocked_code=GENERATION_CALL_TIMEOUT` + 对应 `generation_runs.status=failed`（列在 roots，runs 无此列） | 两表行原文 |
| 3 | 三态可辨（生成中／超时中止／调用失败）**在界面**各不相同，用既有文案与状态即可（不要求 `callPhase` 过 IPC） | 三档界面原文 + 触发条件 |
| 4 | 预算小于上限归 `ROOT_BUDGET_EXHAUSTED` | 输出或单测断言原文 |
| 5 | 单测覆盖 cap 注入默认不变、三态切换（含 watchdog 生产接线后的阶段态取值）；相关测试文件**整文件**绿；`check:fast` 绿 | 整文件汇总行 `Tests N passed (N)`、`EXIT=` |

实例纪律三项（卡面 §8）必须与判据 1 同屏：`instancesThisRun`＝1、`exitCode`、`leftoverElectronProcesses`＝0。等待期内不得再起实例。

## 必报命令（原样贴出）

- 实机：验收脚本命令 + 末行 JSON + `EXIT=`；走卡面 §4 的 A 或 B，走 B 必须贴完整起止时间戳。
- DB：`generation_roots` 该行的 `blocked_code` 原文 + 同 run 在 `generation_runs` 的 `status` 原文（`blocked_code` 只在 roots；runs 无此列）。
- 单测与闸门：`pnpm test <相关路径>` 汇总行；`pnpm check:fast` 末行与 `EXIT=`。

## 不可外派

实机复验须在 `develop` 由 developer 执行（主人 11-21 19:07；AGENTS 第 8 条）。静态活（调用点清单、复现步骤）可外派，产物只登记、不进判据。

## 判定纪律

- 「可配置」那条延后项**不入本卡判据**（卡面 §3）；若 developer 顺手改了 budget 键集或版本分支，按越界打回。
- 判词落 `.batch/night/reports/s2-d9-qa-firstcheck.md`，直投 `.batch/night/bridge/to-owner`。
- D9 状态转 ✅ 由产品经理做。

## 取证口径（负责人 11-22 裁定）

- 判据 5 只认整文件汇总行：`pnpm test <测试文件>` 的 `Tests … passed (…)`＋`EXIT=`；`-t` 过滤结果视为无效证据。
- 判据 3 不给接线点与字段名 ⇒ 该条不通过（「只改文案、不接线」不算三态）。
- 卡面现 83 行 / 8,477B / `fea4b4fcdcd24137`；§3.1 为三态缺口条。
- 裁定改为 (b) 收口（负责人 2026-11-22 04:5x）：`callPhase` 过 IPC 另立 D9b，不在本卡；卡面 89 行 / 9,660B / `db8d01f60ac952d0`。
- 记录项：超时档无「错误码：」行属既有设计，不判红。
