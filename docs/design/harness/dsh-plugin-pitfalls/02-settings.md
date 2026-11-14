# 02 · 设置卡与依赖解析

> 状态：已实施（2026-11-14）
> 日期：2026-11-14
> 上级索引：[README.md](README.md) · 对应事故：P14「设置页能看见卡」为何仍是真机项

## K06 · `ERR_MODULE_NOT_FOUND`，但 profile 里明明装了

- **现象**：仓库目录 `import('@deepseek-ai/schemastery')` 报 `ERR_MODULE_NOT_FOUND`，而 `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\package.json` 存在（3.19.0）。
- **根因**：插件以仓库**真实路径**被加载，Node 从这个目录逐级往上找 `node_modules`，永远走不到 profile 那一份；不是「缺依赖」，是**解析基线站错了地方**。
- **解法**：用 `createRequire(path.join(<profile 根>, 'package.json'))` 解析（P14 采用），或从宿主服务取 schema 构造器；两条都要在报告里写明「走哪条基线、解到的绝对路径」。

## K07 · 把「Test-Path False」当成「宿主没带这个包」

- **现象**：判定宿主缺 `schemastery`，接着开始想办法往仓库里装。
- **根因**：asar 是**单个文件**不是目录，文件系统 `Test-Path` 对 asar 内路径必然 False；要判 asar 内容得读清单，不能查文件系统。
- **解法**：先查 asar 清单确认宿主是否随包分发；**绝不** `npm install` 到插件仓库（会写脏 `node_modules` 联结），**不改** `package.json` 加依赖来「解决」解析问题。

## K08 · 「只做只读展示的界面」也是有成本的 client 侧

- **现象**：方案里写「一期只做个只读列表，零成本、不引依赖」，评审时被否。
- **根因**：`settings.plugin.item` 槽位要的是 **React 组件**，任何可见 UI 都在 client 侧、都要打包；不存在「零成本的只读界面」。
- **解法**：一期不上界面，只做 Host 侧启动校验 + 日志（把解析结果逐条记一行、失效才 warn）；界面单独立卡、按 client 打包，且在设计稿里标注「二期实现」。

## K09 · 验收「卡片挂上了没」：看错标签页

- **现象**：截图里官方自带「插件列表」标签页能看到 handoff-relay（已启用/已挂载），被当成「卡片挂载成功」的证据。
- **根因**：任何已安装插件都会列在「插件列表」里，那一栏只证明**装上了**；设置卡是否真的渲染出来，只看得到插件自己声明的配置项。
- **解法**：验收一律点**「插件配置」**标签页，看到该插件自己的配置项才算卡片挂上；「插件列表」只能证明安装状态，不算证据。

## K10 · profile patch 里用 `- insert:` 加同 id 项

- **现象**：在 `cordis.patch.yml` 里用 `- insert:` 追加一条插件配置，启动报 `duplicate loader entry id`。
- **根因**：profile patch 以 `id` 为键做**覆盖合并**，`insert` 走的是新增语义，撞上已存在的同名 `id` 即报重复，不是 YAML 语法问题。
- **解法**：改已有项用 `- id: <既有 id>` + 要覆盖的字段；确实要新增才用 `- insert:`，且 id 不得与任何已加载项重名。

## K11 · 「插件配置」页没卡，就判 namespace 没注册

- **现象**：设置页看不到自己的卡，`relay.log` 干净、settings.register 没抛异常，于是判「namespace 没注册」或「挂载时序不对」，换着法试。
- **根因**：渲染层把槽位内的异常整个吞掉，只对外剩下「没卡」这一个现象；namespace 没注册、注册了但没进 `describe()`、进了也派发了但卡片自身抛错 —— 三种状态在 UI 上长得完全一样。
- **解法**：三步分开查：①`POST /api/settings.describe` 看返回里有没有自己的 namespace；②开控制台看有没有 `slot entry crashed in 'settings.plugin.item'` 及栈顶 `client.js:行`；③两者都正常才去查时序。不看控制台永远只能看到「没卡」。

## K12 · 改了插件代码、重启后行为没变

- **现象**：改完 `client.js` / `index.js` 并重启，页面表现和改之前一模一样（常见表现就是「卡片没出现」），日志里也没有新行。
- **根因**：两条并存。① profile 里 `.pnpm` 那份副本与仓库是硬链接，实例启动后 pnpm 会从内容寻址仓库**重新物化成旧字节**，服务端于是一直发旧文件。② 页面缓存了旧的 `client.js`，表现同样像「没卡」。
- **解法**：改码后先 `dsh plugin --profile <profile名> install` 刷新，再按 `git hash-object` 比 blob 与仓库一致（工作区因 `core.autocrlf=true` 字节数不同，别横比工作区 md5）后启动；页面侧记下网络面板实际加载的 `?rev=`，它就是**被服务那份字节的 sha1 前 12 位**，要拿服务端实际发出的那份算才比得上。

## K21 · 客户端导出 `inject` 写了旧服务名：整页 `web boot: 1 entry did not activate`

- **现象**：桌面 DSH（0.2.2-rc.1）启动报 `Error: web boot: 1 entry did not activate`，紧跟 `dsh-handoff-relay: pending (waiting for service: settingsScope)`；同一插件在 npm 全局 CLI（0.1.1-rc.2）里却能正常出卡。
- **根因**：0.2.2-rc.1 的 `dsh-client-ui-settings` 已改用 `configForms` + `settingsSchema`，全包**一处 `settingsScope` 都没有**；`client.js` 导出的 `inject = ["slots","settingsScope"]` 是**硬依赖**，缺服务即永久 pending，渲染层 `assertEntriesActive` 抛错 → `bootFailed` IPC → 主进程打出那行（`app.asar/lib/main.js` 只是报错出口，不是失败起点）。`package.json#dsh.client.inject` 是**模块依赖**语义，不决定这个 pending。
- **解法**：客户端导出 `inject` 只写**当前运行时确实存在、且先于本插件**的服务（如 `["slots"]` 这类槽位服务）；可选 UI 服务用 `ctx.get("configForms") ?? ctx.get("settingsScope")` 取，取不到再 `ctx.inject([...], cb)` 延后挂卡；**不要**按版本硬分支（pending 在 apply 之前发生，分支跑不到）；`dsh.client.immediately` 一并去掉。把提供者包排进 `dsh.client.inject` **不解决**问题——那是模块依赖，只影响 `require()` 图，造不出服务名。