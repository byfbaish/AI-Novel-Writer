# dsh-handoff-relay 桌面端崩溃定性：客户端条目硬注入 `settingsScope`，而 0.2.2-rc.1 已改名为 `configForms`

只读取证，未改码、未碰在跑的实例。时间 2026-11-14 02:50 前后。

## 一句话结论

崩在**浏览器端 cordis 树**，不是宿主装配：`client.js` 导出的 `inject` 里写死了 `settingsScope`，桌面壳自带的 DSH 0.2.2-rc.1 已把这个服务改名为 `configForms`（另新增 `settingsSchema`），条目永远停在 pending，渲染层 `assertEntriesActive` 直接抛错 → `bootFailed` IPC → 主进程 `reportFatal(..., "web-boot")` 落 crash 日志。

## 证据链

1. 崩溃栈里的 `app.asar/lib/main.js:20648` 不是"宿主 boot 失败"，而是 IPC 处理器本体：
   `ipcMain.handle(DESKTOP_IPC.bootFailed, (event, message) => { … reportFatal(new Error(message), "web-boot"); })`
   → 错误文本是渲染层传上来的。
2. 渲染层断言在 `dsh-web-frontend\dist\assets\index-*.js` 末尾：`runPluginBoot()` 里 `await l.await()` 之后调 `assertEntriesActive(ctx)`，pending 分支拼的就是
   `web boot: N entry/entries did not activate` + `${name}: pending (waiting for service: …)`，与 crash 日志逐字相同。
3. 桌面壳自带 DSH **0.2.2-rc.1**（asar 内 `dsh/node_modules/@deepseek-ai/*/package.json`）。它那份 `dsh-client-ui-settings/lib/client.js`：
   - 全文 **0 处 `settingsScope`**；
   - 提供 `settingsSchema`（`super(ctx, "settingsSchema")`）与 `configForms`（`super(ctx, "configForms")`）；
   - 自身 `inject = ["remote", "remote.settings"]`。
4. 我本机 npm 全局 CLI 是 **0.1.1-rc.2**，其 `dsh-client-ui-settings\lib\client.js:1139` 为 `super(ctx, "settingsScope")`、`:1327` `inject = ["connection","remote"]`。
   ⇒ 这就是"隔离 profile 能出卡、桌面端必崩"的全部原因：**两套运行时不同名**，我用旧 CLI 验的正是旧语义。
5. 第三方对照：`@linxin666/dsh-client-ui-task-board@0.4.16` 声明 `engines.dsh: ">=0.2.2-rc.1"`，`lib/client.js:15691-15702` 注入的是 `configForms`，没有 `settingsScope`。

## 三问答

### ① `settings` / `settingsScope` 分别由谁提供，为什么现在没有了

- 宿主 `settings`：`@deepseek-ai/dsh-settings`。
- 客户端 `settingsScope`：0.1.x 由 `@deepseek-ai/dsh-client-ui-settings` 的客户端半身提供（`SettingsScopeBinder extends Service`，`super(ctx,"settingsScope")`）。
- 0.2.2-rc.1 起**改名并拆分**为 `configForms`（配置表单）＋ `settingsSchema`（schema 操作），`settingsScope` 这个名字在桌面壳里已不存在。

### ② `dsh.client.inject` 的语义是包名还是服务名

是**客户端模块依赖（包名 / module id）**，不是 cordis 服务名：

- `dsh-client-modules\lib\index.js:125` 解析它，`:398` 存成 `meta.inject`，`:152-160` `graphRow()` 写进图行的 `inject`；
- `:172-193` `orderByModuleGraph` 排序只看 `external`，不看 `inject`；
- 浏览器侧 `dsh-client-modules\lib\client.js:84-95` 读 `row.inject` 供 `require()` 解析，`:259` require 未命中直接抛错。

所以 `package.json` 里那句 `["@deepseek-ai/dsh-client-ui-settings"]` 只是模块依赖声明，和本次崩溃无关；**真正致命的是 `client.js:17` 导出的 `inject = ["slots","settingsScope"]`**（服务声明走 bundle 自己的 `exports.inject`，官方 `dsh-client-ui-settings` `:1359` 也是这么导出的）。

