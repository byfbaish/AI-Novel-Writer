# 方案 A 判据③「无卡」的证据包（developer，2026-11-14 01:12）

主人实测：宿主「插件配置」标签页只有 终端 / Agent 循环 / 网页搜索 三项，没有 Handoff Relay 的自有配置项。「插件列表」里 `handoff-relay 已启用 / Cordis 状态 已挂载` 不算证据。

实例已关闭（61001 不再监听），证据目录全部保留未删：

## 1. 实例的实际配置

`C:\Users\<用户名>\.dsh\profiles\selftest1114\cordis.patch.yml`：

```yaml
- id: dsh-handoff-relay
  name: dsh-handoff-relay
  config:
    watches:
      - dir: 'C:\Users\<用户名>\AppData\Local\Temp\relay-selftest-watch'
        targetSessionId: 'session-selftest-dummy'
    stableMs: 5000
```

一条 watch，目标会话是故意编的假 id（保证不会投给任何人）。

## 2. 本次实例的完整 relay.log 段

```
16:56:43.796Z INFO watches[0] 加载解析 dir=…\relay-selftest-watch 目标=targetSessionId=session-selftest-dummy agent-not-found
16:56:43.797Z INFO 启动 1/1 个 watch；stableMs=5000，delivered=…\profiles\desktop\dsh-handoff-relay\delivered
16:56:43.983Z INFO 设置卡 schema 基线=C:\Users\<用户名>\.dsh\profiles\desktop\package.json resolved=…\@deepseek-ai\schemastery\lib\index.cjs
16:56:44.808Z INFO rescan#1 … result=not-found
16:56:48.807Z INFO rescan#2 … result=not-found
16:56:58.811Z INFO rescan#3 … result=not-found
```

**关键判读**：日志里**没有任何**「设置卡未挂载 / register 失败 / 播种失败 / observe 失败」的 WARN。挂卡代码 `index.js:699-749` 的四个失败分支（`:702` 无 settings 服务、`:714` 解析 schemastery 失败、`:723` register 抛错、`:747` observe 抛错）都会写 WARN，一条都没有出现 ⇒ **`:721` 的 `settings.register(SETTINGS_NS, Schema, …)` 没有抛异常**。

但要说实话：`:721` 之后成功路径**没有日志**，所以日志只能证明「没失败」，不能证明「宿主接住了并对外暴露了」。

## 3. 契约层面的两个硬事实

- 宿主侧 namespace 常量：`index.js:34` `export const SETTINGS_NS = 'dsh-handoff-relay';`
- 客户端侧：`client.js:15` 同一个字符串；`client.js:199-203` 以 keyed 槽注册
  ```js
  ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
    name: "settings.plugin.item",
    key: SETTINGS_NS,
    inject: () => ({ scope }),
  }, RelayCard));
  ```
- 官方「插件配置」页是按 **namespace 列表** 逐条派发卡片的：`dsh-client-ui-settings-plugins\lib\client.js:403` `namespaces.map(ns => renderSlot("settings.plugin.item", {}, { entryKey: ns }))`，而 `namespaces` 来自 `ctx.settingsScope.describe()`（同文件 `:1241`）。
- 也就是说：**页面无卡 ⇔ 该 namespace 没出现在客户端 describe() 的列表里**（或卡片渲染时抛了异常被渲染层吞掉）。

## 4. 给 QA 的两条候选（我不定性）

1. **注册了但没投影到客户端**：Host 在启动期 register 成功，但客户端 describe() 的列表没包含它（动态注册是否会被推送到客户端，需要看 dsh-settings 的实现）。日志能排除「没注册成功」，不能排除「注册了但不投影」。
2. **注册被当作「不可配置」而过滤**：register 传入的 `{ base, applies: 'live' }` 若不满足页面判定条件（例如缺少可编辑 schema 的标记），列表里就不显示。

## 5. 未做的验证（避免被当成已验）

- 没有抓到客户端一侧的报错（本机没有 Playwright chromium，`browser_open` 不可用，只能用 `Invoke-WebRequest` 拿静态 HTML，跑不了页面脚本）。
- 所以「卡片渲染时抛异常」这条分支，现有证据既不能证实也不能排除。

## 6. 补充事实（01:25，决定候选 1/2 谁更可能）

- `index.js:721` 的注册调用是 `settings.register(SETTINGS_NS, Schema, { base: { watches: configWatches }, applies: 'live' })`。
- 同目录下的官方卡用的是另一套入口：`ctx.settingsScope.bind({ namespace })`（客户端）＋ Host 侧注册时给 **schema**（`dsh-settings\lib\types\index.d.ts:3-5`）。
- 也就是说两侧都用了官方 API，没有自建通道。若 register 真没抛错，问题就落在「register 成功后，namespace 有没有进客户端 describe() 返回的那份列表」这一层——这层不在插件进程内，日志看不到，只能在浏览器侧读。

## 7. 收尾（01:30）

- 61001 实例已关闭，`Get-NetTCPConnection -LocalPort 61001` 无监听。
- 临时 profile `C:\Users\<用户名>\.dsh\profiles\selftest1114` 与 `%TEMP%\relay-selftest-watch` **已删除**；删除前把证据原样存到
  `.batch\night\evidence\selftest1114\`：`cordis.patch.yml`(289B)、`package.json`(361B)、`cordis.yml`(223B)、
  `boot5.log`(32B)、`boot5.err.log`(0B)、`relay.log`(7097B)。
- 宿主启动日志原文（无任何 fatal）：
  ```
  boot5.log     →  dsh web: http://127.0.0.1:61001
  boot5.err.log →  (0 字节，空)
  ```
- 设置页原文（主人实测）：「插件配置」标签页只有 **终端 / Agent 循环 / 网页搜索** 三项，没有第四项；
  「插件列表」标签页里 `handoff-relay 已启用 / Cordis 状态 已挂载` 有过，但按口径这不构成证据。
