# dsh-schedule `source` 三条修复路径的代价取证（只读，未改任何文件）

依据取证时间：11-13 21:28–21:31。

## 事实基线

- 实际被解析的文件：`C:\Users\<用户名>\.dsh\profiles\node_modules\@deepseek-ai\dsh-schedule\lib\index.js`（53175B，md5 `F1FA315969D05A3137510126405CBEE6`）是 **Junction → `C:\Users\<用户名>\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-schedule`**（全局 npm 的 dsh 安装树）。两份 md5 相同，即同一份文件。
- `require.resolve('@deepseek-ai/dsh-schedule', {paths:[profile 目录]})` 与从 `~\.dsh\profiles` 起解，均落到全局 npm 那一份。`@deepseek-ai/dsh-base` 同样落在全局树。
- `~\.dsh\profiles\desktop\node_modules\@deepseek-ai\` 下**没有** dsh-schedule（只有 computer-use、mcp-client 等 6 个），所以 profile 层目前无覆盖。
- 出事那一处：`lib/index.js:830-833`
  ```
  830: 	source: {
  831: 		kind: "plugin",
  832: 		plugin: "schedule"
  833: 	}
  ```
- V4 规则权威依据：`~\.dsh\profiles\desktop\node_modules\dsh-vision-router\lib\session-message-source-compat.js`（4625B）。注释原文：「DSH Session V3 requires the historical {kind:'plugin', plugin:...} source, while V4 rejects that wrapper in favor of producer-owned source kinds.」→ V4 要 `{kind:'plugin:<名>'}`
  ```
  const LEGACY_SOURCE = Object.freeze({ kind: 'plugin', plugin: 'dsh-vision-router' })
  const PRODUCER_SOURCE = Object.freeze({ kind: 'plugin:dsh-vision-router' })
  const version = Number(session?.header?.version)
  return Number.isInteger(version) && version >= 4 ? PRODUCER_SOURCE : LEGACY_SOURCE
  ```

## 三条路径

| | 改哪里 | 何时生效 | 升级后 | 已知坑 |
|---|---|---|---|---|
| A 直接改共享包 | 全局 npm 树里的 `…\dsh-schedule\lib\index.js:830-833`（经由 junction 即 profile 那份） | 下次重启（库只在启动时加载） | **必被覆盖**：`npm i -g @deepseek-ai/dsh@…` 或 DSH 升级重写整包 | V3 会话要的正是旧写法，写死会在 V3 会话上反向坏掉，需按 `session.header.version` 分支 |
| B profile 层同名覆盖 | 新建 `~\.dsh\profiles\desktop\node_modules\@deepseek-ai\dsh-schedule\`（包名相同、index.js 已改） | 下次重启 | 不随 DSH 升级重写（profile 目录独立）；但 `dsh profile` 重装/prune 会清掉 | 要自维护一份 53KB 副本；不进 profile 的 package.json 依赖，属「目录里多一个包」，来源不透明 |
| C 走旁路不改码 | 不动 DSH；自建定时器写文件进 watch 目录，由 dsh-handoff-relay 以 `plugin:dsh-handoff-relay` 投递 | 立即可用，无需重启 | 零影响 | 要自带定时器（扛休眠得 schtasks + WakeToRun）；dir→session 映射自己维护；`schedule_create` 必须停用，否则仍会崩接收方 |

## 共同未验点

Electron 宿主（`C:\develop\software\DeepSeekHarness\resources\app.asar`，其 `app.asar.unpacked\dsh\node_modules` 存在）是否真按 profile 目录的 Node 解析链加载插件，我没有实测证据——我只证到 **Node 从 profile 解析**这一层。因此 A/B 是否生效，最终只能靠「改完重启 + 实投一条」来证。
