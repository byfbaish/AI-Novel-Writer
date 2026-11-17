# CLAIM-WB-7 · 认领声明（夜跑 11-12 · WorkBuddy 实机批）

- 认领时间：2026-11-12 02:39 +0800（自证命令 `date` 输出 `2026-11-12 02:38:56 +0800`）
- 卡号：**WB-7** · browser 全量判读 · **只跑一次**
- 本轮授权：只读 + 允许跑全量测试 + **唯一允许写入** `.batch/night/reports/`；不改任何代码 / 测试 / 文档，不执行 `git add/commit/push/checkout/stash`，不删 `node_modules`、不重建 ABI，不重跑刷绿，不 append 既有报告，不自己 `review --pass`
- 工作区自证：`pwd` = `/c/develop/workspace/AI-writer/develop`；`git rev-parse --show-toplevel` = `C:/develop/workspace/AI-writer/develop`（与要求的主区一致）；`git rev-parse --abbrev-ref HEAD` = `exp/resource-ledger`
- 输入前提：`vitest.browser.config.ts` 存在（`Test-Path` = True）✅
- 唯一执行命令（本卡只发起一次，不重试、不补跑、不挑结果）：
  `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts`
- 执行口径：**按任务字面命令原样执行**，不加 `env -u`、不摘变量、不改环境。取证发现本会话已注入 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` + `CODEBUDDY_TOOL_CALL_ID`（`.workbuddy/memory/notes/env-and-conventions.md` 第 34 轮记载：全量跑测可能因 safe-delete 阈值 50 产生栈落在 `rmSync`/cleanup 的假失败）。本次不擅自变更口径，如实取数，噪音在报告中逐条标注并汇总为待裁决项。
- 与 11-11 基线比对口径：基线 `2 failed / 835 passed / 837 total`、99.3s，失败点 B11 `RendererStartup.browser.tsx:130/:137`、B16 `CodeMirrorEditor-generation.browser.tsx:281`；本次用同一条命令、同一工作区、同一会话环境，保证可比。
- 时间盒：单卡 40 分钟；**08:00 硬停** → 停手先写 `STOP-wb.md`（已完成 / 未完成 / 卡在哪一步各一行）
- 证据落盘：`.batch/night/reports/wb-7-run-1.log` = 本次唯一一次运行的完整 stdout+stderr（文件名 `run-1` 即自证只跑一次）
- 交付：`.batch/night/reports/wb-7.md`，末行 `DONE`；无产物不许 done
- 判定线（自检）：wb-7.md 存在 + 首段含 `结论：` + failed/passed/total 三个数齐 + 每条失败用例带 `文件:行`

状态：CLAIMED（认领完成，尚未执行）
