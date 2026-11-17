# P41 · 设置卡框沿为什么没有红/绿（只读取证）

起点 HEAD=`8e4ad64`（插件仓库 `C:\develop\workspace\dsh-handoff-relay`，porcelain 空）
取证时刻：2026-11-16 20:36–20:52（本机 20:30 重启后）
不变量：未改任何代码、未重启宿主、未动 `cordis.patch.yml`。

---

## Q1 · 用户看到的那张卡是哪个组件

### 结论：是 `client.js` 里的 `SettingsCard`（P39 染色就在它内部的 `DirPathField` 上）

判据是「只在该文件出现」的界面字符串，主人之前描述过的三处全部命中：

| 主人看到的文字 | 唯一出处 |
|---|---|
| 「Host 未提供该条目」 | `client.js:399`（`snapshot.status` 既非 ready 也非 loading 时的兜底文案） |
| 「新增一行」/「保存」/「放弃修改」三个按钮 | `client.js:552` / `:553` / `:554`（同一行 `div` 里的三个 button） |
| 三列表头「目录 / 目标会话 / 完成规则」 | `client.js:533-537`（`S.head` 网格的四个 span） |
| 标签「stableMs」+ 数字输入框 | `client.js:524-532` |

宿主按 schema 自动生成的通用表单不会出现「新增一行 / 保存 / 放弃修改」这一组按钮，也不会出现「目录 / 目标会话 / 完成规则」这套自定表头——那些字符串不在宿主侧的通用渲染里，是 `SettingsCard` 自己 `h()` 出来的。所以**这张卡不是宿主通用表单**，而是我们的组件在渲染。

### 一条要纠正的连线：`设置卡未挂载` 那条 warn 与这张卡无关

`relay.log` 20:30:17（UTC 12:30:17）的
`设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）`
出自 `index.js:867`，在 `mountSettingsCard()` 里——那是**主进程侧**旧的 `settings.register(namespace, Schema)` 老路（给「settings.plugin.item」老宿主用的），它拿不到 `ctx.get('settings')` 就整段跳过。

真正把卡片挂到界面上的，是**渲染层**的 `client.js:620-628` 往 `plugins.row.config` 注册组件；两条路径互相独立，**前者 warn 并不导致后者不渲染**。所以别把这条 warn 当成「卡没挂上」的证据，它一直存在、且不影响 slot 卡。

### 拿不到的部分：DOM 原文 = unknown

- `http://127.0.0.1:9222/json/version` → `目标计算机积极拒绝`，本宿主没有开 CDP 调试口；
- 主进程命令行（PID 2044）只有 `"C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe"`，没有 `--remote-debugging-port`。

⇒ 组件来源可指认到 `client.js:366-556`，但「DOM 里到底是哪个节点在染色」无法直证，标 unknown（原因：无调试端口）。

---

## Q2 · `kind` 实际值

### `probeDirectory` 的全部出口（`client.js:207-241`）

| 出口 | 行 | 条件 |
|---|---|---|
| `none` | `:208` | `dir` 为空或 `sessionId` 为空（`firstSessionId` 取 `sessionMap` 第一个 key，`:202-205`） |
| `none` | `:213` | `ctx.get("remoteAccess")` **抛错**（严格代理场景） |
| `none` | `:215` | `access` 为 `undefined`（宿主没有这个服务） |
| `none` | `:217` | `workspaceFilesOf()` 四路候选全落空，拿不到带 `.list()` 的对象（`:185-200`） |
| `none` | `:230` | 3 秒超时（`DIR_CHECK_TIMEOUT_MS`，`:173`） |
| `none` | `:232` | `files.list()` reject |
| `ok` / `bad` | `:231` | `result.ok === true` → ok，否则 bad |

### 染色规则（`client.js:243-248`）

`ok`→绿 `#2e7d32`；`bad`→红 `#d33`；`none`/`checking`→**灰 `#9e9e9e`**（不是透明，是实色灰边）。所以「没有红绿」只有两种可能：**一直是灰（`none`）**，或者**输入框根本没渲染**。

