# CLAIM WB-E1

- 时间：2026-11-12（下午批，UTC+8）
- 卡号：WB-E1 七个 electron/services 用例的 cleanup 换 discardTree
- 授权：可改码 + 可提交（不含推送）；时间盒 60 分钟。
- 一句话计划：先核四项前提 → 写本 CLAIM → 只改 7 处 cleanup 为 `discardTree(root)`（各加 1 行 import）→ 逐个 `node scripts/run-tests-electron.mjs <单文件>` 并采 S0/S1 → #4 反例对照 → 写 `fix-enotempty.md` → `pnpm check:fast` → 提交（不推送）→ tag review。
- 判定线：**以补充判定线为准**，卡面第 3 条改为集合断言 —— 跑前 `S0.txt`、跑完 `S1.txt`，判 S1 ⊆ S0（新增=0 为 PASS），不判残留=0；7 文件 ENOTEMPTY=0；`%TEMP%\discard-*` 只记「不增长」、不算失败、不手工删。补充判定线在开跑前到达，本轮无旧口径跑测数据需作废。
- 前提（已实读，非 BLOCKED）：`test/helpers/temp-dir.ts:39` 导出 `discardTree`；`vite.config.ts:135` 有 `globalSetup`；`test/global-setup.ts:14-16` 只有 setup、无 teardown；`scripts/run-tests-electron.mjs` 存在且参数原样透传 vitest。先例 `project-archive-service.test.ts:31` import 写法一致。
- 基线（13:44 实测）：分支 `exp/resource-ledger`；`git status --porcelain electron/` = 0 行；`.runtime/.cache/novel-quality-modernization` 条目 9；`%TEMP%\discard-*` = 6；7 处现值与卡面行号逐一吻合。全库另有 5 行既有改动（`docs/README.md` 及 3 个未跟踪 docs 文件 + 整个 `.batch/` 未跟踪），**不在本卡提交范围**，提交时精确 `git add` 指定路径。
- 已确认红线：不改断言 / 不改业务代码 / 不动 7 处以外的 `rmSync`（含 `external-file-grant-service.test.ts`、`legacy-project-copy-import.test.ts:245/:767`）/ 不跑全量 / 不用 `pnpm test` 多路径 / 不跑 `pnpm check:full` / 不自己 `review --pass` / 不 append 已有报告 / 不推送。
- 待裁决（不阻塞执行，收口时汇总）：① 判定线要求「跑前跑后 `git status --porcelain electron/` 都是 0 行」，但本卡按授权改的 7 个文件在提交前必然是 7 行 `M`；本轮改采「前后输出逐字节一致 = 测试未额外触碰源码树」的等价判据并如实记录绝对行数。② 看板无 WB-E1 卡（`list --query` 多词均未命中），最后一步 tag review 无卡 ID 可打，不造卡、不误 tag。
