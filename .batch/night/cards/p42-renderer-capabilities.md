# 定性卡 · 渲染层有没有能读文件系统的服务（往下走哪条路）

- 卡号：P42（只读取证，B 类；不改码、不重启宿主、不动 `cordis.patch.yml`）
- 估时：20 分钟
- 派单人：AI writer总负责人
- 时刻：2026-11-16 20:44
- 前置：P41 结论（`.batch/night/staging/p41-dirframe-dig.md`，7,078B / `23285B40EF266F40E526706D6BFECCD3`）——主进程能判目录，但**没有现成下行通道**；渲染层 `kind` 恒 `none`。

## 要回答的四件事（只报事实与位置，不设计实现、不写代码）

1. **渲染层可用服务清单**：在本机 DSH 宿主（`C:\develop\software\DeepSeekHarness\resources\app.asar` 展开后的 dsh 目录，或 profile 端）里，`ctx.get(<name>)` 能拿到哪些服务？把**与文件/工作区/会话相关的名字全部列出来**（例如 `remoteAccess` / `workspaceFiles` / `files` / `fs` / `workspace` / `sessions`…），并标明每个是在宿主源码哪一行注册的、有没有 `list`/`exists`/`stat` 之类方法。
2. **`remoteAccess` 到底有没有**：宿主源码里搜 `remoteAccess` 的注册点，确认它是可选服务（某条件下才注册）还是根本不存在于本宿主版本；给出文件:行。
3. **slot props 里有什么**：`plugins.row.config` 与 `settings.plugin.item` 两个 slot 给注入了哪些 props（尤其是 `ctx`、`sessionMap`、`configForms` 控制器），宿主源码位置；有没有字段能触发一次「让主进程干活」的回调。
4. **主进程下行方案的可行性（只判有无）**：宿主是否允许插件注册自己的 IPC/路由/静态资源（在宿主源码里找插件的 `register` 能力清单），能让主进程把「目录是否可读」的结果传给渲染层。有就给位置，没有就明确写「无」。

## 交付
- 报告：`.batch/night/staging/p42-renderer-capabilities.md`，末行 `<!-- DONE -->`
- 章首：`起点 HEAD=<插件仓库 HEAD>`、`宿主版本=<从 package.json / app.asar 读到的 dsh 版本>`
- 每条必带 `文件:行`；查不到写 `unknown + 原因`，不许猜
- **不改任何代码、不重启宿主、不动配置**
