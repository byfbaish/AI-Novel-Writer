# STOP-wb · 停手记录（夜跑 11-12 · WorkBuddy 实机批）

停手时间：2026-11-12 03:25 +0800 —— WB-6 **单卡 40 分钟盒到点**（有效运行 `START=02:45:07` → 盒满 `03:25:07`）；**不是 08:00 全局硬停**，距硬停尚有 4 小时 35 分。触发原因：单卡时间盒用尽且该卡已确认无进展。

已完成：WB-7 全套交付（`CLAIM-WB-7.md` / `wb-7.md` / `wb-7-run-1.log`；唯一一次运行得 `1 failed / 836 passed / 837`、91.86s、exit 1，判 **FAIL = 基线漂移**）；WB-6 已写 `CLAIM-WB-6.md`、已按字面命令发起**唯一一次** `pnpm test`（未重跑、未刷绿、未改任何代码/测试/文档）、完整输出已落盘 `wb-6-run-1.log`。

未完成：WB-6 的 `pnpm test` 全量未在盒内结束，vitest 最终汇总行（Test Files / Tests / Duration / Failed Tests）**始终未出现**，exit code 与 passed / failed / total / 真实耗时均**未取得**，**今晚基线未建立**；`wb-6.md` 以 `BLOCKED` 结论收口，不编数字、不写「部分通过」。

卡在哪一步：`pnpm test` 自 `02:53:25`（`wb-6-run-1.log` 最后写入时间，1,034,112 字节）起 stdout/日志零新增，后台 stdout delta 恒为 570953 字符；主测试进程 `electron pid=24292` CPU 在 02:55:42 为 35.5s、03:06:32 仍为 35.6s（等待态而非计算态）；日志中已出现 13 次 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`（栈落在 `rmSync`/`wrappedRmSync`，非断言）与大量整文件失败，但**根因未查、不作推断**。40 分钟盒到点即停手：**未杀进程（避免越权）、未重跑、未改任何文件、未自己 review --pass**；后台任务 `ivfiyg` 与对应 electron/node 进程可能仍在，留待主人处置。

---
停手后的收尾动作：仅写 `wb-6.md`（BLOCKED 报告）与必要的只读取证，均在 `.batch/night/reports/` 内；不再发起任何测试命令。
