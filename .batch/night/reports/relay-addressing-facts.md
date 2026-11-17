# 寻址方式只读取证（标题 / bot 名 / roots 字段 / 重启后 id 变化）

本轮做了四组只读取证，未改任何文件、未改配置、未重启 DSH。

## 1. 标题

插件里现成实现在 `C:\develop\workspace\dsh-handoff-relay\index.js:112-140`（函数名是 `resolveSession`，不是 `resolveSessionTitle`）。

```js
124 :     const svc = ctx && typeof ctx.get === 'function' ? ctx.get('sessionTitle') : null;
126 :       const snap = svc.get(session);
127 :       const ti = typeof snap === 'string' ? snap : (snap && (snap.title || snap.text));
```

标题的权威来源是 `sessionTitle` 服务，服务定义在
`C:\Users\<用户名>\.dsh\profiles\node_modules\@deepseek-ai\dsh-session-title\lib\types\index.d.ts:62-66`：

```
62 : declare module '@deepseek-ai/cordis' {
63 :     interface Context {
64 :         sessionTitle: SessionTitleService;
```

`get()` 的签名与返回值（同文件 `:151-156`）：

```
151 :     /**
152 :      * Read the latest folded title from one live or replayed session.
153 :      * @param session - session whose log is the title source of truth.
154 :      * @returns latest title snapshot, or `undefined` before eligible input.
155 :      */
156 :     get(session: Session): SessionTitleSnapshot | undefined;
```

两种情况的返回：

- **会话存在但无标题**：`ctx.sessionTitle.get(session)` 返回 `undefined`（`:154` 原文「undefined before eligible input」）⇒ `index.js:131-137` 退回 agent 上的 `title/name/label/meta.*`；都空则 `index.js:139` 返回 `{ found: true, title: '' }`。
- **会话不存在**：`agents.get(id)` 拿不到、`roots()` 里也找不到 ⇒ `index.js:121` `return { found: false, title: '' }`。这条已经在用：加载期日志打「会话不存在」，不静默（`index.js:252` 打 `targetSessionId=…` 与会话标题）。

结论：标题可在运行时取到，且「无标题」与「会话不存在」能被区分开。

## 2. bot 名

宿主层没有把 bot 花名册暴露给插件。

- 已装 typings 里没有 `dsh-bot` 包；bot 层是**普通插件** `ds-bot`（`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\ds-bot\index.js:55` `export const name = 'ds-bot'`）。
- 它的 `inject`（`index.js:56`）只声明依赖 `llm, tools, systemPrompt, sessionController, sessions, sessionTitle, workspaceRegistry, connection`，**不提供**任何服务：全包搜 `.provide(` / `ctx.set(` **0 命中**。

```
$ Select-String -Path index.js -Pattern "\.provide\(|ctx\.set\(" | Measure-Object
Count : 0
```

- bot 名 ↔ 会话 id 只存在于宿主私有文件 `C:\Users\<用户名>\.dsh\bot\state.json`（读写者是 `ds-bot\src\host\store.js`，映射函数 `store.js:471`：`const chatOf = botId => botOf(botId)?.sessionId ?? botId`）。

结论 ❌：插件拿不到 bot 名；只能读私有 JSON 文件，那是宿主内部实现，不算稳定接口。

## 3. roots() 字段

`ctx.agents.roots()` 返回 `Agent[]`。接口在
`C:\Users\<用户名>\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent\lib\types\runtime-types.d.ts:59-72`：

```
60 : export interface Agent {
62 :     readonly id: SessionId;
64 :     readonly options: AgentOptions;
66 :     readonly session: Session;
68 :     readonly inbox: Inbox;
70 :     readonly status: AgentStatus;
72 :     readonly ctx: Context;
```

逐条对答案：

| 要的字段 | 能否拿到 | 来源 |
|---|---|---|
| `id` | ✅ | `Agent.id`（`:62`） |
| `status` | ✅ | `Agent.status`（`:70`，`agent/status` 跃迁镜像） |
| `cwd` | ✅ | `agent.session.header.cwd`（`Session.header` 见 `dsh-session\lib\types\index.d.ts:120`；`SessionHeader.cwd` 见 `dsh-session\lib\types\types.d.ts:52`） |
| `createdAt` | ✅ | `agent.session.header.createdAt`（`types.d.ts:50`） |
| `parentSession` / `seedLength` / `origin` / `delegationDepth` / `agentPreset` | ✅ | `types.d.ts:54 / :59 / :64 / :70 / :77` |
| 标题 | ❌ 不在 `Agent` / `SessionHeader` | 只能走 §1 的 `ctx.sessionTitle` |
| bot 名 | ❌ | 见 §2 |

实测 `SessionHeader` 原始输出（解压 `session.v4.jsonl.zstd` 首帧）：

```
{"type":"session","version":4,"id":"session-daeb834f-…","createdAt":1794503626332,
 "cwd":"C:\\develop\\workspace\\AI-writer\\develop","isSeeded":false,
 "delegationDepth":0,"agentPreset":"standard"}
```

## 4. 重启后 id 到底变不变

判定依据是「会话创建时间」与「重启时间」的关系，不是猜。本机会话头 `createdAt`（本地时间）分布：

```
daeb834f 2026-11-13 01:13:46 mtime=2026-11-13 05:00:23
2f15b23e 2026-11-12 01:41:26 mtime=2026-11-13 03:13:46
7c3feeab 2026-11-12 01:45:27 mtime=2026-11-12 13:06:17
33494f59 2026-11-12 01:56:24 mtime=2026-11-13 04:54:26
4380d607 2026-11-12 02:00:20 mtime=2026-11-13 05:04:11
```

配套事实：

1. `ds-bot\index.js:1-3` 原文：「Every Bot is one root Session; the roster, rooms, and the bot-to-bot exchange log live in one JSON file under DSH_HOME **so they survive restarts without new Session event types**.」
2. 今天 03:49 与 03:57 两次重启之后，bot 记录里的 `sessionId` 仍是 11-12 创建的那些（`2f15b23e` / `7c3feeab`），且它们的 `createdAt` 没变、日志继续追加 ⇒ **重启是 resume，id 不变**。
3. id 变的是「新会话被创建」这件事：`daeb834f` 的 `createdAt` 正好落在 01:1x 那次重启之后。我能证明它是新建的，但无法从文件里证明「那次重启本身导致新建」还是「重建了会话/新开了聊天」，这一条**给不出确定性结论**。

结论：`createdAt` 早于重启时刻且重启后仍有写入 ⇒ 同一会话、id 不变（resume）；只有真的新建会话，id 才变。插件侧能用来判断「这条 watch 指向的会话是不是还活着」的判据是 `agents.get(id)` 是否存在（已有实现），而不是 id 本身。

## 5. 可行寻址候选（只列运行时确实拿得到的）

| 候选 | 可得性 | 说明 |
|---|---|---|
| `ctx.sessionTitle.get(agent.session)` 标题串 | ✅ | 人可写、UI 可见；缺点：可改、可空、可重名 |
| `agent.id` 精确匹配 | ✅ | 现状，id 失效就送不到 |
| `agent.session.header.cwd` | ✅ | 稳定，但同目录常有多个会话，不唯一 |
| `agent.session.header.createdAt` | ✅ | 可做「取最新」，但用户看不见、不是身份 |
| `agent.status` | ✅ | 只能判活/忙，不能当身份 |
| bot 名 | ❌ | 只存在于 `~/.dsh/bot/state.json`，插件无服务可拿 |
| 会话在 UI 里的展示名（群名/房间名） | ❌ | `ds-bot` 未提供 service，插件取不到 |

<!-- DONE -->
