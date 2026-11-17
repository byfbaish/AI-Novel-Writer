# P13 首验 · 设置卡 inject 崩溃修复

> 状态：已裁定 · 日期：2026-11-14

- 卡号：P13（卡片 `.batch/night/cards/p13-settings-inject-crash.md`；追加卡 `.batch/night/cards/p13-addendum.md`）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：`8c5c073`（95/95，宿主崩溃版）
- 交付：`c55d7f1`（`index.js 25/3`、`index.test.mjs 53/0`）+ `3e9abd6`（`index.test.mjs 56/4`）
- 首验时刻：2026-11-14 00:20
- **结论：PASS**

## 1. 判定项逐条

| # | 判据 | 实测 | 判定 |
|---|---|---|---|
| 1 | 不把 `settings` 写进 `inject`，改用安全取服务 + try/catch | `index.js:10` `export const inject = ['agents'];` 未变；新增 `getService(ctx,name)` = `ctx.get(name)` 外层 try/catch（`index.js:669-675`）；`mountSettingsCard` 首行改 `getService(ctx,'settings')`，取不到写 warn「宿主无 settings 服务（跳过，不影响 watch）」后 return（`:685-691`） | PASS |
| 2 | `:974` 的 `void` 不许漏接 rejected promise | 改为 `void mountSettingsCard(...).catch(err => relayLog(ctx, stateDir, 'warn', …设置卡未挂载：意外异常…))`（`index.js:995-996`） | PASS |
| 3 | 严格 ctx 冒烟：Proxy 拦未声明属性即抛，只给 agents/logger/effect | `index.test.mjs:1970-1976` `new Proxy(target,{get(){ if (prop in t) …; throw new Error(\`cannot get property "${String(prop)}" without inject\`) }})`，target 只有 `agents`/`logger`/`effect`/`get`；4 条 `check`：apply 不抛、真投递 1 次且源文件被移走、`relay.log` 含「无 settings 服务」、有 settings 但 schemastery 不可解析时 warn 跳过且照常投递 | PASS |
| 4 | `TOTAL` ≥96/96 | `node index.test.mjs` → `TOTAL: 99/99 PASS` / `RESULT: PASS` / exit 0；95→99 = 3 条严格 ctx + 1 条 schemastery 降级，原 95 条一条未删 | PASS |
| 5 | 边界：只改 `index.js`/`index.test.mjs`/报告；`source:` 逐字不变 | porcelain 空；`git show --numstat` 仅上述两文件；`source:` 在 `index.js:441` = `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` }),`，与 `27c40bb`/`8c5c073` 逐字相同 | PASS |
| 6 | 追加卡：临时目录 `os.tmpdir()` 派生 + 三条各自否证 + 贴绝对路径 | `assertOutsideWatchZones`（`index.test.mjs:1949-1958`）分别断言 tmpdir 前缀、不在仓库内、不在 `~/.dsh` 内；`out('P13 临时目录（绝对路径）：…')` 打印路径 | PASS |
| 7 | 追加卡：断言真起 watcher，不看 `startWatch` 被调用 | 用例写 `p13.txt` → `box.cb('change','p13.txt')` → `sleep(150)` → 断言 `calls.length===1`、源文件已移走、`delivered/` 下有该文件 | PASS |

## 2. 独立反证（我自己跑的，未改仓库）

为确认这条冒烟测试真能拦住原崩溃，我用 `git archive 8c5c073 | tar -x` 到临时目录，把 `3e9abd6` 的 `index.test.mjs` 拷进去跑：

```
throw new Error(`cannot get property "${String(prop)}" without inject`);
Error: cannot get property "settings" without inject
exit=1
```

即：**旧 `index.js` + 新用例 = 直接失败 exit 1**，报错文本与宿主崩溃原文逐字同因。这条测试确实能拦住 `8c5c073` 的加载期崩溃，不是空转。临时目录已删。

## 3. 报告一致性

`p13-settings-inject-crash.md`（12,011B）L6 写「追加轮后 `TOTAL: 99/99 PASS`」，L93 保留 `98/98` 并注明为追加轮之前的读数，L99 写明 95→99 的四条来源。读数与实测一致。

## 4. 记（不拦）

1. **启动期 `ctx.get('settings')` 可能恒为 undefined**（developer 提出、负责人已立项 P14）：`ReflectService.get(name, strict=true)` 只在提供该服务的 fiber active 时返回值，设置卡在启动期挂载时 `settings` 多半未就绪 ⇒ 本卡修完是「不崩了」，但卡片可能静默不出现。本卡范围不含此项，已由 P14 承接，真机验收须以「设置页能看见那张卡」为硬判据。
2. `getService` 目前只服务 `settings` 一处；`index.js:36` `ctx.logger`、`:367/:393` `ctx.agents`、`:1003` `ctx.effect` 均为核心能力或已声明注入，不需要改。
3. P13 用例的 `root`/`d` 两个 `mkdtemp` 目录跑完不删（`index.test.mjs:1946/1948/2010`），会在 `%TEMP%` 留 `relay-p13-*` 空目录；不影响判定，建议后续随清理用例一并收。
