# P27 首验 · 客户端 inject 补 `sessions`（QA）

- 卡号：P27（派验单 `.batch/night/review-requests/P27.md`，08:33 登记；卡面 4,265B / `7B5732E16C831CF993B65E900C36A0A7`）
- 对象：`beb0af2fbd982bdf47af9d1093c525063fb84eca`（父 `bb8ee91`）
- 交付：报告 `.batch/night/reports/p27-client-inject-sessions.md`（3,879B / MD5 `EB2DEC60E16EEBE423050F589A579243` / 末行 `<!-- DONE -->`）；信号已搬入 `delivered\dad6df13f302\p27-client-inject-sessions.done`（135B / 08:37:22 / 含 `beb0af2fbd98`）
- 结论：**有条件通过（不拦真机）**——C1/C2/C4 过；C3 按卡面达成、按派验单字面未达成（见下）

## 逐条复算（我自己跑）

### C1 改动只含两文件；`index.js` blob 相同 —— 过
- `git diff --numstat bb8ee91 beb0af2` → `1 1 client.js`、`97 2 index.test.mjs`，无第三文件。
- `index.js` blob 两边同为 `04a44b8d89077e9739f57bcde4a931810fdc7ed5`。
- 附带核：`package.json` blob 两边同为 `1b04240d94d3b8fe97094cb06224d1717a2eb20b`（`dsh.client.inject` 未动）。
- porcelain 空；HEAD `beb0af2`；tag 仍 4 个、无新 tag。

### C2 导出数组恰为 `["slots","sessions"]` —— 过
- `client.js:20 const inject = ["slots", "sessions"];`；`client.js:509 exports.inject = inject;`；数组恰两项。
- 反向断言仍在：`index.test.mjs` P17 ① 断言 `settingsScope`、`configForms` 均不在 `inject` 内。

### C3 反证 —— 卡面达成 / 派验单字面未达成
- 我在 `git archive beb0af2` 的临时树里只把 `:20` 改回 `["slots"]` 跑：`TOTAL: 133/135 PASS` / `RESULT: FAIL` / exit 1。
- 红的两条：`FAIL P17 ① client inject 只含 slots + sessions`、`FAIL P27 client inject 恰为 ["slots", "sessions"]`。
- **picker 用例没红**：`P27 sessions 桩：sessionMap 非空…` 仍 PASS。原因在用例结构——它在 `p27Render()` 里自建 `ctx.sessions` 桩（`index.test.mjs` P27 段），从不读 `mod.inject`，所以 inject 怎么改都影响不到它。
- ⇒ 对应卡面 C3「改回 `["slots"]` 变红」成立；对应派验单 C3「新增的 picker/sessionMap 用例必须变红」不成立。

### C4 全绿且总数 > 133 —— 过
- 提交树（`git archive beb0af2 | tar -x`，9 文件）跑：`TOTAL: 135/135 PASS` / `RESULT: PASS` / exit 0。

## 兜底核对（派验单 §七.2「一条不准删」）—— 过
- `client.js` diff 恰 1 行，结构上不可能删别处；逐条仍在：
  - `:147 function sessionsOf(ctx)` / `:149 if (ctx && ctx.sessions && ctx.sessions.list) return ctx.sessions;` / `:150 return readService(ctx, "sessions");`（两条取法）
  - `:156 function sessionMap(ctx)` / `:160 return snap && snap.byId ? snap.byId : {};`
  - `:220 function pickerItems(ctx, query)`；空态文案 `:362 "没有匹配的会话"`；按钮 `:423 "选择会话"`
- `readService` 兜底未动（与 `:150` 同路径）。

## 建议（低成本，不阻塞 U 轮）
把 picker 用例改成**从 `mod.inject` 派生可用服务集**（严格 ctx：未声明的服务在 ctx 上取不到），这样 inject 回退会同时让行为用例变红。改动在测试内、约 10 行，不动 `client.js` / `index.js`。可并入 P28 或任一后续改码卡；当前不至于为它单独回炉。

## 风险提示
- 硬 inject 使 `sessions` 成为条目前置依赖；真机若出现 `web boot: 1 entry did not activate`，按卡面三步回滚，且只撤 P27、保留 P26。
- 报告 §7 已自认「真机未重启验证」「真机未验空态消失」，与本卡范围一致，不算缺陷。
