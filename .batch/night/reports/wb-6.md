结论：BLOCKED ｜ 产物：.batch/night/reports/wb-6.md ｜ 判定线：Test-Path ./.batch/night/reports/wb-6.md; Select-String -Pattern '结论：|exit code|passed|failed|total|\.test\.(ts|tsx|mjs):[0-9]+' ./.batch/night/reports/wb-6.md ｜ 证据：wb-6-run-1.log 定格在 02:53:25（1,034,112 字节 / 5900 行）、0 条 vitest 汇总行，`pnpm test` 在 40 分钟盒内未退出 → exit code 与四个数均未取得（见 STOP-wb.md）

# WB-6 · `pnpm test` 全量建基线（夜跑 11-12 · 只跑一次）

## 0. BLOCKED 卡点（哪条命令报什么错）

- 命令：`pnpm test`（= `node scripts/run-tests-electron.mjs`，在 develop 根、PowerShell 7 中执行，**唯一一次发起，未重跑**）。
- 卡点：命令**没有报错退出，也没有正常退出**。有效运行 `START=2026-11-12 02:45:07 +08:00`，日志最后写入 `02:53:25`（运行 8 分 18 秒后），此后 stdout 与日志**零新增**至停手（03:25，静默 31 分 42 秒）；后台 stdout delta 恒为 570953 字符。主测试进程 `electron pid=24292` CPU 02:55:42 为 35.5s、03:06:32 仍为 35.6s —— 等待态而非计算态。**vitest 最终汇总行（`Test Files` / `Tests ` / `Failed Tests` / `Duration`）始终未出现**，进程未退出，故 `$LASTEXITCODE` 无法读取。**单卡 40 分钟盒（02:45:07 → 03:25:07）用尽，停手**，先写 `STOP-wb.md`。
- 日志中唯一成体系的错误串（13 次，示例 `wb-6-run-1.log:17`）：
  `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":50,"threshold":50,"scope":"turn",...}`，栈落在 `checkBulkDeleteGuard → tryTrash → tryRm → Object.wrappedRmSync [as rmSync]`，**不是断言**。与 `.workbuddy/memory/notes/env-and-conventions.md` 第 34 轮记载的「全量跑测 cleanup 假失败、failed 数虚高」一致；是否与本次挂起有因果关系**未查证，不作推断**（T0：不猜根因）。
- 停手处置：**未杀进程、未重跑、未刷绿、未改任何代码/测试/文档、未自己 review --pass**；后台任务 `ivfiyg` 及对应 electron/node 进程可能仍存活，留待主人处置。

## 1. 四个数（全部如实标注为「未取得」，不编数字）

| 指标 | 值 | 说明 |
|---|---|---|
| **exit code** | **未取得** | 进程在盒内未退出，`$LASTEXITCODE` 无从读取；**不是 0、也不是 1**，不做推断 |
| **passed** | **未取得** | 全量汇总未产出 |
| **failed** | **未取得** | 全量汇总未产出 |
| **total** | **未取得** | 全量汇总未产出 |
| **耗时** | **未取得**（全量 duration 未产出） | 可核查的观测窗口：有效运行到停手 **40 分钟**（02:45:07–03:25:07）；其中最后一次输出在 02:53:25（运行 8m18s），之后静默 31m42s |

> 判定线要求「exit code 明确 + 四个数齐」，本卡因 BLOCKED **无法满足**，故不伪造、不用部分数字冒充全量；此处按全局规则「BLOCKED 必须带卡点」收口。

**可核查的部分读数（明确：非全量、不可作基线、不计入上表）**：日志 5900 行中含 **62 条**文件级 `N tests | M failed` 结果行，这些行里累计 **1074 failed**；典型如 `scripts/__tests__/quality-modernization-run.test.mjs (195 tests | 129 failed)`（log:499）、`electron/services/__tests__/main-generation-owner.test.ts (187 tests | 186 failed)`（log:1434）、`electron/controllers/__tests__/generation-controller.test.ts (45 tests | 45 failed)`（log:1980）。这些是**已跑完文件**的读数，不是全量汇总，也不代表真实失败率（大量栈落在 cleanup 的 safe-delete 噪声）。

## 2. 失败清单（`文件:行`）

**完整失败清单未产出** —— vitest 的 `Failed Tests` 汇总区未生成，这是 BLOCKED 的直接后果，不编造清单。

日志中**可核查**的失败栈定位共 **91 条**带 `文件:行` 的记录，抽样如下（来自 stderr 栈，非 vitest 失败清单）：

