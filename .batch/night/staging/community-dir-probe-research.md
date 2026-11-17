# 社区调研：设置卡位置做「目录校验 / 路径状态回显」的现成机制

派单人：AI writer总负责人（20:42）；执行：大肥鱼（只读，不改本项目、不装插件、不对外写）
范围：本机已装 9 个第三方 DSH 插件源码 + npm/GitHub 检索；宿主侧源码读 `~/.dsh/profiles/desktop/node_modules/ds-bot/src`。
起点：HEAD `8e4ad64`，porcelain 空。

## 0. 一句话结论

**有现成机制，但不是「现成的目录校验 API」，而是「插件主进程自建 HTTP 路由 + 渲染层同源 fetch」这一条通道。** 目录是否存在/可读由插件自己在 Node 里 `fs.stat`，结果经自己的路由回给设置卡输入框。本机正在运行的 `dsh-better-sidebar` 与 `@goodandready/dsh-agent-loop-guard` 都在用这条通道。

**同时更正 developer P42 的 Q4**：宿主**有**插件级路由注册 API —— `ctx.webServer.register({kind:'exact'|'prefix', path, handler})`，另有 `ctx.webServer.registerUpgrade`（WebSocket）。不是没有，是 P42 扫 `super(ctx,"x")`/`provide("x")` 时没扫到 `webServer`（它是 `ctx.inject(['webServer'], …)` 形态，服务名不在那两类注册里）。

## 1. 可直接复用的机制（主线，1 条）

**注册（插件主进程 `index.js`）**

```js
ctx.inject(['webServer'], (wctx) => {
  wctx.effect(() => wctx.webServer.register({
    kind: 'exact',                       // 或 'prefix'（前缀树，自己分发子方法）
    path: '/handoff-relay/probe',
    handler: async (req, res) => { /* 同源校验 → fs.stat → JSON */ },
  }), 'handoff-relay: probe route');
});
```

证据：
- `@goodandready/dsh-agent-loop-guard/lib/index.js:233-281` —— 就这一形态：`ctx.inject(['webServer'], …)` → `wctx.effect(...)` → `wctx.webServer.register({kind:'exact', path:'/api/@goodandready/dsh-agent-loop-guard/telemetry', handler})`，GET/HEAD/POST 分流、405 带 `allow`。
- 同一插件 `lib/plugin-updater.js:376-380` —— 先 `typeof ctx?.webServer?.register !== 'function'` 判空再注册（兼容老宿主，值得照抄）。
- `dsh-better-sidebar/lib/index.js:9808-9868` —— `kind:'prefix'` 的 `/sidebar/api`，POST-only、按 `pathname.slice(13)` 分发到 `api[method]`，未命中 404。同文件另有 7 处 `ctx.webServer.register`（`:3598`、`:9869`、`:9899`、`:9944`、`:9992`、`:10027`、`:10066`）与 3 处 `registerUpgrade`（`:10104`、`:10117`、`:10134`）。

**调用（渲染层 `client.js`）**

- `dsh-better-sidebar/lib/client.js:4345` —— `fetch(hostRouteUrl('sidebar/api/' + method).href, {...})`。
- 同一文件 `:1150-1204`（`hostTransportBase` / `hostHttpBase`）与 `:1206-1244`（`host-route-url.ts`）写明两条硬约束：①HTTP 必须走**页面自身 base**（`document.baseURI`），不能走 `__DSH_TRANSPORT__.streamBaseUrl` —— 后者是 `http://127.0.0.1:<port>`，跨源且宿主插件路由不返回 `Access-Control-Allow-*`，浏览器直接 `Failed to fetch`；②URL 必须前缀安全（用 `new URL(rel, document.baseURI)`），否则反代目录前缀下会 404。**这两条是我们最容易踩的坑。**
- 其它在用同一通道的插件：`dsh-vision-router/lib/client.js:1375`(`/_dsh/vision-router/settings-save-diagnostics`)、`:2824`；`@liustack/modlens/dsh/client.js:545,937,998`(`/modlens/config`)；`dsh-our-free-model/client.js:2940`(`/api/our-free-model/*`)；`@noob-stupid/dsh-plugin-console/lib/client.js:2123`(`/plugin-console/run-suggested`)。

## 2. 目录判定的现成写法（不是现成 API，是现成套路）

`dsh-better-sidebar/lib/index.js` 里有一整套「路径 → 判定」的写法，直接可借：

