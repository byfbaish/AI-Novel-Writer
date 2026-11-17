# 插件设置卡片的接法取证（四问）

- 取证时间：2026-11-13 23:20–23:40（Asia/Shanghai）
- 取证方式：只读，未改任何代码、未重启、未动 `cordis.patch.yml`
- 取证对象版本：本机 `@deepseek-ai/dsh` 全局安装树（`C:\Users\<用户名>\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai`），插件版本 `0.1.1-rc.2`
- 结论档位：**② 需构建链**（且有一个硬约束：官方表单模型不能复用）

---

## 一、设置槽位要求的是 React 组件，不是 HTML/字符串

**证据 1 · 槽位声明**：`@deepseek-ai/dsh-client-ui-settings-plugins\lib\types\client\slot-contract.d.ts:16-30`

```ts
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'settings.plugin.item': {
            kind: 'keyed';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
    }
}
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
```

槽位是 Cordis `slots` 的 keyed slot，`owner` props 为空标记类型——**card 的全部内部由贡献方自己画**（同一文件 `:4-5` 原文：「A card draws its own internals; the tab only decides which namespaces to dispatch and stacks what comes back.」）。

**证据 2 · 实际渲染形态**：任何 slot 组件在 DSH 客户端都是 React 组件。已装官方包的 client bundle 首行即 lazy-CJS 工厂，内部 `require("react")` / `require("react/jsx-runtime")`：

- `dsh-client-ui-settings-plugin-inventory\lib\client.js:1-9`：

```js
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-settings-plugin-inventory",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		...
```

结尾 `exports.apply` / `exports.inject` / `exports.NS`（同文件尾 6 行）。

**结论**：不能塞 HTML 字符串、不能塞纯字符串渲染；必须是 React 组件，且必须以 `dsh.client` 浏览器半身的方式交付。

### 配对规则（决定「能不能只做只读」）

`dsh-client-ui-settings-plugins\README.md:9` 原文：

> The configurable tab reads which settings namespaces the Host serves and dispatches one slot key per namespace, so what renders is the intersection of two ledgers: the namespaces a live Host plugin registered, and the cards registered under those keys. **A served namespace no card claims renders nothing** … and a card whose namespace this deployment does not serve is never dispatched.

即：**没有浏览器半身 = 设置页里什么都不会出现**。不存在「Host 注册了 namespace，UI 自动给个只读卡」这条路径。

---

## 二、「只靠配置文件、UI 只读」的既有先例：有，但只读卡是另一个包给的

**先例（本机已装、无浏览器半身）**：逐个读 `package.json` 的 `dsh.client` 字段与 `lib/client.js` 是否存在：

| 插件 | 版本 | `dsh.client` | `lib/client.js` | 设置来源 |
|---|---|---|---|---|
| `dsh-handoff-relay` | 0.3.2 | 无 | 无 | `cordis.patch.yml` 的 `config:` |
| `dsh-win-notify` | 0.1.0 | 无 | 无 | `cordis.patch.yml` 的 `config:` |
| `dsh-whale-widget` | 0.4.2 | 无 | 无 | `cordis.patch.yml` 的 `config:` |
| `superpowers-dsh` | 0.4.0 | 无 | 无 | `cordis.patch.yml` 的 `config:` |

relay 的配置读法可直接印证：`C:\develop\workspace\dsh-handoff-relay\index.js:596-604`

```js
export function apply(ctx, config = {}) {
  ... config.stableMs ...
  const watches = config && Array.isArray(config.watches) ? config.watches : [];
```

它读的是 Cordis 注入的 `config`（即 `cordis.patch.yml` 里该条目的 `config:` 段），**完全不走 settings 文档**。

**管理界面对它们的呈现**：`@deepseek-ai/dsh-client-ui-settings-plugin-inventory`（README 首行「Read-only **Plugin list** tab」）提供一张只读目录卡：短模块名、启用态、彩色 root-fiber 状态点，展开后显示 Loader entry id、**有效配置**、Cordis 状态；数据来自 `ctx.remote.pluginInventory.list()`（`dsh-host-plugin-inventory`）。README 明确写「Read-only Loader view … no plugin mutation controls」。

**结论**：①设「只靠配置文件 + 管理界面只读」这件事已经被官方 inventory 页覆盖，不需要自己写卡；②但它的只读卡是**官方包**，不是第三方能「注册一个只读 namespace 就得到」的能力。

---

## 三、本机已装插件里 client 侧产物的先例（都要构建链）

