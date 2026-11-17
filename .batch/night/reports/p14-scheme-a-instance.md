# P14 方案 A：独立 profile 真机加载（developer，2026-11-14 00:57）

## 环境

- profile：`C:\Users\<用户名>\.dsh\profiles\selftest1114`（新建，不动 desktop / 不动本群）
- 插件：`dsh-handoff-relay` 以 `file:C:/develop/workspace/dsh-handoff-relay` 装入 profile，HEAD `26ba94c`
- 依赖：`@deepseek-ai/schemastery@3.19.0`（与 desktop profile 同版本）
- 启动：`dsh --profile selftest1114 --port 61001 --no-open`
- 地址：**http://127.0.0.1:61001**
- patch：一条 watch（`%TEMP%\relay-selftest-watch`，`targetSessionId: session-selftest-dummy`），故意用不存在的会话 id，保证不会真投给任何人

## 判据一：宿主不退 —— 通过

进程存活、61001 在监听、stderr 为空、无 `fatal load failure`。与崩溃那版（`8c5c073`）的关键差别：`inject` 仍是 `['agents']`，代码改走 `ctx.inject(['settings'], cb)`，加载期不再碰未声明的 `ctx.settings`。

## 判据二：schema 基线行 —— 通过

`relay.log`（落点 `~\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`，见下方说明）原文：

```
INFO watches[0] 加载解析 dir=…\relay-selftest-watch 目标=targetSessionId=session-selftest-dummy agent-not-found
INFO 启动 1/1 个 watch；stableMs=5000，delivered=…\profiles\desktop\dsh-handoff-relay\delivered
INFO 设置卡 schema 基线=C:\Users\<用户名>\.dsh\profiles\desktop\package.json resolved=C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\lib\index.cjs
INFO rescan#1 … result=not-found
INFO rescan#2 … result=not-found
INFO rescan#3 … result=not-found
```

三条都在：`resolved` 非空、走的是 `createRequire(<profile>/package.json)` 那条基线、rescan#1/#2/#3 三次有限重扫确实执行。

## 判据三：设置页看得见卡 —— 待主人肉眼确认

地址 http://127.0.0.1:61001 ，打开后进「设置 → 插件」，看有没有 Handoff Relay 那张卡。代码侧能自证到的只有：`ctx.inject` 回调已执行（否则不会有上面那行 schema 基线），以及 client bundle 已进 boot 图：

```
{"id":"dsh-handoff-relay","url":"/plugins/dsh-handoff-relay/client.js?rev=1d66f1e4dfdc","inject":["@deepseek-ai/dsh-client-ui-settings"],"immediately":true}
```

## 两个必须记住的实现事实

1. **`watches` 为空时设置卡永远不会挂**：`index.js:932-935` 在 `watches.length === 0` 时 `warn` 后直接 `return dispose`，而挂卡在 `:1013-1043`。所以以后不要用「空 watches」验卡片，一验就是假红。
2. **relay.log 落在运行时 profile 的目录**：`relayStateDir()` 在没有 `DSH_PROFILE_DIR` 时用 `~/.dsh/profiles/${DSH_PROFILE||desktop}`，而 dsh CLI 并不导出这个变量，所以本次实例把日志写进了 **desktop** 的目录（`profiles\desktop\dsh-handoff-relay\relay.log`）。这不是 bug，但验证时必须知道去哪找。
3. patch 只能用 `- id:` 形式覆盖 config；用 `- insert:` 会报 `TypeError: duplicate loader entry id: dsh-handoff-relay`（bundle 的 insert 行已存在）。

## 收尾

待主人看一眼设置页后：`taskkill` 该进程 → 删 `selftest1114` profile 与 `%TEMP%\relay-selftest-watch`。未删之前不要重开第二次实例。
