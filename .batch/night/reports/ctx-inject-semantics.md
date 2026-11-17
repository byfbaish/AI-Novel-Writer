# ctx.inject 的两种时序实测（developer，2026-11-14 00:20）

供 P14 定方案用。环境：`@deepseek-ai/cordis`（`…\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\cordis\lib\index.js`，Node 24），只读探针，不碰插件仓库。

## 结果

| 场景 | 结果 |
|---|---|
| 先 `provide('settings')`，后 `ctx.inject(['settings'], cb)` | **回调立即触发**，cb 内 `c.settings` 可读 |
| 先 `ctx.inject(...)`，后 `provide('settings')` | 注入当时不触发；`provide` 之后**回调正常触发**，`c.settings` 可读 |

原文输出：

```
A 已就绪再 inject -> 回调立即触发
B 注入后未提供 -> 未触发(符合预期)
B 之后 provide -> 回调触发
```

## 对 P14 的意义

- `ctx.inject(['settings'], cb)` **两种启动顺序都成立**：settings 先到就立即挂卡，后到就在到达时挂卡，不存在「启动期拿不到就等于永远拿不到」。
- 因此它同时解决两件事：①不再让 `ctx.settings` 在未声明注入时抛错（注入是显式声明的，cb 里访问合法）；②不会像 `ctx.get('settings')` 那样在启动期拿到 `undefined` 后静默失效。
- 仍未消除的验证点：真机里设置页是否真渲染出那张卡，仍要在隔离 profile 上肉眼/截图确认，代码层保证不了。

## 与 `ctx.get` 的差别（同一版本 cordis）

- `ReflectService.get(name, strict = true)`（`index.js:762-770`）：只在提供者 fiber 处于 active 时返回值，否则 `undefined`；未提供时也是 `undefined`，**不抛**。
- 未声明注入时直接访问 `ctx.settings`：`index.js:675` 抛 `cannot get property "settings" without inject` —— 就是这次崩溃的那条。
