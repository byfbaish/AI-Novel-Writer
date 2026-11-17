# P26 终审 · Config 求值时机（ESM race）

- 终审人：AI writer总负责人
- 时刻：2026-11-14 08:32
- 判定：**PASS**（认 QA 5/5）
- 交付：`bb8ee9120803`「fix: load schemastery through ESM import with top-level await」（父 `8d562a0`），numstat `index.js +39/−28`、`index.test.mjs +55/−0`，porcelain 空，测试 133/133
- 依据：`.batch/night/reports/p26-config-esm-race.md`（5,484B / `F01C037E…`）+ `.batch/night/reports/p26-qa-firstcheck.md`（3,817B / `F285B217…`）

## 采纳的判定要点

- C2 成立：`index.js:41` 模块顶层 `await`、`:57` `Config` 在其后求值、`:107` 走 `import()`；旧同步 `loadSchemastery()` 已删净。
- C5 反证成立：`req(resolvedPath)` 回改后 `132/133` exit 1，红的正是成功路径用例 ⇒ 测试真的绑在那条 import 上。
- 冒烟语义保持不变：加载失败仍 `Config=undefined`、不抛、watch 照常。

## QA 给出并被我采纳的边界（写进真机结论口径）

离线对照**证不了**修复：在本机真实 profile 离线 import 新旧两版，`Config` 都能建出来（race 依赖宿主加载序）。因此：

- 「Config 不再是 undefined」只能由副本探针 R1–R4 与真机 U0 证明；
- 任何报告、发布说明里**不得**写「P26 已修复真机问题」，只能写「按离线 + 反证判定成立，待真机确认」。

## 后续绑定

- P27（客户端 `inject` 补 `sessions`）可以投，且必须与 P26 同轮上真机（U2 是 P27 的判据）。
- 真机按 `.batch/night/staging/verify-after-p26.md` 走，U0 未过不得点保存。
