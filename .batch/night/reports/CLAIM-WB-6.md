# CLAIM-WB-6 · 认领声明（夜跑 11-12 · WorkBuddy 实机批）

- 认领时间：2026-11-12 02:43 +0800 之后，紧随 WB-7 有效运行 `END=2026-11-12 02:43:01 +08:00`
- 卡号：**WB-6** · `pnpm test` 全量建基线（取数卡，非判读卡）· **只跑一次**
- 本轮授权：只读 + 允许跑全量测试 + **唯一允许写入** `.batch/night/reports/`；不改任何代码 / 测试 / 文档，不执行 `git add/commit/push/checkout/stash`，不删 `node_modules`、不重建 ABI，不重跑刷绿，不 append 既有报告，不自己 `review --pass`
- 工作区自证：`pwd` = `/c/develop/workspace/AI-writer/develop`；`git rev-parse --show-toplevel` = `C:/develop/workspace/AI-writer/develop`（与要求的主区一致）；分支 `exp/resource-ledger`
- 输入前提：`package.json` 含 `test` 脚本 = `node scripts/run-tests-electron.mjs` ✅（已读文件核对）；`scripts/run-tests-electron.mjs`、`node_modules/electron/dist/electron.exe`、`node_modules/vitest/vitest.mjs` 均 `Test-Path` = True
- 唯一执行命令（本卡只发起一次，不重试、不补跑、不挑结果）：`pnpm test`
- 执行终端：**PowerShell 7**（遵循 `.workbuddy/memory/notes/env-and-conventions.md`「不要用 Git Bash 跑 pnpm，npm shim 的 node 路径会损坏」）
- 执行口径：**按任务字面命令原样执行**，不加 `env -u`、不摘变量、不改环境。取证发现本会话已注入 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` + `CODEBUDDY_TOOL_CALL_ID`（safe-delete 阈值 50 守卫开启；项目笔记第 34 轮记载全量跑测可能因此产生栈落在 `rmSync`/cleanup 的假失败，failed 数虚高）。本次不擅自变更口径，如实取数；失败清单逐条标注栈落在断言还是 cleanup，口径问题汇总为待裁决项。
- 本卡性质：`pnpm test` 全量**从未跑过**，今晚第一次建基线，后续红绿以它为参照；**不因为数字难看而修任何东西、不重跑**。
- 时间盒：单卡 40 分钟；**08:00 硬停** → 停手先写 `STOP-wb.md`（已完成 / 未完成 / 卡在哪一步各一行）
- 证据落盘：`.batch/night/reports/wb-6-run-1.log` = 本次唯一一次运行的完整 stdout+stderr（文件名 `run-1` 自证只跑一次）
- 交付：`.batch/night/reports/wb-6.md`，含 ①exit code ②passed / failed / total / 耗时 ③失败用例 `文件:行`（无失败写「0 条」）④一句话「今晚基线，后续以此参照」，末行 `DONE`；无产物不许 done
- 判定线（自检）：wb-6.md 存在 + 首段含 `结论：` + exit code 明确 + 四个数齐 + 失败清单每条带 `文件:行`

状态：CLAIMED（认领完成，尚未执行）
