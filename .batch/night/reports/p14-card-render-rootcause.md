# 「插件配置页无卡」根因：卡片渲染时抛 ReferenceError（developer，2026-11-14 01:38）

## 结论

不是 namespace 没进 `describe()`，也不是时序问题。**namespace 已经注册并对外暴露，卡片也真的被派发了；是卡片组件自己渲染时抛错，被渲染层吞掉后整张卡不显示。**

## 证据链（我用 browser-skill 在隔离实例上复现，实例现仍在 61001）

1. 复现：同一 profile、同一份插件，`设置 → 插件 → 插件配置` 里同样只有 **终端 / Agent 循环 / 网页搜索** 三项，没有 Handoff Relay。与主人截图一致。
2. `/api/settings.describe` 原文（页面内 fetch，RPC 信封 `{type:'client-request', rpcId, method, payload:{}}`）：返回 26,493 字节，**`hasHandoff: true`** ⇒ `dsh-handoff-relay` 这个 namespace 在列表里，`register` 被宿主接住了。
3. 浏览器控制台（原样）：

```
error  RelayCard (plugins/dsh-handoff-relay/client.js?rev=1d66f1e4dfdc:173:8)
       ReferenceError: row is not defined
error  slot entry crashed in 'settings.plugin.item': ReferenceError: row is not defined
       at RelayCard (client.js:173:8)
```

## 代码侧定位

`client.js:153` 起是 `rows.map((row, i) => h("div", …)`，`client.js:172` 的 `))` 把 `h("div", …)` 提前关掉了；`client.js:173` 那句 `(row.doneKind === "text" || row.doneKind === "regex") && h(...)` 就落到了箭头函数**作用域之外**，`row` 未定义。

也就是说：`.map()` 回调在 172 行就返回了，173 行变成多余的表达式，一执行就 `ReferenceError`。

## 修法（一句话）

把 `client.js:172` 末尾的 `))` 改回 `),`，让 173–189 行那几个子节点留在同一个 `h("div", …)` 的参数表里；改完在页面里必须能看见卡，才算过。

## 教训（建议进避坑指南）

- 「插件配置」页里**没卡 ≠ namespace 没注册**。三步分开查：`settings.describe` 有没有这个 ns → 控制台有没有 `slot entry crashed` → 才轮到查时序。
- 渲染层把 slot 里的异常吞掉了，只留一条 console.error；不看控制台就永远只能看到「没卡」。
- 本地没有 Playwright chromium 时，`browser-skill` 用主人已登录的 Chromium 就能读控制台，是这次定性的关键工具。
