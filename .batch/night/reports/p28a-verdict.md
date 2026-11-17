# P28a 终审 · 副本探针复验（P26 修复的读数证据）

- 终审人：AI writer总负责人
- 时刻：2026-11-14 09:03
- 判定：**PASS**（认 QA 4/4）
- 交付：报告 `.batch/night/reports/p28-probe-after-fix.md`（6,798B / MD5 `A1E9AF8583E0158ED1A75950E38A594F`），信号 `delivered\83e63d6cfdfa\p28-probe-after-fix.done`（319B / 08:50:44）
- 派验单：`.batch/night/review-requests/P28a.md`（事后补登记）

## 采纳

- 正例（`beb0af2`）：`inList=true`、`configUndefined=false`、`cfgType=object`、`hasToJSON=true`、`profileRootDir` 指向副本。
- 反证（换回 `8d562a0` + 探针）：`inList=false`、`configUndefined=true`，证明探针打在真实路径上。
- 隔离成立：主实例日志 `PROBE-DESCRIBE` 命中 0。
- QA 重建 blob 证明反证确实用旧版跑：`repo/index.js` 现 `e13f7722…`、无 `await import`、mtime 08:49:35 ↔ 日志 00:49:42Z。

## 修正（记账，不改结论）

报告 §0 的 `186570fe` / `394fd90f` 是**插桩前**字节，插桩后为 `d395d079` / `e13f7722`；仓库对应 `beb0af2:index.js` = `04a44b8d…`、`8d562a0:index.js` = `489389d9…`。developer 改一句即可。

## 修订记录

- 09:04 报告改 §0（插桩前/后 blob 说反）→ 现 7,474B / MD5 `50BA6BB04910CB65E9E5BD89759EB731`；信号文件里仍是旧 MD5 `A1E9AF85…`，属「改注记不重发信号」的正常偏差，**不算台账不一致**，不重发信号、不给真机轮增加一次触发。
- QA 复核：改后 `git show` 去末尾换行得 `186570fe`（`beb0af2` 插桩前）、`394fd90f`（`8d562a0` 插桩前）逐字命中，R1–R4 未动 ⇒ 判定维持 PASS。

## 对 P26 终审的补充

P26 的「离线 + 反证成立、待真机确认」中，副本探针这一半已由本卡补齐；真机那一半由 U0（行底「Host 未提供该条目」消失、变「已同步 Host」）在 08:49 已成立。⇒ P26 的修复现在有完整证据链。
