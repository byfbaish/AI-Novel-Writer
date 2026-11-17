# P33 · target 解析只读取证（agent id / 存活 / 七条 watch 判定）

- 类型：只读排查（未改任何文件、未动 `cordis.patch.yml`、未重启）
- 派单：AI writer总负责人（群内 m00372）
- 代码基准：仓库 `C:\develop\workspace\dsh-handoff-relay` HEAD `d535dc1`；宿主 asar `C:\develop\software\DeepSeekHarness\resources\app.asar`
- 重要前提：**当前运行中的宿主进程加载的是 09:09 之前的 `index.js`**（`dedupe.json` 不存在、`relay.log` 文案与 HEAD 有差），所以 `relay.log` 的历史行不能按 HEAD 行号对号入座；本报告代码结论一律按 HEAD 源码，日志结论一律按原文引用。

## 0. 结论先行

1. `findAgentById` 要的是 **agent id**，而 DSH 里 agent id 与 session id 是**同一个字符串** `session-<uuid>` ⇒ 现有配置写法**是对的**，不是格式错。
2. 「时好时坏」的根因是 **存活状态**，不是 id、不是时序偶然：注册表只保存**活着的** agent，目标会话没在宿主里打开/恢复过就必然 `agent-not-found`；启动瞬间插件先于会话恢复加载，所以启动期几乎必然全红，靠 P11 有限重扫（1s/5s/15s，窗口 21s）在后 21 秒内补。
3. 7 条里 **5 条有真实投递证据（能投）**、1 条（给负责人）**时好时坏且本 boot 已静默失效**、2 条从未有文件（未验证）。
4. 结论对方案的影响：**「id→标题迁移」不能解决存活问题**——标题解析同样只走 `roots()`，一样只看活着的会话。它能解决的只是「id 写旧了」，而当前 7 条里只有 to-group 曾踩过旧 id（已改）。

## 1. Q1：`findAgentById` 期望的键是什么？配置里 `session-<uuid>` 对不对？

### 1.1 插件侧代码（HEAD）

- `index.js:537-548` `findAgentById(ctx, id)`：先 `agents.get(id)`，未命中再 `(agents.roots() || []).find((a) => a && a.id === id)`。
- `index.js:554-558` `resolveSession` = `findAgentById` + `sessionTitleOf`，只返回 `{found, title, agent}`。
- `index.js:564-578` `matchSessionsByTitle` 也是遍历 `agents.roots()` 取 `a.id`。**标题与 id 两条路径共用同一个注册表**，这是第 4 条结论的依据。
- `index.js:946-974` 投递期 `resolveNow`：标题优先 → 没命中/多义时用 `target.id` 按 id 兜底 → 都失败就 `{ok:false, reason:'agent-not-found'}`，且 `:997` 注释写明「先解析、后标记：解析不到就不进 delivered」。

### 1.2 宿主侧实现（决定性证据）

`app.asar → dsh/node_modules/@deepseek-ai/dsh-agent/lib/index.js`：

- `:450` `super(ctx, "agents")` —— 这就是插件 `inject = ['agents']` 拿到的服务。
- `:441` `store = new Map()`；`:641` `enter(agent, owner)` 写入，`:669-676` `detachEntered` 删除，`:672` / `:704` 都以 `agent.id` 为键。
- `:720-727` `get(id)` 的文档原文：**"Look up a live agent. @param id - the shared agent/session id to look up. @returns the agent, or undefined when no live agent has that id."**
- `:746-754` `roots()`：**"All live top-level agents in registration order."** 实现是 `[...store.values()].filter(e => e.owner === void 0)`。
- `:595-600` `async resume(options)`：可「Load a persisted session and resume an agent on it」。

⇒ 键 = agent id = session id（同值），形如 `session-daeb834f-a940-44d0-b4cc-9d56b7c5eb72`。**配置里的 7 个 targetSessionId 格式正确。**

### 1.3 数据形状

```
agents.get(id: string)        -> Agent | undefined
agents.roots()                -> Agent[]            // 只含 live 且 owner===undefined 的
agents.list()                 -> Agent[]            // 只含 live
agents.resume({resumeSessionId, ...}) -> Promise<Agent>
Agent = { id: 'session-<uuid>', session, status, ctx, followup(msg), whenIdle(), ... }
```

### 1.4 反证（配置写法确实可用）

