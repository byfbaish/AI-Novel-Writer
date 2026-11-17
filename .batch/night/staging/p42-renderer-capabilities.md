# P42 · 渲染层能拿到哪些服务 / 主进程能不能下行（只读取证）

起点 HEAD=`8e4ad64`（`C:\develop\workspace\dsh-handoff-relay`，porcelain 空）
宿主版本：`app.asar` 内 `dsh/package.json` 未单独取版本号，按「桌面端当前安装（2026-11-14 20:30 起运行的那份 app.asar）」计；插件侧 `package.json` = `dsh-handoff-relay@0.5.0`。
工具：`.batch/night/tools/asar-grep.py`（本次新写，按正则扫 asar 内文件并回显行号，只读）。
不变量：未改任何代码、未重启宿主、未动配置。

---

## Q1 · 渲染层可拿到的服务清单（文件 / 工作区 / 会话相关）

枚举方法：扫 asar 内所有 `*/lib/client.js`，抓两类注册点——`super(ctx, "<name>")`（Service 类）与 `ctx.provide("<name>", …)`／`ctx.reflect.provide("<name>", …)`（非 Service 值）。**命中 18 + 23 条**，与文件/工作区/会话相关的如下。

| 服务名 | 注册位置 | 能力（方法） |
|---|---|---|
| `sessions` | `dsh-api-session-controller/lib/client.js:3856` `rootCtx.reflect.provide("sessions", this, void 0)` | `list.getSnapshot().byId`（快照里带 `running` / `blank` / `displayTitle` / `cwd`）；无 fs 读取 |
| `workspaces` | `dsh-api-workspace-controller/lib/client.js:389` `super(ctx, "workspaces")` | `this.list = model`、`create(input)` 等（`:393-395`）——工作区实体，不是目录探测 |
| `remoteAccess` | `dsh-api-remote-access/lib/client.js:718` `super(ctx, "remoteAccess")` | `source(kind,id,action)`（`:721`）、`allows(...)`——**权限快照，不做 fs** |
| `remote` | `dsh-api-gateway/lib/client.browser.js:1626`（node 侧同 `client.node.js:1442`）`super(ctx, "remote")` | 远程 RPC 门面（`this.connection = ctx.get("connection")`、`streams`）；工作区文件族挂在它下面 |
| `uiWorkspace` | `dsh-client-ui-workspace/lib/client.js:1382` | 工作区 UI 状态 |
| `uiSession` | `dsh-client-ui-session/lib/client.js:798` | 会话 UI 状态 |
| `uiConversation` / `conversation` | `dsh-client-ui-conversation/lib/client.js:4097` / `:4718` | 会话内容 |
| `fileActions` | `dsh-client-ui-file-actions/lib/client.js:1833` `ctx.provide("fileActions", actions)` | 文件动作（打开/预览类动作表），不是 fs |
| `fileUpload` | `dsh-client-file-upload/lib/client.js:158` | 上传 |
| `chatFileMentions` | `dsh-client-ui-deliverables/lib/client.js:2684` | 对话里 @ 文件 |
| `documentPreviews` | `dsh-client-ui-sidebar-documentpreview/lib/client.js:8002` | 文档预览注册表 |
| `resources` | `dsh-client-resources/lib/client.js:172` `ctx.reflect.provide("resources", resources)` | UI 资源注册表（图标等），**不是文件系统** |
| `sessionLogDownload` | `dsh-session-log-export/lib/client.js:587` | 会话日志下载 |

**工作区文件服务（`workspaceFiles`）没有自己的 `provide`**：它在 `dsh-api-remotes/lib/client.js:27614` 起，是 `workspace-files/lib/typert.remote-client.js` 打进 `remote` 门面的远程方法族（`dsh-api-remotes/lib/client.js:3844` 还能看到与它共享的 `workspaceFileScope` lookup）。⇒ 渲染层要读目录，唯一现成口子仍然是**远程**的 `remote.workspaceFiles`，本地 fs 一律没有。

**这张表不是全量**：`ctx.provide` 里若有动态拼接名字（模板字符串）就抓不到，此类标 unknown（原因：枚举只认字面量）。

---

## Q2 · `remoteAccess` 有没有注册点

**有，而且是常驻注册，不是可选服务。**

- 宿主（主进程）：`dsh-api-remote-access/lib/index.js:153` `super(ctx, "remoteAccess")`；紧跟 `:154-156` `ctx.effect(...)` 生命周期、`:157` `ctx.inject(["webServer"], …)`、`:158` `webCtx.on("webserver/index-inject", (table, peer) => …)` 往页面注入 `REMOTE_ACCESS_SNAPSHOT_KEY`。
- 渲染层：`dsh-api-remote-access/lib/client.js:718` `super(ctx, "remoteAccess")`（`constructor(ctx, state)`）。
- 宿主侧快照方法：`dsh-api-remote-access/lib/index.js:59` `const FOLLOW_ACTION = "remoteAccess/follow"`；客户端远程声明在 `dsh-api-remote-access/lib/client.js:225-228` `methods: { "remoteAccess/follow": { service: "remoteAccess", … mode: "stream" } }`。

