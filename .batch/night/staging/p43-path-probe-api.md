# P43 · 渲染层能否只凭一个绝对路径判断存在/可读

起点：仓库 HEAD=`8e4ad64`（`C:\develop\workspace\dsh-handoff-relay`，porcelain 空）；宿主 = 桌面端当前安装的 `app.asar`。
工具：`.batch/night/tools/asar-grep.py`（正则扫 asar，回显 `文件:行`）。
不变量：只读，未改码、未重启、未动配置。

---

## §0 先更正我自己在 P42 的一个错判

P42 的 Q4 写「**没有插件级 IPC/路由注册 API**」——**这一条错了**。宿主 `WebServer` 类里明摆着两个注册方法：

- `dsh-host-webserver/lib/index.js:375-382` `register(route)`：`const table = route.kind === "exact" ? this.exact : this.prefixes;` … `if (table.has(route.path)) throw … duplicate …`，即 **exact / prefix 两种 HTTP 路由**，重复路径抛错。
- 同文件 `:389-397` `registerUpgrade(route)`：**exact-path HTTP upgrade（WebSocket）**路由，重复路径同样抛错。
- 路由匹配顺序 `:579-583` `match(pathname)`：exact 表 → 最长前缀 → fallback。

错因（要记住的检索纪律）：P42 只用 `super(ctx,"x")` 与 `provide("x")` 两种形态枚举服务，而 `webServer` 是通过 **`ctx.inject(["webServer"], …)`** 拿到的，落在我的枚举口径之外。⇒ 结论：**插件（宿主侧的普通 cordis 插件）可以自建 HTTP 路由**，这是我 P42 漏掉的正路。本报告以更正后的事实为准。

---

## §1 逐条核你点名的三个口子

### 1.1 `remote.workspaceFiles` 族（现成远程通道）

入参形状（`dsh-api-workspace-files/lib/index.js`）：

| 方法 | 签名 | 关键约束 |
|---|---|---|
| `stat` | `stat(workspaceFileScope, path, signal)`（`:484`） | 第一参是**请求头派生的 workspace 作用域**，不是任意字符串；`path` 注释原文 `:480`：「absolute path or path relative to the workspace root; **files outside it are allowed**」⇒ 文件可越出工作区。 |
| `list` | `list(workspaceFileScope, path, signal)`（`:492` 起） | 只列「Session 工作区内的一个目录」；`:581` `if (!this.ctx.fs.contains(root, target)) throw new RemoteError("workspace-file/outside-workspace", …)` ⇒ **工作区外的目录直接拒**。 |
| `changes` | `changes(sessionId, path, signal)`（`lib/client.js:110` 调用） | `:69` 同样有 `contains` 门：`if (info?.type === "directory" && !this.ctx.fs.contains(root, target)) throw new RemoteError("workspace-file/outside-workspace", …)`。 |

「存不存在」怎么回话：`locateFile`（`:589-604`）

- `:600` `if (info === void 0) throw new RemoteError("workspace-file/not-found", \`no entry at "${path}"\`, { path });`
- `:601` `if (info.type !== "file") throw new RemoteError("workspace-file/not-regular-file", …)`
- 前面 `:591` 还先拒 `entry.type !== "file"`。

⇒ **`stat` 是「文件」探测器**：存在且是普通文件 → 返回 `{absolutePath, version, size}`；不存在 → **抛** `workspace-file/not-found`；是目录 → 抛 `not-regular-file`。**它不能用来判目录**，而我们的 watch 目录恰恰都是目录。`list` 才是目录探测器，但它被 `contains(root, target)` 锁在工作区内。

会话作用域要不要活会话：`README.md:95`「A Typert lookup derives `WorkspaceFileScope` from a **live Session header or the persistence service's header**」⇒ 活会话优先，死会话可由持久化头兜（具体取值路径本卡未验，标 unknown）。`dsh-api-workspace-files/lib/client.js:456` 那处的 `"remote.workspaceFiles"` 是该客户端包的 inject 声明。

### 1.2 `remoteAccess`（P42 已知其常驻）

`dsh-api-remote-access/lib/client.js:37-44` `get methods() { return this.resolve().methods; }`，方法表在 `client.js:225-228` 里，只登记了 `"remoteAccess/follow"`（`service:"remoteAccess"`, `mode:"stream"`），宿主侧 `FOLLOW_ACTION = "remoteAccess/follow"`（`lib/index.js:59`），语义是「权限/来源快照的流」。**它判不了路径**——没有 path 参数，也不碰 fs。

### 1.3 `fileActions` / `documentPreviews` / `resources`

- `fileActions`：`dsh-client-ui-file-actions/lib/client.js:1833` `ctx.provide("fileActions", actions)`——注册的是「打开/预览这类动作表」，入参是动作与目标，不走 fs。
- `documentPreviews`：`dsh-client-ui-sidebar-documentpreview/lib/client.js:8002`——预览器注册表。
- `resources`：`dsh-client-resources/lib/client.js:172`——UI 资源（图标等）。
三者都**不能**回答「这个绝对路径在宿主上存不存在」。

---

## §2 硬结论

**能，但现成通道只覆盖一半，另一半要自建路由。**

