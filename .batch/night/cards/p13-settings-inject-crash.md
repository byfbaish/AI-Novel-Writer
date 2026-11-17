# 卡 P13 · 修启动期致命崩溃（ctx 服务未声明 inject 就访问）

> 卡号：P13-settings-inject-crash。执行方：豆包。派卡人：AI writer总负责人。优先级最高：插件当前被主人停用，修不好不能恢复。
> 基线：仓库 `C:\develop\workspace\dsh-handoff-relay`，HEAD `8c5c073`，porcelain 空，`node index.test.mjs` = `TOTAL: 95/95 PASS`。

## 1. 崩溃原文（宿主 crash 日志，逐字）

```
dsh: fatal load failure: Error: cannot get property "settings" without inject
    at mountSettingsCard (file:///C:/develop/workspace/dsh-handoff-relay/index.js:668:31)
    at new apply (file:///C:/develop/workspace/dsh-handoff-relay/index.js:974:8)
    at Fiber.execute (.../cordis/lib/index.js:362:24)
```

宿主进程由此 exit 1，整个 DSH 崩溃（`phase: startup`）。

## 2. 根因（我核过的，不用再考古）

- `index.js:10` 只声明 `export const inject = ['agents'];`，**没有 `settings`**。
- `index.js:668` `const settings = ctx && ctx.settings;` —— cordis 的 ctx 是严格代理，访问未声明 inject 的服务属性会**同步抛**，不是返回 undefined。
- `index.js:974` `void mountSettingsCard(ctx, ...)` 在 `apply` 里调用它，抛错发生在启动装配期 ⇒ fatal load failure ⇒ 宿主退出。
- 同理需要全仓排查：还有没有别的地方在未声明 inject 的情况下直接取 `ctx.<服务名>` 属性。

## 3. 要改成什么

1. **不要**把 `settings` 放进 `inject`——该服务在部分宿主里不存在，加进去会让插件等一个永不出现的依赖。改为**安全取用**：优先 `typeof ctx.get === 'function' ? ctx.get('settings') : undefined`（本仓库 `index.js:124-126` 取 `sessionTitle` 就是这个写法），并整段包 `try/catch`；取不到就 `return`（一行 warn 到 `relay.log` 即可，理由「宿主无 settings 服务」）。
2. 全仓扫一遍 `ctx.<name>` 直接属性访问，凡未在 `inject` 声明的服务一律改成 `ctx.get(name)` + try/catch。**`agents` 已声明，保持原样**。
3. **补一条能抓住这个 bug 的测试**（这是本卡的重点，不只是修一行）：构造一个「严格 ctx」——访问未声明属性即抛 `cannot get property "<x>" without inject`（用 `Proxy` 的 `get` 抛错即可），只提供 `agents`/`logger`/`effect`，然后调 `apply`（或 `mountSettingsCard`），断言：**不抛异常**、`relay.log` 有一行「无 settings 服务」的 warn、watch 照常启动。
4. 原有 95 条一条不许删；`source:` 那一行按内容逐字不变。

## 4. 禁止

- 不许动 `client.js`（按 crash 栈，本次崩因不在客户端；改它会把定性搅浑）；本卡只改 `index.js` / `index.test.mjs` 与该报告。
- 不许动 `cordis.patch.yml`、不许重启 DSH、不许启用插件、不许往任何 watch 目录丢文件。
- 不许 `git add -A`；点名 `git add index.js index.test.mjs`（若确实新增文件才加）。

## 5. 判据

1. `node index.test.mjs` → `TOTAL:` ≥ 96/96 PASS、exit 0，且新增用例在「严格 ctx」下确实会在修复前失败（报告里写清：修复前它会抛什么）。
2. `grep` 结果贴原文：`ctx\.[a-zA-Z]+` 的每一处，标注「已声明 inject / 已改 ctx.get / 非服务」。
3. `source:` 逐字不变。
4. porcelain 只 `index.js`、`index.test.mjs`。

## 6. 产物

- 报告：`.batch\night\reports\p13-settings-inject-crash.md`，末行 `<!-- DONE -->`。
- 信号：`.batch\night\signals\doubao\p13-settings-inject-crash.done`，三行：完成 / 改了几处 / 测试 TOTAL。
- 估时 40–60 分钟。做完提交（英文提交信息，如 `fix: never touch undeclared services on ctx so startup cannot crash`），**不要 push**。
