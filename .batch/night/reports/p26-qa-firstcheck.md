# P26 首验 · Config 求值时机（QA）

- 卡号：P26（派验单 `.batch/night/review-requests/P26.md`，08:26 登记）
- 对象：`bb8ee9120803`（父 `8d562a0`）；报告 `.batch/night/reports/p26-config-esm-race.md`（5,484B / MD5 `F01C037E2FA35ED3B71D1616579922D2` / 末行 `<!-- DONE -->`）；信号 `delivered\dad6df13f302\p26-config-esm-race.done`（128B / 08:25:10，含 `bb8ee9120803`）
- 结论：**PASS 5/5**

## 逐条复算（全部我自己跑，不抄回执）

### C1 只含 `index.js`、`index.test.mjs`；`client.js` blob 相同 —— 过
- `git diff --numstat 8d562a0 bb8ee91` → `39 28 index.js`、`55 0 index.test.mjs`，无第三文件。
- `git rev-parse 8d562a0:client.js` = `git rev-parse bb8ee91:client.js` = `771e7c40becf1bb13fa606261740cf4f42754d34`。

### C2 顶层 `await` 真在求值链上 —— 过
- `index.js:41 const SCHEMA_LOAD = await loadSchemasteryAsync(SCHEMA_PROFILE_ROOT);`（模块顶层，不在任何函数体内）
- `index.js:57 export const Config = buildConfigSchema(SCHEMA_LOAD && SCHEMA_LOAD.z);` —— 在 TLA 之后求值
- `index.js:107 const mod = await import(pathToFileURL(resolvedPath).href);`
- 反查残留：全文只剩 `loadSchemasteryAsync`（`:102` 定义、`:41` 与 `:767` 调用），**旧同步 `loadSchemastery()` 已删净**，无 `req('@deepseek-ai/schemastery')`。
- `:767 const loaded = currentRoot === SCHEMA_PROFILE_ROOT ? SCHEMA_LOAD : await loadSchemasteryAsync(currentRoot);` —— 同 profile 复用、换 profile 重解析，符合卡面 §二.3。

### C3 加载失败不 throw（测试真跑）—— 过
- `index.test.mjs:2586` 起：临时空 profile → `DSH_PROFILE_DIR` 指向无 schemastery 的目录 → `import('./index.js?p26fail=…')` → 断言 `Config === undefined`、`typeof apply === 'function'`、`assert.doesNotThrow(() => apply({}, {}))`。是真断言，不是注释。

### C4 全绿且总数 > 131 —— 过
- 我在临时目录用提交树跑（`git archive bb8ee91 | tar -x`，10 个文件）：`TOTAL: 133/133 PASS` / `RESULT: PASS` / exit 0。

### C5 反证真变红 —— 过
- 同一提交树复制一份，只把 `:107` 的 `await import(pathToFileURL(resolvedPath).href)` 换成 `req(resolvedPath)`，其余不动：`TOTAL: 132/133 PASS` / `RESULT: FAIL` / exit 1。
- 唯一红行：`FAIL  P26 加载成功：ESM-only schemastery（含顶层 await）可被 import() 加载，Config 含三字段且关键字段 volatile :: ESM-only schemastery 应构建出 Config`。
- 与报告 §3 的读数一致（我独立复跑得到同一结果）。

## 边界与记录（不拦）

1. **离线 standalone import 不能复现该 race**：我在本机用真实 profile 分别 import 新旧两版 `index.js`，`Config` 都能建出来（`type=object`、`fields=[watches,stableMs,message]`、watches/stableMs volatile=true）。说明 `ERR_REQUIRE_ESM_RACE_CONDITION` 依赖宿主加载序，普通 `node` 直导不会触发。⇒ 这张卡只能证明「代码路径正确、失败可降级」；「真机上 Config 是否真的变 object」须由副本探针 R1–R4 / 真机 U 轮出，别拿离线对照当已修好的证据。
2. **行为变化一处（符合卡面要求，记录备查）**：`mountSettingsCard` 现在同一 profile 下直接复用模块级 `SCHEMA_LOAD`，不再每次挂载都重试解析。若模块级加载在启动时失败，同一 reload 周期内不会自愈（需重载）。卡面 §二.3 明确要求「复用」，判合规；风险低。
3. 报告 §6 的 `index.js` 52,447B / MD5 是工作区 CRLF 形态读数，不影响提交内容；核内容以 blob 为准（本次 C1 已用 blob）。

## 未做（不属本卡判据）
- 真机重启、设置页卡片、会话搜索：等 P27 与真机轮，按 `.batch/night/staging/verify-after-p26.md` 走。
