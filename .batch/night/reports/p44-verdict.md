# P44 终审 · 目录探测改走主进程路由

- 卡面：`.batch\night\cards\p44-dir-probe.md`（4,810B）+ 补正单 `.batch\night\cards\p44-correction-1.md`（1,561B / `F9FB92127FFFD199756A5116046A608A`）
- 派验单：`.batch\night\review-requests\P44.md`（2,162B / `7BD55757465AD9B169CB4015DA763A66`）
- QA 首验：`.batch\night\reports\p44-qa-firstcheck.md`（7,427B / `EAC11553FEB6B7C002541CE648283314` / 通过 9/9）
- 判定对象：`8df4e764fd60861dbcbf48e1a7846821bc68aa47`「feat: probe directories via main-process route」，父 `8e4ad64`
- 终审时刻：2026-11-16 21:26（Asia/Shanghai）
- 结论：**PASS（通过）**

## 我自己核的（不做重复劳动）

- 提交面：`HEAD=8df4e764…`、父 `8e4ad64`、`git rev-list --count 8e4ad64..HEAD`=1、porcelain 0；numstat 恰 3 文件 `157 0 index.js` / `112 63 client.js` / `106 7 index.test.mjs`；README×2、`package.json` 与起点 diff 为空。
- 证据面：报告 4,637B / `4C292238089FE1646FFD3A069EAFB7AA` / 末行 `<!-- DONE -->`，末尾 `TOTAL: 156/156 PASS` / `RESULT: PASS`；信号已在 `delivered\<doubao dirKey>\p44-dir-probe.done`（30 分钟内两次读数稳定）。行数以 QA 的 96 行为准（我先前用 `Measure-Object -Line` 按 LF 计，末尾无换行会少一行，属计数口径差，非文件差）。
- 挂载链（QA 未展开的一项）：`index.js:218` `injectFn(['webServer'], (wctx) => …)` → `:221` 无 `webServer.register` 时 return no-op → `:222` 注册；handler `:190` 先 403、再 405、再 `probePath`，只用 `stat`/`access(R_OK)`。
- 渲染链：`client.js:174` `DIR_PROBE_DEBOUNCE_MS=350`、`:277-291` debounce、`:493` 非 ok 打保存提示（提示不拦保存）。

## 四条备注的处置（我裁）

1. 三色无单测咬住 → 不补测，**真机看一眼**即闭环（与 P39 同）。
2. 350ms 内抢先保存会出一行误报提示 → 纯观感、不拦保存、不返工；真机轮顺带确认是否刺眼。
3. `probeReason` 其余错误码归 `none`，文案写「宿主未提供目录核验」语义偏 → 记 backlog，本版不改（改文案要重跑套件，收益低）。
4. 本机无 `origin` 请求在回退分支放行（`index.js:138`）→ **本版接受**。理由：只读、非列举、只限本机；收紧要求 `sec-fetch-site` 必存在，一旦宿主代理链路丢该头会让真机全灰，风险大于收益。记安全 backlog，下版随「收紧同源」一起做。

## 未判、归下一环

- **真机观感未判**：框沿 ok→绿 `#2e7d32` / missing→红 `#d33` / none→灰 `#9e9e9e`，以及「不存在目录保存后显示红字」是否真出现。需主人重启一次 DSH 后看。

## 下一步

合并真机轮（P39 框沿 + P44 探测 + P40 启动行 `7/7`）**一次重启验三样**，核验卡见 `.batch\night\staging\real-machine-round-p44.md`。
