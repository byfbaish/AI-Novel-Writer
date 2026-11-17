# DSH 宿主崩溃定性（developer 只读取证，2026-11-14 00:12）

## 结论一句话

崩溃点在**我们插件 Host 半身**的 index.js:668，不是 client.js、与 dsh.client 注入无关；根因是 settings 服务未声明注入却直接访问。

## 崩溃点与调用栈（原文）

`
dsh: fatal load failure: Error: cannot get property "settings" without inject
    at mountSettingsCard (file:///C:/develop/workspace/dsh-handoff-relay/index.js:668:31)
    at new apply (file:///C:/develop/workspace/dsh-handoff-relay/index.js:974:8)
    at Fiber.execute (.../@deepseek-ai/cordis/lib/index.js:362:24)
`

两次崩溃（crash-2026-11-13T16-02-28-685Z-host.log 与 ...16-02-46-409Z-host.log，相隔 18 秒）栈完全相同。

## 机制

1. index.js:10 是 xport const inject = ['agents']; —— **settings 不在注入清单**。cordis 对未声明服务的属性访问是**抛错**，不是返回 undefined，所以 :668 的 ctx && ctx.settings 直接抛，&& 拦不住。
2. :974 是 oid mountSettingsCard(ctx, …)，返回的是 rejected promise，**没人 catch**。
3. cordis 把这次 apply 的异常判为 atal load failure → 宿主进程 xited with 1。日志头 phase: startup、shell pid: 58392 与之吻合。

## 四问逐条

1. **崩溃点/栈首行**：见上，index.js:668；不是 client.js，不是 dsh.client。
2. **7 条 watch 是否已加载**：**已加载**。:971/:972 两条启动日志在 :974 之前执行完，卡片挂载是最后一步。
3. **崩溃前最后一条 relay 日志**：[dsh-handoff-relay] 启动 7/7 个 watch；stableMs=5000，delivered=…，之后无任何日志。
4. **0.4.0 是否已 push**：**已 push**（我做的，在收到停发指令之前：tag 对象 935622c，peeled 8c5c073，efs/tags/v0.4.0 已在远端）。
pm publish **未执行**，registry 仍是 0.3.2。

## 附带发现（不构成此次崩因，但会在修完注入后浮现）


ode -e "import('@deepseek-ai/schemastery')" 在插件仓库目录下 **ERR_MODULE_NOT_FOUND**。修好注入后，:675 那条会走 warn 分支并 return（它本身有 try/catch，不会崩，但**设置卡等于没挂上**）。

## 修复方向（只报，不改码）

- :10 改成对象式注入：xport const inject = { required: ['agents'], optional: ['settings'] }; —— 只在 service 存在时才允许访问。
- :668 外面再包一层 try/catch 兜底（防御不是替代）。
- :974 的 oid 改成 .catch(err => relayLog(…))，避免任何 mount 期异常升级成 host fatal。
- schemastery 改为从宿主播种/相对可解析路径取，或把卡片注册判据降为「拿不到 schema 就跳过」。

## 状态冻结

- 发版链停在 tag+push，未 publish；不 deprecate、不删 tag、不改 README。
