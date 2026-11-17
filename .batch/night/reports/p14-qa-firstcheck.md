# P14 首验 · 设置卡经 ctx.inject 挂载 + schemastery 换基线

> 状态：已裁定 · 日期：2026-11-14

- 卡号：P14（`p14-settings-inject-mount`，含追加卡 schemastery 前置）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：`3e9abd6`（99/99）
- 交付：`2ea6b53`（`index.js 31/4`、`index.test.mjs 236/1`）+ `26ba94c`（`index.js 23/3`、`index.test.mjs 26/31`）
- 报告：`.batch/night/reports/p14-settings-inject-mount.md`（13,354B）
- 首验时刻：2026-11-14 00:46
- **结论：PASS**

## 1. 四项重点

| # | 判据 | 实测 | 判定 |
|---|---|---|---|
| ① | 两条时序用例都断言 `settings.register` 恰好 1 次且服务对象非 undefined | `index.test.mjs:2072` `reg` 为 spy 数组；`:2111-2114` 断言 `reg.length===1`、`typeof reg[0][1]==='object'`；`:2164-2166` 后到用例先断言「启动时 `reg.length===0`」，`:2170` 轮询 `p14WaitFor(() => reg.length>0)`，`:2171-2173` 再断言 `===1` 与非空；两处都额外断言 watch 照常投递 | PASS |
| ② | 回调内 try/catch 保住；不 `await` fiber | `index.js:1019-1022` `mountOnReady = (c) => Promise.resolve().then(() => mountSettingsCard(...)).catch(cardError)`；`:1031-1033` 回调体 `try { mountOnReady(c) } catch (err) { cardError(err) }`；`:1039` `fiber.catch(cardError)`；全文无 `await fiber`（`await` 仅出现在 `:730` `scope.update` 与测试内） | PASS |
| ③ | schemastery 基线写清：哪条、路径原文；未改 `package.json`、未 `npm install` | `index.js:60-66` `loadSchemastery()` = `createRequire(<profile>/package.json)` + `resolve` + `require`；报告 §3（L111-118）写明基线文件 `C:\Users\<用户名>\.dsh\profiles\desktop\package.json`、解析结果 `…\schemastery\lib\index.cjs`、以及仓库基线 `MODULE_NOT_FOUND` 对照；两笔提交 `--numstat` 只含 `index.js`/`index.test.mjs`，无 `package.json` | PASS |
| ④ | `%TEMP%` 的 `relay-p13-*` 清干净 | 实测 0 个（首验时 `Get-ChildItem -Filter 'relay-p13-*'` 无输出）；P14 用例 `mkdtemp('relay-p14-')` 也有 `finally` 收尾（`index.test.mjs:2140` 等） | PASS |

## 2. 全量读数

- `node index.test.mjs` → `TOTAL: 111/111 PASS` / `RESULT: PASS` / exit 0（99→111，新增 12 条 `P14 ①/②/③/④` 用例）
- `git status --porcelain` → 空
- `export const inject = ['agents']` 未变（`index.js:11`），未把 `settings` 写进 inject
- `source:` 在 `index.js:456` = `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` }),`，与 `3e9abd6` 逐字相同
- 无 `await` 返回的 fiber；无 `ctx.settings` 属性直读（唯一取服务入口仍是 `getService`，`index.js:684`）

## 3. 记（不拦）

1. **两条时序用例是手写 stub 模拟 cordis**：`index.test.mjs:2161` `inject: (deps, cb) => { injectedCb = cb; return { catch(){}, then(){} } }`，后到用例在 `:2169` 手动调 `injectedCb(...)`。这证明的是「我方回调在被调用时能正确挂卡」，**不证明真实 cordis 的 provide 顺序**——「settings 先到/后到都只触发一次」仍需真机日志确认（报告 L72 的 `设置卡 schema 基线=… resolved=…` 那行是真机取信点）。
2. 回调体异常用例（`P14 ④`）验证的是「apply 不抛 + relay.log warn + watch 照常」，与 cordis「子 fiber 内未捕获异常会 fatal」的机制一致，但没有在真 cordis 上复现过 fatal，同上归真机。
3. 若宿主多次 provide/dispose 该服务，`register` 可能被重复调用；当前只覆盖单次提供，未覆盖「服务重载」。属低概率，建议记 backlog 不派卡。
4. `index.js` 文件尾 `:1053-1065` 有 13 行空白（格式化残留），不影响运行。

## 4. 未覆盖（必须真机才能判）

- 「设置页能看见那张卡」——本卡只保证挂载路径与降级路径正确，页面呈现、schema 渲染、保存回写均未验。
- 崩溃回归：真机上「无 settings 服务」的宿主不再 fatal——`26ba94c` 只在单测层面盖住，真机需一次干净重启确认 `relay.log` 出现启动行且宿主不退。