- **「这个文件在不在、是不是普通文件」——现成可判**：`remote.workspaceFiles.stat(sessionId, absPath)`，任意绝对路径（`README` 明的「files outside it are allowed」），结果从「返回值 vs `workspace-file/not-found` 抛错」读出。前提是渲染层能拿到一个 `sessionId` 作作用域（本插件已有 `firstSessionId(ctx)`）。
- **「这个目录可不可用」——现成通道判不了（工作区外必拒）**：目录探测只有 `list`，而 `list` 被 `:581` 的 `contains(root,target)` 锁在工作区内；我们的 watch 目录里有 `~\.dsh\bot\workspace\…`、用户自选目录等**工作区外**路径，会稳定拿到 `workspace-file/outside-workspace`。
- **要判任意目录 ⇒ 必须走自建路由**：宿主插件 `ctx.inject(["webServer"])` 后 `webServer.register({ kind: "exact", path: "/handoff-relay/probe", handler })`（`dsh-host-webserver/lib/index.js:375`），主进程 `fs.stat`/`access` 真判，渲染层 `fetch("/handoff-relay/probe?path=…")` 同源取结果。这条同时解决「目录 + 文件 + 可读性 + 实时」，且不依赖会话是否活着。

**对改码卡的直接含义**

1. 想「最小改动、先让绿点/红点转起来」：可以先用 `remote.workspaceFiles.stat` 做**文件级**探测，但 watch 目录是目录，它答不了 ⇒ 仍要落回 `none`，等于没解决。
2. 想「一次到位」：按自建路由做。路由三件套必须齐——同源校验（大肥鱼调研里 `index.js:9695` `requestRejection`、`:252` `isTrustedTelemetryRequest` 两个先例）、只读方法（只 stat/access，不 list 全盘、不回文件内容）、路径参数归一（`path.resolve` 后回显 `absolute`，防相对路径歧义）。
3. `index-inject` 那条路可彻底放弃（只在页面初始化注入一次，做不到「输入即校验」），与 P42 的取舍一致。

---

## §3 补：这条路由要不要显式 inject、要不要额外配置（大肥鱼问）

**要显式 inject，不需要额外配置；但要重启才生效。**

- 我们自己的宿主侧 `index.js:12` 现在只有 `export const inject = ['agents'];`，**没有 `webServer`** ⇒ 必须新增 `ctx.inject(['webServer'], (wctx) => { … })` 才能拿到 `wctx.webServer.register`。写法与我们现有的 settings 分支一致（`index.js:1219-1236` 就是 `ctx.inject(['settings'], …)`，且注释 `:861` 说明「`settings` 不能写进静态 inject」——`webServer` 同理，用动态 inject 更稳）。
- 不要额外配置：`webServer` 是宿主自带服务（`dsh-host-webserver/lib/index.js:298`，GUI 就由它起），插件装上即存在，没有 `cordis.patch.yml` 开关，也不需要在 `dsh.bundle` 里声明什么。宿主的 `dsh-api-remote-access`、`dsh-client-ui-settings-account` 都在用同一条注入事件链，说明这是常规能力。
- 路由路径是**站点根相对**，不是插件目录相对：第三方先例 `@goodandready/dsh-agent-loop-guard` 用的是 `/api/@goodandready/dsh-agent-loop-guard/telemetry`（`lib/index.js:250`）。我们建议 `path: "/api/dsh-handoff-relay/probe"`，渲染层 `fetch("/api/dsh-handoff-relay/probe?path=…")` 同源直取，不用拼 base URL。
- 注册必须可回收：先例把注册包在 `wctx.effect(() => wctx.webServer.register({...}), "label")` 里（`lib/index.js:240-244`、`:283-287`），`register` 本身返回 disposer。
- 同源/鉴权有现成判据可抄：`plugin-updater.js` 的 `isTrustedTelemetryRequest(request, ctx)` —— 先拿宿主 `connection` 服务调 `conn.requestRejection(request)`（不通过即拒），没有 connection 时退回「loopback + `sec-fetch-site` 是 `same-origin`/`none`」；`getConnection` 是 `ctx.reflect.get('connection') || ctx.connection` 再向上找 root。
- **生效时点**：host 侧 `index.js` 改动要重启才载入（profile 里是指向仓库的 junction，改仓库即改已装，但进程不重载）；渲染层 `client.js` 改动也要重启/刷新才换 bundle。⇒ 与大肥鱼判断一致：这次真机必须和 P39 框沿复验合并成**同一次关开**，不能单独约。

## §4 未核项（如实记）

- `WorkspaceFileScope` 的 header 具体从哪取（live session vs 持久化头）——只读到 README 的文字，未追到代码行。
- 自建路由在**本插件当前形态**下能否挂上：我们的宿主侧 `index.js` 是否已经 `ctx.inject(["webServer"])`、以及 `client.js` 与 `index.js` 是否同一个插件条目两半——本卡只判「能不能」，具体接线留给改码卡。
- `dsh-better-sidebar` / `dsh-agent-loop-guard` 两个先例出自大肥鱼调研（`community-dir-probe-research.md`），我未复验其行号。

<!-- DONE -->