| 插件 | client 入口 | 构建方式（`package.json` scripts） |
|---|---|---|
| `dsh-better-sidebar` 0.30.1 | `./lib/client.js` | `tsc -p tsconfig.build.json && tsdown` |
| `dsh-context` 0.83.1 | `./lib/client.js` | `tsdown` |
| `dshmarket` 1.73.13 | `./client/client.js` | `build:client = tsdown && node scripts/normalize-client-banner.mjs` |
| `dsh-ops` 0.5.2 | `./lib/client.js` | `build = node scripts/build.mjs`（自写脚本） |
| `dsh-vision-router` 3.2.0 | `./lib/client.js` | `build = node scripts/build-source-artifacts.mjs`（自写脚本） |
| `ds-bot` 0.3.5 | `./client.js` | `build = node scripts/build-client.mjs`（内部用 esbuild） |
| `billion-context` 0.1.213 | `./dist/agent/dsh-native-client.js` | `tsup` + 若干自写检查脚本 |

共同特征：**没有一个第三方插件是「手写 client.js 不用构建」的**；构建工具集中在 `tsdown`（官方预设的名字），自写脚本的也都包了一层 esbuild/tsdown。

---

## 四、最小依赖集合：React 由宿主提供，但必须有一个打包器

### 4.1 由 shell 播种、不用打进包里（也不用写成 dependency）

从 shell 包 `dsh-web-frontend\dist\assets\index-ClqxG24t.js` 里抽出静态模块表的键：

```
@deepseek-ai/cordis
@deepseek-ai/dsh-client-ui-primitives
@deepseek-ai/dsh-client-ui-slots
react
react-dom
react-dom/client
react/jsx-runtime
```

与 `dsh-client-modules\README.md` 原文一致：

> `dsh.client.external` is an optional exact-specifier request list beyond the implicit baseline: **shell-seeded React, Cordis, and static UI libraries** plus parser-preloaded runtime.

即 React、`react-dom`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`（现成 UI 组件）、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/cordis` 都可以直接 `require`，宿主已提供；**不需要**在 `dependencies` 里声明，也不需要打进 bundle。超出这几个的额外包才要写进 `dsh.client.external`。

### 4.2 必须自己解决的部分

`dsh-client-ui-settings-plugins\README.md:38`（Known Limitations 第 2 条）原文：

> **A card still needs a browser bundle** — the browser half must be a `dsh.client` package built in the client module system's lazy-CJS factory format, and the `clientBundle` preset that emits it lives in `packages/client/tsdown.client.ts` **rather than a published package, so a plugin outside this repository has to reproduce that build itself**. The bundle-purity gate also **forbids importing this package's card chrome or form model as values**, so such a card owns its own staging and revision fencing.

拆成四条硬事实：

1. 产物格式：lazy-CJS 工厂（`window.__ModuleLoader__.load({ id, factory })`），**不是普通 ESM**；
2. 官方的 `clientBundle` 预设**没有发布**，仓库外插件要自己重现这套构建；
3. **不能复用** `dsh-client-ui-settings-plugins` 的卡片外观或表单模型（`CardForm`、`numberField`/`textField` 都是 value import，会被 purity gate 拒），暂存（staged）+ revision fencing 要自己写；
4. 所以 `dsh-client-ui-settings-plugins` 只能作 `devDependencies` 里的**类型**来源（type-only import 会被擦除、不产生请求）。

### 4.3 手写工厂能不能绕开构建链

格式本身是纯文本包裹，理论上可以手写：

```js
window.__ModuleLoader__.load({
  id: "dsh-handoff-relay",
  factory: (require) => {
    const React = require("react");
    const jsx = require("react/jsx-runtime");
    // ...
    return { apply, inject };
  }
});
```

不成立为**推荐路线**，理由：①无 JSX/TS 转译，复杂卡片要靠 `React.createElement` 手搓；②没有构建期校验，格式或 purity 违规只能在运行时炸；③官方明确说「要自己重现构建」，没有任何已发布的校验器能告诉你手写件对不对。**只在「一张极小的只读卡」时作为兜底考虑**，且必须真机验。

---

## 五、三档结论

**② 需构建链。**

- 设置卡片 = React 组件 + `dsh.client` 浏览器半身 + lazy-CJS 工厂 bundle；
- React / react-dom / jsx-runtime / primitives / slots / cordis 由宿主提供，不进 bundle、不进依赖；
- 打包器要自己搭（官方 `tsdown.client.ts` 预设未发布），本机同类插件的实际做法见第三节；
- 表单模型（暂存、revision fencing、reset-to-composed）**必须自写**，不能 import `dsh-client-ui-settings-plugins/client`。