⇒ 「本版本根本没有 remoteAccess」这个假设**不成立**。P41 里 `probeDirectory` 落 `none` 更可能不是 `:215`（服务 undefined），而是 `:217`（`workspaceFilesOf` 四路候选全落空）或 `:208`（`sessionId` 为空 —— `firstSessionId` 取 `sessionMap(ctx)` 第一个 key，卡片首帧 `sessions` 快照可能还是空对象）。这两条要等有 DOM/日志才能钉死，仍标 unknown。

---

## Q3 · 两个 slot 注入的 props

### `plugins.row.config`

- 声明：`dsh-client-ui-plugin-manager/lib/client.js:7780-7783` `"plugins.row.config": { kind: "keyed", scope: "root" }`（同一处 `:93` 也列在 `SLOTS` 里）；key 规则 `:87-88` `rowConfigKey = (bundle,rowId) => \`${bundle}#${rowId}\``。
- 渲染：`:5870-5873` `renderSlot("plugins.row.config", { view: "page", form }, { entryKey: key })`；摘要视图在 `:5855` `renderSlot("plugins.row.config", { view: "summary" }, { entryKey: key })`。
- 所以宿主注入给卡片的 props 就是 **`{ view: "page"|"summary", form }`**（第三个参数 `{ entryKey }` 是 slot 的 key 选项，不是 props）；插件自己在注册时还能补 `inject`（我们的 `client.js:625` 注入 `{ ctx, controller }`）。
- `form` 的形状（同一文件 `:6920-6927` 一带）：`{ state: form.getSnapshot(), mutate: (ops, revision) => form.mutate(ops, revision) }`——**`mutate` 是唯一会写宿主状态的入口**（落 `settings/update`，即配置回写），除它之外没有任何「让主进程执行任意动作」的回调。

### `settings.plugin.item`

- 在本宿主 asar 里**搜不到这个 slot 名**（`asar-grep.py '"settings\.plugin\.item"'` 全库 0 命中）⇒ 这是老宿主留下的入口，本版本没有；我们 `client.js:610` 只在 `configForms`/`settingsScope` 都拿不到时才走它，属于死分支。

### 有没有「触发主进程干活」的 props

**没有通用回调**。能触发宿主动作的只有 `form.mutate`（只写配置）与 `form.state`（只读快照）；`view`/`entryKey` 都是纯渲染用。⇒ 想在卡片里「请主进程校验一个目录」，走 props 这条路不通。

---

## Q4 · 插件能不能注册自己的 IPC / 路由 / 静态资源

### 结论：**没有插件级的 route / IPC 注册 API；宿主只提供了「往 index HTML 注入全局量」这一个扩展点**

- 宿主 web 服务类：`dsh-host-webserver/lib/index.js:298` `var WebServer = class extends Service`；它对外的扩展点是**事件**，不是路由注册：`:648` `this.ctx.emit("webserver/index-inject", table, peer)`（注释在 `:640`：每个订阅者往 table 里推自己当前的行）。
- 订阅方的现成写法（都在宿主包里，证明这条路对第三方插件同样开放——都是普通 cordis 插件）：
  - `dsh-api-remote-access/lib/index.js:157-161` `ctx.inject(["webServer"], (webCtx) => { webCtx.on("webserver/index-inject", (table, peer) => { table.push({ kind: "global", name: REMOTE_ACCESS_SNAPSHOT_KEY, … }) }) })`
  - `dsh-client-ui-settings-account/lib/index.js:74-82` `ctx.on("webserver/index-inject", (table) => { table.push({ kind: "global", name: CONTACT_CONFIG_GLOBAL, value: {…} }) })`
  - 同类订阅者还有 `dsh-client-connection/lib/index.js:1037`、`dsh-client-modules/lib/index.js:628`、`dsh-client-shortcuts/lib/index.js:14`、`dsh-client-ui-theme/lib/index.js:204`、`dsh-client-ui-settings-models/lib/index.js:17`、`dsh-client-ui-sidebar-documentpreview/lib/index.js:26`、`dsh-experimental-inspector/lib/index.js:2407`。
- 主进程侧的 `ipcMain` 只在宿主自己手里（`lib/main.js`），没有「插件注册 IPC handler」的入口；`dsh-api-gateway` 的 `remote` 是宿主 typert 方法的统一门面，也没有给插件新增方法的公开面。

⇒ 可行性判定：**「主进程把目录可读性送渲染层」有且只有一条现成通道**——宿主插件在 `webserver/index-inject` 里往页面注入一个 `kind:"global"` 的值（注入发生在页面初始化时），渲染层从全局量读到它；**每次改动都要等页面初始化，做不到「输入即校验」**。想做实时回显，需要另一条路（未设计，按卡面要求不展开）。

---

## 附：本次另核到的事实

- `remote` 服务在浏览器端**存在**（`dsh-api-gateway/lib/client.browser.js:1626`），所以 `client.js:192-195` 的 `readService(ctx,"remote")` / `readService(ctx,"remote.workspaceFiles")` 至少前者不会落空；`remote.workspaceFiles` 是否存在 = unknown（`remote` 是动态方法门面，静态文本里拿不到实例化后的键）。
- 我们 `client.js:21` `inject = ["slots","sessions"]`：`sessions` 在宿主里确有（`dsh-api-session-controller/lib/client.js:3856`），所以 `sessionMap` 拿空只可能是**首帧快照未就绪**，不是服务缺失。

<!-- DONE -->
