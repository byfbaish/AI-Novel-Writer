# 01 · 加载与生命周期

> 状态：已实施（2026-11-14）
> 日期：2026-11-14
> 上级索引：[README.md](README.md) · 对应事故：宿主启动即崩（P13/P14 修复段）

## K01 · 启动即崩：读了没声明的服务

- **现象**：`dsh: fatal load failure: Error: cannot get property "settings" without inject`，宿主 exit 1；栈首帧落在 `apply` 里的设置卡挂载函数（原提交 `8c5c073` 的 `index.js:668`、`:974`）。
- **根因**：cordis 在 plugin fiber 上代理服务，`export const inject` 里没列的服务**读取时同步抛错**；异常发生在 `apply` 同步段，于是被升级成 fatal，宿主直接退出——不是「卡片坏了」，是整个宿主没起来。
- **解法**：只读已声明的服务；临时读用 `ctx.get('settings')` 判空后跳过；要「服务就绪后再挂载」用 `ctx.inject(['settings'], cb)`，把 `settings` 放进 inject 参数、**不要**加到模块级 `inject` 数组。

## K02 · fire-and-forget 没有 catch：异步异常照样能打死宿主

- **现象**：崩栈第一帧与业务逻辑无关，只有一个 `void mountXxx(...)` / 裸 promise 调用。
- **根因**：cordis 加载链上未处理的 promise rejection 等同于同步抛错；`void` 只是消除 lint 提示，不构成任何防护。
- **解法**：一律 `Promise.resolve().then(work).catch(logWarn)`；`.catch` 里只降级并记一条 warn（写明「未挂载/跳过」），不吞掉异常类型。

## K03 · 用 `ctx.get` 判「服务不存在」：会得到假修好

- **现象**：改成 `ctx.get('settings')` 后宿主不崩了，但设置卡静默不出现，`relay.log` 一条错都没有。
- **根因**：`ReflectService.get(name, strict=true)` 在**提供方 fiber 还没就绪**时返回 `undefined`，与「这个宿主根本没有该服务」不可区分；判空跳过就成了静默失效。
- **解法**：时序交给 `ctx.inject(cb)`；不要用固定 `sleep` 轮询「赌它已经好了」（慢机器上必翻车，且掩盖真实顺序问题）。测试要断言 cb **恰好被调用一次**。

## K04 · `apply` 里 await 返回的 fiber：启动链被挂住

- **现象**：宿主不退出、也不就绪，UI 一直停在启动；日志没有报错。
- **根因**：`ctx.inject(...)` 返回的是 thenable fiber，`await` 等的是整个加载完成；该服务永不到来时它永远不 settle，而 `apply` 不返回，启动链就停在这。
- **解法**：`inject` 的结果只 fire-and-forget + `.catch`，要「就绪后再做」就把逻辑写进回调；`apply` 必须同步返回 dispose。

## K05 · `inject(cb)` 回调体是子 fiber：里面抛错一样 fatal

- **现象**：换了 `inject(cb)` 仍然 fatal，栈落在回调体内部。
- **根因**：回调运行在子 plugin fiber 上，未捕获异常同样升级为 `fatal load failure`——**换了 API 不等于换了错误边界**。
- **解法**：回调里同步段 `try/catch`、异步段 `.catch`，两条都要有；参考实现 `dsh-handoff-relay/index.js` 挂载段（`injectFn(['settings'], cb)` + 内层 `try/catch` + `fiber.catch(cardError)`）。