`<profile>\dsh-handoff-relay\delivered\<dirKey>\` 下 5 个 dirKey 都有真实投递落盘，说明这 5 个 id 形态都被成功解析过（dirKey = sha1(resolve(dir).toLowerCase())[0:12]，见 `index.js:124-127`，我逐条算过）：

| dirKey | 对应 watch 目录 | 文件数 | 最后一件 |
|---|---|---|---|
| `90caa0a2de22` | `scripts\dsh\wakeup-inbox` | 2 | `probe-resume-1114.txt` 11-14 02:14:34 |
| `57bafc8e48c6` | `scripts\dsh\wakeup-inbox\workbuddy` | 0（目录不存在） | — |
| `d5b1c02cd4cc` | `scripts\dsh\wakeup-inbox\doubao` | 0（目录不存在） | — |
| `83e63d6cfdfa` | `.batch\night\signals\workbuddy` | 11 | `real-machine-050-script.v2.done` 10:17:26 |
| `dad6df13f302` | `.batch\night\signals\doubao` | 15 | `p29-dir-check.done` 09:55:29 |
| `462e69db07b3` | `.batch\night\bridge\to-owner` | 7 | `ask-owner-050-1020.md` 10:18:58 |
| `abf70c44921e` | `.batch\night\bridge\to-group` | 9 | `ask-dedupe-physical-0854.md` 08:54:46 |

## 2. Q2：为什么同一个 target 有时解析成功、有时 `agent-not-found`？

### 2.1 机制（一句话）

`agents` 注册表是**内存里的活体表**：session 只有在宿主进程里被打开/恢复（`api-session-controller` 的 `resumeOrRestore` → `ctx.agents.resume(...)`，见 `dsh-api-session-controller/lib/index.js:177-215`、`:283-320`）时才 `enter`，会话一被释放/关掉就从表里消失。**没打开的会话 = 不存在于表里 = not-found，哪怕 id 完全正确。**

同一文件 `:2739` 也把这件事说透了：会话列表里每项带的 `agentAvailable: this.ctx.agents.get(session.id)?.session === session`——「活着的」是单独一个布尔位。

### 2.2 时序这一层（启动期）

插件加载时目标会话通常还没恢复 ⇒ 启动瞬间 `加载解析` 全红是常态，不是故障。P11 为此做了有限重扫：`index.js:34-36` `RETRY_DELAYS_MS = [1000, 5000, 15000]`、`MAX_SCAN_ATTEMPTS = 3`、`MAX_SCAN_WINDOW_MS = 21000`；`index.js:1100-1108` 只在 `atLoad.ok === false` 时挂重扫，命中即停。**21 秒之后再没有周期性重试**，只剩「新文件事件到来时重新解析」这一条路。

### 2.3 证据链（`relay.log` 原文）

- 同一批 id，两次加载结果相反：`15:04:30` 七条全 `agent-not-found` → `16:02:25` 七条全 `resolved=...`（第 2-17 行）；紧接着 `16:02:40` 又七条全 `agent-not-found`（第 19-25 行）。id 没变，变的是会话活没活。
- 本 boot（`00:45:22` 加载）七条全红，`00:45:25/27/37` 三次 rescan 里只有 workbuddy、to-owner、to-group 转 `resolved`；负责人（`session-daeb834f…`）与豆包（`session-4380d607…`）到 rescan#3 仍未活。
- 同一 target 先成功后失败：`delivered\90caa0a2de22\probe-resume-1114.txt`（02:14:34 投递成功，目标 `session-daeb834f…`）→ `02:05:00.896/.897/.898Z`（本地 10:05）三连 `watches[0] 解析不到目标，保持未投递（reason=agent-not-found）`。文件至今留在 `scripts\dsh\wakeup-inbox\dsh-wake-20261114-1005-6263.md`。

⇒ 同一 target 的「时好时坏」= **目标会话此刻是否活着**；「启动后 21 秒内」是唯一的补偿窗口。

### 2.4 另一条独立的病因：id 写过旧值

`relay.log:330-332`（11-13 23:29 / 23:46 / 11-14 00:04）`watches[6] … targetSessionId=session-f6f51eef-c04b-47aa-ad84-491d880ca5e9` 三连失败；后来配置改成 `session-453478dd-2bf6-4099-8984-8868101be7c3` 才通（`to-group` 现在有 9 件落盘）。这一类是「id 写旧了」，不是存活问题——但**表现与存活问题一模一样**，靠日志单看分不出来，必须比对当前配置。

## 3. Q3：七条 watch 逐条判定

判定口径：①「能投」= 本 boot（本地 08:45 之后）`delivered\<dirKey>\` 有落盘，且落盘依赖解析成功；②「时好时坏」= 历史有成功、但本 boot 已失败且目标非常驻活；③「未验证」= 该 watch 从未有任何文件落盘。

| # | watch 目录 | targetSessionId | 目标标题 | 本 boot 落盘 | 判定 |
|---|---|---|---|---|---|
| 0 | `scripts\dsh\wakeup-inbox` | `session-daeb834f…eb72` | AI writer总负责人 · AI writer项目组 | 无（10:05 三连失败，文件留原地） | **时好时坏 · 本 boot 静默失效** |
| 1 | `…\wakeup-inbox\workbuddy` | `session-33494f59…e7d0` | workbuddy联络人 · AI writer项目组 | 无（目录从未有文件） | **未验证**（同 id 在 #3 能投） |
| 2 | `…\wakeup-inbox\doubao` | `session-4380d607…b377` | 豆包联络人 · AI writer项目组 | 无（目录从未有文件） | **未验证**（同 id 在 #4 能投） |
| 3 | `.batch\night\signals\workbuddy` | `session-33494f59…e7d0` | workbuddy联络人 · AI writer项目组 | 6 件（08:50–10:17） | **能投** |
| 4 | `.batch\night\signals\doubao` | `session-4380d607…b377` | 豆包联络人 · AI writer项目组 | 3 件（08:54–09:55） | **能投** |
| 5 | `.batch\night\bridge\to-owner` | `session-a1d48adb…a9f1` | 大肥鱼 | 5 件（08:49–10:18） | **能投** |
| 6 | `.batch\night\bridge\to-group` | `session-453478dd…e7c3` | 大肥鱼 · AI writer项目组 | 1 件（08:54） | **能投**（旧 id 已修） |

补充两点事实，避免误判：

1. **「常年不通」的说法与落盘证据不符**：#4/#5/#6 本 boot 都有成功落盘。#5（to-owner）本 boot 投了 5 次，最新 10:18:58。真正不通的只有 #0，以及从未被使用过的 #1/#2。
2. **`relay.log` 里查不到「投递成功」**：HEAD 的成功路径只调 `log(ctx,'info',...)`（`index.js:1014`），`relayLog` 只写 warn 与启动/加载行。所以**不能用 relay.log 判通道是否活着**，必须看 `delivered\`——这是本次排查最容易被引到错结论的一处。

## 4. 修法建议（只建议，未改码）

1. **立即止血（不改码）**：#0 那条 `dsh-wake-20261114-1005-6263.md` 还在原地，属「未投出但没丢」。给负责人的唤醒如需保证到达，短期内应同时往一个常驻通道（如 `bridge\to-owner`，本 boot 全程可用）投一份。
2. **真解：投递前按需 resume**。宿主已提供 `agents.resume({ resumeSessionId })`（`dsh-agent/lib/index.js:595-600`），或走 `api-session-controller` 的 `resolveOrResume`（`:177-215`）。做法：`findAgentById` 未命中时先 resume 目标会话，再 `followup`。
   - 代价与风险须先拍板：resume 会**真的把会话拉起**（走 factory、发 `agent/created` 等生命周期），不是纯查询；高频唤醒可能造成会话常驻。
   - 建议只在「唤醒/交接」这类必须达的通道启用，signals 通道维持「没活就留原地等下一次事件」。
3. **失败也要留痕**：解析不到时目前只写 warn 且文件留原地（`index.js:997-1003`），下次事件才重试。建议把 not-found 的次数与最后时间写进 `failed.json` 或在 `delivered\` 同级落一个 `undelivered.json`，否则「静默丢失」只能靠人翻日志发现。
4. **观测补口**：成功投递也写一行 `relayLog`（`已投递 → <id> file=<name>`），否则通道死活在日志里完全不可见——这次三处误判都源于此。
5. **纠正一个预期**：id→标题迁移**不能**解决存活问题（标题解析同样只遍历 `roots()`）。它能解决的是「配置里的 id 写旧了」。当前 7 条里只有 #6 需这么修，且已修完；剩下的红全部是存活问题。迁移仍值得做（少踩旧 id、可读性），但**要按「少一个坑」而不是「解决唤醒丢失」来定位收益**。

## 5. 改码前需拍板的三件事

1. 是否允许插件对目标会话做 `agents.resume`（真拉起会话）？如允许，限定哪些通道？
2. not-found 时的处置：留原地等事件（现状）/ 记 `undelivered.json` / 改投常驻通道 —— 三者选一或组合。
3. 成功投递是否也进 `relay.log`（会明显增大日志量，需定清理口径）。

<!-- DONE -->