**③ 只能退化为文件编辑 + 重启生效** 也真实可用：现状就是这样（`cordis.patch.yml` 的 `config:`，改完重启），管理界面里靠官方 inventory 页只读查看有效配置。若二期的目标是「少改文件、少重启」，那 ③ 不满足目标；若只需要「看得见当前配置」，③ 已经免费得到。

**① 无需构建链直接做** 不成立（第 4.2 条 1、2 两条共同否掉）。

---

## 六、对二期排期的直接影响（只报事实，不含排期决定）

- 主项 A（React 设置卡片）的成本主体不是 UI，而是**一次性的构建链搭建**（复现 lazy-CJS 工厂产物 + purity 约束自检）＋ 自写表单模型（暂存/回写/重置/revision 冲突）。UI 本身因为 primitives 是现成的，反而便宜。
- 卡片要能出现，Host 侧必须先用 `ctx.settings.register(...)` 注册一个 namespace（`dsh-settings\lib\types\index.d.ts:3-5`：「per-namespace sections; plugins register a namespace schema and read the …」），并且 relay 目前的 `config.watches` 与 settings namespace 是两套通道——**接卡片意味着要把 watches 的读写迁到 settings 文档**（或在卡片里同时写两处），这是一次数据源变更，不是纯加 UI。
- 若二期先要「可见不可改」，用官方 inventory 页即可，零成本，但只能看到 `config:` 原文。

<!-- DONE -->

---

# 追加（23:38）· (甲)/(乙) 二选一与最小产物、分钟数

## 结论：(甲) 可行，(乙) 不必

关键前提一条：`settings.plugin.item` 是**按 namespace 派发**的 keyed slot，没有 Host 注册的 namespace，卡片**永不渲染**（`dsh-client-ui-settings-plugins\README.md:9`）。所以「甲」不是「不碰 settings」，而是：**把 settings 当编辑通道，把 yml 当唯一运行时真相**。

最小闭环：

1. Host 侧 `ctx.settings.register(namespace, …)`，注册时用 `cordis.patch.yml` 的 `watches` **播种**（yml 有、doc 没有就写进去；doc 与 yml 冲突以 yml 为准）。
2. 卡片用官方客户端 API `ctx.settingsScope.bind({ namespace })` 读写——同一 bundle `dsh-client-ui-settings-plugins\lib\client.js:1235-1237` 给 bash / agent-loop / web-search 三张卡用的就是它，`:1241` 用 `ctx.settingsScope.describe()`。**不是自建通道**。
3. 用户保存 → settings doc 变更 → 插件 `observe` 到 → **写回 yml**。relay 运行期仍只读 `config.watches`（`index.js:596-604`），不新增第二份运行时输入。

不需要自建 typert 远程投影：那套要 `@deepseek-ai/dsh-typert-generator` 产出的 `TYPERT`/`TYPERT_REMOTE` 声明物，本机只有 `dsh-typert-loader` / `-protocol` / `-registry`，**没有 generator**，手写生成物属未文档化路径，不推荐。

## 最小产物：不打包也能做

`dsh-client-modules\README.md:11` 写的是运行时解析顺序（platform seed word → shell instance → 记忆化记录 → 图行 → 已注册工厂 → 抛错），注释原话「the runtime mirror of the build-time bundle purity gate」。也就是说 purity 闸在运行时同样生效：**只要 factory 只 require 宿主播种过的 specifier，手写也能过**。

- 手写即可：单个 `exports["./client"]` 指向的 JS，内容是 `window.__ModuleLoader__.load({ id, factory })`，工厂里 `require("react")` / `require("react/jsx-runtime")` / `@deepseek-ai/dsh-client-ui-primitives` / `@deepseek-ai/dsh-client-ui-slots`（`:7` 要求模块体副作用都在 factory 闭包内）。
- 打包只在想写 JSX/TS 时才需要。本机**没有** esbuild/tsdown/tsup/rollup/vite（全局 npm 与 `profiles\desktop\node_modules` 都查过），那一步要现装。

## 分钟数

| 项 | 分钟 |
|---|---|
| 手写 client entry（React.createElement，无 JSX） | 40–60 |
| 装打包器 + 配一次（仅走 JSX/TS 路线才需要） | +30–40 |
| 真机装载 + 三条 watch 往返验证 | +30 |

手写路线合计 **约 90–120 分钟**（不含 QA 验收）；走打包多 30–40 分钟，且多一份工具链维护面。
