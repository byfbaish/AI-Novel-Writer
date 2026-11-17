# P25 · 在隔离实例里打出 describe 的两个值（fiber.state / entry.options.id）

派单人：AI writer总负责人　派发：2026-11-14 07:1x　估时：45 分钟

## 目的
钉死 `dsh-settings` 的 `describe()` 为什么没把 `dsh-handoff-relay` 列进 `namespaces`。今天已排除的：座位（`plugins.row.config` / `bundle.config` / `plugins.item` 与 describe 无关）、schema 结构（`volatileForm` 正常、`toJSON` 在）、`configForms.get` 的 key 形状。剩下只有两件事要看：`entry.fiber.state` 是不是 2，`entry.options.id` 原文是什么。

## 做法（只能在隔离实例里做）
1. 复制一份 profile 到独立目录（例如 `%TEMP%\dsh-probe-1114\profiles\desktop`），**不要动用户正在用的 profile**。
2. 在该副本里把 `node_modules\dsh-handoff-relay` 换成仓库的临时分支副本（不改仓库主分支、不 commit），加**一段临时日志**：
   - apply 里延后 3 秒（`setTimeout`，不要 await fiber）；
   - 打印 `ctx.get('settings')` 是否有 `describe`，以及 `describe()` 返回里：
     - `namespaces` 的 `ns` 数组；
     - 我们那条 entry（按 `options.id === 'dsh-handoff-relay'` 找）的 `fiber.state`、`runtime.Config` 是否为 undefined、`options.id` 原文；
   - 写进该副本自己的 `relay.log`（沿用插件现有日志函数），前缀 `PROBE-DESCRIBE`。
3. 用**桌面端自带运行时**起这个副本（不是全局 `dsh` CLI：那个是 0.1.1-rc.2，没有 `configForms`，结果不可用）。`DSH_HOME` 指向副本根；端口用非 55990/53199 的值。
4. 若桌面端不接受 `DSH_HOME` 隔离（会读用户 profile），**立刻停止并回报**，不要强行起第二实例盖用户数据。

## 判据
- 成功：`relay.log` 里出现 `PROBE-DESCRIBE` 行，含 `namespaces=[...]`、`entry=...`、`fiberState=<n>`、`configUndefined=<bool|null>`。
- 失败可接受：明确写清卡在哪一步（DSH_HOME 不生效 / 端口被占 / 无法在不碰用户 profile 的前提下起实例）。

## 铁律
- 不 restart 用户实例、不写用户 profile、不动仓库主分支、不 commit。
- 报告落 `reports/p25-describe-probe.md`，末行 `<!-- DONE -->`，落盘同一分钟内写 `.done` 信号。
