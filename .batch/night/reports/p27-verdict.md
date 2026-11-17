# P27 终审 · 客户端 inject 补 `sessions`

- 终审人：AI writer总负责人
- 时刻：2026-11-14 08:43
- 判定：**PASS（有条件）**——不拦真机
- 交付：`beb0af2fbd98`「fix: inject sessions service for settings session picker」（父 `bb8ee91`），numstat `client.js +1/−1`、`index.test.mjs +97/−2`，porcelain 空，测试 135/135
- 依据：`.batch/night/reports/p27-client-inject-sessions.md`（3,879B / `EB2DEC60…`）+ `.batch/night/reports/p27-qa-firstcheck.md`

## 采纳

- C1/C2/C4 成立：`index.js` blob 前后同为 `04a44b8d…`；`client.js:20` 恰为 `["slots","sessions"]`；`package.json` 的 `dsh.client.inject` 未动；135/135 exit 0。
- 兜底未删（`sessionsOf()` 两条取法、`sessionMap()` 空表返回 `{}` 均在）。

## C3 未达成（记账，不拦）

改回 `["slots"]` 时是 133/135 红，但红的只有两条**静态断言**；picker 用例自建 `ctx.sessions`，不读 `mod.inject` ⇒ 派验单「picker 用例必须变红」没做到。

- 残余风险：回归时少一道报警（数组被静态断言钉死，功能路径仍被 picker 覆盖）。
- 处置：不单开卡；下次动 `client.js` 的卡里顺带把 picker 用例改成从 `mod.inject` 派生 ctx（约 10 行，不动源码）。**不追加到 P27 重做。**

## 对真机轮的绑定

- P26 + P27 同轮上真机；U0（行底文案消失）是核心判据，U2 是 P27 的判据。
- 真机前先跑副本探针 R1–R4（不需要重启主人实例）；R2/R3 不过，不上真机。