1. `electron/__tests__/knowledge-base-original-copy.test.ts:41:10` — `removeDocumentInternal` 删除副本时被 safe-delete 守卫拦下（log:17-24）。
2. `electron/__tests__/knowledge-base-original-copy.test.ts:91:74`
3. `electron/__tests__/knowledge-base-original-copy.test.ts:93:19`
4. `electron/__tests__/knowledge-base-original-copy.test.ts:144:18`
5. `electron/__tests__/knowledge-base-embedding-space.test.ts:370:30`
6. `electron/__tests__/knowledge-base-embedding-space.test.ts:551:18`
7. `electron/__tests__/knowledge-base-embedding-space.test.ts:589:50`

文件级失败行（62 条）的完整清单见 `wb-6-run-1.log`（可用 `Select-String -Pattern '\d+ failed'` 复现）；其中末尾 10 行日志均为通过的小文件（如 `src/components/updates/__tests__/update-retry-action.test.ts (1 test) 2ms`），说明日志止于「文件仍在陆续跑完、但全量汇总未到」的阶段。

## 3. 一句话（基线状态）

**今晚基线未建立**：`pnpm test` 全量在 40 分钟单卡盒内未跑完、未产出汇总，**本卡不能作为后续红绿参照**；按卡要求本应写「今晚基线，后续以此参照」，但该句的前提（四个数齐、exit code 明确）今晚不成立，故如实写明未建立，留待主人裁定口径后重取（本次不擅自重跑）。

## 4. 执行记录（证据链）

| 项 | 值 |
|---|---|
| 工作区自证 | `git rev-parse --show-toplevel` = `C:/develop/workspace/AI-writer/develop`；分支 `exp/resource-ledger` |
| 输入前提 | `package.json` 有 `test` 脚本 = `node scripts/run-tests-electron.mjs` ✅；`run-tests-electron.mjs` / `electron.exe` / `vitest.mjs` 均存在 |
| 唯一执行命令 | `pnpm test`（PowerShell 7；遵循项目笔记「不要用 Git Bash 跑 pnpm」） |
| 有效运行次数 | **1 次**（无重试、无补跑、无挑结果） |
| 证据 | `.batch/night/reports/wb-6-run-1.log`（1,034,112 字节 / 5900 行，唯一一次运行的完整 stdout+stderr）；停手记录 `STOP-wb.md`；认领声明 `CLAIM-WB-6.md` |
| 执行口径 | 严格按字面命令原样执行，**未加 `env -u`、未摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` / `CODEBUDDY_TOOL_CALL_ID`、未改环境变量**。取证：这两个变量在本会话确实存在（safe-delete 阈值 50 守卫开启），日志已实证其影响。不擅自变更基线口径、不因数字难看而修任何东西。 |
| 编码说明 | 日志中文经 PowerShell 管道呈 GBK 乱码；判定所需的数字、路径、行号、错误串均为 ASCII 且完整。 |

## 5. 反例自检

- 改测试/代码让它变绿 → 未踩：全程只读，唯一写入是 `.batch/night/reports/` 内的 CLAIM / 报告 / log / STOP。
- 只贴日志尾巴不写结论 → 未踩：首段结论行 + §0 卡点 + §1 四个数状态 + §3 基线状态均明确。
- 报「部分通过」不给数 → 未踩：明确写「未取得」，部分读数单列并标注「非全量、不可作基线」，不冒充全量。
- 重跑刷绿 → 未踩：有效运行 1 次，超时后停手，未发起第二次。

## 6. 待裁决项（不擅自处理，仅汇总）

1. **口径**：是否把 `pnpm test` 全量的标准口径改为带 `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID`（项目笔记第 34 轮建议）？本次按字面命令裸跑，如实记录了 13 次 safe-delete 命中与 1074 条文件级 failed（含大量 cleanup 噪声）。
2. **时间盒**：全量在 40 分钟内未跑完（且后 31 分钟静默），是否放宽单卡时间盒、或改为分目录建基线？需主人裁定，本次未擅自变更。
3. **挂起根因**：日志止于 02:53:25 后的静默、CPU 不再增长，是否与 safe-delete 批量确认等待有关**未查证**；按 T0 不猜根因，未做任何代码/环境排查。
4. **后台进程**：`ivfiyg` 及 electron/node 进程未终止（避免越权），是否清理由主人决定。
5. **WB-7 的连带影响**：WB-7 已交付（FAIL = 基线漂移），不受本卡 BLOCKED 影响；两张卡互不依赖。

> `DONE` 仅表示**本卡报告交付收口**（CLAIM + 报告 + 日志 + STOP 均已落盘），**不表示测试取数完成**；本卡结论为 BLOCKED，基线未建立。

DONE
