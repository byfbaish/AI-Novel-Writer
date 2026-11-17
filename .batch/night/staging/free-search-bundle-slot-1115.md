# 调查：dsh-free-search 为何除最深一级配置页外，README 页还多一块配置页

- 派单人：用户（群内 m00072，cc 大肥鱼 / AI writer总负责人）
- 调查人：developer（只读取证，未改任何在跑进程、未动仓库）
- 时间：2026-11-15 04:3x
- 级别：B 类草稿（不产生仓库提交）

## 一句话结论

**不是 bug，是插件主动占了两个 seat。** dsh-free-search 同时注册了行级 `plugins.row.config`（最深的行详情页）与 bundle 级 `plugins.bundle.config`（以包名为 key，渲染在 bundle 详情页「描述之后、行列表之前」）。后者就是用户在 README 页看到的那块。宿主契约写明 bundle 级配置本来就该长在 bundle 页上。

## 证据

### 1. 宿主契约（`dsh/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/README.md`）

- :89「A plugin that carries its own configuration renders it on this page rather than in Settings, through three slots the page declares: `plugins.item` (list) for an official plugin, listed in Built-in plugin settings by its `label`; `plugins.bundle.config` (keyed by the bundle's package name) for a bundle's own configuration, **shown on the bundle's page between its description and its rows**; and `plugins.row.config` (keyed by `<package name>#<row id>`) for one row's configuration, which gives that row a **Configure** control opening the row's page.」
- :151 三个 slot 由 page 的 `main` 注册声明为 child，注册方 `ctx.slots.inject` 等它出现。
- :153「`plugins.bundle.config` supplies bundle detail configuration, keyed by npm package name.」

### 2. 宿主渲染位置（`...dsh-client-ui-plugin-manager/lib/client.js`，asar 抽出）

```js
6015  (0, react_jsx_runtime.jsxs)("div", { className: detailSections, children: [
6018      detail,                       // ← 描述 / README 区
6019      configured ? (0, react_jsx_runtime.jsx)("section", {
6020          className: detailSection,
6021          "data-plugin-config": true,
6022          children: renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })
6023      }) : null,
6024      pkg.availability === "missing" ? null : (0, react_jsx_runtime.jsx)(RowsSection, { ... })
```
`:92` slot 名在声明列表里；`:122` collector `bundles: keysOf("plugins.bundle.config")`；`:7776` slot 声明。→ bundle 页的顺序固定是 **描述 → bundle 配置 → 行列表**，所以看起来「README 页里塞了一块配置表单」。

### 3. 插件侧注册（`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-free-search`，v0.9.48，普通目录非 Junction）

`cordis.patch.yml` 只有一行 insert：`- id: web-search-free / name: dsh-free-search / config: { disabledEngines: [], bingMarket: zh-CN }`。

`lib/client.js:3287` `const inject = ["slots", "commandUi"];`，`apply(ctx)` 内两次注册：

```js
3294-3305  ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
              name: "plugins.row.config", key: "<包名>#<行 id>" },   // 值为 dsh-free-search + "#" + web-search-free
              p => p && p.view === "summary" ? summaryText() : jsx(FreeSearchCard, { page: true })))
3314-3325  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
              name: "plugins.bundle.config", key: "dsh-free-search" },
              p => p && p.view === "summary" ? summaryText() : jsx(FreeSearchCard, { page: true })))
```
源码注释（#101）自述：「also claim the bundle-level seat (keyed by the package name) so the card renders on the bundle page itself, between the description and the rows. The row-level seat stays registered for the older entry point.」

→ 两块是**同一个组件 `FreeSearchCard` 挂两个座位**，所以内容一致、只是位置不同：行详情页那块是「老入口」，bundle 页那块是新加的。

### 4. 版本门槛

`dsh-free-search/package.json`：`dsh.bundle.patch = cordis.patch.yml`；peerDeps 含 `@deepseek-ai/dsh-client-ui-plugin-manager ^0.1.7-rc.1 || ^0.2.0-rc.1`，`dsh.client.inject` 含 `dsh-client-ui-plugin-manager`。bundle seat 依赖宿主有该 slot（宿主 client.js 已确认有）。

## 对本项目的可复用结论

我方 `C:\develop\workspace\dsh-handoff-relay\client.js` **只注册了行级 seat**：

```js
657  mountLegacy(ctx, service)   → ctx.slots.register({ name: "settings.plugin.item", key: SETTINGS_NS /* dsh-handoff-relay */ }, RelayCard)   // 旧宿主
666  mountRowConfig(ctx, forms)  → ctx.slots.register({ name: "plugins.row.config", key: ROW_CONFIG_KEY /* 按 <包名>#<行 id> */, order: 10, locale: SETTINGS_NS }, SettingsCard)
```
`cordis.patch.yml` 行 id = `dsh-handoff-relay`。**没有 `plugins.bundle.config`** —— 这正是我方设置卡只出现在最深一级、bundle（README）页没有卡的原因。

若要「bundle 页也显示设置卡」（可选增强，非缺陷）：在 `mountRowConfig` 旁加一次
```js
ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
  name: "plugins.bundle.config", key: "dsh-handoff-relay", order: 10, locale: SETTINGS_NS,
  inject: () => ({ ctx, controller }),
}, SettingsCard));
```
注意两点：① bundle 页 `view` 收的是 `{ view: "page" }`，与行页一致，卡片要有自己的保存按钮；② 同一表单挂两处要注意两处状态不同步（Pending 编辑各自一份），我方卡片目前是一次性读 config + 显式保存，风险可控。属**改码**，需开 A 类卡，不在本任务内动仓库。

## Backlog 条目（待落 `docs/plans/prompt-assembly-backlog.md`，入仓库须开卡）

> **UI-Next（低优先，待排期）：dsh-handoff-relay 是否补注册 `plugins.bundle.config`**
> 缘起：2026-11-15 用户问「dsh-free-search 为什么 README 页还有一块配置页」，查明是插件同时占了 row + bundle 两个 seat；我方只占了 row seat，因此卡只出现在最深层。
> 现状：`client.js:666 mountRowConfig` 只注册 `plugins.row.config`；宿主 `dsh-client-ui-plugin-manager` 支持 bundle seat（client.js:6022）。
> 目标：如需在 bundle 详情页（含 README）也能配置，加一次 `plugins.bundle.config` 注册，key 用包名 `dsh-handoff-relay`。
> 验收：插件页进入 bundle 详情，描述与行列表之间出现设置卡；行详情页原卡不回归。
> 风险：两处同一表单，编辑状态各自独立；须确认不会双写覆盖。

## 边界声明

- 只读：未改 profile 配置、未动插件目录、未重启宿主、未提交任何仓库文件。
- 结论基于 asar 抽出源码与已装插件源码，非界面实测推断。

<!-- DONE -->
