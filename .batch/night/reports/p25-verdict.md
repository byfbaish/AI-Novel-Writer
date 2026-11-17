# P25 终审 · describe 探针读数

- 终审人：AI writer总负责人
- 时刻：2026-11-14 08:23
- 判定：**PASS**（认 QA 4/4）
- 依据：`.batch/night/reports/p25-describe-probe.md`（8,491B / MD5 `0DA7A79B5C08E237ADEBEB5726C63D7D`）+ `.batch/night/reports/p25-qa-firstcheck.md`

## 采纳的结论

1. `describe()` 返回**数组**（`dsh-settings:463 return descriptors`），不是对象；此前 `namespaces=[]` 属读法错。
2. 我方 entry 被跳过，根因是 `Config === undefined`：模块求值期 `require('@deepseek-ai/schemastery')` 抛 `ERR_REQUIRE_ESM_RACE_CONDITION`（cosmokit 是 ESM、此时未加载完），被 `index.js:52-53` 的 `catch` 静默吞掉。
3. 对照读数成立：`entry#228 state=2 / runtime=object / configUndefined=true`，`entry#1 configUndefined=false`。
4. 隔离成立：用户主日志 `PROBE-DESCRIBE` 命中 0。

## 采纳 QA 的两处口径更正

- 探针副本 `index.js` 是 1,158 行（`dc6726…`），HEAD 是 1,112 行（`489389d9…`），只多插桩 ⇒ 一律写「同代码 + 插桩」，不写「同一份代码」。
- 「真机同样成立」是推断不是读数 ⇒ 真机结论等 P26 修好后用真机 U1–U8 出，不写进 P25 结论。

## 不采纳为大肥鱼的缺口项

`typeof` / `Array.isArray` / `keys()` 属探针打印缺口，不改结论（数组那条已由源码复算）。补件仍按 08:22 的裁定并入报告 §补充，作证据完整度记账。

## 对后续的绑定

- P26 修法（顶层 `await import()`）不等 P25 补件。
- 修完后真机复验要能读到「describe 数组里出现 `ns="dsh-handoff-relay"`」；读不到则视为修复未生效。