### 实际值 = unknown，但可以三选一定位

无 DOM、无日志（`probeDirectory` 不打日志），值只能从界面反推。请按下面三条读，一条就够区分：

1. dir 输入框下面有没有**灰色小字「宿主未提供目录核验」**？
   有 ⇒ `kind === "none"`，走的是 `:291` 那行；说明宿主侧探测能力拿不到（`:215` 或 `:217`）。
2. 输入框右边有没有**「选择目录…」按钮**？
   没有 ⇒ `directoryPickerOf()` 为空（`:176-183`，读 `globalThis.__DSH_DIRECTORY_PICKER__`），`:284` 那个分支不渲染。
3. 整张卡里有没有**任何一行 dir 输入框**？
   没有 ⇒ `rows` 为空（快照不是 ready，`:385` 不灌行），这时根本不会走到 `DirPathField`。

### 宿主侧能力侧写（供定性用，不是结论）

- `remoteAccess` 是宿主的远程服务：`dsh-api-remote-access/lib/client.js:225-228` 有 `methods: { "remoteAccess/follow": { service: "remoteAccess" … } }`；
- `workspaceFiles` 在 `dsh-api-remotes/lib/client.js:27614` 起（`workspace-files/lib/typert.remote-client.js` 打进来的那一大段）；
- 本 profile 的 `cordis.patch.yml` 里**没有** `remote-access` / `workspace-files` 条目（`Select-String -Pattern 'workspace-files|remote-access'` 0 命中）——它们是 asar 里的宿主核心包，不靠 profile 条目开。

⇒ 服务在宿主里存在，但「插件 client 的 `ctx.get("remoteAccess")` 能不能拿到」= unknown（无 DOM、无探针）。

---

## Q3 · 主进程能不能自己判目录 / 有没有现成下行通道

### 能力：有，主进程就是直接读盘的

`index.js` 里全是同步 fs：`:321` `fs.statSync(file).size`、`:350` `fs.readdirSync(dir,{withFileTypes:true})`、`:353` `fs.statSync(full).mtimeMs`、`:380`、`:1025`、`:1045`；写侧 `:830` `fs.writeFileSync` + `:831` `fs.renameSync`（配置回写）。主进程判「这个目录存不存在/可不可读」是现成的，零新增依赖。

### 下行通道：没有现成的

- 渲染层侧的插件上下文只拿到两块：`client.js:21` `const inject = ["slots", "sessions"]`；表单数据来自 `client.js:617-628` 的 `configForms.get(ENTRY_ID)`。这里**都是读值/挂组件**，没有「主进程推一条自定义结果给卡片」的口子。
- `SettingsCard` 的 props 由宿主 slot 注入：`client.js:620-626` `inject: () => ({ ctx, controller })`——注入的是**渲染层自己的 ctx**（所以 `ctx.get("remoteAccess")` 是渲染层的服务），主进程内存里的状态传不过来。
- 插件没有自己的 route / IPC 通道注册代码，`package.json` 的 `dsh.client.inject` 只声明 `@deepseek-ai/dsh-client-ui-settings`，没有声明客户端服务。

⇒ **结论：主进程「能判」，但没有现成通道把判定结果送到卡片**；要做只能新增机制（未设计，按卡面要求不展开）。

---

## 附：本次取证顺带确认的事实

- `relay.log` 12:30:16.825Z：`启动 7/7 个 watch；stableMs=5000` ⇒ P40 生效（第 8 条已删）。
- 同一次启动 `watches[0]` 的两封信报 `解析不到目标，保持未投递（reason=agent-not-found）`（`:1000`），说明运行中的 index.js 已是含「保持未投递」那版。
- 20:30 重启后 `rescan#3`（12:30:32Z）里 `wakeup-inbox\workbuddy`、`signals\workbuddy`、`to-owner` 三条 resolved，`to-group` 仍 `not-found`。

<!-- DONE -->