### ③ 「客户端条目不该阻断 web boot」的最小改法候选（未写码）

- **A（推荐）**：`client.js` 导出的 `inject` 只留 `["slots"]`；`apply` 内改成
  `const forms = ctx.get("configForms") ?? ctx.get("settingsScope")`，
  取不到就 `ctx.inject(["configForms"], cb)` 起子 fiber 等它（或两名字各挂一个），卡片延后挂载。任何版本下都不会 pending，也就不会拖死 boot。
  ⚠ 待验：客户端 cordis 里对**未声明**服务调 `ctx.get` 是否安全不抛（宿主侧 0.1.x 已验：不抛、返回 undefined）。
- **B**：保留硬注入、按版本分支——不成立，硬注入本身就会 pending，代码根本执行不到。
- **C**：去掉 `package.json` 的 `dsh.client.immediately: true`。不解决 pending，但能把它从即时预取层摘出去，建议与 A 一起做。
- **D**：向 task-board 看齐，补 `engines.dsh: ">=0.2.2-rc.1"`、只认 `configForms`。代价是旧运行时不再支持。

## 两条附带更正

- 02:14 那次"热重载后能跑"是假象：热重载路径不走 boot 断言，pending 只是静默存在。
- `WARN 设置卡未挂载：宿主无 settings 服务` 是宿主侧另一处判断（`index.js` 内），与本次**客户端条目** pending 不是同一条链路，别混为一谈。

## 给避坑指南的一条硬规矩（建议 K 条新增）

客户端 bundle 绝不把"可选 UI 服务"写进导出的 `inject` 数组——一个插件能把整个 web boot 拖到 fatal；可选依赖一律 `ctx.get()` 探测 + `ctx.inject()` 延后挂载。

## 附加：与社区案例对照（11-14 03:00，大肥鱼提供的外部链接）

逐条核对，三条外部证据与本地取证**同机制、可并案**：

1. `dsh-ego-browser` issue #29（已关闭）：插件把可选服务写进 `inject` → 入口永久 `pending (waiting for service: betterSidebar)`，页面 `Failed to load plugins / 1 entry did not activate`；从 `inject` 删掉后，`ctx.betterSidebar` 直接属性读取立刻报 `cannot get property "betterSidebar" without inject`。社区给出的修法正是"不写进 inject、改用 `ctx.get?.(name)` 读取 + 降级分支"——与本报告方案 A 一致。**这条同时回答了 A 的待验点**：客户端 cordis 的严格代理拦的是 `ctx.X` 属性访问，`ctx.get()` 是安全读法（本地 P17 仍应真机复验一次）。
2. `deepseek-ai/deepseek-harness` discussion #2463：报错形态相同（`pending (waiting for service: remote.scriptLibrary)`）→ web boot 卡死。属同一失败模式，可作第二例。
3. 第三方排障文档（interview-forge、btw-sidebar）：只应在 `inject` 里声明**先于本插件存在**的服务（如 `['slots','remote']`），apply 之后再取其余；client `apply` 抛异常时 boot 审计会拦住整页，属**保护机制**，定位时应看 `web boot:` 报错上方最近一次异常。

需要修正/收紧的两点：

- **本例不是"自等死锁"**：自等死锁是指注入"自己 apply 阶段才安装的服务"。`settingsScope`/`configForms` 由 `@deepseek-ai/dsh-client-ui-settings` 提供，不是我们插件装的；本例的失败形态是**提供者在当前运行时里改名/不存在**。K18 应写成更一般的一句：inject 里只写"当前运行时确实存在、且先于本插件"的服务；对跨版本可能改名的可选 UI 服务一律不进 inject。
- **"把真正的提供者 bundle 排进 `dsh.client.inject`"这条候选不成立**：`dsh.client.inject` 是模块依赖（见本报告 ②），排进去只影响 `require()` 的模块图，不会凭空造出 `settingsScope` 这个服务名，更不能解决改名问题。