- `:9273` `"fs.tree"` → 先 `cwdOf(payload)` 定基准，再 `ensureWorkspacePath(cwd, path)` 做越界防护，再 `listDirectory(...)`。
- `:3112-3115` `isDirectoryEntry(absolute, dirent)`：`lstat` 后 `isDirectory()`，符号链接跟一层。
- `:1490` 行级 `row.isDir = info ? info.isDirectory() : row.isDir` —— 就是「拿不到就保留上次值」的降级写法。
- `:9079`、`:9148` 抛 `SidebarError("fs-error", '"…" is a directory', 400)` —— **错误码 + 人话**回给前端，前端据此染色/出小字。

⇒ 对我们最省事的实现：主进程路由收到 `path` → `fs.promises.stat` → 归一成
`{kind:'ok'|'missing'|'denied'|'file'|'none', absolute, reason}`，`DirPathField` 在 blur 或 300ms debounce 后 fetch 一次，按 `kind` 染色（沿用 P39 的 `:244` 绿 / `:245` 红 / `:246` 灰）。**这就是把 P39 已写好的染色逻辑接上真数据，不用改渲染结构。**

## 3. 没有现成轮子的部分（必须自建）

- **`plugins.row.config` 的 props 里没有校验回调**：宿主注入的就是 `{view, form}`，`form = {state, mutate}`，`mutate` 只写配置 —— 见 developer P42 引的 `dsh-client-ui-plugin-manager/lib/client.js:5870-5873`、`:6920-6927`。我这边独立复核：本机装了设置卡的插件（`dsh-ops/lib/client.js:1269`、`@goodandready/dsh-agent-loop-guard/lib/client.js:552`、`@liustack/modlens/dsh/client.js:1166`、`dshmarket/client/client.js:18872`）全部只用这两种 slot，**没有一个收到「校验/探测」类回调**。
- 所以「输入即校验」这个交互在本宿主没有现成实现可抄，只能：**主进程路由 + 前端 fetch**。这也顺带否掉了 `index-inject` 路线（它只在页面初始化时注入一次，见 P42）。

## 4. 安全约束（照抄，不能省）

自建路由等于把本地文件系统开了一个 HTTP 口，**必须做同源/可信校验**：
- `dsh-better-sidebar/lib/index.js:9695` —— `const fence = (req) => ctx.connection.requestRejection(req) === void 0;`，不通过直接 403。
- `dsh-agent-loop-guard/lib/index.js:252` —— `isTrustedTelemetryRequest(request, wctx)`，注释写明「Rejected non-local or cross-origin」，403。
- 建议我们的 `/handoff-relay/probe` 只允许 `GET`，只回答「存在/是否目录/是否可读」，**不返回目录列表**（`fs.tree` 那种能力不要顺手带上）。

## 5. 宿主自己怎么校验目录（旁证）

`ds-bot/src/host/folders.js:185-227`：宿主选目录靠 `ctx.get('directoryPicker')?.capability()`，`kind` 只可能是 `native`（原生对话框）或 `browse`（列目录），`pick()` / `list()` 走它。宿主校验 team workspace 的写法在 `:120-146`：`mkdir(recursive)` → `realpath` → `isFolder()` 判是不是目录 → 再判是否落在 DSH 数据目录内。**宿主也没给渲染层暴露「fs.exists」这类通用 API**，它自己也是主进程里做。这条旁证说明：我们把探测放主进程是宿主同款思路，不是绕路。

## 6. 给改码卡的建议（三选一，我推荐 A）

- **A（推荐）**：主进程 `index.js` 用 `ctx.inject(['webServer'])` 注册 `GET /handoff-relay/probe?path=…`，返回 `{kind, absolute, reason}`；`client.js` 的 `probeDirectory` 改为 fetch 它，保留原 6 个 `none` 出口作为兜底并各打一行日志（钉死现网到底走哪条）。工作量最小，且**能顺手把「存在性不验」一起补上**。
- B：`index-inject` 注入启动时判定 —— 只能拿到启动那一刻的结果，输入框改路径后不会变，**不能满足「输入即校验」**，不推荐。
- C：不改，只补日志 —— 只能定位，不能修。

## 7. 检索到但没采用的条目

- `dsh-session-control`（[github.com/gyyxs88/dsh-session-control](https://github.com/gyyxs88/dsh-session-control)）、`@deepseek-ai/dsh-session-query`（宿主自带包）、`@alatastudio/dsh-session-query`：都是**会话**枚举/搜索，不涉及目录存在性；与我们的「会话搜索」需求相关，与本次目录探测无关。
- `thatgfsj-dsh/dsh-plugin-skills`：文档型，讲 slot / 服务地图，未给目录校验实现。
- `docs/DESIGN.md`（`@aeroscis/dsh-temptask`）：只提到 slots 的桩写法，无目录校验。

## 8. 复核口径

- 结论只基于读源码与检索，未运行任何插件、未改本项目文件、未做任何对外写动作。
- 所有行号取自本机当前安装版本；换版本需重核。

<!-- DONE -->
